import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
// Remove stepper import as it's not needed for the implementation
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest, authenticatedFetch } from '@/lib/queryClient';
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  FileText, 
  Download, 
  Play,
  ArrowRight,
  ArrowLeft,
  Shield,
  Target,
  Settings,
  Package,
  CheckSquare,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Zap
} from 'lucide-react';

interface System {
  id: string;
  name: string;
  description?: string;
  category: string;
  impactLevel: string;
  complianceStatus: string;
}

interface AssessmentSummary {
  assessment: {
    id: string;
    status: string;
    lastRun: string;
    overallCompliance: number;
  };
  metrics: {
    totalControls: number;
    compliantControls: number;
    openFindings: number;
  };
}

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  requirements: string[];
  validation?: () => Promise<boolean>;
}

interface GenerationJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  documentTypes: string[];
}

export function AtoGuidedWorkflow() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [workflowState, setWorkflowState] = useState<Record<string, any>>({});
  const [generationNotes, setGenerationNotes] = useState('');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Fetch available systems
  const { data: systemsResponse } = useQuery({
    queryKey: ['/api/systems'],
    enabled: true
  }) as { data: { systems: System[]; totalCount: number } | undefined };

  const systems = systemsResponse?.systems || [];

  // Fetch selected system assessment summary
  const { data: assessmentSummary, refetch: refetchAssessment } = useQuery({
    queryKey: ['/api/assessment/systems', selectedSystem, 'summary'],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/assessment/systems/${selectedSystem}/summary`);
      if (!response.ok) throw new Error('Assessment not found');
      return response.json() as Promise<AssessmentSummary>;
    },
    enabled: !!selectedSystem,
  });

  // Fetch system controls for narrative validation
  const { data: systemControls = [] } = useQuery({
    queryKey: ['/api/systems', selectedSystem, 'controls'],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/systems/${selectedSystem}/controls`);
      if (!response.ok) throw new Error('Failed to fetch system controls');
      return response.json();
    },
    enabled: !!selectedSystem,
  });

  // Monitor generation job progress
  const { data: jobStatus } = useQuery({
    queryKey: ['/api/generation/status', activeJobId],
    enabled: !!activeJobId,
    refetchInterval: activeJobId ? 2000 : false
  }) as { data: GenerationJob | undefined };

  // Start generation mutation
  const startGeneration = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/generation/start', data);
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to start generation');
      }
      return result;
    },
    onSuccess: (result) => {
      setActiveJobId(result.jobId);
      setCurrentStep(3); // Move to generation monitoring step
      toast({
        title: 'ATO Generation Started',
        description: 'Your ATO package generation is now in progress.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to start ATO package generation.',
        variant: 'destructive',
      });
    }
  });

  // Define workflow steps
  const workflowSteps: WorkflowStep[] = [
    {
      id: 'system-selection',
      title: 'System Selection',
      description: 'Select the system for ATO package generation',
      icon: Target,
      status: selectedSystem ? 'completed' : 'pending',
      requirements: [
        'Select a system from your registered IT systems',
        'Ensure system information is complete and accurate'
      ]
    },
    {
      id: 'assessment-review',
      title: 'Assessment Review',
      description: 'Verify system assessments are complete and current',
      icon: Shield,
      status: getAssessmentStepStatus(),
      requirements: [
        'Recent assessment completed (within 30 days)',
        'No critical findings blocking ATO approval',
        'Overall compliance ≥ 85%'
      ]
    },
    {
      id: 'narrative-review',
      title: 'Implementation Narratives',
      description: 'Ensure all required controls have implementation narratives',
      icon: FileText,
      status: getNarrativeStepStatus(),
      requirements: [
        'All implemented controls have detailed narratives',
        'Narratives describe specific implementation details',
        'Evidence references are included where applicable'
      ]
    },
    {
      id: 'package-generation',
      title: 'Package Generation',
      description: 'Generate and monitor ATO documentation package',
      icon: Package,
      status: getGenerationStepStatus(),
      requirements: [
        'Document types selected and configured',
        'Generation parameters validated',
        'Sufficient system resources available'
      ]
    },
    {
      id: 'final-review',
      title: 'Final Review & Download',
      description: 'Review generated documents and download complete package',
      icon: Download,
      status: getFinalStepStatus(),
      requirements: [
        'All documents generated successfully',
        'Package integrity verified',
        'Ready for submission to authorizing official'
      ]
    }
  ];

  function getAssessmentStepStatus(): WorkflowStep['status'] {
    if (!selectedSystem || !assessmentSummary) return 'pending';
    
    const isRecent = new Date(assessmentSummary.assessment.lastRun) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const hasGoodCompliance = assessmentSummary.assessment.overallCompliance >= 85;
    const hasLowFindings = assessmentSummary.metrics.openFindings < 5;
    
    if (isRecent && hasGoodCompliance && hasLowFindings) return 'completed';
    if (!isRecent || assessmentSummary.assessment.overallCompliance < 50) return 'error';
    return 'in_progress';
  }

  function getNarrativeStepStatus(): WorkflowStep['status'] {
    if (!selectedSystem || systemControls.length === 0) return 'pending';
    
    const implementedControls = systemControls.filter((sc: any) => sc.status === 'implemented');
    const controlsWithNarratives = implementedControls.filter((sc: any) => 
      sc.implementationText && sc.implementationText.trim().length > 50
    );
    
    const narrativeCompletion = implementedControls.length > 0 ? 
      (controlsWithNarratives.length / implementedControls.length) * 100 : 0;
    
    if (narrativeCompletion >= 90) return 'completed';
    if (narrativeCompletion >= 60) return 'in_progress';
    return 'pending';
  }

  function getGenerationStepStatus(): WorkflowStep['status'] {
    if (!activeJobId || !jobStatus) return 'pending';
    
    switch (jobStatus.status) {
      case 'completed':
        return 'completed';
      case 'failed':
        return 'error';
      case 'running':
        return 'in_progress';
      default:
        return 'pending';
    }
  }

  function getFinalStepStatus(): WorkflowStep['status'] {
    if (jobStatus?.status === 'completed') return 'completed';
    return 'pending';
  }

  const canProceedToStep = (stepIndex: number): boolean => {
    if (stepIndex === 0) return true;
    
    const previousSteps = workflowSteps.slice(0, stepIndex);
    return previousSteps.every(step => step.status === 'completed');
  };

  const handleStartGeneration = () => {
    if (!selectedSystem || selectedDocuments.length === 0) {
      toast({
        title: 'Missing Requirements',
        description: 'Please complete all previous steps before generating the ATO package.',
        variant: 'destructive',
      });
      return;
    }

    const generationRequest = {
      systemId: selectedSystem,
      documentTypes: selectedDocuments,
      templateOptions: {
        classification: 'UNCLASSIFIED',
        notes: generationNotes.trim() || undefined,
        includeAssessmentResults: true,
        includeImplementationNarratives: true,
        generateExecutiveSummary: true
      }
    };

    startGeneration.mutate(generationRequest);
  };

  const [assessmentStatus, setAssessmentStatus] = useState<{
    running: boolean;
    progress: number;
    status: string;
    error?: string;
  }>({ running: false, progress: 0, status: 'idle' });

  const pollAssessmentStatus = useCallback(async (systemId: string): Promise<void> => {
    try {
      const response = await authenticatedFetch(`/api/assessment/systems/${systemId}/status`);
      
      if (response.status === 404) {
        // No assessment found, stop polling
        setAssessmentStatus({ running: false, progress: 0, status: 'idle' });
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch assessment status');
      }
      
      const status = await response.json();
      
      setAssessmentStatus({
        running: status.status === 'running',
        progress: status.progress || 0,
        status: status.status,
        error: status.errors?.length > 0 ? status.errors.join(', ') : undefined
      });
      
      // Continue polling if still running
      if (status.status === 'running') {
        setTimeout(() => pollAssessmentStatus(systemId), 3000);
      } else if (status.status === 'completed') {
        // Assessment completed, refetch summary data
        refetchAssessment();
        toast({
          title: 'Assessment Completed',
          description: 'System assessment has finished successfully.',
        });
      } else if (status.status === 'failed') {
        toast({
          title: 'Assessment Failed',
          description: status.errors?.join(', ') || 'Assessment failed with unknown error.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error polling assessment status:', error);
      setAssessmentStatus(prev => ({ 
        ...prev, 
        running: false, 
        error: 'Failed to check assessment status' 
      }));
    }
  }, [refetchAssessment, toast]);

  const handleRunAssessment = async () => {
    if (!selectedSystem) {
      toast({
        title: 'No System Selected',
        description: 'Please select a system before running an assessment.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setAssessmentStatus({ running: true, progress: 0, status: 'starting' });
      
      const response = await apiRequest('POST', `/api/assessment/systems/${selectedSystem}/assess`, {
        assessmentMode: 'automated',
        includeInformationalFindings: false,
        generatePoamItems: true,
        updateControlStatus: true
      });

      if (response.ok) {
        toast({
          title: 'Assessment Started',
          description: 'System assessment is now running. This may take several minutes.',
        });
        
        // Start polling for status updates
        setTimeout(() => pollAssessmentStatus(selectedSystem), 2000);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to start assessment');
      }
    } catch (error) {
      setAssessmentStatus({ running: false, progress: 0, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
      toast({
        title: 'Assessment Failed',
        description: error instanceof Error ? error.message : 'Failed to start system assessment.',
        variant: 'destructive',
      });
    }
  };

  const getStepStatusIcon = (status: WorkflowStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />;
    }
  };

  const renderStepContent = () => {
    const step = workflowSteps[currentStep];
    
    switch (step.id) {
      case 'system-selection':
        return (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Select System *</label>
              <Select value={selectedSystem} onValueChange={setSelectedSystem}>
                <SelectTrigger data-testid="select-workflow-system">
                  <SelectValue placeholder="Choose a system for ATO package generation" />
                </SelectTrigger>
                <SelectContent>
                  {systems.map((system) => (
                    <SelectItem key={system.id} value={system.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{system.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {system.category} • {system.impactLevel} Impact
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSystem && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  System selected successfully. You can now proceed to the next step.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 'assessment-review':
        return (
          <div className="space-y-6">
            {assessmentSummary ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {assessmentSummary.assessment.overallCompliance}%
                        </div>
                        <div className="text-sm text-muted-foreground">Overall Compliance</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {assessmentSummary.metrics.compliantControls}
                        </div>
                        <div className="text-sm text-muted-foreground">Controls Implemented</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {assessmentSummary.metrics.openFindings}
                        </div>
                        <div className="text-sm text-muted-foreground">Open Findings</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {getAssessmentStepStatus() === 'error' && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Assessment does not meet ATO requirements. Please run a new assessment or address critical findings.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleRunAssessment} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Run New Assessment
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => window.open(`/systems/${selectedSystem}#assessment`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Assessment Details
                  </Button>
                </div>
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No assessment found for this system. Please run an assessment before proceeding.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 'narrative-review':
        const implementedControls = systemControls.filter((sc: any) => sc.status === 'implemented');
        const controlsWithNarratives = implementedControls.filter((sc: any) => 
          sc.implementationText && sc.implementationText.trim().length > 50
        );
        const narrativeCompletion = implementedControls.length > 0 ? 
          (controlsWithNarratives.length / implementedControls.length) * 100 : 0;

        return (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {controlsWithNarratives.length}/{implementedControls.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Controls with Narratives</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round(narrativeCompletion)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Narrative Completion</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Progress value={narrativeCompletion} className="w-full" />

            {narrativeCompletion < 90 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {90 - Math.round(narrativeCompletion)}% more narratives needed for optimal ATO package quality.
                </AlertDescription>
              </Alert>
            )}

            <Button 
              variant="outline"
              onClick={() => window.open(`/systems/${selectedSystem}#controls`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Edit Implementation Narratives
            </Button>
          </div>
        );

      case 'package-generation':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Document Types</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { type: 'ssp', name: 'System Security Plan (SSP)', description: 'Comprehensive system security documentation and control implementation details' },
                    { type: 'complete_ato_package', name: 'Complete ATO Package', description: 'All required documents for ATO submission' },
                    { type: 'sar_package', name: 'Security Assessment Report', description: 'Comprehensive security assessment documentation' },
                    { type: 'stig_checklist', name: 'STIG Checklists', description: 'Security Technical Implementation Guide compliance' },
                    { type: 'poam_report', name: 'POA&M Report', description: 'Plan of Action & Milestones for findings' },
                    { type: 'sctm_excel', name: 'Security Control Traceability Matrix', description: 'Excel-based control traceability matrix with STIG mappings' },
                    { type: 'rar', name: 'Risk Assessment Report', description: 'Comprehensive risk assessment documentation' },
                    { type: 'pps_worksheet', name: 'Privacy Impact Assessment Worksheet', description: 'Excel-based privacy impact assessment worksheet' }
                  ].map((template) => (
                    <div key={template.type} className="flex items-start space-x-3 p-3 border rounded-lg">
                      <Checkbox
                        id={template.type}
                        checked={selectedDocuments.includes(template.type)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDocuments(prev => [...prev, template.type]);
                          } else {
                            setSelectedDocuments(prev => prev.filter(t => t !== template.type));
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <label htmlFor={template.type} className="text-sm font-medium cursor-pointer">
                          {template.name}
                        </label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {template.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Generation Notes</label>
                <Textarea
                  placeholder="Optional notes for document generation (e.g., specific requirements, context, or instructions)..."
                  value={generationNotes}
                  onChange={(e) => setGenerationNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {!activeJobId ? (
                <Button 
                  onClick={handleStartGeneration}
                  disabled={selectedDocuments.length === 0 || startGeneration.isPending}
                  className="w-full"
                  size="lg"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  {startGeneration.isPending ? 'Starting Generation...' : 'Generate ATO Package'}
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-lg font-medium">Generation in Progress</div>
                    <div className="text-sm text-muted-foreground">
                      {jobStatus?.currentStep || 'Preparing documents...'}
                    </div>
                  </div>
                  <Progress value={jobStatus?.progress || 0} className="w-full" />
                  <div className="text-center text-sm text-muted-foreground">
                    {Math.round(jobStatus?.progress || 0)}% complete
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'final-review':
        return (
          <div className="space-y-6">
            {jobStatus?.status === 'completed' ? (
              <div className="text-center space-y-4">
                <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
                <div>
                  <h3 className="text-lg font-semibold text-green-600">ATO Package Generated Successfully!</h3>
                  <p className="text-muted-foreground">
                    Your complete ATO documentation package is ready for download and submission.
                  </p>
                </div>
                
                <div className="flex gap-2 justify-center">
                  <Button size="lg">
                    <Download className="h-4 w-4 mr-2" />
                    Download Complete Package
                  </Button>
                  <Button variant="outline" size="lg">
                    <FileText className="h-4 w-4 mr-2" />
                    View Document List
                  </Button>
                </div>

                <Alert>
                  <CheckSquare className="h-4 w-4" />
                  <AlertDescription>
                    Package includes all required documents, STIG checklists, assessment reports, and implementation narratives.
                    Ready for submission to your Authorizing Official.
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Waiting for document generation to complete...
                </p>
              </div>
            )}
          </div>
        );

      default:
        return <div>Step content not found</div>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8" data-testid="ato-guided-workflow">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Package className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">ATO Package Generation Workflow</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Follow this guided workflow to generate a complete Authority to Operate (ATO) documentation package. 
          Each step ensures your package meets federal compliance requirements.
        </p>
      </div>

      {/* Progress Stepper */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              {workflowSteps.map((step, index) => (
                <div 
                  key={step.id} 
                  className="flex flex-col items-center space-y-2 flex-1"
                  data-testid={`workflow-step-${index}`}
                >
                  <Button
                    variant={index === currentStep ? "default" : "ghost"}
                    size="icon"
                    onClick={() => canProceedToStep(index) && setCurrentStep(index)}
                    disabled={!canProceedToStep(index)}
                    className="rounded-full"
                  >
                    {getStepStatusIcon(step.status)}
                  </Button>
                  <div className="text-center">
                    <div className="text-sm font-medium">{step.title}</div>
                    <div className="text-xs text-muted-foreground max-w-[120px]">
                      {step.description}
                    </div>
                  </div>
                  {index < workflowSteps.length - 1 && (
                    <div className="w-full h-px bg-border mt-4" />
                  )}
                </div>
              ))}
            </div>
            
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${((currentStep + 1) / workflowSteps.length) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {React.createElement(workflowSteps[currentStep].icon, { className: "h-5 w-5" })}
            Step {currentStep + 1}: {workflowSteps[currentStep].title}
          </CardTitle>
          <CardDescription>
            {workflowSteps[currentStep].description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Requirements Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {workflowSteps[currentStep].requirements.map((requirement, index) => (
              <div key={index} className="flex items-start gap-2">
                <CheckSquare className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <span className="text-sm">{requirement}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous Step
        </Button>
        
        <Button 
          onClick={() => setCurrentStep(Math.min(workflowSteps.length - 1, currentStep + 1))}
          disabled={currentStep === workflowSteps.length - 1 || !canProceedToStep(currentStep + 1)}
        >
          Next Step
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}