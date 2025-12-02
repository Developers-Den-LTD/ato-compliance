import * as dotenv from 'dotenv';
import { seedMappingData } from '../src/data/seed-mapping';

// Load environment variables
dotenv.config();

async function main() {
  try {
    console.log('🚀 Starting STIG mapping data seed...\n');
    await seedMappingData();
    console.log('\n✨ STIG mappings seeded successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding STIG mappings:', error);
    process.exit(1);
  }
}

main();
