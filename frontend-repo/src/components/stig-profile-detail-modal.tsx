import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield, FileText, Calendar, Tag, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";

type StigProfile = {
  stig_id: string;
  stig_title: string;
  version: string;
  release_date?: string;
  category: string;
  rule_type: string;
  total_rules: number;
  applicable_os?: string[];
  description?: string;
  severity_breakdown?: {
    high: number;
    medium: number;
    low: number;
  };
  sample_rules?: Array<{
    id: string;
    title: string;
    severity: string;
    description: string;
  }>;
};

interface StigProfileDetailModalProps {
  profile: StigProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StigProfileDetailModal({ profile, open, onOpenChange }: StigProfileDetailModalProps) {
  if (!profile) return null;

  const severityBreakdown = profile.severity_breakdown || {
    high: 0,
    medium: 0,
    low: 0
  };

  const getSeverityColor = (severity: string) => {
    const sev = severity.toLowerCase();
    if (sev.includes('cat i') || sev.includes('high') || sev === 'cat_i') {
      return 'text-red-600 dark:text-red-400';
    } else if (sev.includes('cat ii') || sev.includes('medium') || sev === 'cat_ii') {
      return 'text-yellow-600 dark:text-yellow-400';
    } else {
      return 'text-green-600 dark:text-green-400';
    }
  };

  const getSeverityBadge = (severity: string) => {
    const sev = severity.toLowerCase();
    if (sev.includes('cat i') || sev.includes('high') || sev === 'cat_i') {
      return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300';
    } else if (sev.includes('cat ii') || sev.includes('medium') || sev === 'cat_ii') {
      return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300';
    } else {
      return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl">{profile.stig_title}</DialogTitle>
              <DialogDescription className="mt-1">
                Security Technical Implementation Guide Details
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Basic Information */}
          <Card className="border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="w-4 h-4" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">STIG ID</p>
                  <p className="text-sm font-semibold mt-1 text-gray-900 dark:text-gray-100">{profile.stig_id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Version</p>
                  <p className="text-sm font-semibold mt-1 text-gray-900 dark:text-gray-100">{profile.version}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Category</p>
                  <Badge variant="outline" className="mt-1 border-gray-300 dark:border-gray-600">{profile.category}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Rule Type</p>
                  <Badge variant="secondary" className="mt-1 bg-gray-100 dark:bg-gray-700">{profile.rule_type}</Badge>
                </div>
              </div>

              {profile.release_date && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Release Date
                  </p>
                  <p className="text-sm mt-1 text-gray-900 dark:text-gray-100">{new Date(profile.release_date).toLocaleDateString()}</p>
                </div>
              )}

              {profile.description && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{profile.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rules Summary */}
          <Card className="border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Rules Summary
              </CardTitle>
              <CardDescription>
                Total security controls and severity distribution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/40 rounded-lg border border-blue-200 dark:border-blue-800">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Rules</span>
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{profile.total_rules}</span>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Severity Breakdown</p>
                
                <div className="flex items-center justify-between p-3 border rounded-lg bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-red-100 dark:bg-red-900/40 rounded">
                      <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">High Severity</span>
                  </div>
                  <Badge variant="destructive" className="bg-red-600 dark:bg-red-700 text-white font-semibold px-3">
                    {severityBreakdown.high} rules
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/50 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/40 rounded">
                      <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Medium Severity</span>
                  </div>
                  <Badge className="bg-yellow-500 dark:bg-yellow-600 hover:bg-yellow-600 dark:hover:bg-yellow-700 text-white font-semibold px-3">
                    {severityBreakdown.medium} rules
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-green-100 dark:bg-green-900/40 rounded">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Low Severity</span>
                  </div>
                  <Badge className="bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white font-semibold px-3">
                    {severityBreakdown.low} rules
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Applicable Systems */}
          {profile.applicable_os && profile.applicable_os.length > 0 && (
            <Card className="border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Applicable Operating Systems
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.applicable_os.map((os) => (
                    <Badge key={os} variant="outline" className="text-xs border-gray-300 dark:border-gray-600">
                      {os}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sample Rules Preview */}
          {profile.sample_rules && profile.sample_rules.length > 0 && (
            <Card className="border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Sample Rules Preview
                </CardTitle>
                <CardDescription>
                  Showing {profile.sample_rules.length} of {profile.total_rules} rules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {profile.sample_rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1">
                          {rule.title}
                        </h5>
                        <Badge className={`text-xs ${getSeverityBadge(rule.severity)}`}>
                          {rule.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                        {rule.description}
                      </p>
                    </div>
                  ))}
                </div>
                {profile.total_rules > (profile.sample_rules?.length || 0) && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      {profile.total_rules - profile.sample_rules.length} more rules available
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Implementation Notes */}
          <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Implementation Notes</p>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                    <li>This STIG profile contains {profile.total_rules} security controls that must be implemented</li>
                    <li>Regular assessments are required to maintain compliance</li>
                    <li>DISA releases quarterly updates - enable auto-updates to stay current</li>
                    <li>High severity findings require immediate remediation</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-4 bg-gray-200 dark:bg-gray-700" />

        <div className="flex justify-end">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-600 transition-colors"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default StigProfileDetailModal;
