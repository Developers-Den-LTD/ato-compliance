import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { users } from '@ato-compliance/shared';
import * as dotenv from 'dotenv';

dotenv.config();

async function updateAdminRole() {
  try {
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.username, 'admin'));

    const [admin] = await db
      .select()
      .from(users)
      .where(eq(users.username, 'admin'));

    if (admin) {
      console.log('✅ Admin user updated successfully!');
      console.log('Username:', admin.username);
      console.log('Role:', admin.role);
    } else {
      console.log('❌ Admin user not found');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to update admin role:', error);
    process.exit(1);
  }
}

updateAdminRole();
