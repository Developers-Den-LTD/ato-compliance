import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  FileText, 
  Image, 
  Shield, 
  Trash2, 
  Eye, 
  Link,
  AlertCircle,
  CheckCircle,
  X,
  Plus,
  Search,
  Filter,
  Download,
  FileCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest, authenticatedFetch } from '@/lib/queryClient';
import { formatBytes } from '@/lib/utils';

interface Control {
  id: string;
  family: string;
  title: string;
  description: string;
}

interface Evidence {
  id: string;
  systemId: string;
  controlId?: string;
  type: string;
  title: string;
  description: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: 'satisfies' | 'partially_satisfies' | 'does_not_satisfy' | 'not_applicable';
  url: string;
  createdAt: string;
  tags?: string[];
}

interface UploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  evidenceId?: string;
}

interface EvidenceUploadManagerProps {
  systemId: string;
}

const EVIDENCE_TYPES = [
  { value: 'policy_document', label: 'Policy Document', icon: Shield },
  { value: 'procedure_document', label: 'Procedure Document', icon: FileText },
  { value: 'system_documentation', label: 'System Documentation', icon: FileText },
  { value: 'architecture_diagram', label: 'Architecture Diagram', icon: Image },
  { value: 'scan_results', label: 'Vulnerability Scan Results', icon: FileCheck },
  { value: 'assessment_report', label: 'Assessment Report', icon: FileText },
  { value: 'evidence_file', label: 'General Evidence File', icon: FileText },
  { value: 'configuration_file', label: 'Configuration File', icon: FileText },
  { value: 'test_results', label: 'Test Results', icon: FileCheck },
  { value: 'interview_notes', label: 'Interview Notes', icon: FileText }
];

const EVIDENCE_STATUS_OPTIONS = [
  { value: 'satisfies', label: 'Satisfies Control', color: 'text-green-600' },
  { value: 'partially_satisfies', label: 'Partially Satisfies', color: 'text-yellow-600' },
  { value: 'does_not_satisfy', label: 'Does Not Satisfy', color: 'text-red-600' },
  { value: 'not_applicable', label: 'Not Applicable', color: 'text-gray-600' }
];

export function EvidenceUploadManager({ systemId }: EvidenceUploadManagerProps) {
  const { toast } = useToast();
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [selectedControls, setSelectedControls] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    type: '',
    status: 'satisfies' as const,
    tags: '',
    controlIds: [] as string[]
  });

  // Fetch controls for linking
  const { data: controls = [] } = useQuery({
    queryKey: ['/api/controls', 'v2'],
    queryFn: async () => {
      const response = await authenticatedFetch('/api/controls?limit=2000');
      if (!response.ok) throw new Error('Failed to fetch controls');
      const data = await response.json();
      return data.controls || data;
    }
  }) as { data: Control[] };

  // Fetch artifacts for this system (backend uses 'artifacts' not 'evidence')
  const { data: evidence = [], isLoading: evidenceLoading, refetch: refetchEvidence } = useQuery({
    queryKey: ['/api/artifacts/systems', systemId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/artifacts/systems/${systemId}`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error('Failed to fetch artifacts');
      }
      const data = await response.json();
      return data.artifacts || data || [];
    },
    enabled: !!systemId
  });

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending' as const
    }));
    setUploadFiles(prev => [...prev, ...newFiles]);
    setIsUploadDialogOpen(true);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/svg+xml': ['.svg'],
      'application/json': ['.json', '.cklb'],
      'application/xml': ['.xml', '.ckl', '.nessus', '.xccdf'],
      'text/xml': ['.xml', '.ckl', '.nessus', '.xccdf'],
      'text/csv': ['.csv'],
      'application/octet-stream': ['.nessus', '.cklb', '.ckl']
    }
  });

  // Upload artifact mutation (backend uses 'artifacts' terminology)
  const uploadEvidence = useMutation({
    mutationFn: async (evidenceData: any) => {
      const formData = new FormData();
      formData.append('file', evidenceData.file);
      formData.append('systemId', systemId);
      formData.append('type', evidenceData.type);
      formData.append('title', evidenceData.title);
      
      if (evidenceData.description) {
        formData.append('description', evidenceData.description);
      }
      
      if (evidenceData.tags) {
        formData.append('tags', evidenceData.tags);
      }
      
      // Backend doesn't have status or controlIds in artifact schema
      // These would need to be handled separately via evidence records
      
      const response = await authenticatedFetch('/api/artifacts/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload artifact');
      }
      
      const result = await response.json();
      
      // If controlIds are specified, create evidence records linking to controls
      if (evidenceData.controlIds?.length > 0) {
        await Promise.all(
          evidenceData.controlIds.map(async (controlId: string) => {
            try {
              await authenticatedFetch('/api/evidence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  systemId,
                  controlId,
                  artifactId: result.artifact.id,
                  type: 'document',
                  description: evidenceData.title,
                  implementation: evidenceData.description || '',
                  status: evidenceData.status || 'satisfies'
                })
              });
            } catch (err) {
              console.warn('Failed to create evidence record:', err);
            }
          })
        );
      }
      
      return result;
    },
    onSuccess: (result) => {
      toast({
        title: 'Artifact Uploaded',
        description: result.processing ? 
          'File uploaded and processing started automatically.' : 
          'File has been successfully uploaded and linked to controls.'
      });
      refetchEvidence();
      setUploadFiles([]);
      setIsUploadDialogOpen(false);
      setUploadForm({
        title: '',
        description: '',
        type: '',
        status: 'satisfies',
        tags: '',
        controlIds: []
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload artifact',
        variant: 'destructive'
      });
    }
  });

  const handleUpload = () => {
    if (uploadFiles.length === 0 || !uploadForm.type || !uploadForm.title) {
      toast({
        title: 'Invalid Form',
        description: 'Please fill in all required fields and select files.',
        variant: 'destructive'
      });
      return;
    }

    uploadFiles.forEach(uploadFile => {
      uploadEvidence.mutate({
        file: uploadFile.file,
        title: uploadForm.title,
        description: uploadForm.description,
        type: uploadForm.type,
        tags: uploadForm.tags
      });
    });
  };

  const removeUploadFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Filter evidence based on search and filters
  const filteredEvidence = evidence.filter(item => {
    const matchesSearch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = EVIDENCE_STATUS_OPTIONS.find(s => s.value === status);
    const variant = status === 'satisfies' ? 'default' : 
                   status === 'partially_satisfies' ? 'secondary' : 
                   status === 'does_not_satisfy' ? 'destructive' : 'outline';
    
    return (
      <Badge variant={variant} className={statusConfig?.color}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6" data-testid="evidence-upload-manager">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Evidence Management</h3>
          <p className="text-muted-foreground">Upload and organize evidence artifacts for control verification</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsLinkDialogOpen(true)} variant="outline" data-testid="button-link-evidence">
            <Link className="h-4 w-4 mr-2" />
            Link to Controls
          </Button>
          <Button onClick={() => setIsUploadDialogOpen(true)} data-testid="button-upload-evidence">
            <Upload className="h-4 w-4 mr-2" />
            Upload Evidence
          </Button>
        </div>
      </div>

      {/* Upload Drop Zone */}
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-gray-300'
            }`}
            data-testid="dropzone-evidence-upload"
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            {isDragActive ? (
              <p className="text-lg font-medium text-blue-600">Drop the files here ...</p>
            ) : (
              <>
                <p className="text-lg font-medium mb-2">Drag & drop evidence files here</p>
                <p className="text-muted-foreground">or click to select files</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Supports: PDF, Word, Images, JSON, XML, CSV, Text files
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Evidence Library
          </CardTitle>
          <CardDescription>
            {evidence.length} evidence items uploaded for this system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Search evidence..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
                data-testid="input-search-evidence"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {EVIDENCE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {EVIDENCE_STATUS_OPTIONS.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Evidence Table */}
          {evidenceLoading ? (
            <div className="text-center py-8">Loading evidence...</div>
          ) : filteredEvidence.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No evidence found matching your criteria.</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvidence.map((item) => (
                    <TableRow key={item.id} data-testid={`row-evidence-${item.id}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.title}</div>
                          <div className="text-sm text-muted-foreground">{item.fileName}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-md">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {EVIDENCE_TYPES.find(t => t.value === item.type)?.label || item.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(item.status)}
                      </TableCell>
                      <TableCell>{formatBytes(item.fileSize)}</TableCell>
                      <TableCell>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" data-testid={`button-view-evidence-${item.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" data-testid={`button-link-controls-${item.id}`}>
                            <Link className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" data-testid={`button-download-evidence-${item.id}`}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Evidence</DialogTitle>
            <DialogDescription>
              Configure evidence details and link to applicable controls
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* File List */}
            {uploadFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files</Label>
                <div className="border rounded-lg p-3 space-y-2 max-h-32 overflow-y-auto">
                  {uploadFiles.map((uploadFile, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">{uploadFile.file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(uploadFile.file.size)}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeUploadFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="evidenceTitle">Title *</Label>
                <Input
                  id="evidenceTitle"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Evidence title"
                />
              </div>
              <div>
                <Label htmlFor="evidenceType">Type *</Label>
                <Select value={uploadForm.type} onValueChange={(value) => setUploadForm(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select evidence type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVIDENCE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="evidenceDescription">Description</Label>
              <Textarea
                id="evidenceDescription"
                value={uploadForm.description}
                onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe how this evidence supports compliance..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="evidenceStatus">Control Satisfaction</Label>
                <Select value={uploadForm.status} onValueChange={(value: any) => setUploadForm(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVIDENCE_STATUS_OPTIONS.map(status => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="evidenceTags">Tags</Label>
                <Input
                  id="evidenceTags"
                  value={uploadForm.tags}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </div>

            {/* Control Selection */}
            <div>
              <Label>Link to Controls</Label>
              <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                {controls.slice(0, 10).map(control => (
                  <div key={control.id} className="flex items-center space-x-2 py-1">
                    <input
                      type="checkbox"
                      id={`control-${control.id}`}
                      checked={uploadForm.controlIds.includes(control.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setUploadForm(prev => ({
                            ...prev,
                            controlIds: [...prev.controlIds, control.id]
                          }));
                        } else {
                          setUploadForm(prev => ({
                            ...prev,
                            controlIds: prev.controlIds.filter(id => id !== control.id)
                          }));
                        }
                      }}
                      className="rounded"
                    />
                    <Label htmlFor={`control-${control.id}`} className="text-sm">
                      {control.id} - {control.title}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={uploadEvidence.isPending || uploadFiles.length === 0 || !uploadForm.type || !uploadForm.title}
            >
              {uploadEvidence.isPending ? (
                <>Uploading...</>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Evidence
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}