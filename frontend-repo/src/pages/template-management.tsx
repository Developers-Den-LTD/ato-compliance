import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Upload, 
  FileText, 
  Eye, 
  Trash2, 
  Download,
  Plus,
  Search,
  Filter,
  History,
  Settings,
  AlertCircle,
  CheckCircle,
  X,
  FileCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { formatBytes } from '@/lib/utils';
import { TemplateUploadManager } from '@/components/template-upload-manager';
import { TemplatePreview } from '@/components/template-preview';
import { TemplateVersionHistory } from '@/components/template-version-history';

interface Template {
  id: string;
  name: string;
  description?: string;
  type: 'ssp' | 'sar' | 'poam' | 'checklist' | 'ato_package';
  status: 'active' | 'inactive' | 'deprecated';
  organizationId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
  tags?: string[];
  isPublic: boolean;
  sizeBytes: number;
  checksum: string;
  versionCount: number;
  activeVersion?: {
    id: string;
    version: number;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  };
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

export default function TemplateManagement() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const { toast } = useToast();

  // Fetch templates
  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const response = await apiRequest('/api/templates');
      return response.templates as Template[];
    }
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      await apiRequest(`/api/templates/${templateId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast({
        title: 'Template Deleted',
        description: 'Template has been successfully deleted.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Delete Failed',
        description: (error as Error).message || 'Failed to delete template',
        variant: 'destructive',
      });
    }
  });

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || template.type === filterType;
    const matchesStatus = filterStatus === 'all' || template.status === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleDeleteTemplate = (template: Template) => {
    if (confirm(`Are you sure you want to delete "${template.name}"? This action cannot be undone.`)) {
      deleteTemplateMutation.mutate(template.id);
    }
  };

  const handlePreviewTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setShowPreviewDialog(true);
  };

  const handleViewVersions = (template: Template) => {
    setSelectedTemplate(template);
    setShowVersionDialog(true);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'ssp': return 'bg-blue-100 text-blue-800';
      case 'sar': return 'bg-green-100 text-green-800';
      case 'poam': return 'bg-yellow-100 text-yellow-800';
      case 'checklist': return 'bg-purple-100 text-purple-800';
      case 'ato_package': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'deprecated': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>Error loading templates: {(error as Error).message}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Template Management</h1>
          <p className="text-muted-foreground">
            Upload and manage document templates for custom document generation
          </p>
        </div>
        <Button onClick={() => setShowUploadDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Upload Template
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Templates</p>
                <p className="text-2xl font-bold">{templates.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Templates</p>
                <p className="text-2xl font-bold">{templates.filter(t => t.status === 'active').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">SSP Templates</p>
                <p className="text-2xl font-bold">{templates.filter(t => t.type === 'ssp').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Download className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Size</p>
                <p className="text-2xl font-bold">
                  {formatBytes(templates.reduce((sum, t) => sum + t.sizeBytes, 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Templates</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="type-filter">Document Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="ssp">SSP</SelectItem>
                  <SelectItem value="sar">SAR</SelectItem>
                  <SelectItem value="poam">POA&M</SelectItem>
                  <SelectItem value="checklist">Checklist</SelectItem>
                  <SelectItem value="ato_package">ATO Package</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="deprecated">Deprecated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Templates ({filteredTemplates.length})</CardTitle>
          <CardDescription>
            Manage your document templates and their versions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading templates...</p>
              </div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center p-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No templates found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || filterType !== 'all' || filterStatus !== 'all'
                  ? 'Try adjusting your filters to see more templates.'
                  : 'Get started by uploading your first template.'}
              </p>
              {!searchTerm && filterType === 'all' && filterStatus === 'all' && (
                <Button onClick={() => setShowUploadDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Template
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        {template.description && (
                          <div className="text-sm text-muted-foreground">
                            {template.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getTypeColor(template.type)}>
                        {template.type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(template.status)}>
                        {template.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>v{template.activeVersion?.version || 1}</span>
                        {template.versionCount > 1 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.versionCount - 1}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatBytes(template.sizeBytes)}</TableCell>
                    <TableCell>
                      {new Date(template.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreviewTemplate(template)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewVersions(template)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTemplate(template)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Template</DialogTitle>
            <DialogDescription>
              Upload a new document template for custom document generation
            </DialogDescription>
          </DialogHeader>
          <TemplateUploadManager
            onSuccess={() => {
              setShowUploadDialog(false);
              queryClient.invalidateQueries({ queryKey: ['templates'] });
            }}
            onCancel={() => setShowUploadDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {selectedTemplate && (
        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Template Preview: {selectedTemplate.name}</DialogTitle>
              <DialogDescription>
                Preview template variables and structure
              </DialogDescription>
            </DialogHeader>
            <TemplatePreview templateId={selectedTemplate.id} />
          </DialogContent>
        </Dialog>
      )}

      {/* Version History Dialog */}
      {selectedTemplate && (
        <Dialog open={showVersionDialog} onOpenChange={setShowVersionDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Version History: {selectedTemplate.name}</DialogTitle>
              <DialogDescription>
                Manage template versions and rollback changes
              </DialogDescription>
            </DialogHeader>
            <TemplateVersionHistory templateId={selectedTemplate.id} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
