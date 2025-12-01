import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AssessmentInitiatorSimple } from '@/components/assessment-initiator-simple';
import { useToast } from '@/hooks/use-toast';
import { Settings } from 'lucide-react';

interface AssessmentDashboardTestProps {
  systemId: string;
}

export function AssessmentDashboardTest({ systemId }: AssessmentDashboardTestProps) {
  const { toast } = useToast();
  const [showConfig, setShowConfig] = useState(false);

  const handleAssessmentStarted = () => {
    toast({
      title: 'Assessment Started',
      description: 'Assessment is now running.',
    });
    setShowConfig(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Assessment Dashboard Test</CardTitle>
          <CardDescription>
            Testing the assessment configuration without dialog wrapper
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowConfig(!showConfig)}>
            <Settings className="h-4 w-4 mr-2" />
            Toggle Assessment Config
          </Button>
        </CardContent>
      </Card>

      {showConfig && (
        <div className="border rounded-lg p-4 bg-background">
          <h3 className="text-lg font-semibold mb-4">Direct Component Test</h3>
          <AssessmentInitiatorSimple
            systemId={systemId}
            onAssessmentStarted={handleAssessmentStarted}
          />
        </div>
      )}
    </div>
  );
}