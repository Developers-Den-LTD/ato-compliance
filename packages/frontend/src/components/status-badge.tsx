import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComplianceStatusType } from "@shared/schema";

interface StatusBadgeProps {
  status: ComplianceStatusType;
  className?: string;
}

const statusConfig = {
  compliant: {
    label: "Compliant",
    icon: CheckCircle,
    className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
  },
  "non-compliant": {
    label: "Non-Compliant",
    icon: XCircle,
    className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
  },
  "in-progress": {
    label: "In Progress",
    icon: Clock,
    className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
  },
  "not-assessed": {
    label: "Not Assessed",
    icon: AlertTriangle,
    className: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800"
  }
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  if (!config) {
    // Fallback for unknown status
    return (
      <Badge 
        variant="outline" 
        className={cn("bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800", "gap-1", className)}
        data-testid={`status-badge-${status}`}
      >
        <AlertTriangle className="h-3 w-3" />
        {status}
      </Badge>
    );
  }
  
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={cn(config?.className, "gap-1", className)}
      data-testid={`status-badge-${status}`}
    >
      <Icon className="h-3 w-3" />
      {config?.label || status}
    </Badge>
  );
}