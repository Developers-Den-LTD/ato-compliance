import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { 
  Brain, 
  Shield, 
  Target, 
  Zap, 
  CheckCircle, 
  AlertCircle, 
  Info,
  Plus,
  Sparkles,
  BookOpen,
  Settings
} from 'lucide-react';

interface SmartControlAssignmentProps {
  systemId: string;
  onClose?: () => void;
}

interface AssignmentOption {
  id: string;
  name: string;
  description: string;
  controlCount: number;
  controls: string[];
  rationale?: string;
}

interface AssignmentOptions {
  systemId: string;
  systemName: string;
  category: string;
  impactLevel: string;
  options: {
    baseline: AssignmentOption;
    templates: AssignmentOption[];
    smart: AssignmentOption;
  };
}

export function SmartControlAssignment({ systemId, onClose }: SmartControlAssignmentProps) {
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch assignment options
  const { data: options, isLoading, error } = useQuery({
    queryKey: ['/api/control-assignment/options', systemId],
    queryFn: async () => {
      const response = await fetch(`/api/control-assignment/options/${systemId}`);
      if (!response.ok) throw new Error('Failed to fetch assignment options');
      const data = await response.json();
      return data.data as AssignmentOptions;
    },
    enabled: !!systemId
  });

  // Assign controls mutation
  const assignControls = useMutation({
    mutationFn: async ({ assignmentType, templateId, controlIds }: {
      assignmentType: string;
      templateId?: string;
      controlIds?: string[];
    }) => {
      const response = await fetch('/api/control-assignment/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemId,
          assignmentType,
          templateId,
          controlIds,
          impactLevel: options?.impactLevel,
          category: options?.category
        })
      });
      
      if (!response.ok) throw new Error('Failed to assign controls');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Controls Assigned Successfully',
        description: `${data.data.assignedCount} controls have been assigned to your system.`,
      });
      
      // Refresh system controls
      queryClient.invalidateQueries({ queryKey: ['/api/systems', systemId, 'controls'] });
      queryClient.invalidateQueries({ queryKey: ['/api/systems', systemId, 'metrics'] });
      
      setIsAssigning(false);
      setShowPreview(false);
      onClose?.();
    },
    onError: (error: any) => {
      toast({
        title: 'Assignment Failed',
        description: error?.message || 'Failed to assign controls',
        variant: 'destructive',
      });
      setIsAssigning(false);
    }
  });

  const handleAssign = () => {
    if (!selectedOption) return;
    
    setIsAssigning(true);
    
    // Determine assignment type and parameters
    let assignmentType = 'custom';
    let templateId: string | undefined;
    let controlIds: string[] | undefined;
    
    if (selectedOption === 'baseline') {
      assignmentType = 'baseline';
    } else if (selectedOption === 'smart') {
      assignmentType = 'smart';
    } else if (selectedOption.startsWith('template-')) {
      assignmentType = 'template';
      templateId = selectedOption.replace('template-', '');
    } else {
      assignmentType = 'custom';
      controlIds = options?.options[selectedOption as keyof typeof options.options]?.controls;
    }
    
    assignControls.mutate({ assignmentType, templateId, controlIds });
  };

  const getOptionIcon = (optionId: string) => {
    switch (optionId) {
      case 'baseline':
        return <Shield className="h-5 w-5" />;
      case 'smart':
        return <Brain className="h-5 w-5" />;
      default:
        return <Target className="h-5 w-5" />;
    }
  };

  const getOptionColor = (optionId: string) => {
    switch (optionId) {
      case 'baseline':
        return 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-400';
      case 'smart':
        return 'bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-950/20 dark:border-purple-800 dark:text-purple-400';
      default:
        return 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950/20 dark:border-green-800 dark:text-green-400';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-48 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !options) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Error Loading Assignment Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {error?.message || 'Failed to load control assignment options'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6" />
          Smart Control Assignment
        </h2>
        <p className="text-muted-foreground">
          Choose how to assign controls to <strong>{options.systemName}</strong>
        </p>
        <div className="flex items-center justify-center gap-4 text-sm">
          <Badge variant="outline">{options.category}</Badge>
          <Badge variant="outline">{options.impactLevel} Impact</Badge>
        </div>
      </div>

      {/* Assignment Options */}
      <Tabs defaultValue="baseline" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="baseline" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Baseline
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="smart" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Smart
          </TabsTrigger>
        </TabsList>

        {/* Baseline Assignment */}
        <TabsContent value="baseline" className="space-y-4">
          <Card className={`cursor-pointer transition-all hover:shadow-md ${selectedOption === 'baseline' ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => setSelectedOption('baseline')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                NIST 800-53 {options.impactLevel} Impact Baseline
              </CardTitle>
              <CardDescription>
                {options.options.baseline.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {options.options.baseline.controlCount} controls
                </Badge>
                {selectedOption === 'baseline' && (
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Template Assignment */}
        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {options.options.templates.map((template) => (
              <Card 
                key={template.id}
                className={`cursor-pointer transition-all hover:shadow-md ${selectedOption === `template-${template.id}` ? 'ring-2 ring-green-500' : ''}`}
                onClick={() => setSelectedOption(`template-${template.id}`)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    {template.name}
                  </CardTitle>
                  <CardDescription>
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Settings className="h-3 w-3" />
                        {template.controlCount} controls
                      </Badge>
                      {selectedOption === `template-${template.id}` && (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    {template.rationale && (
                      <p className="text-xs text-muted-foreground">
                        {template.rationale}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Smart Assignment */}
        <TabsContent value="smart" className="space-y-4">
          <Card className={`cursor-pointer transition-all hover:shadow-md ${selectedOption === 'smart' ? 'ring-2 ring-purple-500' : ''}`}
                onClick={() => setSelectedOption('smart')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI-Powered Smart Recommendations
              </CardTitle>
              <CardDescription>
                {options.options.smart.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {options.options.smart.controlCount} recommended controls
                  </Badge>
                  {selectedOption === 'smart' && (
                    <CheckCircle className="h-5 w-5 text-purple-600" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>Combines baseline controls with system-specific recommendations</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          onClick={() => setShowPreview(true)}
          disabled={!selectedOption}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Preview Assignment
        </Button>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Assignment Preview
            </DialogTitle>
            <DialogDescription>
              Review the controls that will be assigned to your system
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedOption && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">
                  {selectedOption === 'baseline' && 'NIST 800-53 Baseline'}
                  {selectedOption === 'smart' && 'Smart Recommendations'}
                  {selectedOption.startsWith('template-') && 
                    options.options.templates.find(t => `template-${t.id}` === selectedOption)?.name}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {selectedOption === 'baseline' && options.options.baseline.description}
                  {selectedOption === 'smart' && options.options.smart.description}
                  {selectedOption.startsWith('template-') && 
                    options.options.templates.find(t => `template-${t.id}` === selectedOption)?.description}
                </p>
                <div className="mt-2">
                  <Badge variant="outline">
                    {selectedOption === 'baseline' && `${options.options.baseline.controlCount} controls`}
                    {selectedOption === 'smart' && `${options.options.smart.controlCount} controls`}
                    {selectedOption.startsWith('template-') && 
                      `${options.options.templates.find(t => `template-${t.id}` === selectedOption)?.controlCount} controls`}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssign}
              disabled={assignControls.isPending}
              className="flex items-center gap-2"
            >
              {assignControls.isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Assigning...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Assign Controls
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
