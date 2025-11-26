import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Server, Shield, FileText, AlertTriangle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { RuleTypeBadge } from "@/components/rule-type-badge";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: "up" | "down";
    period: string;
  };
  icon: React.ElementType;
  description?: string;
  progress?: number;
  className?: string;
  "data-testid"?: string;
}

export function StatCard({ title, value, change, icon: Icon, description, progress, className, "data-testid": testId }: StatCardProps) {
  return (
    <Card className={cn("hover-elevate", className)} data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {change && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            {change.trend === "up" ? (
              <TrendingUp className="h-3 w-3 text-green-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            <span className={change.trend === "up" ? "text-green-500" : "text-red-500"}>
              {change.value > 0 ? "+" : ""}{change.value}%
            </span>
            <span>from {change.period}</span>
          </div>
        )}
        {progress !== undefined && (
          <div className="mt-3">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{progress}% complete</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-32 mb-1" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );
}

interface AnalyticsResponse {
  timestamp: string;
  overview: {
    totalSystems: number;
    totalControls: number;
    totalFindings: number;
    compliancePercentage: number;
  };
  systems: {
    total: number;
    byImpactLevel: {
      High: number;
      Moderate: number;
      Low: number;
    };
    byComplianceStatus: {
      compliant: number;
      'non-compliant': number;
      'in-progress': number;
      'not-assessed': number;
    };
  };
  controls: {
    total: number;
    implemented: number;
    'partially-implemented': number;
    'not-implemented': number;
    notApplicable: number;
    byRuleType: {
      stig: {
        total: number;
        implemented: number;
        'partially-implemented': number;
        'not-implemented': number;
      };
      jsig: {
        total: number;
        implemented: number;
        'partially-implemented': number;
        'not-implemented': number;
      };
    };
  };
  findings: {
    total: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      informational: number;
    };
    byStatus: {
      open: number;
      fixed: number;
      accepted: number;
      false_positive: number;
    };
    byRuleType: {
      stig: {
        total: number;
        critical: number;
        high: number;
        medium: number;
        low: number;
        informational: number;
      };
      jsig: {
        total: number;
        critical: number;
        high: number;
        medium: number;
        low: number;
        informational: number;
      };
    };
  };
  systemsCount: number;
  controlsCount: number;
  assessmentsCount: number;
  complianceRate: number;
}

export function DashboardStats() {
  // Fetch analytics data from API
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['/api/analytics/dashboard'],
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  }) as { data: AnalyticsResponse | undefined, isLoading: boolean, error: Error | null };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="dashboard-stats">
        {[...Array(4)].map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="dashboard-stats">
        <Card className="col-span-full">
          <CardContent className="flex items-center justify-center py-6">
            <div className="text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {error?.message || "Failed to load dashboard statistics"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate implementation progress
  const total = analytics.controlsCount || 0;
  const implemented = analytics.controls?.implemented || 0;
  const implementationProgress = total > 0
    ? Math.round((implemented / total) * 100)
    : 0;

  // Calculate critical findings (critical + high severity) - with safe access
  const criticalFindings = (analytics.findings?.bySeverity?.critical || 0) + (analytics.findings?.bySeverity?.high || 0);

  // Calculate STIG vs JSIG implementation progress - with safe access
  const stigImplementationProgress = (analytics.controls?.byRuleType?.stig?.total ?? 0) > 0
    ? Math.round(((analytics.controls?.byRuleType?.stig?.implemented ?? 0) / (analytics.controls?.byRuleType?.stig?.total ?? 1)) * 100)
    : 0;
    
  const jsigImplementationProgress = (analytics.controls?.byRuleType?.jsig?.total ?? 0) > 0
    ? Math.round(((analytics.controls?.byRuleType?.jsig?.implemented ?? 0) / (analytics.controls?.byRuleType?.jsig?.total ?? 1)) * 100)
    : 0;

  // Calculate rule type specific critical findings
  const stigCriticalFindings = analytics.findings?.byRuleType?.stig?.critical ?? 0;
  const jsigCriticalFindings = analytics.findings?.byRuleType?.jsig?.critical ?? 0;

  const stats = [
    {
      title: "Total Systems",
      value: (analytics.overview?.totalSystems ?? analytics.systemsCount ?? 0).toString(),
      change: { value: 8, trend: "up" as const, period: "last month" }, // TODO: Calculate real trends
      icon: Server,
      description: "Registered IT systems"
    },
    {
      title: "STIG Controls",
      value: (analytics.controls?.byRuleType?.stig?.implemented ?? 0).toString(),
      change: { value: 12, trend: "up" as const, period: "last week" }, // TODO: Calculate real trends
      icon: Shield,
      description: `Out of ${analytics.controls?.byRuleType?.stig?.total ?? 0} STIG controls`,
      progress: stigImplementationProgress
    },
    {
      title: "JSIG Controls",
      value: (analytics.controls?.byRuleType?.jsig?.implemented ?? 0).toString(),
      change: { value: 8, trend: "up" as const, period: "last week" }, // TODO: Calculate real trends
      icon: Users,
      description: `Out of ${analytics.controls?.byRuleType?.jsig?.total ?? 0} JSIG controls`,
      progress: jsigImplementationProgress
    },
    {
      title: "Compliance Rate",
      value: `${analytics.overview?.compliancePercentage ?? analytics.complianceRate ?? 0}%`,
      change: { value: 5, trend: "up" as const, period: "last month" }, // TODO: Calculate real trends
      icon: FileText,
      description: "Overall system compliance",
      progress: analytics.overview?.compliancePercentage ?? analytics.complianceRate ?? 0
    },
    {
      title: "Open Findings",
      value: (analytics.findings?.byStatus?.open ?? 0).toString(),
      change: { value: -15, trend: "down" as const, period: "last week" }, // TODO: Calculate real trends
      icon: AlertTriangle,
      description: `${stigCriticalFindings} STIG, ${jsigCriticalFindings} JSIG critical`,
      className: criticalFindings > 0 ? "border-destructive/50" : undefined
    }
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5" data-testid="dashboard-stats">
        {stats.map((stat, index) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            change={stat.change}
            icon={stat.icon}
            description={stat.description}
            progress={stat.progress}
            className={stat.className}
            data-testid={`stat-card-${index}`}
          />
        ))}
      </div>
      
      {/* Rule Type Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2" data-testid="rule-type-summary">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">STIG Summary</CardTitle>
            <RuleTypeBadge ruleType="stig" size="sm" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold mb-2">
              {analytics.controls?.byRuleType?.stig?.implemented ?? 0} / {analytics.controls?.byRuleType?.stig?.total ?? 0} Implemented
            </div>
            <div className="text-xs text-muted-foreground">
              {stigCriticalFindings} critical findings
            </div>
            <Progress value={stigImplementationProgress} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">JSIG Summary</CardTitle>
            <RuleTypeBadge ruleType="jsig" size="sm" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold mb-2">
              {analytics.controls?.byRuleType?.jsig?.implemented ?? 0} / {analytics.controls?.byRuleType?.jsig?.total ?? 0} Implemented
            </div>
            <div className="text-xs text-muted-foreground">
              {jsigCriticalFindings} critical findings
            </div>
            <Progress value={jsigImplementationProgress} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}