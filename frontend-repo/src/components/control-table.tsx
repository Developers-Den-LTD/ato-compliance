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
import { Search, Filter, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// Type definitions
interface Control {
  id: string;
  family: string;
  title: string;
  baseline: "Low" | "Moderate" | "High";
  implementationStatus: "compliant" | "non-compliant" | "in-progress" | "not-assessed";
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
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredControls = controls.filter(control => {
    const matchesSearch = control.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      control.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      control.family.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBaseline = !filterBaseline || control.baseline === filterBaseline;
    const matchesStatus = !filterStatus || control.implementationStatus === filterStatus;
    return matchesSearch && matchesBaseline && matchesStatus;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredControls.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedControls = filteredControls.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleBaselineChange = (value: string) => {
    setFilterBaseline(value);
    setCurrentPage(1);
  };

  const handleStatusChange = (value: string) => {
    setFilterStatus(value);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setFilterBaseline("");
    setFilterStatus("");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm || filterBaseline || filterStatus;

  const handleViewControl = (controlId: string) => {
    console.log(`Viewing control: ${controlId}`);
    onViewControl?.(controlId);
  };

  return (
    <div className={cn("space-y-4 w-full", className)} data-testid="control-table">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search controls by ID, title, or family..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
            data-testid="input-search-controls"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterBaseline}
            onChange={(e) => handleBaselineChange(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            data-testid="select-filter-baseline"
          >
            <option value="">All Baselines</option>
            <option value="Low">Low</option>
            <option value="Moderate">Moderate</option>
            <option value="High">High</option>
          </select>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowMoreFilters(!showMoreFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            More Filters
          </Button>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={clearAllFilters}
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* More Filters Section */}
      {showMoreFilters && (
        <div className="p-4 border rounded-md bg-muted/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="">All Statuses</option>
                <option value="compliant">Compliant</option>
                <option value="non-compliant">Non-Compliant</option>
                <option value="in-progress">In Progress</option>
                <option value="not-assessed">Not Assessed</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-md border w-full">
        <div className="w-full overflow-x-auto">
          <Table className="min-w-[900px]">

            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px] whitespace-nowrap">Control ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-[120px] whitespace-nowrap">Family</TableHead>
                <TableHead className="w-[120px] whitespace-nowrap">Baseline</TableHead>
                <TableHead className="w-[140px] whitespace-nowrap">Status</TableHead>
                <TableHead className="w-[120px] whitespace-nowrap">Assigned To</TableHead>
                <TableHead className="w-[120px] whitespace-nowrap">Last Assessed</TableHead>
                <TableHead className="w-[100px] whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedControls.map((control) => (
                <TableRow key={control.id} className="hover-elevate">
                  <TableCell className="font-mono font-medium">{control.id}</TableCell>
                  <TableCell className="max-w-[300px] truncate">{control.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{control.family}</Badge>
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
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div>
          Showing {startIndex + 1}-{Math.min(endIndex, filteredControls.length)} of {filteredControls.length} controls
          {filteredControls.length !== controls.length && ` (filtered from ${controls.length})`}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}