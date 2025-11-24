import { SystemCard } from '../system-card';

export default function SystemCardExample() {
  const handleViewDetails = () => {
    console.log('View details clicked');
  };

  const handleGenerateSSP = () => {
    console.log('Generate SSP clicked');
  };

  return (
    <div className="max-w-md">
      <SystemCard
        id="sys-001"
        name="Enterprise Web Portal"
        description="Customer-facing web application with payment processing and user management"
        impactLevel="High"
        category="Major Application"
        complianceStatus="in-progress"
        controlsImplemented={245}
        totalControls={324}
        lastAssessment="2 days ago"
        onViewDetails={handleViewDetails}
        onGenerateSSP={handleGenerateSSP}
      />
    </div>
  );
}