import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface LLMProviderConfigProps {
  provider: any;
  updateProvider: (name: string, updates: any) => void;
}

export function LLMProviderConfig({ provider, updateProvider }: LLMProviderConfigProps) {
  return (
    <div className="space-y-4">
      {/* Always show API Key first for providers that need it */}
      {(provider.name === 'openai' || provider.name === 'anthropic') && (
        <>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Enter your {provider.displayName} API key to use this provider
            </AlertDescription>
          </Alert>
          
          <div>
            <Label htmlFor={`${provider.name}-api-key`}>
              API Key <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`${provider.name}-api-key`}
              type="password"
              placeholder={provider.name === 'openai' ? 'sk-...' : 'sk-ant-...'}
              value={provider.configuration?.apiKey || ''}
              onChange={(e) => updateProvider(provider.name, {
                configuration: { ...provider.configuration, apiKey: e.target.value }
              })}
              className="mt-1 font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Required for authentication
            </p>
          </div>
        </>
      )}

      {/* Model Selection */}
      {provider.availableModels?.length > 0 && (
        <div>
          <Label htmlFor={`${provider.name}-model`}>Model</Label>
          <Select
            value={provider.configuration?.model || provider.defaultModel || ''}
            onValueChange={(value) => updateProvider(provider.name, {
              configuration: { ...provider.configuration, model: value }
            })}
          >
            <SelectTrigger id={`${provider.name}-model`} className="mt-1">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {provider.availableModels.map((model: string) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Provider-specific fields */}
      {provider.name === 'openai' && (
        <>
          <div>
            <Label htmlFor={`${provider.name}-endpoint`}>API Endpoint</Label>
            <Input
              id={`${provider.name}-endpoint`}
              value={provider.configuration?.baseUrl || 'https://api.openai.com/v1'}
              onChange={(e) => updateProvider(provider.name, {
                configuration: { ...provider.configuration, baseUrl: e.target.value }
              })}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor={`${provider.name}-org`}>Organization ID (Optional)</Label>
            <Input
              id={`${provider.name}-org`}
              value={provider.configuration?.organizationId || ''}
              onChange={(e) => updateProvider(provider.name, {
                configuration: { ...provider.configuration, organizationId: e.target.value }
              })}
              className="mt-1"
              placeholder="org-..."
            />
          </div>
        </>
      )}

      {provider.name === 'anthropic' && (
        <div>
          <Label htmlFor={`${provider.name}-endpoint`}>API Endpoint</Label>
          <Input
            id={`${provider.name}-endpoint`}
            value={provider.configuration?.baseUrl || 'https://api.anthropic.com'}
            onChange={(e) => updateProvider(provider.name, {
              configuration: { ...provider.configuration, baseUrl: e.target.value }
            })}
            className="mt-1"
          />
        </div>
      )}

      {provider.name === 'ollama' && (
        <>
          <div>
            <Label htmlFor={`${provider.name}-endpoint`}>Ollama Endpoint</Label>
            <Input
              id={`${provider.name}-endpoint`}
              value={provider.configuration?.baseUrl || 'http://localhost:11434'}
              onChange={(e) => updateProvider(provider.name, {
                configuration: { ...provider.configuration, baseUrl: e.target.value }
              })}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor={`${provider.name}-api-key`}>API Key (Optional)</Label>
            <Input
              id={`${provider.name}-api-key`}
              type="password"
              value={provider.configuration?.apiKey || ''}
              onChange={(e) => updateProvider(provider.name, {
                configuration: { ...provider.configuration, apiKey: e.target.value }
              })}
              className="mt-1"
              placeholder="Only for remote Ollama"
            />
          </div>
        </>
      )}

      {/* Common settings */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor={`${provider.name}-max-tokens`}>Max Tokens</Label>
          <Input
            id={`${provider.name}-max-tokens`}
            type="number"
            value={provider.configuration?.maxTokens || 8000}
            onChange={(e) => updateProvider(provider.name, {
              configuration: { ...provider.configuration, maxTokens: parseInt(e.target.value) || 8000 }
            })}
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor={`${provider.name}-temperature`}>Temperature</Label>
          <Input
            id={`${provider.name}-temperature`}
            type="number"
            step="0.1"
            value={provider.configuration?.temperature || 0.1}
            onChange={(e) => updateProvider(provider.name, {
              configuration: { ...provider.configuration, temperature: parseFloat(e.target.value) || 0.1 }
            })}
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor={`${provider.name}-timeout`}>Timeout (ms)</Label>
          <Input
            id={`${provider.name}-timeout`}
            type="number"
            value={provider.configuration?.timeoutMs || 120000}
            onChange={(e) => updateProvider(provider.name, {
              configuration: { ...provider.configuration, timeoutMs: parseInt(e.target.value) || 120000 }
            })}
            className="mt-1"
          />
        </div>
      </div>
    </div>
  );
}