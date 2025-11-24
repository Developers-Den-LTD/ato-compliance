// SystemCard component
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from './ui/dropdown-menu';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from './ui/alert-dialog';
import { MoreHorizontal, Edit, Trash2, Eye } from 'lucide-react';
import { QuickDocumentGenerator, DocumentType } from './quick-document-generator';

export interface System {
  id: string;
  name: string;
  description: string;
  category: string;
  impactLevel: 'Low' | 'Moderate' | 'High';
  complianceStatus: 'not-started' | 'in-progress' | 'compliant' | 'non-compliant';
  owner: string;
  createdAt: string;
  updatedAt: string;
  ownerDetails?: {
    id: string;
    username: string;
    email: string;
  };
}

interface SystemCardProps {
  system: System;
  onEdit: (system: System) => void;
  onDelete: (system: System) => void;
  onView?: (system: System) => void;
  onDocumentGenerate?: (systemId: string, documentType: DocumentType) => void;
  onStartGuidedWorkflow?: (systemId: string) => void;
  className?: string;
}

export const SystemCard: React.FC<SystemCardProps> = ({
  system,
  onEdit,
  onDelete,
  onView,
  onDocumentGenerate,
  onStartGuidedWorkflow,
  className = '',
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const getComplianceStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'bg-green-100 text-green-800';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'non-compliant':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getImpactLevelColor = (level: string) => {
    switch (level) {
      case 'High':
        return 'bg-red-100 text-red-800';
      case 'Moderate':
        return 'bg-yellow-100 text-yellow-800';
      case 'Low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDelete = () => {
    onDelete(system);
    setShowDeleteDialog(false);
  };

  return (
    <>
      <Card className={`w-full ${className}`} data-testid="system-card">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold" data-testid="system-name">
                {system.name}
              </CardTitle>
              <p className="text-sm text-gray-600" data-testid="system-category">
                {system.category}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="system-menu-trigger">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onView && (
                  <DropdownMenuItem onClick={() => onView(system)} data-testid="view-system-button">
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onEdit(system)} data-testid="edit-system-button">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-red-600"
                  data-testid="delete-system-button"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-700" data-testid="system-description">
            {system.description}
          </p>
          
          <div className="flex flex-wrap gap-2">
            <Badge 
              className={getComplianceStatusColor(system.complianceStatus)}
              data-testid="compliance-status-badge"
            >
              {system.complianceStatus.replace('-', ' ').toUpperCase()}
            </Badge>
            <Badge 
              className={getImpactLevelColor(system.impactLevel)}
              data-testid="impact-level-badge"
            >
              {system.impactLevel} Impact
            </Badge>
          </div>
          
          {system.ownerDetails && (
            <div className="text-xs text-gray-500" data-testid="system-owner">
              Owner: {system.ownerDetails.username}
            </div>
          )}
          
          <div className="text-xs text-gray-400" data-testid="system-dates">
            Created: {new Date(system.createdAt).toLocaleDateString()}
            {system.updatedAt !== system.createdAt && (
              <span className="ml-2">
                Updated: {new Date(system.updatedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Document Generation Actions */}
          {onDocumentGenerate && onStartGuidedWorkflow && (
            <div className="pt-2 border-t">
              <QuickDocumentGenerator
                systemId={system.id}
                systemName={system.name}
                onDocumentGenerate={onDocumentGenerate}
                onStartGuidedWorkflow={onStartGuidedWorkflow}
                variant="compact"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="delete-confirmation-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete System</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{system.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-button"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SystemCard;