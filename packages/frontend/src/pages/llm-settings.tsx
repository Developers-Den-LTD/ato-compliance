import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Database, 
  RefreshCw, 
  Check, 
  X, 
  AlertCircle, 
  Globe, 
  Server,
  Settings,
  ChevronDown,
  ChevronUp,
  Play,
  Wifi,
  WifiOff,
  Clock
} from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

// Types for LLM provider data
interface LLMProvider {
  name: string;
  displayName: string;
  isEnabled: boolean;
  priority: number;
  isDefault: boolean;
  isConnected: boolean;
  isAvailable: boolean;
  configuration: Record<string, any>;
  availableModels: string[];
  defaultModel: string | null;
  capabilities: {
    textGeneration: boolean;
    jsonGeneration: boolean;
    streaming: boolean;
    airGapped: boolean;
  };
  settings?: {
    id: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
  };
}

interface LLMProvidersResponse {
  success: boolean;
  providers: LLMProvider[];
  summary: {
    totalProviders: number;
    enabledProviders: number;
    connectedProviders: number;
    defaultProvider: string | null;
    totalModels: number;
  };
}

interface TestResult {
  provider: string;
  status: 'connected' | 'failed' | 'error';
  isAvailable: boolean;
  responseTime: number;
  models: string[];
  defaultModel: string | null;
  error: string | null;
}

// Configuration schemas
const providerConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  priority: z.number().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
  configuration: z.object({
    apiKey: z.string().optional(),
    baseUrl: z.string().url().optional(),
    model: z.string().optional(),
    organizationId: z.string().optional(),
    endpoint: z.string().url().optional(),
    modelName: z.string().optional(),
    pullOnStartup: z.boolean().optional(),
    maxTokens: z.number().min(1).max(100000).optional(),
    temperature: z.number().min(0).max(2).optional(),
    timeoutMs: z.number().min(1000).max(300000).optional(),
  }).optional()
});

const testProvidersSchema = z.object({
  providers: z.array(z.enum(['openrouter', 'ollama'])).optional(),
  timeout: z.number().min(1000).max(60000).default(30000)
});

type ProviderConfig = z.infer<typeof providerConfigSchema>;

export default function LLMSettings() {
  const { toast } = useToast();
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [isTesting, setIsTesting] = useState<Record<string, boolean>>({});
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

  // Fetch providers data
  const { data: providersData, isLoading, error } = useQuery<LLMProvidersResponse>({
    queryKey: ['/api/llm/providers'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Mutation for updating provider configuration
  const updateProviderMutation = useMutation({
    mutationFn: async ({ provider, config }: { provider: string; config: ProviderConfig }) => {
      const response = await apiRequest('PUT', `/api/llm/providers/${provider}`, config);
      return response.json();
    },
    onSuccess: (data, { provider }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/llm/providers'] });
      toast({
        title: 'Provider Updated',
        description: `Successfully updated ${provider} configuration.`,
      });
    },
    onError: (error: any, { provider }) => {
      toast({
        title: 'Update Failed',
        description: `Failed to update ${provider} configuration: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Test provider connectivity
  const testProvider = async (provider: string) => {
    setIsTesting(prev => ({ ...prev, [provider]: true }));
    
    try {
      const response = await apiRequest('POST', '/api/llm/providers/test', {
        providers: [provider],
        timeout: 30000
      });
      const data = await response.json();
      
      if (data.success && data.results.length > 0) {
        const result = data.results[0];
        setTestResults(prev => ({ ...prev, [provider]: result }));
        
        toast({
          title: 'Test Complete',
          description: `${provider}: ${result.status === 'connected' ? 'Connected' : 'Failed'} (${result.responseTime}ms)`,
          variant: result.status === 'connected' ? 'default' : 'destructive',
        });
      }
    } catch (error: any) {
      const failedResult: TestResult = {
        provider,
        status: 'error',
        isAvailable: false,
        responseTime: 30000,
        models: [],
        defaultModel: null,
        error: error.message || 'Test failed'
      };
      
      setTestResults(prev => ({ ...prev, [provider]: failedResult }));
      toast({
        title: 'Test Failed',
        description: `Failed to test ${provider}: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsTesting(prev => ({ ...prev, [provider]: false }));
    }
  };

  // Test all providers
  const testAllProviders = async () => {
    if (!providersData?.providers) return;
    
    setIsTestingAll(true);
    const enabledProviders = providersData.providers
      .filter(p => p.isEnabled)
      .map(p => p.name);
    
    if (enabledProviders.length === 0) {
      toast({
        title: 'No Providers Enabled',
        description: 'Please enable at least one provider before testing.',
        variant: 'destructive',
      });
      setIsTestingAll(false);
      return;
    }

    try {
      const response = await apiRequest('POST', '/api/llm/providers/test', {
        providers: enabledProviders,
        timeout: 30000
      });
      const data = await response.json();
      
      if (data.success) {
        const resultsMap: Record<string, TestResult> = {};
        data.results.forEach((result: TestResult) => {
          resultsMap[result.provider] = result;
        });
        setTestResults(prev => ({ ...prev, ...resultsMap }));
        
        const connectedCount = data.results.filter((r: TestResult) => r.status === 'connected').length;
        toast({
          title: 'Test Complete',
          description: `Tested ${data.results.length} providers. ${connectedCount} connected successfully.`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Test Failed',
        description: `Failed to test providers: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsTestingAll(false);
    }
  };

  // Toggle provider expansion
  const toggleProvider = (provider: string) => {
    setExpandedProviders(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }));
  };

  // Update provider settings
  const updateProvider = (provider: string, updates: Partial<ProviderConfig>) => {
    updateProviderMutation.mutate({ provider, config: updates });
  };

  // Get connection status icon
  const getConnectionStatusIcon = (provider: LLMProvider, testResult?: TestResult) => {
    if (isTesting[provider.name]) {
      return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" data-testid={`icon-${provider.name}-testing`} />;
    }
    
    if (testResult) {
      if (testResult.status === 'connected') {
        return <Check className="h-4 w-4 text-green-500" data-testid={`icon-${provider.name}-connected`} />;
      } else {
        return <X className="h-4 w-4 text-red-500" data-testid={`icon-${provider.name}-failed`} />;
      }
    }
    
    if (provider.isConnected) {
      return <Wifi className="h-4 w-4 text-green-500" data-testid={`icon-${provider.name}-online`} />;
    } else {
      return <WifiOff className="h-4 w-4 text-gray-400" data-testid={`icon-${provider.name}-offline`} />;
    }
  };

  // Get provider status badge
  const getProviderStatusBadge = (provider: LLMProvider, testResult?: TestResult) => {
    if (isTesting[provider.name]) {
      return <Badge variant="secondary" data-testid={`badge-${provider.name}-testing`}>Testing...</Badge>;
    }
    
    if (testResult) {
      if (testResult.status === 'connected') {
        return <Badge variant="default" data-testid={`badge-${provider.name}-connected`}>Connected ({testResult.responseTime}ms)</Badge>;
      } else {
        return <Badge variant="destructive" data-testid={`badge-${provider.name}-failed`}>Failed</Badge>;
      }
    }
    
    if (!provider.isEnabled) {
      return <Badge variant="secondary" data-testid={`badge-${provider.name}-disabled`}>Disabled</Badge>;
    }
    
    if (provider.isConnected) {
      return <Badge variant="default" data-testid={`badge-${provider.name}-online`}>Online</Badge>;
    } else {
      return <Badge variant="outline" data-testid={`badge-${provider.name}-offline`}>Offline</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="page-llm-settings-loading">
        <div>
          <h1 className="text-3xl font-bold">LLM Provider Settings</h1>
          <p className="text-muted-foreground mt-2">Loading provider configurations...</p>
        </div>
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                  <div className="h-8 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6" data-testid="page-llm-settings-error">
        <div>
          <h1 className="text-3xl font-bold">LLM Provider Settings</h1>
          <p className="text-muted-foreground mt-2">Configure AI language model providers</p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load LLM provider configurations. Please check your connection and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const providers = providersData?.providers || [];

  return (
    <div className="space-y-6" data-testid="page-llm-settings">
      <div>
        <h1 className="text-3xl font-bold">LLM Provider Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure and manage Large Language Model providers for ATO document generation
        </p>
      </div>

      {/* Provider Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Provider Overview
          </CardTitle>
          <CardDescription>
            Current status of all LLM providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary" data-testid="stat-total-providers">
                {providersData?.summary.totalProviders || 0}
              </div>
              <p className="text-sm text-muted-foreground">Total Providers</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600" data-testid="stat-enabled-providers">
                {providersData?.summary.enabledProviders || 0}
              </div>
              <p className="text-sm text-muted-foreground">Enabled</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600" data-testid="stat-connected-providers">
                {providersData?.summary.connectedProviders || 0}
              </div>
              <p className="text-sm text-muted-foreground">Connected</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600" data-testid="stat-total-models">
                {providersData?.summary.totalModels || 0}
              </div>
              <p className="text-sm text-muted-foreground">Available Models</p>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="flex gap-2">
            <Button 
              onClick={testAllProviders} 
              disabled={isTestingAll || providers.filter(p => p.isEnabled).length === 0}
              data-testid="button-test-all-providers"
            >
              {isTestingAll ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Testing All...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Test All Enabled Providers
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/llm/providers'] })}
              data-testid="button-refresh-providers"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Provider Configuration Cards */}
      <div className="space-y-4">
        {providers.map((provider) => (
          <Card key={provider.name} className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {getConnectionStatusIcon(provider, testResults[provider.name])}
                    <CardTitle className="flex items-center gap-2">
                      {provider.displayName}
                      {provider.isDefault && (
                        <Badge variant="default" data-testid={`badge-${provider.name}-default`}>Default</Badge>
                      )}
                      {provider.capabilities.airGapped && (
                        <Badge variant="secondary" data-testid={`badge-${provider.name}-airgapped`}>Air-gapped</Badge>
                      )}
                    </CardTitle>
                  </div>
                  {getProviderStatusBadge(provider, testResults[provider.name])}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline" 
                    size="sm"
                    onClick={() => testProvider(provider.name)}
                    disabled={isTesting[provider.name]}
                    data-testid={`button-test-${provider.name}`}
                  >
                    {isTesting[provider.name] ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                  <Collapsible 
                    open={expandedProviders[provider.name]} 
                    onOpenChange={() => toggleProvider(provider.name)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid={`button-expand-${provider.name}`}>
                        {expandedProviders[provider.name] ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </Collapsible>
                </div>
              </div>
              <CardDescription>
                {provider.name === 'openrouter' && 'Unified API for multiple LLM providers with 100+ models including GPT, Claude, Llama, and more'}
                {provider.name === 'ollama' && 'Local models for air-gapped and secure environments'}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {/* Basic Provider Controls */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Enable/Disable */}
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`enabled-${provider.name}`} className="text-sm font-medium">
                      Enabled
                    </Label>
                    <Switch
                      id={`enabled-${provider.name}`}
                      checked={provider.isEnabled}
                      onCheckedChange={(checked) => updateProvider(provider.name, { isEnabled: checked })}
                      data-testid={`switch-${provider.name}-enabled`}
                    />
                  </div>

                  {/* Priority */}
                  <div className="space-y-2">
                    <Label htmlFor={`priority-${provider.name}`} className="text-sm font-medium">
                      Priority
                    </Label>
                    <Input
                      id={`priority-${provider.name}`}
                      type="number"
                      min="1"
                      max="100"
                      value={provider.priority}
                      onChange={(e) => updateProvider(provider.name, { 
                        priority: parseInt(e.target.value) || 1 
                      })}
                      className="w-full"
                      data-testid={`input-${provider.name}-priority`}
                    />
                  </div>

                  {/* Set Default */}
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`default-${provider.name}`} className="text-sm font-medium">
                      Set as Default
                    </Label>
                    <Switch
                      id={`default-${provider.name}`}
                      checked={provider.isDefault}
                      onCheckedChange={(checked) => updateProvider(provider.name, { isDefault: checked })}
                      data-testid={`switch-${provider.name}-default`}
                    />
                  </div>
                </div>

                {/* Available Models */}
                {provider.availableModels.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Available Models</Label>
                    <div className="flex flex-wrap gap-2">
                      {provider.availableModels.map((model) => (
                        <Badge 
                          key={model} 
                          variant={model === provider.defaultModel ? "default" : "outline"}
                          data-testid={`badge-model-${provider.name}-${model.replace(/[^a-zA-Z0-9]/g, '-')}`}
                        >
                          {model}
                          {model === provider.defaultModel && " (default)"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Test Results */}
                {testResults[provider.name] && (
                  <Alert className={testResults[provider.name].status === 'connected' ? '' : 'border-destructive'}>
                    <Clock className="h-4 w-4" />
                    <AlertDescription data-testid={`test-result-${provider.name}`}>
                      <strong>Last Test:</strong> {testResults[provider.name].status === 'connected' ? 'Success' : 'Failed'} 
                      {' '}({testResults[provider.name].responseTime}ms)
                      {testResults[provider.name].error && (
                        <span className="block mt-1 text-destructive">
                          Error: {testResults[provider.name].error}
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Expanded Configuration */}
              <Collapsible open={expandedProviders[provider.name]}>
                <CollapsibleContent className="space-y-4 mt-4">
                  <Separator />
                  
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold">Provider Configuration</h4>
                    
                    {/* OpenRouter Configuration */}
                    {provider.name === 'openrouter' && (
                      <div className="space-y-4">
                        <Alert>
                          <Globe className="h-4 w-4" />
                          <AlertDescription>
                            OpenRouter provides unified access to 100+ LLM models from multiple providers. 
                            Get your API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline">openrouter.ai/keys</a>
                          </AlertDescription>
                        </Alert>
                        
                        <div className="space-y-2">
                          <Label className="text-sm">API Key</Label>
                          <Input
                            type="password"
                            placeholder="sk-or-v1-..."
                            value={provider.configuration.apiKey || ''}
                            onChange={(e) => updateProvider(provider.name, {
                              configuration: { ...provider.configuration, apiKey: e.target.value }
                            })}
                            data-testid={`input-${provider.name}-apikey`}
                          />
                          <p className="text-xs text-muted-foreground">
                            Your API key is stored securely and never exposed to the client
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm">API Endpoint</Label>
                            <Input
                              placeholder="https://openrouter.ai/api/v1"
                              value={provider.configuration.endpoint || provider.configuration.baseUrl || ''}
                              onChange={(e) => updateProvider(provider.name, {
                                configuration: { ...provider.configuration, endpoint: e.target.value }
                              })}
                              data-testid={`input-${provider.name}-endpoint`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Default Model</Label>
                            <Select
                              value={provider.configuration.model || provider.defaultModel || ''}
                              onValueChange={(value) => updateProvider(provider.name, {
                                configuration: { ...provider.configuration, model: value }
                              })}
                            >
                              <SelectTrigger data-testid={`select-${provider.name}-model`}>
                                <SelectValue placeholder="Select default model" />
                              </SelectTrigger>
                              <SelectContent>
                                {provider.availableModels.map((model) => (
                                  <SelectItem key={model} value={model}>
                                    {model}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm">HTTP Referer (Optional)</Label>
                            <Input
                              placeholder="https://your-domain.com"
                              value={provider.configuration.httpReferer || ''}
                              onChange={(e) => updateProvider(provider.name, {
                                configuration: { ...provider.configuration, httpReferer: e.target.value }
                              })}
                              data-testid={`input-${provider.name}-referer`}
                            />
                            <p className="text-xs text-muted-foreground">
                              For attribution and analytics
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">App Title (Optional)</Label>
                            <Input
                              placeholder="ATO Compliance Agent"
                              value={provider.configuration.appTitle || ''}
                              onChange={(e) => updateProvider(provider.name, {
                                configuration: { ...provider.configuration, appTitle: e.target.value }
                              })}
                              data-testid={`input-${provider.name}-app-title`}
                            />
                            <p className="text-xs text-muted-foreground">
                              Displayed in OpenRouter dashboard
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ollama Configuration */}
                    {provider.name === 'ollama' && (
                      <div className="space-y-4">
                        <Alert>
                          <Server className="h-4 w-4" />
                          <AlertDescription>
                            Ollama provides air-gapped LLM capabilities for secure environments. 
                            Ensure Ollama is running locally or configure a custom endpoint.
                          </AlertDescription>
                        </Alert>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm">Ollama Endpoint</Label>
                            <Input
                              placeholder="http://localhost:11434"
                              value={provider.configuration.endpoint || 'http://localhost:11434'}
                              onChange={(e) => updateProvider(provider.name, {
                                configuration: { ...provider.configuration, endpoint: e.target.value }
                              })}
                              data-testid={`input-${provider.name}-endpoint`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Model Name</Label>
                            <Input
                              placeholder="llama2, codellama, etc."
                              value={provider.configuration.modelName || ''}
                              onChange={(e) => updateProvider(provider.name, {
                                configuration: { ...provider.configuration, modelName: e.target.value }
                              })}
                              data-testid={`input-${provider.name}-model-name`}
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-sm">Auto-pull Models on Startup</Label>
                            <p className="text-xs text-muted-foreground">
                              Automatically download missing models when the service starts
                            </p>
                          </div>
                          <Switch
                            checked={provider.configuration.pullOnStartup || false}
                            onCheckedChange={(checked) => updateProvider(provider.name, {
                              configuration: { ...provider.configuration, pullOnStartup: checked }
                            })}
                            data-testid={`switch-${provider.name}-autopull`}
                          />
                        </div>
                      </div>
                    )}

                    {/* Common Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Max Tokens</Label>
                        <Input
                          type="number"
                          min="1000"
                          max="100000"
                          value={provider.configuration.maxTokens || 8000}
                          onChange={(e) => updateProvider(provider.name, {
                            configuration: { ...provider.configuration, maxTokens: parseInt(e.target.value) }
                          })}
                          data-testid={`input-${provider.name}-max-tokens`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Temperature</Label>
                        <Input
                          type="number"
                          min="0"
                          max="2"
                          step="0.1"
                          value={provider.configuration.temperature || 0.1}
                          onChange={(e) => updateProvider(provider.name, {
                            configuration: { ...provider.configuration, temperature: parseFloat(e.target.value) }
                          })}
                          data-testid={`input-${provider.name}-temperature`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Timeout (ms)</Label>
                        <Input
                          type="number"
                          min="1000"
                          max="300000"
                          value={provider.configuration.timeoutMs || 120000}
                          onChange={(e) => updateProvider(provider.name, {
                            configuration: { ...provider.configuration, timeoutMs: parseInt(e.target.value) }
                          })}
                          data-testid={`input-${provider.name}-timeout`}
                        />
                      </div>
                    </div>

                    {/* Capabilities */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Capabilities</Label>
                      <div className="flex flex-wrap gap-2">
                        {provider.capabilities.textGeneration && (
                          <Badge variant="outline" data-testid={`capability-${provider.name}-text`}>Text Generation</Badge>
                        )}
                        {provider.capabilities.jsonGeneration && (
                          <Badge variant="outline" data-testid={`capability-${provider.name}-json`}>JSON Generation</Badge>
                        )}
                        {provider.capabilities.streaming && (
                          <Badge variant="outline" data-testid={`capability-${provider.name}-streaming`}>Streaming</Badge>
                        )}
                        {provider.capabilities.airGapped && (
                          <Badge variant="outline" data-testid={`capability-${provider.name}-airgapped`}>Air-gapped</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Help</CardTitle>
          <CardDescription>
            Guidelines for configuring LLM providers in different environments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <Alert>
              <Globe className="h-4 w-4" />
              <AlertDescription>
                <strong>Internet-Connected Environments:</strong> Use OpenRouter for unified access to 100+ models including GPT-4, Claude, Llama, and more. 
                Single API key, cost-effective pricing, and no billing minimums make it perfect for development and production.
              </AlertDescription>
            </Alert>
            
            <Alert>
              <Server className="h-4 w-4" />
              <AlertDescription>
                <strong>Air-Gapped Environments:</strong> Use Ollama for completely offline LLM capabilities. 
                Install Ollama locally and download models like llama2, codellama, or mistral for secure operation.
              </AlertDescription>
            </Alert>
            
            <Alert>
              <Settings className="h-4 w-4" />
              <AlertDescription>
                <strong>Priority Settings:</strong> Lower numbers indicate higher priority. The system will attempt 
                to use providers in priority order, falling back to the next available provider if the primary fails.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}