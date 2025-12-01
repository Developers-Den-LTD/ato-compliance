import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AssessmentDashboardMinimalProps {
  systemId: string;
}

export function AssessmentDashboardMinimal({ systemId }: AssessmentDashboardMinimalProps) {
  const [showConfig, setShowConfig] = useState(false);
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Assessment Dashboard - Minimal Test</CardTitle>
        </CardHeader>
        <CardContent>
          <p>System ID: {systemId}</p>
          <p>Config shown: {showConfig ? 'Yes' : 'No'}</p>
          <Button 
            onClick={() => setShowConfig(!showConfig)}
            className="mt-4"
          >
            Toggle Config (Test)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}