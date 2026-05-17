/**
 * One-time: imports existing GitHub report files into the DB report_content column.
 * Run with: DATABASE_URL=... npx tsx lib/db/migrate-reports.ts
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { Octokit } from '@octokit/rest';

const owner = process.env.GITHUB_OWNER!;
const repo = process.env.GITHUB_REPO!;
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const url = (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!)
  .replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
const sql = neon(url);

async function fetchFile(path: string): Promise<string> {
  const res = await octokit.repos.getContent({ owner, repo, path });
  const data = res.data as { content: string };
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

async function listDir(path: string): Promise<{ name: string; path: string }[]> {
  const res = await octokit.repos.getContent({ owner, repo, path });
  const data = res.data as { name: string; path: string; type: string }[];
  return data.filter((f) => f.type === 'file').map((f) => ({ name: f.name, path: f.path }));
}

async function main() {
  const files = await listDir('reports');
  const reportFiles = files.filter((f) => /^\d{3}-.+\.md$/.test(f.name));
  console.log(`Found ${reportFiles.length} report files in GitHub`);

  for (const file of reportFiles) {
    const idMatch = file.name.match(/^(\d{3})/);
    if (!idMatch) continue;
    const reportId = idMatch[1];

    try {
      const content = await fetchFile(file.path);
      const result = await sql`
        UPDATE applications SET report_content = ${content}
        WHERE report_id = ${reportId} OR report_id = ${String(parseInt(reportId))}
        RETURNING id, company
      `;
      if (result.length > 0) {
        console.log(`✓ ${reportId} → ${result[0].company} (db id ${result[0].id})`);
      } else {
        console.log(`⚠ ${reportId} — no matching DB row (GitHub-only report)`);
      }
    } catch (err) {
      console.error(`✗ ${reportId}:`, (err as Error).message);
    }
  }
  console.log('Done.');
}

main().catch(console.error);
