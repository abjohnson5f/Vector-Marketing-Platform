import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const sql = neon(process.env.DATABASE_URL);

const migration = readFileSync('./drizzle/0000_mushy_morg.sql', 'utf-8');

// Split by statement breakpoint and execute each statement
const statements = migration.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);

console.log(`Running ${statements.length} statements...`);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  try {
    await sql(stmt);
    console.log(`✓ Statement ${i + 1}/${statements.length} executed`);
  } catch (err) {
    // Ignore "already exists" errors
    if (err.message.includes('already exists')) {
      console.log(`⊘ Statement ${i + 1}/${statements.length} skipped (already exists)`);
    } else {
      console.error(`✗ Statement ${i + 1} failed:`, err.message);
    }
  }
}

console.log('\n✓ Migration complete!');

