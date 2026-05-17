import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export type DbType = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbType | null = null;

export function getDb(): DbType {
  if (_db) return _db;
  const url = process.env.SUPABASE_POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('SUPABASE_POSTGRES_URL or DATABASE_URL is not set');
  const client = postgres(url, { max: 1 });
  _db = drizzle(client, { schema });
  return _db;
}

// Named exports for convenience — call getDb() at runtime, not module load time
export { schema };
export * from './schema';
