#!/usr/bin/env node
import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Fetches the official NIST 800-53 Rev 5 catalog from NIST's OSCAL repository
 */
async function fetchNISTCatalog() {
  const catalogUrl = 'https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json';
  
  console.log('Fetching NIST 800-53 Rev 5 catalog from:', catalogUrl);
  
  return new Promise<string>((resolve, reject) => {
    https.get(catalogUrl, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(data);
      });
      
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parse OSCAL catalog and extract controls in our format
 */
function parseOSCALCatalog(oscalData: any) {
  const controls: any[] = [];
  
  // OSCAL structure has groups (families) containing controls
  if (oscalData.catalog && oscalData.catalog.groups) {
    for (const group of oscalData.catalog.groups) {
      const familyName = group.title || group.id;
      
      if (group.controls) {
        for (const control of group.controls) {
          // Main control
          const baselineArray = determineBaseline(control);
          
          controls.push({
            id: control.id.toUpperCase(),
            title: control.title,
            description: extractDescription(control),
            family: familyName,
            baseline: baselineArray,
            priority: determinePriority(control),
            enhancement: null,
            supplementalGuidance: extractSupplementalGuidance(control)
          });
          
          // Control enhancements
          if (control.controls) {
            for (const enhancement of control.controls) {
              const enhancementBaseline = determineBaseline(enhancement);
              
              controls.push({
                id: enhancement.id.toUpperCase(),
                title: enhancement.title,
                description: extractDescription(enhancement),
                family: familyName,
                baseline: enhancementBaseline,
                priority: determinePriority(enhancement),
                enhancement: control.id.toUpperCase(), // Parent control
                supplementalGuidance: extractSupplementalGuidance(enhancement)
              });
            }
          }
        }
      }
    }
  }
  
  return controls;
}

/**
 * Extract description from OSCAL prose sections
 */
function extractDescription(control: any): string {
  if (control.parts) {
    for (const part of control.parts) {
      if (part.name === 'statement' && part.prose) {
        return part.prose;
      }
    }
  }
  return control.title || '';
}

/**
 * Extract supplemental guidance
 */
function extractSupplementalGuidance(control: any): string | null {
  if (control.parts) {
    for (const part of control.parts) {
      if (part.name === 'guidance' && part.prose) {
        return part.prose;
      }
    }
  }
  return null;
}

/**
 * Determine baseline based on control properties
 * This is a simplified mapping - in reality, baseline is determined by NIST SP 800-53B
 */
function determineBaseline(control: any): string[] {
  const controlId = control.id.toUpperCase();
  const baselines: string[] = [];
  
  // Get baseline from properties if available
  if (control.props) {
    for (const prop of control.props) {
      if (prop.name === 'baseline-impact') {
        if (prop.value.includes('low')) baselines.push('Low');
        if (prop.value.includes('moderate')) baselines.push('Moderate');
        if (prop.value.includes('high')) baselines.push('High');
      }
    }
  }
  
  // If no baseline found, use default mapping based on control family and number
  if (baselines.length === 0) {
    // Core controls (non-enhancements) typically apply to all baselines
    if (!controlId.includes('(')) {
      // Most base controls apply to all baselines
      if (controlId.match(/^(AC|AU|CM|CP|IA|SC|SI)-[0-9]+$/)) {
        baselines.push('Low', 'Moderate', 'High');
      }
    } else {
      // Enhancements typically apply to higher baselines
      const enhancementNum = parseInt(controlId.match(/\\(([0-9]+)\\)/)?.[1] || '0');
      if (enhancementNum <= 2) {
        baselines.push('Moderate', 'High');
      } else {
        baselines.push('High');
      }
    }
  }
  
  return baselines;
}

/**
 * Determine priority based on control characteristics
 */
function determinePriority(control: any): string {
  const controlId = control.id.toUpperCase();
  
  // P1: Critical security controls
  if (controlId.match(/^(AC-[23]|AU-[23]|CM-[67]|IA-[25]|SC-[78]|SI-[234])$/)) {
    return 'P1';
  }
  
  // P1: Policy controls
  if (controlId.endsWith('-1')) {
    return 'P1';
  }
  
  // P2: Important operational controls
  if (controlId.match(/^(CA-[237]|CP-[2349]|IR-[456]|RA-[35]|SA-[489])$/)) {
    return 'P2';
  }
  
  // P3: Everything else
  return 'P3';
}

/**
 * Main function to fetch and save NIST catalog
 */
async function main() {
  try {
    console.log('Fetching NIST 800-53 Rev 5 catalog...');
    const catalogData = await fetchNISTCatalog();
    
    console.log('Parsing catalog...');
    const oscalCatalog = JSON.parse(catalogData);
    const controls = parseOSCALCatalog(oscalCatalog);
    
    console.log(`Extracted ${controls.length} controls`);
    
    // Count by family
    const families = new Set(controls.map(c => c.family));
    console.log(`Control families: ${families.size}`);
    
    // Save processed controls
    const outputPath = path.join(__dirname, 'nist-800-53-rev5-full.json');
    await fs.writeFile(
      outputPath,
      JSON.stringify({
        version: "5.1.1",
        source: "NIST SP 800-53 Rev 5",
        lastUpdated: new Date().toISOString().split('T')[0],
        totalControls: controls.length,
        families: Array.from(families),
        controls: controls
      }, null, 2)
    );
    
    console.log(`✅ Saved ${controls.length} controls to ${outputPath}`);
    
    // Summary by family
    const familyCount: Record<string, number> = {};
    for (const control of controls) {
      familyCount[control.family] = (familyCount[control.family] || 0) + 1;
    }
    
    console.log('\\nControls by family:');
    for (const [family, count] of Object.entries(familyCount).sort()) {
      console.log(`  ${family}: ${count} controls`);
    }
    
  } catch (error) {
    console.error('Error fetching NIST catalog:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
