/**
 * Simple Baseline Assignment Component
 * Provides a straightforward way to assign controls based on impact level
 */

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Loader2, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/queryClient';

interface SimpleBaselineAssignmentProps {
  systemId: string;
  onClose: () => void;
}

interface AssignmentResult {
  success: boolean;
  assignedCount: number;
  assignedControls: string[];
  errors?: string[];
}

export function SimpleBaselineAssignment({ systemId, onClose }: SimpleBaselineAssignmentProps) {
  const [selectedImpactLevel, setSelectedImpactLevel] = useState<'Low' | 'Moderate' | 'High' | ''>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [result, setResult] = useState<AssignmentResult | null>(null);
  const queryClient = useQueryClient();

  const assignBaselineControls = async (impactLevel: 'Low' | 'Moderate' | 'High') => {
    const response = await authenticatedFetch('/api/simple-baseline-assignment/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemId,
        impactLevel
      })
    });

    if (!response.ok) {
      throw new Error('Failed to assign baseline controls');
    }

    return response.json();
  };

  const handleAssign = async () => {
    if (!selectedImpactLevel) return;

    setIsAssigning(true);
    setResult(null);

    try {
      const response = await assignBaselineControls(selectedImpactLevel);
      setResult(response.data);
      
      // Invalidate queries to refresh the controls list
      await queryClient.invalidateQueries({ queryKey: ['systemControls', systemId] });
      await queryClient.refetchQueries({ queryKey: ['systemControls', systemId] });
      queryClient.invalidateQueries({ queryKey: ['/api/systems', systemId] });
      queryClient.invalidateQueries({ queryKey: ['/api/systems', systemId, 'metrics'] });
      
      // Close dialog after successful assignment
      if (response.data.success) {
        setTimeout(() => {
          onClose();
        }, 2000); // Close after 2 seconds to show success message
      }
    } catch (error) {
      console.error('Error assigning baseline controls:', error);
      setResult({
        success: false,
        assignedCount: 0,
        assignedControls: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const getImpactLevelDescription = (level: 'Low' | 'Moderate' | 'High') => {
    switch (level) {
      case 'Low':
        return 'Basic security controls for low-impact systems (50 controls)';
      case 'Moderate':
        return 'Standard security controls for moderate-impact systems (100 controls)';
      case 'High':
        return 'Comprehensive security controls for high-impact systems (200+ controls)';
      default:
        return '';
    }
  };

  const getControlCount = (level: 'Low' | 'Moderate' | 'High') => {
    switch (level) {
      case 'Low':
        return 50;
      case 'Moderate':
        return 100;
      case 'High':
        return 200;
      default:
        return 0;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Baseline Control Assignment
          </h2>
          <p className="text-muted-foreground">
            Automatically assign NIST 800-53 controls based on system impact level
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Impact Level</CardTitle>
          <CardDescription>
            Choose the appropriate impact level for your system to determine which controls to assign
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedImpactLevel} onValueChange={(value) => setSelectedImpactLevel(value as 'Low' | 'Moderate' | 'High' | '')}>
            <SelectTrigger>
              <SelectValue placeholder="Select impact level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">
                <div className="flex items-center justify-between w-full">
                  <span>Low Impact</span>
                  <Badge variant="secondary" className="ml-2">50 controls</Badge>
                </div>
              </SelectItem>
              <SelectItem value="Moderate">
                <div className="flex items-center justify-between w-full">
                  <span>Moderate Impact</span>
                  <Badge variant="secondary" className="ml-2">100 controls</Badge>
                </div>
              </SelectItem>
              <SelectItem value="High">
                <div className="flex items-center justify-between w-full">
                  <span>High Impact</span>
                  <Badge variant="secondary" className="ml-2">200+ controls</Badge>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {selectedImpactLevel && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">
                {selectedImpactLevel} Impact Level
              </p>
              <p className="text-sm text-muted-foreground">
                {getImpactLevelDescription(selectedImpactLevel)}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={handleAssign} 
              disabled={!selectedImpactLevel || isAssigning}
              className="flex items-center gap-2"
            >
              {isAssigning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Assigning Controls...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  Assign Baseline Controls
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              Assignment Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.success ? (
              <div className="space-y-2">
                <p className="text-green-600 font-medium">
                  Successfully assigned {result.assignedCount} controls
                </p>
                {result.assignedCount === 0 && (
                  <p className="text-muted-foreground">
                    All baseline controls for this impact level are already assigned to this system.
                  </p>
                )}
                {result.assignedControls.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Assigned Controls:</p>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                      {result.assignedControls.slice(0, 20).map((controlId) => (
                        <Badge key={controlId} variant="outline" className="text-xs">
                          {controlId}
                        </Badge>
                      ))}
                      {result.assignedControls.length > 20 && (
                        <Badge variant="outline" className="text-xs">
                          +{result.assignedControls.length - 20} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-red-600 font-medium">
                  Assignment failed
                </p>
                {result.errors && result.errors.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Errors:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {result.errors.map((error, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-red-500">•</span>
                          <span>{error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
