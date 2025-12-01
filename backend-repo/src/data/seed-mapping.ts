import { db } from '../db';
import { controls, stigRules, stigRuleControls, stigRuleCcis, ccis } from '../schema';
import mappingData from './nist-stig-mapping.json' assert { type: 'json' };

export interface SeedMappingData {
  version: string;
  description: string;
  lastUpdated: string;
  controls: Array<{
    id: string;
    title: string;
    description: string;
    family: string;
    baseline: string[];
    priority: string;
  }>;
  stigRules: Array<{
    id: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    stigId: string;
    stigTitle: string;
    version: string;
    ruleTitle: string;
    checkText: string;
    fixText: string;
    ruleType?: 'stig' | 'jsig'; // Optional: defaults to 'stig' for backward compatibility
  }>;
  ccis: Array<{
    cci: string;
    definition: string;
    controlId: string;
  }>;
  mappings: {
    stigRuleControls: Array<{
      stigRuleId: string;
      controlId: string;
      rationale: string;
    }>;
    stigRuleCcis: Array<{
      stigRuleId: string;
      cci: string;
      rationale: string;
    }>;
  };
}

/**
 * Seeds the database with curated NIST 800-53 to STIG/JSIG mapping data
 * This creates the foundational data for ATO package generation
 * Supports both traditional STIG rules and Joint STIG (JSIG) rules
 */
export async function seedMappingData(): Promise<void> {
  const data = mappingData as SeedMappingData;
  
  console.log(`Seeding mapping data version ${data.version} (${data.lastUpdated})`);
  console.log(data.description);

  try {
    // 1. Seed NIST 800-53 Controls
    console.log(`Seeding ${data.controls.length} NIST controls...`);
    for (const control of data.controls) {
      await db.insert(controls).values({
        id: control.id,
        title: control.title,
        description: control.description,
        family: control.family,
        baseline: control.baseline, // Store as array
        priority: control.priority
      }).onConflictDoNothing(); // Skip if already exists
    }

    // 2. Seed STIG/JSIG Rules  
    console.log(`Seeding ${data.stigRules.length} STIG/JSIG rules...`);
    for (const rule of data.stigRules) {
      await db.insert(stigRules).values({
        id: rule.id,
        title: rule.title,
        description: rule.description,
        severity: rule.severity,
        stigId: rule.stigId,
        stigTitle: rule.stigTitle,
        version: rule.version,
        ruleTitle: rule.ruleTitle,
        checkText: rule.checkText,
        fixText: rule.fixText,
        ruleType: rule.ruleType || 'stig' // Default to 'stig' for backward compatibility
      }).onConflictDoNothing(); // Skip if already exists
    }

    // 3. Seed CCIs
    console.log(`Seeding ${data.ccis.length} CCIs...`);
    let cciCount = 0;
    let cciSkipped = 0;
    for (const cci of data.ccis) {
      try {
        await db.insert(ccis).values({
          cci: cci.cci,
          definition: cci.definition,
          controlId: cci.controlId
        }).onConflictDoNothing(); // Skip if already exists
        cciCount++;
      } catch (error: any) {
        // Skip CCIs that reference non-existent controls
        if (error.code === '23503') {
          cciSkipped++;
          if (cciSkipped <= 5) {
            console.log(`  Skipping CCI ${cci.cci} - control ${cci.controlId} not found`);
          }
        } else {
          throw error; // Re-throw non-foreign key errors
        }
      }
    }
    console.log(`Seeded ${cciCount} CCIs (${cciSkipped} skipped due to missing controls)`)

    // 4. Seed STIG/JSIG Rule to Control mappings
    console.log(`Seeding ${data.mappings.stigRuleControls.length} rule to control mappings...`);
    let controlMappingCount = 0;
    let controlMappingSkipped = 0;
    for (const mapping of data.mappings.stigRuleControls) {
      try {
        await db.insert(stigRuleControls).values({
          stigRuleId: mapping.stigRuleId,
          controlId: mapping.controlId,
          rationale: mapping.rationale
        }).onConflictDoNothing(); // Skip if mapping already exists due to unique constraint
        controlMappingCount++;
      } catch (error: any) {
        // Skip mappings that reference non-existent controls or STIG rules
        if (error.code === '23503') {
          controlMappingSkipped++;
        } else {
          throw error; // Re-throw non-foreign key errors
        }
      }
    }
    console.log(`Seeded ${controlMappingCount} STIG-Control mappings (${controlMappingSkipped} skipped)`)

    // 5. Seed STIG/JSIG Rule to CCI mappings
    console.log(`Seeding ${data.mappings.stigRuleCcis.length} rule to CCI mappings...`);
    let cciMappingCount = 0;
    let cciMappingSkipped = 0;
    for (const mapping of data.mappings.stigRuleCcis) {
      try {
        await db.insert(stigRuleCcis).values({
          stigRuleId: mapping.stigRuleId,
          cci: mapping.cci,
          rationale: mapping.rationale
        }).onConflictDoNothing(); // Skip if mapping already exists due to unique constraint
        cciMappingCount++;
      } catch (error: any) {
        // Skip mappings that reference non-existent STIG rules or CCIs
        if (error.code === '23503') {
          cciMappingSkipped++;
        } else {
          throw error; // Re-throw non-foreign key errors
        }
      }
    }
    console.log(`Seeded ${cciMappingCount} STIG-CCI mappings (${cciMappingSkipped} skipped)`)

    console.log('✅ Mapping data seeded successfully!');
    console.log('The system now has curated NIST↔STIG/JSIG mappings for ATO package generation.');
    
    // Log summary
    const totalControlCount = await db.$count(controls);
    const totalStigRuleCount = await db.$count(stigRules);
    const totalCciCount = await db.$count(ccis);
    const totalMappingCount = await db.$count(stigRuleControls);
    const totalCciMappingCount = await db.$count(stigRuleCcis);
    
    console.log(`\nDatabase Summary:`);
    console.log(`- NIST Controls: ${totalControlCount}`);
    console.log(`- STIG/JSIG Rules: ${totalStigRuleCount}`);
    console.log(`- CCIs: ${totalCciCount}`);
    console.log(`- Control Mappings: ${totalMappingCount}`);
    console.log(`- CCI Mappings: ${totalCciMappingCount}`);

  } catch (error) {
    console.error('❌ Error seeding mapping data:', error);
    throw error;
  }
}

/**
 * Clears all mapping data (for development/testing)
 */
export async function clearMappingData(): Promise<void> {
  console.log('Clearing mapping data...');
  
  try {
    // Clear in reverse dependency order
    await db.delete(stigRuleCcis);
    await db.delete(stigRuleControls);
    await db.delete(ccis);
    await db.delete(stigRules);
    await db.delete(controls);
    
    console.log('✅ Mapping data cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing mapping data:', error);
    throw error;
  }
}

// Allow running this file directly for seeding
if (import.meta.url === `file://${process.argv[1]}`) {
  seedMappingData()
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}
