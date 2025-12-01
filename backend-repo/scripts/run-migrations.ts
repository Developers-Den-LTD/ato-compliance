import '../env';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { pool } from '../db';

export async function runMigrations() {
  
  try {
    console.log('🔄 Running database migrations...');
    
    // Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get migration files
    const migrationsDir = join(process.cwd(), 'migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .filter(f => !f.includes('_ancient') && !f.includes('_complete_initialization'))
      .sort();
    
    console.log(`Found ${migrationFiles.length} migration files`);
    
    for (const file of migrationFiles) {
      // Check if migration was already applied
      const result = await pool.query(
        'SELECT id FROM migrations WHERE id = $1',
        [file]
      );
      
      if (result.rows.length > 0) {
        console.log(`✓ Migration ${file} already applied`);
        continue;
      }
      
      console.log(`📝 Applying migration: ${file}`);
      
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      const statements = sql.split('--> statement-breakpoint');
      
      // Run each statement
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await pool.query(statement);
          } catch (err: any) {
            // Ignore certain errors
            if (err.code === '42P07') { // relation already exists
              console.log(`  ⚠️  Table already exists, continuing...`);
            } else if (err.code === '42701') { // column already exists
              console.log(`  ⚠️  Column already exists, continuing...`);
            } else if (err.code === '42710') { // duplicate_object (constraint already exists)
              console.log(`  ⚠️  Constraint already exists, continuing...`);
            } else {
              throw err;
            }
          }
        }
      }
      
      // Mark migration as applied
      await pool.query(
        'INSERT INTO migrations (id) VALUES ($1)',
        [file]
      );
      
      console.log(`✅ Migration ${file} applied successfully`);
    }
    
    console.log('✅ All migrations completed');
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
  // Note: Pool is shared, do not close it here
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations().catch(console.error);
}