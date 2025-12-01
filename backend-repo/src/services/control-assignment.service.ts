/**
 * Service for intelligent control assignment based on system characteristics
 */

import { db } from '../db';
import { systemControls, systems, controls } from "../schema";
import { eq, sql, inArray } from 'drizzle-orm';
import { getControlAssignmentOptions, getSmartRecommendations, BASELINE_TEMPLATES } from '../data/control-templates';

export interface ControlAssignmentRequest {
  systemId: string;
  assignmentType: 'baseline' | 'template' | 'smart' | 'custom';
  templateId?: string;
  controlIds?: string[];
  impactLevel?: 'Low' | 'Moderate' | 'High';
  category?: string;
}

export interface ControlAssignmentResult {
  success: boolean;
  assignedCount: number;
  assignedControls: string[];
  errors?: string[];
}

export class ControlAssignmentService {
  /**
   * Get available control assignment options for a system
   */
  async getAssignmentOptions(systemId: string) {
    try {
      // Get system details
      const system = await db.select().from(systems).where(eq(systems.id, systemId)).limit(1);
      
      if (system.length === 0) {
        throw new Error('System not found');
      }
      
      const systemData = system[0];
      const category = systemData.category || 'Major Application';
      const impactLevel = systemData.impactLevel as 'Low' | 'Moderate' | 'High';
      
      // Get assignment options
      const options = getControlAssignmentOptions(category, impactLevel);

      return {
        systemId,
        systemName: systemData.name,
        category,
        impactLevel,
        options
      };
    } catch (error) {
      console.error('Error getting assignment options:', error);
      throw new Error('Failed to get assignment options');
    }
  }

  /**
   * Assign controls to a system based on the selected strategy
   */
  async assignControls(request: ControlAssignmentRequest): Promise<ControlAssignmentResult> {
    try {
      const { systemId, assignmentType, templateId, controlIds, impactLevel, category } = request;
      
      let controlsToAssign: string[] = [];
      
      // Determine which controls to assign based on strategy
      console.log('Assignment type:', assignmentType);
      console.log('Impact level:', impactLevel);
      console.log('Category:', category);
      
      switch (assignmentType) {
        case 'baseline':
          // Get system to determine impact level
          const system = await db.select().from(systems).where(eq(systems.id, systemId)).limit(1);
          if (system.length === 0) {
            throw new Error('System not found');
          }
          const systemImpactLevel = (impactLevel || system[0].impactLevel) as 'Low' | 'Moderate' | 'High';
          const baseline = BASELINE_TEMPLATES.find(t => t.impactLevel === systemImpactLevel);
          if (!baseline) {
            throw new Error(`No baseline found for impact level: ${systemImpactLevel}`);
          }
          controlsToAssign = [...baseline.controls];
          console.log(`Baseline assignment for ${systemImpactLevel}: ${controlsToAssign.length} controls`);
          break;

        case 'template':
          if (!templateId) {
            throw new Error('Template ID required for template assignment');
          }
          const options = getControlAssignmentOptions(
            category || 'Major Application',
            impactLevel || 'Moderate'
          );
          const template = options.templates.find(t => t.id === templateId);
          if (!template) {
            throw new Error(`Template not found: ${templateId}`);
          }
          controlsToAssign = [...template.controls];
          console.log(`Template assignment ${templateId}: ${controlsToAssign.length} controls`);
          break;

        case 'smart':
          const smartRecs = getSmartRecommendations(
            category || 'Major Application',
            impactLevel || 'Moderate'
          );
          controlsToAssign = [...smartRecs.recommended];
          console.log(`Smart assignment: ${controlsToAssign.length} controls`);
          break;

        case 'custom':
          if (!controlIds || controlIds.length === 0) {
            throw new Error('Control IDs required for custom assignment');
          }
          controlsToAssign = [...controlIds];
          console.log('Custom controls count:', controlsToAssign.length);
          break;

        default:
          throw new Error('Invalid assignment type');
      }

      // For non-baseline assignments, check if system exists
      if (assignmentType !== 'baseline') {
        console.log('Checking if system exists:', systemId);
        const system = await db.select().from(systems).where(eq(systems.id, systemId)).limit(1);
        if (system.length === 0) {
          throw new Error('System not found');
        }
        console.log('System found:', system[0].name);
      }

      // Validate that all control IDs exist in the database
      console.log(`Validating ${controlsToAssign.length} controls exist in database...`);
      const validControls = await db.select({ id: controls.id })
        .from(controls)
        .where(inArray(controls.id, controlsToAssign));

      const validControlIds = new Set(validControls.map(c => c.id));
      const invalidControls = controlsToAssign.filter(id => !validControlIds.has(id));

      if (invalidControls.length > 0) {
        console.log(`Warning: ${invalidControls.length} controls not found in database:`, invalidControls.slice(0, 5));
      }

      // Only assign controls that exist in the database
      controlsToAssign = controlsToAssign.filter(id => validControlIds.has(id));
      console.log(`${controlsToAssign.length} valid controls after filtering`);

      if (controlsToAssign.length === 0) {
        return {
          success: false,
          assignedCount: 0,
          assignedControls: [],
          errors: ['No valid controls found to assign']
        };
      }

      // Get existing assigned controls
      console.log('Fetching existing controls...');
      const existingControls = await db.select()
        .from(systemControls)
        .where(eq(systemControls.systemId, systemId));
      console.log('Existing controls count:', existingControls.length);
      
      const existingControlIds = new Set(existingControls.map(sc => sc.controlId));
      
      // Filter out already assigned controls
      const newControls = controlsToAssign.filter(controlId => !existingControlIds.has(controlId));
      
      if (newControls.length === 0) {
        return {
          success: true,
          assignedCount: 0,
          assignedControls: [],
          errors: ['All selected controls are already assigned to this system']
        };
      }
      
      // Assign new controls
      console.log('Creating assignments for controls:', newControls.slice(0, 5), '...');
      const assignments = newControls.map((controlId) => ({
        systemId,
        controlId,
        status: 'not_implemented' as const,
        assignedTo: null,
        implementationText: null
        // Let database handle lastUpdated with default CURRENT_TIMESTAMP
        // and id with default gen_random_uuid()
      }));
      
      await db.insert(systemControls).values(assignments);
      
      return {
        success: true,
        assignedCount: newControls.length,
        assignedControls: newControls
      };
      
    } catch (error) {
      console.error('Error assigning controls:', error);
      return {
        success: false,
        assignedCount: 0,
        assignedControls: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
  
  /**
   * Get assignment recommendations for a system
   */
  async getRecommendations(systemId: string) {
    try {
      const system = await db.select().from(systems).where(eq(systems.id, systemId)).limit(1);
      
      if (system.length === 0) {
        throw new Error('System not found');
      }
      
      const systemData = system[0];
      const category = systemData.category || 'Major Application';
      const impactLevel = systemData.impactLevel as 'Low' | 'Moderate' | 'High';
      
      // Get smart recommendations
      const recommendations = getSmartRecommendations(category, impactLevel);
      
      // Get currently assigned controls
      const assignedControls = await db.select()
        .from(systemControls)
        .where(eq(systemControls.systemId, systemId));
      
      const assignedControlIds = new Set(assignedControls.map(sc => sc.controlId));
      
      // Filter recommendations to exclude already assigned controls
      const availableRecommendations = recommendations.recommended.filter(
        controlId => !assignedControlIds.has(controlId)
      );
      
      return {
        systemId,
        systemName: systemData.name,
        category,
        impactLevel,
        recommendations: {
          baseline: {
            ...recommendations.baseline,
            available: recommendations.baseline.controls.filter(
              controlId => !assignedControlIds.has(controlId)
            )
          },
          templates: recommendations.templates.map(template => ({
            ...template,
            available: template.controls.filter(
              controlId => !assignedControlIds.has(controlId)
            )
          })),
          smart: {
            controls: availableRecommendations,
            count: availableRecommendations.length
          }
        },
        currentlyAssigned: assignedControlIds.size
      };
      
    } catch (error) {
      console.error('Error getting recommendations:', error);
      throw new Error('Failed to get recommendations');
    }
  }
}

export const controlAssignmentService = new ControlAssignmentService();
