import React from 'react';
import { apiRequest } from '@/lib/queryClient';

interface AssessmentInitiatorBasicProps {
  systemId: string;
  onAssessmentStarted: (assessmentId: string) => void;
}

export function AssessmentInitiatorBasic({ systemId, onAssessmentStarted }: AssessmentInitiatorBasicProps) {
  const [loading, setLoading] = React.useState(false);

  const startAssessment = async () => {
    setLoading(true);
    
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
      if (result.assessmentId && onAssessmentStarted) {
        onAssessmentStarted(result.assessmentId);
      }
    } catch (error) {
      console.error('Assessment error:', error);
    } finally {
      setLoading(false);
    });
  };

  return React.createElement('div', { className: 'p-6 space-y-4' },
    React.createElement('h3', { className: 'text-lg font-semibold' }, 
      'Configure Assessment'
    ),
    React.createElement('p', { className: 'text-sm text-gray-600' },
      'Start an automated security assessment with default settings.'
    ),
    React.createElement('button', {
      onClick: startAssessment,
      disabled: loading,
      className: 'w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50',
      type: 'button'
    }, loading ? 'Starting...' : 'Start Assessment')
  );
}