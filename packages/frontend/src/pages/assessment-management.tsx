import { useState, useCallback, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest, authenticatedFetch } from '@/lib/queryClient';
import { AssessmentLifecycleTracker } from '@/components/assessment-lifecycle-tracker';
import { EvidenceUploadManager } from '@/components/evidence-upload-manager';
import { NarrativeEditor } from '@/components/narrative-editor';
import { AssessmentInitiatorEnhanced } from '@/components/assessment-initiator-enhanced';
import { AssessmentReportGenerator } from '@/components/assessment-report-generator';
import { JobMonitor } from '@/components/job-monitor';
import { AssessmentResultsViewer } from '@/components/assessment-results-viewer';
import { 
  ArrowLeft,
  Shield, 
  Play, 
  Pause,
  CheckCircle, 
  Clock, 
  AlertTriangle,
  FileText,
  Upload,
  Edit,
  Save,
  RefreshCw,
  Download,
  Eye,
  Target,
  BarChart3,
  Settings,
  History,
  Users,
  Calendar,
  FileCheck,
  Building2,
  AlertCircle
} from 'lucide-react';
import type { System } from '@shared/schema';

// Types for assessment management
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

interface Evidence {
  id: string;
  systemId: string;
  controlId?: string;
  type: string;
  title: string;
  description: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: 'satisfies' | 'partially_satisfies' | 'does_not_satisfy' | 'not_applicable';
  createdAt: string;
}

interface SystemControl {
  id: string;
  systemId: string;
  controlId: string;
  status: 'not_implemented' | 'partial' | 'implemented' | 'not_applicable';
  implementationText?: string;
  assignedTo?: string;
  lastUpdated: string;
}

export default function AssessmentManagement() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const systemId = params.id as string;
  
  // Component state
  const [activeTab, setActiveTab] = useState('overview');
  const [isStartAssessmentOpen, setIsStartAssessmentOpen] = useState(false);
  const [assessmentConfig, setAssessmentConfig] = useState({
    assessmentMode: 'automated',
    includeInformationalFindings: false,
    generatePoamItems: true,
    generateEvidence: true,
    updateControlStatus: true,
    riskTolerance: 'medium'
  });

  // Data queries
  const { data: system, isLoading: systemLoading } = useQuery({
    queryKey: ['/api/systems', systemId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/systems/${systemId}`);
      if (!response.ok) throw new Error('Failed to fetch system');
      return response.json() as Promise<System>;
    },
    enabled: !!systemId
  });

  const { data: assessmentSummary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['/api/assessment/systems', systemId, 'summary'],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/assessment/systems/${systemId}/summary`);
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No assessments yet
        }
        throw new Error('Failed to fetch assessment summary');
      }
      return response.json() as Promise<AssessmentSummary>;
    },
    enabled: !!systemId
  });

  const { data: assessmentStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/assessment/systems', systemId, 'status'],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/assessment/systems/${systemId}/status`);
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No assessments yet
        }
        throw new Error('Failed to fetch assessment status');
      }
      return response.json() as Promise<AssessmentStatus>;
    },
    enabled: !!systemId
  });

  // Use useEffect to handle dynamic refetch interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (assessmentStatus?.status === 'running') {
      interval = setInterval(() => {
        refetchStatus();
        refetchSummary();
      }, 3000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [assessmentStatus?.status, refetchStatus, refetchSummary]);

  const { data: systemControls = [], refetch: refetchControls } = useQuery({
    queryKey: ['/api/systems', systemId, 'controls'],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/systems/${systemId}/controls`);
      if (!response.ok) throw new Error('Failed to fetch system controls');
      return response.json() as Promise<SystemControl[]>;
    },
    enabled: !!systemId
  });

  const { data: evidence = [], refetch: refetchEvidence } = useQuery({
    queryKey: ['/api/evidence/system', systemId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/evidence?systemId=${systemId}`);
      if (!response.ok) throw new Error('Failed to fetch evidence');
      return response.json() as Promise<Evidence[]>;
    },
    enabled: !!systemId
  });

  // Start assessment mutation
  const startAssessment = useMutation({
    mutationFn: async (config: any) => {
      const response = await authenticatedFetch(`/api/assessment/systems/${systemId}/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start assessment');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Assessment Started',
        description: 'The system assessment has been initiated successfully.'
      });
      setIsStartAssessmentOpen(false);
      refetchStatus();
      refetchSummary();
    },
    onError: (error: any) => {
      toast({
        title: 'Assessment Failed',
        description: error.message || 'Failed to start assessment',
        variant: 'destructive'
      });
    }
  });

  const handleBackToSystems = () => {
    navigate('/systems');
  };

  const handleStartAssessment = () => {
    startAssessment.mutate(assessmentConfig);
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'running': return 'text-blue-600';
      case 'failed': return 'text-red-600';
      case 'pending': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    const variant = status === 'completed' ? 'default' : 
                   status === 'running' ? 'secondary' : 
                   status === 'failed' ? 'destructive' : 'outline';
    return <Badge variant={variant}>{status || 'Not Started'}</Badge>;
  };

  // Loading state
  if (systemLoading || summaryLoading) {
    return (
      <div className="space-y-6" data-testid="assessment-management-loading">
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-2" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-2" />
          <Skeleton className="h-6 w-40" />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-96" />
            <Skeleton className="h-4 w-128" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-3 w-24 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!system) {
    return (
      <div className="flex items-center justify-center min-h-96" data-testid="system-not-found">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-yellow-600 mx-auto" />
          <h2 className="text-xl font-semibold">System Not Found</h2>
          <p className="text-muted-foreground">The requested system could not be found.</p>
          <Button onClick={handleBackToSystems} data-testid="button-back-to-systems">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Systems
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="assessment-management-page">
      {/* Breadcrumb Navigation */}
      <Breadcrumb data-testid="breadcrumb-navigation">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={handleBackToSystems} className="cursor-pointer">
              Systems
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate(`/systems/${systemId}`)} className="cursor-pointer">
              {system.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbPage>Assessment Management</BreadcrumbPage>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">
                Assessment Management
              </h1>
              <p className="text-xl text-muted-foreground">{system.name}</p>
            </div>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Comprehensive assessment lifecycle management for NIST 800-53 compliance evaluation, evidence collection, and control implementation verification.
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/systems/${systemId}`)}
            data-testid="button-system-details"
          >
            <Building2 className="h-4 w-4 mr-2" />
            System Details
          </Button>
          
          <Button
            onClick={() => setIsStartAssessmentOpen(true)}
            disabled={assessmentStatus?.status === 'running' || startAssessment.isPending}
            data-testid="button-start-assessment"
          >
            <Play className="h-4 w-4 mr-2" />
            {assessmentStatus?.status === 'running' ? 'Assessment Running' : 'Start New Assessment'}
          </Button>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Category</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold" data-testid="text-system-category">
              {system.category}
            </div>
            <Badge variant="outline" className="mt-1">
              {system.impactLevel} Impact
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assessment Status</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {getStatusBadge(assessmentStatus?.status)}
              {assessmentStatus?.status === 'running' && (
                <Progress value={assessmentStatus.progress} className="h-2" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-compliance-rate">
              {assessmentSummary?.assessment.overallCompliance?.toFixed(1) || '0.0'}%
            </div>
            <p className="text-xs text-muted-foreground">
              Overall compliance score
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evidence Items</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-evidence-count">
              {evidence.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Total evidence files
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Findings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-open-findings">
              {assessmentSummary?.metrics.openFindings || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Running Assessment Alert */}
      {assessmentStatus?.status === 'running' && (
        <Alert data-testid="alert-assessment-running">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Assessment is currently running... Progress: {assessmentStatus.progress}%
            {assessmentStatus.currentStep && ` - ${assessmentStatus.currentStep}`}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="execution" data-testid="tab-execution">
            <Play className="h-4 w-4 mr-2" />
            Execution
          </TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">
            <Clock className="h-4 w-4 mr-2" />
            Jobs
          </TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-results">
            <Target className="h-4 w-4 mr-2" />
            Results
          </TabsTrigger>
          <TabsTrigger value="evidence" data-testid="tab-evidence">
            <Upload className="h-4 w-4 mr-2" />
            Evidence
          </TabsTrigger>
          <TabsTrigger value="narratives" data-testid="tab-narratives">
            <Edit className="h-4 w-4 mr-2" />
            Narratives
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">
            <FileText className="h-4 w-4 mr-2" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Assessment Status Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Assessment Status
                </CardTitle>
                <CardDescription>
                  Current assessment progress and key metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {assessmentSummary ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Total Controls</p>
                        <p className="text-2xl font-bold">{assessmentSummary.metrics.totalControls}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Compliant</p>
                        <p className="text-2xl font-bold text-green-600">{assessmentSummary.metrics.compliantControls}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Risk Score</p>
                        <p className="text-2xl font-bold">{assessmentSummary.assessment.riskScore}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">STIG Compliance</p>
                        <p className="text-2xl font-bold">{assessmentSummary.metrics.stigCompliance}%</p>
                      </div>
                    </div>
                    
                    {assessmentSummary.assessment.lastRun && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                          Last assessment: {new Date(assessmentSummary.assessment.lastRun).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>No assessments have been run yet.</p>
                    <Button className="mt-4" onClick={() => setIsStartAssessmentOpen(true)}>
                      Start Your First Assessment
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Common assessment management tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => setActiveTab('evidence')}
                  variant="outline"
                  className="w-full justify-start"
                  data-testid="button-manage-evidence"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Evidence
                </Button>
                
                <Button
                  onClick={() => setActiveTab('narratives')}
                  variant="outline"
                  className="w-full justify-start"
                  data-testid="button-edit-narratives"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Implementation Narratives
                </Button>
                
                <Button
                  onClick={() => setActiveTab('reports')}
                  variant="outline"
                  className="w-full justify-start"
                  data-testid="button-generate-reports"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Assessment Reports
                </Button>
                
                <Button
                  onClick={() => setActiveTab('execution')}
                  variant="outline"
                  className="w-full justify-start"
                  data-testid="button-view-assessments"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Assessment Results
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Latest assessment activities and changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {assessmentSummary ? (
                  <>
                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div className="flex-1">
                        <p className="font-medium">Assessment completed</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(assessmentSummary.assessment.lastRun).toLocaleDateString()} - Overall compliance: {assessmentSummary.assessment.overallCompliance}%
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <FileCheck className="h-5 w-5 text-blue-600" />
                      <div className="flex-1">
                        <p className="font-medium">Evidence uploaded</p>
                        <p className="text-sm text-muted-foreground">
                          {evidence.length} evidence files available for control verification
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No recent activity. Start an assessment to begin tracking activities.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assessment Execution Tab */}
        <TabsContent value="execution" className="space-y-6">
          <AssessmentLifecycleTracker 
            systemId={systemId} 
            currentPhase={assessmentStatus?.currentStep}
            assessmentId={assessmentStatus?.assessmentId}
          />
          
          <AssessmentInitiatorEnhanced 
            systemId={systemId}
            onAssessmentStarted={(assessmentId) => {
              refetchStatus();
              refetchSummary();
            }}
          />
        </TabsContent>

        {/* Job Monitor Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <JobMonitor systemId={systemId} />
        </TabsContent>

        {/* Assessment Results Tab */}
        <TabsContent value="results" className="space-y-6">
          <AssessmentResultsViewer systemId={systemId} />
        </TabsContent>

        {/* Evidence Management Tab */}
        <TabsContent value="evidence" className="space-y-6">
          <EvidenceUploadManager systemId={systemId} />
        </TabsContent>

        {/* Implementation Narratives Tab */}
        <TabsContent value="narratives" className="space-y-6">
          <NarrativeEditor systemId={systemId} />
        </TabsContent>

        {/* Assessment Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <AssessmentReportGenerator 
            systemId={systemId}
            assessmentId={assessmentStatus?.assessmentId}
          />
        </TabsContent>

        {/* Assessment History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assessment History</CardTitle>
              <CardDescription>
                Previous assessments and historical compliance data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-2" />
                <p>Assessment history tracking coming soon.</p>
                <p className="text-sm">This will include historical assessment tracking and trends analysis.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Start Assessment Dialog */}
      <Dialog open={isStartAssessmentOpen} onOpenChange={setIsStartAssessmentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start New Assessment</DialogTitle>
            <DialogDescription>
              Configure and initiate a comprehensive system assessment for {system.name}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="assessmentMode">Assessment Mode</Label>
                <Select 
                  value={assessmentConfig.assessmentMode}
                  onValueChange={(value) => setAssessmentConfig(prev => ({ ...prev, assessmentMode: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automated">Automated</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="riskTolerance">Risk Tolerance</Label>
                <Select 
                  value={assessmentConfig.riskTolerance}
                  onValueChange={(value) => setAssessmentConfig(prev => ({ ...prev, riskTolerance: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="generatePoamItems"
                  checked={assessmentConfig.generatePoamItems}
                  onChange={(e) => setAssessmentConfig(prev => ({ ...prev, generatePoamItems: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="generatePoamItems">Generate POA&M items</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="generateEvidence"
                  checked={assessmentConfig.generateEvidence}
                  onChange={(e) => setAssessmentConfig(prev => ({ ...prev, generateEvidence: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="generateEvidence">Generate evidence artifacts</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="updateControlStatus"
                  checked={assessmentConfig.updateControlStatus}
                  onChange={(e) => setAssessmentConfig(prev => ({ ...prev, updateControlStatus: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="updateControlStatus">Update control status</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="includeInformationalFindings"
                  checked={assessmentConfig.includeInformationalFindings}
                  onChange={(e) => setAssessmentConfig(prev => ({ ...prev, includeInformationalFindings: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="includeInformationalFindings">Include informational findings</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsStartAssessmentOpen(false)}
              data-testid="button-cancel-assessment"
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartAssessment}
              disabled={startAssessment.isPending}
              data-testid="button-confirm-start-assessment"
            >
              {startAssessment.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Assessment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}