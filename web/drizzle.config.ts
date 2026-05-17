import type { Config } from 'drizzle-kit';

const isSupabase = process.env.MIGRATION_TARGET === 'supabase';
const dbUrl = isSupabase
  ? process.env.SUPABASE_POSTGRES_URL_NON_POOLING
  : process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: dbUrl!,
  },
} satisfies Config;
