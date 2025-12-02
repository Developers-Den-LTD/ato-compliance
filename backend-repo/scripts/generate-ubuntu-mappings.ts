import * as dotenv from 'dotenv';
import { db } from '../src/db';
import { stigRules, stigRuleControls } from '../src/schema';
import { eq } from 'drizzle-orm';

dotenv.config();

/**
 * Generate automatic STIG-to-NIST control mappings for existing Ubuntu rules
 * Uses the same keyword-based mapping logic as the STIG import endpoint
 */
async function generateUbuntuMappings() {
  console.log('🚀 Generating mappings for existing Ubuntu STIG rules...\n');

  try {
    // Get all Ubuntu STIG rules
    const ubuntuRules = await db
      .select()
      .from(stigRules)
      .where(eq(stigRules.stigId, 'UBUNTU-20-STIG'));

    console.log(`Found ${ubuntuRules.length} Ubuntu STIG rules\n`);

    if (ubuntuRules.length === 0) {
      console.log('❌ No Ubuntu STIG rules found. Please import Ubuntu STIG first.');
      process.exit(1);
    }

    // Mapping patterns (same as in assessment.ts)
    const mappingPatterns = [
      { keywords: ['access', 'authorization', 'permission'], controlId: 'AC-3', rationale: 'Access control enforcement' },
      { keywords: ['audit', 'logging', 'log'], controlId: 'AU-2', rationale: 'Audit event selection' },
      { keywords: ['config', 'setting', 'baseline'], controlId: 'CM-6', rationale: 'Configuration settings' },
      { keywords: ['auth', 'password', 'credential', 'login'], controlId: 'IA-2', rationale: 'Identification and authentication' },
      { keywords: ['encrypt', 'crypto', 'cipher'], controlId: 'SC-8', rationale: 'Transmission confidentiality' },
      { keywords: ['patch', 'update', 'vulnerability'], controlId: 'SI-2', rationale: 'Flaw remediation' },
      { keywords: ['account', 'user'], controlId: 'AC-2', rationale: 'Account management' },
      { keywords: ['session', 'timeout', 'concurrent'], controlId: 'AC-10', rationale: 'Concurrent session control' }
    ];

    // Generate mappings
    const mappingsToInsert = [];
    
    for (const rule of ubuntuRules) {
      const ruleText = ((rule.title || '') + ' ' + (rule.description || '')).toLowerCase();
      
      for (const pattern of mappingPatterns) {
        if (pattern.keywords.some(keyword => ruleText.includes(keyword))) {
          mappingsToInsert.push({
            stigRuleId: rule.id,
            controlId: pattern.controlId,
            rationale: `Automated mapping: ${pattern.rationale}`
          });
          break; // Only one mapping per rule
        }
      }
    }

    console.log(`Generated ${mappingsToInsert.length} mappings\n`);

    // Bulk insert all mappings
    if (mappingsToInsert.length > 0) {
      await db.insert(stigRuleControls).values(mappingsToInsert).onConflictDoNothing();
      console.log(`✅ Created ${mappingsToInsert.length} automatic STIG-to-NIST mappings`);
      
      // Show breakdown by control
      const controlCounts = mappingsToInsert.reduce((acc, m) => {
        acc[m.controlId] = (acc[m.controlId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('\nMappings by control:');
      Object.entries(controlCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([controlId, count]) => {
          console.log(`  ${controlId}: ${count} mappings`);
        });
    } else {
      console.log('⚠️  No mappings generated. Rules may not match any keyword patterns.');
    }

    console.log('\n✨ Ubuntu STIG mappings generated successfully!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error generating Ubuntu mappings:', error);
    process.exit(1);
  }
}

generateUbuntuMappings();
