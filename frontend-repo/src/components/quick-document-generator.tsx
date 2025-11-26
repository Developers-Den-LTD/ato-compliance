import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from './ui/dropdown-menu';
import { 
  FileText, 
  ChevronDown, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Workflow,
  Zap,
  FileSpreadsheet,
  Shield,
  ClipboardList,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authenticatedFetch } from '@/lib/queryClient';

// Document types with metadata
export type DocumentType = 
  | 'ssp'
  | 'stig_checklist'
  | 'jsig_checklist'
  | 'sar_package' 
  | 'poam_report'
  | 'control_narratives'
  | 'evidence_summary'
  | 'complete_ato_package'
  | 'sctm_excel'
  | 'rar'
  | 'pps_worksheet';

interface DocumentTypeInfo {
  type: DocumentType;
  name: string;
  description: string;
  icon: React.ReactNode;
  priority: 'high' | 'medium' | 'low';
  prerequisites: string[];
  estimatedTime: string;
}

const DOCUMENT_TYPES: DocumentTypeInfo[] = [
  {
    type: 'ssp',
    name: 'System Security Plan',
    description: 'Comprehensive system security documentation',
    icon: <FileText className="h-4 w-4" />,
    priority: 'high',
    prerequisites: ['system_profile', 'control_assignments'],
    estimatedTime: '5-10 min'
  },
  {
    type: 'sctm_excel',
    name: 'Security Control Traceability Matrix',
    description: 'Excel-based control traceability with STIG mappings',
    icon: <FileSpreadsheet className="h-4 w-4" />,
    priority: 'high',
    prerequisites: ['control_assignments', 'stig_mappings'],
    estimatedTime: '2-5 min'
  },
  {
    type: 'poam_report',
    name: 'POA&M Report',
    description: 'Plan of Action & Milestones for findings',
    icon: <ClipboardList className="h-4 w-4" />,
    priority: 'high',
    prerequisites: ['assessment_results', 'findings'],
    estimatedTime: '3-7 min'
  },
  {
    type: 'stig_checklist',
    name: 'STIG Checklist',
    description: 'Security Technical Implementation Guide compliance',
    icon: <Shield className="h-4 w-4" />,
    priority: 'medium',
    prerequisites: ['stig_mappings', 'assessment_results'],
    estimatedTime: '5-15 min'
  },
  {
    type: 'rar',
    name: 'Risk Assessment Report',
    description: 'Comprehensive risk assessment documentation',
    icon: <AlertTriangle className="h-4 w-4" />,
    priority: 'medium',
    prerequisites: ['risk_assessments', 'threat_analysis'],
    estimatedTime: '3-8 min'
  },
  {
    type: 'control_narratives',
    name: 'Control Narratives',
    description: 'Detailed control implementation descriptions',
    icon: <FileText className="h-4 w-4" />,
    priority: 'medium',
    prerequisites: ['control_assignments', 'implementation_details'],
    estimatedTime: '5-12 min'
  }
];

interface SystemReadiness {
  hasControlAssignments: boolean;
  hasEvidenceUploaded: boolean;
  hasAssessmentResults: boolean;
  hasSystemProfile: boolean;
  totalControls: number;
  implementedControls: number;
}

interface QuickDocumentGeneratorProps {
  systemId: string;
  systemName: string;
  onDocumentGenerate: (systemId: string, documentType: DocumentType) => void;
  onStartGuidedWorkflow: (systemId: string) => void;
  className?: string;
  variant?: 'default' | 'compact';
}

export function QuickDocumentGenerator({
  systemId,
  systemName,
  onDocumentGenerate,
  onStartGuidedWorkflow,
  className = '',
  variant = 'default'
}: QuickDocumentGeneratorProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch system readiness data
  const { data: readinessResponse, isLoading } = useQuery({
    queryKey: ['/api/systems', systemId, 'readiness'],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/systems/${systemId}/readiness`);
      if (!response.ok) {
        throw new Error('Failed to fetch system readiness');
      }
      return response.json();
    },
    enabled: !!systemId
  });

  const systemReadiness = readinessResponse?.readiness;

  // Check if document type can be generated
  const canGenerateDocument = (docType: DocumentTypeInfo): boolean => {
    if (!systemReadiness) return false;
    
    const checks: Record<string, boolean> = {
      'system_profile': systemReadiness.hasSystemProfile,
      'control_assignments': systemReadiness.hasControlAssignments,
      'stig_mappings': systemReadiness.hasControlAssignments,
      'evidence_uploaded': systemReadiness.hasEvidenceUploaded,
      'assessment_results': systemReadiness.hasAssessmentResults,
      'findings': systemReadiness.hasAssessmentResults,
      'risk_assessments': systemReadiness.hasAssessmentResults,
      'threat_analysis': systemReadiness.hasAssessmentResults,
      'implementation_details': systemReadiness.implementedControls > 0
    };

    return docType.prerequisites.every(prereq => checks[prereq] === true);
  };

  // Get readiness indicator
  const getReadinessIndicator = (docType: DocumentTypeInfo) => {
    const canGenerate = canGenerateDocument(docType);
    
    if (canGenerate) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else {
      return <AlertCircle className="h-4 w-4 text-orange-500" />;
    }
  };

  // Handle document generation with validation
  const handleGenerateDocument = (docType: DocumentType) => {
    const docInfo = DOCUMENT_TYPES.find(d => d.type === docType);
    if (!docInfo) return;

    if (!canGenerateDocument(docInfo)) {
      toast({
        title: "Prerequisites Required",
        description: `Please complete the required setup steps before generating ${docInfo.name}.`,
        variant: "destructive",
      });
      return;
    }

    onDocumentGenerate(systemId, docType);
    setIsOpen(false);
  };

  // Calculate overall readiness percentage
  const readinessPercentage = systemReadiness 
    ? Math.round((systemReadiness.implementedControls / systemReadiness.totalControls) * 100)
    : 0;

  if (variant === 'compact') {
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={className}>
            <Zap className="h-4 w-4 mr-2" />
            Quick Generate
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Generate Document</DropdownMenuLabel>
          {DOCUMENT_TYPES.filter(doc => doc.priority === 'high').map((docType) => (
            <DropdownMenuItem
              key={docType.type}
              onClick={() => handleGenerateDocument(docType.type)}
              disabled={!canGenerateDocument(docType)}
              className="flex items-center justify-between p-3"
            >
              <div className="flex items-center gap-3">
                {docType.icon}
                <div>
                  <div className="font-medium">{docType.name}</div>
                  <div className="text-xs text-muted-foreground">{docType.estimatedTime}</div>
                </div>
              </div>
              {getReadinessIndicator(docType)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* System Readiness Alert */}
      {systemReadiness && readinessPercentage < 80 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            System is {readinessPercentage}% ready. Consider completing setup for better document quality.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        {/* Quick Generation Dropdown */}
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Zap className="h-4 w-4 mr-2" />
              Quick Generate
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-96">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Generate Document - {systemName}</span>
              <Badge variant="outline">{readinessPercentage}% ready</Badge>
            </DropdownMenuLabel>
            
            {/* High Priority Documents */}
            <div className="p-2">
              <div className="text-xs font-medium text-muted-foreground mb-2">MOST REQUESTED</div>
              {DOCUMENT_TYPES.filter(doc => doc.priority === 'high').map((docType) => (
                <DropdownMenuItem
                  key={docType.type}
                  onClick={() => handleGenerateDocument(docType.type)}
                  disabled={!canGenerateDocument(docType)}
                  className="flex items-center justify-between p-3 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {docType.icon}
                    <div className="flex-1">
                      <div className="font-medium">{docType.name}</div>
                      <div className="text-xs text-muted-foreground">{docType.description}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {docType.estimatedTime}
                      </div>
                    </div>
                  </div>
                  {getReadinessIndicator(docType)}
                </DropdownMenuItem>
              ))}
            </div>

            <DropdownMenuSeparator />

            {/* Medium Priority Documents */}
            <div className="p-2">
              <div className="text-xs font-medium text-muted-foreground mb-2">OTHER DOCUMENTS</div>
              {DOCUMENT_TYPES.filter(doc => doc.priority === 'medium').map((docType) => (
                <DropdownMenuItem
                  key={docType.type}
                  onClick={() => handleGenerateDocument(docType.type)}
                  disabled={!canGenerateDocument(docType)}
                  className="flex items-center justify-between p-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {docType.icon}
                    <div>
                      <div className="text-sm font-medium">{docType.name}</div>
                      <div className="text-xs text-muted-foreground">{docType.estimatedTime}</div>
                    </div>
                  </div>
                  {getReadinessIndicator(docType)}
                </DropdownMenuItem>
              ))}
            </div>

            <DropdownMenuSeparator />

            {/* Guided Workflow Option */}
            <DropdownMenuItem
              onClick={() => onStartGuidedWorkflow(systemId)}
              className="flex items-center gap-2 p-3 bg-primary/5 cursor-pointer"
            >
              <Workflow className="h-4 w-4 text-primary" />
              <div>
                <div className="font-medium text-primary">Complete ATO Package (Guided)</div>
                <div className="text-xs text-muted-foreground">Step-by-step process with validation</div>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Guided Workflow Button */}
        <Button
          onClick={() => onStartGuidedWorkflow(systemId)}
          size="sm"
        >
          <Workflow className="h-4 w-4 mr-2" />
          ATO Workflow
        </Button>
      </div>
    </div>
  );
}

export default QuickDocumentGenerator;