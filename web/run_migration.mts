import 'dotenv/config';
import postgres from 'postgres';
import { readFileSync } from 'fs';

console.log('Env URL:', process.env.SUPABASE_POSTGRES_URL_NON_POOLING?.substring(0, 50));

(async () => {
  const sql = postgres(process.env.SUPABASE_POSTGRES_URL_NON_POOLING!);

  const migrationSQL = readFileSync('./lib/db/migrations/0001_dry_night_thrasher.sql', 'utf-8');
  const statements = migrationSQL.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);

  for (const stmt of statements) {
    console.log('Running SQL...');
    await sql.unsafe(stmt);
  }

  console.log('✓ Migration complete');
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
