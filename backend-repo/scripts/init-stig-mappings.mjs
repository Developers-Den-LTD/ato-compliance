#!/usr/bin/env node
/**
 * STIG-to-NIST Control Mapping Initialization Script (ES Module version)
 * Following CLAUDE.md consistency patterns
 * 
 * This script populates the CCI (Control Correlation Identifier) mappings
 * between STIG rules and NIST 800-53 controls for compliance automation.
 */

import { db } from '../db.js';
import { ccis, stigRuleControls, stigRules, controls } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';

// Official CCI to NIST 800-53 mappings from DISA
const OFFICIAL_CCI_MAPPINGS = [
  // Access Control (AC) Family
  { cci: 'CCI-000015', definition: 'The organization defines individuals authorized to make information freely available to the public.', controlId: 'AC-22' },
  { cci: 'CCI-000016', definition: 'The organization defines information that may be made freely available to the public.', controlId: 'AC-22' },
  { cci: 'CCI-000213', definition: 'The organization enforces approved authorizations for logical access to information and system resources.', controlId: 'AC-3' },
  { cci: 'CCI-001384', definition: 'The organization defines the frequency for reviews and updates to the access control policy.', controlId: 'AC-1' },
  { cci: 'CCI-001385', definition: 'The organization defines the frequency for reviews and updates to the access control procedures.', controlId: 'AC-1' },
  { cci: 'CCI-001617', definition: 'The organization limits the number of concurrent sessions to an organization-defined number for each organization-defined account and/or account type.', controlId: 'AC-10' },
  { cci: 'CCI-002009', definition: 'The organization monitors the use of information system accounts.', controlId: 'AC-2' },
  { cci: 'CCI-002010', definition: 'The organization reviews the information system account utilization.', controlId: 'AC-2' },
  
  // Configuration Management (CM) Family
  { cci: 'CCI-000366', definition: 'The organization implements the security configuration settings.', controlId: 'CM-6' },
  { cci: 'CCI-001199', definition: 'The organization defines security configuration settings for information technology products employed within the information system using organization-defined security configuration checklists.', controlId: 'CM-6' },
  { cci: 'CCI-001444', definition: 'The organization defines the baseline configuration for the information system.', controlId: 'CM-2' },
  { cci: 'CCI-000195', definition: 'The organization defines configuration change control procedures.', controlId: 'CM-3' },
  
  // System and Information Integrity (SI) Family
  { cci: 'CCI-001240', definition: 'The organization defines the frequency for scanning for unauthorized software on organizational information systems.', controlId: 'SI-7' },
  { cci: 'CCI-001497', definition: 'The organization defines information system components for which duplicate system security plans need to be developed.', controlId: 'SI-12' },
  { cci: 'CCI-002418', definition: 'The organization defines the time period for retaining audit records.', controlId: 'AU-11' },
  
  // Audit and Accountability (AU) Family
  { cci: 'CCI-000154', definition: 'The organization defines the events for which the information system is capable of auditing.', controlId: 'AU-2' },
  { cci: 'CCI-000158', definition: 'The organization defines the frequency for reviews and updates to the list of organization-defined auditable events.', controlId: 'AU-2' },
  { cci: 'CCI-000159', definition: 'The organization reviews and updates the list of organization-defined auditable events.', controlId: 'AU-2' },
  
  // Identification and Authentication (IA) Family
  { cci: 'CCI-000764', definition: 'The organization defines the list of organization-defined group and role memberships for user accounts.', controlId: 'IA-2' },
  { cci: 'CCI-000765', definition: 'The organization defines the conditions for group and role membership.', controlId: 'IA-2' },
  { cci: 'CCI-000766', definition: 'The organization defines the time period for privileged accounts.', controlId: 'IA-2' },
  
  // System and Communications Protection (SC) Family
  { cci: 'CCI-001453', definition: 'The organization defines the alternative physical safeguards to be employed when it is not feasible to employ encrypted communications paths for transmission of organization-defined unclassified information.', controlId: 'SC-8' },
  { cci: 'CCI-002450', definition: 'The organization defines the unclassified information for which alternative physical safeguards are to be employed when it is not feasible to employ encrypted communications paths for transmission.', controlId: 'SC-8' }
];

// STIG-specific CCI mappings (These are commonly used in STIGs)
const STIG_CCI_MAPPINGS = [
  // Ubuntu 24.04 LTS STIG-specific CCIs
  { cci: 'CCI-004084', definition: 'The organization defines the frequency for time synchronization.', controlId: 'AU-8' },
  { cci: 'CCI-001958', definition: 'The organization prohibits the installation of unauthorized software.', controlId: 'CM-11' },
  { cci: 'CCI-001090', definition: 'The organization defines the time period within which the information system is capable of automatically disabling accounts after the defined time period of inactivity.', controlId: 'AC-2' },
  { cci: 'CCI-000192', definition: 'The organization defines minimum password complexity requirements.', controlId: 'IA-5' },
  { cci: 'CCI-000193', definition: 'The organization defines minimum password length requirements.', controlId: 'IA-5' },
  { cci: 'CCI-000194', definition: 'The organization defines the types of characters required for passwords.', controlId: 'IA-5' },
  { cci: 'CCI-000205', definition: 'The organization defines minimum password lifetime restrictions.', controlId: 'IA-5' },
  { cci: 'CCI-000199', definition: 'The organization defines maximum password lifetime restrictions.', controlId: 'IA-5' },
  { cci: 'CCI-000200', definition: 'The organization defines the number of password generations for password reuse restrictions.', controlId: 'IA-5' },
];

// Sample STIG rule to control mappings (these typically come from XCCDF files)
// These map specific STIG rules to controls via CCIs
const STIG_RULE_MAPPINGS = [
  { 
    stigRuleId: 'xccdf_mil.disa.stig_rule_SV-270645r1068357_rule', 
    controlIds: ['AU-8'], 
    description: 'Time synchronization mapping' 
  },
  { 
    stigRuleId: 'xccdf_mil.disa.stig_rule_SV-270647r1066430_rule', 
    controlIds: ['AC-3', 'SC-7'], 
    description: 'Remote access control mapping' 
  },
  { 
    stigRuleId: 'xccdf_mil.disa.stig_rule_SV-270649r1067136_rule', 
    controlIds: ['SI-6', 'SI-7'], 
    description: 'File integrity mapping' 
  },
  { 
    stigRuleId: 'xccdf_mil.disa.stig_rule_SV-270652r1067138_rule', 
    controlIds: ['SI-6', 'CM-5'], 
    description: 'Configuration monitoring mapping' 
  },
  { 
    stigRuleId: 'xccdf_mil.disa.stig_rule_SV-270655r1067145_rule', 
    controlIds: ['SC-7', 'AC-4'], 
    description: 'Firewall configuration mapping' 
  },
  { 
    stigRuleId: 'xccdf_mil.disa.stig_rule_SV-270656r1067148_rule', 
    controlIds: ['AU-12', 'AU-3'], 
    description: 'Audit configuration mapping' 
  },
  { 
    stigRuleId: 'xccdf_mil.disa.stig_rule_SV-270657r1066460_rule', 
    controlIds: ['AU-12', 'AU-3', 'AU-4', 'AU-5'], 
    description: 'Comprehensive audit mapping' 
  },
  { 
    stigRuleId: 'xccdf_mil.disa.stig_rule_SV-270659r1066466_rule', 
    controlIds: ['AC-6', 'CM-7'], 
    description: 'AppArmor security mapping' 
  },
  { 
    stigRuleId: 'xccdf_mil.disa.stig_rule_SV-270661r1067175_rule', 
    controlIds: ['IA-5'], 
    description: 'Password quality mapping' 
  },
];

async function initializeStigMappings() {
  console.log('🚀 Starting STIG mapping initialization...');
  
  try {
    // Step 1: Insert CCIs
    console.log('\n📝 Inserting CCI definitions...');
    let cciCount = 0;
    
    for (const mapping of [...OFFICIAL_CCI_MAPPINGS, ...STIG_CCI_MAPPINGS]) {
      // Check if CCI already exists
      const existingCci = await db
        .select()
        .from(ccis)
        .where(eq(ccis.cci, mapping.cci))
        .limit(1);
      
      if (existingCci.length === 0) {
        await db.insert(ccis).values({
          id: mapping.cci.toLowerCase(),
          cci: mapping.cci,
          definition: mapping.definition,
          nistControl: mapping.controlId,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        cciCount++;
        console.log(`   ✅ Added CCI: ${mapping.cci} → ${mapping.controlId}`);
      }
    }
    console.log(`✅ Inserted ${cciCount} new CCIs`);
    
    // Step 2: Map STIG rules to controls
    console.log('\n🔗 Creating STIG rule to control mappings...');
    let mappingCount = 0;
    
    for (const mapping of STIG_RULE_MAPPINGS) {
      // Verify STIG rule exists
      const stigRule = await db
        .select()
        .from(stigRules)
        .where(eq(stigRules.id, mapping.stigRuleId))
        .limit(1);
      
      if (stigRule.length === 0) {
        console.log(`   ⚠️  STIG rule not found: ${mapping.stigRuleId}`);
        continue;
      }
      
      // Map to each control
      for (const controlId of mapping.controlIds) {
        // Verify control exists
        const control = await db
          .select()
          .from(controls)
          .where(eq(controls.id, controlId))
          .limit(1);
        
        if (control.length === 0) {
          console.log(`   ⚠️  Control not found: ${controlId}`);
          continue;
        }
        
        // Check if mapping already exists
        const existingMapping = await db
          .select()
          .from(stigRuleControls)
          .where(
            and(
              eq(stigRuleControls.stigRuleId, mapping.stigRuleId),
              eq(stigRuleControls.controlId, controlId)
            )
          )
          .limit(1);
        
        if (existingMapping.length === 0) {
          await db.insert(stigRuleControls).values({
            id: `${mapping.stigRuleId}-${controlId}`,
            stigRuleId: mapping.stigRuleId,
            controlId: controlId,
            mappingType: 'direct',
            createdAt: new Date(),
            updatedAt: new Date()
          });
          mappingCount++;
          console.log(`   ✅ Mapped: ${mapping.stigRuleId} → ${controlId}`);
        }
      }
    }
    console.log(`✅ Created ${mappingCount} new STIG rule mappings`);
    
    // Step 3: Summary
    console.log('\n📊 Verification Summary:');
    
    const totalCcis = await db.select().from(ccis);
    console.log(`   Total CCIs: ${totalCcis.length}`);
    
    const totalMappings = await db.select().from(stigRuleControls);
    console.log(`   Total STIG mappings: ${totalMappings.length}`);
    
    const stigsWithMappings = await db
      .selectDistinct({ stigRuleId: stigRuleControls.stigRuleId })
      .from(stigRuleControls);
    console.log(`   STIG rules with mappings: ${stigsWithMappings.length}`);
    
    console.log('\n✅ STIG mapping initialization complete!');
    
  } catch (error) {
    console.error('❌ Error during initialization:', error);
    throw error;
  }
}

// Run the initialization
initializeStigMappings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });