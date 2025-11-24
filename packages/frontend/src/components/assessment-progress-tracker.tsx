import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Clock,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';

interface AssessmentProgressTrackerProps {
  systemId: string;
  onComplete?: () => void;
}

interface AssessmentStatus {
  assessmentId: string;
  systemId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime: string;
  endTime?: string;
  currentStep: string;
  errors?: string[];
  estimatedTimeRemaining?: number;
  summary?: any;
  findings?: any;
}

export function AssessmentProgressTracker({ systemId, onComplete }: AssessmentProgressTrackerProps) {
  const [isPolling, setIsPolling] = useState(true);

  // Poll assessment status every 2 seconds while running
  const { data: status, refetch, isLoading } = useQuery<AssessmentStatus>({
    queryKey: ['/api/assessment/systems', systemId, 'status'],
    queryFn: async () => {
      const response = await fetch(`/api/assessment/systems/${systemId}/status`);
      if (!response.ok) {
        throw new Error('Failed to fetch assessment status');
      }
      return response.json();
    },
    enabled: !!systemId,
    refetchInterval: (data) => (data as any)?.status === 'running' && isPolling ? 2000 : false,
  });

  // Call onComplete when assessment finishes
  useEffect(() => {
    if (status?.status === 'completed' && onComplete) {
      onComplete();
    }
  }, [status?.status, onComplete]);

  // Format time remaining
  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds) return 'Calculating...';
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Get status icon
  const getStatusIcon = () => {
    switch (status?.status) {
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  // Get status badge variant
  const getStatusBadgeVariant = () => {
    switch (status?.status) {
      case 'running':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (isLoading && !status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading Assessment Status...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!status) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No assessment data available. Start a new assessment to track progress.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card data-testid="assessment-progress-tracker">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon()}
              Assessment Progress
            </CardTitle>
            <CardDescription>
              {status.assessmentId}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusBadgeVariant()}>
              {status.status.toUpperCase()}
            </Badge>
            {status.status === 'running' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsPolling(!isPolling)}
                data-testid="button-toggle-polling"
              >
                {isPolling ? (
                  <>
                    <Pause className="h-3 w-3 mr-1" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 mr-1" />
                    Resume
                  </>
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              data-testid="button-refresh"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{status.progress}%</span>
          </div>
          <Progress 
            value={status.progress} 
            className="h-2"
            data-testid="progress-assessment"
          />
        </div>

        {/* Current Step */}
        <div className="space-y-1">
          <div className="text-sm font-medium">Current Step</div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {status.status === 'running' && (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
            {status.currentStep}
          </div>
        </div>

        {/* Time Information */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-medium">Started</div>
            <div className="text-muted-foreground">
              {new Date(status.startTime).toLocaleTimeString()}
            </div>
          </div>
          {status.status === 'running' && status.estimatedTimeRemaining !== undefined ? (
            <div>
              <div className="font-medium">Est. Time Remaining</div>
              <div className="text-muted-foreground">
                {formatTimeRemaining(status.estimatedTimeRemaining)}
              </div>
            </div>
          ) : status.endTime ? (
            <div>
              <div className="font-medium">Completed</div>
              <div className="text-muted-foreground">
                {new Date(status.endTime).toLocaleTimeString()}
              </div>
            </div>
          ) : null}
        </div>

        {/* Summary Preview (for completed assessments) */}
        {status.status === 'completed' && status.summary && (
          <div className="border-t pt-4 space-y-2">
            <div className="text-sm font-medium">Summary</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Compliance: </span>
                <span className="font-medium">{status.summary.overallCompliancePercentage}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Risk Score: </span>
                <span className="font-medium">{status.summary.riskScore}</span>
              </div>
            </div>
          </div>
        )}

        {/* Errors */}
        {status.errors && status.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-1">Assessment Errors:</div>
              <ul className="list-disc list-inside text-sm">
                {status.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}