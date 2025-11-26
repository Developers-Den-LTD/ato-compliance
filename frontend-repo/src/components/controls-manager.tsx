import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest, authenticatedFetch } from '@/lib/queryClient';
import { 
  Shield, 
  Edit, 
  Save, 
  Search, 
  Filter, 
  Plus, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Eye,
  BookOpen,
  Users,
  Target,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { SimpleBaselineAssignment } from './simple-baseline-assignment';

interface Control {
  id: string;
  family: string;
  title: string;
  description: string;
  baseline: string[];
  priority: string;
  enhancement?: string;
  status: string;
}

interface SystemControl {
  id: string;
  systemId: string;
  controlId: string;
  status: 'not_implemented' | 'partial' | 'implemented' | 'not_applicable';
  assignedTo?: string;
  implementationText?: string;
  lastUpdated: string;
}

interface ControlsManagerProps {
  systemId: string;
}

export function ControlsManager({ systemId }: ControlsManagerProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [editingControl, setEditingControl] = useState<string | null>(null);
  const [narrativeText, setNarrativeText] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'assigned' | 'all'>('assigned');
  const [showBaselineAssignment, setShowBaselineAssignment] = useState(false);
  const [generatingNarratives, setGeneratingNarratives] = useState(false);
  const [narrativeGenerationProgress, setNarrativeGenerationProgress] = useState<{
    progress: number;
    currentControl?: string;
    processedControls: number;
    totalControls: number;
  } | null>(null);

  // Fetch all controls for the system's impact level
  const { data: controlsData, isLoading: controlsLoading } = useQuery({
    queryKey: ['/api/controls'],
    queryFn: async () => {
      const response = await authenticatedFetch('/api/controls?limit=2000');
      if (!response.ok) throw new Error('Failed to fetch controls');
      const data = await response.json();
      return data;
    }
  });

  // Extract controls array from the response
  const controls = Array.isArray(controlsData?.controls) ? controlsData.controls : [];

  // Fetch system controls (implementation status and narratives)
  const { data: systemControlsResponse, isLoading: systemControlsLoading, refetch: refetchSystemControls } = useQuery({
    queryKey: ['systemControls', systemId],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      
      const response = await fetch(`/api/systems/${systemId}/controls`, {
        headers,
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch system controls');
      const data = await response.json();
      
      // The API returns { systemControls: [...], pagination: {...} }
      return data.systemControls || [];
    },
    enabled: !!systemId,
    staleTime: 0, // Always fetch fresh data
    gcTime: 0 // Don't cache
  });

  const systemControls = systemControlsResponse || [];

  // Save implementation narrative
  const saveNarrative = useMutation({
    mutationFn: async ({ controlId, narrative, status, assignedTo }: {
      controlId: string;
      narrative: string;
      status: string;
      assignedTo?: string;
    }) => {
      const token = localStorage.getItem('accessToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      
      const response = await fetch(`/api/systems/${systemId}/controls/${controlId}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          implementationText: narrative,
          status,
          responsibleParty: assignedTo
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save narrative');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Narrative Saved',
        description: 'Implementation narrative has been successfully saved.',
      });
      // Invalidate related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/systems', systemId, 'controls'] });
      queryClient.invalidateQueries({ queryKey: ['/api/systems', systemId, 'metrics'] });
      setIsDialogOpen(false);
      setEditingControl(null);
      setNarrativeText('');
    },
    onError: (error: any) => {
      console.error('Failed to save narrative:', error);
      toast({
        title: 'Save Failed',
        description: error?.message || error?.error || 'Failed to save implementation narrative.',
        variant: 'destructive',
      });
    }
  });

  // Get unique control families for filtering
  const controlFamilies = Array.from(new Set(controls.map((c: Control) => c.family))).sort();

  // Create a lookup for system controls
  const systemControlsLookup: Record<string, SystemControl> = {};
  for (const sc of systemControls) {
    systemControlsLookup[sc.controlId] = sc;
  }

  // Filter controls based on search and filters
  let filteredControls: Control[] = [];
  if (activeTab === 'assigned') {
    // For assigned controls, get all controls that have system controls
    filteredControls = controls.filter((control: any) => {
      const systemControl = systemControlsLookup[control.id];
      if (!systemControl) return false;
      
      const matchesSearch = searchQuery === '' || 
        control.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        control.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        control.family.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFamily = selectedFamily === 'all' || control.family === selectedFamily;
      const matchesStatus = selectedStatus === 'all' || 
        systemControl.status === selectedStatus;
      
      return matchesSearch && matchesFamily && matchesStatus;
    });
  } else {
    // For all controls, filter the controls array
    filteredControls = controls.filter((control: any) => {
      const systemControl = systemControlsLookup[control.id];
      
      const matchesSearch = searchQuery === '' || 
        control.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        control.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        control.family.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFamily = selectedFamily === 'all' || control.family === selectedFamily;
      const matchesStatus = selectedStatus === 'all' || 
        (systemControl?.status || 'not_implemented') === selectedStatus;
      
      return matchesSearch && matchesFamily && matchesStatus;
    });
  }

  // Calculate stats after filteredControls is defined
  const getProgressStats = () => {
    const total = activeTab === 'assigned' ? systemControls.length : filteredControls.length;
    
    if (activeTab === 'assigned') {
      const implemented = systemControls.filter(sc => sc.status === 'implemented').length;
      const withNarratives = systemControls.filter(sc => sc.implementationText?.trim()).length;
      return { total, implemented, withNarratives };
    } else {
      const implemented = filteredControls.filter(c => 
        systemControlsLookup[c.id]?.status === 'implemented'
      ).length;
      const withNarratives = filteredControls.filter(c => 
        systemControlsLookup[c.id]?.implementationText?.trim()
      ).length;
      return { total, implemented, withNarratives };
    }
  };

  const stats = getProgressStats();

  const handleEditNarrative = (control: any) => {
    const systemControl = systemControlsLookup[control.id];
    setEditingControl(control.id);
    setNarrativeText(systemControl?.implementationText || '');
    setIsDialogOpen(true);
  };

  const handleReviewNarrative = (control: any) => {
    const systemControl = systemControlsLookup[control.id];
    setEditingControl(control.id);
    setNarrativeText(systemControl?.implementationText || '');
    setIsDialogOpen(true);
  };

  const handleStatusChange = async (controlId: string, newStatus: string) => {
    try {
      const systemControl = systemControlsLookup[controlId];
      const token = localStorage.getItem('accessToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      
      const response = await fetch(`/api/systems/${systemId}/controls/${controlId}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          implementationText: systemControl?.implementationText,
          status: newStatus,
          responsibleParty: systemControl?.assignedTo
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update status');
      }
      
      toast({
        title: 'Status Updated',
        description: `Control status updated to ${newStatus}`,
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['systemControls', systemId] });
      queryClient.invalidateQueries({ queryKey: ['/api/systems', systemId, 'metrics'] });
    } catch (error: any) {
      console.error('Failed to update status:', error);
      toast({
        title: 'Update Failed',
        description: error?.message || 'Failed to update control status.',
        variant: 'destructive',
      });
    }
  };

  // Narrative generation is now synchronous - no polling needed

  const handleSaveNarrative = () => {
    if (!editingControl) return;
    
    const systemControl = systemControlsLookup[editingControl];
    const hasNarrative = narrativeText.trim().length > 0;
    
    // Automatically set status to 'implemented' if narrative is completed
    const newStatus = hasNarrative ? 'implemented' : (systemControl?.status || 'partial');
    
    console.log('Saving narrative:', { editingControl, hasNarrative, newStatus, narrativeLength: narrativeText.trim().length });
    
    saveNarrative.mutate({
      controlId: editingControl,
      narrative: narrativeText,
      status: newStatus,
      assignedTo: systemControl?.assignedTo
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'implemented':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'partial':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'not_applicable':
        return <Target className="h-4 w-4 text-gray-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'implemented':
        return 'default';
      case 'partial':
        return 'secondary';
      case 'not_applicable':
        return 'outline';
      default:
        return 'destructive';
    }
  };

  // Stats calculation moved to after filteredControls is defined

  // Calculate suggested status based on narrative and evidence (read-only assessment)
  // This provides intelligent status suggestions but does NOT automatically update
  const calculateSuggestedStatus = (control: any) => {
    const hasNarrative = control.implementationText && control.implementationText.trim().length > 50;
    const hasEvidence = control.evidence && control.evidence.length > 0;
    const narrativeLength = control.implementationText?.trim().length || 0;
    
    if (hasNarrative && hasEvidence && narrativeLength > 200) {
      // Comprehensive narrative + evidence = fully implemented
      return 'implemented';
    } else if (hasNarrative && narrativeLength > 100) {
      // Good narrative but missing evidence or detail = in progress
      return 'in_progress';
    } else if (hasNarrative || control.status === 'planning') {
      // Some narrative or planning status = planning
      return 'planning';
    }
    // No narrative or evidence = not implemented
    return 'not_implemented';
  };

  // Assess controls and identify status mismatches (for visual indicators)
  const controlsWithSuggestedStatus = useMemo(() => {
    return systemControls.map(sc => {
      const suggestedStatus = calculateSuggestedStatus(sc);
      const statusMismatch = suggestedStatus !== sc.status && 
                            suggestedStatus === 'implemented' && 
                            sc.status === 'not_implemented';
      
      return {
        ...sc,
        suggestedStatus,
        statusMismatch // Show badge/indicator when system suggests status change
      };
    });
  }, [systemControls]);

  if (controlsLoading || systemControlsLoading) {
    return (
      <div className="space-y-6" data-testid="controls-loading">
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
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

  return (
    <div className="space-y-6" data-testid="controls-manager">
      {/* Controls Overview Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="metric-total-controls">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Total Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">For this system</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-implemented-controls">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Implemented
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.implemented}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.implemented / stats.total) * 100) : 0}% complete
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-documented-controls">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Documented
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.withNarratives}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.withNarratives / stats.total) * 100) : 0}% documented
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls Management Tabs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Controls Management
              </CardTitle>
              <CardDescription>
                Manage implementation status and narratives for NIST 800-53 security controls
              </CardDescription>
            </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => refetchSystemControls()}
                    variant="outline"
                    className="flex items-center gap-2"
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                  <Button 
                    onClick={async () => {
                      try {
                        setGeneratingNarratives(true);
                        const response = await apiRequest('POST', `/api/narrative/systems/${systemId}/narratives/generate`);
                        const result = await response.json();
                        
                        if (result.success) {
                          setGeneratingNarratives(false);
                          toast({
                            title: 'Narrative Generation Complete',
                            description: `Generated narratives for ${result.narrativesGenerated} controls.`,
                          });
                          // Refresh the data to show new narratives
                          await queryClient.invalidateQueries({ queryKey: ['systemControls', systemId] });
                          await queryClient.invalidateQueries({ queryKey: ['/api/systems', systemId, 'metrics'] });
                        } else {
                          throw new Error(result.error || 'Failed to generate narratives');
                        }
                      } catch (error: any) {
                        setGeneratingNarratives(false);
                        setNarrativeGenerationProgress(null);
                        console.error('Failed to generate narratives:', error);
                        toast({
                          title: 'Generation Failed',
                          description: error?.message || 'Failed to generate AI narratives.',
                          variant: 'destructive',
                        });
                      }
                    }}
                    disabled={generatingNarratives}
                    variant="outline"
                    className="flex items-center gap-2"
                    size="sm"
                  >
                    {generatingNarratives ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>
                          {narrativeGenerationProgress ? (
                            <>
                              Generating... {narrativeGenerationProgress.processedControls}/{narrativeGenerationProgress.totalControls}
                              {narrativeGenerationProgress.currentControl && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({narrativeGenerationProgress.currentControl})
                                </span>
                              )}
                            </>
                          ) : (
                            'Starting generation...'
                          )}
                        </span>
                      </div>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate AI Narratives
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={async () => {
                      const controlsToUpdate = systemControls.filter(sc => 
                        sc.implementationText?.trim() && sc.status === 'not_implemented'
                      );
                      console.log('Manually updating controls with narratives:', controlsToUpdate.length);
                      for (const sc of controlsToUpdate) {
                        try {
                          await apiRequest('PUT', '/api/systems/controls', {
                            systemId,
                            controlId: sc.controlId,
                            implementationText: sc.implementationText,
                            status: 'implemented',
                            assignedTo: sc.assignedTo
                          });
                          console.log(`Updated ${sc.controlId} to implemented`);
                        } catch (error) {
                          console.error(`Failed to update ${sc.controlId}:`, error);
                        }
                      }
                      await queryClient.invalidateQueries({ queryKey: ['systemControls', systemId] });
                    }}
                    variant="outline"
                    className="flex items-center gap-2"
                    size="sm"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Update All Narratives
                  </Button>
                  <Button 
                    onClick={() => setShowBaselineAssignment(true)}
                    className="flex items-center gap-2"
                    size="sm"
                  >
                    <Shield className="h-4 w-4" />
                    Baseline Assignment
                  </Button>
                </div>
          </div>
          
          {/* Progress bar for narrative generation */}
          {generatingNarratives && narrativeGenerationProgress && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                  <span className="text-muted-foreground">
                    Generating narratives: {narrativeGenerationProgress.processedControls} of {narrativeGenerationProgress.totalControls} controls
                  </span>
                </div>
                <span className="font-medium text-blue-600">
                  {narrativeGenerationProgress.progress}%
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300 ease-in-out"
                  style={{ width: `${narrativeGenerationProgress.progress}%` }}
                />
              </div>
              {narrativeGenerationProgress.currentControl && (
                <p className="text-xs text-muted-foreground">
                  Currently processing: {narrativeGenerationProgress.currentControl}
                </p>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tab Navigation */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'assigned' | 'all')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="assigned" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Assigned Controls ({systemControls.length})
              </TabsTrigger>
              <TabsTrigger value="all" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                All Controls ({controls.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="assigned" className="space-y-4">
              <div className="flex gap-4 items-center">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search assigned controls..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                    data-testid="input-search-assigned-controls"
                  />
                </div>
                <Select value={selectedFamily} onValueChange={setSelectedFamily}>
                  <SelectTrigger className="w-[200px]" data-testid="select-family-filter">
                    <SelectValue placeholder="All families" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Control Families</SelectItem>
                    {controlFamilies.map((family: any) => (
                      <SelectItem key={family} value={family}>{family}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="implemented">Implemented</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="not_implemented">Not Implemented</SelectItem>
                    <SelectItem value="not_applicable">Not Applicable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="all" className="space-y-4">
              <div className="flex gap-4 items-center">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search all controls..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                    data-testid="input-search-all-controls"
                  />
                </div>
                <Select value={selectedFamily} onValueChange={setSelectedFamily}>
                  <SelectTrigger className="w-[200px]" data-testid="select-family-filter-all">
                    <SelectValue placeholder="All families" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Control Families</SelectItem>
                    {controlFamilies.map((family: any) => (
                      <SelectItem key={family} value={family}>{family}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-[180px]" data-testid="select-status-filter-all">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="implemented">Implemented</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="not_implemented">Not Implemented</SelectItem>
                    <SelectItem value="not_applicable">Not Applicable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* Controls Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Control</TableHead>
                  <TableHead>Family</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Narrative</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredControls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {activeTab === 'assigned' 
                        ? (systemControls.length === 0 ? 'No controls assigned to this system' : 'No assigned controls match current filters')
                        : (controls.length === 0 ? 'No controls found' : 'No controls match current filters')
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredControls.map((control) => {
                    const systemControl = systemControlsLookup[control.id];
                    const hasNarrative = systemControl?.implementationText?.trim();
                    
                    // Calculate suggested status
                    const suggestedStatus = systemControl ? calculateSuggestedStatus(systemControl) : 'not_implemented';
                    const currentStatus = systemControl?.status || 'not_implemented';
                    const showSuggestion = suggestedStatus !== currentStatus && hasNarrative;
                    
                    return (
                      <TableRow key={control.id} data-testid={`control-row-${control.id}`}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">
                                {control.id}
                              </Badge>
                              {control.enhancement && (
                                <Badge variant="secondary" className="text-xs">
                                  Enhancement {control.enhancement}
                                </Badge>
                              )}
                            </div>
                            <div className="font-medium text-sm">{control.title}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {control.description}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{control.family}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge 
                              variant={getStatusBadgeVariant(currentStatus)}
                              className="flex items-center gap-1 w-fit"
                            >
                              {getStatusIcon(currentStatus)}
                              {currentStatus.replace('_', ' ')}
                            </Badge>
                            {showSuggestion && (
                              <div className="flex items-center gap-1 text-xs text-blue-600">
                                <span className="font-semibold">💡 Suggested:</span>
                                <span className="font-medium">{suggestedStatus.replace('_', ' ')}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {hasNarrative ? (
                              <Badge variant="default" className="text-xs">
                                <FileText className="h-3 w-3 mr-1" />
                                Complete
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Missing
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {systemControl?.assignedTo && (
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {systemControl.assignedTo}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {systemControl?.lastUpdated ? 
                            new Date(systemControl.lastUpdated).toLocaleDateString() : 
                            'Never'
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {hasNarrative ? (
                              // If narrative exists, show review and status change options
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleReviewNarrative(control)}
                                  data-testid={`button-review-${control.id}`}
                                  title="Review narrative"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                {systemControl?.status !== 'implemented' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleStatusChange(control.id, 'implemented')}
                                    data-testid={`button-implement-${control.id}`}
                                    title="Mark as implemented"
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditNarrative(control)}
                                  data-testid={`button-edit-${control.id}`}
                                  title="Edit narrative"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </>
                            ) : (
                              // If no narrative, show edit option
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditNarrative(control)}
                                data-testid={`button-edit-${control.id}`}
                                title="Add narrative"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Tabs>
        </CardContent>
      </Card>

      {/* Implementation Narrative Editor/Review Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-narrative-editor">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingControl && systemControlsLookup[editingControl]?.implementationText?.trim() ? (
                <>
                  <Eye className="h-5 w-5" />
                  Review Implementation Narrative
                </>
              ) : (
                <>
                  <Edit className="h-5 w-5" />
                  Edit Implementation Narrative
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingControl && (
                <>
                  {editingControl && systemControlsLookup[editingControl]?.implementationText?.trim() ? 'Reviewing' : 'Editing'} narrative for control <Badge variant="outline" className="font-mono">{editingControl}</Badge>
                  <div className="mt-2 text-sm">
                    {controls.find((c: any) => c.id === editingControl)?.title}
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {editingControl && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Control Description:</h4>
                <p className="text-sm text-muted-foreground">
                  {controls.find((c: any) => c.id === editingControl)?.description}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="narrative-text">Implementation Narrative</Label>
              <Textarea
                id="narrative-text"
                placeholder="Describe how this control is implemented in your system. Include specific technical details, processes, tools, and evidence of implementation..."
                value={narrativeText}
                onChange={(e) => setNarrativeText(e.target.value)}
                rows={12}
                className="resize-none"
                data-testid="textarea-implementation-narrative"
                readOnly={!!(editingControl && systemControlsLookup[editingControl]?.implementationText?.trim())}
              />
              <div className="text-xs text-muted-foreground">
                {narrativeText.length} characters
                {editingControl && systemControlsLookup[editingControl]?.implementationText?.trim() && (
                  <span className="ml-2 text-blue-600">(Read-only - Click Edit to modify)</span>
                )}
              </div>
            </div>

            <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
              <strong>Writing Tips:</strong>
              <ul className="mt-1 space-y-1 text-xs">
                <li>• Be specific about technologies, tools, and processes used</li>
                <li>• Include configuration details and security settings</li>
                <li>• Reference procedures, documentation, and evidence</li>
                <li>• Explain how the control is monitored and maintained</li>
                <li>• Address all aspects of the control requirements</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              data-testid="button-cancel-narrative"
            >
              {editingControl && systemControlsLookup[editingControl]?.implementationText?.trim() ? 'Close' : 'Cancel'}
            </Button>
            {editingControl && systemControlsLookup[editingControl]?.implementationText?.trim() ? (
              // Review mode - show status change buttons
              <>
                <Button 
                  variant="outline"
                  onClick={() => handleStatusChange(editingControl!, 'partial')}
                  data-testid="button-mark-partial"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Mark as Partial
                </Button>
                <Button 
                  onClick={() => handleStatusChange(editingControl!, 'implemented')}
                  data-testid="button-mark-implemented"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Implemented
                </Button>
              </>
            ) : (
              // Edit mode - show save button
              <Button 
                onClick={handleSaveNarrative}
                disabled={saveNarrative.isPending || !narrativeText.trim()}
                data-testid="button-save-narrative"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveNarrative.isPending ? 'Saving...' : 'Save Narrative'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

          {/* Simple Baseline Assignment Dialog */}
          <Dialog open={showBaselineAssignment} onOpenChange={setShowBaselineAssignment}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Baseline Control Assignment</DialogTitle>
                <DialogDescription>
                  Assign security controls based on your system's impact level
                </DialogDescription>
              </DialogHeader>
              <SimpleBaselineAssignment 
                systemId={systemId} 
                onClose={() => setShowBaselineAssignment(false)} 
              />
            </DialogContent>
          </Dialog>
    </div>
  );
}