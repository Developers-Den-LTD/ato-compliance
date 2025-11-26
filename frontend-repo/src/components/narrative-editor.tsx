import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Edit, 
  Save, 
  RotateCcw,
  Eye,
  History,
  Wand2,
  CheckCircle,
  AlertTriangle,
  Clock,
  User,
  FileText,
  RefreshCw,
  Copy,
  Download,
  Search,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest, authenticatedFetch } from '@/lib/queryClient';

interface Control {
  id: string;
  family: string;
  title: string;
  description: string;
  baseline: string[];
  supplementalGuidance?: string;
}

interface SystemControl {
  id: string;
  systemId: string;
  controlId: string;
  status: 'not_implemented' | 'partial' | 'implemented' | 'not_applicable';
  implementationText?: string;
  assignedTo?: string;
  lastUpdated: string;
}

interface NarrativeVersion {
  id: string;
  version: number;
  text: string;
  author: string;
  createdAt: string;
  isAiGenerated: boolean;
  changesSummary?: string;
}

interface NarrativeEditorProps {
  systemId: string;
}

export function NarrativeEditor({ systemId }: NarrativeEditorProps) {
  const { toast } = useToast();
  const [selectedControlId, setSelectedControlId] = useState<string>('');
  const [currentText, setCurrentText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [includeGuidance, setIncludeGuidance] = useState(false);

  // Fetch all controls
  const { data: controlsResponse } = useQuery({
    queryKey: ['/api/controls', 'v2'],
    queryFn: async () => {
      const response = await authenticatedFetch('/api/controls?limit=2000');
      if (!response.ok) throw new Error('Failed to fetch controls');
      const data = await response.json();
      return data;
    }
  });
  const controls: Control[] = (controlsResponse as any)?.controls || [];

  // Fetch system controls with implementation text  
  const { data: systemControls = [], refetch: refetchSystemControls } = useQuery({
    queryKey: ['/api/systems', systemId, 'controls'],
    enabled: !!systemId
  }) as { data: SystemControl[]; refetch: () => void };

  // Get selected control data
  const selectedControl = controls.find((c: Control) => c.id === selectedControlId);
  const selectedSystemControl = systemControls.find(sc => sc.controlId === selectedControlId);

  // Update text when control selection changes
  useEffect(() => {
    if (selectedSystemControl?.implementationText) {
      setCurrentText(selectedSystemControl.implementationText);
      setOriginalText(selectedSystemControl.implementationText);
      setHasChanges(false);
    } else {
      setCurrentText('');
      setOriginalText('');
      setHasChanges(false);
    }
  }, [selectedSystemControl]);

  // Track text changes
  useEffect(() => {
    setHasChanges(currentText !== originalText);
  }, [currentText, originalText]);

  // Save narrative mutation
  const saveNarrative = useMutation({
    mutationFn: async (data: {
      controlId: string;
      implementationText: string;
      status?: string;
    }) => {
      return await apiRequest('/api/systems/controls', 'PUT', {
        systemId,
        controlId: data.controlId,
        implementationText: data.implementationText,
        status: data.status || selectedSystemControl?.status || 'partial'
      });
    },
    onSuccess: () => {
      toast({
        title: 'Narrative Saved',
        description: 'Implementation narrative has been successfully updated.'
      });
      refetchSystemControls();
      setOriginalText(currentText);
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save implementation narrative',
        variant: 'destructive'
      });
    }
  });

  // Generate AI narrative mutation
  const generateNarrative = useMutation({
    mutationFn: async (data: {
      controlId: string;
      prompt?: string;
      includeGuidance?: boolean;
    }) => {
      // Use direct narrative generation endpoint
      const response = await authenticatedFetch('/api/narrative/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemId,
          controlId: data.controlId,
          customPrompt: data.prompt,
          includeGuidance: data.includeGuidance || false
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate narrative');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Extract narrative content from generation result
      const narrativeContent = data.narrative;
      setCurrentText(narrativeContent);
      
      // Show confidence and suggestions
      toast({
        title: 'Narrative Generated',
        description: `AI-generated narrative ready (${data.confidence}% confidence). Method: ${data.generationMethod}`
      });
      
      // Show improvement suggestions if any
      if (data.suggestedImprovements?.length > 0) {
        toast({
          title: 'Improvement Suggestions',
          description: data.suggestedImprovements[0],
        });
      }
      
      setIsGenerateOpen(false);
      setGeneratePrompt('');
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate narrative',
        variant: 'destructive'
      });
    }
  });

  const handleSave = () => {
    if (!selectedControlId) return;
    
    saveNarrative.mutate({
      controlId: selectedControlId,
      implementationText: currentText
    });
  };

  const handleRevert = () => {
    setCurrentText(originalText);
    setHasChanges(false);
  };

  const handleGenerate = () => {
    if (!selectedControlId) return;
    
    generateNarrative.mutate({
      controlId: selectedControlId,
      prompt: generatePrompt || undefined,
      includeGuidance
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentText);
    toast({
      title: 'Copied',
      description: 'Implementation text copied to clipboard.'
    });
  };

  // Filter controls based on search and status
  const filteredControls = controls.filter((control: Control) => {
    const systemControl = systemControls.find(sc => sc.controlId === control.id);
    
    const matchesSearch = !searchQuery || 
      control.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      control.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      control.family.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'with_text' && systemControl?.implementationText) ||
      (statusFilter === 'without_text' && !systemControl?.implementationText) ||
      (statusFilter === systemControl?.status);
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (controlId: string) => {
    const systemControl = systemControls.find(sc => sc.controlId === controlId);
    if (!systemControl) return <Clock className="h-4 w-4 text-gray-400" />;
    
    switch (systemControl.status) {
      case 'implemented':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'not_applicable':
        return <CheckCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (controlId: string) => {
    const systemControl = systemControls.find(sc => sc.controlId === controlId);
    if (!systemControl) return <Badge variant="outline">Not Started</Badge>;
    
    const variant = systemControl.status === 'implemented' ? 'default' : 
                   systemControl.status === 'partial' ? 'secondary' : 
                   systemControl.status === 'not_applicable' ? 'outline' : 'destructive';
    
    return (
      <Badge variant={variant}>
        {systemControl.status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6" data-testid="narrative-editor">
      <div className="grid md:grid-cols-3 gap-6">
        {/* Control Selection Panel */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Control Selection
            </CardTitle>
            <CardDescription>
              Choose a control to edit its implementation narrative
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search and Filter */}
            <div className="space-y-2">
              <Input
                placeholder="Search controls..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-controls"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Controls</SelectItem>
                  <SelectItem value="with_text">With Narratives</SelectItem>
                  <SelectItem value="without_text">Without Narratives</SelectItem>
                  <SelectItem value="implemented">Implemented</SelectItem>
                  <SelectItem value="partial">Partially Implemented</SelectItem>
                  <SelectItem value="not_implemented">Not Implemented</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Control List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredControls.map(control => {
                const systemControl = systemControls.find(sc => sc.controlId === control.id);
                const hasText = !!systemControl?.implementationText;
                
                return (
                  <div
                    key={control.id}
                    className={`p-3 border rounded-lg cursor-pointer hover-elevate transition-all ${
                      selectedControlId === control.id ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20' : ''
                    }`}
                    onClick={() => setSelectedControlId(control.id)}
                    data-testid={`card-control-${control.id}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(control.id)}
                        <span className="font-semibold text-sm">{control.id}</span>
                        {hasText && <Edit className="h-3 w-3 text-blue-600" />}
                      </div>
                      {getStatusBadge(control.id)}
                    </div>
                    <div className="text-sm font-medium truncate">{control.title}</div>
                    <div className="text-xs text-muted-foreground">{control.family}</div>
                    {hasText && (
                      <div className="text-xs text-blue-600 mt-1">Has implementation text</div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Editor Panel */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Edit className="h-5 w-5" />
                  Implementation Narrative Editor
                  {selectedControl && (
                    <Badge variant="outline">{selectedControl.id}</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {selectedControl ? 
                    `Edit implementation narrative for ${selectedControl.title}` :
                    'Select a control to begin editing its implementation narrative'
                  }
                </CardDescription>
              </div>
              
              {selectedControl && (
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={copyToClipboard}
                    disabled={!currentText}
                    data-testid="button-copy-text"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setIsHistoryOpen(true)}
                    data-testid="button-view-history"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setIsGenerateOpen(true)}
                    data-testid="button-generate-ai"
                  >
                    <Wand2 className="h-4 w-4" />
                    AI Generate
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedControl ? (
              <>
                {/* Control Information */}
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div><strong>Control:</strong> {selectedControl.id} - {selectedControl.title}</div>
                      <div><strong>Family:</strong> {selectedControl.family}</div>
                      <div><strong>Baseline:</strong> {selectedControl.baseline.join(', ')}</div>
                      {selectedControl.description && (
                        <div><strong>Description:</strong> {selectedControl.description}</div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>

                {/* Text Editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="narrativeText">Implementation Text</Label>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {hasChanges && (
                        <span className="text-amber-600">Unsaved changes</span>
                      )}
                      <span>{currentText.length} characters</span>
                    </div>
                  </div>
                  <Textarea
                    id="narrativeText"
                    value={currentText}
                    onChange={(e) => setCurrentText(e.target.value)}
                    placeholder="Describe how this control is implemented in your system..."
                    rows={15}
                    className="font-mono text-sm"
                    data-testid="textarea-implementation-text"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4">
                  <div className="flex gap-2">
                    {hasChanges && (
                      <Button 
                        variant="outline" 
                        onClick={handleRevert}
                        data-testid="button-revert-changes"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Revert
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        // Preview functionality
                      }}
                      data-testid="button-preview"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                    <Button 
                      onClick={handleSave} 
                      disabled={!hasChanges || saveNarrative.isPending}
                      data-testid="button-save-narrative"
                    >
                      {saveNarrative.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Status and Assignment */}
                {selectedSystemControl && (
                  <div className="pt-4 border-t space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Status:</span> {getStatusBadge(selectedControl.id)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last Updated:</span> {' '}
                        {new Date(selectedSystemControl.lastUpdated).toLocaleDateString()}
                      </div>
                      {selectedSystemControl.assignedTo && (
                        <div>
                          <span className="text-muted-foreground">Assigned To:</span> {selectedSystemControl.assignedTo}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Edit className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">No Control Selected</h3>
                <p>Choose a control from the list to edit its implementation narrative.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Generation Dialog */}
      <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate AI Implementation Narrative</DialogTitle>
            <DialogDescription>
              Generate an implementation narrative for {selectedControl?.id} using AI assistance.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="generatePrompt">Custom Instructions (Optional)</Label>
              <Textarea
                id="generatePrompt"
                value={generatePrompt}
                onChange={(e) => setGeneratePrompt(e.target.value)}
                placeholder="Provide specific instructions for the AI, such as implementation details, technologies used, or compliance approaches..."
                rows={4}
              />
            </div>
            
            {/* Generation Options */}
            <div className="space-y-3">
              <Label>Generation Options</Label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="includeGuidance"
                  checked={includeGuidance}
                  onChange={(e) => setIncludeGuidance(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="includeGuidance" className="text-sm cursor-pointer">
                  Include NIST supplemental guidance in generation
                </Label>
              </div>
            </div>
            
            <Alert>
              <Wand2 className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p>The AI will generate an implementation narrative based on:</p>
                  <ul className="list-disc list-inside text-sm">
                    <li>Control requirements and objectives</li>
                    <li>Your system's context and architecture</li>
                    <li>Uploaded evidence and documentation</li>
                    <li>Existing security findings</li>
                  </ul>
                  <p className="mt-2">You can review and edit the generated text before saving.</p>
                </div>
              </AlertDescription>
            </Alert>
            
            {/* Show current evidence summary */}
            {selectedControl && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1 text-sm">
                    <p><strong>Available Context:</strong></p>
                    <p>• System: {systemControls.length} controls configured</p>
                    <p>• Evidence: {systemControls.find(sc => sc.controlId === selectedControl.id)?.implementationText ? 'Existing narrative found' : 'No existing narrative'}</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGenerateOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleGenerate} 
              disabled={generateNarrative.isPending}
            >
              {generateNarrative.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Narrative
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}