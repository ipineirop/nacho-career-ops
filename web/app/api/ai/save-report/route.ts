import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createFile } from '@/lib/github';
import { getSql } from '@/lib/db';

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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 });

  const today = new Date().toISOString().split('T')[0];
  const { score, scoreNum } = extractScore(content);
  const company = extractCompany(content);
  const role = extractRole(content);

  const sql = getSql();

  let appId: number;
  try {
    const rows = await sql`
      INSERT INTO applications (date, company, role, score, score_num, status, has_pdf, notes)
      VALUES (${today}, ${company}, ${role}, ${score}, ${scoreNum}, 'Evaluated', false, '')
      RETURNING id
    `;
    appId = rows[0].id;
  } catch (err) {
    console.error('[save-report] DB insert error:', JSON.stringify(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  const reportId = String(appId).padStart(3, '0');
  const companySlug = slugify(company);
  const filename = `reports/${reportId}-${companySlug}-${today}.md`;

  try {
    await sql`UPDATE applications SET report_id = ${reportId} WHERE id = ${appId}`;
  } catch (err) {
    console.error('[save-report] DB update error:', err);
  }

  const header = `# Evaluación: ${company}${role ? ` — ${role}` : ''}\n\n**Fecha:** ${today}  \n**Score:** ${score}  \n**URL:** (pasted JD)  \n**PDF:** ❌  \n\n---\n\n`;
  try {
    await createFile(filename, header + content, `report: ${reportId}-${companySlug}-${today}`);
  } catch (err) {
    console.error('[save-report] GitHub save error:', err);
  }

  return NextResponse.json({ reportId, filename, applicationId: appId });
}
