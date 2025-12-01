import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  FileText, 
  Download, 
  Eye,
  RefreshCw,
  BarChart3,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Search,
  Settings,
  Share,
  Printer,
  FileCheck,
  Target,
  Calendar,
  Users
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'executive' | 'technical' | 'compliance' | 'findings';
  format: 'pdf' | 'html' | 'docx' | 'json';
  sections: string[];
  audience: string;
}

interface ReportSection {
  id: string;
  title: string;
  description: string;
  required: boolean;
  dataSource: string;
  estimatedPages?: number;
}

interface AssessmentReport {
  id: string;
  title: string;
  type: string;
  format: string;
  status: 'generating' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  downloadUrl?: string;
  size?: number;
}

interface AssessmentReportGeneratorProps {
  systemId: string;
  assessmentId?: string;
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'executive_summary',
    name: 'Executive Summary Report',
    description: 'High-level compliance overview for executive stakeholders',
    type: 'executive',
    format: 'pdf',
    sections: ['Executive Summary', 'Risk Overview', 'Compliance Status', 'Recommendations'],
    audience: 'C-Level Executives, Risk Management'
  },
  {
    id: 'technical_assessment',
    name: 'Technical Assessment Report',
    description: 'Detailed technical findings and recommendations',
    type: 'technical',
    format: 'pdf',
    sections: ['Technical Findings', 'Vulnerability Details', 'Control Assessment', 'Remediation Steps'],
    audience: 'IT Teams, Security Engineers'
  },
  {
    id: 'compliance_matrix',
    name: 'Compliance Assessment Matrix',
    description: 'Control-by-control compliance status and evidence mapping',
    type: 'compliance',
    format: 'pdf',
    sections: ['Control Matrix', 'Evidence Mapping', 'Implementation Status', 'Gap Analysis'],
    audience: 'Compliance Officers, Auditors'
  },
  {
    id: 'findings_report',
    name: 'Detailed Findings Report',
    description: 'Comprehensive list of all findings with detailed analysis',
    type: 'findings',
    format: 'pdf',
    sections: ['Findings Summary', 'Critical Issues', 'Remediation Guidance', 'Evidence References'],
    audience: 'Technical Teams, Project Managers'
  },
  {
    id: 'stig_checklist',
    name: 'STIG Compliance Checklist',
    description: 'STIG-specific compliance checklist with pass/fail status',
    type: 'compliance',
    format: 'html',
    sections: ['STIG Overview', 'Rule Compliance', 'Non-Compliance Items', 'Remediation Plan'],
    audience: 'System Administrators, Security Officers'
  },
  {
    id: 'json_data_export',
    name: 'Raw Data Export',
    description: 'Machine-readable assessment data for integration',
    type: 'technical',
    format: 'json',
    sections: ['Assessment Metadata', 'Findings Data', 'Control Status', 'Evidence Links'],
    audience: 'Developers, Integration Teams'
  }
];

const REPORT_SECTIONS: ReportSection[] = [
  {
    id: 'executive_summary',
    title: 'Executive Summary',
    description: 'High-level overview of assessment results and recommendations',
    required: true,
    dataSource: 'assessment_summary',
    estimatedPages: 2
  },
  {
    id: 'assessment_methodology',
    title: 'Assessment Methodology',
    description: 'Description of assessment approach and testing methods',
    required: false,
    dataSource: 'assessment_config',
    estimatedPages: 1
  },
  {
    id: 'system_overview',
    title: 'System Overview',
    description: 'System architecture and security boundaries',
    required: false,
    dataSource: 'system_info',
    estimatedPages: 2
  },
  {
    id: 'control_assessment',
    title: 'Control Assessment Results',
    description: 'NIST 800-53 control implementation status and findings',
    required: true,
    dataSource: 'control_status',
    estimatedPages: 5
  },
  {
    id: 'findings_analysis',
    title: 'Findings Analysis',
    description: 'Detailed analysis of security findings and vulnerabilities',
    required: true,
    dataSource: 'findings_data',
    estimatedPages: 8
  },
  {
    id: 'risk_assessment',
    title: 'Risk Assessment',
    description: 'Risk analysis and impact assessment',
    required: false,
    dataSource: 'risk_data',
    estimatedPages: 3
  },
  {
    id: 'stig_compliance',
    title: 'STIG Compliance',
    description: 'STIG checklist results and compliance status',
    required: false,
    dataSource: 'stig_data',
    estimatedPages: 4
  },
  {
    id: 'evidence_mapping',
    title: 'Evidence Mapping',
    description: 'Mapping of evidence artifacts to controls',
    required: false,
    dataSource: 'evidence_data',
    estimatedPages: 3
  },
  {
    id: 'remediation_plan',
    title: 'Remediation Plan',
    description: 'Prioritized remediation recommendations and timelines',
    required: true,
    dataSource: 'poam_data',
    estimatedPages: 4
  },
  {
    id: 'appendices',
    title: 'Technical Appendices',
    description: 'Supporting technical documentation and references',
    required: false,
    dataSource: 'technical_data',
    estimatedPages: 10
  }
];

export function AssessmentReportGenerator({ systemId, assessmentId }: AssessmentReportGeneratorProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [customConfig, setCustomConfig] = useState({
    title: '',
    format: 'pdf' as const,
    includeSections: [] as string[],
    includeClassifiedInfo: false,
    includeEvidence: true,
    includeRemediation: true,
    customSections: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('templates');

  // Fetch system info
  const { data: system } = useQuery({
    queryKey: ['/api/systems', systemId],
    enabled: !!systemId
  });

  // Fetch assessment summary
  const { data: assessmentSummary } = useQuery({
    queryKey: ['/api/assessment/systems', systemId, 'summary'],
    enabled: !!systemId
  });

  // Fetch existing reports (using generation service status tracking)
  // TODO: Implement proper report history tracking via generation service
  const { data: existingReports = [], refetch: refetchReports } = useQuery({
    queryKey: ['/api/reports/system', systemId],
    queryFn: async () => {
      // For now, return empty array since backend doesn't have report history endpoint
      // In production, this would track completed generation jobs
      return [] as AssessmentReport[];
    },
    enabled: !!systemId
  });

  // Generate report mutation (using correct generation service endpoints)
  const generateReport = useMutation({
    mutationFn: async (config: any) => {
      // Map report template to document types
      const getDocumentTypes = (templateId: string) => {
        switch (templateId) {
          case 'executive_summary':
            return ['sar_package'];
          case 'technical_assessment':
            return ['evidence_summary', 'poam_report'];
          case 'compliance_matrix':
            return ['control_narratives'];
          case 'findings_report':
            return ['poam_report'];
          case 'stig_checklist':
            return ['stig_checklist'];
          case 'json_data_export':
            return ['complete_ato_package'];
          default:
            return ['sar_package']; // Default fallback
        }
      };
      
      // Step 1: Start generation job using correct endpoint
      const startResponse = await apiRequest('POST', '/api/generation/start', {
        body: JSON.stringify({
          systemId,
          documentTypes: getDocumentTypes(selectedTemplate || 'executive_summary'),
          includeEvidence: config.includeEvidence !== false,
          includeArtifacts: true,
          templateOptions: {
            classification: config.includeClassifiedInfo ? 'FOR OFFICIAL USE ONLY' : 'UNCLASSIFIED',
            customFields: {
              reportTitle: config.title,
              sections: config.includeSections,
              customSections: config.customSections,
              includeRemediation: config.includeRemediation,
              assessmentId
            }
          }
        })
      });
      
      if (!startResponse.ok) {
        const error = await startResponse.json();
        throw new Error(error.error || 'Failed to start report generation');
      }
      
      const startResult = await startResponse.json();
      const jobId = startResult.jobId;
      
      // Step 2: Poll for completion (simplified polling)
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds timeout for reports
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await apiRequest('GET', `/api/generation/status/${jobId}`);
        if (!statusResponse.ok) throw new Error('Failed to get generation status');
        const statusResult = await statusResponse.json();
        
        if (statusResult.status.status === 'completed') {
          // Step 3: Get final result
          const resultResponse = await apiRequest('GET', `/api/generation/result/${jobId}`);
          if (!resultResponse.ok) throw new Error('Failed to get generation result');
          const finalResult = await resultResponse.json();
          
          // Return result with download info
          return {
            ...finalResult,
            jobId,
            title: config.title,
            downloadable: true
          };
        } else if (statusResult.status.status === 'failed') {
          throw new Error(statusResult.status.error || 'Report generation failed');
        }
        
        attempts++;
      }
      
      throw new Error('Report generation timeout - please try again');
    },
    onSuccess: (data) => {
      toast({
        title: 'Report Generated Successfully',
        description: `Report "${data.title || 'Assessment Report'}" has been generated and is ready for download.`
      });
      setIsGenerating(false);
      refetchReports();
      
      // Automatically trigger download if result contains downloadable content
      if (data.result?.documents?.length > 0) {
        const document = data.result.documents[0];
        if (document.content || document.filePath) {
          setTimeout(() => {
            handleDownloadGenerated(data.jobId, data.title || 'assessment-report');
          }, 1000);
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate report',
        variant: 'destructive'
      });
      setIsGenerating(false);
    }
  });

  const applyTemplate = (templateId: string) => {
    const template = REPORT_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      const sectionIds = REPORT_SECTIONS
        .filter(section => template.sections.some(ts => 
          section.title.toLowerCase().includes(ts.toLowerCase()) || 
          ts.toLowerCase().includes(section.title.toLowerCase())
        ))
        .map(s => s.id);

      setCustomConfig({
        title: template.name,
        format: template.format as "pdf",
        includeSections: sectionIds,
        includeClassifiedInfo: false,
        includeEvidence: template.type !== 'executive',
        includeRemediation: true,
        customSections: ''
      });
      setSelectedTemplate(templateId);
    }
  };

  const handleGenerate = () => {
    if (!selectedTemplate && !customConfig.title) {
      toast({
        title: 'Invalid Configuration',
        description: 'Please select a template or configure custom report settings.',
        variant: 'destructive'
      });
      return;
    }

    setIsGenerating(true);
    const template = REPORT_TEMPLATES.find(t => t.id === selectedTemplate);
    
    generateReport.mutate({
      title: customConfig.title || template?.name,
      type: template?.type || 'custom',
      format: customConfig.format,
      sections: customConfig.includeSections,
      options: {
        includeClassifiedInfo: customConfig.includeClassifiedInfo,
        includeEvidence: customConfig.includeEvidence,
        includeRemediation: customConfig.includeRemediation
      }
    });
  };

  // Helper function to create and download blob content
  const downloadBlob = (content: string, filename: string, mimeType: string = 'application/pdf') => {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Download generated report from generation service result
  const handleDownloadGenerated = async (jobId: string, title: string) => {
    try {
      const response = await apiRequest('GET', `/api/generation/result/${jobId}`);
      if (!response.ok) throw new Error('Failed to get generation result');
      const result = await response.json();
      
      if (result.result?.documents?.length > 0) {
        const document = result.result.documents[0];
        const filename = `${title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.${document.format || 'pdf'}`;
        
        if (document.content) {
          // Direct content download
          downloadBlob(document.content, filename, document.mimeType || 'application/pdf');
        } else if (document.filePath) {
          // File path download (would need server file serving endpoint)
          toast({
            title: 'Download Available',
            description: `Report generated at: ${document.filePath}`,
          });
        }
        
        toast({
          title: 'Report Downloaded',
          description: `Successfully downloaded ${filename}`
        });
      } else {
        throw new Error('No downloadable content found');
      }
    } catch (error: any) {
      toast({
        title: 'Download Failed',
        description: error.message || 'Failed to download generated report',
        variant: 'destructive'
      });
    }
  };

  // Legacy download function (for existing reports if any)
  const downloadReport = async (reportId: string) => {
    try {
      // Try to use generation service result endpoint
      await handleDownloadGenerated(reportId, 'assessment-report');
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to download report - please regenerate',
        variant: 'destructive'
      });
    }
  };

  const getEstimatedPages = () => {
    return REPORT_SECTIONS
      .filter(section => customConfig.includeSections.includes(section.id))
      .reduce((total, section) => total + (section.estimatedPages || 1), 0);
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'completed' ? 'default' : 
                   status === 'generating' ? 'secondary' : 'destructive';
    return <Badge variant={variant}>{status.toUpperCase()}</Badge>;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6" data-testid="assessment-report-generator">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Assessment Report Generator</h3>
          <p className="text-muted-foreground">Generate comprehensive assessment reports for {(system as any)?.name || 'the system'}</p>
        </div>
        {assessmentSummary && (
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Assessment Compliance</div>
            <div className="text-2xl font-bold">
              {String((assessmentSummary as any)?.assessment?.overallCompliance?.toFixed(1) || '0.0')}%
            </div>
          </div>
        )}
      </div>

      {/* Configuration Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Report Configuration
          </CardTitle>
          <CardDescription>
            Configure report content, format, and sections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="sections">Sections</TabsTrigger>
              <TabsTrigger value="options">Options</TabsTrigger>
            </TabsList>

            {/* Templates Tab */}
            <TabsContent value="templates" className="space-y-4">
              <div className="grid gap-4">
                {REPORT_TEMPLATES.map((template) => (
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
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{template.name}</h4>
                            <Badge variant="outline">{template.format.toUpperCase()}</Badge>
                            <Badge variant="outline">{template.type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                          <div className="text-xs text-muted-foreground">
                            <strong>Audience:</strong> {template.audience}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <strong>Sections:</strong> {template.sections.join(', ')}
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

            {/* Sections Tab */}
            <TabsContent value="sections" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="reportTitle">Report Title</Label>
                  <Input
                    id="reportTitle"
                    value={customConfig.title}
                    onChange={(e) => setCustomConfig(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Custom Assessment Report"
                  />
                </div>

                <div>
                  <Label htmlFor="reportFormat">Format</Label>
                  <Select 
                    value={customConfig.format}
                    onValueChange={(value: any) => setCustomConfig(prev => ({ ...prev, format: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="html">HTML</SelectItem>
                      <SelectItem value="docx">Word Document</SelectItem>
                      <SelectItem value="json">JSON Data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Report Sections</Label>
                  <div className="space-y-2 mt-2 max-h-64 overflow-y-auto">
                    {REPORT_SECTIONS.map((section) => (
                      <div key={section.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                        <Checkbox
                          id={section.id}
                          checked={customConfig.includeSections.includes(section.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setCustomConfig(prev => ({
                                ...prev,
                                includeSections: [...prev.includeSections, section.id]
                              }));
                            } else {
                              setCustomConfig(prev => ({
                                ...prev,
                                includeSections: prev.includeSections.filter(id => id !== section.id)
                              }));
                            }
                          }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={section.id} className="font-medium">
                              {section.title}
                            </Label>
                            {section.required && (
                              <Badge variant="outline" className="text-xs">Required</Badge>
                            )}
                            {section.estimatedPages && (
                              <Badge variant="outline" className="text-xs">
                                ~{section.estimatedPages}p
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{section.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Options Tab */}
            <TabsContent value="options" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Report Options</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeEvidence"
                        checked={customConfig.includeEvidence}
                        onCheckedChange={(checked) => 
                          setCustomConfig(prev => ({ ...prev, includeEvidence: !!checked }))
                        }
                      />
                      <Label htmlFor="includeEvidence">Include evidence artifacts and references</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeRemediation"
                        checked={customConfig.includeRemediation}
                        onCheckedChange={(checked) => 
                          setCustomConfig(prev => ({ ...prev, includeRemediation: !!checked }))
                        }
                      />
                      <Label htmlFor="includeRemediation">Include remediation recommendations</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeClassifiedInfo"
                        checked={customConfig.includeClassifiedInfo}
                        onCheckedChange={(checked) => 
                          setCustomConfig(prev => ({ ...prev, includeClassifiedInfo: !!checked }))
                        }
                      />
                      <Label htmlFor="includeClassifiedInfo">Include classified system information</Label>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label htmlFor="customSections">Additional Custom Sections</Label>
                  <Textarea
                    id="customSections"
                    value={customConfig.customSections}
                    onChange={(e) => setCustomConfig(prev => ({ ...prev, customSections: e.target.value }))}
                    placeholder="Describe any additional custom sections to include..."
                    rows={3}
                  />
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-medium mb-2">Report Preview</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Estimated Pages:</span>
                      <div className="font-medium">{getEstimatedPages()}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Format:</span>
                      <div className="font-medium">{customConfig.format.toUpperCase()}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sections:</span>
                      <div className="font-medium">{customConfig.includeSections.length}</div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {customConfig.includeSections.length} sections selected, approximately {getEstimatedPages()} pages
            </div>
            <Button 
              onClick={handleGenerate}
              disabled={isGenerating || generateReport.isPending || customConfig.includeSections.length === 0}
              data-testid="button-generate-report"
            >
              {isGenerating || generateReport.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Generated Reports
          </CardTitle>
          <CardDescription>
            Previously generated assessment reports for this system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {existingReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No reports have been generated yet.</p>
              <p className="text-sm">Generate your first assessment report using the configuration above.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {existingReports.map((report) => (
                <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{report.title}</h4>
                      {getStatusBadge(report.status)}
                      <Badge variant="outline">{report.format.toUpperCase()}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Created: {new Date(report.createdAt).toLocaleDateString()}
                      {report.size && ` • ${formatFileSize(report.size)}`}
                    </div>
                    {report.status === 'generating' && (
                      <Progress value={report.progress} className="w-64 h-2" />
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {report.status === 'completed' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadReport(report.id)}
                          data-testid={`button-download-${report.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-preview-${report.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}