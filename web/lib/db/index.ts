import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export type DbType = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbType | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

function supabaseUrl(): string {
  const url = process.env.SUPABASE_POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('SUPABASE_POSTGRES_URL or DATABASE_URL is not set');
  return url;
}

export function getDb(): DbType {
  if (_db) return _db;
  _db = drizzle(postgres(supabaseUrl(), { max: 1 }), { schema });
  return _db;
}

// Cached raw postgres-js client on Supabase, for tagged-template SQL (replaces
// the deprecated Neon `neon()` driver). Single source of truth: Supabase.
export function getSql(): ReturnType<typeof postgres> {
  if (_sql) return _sql;
  _sql = postgres(supabaseUrl(), { max: 1 });
  return _sql;
}

// Named exports for convenience — call getDb() at runtime, not module load time
export { schema };
export * from './schema';
