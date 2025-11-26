import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type InsertSystem } from "@shared/schema";
import { Loader2, Shield, HardDrive, Server, Smartphone, Cloud, AlertCircle, CheckCircle } from "lucide-react";
import { z } from "zod";

interface SystemRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Enhanced form schema with STIG profile fields
const enhancedFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.enum(["Major Application", "General Support System"]),
  impactLevel: z.enum(["High", "Moderate", "Low"]),
  owner: z.string().default("System Administrator"),
  complianceStatus: z.enum(["compliant", "non-compliant", "in-progress", "not-started", "not-assessed"]).default('not-assessed'),
  systemType: z.enum(["Application", "Operating System", "Network Device", "Mobile Device", "Cloud"]),
  operatingSystem: z.string().optional(),
  stigProfiles: z.array(z.string()).default([]),
  autoStigUpdates: z.boolean().default(true)
});

type EnhancedInsertSystem = z.infer<typeof enhancedFormSchema>;

// STIG Profile type
type StigProfile = {
  stig_id: string;
  stig_title: string;
  version: string;
  category: string;
  rule_count: number;
};

// System type configuration
const SYSTEM_TYPE_CONFIG = {
  "Application": {
    icon: Server,
    description: "Web servers, databases, application servers",
    osOptions: ["Apache Web Server", "Nginx", "PostgreSQL", "MySQL", "MongoDB", "Docker", "Kubernetes", "Java/Tomcat", "Node.js", "Other"]
  },
  "Operating System": {
    icon: HardDrive,
    description: "Desktop and server operating systems",
    osOptions: ["Windows 10/11", "Windows Server", "Ubuntu", "RHEL", "CentOS", "SUSE", "macOS"]
  },
  "Network Device": {
    icon: Shield,
    description: "Routers, switches, firewalls, load balancers",
    osOptions: ["Cisco IOS", "Juniper JunOS", "pfSense", "Fortinet", "Palo Alto", "Other"]
  },
  "Mobile Device": {
    icon: Smartphone,
    description: "Mobile devices and endpoints",
    osOptions: ["iOS", "Android", "Windows Mobile", "Other"]
  },
  "Cloud": {
    icon: Cloud,
    description: "Cloud services and infrastructure",
    osOptions: ["AWS", "Azure", "Google Cloud", "Multi-Cloud", "Other"]
  }
};

export function SystemRegistrationModal({ open, onOpenChange }: SystemRegistrationModalProps) {
  const { toast } = useToast();
  const [selectedSystemType, setSelectedSystemType] = useState<string>("");
  
  const form = useForm<EnhancedInsertSystem>({
    resolver: zodResolver(enhancedFormSchema),
    defaultValues: {
      name: "",
      description: "TBD",
      category: "Major Application",
      impactLevel: "Moderate",
      complianceStatus: "not-assessed",
      owner: "System Administrator",
      systemType: "Application",
      operatingSystem: "",
      stigProfiles: [],
      autoStigUpdates: true
    }
  });

  // Watch system type changes to update OS options
  const watchedSystemType = form.watch("systemType");
  useEffect(() => {
    setSelectedSystemType(watchedSystemType);
    // Reset OS selection when system type changes
    form.setValue("operatingSystem", "");
    form.setValue("stigProfiles", []);
  }, [watchedSystemType, form]);

  // Fetch available STIG profiles
  const { data: stigProfiles = [], isLoading: stigProfilesLoading } = useQuery<StigProfile[]>({
    queryKey: ['/api/systems/stig-profiles', selectedSystemType],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/systems/stig-profiles?category=${selectedSystemType}`);
      return response.json();
    },
    enabled: !!selectedSystemType
  });

  // Create system mutation
  const createSystemMutation = useMutation({
    mutationFn: async (data: EnhancedInsertSystem) => {
      const response = await apiRequest('POST', '/api/systems', data);
      return response.json();
    },
    onSuccess: (newSystem) => {
      queryClient.invalidateQueries({ queryKey: ['/api/systems'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/dashboard'] });
      
      toast({
        title: "Success",
        description: `System "${newSystem.name}" has been registered with ${newSystem.stigProfiles?.length || 0} STIG profiles.`,
      });
      
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Enhanced system registration error:', error);
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register system. Please try again.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: EnhancedInsertSystem) => {
    createSystemMutation.mutate(data);
  };

  const handleClose = () => {
    if (!createSystemMutation.isPending) {
      form.reset();
      onOpenChange(false);
    }
  };

  const toggleStigProfile = (stigId: string) => {
    const currentProfiles = form.getValues("stigProfiles");
    const newProfiles = currentProfiles.includes(stigId)
      ? currentProfiles.filter(id => id !== stigId)
      : [...currentProfiles, stigId];
    form.setValue("stigProfiles", newProfiles);
  };

  const systemTypeConfig = SYSTEM_TYPE_CONFIG[selectedSystemType as keyof typeof SYSTEM_TYPE_CONFIG];
  const selectedProfiles = form.watch("stigProfiles");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto" data-testid="modal-enhanced-system-registration">
        <DialogHeader>
          <DialogTitle data-testid="text-modal-title">Register New System with STIG Profiles</DialogTitle>
          <DialogDescription data-testid="text-modal-description">
            Add a new IT system to the compliance management platform with appropriate STIG security profiles.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic System Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">System Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel data-testid="label-system-name">System Name *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Customer Management System"
                            data-testid="input-system-name"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="owner"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel data-testid="label-system-owner">System Owner</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="System Administrator"
                            data-testid="input-system-owner"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel data-testid="label-system-description">Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Brief description of the system's purpose and functionality..."
                          rows={3}
                          data-testid="textarea-system-description"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel data-testid="label-system-category">Category *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-system-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Major Application">Major Application</SelectItem>
                            <SelectItem value="General Support System">General Support System</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="impactLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel data-testid="label-impact-level">Impact Level *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-impact-level">
                              <SelectValue placeholder="Select impact level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Low">Low Impact</SelectItem>
                            <SelectItem value="Moderate">Moderate Impact</SelectItem>
                            <SelectItem value="High">High Impact</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="complianceStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel data-testid="label-compliance-status">Initial Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-compliance-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="not-assessed">Not Assessed</SelectItem>
                            <SelectItem value="in-progress">In Progress</SelectItem>
                            <SelectItem value="compliant">Compliant</SelectItem>
                            <SelectItem value="non-compliant">Non-Compliant</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* STIG Profile Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  STIG Security Profiles
                </CardTitle>
                <CardDescription>
                  Select the appropriate Security Technical Implementation Guides (STIGs) based on your system type and components.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="systemType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>System Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select system type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(SYSTEM_TYPE_CONFIG).map(([type, config]) => {
                              const Icon = config.icon;
                              return (
                                <SelectItem key={type} value={type}>
                                  <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4" />
                                    {type}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {systemTypeConfig && (
                    <FormField
                      control={form.control}
                      name="operatingSystem"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Operating System / Platform</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select OS/Platform" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {systemTypeConfig.osOptions.map((os) => (
                                <SelectItem key={os} value={os}>{os}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {systemTypeConfig && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>{selectedSystemType}:</strong> {systemTypeConfig.description}
                    </p>
                  </div>
                )}

                {/* STIG Profiles Selection */}
                {selectedSystemType && (
                  <div className="space-y-3">
                    <FormLabel className="text-base font-medium">Available STIG Profiles</FormLabel>
                    
                    {stigProfilesLoading ? (
                      <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-gray-600">Loading STIG profiles...</span>
                      </div>
                    ) : stigProfiles.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {stigProfiles.map((profile) => (
                          <div
                            key={profile.stig_id}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedProfiles.includes(profile.stig_id)
                                ? 'bg-green-50 border-green-300'
                                : 'bg-white border-gray-200 hover:border-blue-300'
                            }`}
                            onClick={() => toggleStigProfile(profile.stig_id)}
                          >
                            <div className="flex items-start gap-2">
                              <Checkbox 
                                checked={selectedProfiles.includes(profile.stig_id)}
                                onCheckedChange={() => {}}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-sm truncate">{profile.stig_title}</h4>
                                  {selectedProfiles.includes(profile.stig_id) && (
                                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {profile.rule_count} rules
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {profile.version}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-600" />
                          <span className="text-sm text-yellow-800">
                            No STIG profiles available for {selectedSystemType} systems. 
                            You can upload custom STIGs after system registration.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Auto-update setting */}
                    <FormField
                      control={form.control}
                      name="autoStigUpdates"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-medium">
                              Auto-update STIG profiles
                            </FormLabel>
                            <p className="text-xs text-gray-600">
                              Automatically apply new STIG versions when released by DISA (quarterly updates)
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary */}
            {selectedProfiles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Registration Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <strong>System Type:</strong> {selectedSystemType}
                    </p>
                    <p className="text-sm">
                      <strong>STIG Profiles:</strong> {selectedProfiles.length} selected
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedProfiles.map(profileId => {
                        const profile = stigProfiles.find(p => p.stig_id === profileId);
                        return profile ? (
                          <Badge key={profileId} variant="secondary" className="text-xs">
                            {profile.stig_title}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={createSystemMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createSystemMutation.isPending}
                data-testid="button-register"
              >
                {createSystemMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Registering...
                  </>
                ) : (
                  "Register System"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Export default
export default SystemRegistrationModal;