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
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Upload, 
  FileText, 
  Image, 
  Shield, 
  Download, 
  Trash2, 
  Eye, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Database,
  Settings,
  FileCheck,
  Code,
  Server,
  Scan
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { formatBytes } from '@/lib/utils';

// Types
interface System {
  id: string;
  name: string;
  impact_level?: string;
  impactLevel?: string;
}

interface ArtifactInfo {
  id: string;
  title: string;
  type: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  isPublic: boolean;
  uploadDate: Date;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface UploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  artifactId?: string;
}

const ARTIFACT_TYPES = [
  { value: 'architecture_diagram', label: 'Architecture Diagram', icon: Image },
  { value: 'system_documentation', label: 'System Documentation', icon: FileText },
  { value: 'evidence_file', label: 'Evidence File', icon: FileCheck },
  { value: 'policy_document', label: 'Policy Document', icon: Shield },
  { value: 'procedure_document', label: 'Procedure Document', icon: Settings },
  { value: 'assessment_report', label: 'Assessment Report', icon: Database },
  { value: 'scan_results', label: 'Vulnerability Scan Results', icon: Scan },
  { value: 'source_code', label: 'Application Source Code', icon: Code },
  { value: 'infrastructure_code', label: 'Infrastructure as Code (IAC)', icon: Server },
  { value: 'other', label: 'Other Document', icon: FileText }
];

// Artifact-type-specific MIME type mappings that match server validation exactly
const ARTIFACT_TYPE_MIME_MAPPINGS = {
  architecture_diagram: {
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/svg+xml': ['.svg'],
    'image/gif': ['.gif'],
    'application/pdf': ['.pdf'],
    'application/vnd.visio': ['.vsd', '.vsdx'],
    'image/vnd.microsoft.icon': ['.ico']
  },
  system_documentation: {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt', '.md'],
    'text/markdown': ['.md'],
    'text/x-markdown': ['.md'],
    'text/html': ['.html', '.htm'],
    'text/csv': ['.csv'],
    'application/json': ['.json'],
    'application/xml': ['.xml'],
    'text/xml': ['.xml'],
    'text/yaml': ['.yaml', '.yml'],
    'text/x-yaml': ['.yaml', '.yml'],
    'application/x-yaml': ['.yaml', '.yml']
  },
  evidence_file: {
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/gif': ['.gif'],
    'application/pdf': ['.pdf'],
    'text/plain': ['.txt'],
    'text/csv': ['.csv'],
    'application/json': ['.json'],
    'application/xml': ['.xml'],
    'text/xml': ['.xml'],
    'text/markdown': ['.md'],
    'text/html': ['.html', '.htm']
  },
  policy_document: {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt'],
    'text/markdown': ['.md'],
    'text/html': ['.html', '.htm']
  },
  procedure_document: {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt'],
    'text/markdown': ['.md'],
    'text/html': ['.html', '.htm']
  },
  assessment_report: {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'text/plain': ['.txt'],
    'text/csv': ['.csv']
  },
  scan_results: {
    'application/xml': ['.xml', '.ckl'],
    'text/xml': ['.xml', '.ckl'],
    'application/json': ['.json', '.cklb'],
    'text/plain': ['.txt'],
    'text/csv': ['.csv'],
    'application/pdf': ['.pdf'],
    'application/octet-stream': ['.nessus', '.cklb']
  },
  source_code: {
    'text/plain': ['.txt', '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.cs', '.cpp', '.c', '.h', '.go', '.rs', '.php', '.rb', '.sh'],
    'text/javascript': ['.js'],
    'text/typescript': ['.ts', '.tsx'],
    'text/python': ['.py'],
    'text/java': ['.java'],
    'text/go': ['.go'],
    'text/cpp': ['.cpp', '.c', '.h'],
    'text/html': ['.html', '.htm'],
    'text/css': ['.css'],
    'application/json': ['.json'],
    'text/yaml': ['.yaml', '.yml'],
    'text/x-yaml': ['.yaml', '.yml'],
    'application/x-yaml': ['.yaml', '.yml']
  },
  infrastructure_code: {
    'text/plain': ['.tf', '.hcl', '.bicep', '.ps1', '.dockerfile'],
    'text/yaml': ['.yaml', '.yml'],
    'text/x-yaml': ['.yaml', '.yml'],
    'application/x-yaml': ['.yaml', '.yml'],
    'application/json': ['.json'],
    'text/hcl': ['.hcl'],
    'text/terraform': ['.tf'],
    'application/x-powershell': ['.ps1'],
    'text/dockerfile': ['.dockerfile']
  },
  other: {
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/gif': ['.gif'],
    'image/svg+xml': ['.svg'],
    'application/pdf': ['.pdf'],
    'text/plain': ['.txt'],
    'application/json': ['.json'],
    'text/markdown': ['.md'],
    'text/yaml': ['.yaml', '.yml'],
    'text/x-yaml': ['.yaml', '.yml']
  }
};

export default function DataIngestion() {
  // Get accepted file types for the current artifact type
  const getAcceptedFileTypes = (artifactType: string) => {
    return ARTIFACT_TYPE_MIME_MAPPINGS[artifactType as keyof typeof ARTIFACT_TYPE_MIME_MAPPINGS] || ARTIFACT_TYPE_MIME_MAPPINGS.other;
  };

  // Get user-friendly description of accepted file types for each artifact type
  const getFileTypeDescription = (artifactType: string) => {
    const descriptions = {
      architecture_diagram: 'Images (PNG, JPEG, SVG, GIF), PDF, Visio files (.vsd, .vsdx), Icons',
      system_documentation: 'PDF, Word docs, Text files, Markdown, HTML, CSV, JSON, XML, YAML',
      evidence_file: 'Images (PNG, JPEG, GIF), PDF, Text files, CSV, JSON, XML, Markdown, HTML',
      policy_document: 'PDF, Word docs, Text files, Markdown, HTML',
      procedure_document: 'PDF, Word docs, Text files, Markdown, HTML',
      assessment_report: 'PDF, Word docs, Excel files, Text files, CSV',
      source_code: 'Source code files (.js, .ts, .py, .java, .go, .cpp, .rs, etc.), JSON, YAML, HTML, CSS',
      infrastructure_code: 'Infrastructure files (.tf, .hcl, .bicep, .ps1, .dockerfile), YAML, JSON',
      scan_results: 'SARIF (.sarif), XML scan files (.nessus, .scap), JSON, Text logs, PDF reports',
      other: 'Images, PDF, Text files, JSON, Markdown, YAML'
    };
    
    return descriptions[artifactType as keyof typeof descriptions] || descriptions.other;
  };

  const { toast } = useToast();
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [uploadMetadata, setUploadMetadata] = useState({
    title: '',
    description: '',
    type: 'system_documentation' as const,
    tags: '',
    isPublic: false
  });

  // Fetch systems for selection
  const { data: systemsResponse, isLoading: systemsLoading } = useQuery<{ systems: System[]; totalCount: number }>({
    queryKey: ['/api/systems'],
    enabled: true
  });

  const systems = systemsResponse?.systems || [];

  // Fetch artifacts for selected system
  const { data: artifactsData, isLoading: artifactsLoading, refetch: refetchArtifacts } = useQuery({
    queryKey: ['/api/artifacts/systems', selectedSystem],
    enabled: !!selectedSystem,
    select: (data: any) => data.artifacts || []
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, metadata }: { file: File, metadata: any }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('systemId', selectedSystem);
      formData.append('type', metadata.type);
      formData.append('title', metadata.title || file.name);
      formData.append('description', metadata.description || '');
      formData.append('tags', metadata.tags || '');
      formData.append('isPublic', metadata.isPublic.toString());

      // Use apiRequest for FormData uploads
      const response = await apiRequest('POST', '/api/artifacts/upload', formData);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return await response.json();
    },
    onSuccess: (data, { file }) => {
      setUploadFiles(prev => prev.map(f => 
        f.file === file 
          ? { ...f, status: 'completed', progress: 100, artifactId: data.artifact?.id }
          : f
      ));
      queryClient.invalidateQueries({ queryKey: ['/api/artifacts/systems', selectedSystem] });
      toast({
        title: "Upload successful",
        description: `${file.name} has been uploaded successfully.`
      });
    },
    onError: (error: any, { file }) => {
      setUploadFiles(prev => prev.map(f => 
        f.file === file 
          ? { ...f, status: 'error', error: error.message }
          : f
      ));
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete artifact mutation
  const deleteMutation = useMutation({
    mutationFn: async (artifactId: string) => {
      const response = await apiRequest('DELETE', `/api/artifacts/by-id/${artifactId}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/artifacts/systems', selectedSystem] });
      toast({
        title: "Deleted successfully",
        description: "The artifact has been removed."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Drop zone configuration with type-specific file acceptance
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newUploadFiles: UploadFile[] = acceptedFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending'
    }));
    
    setUploadFiles(prev => [...prev, ...newUploadFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: getAcceptedFileTypes(uploadMetadata.type),
    multiple: true,
    disabled: !selectedSystem
  });

  const handleUpload = async (uploadFile: UploadFile) => {
    if (!selectedSystem) {
      toast({
        title: "No system selected",
        description: "Please select a system before uploading files.",
        variant: "destructive"
      });
      return;
    }

    setUploadFiles(prev => prev.map(f => 
      f.file === uploadFile.file 
        ? { ...f, status: 'uploading', progress: 25 }
        : f
    ));

    // Update progress during upload with realistic progress simulation
    const progressInterval = setInterval(() => {
      setUploadFiles(prev => prev.map(f => {
        if (f.file === uploadFile.file && f.status === 'uploading' && f.progress < 90) {
          return { ...f, progress: Math.min(f.progress + 15, 90) };
        }
        return f;
      }));
    }, 300);

    try {
      await uploadMutation.mutateAsync({
        file: uploadFile.file,
        metadata: {
          ...uploadMetadata,
          title: uploadMetadata.title || uploadFile.file.name
        }
      });
    } finally {
      clearInterval(progressInterval);
    }
  };

  const handleBulkUpload = () => {
    const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
    pendingFiles.forEach(handleUpload);
  };

  const removeUploadFile = (file: File) => {
    setUploadFiles(prev => prev.filter(f => f.file !== file));
  };

  const clearCompleted = () => {
    setUploadFiles(prev => prev.filter(f => f.status !== 'completed'));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'uploading': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getArtifactTypeInfo = (type: string) => {
    return ARTIFACT_TYPES.find(t => t.value === type) || ARTIFACT_TYPES[ARTIFACT_TYPES.length - 1];
  };

  if (systemsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Upload className="h-6 w-6 text-blue-600" />
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Data Ingestion</h1>
        </div>
        <p className="text-muted-foreground">Loading systems...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-2">
        <Upload className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Data Ingestion</h1>
          <p className="text-muted-foreground">Upload security scan results, architecture diagrams, and system documentation</p>
        </div>
      </div>

      {/* System Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Target System</CardTitle>
          <CardDescription>Choose the system for document association and compliance tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="system-select" data-testid="label-system">System</Label>
              <Select value={selectedSystem} onValueChange={setSelectedSystem} data-testid="select-system">
                <SelectTrigger data-testid="select-system-trigger">
                  <SelectValue placeholder="Select a system to upload documents for..." />
                </SelectTrigger>
                <SelectContent>
                  {systems.map((system) => (
                    <SelectItem key={system.id} value={system.id} data-testid={`system-option-${system.id}`}>
                      <div className="flex items-center gap-2">
                        <span>{system.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {system.impact_level || system.impactLevel}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSystem && (
              <div className="text-sm text-muted-foreground" data-testid="text-selected-system">
                Selected: <strong>{systems.find((s) => s.id === selectedSystem)?.name}</strong>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload" data-testid="tab-upload">Upload Documents</TabsTrigger>
          <TabsTrigger value="manage" data-testid="tab-manage">Manage Artifacts</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          {/* Upload Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Configuration</CardTitle>
              <CardDescription>Set default metadata for uploaded documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title" data-testid="label-title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Default title (or leave empty to use filename)"
                    value={uploadMetadata.title}
                    onChange={(e) => setUploadMetadata(prev => ({ ...prev, title: e.target.value }))}
                    data-testid="input-title"
                  />
                </div>
                
                <div>
                  <Label htmlFor="type" data-testid="label-type">Document Type</Label>
                  <Select value={uploadMetadata.type} onValueChange={(value: any) => setUploadMetadata(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger data-testid="select-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ARTIFACT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value} data-testid={`type-option-${type.value}`}>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="tags" data-testid="label-tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    placeholder="security, compliance, assessment"
                    value={uploadMetadata.tags}
                    onChange={(e) => setUploadMetadata(prev => ({ ...prev, tags: e.target.value }))}
                    data-testid="input-tags"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="public"
                    checked={uploadMetadata.isPublic}
                    onChange={(e) => setUploadMetadata(prev => ({ ...prev, isPublic: e.target.checked }))}
                    data-testid="checkbox-public"
                  />
                  <Label htmlFor="public" data-testid="label-public">Make files publicly accessible</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="description" data-testid="label-description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional description for uploaded documents"
                  value={uploadMetadata.description}
                  onChange={(e) => setUploadMetadata(prev => ({ ...prev, description: e.target.value }))}
                  data-testid="textarea-description"
                />
              </div>
            </CardContent>
          </Card>

          {/* File Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle>File Upload</CardTitle>
              <CardDescription>Drag and drop files or click to browse</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-blue-400 bg-blue-50 dark:bg-blue-950' : 'border-gray-300 dark:border-gray-600'
                } ${!selectedSystem ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'}`}
                data-testid="dropzone-area"
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                {!selectedSystem ? (
                  <p className="text-muted-foreground">Please select a system first</p>
                ) : isDragActive ? (
                  <p className="text-blue-600">Drop the files here...</p>
                ) : (
                  <div>
                    <p className="text-lg font-medium">Drop files here or click to browse</p>
                    <div className="text-sm text-muted-foreground mt-2">
                      <p className="font-medium mb-1">Accepted for {ARTIFACT_TYPES.find(t => t.value === uploadMetadata.type)?.label}:</p>
                      <p>{getFileTypeDescription(uploadMetadata.type)}</p>
                    </div>
                  </div>
                )}
              </div>

              {uploadFiles.length > 0 && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold" data-testid="text-upload-queue">Upload Queue ({uploadFiles.length})</h3>
                    <div className="space-x-2">
                      <Button 
                        onClick={handleBulkUpload} 
                        disabled={!uploadFiles.some(f => f.status === 'pending') || uploadMutation.isPending}
                        data-testid="button-upload-all"
                      >
                        Upload All
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={clearCompleted}
                        disabled={!uploadFiles.some(f => f.status === 'completed')}
                        data-testid="button-clear-completed"
                      >
                        Clear Completed
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {uploadFiles.map((uploadFile, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover-elevate" data-testid={`upload-file-${index}`}>
                        <div className="flex items-center gap-3 flex-1">
                          {getStatusIcon(uploadFile.status)}
                          <div className="flex-1">
                            <p className="font-medium text-sm">{uploadFile.file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatBytes(uploadFile.file.size)} • {uploadFile.file.type}
                            </p>
                            {uploadFile.status === 'uploading' && (
                              <Progress value={uploadFile.progress} className="mt-1 h-1" />
                            )}
                            {uploadFile.error && (
                              <p className="text-xs text-red-600 mt-1">{uploadFile.error}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {uploadFile.status === 'pending' && (
                            <Button 
                              size="sm" 
                              onClick={() => handleUpload(uploadFile)}
                              disabled={uploadMutation.isPending}
                              data-testid={`button-upload-${index}`}
                            >
                              Upload
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => removeUploadFile(uploadFile.file)}
                            data-testid={`button-remove-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Artifacts</CardTitle>
              <CardDescription>
                {selectedSystem ? 
                  `Manage documents for ${systems.find((s) => s.id === selectedSystem)?.name}` :
                  'Select a system to view its artifacts'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedSystem ? (
                <p className="text-center text-muted-foreground py-8">Please select a system to view artifacts</p>
              ) : artifactsLoading ? (
                <p className="text-center text-muted-foreground py-8">Loading artifacts...</p>
              ) : artifactsData && artifactsData.length > 0 ? (
                <div className="space-y-4">
                  {artifactsData.map((artifact: ArtifactInfo) => {
                    const typeInfo = getArtifactTypeInfo(artifact.type);
                    return (
                      <div key={artifact.id} className="flex items-center justify-between p-4 border rounded-lg hover-elevate" data-testid={`artifact-${artifact.id}`}>
                        <div className="flex items-center gap-3 flex-1">
                          <typeInfo.icon className="h-5 w-5 text-blue-600" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm" data-testid={`artifact-title-${artifact.id}`}>{artifact.title}</h3>
                              <Badge variant="outline" className="text-xs">
                                {typeInfo.label}
                              </Badge>
                              {artifact.isPublic && (
                                <Badge variant="secondary" className="text-xs">Public</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {artifact.fileName} • {formatBytes(artifact.fileSize)} • {new Date(artifact.uploadDate).toLocaleDateString()}
                            </p>
                            {artifact.tags && artifact.tags.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {artifact.tags.map(tag => (
                                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(artifact.url, '_blank')}
                            data-testid={`button-view-${artifact.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const a = document.createElement('a');
                              a.href = artifact.url;
                              a.download = artifact.fileName;
                              a.click();
                            }}
                            data-testid={`button-download-${artifact.id}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteMutation.mutate(artifact.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${artifact.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-artifacts">
                  <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No artifacts found for this system</p>
                  <p className="text-sm">Upload documents using the "Upload Documents" tab</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}