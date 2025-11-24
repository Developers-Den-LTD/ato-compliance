import bcrypt from 'bcrypt';
import { db } from '../src/db';
import { users } from '@ato-compliance/shared';
import * as dotenv from 'dotenv';

dotenv.config();

async function createTestUser() {
  const username = 'admin';
  const password = 'admin123';

  try {
    // Check if user already exists
    const existingUser = await db.select().from(users).where((u) => u.username === username);
    
    if (existingUser.length > 0) {
      console.log('❌ User "admin" already exists');
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const [newUser] = await db.insert(users).values({
      username,
      passwordHash,
    }).returning();

    console.log('✅ Test user created successfully!');
    console.log('');
    console.log('Login credentials:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('');
    console.log('User ID:', newUser.id);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create test user:', error);
    process.exit(1);
  }
}

createTestUser();
