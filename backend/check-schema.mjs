import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const cols = await sql`
  SELECT table_name, column_name, data_type 
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name IN ('daily_stats', 'campaigns', 'integrations', 'sync_jobs')
  ORDER BY table_name, ordinal_position
`;

let currentTable = '';
for (const c of cols) {
  if (c.table_name !== currentTable) {
    currentTable = c.table_name;
    console.log(`\n${currentTable}:`);
  }
  console.log(`  - ${c.column_name} (${c.data_type})`);
}

