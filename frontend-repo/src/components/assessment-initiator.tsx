import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Play, 
  Pause,
  RefreshCw,
  Settings,
  Target,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileText,
  Shield,
  Users,
  Calendar,
  BarChart3,
  Zap,
  Eye,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface AssessmentConfig {
  assessmentMode: 'automated' | 'manual' | 'hybrid';
  includeInformationalFindings: boolean;
  generatePoamItems: boolean;
  generateEvidence: boolean;
  updateControlStatus: boolean;
  riskTolerance: 'low' | 'medium' | 'high';
  scope: {
    includeInfrastructure: boolean;
    includeApplications: boolean;
    includeNetworkComponents: boolean;
    includeDatabases: boolean;
    includeCloudServices: boolean;
  };
  testingMethods: {
    vulnerabilityScanning: boolean;
    penetrationTesting: boolean;
    configurationReview: boolean;
    documentReview: boolean;
    interviewAssessment: boolean;
    complianceScanning: boolean;
  };
  controlsFilter: {
    baseline: string[];
    families: string[];
    priorities: string[];
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

interface AssessmentInitiatorProps {
  systemId: string;
  onAssessmentStarted?: (assessmentId: string) => void;
}

const ASSESSMENT_TEMPLATES = [
  {
    id: 'comprehensive',
    name: 'Comprehensive Assessment',
    description: 'Full assessment including all testing methods and findings',
    config: {
      assessmentMode: 'hybrid' as const,
      includeInformationalFindings: true,
      generatePoamItems: true,
      generateEvidence: true,
      updateControlStatus: true,
      riskTolerance: 'medium' as const,
      scope: {
        includeInfrastructure: true,
        includeApplications: true,
        includeNetworkComponents: true,
        includeDatabases: true,
        includeCloudServices: true
      },
      testingMethods: {
        vulnerabilityScanning: true,
        penetrationTesting: true,
        configurationReview: true,
        documentReview: true,
        interviewAssessment: true,
        complianceScanning: true
      }
    }
  },
  {
    id: 'rapid',
    name: 'Rapid Assessment',
    description: 'Quick automated assessment focusing on critical controls',
    config: {
      assessmentMode: 'automated' as const,
      includeInformationalFindings: false,
      generatePoamItems: true,
      generateEvidence: false,
      updateControlStatus: true,
      riskTolerance: 'high' as const,
      scope: {
        includeInfrastructure: true,
        includeApplications: true,
        includeNetworkComponents: false,
        includeDatabases: false,
        includeCloudServices: false
      },
      testingMethods: {
        vulnerabilityScanning: true,
        penetrationTesting: false,
        configurationReview: true,
        documentReview: false,
        interviewAssessment: false,
        complianceScanning: true
      }
    }
  },
  {
    id: 'compliance_focused',
    name: 'Compliance-Focused Assessment',
    description: 'Manual assessment emphasizing compliance documentation and processes',
    config: {
      assessmentMode: 'manual' as const,
      includeInformationalFindings: true,
      generatePoamItems: true,
      generateEvidence: true,
      updateControlStatus: true,
      riskTolerance: 'low' as const,
      scope: {
        includeInfrastructure: false,
        includeApplications: true,
        includeNetworkComponents: false,
        includeDatabases: true,
        includeCloudServices: true
      },
      testingMethods: {
        vulnerabilityScanning: false,
        penetrationTesting: false,
        configurationReview: true,
        documentReview: true,
        interviewAssessment: true,
        complianceScanning: true
      }
    }
  }
];

const CONTROL_FAMILIES = [
  'Access Control', 'Audit and Accountability', 'Awareness and Training',
  'Configuration Management', 'Contingency Planning', 'Identification and Authentication',
  'Incident Response', 'Maintenance', 'Media Protection', 'Physical Protection',
  'Risk Assessment', 'Security Assessment', 'System Communications Protection',
  'System Information Integrity'
];

export function AssessmentInitiator({ systemId, onAssessmentStarted }: AssessmentInitiatorProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [assessmentConfig, setAssessmentConfig] = useState<AssessmentConfig>({
    assessmentMode: 'automated',
    includeInformationalFindings: false,
    generatePoamItems: true,
    generateEvidence: true,
    updateControlStatus: true,
    riskTolerance: 'medium',
    scope: {
      includeInfrastructure: true,
      includeApplications: true,
      includeNetworkComponents: true,
      includeDatabases: true,
      includeCloudServices: true
    },
    testingMethods: {
      vulnerabilityScanning: true,
      penetrationTesting: false,
      configurationReview: true,
      documentReview: true,
      interviewAssessment: false,
      complianceScanning: true
    },
    controlsFilter: {
      baseline: ['Low', 'Moderate', 'High'],
      families: [],
      priorities: ['P1', 'P2']
    }
  });
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Fetch system info
  const { data: system } = useQuery({
    queryKey: ['/api/systems', systemId],
    enabled: !!systemId
  });

  // Fetch current assessment status
  const { data: currentAssessment, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/assessment/systems', systemId, 'status'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/assessment/systems/${systemId}/status`);
        return response.json() as Promise<AssessmentStatus>;
      } catch (error: any) {
        if (error.message?.includes('404')) return null;
        throw error;
      }
    },
    enabled: !!systemId,
    refetchInterval: 3000 // Poll every 3 seconds for real-time updates
  });

  // Start assessment mutation
  const startAssessment = useMutation({
    mutationFn: async (config: AssessmentConfig) => {
      const response = await apiRequest('POST', `/api/assessment/systems/${systemId}/assess`, config);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Assessment Started',
        description: `Assessment ${data.assessmentId} has been initiated successfully.`
      });
      setIsConfirmOpen(false);
      refetchStatus();
      onAssessmentStarted?.(data.assessmentId);
    },
    onError: (error: any) => {
      toast({
        title: 'Assessment Failed',
        description: error.message || 'Failed to start assessment',
        variant: 'destructive'
      });
    }
  });

  const applyTemplate = (templateId: string) => {
    const template = ASSESSMENT_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setAssessmentConfig(prev => ({
        ...prev,
        ...template.config,
        controlsFilter: prev.controlsFilter // Keep existing filter settings
      }));
      setSelectedTemplate(templateId);
    }
  };

  const handleStartAssessment = () => {
    setIsConfirmOpen(true);
  };

  const confirmStartAssessment = () => {
    startAssessment.mutate(assessmentConfig);
  };

  const getEstimatedDuration = () => {
    const baseTime = assessmentConfig.assessmentMode === 'automated' ? 30 : 
                    assessmentConfig.assessmentMode === 'manual' ? 180 : 90;
    
    const scopeMultiplier = Object.values(assessmentConfig.scope).filter(Boolean).length / 5;
    const methodsMultiplier = Object.values(assessmentConfig.testingMethods).filter(Boolean).length / 6;
    
    return Math.round(baseTime * scopeMultiplier * methodsMultiplier);
  };

  // Determine if assessment is running for UI state management
  const isRunning = currentAssessment?.status === 'running';

  return (
    <div className="space-y-6" data-testid="assessment-initiator">
      {/* Current Assessment Status */}
      {currentAssessment && (
        <Alert className={isRunning ? 'border-blue-500' : ''}>
          <Target className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">Assessment Status:</span> {' '}
                <Badge variant={currentAssessment.status === 'completed' ? 'default' : 
                               currentAssessment.status === 'running' ? 'secondary' : 
                               currentAssessment.status === 'failed' ? 'destructive' : 'outline'}>
                  {currentAssessment.status.toUpperCase()}
                </Badge>
                {isRunning && (
                  <>
                    {' '} - Progress: {currentAssessment.progress}%
                    {currentAssessment.currentStep && ` (${currentAssessment.currentStep})`}
                  </>
                )}
              </div>
              {isRunning && <RefreshCw className="h-4 w-4 animate-spin" />}
            </div>
            {isRunning && (
              <Progress value={currentAssessment.progress} className="mt-2" />
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Assessment Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Assessment Configuration
          </CardTitle>
          <CardDescription>
            Configure assessment parameters and testing methodology for {(system as any)?.name || 'the system'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="scope">Scope</TabsTrigger>
              <TabsTrigger value="methods">Methods</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            {/* Templates Tab */}
            <TabsContent value="templates" className="space-y-4">
              <div className="grid gap-4">
                {ASSESSMENT_TEMPLATES.map((template) => (
                  <Card 
                    key={template.id}
                    className={`cursor-pointer hover-elevate transition-all ${
                      selectedTemplate === template.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => applyTemplate(template.id)}
                    data-testid={`card-template-${template.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h3 className="font-semibold">{template.name}</h3>
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline">{template.config.assessmentMode}</Badge>
                            <Badge variant="outline">{template.config.riskTolerance} risk</Badge>
                          </div>
                        </div>
                        {selectedTemplate === template.id && (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Scope Tab */}
            <TabsContent value="scope" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-3">Assessment Scope</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(assessmentConfig.scope).map(([key, value]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Checkbox
                          id={key}
                          checked={value}
                          onCheckedChange={(checked) => 
                            setAssessmentConfig(prev => ({
                              ...prev,
                              scope: { ...prev.scope, [key]: !!checked }
                            }))
                          }
                        />
                        <Label htmlFor={key} className="text-sm">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="assessmentMode">Assessment Mode</Label>
                    <Select 
                      value={assessmentConfig.assessmentMode}
                      onValueChange={(value: any) => setAssessmentConfig(prev => ({ ...prev, assessmentMode: value }))}
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
                      onValueChange={(value: any) => setAssessmentConfig(prev => ({ ...prev, riskTolerance: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low - Comprehensive testing</SelectItem>
                        <SelectItem value="medium">Medium - Balanced approach</SelectItem>
                        <SelectItem value="high">High - Minimal disruption</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Methods Tab */}
            <TabsContent value="methods" className="space-y-4">
              <div>
                <h4 className="font-medium mb-3">Testing Methods</h4>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(assessmentConfig.testingMethods).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={value}
                        onCheckedChange={(checked) => 
                          setAssessmentConfig(prev => ({
                            ...prev,
                            testingMethods: { ...prev.testingMethods, [key]: !!checked }
                          }))
                        }
                      />
                      <Label htmlFor={key} className="text-sm">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">Assessment Options</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="generatePoamItems"
                      checked={assessmentConfig.generatePoamItems}
                      onCheckedChange={(checked) => 
                        setAssessmentConfig(prev => ({ ...prev, generatePoamItems: !!checked }))
                      }
                    />
                    <Label htmlFor="generatePoamItems">Generate POA&M items for findings</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="generateEvidence"
                      checked={assessmentConfig.generateEvidence}
                      onCheckedChange={(checked) => 
                        setAssessmentConfig(prev => ({ ...prev, generateEvidence: !!checked }))
                      }
                    />
                    <Label htmlFor="generateEvidence">Generate evidence artifacts</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="updateControlStatus"
                      checked={assessmentConfig.updateControlStatus}
                      onCheckedChange={(checked) => 
                        setAssessmentConfig(prev => ({ ...prev, updateControlStatus: !!checked }))
                      }
                    />
                    <Label htmlFor="updateControlStatus">Update control implementation status</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeInformationalFindings"
                      checked={assessmentConfig.includeInformationalFindings}
                      onCheckedChange={(checked) => 
                        setAssessmentConfig(prev => ({ ...prev, includeInformationalFindings: !!checked }))
                      }
                    />
                    <Label htmlFor="includeInformationalFindings">Include informational findings</Label>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="controlFamilies">Control Families Filter</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select control families to assess" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTROL_FAMILIES.map(family => (
                        <SelectItem key={family} value={family}>
                          {family}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="baseline">Control Baseline</Label>
                  <div className="flex gap-2 mt-2">
                    {['Low', 'Moderate', 'High'].map(baseline => (
                      <div key={baseline} className="flex items-center space-x-2">
                        <Checkbox
                          id={baseline}
                          checked={assessmentConfig.controlsFilter.baseline.includes(baseline)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setAssessmentConfig(prev => ({
                                ...prev,
                                controlsFilter: {
                                  ...prev.controlsFilter,
                                  baseline: [...prev.controlsFilter.baseline, baseline]
                                }
                              }));
                            } else {
                              setAssessmentConfig(prev => ({
                                ...prev,
                                controlsFilter: {
                                  ...prev.controlsFilter,
                                  baseline: prev.controlsFilter.baseline.filter(b => b !== baseline)
                                }
                              }));
                            }
                          }}
                        />
                        <Label htmlFor={baseline}>{baseline}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Assessment Summary and Start */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Assessment Summary
          </CardTitle>
          <CardDescription>
            Review configuration and start the assessment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium">Estimated Duration</div>
                <div className="text-sm text-muted-foreground">{getEstimatedDuration()} minutes</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Target className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="font-medium">Assessment Mode</div>
                <div className="text-sm text-muted-foreground capitalize">{assessmentConfig.assessmentMode}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="font-medium">Risk Tolerance</div>
                <div className="text-sm text-muted-foreground capitalize">{assessmentConfig.riskTolerance}</div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Assessment will evaluate {Object.values(assessmentConfig.scope).filter(Boolean).length} scope areas using {Object.values(assessmentConfig.testingMethods).filter(Boolean).length} testing methods.
            </div>

            <Button 
              onClick={handleStartAssessment}
              disabled={isRunning || startAssessment.isPending}
              size="lg"
              data-testid="button-start-assessment"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Assessment Running
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Assessment
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Assessment Start</DialogTitle>
            <DialogDescription>
              Are you ready to start the assessment for {(system as any)?.name || 'the system'}? This process cannot be undone once started.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <Zap className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div><strong>Duration:</strong> Approximately {getEstimatedDuration()} minutes</div>
                  <div><strong>Mode:</strong> {assessmentConfig.assessmentMode}</div>
                  <div><strong>Scope:</strong> {Object.values(assessmentConfig.scope).filter(Boolean).length} areas</div>
                  <div><strong>Methods:</strong> {Object.values(assessmentConfig.testingMethods).filter(Boolean).length} testing methods</div>
                </div>
              </AlertDescription>
            </Alert>

            {assessmentConfig.testingMethods.penetrationTesting && (
              <Alert className="border-amber-500">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> Penetration testing is enabled. This may impact system performance during the assessment.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmStartAssessment} 
              disabled={startAssessment.isPending}
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