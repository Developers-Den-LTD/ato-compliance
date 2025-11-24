import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  FileText, 
  Code, 
  Eye, 
  Download,
  AlertCircle,
  CheckCircle,
  Info,
  Variable,
  Layers,
  Shield
} from 'lucide-react';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface TemplatePreviewProps {
  templateId: string;
}

interface TemplateParseResult {
  success: boolean;
  variables: Array<{
    name: string;
    type: string;
    description?: string;
    required: boolean;
    defaultValue?: any;
    examples?: string[];
  }>;
  structure: {
    sections: Array<{
      name: string;
      type: string;
      content: string;
      variables: string[];
    }>;
    documentType: string;
    complianceRequirements: string[];
  };
  errors?: Array<{
    type: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
}

export function TemplatePreview({ templateId }: TemplatePreviewProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch template info first
  const { data: templateInfo } = useQuery({
    queryKey: ['template-info', templateId],
    queryFn: async () => {
      const response = await apiRequest(`/api/templates/${templateId}`);
      return response.template;
    },
    enabled: !!templateId
  });

  // Fetch template parse result only if template has active version
  const { data: parseResult, isLoading, error } = useQuery({
    queryKey: ['template-parse', templateId],
    queryFn: async () => {
      const response = await apiRequest(`/api/templates/${templateId}/parse`);
      return response as TemplateParseResult;
    },
    enabled: !!templateId && !!templateInfo?.activeVersion
  });

  const getVariableTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'text': return 'bg-blue-100 text-blue-800';
      case 'number': return 'bg-green-100 text-green-800';
      case 'date': return 'bg-purple-100 text-purple-800';
      case 'boolean': return 'bg-yellow-100 text-yellow-800';
      case 'list': return 'bg-pink-100 text-pink-800';
      case 'object': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      case 'info': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <AlertCircle className="h-4 w-4" />;
      case 'warning': return <AlertCircle className="h-4 w-4" />;
      case 'info': return <Info className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Analyzing template...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-600 p-4">
        <AlertCircle className="h-5 w-5" />
        <span>Error loading template preview: {(error as Error).message}</span>
      </div>
    );
  }

  if (!parseResult) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-4">
        <Info className="h-5 w-5" />
        <span>No template data available</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Template Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Template Overview
          </CardTitle>
          <CardDescription>
            {templateInfo?.name} • {templateInfo?.type?.toUpperCase()} • v{templateInfo?.activeVersion?.version}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {parseResult?.variables?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Variables</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {parseResult?.structure?.sections?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Sections</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {parseResult?.structure?.complianceRequirements?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Compliance Requirements</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parse Status */}
      {parseResult?.errors && parseResult.errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Parse Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {parseResult.errors.map((error, index) => (
                <div key={index} className={`flex items-center gap-2 p-3 rounded-lg border ${getSeverityColor(error.severity)}`}>
                  {getSeverityIcon(error.severity)}
                  <div>
                    <div className="font-medium">{error.type}</div>
                    <div className="text-sm">{error.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Analysis */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="variables">Variables</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Template Analysis Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Document Type</h4>
                  <Badge variant="outline">{parseResult?.structure?.documentType || 'Unknown'}</Badge>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Variable Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {['text', 'number', 'date', 'boolean', 'list', 'object'].map(type => {
                      const count = parseResult?.variables?.filter(v => v.type.toLowerCase() === type)?.length || 0;
                      return count > 0 ? (
                        <div key={type} className="text-center">
                          <div className="text-lg font-bold">{count}</div>
                          <div className="text-xs text-muted-foreground capitalize">{type}</div>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Required Variables</h4>
                  <div className="text-sm text-muted-foreground">
                    {parseResult?.variables?.filter(v => v.required)?.length || 0} of {parseResult?.variables?.length || 0} variables are required
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variables" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Variable className="h-5 w-5" />
                Template Variables
              </CardTitle>
              <CardDescription>
                Variables found in the template that will be replaced during generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(parseResult?.variables?.length || 0) === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Variable className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No variables found in this template</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variable Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Examples</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(parseResult?.variables || []).map((variable, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <code className="bg-muted px-2 py-1 rounded text-sm">
                            {`{{${variable.name}}}`}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge className={getVariableTypeColor(variable.type)}>
                            {variable.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {variable.required ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <div className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell>
                          {variable.description || (
                            <span className="text-muted-foreground italic">No description</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {variable.examples && variable.examples.length > 0 ? (
                            <div className="space-y-1">
                              {variable.examples.slice(0, 2).map((example, i) => (
                                <div key={i} className="text-xs bg-muted px-2 py-1 rounded">
                                  {example}
                                </div>
                              ))}
                              {variable.examples.length > 2 && (
                                <div className="text-xs text-muted-foreground">
                                  +{variable.examples.length - 2} more
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">No examples</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="structure" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Document Structure
              </CardTitle>
              <CardDescription>
                Sections and structure identified in the template
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(parseResult?.structure?.sections?.length || 0) === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sections identified in this template</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(parseResult?.structure?.sections || []).map((section, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{section.name}</h4>
                        <Badge variant="outline">{section.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {section.content.substring(0, 200)}
                        {section.content.length > 200 && '...'}
                      </p>
                      {section.variables.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            Variables in this section:
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {section.variables.map((variable, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {variable}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Compliance Requirements
              </CardTitle>
              <CardDescription>
                NIST 800-53 controls and compliance requirements identified
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(parseResult?.structure?.complianceRequirements?.length || 0) === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No compliance requirements identified</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(parseResult?.structure?.complianceRequirements || []).map((requirement, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                      <Shield className="h-4 w-4 text-blue-600" />
                      <span className="font-mono text-sm">{requirement}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
        <Button>
          <FileText className="h-4 w-4 mr-2" />
          Use Template
        </Button>
      </div>
    </div>
  );
}
