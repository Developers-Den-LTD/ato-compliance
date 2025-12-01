/**
 * STIG Mapping Service
 * Handles STIG profile to NIST control mapping and automatic control assignment
 * Follows CLAUDE.md data consistency patterns
 */

import { db } from '../db';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { 
  stigRules, 
  stigRuleControls, 
  controls, 
  systems, 
  systemControls,
  systemStigProfiles 
} from "../schema";

export interface StigMapping {
  stigRuleId: string;
  controlId: string;
  rationale: string;
}

export interface StigProfile {
  stigId: string;
  stigTitle: string;
  version: string;
  category: string;
  mappedControls: string[];
}

export class StigMappingService {
  /**
   * Get STIG profiles mapped to controls for a given category
   */
  async getStigProfilesByCategory(category: string): Promise<StigProfile[]> {
    const categorizeProfile = (stigId: string): string => {
      const id = stigId.toUpperCase();
      if (id.includes('WEB') || id.includes('DATABASE') || id.includes('APP')) {
        return 'Application';
      } else if (id.includes('WINDOWS') || id.includes('RHEL') || id.includes('UBUNTU') || id.includes('LINUX')) {
        return 'Operating System';
      } else if (id.includes('CISCO') || id.includes('FIREWALL') || id.includes('ROUTER') || id.includes('SWITCH')) {
        return 'Network Device';
      } else if (id.includes('IOS') || id.includes('ANDROID') || id.includes('MOBILE')) {
        return 'Mobile Device';
      } else if (id.includes('AWS') || id.includes('AZURE') || id.includes('CLOUD') || id.includes('GCP')) {
        return 'Cloud';
      }
      return 'Other';
    };

    // Get all unique STIG profiles from database
    const allStigRules = await db
      .select({
        stigId: stigRules.stigId,
        stigTitle: stigRules.stigTitle,
        version: stigRules.version,
        controlId: stigRuleControls.controlId
      })
      .from(stigRules)
      .leftJoin(stigRuleControls, eq(stigRules.id, stigRuleControls.stigRuleId));

    // Filter by category
    const stigProfilesWithControls = allStigRules.filter(row => 
      categorizeProfile(row.stigId) === category
    );

    // Group by STIG profile
    const profileMap = new Map<string, StigProfile>();
    
    for (const row of stigProfilesWithControls) {
      const key = row.stigId;
      if (!profileMap.has(key)) {
        profileMap.set(key, {
          stigId: row.stigId,
          stigTitle: row.stigTitle || '',
          version: row.version || '',
          category,
          mappedControls: []
        });
      }
      
      if (row.controlId) {
        profileMap.get(key)!.mappedControls.push(row.controlId);
      }
    }

    return Array.from(profileMap.values());
  }

  /**
   * Get all controls mapped to a specific STIG profile
   */
  async getControlsForStigProfile(stigProfileId: string): Promise<any[]> {
    // First get all rules for this STIG profile
    const rules = await db
      .select({
        ruleId: stigRules.id
      })
      .from(stigRules)
      .where(eq(stigRules.stigId, stigProfileId));
    
    if (rules.length === 0) {
      console.log(`No rules found for STIG profile: ${stigProfileId}`);
      return [];
    }
    
    // Then get all controls mapped to these rules
    const ruleIds = rules.map(r => r.ruleId);
    return await db
      .select({
        controlId: controls.id,
        controlTitle: controls.title,
        controlFamily: controls.family,
        rationale: stigRuleControls.rationale
      })
      .from(stigRuleControls)
      .innerJoin(controls, eq(stigRuleControls.controlId, controls.id))
      .innerJoin(stigRules, eq(stigRuleControls.stigRuleId, stigRules.id))
      .where(
        and(
          inArray(stigRuleControls.stigRuleId, ruleIds),
          eq(stigRules.stigId, stigProfileId)
        )
      );
  }

  /**
   * Assign STIG-mapped controls to a system when STIG profiles are selected
   */
  async assignStigControlsToSystem(systemId: string, stigProfiles: string[]): Promise<number> {
    let assignedCount = 0;

    for (const stigProfileId of stigProfiles) {
      // Get all controls mapped to this STIG profile
      const mappedControls = await this.getControlsForStigProfile(stigProfileId);
      
      for (const control of mappedControls) {
        try {
          // Check if control is already assigned to this system
          const existingAssignment = await db
            .select()
            .from(systemControls)
            .where(
              and(
                eq(systemControls.systemId, systemId),
                eq(systemControls.controlId, control.controlId)
              )
            )
            .limit(1);

          if (existingAssignment.length === 0) {
            // Assign the control with STIG source
            await db.insert(systemControls).values({
              systemId,
              controlId: control.controlId,
              status: 'not_implemented',
              implementationText: `Auto-assigned from STIG profile. ${control.rationale}`,
              source: 'stig',
              lastUpdated: new Date()
            });
            
            assignedCount++;
          }
        } catch (error) {
          console.error(`Error assigning control ${control.controlId} to system ${systemId}:`, error);
          // Continue with other controls even if one fails
        }
      }
    }

    return assignedCount;
  }

  /**
   * Update system STIG profiles and assign mapped controls
   */
  async updateSystemStigProfiles(
    systemId: string, 
    stigProfiles: string[], 
    autoStigUpdates: boolean = true
  ): Promise<{ assigned: number; profiles: string[] }> {
    // Update system with STIG profiles
    await db
      .update(systems)
      .set({
        stigProfiles,
        autoStigUpdates,
        lastStigUpdate: new Date()
      })
      .where(eq(systems.id, systemId));

    // Update system_stig_profiles junction table
    // First, remove existing profiles for this system
    await db
      .delete(systemStigProfiles)
      .where(eq(systemStigProfiles.systemId, systemId));

    // Insert new profiles
    if (stigProfiles.length > 0) {
      const profileRecords = stigProfiles.map(stigId => ({
        systemId,
        stigId,
        autoUpdate: autoStigUpdates,
        assignedAt: new Date()
      }));

      await db.insert(systemStigProfiles).values(profileRecords);
    }

    // Assign controls from STIG profiles
    const assignedCount = await this.assignStigControlsToSystem(systemId, stigProfiles);

    return {
      assigned: assignedCount,
      profiles: stigProfiles
    };
  }

  /**
   * Get system with its STIG profiles and control assignments
   */
  async getSystemWithStigProfiles(systemId: string): Promise<any> {
    // Get system details
    const system = await db
      .select()
      .from(systems)
      .where(eq(systems.id, systemId))
      .limit(1);

    if (system.length === 0) {
      return null;
    }

    // Get STIG profiles for this system
    const profiles = await db
      .select({
        stigId: systemStigProfiles.stigId,
        version: systemStigProfiles.version,
        autoUpdate: systemStigProfiles.autoUpdate,
        assignedAt: systemStigProfiles.assignedAt
      })
      .from(systemStigProfiles)
      .where(eq(systemStigProfiles.systemId, systemId));

    // Get control assignments from STIG
    const stigControls = await db
      .select({
        controlId: systemControls.controlId,
        status: systemControls.status,
        implementationText: systemControls.implementationText,
        controlTitle: controls.title,
        controlFamily: controls.family
      })
      .from(systemControls)
      .innerJoin(controls, eq(systemControls.controlId, controls.id))
      .where(
        and(
          eq(systemControls.systemId, systemId),
          eq(systemControls.source, 'stig')
        )
      );

    return {
      ...system[0],
      stigProfiles: profiles,
      stigControlAssignments: stigControls
    };
  }

  /**
   * Create a new STIG to control mapping
   */
  async createStigControlMapping(
    stigRuleId: string, 
    controlId: string, 
    rationale: string
  ): Promise<void> {
    await db.insert(stigRuleControls).values({
      stigRuleId,
      controlId,
      rationale
    });
  }

  /**
   * Get all STIG mappings for reporting/analysis
   */
  async getAllStigMappings(): Promise<StigMapping[]> {
    const mappings = await db
      .select({
        stigRuleId: stigRuleControls.stigRuleId,
        controlId: stigRuleControls.controlId,
        rationale: stigRuleControls.rationale
      })
      .from(stigRuleControls);

    return mappings.map(m => ({
      stigRuleId: m.stigRuleId,
      controlId: m.controlId,
      rationale: m.rationale || ''
    }));
  }

  /**
   * Remove STIG controls from a system
   */
  async removeStigControlsFromSystem(systemId: string): Promise<number> {
    const result = await db
      .delete(systemControls)
      .where(
        and(
          eq(systemControls.systemId, systemId),
          eq(systemControls.source, 'stig')
        )
      );

    return result.length || 0;
  }
}
