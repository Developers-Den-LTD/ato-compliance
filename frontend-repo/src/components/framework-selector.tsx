import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';

export interface Framework {
  id: string;
  name: string;
  description: string;
  version?: string;
  color: string;
}

const SUPPORTED_FRAMEWORKS: Framework[] = [
  {
    id: 'NIST-800-53',
    name: 'NIST 800-53',
    description: 'Security and Privacy Controls for Federal Information Systems',
    version: 'Rev 5',
    color: 'blue'
  },
  {
    id: 'FedRAMP',
    name: 'FedRAMP',
    description: 'Federal Risk and Authorization Management Program',
    version: 'Rev 5',
    color: 'green'
  },
  {
    id: 'ISO-27001',
    name: 'ISO 27001',
    description: 'Information Security Management Systems',
    version: '2022',
    color: 'purple'
  },
  {
    id: 'CIS-Controls',
    name: 'CIS Controls',
    description: 'Center for Internet Security Critical Security Controls',
    version: 'v8',
    color: 'orange'
  }
];

interface FrameworkSelectorProps {
  selectedFramework?: string;
  onFrameworkChange: (framework: string) => void;
  className?: string;
  disabled?: boolean;
}

export function FrameworkSelector({
  selectedFramework,
  onFrameworkChange,
  className,
  disabled = false
}: FrameworkSelectorProps) {
  return (
    <div className={className}>
      <Select 
        value={selectedFramework} 
        onValueChange={onFrameworkChange}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a security framework" />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_FRAMEWORKS.map((framework) => (
            <SelectItem key={framework.id} value={framework.id}>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`bg-${framework.color}-50 text-${framework.color}-700`}>
                  {framework.name}
                </Badge>
                <div className="text-sm">
                  <div className="font-medium">{framework.description}</div>
                  {framework.version && (
                    <div className="text-muted-foreground text-xs">
                      Version {framework.version}
                    </div>
                  )}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FrameworkBadge({ frameworkId }: { frameworkId: string }) {
  const framework = SUPPORTED_FRAMEWORKS.find(f => f.id === frameworkId);
  
  if (!framework) {
    return <Badge variant="secondary">{frameworkId}</Badge>;
  }
  
  return (
    <Badge variant="outline" className={`bg-${framework.color}-50 text-${framework.color}-700`}>
      {framework.name}
    </Badge>
  );
}

export { SUPPORTED_FRAMEWORKS };