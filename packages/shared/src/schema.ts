import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean, uniqueIndex, date, uuid, real, primaryKey, index } from "drizzle-orm/pg-core";
import { z } from "zod";

// Status type definitions (moved to top for proper usage)
export const ComplianceStatus = z.enum(["compliant", "non-compliant", "in-progress", "not-started", "not-assessed"]);
export const ImpactLevel = z.enum(["High", "Moderate", "Low"]);
export const Baseline = z.enum(["Low", "Moderate", "High"]);
export const Severity = z.enum(["critical", "high", "medium", "low", "informational"]);
export const FindingStatus = z.enum(["open", "fixed", "accepted", "false_positive"]);
export const EvidenceStatus = z.enum(["satisfies", "partially_satisfies", "does_not_satisfy", "not_applicable"]);
export const JobStatus = z.enum(["pending", "running", "processing", "completed", "completed_with_errors", "failed"]);
export const DocumentStatus = z.enum(["draft", "review", "approved", "final"]);
export const LLMProvider = z.enum(["anthropic", "ollama", "openai"]);
export const SourceType = z.enum(["nessus", "scap", "manual"]);
export const ImplementationStatus = z.enum(["not_implemented", "partial", "implemented", "not_applicable"]);
export const ArtifactType = z.enum(["architecture_diagram", "system_documentation", "evidence_file", "policy_document", "procedure_document", "assessment_report", "scan_results", "source_code", "infrastructure_code", "other"]);
export const RuleType = z.enum(["stig", "jsig"]);
export const TemplateType = z.enum(["ssp", "sar", "poam", "checklist", "ato_package"]);
export const TemplateStatus = z.enum(["active", "inactive", "deprecated"]);
export const MappingAction = z.enum(["created", "updated", "deleted", "confidence_adjusted"]);
export const RelationshipType = z.enum(["supports", "conflicts", "depends_on", "related_to"]);

export type ComplianceStatusType = z.infer<typeof ComplianceStatus>;
export type ImpactLevelType = z.infer<typeof ImpactLevel>;
export type BaselineType = z.infer<typeof Baseline>;
export type SeverityType = z.infer<typeof Severity>;
export type FindingStatusType = z.infer<typeof FindingStatus>;
export type EvidenceStatusType = z.infer<typeof EvidenceStatus>;
export type JobStatusType = z.infer<typeof JobStatus>;
export type DocumentStatusType = z.infer<typeof DocumentStatus>;
export type LLMProviderType = z.infer<typeof LLMProvider>;
export type SourceTypeType = z.infer<typeof SourceType>;
export type ImplementationStatusType = z.infer<typeof ImplementationStatus>;
export type ArtifactTypeType = z.infer<typeof ArtifactType>;
export type RuleTypeType = z.infer<typeof RuleType>;
export type TemplateTypeType = z.infer<typeof TemplateType>;
export type TemplateStatusType = z.infer<typeof TemplateStatus>;
export type MappingActionType = z.infer<typeof MappingAction>;
export type RelationshipTypeType = z.infer<typeof RelationshipType>;

// Users table (existing) - Note: password should be hashed before storage
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(), // Store bcrypt/argon2 hash
  role: text("role").notNull().default("user"), // "admin" or "user"
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// IT Systems
export const systems = pgTable("systems", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // "Major Application", "General Support System"
  impactLevel: text("impact_level").notNull(), // "High", "Moderate", "Low"
  complianceStatus: text("compliance_status").notNull(), // "compliant", "non-compliant", "in-progress", "not-assessed"
  owner: text("owner"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
  // STIG Integration Fields
  systemType: text("system_type"), // "Application", "Operating System", "Network Device", "Mobile Device", "Cloud"
  operatingSystem: text("operating_system"),
  stigProfiles: text("stig_profiles").array(), // Array of STIG profile IDs
  autoStigUpdates: boolean("auto_stig_updates").default(true),
  lastStigUpdate: timestamp("last_stig_update"),
});

// Security Controls (Multi-Framework Support)
export const controls = pgTable("controls", {
  id: varchar("id").primaryKey(), // e.g., "AC-1", "AU-2", "FedRAMP-AC-1" - make unique across frameworks
  framework: varchar("framework", { length: 50 }).notNull().default("NIST-800-53"), // Framework identifier
  family: text("family").notNull(), // e.g., "Access Control", "Audit and Accountability"
  title: text("title").notNull(),
  description: text("description"),
  baseline: text("baseline").array().notNull(), // ["Low", "Moderate", "High"] or ["Low", "Moderate", "High", "FedRAMP Low", "FedRAMP Moderate", "FedRAMP High"]
  priority: text("priority"), // e.g., "P1", "P2", "P3"
  enhancement: text("enhancement"), // e.g., "(1)", "(2)" for control enhancements
  supplementalGuidance: text("supplemental_guidance"),
  status: text("status").notNull().default("not_implemented"), // compliance status
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  frameworkIdx: index("idx_controls_framework").on(table.framework),
}));

// STIG Rules mapping
export const stigRules = pgTable("stig_rules", {
  id: varchar("id").primaryKey(), // Use actual STIG rule ID like "RHEL-08-010010"
  stigId: text("stig_id").notNull(), // STIG identifier like "RHEL-8-STIG"
  stigTitle: text("stig_title"), // Full STIG title
  version: text("version"), // STIG version like "V1R14"
  ruleTitle: text("rule_title"), // Full rule title
  title: text("title").notNull(),
  description: text("description"),
  checkText: text("check_text"),
  fixText: text("fix_text"),
  severity: text("severity").notNull(), // "high", "medium", "low"
  ruleType: text("rule_type").notNull().default("stig"), // "stig", "jsig" - default to "stig" for backward compatibility
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Control Correlation Identifiers (CCIs) - Bridge between NIST controls and implementation requirements
export const ccis = pgTable("ccis", {
  cci: varchar("cci").primaryKey(), // e.g., "CCI-000015"
  definition: text("definition").notNull(),
  controlId: varchar("control_id").references(() => controls.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Many-to-many mapping: STIG Rules to CCIs
export const stigRuleCcis = pgTable("stig_rule_ccis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stigRuleId: varchar("stig_rule_id").references(() => stigRules.id, { onDelete: "cascade" }).notNull(),
  cci: varchar("cci").references(() => ccis.cci, { onDelete: "cascade" }).notNull(),
  rationale: text("rationale"), // Why this STIG rule maps to this CCI
}, (table) => ({
  // Prevent duplicate mappings using Drizzle's uniqueIndex builder
  uniqueMapping: uniqueIndex("uq_stig_rule_ccis").on(table.stigRuleId, table.cci),
}));

// Many-to-many mapping: STIG Rules to NIST Controls
export const stigRuleControls = pgTable("stig_rule_controls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stigRuleId: varchar("stig_rule_id").references(() => stigRules.id, { onDelete: "cascade" }).notNull(),
  controlId: varchar("control_id").references(() => controls.id, { onDelete: "cascade" }).notNull(),
  rationale: text("rationale"), // Why this STIG rule implements this control
}, (table) => ({
  // Prevent duplicate mappings using Drizzle's uniqueIndex builder
  uniqueMapping: uniqueIndex("uq_stig_rule_controls").on(table.stigRuleId, table.controlId),
}));

// Evidence Artifacts (diagrams, docs, etc.)
export const artifacts = pgTable("artifacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  systemId: varchar("system_id").references(() => systems.id),
  name: text("name").notNull(), // Original filename
  title: text("title").notNull(), // Display title
  description: text("description"), // Optional description
  type: text("type").notNull(), // "architecture_diagram", "system_documentation", "evidence_file", etc.
  filePath: text("file_path"),
  mimeType: text("mime_type"),
  size: integer("size"), // File size in bytes
  checksum: text("checksum"), // File checksum for integrity
  isPublic: boolean("is_public").default(false), // Public accessibility
  tags: text("tags").array(), // Tags for categorization
  metadata: jsonb("metadata"), // Extracted text, OCR results, etc.
  processingStatus: text("processing_status").default('pending'), // Processing status: pending, processing, completed, failed
  processingError: text("processing_error"), // Error message if processing failed
  processedAt: timestamp("processed_at"), // Timestamp when processing completed or failed
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Scan Findings (from SCAP, Nessus, etc.)
export const findings = pgTable("findings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  systemId: varchar("system_id").references(() => systems.id, { onDelete: "cascade" }).notNull(),
  artifactId: varchar("artifact_id").references(() => artifacts.id, { onDelete: "set null" }),
  stigRuleId: varchar("stig_rule_id").references(() => stigRules.id, { onDelete: "cascade" }).notNull(), // Links to STIG rule
  findingId: text("finding_id"), // Scanner-specific ID
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull(), // "critical", "high", "medium", "low", "informational"
  status: text("status").notNull(), // "open", "fixed", "accepted", "false_positive"
  source: text("source").notNull(), // "nessus", "scap", "manual"
  evidence: text("evidence"),
  remediation: text("remediation"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Evidence for control implementation
export const evidence = pgTable("evidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  systemId: varchar("system_id").references(() => systems.id, { onDelete: "cascade" }).notNull(),
  controlId: varchar("control_id").references(() => controls.id, { onDelete: "cascade" }).notNull(),
  artifactId: varchar("artifact_id").references(() => artifacts.id, { onDelete: "set null" }),
  findingId: varchar("finding_id").references(() => findings.id, { onDelete: "set null" }),
  type: text("type").notNull(), // "document", "scan_result", "configuration", "policy"
  description: text("description"),
  implementation: text("implementation"), // How the control is implemented
  assessorNotes: text("assessor_notes"),
  status: text("status").notNull(), // "satisfies", "partially_satisfies", "does_not_satisfy", "not_applicable"
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// STIG Checklists
export const checklists = pgTable("checklists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  systemId: varchar("system_id").references(() => systems.id, { onDelete: "cascade" }).notNull(),
  jobId: varchar("job_id").references(() => generationJobs.id), // Link to generation job
  stigId: text("stig_id"), // STIG identifier
  stigName: text("stig_name").notNull(),
  title: text("title"), // Checklist title
  version: text("version"),
  content: jsonb("content"), // Checklist content
  items: jsonb("items"), // Array of checklist items with status
  findings: integer("findings"), // Total findings count
  compliant: integer("compliant"), // Compliant findings count
  completionStatus: text("completion_status").notNull(), // "not_started", "in_progress", "completed"
  generatedBy: text("generated_by"), // "manual", "ai_generated"
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Plan of Action and Milestones (POA&M)
export const poamItems = pgTable("poam_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  systemId: varchar("system_id").references(() => systems.id, { onDelete: "cascade" }).notNull(),
  controlId: varchar("control_id").references(() => controls.id, { onDelete: "cascade" }),
  findingId: varchar("finding_id").references(() => findings.id, { onDelete: "cascade" }),
  weakness: text("weakness").notNull(),
  riskStatement: text("risk_statement"),
  remediation: text("remediation"),
  milestones: jsonb("milestones"), // Array of milestone objects
  resources: text("resources"),
  plannedCompletionDate: timestamp("planned_completion_date"),
  actualCompletionDate: timestamp("actual_completion_date"),
  status: text("status").notNull(), // "open", "in_progress", "completed", "delayed"
  priority: text("priority").notNull(), // "critical", "high", "medium", "low"
  assignedTo: text("assigned_to"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Generated Documents (SSP, SAR, POA&M, etc.)
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  systemId: varchar("system_id").references(() => systems.id, { onDelete: "cascade" }).notNull(),
  jobId: varchar("job_id").references(() => generationJobs.id), // Link to generation job
  templateId: varchar("template_id").references(() => templates.id), // Optional: Link to custom template used
  type: text("type").notNull(), // "ssp", "sar", "poam", "checklist", "ato_package", "control_narrative", "poam_report", "sar_package", "complete_ato_package"
  title: text("title").notNull(),
  content: jsonb("content"), // Structured document content
  template: text("template"), // Template used for generation (legacy field)
  version: text("version").default("1.0"),
  status: text("status").notNull(), // "draft", "review", "approved", "final"
  generatedBy: text("generated_by"), // "manual", "ai_generated"
  filePath: text("file_path"), // Path to exported file
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// LLM Generation Jobs
export const generationJobs = pgTable("generation_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  systemId: varchar("system_id").references(() => systems.id),
  type: text("type").notNull(), // "ato_package", "ssp", "sar", "poam", "checklist", "data_ingestion"
  documentTypes: text("document_types").array(), // Array of document types to generate
  status: text("status").notNull(), // "pending", "running", "processing", "completed", "completed_with_errors", "failed"
  progress: integer("progress").default(0), // 0-100
  currentStep: text("current_step"), // Current processing step
  stepData: jsonb("step_data"), // Array of generation steps with status
  provider: text("provider"), // "anthropic", "ollama", "openai"
  model: text("model"), // Model used for generation
  prompt: text("prompt"), // Prompt used
  result: jsonb("result"), // Generated content
  requestData: jsonb("request_data"), // Original generation request
  metadata: jsonb("metadata"), // Additional job metadata
  error: text("error_message"), // Error message if failed
  startTime: timestamp("started_at"),
  endTime: timestamp("completed_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// System Assessments - Stores completed assessment results
export const assessments = pgTable("assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  systemId: varchar("system_id").references(() => systems.id, { onDelete: "cascade" }),
  assessmentId: text("assessment_id").notNull().unique(), // External assessment ID from engine
  title: text("title"),
  assessor: text("assessor"),
  assessmentDate: timestamp("assessment_date").default(sql`CURRENT_TIMESTAMP`),
  nextAssessmentDate: date("next_assessment_date"),
  findingsCount: integer("findings_count").default(0),
  controlAssessments: jsonb("control_assessments"), // Array of ControlAssessmentResults
  status: text("status").notNull().default("draft"), // "draft", "in_progress", "completed", "cancelled", "failed"
  // Additional columns added by migrations
  progress: integer("progress").default(0), // Assessment progress percentage (0-100)
  startTime: timestamp("start_time").default(sql`CURRENT_TIMESTAMP`), // Assessment start time
  endTime: timestamp("end_time"), // Assessment end time
  summary: jsonb("summary"), // Assessment summary data
  findings: jsonb("findings"), // Assessment findings data
  errors: text("errors").array(), // Assessment error messages
  stigCompliance: jsonb("stig_compliance"), // STIG compliance data
  assessmentOptions: jsonb("assessment_options"), // Assessment configuration options
  assessedBy: varchar("assessed_by").references(() => users.id), // User who performed assessment
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// LLM Provider Settings
export const providerSettings = pgTable("provider_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  provider: text("provider").notNull(), // "anthropic", "ollama", "openai"
  isEnabled: boolean("is_enabled").default(true),
  priority: integer("priority").default(1), // For fallback ordering
  configuration: jsonb("configuration"), // Provider-specific config
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// System Controls - Links systems to controls with implementation status
export const systemControls = pgTable("system_controls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  systemId: varchar("system_id").references(() => systems.id, { onDelete: "cascade" }).notNull(),
  controlId: varchar("control_id").references(() => controls.id, { onDelete: "cascade" }).notNull(),
  status: text("status").notNull().default("not_implemented"), // "not_implemented", "partial", "implemented", "not_applicable"
  assignedTo: text("assigned_to"),
  implementationText: text("implementation_text"), // Detailed implementation narrative
  lastUpdated: timestamp("last_updated").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  // Prevent duplicate system-control assignments
  uniqueMapping: uniqueIndex("uq_system_controls").on(table.systemId, table.controlId),
}));

// System STIG Profiles - Junction table for many-to-many relationship
export const systemStigProfiles = pgTable("system_stig_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  systemId: varchar("system_id").references(() => systems.id, { onDelete: "cascade" }).notNull(),
  stigId: text("stig_id").notNull(), // References stig_rules.stig_id
  assignedAt: timestamp("assigned_at").default(sql`CURRENT_TIMESTAMP`),
  autoUpdate: boolean("auto_update").default(true),
  version: text("version"), // Track STIG version (e.g., "V1R1")
}, (table) => ({
  // Prevent duplicate system-stig assignments
  uniqueMapping: uniqueIndex("uq_system_stig_profiles").on(table.systemId, table.stigId),
}));

// Template Storage Tables for Epic 3
// Templates table - stores template metadata
export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // TemplateType
  status: text("status").notNull().default("active"), // TemplateStatus
  organizationId: varchar("organization_id"), // For multi-tenant support
  createdBy: varchar("created_by").notNull(), // User ID
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  metadata: jsonb("metadata"), // Additional template metadata
  tags: jsonb("tags"), // Array of tags for categorization
  isPublic: boolean("is_public").notNull().default(false),
  sizeBytes: integer("size_bytes").notNull().default(0),
  checksum: text("checksum"), // File integrity check
  filePath: text("file_path"), // Path to uploaded template file
  fileSize: integer("file_size"), // File size in bytes
  mimeType: text("mime_type"), // MIME type of uploaded file
});

// Template versions table - tracks version history
export const templateVersions = pgTable("template_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  filePath: text("file_path").notNull(), // Path to template file
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  checksum: text("checksum").notNull(),
  changeLog: text("change_log"), // Description of changes
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(false), // Only one version can be active
});

// Template mappings table - maps templates to document types and systems
export const templateMappings = pgTable("template_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),
  systemId: varchar("system_id").references(() => systems.id, { onDelete: "cascade" }), // Optional: system-specific templates
  documentType: text("document_type").notNull(), // TemplateType
  isDefault: boolean("is_default").notNull().default(false), // Default template for this type
  priority: integer("priority").notNull().default(0), // Higher priority templates used first
  conditions: jsonb("conditions"), // JSON conditions for when to use this template
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar("created_by").notNull(),
});

// Generation checkpoints table for recovery
export const generationCheckpoints = pgTable("generation_checkpoints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => generationJobs.id, { onDelete: "cascade" }),
  step: varchar("step", { length: 100 }).notNull(),
  data: jsonb("data").notNull().default({}),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Document sections extracted from artifacts
export const documentSections = pgTable("document_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  artifactId: varchar("artifact_id").notNull().references(() => artifacts.id, { onDelete: "cascade" }),
  parentSectionId: varchar("parent_section"),
  sectionIndex: integer("section_index").notNull(),
  sectionLevel: integer("section_level").notNull(),
  sectionType: varchar("section_type", { length: 50 }).notNull(),
  title: text("title"),
  content: text("content").notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Semantic search tables for Story 9.3
export const semanticChunks = pgTable("semantic_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  artifactId: varchar("artifact_id").notNull().references(() => artifacts.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: text("embedding"), // Will store as text and convert to vector in SQL
  chunkType: varchar("chunk_type", { length: 50 }), // 'header', 'paragraph', 'list', 'table', 'policy', 'procedure'
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const controlEmbeddings = pgTable("control_embeddings", {
  controlId: varchar("control_id").primaryKey().references(() => controls.id),
  requirementEmbedding: text("requirement_embedding"), // Will store as text and convert to vector in SQL
  titleEmbedding: text("title_embedding"),
  combinedEmbedding: text("combined_embedding"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const documentControlMappings = pgTable("document_control_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chunkId: varchar("chunk_id").notNull().references(() => semanticChunks.id, { onDelete: "cascade" }),
  controlId: varchar("control_id").notNull().references(() => controls.id),
  relevanceScore: real("relevance_score").notNull(),
  mappingType: varchar("mapping_type", { length: 50 }).notNull(), // 'primary', 'supporting', 'related'
  extractedDetails: jsonb("extracted_details").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Control Mapping Tables (Story 9.4)
export const controlMappings = pgTable("control_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  controlId: varchar("control_id").notNull(),
  controlFramework: varchar("control_framework", { length: 50 }).notNull(),
  confidenceScore: real("confidence_score").notNull(),
  mappingCriteria: jsonb("mapping_criteria").default({}),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: varchar("created_by").references(() => users.id),
}, (table) => ({
  uniqueMapping: uniqueIndex("unique_document_control_mapping").on(table.documentId, table.controlId, table.controlFramework),
}));

export const controlRelationships = pgTable("control_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceControlId: varchar("source_control_id", { length: 50 }).notNull(),
  targetControlId: varchar("target_control_id", { length: 50 }).notNull(),
  relationshipType: varchar("relationship_type", { length: 50 }).notNull(),
  framework: varchar("framework", { length: 50 }).notNull(),
  strength: real("strength").default(1.0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueRelationship: uniqueIndex("unique_control_relationship").on(table.sourceControlId, table.targetControlId, table.relationshipType, table.framework),
}));

export const mappingCriteria = pgTable("mapping_criteria", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  criteriaName: varchar("criteria_name", { length: 100 }).notNull().unique(),
  criteriaType: varchar("criteria_type", { length: 50 }).notNull(),
  weight: real("weight").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const controlMappingHistory = pgTable("control_mapping_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mappingId: varchar("mapping_id").notNull().references(() => controlMappings.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 50 }).notNull(),
  oldConfidenceScore: real("old_confidence_score"),
  newConfidenceScore: real("new_confidence_score"),
  changeReason: text("change_reason"),
  changedBy: varchar("changed_by").references(() => users.id),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
});

// Context Aggregation Tables (Story 9.5)
export const evidenceAggregations = pgTable("evidence_aggregations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  controlId: varchar("control_id", { length: 50 }).notNull(),
  controlFramework: varchar("control_framework", { length: 50 }).notNull(),
  aggregatedContext: jsonb("aggregated_context").notNull(),
  evidenceCount: integer("evidence_count").notNull().default(0),
  qualityScore: real("quality_score"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: varchar("created_by").references(() => users.id),
}, (table) => ({
  uniqueAggregation: uniqueIndex("unique_control_aggregation").on(table.controlId, table.controlFramework),
}));

export const evidenceItems = pgTable("evidence_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  controlId: varchar("control_id", { length: 50 }).notNull(),
  evidenceText: text("evidence_text").notNull(),
  evidenceType: varchar("evidence_type", { length: 50 }).notNull(),
  relevanceScore: real("relevance_score"),
  qualityScore: real("quality_score"),
  sourceLocation: jsonb("source_location").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const evidenceRelationships = pgTable("evidence_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceEvidenceId: varchar("source_evidence_id").notNull().references(() => evidenceItems.id, { onDelete: "cascade" }),
  targetEvidenceId: varchar("target_evidence_id").notNull().references(() => evidenceItems.id, { onDelete: "cascade" }),
  relationshipType: varchar("relationship_type", { length: 50 }).notNull(),
  strength: real("strength").default(1.0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueRelationship: uniqueIndex("unique_evidence_relationship").on(table.sourceEvidenceId, table.targetEvidenceId, table.relationshipType),
}));

export const contextVersions = pgTable("context_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  controlId: varchar("control_id", { length: 50 }).notNull(),
  controlFramework: varchar("control_framework", { length: 50 }).notNull(),
  versionNumber: integer("version_number").notNull(),
  contextData: jsonb("context_data").notNull(),
  changeSummary: text("change_summary"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
}, (table) => ({
  uniqueVersion: uniqueIndex("unique_context_version").on(table.controlId, table.controlFramework, table.versionNumber),
}));

// Type exports using Drizzle's built-in type inference
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type System = typeof systems.$inferSelect;
export type InsertSystem = typeof systems.$inferInsert;

export type Control = typeof controls.$inferSelect;
export type InsertControl = typeof controls.$inferInsert;

export type Cci = typeof ccis.$inferSelect;
export type InsertCci = typeof ccis.$inferInsert;

export type Artifact = typeof artifacts.$inferSelect;
export type InsertArtifact = typeof artifacts.$inferInsert;

export type Finding = typeof findings.$inferSelect;
export type InsertFinding = typeof findings.$inferInsert;

export type Evidence = typeof evidence.$inferSelect;
export type InsertEvidence = typeof evidence.$inferInsert;

export type GenerationJob = typeof generationJobs.$inferSelect;
export type InsertGenerationJob = typeof generationJobs.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

export type StigRule = typeof stigRules.$inferSelect;
export type InsertStigRule = typeof stigRules.$inferInsert;

export type Checklist = typeof checklists.$inferSelect;
export type InsertChecklist = typeof checklists.$inferInsert;

export type PoamItem = typeof poamItems.$inferSelect;
export type InsertPoamItem = typeof poamItems.$inferInsert;

export type ProviderSettings = typeof providerSettings.$inferSelect;
export type InsertProviderSettings = typeof providerSettings.$inferInsert;

export type StigRuleCci = typeof stigRuleCcis.$inferSelect;
export type InsertStigRuleCci = typeof stigRuleCcis.$inferInsert;

export type StigRuleControl = typeof stigRuleControls.$inferSelect;
export type InsertStigRuleControl = typeof stigRuleControls.$inferInsert;

export type SystemControl = typeof systemControls.$inferSelect;
export type InsertSystemControl = typeof systemControls.$inferInsert;

export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = typeof assessments.$inferInsert;

// Type definitions for template tables
export type Template = typeof templates.$inferSelect;
export type InsertTemplate = typeof templates.$inferInsert;
export type TemplateVersion = typeof templateVersions.$inferSelect;
export type InsertTemplateVersion = typeof templateVersions.$inferInsert;
export type TemplateMapping = typeof templateMappings.$inferSelect;
export type InsertTemplateMapping = typeof templateMappings.$inferInsert;

// Type definitions for checkpoints
export type GenerationCheckpoint = typeof generationCheckpoints.$inferSelect;
export type InsertGenerationCheckpoint = typeof generationCheckpoints.$inferInsert;

// Type definitions for document sections
export type DocumentSectionRecord = typeof documentSections.$inferSelect;
export type InsertDocumentSection = typeof documentSections.$inferInsert;

// Type definitions for semantic search
export type SemanticChunk = typeof semanticChunks.$inferSelect;
export type InsertSemanticChunk = typeof semanticChunks.$inferInsert;
export type ControlEmbedding = typeof controlEmbeddings.$inferSelect;
export type InsertControlEmbedding = typeof controlEmbeddings.$inferInsert;
export type DocumentControlMapping = typeof documentControlMappings.$inferSelect;
export type InsertDocumentControlMapping = typeof documentControlMappings.$inferInsert;

// Type definitions for control mapping
export type ControlMapping = typeof controlMappings.$inferSelect;
export type InsertControlMapping = typeof controlMappings.$inferInsert;
export type ControlRelationship = typeof controlRelationships.$inferSelect;
export type InsertControlRelationship = typeof controlRelationships.$inferInsert;
export type MappingCriteria = typeof mappingCriteria.$inferSelect;
export type InsertMappingCriteria = typeof mappingCriteria.$inferInsert;
export type ControlMappingHistory = typeof controlMappingHistory.$inferSelect;
export type InsertControlMappingHistory = typeof controlMappingHistory.$inferInsert;

// Type definitions for context aggregation
export type EvidenceAggregation = typeof evidenceAggregations.$inferSelect;
export type InsertEvidenceAggregation = typeof evidenceAggregations.$inferInsert;
export type EvidenceItem = typeof evidenceItems.$inferSelect;
export type InsertEvidenceItem = typeof evidenceItems.$inferInsert;
export type EvidenceRelationship = typeof evidenceRelationships.$inferSelect;
export type InsertEvidenceRelationship = typeof evidenceRelationships.$inferInsert;
export type ContextVersion = typeof contextVersions.$inferSelect;
export type InsertContextVersion = typeof contextVersions.$inferInsert;

// API Response Interfaces
// These interfaces define the structure of API responses for complex endpoints
export interface AnalyticsResponse {
  timestamp: string;
  overview: {
    totalSystems: number;
    totalControls: number;
    totalFindings: number;
    compliancePercentage: number;
  };
  systems: {
    total: number;
    byImpactLevel: {
      High: number;
      Moderate: number;
      Low: number;
    };
    byComplianceStatus: {
      compliant: number;
      'non-compliant': number;
      'in-progress': number;
      'not-assessed': number;
    };
  };
  controls: {
    total: number;
    implemented: number;
    'partially-implemented': number;
    'not-implemented': number;
  };
  findings: {
    total: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      informational: number;
    };
    byStatus: {
      open: number;
      fixed: number;
      accepted: number;
      false_positive: number;
    };
  };
}

export interface ControlsResponse {
  controls: Control[];
  total: number;
  filters?: {
    family?: string;
    baseline?: string;
    status?: string;
    limit: number;
  };
}

export interface SystemsResponse {
  systems: System[];
  total: number;
  filters?: {
    impactLevel?: string;
    complianceStatus?: string;
    category?: string;
    limit: number;
  };
}

export interface FindingsResponse {
  findings: Finding[];
  total: number;
  filters?: {
    severity?: string;
    status?: string;
    systemId?: string;
    limit: number;
  };
}

export interface DocumentTemplate {
  type: string;
  name: string;
  description: string;
  options?: Record<string, any>;
}

export interface JobResult {
  job: GenerationJob;
  documents: Document[];
  checklists: Checklist[];
  summary: {
    totalDocuments: number;
    totalChecklists: number;
    completionTime?: string;
  };
}
