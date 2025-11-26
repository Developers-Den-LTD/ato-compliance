// Type definitions from backend schema
// These are duplicated here to avoid coupling frontend to backend code

export type ComplianceStatusType = "compliant" | "non-compliant" | "in-progress" | "not-started" | "not-assessed";
export type ImpactLevelType = "High" | "Moderate" | "Low";
export type BaselineType = "Low" | "Moderate" | "High";
export type SeverityType = "critical" | "high" | "medium" | "low" | "informational";
export type FindingStatusType = "open" | "fixed" | "accepted" | "false_positive";
export type RuleTypeType = "stig" | "jsig";

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
  owner?: string;
  systemType?: string;
  operatingSystem?: string;
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
  parentControlId?: string | null;
  supplementalGuidance?: string | null;
  createdAt?: Date | null;
}
