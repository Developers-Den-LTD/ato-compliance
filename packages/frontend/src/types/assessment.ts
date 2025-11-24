export type SystemAssessmentSnapshot = {
  assessmentId: string | null;
  systemId: string;
  status: 'not_started' | 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime: string | null;
  endTime: string | null;
  currentStep: string | null;
  summary: {
    totalControls: number;
    compliantControls: number;
    nonCompliantControls: number;
    partiallyImplementedControls: number;
    notAssessedControls: number;
    overallCompliancePercentage: number;
    riskScore: number;
  };
  findings: {
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
    resolvedFindings: number;
  };
  stigCompliance: {
    totalRules: number;
    compliantRules: number;
    nonCompliantRules: number;
    notApplicableRules: number;
    notReviewedRules: number;
    stigCompliancePercentage: number;
  };
  controlAssessments?: unknown[];
  poamItems?: unknown[];
  errors: string[];
};
