import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  History, 
  Upload, 
  Download,
  Trash2,
  CheckCircle,
  AlertCircle,
  Eye,
  FileText,
  User,
  Calendar,
  ArrowUpDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { formatBytes } from '@/lib/utils';

interface TemplateVersionHistoryProps {
  templateId: string;
}

interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  changeLog?: string;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
}

export function TemplateVersionHistory({ templateId }: TemplateVersionHistoryProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<TemplateVersion | null>(null);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [changeLog, setChangeLog] = useState('');
  const { toast } = useToast();

  // Fetch template versions
  const { data: versions = [], isLoading, error } = useQuery({
    queryKey: ['template-versions', templateId],
    queryFn: async () => {
      const response = await apiRequest(`/api/templates/${templateId}/versions`);
      return response.versions as TemplateVersion[];
    },
    enabled: !!templateId
  });

  // Fetch template info
  const { data: templateInfo } = useQuery({
    queryKey: ['template-info', templateId],
    queryFn: async () => {
      const response = await apiRequest(`/api/templates/${templateId}`);
      return response.template;
    },
    enabled: !!templateId
  });

  // Activate version mutation
  const activateVersionMutation = useMutation({
    mutationFn: async (versionId: string) => {
      await apiRequest(`/api/templates/${templateId}/versions/${versionId}/activate`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-versions', templateId] });
      queryClient.invalidateQueries({ queryKey: ['template-info', templateId] });
      toast({
        title: 'Version Activated',
        description: 'Template version has been successfully activated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Activation Failed',
        description: (error as Error).message || 'Failed to activate version',
        variant: 'destructive',
      });
    }
  });

  // Upload new version mutation
  const uploadVersionMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest(`/api/templates/${templateId}/versions`, {
        method: 'POST',
        body: formData
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-versions', templateId] });
      queryClient.invalidateQueries({ queryKey: ['template-info', templateId] });
      toast({
        title: 'New Version Uploaded',
        description: 'New template version has been successfully uploaded.',
      });
      setShowUploadDialog(false);
      setNewVersionFile(null);
      setChangeLog('');
    },
    onError: (error) => {
      toast({
        title: 'Upload Failed',
        description: (error as Error).message || 'Failed to upload new version',
        variant: 'destructive',
      });
    }
  });

  // Delete version mutation
  const deleteVersionMutation = useMutation({
    mutationFn: async (versionId: string) => {
      await apiRequest(`/api/templates/${templateId}/versions/${versionId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-versions', templateId] });
      queryClient.invalidateQueries({ queryKey: ['template-info', templateId] });
      toast({
        title: 'Version Deleted',
        description: 'Template version has been successfully deleted.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Delete Failed',
        description: (error as Error).message || 'Failed to delete version',
        variant: 'destructive',
      });
    }
  });

  const handleActivateVersion = (version: TemplateVersion) => {
    if (version.isActive) return;
    
    if (confirm(`Are you sure you want to activate version ${version.version}? This will make it the active version for document generation.`)) {
      activateVersionMutation.mutate(version.id);
    }
  };

  const handleDeleteVersion = (version: TemplateVersion) => {
    if (version.isActive) {
      toast({
        title: 'Cannot Delete Active Version',
        description: 'You cannot delete the currently active version.',
        variant: 'destructive',
      });
      return;
    }

    if (confirm(`Are you sure you want to delete version ${version.version}? This action cannot be undone.`)) {
      deleteVersionMutation.mutate(version.id);
    }
  };

  const handleUploadNewVersion = () => {
    if (!newVersionFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a file to upload.',
        variant: 'destructive',
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', newVersionFile);
    formData.append('changeLog', changeLog);

    uploadVersionMutation.mutate(formData);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewVersionFile(file);
    }
  };

  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading version history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-600 p-4">
        <AlertCircle className="h-5 w-5" />
        <span>Error loading version history: {(error as Error).message}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Version History</h3>
          <p className="text-sm text-muted-foreground">
            {templateInfo?.name} • {versions.length} versions
          </p>
        </div>
        <Button onClick={() => setShowUploadDialog(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload New Version
        </Button>
      </div>

      {/* Versions Table */}
      <Card>
        <CardContent className="p-0">
          {versions.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No versions found</h3>
              <p className="text-muted-foreground mb-4">
                This template doesn't have any versions yet.
              </p>
              <Button onClick={() => setShowUploadDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload First Version
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedVersions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">v{version.version}</span>
                        {version.isActive && (
                          <Badge className="bg-green-100 text-green-800">
                            Active
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{version.fileName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatBytes(version.sizeBytes)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{version.createdBy}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(version.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {version.isActive ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedVersion(version)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/api/templates/${templateId}/versions/${version.id}/download`)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {!version.isActive && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleActivateVersion(version)}
                            >
                              <ArrowUpDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteVersion(version)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upload New Version Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload New Version</DialogTitle>
            <DialogDescription>
              Upload a new version of this template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="version-file">Template File</Label>
              <Input
                id="version-file"
                type="file"
                accept=".docx,.doc,.html,.txt,.md,.rtf,.odt"
                onChange={handleFileSelect}
              />
              {newVersionFile && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Selected: {newVersionFile.name} ({formatBytes(newVersionFile.size)})
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="change-log">Change Log</Label>
              <Textarea
                id="change-log"
                value={changeLog}
                onChange={(e) => setChangeLog(e.target.value)}
                placeholder="Describe what changed in this version..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUploadNewVersion}
              disabled={!newVersionFile || uploadVersionMutation.isPending}
            >
              {uploadVersionMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Version
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version Details Dialog */}
      {selectedVersion && (
        <Dialog open={!!selectedVersion} onOpenChange={() => setSelectedVersion(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Version {selectedVersion.version} Details</DialogTitle>
              <DialogDescription>
                {selectedVersion.fileName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Version</Label>
                  <p className="text-sm">v{selectedVersion.version}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <p className="text-sm">
                    {selectedVersion.isActive ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">File Size</Label>
                  <p className="text-sm">{formatBytes(selectedVersion.sizeBytes)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Created By</Label>
                  <p className="text-sm">{selectedVersion.createdBy}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Created</Label>
                  <p className="text-sm">
                    {new Date(selectedVersion.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Checksum</Label>
                  <p className="text-sm font-mono text-xs">{selectedVersion.checksum}</p>
                </div>
              </div>
              {selectedVersion.changeLog && (
                <div>
                  <Label className="text-sm font-medium">Change Log</Label>
                  <p className="text-sm bg-muted p-3 rounded-lg">
                    {selectedVersion.changeLog}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedVersion(null)}>
                Close
              </Button>
              <Button
                onClick={() => window.open(`/api/templates/${templateId}/versions/${selectedVersion.id}/download`)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
