import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  FileText,
  Download,
  Printer,
  Clock,
  Target,
  BarChart3,
  TrendingUp,
  AlertCircle,
  Info,
  ChevronRight
} from 'lucide-react';

interface AssessmentResult {
  assessmentId: string;
  systemId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime: Date;
  endTime?: Date;
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
  controlAssessments: any[];
  poamItems: any[];
  errors: string[];
}

interface AssessmentResultsDetailProps {
  systemId: string;
  assessmentId?: string;
  onClose?: () => void;
}

export function AssessmentResultsDetail({ systemId, assessmentId, onClose }: AssessmentResultsDetailProps) {
  const [activeTab, setActiveTab] = useState('summary');

  // Fetch assessment results
  const { data: result, isLoading, error } = useQuery<AssessmentResult>({
    queryKey: ['/api/assessment/systems', systemId, 'results', assessmentId],
    queryFn: async () => {
      const url = assessmentId 
        ? `/api/assessment/systems/${systemId}/results?assessmentId=${assessmentId}`
        : `/api/assessment/systems/${systemId}/results`;
      
      const response = await apiRequest('GET', url);
      return response.json();
    },
    enabled: !!systemId,
  });

  const getComplianceColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRiskColor = (score: number) => {
    if (score <= 30) return 'text-green-600';
    if (score <= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDuration = (start: Date, end?: Date) => {
    if (!end) return 'In Progress';
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2">
            <Clock className="h-5 w-5 animate-spin" />
            <span>Loading assessment results...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <Alert variant="default">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error?.message === 'Assessment not found' || (error as any)?.error === 'No assessments found for this system'
            ? 'No assessment results found. Please run an assessment first to view results.'
            : 'Failed to load assessment results. Please try again.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6" data-testid="assessment-results-detail">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Assessment Results</h2>
          <p className="text-muted-foreground">
            {result.assessmentId} • {new Date(result.startTime).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Executive Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getComplianceColor(result.summary.overallCompliancePercentage)}`}>
                {result.summary.overallCompliancePercentage}%
              </div>
              <div className="text-sm text-muted-foreground">Overall Compliance</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${getRiskColor(result.summary.riskScore)}`}>
                {result.summary.riskScore}
              </div>
              <div className="text-sm text-muted-foreground">Risk Score</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{result.findings.totalFindings}</div>
              <div className="text-sm text-muted-foreground">Total Findings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{formatDuration(result.startTime, result.endTime)}</div>
              <div className="text-sm text-muted-foreground">Assessment Duration</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="findings">Findings</TabsTrigger>
          <TabsTrigger value="stig">STIG</TabsTrigger>
          <TabsTrigger value="poam">POA&M</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {/* Controls Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Controls Implementation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Compliant Controls</span>
                  <span className="font-medium">
                    {result.summary.compliantControls} / {result.summary.totalControls}
                  </span>
                </div>
                <Progress 
                  value={(result.summary.compliantControls / result.summary.totalControls) * 100} 
                  className="h-2"
                />
              </div>
              
              <div className="grid grid-cols-4 gap-4 pt-4">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {result.summary.compliantControls}
                  </div>
                  <div className="text-xs text-muted-foreground">Compliant</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {result.summary.partiallyImplementedControls}
                  </div>
                  <div className="text-xs text-muted-foreground">Partial</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {result.summary.nonCompliantControls}
                  </div>
                  <div className="text-xs text-muted-foreground">Non-Compliant</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-600">
                    {result.summary.notAssessedControls}
                  </div>
                  <div className="text-xs text-muted-foreground">Not Assessed</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Findings Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Security Findings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {result.findings.criticalFindings}
                  </div>
                  <div className="text-xs text-muted-foreground">Critical</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {result.findings.highFindings}
                  </div>
                  <div className="text-xs text-muted-foreground">High</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {result.findings.mediumFindings}
                  </div>
                  <div className="text-xs text-muted-foreground">Medium</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.findings.lowFindings}
                  </div>
                  <div className="text-xs text-muted-foreground">Low</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {result.findings.resolvedFindings}
                  </div>
                  <div className="text-xs text-muted-foreground">Resolved</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* STIG Compliance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                STIG Compliance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">STIG Compliance Rate</span>
                <span className={`text-2xl font-bold ${getComplianceColor(result.stigCompliance.stigCompliancePercentage)}`}>
                  {result.stigCompliance.stigCompliancePercentage}%
                </span>
              </div>
              <Progress 
                value={result.stigCompliance.stigCompliancePercentage} 
                className="h-2"
              />
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Compliant:</span> {result.stigCompliance.compliantRules}
                </div>
                <div>
                  <span className="text-muted-foreground">Non-Compliant:</span> {result.stigCompliance.nonCompliantRules}
                </div>
                <div>
                  <span className="text-muted-foreground">N/A:</span> {result.stigCompliance.notApplicableRules}
                </div>
                <div>
                  <span className="text-muted-foreground">Not Reviewed:</span> {result.stigCompliance.notReviewedRules}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="controls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Control Assessment Details</CardTitle>
              <CardDescription>
                Detailed assessment results for each control
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result.controlAssessments.length > 0 ? (
                <div className="space-y-3">
                  {result.controlAssessments.map((control, index) => (
                    <div key={index} className="border rounded-lg p-4 hover-elevate">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{control.controlId}</h4>
                            <Badge variant={control.status === 'compliant' ? 'default' : 'destructive'}>
                              {control.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{control.title}</p>
                          <p className="text-sm">{control.assessmentNarrative}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {control.compliancePercentage}% Compliant
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {control.stigRulesCompliant}/{control.stigRulesMapped} STIG Rules
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4" />
                  <p>No control assessment data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="findings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Findings Details</CardTitle>
              <CardDescription>
                All findings discovered during the assessment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {result.findings.totalFindings} findings identified. 
                  Focus on {result.findings.criticalFindings + result.findings.highFindings} critical and high severity items first.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stig" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>STIG Rule Assessment</CardTitle>
              <CardDescription>
                Detailed STIG compliance results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4" />
                <p>STIG rule details available in the full assessment report</p>
                <Button variant="outline" className="mt-4">
                  <Download className="h-4 w-4 mr-2" />
                  Download STIG Checklist
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="poam" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Plan of Action & Milestones</CardTitle>
              <CardDescription>
                Generated POA&M items for remediation tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result.poamItems.length > 0 ? (
                <div className="space-y-3">
                  {result.poamItems.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="font-medium">{item.weakness}</h4>
                          <p className="text-sm text-muted-foreground">{item.remediation}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant={item.priority === 'critical' ? 'destructive' : 'secondary'}>
                              {item.priority}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Due: {new Date(item.plannedCompletionDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                  <p>No POA&M items generated for this assessment</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Errors */}
      {result.errors && result.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium mb-1">Assessment Errors:</div>
            <ul className="list-disc list-inside text-sm">
              {result.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}