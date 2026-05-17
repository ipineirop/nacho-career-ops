/**
 * One-time migration: imports applications.md and pipeline.md from GitHub into Postgres.
 * Run with: npx tsx lib/db/migrate.ts
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { applications, jobs } from './schema';
import { Octokit } from '@octokit/rest';

const OWNER = process.env.GITHUB_OWNER!;
const REPO = process.env.GITHUB_REPO!;
const TOKEN = process.env.GITHUB_TOKEN!;

async function fetchFile(path: string): Promise<string> {
  const octokit = new Octokit({ auth: TOKEN });
  const res = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path });
  const data = res.data as { content: string };
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

function parseApplicationsMd(raw: string) {
  const rows = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed.split('|').map((c) => c.trim());
    const idCell = cells[1];
    if (!idCell || idCell === '#' || idCell.startsWith('-')) continue;
    const id = parseInt(idCell, 10);
    if (isNaN(id)) continue;
    const score = cells[5] ?? '';
    const scoreNum = parseFloat(score.split('/')[0]) || 0;
    const reportMatch = (cells[8] ?? '').match(/\[(\d+)\]/);
    rows.push({
      id,
      date: cells[2] ?? '',
      company: cells[3] ?? '',
      role: cells[4] ?? '',
      score,
      scoreNum,
      status: cells[6] ?? 'Evaluated',
      hasPdf: (cells[7] ?? '').includes('✅'),
      reportId: reportMatch ? reportMatch[1] : null,
      notes: cells[9] ?? '',
    });
  }
  return rows;
}

function parsePipelineMd(raw: string) {
  const rows = [];
  const PENDING_RE = /^- \[ \] (https?:\/\/\S+)(?: \| (.+?) \| (.+?))?$/;
  const EVAL_RE = /^- \[x\] #(\d+) \| (https?:\/\/\S+) \| (.+?) \| (.+?) \| ([\d.]+\/5)/;

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    const evalMatch = trimmed.match(EVAL_RE);
    if (evalMatch) {
      rows.push({ url: evalMatch[2], company: evalMatch[3], role: evalMatch[4], status: 'evaluated' as const });
      continue;
    }
    const pendingMatch = trimmed.match(PENDING_RE);
    if (pendingMatch) {
      rows.push({ url: pendingMatch[1], company: pendingMatch[2] ?? '', role: pendingMatch[3] ?? '', status: 'pending' as const });
    }
  }
  return rows;
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema: { applications, jobs } });

  console.log('Fetching data from GitHub...');
  const [appsMd, pipelineMd] = await Promise.all([
    fetchFile('data/applications.md'),
    fetchFile('data/pipeline.md'),
  ]);

  const appRows = parseApplicationsMd(appsMd);
  const jobRows = parsePipelineMd(pipelineMd);

  console.log(`Migrating ${appRows.length} applications...`);
  if (appRows.length > 0) {
    await db.insert(applications).values(appRows).onConflictDoNothing();
  }

  console.log(`Migrating ${jobRows.length} pipeline jobs...`);
  const today = new Date().toISOString().split('T')[0];
  if (jobRows.length > 0) {
    await db.insert(jobs).values(
      jobRows.map((j) => ({ ...j, firstSeen: today }))
    ).onConflictDoNothing();
  }

  console.log('✓ Migration complete.');
}

main().catch(console.error);
