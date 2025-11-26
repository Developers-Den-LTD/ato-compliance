import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Play, 
  Pause,
  FileText,
  Database,
  Shield,
  Eye,
  AlertCircle
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface JobStatus {
  id: string;
  systemId: string;
  type: 'assessment' | 'data_ingestion' | 'document_generation' | 'stig_import';
  status: 'pending' | 'processing' | 'running' | 'completed' | 'completed_with_errors' | 'failed';
  progress: number;
  createdAt: string;
  endTime?: string;
  metadata?: {
    currentStep?: string;
    error?: string;
    estimatedDuration?: string;
    totalControls?: number;
    compliancePercentage?: number;
    findingsCreated?: number;
    documentsGenerated?: number;
    [key: string]: any;
  };
  relatedDocuments?: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    fileSize?: number;
    createdAt: string;
  }>;
}

interface JobMonitorProps {
  systemId: string;
  className?: string;
}

const getJobTypeIcon = (type: string) => {
  switch (type) {
    case 'assessment': return Shield;
    case 'data_ingestion': return Database;
    case 'document_generation': return FileText;
    case 'stig_import': return RefreshCw;
    default: return Clock;
  }
};

const getJobTypeLabel = (type: string) => {
  switch (type) {
    case 'assessment': return 'System Assessment';
    case 'data_ingestion': return 'Data Ingestion';
    case 'document_generation': return 'Document Generation';
    case 'stig_import': return 'STIG Import';
    default: return type;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    case 'completed_with_errors': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    case 'running': 
    case 'processing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed': return CheckCircle;
    case 'completed_with_errors': return AlertTriangle;
    case 'failed': return AlertCircle;
    case 'running': 
    case 'processing': return RefreshCw;
    case 'pending': return Clock;
    default: return Clock;
  }
};

export function JobMonitor({ systemId, className }: JobMonitorProps) {
  const [pollInterval, setPollInterval] = useState<number | false>(false);

  // Query for jobs related to this system
  const { data: jobs, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/jobs', systemId],
    queryFn: async () => {
      const getAuthToken = () => localStorage.getItem('sessionToken');
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['X-Session-Token'] = token;
      } else {
        headers['Authorization'] = 'Bearer dev-token-123';
      }
      
      const response = await fetch(`/api/jobs?systemId=${systemId}&limit=10`, {
        headers,
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch jobs');
      }
      const result = await response.json();
      return result.jobs as JobStatus[];
    },
    refetchInterval: pollInterval,
  });

  // Determine if we should poll (if there are running jobs)
  useEffect(() => {
    const hasRunningJobs = jobs?.some(job => 
      job.status === 'running' || job.status === 'processing' || job.status === 'pending'
    );
    
    setPollInterval(hasRunningJobs ? 3000 : false); // Poll every 3 seconds if jobs are running
  }, [jobs]);

  if (isLoading) {
    return (
      <Card className={className} data-testid="card-job-monitor-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Job Status
          </CardTitle>
          <CardDescription>
            Monitoring active and recent jobs for this system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-3/4" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className} data-testid="card-job-monitor-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Job Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load job status. Please try refreshing the page.
            </AlertDescription>
          </Alert>
          <Button 
            onClick={() => refetch()} 
            variant="outline" 
            className="mt-4"
            data-testid="button-retry-jobs"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const runningJobs = jobs?.filter(job => 
    job.status === 'running' || job.status === 'processing' || job.status === 'pending'
  ) || [];
  
  const recentJobs = jobs?.filter(job => 
    job.status === 'completed' || job.status === 'completed_with_errors' || job.status === 'failed'
  ).slice(0, 5) || [];

  return (
    <Card className={className} data-testid="card-job-monitor">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Job Status
          {pollInterval && (
            <Badge variant="outline" className="ml-auto">
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Live
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Monitoring active and recent jobs for this system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Running Jobs */}
        {runningJobs.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-blue-500" />
              <h4 className="font-medium">Active Jobs ({runningJobs.length})</h4>
            </div>
            {runningJobs.map((job) => {
              const JobIcon = getJobTypeIcon(job.type);
              const StatusIcon = getStatusIcon(job.status);
              
              return (
                <div 
                  key={job.id} 
                  className="p-4 border rounded-lg space-y-3"
                  data-testid={`job-active-${job.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <JobIcon className="h-4 w-4" />
                      <span className="font-medium">{getJobTypeLabel(job.type)}</span>
                    </div>
                    <Badge className={getStatusColor(job.status)}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {job.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{job.progress}%</span>
                    </div>
                    <Progress value={job.progress} className="h-2" />
                  </div>
                  
                  {job.metadata?.currentStep && (
                    <div className="text-sm text-muted-foreground">
                      Current step: {job.metadata.currentStep}
                    </div>
                  )}
                  
                  {job.metadata?.error && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        {job.metadata.error}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Started {formatDistanceToNow(parseISO(job.createdAt))} ago</span>
                    {job.metadata?.estimatedDuration && (
                      <span>Est. {job.metadata.estimatedDuration}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {runningJobs.length > 0 && recentJobs.length > 0 && <Separator />}

        {/* Recent Jobs */}
        {recentJobs.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-gray-500" />
              <h4 className="font-medium">Recent Jobs</h4>
            </div>
            <div className="space-y-2">
              {recentJobs.map((job) => {
                const JobIcon = getJobTypeIcon(job.type);
                const StatusIcon = getStatusIcon(job.status);
                
                return (
                  <div 
                    key={job.id} 
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`job-recent-${job.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <JobIcon className="h-4 w-4" />
                      <div>
                        <div className="font-medium text-sm">{getJobTypeLabel(job.type)}</div>
                        <div className="text-xs text-muted-foreground">
                          {job.endTime ? 
                            `Completed ${formatDistanceToNow(parseISO(job.endTime))} ago` :
                            `Started ${formatDistanceToNow(parseISO(job.createdAt))} ago`
                          }
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.metadata?.totalControls && (
                        <span className="text-xs text-muted-foreground">
                          {job.metadata.totalControls} controls
                        </span>
                      )}
                      {job.metadata?.compliancePercentage && (
                        <span className="text-xs text-muted-foreground">
                          {job.metadata.compliancePercentage}% compliant
                        </span>
                      )}
                      {job.relatedDocuments && job.relatedDocuments.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {job.relatedDocuments.length} docs
                        </span>
                      )}
                      <Badge variant="outline" className={getStatusColor(job.status)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {job.status === 'completed_with_errors' ? 'Warning' : 
                         job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No Jobs */}
        {jobs && jobs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-4 opacity-50" />
            <p>No jobs found for this system</p>
            <p className="text-sm">Jobs will appear here when assessments, ingestion, or generation tasks are started</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}