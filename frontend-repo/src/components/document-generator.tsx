import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Download, 
  Eye, 
  Settings,
  CheckCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  FileDown,
  FileType,
  Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest, authenticatedFetch } from '@/lib/queryClient';

interface DocumentGeneratorProps {
  systemId: string;
}

interface SSPGenerationOptions {
  format: 'docx' | 'pdf' | 'oscal';
  includeEvidence: boolean;
  includeAssessmentResults: boolean;
  includeDiagrams: boolean;
  templateOptions: {
    classification: string;
    organization: string;
    preparedBy: string;
    reviewedBy: string;
    approvedBy: string;
    version: string;
  };
}

export function DocumentGenerator({ systemId }: DocumentGeneratorProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  
  // SSP Generation Options
  const [sspOptions, setSspOptions] = useState<SSPGenerationOptions>({
    format: 'docx',
    includeEvidence: true,
    includeAssessmentResults: true,
    includeDiagrams: true,
    templateOptions: {
      classification: 'UNCLASSIFIED',
      organization: '',
      preparedBy: '',
      reviewedBy: '',
      approvedBy: '',
      version: '1.0'
    }
  });

  // Fetch system information
  const { data: system } = useQuery({
    queryKey: ['/api/systems', systemId],
    enabled: !!systemId
  });

  // Fetch system controls for stats
  const { data: systemControls = [] } = useQuery({
    queryKey: ['/api/systems', systemId, 'controls'],
    enabled: !!systemId
  });

  // Calculate readiness
  const calculateReadiness = () => {
    const totalControls = systemControls.length;
    const implementedControls = systemControls.filter((sc: any) => 
      sc.status === 'implemented' && sc.implementationText
    ).length;
    
    if (totalControls === 0) return 0;
    return Math.round((implementedControls / totalControls) * 100);
  };

  const readiness = calculateReadiness();

  // Generate SSP mutation
  const generateSSP = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      setGenerationProgress(10);
      
      // Start generation job
      const response = await authenticatedFetch('/api/generation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemId,
          documentTypes: ['ssp'],
          includeEvidence: sspOptions.includeEvidence,
          includeArtifacts: sspOptions.includeDiagrams,
          templateOptions: sspOptions.templateOptions
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start SSP generation');
      }

      const { jobId } = await response.json();
      setGenerationProgress(30);

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second intervals
        
        const statusResponse = await authenticatedFetch(`/api/generation/status/${jobId}`);
        if (!statusResponse.ok) continue;
        
        const status = await statusResponse.json();
        setGenerationProgress(Math.min(status.progress || 30, 90));
        
        if (status.status === 'completed') {
          setGenerationProgress(100);
          
          // Get the result
          const resultResponse = await authenticatedFetch(`/api/generation/result/${jobId}`);
          if (!resultResponse.ok) {
            throw new Error('Failed to get generation result');
          }
          
          return await resultResponse.json();
        } else if (status.status === 'failed') {
          throw new Error(status.error || 'Generation failed');
        }
        
        attempts++;
      }
      
      throw new Error('Generation timed out');
    },
    onSuccess: (result) => {
      setIsGenerating(false);
      setGenerationProgress(0);
      
      toast({
        title: 'SSP Generated Successfully',
        description: 'Your System Security Plan is ready for download.',
      });

      // Trigger download
      if (result.result?.documents?.[0]) {
        downloadDocument(result.result.documents[0]);
      }
    },
    onError: (error: any) => {
      setIsGenerating(false);
      setGenerationProgress(0);
      
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate SSP',
        variant: 'destructive'
      });
    }
  });

  // Enhanced SSP generation with new service
  const generateEnhancedSSP = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch('/api/documents/ssp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemId,
          ...sspOptions
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate SSP');
      }

      // For DOCX/PDF, we get a blob
      if (sspOptions.format !== 'oscal') {
        const blob = await response.blob();
        return { blob, format: sspOptions.format };
      } else {
        // For OSCAL, we get JSON
        return await response.json();
      }
    },
    onSuccess: (result) => {
      toast({
        title: 'SSP Generated Successfully',
        description: `Your System Security Plan has been generated in ${sspOptions.format.toUpperCase()} format.`,
      });

      // Handle download based on format
      if (result.blob) {
        const url = window.URL.createObjectURL(result.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `SSP_${system?.name?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${result.format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // OSCAL JSON
        const jsonStr = JSON.stringify(result, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `SSP_${system?.name?.replace(/\s+/g, '_')}_OSCAL_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate SSP',
        variant: 'destructive'
      });
    }
  });

  const downloadDocument = (document: any) => {
    const blob = new Blob([document.content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = document.title + '.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const previewSSP = async () => {
    try {
      const response = await authenticatedFetch('/api/documents/ssp/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemId,
          sections: ['executive_summary', 'system_overview', 'compliance_summary']
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate preview');
      }

      const preview = await response.json();
      setPreviewContent(preview.content);
      setShowPreview(true);
    } catch (error) {
      toast({
        title: 'Preview Failed',
        description: 'Failed to generate document preview',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6" data-testid="document-generator">
      {/* Document Readiness */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            SSP Generation Readiness
          </CardTitle>
          <CardDescription>
            System security plan generation readiness based on control implementation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Readiness</span>
              <span className="text-sm text-muted-foreground">{readiness}%</span>
            </div>
            <Progress value={readiness} className="h-2" />
          </div>
          
          {readiness < 100 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {100 - readiness}% of controls need implementation narratives before generating a complete SSP.
              </AlertDescription>
            </Alert>
          )}

          {readiness === 100 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                All controls have implementation narratives. Your system is ready for SSP generation!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* SSP Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            SSP Configuration
          </CardTitle>
          <CardDescription>
            Configure options for System Security Plan generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="format" className="space-y-4">
            <TabsList>
              <TabsTrigger value="format">Format Options</TabsTrigger>
              <TabsTrigger value="content">Content Options</TabsTrigger>
              <TabsTrigger value="metadata">Document Metadata</TabsTrigger>
            </TabsList>

            <TabsContent value="format" className="space-y-4">
              <div>
                <Label htmlFor="format">Output Format</Label>
                <Select 
                  value={sspOptions.format} 
                  onValueChange={(value: any) => setSspOptions(prev => ({ ...prev, format: value }))}
                >
                  <SelectTrigger id="format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="docx">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Microsoft Word (DOCX)
                      </div>
                    </SelectItem>
                    <SelectItem value="pdf">
                      <div className="flex items-center gap-2">
                        <FileDown className="h-4 w-4" />
                        PDF Document
                      </div>
                    </SelectItem>
                    <SelectItem value="oscal">
                      <div className="flex items-center gap-2">
                        <FileType className="h-4 w-4" />
                        OSCAL JSON
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  {sspOptions.format === 'docx' && 'Editable document format compatible with Microsoft Word'}
                  {sspOptions.format === 'pdf' && 'Read-only format suitable for official submissions'}
                  {sspOptions.format === 'oscal' && 'Machine-readable format for automated processing'}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="content" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="evidence">Include Evidence References</Label>
                    <p className="text-sm text-muted-foreground">
                      Add links to supporting evidence and artifacts
                    </p>
                  </div>
                  <Switch
                    id="evidence"
                    checked={sspOptions.includeEvidence}
                    onCheckedChange={(checked) => setSspOptions(prev => ({ 
                      ...prev, 
                      includeEvidence: checked 
                    }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="assessments">Include Assessment Results</Label>
                    <p className="text-sm text-muted-foreground">
                      Add findings and risk assessment data if available
                    </p>
                  </div>
                  <Switch
                    id="assessments"
                    checked={sspOptions.includeAssessmentResults}
                    onCheckedChange={(checked) => setSspOptions(prev => ({ 
                      ...prev, 
                      includeAssessmentResults: checked 
                    }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="diagrams">Include Architecture Diagrams</Label>
                    <p className="text-sm text-muted-foreground">
                      Embed system architecture diagrams in the document
                    </p>
                  </div>
                  <Switch
                    id="diagrams"
                    checked={sspOptions.includeDiagrams}
                    onCheckedChange={(checked) => setSspOptions(prev => ({ 
                      ...prev, 
                      includeDiagrams: checked 
                    }))}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="metadata" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="classification">Classification</Label>
                  <Select 
                    value={sspOptions.templateOptions.classification}
                    onValueChange={(value) => setSspOptions(prev => ({ 
                      ...prev, 
                      templateOptions: { ...prev.templateOptions, classification: value }
                    }))}
                  >
                    <SelectTrigger id="classification">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNCLASSIFIED">UNCLASSIFIED</SelectItem>
                      <SelectItem value="CUI">CUI</SelectItem>
                      <SelectItem value="CONFIDENTIAL">CONFIDENTIAL</SelectItem>
                      <SelectItem value="SECRET">SECRET</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="version">Document Version</Label>
                  <Input
                    id="version"
                    value={sspOptions.templateOptions.version}
                    onChange={(e) => setSspOptions(prev => ({ 
                      ...prev, 
                      templateOptions: { ...prev.templateOptions, version: e.target.value }
                    }))}
                    placeholder="1.0"
                  />
                </div>

                <div>
                  <Label htmlFor="organization">Organization</Label>
                  <Input
                    id="organization"
                    value={sspOptions.templateOptions.organization}
                    onChange={(e) => setSspOptions(prev => ({ 
                      ...prev, 
                      templateOptions: { ...prev.templateOptions, organization: e.target.value }
                    }))}
                    placeholder="Your Organization Name"
                  />
                </div>

                <div>
                  <Label htmlFor="preparedBy">Prepared By</Label>
                  <Input
                    id="preparedBy"
                    value={sspOptions.templateOptions.preparedBy}
                    onChange={(e) => setSspOptions(prev => ({ 
                      ...prev, 
                      templateOptions: { ...prev.templateOptions, preparedBy: e.target.value }
                    }))}
                    placeholder="System Owner Name"
                  />
                </div>

                <div>
                  <Label htmlFor="reviewedBy">Reviewed By</Label>
                  <Input
                    id="reviewedBy"
                    value={sspOptions.templateOptions.reviewedBy}
                    onChange={(e) => setSspOptions(prev => ({ 
                      ...prev, 
                      templateOptions: { ...prev.templateOptions, reviewedBy: e.target.value }
                    }))}
                    placeholder="ISSO Name"
                  />
                </div>

                <div>
                  <Label htmlFor="approvedBy">Approved By</Label>
                  <Input
                    id="approvedBy"
                    value={sspOptions.templateOptions.approvedBy}
                    onChange={(e) => setSspOptions(prev => ({ 
                      ...prev, 
                      templateOptions: { ...prev.templateOptions, approvedBy: e.target.value }
                    }))}
                    placeholder="Authorizing Official Name"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-4">
            <Button
              onClick={() => previewSSP()}
              variant="outline"
              disabled={isGenerating}
              data-testid="button-preview-ssp"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            
            <Button
              onClick={() => generateEnhancedSSP.mutate()}
              disabled={isGenerating || generateEnhancedSSP.isPending}
              data-testid="button-generate-ssp"
            >
              {(isGenerating || generateEnhancedSSP.isPending) ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generate SSP
                </>
              )}
            </Button>
          </div>

          {/* Generation Progress */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Generating System Security Plan...</span>
                <span>{generationProgress}%</span>
              </div>
              <Progress value={generationProgress} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other Document Types */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Documents</CardTitle>
          <CardDescription>
            Generate other ATO package documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" disabled>
              <FileText className="h-4 w-4 mr-2" />
              Security Assessment Report (Coming Soon)
            </Button>
            <Button variant="outline" disabled>
              <FileText className="h-4 w-4 mr-2" />
              POA&M Report (Coming Soon)
            </Button>
            <Button variant="outline" disabled>
              <FileText className="h-4 w-4 mr-2" />
              Risk Assessment (Coming Soon)
            </Button>
            <Button variant="outline" disabled>
              <FileText className="h-4 w-4 mr-2" />
              Complete ATO Package (Coming Soon)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>SSP Preview</DialogTitle>
            <DialogDescription>
              Preview of selected sections from your System Security Plan
            </DialogDescription>
          </DialogHeader>
          <div className="prose dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm">
              {previewContent}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowPreview(false);
              generateEnhancedSSP.mutate();
            }}>
              Generate Full Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}