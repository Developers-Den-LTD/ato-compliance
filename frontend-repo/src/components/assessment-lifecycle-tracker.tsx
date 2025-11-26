import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  PlayCircle,
  PauseCircle,
  FileText,
  Shield,
  Target,
  BarChart3,
  Calendar,
  Users,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest, authenticatedFetch } from '@/lib/queryClient';
import { StatCard } from '@/components/dashboard-stats';
import type { SystemAssessmentSnapshot } from '@/types/assessment';

const defaultSnapshot: SystemAssessmentSnapshot = {
  assessmentId: null,
  systemId: '',
  status: 'not_started',
  progress: 0,
  startTime: null,
  endTime: null,
  currentStep: 'Assessment not started',
  summary: {
    totalControls: 0,
    compliantControls: 0,
    nonCompliantControls: 0,
    partiallyImplementedControls: 0,
    notAssessedControls: 0,
    overallCompliancePercentage: 0,
    riskScore: 100,
  },
  findings: {
    totalFindings: 0,
    criticalFindings: 0,
    highFindings: 0,
    mediumFindings: 0,
    lowFindings: 0,
    resolvedFindings: 0,
  },
  stigCompliance: {
    totalRules: 0,
    compliantRules: 0,
    nonCompliantRules: 0,
    notApplicableRules: 0,
    notReviewedRules: 0,
    stigCompliancePercentage: 0,
  },
  controlAssessments: [],
  poamItems: [],
  errors: [],
};

// Real assessment status from backend
interface AssessmentStatus {
  assessmentId: string;
  systemId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime: string;
  endTime?: string;
  currentStep?: string;
  errors?: string[];
}

// Assessment summary with metrics from backend
interface AssessmentSummary {
  system: {
    id: string;
    name: string;
    category: string;
    impactLevel: string;
    complianceStatus: string;
  };
  assessment: {
    id: string;
    status: string;
    lastRun: string;
    overallCompliance: number;
    riskScore: number;
  };
  metrics: {
    totalControls: number;
    compliantControls: number;
    nonCompliantControls: number;
    totalFindings: number;
    openFindings: number;
    criticalFindings: number;
    highFindings: number;
    stigCompliance: number;
  };
  trends: {
    riskTrend: string;
    complianceTrend: string;
  };
}

// Dynamic assessment phase based on real progress
interface AssessmentPhase {
  id: string;
  name: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending' | 'blocked';
  progress: number;
  startDate?: string;
  endDate?: string;
  estimatedDuration: string;
  deliverables: string[];
}

interface AssessmentLifecycleTrackerProps {
  systemId: string;
  currentPhase?: string;
  assessmentId?: string;
}


export function AssessmentLifecycleTracker({ systemId, currentPhase, assessmentId }: AssessmentLifecycleTrackerProps) {
  const { toast } = useToast();
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  
  // Fetch current assessment status with real-time updates
  const { data: assessmentStatusRaw, isLoading: statusLoading, error: statusError } = useQuery({
    queryKey: ['/api/assessment/systems', systemId, 'status'],
    refetchInterval: (data) => {
      return (data as any)?.status === 'running' ? 2000 : 30000;
    },
    enabled: !!systemId,
    retry: 1,
  }) as { data: SystemAssessmentSnapshot | undefined, isLoading: boolean, error: any };

  const assessmentStatus = assessmentStatusRaw ?? { ...defaultSnapshot, systemId };

  // Fetch assessment summary for metrics
  const { data: assessmentSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['/api/assessment/systems', systemId, 'summary'],
    enabled: !!systemId,
    retry: 1,
  }) as { data: { system: any; assessment: any; metrics: any; trends: any } | undefined, isLoading: boolean };

  // Generate dynamic phases based on real assessment progress
  const generateDynamicPhases = (status?: SystemAssessmentSnapshot): AssessmentPhase[] => {
    const basePhases: Omit<AssessmentPhase, 'status' | 'progress'>[] = [
      {
        id: 'initiation',
        name: 'Assessment Initiation',
        description: 'Initialize assessment and prepare resources',
        estimatedDuration: '1 day',
        deliverables: ['Assessment Configuration', 'Resource Allocation']
      },
      {
        id: 'discovery',
        name: 'System Discovery',
        description: 'Discover system components and configurations',
        estimatedDuration: '2-3 days', 
        deliverables: ['System Inventory', 'Component Map', 'Architecture Review']
      },
      {
        id: 'control_assessment',
        name: 'Control Assessment',
        description: 'Evaluate implementation of security controls',
        estimatedDuration: '1-2 weeks',
        deliverables: ['Control Evaluation', 'Implementation Review', 'Evidence Collection']
      },
      {
        id: 'vulnerability_scanning',
        name: 'Vulnerability Assessment', 
        description: 'Scan for security vulnerabilities and weaknesses',
        estimatedDuration: '3-5 days',
        deliverables: ['Scan Results', 'Vulnerability Report', 'Risk Analysis']
      },
      {
        id: 'analysis',
        name: 'Results Analysis',
        description: 'Analyze findings and determine compliance status',
        estimatedDuration: '1 week',
        deliverables: ['Findings Analysis', 'Risk Assessment', 'Compliance Matrix']
      },
      {
        id: 'reporting',
        name: 'Report Generation',
        description: 'Generate assessment reports and documentation',
        estimatedDuration: '3-5 days',
        deliverables: ['Security Assessment Report', 'POA&M', 'Executive Summary']
      }
    ];

    if (!status) {
      // No assessment data - all phases pending
      return basePhases.map(phase => ({
        ...phase,
        status: 'pending' as const,
        progress: 0
      }));
    }

    const currentProgress = status.progress || 0;
    const assessmentStatus = status.status;
    
    return basePhases.map((phase, index) => {
      const phaseStartProgress = (index / basePhases.length) * 100;
      const phaseEndProgress = ((index + 1) / basePhases.length) * 100;

      let phaseStatus: 'completed' | 'in_progress' | 'pending' | 'blocked';
      let phaseProgress: number;

      if (assessmentStatus === 'failed') {
        // Mark phases as blocked if assessment failed
        phaseStatus = currentProgress > phaseEndProgress ? 'completed' : 
                     currentProgress >= phaseStartProgress ? 'blocked' : 'pending';
        phaseProgress = currentProgress > phaseEndProgress ? 100 : 
                       currentProgress >= phaseStartProgress ? currentProgress - phaseStartProgress : 0;
      } else if (currentProgress >= phaseEndProgress) {
        phaseStatus = 'completed';
        phaseProgress = 100;
      } else if (currentProgress >= phaseStartProgress) {
        phaseStatus = 'in_progress';
        phaseProgress = ((currentProgress - phaseStartProgress) / (phaseEndProgress - phaseStartProgress)) * 100;
      } else {
        phaseStatus = 'pending';
        phaseProgress = 0;
      }

      return {
        ...phase,
        status: phaseStatus,
        progress: Math.round(phaseProgress),
        startDate: status.startTime && currentProgress >= phaseStartProgress ? status.startTime : undefined,
        endDate: status.endTime && phaseStatus === 'completed' ? status.endTime : undefined
      };
  }).filter((phase): phase is AssessmentPhase => Boolean(phase && phase.name && Array.isArray(phase.deliverables)));
  };

  const phases = generateDynamicPhases(assessmentStatus);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <PlayCircle className="h-5 w-5 text-blue-600" />;
      case 'blocked':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'blocked': return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'completed' ? 'default' : 
                   status === 'in_progress' ? 'secondary' : 
                   status === 'blocked' ? 'destructive' : 'outline';
    return (
      <Badge variant={variant} className="ml-2">
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  // Show loading state while fetching data
  if (statusLoading && summaryLoading) {
    return <Skeleton className="h-64" />;
  }

  // Show error state if there's a problem fetching status
  if (statusError && !assessmentStatus) {
    return (
      <div className="space-y-6" data-testid="assessment-lifecycle-tracker">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Unable to load assessment status. This system may not have an active assessment.
            {statusError?.message && ` Error: ${statusError.message}`}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const snapshot = assessmentStatus;
  const metrics = assessmentSummary?.metrics ?? {
    totalControls: snapshot.summary.totalControls,
    compliantControls: snapshot.summary.compliantControls,
    nonCompliantControls: snapshot.summary.nonCompliantControls,
    totalFindings: snapshot.findings.totalFindings,
    openFindings: snapshot.findings.totalFindings - snapshot.findings.resolvedFindings,
    criticalFindings: snapshot.findings.criticalFindings,
    highFindings: snapshot.findings.highFindings,
    stigCompliance: snapshot.stigCompliance.stigCompliancePercentage,
  };
  
  // Determine current step text
  let currentStepText = 'No assessment running';
  if (snapshot) {
    if (snapshot.status === 'running') {
      currentStepText = snapshot.currentStep || 'Processing...';
    } else if (snapshot.status === 'completed') {
      currentStepText = 'Assessment completed';
    } else if (snapshot.status === 'failed') {
      currentStepText = 'Assessment failed';
    }
  }

  return (
    <div className="space-y-6" data-testid="assessment-lifecycle-tracker">
      {/* Overall Progress Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Assessment Lifecycle Progress
                {assessmentSummary && (
                  <Badge variant="outline" className="ml-2">
                    {assessmentSummary.system.name}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {currentStepText} 
                {assessmentSummary && (
                  <span className="ml-2">• {assessmentSummary.system.impactLevel} Impact System</span>
                )}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold" data-testid="text-overall-progress">
                {snapshot.progress}%
              </div>
              <p className="text-sm text-muted-foreground">Overall Progress</p>
              {snapshot.status === 'running' && (
                <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                  Live Updates
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={snapshot.progress} className="h-3" data-testid="progress-overall" />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>Initiation</span>
            <span>Assessment</span>
            <span>Reporting</span>
          </div>
          {snapshot.errors && snapshot.errors.length > 0 && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Assessment errors: {snapshot.errors.join(', ')}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Assessment Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Assessment Overview</CardTitle>
          <CardDescription>
            {snapshot.status === 'not_started' ? 'No assessments have been run yet.' : `Current status: ${snapshot.status}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Overall Compliance"
              value={`${metrics.overallCompliance ?? snapshot.summary.overallCompliancePercentage}%`}
              description="Based on assessed controls"
              icon={Shield}
            />
            <StatCard
              title="Risk Score"
              value={metrics.riskScore ?? snapshot.summary.riskScore}
              description="Lower is better"
              icon={Target}
            />
            <StatCard
              title="Open Findings"
              value={metrics.openFindings ?? snapshot.findings.totalFindings - snapshot.findings.resolvedFindings}
              description={`${snapshot.findings.criticalFindings} critical, ${snapshot.findings.highFindings} high`}
              icon={AlertTriangle}
            />
            <StatCard
              title="STIG Compliance"
              value={`${metrics.stigCompliance ?? snapshot.stigCompliance.stigCompliancePercentage}%`}
              description="STIG/JSIG coverage"
              icon={BarChart3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Assessment Metrics */}
      {assessmentSummary && (
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{assessmentSummary.metrics.totalControls}</div>
              <p className="text-xs text-muted-foreground">Total Controls</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{assessmentSummary.metrics.compliantControls}</div>
              <p className="text-xs text-muted-foreground">Compliant</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{assessmentSummary.metrics.criticalFindings}</div>
              <p className="text-xs text-muted-foreground">Critical Findings</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{Math.round(assessmentSummary.metrics.stigCompliance)}%</div>
              <p className="text-xs text-muted-foreground">STIG Compliance</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Phase Timeline */}
      <div className="space-y-4">
        {phases.map((phase, index) => (
          <Card 
            key={phase.id} 
            className={`relative hover-elevate cursor-pointer transition-all ${
              selectedPhase === phase.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedPhase(selectedPhase === phase.id ? null : phase.id)}
            data-testid={`card-phase-${phase.id}`}
          >
            {/* Timeline Connector */}
            {index < phases.length - 1 && (
              <div className="absolute left-8 top-16 w-0.5 h-8 bg-gray-200 dark:bg-gray-700" />
            )}
            
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                {/* Phase Icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getStatusColor(phase.status)}`}>
                  {getStatusIcon(phase.status)}
                </div>

                {/* Phase Content */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg" data-testid={`text-phase-name-${phase.id}`}>
                        {phase.name}
                      </h3>
                      {getStatusBadge(phase.status)}
                    </div>
                    <div className="text-right">
                      <div className="font-medium" data-testid={`text-phase-progress-${phase.id}`}>
                        {phase.progress}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {phase.estimatedDuration}
                      </div>
                    </div>
                  </div>

                  <p className="text-muted-foreground">{phase.description}</p>

                  {phase.status === 'in_progress' && (
                    <Progress value={phase.progress} className="h-2" />
                  )}

                  {/* Expanded Details */}
                  {selectedPhase === phase.id && (
                    <div className="mt-4 p-4 bg-muted/30 rounded-lg space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Deliverables */}
                        <div>
                          <h4 className="font-medium flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4" />
                            Key Deliverables
                          </h4>
                          <ul className="space-y-1 text-sm">
                            {phase.deliverables.map((deliverable, idx) => (
                              <li key={idx} className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {deliverable}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Timeline */}
                        <div>
                          <h4 className="font-medium flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4" />
                            Timeline
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div>Duration: {phase.estimatedDuration}</div>
                            {phase.startDate && (
                              <div>Started: {new Date(phase.startDate).toLocaleDateString()}</div>
                            )}
                            {phase.endDate && (
                              <div>Completed: {new Date(phase.endDate).toLocaleDateString()}</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        {phase.status === 'pending' && (
                          <Button size="sm" data-testid={`button-start-phase-${phase.id}`}>
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Start Phase
                          </Button>
                        )}
                        
                        {phase.status === 'in_progress' && (
                          <>
                            <Button size="sm" variant="outline" data-testid={`button-pause-phase-${phase.id}`}>
                              <PauseCircle className="h-4 w-4 mr-2" />
                              Pause
                            </Button>
                            <Button size="sm" data-testid={`button-update-phase-${phase.id}`}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Update Progress
                            </Button>
                          </>
                        )}
                        
                        {phase.status === 'completed' && (
                          <Button size="sm" variant="outline" data-testid={`button-view-deliverables-${phase.id}`}>
                            <FileText className="h-4 w-4 mr-2" />
                            View Deliverables
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Assessment Actions
          </CardTitle>
          <CardDescription>
            Common actions for managing the assessment lifecycle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <Button variant="outline" className="justify-start h-auto p-4" data-testid="button-view-schedule">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 mt-0.5" />
                <div className="text-left">
                  <div className="font-medium">View Schedule</div>
                  <div className="text-sm text-muted-foreground">Assessment timeline & milestones</div>
                </div>
              </div>
            </Button>
            
            <Button variant="outline" className="justify-start h-auto p-4" data-testid="button-assign-resources">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 mt-0.5" />
                <div className="text-left">
                  <div className="font-medium">Assign Resources</div>
                  <div className="text-sm text-muted-foreground">Team assignments & responsibilities</div>
                </div>
              </div>
            </Button>
            
            <Button variant="outline" className="justify-start h-auto p-4" data-testid="button-risk-register">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 mt-0.5" />
                <div className="text-left">
                  <div className="font-medium">Risk Register</div>
                  <div className="text-sm text-muted-foreground">Track assessment risks & issues</div>
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}