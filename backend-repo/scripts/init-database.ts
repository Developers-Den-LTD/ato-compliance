#!/usr/bin/env node
import '../env'; // Load environment variables
import { runMigrations } from './run-migrations';
import { importFullNISTControls } from '../data/import-full-nist-controls';
import { importFedRAMPControls, createFedRAMPMappings } from '../data/import-fedramp-controls';
import { seedMappingData } from '../data/seed-mapping';
import { initializeTemplates } from './init-templates';
import { initializeStigMappings } from './init-stig-mappings';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { Pool } from 'pg';

async function seedAdminUser() {
  try {
    console.log('🌱 Seeding admin user...');

    // Check if admin already exists
    const existingResult = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      ['admin']
    );

    if (existingResult.rows.length > 0) {
      console.log('✅ Admin user already exists');
      return;
    }

    // Create admin user
    const passwordHash = await bcrypt.hash('admin123', 12);

    await pool.query(
      'INSERT INTO users (id, username, password_hash) VALUES (gen_random_uuid(), $1, $2)',
      ['admin', passwordHash]
    );

    console.log('✅ Admin user created (username: admin, password: admin123)');
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    throw error;
  }
}

async function ensureRequiredColumns() {
  
  try {
    console.log('🔧 Ensuring all required columns exist...');
    
    // Add missing columns to controls table
    await pool.query(`ALTER TABLE controls ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'P2'`);
    await pool.query(`ALTER TABLE controls ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'not_implemented'`);
    
    // Add missing columns to generation_jobs
    await pool.query(`ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS document_types TEXT[]`);
    await pool.query(`ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS current_step TEXT`);
    await pool.query(`ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS step_data JSONB`);
    await pool.query(`ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS request_data JSONB`);
    await pool.query(`ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS metadata JSONB`);
    
    // Add missing columns to stig_rules
    await pool.query(`ALTER TABLE stig_rules ADD COLUMN IF NOT EXISTS stig_title TEXT`);
    await pool.query(`ALTER TABLE stig_rules ADD COLUMN IF NOT EXISTS version TEXT`);
    await pool.query(`ALTER TABLE stig_rules ADD COLUMN IF NOT EXISTS rule_title TEXT`);
    await pool.query(`ALTER TABLE stig_rules ADD COLUMN IF NOT EXISTS check_text TEXT`);
    await pool.query(`ALTER TABLE stig_rules ADD COLUMN IF NOT EXISTS fix_text TEXT`);
    await pool.query(`ALTER TABLE stig_rules ADD COLUMN IF NOT EXISTS rule_type TEXT NOT NULL DEFAULT 'stig'`);
    
    // Add missing columns to documents
    await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '1.0'`);
    await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS job_id VARCHAR REFERENCES generation_jobs(id)`);
    
    // Add missing columns to findings
    await pool.query(`ALTER TABLE findings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'`);
    
    // Create system_controls table if missing
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_controls (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        system_id VARCHAR REFERENCES systems(id) ON DELETE CASCADE NOT NULL,
        control_id VARCHAR REFERENCES controls(id) ON DELETE CASCADE NOT NULL,
        status TEXT NOT NULL DEFAULT 'not_implemented',
        assigned_to TEXT,
        implementation_text TEXT,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create unique index
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_system_controls 
      ON system_controls(system_id, control_id)
    `);
    
    console.log('✅ All required columns ensured');
  } catch (error) {
    console.error('❌ Error ensuring columns:', error);
    throw error;
  }
}

interface InitOptions {
  skipMigrations?: boolean;
}

function parseArgs(): InitOptions {
  const options: InitOptions = {};
  if (process.argv.includes('--skip-migrations')) {
    options.skipMigrations = true;
  }
  return options;
}

async function initDatabase(options: InitOptions = {}) {
  try {
    console.log('🚀 Initializing ATO Compliance Database...\n');
    
    if (options.skipMigrations) {
      console.log('⏭️  Skipping migrations as requested');
    } else {
      await runMigrations();
    }
    
    // Step 2: Ensure all required columns
    await ensureRequiredColumns();
    
    // Step 3: Import NIST controls
    await importFullNISTControls();
    
    // Step 4: Import FedRAMP controls
    await importFedRAMPControls();
    
    // Step 5: Create FedRAMP mappings
    await createFedRAMPMappings();
    
    // Step 6: Seed STIG mapping data
    await seedMappingData();
    
    // Step 6.1: Initialize STIG-to-NIST control mappings
    await initializeStigMappings();
    
    // Step 7: Initialize default templates
    await initializeTemplates();
    
    // Step 8: Seed admin user
    await seedAdminUser();
    
    console.log('\nDatabase Summary:');
    const summary = await getDatabaseSummary(pool);
    for (const line of summary.lines) {
      console.log(`- ${line}`);
    }

    if (summary.failures.length > 0) {
      console.error('\n❌ Seed validation failures detected:', summary.failures.join(', '));
      process.exitCode = 1;
    }
    
    console.log('\n✅ Database initialization completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 Default admin credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error);
    process.exit(1);
  }
}

async function getDatabaseSummary(pool: Pool) {
  const client = await pool.connect();
  try {
    const checks = [
      { name: 'NIST Controls', query: 'SELECT COUNT(*) AS count FROM controls', min: 1 },
      { name: 'STIG/JSIG Rules', query: 'SELECT COUNT(*) AS count FROM stig_rules', min: 1 },
      { name: 'CCIs', query: 'SELECT COUNT(*) AS count FROM ccis', min: 1 },
      { name: 'Control Mappings', query: 'SELECT COUNT(*) AS count FROM stig_rule_controls', min: 1 },
      { name: 'CCI Mappings', query: 'SELECT COUNT(*) AS count FROM stig_rule_ccis', min: 1 },
    ];

    const lines: string[] = [];
    const failures: string[] = [];
    for (const check of checks) {
      const result = await client.query(check.query);
      const count = Number(result.rows[0]?.count ?? 0);
      lines.push(`${check.name}: ${count}`);
      if (count < check.min) {
        failures.push(`${check.name} < ${check.min}`);
      }
    }

    return { lines, failures };
  } finally {
    client.release();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs();
  initDatabase(options);
}