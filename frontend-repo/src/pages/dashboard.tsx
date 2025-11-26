import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardStats } from "@/components/dashboard-stats";
import { SystemCard } from "@/components/system-card";
import { SystemRegistrationModal } from "@/components/system-registration-modal";
import { STIGMappingDialog } from "@/components/stig-mapping-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FileText, Download, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { System, ImpactLevelType, ComplianceStatusType } from "@shared/schema";

interface AnalyticsResponse {
  systems: {
    total: number;
    byImpactLevel: {
      High: number;
      Moderate: number;
      Low: number;
    };
    byComplianceStatus: {
      compliant: number;
      'non-compliant': number;
      'in-progress': number;
      'not-assessed': number;
    };
  };
}

export default function Dashboard() {
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [isSTIGMappingOpen, setIsSTIGMappingOpen] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState<string | undefined>();

  // Fetch recent systems (limited to 3 for dashboard)
  const { data: systemsResponse, isLoading: systemsLoading, error: systemsError } = useQuery({
    queryKey: ['/api/systems'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  }) as { data: { systems: System[], totalCount: number } | undefined, isLoading: boolean, error: Error | null };

  // Fetch analytics data for compliance summary
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/analytics/dashboard'],
    staleTime: 2 * 60 * 1000,
  }) as { data: any, isLoading: boolean };

  const safeAnalytics = analytics ?? {};
  const systemsByStatus = safeAnalytics.systems?.byComplianceStatus ?? {};
  const controlsStats = safeAnalytics.controls ?? {};
  const findingsStats = safeAnalytics.findings ?? {};

  const highTotal = safeAnalytics.systems?.byImpactLevel?.High ?? 0;
  const moderateTotal = safeAnalytics.systems?.byImpactLevel?.Moderate ?? 0;
  const lowTotal = safeAnalytics.systems?.byImpactLevel?.Low ?? 0;
  const compliantCount = systemsByStatus['compliant'] ?? 0;
  const overallBaseTotal = safeAnalytics.systems?.total ?? highTotal + moderateTotal + lowTotal;

  // Extract systems array from response
  const systems = systemsResponse?.systems || [];

  // Get recent systems (last 3) with enriched data
  // Filter out any undefined/null systems to prevent crashes
  const recentSystems = systems
    .filter((system) => system != null && system.name != null)
    .slice(0, 3)
    .map(system => ({
      ...system,
      controlsImplemented: Math.floor(Math.random() * 200) + 50, // TODO: Get from controls API
      totalControls: system.impactLevel === 'High' ? 324 : system.impactLevel === 'Moderate' ? 183 : 78,
      lastAssessment: '2 days ago', // TODO: Get from assessments API
    }));

  const handleViewSystem = (systemId: string) => {
    // Navigate to system detail page
    window.location.href = `/systems/${systemId}`;
  };

  const handleGenerateSSP = (systemId: string) => {
    console.log(`Generating SSP for system: ${systemId}`);
    // TODO: Navigate to document generation page with system pre-selected
  };

  const handleNewSystem = () => {
    setIsRegistrationModalOpen(true);
  };

  const handleGenerateReport = async () => {
    try {
      console.log('Generating compliance report');
      
      const response = await apiRequest('POST', '/api/reports/export', {
        format: 'json',
        includeFindings: true,
        includeEvidence: true
      });
      
      if (!response.ok) {
        throw new Error('Report export failed');
      }
      
      // Get the filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : 'compliance-report.json';
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('Compliance report downloaded successfully');
      alert('Compliance report has been downloaded successfully!');
      
    } catch (error) {
      console.error('Report export error:', error);
      alert(`Failed to generate compliance report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleQuickImportControls = async () => {
    // Navigate to controls page where they can import STIG controls
    window.location.href = '/controls';
  };

  const handleQuickGenerateSSP = () => {
    // Navigate to document generation page
    window.location.href = '/document-generation';
  };

  const handleSTIGMapping = () => {
    // Open STIG mapping dialog (will let user select system if none selected)
    setSelectedSystemId(undefined);
    setIsSTIGMappingOpen(true);
  };

  const deriveComplianceMetrics = (analyticsData: AnalyticsResponse | undefined) => {
    if (!analyticsData?.systems?.byImpactLevel || !analyticsData?.systems?.byComplianceStatus) {
      return null;
    }

    const byImpact = analyticsData.systems.byImpactLevel;
    const byCompliance = analyticsData.systems.byComplianceStatus;

    const impactLevels = ['High', 'Moderate', 'Low'] as const;
    const complianceStates = ['compliant', 'in-progress', 'non-compliant', 'not-assessed'] as const;

    const totals = impactLevels.reduce((acc, level) => {
      acc[level] = byImpact[level] ?? 0;
      return acc;
    }, {} as Record<typeof impactLevels[number], number>);

    const systemTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);
    const compliantTotal = byCompliance['compliant'] ?? 0;
    const inProgressTotal = byCompliance['in-progress'] ?? 0;
    const nonCompliantTotal = byCompliance['non-compliant'] ?? 0;
    const notAssessedTotal = byCompliance['not-assessed'] ?? 0;

    const distribute = (count: number) => impactLevels.reduce((acc, level) => {
      acc[level] = systemTotal > 0 ? Math.round(count * (totals[level] / systemTotal)) : 0;
      return acc;
    }, {} as Record<typeof impactLevels[number], number>);

    const compliantDistrib = distribute(compliantTotal);
    const inProgressDistrib = distribute(inProgressTotal);
    const nonCompliantDistrib = distribute(nonCompliantTotal);
    const notAssessedDistrib = distribute(notAssessedTotal);

    const normalize = (target: Record<string, number>) => {
      let allocated = 0;
      impactLevels.forEach(level => { allocated += target[level]; });
      if (systemTotal > 0 && allocated !== target.total) {
        const diff = target.total - allocated;
        target[impactLevels[impactLevels.length - 1]] += diff;
      }
      return target;
    };

    normalize({ ...compliantDistrib, total: compliantTotal });
    normalize({ ...inProgressDistrib, total: inProgressTotal });
    normalize({ ...nonCompliantDistrib, total: nonCompliantTotal });
    normalize({ ...notAssessedDistrib, total: notAssessedTotal });

    const combinedCompliant = impactLevels.reduce((acc, level) => {
      acc[level] = compliantDistrib[level];
      return acc;
    }, {} as Record<typeof impactLevels[number], number>);

    return {
      totals,
      compliant: combinedCompliant,
      inProgress: inProgressDistrib,
      nonCompliant: nonCompliantDistrib,
      notAssessed: notAssessedDistrib,
      overall: (() => {
        const totalCompliant = Object.values(combinedCompliant).reduce((sum, val) => sum + val, 0);
        return systemTotal > 0 ? Math.round((totalCompliant / systemTotal) * 100) : 0;
      })()
    };
  };

  const complianceMetrics = deriveComplianceMetrics(analytics);
  const overallCompliance = complianceMetrics?.overall ?? 0;

  return (
    <div className="space-y-8" data-testid="dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ATO Compliance Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your organization's security compliance status and ATO progress
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleGenerateReport}
            data-testid="button-generate-report"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button 
            onClick={handleNewSystem}
            data-testid="button-new-system"
          >
            <Plus className="h-4 w-4 mr-2" />
            Register System
          </Button>
        </div>
      </div>

      <DashboardStats />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Recent Systems
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {systemsLoading && (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="border-0 shadow-none bg-muted/30 h-32">
                      <CardHeader>
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-center">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-6 w-16" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {systemsError && (
                <Card className="border-0 shadow-none bg-muted/30 border-destructive">
                  <CardContent className="flex items-center justify-center py-6">
                    <div className="text-center">
                      <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-2" />
                      <p className="text-sm text-muted-foreground">{systemsError.message}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!systemsLoading && !systemsError && recentSystems.length === 0 && (
                <Card className="border-0 shadow-none bg-muted/30">
                  <CardContent className="flex items-center justify-center py-6">
                    <div className="text-center">
                      <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">No systems registered yet</p>
                      <Button onClick={handleNewSystem} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Register Your First System
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!systemsLoading && !systemsError && recentSystems.map((system) => (
                <SystemCard
                  key={system.id}
                  system={system}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onView={() => handleViewSystem(system.id)}
                  className="border-0 shadow-none bg-muted/30"
                />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={handleNewSystem}
                data-testid="button-quick-new-system"
              >
                <Plus className="h-4 w-4 mr-2" />
                Register New System
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={handleQuickImportControls}
                data-testid="button-quick-import-controls"
              >
                <Download className="h-4 w-4 mr-2" />
                Import STIG Controls
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={handleQuickGenerateSSP}
                data-testid="button-quick-generate-ssp"
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate SSP Document
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={handleSTIGMapping}
                data-testid="button-stig-mapping"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                View STIG/JSIG Mappings
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compliance Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analyticsLoading ? (
                <>
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </div>
                </>
              ) : complianceMetrics ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span>High Impact Systems</span>
                    <span className="font-medium">
                      {complianceMetrics.compliant.High} of {complianceMetrics.totals.High} compliant
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Moderate Impact Systems</span>
                    <span className="font-medium">
                      {complianceMetrics.compliant.Moderate} of {complianceMetrics.totals.Moderate} compliant
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Low Impact Systems</span>
                    <span className="font-medium">
                      {complianceMetrics.compliant.Low} of {complianceMetrics.totals.Low} compliant
                    </span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Overall Compliance</span>
                      <span className={overallCompliance >= 90 ? "text-green-600" : overallCompliance >= 70 ? "text-yellow-600" : "text-red-600"}>
                        {overallCompliance}%
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <AlertCircle className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Compliance data unavailable</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <SystemRegistrationModal 
        open={isRegistrationModalOpen}
        onOpenChange={setIsRegistrationModalOpen}
      />

      <STIGMappingDialog 
        open={isSTIGMappingOpen}
        onOpenChange={setIsSTIGMappingOpen}
        systemId={selectedSystemId}
      />
    </div>
  );
}