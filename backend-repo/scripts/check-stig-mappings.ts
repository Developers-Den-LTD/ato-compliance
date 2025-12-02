import * as dotenv from 'dotenv';
import { db } from '../src/db';
import { stigRuleControls, stigRules } from '../src/schema';

dotenv.config();

async function checkMappings() {
  console.log('Checking STIG mappings...\n');
  
  // Check total mappings
  const totalMappings = await db.$count(stigRuleControls);
  console.log(`Total STIG-Control mappings: ${totalMappings}`);
  
  // Get sample mappings
  const sampleMappings = await db.select().from(stigRuleControls).limit(5);
  console.log('\nSample mappings:');
  console.log(JSON.stringify(sampleMappings, null, 2));
  
  // Check STIG rules
  const totalRules = await db.$count(stigRules);
  console.log(`\nTotal STIG rules: ${totalRules}`);
  
  // Get sample rules
  const sampleRules = await db.select().from(stigRules).limit(3);
  console.log('\nSample STIG rules:');
  sampleRules.forEach(rule => {
    console.log(`  ID: ${rule.id}`);
    console.log(`  STIG ID: ${rule.stigId}`);
    console.log(`  Title: ${rule.title}`);
    console.log('');
  });
  
  process.exit(0);
}

checkMappings();
