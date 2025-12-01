#!/usr/bin/env node
/**
 * ============================================================================
 * AUTHENTICATION SCHEMA MIGRATION SCRIPT
 * ============================================================================
 * This script migrates the database to include the new authentication schema
 * for enterprise-grade authentication and authorization.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as authSchema from '@shared/auth-schema';
import * as existingSchema from '@shared/schema';

// Load environment variables
import './env.js';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

const db = drizzle({ client: pool });

async function migrateAuthSchema() {
  console.log('🚀 Starting authentication schema migration...');

  try {
    // Check if auth tables already exist
    const existingTables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'user_roles', 'role_permissions', 'user_sessions', 'user_mfa', 'api_keys', 'audit_log')
    `);

    if (existingTables.rows.length > 0) {
      console.log('⚠️  Authentication tables already exist. Skipping migration.');
      return;
    }

    // Create authentication tables
    console.log('📋 Creating authentication tables...');

    // Users table (enhanced)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        email TEXT UNIQUE,
        first_name TEXT,
        last_name TEXT,
        display_name TEXT,
        password_hash TEXT,
        salt TEXT,
        is_active BOOLEAN DEFAULT true NOT NULL,
        is_locked BOOLEAN DEFAULT false NOT NULL,
        is_verified BOOLEAN DEFAULT false NOT NULL,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        last_login_at TIMESTAMP,
        password_changed_at TIMESTAMP,
        identity_provider TEXT NOT NULL DEFAULT 'local',
        external_id TEXT,
        preferences JSONB,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity_at TIMESTAMP
      )
    `);

    // Create indexes for users table
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_external_id ON users(external_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_identity_provider ON users(identity_provider)`);

    // User roles table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_roles (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        role TEXT NOT NULL,
        system_id VARCHAR REFERENCES systems(id) ON DELETE CASCADE,
        granted_by VARCHAR REFERENCES users(id),
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true NOT NULL,
        UNIQUE(user_id, role, system_id)
      )
    `);

    // Create indexes for user_roles table
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role)`);

    // Role permissions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        role TEXT NOT NULL,
        permission TEXT NOT NULL,
        resource TEXT,
        conditions JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(role, permission, resource)
      )
    `);

    // User sessions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        session_token TEXT NOT NULL UNIQUE,
        refresh_token TEXT UNIQUE,
        user_agent TEXT,
        ip_address TEXT,
        location TEXT,
        is_active BOOLEAN DEFAULT true NOT NULL,
        last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        refresh_expires_at TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for user_sessions table
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON user_sessions(expires_at)`);

    // User MFA table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_mfa (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        type TEXT NOT NULL,
        secret TEXT NOT NULL,
        backup_codes TEXT[],
        is_enabled BOOLEAN DEFAULT false NOT NULL,
        is_verified BOOLEAN DEFAULT false NOT NULL,
        name TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP,
        verified_at TIMESTAMP
      )
    `);

    // Create indexes for user_mfa table
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_mfa_user_id ON user_mfa(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_mfa_type ON user_mfa(type)`);

    // API keys table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        key_prefix TEXT NOT NULL,
        user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
        created_by VARCHAR REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        permissions TEXT[] NOT NULL,
        systems TEXT[],
        is_active BOOLEAN DEFAULT true NOT NULL,
        last_used_at TIMESTAMP,
        expires_at TIMESTAMP,
        description TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for api_keys table
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix)`);

    // Audit log table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_log (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type TEXT NOT NULL,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        resource_id TEXT,
        user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        session_id VARCHAR REFERENCES user_sessions(id) ON DELETE SET NULL,
        ip_address TEXT,
        user_agent TEXT,
        request_id TEXT,
        success BOOLEAN NOT NULL,
        error_code TEXT,
        error_message TEXT,
        old_values JSONB,
        new_values JSONB,
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    // Create indexes for audit_log table
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_log(event_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource, resource_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_success ON audit_log(success)`);

    // Identity providers table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS identity_providers (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true NOT NULL,
        config JSONB NOT NULL,
        description TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Security policies table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS security_policies (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        config JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Authentication tables created successfully');

    // Insert default role permissions
    console.log('📋 Inserting default role permissions...');

    const defaultPermissions = [
      // System Admin - All permissions
      { role: 'system_admin', permission: '*', resource: null },
      
      // Compliance Officer permissions
      { role: 'compliance_officer', permission: 'systems:read', resource: null },
      { role: 'compliance_officer', permission: 'systems:write', resource: null },
      { role: 'compliance_officer', permission: 'controls:read', resource: null },
      { role: 'compliance_officer', permission: 'controls:write', resource: null },
      { role: 'compliance_officer', permission: 'controls:assign', resource: null },
      { role: 'compliance_officer', permission: 'assessments:read', resource: null },
      { role: 'compliance_officer', permission: 'assessments:create', resource: null },
      { role: 'compliance_officer', permission: 'assessments:manage', resource: null },
      { role: 'compliance_officer', permission: 'documents:read', resource: null },
      { role: 'compliance_officer', permission: 'documents:generate', resource: null },
      { role: 'compliance_officer', permission: 'documents:export', resource: null },
      { role: 'compliance_officer', permission: 'audit:read', resource: null },
      { role: 'compliance_officer', permission: 'audit:export', resource: null },
      
      // Auditor permissions
      { role: 'auditor', permission: 'systems:read', resource: null },
      { role: 'auditor', permission: 'controls:read', resource: null },
      { role: 'auditor', permission: 'assessments:read', resource: null },
      { role: 'auditor', permission: 'documents:read', resource: null },
      { role: 'auditor', permission: 'audit:read', resource: null },
      { role: 'auditor', permission: 'audit:export', resource: null },
      
      // System Owner permissions
      { role: 'system_owner', permission: 'systems:read', resource: null },
      { role: 'system_owner', permission: 'systems:write', resource: null },
      { role: 'system_owner', permission: 'controls:read', resource: null },
      { role: 'system_owner', permission: 'controls:write', resource: null },
      { role: 'system_owner', permission: 'controls:assign', resource: null },
      { role: 'system_owner', permission: 'assessments:read', resource: null },
      { role: 'system_owner', permission: 'assessments:create', resource: null },
      { role: 'system_owner', permission: 'documents:read', resource: null },
      { role: 'system_owner', permission: 'documents:generate', resource: null },
      
      // Assessor permissions
      { role: 'assessor', permission: 'systems:read', resource: null },
      { role: 'assessor', permission: 'controls:read', resource: null },
      { role: 'assessor', permission: 'controls:write', resource: null },
      { role: 'assessor', permission: 'assessments:read', resource: null },
      { role: 'assessor', permission: 'assessments:create', resource: null },
      { role: 'assessor', permission: 'documents:read', resource: null },
      { role: 'assessor', permission: 'documents:generate', resource: null },
      
      // Viewer permissions
      { role: 'viewer', permission: 'systems:read', resource: null },
      { role: 'viewer', permission: 'controls:read', resource: null },
      { role: 'viewer', permission: 'assessments:read', resource: null },
      { role: 'viewer', permission: 'documents:read', resource: null }
    ];

    for (const perm of defaultPermissions) {
      await db.execute(sql`
        INSERT INTO role_permissions (role, permission, resource)
        VALUES (${perm.role}, ${perm.permission}, ${perm.resource})
        ON CONFLICT (role, permission, resource) DO NOTHING
      `);
    }

    console.log('✅ Default role permissions inserted');

    // Insert default security policies
    console.log('📋 Inserting default security policies...');

    const defaultPolicies = [
      {
        name: 'password_policy',
        type: 'password',
        config: {
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSymbols: true,
          maxAge: 90,
          historyCount: 12
        },
        description: 'Default password policy'
      },
      {
        name: 'session_policy',
        type: 'session',
        config: {
          timeout: 3600,
          refreshThreshold: 300,
          maxConcurrentSessions: 3,
          invalidateOnPasswordChange: true,
          invalidateOnRoleChange: true
        },
        description: 'Default session policy'
      },
      {
        name: 'lockout_policy',
        type: 'lockout',
        config: {
          maxAttempts: 5,
          lockoutDuration: 900,
          resetTime: 300,
          progressiveDelay: true
        },
        description: 'Default account lockout policy'
      }
    ];

    for (const policy of defaultPolicies) {
      await db.execute(sql`
        INSERT INTO security_policies (name, type, config, description)
        VALUES (${policy.name}, ${policy.type}, ${JSON.stringify(policy.config)}, ${policy.description})
        ON CONFLICT (name) DO NOTHING
      `);
    }

    console.log('✅ Default security policies inserted');

    // Create default admin user
    console.log('👤 Creating default admin user...');

    const bcrypt = await import('bcryptjs');
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    await db.execute(sql`
      INSERT INTO users (
        id, username, email, display_name, password_hash, salt,
        is_active, is_verified, identity_provider
      ) VALUES (
        'admin-user-001',
        'admin',
        'admin@company.com',
        'System Administrator',
        ${passwordHash},
        ${salt},
        true,
        true,
        'local'
      ) ON CONFLICT (username) DO NOTHING
    `);

    // Assign system_admin role to admin user
    await db.execute(sql`
      INSERT INTO user_roles (user_id, role, is_active)
      VALUES ('admin-user-001', 'system_admin', true)
      ON CONFLICT (user_id, role, system_id) DO NOTHING
    `);

    console.log('✅ Default admin user created');
    console.log('📧 Admin credentials:');
    console.log('   Username: admin');
    console.log('   Password: ' + adminPassword);
    console.log('   Email: admin@company.com');

    console.log('🎉 Authentication schema migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
migrateAuthSchema().catch(console.error);
