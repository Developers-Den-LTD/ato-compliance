import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { AssessmentProgressTracker } from '@/components/assessment-progress-tracker';
import { AssessmentHistory } from '@/components/assessment-history';
import { AssessmentInitiatorEnhanced } from '@/components/assessment-initiator-enhanced';
import { AssessmentRiskMatrix } from '@/components/assessment-risk-matrix';
import { AssessmentResultsDetail } from '@/components/assessment-results-detail';
import { VulnerabilityScanUpload } from '@/components/vulnerability-scan-upload';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Search,
  Filter,
  Play,
  RefreshCw,
  FileText,
  AlertCircle,
  BarChart3,
  Target,
  Eye,
  History,
  Settings,
  Upload
} from 'lucide-react';

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

interface Finding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  status: 'open' | 'fixed' | 'accepted' | 'false_positive';
  description: string;
  stigRuleId?: string;
  controlId?: string;
  createdAt: string;
  remediation?: string;
}

interface StigRule {
  id: string;
  title: string;
  severity: string;
  status: 'pass' | 'fail' | 'not_reviewed';
  findingsCount: number;
  openFindingsCount: number;
}

interface ControlAssessment {
  controlId: string;
  title: string;
  family: string;
  status: string;
  implementationStatus: string;
  evidenceCount: number;
  stigRulesMapped: number;
}

interface AssessmentDashboardProps {
  systemId: string;
}

export function AssessmentDashboard({ systemId }: AssessmentDashboardProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('risk');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showAssessmentConfig, setShowAssessmentConfig] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showResultsDetail, setShowResultsDetail] = useState(false);
  const [showScanUpload, setShowScanUpload] = useState(false);
  const [currentAssessmentId, setCurrentAssessmentId] = useState<string | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  
  // Pre-define all handlers to avoid initialization issues
  const handleShowAssessmentConfig = () => {
    setShowAssessmentConfig(true);
  };
  
  const handleHideAssessmentConfig = () => {
    setShowAssessmentConfig(false);
  };
  
  const handleShowHistory = () => {
    setShowHistory(true);
  };
  
  const handleHideHistory = () => {
    setShowHistory(false);
  };
  
  const handleShowResultsDetail = () => {
    setShowResultsDetail(true);
  };
  
  const handleHideResultsDetail = () => {
    setShowResultsDetail(false);
  };
  
  const handleViewResults = () => {
    if (summary?.assessment?.id) {
      setSelectedAssessmentId(summary.assessment.id);
      setShowResultsDetail(true);
    }
  };
  
  const handleHistoryViewResults = (assessmentId: string) => {
    setSelectedAssessmentId(assessmentId);
    setShowHistory(false);
    setShowResultsDetail(true);
  };
  
  const handleAssessmentStarted = (assessmentId: string) => {
    setCurrentAssessmentId(assessmentId);
    setShowAssessmentConfig(false);
    toast({
      title: 'Assessment Started',
      description: 'Your assessment is now running. Track progress below.',
    });
  };
  
  const handleProgressComplete = () => {
    setCurrentAssessmentId(null);
    refetchSummary();
    queryClient.invalidateQueries({ queryKey: ['/api/findings/system', systemId] });
    queryClient.invalidateQueries({ queryKey: ['/api/systems', systemId, 'controls'] });
    queryClient.invalidateQueries({ queryKey: ['/api/assessment/systems', systemId, 'status'] });
  };
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  
  const handleSeverityChange = (value: string) => {
    setSelectedSeverity(value);
  };
  
  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
  };

  // Fetch assessment summary
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['/api/assessment/systems', systemId, 'summary'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/assessment/systems/${systemId}/summary`);
        return response.json();
      } catch (error: any) {
        if (error.message?.includes('404')) {
          throw new Error('No assessments found. Run an assessment first.');
        }
        throw new Error('Failed to fetch assessment summary');
      }
      return response.json() as Promise<AssessmentSummary>;
    },
    enabled: !!systemId,
  });

  // Fetch findings
  const { data: findingsData, isLoading: findingsLoading } = useQuery({
    queryKey: ['/api/ingestion/systems', systemId, 'findings'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/ingestion/systems/${systemId}/findings`);
      const data = await response.json();
      return data.findings || [];
    },
    enabled: !!systemId,
  });

  const findings = findingsData || [];

  // Fetch assessment results
  const { data: assessmentResults } = useQuery({
    queryKey: ['/api/assessment/systems', systemId, 'results'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/assessment/systems/${systemId}/results`);
      return response.json();
    },
    enabled: !!systemId,
  });

  // Check for running assessment
  const { data: assessmentStatus } = useQuery({
    queryKey: ['/api/assessment/systems', systemId, 'status'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/assessment/systems/${systemId}/status`);
        return response.json();
      } catch {
        return null;
      }
    },
    enabled: !!systemId,
    refetchInterval: 5000 // Check every 5 seconds
  });

  // Fetch system controls for risk matrix
  const { data: systemControls = [] } = useQuery({
    queryKey: ['/api/systems', systemId, 'controls'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/systems/${systemId}/controls`);
        return response.json();
      } catch {
        return [];
      }
    },
    enabled: !!systemId,
  });

  // Set currentAssessmentId if there's a running assessment
  useEffect(() => {
    if (assessmentStatus?.status === 'running' && assessmentStatus?.assessmentId) {
      setCurrentAssessmentId(assessmentStatus.assessmentId);
    }
  }, [assessmentStatus]);

  // Start new assessment
  const handleStartAssessment = async () => {
    try {
      const response = await apiRequest('POST', `/api/assessment/systems/${systemId}/assess`, {
        body: JSON.stringify({
          assessmentMode: 'automated',
          includeInformationalFindings: false,
          generatePoamItems: true,
          generateEvidence: true,
          updateControlStatus: true,
          riskTolerance: 'medium'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start assessment');
      }

      const result = await response.json();
      toast({
        title: 'Assessment Started',
        description: `Assessment ${result.assessmentId} has been initiated. This may take several minutes to complete.`,
      });

      // Invalidate related queries to refresh assessment data
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/assessment/systems', systemId, 'summary'] });
        queryClient.invalidateQueries({ queryKey: ['/api/findings/system', systemId] });
        queryClient.invalidateQueries({ queryKey: ['/api/systems', systemId, 'metrics'] });
      }, 2000);
    } catch (error) {
      toast({
        title: 'Assessment Failed',
        description: error instanceof Error ? error.message : 'Failed to start assessment',
        variant: 'destructive',
      });
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'medium':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'low':
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'fixed':
        return 'default';
      case 'open':
        return 'destructive';
      case 'accepted':
        return 'secondary';
      case 'false_positive':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <BarChart3 className="h-4 w-4 text-gray-600" />;
    }
  };

  // Filter findings based on search and filters
  const filteredFindings = findings.filter(finding => {
    const matchesSearch = searchQuery === '' || 
      finding.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      finding.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSeverity = selectedSeverity === 'all' || finding.severity === selectedSeverity;
    const matchesStatus = selectedStatus === 'all' || finding.status === selectedStatus;
    
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  if (summaryLoading) {
    return (
      <div className="space-y-6" data-testid="assessment-loading">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                <div className="h-3 w-20 bg-muted rounded animate-pulse mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="space-y-6" data-testid="assessment-no-data">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              No Assessment Data Available
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              No assessment data is available for this system. Run an assessment to view compliance metrics and findings.
            </p>
            <Button onClick={handleStartAssessment} data-testid="button-start-first-assessment">
              <Play className="h-4 w-4 mr-2" />
              Run First Assessment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="assessment-dashboard">
      {/* Assessment Overview Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="metric-overall-compliance">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Overall Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.assessment.overallCompliance}%</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getTrendIcon(summary.trends.complianceTrend)}
              {summary.trends.complianceTrend}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="metric-risk-score">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Risk Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.assessment.riskScore}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getTrendIcon(summary.trends.riskTrend)}
              {summary.trends.riskTrend}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="metric-open-findings">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Open Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{summary.metrics.openFindings}</div>
            <p className="text-xs text-muted-foreground">
              {summary.metrics.criticalFindings} critical, {summary.metrics.highFindings} high
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-stig-compliance">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              STIG Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.metrics.stigCompliance}%</div>
            <p className="text-xs text-muted-foreground">Security compliance</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls Implementation Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Controls Implementation Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>Implemented Controls</span>
            <span className="font-medium">
              {summary.metrics.compliantControls}/{summary.metrics.totalControls} 
              ({Math.round((summary.metrics.compliantControls / summary.metrics.totalControls) * 100)}%)
            </span>
          </div>
          <Progress 
            value={(summary.metrics.compliantControls / summary.metrics.totalControls) * 100} 
            className="w-full"
            data-testid="progress-controls-implementation"
          />
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">{summary.metrics.compliantControls}</div>
              <div className="text-muted-foreground">Compliant</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600">{summary.metrics.nonCompliantControls}</div>
              <div className="text-muted-foreground">Non-Compliant</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-600">
                {summary.metrics.totalControls - summary.metrics.compliantControls - summary.metrics.nonCompliantControls}
              </div>
              <div className="text-muted-foreground">Not Assessed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assessment Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button 
          onClick={handleShowAssessmentConfig} 
          data-testid="button-run-assessment"
        >
          <Settings className="h-4 w-4 mr-2" />
          Configure & Run Assessment
        </Button>
        <Button 
          variant="outline"
          onClick={() => setShowScanUpload(true)}
          data-testid="button-upload-scan"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Scan Results
        </Button>
        <Button 
          variant="outline" 
          onClick={handleShowHistory}
          data-testid="button-view-history"
        >
          <History className="h-4 w-4 mr-2" />
          Assessment History
        </Button>
        {summary?.assessment?.id && (
          <Button 
            variant="outline"
            onClick={handleViewResults}
            data-testid="button-view-results"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Results
          </Button>
        )}
        <Button variant="outline" data-testid="button-export-results">
          <FileText className="h-4 w-4 mr-2" />
          Export Results
        </Button>
      </div>

      {/* Assessment Progress Tracker (if assessment is running) */}
      {(currentAssessmentId || assessmentStatus?.status === 'running') && (
        <AssessmentProgressTracker
          systemId={systemId}
          onComplete={handleProgressComplete}
        />
      )}

      {/* Detailed Assessment Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="assessment-tabs">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="risk" data-testid="tab-risk">
            Risk Matrix
          </TabsTrigger>
          <TabsTrigger value="findings" data-testid="tab-findings">
            Security Findings ({findings.length})
          </TabsTrigger>
          <TabsTrigger value="controls" data-testid="tab-controls">
            Control Assessments
          </TabsTrigger>
          <TabsTrigger value="stig" data-testid="tab-stig">
            STIG Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="risk" className="space-y-4" data-testid="tab-content-risk">
          <AssessmentRiskMatrix
            systemId={systemId}
            findings={findings}
            controls={systemControls}
          />
        </TabsContent>

        <TabsContent value="findings" className="space-y-4" data-testid="tab-content-findings">
          {/* Findings Filters */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search findings..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-8"
                data-testid="input-search-findings"
              />
            </div>
            <Select value={selectedSeverity} onValueChange={handleSeverityChange}>
              <SelectTrigger className="w-[180px]" data-testid="select-severity-filter">
                <SelectValue placeholder="All severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="informational">Informational</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="false_positive">False Positive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Findings Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Finding</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Control</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFindings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {findings.length === 0 ? 'No findings found' : 'No findings match current filters'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredFindings.map((finding) => (
                      <TableRow key={finding.id} data-testid={`finding-row-${finding.id}`}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{finding.title}</div>
                            <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                              {finding.description}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={getSeverityBadgeVariant(finding.severity)}
                            className="flex items-center gap-1 w-fit"
                          >
                            {getSeverityIcon(finding.severity)}
                            {finding.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(finding.status)}>
                            {finding.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {finding.controlId && (
                            <Badge variant="outline">{finding.controlId}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(finding.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            data-testid={`button-view-finding-${finding.id}`}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="controls" className="space-y-4" data-testid="tab-content-controls">
          <Card>
            <CardHeader>
              <CardTitle>Control Assessment Status</CardTitle>
              <CardDescription>
                Review implementation status and evidence for security controls
              </CardDescription>
            </CardHeader>
            <CardContent>
              {systemControls && systemControls.length > 0 ? (
                <div className="space-y-4">
                  {/* Control Status Summary */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{systemControls.length}</div>
                          <p className="text-sm text-muted-foreground">Total Controls</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {systemControls.filter((c: any) => c.status === 'compliant' || c.status === 'implemented').length}
                          </div>
                          <p className="text-sm text-muted-foreground">Implemented</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-600">
                            {systemControls.filter((c: any) => c.status === 'partial' || c.status === 'partially_implemented').length}
                          </div>
                          <p className="text-sm text-muted-foreground">Partially Implemented</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {systemControls.filter((c: any) => c.status === 'non_compliant' || c.status === 'not_implemented').length}
                          </div>
                          <p className="text-sm text-muted-foreground">Not Implemented</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Control Details Table */}
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Control ID</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Family</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Evidence</TableHead>
                          <TableHead>STIG Mappings</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {systemControls.map((control: any) => (
                          <TableRow key={control.controlId}>
                            <TableCell className="font-medium">
                              {control.controlId}
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              <div className="truncate" title={control.title}>
                                {control.title}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{control.family}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  control.status === 'compliant' || control.status === 'implemented' 
                                    ? 'default' 
                                    : control.status === 'partial' || control.status === 'partially_implemented'
                                    ? 'secondary'
                                    : 'destructive'
                                }
                              >
                                {control.status.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <FileText className="h-4 w-4" />
                                <span className="text-sm">{control.evidenceCount || 0}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Shield className="h-4 w-4" />
                                <span className="text-sm">{control.stigMappingCount || 0}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* If there are findings associated with controls */}
                  {findings.some((f: Finding) => f.controlId) && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Control-Related Findings</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {findings.filter((f: Finding) => f.controlId).slice(0, 5).map((finding: Finding) => (
                            <div key={finding.id} className="flex items-center justify-between p-2 border rounded">
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={finding.severity === 'critical' || finding.severity === 'high' ? 'destructive' : 'default'}
                                >
                                  {finding.severity}
                                </Badge>
                                <span className="text-sm">{finding.title}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                Control: {finding.controlId}
                              </span>
                            </div>
                          ))}
                          {findings.filter((f: Finding) => f.controlId).length > 5 && (
                            <p className="text-sm text-muted-foreground text-center mt-2">
                              And {findings.filter((f: Finding) => f.controlId).length - 5} more...
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="mx-auto h-12 w-12 mb-4" />
                  <p>No control assessments available.</p>
                  <p className="text-sm">Run an assessment to see control compliance data.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stig" className="space-y-4" data-testid="tab-content-stig">
          <Card>
            <CardHeader>
              <CardTitle>STIG Compliance Results</CardTitle>
              <CardDescription>
                Security Technical Implementation Guide rule assessments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assessmentResults ? (
                <div className="space-y-6">
                  {/* STIG Compliance Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-green-600">
                            {assessmentResults.stigCompliance?.stigCompliancePercentage || 0}%
                          </div>
                          <p className="text-sm text-muted-foreground">STIG Compliance</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold">
                            {assessmentResults.stigCompliance?.totalRules || 0}
                          </div>
                          <p className="text-sm text-muted-foreground">Total STIG Rules</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-red-600">
                            {assessmentResults.stigCompliance?.nonCompliantRules || 0}
                          </div>
                          <p className="text-sm text-muted-foreground">Non-Compliant Rules</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Rule Status Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Rule Status Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Compliant</span>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={assessmentResults.stigCompliance ? 
                              (assessmentResults.stigCompliance.compliantRules / assessmentResults.stigCompliance.totalRules) * 100 : 0
                            } 
                            className="w-[200px]" 
                          />
                          <span className="text-sm text-muted-foreground">
                            {assessmentResults.stigCompliance?.compliantRules || 0}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Non-Compliant</span>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={assessmentResults.stigCompliance ? 
                              (assessmentResults.stigCompliance.nonCompliantRules / assessmentResults.stigCompliance.totalRules) * 100 : 0
                            } 
                            className="w-[200px]" 
                          />
                          <span className="text-sm text-muted-foreground">
                            {assessmentResults.stigCompliance?.nonCompliantRules || 0}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Not Reviewed</span>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={assessmentResults.stigCompliance ? 
                              (assessmentResults.stigCompliance.notReviewedRules / assessmentResults.stigCompliance.totalRules) * 100 : 0
                            } 
                            className="w-[200px]" 
                          />
                          <span className="text-sm text-muted-foreground">
                            {assessmentResults.stigCompliance?.notReviewedRules || 0}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Associated Finding */}
                  {findings.length > 0 && findings.some(f => f.stigRuleId) && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">STIG-Related Findings</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {findings.filter(f => f.stigRuleId).map(finding => (
                            <div key={finding.id} className="flex items-center justify-between p-2 border rounded">
                              <div className="flex items-center gap-2">
                                <Badge variant={finding.severity === 'high' ? 'destructive' : 'default'}>
                                  {finding.severity}
                                </Badge>
                                <span className="text-sm">{finding.title}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                Rule: {finding.stigRuleId}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="mx-auto h-12 w-12 mb-4" />
                  <p>No STIG assessment results available.</p>
                  <p className="text-sm">Run an assessment to see STIG compliance data.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Last Assessment Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Last assessment: {new Date(summary.assessment.lastRun).toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              Assessment ID: <code className="text-xs">{summary.assessment.id}</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assessment Configuration Dialog */}
      {showAssessmentConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl max-h-[80vh] overflow-y-auto p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Configure Assessment</h2>
              <p className="text-sm text-gray-600">Configure and start a new security assessment for this system.</p>
            </div>
            <AssessmentInitiatorEnhanced
              systemId={systemId}
              onAssessmentStarted={handleAssessmentStarted}
            />
            <button
              onClick={handleHideAssessmentConfig}
              className="mt-4 px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Assessment History Dialog */}
      <Dialog open={showHistory} onOpenChange={(open) => open ? handleShowHistory() : handleHideHistory()}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assessment History</DialogTitle>
            <DialogDescription>
              View and compare previous assessment results for this system.
            </DialogDescription>
          </DialogHeader>
          <AssessmentHistory 
            systemId={systemId} 
            onViewResults={handleHistoryViewResults}
          />
        </DialogContent>
      </Dialog>

      {/* Assessment Results Detail Dialog */}
      <Dialog open={showResultsDetail} onOpenChange={(open) => open ? handleShowResultsDetail() : handleHideResultsDetail()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assessment Results Detail</DialogTitle>
            <DialogDescription>
              Detailed view of assessment findings and compliance status.
            </DialogDescription>
          </DialogHeader>
          <AssessmentResultsDetail 
            systemId={systemId} 
            assessmentId={selectedAssessmentId || undefined}
            onClose={handleHideResultsDetail}
          />
        </DialogContent>
      </Dialog>

      {/* Vulnerability Scan Upload Dialog */}
      <VulnerabilityScanUpload
        systemId={systemId}
        open={showScanUpload}
        onOpenChange={setShowScanUpload}
        onUploadComplete={() => {
          // Refresh findings and assessment data
          queryClient.invalidateQueries({ queryKey: ['/api/ingestion/systems', systemId, 'findings'] });
          queryClient.invalidateQueries({ queryKey: ['/api/assessment/systems', systemId] });
        }}
      />
    </div>
  );
}