import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  Download, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Database,
  FileCheck,
  Target,
  Clock,
  Users,
  Calendar
} from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';

interface AssessmentSummary {
  systemId: string;
  systemName: string;
  assessmentId?: string;
  lastAssessment?: string;
  complianceScore: number;
  totalControls: number;
  implementedControls: number;
  partiallyImplementedControls: number;
  notImplementedControls: number;
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  informationalFindings: number;
  openFindings: number;
  resolvedFindings: number;
  stigCompliance: number;
  riskScore?: number;
  complianceTrend?: 'improving' | 'declining' | 'stable';
  lastUpdated: string;
}

interface Finding {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  status: 'open' | 'fixed' | 'accepted' | 'false_positive';
  source: 'nessus' | 'scap' | 'manual';
  hostName?: string;
  pluginId?: string;
  cveId?: string;
  stigRuleId?: string;
  controlId?: string;
  discoveredAt: string;
  lastUpdated: string;
  assignedTo?: string;
}

interface Document {
  id: string;
  title: string;
  type: 'ssp' | 'sar' | 'poam' | 'stig_checklist' | 'control_matrix' | 'evidence_package' | 'other';
  status: 'draft' | 'review' | 'approved' | 'final';
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  downloadUrl?: string;
  canDownload: boolean;
  createdAt: string;
  lastUpdated: string;
  generatedBy?: string;
  version?: string;
}

interface AssessmentResultsViewerProps {
  systemId: string;
  className?: string;
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    case 'informational': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'fixed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    case 'accepted': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    case 'false_positive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    case 'open': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
  }
};

const getDocumentTypeLabel = (type: string) => {
  switch (type) {
    case 'ssp': return 'System Security Plan';
    case 'sar': return 'Security Assessment Report';
    case 'poam': return 'Plan of Actions & Milestones';
    case 'stig_checklist': return 'STIG Checklist';
    case 'control_matrix': return 'Control Implementation Matrix';
    case 'evidence_package': return 'Evidence Package';
    default: return type.charAt(0).toUpperCase() + type.slice(1);
  }
};

const getDocumentIcon = (type: string) => {
  switch (type) {
    case 'ssp': return Shield;
    case 'sar': return Target;
    case 'poam': return AlertTriangle;
    case 'stig_checklist': return CheckCircle;
    case 'control_matrix': return Database;
    case 'evidence_package': return FileCheck;
    default: return FileText;
  }
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return 'Unknown size';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export function AssessmentResultsViewer({ systemId, className }: AssessmentResultsViewerProps) {
  const [activeTab, setActiveTab] = useState('summary');

  // Fetch assessment summary
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ['/api/analytics/systems', systemId, 'compliance'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/analytics/systems/${systemId}/compliance`);
        return response.json();
      } catch (error: any) {
        if (error.message?.includes('404')) {
          // Try alternative endpoint if analytics doesn't exist
          const altResponse = await apiRequest('GET', `/api/assessment/systems/${systemId}/summary`);
          const data = await altResponse.json();
            // Transform the data to match expected format
            return {
              systemId,
              systemName: data.system?.name || 'Unknown',
              complianceScore: data.assessment?.overallCompliance || 0,
              totalControls: data.metrics?.totalControls || 0,
              implementedControls: data.metrics?.compliantControls || 0,
              partiallyImplementedControls: 0,
              notImplementedControls: data.metrics?.nonCompliantControls || 0,
              totalFindings: data.metrics?.totalFindings || 0,
              criticalFindings: data.metrics?.criticalFindings || 0,
              highFindings: data.metrics?.highFindings || 0,
              mediumFindings: 0,
              lowFindings: 0,
              informationalFindings: 0,
              openFindings: data.metrics?.openFindings || 0,
              resolvedFindings: 0,
              stigCompliance: data.metrics?.stigCompliance || 0,
              lastAssessment: data.assessment?.lastRun,
              lastUpdated: new Date().toISOString()
            } as AssessmentSummary;
        }
        throw error;
      }
    },
    retry: false,
  });

  // Fetch findings
  const { data: findings, isLoading: findingsLoading, error: findingsError } = useQuery({
    queryKey: ['/api/systems', systemId, 'findings'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/systems/${systemId}/findings?limit=100`);
        const result = await response.json();
        // Handle both array and object with findings property
        return Array.isArray(result) ? result : (result.findings || []) as Finding[];
      } catch (error: any) {
        if (error.message?.includes('404')) {
          // Try alternative endpoint
          const altResponse = await apiRequest('GET', `/api/findings?systemId=${systemId}`);
          return await altResponse.json() as Finding[];
        }
        throw error;
      }
    },
    enabled: activeTab === 'findings',
    retry: false,
  });

  // Fetch documents - Since this endpoint doesn't exist, we'll just return empty array
  const { data: documents = [], isLoading: documentsLoading, error: documentsError } = useQuery({
    queryKey: ['/api/documents', systemId],
    queryFn: async () => {
      // Documents endpoint doesn't exist yet, return empty array
      console.log('Documents endpoint not implemented yet, returning empty array');
      return [];
    },
    enabled: activeTab === 'documents',
    retry: false,
  });

  const handleDownload = async (document: Document) => {
    if (!document.canDownload || !document.downloadUrl) {
      return;
    }
    
    try {
      window.open(document.downloadUrl, '_blank');
    } catch (error) {
      console.error('Failed to download document:', error);
    }
  };

  return (
    <Card className={className} data-testid="card-assessment-results">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Assessment Results
        </CardTitle>
        <CardDescription>
          Comprehensive assessment results and compliance status
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary" data-testid="tab-summary">Summary</TabsTrigger>
            <TabsTrigger value="findings" data-testid="tab-findings">Findings</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="mt-6">
            {summaryLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </div>
            ) : summaryError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load assessment summary. Please try refreshing the page.
                </AlertDescription>
              </Alert>
            ) : summary ? (
              <div className="space-y-6">
                {/* Overall Compliance Score */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Overall Compliance Score</span>
                      <Badge variant={summary.complianceScore >= 80 ? 'default' : 
                                    summary.complianceScore >= 60 ? 'secondary' : 'destructive'}>
                        {summary.complianceScore}%
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Progress value={summary.complianceScore} className="h-3" />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Non-compliant</span>
                        <span>Fully compliant</span>
                      </div>
                    </div>
                    {summary.lastAssessment && (
                      <div className="mt-4 text-sm text-muted-foreground">
                        Last assessed: {formatDistanceToNow(parseISO(summary.lastAssessment))} ago
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card data-testid="metric-controls">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Controls</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{summary.totalControls}</div>
                      <div className="text-xs text-muted-foreground">
                        {summary.implementedControls} implemented
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="metric-findings">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Total Findings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{summary.totalFindings}</div>
                      <div className="text-xs text-muted-foreground">
                        {summary.openFindings} open
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="metric-critical">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Critical Findings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">{summary.criticalFindings}</div>
                      <div className="text-xs text-muted-foreground">
                        Require immediate attention
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="metric-stig">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">STIG Compliance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{summary.stigCompliance}%</div>
                      <div className="text-xs text-muted-foreground">
                        Security guidelines compliance
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Control Implementation Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Control Implementation Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Implemented</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full" 
                              style={{ width: `${(summary.implementedControls / summary.totalControls) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{summary.implementedControls}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Partially Implemented</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-yellow-500 h-2 rounded-full" 
                              style={{ width: `${(summary.partiallyImplementedControls / summary.totalControls) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{summary.partiallyImplementedControls}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Not Implemented</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-red-500 h-2 rounded-full" 
                              style={{ width: `${(summary.notImplementedControls / summary.totalControls) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{summary.notImplementedControls}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          {/* Findings Tab */}
          <TabsContent value="findings" className="mt-6">
            {findingsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : findingsError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load findings. Please try refreshing the page.
                </AlertDescription>
              </Alert>
            ) : findings ? (
              <div className="space-y-6">
                {/* Findings Summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card className="text-center">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-red-600">
                        {findings.filter(f => f.severity === 'critical').length}
                      </div>
                      <div className="text-sm text-muted-foreground">Critical</div>
                    </CardContent>
                  </Card>
                  <Card className="text-center">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-orange-600">
                        {findings.filter(f => f.severity === 'high').length}
                      </div>
                      <div className="text-sm text-muted-foreground">High</div>
                    </CardContent>
                  </Card>
                  <Card className="text-center">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-yellow-600">
                        {findings.filter(f => f.severity === 'medium').length}
                      </div>
                      <div className="text-sm text-muted-foreground">Medium</div>
                    </CardContent>
                  </Card>
                  <Card className="text-center">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-blue-600">
                        {findings.filter(f => f.severity === 'low').length}
                      </div>
                      <div className="text-sm text-muted-foreground">Low</div>
                    </CardContent>
                  </Card>
                  <Card className="text-center">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-gray-600">
                        {findings.filter(f => f.severity === 'informational').length}
                      </div>
                      <div className="text-sm text-muted-foreground">Info</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Findings List */}
                <div className="space-y-3">
                  {findings.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <h3 className="text-lg font-medium">No findings detected</h3>
                      <p>This system has no security findings. Great job!</p>
                    </div>
                  ) : (
                    findings.map((finding) => (
                      <Card key={finding.id} data-testid={`finding-${finding.id}`}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium">{finding.title}</h4>
                                <Badge className={getSeverityColor(finding.severity)}>
                                  {finding.severity}
                                </Badge>
                                <Badge variant="outline" className={getStatusColor(finding.status)}>
                                  {finding.status.replace('_', ' ')}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">
                                {finding.description}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                {finding.hostName && (
                                  <span>Host: {finding.hostName}</span>
                                )}
                                {finding.source && (
                                  <span>Source: {finding.source.toUpperCase()}</span>
                                )}
                                <span>
                                  Discovered: {formatDistanceToNow(parseISO(finding.discoveredAt))} ago
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-6">
            {documentsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : documentsError && !documents ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load documents. Please try refreshing the page.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {!documents || documents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium">No documents generated</h3>
                    <p>Generated documents will appear here after running assessments or document generation tasks.</p>
                  </div>
                ) : (
                  documents.map((document) => {
                    const DocIcon = getDocumentIcon(document.type);
                    return (
                      <Card key={document.id} data-testid={`document-${document.id}`}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <DocIcon className="h-8 w-8 text-blue-500" />
                              <div>
                                <h4 className="font-medium">{document.title}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {getDocumentTypeLabel(document.type)}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline">
                                    {document.status}
                                  </Badge>
                                  {document.fileSize && (
                                    <span className="text-xs text-muted-foreground">
                                      {formatFileSize(document.fileSize)}
                                    </span>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    Created {formatDistanceToNow(parseISO(document.createdAt))} ago
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              onClick={() => handleDownload(document)}
                              disabled={!document.canDownload}
                              variant="outline"
                              size="sm"
                              data-testid={`button-download-${document.id}`}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}