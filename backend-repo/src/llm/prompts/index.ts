// Prompt Templates Index - ATO Document Generation
// Centralized access to all prompt templates for LLM-powered compliance documentation

import type { PromptTemplate } from './base-templates';
import { BASE_SYSTEM_PROMPTS, COMMON_VARIABLES } from './base-templates';

// STIG Checklist Templates
import { 
  STIG_CHECKLIST_TEMPLATE, 
  STIG_BATCH_CHECKLIST_TEMPLATE 
} from './stig-checklist';

// Joint SIG Checklist Templates
import { 
  JSIG_CHECKLIST_TEMPLATE, 
  JSIG_BATCH_CHECKLIST_TEMPLATE 
} from './jsig-checklist';

// Security Assessment Report Templates
import { 
  SAR_CONTROL_NARRATIVE_TEMPLATE 
} from './sar-generation';

// Plan of Action & Milestones Templates
import { 
  POAM_ITEM_TEMPLATE 
} from './poam-generation';

// Control Implementation Narratives
import { 
  CONTROL_IMPLEMENTATION_TEMPLATE 
} from './control-narratives';

// Re-export types and base templates
export type { PromptTemplate } from './base-templates';
export { BASE_SYSTEM_PROMPTS, COMMON_VARIABLES };

// Re-export individual templates
export { 
  STIG_CHECKLIST_TEMPLATE, 
  STIG_BATCH_CHECKLIST_TEMPLATE,
  JSIG_CHECKLIST_TEMPLATE, 
  JSIG_BATCH_CHECKLIST_TEMPLATE,
  SAR_CONTROL_NARRATIVE_TEMPLATE,
  POAM_ITEM_TEMPLATE,
  CONTROL_IMPLEMENTATION_TEMPLATE
};

// Template Registry for Dynamic Access
export const TEMPLATE_REGISTRY = {
  // STIG Checklists
  'stig_checklist': STIG_CHECKLIST_TEMPLATE,
  'stig_batch_checklist': STIG_BATCH_CHECKLIST_TEMPLATE,
  
  // Joint SIG Checklists
  'jsig_checklist': JSIG_CHECKLIST_TEMPLATE,
  'jsig_batch_checklist': JSIG_BATCH_CHECKLIST_TEMPLATE,
  
  // SAR Generation
  'sar_control_narrative': SAR_CONTROL_NARRATIVE_TEMPLATE,
  
  // POA&M Generation
  'poam_item': POAM_ITEM_TEMPLATE,
  
  // Control Narratives
  'control_implementation': CONTROL_IMPLEMENTATION_TEMPLATE,
} as const;

export type TemplateType = keyof typeof TEMPLATE_REGISTRY;

// Template Categories for Organization
export const TEMPLATE_CATEGORIES = {
  stig: ['stig_checklist', 'stig_batch_checklist'],
  jsig: ['jsig_checklist', 'jsig_batch_checklist'],
  sar: ['sar_control_narrative'],
  poam: ['poam_item'],
  controls: ['control_implementation'],
} as const;

// Utility Functions
export function getTemplate(templateName: TemplateType): PromptTemplate {
  const template = TEMPLATE_REGISTRY[templateName];
  if (!template) {
    throw new Error(`Template '${templateName}' not found`);
  }
  return template;
}

export function getTemplatesByCategory(category: keyof typeof TEMPLATE_CATEGORIES): PromptTemplate[] {
  const templateNames = TEMPLATE_CATEGORIES[category];
  return templateNames.map(name => TEMPLATE_REGISTRY[name]);
}

export function getAllTemplateNames(): TemplateType[] {
  return Object.keys(TEMPLATE_REGISTRY) as TemplateType[];
}

export function validateTemplateVariables(templateName: TemplateType, variables: Record<string, any>): string[] {
  const template = getTemplate(templateName);
  const missing: string[] = [];
  
  for (const required of template.requiredVariables) {
    if (!(required in variables) || variables[required] === undefined || variables[required] === null) {
      missing.push(required);
    }
  }
  
  return missing;
}
