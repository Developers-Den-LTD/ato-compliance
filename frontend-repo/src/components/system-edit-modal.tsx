import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertSystemSchema, type InsertSystem, type System } from "@/types/schema";
import { Loader2 } from "lucide-react";

interface SystemEditModalProps {
  system: System | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Form schema for editing - make all fields optional except required ones
const editFormSchema = insertSystemSchema.partial().extend({
  name: insertSystemSchema.shape.name, // Keep name required
  category: insertSystemSchema.shape.category, // Keep category required
});

type EditFormData = Partial<InsertSystem> & {
  name: string;
  category: string;
};

export function SystemEditModal({ system, open, onOpenChange }: SystemEditModalProps) {
  const { toast } = useToast();
  
  const form = useForm<EditFormData>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "Major Application",
      impactLevel: "Moderate",
      complianceStatus: "not-assessed",
      owner: ""
    }
  });

  // Update form values when system changes
  useEffect(() => {
    if (system) {
      form.reset({
        name: system.name,
        description: system.description || "",
        category: system.category,
        impactLevel: system.impactLevel,
        complianceStatus: system.complianceStatus,
        owner: system.owner || ""
      });
    }
  }, [system, form]);

  // Update system mutation
  const updateSystemMutation = useMutation({
    mutationFn: async (data: EditFormData) => {
      if (!system) throw new Error("No system selected");
      const response = await apiRequest('PUT', `/api/systems/${system.id}`, data);
      return response.json();
    },
    onSuccess: (updatedSystem) => {
      // Invalidate and refetch systems list and dashboard
      queryClient.invalidateQueries({ queryKey: ['/api/systems'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/dashboard'] });
      
      toast({
        title: "Success",
        description: `System "${updatedSystem.name}" has been updated successfully.`,
      });
      
      // Close modal
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('System update error:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update system. Please try again.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: EditFormData) => {
    updateSystemMutation.mutate(data);
  };

  const handleClose = () => {
    if (!updateSystemMutation.isPending) {
      onOpenChange(false);
    }
  };

  // Don't render if no system is selected
  if (!system) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-edit-system">
        <DialogHeader>
          <DialogTitle data-testid="text-edit-modal-title">Edit System</DialogTitle>
          <DialogDescription data-testid="text-edit-modal-description">
            Update the information for "{system.name}". All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="form-edit-system">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-edit-system-name">System Name *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Customer Management System"
                        data-testid="input-edit-system-name"
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
                    <FormLabel data-testid="label-edit-system-owner">System Owner</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="System Administrator"
                        data-testid="input-edit-system-owner"
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
                  <FormLabel data-testid="label-edit-system-description">Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Brief description of the system's purpose and functionality..."
                      rows={3}
                      data-testid="textarea-edit-system-description"
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
                    <FormLabel data-testid="label-edit-system-category">Category *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-system-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Major Application" data-testid="option-edit-major-application">
                          Major Application
                        </SelectItem>
                        <SelectItem value="General Support System" data-testid="option-edit-general-support-system">
                          General Support System
                        </SelectItem>
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
                    <FormLabel data-testid="label-edit-impact-level">Impact Level *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-impact-level">
                          <SelectValue placeholder="Select impact level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Low" data-testid="option-edit-impact-low">
                          Low Impact
                        </SelectItem>
                        <SelectItem value="Moderate" data-testid="option-edit-impact-moderate">
                          Moderate Impact
                        </SelectItem>
                        <SelectItem value="High" data-testid="option-edit-impact-high">
                          High Impact
                        </SelectItem>
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
                    <FormLabel data-testid="label-edit-compliance-status">Compliance Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-compliance-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="not-assessed" data-testid="option-edit-not-assessed">
                          Not Assessed
                        </SelectItem>
                        <SelectItem value="in-progress" data-testid="option-edit-in-progress">
                          In Progress
                        </SelectItem>
                        <SelectItem value="compliant" data-testid="option-edit-compliant">
                          Compliant
                        </SelectItem>
                        <SelectItem value="non-compliant" data-testid="option-edit-non-compliant">
                          Non-Compliant
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={updateSystemMutation.isPending}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateSystemMutation.isPending}
                data-testid="button-save-system"
              >
                {updateSystemMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}