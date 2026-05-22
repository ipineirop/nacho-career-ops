import { getDb, settings } from '@/lib/db';
import { eq } from 'drizzle-orm';

// Key/value settings, stored on Supabase (single source of truth). Per-user
// keys are conventionally `${email}:${name}`. This replaces the old raw
// neon() access against the deprecated Neon database.

export async function getSetting(key: string): Promise<string | null> {
  const db = getDb();
  const rows = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = getDb();
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export async function deleteSetting(key: string): Promise<void> {
  const db = getDb();
  await db.delete(settings).where(eq(settings.key, key));
}

export const userKey = (email: string, name: string) => `${email}:${name}`;
