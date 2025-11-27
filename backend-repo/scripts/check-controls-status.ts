import * as dotenv from 'dotenv';
import { db } from '../src/db';
import { controls } from '../src/schema';
import { sql } from 'drizzle-orm';

dotenv.config();

async function checkControlsStatus() {
  console.log('📊 Checking NIST 800-53 Controls Status...\n');

  try {
    // Get total count
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(controls);

    if (total === 0) {
      console.log('❌ No controls found in database');
      console.log('   Run: npm run import-controls');
      return;
    }

    console.log(`✅ Total Controls: ${total}\n`);

    // Get counts by family
    const familyStats = await db
      .select({
        family: controls.family,
        count: sql<number>`count(*)::int`,
      })
      .from(controls)
      .groupBy(controls.family)
      .orderBy(controls.family);

    console.log('📋 Controls by Family:');
    familyStats.forEach(stat => {
      console.log(`   ${stat.family.padEnd(60)} ${stat.count.toString().padStart(4)}`);
    });

    // Get counts by baseline
    const baselineStats = await db
      .select({
        baseline: sql<string>`unnest(${controls.baseline})`,
        count: sql<number>`count(*)::int`,
      })
      .from(controls)
      .groupBy(sql`unnest(${controls.baseline})`);

    console.log('\n🎯 Controls by Baseline:');
    baselineStats.forEach(stat => {
      console.log(`   ${stat.baseline.padEnd(10)} ${stat.count}`);
    });

    // Get counts by priority
    const priorityStats = await db
      .select({
        priority: controls.priority,
        count: sql<number>`count(*)::int`,
      })
      .from(controls)
      .where(sql`${controls.priority} IS NOT NULL`)
      .groupBy(controls.priority);

    console.log('\n⚡ Controls by Priority:');
    priorityStats.forEach(stat => {
      console.log(`   ${(stat.priority || 'unknown').padEnd(10)} ${stat.count}`);
    });

  } catch (error) {
    console.error('❌ Error checking controls:', error);
    throw error;
  }
}

checkControlsStatus()
  .then(() => {
    console.log('\n✨ Status check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Status check failed:', error);
    process.exit(1);
  });
