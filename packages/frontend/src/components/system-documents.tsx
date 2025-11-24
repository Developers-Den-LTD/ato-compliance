import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  Download, 
  Eye, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';

interface Document {
  id: string;
  type: string;
  title: string;
  status: string;
  generatedBy?: string;
  filePath?: string;
  version?: string;
  createdAt: string;
  updatedAt: string;
  jobId?: string;
}

interface SystemDocumentsProps {
  systemId: string;
}

const documentTypeLabels: Record<string, string> = {
  'ssp': 'System Security Plan',
  'sar': 'Security Assessment Report', 
  'poam': 'Plan of Action & Milestones',
  'checklist': 'Security Checklist',
  'ato_package': 'ATO Package',
  'control_narrative': 'Control Narrative',
  'poam_report': 'POA&M Report',
  'sar_package': 'SAR Package',
  'complete_ato_package': 'Complete ATO Package',
  'stig_checklist': 'STIG Checklist',
  'evidence_summary': 'Evidence Summary',
  'sctm_excel': 'Security Control Traceability Matrix',
  'rar': 'Risk Assessment Report',
  'pps_worksheet': 'Privacy Impact Assessment Worksheet'
};

const statusColors: Record<string, string> = {
  'draft': 'secondary',
  'review': 'outline', 
  'approved': 'default',
  'final': 'default'
};

const statusIcons: Record<string, React.ReactNode> = {
  'draft': <Clock className="w-4 h-4" />,
  'review': <AlertTriangle className="w-4 h-4" />,
  'approved': <CheckCircle className="w-4 h-4" />,
  'final': <CheckCircle className="w-4 h-4" />
};

export function SystemDocuments({ systemId }: SystemDocumentsProps) {
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch system documents
  const { data: documents, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/systems', systemId, 'documents'],
    queryFn: async () => {
      const getAuthToken = () => localStorage.getItem('sessionToken');
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['X-Session-Token'] = token;
      } else {
        headers['Authorization'] = 'Bearer dev-token-123';
      }

      const response = await fetch(`/api/systems/${systemId}/documents`, {
        headers,
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      const result = await response.json();
      return result.documents || [];
    },
    enabled: !!systemId
  }) as { data: Document[] | undefined, isLoading: boolean, error: Error | null, refetch: () => void };

  // Ensure documents is always an array, even when query fails
  const safeDocuments = documents || [];

  // Filter documents based on selected filters
  const filteredDocuments = safeDocuments.filter(doc => {
    const typeMatch = typeFilter === 'all' || doc.type === typeFilter;
    const statusMatch = statusFilter === 'all' || doc.status === statusFilter;
    return typeMatch && statusMatch;
  });

  const handleDownload = async (document: Document) => {
    try {
      if (!document.filePath) {
        toast({
          title: 'Download Unavailable',
          description: 'This document does not have a downloadable file.',
          variant: 'destructive',
        });
        return;
      }

      // Use the artifact download endpoint for documents
      const downloadUrl = `/api/artifacts/public/${document.id}/${encodeURIComponent(document.title)}.pdf`;
      
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${document.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Download Started',
        description: `Downloading ${document.title}...`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download Failed',
        description: 'There was an error downloading the document.',
        variant: 'destructive',
      });
    }
  };

  const handleView = (document: Document) => {
    // For now, show document details in a toast
    // This could be expanded to open a modal or navigate to a detail view
    toast({
      title: 'Document Details',
      description: `${documentTypeLabels[document.type] || document.type} - Version ${document.version || '1.0'}`,
    });
  };

  // Get unique document types and statuses for filters
  const availableTypes = [...new Set(safeDocuments.map(doc => doc.type))];
  const availableStatuses = [...new Set(safeDocuments.map(doc => doc.status))];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            System Documents
          </CardTitle>
          <CardDescription>
            Generated compliance documents and reports for this system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            System Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Documents</h3>
            <p className="text-muted-foreground mb-4">
              {error.message || 'Failed to load system documents'}
            </p>
            <Button onClick={() => refetch()} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          System Documents
        </CardTitle>
        <CardDescription>
          Generated compliance documents and reports for this system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48" data-testid="select-document-type-filter">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {availableTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {documentTypeLabels[type] || type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48" data-testid="select-document-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {availableStatuses.map(status => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Documents Table */}
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {safeDocuments.length === 0 ? 'No Documents Found' : 'No Documents Match Filters'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {safeDocuments.length === 0
                ? 'No compliance documents have been generated for this system yet.'
                : 'Try adjusting your filters to see more documents.'}
            </p>
            {safeDocuments.length === 0 && (
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/document-generation'}
                data-testid="button-generate-documents"
              >
                Generate Documents
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id} data-testid={`document-row-${doc.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium" data-testid={`document-title-${doc.id}`}>
                          {doc.title}
                        </div>
                        {doc.generatedBy && (
                          <div className="text-sm text-muted-foreground">
                            Generated by {doc.generatedBy === 'ai_generated' ? 'AI' : 'Manual'}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm" data-testid={`document-type-${doc.id}`}>
                        {documentTypeLabels[doc.type] || doc.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={statusColors[doc.status] as any || 'secondary'}
                        className="flex items-center gap-1 w-fit"
                        data-testid={`document-status-${doc.id}`}
                      >
                        {statusIcons[doc.status]}
                        {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm" data-testid={`document-date-${doc.id}`}>
                        {format(new Date(doc.createdAt), 'MMM dd, yyyy')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm" data-testid={`document-version-${doc.id}`}>
                        {doc.version || '1.0'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(doc)}
                          data-testid={`button-view-${doc.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(doc)}
                          disabled={!doc.filePath}
                          data-testid={`button-download-${doc.id}`}
                        >
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

        {/* Summary */}
        {filteredDocuments.length > 0 && (
          <div className="text-sm text-muted-foreground" data-testid="documents-summary">
            Showing {filteredDocuments.length} of {safeDocuments.length} documents
          </div>
        )}
      </CardContent>
    </Card>
  );
}