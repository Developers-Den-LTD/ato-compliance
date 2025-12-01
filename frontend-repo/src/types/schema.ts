// Type definitions from backend schema
// These are duplicated here to avoid coupling frontend to backend code

import { z } from 'zod';

// Enum type definitions
export const ComplianceStatus = z.enum(["compliant", "non-compliant", "in-progress", "not-started", "not-assessed"]);
export const ImpactLevel = z.enum(["High", "Moderate", "Low"]);
export const Baseline = z.enum(["Low", "Moderate", "High"]);
export const Severity = z.enum(["critical", "high", "medium", "low", "informational"]);
export const FindingStatus = z.enum(["open", "fixed", "accepted", "false_positive"]);
export const RuleType = z.enum(["stig", "jsig"]);

export type ComplianceStatusType = z.infer<typeof ComplianceStatus>;
export type ImpactLevelType = z.infer<typeof ImpactLevel>;
export type BaselineType = z.infer<typeof Baseline>;
export type SeverityType = z.infer<typeof Severity>;
export type FindingStatusType = z.infer<typeof FindingStatus>;
export type RuleTypeType = z.infer<typeof RuleType>;

export interface System {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  impactLevel: string;
  complianceStatus: string;
  owner?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  systemType?: string | null;
  operatingSystem?: string | null;
  stigProfiles?: string[] | null;
  autoStigUpdates?: boolean | null;
  lastStigUpdate?: Date | null;
}

export interface InsertSystem {
  name: string;
  description?: string;
  category: string;
  impactLevel: string;
  complianceStatus?: string;
  owner?: string;
  systemType?: string;
  operatingSystem?: string;
  stigProfiles?: string[];
  autoStigUpdates?: boolean;
  createdBy?: string;
}

export interface Control {
  id: string;
  framework: string;
  family: string;
  title: string;
  description?: string | null;
  baseline: string[];
  priority?: string | null;
  enhancement?: string | null;
  supplementalGuidance?: string | null;
  status?: string | null;
  createdAt?: Date | null;
}

// Zod schemas for validation
export const insertSystemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category: z.enum(["Major Application", "General Support System"]),
  impactLevel: ImpactLevel,
  complianceStatus: ComplianceStatus.optional(),
  owner: z.string().optional(),
  systemType: z.string().optional(),
  operatingSystem: z.string().optional(),
  stigProfiles: z.array(z.string()).optional(),
  autoStigUpdates: z.boolean().optional(),
  createdBy: z.string().optional(),
});
