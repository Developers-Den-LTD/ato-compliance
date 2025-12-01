import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Loader2, Shield, Clock, Settings2, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface AssessmentConfig {
  systemId: string;
  assessmentType: 'full' | 'partial' | 'continuous';
  scope: {
    includeInherited: boolean;
    controlFamilies?: string[];
    specificControls?: string[];
  };
  schedule?: {
    frequency: 'once' | 'daily' | 'weekly' | 'monthly';
    startDate: Date;
  };
  notificationSettings: {
    emailOnComplete: boolean;
    emailOnFailure: boolean;
    recipients: string[];
  };
  assessmentMode: 'automated' | 'manual' | 'hybrid';
  includeInformationalFindings: boolean;
  generatePoamItems: boolean;
  generateEvidence: boolean;
  updateControlStatus: boolean;
  riskTolerance: 'low' | 'medium' | 'high';
}

interface AssessmentInitiatorEnhancedProps {
  systemId: string;
  onAssessmentStarted: (assessmentId: string) => void;
}

const controlFamilies = [
  { id: 'AC', name: 'Access Control' },
  { id: 'AU', name: 'Audit and Accountability' },
  { id: 'CA', name: 'Assessment, Authorization, and Monitoring' },
  { id: 'CM', name: 'Configuration Management' },
  { id: 'CP', name: 'Contingency Planning' },
  { id: 'IA', name: 'Identification and Authentication' },
  { id: 'IR', name: 'Incident Response' },
  { id: 'MA', name: 'Maintenance' },
  { id: 'MP', name: 'Media Protection' },
  { id: 'PE', name: 'Physical and Environmental Protection' },
  { id: 'PL', name: 'Planning' },
  { id: 'PS', name: 'Personnel Security' },
  { id: 'RA', name: 'Risk Assessment' },
  { id: 'SA', name: 'System and Services Acquisition' },
  { id: 'SC', name: 'System and Communications Protection' },
  { id: 'SI', name: 'System and Information Integrity' }
];

export function AssessmentInitiatorEnhanced({ systemId, onAssessmentStarted }: AssessmentInitiatorEnhancedProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const [config, setConfig] = useState<AssessmentConfig>({
    systemId,
    assessmentType: 'full',
    scope: {
      includeInherited: true,
      controlFamilies: []
    },
    assessmentMode: 'automated',
    includeInformationalFindings: false,
    generatePoamItems: true,
    generateEvidence: true,
    updateControlStatus: true,
    riskTolerance: 'medium',
    notificationSettings: {
      emailOnComplete: true,
      emailOnFailure: true,
      recipients: []
    }
  });

  // Fetch system controls to show scope
  const { data: systemControls } = useQuery({
    queryKey: ['system-controls', systemId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/systems/${systemId}/controls`);
      return response.json();
    }
  });

  const validateConfiguration = (): boolean => {
    const errors: string[] = [];
    
    if (config.assessmentType === 'partial' && (!config.scope.controlFamilies || config.scope.controlFamilies.length === 0)) {
      errors.push('Partial assessment requires at least one control family to be selected');
    }
    
    if (config.schedule && config.schedule.startDate < new Date()) {
      errors.push('Scheduled start date cannot be in the past');
    }
    
    if (config.notificationSettings.emailOnComplete || config.notificationSettings.emailOnFailure) {
      if (config.notificationSettings.recipients.length === 0) {
        errors.push('Email notifications require at least one recipient');
      }
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleStartAssessment = async () => {
    if (!validateConfiguration()) {
      toast({
        title: 'Configuration Error',
        description: 'Please fix the validation errors before proceeding',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    
    try {
      const response = await apiRequest('POST', `/api/assessment/systems/${systemId}/assess`, config);
      const result = await response.json();
      
      // Create audit log entry
      await apiRequest('POST', '/api/audit/log', {
        action: 'assessment.configured',
        resourceType: 'assessment',
        resourceId: result.assessmentId,
        metadata: {
          systemId,
          configuration: config
        }
      });

      toast({
        title: 'Assessment Started',
        description: `Assessment ${result.assessmentId} has been initiated successfully.`,
      });

      onAssessmentStarted(result.assessmentId);
    } catch (error) {
      toast({
        title: 'Assessment Failed',
        description: error instanceof Error ? error.message : 'Failed to start assessment',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getControlCountByFamily = (familyId: string) => {
    if (!systemControls) return 0;
    return systemControls.filter((ctrl: any) => ctrl.control?.family === familyId).length;
  };

  const getTotalSelectedControls = () => {
    if (config.assessmentType === 'full') {
      return systemControls?.length || 0;
    }
    if (!config.scope.controlFamilies) return 0;
    
    return config.scope.controlFamilies.reduce((total, family) => {
      return total + getControlCountByFamily(family);
    }, 0);
  };

  return (
    <div className="space-y-6">
      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Assessment Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Assessment Type
          </CardTitle>
          <CardDescription>
            Choose the type and scope of the security assessment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup 
            value={config.assessmentType} 
            onValueChange={(value: any) => setConfig({...config, assessmentType: value})}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="full" id="full" />
              <Label htmlFor="full" className="flex flex-col cursor-pointer">
                <span className="font-medium">Full Assessment</span>
                <span className="text-sm text-muted-foreground">
                  Assess all assigned controls ({systemControls?.length || 0} controls)
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="partial" id="partial" />
              <Label htmlFor="partial" className="flex flex-col cursor-pointer">
                <span className="font-medium">Partial Assessment</span>
                <span className="text-sm text-muted-foreground">
                  Assess specific control families only
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="continuous" id="continuous" />
              <Label htmlFor="continuous" className="flex flex-col cursor-pointer">
                <span className="font-medium">Continuous Monitoring</span>
                <span className="text-sm text-muted-foreground">
                  Schedule recurring assessments
                </span>
              </Label>
            </div>
          </RadioGroup>

          {/* Control Family Selection for Partial Assessment */}
          {config.assessmentType === 'partial' && (
            <div className="space-y-2 mt-4">
              <Label>Select Control Families</Label>
              <div className="grid grid-cols-2 gap-2">
                {controlFamilies.map(family => {
                  const controlCount = getControlCountByFamily(family.id);
                  return (
                    <div key={family.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={family.id}
                        checked={config.scope.controlFamilies?.includes(family.id)}
                        onCheckedChange={(checked) => {
                          const families = config.scope.controlFamilies || [];
                          if (checked) {
                            setConfig({
                              ...config,
                              scope: {
                                ...config.scope,
                                controlFamilies: [...families, family.id]
                              }
                            });
                          } else {
                            setConfig({
                              ...config,
                              scope: {
                                ...config.scope,
                                controlFamilies: families.filter(f => f !== family.id)
                              }
                            });
                          }
                        }}
                      />
                      <Label
                        htmlFor={family.id}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {family.id} - {family.name}
                        {controlCount > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {controlCount}
                          </Badge>
                        )}
                      </Label>
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {getTotalSelectedControls()} controls
              </p>
            </div>
          )}

          {/* Include Inherited Controls */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeInherited"
              checked={config.scope.includeInherited}
              onCheckedChange={(checked) => setConfig({
                ...config,
                scope: { ...config.scope, includeInherited: !!checked }
              })}
            />
            <Label htmlFor="includeInherited" className="text-sm cursor-pointer">
              Include inherited controls in assessment
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Assessment Mode and Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Assessment Configuration
          </CardTitle>
          <CardDescription>
            Configure how the assessment will be performed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Assessment Mode */}
          <div className="space-y-2">
            <Label htmlFor="mode">Assessment Mode</Label>
            <Select 
              value={config.assessmentMode} 
              onValueChange={(value: any) => setConfig({...config, assessmentMode: value})}
            >
              <SelectTrigger id="mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automated">
                  <div className="flex flex-col">
                    <span>Automated</span>
                    <span className="text-xs text-muted-foreground">AI-powered assessment</span>
                  </div>
                </SelectItem>
                <SelectItem value="manual">
                  <div className="flex flex-col">
                    <span>Manual</span>
                    <span className="text-xs text-muted-foreground">Human review required</span>
                  </div>
                </SelectItem>
                <SelectItem value="hybrid">
                  <div className="flex flex-col">
                    <span>Hybrid</span>
                    <span className="text-xs text-muted-foreground">AI with human validation</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Risk Tolerance */}
          <div className="space-y-2">
            <Label htmlFor="risk">Risk Tolerance</Label>
            <Select 
              value={config.riskTolerance} 
              onValueChange={(value: any) => setConfig({...config, riskTolerance: value})}
            >
              <SelectTrigger id="risk">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (More findings)</SelectItem>
                <SelectItem value="medium">Medium (Balanced)</SelectItem>
                <SelectItem value="high">High (Fewer findings)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assessment Options */}
          <div className="space-y-2">
            <Label>Assessment Options</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeInfo"
                  checked={config.includeInformationalFindings}
                  onCheckedChange={(checked) => setConfig({
                    ...config,
                    includeInformationalFindings: !!checked
                  })}
                />
                <Label htmlFor="includeInfo" className="text-sm cursor-pointer">
                  Include informational findings
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="generatePoam"
                  checked={config.generatePoamItems}
                  onCheckedChange={(checked) => setConfig({
                    ...config,
                    generatePoamItems: !!checked
                  })}
                />
                <Label htmlFor="generatePoam" className="text-sm cursor-pointer">
                  Generate POA&M items for findings
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="generateEvidence"
                  checked={config.generateEvidence}
                  onCheckedChange={(checked) => setConfig({
                    ...config,
                    generateEvidence: !!checked
                  })}
                />
                <Label htmlFor="generateEvidence" className="text-sm cursor-pointer">
                  Generate evidence artifacts
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="updateStatus"
                  checked={config.updateControlStatus}
                  onCheckedChange={(checked) => setConfig({
                    ...config,
                    updateControlStatus: !!checked
                  })}
                />
                <Label htmlFor="updateStatus" className="text-sm cursor-pointer">
                  Update control implementation status
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule (for continuous monitoring) */}
      {config.assessmentType === 'continuous' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Assessment Schedule
            </CardTitle>
            <CardDescription>
              Configure when assessments should run
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select
                value={config.schedule?.frequency || 'weekly'}
                onValueChange={(value: any) => setConfig({
                  ...config,
                  schedule: {
                    frequency: value,
                    startDate: config.schedule?.startDate || new Date()
                  }
                })}
              >
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advanced Settings */}
      <Accordion type="single" collapsible>
        <AccordionItem value="advanced">
          <AccordionTrigger>Advanced Settings</AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardContent className="pt-6 space-y-4">
                {/* Notification Settings */}
                <div className="space-y-4">
                  <Label>Email Notifications</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="emailComplete"
                        checked={config.notificationSettings.emailOnComplete}
                        onCheckedChange={(checked) => setConfig({
                          ...config,
                          notificationSettings: {
                            ...config.notificationSettings,
                            emailOnComplete: !!checked
                          }
                        })}
                      />
                      <Label htmlFor="emailComplete" className="text-sm cursor-pointer">
                        Email when assessment completes
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="emailFailure"
                        checked={config.notificationSettings.emailOnFailure}
                        onCheckedChange={(checked) => setConfig({
                          ...config,
                          notificationSettings: {
                            ...config.notificationSettings,
                            emailOnFailure: !!checked
                          }
                        })}
                      />
                      <Label htmlFor="emailFailure" className="text-sm cursor-pointer">
                        Email on assessment failure
                      </Label>
                    </div>
                  </div>
                  
                  {/* Email Recipients */}
                  {(config.notificationSettings.emailOnComplete || config.notificationSettings.emailOnFailure) && (
                    <div className="space-y-2">
                      <Label htmlFor="emailRecipients">Email Recipients</Label>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            id="emailRecipients"
                            type="email"
                            placeholder="Enter email address"
                            value=""
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const input = e.target as HTMLInputElement;
                                const email = input.value.trim();
                                if (email && email.includes('@')) {
                                  setConfig({
                                    ...config,
                                    notificationSettings: {
                                      ...config.notificationSettings,
                                      recipients: [...config.notificationSettings.recipients, email]
                                    }
                                  });
                                  input.value = '';
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const input = document.getElementById('emailRecipients') as HTMLInputElement;
                              const email = input.value.trim();
                              if (email && email.includes('@')) {
                                setConfig({
                                  ...config,
                                  notificationSettings: {
                                    ...config.notificationSettings,
                                    recipients: [...config.notificationSettings.recipients, email]
                                  }
                                });
                                input.value = '';
                              }
                            }}
                          >
                            Add
                          </Button>
                        </div>
                        {config.notificationSettings.recipients.length > 0 && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Recipients:</Label>
                            <div className="flex flex-wrap gap-1">
                              {config.notificationSettings.recipients.map((email, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md text-sm"
                                >
                                  <span>{email}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                    onClick={() => {
                                      setConfig({
                                        ...config,
                                        notificationSettings: {
                                          ...config.notificationSettings,
                                          recipients: config.notificationSettings.recipients.filter((_, i) => i !== index)
                                        }
                                      });
                                    }}
                                  >
                                    ×
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Press Enter or click Add to add email recipients
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Summary */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Assessment Summary:</strong> {config.assessmentType} assessment covering{' '}
          {getTotalSelectedControls()} controls in {config.assessmentMode} mode.
        </AlertDescription>
      </Alert>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button
          onClick={handleStartAssessment}
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? 'Starting Assessment...' : 'Configure & Run Assessment'}
        </Button>
      </div>
    </div>
  );
}