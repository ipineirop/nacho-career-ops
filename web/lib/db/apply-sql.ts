/**
 * One-off SQL applier — reads a migration file and runs it through the
 * shared postgres-js client. Used to apply hand-written migrations
 * (0004+) that drizzle-kit can't generate because the meta snapshots are
 * stale (see comment in 0011_evaluate_processing.sql).
 *
 * Usage:
 *   npx tsx lib/db/apply-sql.ts lib/db/migrations/0013_brief_tables.sql
 *
 * The file is split on `;` at statement boundaries and run sequentially.
 * Migrations are expected to be idempotent (`IF NOT EXISTS` everywhere)
 * so re-running is safe.
 */

// Load .env.local first (Next.js convention), then fall back to .env.
// dotenv doesn't load .env.local by default — only Next does — so this
// script needs to do it explicitly.
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getSql } from './index';

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: tsx lib/db/apply-sql.ts <path-to-sql>');
    process.exit(2);
  }
  const filePath = resolve(process.cwd(), arg);
  const raw = await readFile(filePath, 'utf-8');

  // Split on `;` outside dollar-quoted strings. For 0013 (plain DDL) the
  // naive split is fine. If we ever need plpgsql DO blocks, swap to a
  // proper parser. Strip leading `--` comment lines before deciding
  // whether a chunk is empty, so a comment block prefixing a real
  // statement doesn't cause us to drop the statement.
  const statements = raw
    .split(/;\s*\n/)
    .map((s) =>
      s
        .split('\n')
        .filter((l) => !l.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((s) => s.length > 0);

  const sql = getSql();
  console.log(`Applying ${statements.length} statements from ${filePath}…`);
  for (const [i, stmt] of statements.entries()) {
    try {
      await sql.unsafe(stmt);
      console.log(`  ✓ [${i + 1}/${statements.length}] ${firstLine(stmt)}`);
    } catch (err) {
      console.error(`  ✗ [${i + 1}/${statements.length}] ${firstLine(stmt)}`);
      console.error(`    ${(err as Error).message}`);
      process.exit(1);
    }
  }
  await sql.end();
  console.log('Done.');
}

function firstLine(stmt: string): string {
  const line = stmt.split('\n').find((l) => l.trim() && !l.trim().startsWith('--')) ?? stmt;
  return line.length > 70 ? line.slice(0, 67) + '...' : line;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
