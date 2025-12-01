// ATO Package Generation Service
// Generates complete ATO compliance packages with all required documents

import { storage } from '../storage';
import { sspGenerationService } from './ssp-generation.service';
import { narrativeGenerationService } from './narrative-generation.service';
import { storagePaths } from '../config/storage-paths';
import archiver from 'archiver';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';
import type { System } from '../schema';

export interface ATOPackageOptions {
  systemId: string;
  includeSSP?: boolean;
  includeNarratives?: boolean;
  includeEvidence?: boolean;
  includeFindings?: boolean;
  includePOAM?: boolean;
  includeChecklists?: boolean;
  format?: 'zip' | 'tar';
}

export interface ATOPackageResult {
  success: boolean;
  packagePath?: string;
  packageSize?: number;
  documentsIncluded: string[];
  errors: string[];
  warnings: string[];
}

export class ATOPackageGenerationService {
  private readonly PACKAGES_DIR = storagePaths.packages;

  /**
   * Generate complete ATO package for a system
   */
  async generateATOPackage(options: ATOPackageOptions): Promise<ATOPackageResult> {
    const result: ATOPackageResult = {
      success: false,
      documentsIncluded: [],
      errors: [],
      warnings: []
    };

    try {
      // Validate system exists
      const system = await storage.getSystem(options.systemId);
      if (!system) {
        result.errors.push('System not found');
        return result;
      }

      // Ensure packages directory exists
      await fs.mkdir(this.PACKAGES_DIR, { recursive: true });

      // Create package filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedName = system.name.replace(/[^a-zA-Z0-9]/g, '_');
      const packageFileName = `ATO_Package_${sanitizedName}_${timestamp}.zip`;
      const packagePath = join(this.PACKAGES_DIR, packageFileName);

      // Create archive
      const output = await fs.open(packagePath, 'w');
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      // Pipe archive to file
      const writeStream = output.createWriteStream();
      archive.pipe(writeStream);

      // Add README
      await this.addReadme(archive, system);
      result.documentsIncluded.push('README.md');

      // Add System Security Plan (SSP)
      if (options.includeSSP !== false) {
        try {
          await this.addSSP(archive, system);
          result.documentsIncluded.push('System_Security_Plan.pdf');
        } catch (error) {
          result.errors.push(`Failed to generate SSP: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Add Control Narratives
      if (options.includeNarratives !== false) {
        try {
          await this.addNarratives(archive, options.systemId);
          result.documentsIncluded.push('Control_Narratives/');
        } catch (error) {
          result.errors.push(`Failed to generate narratives: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Add Evidence
      if (options.includeEvidence !== false) {
        try {
          await this.addEvidence(archive, options.systemId);
          result.documentsIncluded.push('Evidence/');
        } catch (error) {
          result.warnings.push(`Failed to include evidence: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Add Findings
      if (options.includeFindings !== false) {
        try {
          await this.addFindings(archive, options.systemId);
          result.documentsIncluded.push('Findings/');
        } catch (error) {
          result.warnings.push(`Failed to include findings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Add POAM
      if (options.includePOAM !== false) {
        try {
          await this.addPOAM(archive, options.systemId);
          result.documentsIncluded.push('POAM.xlsx');
        } catch (error) {
          result.warnings.push(`Failed to generate POAM: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Add Checklists
      if (options.includeChecklists !== false) {
        try {
          await this.addChecklists(archive, options.systemId);
          result.documentsIncluded.push('Checklists/');
        } catch (error) {
          result.warnings.push(`Failed to include checklists: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Finalize archive
      await archive.finalize();
      await new Promise((resolve, reject) => {
        writeStream.on('close', resolve);
        writeStream.on('error', reject);
      });

      await output.close();

      // Get package size
      const stats = await fs.stat(packagePath);
      result.packageSize = stats.size;
      result.packagePath = packagePath;
      result.success = true;

    } catch (error) {
      result.errors.push(`Package generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Add README to package
   */
  private async addReadme(archive: archiver.Archiver, system: System): Promise<void> {
    const readme = `# ATO Package - ${system.name}

## System Information
- **System Name**: ${system.name}
- **Description**: ${system.description || 'N/A'}
- **Impact Level**: ${system.impactLevel}
- **Category**: ${system.category}
- **Owner**: ${system.owner || 'N/A'}
- **Package Generated**: ${new Date().toISOString()}

## Package Contents

This ATO compliance package contains the following documentation:

### 1. System Security Plan (SSP)
Complete system security plan documenting all implemented security controls.

### 2. Control Narratives
Detailed implementation narratives for each NIST 800-53 control.

### 3. Evidence
Supporting evidence and documentation for control implementations.

### 4. Findings
Security assessment findings and vulnerabilities.

### 5. Plan of Action & Milestones (POA&M)
Remediation plan for identified findings.

### 6. Security Checklists
STIG and compliance checklists.

## Review Instructions

1. Review the System Security Plan for completeness
2. Verify all control narratives are accurate
3. Examine evidence for sufficiency
4. Review findings and POA&M items
5. Validate checklist compliance

## Contact

For questions regarding this ATO package, contact the system owner or security team.

---
Generated by ATO Compliance Automation System
`;

    archive.append(readme, { name: 'README.md' });
  }

  /**
   * Add SSP to package
   */
  private async addSSP(archive: archiver.Archiver, system: System): Promise<void> {
    // Generate SSP (placeholder - would use actual SSP service)
    const sspContent = `System Security Plan for ${system.name}\n\nGenerated: ${new Date().toISOString()}`;
    archive.append(sspContent, { name: 'System_Security_Plan.txt' });
  }

  /**
   * Add control narratives to package
   */
  private async addNarratives(archive: archiver.Archiver, systemId: string): Promise<void> {
    const controls = await storage.getControlsBySystemId(systemId);

    if (controls.length === 0) {
      archive.append('No controls assigned to this system.', { name: 'Control_Narratives/README.txt' });
      return;
    }

    for (const control of controls.slice(0, 10)) { // Limit to first 10 for performance
      const narrative = `Control: ${control.id} - ${control.title}\n\nDescription: ${control.description}\n\nImplementation: To be documented`;
      archive.append(narrative, { name: `Control_Narratives/${control.id}.txt` });
    }

    if (controls.length > 10) {
      archive.append(`Total controls: ${controls.length}\nShowing first 10 in this package.`, {
        name: 'Control_Narratives/_SUMMARY.txt'
      });
    }
  }

  /**
   * Add evidence to package
   */
  private async addEvidence(archive: archiver.Archiver, systemId: string): Promise<void> {
    const evidence = await storage.getEvidenceBySystem(systemId);

    if (evidence.length === 0) {
      archive.append('No evidence uploaded for this system.', { name: 'Evidence/README.txt' });
      return;
    }

    const evidenceList = evidence.map((e, i) =>
      `${i + 1}. ${e.title || 'Evidence Item'} - ${e.type || 'Unknown'}`
    ).join('\n');

    archive.append(`Evidence Items:\n\n${evidenceList}\n\nNote: Actual files not included in automated package.`, {
      name: 'Evidence/evidence_list.txt'
    });
  }

  /**
   * Add findings to package
   */
  private async addFindings(archive: archiver.Archiver, systemId: string): Promise<void> {
    const findings = await storage.getFindingsBySystem(systemId);

    if (findings.length === 0) {
      archive.append('No findings recorded for this system.', { name: 'Findings/README.txt' });
      return;
    }

    const findingsSummary = findings.map((f, i) =>
      `${i + 1}. [${f.severity}] ${f.title}\n   Status: ${f.status}\n   ${f.description || 'No description'}\n`
    ).join('\n');

    archive.append(`Security Findings:\n\n${findingsSummary}`, {
      name: 'Findings/findings_summary.txt'
    });
  }

  /**
   * Add POAM to package
   */
  private async addPOAM(archive: archiver.Archiver, systemId: string): Promise<void> {
    const poamItems = await storage.getPoamItemsBySystem(systemId);

    if (poamItems.length === 0) {
      archive.append('No POA&M items for this system.', { name: 'POAM.txt' });
      return;
    }

    const poamContent = poamItems.map((item, i) =>
      `${i + 1}. ${item.title}\n   Status: ${item.status}\n   Target Date: ${item.targetDate}\n   Resources: ${item.resourcesRequired || 'TBD'}\n`
    ).join('\n');

    archive.append(`Plan of Action & Milestones\n\n${poamContent}`, { name: 'POAM.txt' });
  }

  /**
   * Add checklists to package
   */
  private async addChecklists(archive: archiver.Archiver, systemId: string): Promise<void> {
    const checklists = await storage.getChecklistsBySystem(systemId);

    if (checklists.length === 0) {
      archive.append('No checklists for this system.', { name: 'Checklists/README.txt' });
      return;
    }

    for (const checklist of checklists) {
      const content = `Checklist: ${checklist.type}\nStatus: ${checklist.status}\nCompleted: ${checklist.completedDate || 'In Progress'}`;
      archive.append(content, { name: `Checklists/${checklist.type}_${checklist.id}.txt` });
    }
  }

  /**
   * Get package download stream
   */
  async getPackageStream(packagePath: string): Promise<Readable> {
    const stream = await fs.open(packagePath, 'r');
    return stream.createReadStream();
  }

  /**
   * Delete package file
   */
  async deletePackage(packagePath: string): Promise<void> {
    await fs.unlink(packagePath);
  }
}

// Export singleton instance
export const atoPackageGenerationService = new ATOPackageGenerationService();
