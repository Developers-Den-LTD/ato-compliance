import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ControlTable } from "@/components/control-table";
import { ControlImportDialog } from "@/components/control-import-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Import, Download, Shield, AlertCircle, Upload } from "lucide-react";
import type { Control } from "@shared/schema";

interface ControlsResponse {
  controls: Control[];
  total: number;
  filters: {
    family?: string;
    baseline?: string;
    status?: string;
    limit: number;
  };
}

export default function Controls() {
  const [selectedFamily, setSelectedFamily] = useState<string>("");
  const [selectedBaseline, setSelectedBaseline] = useState<string>("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch controls from API
  const { data: controlsResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/controls', 'v2', { family: selectedFamily, baseline: selectedBaseline }],
    queryFn: async ({ queryKey }) => {
      const [endpoint, params] = queryKey as [string, Record<string, string>];
      const searchParams = new URLSearchParams();
      if (params.family) searchParams.append('family', params.family);
      if (params.baseline) searchParams.append('baseline', params.baseline);
      searchParams.append('limit', '2000');
      
      const url = params.family || params.baseline ? 
        `${endpoint}?${searchParams.toString()}` : endpoint;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': 'Bearer dev-token-123'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch controls: ${response.status}`);
      }
      
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  }) as { data: ControlsResponse | undefined, isLoading: boolean, error: Error | null, refetch: () => void };

  // Extract controls from response
  const controls = controlsResponse?.controls || [];

  // Update control status mutation
  const updateControlMutation = useMutation({
    mutationFn: async ({ controlId, updates }: { controlId: string, updates: Partial<Control> }) => {
      const response = await apiRequest('PUT', `/api/controls/${controlId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/controls', 'v2'] });
      toast({
        title: "Success",
        description: "Control updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update control: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Calculate family statistics from real data
  const familyStats = useMemo(() => {
    const stats: Record<string, { total: number; implemented: number }> = {};
    
    controls.forEach(control => {
      if (!stats[control.family]) {
        stats[control.family] = { total: 0, implemented: 0 };
      }
      stats[control.family].total += 1;
      if (control.status === 'implemented') {
        stats[control.family].implemented += 1;
      }
    });
    
    return stats;
  }, [controls]);

  // Get unique families and baselines for filtering
  const uniqueFamilies = useMemo(() => {
    const families = [...new Set(controls.map(c => c.family))];
    return families.sort();
  }, [controls]);

  const uniqueBaselines = useMemo(() => {
    const baselines = [...new Set(controls.flatMap(c => c.baseline || []))];
    return baselines.sort();
  }, [controls]);

  // Transform controls data for ControlTable component
  const transformedControls = controls.map(control => ({
    id: control.id,
    family: control.family,
    title: control.title,
    baseline: (Array.isArray(control.baseline) ? control.baseline[0] : control.baseline) as "Low" | "Moderate" | "High",
    implementationStatus: control.status === 'implemented' ? 'compliant' as const :
                         control.status === 'partially_implemented' ? 'in-progress' as const :
                         control.status === 'not_implemented' ? 'not-assessed' as const :
                         'non-compliant' as const,
    lastAssessed: control.createdAt ? new Date(control.createdAt).toISOString().split('T')[0] : undefined,
    assignedTo: "System Admin" // TODO: Add assignedTo field to Control schema
  }));

  const handleViewControl = (controlId: string) => {
    console.log(`Viewing control: ${controlId}`);
    // TODO: Navigate to control details page or open modal
  };

  const handleUpdateControlStatus = (controlId: string, status: string) => {
    const mappedStatus = status === 'compliant' ? 'implemented' :
                        status === 'in-progress' ? 'partially_implemented' :
                        status === 'non-compliant' ? 'not_implemented' : 'not_implemented';
    
    updateControlMutation.mutate({
      controlId,
      updates: { status: mappedStatus }
    });
  };

  const handleImportSTIG = async () => {
    console.log('Importing STIG controls');
    try {
      // Check current STIG status
      const response = await fetch('/api/assessment/rule-types', {
        headers: {
          'Authorization': 'Bearer dev-token-123'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch STIG status');
      }
      
      const stigStatus = await response.json();
      
      // Show STIG import status
      toast({
        title: "STIG Rules Status",
        description: `✅ ${stigStatus.summary.stig.totalRules} STIG rules and ${stigStatus.summary.jsig.totalRules} JSIG rules are available.\n\nSTIG rules are automatically loaded during system initialization.`,
      });
      
    } catch (error) {
      console.error('STIG import error:', error);
      toast({
        title: "STIG Import Error", 
        description: "Failed to check STIG status. STIG rules should be automatically loaded during database initialization.",
        variant: "destructive",
      });
    }
  };

  const handleExportControls = () => {
    console.log('Exporting controls');
    // TODO: Implement controls export functionality
  };

  return (
    <div className="space-y-6" data-testid="controls-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NIST 800-53 Controls</h1>
          <p className="text-muted-foreground">
            Manage and track implementation status of security controls across your systems
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setImportDialogOpen(true)}
            data-testid="button-import-controls"
            disabled={isLoading}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import/Export Controls
          </Button>
          <Button 
            variant="outline" 
            onClick={handleExportControls}
            data-testid="button-export-controls"
            disabled={isLoading}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button 
            onClick={handleImportSTIG}
            data-testid="button-import-stig"
            disabled={isLoading}
          >
            <Import className="h-4 w-4 mr-2" />
            Import STIG
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={selectedFamily}
          onChange={(e) => setSelectedFamily(e.target.value)}
          className="px-3 py-2 border border-input bg-background rounded-md text-sm"
          data-testid="select-family-filter"
          disabled={isLoading}
        >
          <option value="">All Families</option>
          {uniqueFamilies.map(family => (
            <option key={family} value={family}>{family}</option>
          ))}
        </select>
        
        <select
          value={selectedBaseline}
          onChange={(e) => setSelectedBaseline(e.target.value)}
          className="px-3 py-2 border border-input bg-background rounded-md text-sm"
          data-testid="select-baseline-filter"
          disabled={isLoading}
        >
          <option value="">All Baselines</option>
          {uniqueBaselines.map(baseline => (
            <option key={baseline} value={baseline}>{baseline}</option>
          ))}
        </select>

        {(selectedFamily || selectedBaseline) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedFamily("");
              setSelectedBaseline("");
            }}
            data-testid="button-clear-filters"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-2 flex-1" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-24" />
                </div>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error Loading Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error.message}</p>
            <Button onClick={() => refetch()} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Family Statistics */}
      {!isLoading && !error && (
        <>
          {Object.keys(familyStats).length > 0 && (
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Object.entries(familyStats).map(([family, stats]) => {
                const percentage = stats.total > 0 ? Math.round((stats.implemented / stats.total) * 100) : 0;
                return (
                  <Card key={family} className="hover-elevate">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate" title={family}>{family}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.implemented}/{stats.total}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <Badge 
                          variant="outline" 
                          className={percentage >= 90 ? "text-green-600" : percentage >= 70 ? "text-yellow-600" : "text-red-600"}
                        >
                          {percentage}%
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Controls Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Security Controls
                <Badge variant="outline">
                  {transformedControls.length} controls
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transformedControls.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-medium text-muted-foreground">No controls found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedFamily || selectedBaseline 
                      ? 'Try adjusting your filter criteria.' 
                      : 'Controls will appear here once they are imported or created.'
                    }
                  </p>
                </div>
              ) : (
                <ControlTable 
                  controls={transformedControls}
                  onViewControl={handleViewControl}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Control Import/Export Dialog */}
      <ControlImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
    </div>
  );
}