import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import path from 'path';

config({ path: path.resolve(__dirname, '../.env.local') });

async function testSupabaseConnection() {
  const connectionString = process.env.SUPABASE_POSTGRES_URL_NON_POOLING;

  if (!connectionString) {
    console.error('❌ SUPABASE_POSTGRES_URL_NON_POOLING is not set');
    process.exit(1);
  }

  try {
    console.log('🔗 Connecting to Supabase...');
    const client = postgres(connectionString);
    const db = drizzle(client);

    console.log('📡 Running SELECT version()...');
    const result = await db.execute(sql`SELECT version()`);

    console.log('✅ Connection successful!');
    console.log('Version:', result[0]);

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error);
    process.exit(1);
  }
}

testSupabaseConnection();
