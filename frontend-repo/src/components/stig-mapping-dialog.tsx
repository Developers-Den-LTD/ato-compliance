import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Shield, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Target,
  Link
} from 'lucide-react';

interface STIGMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  systemId?: string;
}

interface STIGRule {
  id: string;
  title: string;
  severity: string;
  ruleType: 'stig' | 'jsig';
  stigId: string;
  description: string;
  checkText: string;
  fixText: string;
  status: string;
}

interface ControlMapping {
  controlId: string;
  controlTitle: string;
  controlFamily: string;
  cci: string;
  stigRuleId: string;
  stigRuleTitle: string;
  severity: string;
  ruleType: 'stig' | 'jsig';
}

export function STIGMappingDialog({ open, onOpenChange, systemId }: STIGMappingDialogProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRuleType, setSelectedRuleType] = useState<'all' | 'stig' | 'jsig'>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  // Fetch STIG rules
  const { data: stigRules = [], isLoading: stigRulesLoading } = useQuery<STIGRule[]>({
    queryKey: ['/api/assessment/stig-rules'],
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch control mappings
  const { data: controlMappings = [], isLoading: mappingsLoading } = useQuery<ControlMapping[]>({
    queryKey: ['/api/assessment/control-mappings', systemId],
    enabled: open,
    queryFn: async () => {
      const url = systemId 
        ? `/api/assessment/control-mappings?systemId=${systemId}`
        : '/api/assessment/control-mappings';
      const response = await apiRequest('GET', url);
      if (response.ok) {
        return response.json();
      }
      return [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Filter STIG rules based on search and filters
  const filteredStigRules = stigRules.filter(rule => {
    const matchesSearch = rule.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRuleType = selectedRuleType === 'all' || rule.ruleType === selectedRuleType;
    const matchesSeverity = selectedSeverity === 'all' || rule.severity === selectedSeverity;
    
    return matchesSearch && matchesRuleType && matchesSeverity;
  });

  // Filter control mappings
  const filteredMappings = controlMappings.filter(mapping => {
    const matchesSearch = mapping.controlTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         mapping.stigRuleTitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRuleType = selectedRuleType === 'all' || mapping.ruleType === selectedRuleType;
    const matchesSeverity = selectedSeverity === 'all' || mapping.severity === selectedSeverity;
    
    return matchesSearch && matchesRuleType && matchesSeverity;
  });

  const handleExportMappings = async () => {
    try {
      const response = await apiRequest('GET', `/api/assessment/control-mappings/export?systemId=${systemId}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stig-mappings-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Export Successful",
          description: "STIG mappings exported successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export STIG mappings",
        variant: "destructive",
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'destructive';
      case 'medium':
      case 'moderate':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getRuleTypeIcon = (ruleType: string) => {
    return ruleType === 'stig' ? <Shield className="h-4 w-4" /> : <Target className="h-4 w-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            STIG/JSIG Control Mappings {systemId ? '(System-Specific)' : '(All Systems)'}
          </DialogTitle>
          <DialogDescription>
            {systemId 
              ? 'Mappings filtered for the selected system\'s STIG profiles'
              : 'All available mappings between NIST controls and STIG/JSIG rules'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search controls or STIG rules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Label htmlFor="rule-type">Rule Type</Label>
              <Select value={selectedRuleType} onValueChange={(value: any) => setSelectedRuleType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="stig">STIG</SelectItem>
                  <SelectItem value="jsig">JSIG</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label htmlFor="severity">Severity</Label>
              <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleExportMappings} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          {/* Content Tabs */}
          <Tabs defaultValue="mappings" className="space-y-4">
            <TabsList>
              <TabsTrigger value="mappings">Control Mappings</TabsTrigger>
              <TabsTrigger value="stig-rules">STIG Rules</TabsTrigger>
            </TabsList>

            <TabsContent value="mappings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link className="h-4 w-4" />
                    Control to STIG Rule Mappings
                  </CardTitle>
                  <CardDescription>
                    {filteredMappings.length} mappings found
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mappingsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : filteredMappings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No control mappings found
                    </div>
                  ) : (
                    <div className="overflow-auto max-h-96">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Control</TableHead>
                            <TableHead>Family</TableHead>
                            <TableHead>CCI</TableHead>
                            <TableHead>STIG Rule</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Severity</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredMappings.map((mapping, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                {mapping.controlTitle}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{mapping.controlFamily}</Badge>
                              </TableCell>
                              <TableCell>
                                <code className="text-sm">{mapping.cci}</code>
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {mapping.stigRuleTitle}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {getRuleTypeIcon(mapping.ruleType)}
                                  <span className="text-sm uppercase">{mapping.ruleType}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={getSeverityColor(mapping.severity)}>
                                  {mapping.severity}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stig-rules" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    STIG/JSIG Rules
                  </CardTitle>
                  <CardDescription>
                    {filteredStigRules.length} rules found
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {stigRulesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : filteredStigRules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No STIG rules found
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-96 overflow-auto">
                      {filteredStigRules.map((rule) => (
                        <Card key={rule.id} className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                {getRuleTypeIcon(rule.ruleType)}
                                <h4 className="font-medium">{rule.title}</h4>
                                <Badge variant={getSeverityColor(rule.severity)}>
                                  {rule.severity}
                                </Badge>
                                <Badge variant="outline" className="uppercase">
                                  {rule.ruleType}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {rule.description}
                              </p>
                              <div className="text-xs text-muted-foreground">
                                <strong>Check:</strong> {rule.checkText}
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}











