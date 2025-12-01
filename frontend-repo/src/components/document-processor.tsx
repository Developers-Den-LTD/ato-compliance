import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  PlayCircle, 
  CheckCircle, 
  AlertCircle,
  XCircle,
  RefreshCw,
  Loader2,
  Info,
  Search,
  Filter,
  Eye,
  Brain,
  FileSearch,
  MessageSquare,
  Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { formatBytes, cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Artifact {
  id: string;
  systemId: string;
  fileName: string;
  title: string;
  type: string;
  mimeType: string;
  fileSize: number;
  uploadDate: Date | string;
  processedAt?: string;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  processingResult?: ProcessingResult;
}

interface ProcessingResult {
  extractedContent?: {
    wordCount: number;
    pageCount?: number;
    sections: number;
    language: string;
  };
  nlpAnalysis?: {
    summary: string;
    keyTopics: string[];
    securityControls: string[];
    confidence: number;
  };
  narratives?: Array<{
    controlId: string;
    narrative: string;
    confidence: number;
    sources: string[];
  }>;
  controlMappings?: {
    mappings: Array<{
      id: string;
      documentId: string;
      controlId: string;
      controlFramework: string;
      confidenceScore: number;
      mappingCriteria: Record<string, any>;
      createdAt: string;
      updatedAt: string;
      createdBy?: string;
    }>;
    relationships: Array<{
      id: string;
      sourceControlId: string;
      targetControlId: string;
      relationshipType: string;
      framework: string;
      strength: number;
    }>;
    totalProcessed: number;
    processingTime: number;
  };
  error?: string;
}

interface DocumentProcessorProps {
  systemId: string;
}

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  'policy_document': 'Policy Document',
  'procedure_document': 'Procedure Document',
  'system_documentation': 'System Documentation',
  'architecture_diagram': 'Architecture Diagram',
  'scan_results': 'Scan Results',
  'assessment_report': 'Assessment Report',
  'evidence_file': 'Evidence File',
  'configuration_file': 'Configuration File',
  'test_results': 'Test Results',
  'interview_notes': 'Interview Notes'
};

export function DocumentProcessor({ systemId }: DocumentProcessorProps) {
  const { toast } = useToast();
  const [selectedArtifacts, setSelectedArtifacts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [processingJobs, setProcessingJobs] = useState<Map<string, string>>(new Map());
  const [extractionSummaries, setExtractionSummaries] = useState<Map<string, any>>(new Map());

  // Fetch artifacts for the system
  const { data: artifacts = [], isLoading, refetch } = useQuery({
    queryKey: ['artifacts', systemId],
    queryFn: async () => {
      const resp = await apiRequest<{ artifacts: Artifact[] }>(
        `/api/artifacts/systems/${systemId}`
      );
      return resp?.artifacts ?? [];
    }
  });

  // Process document mutation
  const processDocumentMutation = useMutation({
    mutationFn: async ({ artifactId, options }: { artifactId: string; options?: any }) => {
      return apiRequest('/api/document-processing/process', {
        method: 'POST',
        body: JSON.stringify({
          artifactId,
          systemId,
          options: {
            useAI: true,
            createEvidence: true,
            analyzeAllControls: true,
            ...options
          }
        })
      });
    },
    onSuccess: (data, variables) => {
      toast({
        title: 'Document processing started',
        description: 'The document will be analyzed and narratives generated.'
      });
      processingJobs.delete(variables.artifactId);
      refetch();
    },
    onError: (error: any, variables) => {
      toast({
        title: 'Processing failed',
        description: error.message || 'Failed to process document',
        variant: 'destructive'
      });
      processingJobs.delete(variables.artifactId);
    }
  });

  // Batch process documents
  const batchProcessMutation = useMutation({
    mutationFn: async (artifactIds: string[]) => {
      return apiRequest('/api/document-processing/process-batch', {
        method: 'POST',
        body: JSON.stringify({
          artifactIds,
          systemId,
          options: {
            useAI: true,
            createEvidence: true,
            analyzeAllControls: true
          }
        })
      });
    },
    onSuccess: () => {
      toast({
        title: 'Batch processing started',
        description: `Processing ${selectedArtifacts.size} documents`
      });
      setSelectedArtifacts(new Set());
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: 'Batch processing failed',
        description: error.message || 'Failed to process documents',
        variant: 'destructive'
      });
    }
  });

  const handleProcessDocument = (artifactId: string) => {
    processingJobs.set(artifactId, 'processing');
    setProcessingJobs(new Map(processingJobs));
    processDocumentMutation.mutate({ artifactId });
  };

  // Extraction-only mutation (POST /api/extraction/parse)
  const extractContentMutation = useMutation({
    mutationFn: async (artifactId: string) => {
      return apiRequest('/api/extraction/parse', {
        method: 'POST',
        body: JSON.stringify({ artifactId })
      });
    },
    onSuccess: (data: any, artifactId: string) => {
      const summary = data?.summary || data;
      const next = new Map(extractionSummaries);
      next.set(artifactId, summary);
      setExtractionSummaries(next);
      toast({
        title: 'Extraction complete',
        description: `Sections: ${summary?.sectionCount ?? 0}, Depth: ${summary?.hierarchyDepth ?? 0}, Words: ${summary?.wordCount ?? 0}`
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Extraction failed',
        description: error?.message || 'Failed to extract document',
        variant: 'destructive'
      });
    }
  });

  const handleExtractOnly = (artifactId: string) => {
    extractContentMutation.mutate(artifactId);
  };

  const handleBatchProcess = () => {
    if (selectedArtifacts.size === 0) {
      toast({
        title: 'No documents selected',
        description: 'Please select documents to process',
        variant: 'default'
      });
      return;
    }
    batchProcessMutation.mutate(Array.from(selectedArtifacts));
  };

  const toggleArtifactSelection = (artifactId: string) => {
    const newSelected = new Set(selectedArtifacts);
    if (newSelected.has(artifactId)) {
      newSelected.delete(artifactId);
    } else {
      newSelected.add(artifactId);
    }
    setSelectedArtifacts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedArtifacts.size === artifacts.length) {
      setSelectedArtifacts(new Set());
    } else {
      setSelectedArtifacts(new Set(artifacts.map(a => a.id)));
    }
  };

  const filteredArtifacts = artifacts.filter(artifact => {
    const matchesSearch = searchQuery === '' ||
      artifact.fileName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      artifact.title?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = filterType === 'all' || artifact.type === filterType;

    return matchesSearch && matchesType;
  });

  const processedCount = artifacts.filter(a => a.processingStatus === 'completed').length;
  const failedCount = artifacts.filter(a => a.processingStatus === 'failed').length;
  const pendingCount = artifacts.filter(a => !a.processingStatus || a.processingStatus === 'pending').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Document Processing</CardTitle>
          <CardDescription>
            Analyze uploaded documents to extract security information and generate control narratives
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Stats Overview */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Documents</p>
                    <p className="text-2xl font-bold">{artifacts.length}</p>
                  </div>
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Processed</p>
                    <p className="text-2xl font-bold text-green-600">{processedCount}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Failed</p>
                    <p className="text-2xl font-bold text-red-600">{failedCount}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Info Alert */}
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertTitle>Document Processing Features</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Text extraction from PDFs, Word documents, and text files</li>
                <li>AI-powered analysis to identify security controls and compliance information</li>
                <li>Automatic generation of control narratives based on evidence</li>
                <li>Fallback to pattern-based analysis when AI is unavailable</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Actions Bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={handleBatchProcess}
                disabled={selectedArtifacts.size === 0 || batchProcessMutation.isPending}
              >
                {batchProcessMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Process Selected ({selectedArtifacts.size})
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={toggleSelectAll}
              >
                {selectedArtifacts.size === artifacts.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 px-3 py-1 border rounded-md"
              />
            </div>
          </div>

          {/* Documents Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedArtifacts.size === artifacts.length && artifacts.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Document Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                      <p className="mt-2 text-muted-foreground">Loading documents...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredArtifacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">No documents found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredArtifacts.map((artifact) => {
                    const isProcessing = processingJobs.get(artifact.id) === 'processing';
                    return (
                      <TableRow key={artifact.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedArtifacts.has(artifact.id)}
                            onCheckedChange={() => toggleArtifactSelection(artifact.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{artifact.title}</p>
                            <p className="text-sm text-muted-foreground">{artifact.fileName}</p>
                            {extractionSummaries.has(artifact.id) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Extracted: {extractionSummaries.get(artifact.id)?.sectionCount ?? 0} sections, depth {extractionSummaries.get(artifact.id)?.hierarchyDepth ?? 0}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {ARTIFACT_TYPE_LABELS[artifact.type] || artifact.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatBytes(artifact.fileSize)}</TableCell>
                        <TableCell>
                          {isProcessing ? (
                            <Badge variant="secondary">
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              Processing
                            </Badge>
                          ) : artifact.processingStatus === 'completed' ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Processed
                            </Badge>
                          ) : artifact.processingStatus === 'failed' ? (
                            <Badge variant="destructive">
                              <XCircle className="mr-1 h-3 w-3" />
                              Failed
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {artifact.uploadDate ? format(new Date(artifact.uploadDate), 'MMM d, yyyy') : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {artifact.processingStatus === 'completed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // View processing results
                                  toast({
                                    title: 'View Results',
                                    description: 'This feature is coming soon!'
                                  });
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleProcessDocument(artifact.id)}
                              disabled={isProcessing || processDocumentMutation.isPending}
                            >
                              {isProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Brain className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExtractOnly(artifact.id)}
                              disabled={extractContentMutation.isPending}
                              title="Extract structure only"
                            >
                              <FileSearch className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Processing Results Preview */}
          {filteredArtifacts.some(a => a.processingStatus === 'completed') && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Recent Processing Results</h3>
              <div className="grid gap-4">
                {filteredArtifacts
                  .filter(a => a.processingStatus === 'completed' && a.processingResult)
                  .slice(0, 3)
                  .map(artifact => (
                    <Card key={artifact.id}>
                      <CardHeader>
                        <CardTitle className="text-base">{artifact.title}</CardTitle>
                        <CardDescription>Uploaded on {artifact.uploadDate ? format(new Date(artifact.uploadDate), 'MMM d, yyyy') : 'Unknown'}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {artifact.processingResult?.nlpAnalysis && (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {artifact.processingResult.nlpAnalysis.summary}
                            </p>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1">
                                <FileSearch className="h-3 w-3" />
                                {artifact.processingResult.extractedContent?.wordCount || 0} words
                              </span>
                              <span className="flex items-center gap-1">
                                <Brain className="h-3 w-3" />
                                {artifact.processingResult.nlpAnalysis.confidence}% confidence
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {artifact.processingResult.narratives?.length || 0} narratives
                              </span>
                              {artifact.processingResult.controlMappings && (
                                <span className="flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  {artifact.processingResult.controlMappings.mappings.length} control mappings
                                </span>
                              )}
                            </div>
                            {artifact.processingResult.nlpAnalysis.keyTopics.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {artifact.processingResult.nlpAnalysis.keyTopics.slice(0, 5).map((topic, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {topic}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {artifact.processingResult.controlMappings && (
                              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <CheckCircle className="h-4 w-4 text-blue-600" />
                                  <span className="text-sm font-medium text-blue-900">Control Mappings</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                                  <div>Mappings: {artifact.processingResult.controlMappings.mappings.length}</div>
                                  <div>Relationships: {artifact.processingResult.controlMappings.relationships.length}</div>
                                  <div>Processed: {artifact.processingResult.controlMappings.totalProcessed} controls</div>
                                  <div>Time: {artifact.processingResult.controlMappings.processingTime}ms</div>
                                </div>
                              </div>
                            )}
                            {artifact.processingResult.stigEvaluation && (
                              <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <Shield className="h-4 w-4 text-purple-600" />
                                  <span className="text-sm font-medium text-purple-900">STIG Evaluation</span>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-purple-700">Profile: {artifact.processingResult.stigEvaluation.profile}</span>
                                    <Badge variant={artifact.processingResult.stigEvaluation.complianceScore >= 80 ? 'default' : 'destructive'} className="text-xs">
                                      {artifact.processingResult.stigEvaluation.complianceScore}% Compliant
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-xs text-purple-700">
                                    <div>Evaluated: {artifact.processingResult.stigEvaluation.rulesEvaluated}</div>
                                    <div>Passed: {artifact.processingResult.stigEvaluation.rulesPassed}</div>
                                    <div>Failed: {artifact.processingResult.stigEvaluation.rulesFailed}</div>
                                  </div>
                                  {artifact.processingResult.stigEvaluation.categorizedResults && (
                                    <div className="text-xs text-purple-700">
                                      <div>CAT I: {artifact.processingResult.stigEvaluation.categorizedResults.catI.failed}/{artifact.processingResult.stigEvaluation.categorizedResults.catI.total} failed</div>
                                      <div>CAT II: {artifact.processingResult.stigEvaluation.categorizedResults.catII.failed}/{artifact.processingResult.stigEvaluation.categorizedResults.catII.total} failed</div>
                                      <div>CAT III: {artifact.processingResult.stigEvaluation.categorizedResults.catIII.failed}/{artifact.processingResult.stigEvaluation.categorizedResults.catIII.total} failed</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}