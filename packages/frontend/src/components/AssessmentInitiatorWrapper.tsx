import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy load the component to avoid initialization issues
const AssessmentInitiatorEnhanced = lazy(() => 
  import('./assessment-initiator-enhanced').then(module => ({
    default: module.AssessmentInitiatorEnhanced
  }))
);

interface AssessmentInitiatorWrapperProps {
  systemId: string;
  onAssessmentStarted: (assessmentId: string) => void;
}

export function AssessmentInitiatorWrapper(props: AssessmentInitiatorWrapperProps) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2">Loading assessment configuration...</span>
      </div>
    }>
      <AssessmentInitiatorEnhanced {...props} />
    </Suspense>
  );
}