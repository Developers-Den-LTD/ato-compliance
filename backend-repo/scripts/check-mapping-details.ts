import * as dotenv from 'dotenv';
import { db } from '../src/db';
import { stigRuleControls, stigRules } from '../src/schema';
import { eq } from 'drizzle-orm';

dotenv.config();

async function checkDetails() {
  console.log('Checking mapping details...\n');
  
  // Get a few mappings
  const mappings = await db.select().from(stigRuleControls).limit(10);
  console.log(`Total mappings in DB: ${await db.$count(stigRuleControls)}`);
  console.log('\nSample mapping STIG rule IDs:');
  mappings.forEach(m => console.log(`  - ${m.stigRuleId} -> ${m.controlId}`));
  
  // Check if these STIG rules exist
  console.log('\nChecking if these STIG rules exist in stigRules table:');
  for (const mapping of mappings.slice(0, 3)) {
    const rule = await db.select().from(stigRules).where(eq(stigRules.id, mapping.stigRuleId)).limit(1);
    if (rule.length > 0) {
      console.log(`  ✅ ${mapping.stigRuleId} exists (stigId: ${rule[0].stigId})`);
    } else {
      console.log(`  ❌ ${mapping.stigRuleId} NOT FOUND`);
    }
  }
  
  // Check Ubuntu-24.04-STIG rules
  console.log('\nChecking Ubuntu-24.04-STIG rules:');
  const ubuntuRules = await db.select().from(stigRules).where(eq(stigRules.stigId, 'Ubuntu-24.04-STIG')).limit(5);
  console.log(`Found ${ubuntuRules.length} rules`);
  ubuntuRules.forEach(r => console.log(`  - ${r.id}`));
  
  // Check if any of these have mappings
  if (ubuntuRules.length > 0) {
    const ubuntuMappings = await db.select().from(stigRuleControls).where(eq(stigRuleControls.stigRuleId, ubuntuRules[0].id)).limit(5);
    console.log(`\nMappings for ${ubuntuRules[0].id}: ${ubuntuMappings.length}`);
  }
  
  process.exit(0);
}

checkDetails();
