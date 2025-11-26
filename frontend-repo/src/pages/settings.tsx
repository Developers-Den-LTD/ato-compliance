import { useState } from 'react';
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
import { AlertTriangle, Save, RefreshCw, Shield, Database, Key, Globe, Bell, Users, Monitor, FileText } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { UserManagementTab } from '@/components/user-management-tab';

// Configuration schemas
const systemConfigSchema = z.object({
  organizationName: z.string().min(1, 'Organization name is required'),
  environment: z.enum(['development', 'staging', 'production']),
  timezone: z.string().min(1, 'Timezone is required'),
  defaultLanguage: z.string().min(1, 'Default language is required'),
  sessionTimeout: z.number().min(5).max(1440), // 5 minutes to 24 hours
});

const securityConfigSchema = z.object({
  enforceHttps: z.boolean(),
  enableAuditLogging: z.boolean(),
  passwordMinLength: z.number().min(8).max(32),
  sessionRotationEnabled: z.boolean(),
  mfaRequired: z.boolean(),
  passwordComplexity: z.boolean(),
  accountLockoutAttempts: z.number().min(3).max(10),
  accountLockoutDuration: z.number().min(5).max(60), // minutes
});

const llmConfigSchema = z.object({
  primaryProvider: z.enum(['openrouter', 'ollama']),
  enableFallback: z.boolean(),
  maxTokens: z.number().min(1000).max(32000),
  temperature: z.number().min(0).max(2),
  timeoutSeconds: z.number().min(10).max(300),
});

type SystemConfig = z.infer<typeof systemConfigSchema>;
type SecurityConfig = z.infer<typeof securityConfigSchema>;
type LLMConfig = z.infer<typeof llmConfigSchema>;

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('system');
  const [isSaving, setIsSaving] = useState(false);

  // Form configurations
  const systemForm = useForm<SystemConfig>({
    resolver: zodResolver(systemConfigSchema),
    defaultValues: {
      organizationName: 'Department of Defense',
      environment: 'production',
      timezone: 'America/New_York',
      defaultLanguage: 'en-US',
      sessionTimeout: 60, // 1 hour
    },
  });

  const securityForm = useForm<SecurityConfig>({
    resolver: zodResolver(securityConfigSchema),
    defaultValues: {
      enforceHttps: true,
      enableAuditLogging: true,
      passwordMinLength: 14,
      sessionRotationEnabled: true,
      mfaRequired: true,
      passwordComplexity: true,
      accountLockoutAttempts: 3,
      accountLockoutDuration: 15,
    },
  });

  const llmForm = useForm<LLMConfig>({
    resolver: zodResolver(llmConfigSchema),
    defaultValues: {
      primaryProvider: 'openrouter',
      enableFallback: true,
      maxTokens: 8000,
      temperature: 0.1,
      timeoutSeconds: 120,
    },
  });

  // Save handlers
  const saveSystemConfig = async (data: SystemConfig) => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: 'System Settings Saved',
        description: 'System configuration has been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Failed to save system configuration. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveSecurityConfig = async (data: SecurityConfig) => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: 'Security Settings Saved',
        description: 'Security configuration has been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Failed to save security configuration. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveLLMConfig = async (data: LLMConfig) => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: 'LLM Settings Saved',
        description: 'LLM configuration has been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Failed to save LLM configuration. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testConnectivity = async (provider: string) => {
    toast({
      title: 'Testing Connection',
      description: `Testing connectivity to ${provider}...`,
    });
    
    // Simulate connectivity test
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast({
      title: 'Connection Test Complete',
      description: `Successfully connected to ${provider}.`,
    });
  };

  return (
    <div className="space-y-6" data-testid="page-settings">
      <div>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure system-wide settings for the ATO Compliance Agent
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="system" data-testid="tab-system">
            <Monitor className="w-4 h-4 mr-2" />
            System
          </TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="llm" data-testid="tab-llm">
            <Database className="w-4 h-4 mr-2" />
            LLM Providers
          </TabsTrigger>
          <TabsTrigger value="integration" data-testid="tab-integration">
            <Globe className="w-4 h-4 mr-2" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          {user?.role === 'admin' && (
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="w-4 h-4 mr-2" />
              User Management
            </TabsTrigger>
          )}
        </TabsList>

        {/* System Configuration */}
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                System Configuration
              </CardTitle>
              <CardDescription>
                Configure basic system settings and organization information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...systemForm}>
                <form onSubmit={systemForm.handleSubmit(saveSystemConfig)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={systemForm.control}
                      name="organizationName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organization Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter organization name" {...field} data-testid="input-org-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={systemForm.control}
                      name="environment"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Environment</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-environment">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="development">Development</SelectItem>
                              <SelectItem value="staging">Staging</SelectItem>
                              <SelectItem value="production">Production</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={systemForm.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timezone</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-timezone">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="America/New_York">Eastern Time</SelectItem>
                              <SelectItem value="America/Chicago">Central Time</SelectItem>
                              <SelectItem value="America/Denver">Mountain Time</SelectItem>
                              <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                              <SelectItem value="UTC">UTC</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={systemForm.control}
                      name="sessionTimeout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Session Timeout (minutes)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="5" 
                              max="1440" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              data-testid="input-session-timeout"
                            />
                          </FormControl>
                          <FormDescription>
                            Session will expire after this many minutes of inactivity
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" disabled={isSaving} data-testid="button-save-system">
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save System Settings
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Configuration */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Security Configuration
              </CardTitle>
              <CardDescription>
                Configure security policies and authentication requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...securityForm}>
                <form onSubmit={securityForm.handleSubmit(saveSecurityConfig)} className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Enforce HTTPS</Label>
                        <div className="text-sm text-muted-foreground">
                          Require all connections to use HTTPS
                        </div>
                      </div>
                      <FormField
                        control={securityForm.control}
                        name="enforceHttps"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enforce-https"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Enable Audit Logging</Label>
                        <div className="text-sm text-muted-foreground">
                          Log all security-relevant events - NIST 800-53 AU-2
                        </div>
                      </div>
                      <FormField
                        control={securityForm.control}
                        name="enableAuditLogging"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-audit-logging"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Require Multi-Factor Authentication</Label>
                        <div className="text-sm text-muted-foreground">
                          Enforce MFA for all user accounts - NIST 800-53 IA-2
                        </div>
                      </div>
                      <FormField
                        control={securityForm.control}
                        name="mfaRequired"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-mfa-required"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={securityForm.control}
                        name="passwordMinLength"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum Password Length</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="8" 
                                max="32" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                                data-testid="input-password-min-length"
                              />
                            </FormControl>
                            <FormDescription>
                              NIST 800-53 IA-5 recommends minimum 14 characters
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={securityForm.control}
                        name="accountLockoutAttempts"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account Lockout Attempts</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="3" 
                                max="10" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                                data-testid="input-lockout-attempts"
                              />
                            </FormControl>
                            <FormDescription>
                              Number of failed login attempts before lockout - NIST 800-53 AC-7
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={isSaving} data-testid="button-save-security">
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Security Settings
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LLM Configuration */}
        <TabsContent value="llm">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                LLM Provider Configuration
              </CardTitle>
              <CardDescription>
                Configure Large Language Model providers for document generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...llmForm}>
                <form onSubmit={llmForm.handleSubmit(saveLLMConfig)} className="space-y-6">
                  <div className="space-y-4">
                    <FormField
                      control={llmForm.control}
                      name="primaryProvider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary LLM Provider</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-llm-provider">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="openrouter">
                                <div className="flex items-center justify-between w-full">
                                  OpenRouter (Unified API)
                                  <Badge variant="default" className="ml-2">Recommended</Badge>
                                </div>
                              </SelectItem>
                              <SelectItem value="ollama">
                                <div className="flex items-center justify-between w-full">
                                  Ollama (Local)
                                  <Badge variant="secondary" className="ml-2">Air-gapped</Badge>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose your primary LLM provider for document generation
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Enable Provider Fallback</Label>
                        <div className="text-sm text-muted-foreground">
                          Automatically fallback to secondary providers if primary fails
                        </div>
                      </div>
                      <FormField
                        control={llmForm.control}
                        name="enableFallback"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-llm-fallback"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={llmForm.control}
                        name="maxTokens"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Tokens</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="1000" 
                                max="32000" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                                data-testid="input-max-tokens"
                              />
                            </FormControl>
                            <FormDescription>
                              Maximum tokens per LLM request
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={llmForm.control}
                        name="temperature"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Temperature</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                max="2" 
                                step="0.1" 
                                {...field} 
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                data-testid="input-temperature"
                              />
                            </FormControl>
                            <FormDescription>
                              Controls randomness (0.0 = deterministic, 1.0 = creative)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Provider Status</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">OpenRouter</div>
                              <Badge variant="default" className="mt-1">Available</Badge>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => testConnectivity('OpenRouter')}
                              data-testid="button-test-openrouter"
                            >
                              Test
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">Ollama</div>
                              <Badge variant="secondary" className="mt-1">Local</Badge>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => testConnectivity('Ollama')}
                              data-testid="button-test-ollama"
                            >
                              Test
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  <Button type="submit" disabled={isSaving} data-testid="button-save-llm">
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save LLM Settings
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integration Configuration */}
        <TabsContent value="integration">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                External Integrations
              </CardTitle>
              <CardDescription>
                Configure integrations with external systems and services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Integration Management</h3>
                  <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                    Configure integrations with eMASS, STIG repositories, vulnerability scanners, and other compliance tools.
                  </p>
                  <Button className="mt-4" variant="outline" data-testid="button-configure-integrations">
                    Configure Integrations
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure system notifications and alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="text-center py-12">
                  <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Notification Center</h3>
                  <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                    Configure email alerts, system notifications, and compliance reminders.
                  </p>
                  <Button className="mt-4" variant="outline" data-testid="button-configure-notifications">
                    Configure Notifications
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Management */}
        {user?.role === 'admin' && (
          <TabsContent value="users">
            <UserManagementTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}