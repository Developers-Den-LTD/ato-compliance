// Generation Validation Service
// Pre-flight checks and validation for document generation
// Part of Epic 9 - Document Intelligence Pipeline

import os from 'os';
import { storage } from '../storage';
import type { GenerationRequest } from './generation-service';
import type { System, Control, SystemControl, Template } from '../schema';

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
  details?: any;
}

export interface ValidationResult {
  valid: boolean;
  checks: ValidationCheck[];
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface ResourceCheck extends ValidationCheck {
  resources: {
    memory: {
      available: number;
      required: number;
      unit: string;
    };
    cpu: {
      load: number;
      threshold: number;
    };
    disk?: {
      available: number;
      required: number;
      unit: string;
    };
  };
}

export class GenerationValidator {
  private readonly thresholds = {
    minMemoryMB: 500,
    maxCpuLoadPerCore: 0.9,
    minDiskSpaceMB: 1000,
    maxControlsPerBatch: 100,
    maxArtifactSizeMB: 50
  };

  /**
   * Comprehensive validation for generation request
   */
  async validateRequest(request: GenerationRequest): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];
    
    // Run all validation checks
    const [
      systemCheck,
      templateCheck,
      controlsCheck,
      resourceCheck,
      connectivityCheck,
      dataIntegrityCheck
    ] = await Promise.all([
      this.validateSystem(request.systemId),
      this.validateTemplates(request),
      this.validateControls(request.systemId),
      this.validateResources(),
      this.validateConnectivity(),
      this.validateDataIntegrity(request.systemId)
    ]);

    checks.push(
      systemCheck,
      templateCheck,
      controlsCheck,
      resourceCheck,
      connectivityCheck,
      dataIntegrityCheck
    );

    // Add document-type specific checks
    for (const docType of request.documentTypes) {
      const typeCheck = await this.validateDocumentType(docType, request);
      checks.push(typeCheck);
    }

    return this.aggregateResults(checks);
  }

  /**
   * Validate system exists and has required data
   */
  private async validateSystem(systemId: string): Promise<ValidationCheck> {
    try {
      const system = await storage.getSystem(systemId);
      
      if (!system) {
        return {
          name: 'system_check',
          passed: false,
          message: `System ${systemId} not found`,
          severity: 'error'
        };
      }

      const issues: string[] = [];
      
      if (!system.name) issues.push('System name is missing');
      if (!system.description) issues.push('System description is missing');
      if (!system.impactLevel) issues.push('Impact level not defined');
      if (!system.category) issues.push('System category not specified');
      
      if (issues.length > 0) {
        return {
          name: 'system_check',
          passed: false,
          message: `System data incomplete: ${issues.join(', ')}`,
          severity: 'error',
          details: { system, issues }
        };
      }

      return {
        name: 'system_check',
        passed: true,
        message: `System ${system.name} validated successfully`,
        severity: 'info',
        details: { system }
      };
      
    } catch (error) {
      return {
        name: 'system_check',
        passed: false,
        message: `System validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      };
    }
  }

  /**
   * Validate templates are available if needed
   */
  private async validateTemplates(request: GenerationRequest): Promise<ValidationCheck> {
    if (!request.useTemplates) {
      return {
        name: 'template_check',
        passed: true,
        message: 'Template validation skipped (not using templates)',
        severity: 'info'
      };
    }

    try {
      const issues: string[] = [];
      
      // Check if template IDs are provided
      if (request.templateOptions?.templateIds) {
        for (const [docType, templateId] of Object.entries(request.templateOptions.templateIds)) {
          try {
            const template = await storage.getTemplate(templateId);
            if (!template) {
              issues.push(`Template ${templateId} for ${docType} not found`);
            } else if (template.status !== 'active') {
              issues.push(`Template ${templateId} is ${template.status}`);
            }
          } catch (error) {
            issues.push(`Error checking template ${templateId}: ${error}`);
          }
        }
      } else {
        // Check for default templates
        for (const docType of request.documentTypes) {
          const hasTemplate = await this.checkDefaultTemplate(docType);
          if (!hasTemplate) {
            issues.push(`No default template for ${docType}`);
          }
        }
      }

      if (issues.length > 0) {
        return {
          name: 'template_check',
          passed: false,
          message: `Template issues found: ${issues.join(', ')}`,
          severity: 'warning',
          details: { issues }
        };
      }

      return {
        name: 'template_check',
        passed: true,
        message: 'All templates validated',
        severity: 'info'
      };
      
    } catch (error) {
      return {
        name: 'template_check',
        passed: false,
        message: `Template validation error: ${error}`,
        severity: 'error'
      };
    }
  }

  /**
   * Validate controls and their implementations
   */
  private async validateControls(systemId: string): Promise<ValidationCheck> {
    try {
      const [controls, systemControls] = await Promise.all([
        storage.getControlsBySystemId(systemId),
        storage.getSystemControls(systemId)
      ]);

      const issues: string[] = [];
      
      if (controls.length === 0) {
        return {
          name: 'controls_check',
          passed: false,
          message: 'No controls found for system',
          severity: 'error'
        };
      }

      if (systemControls.length === 0) {
        issues.push('No control implementations found');
      }

      // Check implementation coverage
      const implementedCount = systemControls.filter(sc => 
        sc.status === 'implemented'
      ).length;
      
      const coverage = (implementedCount / controls.length) * 100;
      
      if (coverage < 20) {
        issues.push(`Low implementation coverage: ${Math.round(coverage)}%`);
      }

      // Check for controls without narratives
      const withoutNarratives = systemControls.filter(sc => 
        !sc.implementationText || sc.implementationText.trim() === ''
      ).length;
      
      if (withoutNarratives > controls.length * 0.5) {
        issues.push(`${withoutNarratives} controls lack implementation narratives`);
      }

      // Check if controls exceed batch limits
      if (controls.length > this.thresholds.maxControlsPerBatch) {
        issues.push(`${controls.length} controls exceed batch limit of ${this.thresholds.maxControlsPerBatch}`);
      }

      return {
        name: 'controls_check',
        passed: issues.length === 0,
        message: issues.length > 0 
          ? `Control validation issues: ${issues.join(', ')}`
          : `${controls.length} controls validated`,
        severity: issues.length > 0 ? 'warning' : 'info',
        details: {
          totalControls: controls.length,
          implementedControls: implementedCount,
          coverage: Math.round(coverage),
          withoutNarratives
        }
      };
      
    } catch (error) {
      return {
        name: 'controls_check',
        passed: false,
        message: `Control validation error: ${error}`,
        severity: 'error'
      };
    }
  }

  /**
   * Validate system resources
   */
  async validateResources(): Promise<ResourceCheck> {
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();
    const freeMemoryMB = Math.round(freeMemory / 1024 / 1024);
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const loadPerCore = loadAvg / cpuCount;
    
    const issues: string[] = [];
    
    if (freeMemoryMB < this.thresholds.minMemoryMB) {
      issues.push(`Insufficient memory: ${freeMemoryMB}MB available, need ${this.thresholds.minMemoryMB}MB`);
    }
    
    if (loadPerCore > this.thresholds.maxCpuLoadPerCore) {
      issues.push(`High CPU load: ${Math.round(loadPerCore * 100)}% per core`);
    }

    return {
      name: 'resource_check',
      passed: issues.length === 0,
      message: issues.length > 0
        ? `Resource constraints: ${issues.join(', ')}`
        : `Resources OK: ${freeMemoryMB}MB free, ${Math.round(loadPerCore * 100)}% CPU`,
      severity: issues.length > 0 ? 'error' : 'info',
      resources: {
        memory: {
          available: freeMemoryMB,
          required: this.thresholds.minMemoryMB,
          unit: 'MB'
        },
        cpu: {
          load: loadPerCore,
          threshold: this.thresholds.maxCpuLoadPerCore
        }
      }
    };
  }

  /**
   * Validate connectivity to required services
   */
  private async validateConnectivity(): Promise<ValidationCheck> {
    const issues: string[] = [];
    
    // Check database connectivity
    try {
      await storage.getSystem('00000000-0000-0000-0000-000000000000');
    } catch (error) {
      issues.push('Database connection failed');
    }

    // Check LLM service if not using templates
    try {
      const { modelRouter } = await import('../llm/model-router');
      const isAvailable = await modelRouter.isAvailable();
      if (!isAvailable) {
        issues.push('LLM service unavailable');
      }
    } catch (error) {
      issues.push('LLM service check failed');
    }

    return {
      name: 'connectivity_check',
      passed: issues.length === 0,
      message: issues.length > 0
        ? `Connectivity issues: ${issues.join(', ')}`
        : 'All services connected',
      severity: issues.length > 0 ? 'error' : 'info'
    };
  }

  /**
   * Validate data integrity
   */
  private async validateDataIntegrity(systemId: string): Promise<ValidationCheck> {
    const issues: string[] = [];
    
    try {
      // Check for orphaned control implementations
      const systemControls = await storage.getSystemControls(systemId);
      const controls = await storage.getControlsBySystemId(systemId);
      const controlIds = new Set(controls.map(c => c.id));
      
      const orphaned = systemControls.filter(sc => !controlIds.has(sc.controlId));
      if (orphaned.length > 0) {
        issues.push(`${orphaned.length} orphaned control implementations`);
      }

      // Check for duplicate implementations
      const implementations = new Map<string, number>();
      systemControls.forEach(sc => {
        const count = implementations.get(sc.controlId) || 0;
        implementations.set(sc.controlId, count + 1);
      });
      
      const duplicates = Array.from(implementations.entries())
        .filter(([_, count]) => count > 1);
      
      if (duplicates.length > 0) {
        issues.push(`${duplicates.length} controls have duplicate implementations`);
      }

      return {
        name: 'data_integrity_check',
        passed: issues.length === 0,
        message: issues.length > 0
          ? `Data integrity issues: ${issues.join(', ')}`
          : 'Data integrity verified',
        severity: issues.length > 0 ? 'warning' : 'info',
        details: { orphaned: orphaned.length, duplicates: duplicates.length }
      };
      
    } catch (error) {
      return {
        name: 'data_integrity_check',
        passed: false,
        message: `Data integrity check failed: ${error}`,
        severity: 'error'
      };
    }
  }

  /**
   * Document type specific validation
   */
  private async validateDocumentType(
    docType: string, 
    request: GenerationRequest
  ): Promise<ValidationCheck> {
    switch (docType) {
      case 'ssp':
        return this.validateSSPRequirements(request);
      
      case 'stig_checklist':
      case 'jsig_checklist':
        return this.validateChecklistRequirements(request, docType);
      
      case 'poam_report':
        return this.validatePoamRequirements(request);
      
      default:
        return {
          name: `${docType}_check`,
          passed: true,
          message: `Document type ${docType} validated`,
          severity: 'info'
        };
    }
  }

  /**
   * SSP-specific validation
   */
  private async validateSSPRequirements(request: GenerationRequest): Promise<ValidationCheck> {
    const issues: string[] = [];
    
    // Check required metadata
    if (!request.templateOptions?.organization) {
      issues.push('Organization name not provided');
    }
    
    // Check for system owner information
    const system = await storage.getSystem(request.systemId);
    if (system && !system.systemOwner) {
      issues.push('System owner not defined');
    }

    return {
      name: 'ssp_requirements_check',
      passed: issues.length === 0,
      message: issues.length > 0
        ? `SSP requirements missing: ${issues.join(', ')}`
        : 'SSP requirements validated',
      severity: issues.length > 0 ? 'warning' : 'info'
    };
  }

  /**
   * Checklist-specific validation
   */
  private async validateChecklistRequirements(
    request: GenerationRequest,
    checklistType: string
  ): Promise<ValidationCheck> {
    const issues: string[] = [];
    
    // Check for STIG rules
    const stigRules = await storage.getStigRules();
    const relevantRules = stigRules.filter(rule => 
      checklistType === 'jsig_checklist' 
        ? rule.ruleType === 'jsig' 
        : rule.ruleType === 'stig' || !rule.ruleType
    );
    
    if (relevantRules.length === 0) {
      issues.push(`No ${checklistType} rules found`);
    }

    return {
      name: `${checklistType}_requirements_check`,
      passed: issues.length === 0,
      message: issues.length > 0
        ? `Checklist requirements missing: ${issues.join(', ')}`
        : `${relevantRules.length} ${checklistType} rules available`,
      severity: issues.length > 0 ? 'error' : 'info'
    };
  }

  /**
   * POAM-specific validation
   */
  private async validatePoamRequirements(request: GenerationRequest): Promise<ValidationCheck> {
    const findings = await storage.getFindingsBySystem(request.systemId);
    
    if (findings.length === 0) {
      return {
        name: 'poam_requirements_check',
        passed: true,
        message: 'No findings to include in POAM',
        severity: 'warning'
      };
    }

    return {
      name: 'poam_requirements_check',
      passed: true,
      message: `${findings.length} findings available for POAM`,
      severity: 'info'
    };
  }

  /**
   * Check for default template availability
   */
  private async checkDefaultTemplate(docType: string): Promise<boolean> {
    try {
      // Check if template service has default for this type
      // For now, return true as placeholder
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Aggregate validation results
   */
  private aggregateResults(checks: ValidationCheck[]): ValidationResult {
    const errors = checks
      .filter(c => !c.passed && c.severity === 'error')
      .map(c => c.message);
    
    const warnings = checks
      .filter(c => !c.passed && c.severity === 'warning')
      .map(c => c.message);
    
    const valid = errors.length === 0;
    
    // Generate suggestions based on issues
    const suggestions = this.generateSuggestions(checks);

    return {
      valid,
      checks,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Generate helpful suggestions based on validation results
   */
  private generateSuggestions(checks: ValidationCheck[]): string[] {
    const suggestions: string[] = [];
    
    for (const check of checks) {
      if (!check.passed) {
        switch (check.name) {
          case 'resource_check':
            suggestions.push('Consider processing in smaller batches');
            suggestions.push('Free up system memory before generation');
            break;
            
          case 'controls_check':
            if (check.details?.withoutNarratives > 0) {
              suggestions.push('Generate control narratives before creating SSP');
            }
            if (check.details?.totalControls > this.thresholds.maxControlsPerBatch) {
              suggestions.push('Use chunked generation for large control sets');
            }
            break;
            
          case 'template_check':
            suggestions.push('Use default generation if templates are missing');
            suggestions.push('Upload required templates before generation');
            break;
            
          case 'connectivity_check':
            suggestions.push('Check database connection settings');
            suggestions.push('Verify LLM service configuration');
            break;
        }
      }
    }
    
    // Remove duplicates
    return [...new Set(suggestions)];
  }
}

// Export singleton instance
export const generationValidator = new GenerationValidator();
