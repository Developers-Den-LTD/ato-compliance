#!/usr/bin/env tsx

import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { storage } from '../storage.js';
import { templateService } from '../services/template-service.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(SCRIPT_DIR, '..', 'templates');

interface DefaultTemplate {
  name: string;
  description: string;
  type: string;
  fileName: string;
  isDefault: boolean;
}

const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: 'Default System Security Plan',
    description: 'Standard SSP template for generating System Security Plans with NIST 800-53 controls',
    type: 'ssp',
    fileName: 'ssp-template.docx',
    isDefault: true
  }
];

async function initializeTemplates() {
  console.log('🚀 Initializing default templates...');

  try {
    // Ensure database connection
    console.log('📊 Checking database connection...');

    for (const templateConfig of DEFAULT_TEMPLATES) {
      console.log(`📄 Processing template: ${templateConfig.name}`);
      
      const templatePath = join(TEMPLATES_DIR, templateConfig.fileName);
      
      // Check if template file exists
      try {
        await fs.access(templatePath);
        console.log(`✅ Template file found: ${templatePath}`);
      } catch (error) {
        console.error(`❌ Template file not found: ${templatePath}`);
        continue;
      }

      // Check if template already exists in database
      const existingTemplates = await storage.getTemplatesByType(templateConfig.type);
      const existingTemplate = existingTemplates.find(t => t.name === templateConfig.name);
      
      if (existingTemplate) {
        console.log(`📋 Template "${templateConfig.name}" already exists in database`);
        continue;
      }

      // Read template file
      const templateBuffer = await fs.readFile(templatePath);
      const stats = await fs.stat(templatePath);
      
      console.log(`📦 Loading template: ${templateConfig.fileName} (${Math.round(stats.size / 1024)}KB)`);

      // Upload template to database
      try {
        const templateInfo = await templateService.uploadTemplate({
          name: templateConfig.name,
          description: templateConfig.description,
          type: templateConfig.type as any,
          createdBy: 'system',
          file: {
            originalName: templateConfig.fileName,
            buffer: templateBuffer,
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            size: stats.size
          },
          tags: ['default', 'system'],
          isPublic: true,
          metadata: {
            isDefault: templateConfig.isDefault,
            createdBy: 'system-initialization',
            source: 'default-templates'
          }
        });

        console.log(`✅ Template uploaded: ${templateInfo.name} (ID: ${templateInfo.id})`);

        // Create default mapping if specified
        if (templateConfig.isDefault) {
          try {
            await templateService.createTemplateMapping(
              templateInfo.id,
              templateConfig.type,
              'system',
              undefined, // systemId
              true, // isDefault
              100, // priority
              { scope: 'global' }
            );
            console.log(`📋 Created default mapping for ${templateConfig.type}`);
          } catch (mappingError) {
            console.warn(`⚠️  Failed to create default mapping: ${mappingError}`);
          }
        }

      } catch (uploadError) {
        console.error(`❌ Failed to upload template ${templateConfig.name}:`, uploadError);
      }
    }

    console.log('🎉 Template initialization completed!');

    // Verify templates are accessible
    console.log('\n🔍 Verifying template accessibility...');
    for (const templateConfig of DEFAULT_TEMPLATES) {
      const templates = await storage.getTemplatesByType(templateConfig.type);
      const foundTemplate = templates.find(t => t.name === templateConfig.name);
      if (foundTemplate) {
        console.log(`✅ ${templateConfig.type} template is accessible (Status: ${foundTemplate.status})`);
      } else {
        console.log(`❌ ${templateConfig.type} template is NOT accessible`);
      }
    }

  } catch (error) {
    console.error('❌ Template initialization failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeTemplates()
    .then(() => {
      console.log('✅ Template initialization script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Template initialization script failed:', error);
      process.exit(1);
    });
}

export { initializeTemplates };