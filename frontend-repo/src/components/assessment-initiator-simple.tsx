import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Settings, Play, Loader2 } from 'lucide-react';

interface AssessmentInitiatorSimpleProps {
  systemId: string;
  onAssessmentStarted: () => void;
}

export function AssessmentInitiatorSimple({ systemId, onAssessmentStarted }: AssessmentInitiatorSimpleProps) {
  const { toast } = useToast();
  const [isStarting, setIsStarting] = useState(false);
  const [assessmentMode, setAssessmentMode] = useState('automated');
  const [includeInformationalFindings, setIncludeInformationalFindings] = useState(false);
  const [generatePoamItems, setGeneratePoamItems] = useState(true);

  const handleStartAssessment = async () => {
    setIsStarting(true);
    try {
      const options = {
        assessmentMode,
        includeInformationalFindings,
        generatePoamItems,
        generateEvidence: true,
        updateControlStatus: true,
        riskTolerance: 'medium'
      };

      const response = await apiRequest('POST', `/api/assessment/systems/${systemId}/assess`, options);
      const result = await response.json();
      
      toast({
        title: 'Assessment Started',
        description: `Assessment ${result.assessmentId} is now running.`,
      });

      if (onAssessmentStarted) {
        onAssessmentStarted();
      }

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/assessment/systems', systemId] });
      }, 1000);

    } catch (error) {
      toast({
        title: 'Failed to Start Assessment',
        description: (error as Error).message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configure Assessment
        </CardTitle>
        <CardDescription>
          Start a new security assessment for this system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Assessment Mode</Label>
            <RadioGroup value={assessmentMode} onValueChange={setAssessmentMode}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="automated" id="automated" />
                <Label htmlFor="automated">Automated - Fast AI-powered assessment</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="manual" />
                <Label htmlFor="manual">Manual - Detailed manual review</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label>Assessment Options</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="informational"
                checked={includeInformationalFindings}
                onCheckedChange={(checked) => setIncludeInformationalFindings(checked === true)}
              />
              <Label htmlFor="informational">Include informational findings</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="poam"
                checked={generatePoamItems}
                onCheckedChange={(checked) => setGeneratePoamItems(checked === true)}
              />
              <Label htmlFor="poam">Generate POA&M items for findings</Label>
            </div>
          </div>
        </div>

        <Button
          onClick={handleStartAssessment}
          disabled={isStarting}
          className="w-full"
          size="lg"
        >
          {isStarting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting Assessment...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Start Assessment
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}