import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export type DbType = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbType | null = null;

export function getDb(): DbType {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  _db = drizzle(neon(url), { schema });
  return _db;
}

// Named exports for convenience — call getDb() at runtime, not module load time
export { schema };
export * from './schema';
