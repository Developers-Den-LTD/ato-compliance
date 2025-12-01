import { db } from '../db';

async function createTemplateTables() {
  try {
    console.log('🔄 Creating template tables...');
    
    // Add template_id column to documents table
    console.log('📝 Adding template_id column to documents table...');
    await db.execute(`
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "template_id" varchar;
    `);
    
    // Create templates table
    console.log('📝 Creating templates table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "templates" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "type" text NOT NULL,
        "status" text DEFAULT 'active' NOT NULL,
        "organization_id" varchar,
        "created_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "metadata" jsonb,
        "tags" jsonb,
        "is_public" boolean DEFAULT false NOT NULL,
        "size_bytes" integer DEFAULT 0 NOT NULL,
        "checksum" text
      );
    `);
    
    // Create template_versions table
    console.log('📝 Creating template_versions table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "template_versions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "template_id" varchar NOT NULL,
        "version" integer NOT NULL,
        "file_path" text NOT NULL,
        "file_name" text NOT NULL,
        "mime_type" text NOT NULL,
        "size_bytes" integer NOT NULL,
        "checksum" text NOT NULL,
        "change_log" text,
        "created_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "is_active" boolean DEFAULT false NOT NULL
      );
    `);
    
    // Create template_mappings table
    console.log('📝 Creating template_mappings table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "template_mappings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "template_id" varchar NOT NULL,
        "system_id" varchar,
        "document_type" text NOT NULL,
        "is_default" boolean DEFAULT false NOT NULL,
        "priority" integer DEFAULT 0 NOT NULL,
        "conditions" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "created_by" varchar NOT NULL
      );
    `);
    
    // Add foreign key constraints
    console.log('📝 Adding foreign key constraints...');
    try {
      await db.execute(`
        ALTER TABLE "template_versions" 
        ADD CONSTRAINT "template_versions_template_id_templates_id_fk" 
        FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE cascade;
      `);
    } catch (error) {
      console.log('⚠️ Foreign key constraint already exists or failed to create');
    }
    
    try {
      await db.execute(`
        ALTER TABLE "template_mappings" 
        ADD CONSTRAINT "template_mappings_template_id_templates_id_fk" 
        FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE cascade;
      `);
    } catch (error) {
      console.log('⚠️ Foreign key constraint already exists or failed to create');
    }
    
    try {
      await db.execute(`
        ALTER TABLE "template_mappings" 
        ADD CONSTRAINT "template_mappings_system_id_systems_id_fk" 
        FOREIGN KEY ("system_id") REFERENCES "systems"("id") ON DELETE cascade;
      `);
    } catch (error) {
      console.log('⚠️ Foreign key constraint already exists or failed to create');
    }
    
    try {
      await db.execute(`
        ALTER TABLE "documents" 
        ADD CONSTRAINT "documents_template_id_templates_id_fk" 
        FOREIGN KEY ("template_id") REFERENCES "templates"("id");
      `);
    } catch (error) {
      console.log('⚠️ Foreign key constraint already exists or failed to create');
    }
    
    console.log('✅ Template tables created successfully');
  } catch (error) {
    console.error('❌ Template table creation failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

createTemplateTables();
