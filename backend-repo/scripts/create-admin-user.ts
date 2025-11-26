import { db } from '../src/db';
import { users } from '../src/schema';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

async function createAdminUser() {
  try {
    const username = 'admin';
    const password = 'admin123';
    
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUser.length > 0) {
      console.log('❌ User "admin" already exists!');
      console.log('User ID:', existingUser[0].id);
      console.log('Username:', existingUser[0].username);
      console.log('Role:', existingUser[0].role);
      process.exit(0);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    const [newUser] = await db
      .insert(users)
      .values({
        username,
        passwordHash,
        role: 'admin',
      })
      .returning();

    console.log('✅ Admin user created successfully!');
    console.log('Username:', username);
    console.log('Password:', password);
    console.log('Role:', newUser.role);
    console.log('\nYou can now login with these credentials.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

createAdminUser();
