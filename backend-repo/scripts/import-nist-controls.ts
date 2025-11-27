import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { db } from '../src/db';
import { controls } from '../src/schema';
import { eq, sql } from 'drizzle-orm';

dotenv.config();

interface NISTControl {
  id: string;
  title: string;
  description: string;
  family: string;
  baseline: string[];
  priority: string;
  enhancement: string | null;
  supplementalGuidance: string;
}

interface NISTData {
  version: string;
  source: string;
  lastUpdated: string;
  totalControls: number;
  families: string[];
  controls: NISTControl[];
}

async function importNISTControls() {
  console.log('🚀 Starting NIST 800-53 controls import...');

  try {
    // Check if controls already exist
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(controls);

    if (count > 0) {
      console.log(`⚠️  Database already contains ${count} controls. Skipping import.`);
      console.log('   To re-import, delete existing controls first.');
      return;
    }

    // Read the JSON file
    const dataPath = resolve(__dirname, '../src/data/nist-controls-sample.json');
    console.log(`📖 Reading controls from: ${dataPath}`);
    
    const fileContent = readFileSync(dataPath, 'utf-8');
    const nistData: NISTData = JSON.parse(fileContent);

    console.log(`📊 Found ${nistData.totalControls} controls in ${nistData.families.length} families`);
    console.log(`   Version: ${nistData.version}`);
    console.log(`   Source: ${nistData.source}`);

    // Import controls in batches
    const batchSize = 50;
    const totalBatches = Math.ceil(nistData.controls.length / batchSize);
    let imported = 0;

    for (let i = 0; i < nistData.controls.length; i += batchSize) {
      const batch = nistData.controls.slice(i, i + batchSize);
      const currentBatch = Math.floor(i / batchSize) + 1;

      const values = batch.map(control => ({
        id: control.id,
        framework: 'NIST-800-53',
        family: control.family,
        title: control.title,
        description: control.description,
        baseline: control.baseline,
        priority: control.priority,
        enhancement: control.enhancement,
        parentControlId: control.enhancement ? control.enhancement : null,
        supplementalGuidance: control.supplementalGuidance,
      }));

      await db.insert(controls).values(values);
      imported += batch.length;

      process.stdout.write(`\r   Progress: ${currentBatch}/${totalBatches} batches (${imported}/${nistData.controls.length} controls)`);
    }

    console.log('\n✅ Import completed successfully!');

    // Verify import
    const [{ finalCount }] = await db
      .select({ finalCount: sql<number>`count(*)::int` })
      .from(controls);

    console.log(`\n📈 Verification:`);
    console.log(`   Total controls in database: ${finalCount}`);

    // Show distribution by family
    const familyStats = await db
      .select({
        family: controls.family,
        count: sql<number>`count(*)::int`,
      })
      .from(controls)
      .groupBy(controls.family)
      .orderBy(controls.family);

    console.log(`\n📊 Controls by family:`);
    familyStats.forEach(stat => {
      console.log(`   ${stat.family}: ${stat.count}`);
    });

  } catch (error) {
    console.error('❌ Error importing controls:', error);
    throw error;
  }
}

// Run the import
importNISTControls()
  .then(() => {
    console.log('\n✨ Import process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Import process failed:', error);
    process.exit(1);
  });
