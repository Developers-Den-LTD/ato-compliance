import { ControlTable } from '../control-table';

export default function ControlTableExample() {
  const mockControls = [
    {
      id: "AC-1",
      family: "Access Control",
      title: "Access Control Policy and Procedures",
      baseline: "Low" as const,
      implementationStatus: "compliant" as const,
      lastAssessed: "2024-01-15",
      assignedTo: "John Smith"
    },
    {
      id: "AC-2",
      family: "Access Control", 
      title: "Account Management",
      baseline: "Moderate" as const,
      implementationStatus: "in-progress" as const,
      lastAssessed: "2024-01-10",
      assignedTo: "Jane Doe"
    },
    {
      id: "AU-1",
      family: "Audit and Accountability",
      title: "Audit and Accountability Policy and Procedures", 
      baseline: "High" as const,
      implementationStatus: "non-compliant" as const,
      assignedTo: "Bob Wilson"
    }
  ];

  const handleViewControl = (controlId: string) => {
    console.log(`Viewing control: ${controlId}`);
  };

  return (
    <div>
      <ControlTable 
        controls={mockControls}
        onViewControl={handleViewControl}
      />
    </div>
  );
}