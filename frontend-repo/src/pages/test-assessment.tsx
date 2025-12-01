import { useState } from "react";
import { useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TestAssessment() {
  const params = useParams();
  const systemId = params.id || "test-system-id";
  const { toast } = useToast();
  const [isStarting, setIsStarting] = useState(false);

  const handleStartAssessment = async () => {
    setIsStarting(true);
    
    try {
      const response = await apiRequest('POST', `/api/assessment/systems/${systemId}/assess`, {
        assessmentMode: 'automated',
        includeInformationalFindings: false,
        generatePoamItems: true,
        generateEvidence: true,
        updateControlStatus: true,
        riskTolerance: 'medium'
      });

      const result = await response.json();
      
      toast({
        title: 'Assessment Started',
        description: `Assessment ${result.assessmentId} is now running.`,
      });

    } catch (error) {
      toast({
        title: 'Failed to Start Assessment',
        description: 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Assessment Test Page</h1>
      
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Test Assessment Start
          </CardTitle>
          <CardDescription>
            This is a simplified test page to verify assessment functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            System ID: {systemId}
          </p>
          <Button
            onClick={handleStartAssessment}
            disabled={isStarting}
            className="w-full"
            size="lg"
          >
            <Play className="h-4 w-4 mr-2" />
            {isStarting ? 'Starting...' : 'Start Assessment'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}