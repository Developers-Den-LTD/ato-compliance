import * as dotenv from 'dotenv';
import { db } from '../src/db';
import { stigRules } from '../src/schema';
import { sql } from 'drizzle-orm';

dotenv.config();

async function checkUbuntuRules() {
  try {
    // Get all Ubuntu STIG profiles
    const profiles = await db
      .select({
        stigId: stigRules.stigId,
        count: sql<number>`count(*)::int`
      })
      .from(stigRules)
      .where(sql`${stigRules.stigId} LIKE '%UBUNTU%'`)
      .groupBy(stigRules.stigId);

    console.log('Ubuntu STIG profiles in database:');
    console.log(JSON.stringify(profiles, null, 2));
    
    const total = profiles.reduce((sum, p) => sum + p.count, 0);
    console.log(`\nTotal Ubuntu rules: ${total}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUbuntuRules();
