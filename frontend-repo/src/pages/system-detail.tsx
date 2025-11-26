import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { SystemDocuments } from "@/components/system-documents";
import { AssessmentDashboard } from "@/components/assessment-dashboard";
import { ControlsManager } from "@/components/controls-manager";
import { DocumentsTab } from "@/components/documents-tab";
import { QuickDocumentGenerator, DocumentType } from "@/components/quick-document-generator";
import { useToast } from "@/hooks/use-toast";
import { authenticatedFetch } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  Server, 
  Shield, 
  FileText, 
  Upload, 
  Settings, 
  AlertCircle,
  Calendar,
  User,
  Building2,
  BarChart3,
  Clock,
  Download,
  Eye,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import type { System, ComplianceStatusType } from "@shared/schema";

const impactLevelColors = {
  Low: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
  Moderate: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800",
  High: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
};

export default function SystemDetail() {
  const params = useParams();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const systemId = params.id as string;
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch system data
  const { data: system, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/systems', systemId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/systems/${systemId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('System not found');
        }
        throw new Error('Failed to fetch system');
      }
      return response.json() as Promise<System>;
    },
    enabled: !!systemId,
  });

  // Fetch system metrics data from real API (optional - returns default values if not available)
  const { data: systemMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/systems', systemId, 'metrics'],
    queryFn: async () => {
      try {
        const response = await authenticatedFetch(`/api/systems/${systemId}/metrics`);
        if (!response.ok) {
          // Return default metrics if endpoint doesn't exist yet
          return {
            controlsImplemented: 0,
            totalControls: 0,
            documentsCount: 0,
            findingsCount: 0,
            lastAssessment: 'Not assessed',
            nextAssessment: 'TBD',
            compliancePercentage: 0,
          };
        }
        return response.json() as Promise<{
          controlsImplemented: number;
          totalControls: number;
          documentsCount: number;
          findingsCount: number;
          lastAssessment: string;
          nextAssessment: string;
          compliancePercentage: number;
        }>;
      } catch (error) {
        // Return default metrics on error
        return {
          controlsImplemented: 0,
          totalControls: 0,
          documentsCount: 0,
          findingsCount: 0,
          lastAssessment: 'Not assessed',
          nextAssessment: 'TBD',
          compliancePercentage: 0,
        };
      }
    },
    enabled: !!systemId && !!system,
  });

  // Combine system data with metrics
  const enrichedData = system && systemMetrics ? {
    ...system,
    ...systemMetrics
  } : null;

  const handleBackToSystems = () => {
    setLocation('/systems');
  };

  // Document generation handlers
  const handleGenerateDocument = async (systemId: string, documentType: DocumentType) => {
    try {
      const response = await authenticatedFetch('/api/generation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemId,
          documentTypes: [documentType],
          includeEvidence: true,
          includeArtifacts: true,
          templateOptions: {
            organization: system?.category || 'Organization',
            customFields: {
              systemName: system?.name,
              description: system?.description || `${documentType} generation`
            }
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Document Generation Started",
          description: `Your ${documentType} document is being generated. You'll be notified when it's ready.`,
        });
        
        // Navigate to document generation page to track progress
        setLocation(`/document-generation?jobId=${result.jobId}`);
      } else {
        throw new Error(`Failed to start ${documentType} generation`);
      }
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const handleStartGuidedWorkflow = (systemId: string) => {
    setLocation(`/systems/${systemId}/ato-workflow`);
  };

  // Loading State
  if (isLoading || metricsLoading) {
    return (
      <div className="space-y-6" data-testid="system-detail-loading">
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-2" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-2" />
          <Skeleton className="h-6 w-32" />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-3 w-20 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="space-y-6" data-testid="system-detail-error">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBackToSystems}
            data-testid="button-back-to-systems"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Systems
          </Button>
        </div>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {error.message === 'System not found' ? 'System Not Found' : 'Error Loading System'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {error.message === 'System not found' 
                ? `The system with ID "${systemId}" could not be found. It may have been deleted or you may not have permission to access it.`
                : error.message
              }
            </p>
            <div className="flex gap-2">
              {error.message !== 'System not found' && (
                <Button onClick={() => refetch()} variant="outline">
                  Try Again
                </Button>
              )}
              <Button onClick={handleBackToSystems} variant="default">
                Back to Systems
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!system || !enrichedData) {
    return null;
  }

  const completionPercentage = enrichedData?.compliancePercentage ?? 0;

  return (
    <div className="space-y-6" data-testid="system-detail-page">
      {/* Breadcrumb Navigation */}
      <Breadcrumb data-testid="breadcrumb-navigation">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink 
              onClick={handleBackToSystems}
              className="cursor-pointer hover:text-primary"
              data-testid="breadcrumb-systems"
            >
              IT Systems
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage data-testid="breadcrumb-current-system">{system.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight" data-testid="system-name">{system.name}</h1>
            <StatusBadge status={system.complianceStatus as ComplianceStatusType} />
            <Badge variant="outline" className={impactLevelColors[system.impactLevel as keyof typeof impactLevelColors]}>
              {system.impactLevel} Impact
            </Badge>
          </div>
          <p className="text-muted-foreground" data-testid="system-description">
            {system.description || 'No description provided'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setLocation(`/assessment-management/${systemId}`)}
            data-testid="button-assessment-management"
          >
            <Shield className="h-4 w-4 mr-2" />
            Assessment Management
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setActiveTab("controls")}
            data-testid="button-view-controls"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Controls
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setActiveTab("assessment")}
            data-testid="button-view-findings"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            View Findings
          </Button>
          <Button 
            variant="outline" 
            onClick={handleBackToSystems}
            data-testid="button-back-header"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Systems
          </Button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="metric-controls-implementation">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Controls Implementation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionPercentage}%</div>
            <p className="text-xs text-muted-foreground">
              {enrichedData.controlsImplemented} of {enrichedData.totalControls} implemented
            </p>
          </CardContent>
        </Card>
        
        <Card data-testid="metric-documents">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enrichedData.documentsCount}</div>
            <p className="text-xs text-muted-foreground">Total documents</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-findings">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Active Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enrichedData.findingsCount}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-last-assessment">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Last Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enrichedData.lastAssessment}</div>
            <p className="text-xs text-muted-foreground">Next: {enrichedData.nextAssessment}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 justify-between">
        <QuickDocumentGenerator
          systemId={systemId}
          systemName={system.name}
          onDocumentGenerate={handleGenerateDocument}
          onStartGuidedWorkflow={handleStartGuidedWorkflow}
          variant="compact"
        />
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            refetch();
            toast({
              title: "Data Refreshed",
              description: "System data has been refreshed successfully.",
            });
          }}
          data-testid="button-refresh-data"
        >
          <Clock className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      {/* Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4" data-testid="system-tabs">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Server className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="controls" data-testid="tab-controls">
            <Shield className="h-4 w-4 mr-2" />
            Controls
          </TabsTrigger>
          <TabsTrigger value="assessment" data-testid="tab-assessment">
            <BarChart3 className="h-4 w-4 mr-2" />
            Assessment
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileText className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="onboarding" data-testid="tab-onboarding">
            <Upload className="h-4 w-4 mr-2" />
            Onboarding
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6" data-testid="tab-content-overview">
          <div className="grid gap-6 md:grid-cols-2">
            {/* System Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  System Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">System ID</span>
                    <span className="text-sm text-muted-foreground font-mono" data-testid="system-id">{system.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Category</span>
                    <span className="text-sm text-muted-foreground" data-testid="system-category">{system.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Impact Level</span>
                    <Badge variant="outline" className={impactLevelColors[system.impactLevel as keyof typeof impactLevelColors]}>
                      {system.impactLevel}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Compliance Status</span>
                    <StatusBadge status={system.complianceStatus as ComplianceStatusType} />
                  </div>
                  {system.owner && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Owner</span>
                      <span className="text-sm text-muted-foreground flex items-center gap-1" data-testid="system-owner">
                        <User className="h-3 w-3" />
                        {system.owner}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Created</span>
                    <span className="text-sm text-muted-foreground flex items-center gap-1" data-testid="system-created">
                      <Calendar className="h-3 w-3" />
                      {system.createdAt ? new Date(system.createdAt).toLocaleDateString() : 'Unknown'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Compliance Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Compliance Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Controls Implementation</span>
                    <span className="font-medium">{enrichedData.controlsImplemented}/{enrichedData.totalControls} ({completionPercentage}%)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Active Findings</span>
                    <span className="font-medium text-destructive">{enrichedData.findingsCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Documents</span>
                    <span className="font-medium">{enrichedData.documentsCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Last Assessment</span>
                    <span className="font-medium">{enrichedData.lastAssessment}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Next Assessment</span>
                    <span className="font-medium">{enrichedData.nextAssessment}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Description */}
          {system.description && (
            <Card>
              <CardHeader>
                <CardTitle>System Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed" data-testid="system-full-description">
                  {system.description}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="controls" className="space-y-4" data-testid="tab-content-controls" id="controls-section">
          <ControlsManager systemId={systemId} />
        </TabsContent>

        <TabsContent value="assessment" className="space-y-4" data-testid="tab-content-assessment" id="findings-section">
          <AssessmentDashboard systemId={systemId} />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4" data-testid="tab-content-documents">
          <DocumentsTab systemId={systemId} />
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-4" data-testid="tab-content-onboarding">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                System Onboarding
              </CardTitle>
            </CardHeader>
            <CardContent className="py-8">
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">File Upload & Data Import</h3>
                <p className="text-muted-foreground mb-4">
                  Upload security scans, configuration files, and other artifacts to enhance compliance assessment.
                </p>
                <Button variant="outline" onClick={() => window.location.href = '/data-ingestion'} data-testid="button-upload-files">
                  Upload Files
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4" data-testid="tab-content-settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                System Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">System Configuration</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure system settings, ownership, and compliance parameters.
                  </p>
                  <Button variant="outline" onClick={() => toast({ title: "Feature Coming Soon", description: "System configuration interface will be available in the next update." })}>
                    Edit System Settings
                  </Button>
                </div>
                
                <div className="pt-4 border-t">
                  <h3 className="text-lg font-medium mb-2">Notifications</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Manage assessment reminders and compliance alerts for this system.
                  </p>
                  <Button variant="outline" onClick={() => toast({ title: "Feature Coming Soon", description: "Notification management will be available in the next update." })}>
                    Configure Notifications
                  </Button>
                </div>
                
                <div className="pt-4 border-t">
                  <h3 className="text-lg font-medium mb-2 text-destructive">Danger Zone</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanent actions that cannot be undone.
                  </p>
                  <Button 
                    variant="destructive" 
                    onClick={() => toast({ 
                      title: "System Deletion", 
                      description: "System deletion interface will be available in the next update.",
                      variant: "destructive"
                    })}
                  >
                    Delete System
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}