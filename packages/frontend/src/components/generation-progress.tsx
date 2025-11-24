import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  FileText,
  Wand2,
  RefreshCw
} from 'lucide-react';

interface GenerationProgressProps {
  jobId: string;
  onComplete?: (result: any) => void;
  onError?: (error: any) => void;
  className?: string;
}

export function GenerationProgress({ jobId, onComplete, onError, className }: GenerationProgressProps) {
  const [isCompleted, setIsCompleted] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Poll for job status every 2 seconds
  const { data: jobStatus, error, refetch } = useQuery({
    queryKey: ['/api/generation/status', jobId],
    refetchInterval: isCompleted || hasError ? false : 2000,
    enabled: !!jobId && !isCompleted && !hasError,
  });

  useEffect(() => {
    const status = jobStatus as any;
    if (status?.status?.status === 'completed') {
      setIsCompleted(true);
      if (onComplete && status.result) {
        onComplete(status.result);
      }
    } else if (status?.status?.status === 'failed') {
      setHasError(true);
      if (onError) {
        onError(status.status.error || 'Generation failed');
      }
    }
  }, [jobStatus, onComplete, onError]);

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to fetch generation status: {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  const jobData = jobStatus as any;
  const status = jobData?.status;
  const progress = status?.progress || 0;
  const currentStep = status?.currentStep || 'Initializing...';
  const metadata = status?.metadata || {};

  const getStatusIcon = () => {
    switch (status?.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = () => {
    const variant = status?.status === 'completed' ? 'default' :
                   status?.status === 'failed' ? 'destructive' :
                   status?.status === 'running' ? 'secondary' : 'outline';
    
    return <Badge variant={variant}>{status?.status || 'pending'}</Badge>;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Narrative Generation Progress
          </CardTitle>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Generating implementation narratives for security controls
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          {getStatusIcon()}
          <span className="text-sm font-medium">{currentStep}</span>
        </div>

        <Progress value={progress} className="w-full" />
        
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{progress}% complete</span>
          {metadata.completedControls && metadata.totalControls && (
            <span>
              {metadata.completedControls} of {metadata.totalControls} controls
            </span>
          )}
        </div>

        {/* Show current control being processed */}
        {metadata.currentControl && status?.status === 'running' && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Processing:</span>
              <span>{metadata.currentControl}</span>
              {metadata.confidence && (
                <Badge variant="outline" className="ml-auto">
                  {metadata.confidence}% confidence
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Show steps if available */}
        {status?.steps && status.steps.length > 0 && (
          <div className="space-y-2 mt-4">
            <h4 className="text-sm font-medium">Generation Steps:</h4>
            <div className="space-y-1">
              {status.steps.map((step: any, index: number) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  {step.status === 'completed' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : step.status === 'running' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  ) : step.status === 'failed' ? (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-400" />
                  )}
                  <span className={step.status === 'running' ? 'font-medium' : ''}>
                    {step.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </span>
                  {step.error && (
                    <span className="text-xs text-red-500">({step.error})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Generation Failed</AlertTitle>
            <AlertDescription>
              {status?.error || 'An error occurred during narrative generation'}
            </AlertDescription>
          </Alert>
        )}

        {/* Success state */}
        {isCompleted && (
          <Alert className="mt-4 border-green-200 bg-green-50 dark:bg-green-950/20">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle>Generation Complete!</AlertTitle>
            <AlertDescription>
              Successfully generated narratives for all controls.
            </AlertDescription>
          </Alert>
        )}

        {/* Action buttons */}
        {(isCompleted || hasError) && (
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Status
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}