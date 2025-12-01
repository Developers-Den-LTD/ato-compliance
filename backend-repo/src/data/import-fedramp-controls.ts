import { db } from '../db';
import { controls } from '../schema';
import { eq, count } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

// In CommonJS, __dirname is available globally after compilation
const currentDir = path.resolve();

/**
 * Import FedRAMP security controls
 */
export async function importFedRAMPControls(): Promise<void> {
  try {
    console.log('🔄 Starting FedRAMP controls import...');
    
    // Check if FedRAMP controls already exist
    const existingFedRAMPControls = await db
      .select()
      .from(controls)
      .where(eq(controls.framework, 'FedRAMP'))
      .limit(1);
      
    if (existingFedRAMPControls.length > 0) {
      console.log('✅ FedRAMP controls already exist in database, skipping import');
      return;
    }
    
    // Load FedRAMP catalog
    const catalogPath = process.env.NODE_ENV === 'production' 
      ? path.join(process.cwd(), 'server/data/fedramp-controls.json')
      : path.join(currentDir, 'fedramp-controls.json');
      
    const catalogData = await fs.readFile(catalogPath, 'utf-8');
    const catalog = JSON.parse(catalogData);
    
    console.log(`📚 Loading ${catalog.controls.length} FedRAMP controls...`);
    
    // Prepare controls for insertion
    const controlsToInsert = [];
    
    for (const control of catalog.controls) {
      // Main control
      controlsToInsert.push({
        id: control.id,
        framework: 'FedRAMP',
        family: control.family,
        title: control.title,
        description: control.description,
        baseline: control.baseline,
        priority: control.priority,
        supplementalGuidance: control.supplementalGuidance,
        status: 'not_implemented'
      });
      
      // Control enhancements
      if (control.enhancements) {
        for (const enhancement of control.enhancements) {
          controlsToInsert.push({
            id: enhancement.id,
            framework: 'FedRAMP',
            family: control.family,
            title: enhancement.title,
            description: enhancement.description,
            baseline: enhancement.baseline || control.baseline,
            priority: control.priority,
            enhancement: enhancement.id.split('(')[1]?.replace(')', ''),
            supplementalGuidance: enhancement.supplementalGuidance,
            status: 'not_implemented'
          });
        }
      }
    }
    
    // Insert in batches
    const batchSize = 50;
    let imported = 0;
    
    for (let i = 0; i < controlsToInsert.length; i += batchSize) {
      const batch = controlsToInsert.slice(i, i + batchSize);
      
      try {
        await db.insert(controls).values(batch).onConflictDoNothing();
        imported += batch.length;
        
        const progress = Math.round((imported / controlsToInsert.length) * 100);
        process.stdout.write(`\rProgress: ${progress}% (${imported}/${controlsToInsert.length} controls)`);
        
      } catch (error) {
        console.error(`\n❌ Error inserting batch starting at index ${i}:`, error);
        throw error;
      }
    }
    
    console.log(`\n✅ Successfully imported ${imported} FedRAMP controls`);
    
    // Log summary by baseline
    const summary = await db
      .select({
        baseline: controls.baseline,
        count: count()
      })
      .from(controls)
      .where(eq(controls.framework, 'FedRAMP'))
      .groupBy(controls.baseline);
      
    console.log('\n📊 FedRAMP Controls Summary:');
    for (const item of summary) {
      console.log(`   ${item.baseline}: ${item.count} controls`);
    }
    
  } catch (error) {
    console.error('❌ Error importing FedRAMP controls:', error);
    throw error;
  }
}

/**
 * Create FedRAMP-specific control mappings to NIST 800-53
 */
export async function createFedRAMPMappings(): Promise<void> {
  try {
    console.log('🔗 Creating FedRAMP to NIST 800-53 mappings...');
    
    // FedRAMP is based on NIST 800-53, so most controls map 1:1
    const fedRampControls = await db
      .select()
      .from(controls)
      .where(eq(controls.framework, 'FedRAMP'));
      
    console.log(`📋 Found ${fedRampControls.length} FedRAMP controls to map`);
    
    // Import control relationships if the table exists
    try {
      const { controlRelationships } = await import('../schema');
      
      const mappingsToInsert = [];
      
      for (const fedRampControl of fedRampControls) {
        // Map to equivalent NIST 800-53 control (same ID)
        mappingsToInsert.push({
          sourceControlId: fedRampControl.id,
          targetControlId: fedRampControl.id,
          relationshipType: 'equivalent',
          framework: 'FedRAMP-to-NIST',
          description: `FedRAMP ${fedRampControl.id} is equivalent to NIST 800-53 ${fedRampControl.id}`,
          createdAt: new Date()
        });
      }
      
      // Insert mappings in batches
      const batchSize = 100;
      let mapped = 0;
      
      for (let i = 0; i < mappingsToInsert.length; i += batchSize) {
        const batch = mappingsToInsert.slice(i, i + batchSize);
        
        await db.insert(controlRelationships).values(batch).onConflictDoNothing();
        mapped += batch.length;
      }
      
      console.log(`✅ Created ${mapped} FedRAMP-to-NIST mappings`);
      
    } catch (error) {
      console.log('ℹ️  Control relationships table not available, skipping mappings');
    }
    
  } catch (error) {
    console.error('❌ Error creating FedRAMP mappings:', error);
    throw error;
  }
}
