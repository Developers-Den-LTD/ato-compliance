import { eq, sql, and, inArray } from 'drizzle-orm';
import { db } from '../db';
import { stigRules, ccis, stigRuleCcis, stigRuleControls, controls, systemStigProfiles } from '../schema';

export interface STIGProfile {
  stigId: string;
  stigTitle: string;
  version: string;
  ruleType: string;
  totalRules: number;
  category?: string;
}

export interface STIGRuleWithMappings {
  id: string;
  stigId: string;
  stigTitle: string;
  version: string;
  title: string;
  description: string;
  severity: string;
  ruleType: string;
  ccis: Array<{
    cci: string;
    definition: string;
    controlId: string;
  }>;
  controls: Array<{
    id: string;
    title: string;
    family: string;
  }>;
}

export class STIGService {
  // Get all available STIG profiles
  async getSTIGProfiles() {
    const profiles = await db
      .select({
        stigId: stigRules.stigId,
        stigTitle: stigRules.stigTitle,
        version: stigRules.version,
        ruleType: stigRules.ruleType,
        totalRules: sql<number>`count(*)::int`,
      })
      .from(stigRules)
      .groupBy(stigRules.stigId, stigRules.stigTitle, stigRules.version, stigRules.ruleType)
      .orderBy(stigRules.stigId);

    return profiles;
  }

  // Get STIG profiles by category (OS type, etc.)
  async getSTIGProfilesByCategory(category?: string) {
    // For now, return all profiles
    // In a real implementation, you'd filter by category from metadata
    return this.getSTIGProfiles();
  }

  // Get severity breakdown for a STIG profile
  async getSeverityBreakdown(stigId: string) {
    const severityCounts = await db
      .select({
        severity: stigRules.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(stigRules)
      .where(eq(stigRules.stigId, stigId))
      .groupBy(stigRules.severity);

    // Map severity to standard categories (CAT I = High, CAT II = Medium, CAT III = Low)
    const breakdown = {
      high: 0,
      medium: 0,
      low: 0,
    };

    severityCounts.forEach((s) => {
      const severity = s.severity.toLowerCase();
      if (severity.includes('cat i') || severity.includes('high') || severity === 'cat_i') {
        breakdown.high = s.count;
      } else if (severity.includes('cat ii') || severity.includes('medium') || severity === 'cat_ii') {
        breakdown.medium = s.count;
      } else if (severity.includes('cat iii') || severity.includes('low') || severity === 'cat_iii') {
        breakdown.low = s.count;
      }
    });

    return breakdown;
  }

  // Get available profiles for system registration (formatted for frontend)
  async getAvailableProfilesForCategory(category?: string, operatingSystem?: string) {
    const profiles = await this.getSTIGProfiles();
    
    // Smart mapping based on category and OS/Platform
    const profileMapping: Record<string, Record<string, string[]>> = {
      'Operating System': {
        'Ubuntu': ['Ubuntu-24.04-STIG', 'JSIG-General'],
        'RHEL': ['RHEL-8-STIG', 'JSIG-General'],
        'CentOS': ['RHEL-8-STIG', 'JSIG-General'], // CentOS uses RHEL STIG
        'Windows Server': ['Windows-Server-2022-STIG', 'JSIG-General'],
        'Windows 10/11': ['Windows-Server-2022-STIG', 'JSIG-General'],
        'default': ['JSIG-General'], // Fallback for other OS
      },
      'Application': {
        'Apache Web Server': ['Apache-2.4-STIG', 'JSIG-General'],
        'Nginx': ['JSIG-General'],
        'PostgreSQL': ['JSIG-General'],
        'MySQL': ['JSIG-General'],
        'MongoDB': ['JSIG-General'],
        'Docker': ['JSIG-General'],
        'Kubernetes': ['JSIG-General'],
        'default': ['JSIG-General'],
      },
      'Network Device': {
        'default': ['JSIG-General'],
      },
      'Mobile Device': {
        'default': ['JSIG-General'],
      },
      'Cloud': {
        'default': ['JSIG-General'],
      },
    };

    let allowedProfiles: string[] = [];

    if (category) {
      const categoryMap = profileMapping[category];
      if (categoryMap) {
        // If OS/Platform is specified, use it for more specific matching
        if (operatingSystem) {
          // Try exact match first
          allowedProfiles = categoryMap[operatingSystem] || categoryMap['default'] || [];
          
          // If no exact match, try partial match (e.g., "Windows Server 2022" matches "Windows Server")
          if (allowedProfiles.length === 0 || (allowedProfiles.length === 1 && allowedProfiles[0] === 'JSIG-General')) {
            for (const [key, value] of Object.entries(categoryMap)) {
              if (key !== 'default' && (operatingSystem.includes(key) || key.includes(operatingSystem))) {
                allowedProfiles = value;
                break;
              }
            }
          }
        } else {
          // No OS specified, return all profiles for this category
          allowedProfiles = Object.values(categoryMap).flat();
          // Remove duplicates
          allowedProfiles = [...new Set(allowedProfiles)];
        }
      }
    }

    // Filter and format profiles
    const filteredProfiles = allowedProfiles.length > 0
      ? profiles.filter(p => allowedProfiles.includes(p.stigId))
      : profiles;

    // Get severity breakdown for each profile
    const profilesWithSeverity = await Promise.all(
      filteredProfiles.map(async (p) => {
        const severityBreakdown = await this.getSeverityBreakdown(p.stigId);
        return {
          stig_id: p.stigId,
          stig_title: p.stigTitle,
          version: p.version,
          rule_type: p.ruleType,
          total_rules: p.totalRules,
          category: this.getCategoryForProfile(p.stigId),
          applicable_os: this.getApplicableOS(p.stigId),
          severity_breakdown: severityBreakdown,
        };
      })
    );

    return profilesWithSeverity;
  }

  private getCategoryForProfile(stigId: string): string {
    if (stigId.includes('Ubuntu') || stigId.includes('RHEL') || stigId.includes('Windows')) {
      return 'Operating System';
    }
    if (stigId.includes('Apache')) {
      return 'Application';
    }
    return 'General';
  }

  private getApplicableOS(stigId: string): string[] {
    const osMapping: Record<string, string[]> = {
      'Ubuntu-24.04-STIG': ['Ubuntu'],
      'RHEL-8-STIG': ['RHEL', 'CentOS'],
      'Windows-Server-2022-STIG': ['Windows Server', 'Windows 10/11'],
      'Apache-2.4-STIG': ['Apache Web Server'],
      'JSIG-General': ['All'],
    };
    return osMapping[stigId] || ['All'];
  }

  // Get rules for a specific STIG profile
  async getSTIGRules(stigId: string, limit?: number, offset?: number) {
    let query = db
      .select()
      .from(stigRules)
      .where(eq(stigRules.stigId, stigId))
      .orderBy(stigRules.severity, stigRules.id);

    if (limit) {
      query = query.limit(limit);
    }
    if (offset) {
      query = query.offset(offset);
    }

    const rules = await query;
    return rules;
  }

  // Get detailed profile information including rules preview
  async getProfileDetails(stigId: string) {
    // Get profile summary
    const [profile] = await db
      .select({
        stigId: stigRules.stigId,
        stigTitle: stigRules.stigTitle,
        version: stigRules.version,
        ruleType: stigRules.ruleType,
        totalRules: sql<number>`count(*)::int`,
      })
      .from(stigRules)
      .where(eq(stigRules.stigId, stigId))
      .groupBy(stigRules.stigId, stigRules.stigTitle, stigRules.version, stigRules.ruleType)
      .limit(1);

    if (!profile) {
      return null;
    }

    // Get severity breakdown
    const severityBreakdown = await this.getSeverityBreakdown(stigId);

    // Get sample rules (5 per severity level)
    const sampleRules = await db
      .select()
      .from(stigRules)
      .where(eq(stigRules.stigId, stigId))
      .orderBy(stigRules.severity, stigRules.id)
      .limit(15);

    return {
      stig_id: profile.stigId,
      stig_title: profile.stigTitle,
      version: profile.version,
      rule_type: profile.ruleType,
      total_rules: profile.totalRules,
      category: this.getCategoryForProfile(profile.stigId),
      applicable_os: this.getApplicableOS(profile.stigId),
      severity_breakdown: severityBreakdown,
      sample_rules: sampleRules.map(rule => ({
        id: rule.id,
        title: rule.title,
        severity: rule.severity,
        description: rule.description?.substring(0, 200) + '...' || '',
      })),
    };
  }

  // Get a single STIG rule with all mappings
  async getSTIGRuleWithMappings(ruleId: string): Promise<STIGRuleWithMappings | null> {
    const [rule] = await db
      .select()
      .from(stigRules)
      .where(eq(stigRules.id, ruleId))
      .limit(1);

    if (!rule) return null;

    // Get CCIs for this rule
    const ruleCcis = await db
      .select({
        cci: ccis.cci,
        definition: ccis.definition,
        controlId: ccis.controlId,
      })
      .from(stigRuleCcis)
      .innerJoin(ccis, eq(stigRuleCcis.cci, ccis.cci))
      .where(eq(stigRuleCcis.stigRuleId, ruleId));

    // Get NIST controls for this rule
    const ruleControls = await db
      .select({
        id: controls.id,
        title: controls.title,
        family: controls.family,
      })
      .from(stigRuleControls)
      .innerJoin(controls, eq(stigRuleControls.controlId, controls.id))
      .where(eq(stigRuleControls.stigRuleId, ruleId));

    return {
      id: rule.id,
      stigId: rule.stigId,
      stigTitle: rule.stigTitle || '',
      version: rule.version || '',
      title: rule.title,
      description: rule.description || '',
      severity: rule.severity,
      ruleType: rule.ruleType,
      ccis: ruleCcis,
      controls: ruleControls,
    };
  }

  // Get STIG profiles assigned to a system
  async getSystemSTIGProfiles(systemId: string) {
    const profiles = await db
      .select({
        id: systemStigProfiles.id,
        stigId: systemStigProfiles.stigId,
        version: systemStigProfiles.version,
        assignedAt: systemStigProfiles.assignedAt,
        autoUpdate: systemStigProfiles.autoUpdate,
      })
      .from(systemStigProfiles)
      .where(eq(systemStigProfiles.systemId, systemId));

    // Enrich with profile details
    const enrichedProfiles = await Promise.all(
      profiles.map(async (profile) => {
        const [details] = await db
          .select({
            stigTitle: stigRules.stigTitle,
            ruleType: stigRules.ruleType,
            totalRules: sql<number>`count(*)::int`,
          })
          .from(stigRules)
          .where(eq(stigRules.stigId, profile.stigId))
          .groupBy(stigRules.stigTitle, stigRules.ruleType)
          .limit(1);

        return {
          ...profile,
          stigTitle: details?.stigTitle || profile.stigId,
          ruleType: details?.ruleType || 'stig',
          totalRules: details?.totalRules || 0,
        };
      })
    );

    return enrichedProfiles;
  }

  // Assign STIG profiles to a system
  async assignSTIGProfiles(systemId: string, stigIds: string[]) {
    // Remove existing assignments
    await db
      .delete(systemStigProfiles)
      .where(eq(systemStigProfiles.systemId, systemId));

    // Add new assignments
    if (stigIds.length > 0) {
      const values = stigIds.map(stigId => ({
        systemId,
        stigId,
        autoUpdate: true,
      }));

      await db.insert(systemStigProfiles).values(values);
    }

    return this.getSystemSTIGProfiles(systemId);
  }

  // Get statistics about STIG rules
  async getSTIGStats() {
    const [totalRules] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(stigRules);

    const bySeverity = await db
      .select({
        severity: stigRules.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(stigRules)
      .groupBy(stigRules.severity);

    const byType = await db
      .select({
        ruleType: stigRules.ruleType,
        count: sql<number>`count(*)::int`,
      })
      .from(stigRules)
      .groupBy(stigRules.ruleType);

    const [totalCcis] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ccis);

    return {
      totalRules: totalRules.count,
      bySeverity: bySeverity.reduce((acc, s) => {
        acc[s.severity] = s.count;
        return acc;
      }, {} as Record<string, number>),
      byType: byType.reduce((acc, t) => {
        acc[t.ruleType] = t.count;
        return acc;
      }, {} as Record<string, number>),
      totalCcis: totalCcis.count,
    };
  }

  // Get NIST controls covered by a STIG profile
  async getSTIGControlCoverage(stigId: string) {
    const coverage = await db
      .select({
        controlId: controls.id,
        controlTitle: controls.title,
        controlFamily: controls.family,
        ruleCount: sql<number>`count(distinct ${stigRuleControls.stigRuleId})::int`,
      })
      .from(stigRuleControls)
      .innerJoin(stigRules, eq(stigRuleControls.stigRuleId, stigRules.id))
      .innerJoin(controls, eq(stigRuleControls.controlId, controls.id))
      .where(eq(stigRules.stigId, stigId))
      .groupBy(controls.id, controls.title, controls.family)
      .orderBy(controls.id);

    return coverage;
  }
}

export const stigService = new STIGService();
