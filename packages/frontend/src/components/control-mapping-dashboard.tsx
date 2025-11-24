import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, Filter, Download, RefreshCw, Eye, Edit, Trash2 } from 'lucide-react';

interface ControlMapping {
  id: string;
  documentId: string;
  controlId: string;
  controlFramework: string;
  confidenceScore: number;
  mappingCriteria: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

interface ControlRelationship {
  id: string;
  sourceControlId: string;
  targetControlId: string;
  relationshipType: string;
  framework: string;
  strength: number;
}

interface CoverageReport {
  totalControls: number;
  mappedControls: number;
  coveragePercentage: number;
  highConfidenceMappings: number;
  mediumConfidenceMappings: number;
  lowConfidenceMappings: number;
}

export function ControlMappingDashboard() {
  const [mappings, setMappings] = useState<ControlMapping[]>([]);
  const [relationships, setRelationships] = useState<ControlRelationship[]>([]);
  const [coverageReport, setCoverageReport] = useState<CoverageReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    documentId: '',
    controlId: '',
    framework: '',
    minConfidence: 70,
    limit: 50
  });
  const [selectedMapping, setSelectedMapping] = useState<ControlMapping | null>(null);

  // Load initial data
  useEffect(() => {
    loadMappings();
    loadCoverageReport();
  }, []);

  const loadMappings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const queryParams = new URLSearchParams();
      if (filters.documentId) queryParams.append('documentId', filters.documentId);
      if (filters.controlId) queryParams.append('controlId', filters.controlId);
      if (filters.framework) queryParams.append('framework', filters.framework);
      if (filters.minConfidence) queryParams.append('minConfidence', filters.minConfidence.toString());
      if (filters.limit) queryParams.append('limit', filters.limit.toString());

      const response = await fetch(`/api/v1/control-mapping/mappings?${queryParams}`);
      if (!response.ok) throw new Error('Failed to load mappings');
      
      const data = await response.json();
      setMappings(data.data.mappings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mappings');
    } finally {
      setLoading(false);
    }
  };

  const loadCoverageReport = async () => {
    if (!filters.documentId) return;
    
    try {
      const response = await fetch(`/api/v1/control-mapping/coverage/${filters.documentId}`);
      if (!response.ok) throw new Error('Failed to load coverage report');
      
      const data = await response.json();
      setCoverageReport(data.data);
    } catch (err) {
      console.error('Failed to load coverage report:', err);
    }
  };

  const mapDocumentToControls = async () => {
    if (!filters.documentId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/v1/control-mapping/map-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: filters.documentId,
          framework: filters.framework || 'NIST-800-53',
          minConfidence: filters.minConfidence,
          includeRelationships: true
        })
      });
      
      if (!response.ok) throw new Error('Failed to map document');
      
      const data = await response.json();
      setMappings(data.data.mappings);
      setRelationships(data.data.relationships);
      
      // Reload coverage report
      await loadCoverageReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to map document');
    } finally {
      setLoading(false);
    }
  };

  const updateMappingConfidence = async (mappingId: string, newConfidence: number) => {
    try {
      const response = await fetch(`/api/v1/control-mapping/mapping/${mappingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newConfidence,
          reason: 'Manual adjustment'
        })
      });
      
      if (!response.ok) throw new Error('Failed to update mapping');
      
      // Reload mappings
      await loadMappings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update mapping');
    }
  };

  const removeMapping = async (mappingId: string) => {
    if (!confirm('Are you sure you want to remove this mapping?')) return;
    
    try {
      const response = await fetch(`/api/v1/control-mapping/mapping/${mappingId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to remove mapping');
      
      // Reload mappings
      await loadMappings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove mapping');
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 80) return 'High';
    if (score >= 60) return 'Medium';
    return 'Low';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Control Mapping Dashboard</h1>
        <div className="flex gap-2">
          <Button onClick={loadMappings} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={mapDocumentToControls} disabled={loading || !filters.documentId}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Map Document
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="mappings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mappings">Mappings</TabsTrigger>
          <TabsTrigger value="coverage">Coverage Report</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
        </TabsList>

        <TabsContent value="mappings" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="documentId">Document ID</Label>
                  <Input
                    id="documentId"
                    value={filters.documentId}
                    onChange={(e) => setFilters({ ...filters, documentId: e.target.value })}
                    placeholder="Enter document ID"
                  />
                </div>
                <div>
                  <Label htmlFor="controlId">Control ID</Label>
                  <Input
                    id="controlId"
                    value={filters.controlId}
                    onChange={(e) => setFilters({ ...filters, controlId: e.target.value })}
                    placeholder="e.g., AC-1"
                  />
                </div>
                <div>
                  <Label htmlFor="framework">Framework</Label>
                  <Select value={filters.framework} onValueChange={(value) => setFilters({ ...filters, framework: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select framework" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NIST-800-53">NIST 800-53</SelectItem>
                      <SelectItem value="NIST-800-171">NIST 800-171</SelectItem>
                      <SelectItem value="ISO-27001">ISO 27001</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="minConfidence">Min Confidence</Label>
                  <Input
                    id="minConfidence"
                    type="number"
                    min="0"
                    max="100"
                    value={filters.minConfidence}
                    onChange={(e) => setFilters({ ...filters, minConfidence: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mappings List */}
          <Card>
            <CardHeader>
              <CardTitle>Control Mappings ({mappings.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : mappings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No mappings found. Try adjusting your filters or map a document.
                </div>
              ) : (
                <div className="space-y-4">
                  {mappings.map((mapping) => (
                    <div key={mapping.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Badge variant="outline">{mapping.controlId}</Badge>
                          <Badge variant="secondary">{mapping.controlFramework}</Badge>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${getConfidenceColor(mapping.confidenceScore)}`} />
                            <span className="text-sm font-medium">
                              {mapping.confidenceScore.toFixed(1)}% ({getConfidenceLabel(mapping.confidenceScore)})
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedMapping(mapping)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateMappingConfidence(mapping.id, 85)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeMapping(mapping.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Document: {mapping.documentId} • Created: {new Date(mapping.createdAt).toLocaleDateString()}
                      </div>
                      <Progress value={mapping.confidenceScore} className="h-2" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coverage" className="space-y-4">
          {coverageReport ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Coverage Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Controls</span>
                      <span className="font-medium">{coverageReport.totalControls}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Mapped Controls</span>
                      <span className="font-medium">{coverageReport.mappedControls}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Coverage</span>
                      <span className="font-medium">{coverageReport.coveragePercentage.toFixed(1)}%</span>
                    </div>
                    <Progress value={coverageReport.coveragePercentage} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Confidence Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-green-600">High Confidence</span>
                      <span className="font-medium">{coverageReport.highConfidenceMappings}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-yellow-600">Medium Confidence</span>
                      <span className="font-medium">{coverageReport.mediumConfidenceMappings}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">Low Confidence</span>
                      <span className="font-medium">{coverageReport.lowConfidenceMappings}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Mapping Quality</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {coverageReport.highConfidenceMappings + coverageReport.mediumConfidenceMappings}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Quality Mappings
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">Select a document to view coverage report</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="relationships" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Control Relationships ({relationships.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {relationships.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No relationships found. Map a document with relationships enabled.
                </div>
              ) : (
                <div className="space-y-2">
                  {relationships.map((rel) => (
                    <div key={rel.id} className="border rounded p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{rel.sourceControlId}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {rel.relationshipType}
                          </span>
                          <Badge variant="outline">{rel.targetControlId}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Strength: {(rel.strength * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Mapping Detail Modal */}
      {selectedMapping && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Mapping Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Control ID</Label>
                  <p className="font-medium">{selectedMapping.controlId}</p>
                </div>
                <div>
                  <Label>Framework</Label>
                  <p className="font-medium">{selectedMapping.controlFramework}</p>
                </div>
                <div>
                  <Label>Confidence Score</Label>
                  <p className="font-medium">{selectedMapping.confidenceScore.toFixed(1)}%</p>
                </div>
                <div>
                  <Label>Document ID</Label>
                  <p className="font-medium">{selectedMapping.documentId}</p>
                </div>
              </div>
              
              <div>
                <Label>Mapping Criteria</Label>
                <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                  {JSON.stringify(selectedMapping.mappingCriteria, null, 2)}
                </pre>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedMapping(null)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
