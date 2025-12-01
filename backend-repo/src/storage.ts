// Storage implementation - Complete database abstraction layer
import { db } from './db';
import { 
  users, systems, controls, stigRules, ccis, artifacts, findings, evidence, 
  checklists, poamItems, documents, generationJobs, providerSettings, 
  stigRuleControls, stigRuleCcis, systemControls, assessments,
  templates, templateVersions, templateMappings, generationCheckpoints,
  semanticChunks, controlEmbeddings, documentControlMappings
} from './schema';
import { eq, and, desc, asc, inArray, lt } from 'drizzle-orm';
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
    const result = await db.delete(systems).where(eq(systems.id, id));
    return (result.rowCount ?? 0) > 0;
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
    const result = await db.delete(stigRules).where(eq(stigRules.id, id));
    return (result.rowCount ?? 0) > 0;
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
    const result = await db.delete(artifacts).where(eq(artifacts.id, id));
    return (result.rowCount ?? 0) > 0;
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
    const result = await db.delete(documents).where(eq(documents.id, id));
    return (result.rowCount ?? 0) > 0;
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
}

// Export singleton instance
export const storage = new DatabaseStorage();
