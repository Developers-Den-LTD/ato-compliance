import '../env'; // Load environment variables
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

async function seedAdmin() {
  console.log('🌱 Seeding default admin user...');
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Check if admin already exists
    const existingResult = await pool.query(
      'SELECT id, username FROM users WHERE username = $1',
      ['admin']
    );
    
    if (existingResult.rows.length > 0) {
      console.log('✅ Admin user already exists');
      return;
    }
    
    // Create admin user  
    const passwordHash = await bcrypt.hash('admin123', 12);
    
    const insertResult = await pool.query(
      'INSERT INTO users (id, username, password_hash) VALUES (gen_random_uuid(), $1, $2) RETURNING id',
      ['admin', passwordHash]
    );
    
    console.log('✅ Created admin user:', insertResult.rows[0].id);
    
    // Note: Role and permission tables don't exist in basic schema
    console.log('⚠️  Note: Roles and permissions are not configured in the basic schema');
    
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Admin user created successfully!

Username: admin
Password: admin123

Please change the password after first login.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    
  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the seed script
if (import.meta.url === `file://${process.argv[1]}`) {
  seedAdmin()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedAdmin };