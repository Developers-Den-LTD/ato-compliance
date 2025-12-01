import { db } from '../db';
import { users } from '@shared/schema'; // Use basic users table
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

/**
 * Seeds the database with a default admin user
 */
async function seedAdmin() {
  console.log('🌱 Seeding default admin user...');

  try {
    // Check if admin already exists
    const existingAdmin = await db
      .select({
        id: users.id,
        username: users.username
      })
      .from(users)
      .where(eq(users.username, 'admin'))
      .limit(1);

    if (existingAdmin.length > 0) {
      console.log('✅ Admin user already exists');
      return;
    }

    // Create admin user  
    const passwordHash = await bcrypt.hash('admin123', 12);

    const [adminUser] = await db.insert(users).values({
      username: 'admin',
      passwordHash
    }).returning();

    console.log('✅ Created admin user:', adminUser.id);

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