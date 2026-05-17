import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/require-auth';
import { loadPromptFiles, loadModeFile, streamClaude } from '@/lib/ai/stream';
import { neon } from '@neondatabase/serverless';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function fetchJdFromUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; career-ops/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000);
  } catch {
    return '';
  }
}

function extractScore(text: string): { score: string; scoreNum: number } {
  const match =
    text.match(/Global[^\n]{0,60}?(\d+\.?\d*)\s*\/\s*5/i) ||
    text.match(/(\d+\.?\d*)\s*\/\s*5[^\n]{0,30}Global/i) ||
    text.match(/\*\*(\d+\.?\d*)\s*\/\s*5\*\*/);
  if (match) {
    const num = parseFloat(match[1]);
    if (num >= 1 && num <= 5) return { score: `${num}/5`, scoreNum: num };
  }
  return { score: '', scoreNum: 0 };
}

function extractCompany(text: string): string {
  const match =
    text.match(/Evaluaci[oó]n:\s*([^—\n\r]+)/i) ||
    text.match(/Evaluation:\s*([^—\n\r]+)/i);
  if (match) return match[1].trim().replace(/\*+/g, '').slice(0, 50);
  return 'Unknown';
}

function extractRole(text: string): string {
  const match =
    text.match(/Evaluaci[oó]n:[^—]+—\s*([^\n\r]+)/i) ||
    text.match(/Evaluation:[^—]+—\s*([^\n\r]+)/i);
  if (match) return match[1].trim().replace(/\*+/g, '').slice(0, 100);
  return '';
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

async function getNextReportId(): Promise<string> {
  const dbUrl = (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!)
    .replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
  try {
    const sql = neon(dbUrl);
    const rows = await sql`SELECT MAX(CAST(NULLIF(REGEXP_REPLACE(report_id, '[^0-9]', '', 'g'), '') AS INTEGER)) as max_id FROM applications`;
    const max = rows[0]?.max_id ?? 0;
    return String(max + 1).padStart(3, '0');
  } catch { return '001'; }
}

async function saveReport(fullText: string, userEmail: string): Promise<{ reportId: string; appId: number } | null> {
  const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!dbUrl) { console.error('DATABASE_URL not set'); return null; }

  const cleanUrl = dbUrl.replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');

  const today = new Date().toISOString().split('T')[0];
  const { score, scoreNum } = extractScore(fullText);
  const company = extractCompany(fullText);
  const role = extractRole(fullText);

  try {
    const reportId = await getNextReportId();
    const header = `# Evaluación: ${company}${role ? ` — ${role}` : ''}\n\n**Fecha:** ${today}  \n**Score:** ${score}  \n**PDF:** ❌  \n\n---\n\n`;
    const fullContent = header + fullText;

    const sql = neon(cleanUrl);
    const rows = await sql`
      INSERT INTO applications (user_email, date, company, role, score, score_num, status, has_pdf, report_id, report_content, notes)
      VALUES (${userEmail}, ${today}, ${company}, ${role}, ${score}, ${scoreNum}, 'Evaluated', false, ${reportId}, ${fullContent}, '')
      RETURNING id
    `;
    const appId: number = rows[0].id;
    console.log(`[evaluate] Saved report ${reportId} (db id ${appId}) for ${company} [${userEmail}]`);
    return { reportId, appId };
  } catch (err: unknown) {
    const e = err as { message?: string; code?: string };
    console.error('[evaluate] Save failed:', e?.message ?? String(err), '| code:', e?.code);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { jd } = await req.json();
  if (!jd?.trim()) return new Response('JD text required', { status: 400 });

  let jdContent = jd.trim();
  const urlMatch = jdContent.match(/^https?:\/\/\S+$/);
  if (urlMatch) {
    const fetched = await fetchJdFromUrl(jdContent);
    jdContent = fetched || `URL: ${jdContent}\n(Could not fetch — paste the JD text directly)`;
  }

  const dbUrl = (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!)
    .replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');

  const [[{ shared, profile, cv }, oferta], prefsRows] = await Promise.all([
    Promise.all([loadPromptFiles(user.email), Promise.resolve(loadModeFile('oferta'))]),
    neon(dbUrl)`SELECT value FROM settings WHERE key = ${user.email + ':leadme_preferences'} LIMIT 1`.catch(() => []),
  ]);

  let prefsBlock = '';
  if (prefsRows[0]?.value) {
    try {
      const p = JSON.parse(prefsRows[0].value as string);
      const gate = p.mode === 'need' ? 65 : p.mode === 'open' ? 85 : 75;
      const floor = p.currency === 'USD'
        ? `USD $${Math.round(p.floorSalaryMXN / 20000)}k`
        : `MXN $${(p.floorSalaryMXN / 1_000_000).toFixed(1)}M`;
      const stretch = p.currency === 'USD'
        ? `USD $${Math.round(p.baseSalaryStretch / 20000)}k`
        : `MXN $${(p.baseSalaryStretch / 1_000_000).toFixed(1)}M`;
      prefsBlock = `
# LeadMe User Preferences (from onboarding)
Mode: ${p.mode} → minimum score gate: ${gate}/100 (below this = recommend against)
Target scope: ${[...(p.levels ?? []), ...(p.functions ?? [])].join(', ') || 'Director / VP level operations'}
Geography: ${(p.geographies ?? []).join(', ') || 'CDMX / Remote LatAm'}
Walk-away floor: ${floor} base (never recommend below this)
Total comp target: ${floor}–${stretch} base${p.bonusPct ? ` + ${p.bonusPct}% bonus` : ''}${p.equityPct ? ` + ${p.equityPct}% equity` : ''}
What they're optimizing for: "${p.humanAnswer || 'not specified'}"
`;
    } catch { /* malformed prefs — skip */ }
  }

  const system = `# IMPORTANT — API CONTEXT
You are running via the Anthropic API, NOT Claude Code.
You have NO tools. Do NOT output tool calls or <tool_call> blocks.
All files are pre-loaded below. Do NOT attempt to read files or browse URLs.
Do NOT output any "Post-evaluación" section, TSV entries, or file save instructions.
End the evaluation after the Score Global block and keyword list.

---

# System Context & Scoring Rules
${shared}
${prefsBlock ? `\n---\n${prefsBlock}` : ''}
---

# User Profile & Archetypes
${profile}

---

# Candidate CV
${cv}

---

# Evaluation Protocol
${oferta}`;

  const claudeStream = streamClaude(system, `Evaluate this job offer:\n\n${jdContent}`);

  // Tap the stream: collect full text while piping to client
  const encoder = new TextEncoder();
  let fullText = '';

  const outputStream = new ReadableStream({
    async start(controller) {
      const reader = claudeStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = new TextDecoder().decode(value);
          fullText += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } finally {
        // Race save against 15s timeout — always close the stream
        const timeout = new Promise<null>((r) => setTimeout(() => r(null), 15000));
        await Promise.race([saveReport(fullText, user.email), timeout]).catch(console.error);
        controller.close();
      }
    },
  });

  return new Response(outputStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
