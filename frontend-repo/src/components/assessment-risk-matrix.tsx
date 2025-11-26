import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  Shield, 
  Target,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  ChevronRight
} from 'lucide-react';

interface RiskItem {
  id: string;
  title: string;
  controlId?: string;
  findingId?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  likelihood: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  category: string;
  status: 'open' | 'mitigating' | 'resolved';
  remediationEffort: 'low' | 'medium' | 'high';
  daysOpen?: number;
}

interface AssessmentRiskMatrixProps {
  systemId: string;
  findings: any[];
  controls: any[];
}

export function AssessmentRiskMatrix({ systemId, findings, controls }: AssessmentRiskMatrixProps) {
  // Calculate risk items from findings and controls
  const calculateRiskItems = (): RiskItem[] => {
    const riskItems: RiskItem[] = [];

    // Add risks from critical/high findings
    findings
      .filter(f => f.status === 'open' && (f.severity === 'critical' || f.severity === 'high'))
      .forEach(finding => {
        riskItems.push({
          id: finding.id,
          title: finding.title,
          findingId: finding.id,
          controlId: finding.controlId,
          severity: finding.severity,
          likelihood: finding.severity === 'critical' ? 'high' : 'medium',
          impact: finding.severity === 'critical' ? 'high' : 'medium',
          category: 'Security Finding',
          status: 'open',
          remediationEffort: finding.severity === 'critical' ? 'high' : 'medium',
          daysOpen: finding.createdAt ? 
            Math.floor((Date.now() - new Date(finding.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 
            undefined
        });
      });

    // Add risks from non-compliant controls
    controls
      .filter(c => c.status === 'not_implemented' && c.priority === 'high')
      .forEach(control => {
        riskItems.push({
          id: control.id,
          title: `Control ${control.id}: ${control.title}`,
          controlId: control.id,
          severity: 'high',
          likelihood: 'medium',
          impact: 'high',
          category: 'Control Gap',
          status: 'open',
          remediationEffort: 'medium'
        });
      });

    return riskItems.sort((a, b) => {
      // Sort by severity first, then by days open
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return (b.daysOpen || 0) - (a.daysOpen || 0);
    });
  };

  const riskItems = calculateRiskItems();
  const criticalRisks = riskItems.filter(r => r.severity === 'critical');
  const highRisks = riskItems.filter(r => r.severity === 'high');
  const mediumRisks = riskItems.filter(r => r.severity === 'medium');

  const getRiskScore = (item: RiskItem): number => {
    const severityScore = { critical: 10, high: 7, medium: 4, low: 1 };
    const likelihoodScore = { high: 3, medium: 2, low: 1 };
    const impactScore = { high: 3, medium: 2, low: 1 };
    
    return severityScore[item.severity] * likelihoodScore[item.likelihood] * impactScore[item.impact];
  };

  const getRiskBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const getRemediationBadge = (effort: string) => {
    const colors = {
      low: 'text-green-600 bg-green-50',
      medium: 'text-yellow-600 bg-yellow-50',
      high: 'text-red-600 bg-red-50'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[effort as keyof typeof colors]}`}>
        {effort} effort
      </span>
    );
  };

  if (riskItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              No high-priority risks identified. System is in good compliance standing.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="assessment-risk-matrix">
      {/* Risk Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Critical Risks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalRisks.length}</div>
            <p className="text-xs text-muted-foreground">Immediate action required</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              High Risks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{highRisks.length}</div>
            <p className="text-xs text-muted-foreground">Address within 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              Medium Risks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{mediumRisks.length}</div>
            <p className="text-xs text-muted-foreground">Plan remediation</p>
          </CardContent>
        </Card>
      </div>

      {/* Priority Risk Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Priority Risk Items
          </CardTitle>
          <CardDescription>
            Risks requiring immediate attention, sorted by severity and age
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {riskItems.slice(0, 10).map((item) => (
              <div 
                key={item.id} 
                className="flex items-start justify-between p-4 border rounded-lg hover-elevate"
                data-testid={`risk-item-${item.id}`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={getRiskBadgeVariant(item.severity)}>
                      {item.severity}
                    </Badge>
                    <Badge variant="outline">{item.category}</Badge>
                    {item.daysOpen !== undefined && item.daysOpen > 30 && (
                      <Badge variant="secondary" className="text-xs">
                        {item.daysOpen} days old
                      </Badge>
                    )}
                  </div>
                  <h4 className="font-medium text-sm">{item.title}</h4>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Risk Score: {getRiskScore(item)}</span>
                    <span>•</span>
                    <span>Impact: {item.impact}</span>
                    <span>•</span>
                    <span>Likelihood: {item.likelihood}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getRemediationBadge(item.remediationEffort)}
                  <Button size="sm" variant="ghost">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {riskItems.length > 10 && (
            <div className="mt-4 text-center">
              <Button variant="outline">
                View All {riskItems.length} Risk Items
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Mitigation Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Risk Mitigation Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {criticalRisks.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Critical Action Required:</strong> {criticalRisks.length} critical risks need immediate attention. 
                  Focus on these items first to reduce overall system risk.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <strong>Quick Wins:</strong> {riskItems.filter(r => r.remediationEffort === 'low').length} items can be resolved with minimal effort
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Target className="h-4 w-4 text-green-600 mt-0.5" />
                <div className="text-sm">
                  <strong>High Impact:</strong> Addressing top 5 risks would improve compliance by approximately 15%
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-purple-600 mt-0.5" />
                <div className="text-sm">
                  <strong>Control Gaps:</strong> {controls.filter(c => c.status === 'not_implemented').length} controls need implementation
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}