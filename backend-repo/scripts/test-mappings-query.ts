import * as dotenv from 'dotenv';
import { db } from '../src/db';
import { stigRuleControls, stigRules, controls, systems } from '../src/schema';
import { eq, inArray, and } from 'drizzle-orm';

dotenv.config();

async function testQuery() {
  const systemId = 'ade2e5bf-4cb7-4dc4-85b2-95be039fd4c3';
  
  console.log('Testing control mappings query...\n');
  
  // Get system STIG profiles
  const systemData = await db
    .select({ stigProfiles: systems.stigProfiles })
    .from(systems)
    .where(eq(systems.id, systemId))
    .limit(1);
  
  console.log('System data:', JSON.stringify(systemData, null, 2));
  
  if (systemData.length > 0 && systemData[0].stigProfiles) {
    const stigProfileIds = systemData[0].stigProfiles;
    console.log('\nSTIG Profile IDs:', stigProfileIds);
    
    // Get STIG rules for these profiles
    const rulesForProfiles = await db
      .select()
      .from(stigRules)
      .where(inArray(stigRules.stigId, stigProfileIds))
      .limit(5);
    
    console.log(`\nFound ${rulesForProfiles.length} STIG rules for these profiles`);
    rulesForProfiles.forEach(rule => {
      console.log(`  - ${rule.id} (${rule.stigId})`);
    });
    
    // Get mappings for these rules
    const mappings = await db
      .select({
        controlId: stigRuleControls.controlId,
        stigRuleId: stigRuleControls.stigRuleId,
        rationale: stigRuleControls.rationale
      })
      .from(stigRuleControls)
      .innerJoin(stigRules, eq(stigRuleControls.stigRuleId, stigRules.id))
      .where(inArray(stigRules.stigId, stigProfileIds))
      .limit(10);
    
    console.log(`\nFound ${mappings.length} mappings`);
    mappings.forEach(m => {
      console.log(`  ${m.controlId} <- ${m.stigRuleId}`);
    });
  }
  
  process.exit(0);
}

testQuery();
