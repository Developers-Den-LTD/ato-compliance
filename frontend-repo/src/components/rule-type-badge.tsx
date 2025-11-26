import { Badge } from "@/components/ui/badge";
import { Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RuleTypeType } from "@shared/schema";

interface RuleTypeBadgeProps {
  ruleType: RuleTypeType;
  className?: string;
  showIcon?: boolean;
  size?: "default" | "sm" | "lg";
}

const ruleTypeConfig = {
  stig: {
    label: "STIG",
    icon: Shield,
    className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
  },
  jsig: {
    label: "JSIG",
    icon: Users,
    className: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800"
  }
};

export function RuleTypeBadge({ ruleType, className, showIcon = true, size = "default" }: RuleTypeBadgeProps) {
  const config = ruleTypeConfig[ruleType];
  
  if (!config) {
    // Fallback for unknown rule type
    return (
      <Badge 
        variant="outline" 
        size={size}
        className={cn("bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800", "gap-1", className)}
        data-testid={`rule-type-badge-${ruleType}`}
      >
        {showIcon && <Shield className="h-3 w-3" />}
        {ruleType.toUpperCase()}
      </Badge>
    );
  }
  
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      size={size}
      className={cn(config.className, "gap-1", className)}
      data-testid={`rule-type-badge-${ruleType}`}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}