import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not found in environment, using fallback');
}
else{
  console.log("DB URL FOUND", process.env.DATABASE_URL)
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://ato_user:ato_password@localhost:5432/ato_compliance',
  },
  verbose: true,
  strict: true,
});
