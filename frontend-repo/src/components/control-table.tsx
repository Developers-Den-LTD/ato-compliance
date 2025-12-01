import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { RuleTypeBadge } from "@/components/rule-type-badge";
import { Search, Filter, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RuleTypeType } from "@/types/schema";

interface Control {
  id: string;
  family: string;
  title: string;
  baseline: "Low" | "Moderate" | "High";
  implementationStatus: "compliant" | "non-compliant" | "in-progress" | "not-assessed";
  ruleType: RuleTypeType;
  lastAssessed?: string;
  assignedTo?: string;
}

interface ControlTableProps {
  controls: Control[];
  onViewControl?: (controlId: string) => void;
  className?: string;
}

const baselineColors = {
  Low: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
  Moderate: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800",
  High: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
};

export function ControlTable({ controls, onViewControl, className }: ControlTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBaseline, setFilterBaseline] = useState<string>("");
  const [filterRuleType, setFilterRuleType] = useState<string>("");

  const filteredControls = controls.filter(control => {
    const matchesSearch = control.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         control.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         control.family.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = !filterBaseline || control.baseline === filterBaseline;
    const matchesRuleType = !filterRuleType || control.ruleType === filterRuleType;
    return matchesSearch && matchesFilter && matchesRuleType;
  });

  const handleViewControl = (controlId: string) => {
    console.log(`Viewing control: ${controlId}`);
    onViewControl?.(controlId);
  };

  return (
    <div className={cn("space-y-4", className)} data-testid="control-table">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search controls by ID, title, or family..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-controls"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterBaseline}
            onChange={(e) => setFilterBaseline(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            data-testid="select-filter-baseline"
          >
            <option value="">All Baselines</option>
            <option value="Low">Low</option>
            <option value="Moderate">Moderate</option>
            <option value="High">High</option>
          </select>
          <select
            value={filterRuleType}
            onChange={(e) => setFilterRuleType(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            data-testid="select-filter-rule-type"
          >
            <option value="">All Rule Types</option>
            <option value="stig">STIG</option>
            <option value="jsig">JSIG</option>
          </select>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            More Filters
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Control ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[120px]">Family</TableHead>
              <TableHead className="w-[100px]">Rule Type</TableHead>
              <TableHead className="w-[120px]">Baseline</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[120px]">Assigned To</TableHead>
              <TableHead className="w-[120px]">Last Assessed</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredControls.map((control) => (
              <TableRow key={control.id} className="hover-elevate">
                <TableCell className="font-mono font-medium">{control.id}</TableCell>
                <TableCell className="max-w-[300px] truncate">{control.title}</TableCell>
                <TableCell>
                  <Badge variant="outline">{control.family}</Badge>
                </TableCell>
                <TableCell>
                  <RuleTypeBadge ruleType={control.ruleType ?? 'stig'} />
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={baselineColors[control.baseline]}>
                    {control.baseline}
                  </Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={control.implementationStatus} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {control.assignedTo || "Unassigned"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {control.lastAssessed || "Never"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewControl(control.id)}
                    data-testid={`button-view-control-${control.id}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing {filteredControls.length} of {controls.length} controls
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}