import { db } from '../db';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runTemplateMigration() {
  try {
    console.log('🔄 Running template migration...');
    
    const migrationPath = join(process.cwd(), 'migrations', '0006_add_template_storage_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`📝 Executing: ${statement.substring(0, 50)}...`);
        await db.execute(statement);
      }
    }
    
    console.log('✅ Template migration completed successfully');
  } catch (error) {
    console.error('❌ Template migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runTemplateMigration();
