/**
 * Simple baseline assignment service that just works
 */

import { db } from '../db';
import { systemControls, systems, controls } from "../schema";
import { eq, and } from 'drizzle-orm';

export interface BaselineAssignmentRequest {
  systemId: string;
  impactLevel: 'Low' | 'Moderate' | 'High';
}

export interface AssignmentResult {
  success: boolean;
  assignedCount: number;
  assignedControls: string[];
  errors?: string[];
}

export class SimpleBaselineAssignmentService {
  /**
   * Get baseline controls for impact level
   */
  getBaselineControls(impactLevel: 'Low' | 'Moderate' | 'High'): string[] {
    // Return a subset of controls for each impact level
    const allControls = [
      'AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7', 'AC-8', 'AC-9', 'AC-10',
      'AC-11', 'AC-12', 'AC-13', 'AC-14', 'AC-15', 'AC-16', 'AC-17', 'AC-18', 'AC-19', 'AC-20',
      'AC-21', 'AC-22', 'AT-1', 'AT-2', 'AT-3', 'AT-4', 'CA-1', 'CA-2', 'CA-3', 'CA-4',
      'CA-5', 'CA-6', 'CA-7', 'CA-8', 'CA-9', 'CM-1', 'CM-2', 'CM-3', 'CM-4', 'CM-5',
      'CM-6', 'CM-7', 'CM-8', 'CM-9', 'CM-10', 'CM-11', 'CP-1', 'CP-2', 'CP-3', 'CP-4',
      'CP-5', 'CP-6', 'CP-7', 'CP-8', 'CP-9', 'CP-10', 'IA-1', 'IA-2', 'IA-3', 'IA-4',
      'IA-5', 'IA-6', 'IA-7', 'IA-8', 'IA-9', 'IA-10', 'IA-11', 'IR-1', 'IR-2', 'IR-3',
      'IR-4', 'IR-5', 'IR-6', 'IR-7', 'IR-8', 'IR-9', 'IR-10', 'MA-1', 'MA-2', 'MA-3',
      'MA-4', 'MA-5', 'MP-1', 'MP-2', 'MP-3', 'MP-4', 'MP-5', 'MP-6', 'MP-7', 'PE-1',
      'PE-2', 'PE-3', 'PE-4', 'PE-5', 'PE-6', 'PE-7', 'PE-8', 'PE-9', 'PE-10', 'PE-11',
      'PE-12', 'PE-13', 'PE-14', 'PE-15', 'PE-16', 'PE-17', 'PE-18', 'PE-19', 'PE-20',
      'PL-1', 'PL-2', 'PL-3', 'PL-4', 'PL-5', 'PL-6', 'PL-7', 'PL-8', 'PL-9', 'PL-10',
      'PL-11', 'PS-1', 'PS-2', 'PS-3', 'PS-4', 'PS-5', 'PS-6', 'PS-7', 'PS-8', 'RA-1',
      'RA-2', 'RA-3', 'RA-4', 'RA-5', 'RA-6', 'RA-7', 'RA-8', 'RA-9', 'SA-1', 'SA-2',
      'SA-3', 'SA-4', 'SA-5', 'SA-6', 'SA-7', 'SA-8', 'SA-9', 'SA-10', 'SA-11', 'SA-12',
      'SA-13', 'SA-14', 'SA-15', 'SA-16', 'SA-17', 'SA-18', 'SA-19', 'SA-20', 'SA-21', 'SA-22',
      'SC-1', 'SC-2', 'SC-3', 'SC-4', 'SC-5', 'SC-6', 'SC-7', 'SC-8', 'SC-9', 'SC-10',
      'SC-11', 'SC-12', 'SC-13', 'SC-14', 'SC-15', 'SC-16', 'SC-17', 'SC-18', 'SC-19', 'SC-20',
      'SC-21', 'SC-22', 'SC-23', 'SC-24', 'SC-25', 'SC-26', 'SC-27', 'SC-28', 'SC-29', 'SC-30',
      'SC-31', 'SC-32', 'SC-33', 'SC-34', 'SC-35', 'SC-36', 'SC-37', 'SC-38', 'SC-39', 'SC-40',
      'SC-41', 'SC-42', 'SC-43', 'SC-44', 'SC-45', 'SC-46', 'SC-47', 'SC-48', 'SC-49', 'SC-50',
      'SC-51', 'SC-52', 'SC-53', 'SI-1', 'SI-2', 'SI-3', 'SI-4', 'SI-5', 'SI-6', 'SI-7',
      'SI-8', 'SI-9', 'SI-10', 'SI-11', 'SI-12', 'SI-13', 'SI-14', 'SI-15', 'SI-16', 'SI-17',
      'SI-18', 'SI-19', 'SI-20', 'SI-21', 'SI-22', 'SI-23', 'SI-24', 'SI-25'
    ];

    switch (impactLevel) {
      case 'Low':
        return allControls.slice(0, 50); // First 50 controls for Low
      case 'Moderate':
        return allControls.slice(0, 100); // First 100 controls for Moderate
      case 'High':
        return allControls; // All controls for High
      default:
        return allControls.slice(0, 100);
    }
  }

  /**
   * Assign a single control using the working approach
   */
  async assignSingleControl(systemId: string, controlId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🔍 assignSingleControl called for system: ${systemId}, control: ${controlId}`);
      
      // First check if the control exists in the controls table
      const controlExists = await db.select()
        .from(controls)
        .where(eq(controls.id, controlId))
        .limit(1);
      
      if (controlExists.length === 0) {
        console.error(`❌ Control ${controlId} does not exist in the controls table`);
        return { 
          success: false, 
          error: `Control ${controlId} not found in database` 
        };
      }
      
      // Check if control is already assigned
      const existing = await db.select()
        .from(systemControls)
        .where(
          and(
            eq(systemControls.systemId, systemId),
            eq(systemControls.controlId, controlId)
          )
        );
      
      if (existing.length > 0) {
        console.log(`ℹ️ Control ${controlId} already assigned to system ${systemId}`);
        return { success: true }; // Already assigned
      }
      
      // Create the assignment with minimal data - let database handle defaults
      const assignment = {
        systemId,
        controlId,
        status: 'not_implemented' as const,
        assignedTo: null,
        implementationText: null
      };
      
      console.log('🔍 Inserting assignment:', assignment);
      
      try {
        const insertResult = await db.insert(systemControls).values(assignment).returning();
        console.log('✅ Insert successful, returned:', insertResult);
        
        // Verify the insert actually worked by checking the returned result
        if (!insertResult || insertResult.length === 0) {
          console.error('❌ Insert returned no results - database operation may have failed');
          return { 
            success: false, 
            error: 'Database insert returned no results' 
          };
        }
        
        return { success: true };
      } catch (dbError) {
        console.error('❌ Database insert error:', dbError);
        console.error('❌ Error details:', JSON.stringify(dbError, null, 2));
        return {
          success: false,
          error: `Database error: ${dbError instanceof Error ? dbError.message : String(dbError)}`
        };
      }
      
    } catch (error) {
      console.error('❌ Error in assignSingleControl:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Assign baseline controls based on impact level
   */
  async assignBaselineControls(request: BaselineAssignmentRequest): Promise<AssignmentResult> {
    try {
      const { systemId, impactLevel } = request;
      console.log('🚀 assignBaselineControls called with:', request);
      
      // Check if system exists
      const system = await db.select().from(systems).where(eq(systems.id, systemId)).limit(1);
      if (system.length === 0) {
        return {
          success: false,
          assignedCount: 0,
          assignedControls: [],
          errors: ['System not found']
        };
      }

      // Get baseline controls for the impact level
      const controlsToAssign = this.getBaselineControls(impactLevel);
      console.log('📋 Controls to assign:', controlsToAssign.length, controlsToAssign.slice(0, 5));

      // Get existing assigned controls
      const existingControls = await db.select()
        .from(systemControls)
        .where(eq(systemControls.systemId, systemId));
      
      const existingControlIds = new Set(existingControls.map(sc => sc.controlId));
      
      // Filter out already assigned controls
      const newControls = controlsToAssign.filter(controlId => !existingControlIds.has(controlId));
      console.log('🆕 New controls to assign:', newControls.length, newControls.slice(0, 5));
      
      if (newControls.length === 0) {
        return {
          success: true,
          assignedCount: 0,
          assignedControls: [],
          errors: ['All baseline controls are already assigned to this system']
        };
      }

      // Assign each control individually using the working method
      let successCount = 0;
      const errors: string[] = [];
      const assignedControls: string[] = [];
      
      console.log('🔄 Starting assignment loop for', newControls.length, 'controls');
      for (const controlId of newControls) {
        console.log('🔄 Assigning control:', controlId);
        const result = await this.assignSingleControl(systemId, controlId);
        console.log('🔄 Result for', controlId, ':', result);
        if (result.success) {
          successCount++;
          assignedControls.push(controlId);
        } else {
          errors.push(`${controlId}: ${result.error || 'Unknown error'}`);
        }
      }
      console.log('🔄 Assignment loop completed. Success:', successCount, 'Errors:', errors.length);
      
      return {
        success: successCount > 0,
        assignedCount: successCount,
        assignedControls,
        errors: errors.length > 0 ? errors : undefined
      };
      
    } catch (error) {
      console.error('Error in assignBaselineControls:', error);
      return {
        success: false,
        assignedCount: 0,
        assignedControls: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
}

export const simpleBaselineAssignmentService = new SimpleBaselineAssignmentService();
