import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RuleTypeBadge } from "@/components/rule-type-badge";
import { AlertTriangle, CheckCircle, XCircle, Clock, Shield, FileCheck, Filter, Users } from "lucide-react";
import type { RuleTypeType } from "@/types/schema";

type System = {
  id: string;
  name: string;
  compliance_status: string;
  impact_level: string;
  category: string;
  owner?: string;
};

type Control = {
  id: string;
  family: string;
  title: string;
  status: string;
  priority?: string;
  description?: string;
  ruleType?: RuleTypeType;
};

type StigRule = {
  id: string;
  title: string;
  severity: string;
  status: string;
  ruleType: RuleTypeType;
  stigId?: string;
  family?: string;
};

export default function Assessment() {
  const [selectedRuleTypes, setSelectedRuleTypes] = useState<RuleTypeType[]>(['stig', 'jsig']);
  
  const { data: systemsResponse, isLoading: systemsLoading } = useQuery<{ systems: System[]; totalCount: number }>({
    queryKey: ['/api/systems']
  });

  const systems = systemsResponse?.systems || [];

  const { data: controlsResponse, isLoading: controlsLoading } = useQuery<{ controls: Control[]; total: number; filters: any }>({
    queryKey: ['/api/controls', 'v2'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/controls?limit=2000');
      return response.json();
    }
  });

  const { data: stigRules = [], isLoading: stigRulesLoading } = useQuery<StigRule[]>({
    queryKey: ['/api/assessment/stig-rules'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const controls = controlsResponse?.controls || [];

  // Calculate compliance metrics
  const compliantSystems = systems.filter(s => s.compliance_status === 'Compliant').length;
  const inProgressSystems = systems.filter(s => s.compliance_status === 'In Progress').length;
  const systemComplianceRate = systems.length > 0 ? (compliantSystems / systems.length) * 100 : 0;

  const implementedControls = controls.filter(c => c.status === 'implemented').length;
  const notImplementedControls = controls.filter(c => c.status === 'not_implemented').length;
  const controlImplementationRate = controls.length > 0 ? (implementedControls / controls.length) * 100 : 0;

  // Calculate STIG/JSIG rule metrics
  const filteredStigRules = stigRules.filter(rule => selectedRuleTypes.includes(rule.ruleType));
  const stigRulesByType = {
    stig: stigRules.filter(rule => rule.ruleType === 'stig'),
    jsig: stigRules.filter(rule => rule.ruleType === 'jsig')
  };
  const implementedRules = filteredStigRules.filter(rule => rule.status === 'implemented' || rule.status === 'pass').length;
  const ruleImplementationRate = filteredStigRules.length > 0 ? (implementedRules / filteredStigRules.length) * 100 : 0;

  // Group controls by family for gap analysis
  const controlsByFamily = controls.reduce((acc, control) => {
    if (!acc[control.family]) {
      acc[control.family] = [];
    }
    acc[control.family].push(control);
    return acc;
  }, {} as Record<string, Control[]>);

  const getStatusIcon = (status: string | null | undefined) => {
    const safeStatus = (status || 'unknown').toString();
    switch (safeStatus) {
      case 'Compliant':
      case 'implemented':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'In Progress':
      case 'partially_implemented':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusBadge = (status: string | null | undefined) => {
    const safeStatus = (status || 'unknown').toString();
    const variant = safeStatus === 'Compliant' || safeStatus === 'implemented' 
      ? 'default' 
      : safeStatus === 'In Progress' || safeStatus === 'partially_implemented'
      ? 'secondary'
      : 'destructive';
    
    return <Badge variant={variant}>{safeStatus.replace(/_/g, ' ')}</Badge>;
  };

  const getImpactLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'high': return 'text-red-600';
      case 'moderate': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const toggleRuleType = (ruleType: RuleTypeType) => {
    setSelectedRuleTypes(prev => 
      prev.includes(ruleType) 
        ? prev.filter(t => t !== ruleType)
        : [...prev, ruleType]
    );
  };

  if (systemsLoading || controlsLoading || stigRulesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Compliance Assessment</h1>
        </div>
        <p className="text-muted-foreground">Loading assessment data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Compliance Assessment</h1>
            <p className="text-muted-foreground">Evaluate compliance status and identify gaps across systems and controls</p>
          </div>
        </div>
        
        {/* Rule Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Rule Types:</span>
          <Button
            variant={selectedRuleTypes.includes('stig') ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleRuleType('stig')}
            data-testid="button-filter-stig"
            className="gap-1"
          >
            <Shield className="h-3 w-3" />
            STIG ({stigRulesByType.stig.length})
          </Button>
          <Button
            variant={selectedRuleTypes.includes('jsig') ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleRuleType('jsig')}
            data-testid="button-filter-jsig"
            className="gap-1"
          >
            <Users className="h-3 w-3" />
            JSIG ({stigRulesByType.jsig.length})
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Compliance</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-system-compliance-rate">{systemComplianceRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {compliantSystems} of {systems.length} systems compliant
            </p>
            <Progress value={systemComplianceRate} className="mt-2" data-testid="progress-system-compliance" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rule Implementation</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-rule-implementation-rate">{ruleImplementationRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {implementedRules} of {filteredStigRules.length} rules implemented
            </p>
            <div className="flex gap-1 mt-1">
              {selectedRuleTypes.map(ruleType => (
                <RuleTypeBadge key={ruleType} ruleType={ruleType} showIcon={false} />
              ))}
            </div>
            <Progress value={ruleImplementationRate} className="mt-2" data-testid="progress-rule-implementation" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Gaps</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-critical-gaps">{notImplementedControls}</div>
            <p className="text-xs text-muted-foreground">
              Controls requiring attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Impact Systems</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-high-impact-systems">
              {systems.filter(s => s.impact_level === 'High').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Systems with high security impact
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Assessment Tabs */}
      <Tabs defaultValue="systems" className="space-y-4">
        <TabsList>
          <TabsTrigger value="systems" data-testid="tab-systems">System Assessment</TabsTrigger>
          <TabsTrigger value="controls" data-testid="tab-controls">Control Gap Analysis</TabsTrigger>
          <TabsTrigger value="families" data-testid="tab-families">Control Families</TabsTrigger>
        </TabsList>

        <TabsContent value="systems" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Compliance Status</CardTitle>
              <CardDescription>
                Review compliance status for each system in your environment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {systems.map((system) => (
                  <div key={system.id} className="flex items-center justify-between p-4 border rounded-lg hover-elevate" data-testid={`card-system-${system.id}`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(system.compliance_status)}
                        <h3 className="font-semibold" data-testid={`text-system-name-${system.id}`}>{system.name}</h3>
                        <Badge variant="outline" className={getImpactLevelColor(system.impact_level)}>
                          {system.impact_level}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{system.category}</p>
                      {system.owner && (
                        <p className="text-xs text-muted-foreground">Owner: {system.owner}</p>
                      )}
                    </div>
                    <div className="text-right">
                      {getStatusBadge(system.compliance_status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="controls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Control Implementation Gaps</CardTitle>
              <CardDescription>
                NIST 800-53 controls requiring implementation or attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {controls.filter(c => c.status === 'not_implemented').map((control) => (
                  <div key={control.id} className="flex items-start gap-4 p-4 border rounded-lg" data-testid={`card-control-${control.id}`}>
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold" data-testid={`text-control-id-${control.id}`}>{control.id}</h3>
                        <Badge variant="outline">{control.family}</Badge>
                      </div>
                      <p className="text-sm font-medium" data-testid={`text-control-title-${control.id}`}>{control.title}</p>
                      {control.description && (
                        <p className="text-xs text-muted-foreground">{control.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      {getStatusBadge(control.status)}
                    </div>
                  </div>
                ))}

                {controls.filter(c => c.status === 'not_implemented').length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-600" />
                    <p>All controls are implemented! Great job maintaining compliance.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="families" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Control Family Overview</CardTitle>
              <CardDescription>
                Implementation status grouped by NIST 800-53 control families
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(controlsByFamily).map(([family, familyControls]) => {
                  const implemented = familyControls.filter(c => c.status === 'implemented').length;
                  const total = familyControls.length;
                  const percentage = (implemented / total) * 100;

                  return (
                    <div key={family} className="space-y-2" data-testid={`card-family-${family.replace(/\s+/g, '-').toLowerCase()}`}>
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold" data-testid={`text-family-name-${family.replace(/\s+/g, '-').toLowerCase()}`}>{family}</h3>
                        <Badge variant={percentage === 100 ? 'default' : percentage > 0 ? 'secondary' : 'destructive'}>
                          {implemented}/{total} implemented
                        </Badge>
                      </div>
                      <Progress value={percentage} className="h-2" data-testid={`progress-family-${family.replace(/\s+/g, '-').toLowerCase()}`} />
                      <div className="text-xs text-muted-foreground">
                        {percentage.toFixed(1)}% complete
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}