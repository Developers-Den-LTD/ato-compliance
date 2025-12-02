import * as dotenv from 'dotenv';
import { db } from '../src/db';
import { controls } from '../src/schema';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
dotenv.config();

/**
 * Import NIST 800-53 Rev 5 controls from JSON file
 */
async function importNISTControls() {
  try {
    console.log('🚀 Starting NIST 800-53 Rev 5 controls import...\n');

    // Load the JSON file
    const filePath = path.join(__dirname, '../src/data/nist-800-53-rev5-full.json');
    console.log(`📂 Reading file: ${filePath}`);
    
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    console.log(`\n📊 Catalog Information:`);
    console.log(`   Version: ${data.version}`);
    console.log(`   Source: ${data.source}`);
    console.log(`   Last Updated: ${data.lastUpdated}`);
    console.log(`   Total Controls: ${data.totalControls}`);
    console.log(`   Families: ${data.families.length}\n`);

    // Check if controls already exist
    const existingCount = await db.$count(controls);
    if (existingCount > 0) {
      console.log(`⚠️  Database already contains ${existingCount} controls.`);
      console.log('   Clearing existing controls...\n');
      await db.delete(controls);
    }

    // Import controls in batches
    const batchSize = 100;
    let imported = 0;
    let failed = 0;

    console.log(`📥 Importing ${data.controls.length} controls in batches of ${batchSize}...\n`);

    for (let i = 0; i < data.controls.length; i += batchSize) {
      const batch = data.controls.slice(i, i + batchSize);

      try {
        await db.insert(controls).values(
          batch.map((control: any) => ({
            id: control.id,
            framework: 'NIST-800-53',
            family: control.family,
            title: control.title,
            description: control.description || control.title,
            baseline: control.baseline || [],
            priority: control.priority || null,
            enhancement: control.enhancement || null,
            parentControlId: control.parentControlId || null,
            supplementalGuidance: control.supplementalGuidance || null,
            requirements: null, // Can be populated later if needed
          }))
        ).onConflictDoNothing();

        imported += batch.length;

        // Progress indicator
        const progress = Math.round((imported / data.controls.length) * 100);
        process.stdout.write(`\r   Progress: ${progress}% (${imported}/${data.controls.length})`);
      } catch (error) {
        console.error(`\n❌ Error importing batch starting at ${i}:`, error);
        failed += batch.length;
      }
    }

    console.log('\n\n✅ Import completed!');
    console.log(`   Successfully imported: ${imported - failed} controls`);
    if (failed > 0) {
      console.log(`   Failed: ${failed} controls`);
    }

    // Verify import
    const finalCount = await db.$count(controls);
    console.log(`\n📊 Final count in database: ${finalCount} controls`);

    // Show family distribution
    console.log('\n📋 Control distribution by family:');
    const familyCounts: Record<string, number> = {};
    
    for (const control of data.controls) {
      familyCounts[control.family] = (familyCounts[control.family] || 0) + 1;
    }

    const sortedFamilies = Object.entries(familyCounts).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [family, count] of sortedFamilies) {
      console.log(`   ${family}: ${count}`);
    }

    console.log('\n✨ Import process completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error importing NIST controls:', error);
    process.exit(1);
  }
}

// Run the import
importNISTControls();
