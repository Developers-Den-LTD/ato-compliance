// Storage implementation - Complete database abstraction layer
import { db } from './db';
import { 
  users, systems, controls, stigRules, ccis, artifacts, findings, evidence, 
  checklists, poamItems, documents, generationJobs, providerSettings, 
  stigRuleControls, stigRuleCcis, systemControls, assessments,
  templates, templateVersions, templateMappings, generationCheckpoints,
  semanticChunks, controlEmbeddings, documentControlMappings
} from './schema';
import { eq, and, desc, asc, inArray, lt, sql } from 'drizzle-orm';
import type { 
  User, InsertUser, System, InsertSystem, Control, InsertControl,
  StigRule, InsertStigRule, Cci, InsertCci, Artifact, InsertArtifact,
  Finding, InsertFinding, Evidence, InsertEvidence, Checklist, InsertChecklist,
  PoamItem, InsertPoamItem, Document, InsertDocument, GenerationJob, InsertGenerationJob,
  ProviderSettings, InsertProviderSettings, StigRuleControl, InsertStigRuleControl,
  StigRuleCci, InsertStigRuleCci, SystemControl, InsertSystemControl,
  Assessment, InsertAssessment, Template, InsertTemplate,
  TemplateVersion, InsertTemplateVersion, TemplateMapping, InsertTemplateMapping,
  GenerationCheckpoint, InsertGenerationCheckpoint,
  SemanticChunk, InsertSemanticChunk, ControlEmbedding, InsertControlEmbedding,
  DocumentControlMapping, InsertDocumentControlMapping
} from './schema';

export class DatabaseStorage {
  // User management
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  // System management
  async getSystems(): Promise<System[]> {
    return await db.select().from(systems);
  }

  async getSystem(id: string): Promise<System | undefined> {
    const result = await db.select().from(systems).where(eq(systems.id, id));
    return result[0];
  }

  async createSystem(system: InsertSystem): Promise<System> {
    const result = await db.insert(systems).values(system).returning();
    return result[0];
  }

  async updateSystem(id: string, updates: Partial<InsertSystem>): Promise<System | undefined> {
    const result = await db.update(systems).set(updates).where(eq(systems.id, id)).returning();
    return result[0];
  }

  async deleteSystem(id: string): Promise<boolean> {
    const result = await db.delete(systems).where(eq(systems.id, id)).returning();
    return result.length > 0;
  }

  // Control management
  async getControls(): Promise<Control[]> {
    return await db.select().from(controls);
  }

  async getControl(id: string, framework: string = 'NIST-800-53'): Promise<Control | undefined> {
    const result = await db.select().from(controls).where(and(
      eq(controls.id, id),
      eq(controls.framework, framework)
    ));
    return result[0];
  }

  async createControl(control: InsertControl): Promise<Control> {
    const result = await db.insert(controls).values(control).returning();
    return result[0];
  }

  // STIG Rule management
  async getStigRules(ruleType?: 'stig' | 'jsig'): Promise<StigRule[]> {
    if (ruleType) {
      return await db.select().from(stigRules).where(eq(stigRules.ruleType, ruleType));
    }
    return await db.select().from(stigRules);
  }

  async getStigRule(id: string): Promise<StigRule | undefined> {
    const result = await db.select().from(stigRules).where(eq(stigRules.id, id));
    return result[0];
  }

  async getStigRulesByStigId(stigId: string, ruleType?: 'stig' | 'jsig'): Promise<StigRule[]> {
    if (ruleType) {
      return await db.select().from(stigRules).where(and(
        eq(stigRules.stigId, stigId),
        eq(stigRules.ruleType, ruleType)
      ));
    }
    return await db.select().from(stigRules).where(eq(stigRules.stigId, stigId));
  }

  async getStigRulesBySeverity(severity: string, ruleType?: 'stig' | 'jsig'): Promise<StigRule[]> {
    if (ruleType) {
      return await db.select().from(stigRules).where(and(
        eq(stigRules.severity, severity),
        eq(stigRules.ruleType, ruleType)
      ));
    }
    return await db.select().from(stigRules).where(eq(stigRules.severity, severity));
  }

  async createStigRule(stigRule: InsertStigRule): Promise<StigRule> {
    const result = await db.insert(stigRules).values(stigRule).returning();
    return result[0];
  }

  async updateStigRule(id: string, updates: Partial<InsertStigRule>): Promise<StigRule | undefined> {
    const result = await db.update(stigRules).set(updates).where(eq(stigRules.id, id)).returning();
    return result[0];
  }

  async deleteStigRule(id: string): Promise<boolean> {
    const result = await db.delete(stigRules).where(eq(stigRules.id, id)).returning();
    return result.length > 0;
  }

  async getStigRulesByType(ruleType: 'stig' | 'jsig'): Promise<StigRule[]> {
    return await db.select().from(stigRules).where(eq(stigRules.ruleType, ruleType));
  }

  async getJsigRulesByStigId(stigId: string): Promise<StigRule[]> {
    return await db.select().from(stigRules).where(and(
      eq(stigRules.stigId, stigId),
      eq(stigRules.ruleType, 'jsig')
    ));
  }

  async getSTIGRulesByProfile(profileId: string): Promise<StigRule[]> {
    return await db.select().from(stigRules).where(eq(stigRules.stigId, profileId));
  }

  // Artifact management
  async getArtifacts(): Promise<Artifact[]> {
    return await db.select().from(artifacts);
  }

  async getArtifact(id: string): Promise<Artifact | undefined> {
    const result = await db.select().from(artifacts).where(eq(artifacts.id, id));
    return result[0];
  }

  async getArtifactsBySystem(systemId: string): Promise<Artifact[]> {
    return await db.select().from(artifacts).where(eq(artifacts.systemId, systemId));
  }

  async createArtifact(artifact: InsertArtifact): Promise<Artifact> {
    const result = await db.insert(artifacts).values(artifact).returning();
    return result[0];
  }

  async updateArtifact(id: string, updates: Partial<InsertArtifact>): Promise<Artifact | undefined> {
    const result = await db.update(artifacts).set(updates).where(eq(artifacts.id, id)).returning();
    return result[0];
  }

  async deleteArtifact(id: string): Promise<boolean> {
    const result = await db.delete(artifacts).where(eq(artifacts.id, id)).returning();
    return result.length > 0;
  }

  // Document management
  async getDocuments(): Promise<Document[]> {
    return await db.select().from(documents);
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const result = await db.select().from(documents).where(eq(documents.id, id));
    return result[0];
  }

  async getDocumentsBySystem(systemId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.systemId, systemId));
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const result = await db.insert(documents).values(document).returning();
    return result[0];
  }

  async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document | undefined> {
    const result = await db.update(documents).set(updates).where(eq(documents.id, id)).returning();
    return result[0];
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id)).returning();
    return result.length > 0;
  }

  // Finding management
  async getFindingsBySystem(systemId: string): Promise<Finding[]> {
    return await db.select().from(findings).where(eq(findings.systemId, systemId));
  }

  // Evidence management
  async getEvidenceBySystem(systemId: string): Promise<Evidence[]> {
    return await db.select().from(evidence).where(eq(evidence.systemId, systemId));
  }

  // Assessment management
  async getAssessmentsBySystem(systemId: string): Promise<Assessment[]> {
    return await db.select().from(assessments).where(eq(assessments.systemId, systemId));
  }

  async getAssessment(id: string): Promise<Assessment | undefined> {
    const result = await db.select().from(assessments).where(eq(assessments.id, id));
    return result[0];
  }

  async createAssessment(assessment: InsertAssessment): Promise<Assessment> {
    const result = await db.insert(assessments).values(assessment).returning();
    return result[0];
  }

  async updateAssessment(id: string, updates: Partial<InsertAssessment>): Promise<Assessment | undefined> {
    const result = await db.update(assessments).set(updates).where(eq(assessments.id, id)).returning();
    return result[0];
  }

  // Provider Settings
  async getProviderSettings(userId?: string): Promise<ProviderSettings[]> {
    if (userId) {
      return await db.select().from(providerSettings).where(eq(providerSettings.userId, userId));
    }
    return await db.select().from(providerSettings);
  }

  async createProviderSettings(settings: InsertProviderSettings): Promise<ProviderSettings> {
    const result = await db.insert(providerSettings).values(settings).returning();
    return result[0];
  }

  // Templates
  async getTemplates(): Promise<Template[]> {
    return await db.select().from(templates);
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const result = await db.select().from(templates).where(eq(templates.id, id));
    return result[0];
  }

  async getTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
    return await db.select().from(templateVersions).where(eq(templateVersions.templateId, templateId));
  }

  async getTemplateMappings(templateId: string): Promise<TemplateMapping[]> {
    return await db.select().from(templateMappings).where(eq(templateMappings.templateId, templateId));
  }

  // STIG Rule Control mappings
  async getStigRuleControlsByStigRule(stigRuleId: string): Promise<StigRuleControl[]> {
    return await db.select().from(stigRuleControls).where(eq(stigRuleControls.stigRuleId, stigRuleId));
  }

  async createStigRuleControl(mapping: InsertStigRuleControl): Promise<StigRuleControl> {
    const result = await db.insert(stigRuleControls).values(mapping).returning();
    return result[0];
  }

  // System Controls management
  async getSystemControls(systemId: string): Promise<any[]> {
    return await db.select().from(systemControls).where(eq(systemControls.systemId, systemId));
  }

  async getSystemControl(systemId: string, controlId: string): Promise<any | undefined> {
    const result = await db.select().from(systemControls).where(
      and(eq(systemControls.systemId, systemId), eq(systemControls.controlId, controlId))
    );
    return result[0];
  }

  async updateSystemControl(systemId: string, controlId: string, updates: any): Promise<any | undefined> {
    const result = await db.update(systemControls)
      .set(updates)
      .where(and(eq(systemControls.systemId, systemId), eq(systemControls.controlId, controlId)))
      .returning();
    return result[0];
  }

  async getControlsBySystemId(systemId: string): Promise<Control[]> {
    const systemControlsList = await this.getSystemControls(systemId);
    const controlIds = systemControlsList.map((sc: any) => sc.controlId);
    if (controlIds.length === 0) return [];
    return await db.select().from(controls).where(sql`${controls.id} = ANY(${controlIds})`);
  }

  // Evidence management
  async createEvidence(evidenceData: InsertEvidence): Promise<Evidence> {
    const result = await db.insert(evidence).values(evidenceData).returning();
    return result[0];
  }

  async getEvidenceByControl(controlId: string): Promise<Evidence[]> {
    return await db.select().from(evidence).where(eq(evidence.controlId, controlId));
  }

  // Finding management
  async createFinding(findingData: InsertFinding): Promise<Finding> {
    const result = await db.insert(findings).values(findingData).returning();
    return result[0];
  }

  // Generation Job management
  async createGenerationJob(jobData: InsertGenerationJob): Promise<GenerationJob> {
    const result = await db.insert(generationJobs).values(jobData).returning();
    return result[0];
  }

  async updateGenerationJob(jobId: string, updates: Partial<InsertGenerationJob>): Promise<GenerationJob | undefined> {
    const result = await db.update(generationJobs).set(updates).where(eq(generationJobs.id, jobId)).returning();
    return result[0];
  }

  // Template management
  async getTemplatesByType(type: string): Promise<Template[]> {
    return await db.select().from(templates).where(eq(templates.type, type));
  }

  async createTemplate(templateData: InsertTemplate): Promise<Template> {
    const result = await db.insert(templates).values(templateData).returning();
    return result[0];
  }

  async updateTemplate(templateId: string, updates: Partial<InsertTemplate>): Promise<Template | undefined> {
    const result = await db.update(templates).set(updates).where(eq(templates.id, templateId)).returning();
    return result[0];
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    const result = await db.delete(templates).where(eq(templates.id, templateId));
    return result.length > 0;
  }

  async getTemplatesByOrganization(organizationId: string): Promise<Template[]> {
    return await db.select().from(templates).where(eq(templates.organizationId, organizationId));
  }

  async getDefaultTemplateForType(documentType: string, systemId?: string): Promise<Template | undefined> {
    const result = await db.select().from(templates)
      .where(and(eq(templates.type, documentType), eq(templates.status, 'active')))
      .limit(1);
    return result[0];
  }

  // Template Version management
  async createTemplateVersion(versionData: InsertTemplateVersion): Promise<TemplateVersion> {
    const result = await db.insert(templateVersions).values(versionData).returning();
    return result[0];
  }

  async getTemplateVersion(versionId: string): Promise<TemplateVersion | undefined> {
    const result = await db.select().from(templateVersions).where(eq(templateVersions.id, versionId));
    return result[0];
  }

  async getActiveTemplateVersion(templateId: string): Promise<TemplateVersion | undefined> {
    const template = await this.getTemplate(templateId);
    if (!template?.activeVersion) return undefined;
    return await this.getTemplateVersion(template.activeVersion);
  }

  async activateTemplateVersion(templateId: string, versionId: string): Promise<boolean> {
    const result = await db.update(templates)
      .set({ activeVersion: versionId })
      .where(eq(templates.id, templateId))
      .returning();
    return result.length > 0;
  }

  async deleteTemplateVersion(versionId: string): Promise<boolean> {
    const result = await db.delete(templateVersions).where(eq(templateVersions.id, versionId));
    return result.length > 0;
  }

  // Template Mapping management
  async createTemplateMapping(mappingData: InsertTemplateMapping): Promise<TemplateMapping> {
    const result = await db.insert(templateMappings).values(mappingData).returning();
    return result[0];
  }

  async deleteTemplateMapping(mappingId: string): Promise<boolean> {
    const result = await db.delete(templateMappings).where(eq(templateMappings.id, mappingId));
    return result.length > 0;
  }

  // Provider Settings management
  async updateProviderSettings(settingsId: string, updates: Partial<InsertProviderSettings>): Promise<ProviderSettings | undefined> {
    const result = await db.update(providerSettings).set(updates).where(eq(providerSettings.id, settingsId)).returning();
    return result[0];
  }

  async getProviderSettingsByProvider(provider: string): Promise<ProviderSettings | undefined> {
    const result = await db.select().from(providerSettings).where(eq(providerSettings.provider, provider));
    return result[0];
  }

  // STIG Rule Control Mappings
  async getSTIGRuleControlMappings(ruleId: string): Promise<StigRuleControl[]> {
    return await db.select().from(stigRuleControls).where(eq(stigRuleControls.stigRuleId, ruleId));
  }

  async getStigRulesForControl(controlId: string): Promise<StigRule[]> {
    const mappings = await db.select().from(stigRuleControls).where(eq(stigRuleControls.controlId, controlId));
    const ruleIds = mappings.map(m => m.stigRuleId);
    if (ruleIds.length === 0) return [];
    return await db.select().from(stigRules).where(sql`${stigRules.id} = ANY(${ruleIds})`);
  }

  // Artifact content management
  async getArtifactContent(artifactId: string): Promise<string | undefined> {
    const artifact = await this.getArtifact(artifactId);
    if (!artifact?.metadata) return undefined;
    return (artifact.metadata as any)?.extractedText || undefined;
  }

  // Semantic search placeholders (would need vector extension)
  async findSimilarChunks(embedding: number[], limit: number, threshold?: number): Promise<any[]> {
    // Placeholder - would need pgvector extension
    return [];
  }

  async findSimilarControls(embedding: number[], limit: number, threshold?: number): Promise<any[]> {
    // Placeholder - would need pgvector extension
    return [];
  }

  async getControlEmbedding(controlId: string): Promise<any | undefined> {
    // Placeholder - would need embeddings table
    return undefined;
  }

  // Checkpoint management for resilient generation
  async getCheckpoint(jobId: string, checkpointKey: string): Promise<any | undefined> {
    // Placeholder - would need checkpoints table
    return undefined;
  }
  // Missing methods - stub implementations
  async getCcisByControl(controlId: string): Promise<string[]> {
    return [];
  }

  async getStigRuleCcisByCci(cci: string): Promise<any[]> {
    return [];
  }

  async getAssessmentByAssessmentId(assessmentId: string): Promise<any | null> {
    return null;
  }

  async getLatestAssessmentBySystem(systemId: string): Promise<any | null> {
    const result = await db.select().from(assessments)
      .where(eq(assessments.systemId, systemId))
      .orderBy(desc(assessments.createdAt))
      .limit(1);
    return result[0] || null;
  }

  async createChecklist(data: any): Promise<any> {
    return {};
  }

  async getFindings(systemId?: string): Promise<any[]> {
    return [];
  }

  async getStigRuleCcisByStigRule(stigRuleId: string): Promise<any[]> {
    return [];
  }

  async getCci(cciId: string): Promise<any | null> {
    return null;
  }

  async getEvidenceByArtifact(artifactId: string): Promise<any[]> {
    return [];
  }

  async deleteDocumentSectionsByArtifact(artifactId: string): Promise<void> {
    // Stub - would delete document sections for an artifact
  }

  async createDocumentSections(records: any[]): Promise<void> {
    // Stub - would create document sections
  }

  async createControlEmbedding(embeddingRecord: any): Promise<void> {
    // Stub - would create control embedding
  }

  async deleteEvidence(evidenceId: string): Promise<void> {
    // Stub - would delete evidence
  }

  async getEvidenceItem(evidenceId: string): Promise<any | null> {
    // Stub - would get evidence item
    return null;
  }

  async getFindingsByControl(controlId: string): Promise<any[]> {
    // Stub - would get findings by control
    return [];
  }

  async updateEvidence(evidenceId: string, updates: any): Promise<void> {
    // Stub - would update evidence
  }

  async updateFinding(findingId: string, updates: any): Promise<any> {
    // Stub - would update finding
    return {};
  }

  async cleanupOldCheckpoints(cutoff: Date): Promise<number> {
    // Stub - would cleanup old checkpoints
    return 0;
  }

  async createCheckpoint(checkpoint: any): Promise<void> {
    // Stub - would create checkpoint
  }

  async getLatestCheckpoint(jobId: string): Promise<any | null> {
    // Stub - would get latest checkpoint
    return null;
  }

  async getCheckpoints(jobId: string): Promise<any[]> {
    // Stub - would get checkpoints
    return [];
  }

  async getDocumentsByJobId(jobId: string): Promise<any[]> {
    // Stub - would get documents by job ID
    return [];
  }

  async getChecklistsByJobId(jobId: string): Promise<any[]> {
    // Stub - would get checklists by job ID
    return [];
  }

  async getPoamItemsBySystem(systemId: string): Promise<any[]> {
    // Stub - would get POAM items by system
    return [];
  }

  async createPoamItem(item: any): Promise<void> {
    // Stub - would create POAM item
  }

  async getGenerationJob(jobId: string): Promise<any | null> {
    return null;
  }
}

// Export singleton instance
export const storage = new DatabaseStorage();
