import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  History, 
  CheckCircle, 
  XCircle, 
  Clock,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  Download,
  Calendar
} from 'lucide-react';

interface AssessmentHistoryItem {
  assessmentId: string;
  status: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  summary: {
    overallCompliance: number;
    totalControls: number;
    compliantControls: number;
    totalFindings: number;
    criticalFindings: number;
  };
  assessedBy: string;
}

interface AssessmentHistoryProps {
  systemId: string;
  limit?: number;
  onViewResults?: (assessmentId: string) => void;
}

export function AssessmentHistory({ systemId, limit = 10, onViewResults }: AssessmentHistoryProps) {
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentHistoryItem | null>(null);
  const [offset, setOffset] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['/api/assessment/systems', systemId, 'history', limit, offset],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/assessment/systems/${systemId}/history?limit=${limit}&offset=${offset}`);
      if (!response.ok) {
        throw new Error('Failed to fetch assessment history');
      }
      return response.json();
    },
    enabled: !!systemId,
  });

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-600 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'secondary';
      case 'failed':
        return 'destructive';
      case 'running':
        return 'default';
      default:
        return 'outline';
    }
  };

  const getComplianceTrend = (current: number, previous?: number) => {
    if (!previous) return null;
    if (current > previous) return { icon: <TrendingUp className="h-3 w-3" />, color: 'text-green-600' };
    if (current < previous) return { icon: <TrendingDown className="h-3 w-3" />, color: 'text-red-600' };
    return { icon: <Minus className="h-3 w-3" />, color: 'text-gray-600' };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Assessment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading assessment history...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.assessments?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Assessment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4" />
            <p>No assessment history available for this system.</p>
            <p className="text-sm mt-2">Run an assessment to start building history.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card data-testid="assessment-history">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Assessment History
          </CardTitle>
          <CardDescription>
            Track compliance trends and assessment performance over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead>Findings</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Assessed By</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.assessments.map((assessment: AssessmentHistoryItem, index: number) => {
                const previousAssessment = data.assessments[index + 1];
                const trend = getComplianceTrend(
                  assessment.summary.overallCompliance,
                  previousAssessment?.summary.overallCompliance
                );

                return (
                  <TableRow key={assessment.assessmentId} data-testid={`history-row-${assessment.assessmentId}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <div>
                          <div className="text-sm">
                            {new Date(assessment.startTime).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(assessment.startTime).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={getStatusBadgeVariant(assessment.status)}
                        className="flex items-center gap-1 w-fit"
                      >
                        {getStatusIcon(assessment.status)}
                        {assessment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{assessment.summary.overallCompliance}%</span>
                        {trend && (
                          <span className={trend.color}>
                            {trend.icon}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">{assessment.summary.totalFindings} total</div>
                        {assessment.summary.criticalFindings > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {assessment.summary.criticalFindings} critical
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDuration(assessment.duration)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {assessment.assessedBy}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedAssessment(assessment)}
                        data-testid={`button-view-${assessment.assessmentId}`}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          {data.total > limit && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {offset + 1} to {Math.min(offset + limit, data.total)} of {data.total} assessments
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= data.total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assessment Details Dialog */}
      <Dialog open={!!selectedAssessment} onOpenChange={() => setSelectedAssessment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assessment Details</DialogTitle>
            <DialogDescription>
              {selectedAssessment?.assessmentId}
            </DialogDescription>
          </DialogHeader>
          {selectedAssessment && (
            <Tabs defaultValue="summary" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="metrics">Metrics</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>
              
              <TabsContent value="summary" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Assessment Date</div>
                    <div>{new Date(selectedAssessment.startTime).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Duration</div>
                    <div>{formatDuration(selectedAssessment.duration)}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Status</div>
                    <Badge variant={getStatusBadgeVariant(selectedAssessment.status)}>
                      {selectedAssessment.status}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Assessed By</div>
                    <div>{selectedAssessment.assessedBy}</div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="metrics" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Compliance Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{selectedAssessment.summary.overallCompliance}%</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedAssessment.summary.compliantControls} of {selectedAssessment.summary.totalControls} controls
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Total Findings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{selectedAssessment.summary.totalFindings}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedAssessment.summary.criticalFindings} critical findings
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="actions" className="space-y-4">
                <div className="flex flex-col gap-3">
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => {
                      if (onViewResults) {
                        onViewResults(selectedAssessment.assessmentId);
                        setSelectedAssessment(null);
                      }
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Full Results
                  </Button>
                  <Button variant="outline" className="justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    Download Results
                  </Button>
                  <Button variant="outline" className="justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    Compare with Previous
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}