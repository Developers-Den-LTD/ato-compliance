// Document Generation Service
// Orchestrates evidence collection, NIST-STIG mapping, and LLM-powered document generation

import { storage } from '../storage';
import { modelRouter } from '../llm/model-router';
import { TEMPLATE_REGISTRY, getTemplate } from '../llm/prompts';
import { narrativeGenerationService } from './narrative-generation.service';
import { templateGenerationService } from './template-generation.service';
import type { 
  System, 
  GenerationJob, 
  Document, 
  Finding, 
  Evidence, 
  Control, 
  StigRule,
  Checklist,
  PoamItem,
  Artifact,
  InsertGenerationJob,
  InsertDocument,
  InsertChecklist,
  InsertPoamItem
} from '../schema';

export interface GenerationRequest {
  systemId: string;
  documentTypes: DocumentType[];
  includeEvidence: boolean;
  includeArtifacts: boolean;
  useTemplates?: boolean; // Feature flag for template-based generation
  templateOptions?: {
    classification?: string;
    organization?: string;
    authorizedOfficials?: string[];
    customFields?: Record<string, any>;
    templateIds?: Record<string, string>; // Document type -> template ID mapping
  };
}

export type DocumentType = 
  | 'ssp'
  | 'stig_checklist'
  | 'jsig_checklist'
  | 'sar_package' 
  | 'poam_report'
  | 'control_narratives'
  | 'sar' // Using sar for evidence_summary
  | 'complete_ato_package'
  | 'sctm_excel'
  | 'rar'
  | 'pps_worksheet';

export interface GenerationResult {
  jobId: string;
  documents: Document[];
  artifacts: Artifact[];
  checklists: Checklist[];
  poamItems: PoamItem[];
  summary: {
    totalControls: number;
    implementedControls: number;
    findings: number;
    criticalFindings: number;
    evidence: number;
    artifacts: number;
  };
}

export interface GenerationProgress {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep: string;
  steps: GenerationStep[];
  error?: string;
  startTime: Date;
  endTime?: Date;
}

export interface GenerationStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  details?: string;
  error?: string;
}

class GenerationService {
  private activeJobs = new Map<string, GenerationProgress>();

  /**
   * Start a new document generation job
   */
  async startGeneration(request: GenerationRequest): Promise<string> {
    // Validate system exists
    const system = await storage.getSystem(request.systemId);
    if (!system) {
      throw new Error(`System not found: ${request.systemId}`);
    }

    // Create generation job
    const job: InsertGenerationJob = {
      systemId: request.systemId,
      type: 'ato_package', // Default type for comprehensive document generation
      documentTypes: request.documentTypes,
      status: 'pending',
      progress: 0,
      requestData: request,
      startTime: new Date()
    };

    const createdJob = await storage.createGenerationJob(job);
    const jobId = createdJob.id;

    // Initialize progress tracking
    const progress: GenerationProgress = {
      jobId,
      status: 'pending',
      progress: 0,
      currentStep: 'Initializing generation process',
      steps: this.createGenerationSteps(request.documentTypes),
      startTime: new Date()
    };

    this.activeJobs.set(jobId, progress);

    // Start generation asynchronously
    this.executeGeneration(jobId, request, system).catch(error => {
      console.error(`Generation job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed', error.message);
    });

    return jobId;
  }

  /**
   * Get generation job status and progress
   */
  async getGenerationStatus(jobId: string): Promise<GenerationProgress | null> {
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      return activeJob;
    }

    // Check database for completed jobs
    const job = await storage.getGenerationJob(jobId);
    if (!job) {
      return null;
    }

    return {
      jobId,
      status: job.status as any,
      progress: job.progress || 0,
      currentStep: job.currentStep || 'Unknown',
      steps: (job.stepData as GenerationStep[]) || [],
      error: job.error || undefined,
      startTime: job.startTime!,
      endTime: job.endTime || undefined
    };
  }

  /**
   * Get completed generation results
   */
  async getGenerationResult(jobId: string): Promise<GenerationResult | null> {
    const job = await storage.getGenerationJob(jobId);
    if (!job || job.status !== 'completed') {
      return null;
    }

    // Get all generated documents
    const documents = await storage.getDocumentsByJobId(jobId);
    const checklists = await storage.getChecklistsByJobId(jobId);
    const poamItems = await storage.getPoamItemsBySystem(job.systemId!);
    const artifacts = await storage.getArtifactsBySystem(job.systemId!);

    // Calculate summary
    const controls = await storage.getControlsBySystemId(job.systemId!);
    const findings = await storage.getFindingsBySystem(job.systemId!);
    const evidence = await storage.getEvidenceBySystem(job.systemId!);

    const summary = {
      totalControls: controls.length,
      implementedControls: 0, // Control status not in schema
      findings: findings.length,
      criticalFindings: findings.filter((f: Finding) => f.severity === 'critical').length,
      evidence: evidence.length,
      artifacts: artifacts.length
    };

    return {
      jobId,
      documents,
      artifacts,
      checklists,
      poamItems,
      summary
    };
  }

  /**
   * Execute the complete generation workflow
   */
  private async executeGeneration(
    jobId: string, 
    request: GenerationRequest, 
    system: System
  ): Promise<void> {
    try {
      this.updateJobStatus(jobId, 'running', 'Starting document generation');

      // Step 1: Collect system data and evidence
      await this.updateStep(jobId, 'collect_data', 'running');
      const systemData = await this.collectSystemData(system.id);
      await this.updateStep(jobId, 'collect_data', 'completed');

      // Step 2: Generate SSP (System Security Plan)
      if (request.documentTypes.includes('ssp')) {
        await this.updateStep(jobId, 'generate_ssp', 'running');
        
        // Check if template-based generation is enabled
        if (request.useTemplates) {
          await this.generateSSPWithTemplate(jobId, systemData, request);
        } else {
          await this.generateSSP(jobId, systemData, request);
        }
        
        await this.updateStep(jobId, 'generate_ssp', 'completed');
      }

      // Step 3: Generate STIG checklists
      if (request.documentTypes.includes('stig_checklist')) {
        await this.updateStep(jobId, 'generate_checklists', 'running');
        await this.generateStigChecklists(jobId, systemData);
        await this.updateStep(jobId, 'generate_checklists', 'completed');
      }

      // Step 3b: Generate JSIG checklists
      if (request.documentTypes.includes('jsig_checklist')) {
        await this.updateStep(jobId, 'generate_jsig_checklists', 'running');
        await this.generateJsigChecklists(jobId, systemData, request);
        await this.updateStep(jobId, 'generate_jsig_checklists', 'completed');
      }

      // Step 4: Generate control narratives
      if (request.documentTypes.includes('control_narratives')) {
        await this.updateStep(jobId, 'generate_narratives', 'running');
        await this.generateControlNarratives(jobId, systemData);
        await this.updateStep(jobId, 'generate_narratives', 'completed');
      }

      // Step 5: Generate POA&M items
      if (request.documentTypes.includes('poam_report')) {
        await this.updateStep(jobId, 'generate_poam', 'running');
        await this.generatePoamReport(jobId, systemData);
        await this.updateStep(jobId, 'generate_poam', 'completed');
      }

      // Step 6: Generate SAR package
      if (request.documentTypes.includes('sar_package')) {
        await this.updateStep(jobId, 'generate_sar', 'running');
        await this.generateSarPackage(jobId, systemData, request);
        await this.updateStep(jobId, 'generate_sar', 'completed');
      }

      // Step 7: Generate evidence summary
      if (request.documentTypes.includes('sar')) {
        await this.updateStep(jobId, 'generate_evidence_summary', 'running');
        await this.generateEvidenceSummary(jobId, systemData);
        await this.updateStep(jobId, 'generate_evidence_summary', 'completed');
      }

      // Step 8: Generate complete ATO package
      if (request.documentTypes.includes('complete_ato_package')) {
        await this.updateStep(jobId, 'generate_ato_package', 'running');
        await this.generateCompleteAtoPackage(jobId, systemData, request);
        await this.updateStep(jobId, 'generate_ato_package', 'completed');
      }

      // Step 9: Generate SCTM Excel
      if (request.documentTypes.includes('sctm_excel')) {
        await this.updateStep(jobId, 'generate_sctm', 'running');
        
        // Check if template-based generation is enabled
        if (request.useTemplates) {
          await this.generateSCTMWithTemplate(jobId, systemData, request);
        } else {
          await this.generateSCTM(jobId, systemData, request);
        }
        
        await this.updateStep(jobId, 'generate_sctm', 'completed');
      }

      // Step 10: Generate RAR
      if (request.documentTypes.includes('rar')) {
        await this.updateStep(jobId, 'generate_rar', 'running');
        
        // Check if template-based generation is enabled
        if (request.useTemplates) {
          await this.generateRARWithTemplate(jobId, systemData, request);
        } else {
          await this.generateRAR(jobId, systemData, request);
        }
        
        await this.updateStep(jobId, 'generate_rar', 'completed');
      }

      // Step 11: Generate PPS Worksheet
      if (request.documentTypes.includes('pps_worksheet')) {
        await this.updateStep(jobId, 'generate_pps', 'running');
        
        // Check if template-based generation is enabled
        if (request.useTemplates) {
          await this.generatePPSWithTemplate(jobId, systemData, request);
        } else {
          await this.generatePPS(jobId, systemData, request);
        }
        
        await this.updateStep(jobId, 'generate_pps', 'completed');
      }

      // Complete the job
      this.updateJobStatus(jobId, 'completed', 'Document generation completed successfully');

    } catch (error) {
      console.error(`Generation failed for job ${jobId}:`, error);
      this.updateJobStatus(jobId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Collect all system data needed for generation
   */
  private async collectSystemData(systemId: string) {
    const [
      system,
      controls,
      stigRules,
      findings,
      evidence,
      artifacts
    ] = await Promise.all([
      storage.getSystem(systemId),
      storage.getControlsBySystemId(systemId),
      storage.getStigRules(),
      storage.getFindingsBySystem(systemId),
      storage.getEvidenceBySystem(systemId),
      storage.getArtifactsBySystem(systemId)
    ]);

    // Load NIST-STIG mapping data
    const nistStigMapping = await import('../data/nist-stig-mapping.json');

    return {
      system: system!,
      controls,
      stigRules,
      findings,
      evidence,
      artifacts,
      nistStigMapping: nistStigMapping.default
    };
  }

  /**
   * Generate STIG checklists for all applicable STIGs
   */
  private async generateStigChecklists(jobId: string, systemData: any): Promise<void> {
    const { system, controls, stigRules, findings, nistStigMapping } = systemData;

    // Filter for STIG rules only (exclude JSIG rules)
    const stigOnlyRules = stigRules.filter((rule: StigRule) => 
      rule.ruleType === 'stig' || !rule.ruleType // Default to STIG for backward compatibility
    );

    // Group STIG rules by STIG ID
    const stigGroups = new Map<string, StigRule[]>();
    stigOnlyRules.forEach((rule: StigRule) => {
      if (!stigGroups.has(rule.stigId)) {
        stigGroups.set(rule.stigId, []);
      }
      stigGroups.get(rule.stigId)!.push(rule);
    });

    // Generate checklist for each STIG
    for (const [stigId, rules] of stigGroups) {
      const checklistData = await this.generateStigChecklistContent(
        system, 
        rules, 
        controls, 
        findings, 
        nistStigMapping
      );

      console.log('Generated checklist data:', JSON.stringify(checklistData, null, 2));

      const checklist: InsertChecklist = {
        systemId: system.id,
        jobId, // CRITICAL: Link checklist to generation job for result retrieval
        stigId: stigId,
        stigName: stigId,
        title: `${stigId} Security Checklist - ${system.name}`,
        completionStatus: 'completed',
        version: '1.0',
        generatedBy: 'ai_generated',
        content: checklistData, // Store the generated content
        items: checklistData, // Also store in items for backward compatibility
        findings: checklistData.findings?.length || 0,
        compliant: checklistData.findings?.filter((f: any) => f.status === 'NotAFinding').length || 0
      };

      console.log('Creating checklist with data:', {
        systemId: checklist.systemId,
        jobId: checklist.jobId,
        stigId: checklist.stigId,
        stigName: checklist.stigName,
        title: checklist.title,
        findings: checklist.findings,
        compliant: checklist.compliant,
        completionStatus: checklist.completionStatus,
        contentType: typeof checklist.content,
        itemsType: typeof checklist.items,
        fullChecklist: checklist
      });

      const createdChecklist = await storage.createChecklist(checklist);
      console.log('Created checklist result:', {
        id: createdChecklist.id,
        systemId: createdChecklist.systemId,
        stigId: createdChecklist.stigId,
        stigName: createdChecklist.stigName,
        title: createdChecklist.title,
        findings: createdChecklist.findings,
        compliant: createdChecklist.compliant,
        completionStatus: createdChecklist.completionStatus,
        contentExists: !!createdChecklist.content,
        itemsExists: !!createdChecklist.items
      });
    }
  }

  /**
   * Generate JSIG checklists for all applicable Joint STIGs
   */
  private async generateJsigChecklists(jobId: string, systemData: any, request: GenerationRequest): Promise<void> {
    const { system, controls, stigRules, findings, evidence, nistStigMapping } = systemData;

    // Filter for JSIG rules only
    const jsigRules = stigRules.filter((rule: StigRule) => rule.ruleType === 'jsig');

    if (jsigRules.length === 0) {
      console.log('No JSIG rules found for system:', system.id);
      return;
    }

    // Group JSIG rules by JSIG ID
    const jsigGroups = new Map<string, StigRule[]>();
    jsigRules.forEach((rule: StigRule) => {
      if (!jsigGroups.has(rule.stigId)) {
        jsigGroups.set(rule.stigId, []);
      }
      jsigGroups.get(rule.stigId)!.push(rule);
    });

    // Generate checklist for each JSIG
    for (const [jsigId, rules] of jsigGroups) {
      const checklistData = await this.generateJsigChecklistContent(
        system, 
        rules, 
        controls, 
        findings,
        evidence,
        nistStigMapping,
        request
      );

      const checklist: InsertChecklist = {
        systemId: system.id,
        jobId, // CRITICAL: Link checklist to generation job for result retrieval
        stigName: jsigId,
        completionStatus: 'in_progress',
        version: '1.0',
        generatedBy: 'ai_generated',
        items: checklistData
      };

      await storage.createChecklist(checklist);
    }
  }

  /**
   * Generate content for a specific STIG checklist
   */
  private async generateStigChecklistContent(
    system: System,
    stigRules: StigRule[],
    controls: Control[],
    findings: Finding[],
    nistStigMapping: any
  ): Promise<any> {
    const template = getTemplate('stig_checklist');
    
    // Use the proper template with structured data
    const systemPrompt = template.systemPrompt;
    const userPrompt = `Generate a STIG checklist assessment for:

**System Information:**
- System Name: ${system.name}
- System Type: ${system.category || 'General Support System'}
- Assessment Date: ${new Date().toISOString().split('T')[0]}

**STIG Rules (${stigRules.length} total):**
${stigRules.slice(0, 3).map(rule => `- ${rule.id}: ${rule.title} (${rule.severity})`).join('\n')}
${stigRules.length > 3 ? `... and ${stigRules.length - 3} more rules` : ''}

**Related NIST Controls (${controls.length} total):**
${controls.slice(0, 3).map(control => `- ${control.id}: ${control.title}`).join('\n')}
${controls.length > 3 ? `... and ${controls.length - 3} more controls` : ''}

**System Evidence:**
- System compliance status: ${system.complianceStatus}
- Impact level: ${system.impactLevel}
- Findings: ${findings.length} total findings

**Implementation Status:**
System is ${system.complianceStatus} with ${controls.length} controls assessed.

Generate a JSON object containing a checklist assessment with the following structure:
{
  "checklistMetadata": {
    "systemName": "${system.name}",
    "assessmentDate": "${new Date().toISOString().split('T')[0]}",
    "totalRules": ${stigRules.length},
    "summaryStats": {
      "open": 0,
      "notAFinding": 0,
      "notApplicable": 0
    }
  },
  "findings": [
    {
      "vulnerabilityId": "V-XXXXXX",
      "stigId": "RULE-ID",
      "title": "Rule title",
      "severity": "high|medium|low",
      "status": "NotAFinding",
      "findingDetails": "Analysis based on system evidence",
      "comments": "Implementation notes",
      "evidence": ["Supporting evidence"],
      "nisControlMappings": ["Control mappings"],
      "recommendedAction": "Actions if needed"
    }
  ],
  "riskSummary": "Overall assessment summary",
  "recommendations": ["Key recommendations"]
}`;

    try {
      const response = await modelRouter.generateJSON([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        maxTokens: 4000,
        temperature: 0.1
      });

      console.log('LLM response for STIG checklist:', JSON.stringify(response, null, 2));

      // Validate response structure
      if (!response || typeof response !== 'object') {
        console.error('Invalid LLM response - not an object:', response);
        throw new Error('Invalid LLM response format');
      }

      return response;
    } catch (error) {
      console.error('Error generating STIG checklist content:', error);
      
      // Return fallback structure if LLM fails
      return {
        checklistMetadata: {
          systemName: system.name,
          assessmentDate: new Date().toISOString().split('T')[0],
          totalRules: stigRules.length,
          summaryStats: {
            open: stigRules.length,
            notAFinding: 0,
            notApplicable: 0
          }
        },
        findings: stigRules.map((rule, index) => ({
          vulnerabilityId: rule.id,
          stigId: rule.stigId || 'Unknown',
          title: rule.title,
          severity: rule.severity,
          status: 'Open',
          findingDetails: `Assessment required for ${rule.title}`,
          comments: 'Automated assessment - manual review required',
          evidence: [`System compliance status: ${system.complianceStatus}`],
          nisControlMappings: [],
          recommendedAction: 'Review and implement security control'
        })),
        riskSummary: `The system has ${stigRules.length} STIG rules that require assessment. Manual review is recommended.`,
        recommendations: [
          'Conduct detailed assessment of all STIG rules',
          'Implement required security controls',
          'Document compliance evidence'
        ]
      };
    }
  }

  /**
   * Generate content for a specific JSIG checklist
   */
  private async generateJsigChecklistContent(
    system: System,
    jsigRules: StigRule[],
    controls: Control[],
    findings: Finding[],
    evidence: Evidence[],
    nistStigMapping: any,
    request: GenerationRequest
  ): Promise<any> {
    const template = getTemplate('jsig_batch_checklist');
    
    // FIXED: Extract service environment information from customFields
    const serviceEnvironment = (request.templateOptions?.customFields as any)?.serviceEnvironment || 
                              'Joint Service Environment';
    const jointServiceContext = (request.templateOptions?.customFields as any)?.jointServiceContext || 
                                'Multi-Service System';
    const applicableServices = (request.templateOptions?.customFields as any)?.applicableServices || 
                               ['Army', 'Navy', 'Air Force', 'Marines', 'Space Force'];
    
    // Build JSIG-specific prompt data
    const systemPrompt = template.systemPrompt;
    const userPrompt = `Generate a complete Joint STIG checklist assessment for:

**System Information:**
- System Name: ${system.name}
- System Description: ${system.description || 'Joint service system'}
- System Type: ${system.category || 'General Support System'}
- Security Level: ${system.impactLevel}
- Service Environment: ${serviceEnvironment}
- Joint Service Context: ${jointServiceContext}
- Assessment Date: ${new Date().toISOString().split('T')[0]}
- Assessor: AI Generated Assessment
- Assessing Organization: ${request.templateOptions?.organization || 'Joint Service Assessment Team'}

**Joint STIG Information:**
- JSIG Title: ${jsigRules[0]?.stigTitle || 'Joint Service STIG'}
- Version: ${jsigRules[0]?.version || '1.0'}
- Release: Current
- Applicable Services: [${applicableServices.join(', ')}]

**JSIG Rules to Assess:**
${jsigRules.slice(0, 5).map(rule => 
  `- ${rule.id}: ${rule.title} (${rule.severity}) [${applicableServices.join(', ')}]`
).join('\n')}
${jsigRules.length > 5 ? `... and ${jsigRules.length - 5} more JSIG rules` : ''}

**Joint Service Evidence Collection:**
${evidence.slice(0, 3).map(e => 
  `- ${e.type || 'evidence'}: ${e.description} (compliant) [Service: Multi-Service]`
).join('\n')}
${evidence.length > 3 ? `... and ${evidence.length - 3} more evidence items` : ''}

**Service-Specific Implementation Context:**
${applicableServices.map(service => 
  `- ${service}: Standard DoD implementation with ${service.toLowerCase()}-specific requirements`
).join('\n')}

**Cross-Service Considerations:**
System operates in joint service environment requiring consistent implementation across all applicable service branches while maintaining service-specific compliance requirements.

Generate a comprehensive Joint STIG checklist assessment with the required JSON structure including checklistMetadata, findings array, crossServiceAnalysis, riskSummary, recommendations with service-specific sections, and assessorNotes.`;

    const response = await modelRouter.generateJSON([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      maxTokens: 6000,
      temperature: 0.1
    });

    return response;
  }

  /**
   * Generate control implementation narratives
   */
  private async generateControlNarratives(jobId: string, systemData: any): Promise<void> {
    const { system, controls, evidence, artifacts, findings } = systemData;

    // Use the new context-aware narrative generation service
    console.log(`Generating context-aware narratives for ${controls.length} controls`);
    
    for (const control of controls) {
      try {
        // Get system control relationship
        const systemControl = await storage.getSystemControl(system.id, control.id);
        
        // Filter evidence and artifacts for this control
        const controlEvidence = evidence.filter((e: Evidence) => e.controlId === control.id);
        const controlArtifacts = artifacts.filter((a: Artifact) => 
          (a.metadata as any)?.relatedControls?.includes(control.id) ||
          a.description?.toLowerCase().includes(control.id.toLowerCase())
        );

        // Use narrative generation service for context-aware generation
        const narrativeResult = await narrativeGenerationService.generateContextAwareNarrative({
          system,
          control,
          systemControl,
          evidence: controlEvidence,
          artifacts: controlArtifacts,
          findings
        });

        const document: InsertDocument = {
          jobId,
          systemId: system.id,
          type: 'control_narratives',
          title: `${control.id} Implementation Narrative`,
          content: {
            narrative: narrativeResult.narrative,
            controlId: control.id,
            evidenceCount: controlEvidence.length,
            artifactCount: controlArtifacts.length,
            confidence: narrativeResult.confidence,
            sources: narrativeResult.sources,
            extractedDetails: narrativeResult.extractedDetails
          },
          status: 'draft',
          generatedBy: 'ai_generated'
        };

        await storage.createDocument(document);
        
        console.log(`Generated narrative for control ${control.id} with confidence: ${narrativeResult.confidence}%`);
      } catch (error) {
        console.error(`Failed to generate narrative for control ${control.id}:`, error);
        // Continue with next control
      }
    }
  }

  /**
   * Generate System Security Plan (SSP)
   */
  private async generateSSP(jobId: string, systemData: any, request: GenerationRequest): Promise<void> {
    const { system, controls, findings, evidence, artifacts } = systemData;

    const sspContent = await this.generateSSPContent(system, controls, findings, evidence, artifacts, request);
    
    // Convert markdown content to Word-compatible format
    const wordContent = await this.convertMarkdownToWordDocument(sspContent, system);

    const document: InsertDocument = {
      jobId,
      systemId: system.id,
      type: 'ssp',
      title: `System Security Plan - ${system.name}`,
      content: {
        documentContent: wordContent,
        systemName: system.name,
        impactLevel: system.impactLevel,
        controlsCount: controls.length,
        findingsCount: findings.length,
        evidenceCount: evidence.length,
        artifactsCount: artifacts.length
      },
      status: 'draft',
      generatedBy: 'ai_generated'
    };

    await storage.createDocument(document);
  }

  /**
   * Generate SSP using template system
   */
  private async generateSSPWithTemplate(jobId: string, systemData: any, request: GenerationRequest): Promise<void> {
    const { system } = systemData;

    try {
      // Get template ID from request options
      const templateId = request.templateOptions?.templateIds?.ssp;

      console.log(`Template generation attempt for SSP: templateId=${templateId}`);

      // Generate document using template
      const result = await templateGenerationService.generateDocument({
        systemId: system.id,
        documentType: 'ssp',
        templateId,
        format: 'docx',
        includeEvidence: request.includeEvidence,
        includeAssessmentResults: true,
        includeDiagrams: request.includeArtifacts,
        templateOptions: request.templateOptions
      });

      if (!result.success) {
        console.error(`Template generation error: ${result.errors?.join(', ')}`);
        throw new Error(`Template generation failed: ${result.errors?.join(', ')}`);
      }

      // Store the generated document
      const document: InsertDocument = {
        jobId,
        systemId: system.id,
        type: 'ssp',
        title: `System Security Plan - ${system.name}`,
        content: {
          documentContent: result.document.content.toString('base64'),
          systemName: system.name,
          templateName: result.templateInfo.name,
          templateVersion: result.templateInfo.version,
          variablesUsed: result.templateInfo.variables,
          totalControls: result.document.metadata.totalControls,
          implementedControls: result.document.metadata.implementedControls,
          findings: 0, // Will be populated by system data
          evidence: 0 // Will be populated by system data
        },
        status: 'draft',
        generatedBy: 'template_generated'
      };

      await storage.createDocument(document);
      console.log(`Template-based SSP generated for system ${system.name} using template ${result.templateInfo.name}`);

    } catch (error) {
      console.error('Template-based SSP generation failed, falling back to default:', error);
      console.log(`Template-based SSP generation failed for system ${system.name}, falling back to default generation`);
      // Fallback to default generation
      try {
        await this.generateSSP(jobId, systemData, request);
        console.log(`✅ Fallback SSP generation completed for system ${system.name}`);
      } catch (fallbackError) {
        console.error('❌ Both template and fallback SSP generation failed:', fallbackError);
        throw new Error(`SSP generation failed: Template error: ${error.message}, Fallback error: ${fallbackError.message}`);
      }
    }
  }

  /**
   * Generate SSP content using AI
   */
  private async generateSSPContent(
    system: System,
    controls: Control[],
    findings: Finding[],
    evidence: Evidence[],
    artifacts: Artifact[],
    request: GenerationRequest
  ): Promise<string> {
    const implementedControls = controls; // Control status not in schema
    const criticalFindings = findings.filter(f => f.severity === 'critical');

    const prompt = `Generate a comprehensive System Security Plan (SSP) for the following system:

System Information:
- Name: ${system.name}
- Description: ${system.description || 'No description provided'}
- Impact Level: ${system.impactLevel}
- Category: ${system.category}

Current Security Posture:
- Total Controls: ${controls.length}
- Implemented Controls: ${implementedControls.length}
- Open Findings: ${findings.length}
- Critical Findings: ${criticalFindings.length}
- Evidence Items: ${evidence.length}
- Supporting Artifacts: ${artifacts.length}

Organization: ${request.templateOptions?.organization || 'Organization'}
Classification: ${request.templateOptions?.classification || 'UNCLASSIFIED'}

Generate a detailed SSP document that includes:
1. Executive Summary
2. System Overview and Architecture
3. Security Controls Implementation
4. Risk Assessment and Findings
5. Evidence and Documentation
6. Compliance Status
7. Recommendations

The SSP should be professional, comprehensive, and suitable for ATO submission.`;

    const response = await modelRouter.generateText([{ role: 'user', content: prompt }], {
      maxTokens: 8000,
      temperature: 0.1
    });

    return typeof response === 'string' ? response : (response.content || JSON.stringify(response));
  }

  /**
   * Generate POA&M report
   */
  private async generatePoamReport(jobId: string, systemData: any): Promise<void> {
    const { system, findings, controls, stigRules } = systemData;

    // Create POA&M items for each finding
    const poamItems: InsertPoamItem[] = [];

    for (const finding of findings) {
      const relatedControl = controls.find((c: Control) => c.id === finding.controlId);
      const relatedStigRule = stigRules.find((r: StigRule) => r.id === finding.stigRuleId);

      const poamContent = await this.generatePoamItemContent(
        finding,
        relatedControl,
        relatedStigRule,
        system
      );

      // Ensure all required fields have fallback values
      const weakness = poamContent.weakness || finding.title || 'Security control weakness identified';
      const riskStatement = poamContent.riskStatement || `Risk associated with finding: ${finding.title}`;
      const remediation = poamContent.remediation || poamContent.mitigation || 'Remediation plan to be determined';
      
      console.log('Creating POA&M item with data:', {
        findingId: finding.id,
        findingTitle: finding.title,
        weakness,
        riskStatement,
        remediation
      });

      const poamItem: InsertPoamItem = {
        systemId: system.id,
        findingId: finding.id,
        weakness,
        riskStatement,
        remediation,
        status: 'open',
        priority: finding.severity === 'critical' ? 'critical' : finding.severity === 'high' ? 'high' : 'medium',
        plannedCompletionDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        assignedTo: 'System Administrator',
        resources: 'TBD - Requires resource assessment'
      };

      poamItems.push(poamItem);
    }

    // Bulk create POA&M items
    for (const item of poamItems) {
      await storage.createPoamItem(item);
    }

    // Create POA&M summary document
    const poamSummary = await this.generatePoamSummaryDocument(system, poamItems, findings);
    
    const document: InsertDocument = {
      jobId,
      systemId: system.id,
      type: 'poam_report',
      title: `${system.name} Plan of Action & Milestones`,
      content: {
        summary: poamSummary,
        totalFindings: findings.length,
        criticalFindings: findings.filter((f: Finding) => f.severity === 'critical').length,
        openItems: poamItems.length,
        items: poamItems
      },
      status: 'draft',
      generatedBy: 'ai_generated'
    };

    await storage.createDocument(document);
  }

  /**
   * Generate POA&M item content
   */
  private async generatePoamItemContent(
    finding: Finding,
    control: Control | undefined,
    stigRule: StigRule | undefined,
    system: System
  ): Promise<{ 
    description: string; 
    mitigation: string; 
    weakness: string; 
    riskStatement: string; 
    remediation: string; 
  }> {
    const prompt = `Generate POA&M item content for finding:
    
System: ${system.name}
Finding: ${finding.title}
Description: ${finding.description}
Severity: ${finding.severity}
${control ? `Related Control: ${control.id}` : ''}
${stigRule ? `Related STIG Rule: ${stigRule.id}` : ''}

Generate complete POA&M content as JSON with these fields:
- "weakness": The specific security weakness identified
- "riskStatement": Risk impact statement
- "description": Detailed description of the finding
- "remediation": Specific remediation steps
- "mitigation": Interim mitigation measures`;

    try {
      const response = await modelRouter.generateJSON([{ role: 'user', content: prompt }], {
        maxTokens: 1000,
        temperature: 0.3
      });

      return {
        weakness: response.weakness || finding.title || 'Security control weakness',
        riskStatement: response.riskStatement || `Risk associated with ${finding.title}`,
        description: response.description || finding.description || 'No description available',
        remediation: response.remediation || 'Remediation plan to be determined',
        mitigation: response.mitigation || 'Interim mitigation measures to be implemented'
      };
    } catch (error) {
      console.error('Error generating POA&M content:', error);
      return {
        weakness: finding.title || 'Security control weakness identified',
        riskStatement: `Risk associated with finding: ${finding.title}`,
        description: finding.description || 'No description available',
        remediation: 'Remediation plan to be determined based on detailed analysis',
        mitigation: 'Interim mitigation measures to be implemented pending full remediation'
      };
    }
  }

  /**
   * Generate POA&M summary document
   */
  private async generatePoamSummaryDocument(
    system: System,
    poamItems: InsertPoamItem[],
    findings: Finding[]
  ): Promise<string> {
    const prompt = `Generate POA&M summary document for ${system.name}:
    
System: ${system.name}
Description: ${system.description || ''}
Total Findings: ${findings.length}
Critical Findings: ${findings.filter((f: Finding) => f.severity === 'critical').length}
Open POA&M Items: ${poamItems.length}

Generate a comprehensive POA&M summary report with executive overview and mitigation timeline.`;

    const response = await modelRouter.generateText([{ role: 'user', content: prompt }], {
      maxTokens: 3000,
      temperature: 0.2
    });

    return typeof response === 'string' ? response : (response.content || JSON.stringify(response));
  }

  /**
   * Generate SAR (Security Assessment Report) package
   */
  private async generateSarPackage(
    jobId: string, 
    systemData: any, 
    request: GenerationRequest
  ): Promise<void> {
    const { system, controls, findings, evidence, artifacts } = systemData;

    const sarContent = await this.generateSarContent(
      system,
      controls,
      findings,
      evidence,
      artifacts,
      request.templateOptions
    );

    const document: InsertDocument = {
      jobId,
      systemId: system.id,
      type: 'sar_package',
      title: `${system.name} Security Assessment Report`,
      content: {
        documentContent: sarContent,
        classification: request.templateOptions?.classification || 'UNCLASSIFIED',
        totalControls: controls.length,
        totalFindings: findings.length,
        evidenceCount: evidence.length,
        artifactCount: artifacts.length
      },
      status: 'draft',
      generatedBy: 'ai_generated'
    };

    await storage.createDocument(document);
  }

  /**
   * Generate SAR content
   */
  private async generateSarContent(
    system: System,
    controls: Control[],
    findings: Finding[],
    evidence: Evidence[],
    artifacts: Artifact[],
    templateOptions?: any
  ): Promise<string> {
    const prompt = `Generate Security Assessment Report (SAR) for ${system.name}:
    
System: ${system.name}
Description: ${system.description || ''}
Total Controls: ${controls.length}
Total Findings: ${findings.length}
Evidence Items: ${evidence.length}
Artifacts: ${artifacts.length}
Classification: ${templateOptions?.classification || 'UNCLASSIFIED'}

Generate a comprehensive SAR with executive summary, control assessments, and risk analysis.`;

    const response = await modelRouter.generateText([{ role: 'user', content: prompt }], {
      maxTokens: 6000,
      temperature: 0.1
    });

    return typeof response === 'string' ? response : (response.content || JSON.stringify(response));
  }

  /**
   * Generate evidence summary document
   */
  private async generateEvidenceSummary(jobId: string, systemData: any): Promise<void> {
    const { system, evidence, artifacts } = systemData;

    const evidenceSummaryContent = await this.generateEvidenceSummaryContent(
      system,
      evidence,
      artifacts
    );

    const document: InsertDocument = {
      jobId,
      systemId: system.id,
      type: 'sar_package', // Using sar_package as closest match for evidence summary
      title: `${system.name} Evidence Summary`,
      content: {
        documentContent: evidenceSummaryContent,
        documentSubType: 'evidence_summary',
        evidenceCount: evidence.length,
        artifactCount: artifacts.length,
        generatedDate: new Date().toISOString()
      },
      status: 'draft',
      generatedBy: 'ai_generated'
    };

    await storage.createDocument(document);
  }

  /**
   * Generate evidence summary content
   */
  private async generateEvidenceSummaryContent(
    system: System,
    evidence: Evidence[],
    artifacts: Artifact[]
  ): Promise<string> {
    const prompt = `Generate a comprehensive evidence summary for ${system.name}.

This summary should catalog and organize all collected evidence and supporting artifacts:

Evidence Items (${evidence.length} total):
${evidence.map(e => `- ${e.title}: ${e.description || 'No description'}`).join('\n')}

Artifacts (${artifacts.length} total):
${artifacts.map(a => `- ${a.title}: ${a.type} (${a.mimeType || 'unknown type'})`).join('\n')}

Generate a professional evidence summary that:
1. Categorizes evidence by control family or type
2. Assesses evidence quality and completeness
3. Identifies any gaps in evidence collection
4. Provides recommendations for additional evidence needed
5. Summarizes the overall evidence posture for compliance

Format as a government-compliant evidence summary document.`;

    const response = await modelRouter.generateText([{ role: 'user', content: prompt }], {
      maxTokens: 3000,
      temperature: 0.2
    });
    
    return typeof response === 'string' ? response : (response.content || JSON.stringify(response));
  }

  /**
   * Generate complete ATO package
   */
  private async generateCompleteAtoPackage(
    jobId: string,
    systemData: any,
    request: GenerationRequest
  ): Promise<void> {
    // This would generate a comprehensive package including:
    // - System Security Plan (SSP)
    // - Security Assessment Report (SAR)
    // - Plan of Action & Milestones (POA&M)
    // - All STIG checklists
    // - Control implementation narratives
    // - Evidence compilation
    // - Executive summary

    const { system } = systemData;

    const atoPackageContent = await this.generateAtoPackageContent(systemData, request);

    const document: InsertDocument = {
      jobId,
      systemId: system.id,
      type: 'complete_ato_package',
      title: `${system.name} Complete ATO Package`,
      content: atoPackageContent,
      status: 'draft',
      metadata: {
        packageVersion: '1.0',
        generatedDate: new Date().toISOString(),
        includedDocuments: request.documentTypes,
        classification: request.templateOptions?.classification || 'UNCLASSIFIED'
      },
      createdAt: new Date()
    };

    await storage.createDocument(document);
  }

  /**
   * Generate complete ATO package content
   */
  private async generateAtoPackageContent(
    systemData: any,
    request: GenerationRequest
  ): Promise<string> {
    const { system, controls, findings, evidence, artifacts } = systemData;

    const prompt = `Generate a comprehensive ATO (Authority to Operate) package for ${system.name}.

This package should include:
1. Executive Summary
2. System Overview and Architecture
3. Security Control Implementation Summary
4. Assessment Results and Findings
5. Risk Assessment
6. Mitigation Strategies
7. Compliance Status

System Details:
- Name: ${system.name}
- Description: ${system.description || 'Not specified'}
- Total Controls: ${controls.length}
- Total Findings: ${findings.length}
- Evidence Items: ${evidence.length}
- Artifacts: ${artifacts.length}

Generate a professional, government-compliant ATO package document.`;

    const response = await modelRouter.generateText([{ role: 'user', content: prompt }], {
      maxTokens: 8000,
      temperature: 0.1
    });

    return typeof response === 'string' ? response : (response.content || JSON.stringify(response));
  }

  /**
   * Helper methods
   */
  private createGenerationSteps(documentTypes: DocumentType[]): GenerationStep[] {
    const steps: GenerationStep[] = [
      { name: 'collect_data', status: 'pending' }
    ];

    if (documentTypes.includes('ssp')) {
      steps.push({ name: 'generate_ssp', status: 'pending' });
    }
    if (documentTypes.includes('stig_checklist')) {
      steps.push({ name: 'generate_checklists', status: 'pending' });
    }
    if (documentTypes.includes('jsig_checklist')) {
      steps.push({ name: 'generate_jsig_checklists', status: 'pending' });
    }
    if (documentTypes.includes('control_narratives')) {
      steps.push({ name: 'generate_narratives', status: 'pending' });
    }
    if (documentTypes.includes('poam_report')) {
      steps.push({ name: 'generate_poam', status: 'pending' });
    }
    if (documentTypes.includes('sar_package')) {
      steps.push({ name: 'generate_sar', status: 'pending' });
    }
    if (documentTypes.includes('sar' as DocumentType)) {
      steps.push({ name: 'generate_evidence_summary', status: 'pending' });
    }
    if (documentTypes.includes('complete_ato_package')) {
      steps.push({ name: 'generate_ato_package', status: 'pending' });
    }

    return steps;
  }

  private async updateStep(
    jobId: string, 
    stepName: string, 
    status: 'running' | 'completed' | 'failed',
    error?: string
  ): Promise<void> {
    const progress = this.activeJobs.get(jobId);
    if (!progress) return;

    const step = progress.steps.find(s => s.name === stepName);
    if (step) {
      step.status = status;
      if (status === 'running') {
        step.startTime = new Date();
      } else {
        step.endTime = new Date();
      }
      if (error) {
        step.error = error;
      }
    }

    // Update overall progress
    const completedSteps = progress.steps.filter(s => s.status === 'completed').length;
    progress.progress = Math.round((completedSteps / progress.steps.length) * 100);

    // Update current step
    const runningStep = progress.steps.find(s => s.status === 'running');
    if (runningStep) {
      progress.currentStep = `Processing ${runningStep.name.replace('_', ' ')}`;
    }

    await this.persistJobProgress(jobId, progress);
  }

  private async updateJobStatus(
    jobId: string, 
    status: 'pending' | 'running' | 'completed' | 'failed',
    currentStep?: string
  ): Promise<void> {
    const progress = this.activeJobs.get(jobId);
    if (progress) {
      progress.status = status;
      if (currentStep) {
        progress.currentStep = currentStep;
      }
      if (status === 'completed' || status === 'failed') {
        progress.endTime = new Date();
        progress.progress = status === 'completed' ? 100 : progress.progress;
      }
    }

    await this.persistJobProgress(jobId, progress || {
      jobId,
      status,
      progress: 0,
      currentStep: currentStep || 'Unknown',
      steps: [],
      startTime: new Date()
    });

    // Remove from active jobs if completed or failed
    if (status === 'completed' || status === 'failed') {
      this.activeJobs.delete(jobId);
    }
  }

  private async persistJobProgress(jobId: string, progress: GenerationProgress): Promise<void> {
    await storage.updateGenerationJob(jobId, {
      status: progress.status,
      progress: progress.progress,
      currentStep: progress.currentStep,
      stepData: progress.steps,
      error: progress.error,
      endTime: progress.endTime
    });
  }

  private isRuleCompliant(rule: StigRule, findings: Finding[]): boolean {
    return !findings.some(f => f.stigRuleId === rule.id && f.status === 'open');
  }

  /**
   * Generate SCTM using template system
   */
  private async generateSCTMWithTemplate(jobId: string, systemData: any, request: GenerationRequest): Promise<void> {
    const { system } = systemData;

    try {
      // Import SCTM generation service
      const { sctmGenerationService } = await import('./sctm-generation.service');

      // Get template ID from request options
      const templateId = request.templateOptions?.templateIds?.sctm_excel;

      // Generate document using template
      const result = await sctmGenerationService.generateSCTM({
        systemId: system.id,
        templateId,
        format: 'xlsx',
        includeEvidence: request.includeEvidence,
        includeAssessmentResults: true,
        templateOptions: request.templateOptions
      });

      if (!result.success) {
        throw new Error(`SCTM template generation failed: ${result.errors?.join(', ')}`);
      }

      // Store the generated document
      const document: InsertDocument = {
        jobId,
        systemId: system.id,
        type: 'sctm_excel',
        title: `Security Control Traceability Matrix - ${system.name}`,
        content: {
          documentContent: result.document.content.toString('base64'),
          systemName: system.name,
          templateName: result.templateInfo.name,
          templateVersion: result.templateInfo.version,
          variablesUsed: result.templateInfo.variables,
          totalControls: result.document.metadata.totalControls,
          implementedControls: result.document.metadata.implementedControls,
          findings: 0, // Will be populated by system data
          evidence: 0 // Will be populated by system data
        },
        status: 'draft',
        generatedBy: 'template_generated'
      };

      await storage.createDocument(document);
      console.log(`Template-based SCTM generated for system ${system.name} using template ${result.templateInfo.name}`);

    } catch (error) {
      console.error('Template-based SCTM generation failed, falling back to default:', error);
      await this.generateSCTM(jobId, systemData, request);
    }
  }

  /**
   * Generate SCTM using default method (fallback)
   */
  private async generateSCTM(jobId: string, systemData: any, request: GenerationRequest): Promise<void> {
    const { system } = systemData;

    try {
      // Import SCTM generation service
      const { sctmGenerationService } = await import('./sctm-generation.service');

      // Generate document using default method
      const result = await sctmGenerationService.generateSCTM({
        systemId: system.id,
        format: 'xlsx',
        includeEvidence: request.includeEvidence,
        includeAssessmentResults: true,
        templateOptions: request.templateOptions
      });

      if (!result.success) {
        throw new Error(`SCTM generation failed: ${result.errors?.join(', ')}`);
      }

      // Store the generated document
      const document: InsertDocument = {
        jobId,
        systemId: system.id,
        type: 'sctm_excel',
        title: `Security Control Traceability Matrix - ${system.name}`,
        content: {
          documentContent: result.document.content.toString('base64'),
          systemName: system.name,
          templateName: result.templateInfo.name,
          templateVersion: result.templateInfo.version,
          variablesUsed: result.templateInfo.variables,
          totalControls: result.document.metadata.totalControls,
          implementedControls: result.document.metadata.implementedControls,
          findings: 0, // Will be populated by system data
          evidence: 0 // Will be populated by system data
        },
        status: 'draft',
        generatedBy: 'ai_generated'
      };

      await storage.createDocument(document);
      console.log(`SCTM generated for system ${system.name}`);

    } catch (error) {
      console.error('SCTM generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate RAR using template system
   */
  private async generateRARWithTemplate(jobId: string, systemData: any, request: GenerationRequest): Promise<void> {
    const { system } = systemData;

    try {
      // Import RAR generation service
      const { rarGenerationService } = await import('./rar-generation.service');

      // Get template ID from request options
      const templateId = request.templateOptions?.templateIds?.rar;

      // Generate document using template
      const result = await rarGenerationService.generateRAR({
        systemId: system.id,
        templateId,
        format: 'docx',
        includeEvidence: request.includeEvidence,
        includeAssessmentResults: true,
        templateOptions: request.templateOptions
      });

      if (!result.success) {
        throw new Error(`RAR template generation failed: ${result.errors?.join(', ')}`);
      }

      // Store the generated document
      const document: InsertDocument = {
        jobId,
        systemId: system.id,
        type: 'rar',
        title: `Risk Assessment Report - ${system.name}`,
        content: {
          documentContent: result.document.content.toString('base64'),
          systemName: system.name,
          templateName: result.templateInfo.name,
          templateVersion: result.templateInfo.version,
          variablesUsed: result.templateInfo.variables,
          totalRisks: result.document.metadata.totalRisks,
          criticalRisks: result.document.metadata.criticalRisks,
          findings: 0, // Will be populated by system data
          evidence: 0 // Will be populated by system data
        },
        status: 'draft',
        generatedBy: 'template_generated'
      };

      await storage.createDocument(document);
      console.log(`Template-based RAR generated for system ${system.name} using template ${result.templateInfo.name}`);

    } catch (error) {
      console.error('Template-based RAR generation failed, falling back to default:', error);
      await this.generateRAR(jobId, systemData, request);
    }
  }

  /**
   * Generate RAR using default method (fallback)
   */
  private async generateRAR(jobId: string, systemData: any, request: GenerationRequest): Promise<void> {
    const { system } = systemData;

    try {
      // Import RAR generation service
      const { rarGenerationService } = await import('./rar-generation.service');

      // Generate document using default method
      const result = await rarGenerationService.generateRAR({
        systemId: system.id,
        format: 'docx',
        includeEvidence: request.includeEvidence,
        includeAssessmentResults: true,
        templateOptions: request.templateOptions
      });

      if (!result.success) {
        throw new Error(`RAR generation failed: ${result.errors?.join(', ')}`);
      }

      // Store the generated document
      const document: InsertDocument = {
        jobId,
        systemId: system.id,
        type: 'rar',
        title: `Risk Assessment Report - ${system.name}`,
        content: {
          documentContent: result.document.content.toString('base64'),
          systemName: system.name,
          templateName: result.templateInfo.name,
          templateVersion: result.templateInfo.version,
          variablesUsed: result.templateInfo.variables,
          totalRisks: result.document.metadata.totalRisks,
          criticalRisks: result.document.metadata.criticalRisks,
          findings: 0, // Will be populated by system data
          evidence: 0 // Will be populated by system data
        },
        status: 'draft',
        generatedBy: 'ai_generated'
      };

      await storage.createDocument(document);
      console.log(`RAR generated for system ${system.name}`);

    } catch (error) {
      console.error('RAR generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate PPS using template system
   */
  private async generatePPSWithTemplate(jobId: string, systemData: any, request: GenerationRequest): Promise<void> {
    const { system } = systemData;

    try {
      // Import PPS generation service
      const { ppsGenerationService } = await import('./pps-generation.service');

      // Get template ID from request options
      const templateId = request.templateOptions?.templateIds?.pps_worksheet;

      // Generate document using template
      const result = await ppsGenerationService.generatePPS({
        systemId: system.id,
        templateId,
        format: 'xlsx',
        includeEvidence: request.includeEvidence,
        includeAssessmentResults: true,
        templateOptions: request.templateOptions
      });

      if (!result.success) {
        throw new Error(`PPS template generation failed: ${result.errors?.join(', ')}`);
      }

      // Store the generated document
      const document: InsertDocument = {
        jobId,
        systemId: system.id,
        type: 'pps_worksheet',
        title: `Privacy Impact Assessment Worksheet - ${system.name}`,
        content: {
          documentContent: result.document.content.toString('base64'),
          systemName: system.name,
          templateName: result.templateInfo.name,
          templateVersion: result.templateInfo.version,
          variablesUsed: result.templateInfo.variables,
          totalDataTypes: result.document.metadata.totalDataTypes,
          totalPrivacyRisks: result.document.metadata.totalPrivacyRisks,
          findings: 0, // Will be populated by system data
          evidence: 0 // Will be populated by system data
        },
        status: 'draft',
        generatedBy: 'template_generated'
      };

      await storage.createDocument(document);
      console.log(`Template-based PPS generated for system ${system.name} using template ${result.templateInfo.name}`);

    } catch (error) {
      console.error('Template-based PPS generation failed, falling back to default:', error);
      await this.generatePPS(jobId, systemData, request);
    }
  }

  /**
   * Generate PPS using default method (fallback)
   */
  private async generatePPS(jobId: string, systemData: any, request: GenerationRequest): Promise<void> {
    const { system } = systemData;

    try {
      // Import PPS generation service
      const { ppsGenerationService } = await import('./pps-generation.service');

      // Generate document using default method
      const result = await ppsGenerationService.generatePPS({
        systemId: system.id,
        format: 'xlsx',
        includeEvidence: request.includeEvidence,
        includeAssessmentResults: true,
        templateOptions: request.templateOptions
      });

      if (!result.success) {
        throw new Error(`PPS generation failed: ${result.errors?.join(', ')}`);
      }

      // Store the generated document
      const document: InsertDocument = {
        jobId,
        systemId: system.id,
        type: 'pps_worksheet',
        title: `Privacy Impact Assessment Worksheet - ${system.name}`,
        content: {
          documentContent: result.document.content.toString('base64'),
          systemName: system.name,
          templateName: result.templateInfo.name,
          templateVersion: result.templateInfo.version,
          variablesUsed: result.templateInfo.variables,
          totalDataTypes: result.document.metadata.totalDataTypes,
          totalPrivacyRisks: result.document.metadata.totalPrivacyRisks,
          findings: 0, // Will be populated by system data
          evidence: 0 // Will be populated by system data
        },
        status: 'draft',
        generatedBy: 'ai_generated'
      };

      await storage.createDocument(document);
      console.log(`PPS generated for system ${system.name}`);

    } catch (error) {
      console.error('PPS generation failed:', error);
      throw error;
    }
  }

  /**
   * Convert markdown content to Word document format (base64 encoded)
   */
  private async convertMarkdownToWordDocument(markdownContent: string, system: System): Promise<string> {
    try {
      // Create a simple Word-compatible HTML structure
      const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>System Security Plan - ${system.name}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; margin: 1in; }
          h1 { font-size: 18pt; font-weight: bold; margin: 24pt 0 12pt 0; page-break-before: auto; }
          h2 { font-size: 16pt; font-weight: bold; margin: 18pt 0 6pt 0; }
          h3 { font-size: 14pt; font-weight: bold; margin: 12pt 0 6pt 0; }
          p { margin: 6pt 0; text-align: justify; }
          .header { text-align: center; font-weight: bold; font-size: 16pt; margin-bottom: 24pt; }
          .doc-info { border: 1px solid #000; padding: 12pt; margin: 12pt 0; }
          .doc-info table { width: 100%; border-collapse: collapse; }
          .doc-info td { border: 1px solid #000; padding: 6pt; }
          .signature-block { margin-top: 36pt; border: 1px solid #000; padding: 12pt; }
        </style>
      </head>
      <body>
        <div class="header">
          SYSTEM SECURITY PLAN<br/>
          ${system.name.toUpperCase()}
        </div>
        
        <div class="doc-info">
          <table>
            <tr>
              <td><strong>System Name:</strong></td>
              <td>${system.name}</td>
            </tr>
            <tr>
              <td><strong>Impact Level:</strong></td>
              <td>${system.impactLevel}</td>
            </tr>
            <tr>
              <td><strong>System Category:</strong></td>
              <td>${system.category}</td>
            </tr>
            <tr>
              <td><strong>Document Version:</strong></td>
              <td>1.0</td>
            </tr>
            <tr>
              <td><strong>Date:</strong></td>
              <td>${new Date().toLocaleDateString()}</td>
            </tr>
          </table>
        </div>
        
        ${this.convertMarkdownToHtml(markdownContent)}
        
        <div class="signature-block">
          <p><strong>Document Prepared By:</strong> ATO Compliance Agent</p>
          <p><strong>Generation Date:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Document Status:</strong> Draft</p>
        </div>
      </body>
      </html>`;

      // Convert HTML to base64 for Word compatibility
      const base64Content = Buffer.from(htmlContent, 'utf8').toString('base64');
      console.log(`✅ Converted markdown to Word document for system ${system.name} (${base64Content.length} base64 chars)`);
      
      return base64Content;
    } catch (error) {
      console.error('Error converting markdown to Word document:', error);
      // Fallback to original markdown if conversion fails
      return markdownContent;
    }
  }

  /**
   * Convert basic markdown formatting to HTML
   */
  private convertMarkdownToHtml(markdown: string): string {
    return markdown
      // Headers
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Lists
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      // Paragraphs
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[h|u|l])(.+)$/gm, '<p>$1</p>')
      // Clean up
      .replace(/<p><\/p>/g, '')
      .replace(/<p>(<[h|u])/g, '$1')
      .replace(/(<\/[h|u]>)<\/p>/g, '$1');
  }
}

export const generationService = new GenerationService();
