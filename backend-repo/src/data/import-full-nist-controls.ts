import { db } from '../db';
import { controls } from '../schema';
import fs from 'fs/promises';
import path from 'path';

// In CommonJS, __dirname is available globally after compilation
const currentDir = path.resolve();

/**
 * Import the complete NIST 800-53 Rev 5 control catalog
 */
export async function importFullNISTControls(): Promise<void> {
  try {
    // Check if controls already exist
    const existingControls = await db.select().from(controls).limit(1);
    if (existingControls.length > 0) {
      console.log('NIST controls already exist in database, skipping import');
      return;
    }
    
    // Load the full catalog
    // In production, the file is in /app/server/data/
    const catalogPath = process.env.NODE_ENV === 'production' 
      ? path.join(process.cwd(), 'server/data/nist-800-53-rev5-full.json')
      : path.join(currentDir, 'nist-800-53-rev5-full.json');
    const catalogData = await fs.readFile(catalogPath, 'utf-8');
    const catalog = JSON.parse(catalogData);
    
    console.log(`Loading NIST 800-53 Rev 5 catalog...`);
    console.log(`Version: ${catalog.version}`);
    console.log(`Source: ${catalog.source}`);
    console.log(`Total controls: ${catalog.totalControls}`);
    console.log(`Families: ${catalog.families.length}`);
    
    // Clear existing controls (optional - comment out if you want to preserve existing data)
    // console.log('\\nClearing existing controls...');
    // await db.delete(controls);
    
    // Import controls in batches for better performance
    const batchSize = 50;
    let imported = 0;
    let failed = 0;
    
    console.log(`\\nImporting ${catalog.controls.length} controls...`);
    
    for (let i = 0; i < catalog.controls.length; i += batchSize) {
      const batch = catalog.controls.slice(i, i + batchSize);
      
      try {
        // Insert batch of controls
        await db.insert(controls).values(
          batch.map((control: any) => ({
            id: control.id,
            title: control.title,
            description: control.description || `Implementation of ${control.title} control requirements`,
            family: control.family,
            baseline: control.baseline || [], // Keep as array
            enhancement: control.enhancement,
            supplementalGuidance: control.supplementalGuidance
          }))
        ).onConflictDoNothing();
        
        imported += batch.length;
        
        // Progress indicator
        const progress = Math.round((imported / catalog.controls.length) * 100);
        process.stdout.write(`\\rProgress: ${progress}% (${imported}/${catalog.controls.length} controls)`);
        
      } catch (error) {
        console.error(`\\nError importing batch starting at ${i}:`, error);
        failed += batch.length;
      }
    }
    
    console.log('\\n\\n✅ Import completed!');
    console.log(`Successfully imported: ${imported - failed} controls`);
    console.log(`Failed: ${failed} controls`);
    
    // Verify import by counting controls in database
    const dbControlCount = await db.$count(controls);
    console.log(`\\nTotal controls in database: ${dbControlCount}`);
    
    // Show family distribution
    console.log('\\nVerifying control families...');
    const familyCounts: Record<string, number> = {};
    
    for (const control of catalog.controls) {
      familyCounts[control.family] = (familyCounts[control.family] || 0) + 1;
    }
    
    console.log('Control distribution by family:');
    for (const [family, count] of Object.entries(familyCounts).sort()) {
      console.log(`  ${family}: ${count} controls`);
    }
    
  } catch (error) {
    console.error('❌ Error importing NIST controls:', error);
    throw error;
  }
}

// Allow running this file directly
// Commented out to prevent auto-execution on import
// if (import.meta.url === `file://${process.argv[1]}`) {
//   importFullNISTControls()
//     .then(() => {
//       console.log('\\nImport process completed successfully!');
//       process.exit(0);
//     })
//     .catch((error) => {
//       console.error('Import failed:', error);
//       process.exit(1);
//     });
// }
