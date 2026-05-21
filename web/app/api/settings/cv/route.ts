import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export const maxDuration = 300;

const PARSE_PROMPT = `Convert the following CV/resume text into clean, well-structured markdown.

Requirements:
- Start with a ## Summary (2–3 sentences on the candidate's background)
- For each role, use: ### Company · Role (Year–Year) with 3–5 bullet points including metrics
- Preserve ALL numbers, percentages, monetary amounts, and dates exactly as written
- Include ## Education, ## Skills sections
- Keep it factual — don't invent or embellish

After the markdown CV, output a JSON block in this exact format (on its own line, no other text before or after it):
\`\`\`json
{
  "roles": [
    { "company": "Company Name", "role": "Job Title", "years": 2, "current": false, "metrics": ["metric 1", "metric 2"] }
  ],
  "languages": ["Spanish", "English"],
  "trajectory": "IC to Director in 8 years",
  "industries": ["fintech", "marketplaces"],
  "primaryCity": "Mexico City",
  "countryCount": 2,
  "pageCount": 2,
  "format": "PDF",
  "isLinkedInExport": false,
  "outcomeCount": 11,
  "unclearRoles": 1,
  "yearSpan": 14,
  "unsure": [
    { "field": "team size at Company X", "extracted": "12", "confidence": "low" }
  ]
}
\`\`\`

Notes for the JSON fields:
- industries: 1–3 industry/domain labels the candidate has actually worked in, inferred from the companies and role descriptions (e.g. "fintech", "marketplaces", "SaaS", "healthcare", "logistics"). Lowercase, most-recent/most-relevant first. Be specific to THIS candidate — do not default to generic "tech".
- primaryCity: the candidate's current/most-recent city (e.g. "Mexico City", "Santiago", "Bogotá"). Use the most recent role's location or an explicit location/header in the CV. If genuinely unknown, omit the field.
- countryCount: number of distinct countries the candidate has worked in across their roles.
- pageCount: approximate number of pages in the source
- format: "PDF" or "DOCX" or "TEXT"
- isLinkedInExport: true ONLY if the document has clear LinkedIn export markers (e.g., "linkedin.com/in/" URL, LinkedIn-style headers, "Top Skills" section). Otherwise false.
- outcomeCount: total number of quantified outcomes/metrics across all roles
- unclearRoles: number of roles where dates, scope, or outcomes are ambiguous
- yearSpan: total span in years from earliest to latest role

CV text to convert:
`;

export async function POST(req: NextRequest) {
  const user = await getAuthUserId();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { text, base64, filename } = await req.json();
  if (!text?.trim() && !base64?.trim()) return NextResponse.json({ error: 'No content provided' }, { status: 400 });

  // Build message content — PDFs go as a native document block, text as plain string
  const userContent = base64
    ? [
        { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } },
        { type: 'text' as const, text: PARSE_PROMPT.replace('CV text to convert:\n', 'The CV is the PDF above. Apply the same instructions.') },
      ]
    : PARSE_PROMPT + (text as string).slice(0, 20000);

  // Parse CV with Claude
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: userContent }],
  });

  const fullOutput = (message.content[0] as { text: string }).text;

  // Split markdown CV from JSON signals
  const jsonMatch = fullOutput.match(/```json\s*([\s\S]*?)\s*```/);
  const markdownCv = fullOutput.replace(/```json[\s\S]*?```/, '').trim();
  let signals = { roles: [], languages: [], trajectory: '', unsure: [] };
  if (jsonMatch) {
    try { signals = JSON.parse(jsonMatch[1]); } catch { /* keep defaults */ }
  }

  // Dev bypass: no DB available locally — return parsed signals without persisting.
  const dbConfigured = !!(process.env.SUPABASE_POSTGRES_URL || process.env.DATABASE_URL);
  if (!dbConfigured) {
    return NextResponse.json({ ok: true, signals, preview: markdownCv.slice(0, 800) });
  }

  // Save to DB (no GitHub commit — avoids spurious Vercel deploys)
  const { getDb, userProfiles } = await import('@/lib/db');
  const { eq } = await import('drizzle-orm');

  const db = getDb();

  // Create or update user profile with CV data
  const existingProfile = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  if (existingProfile.length > 0) {
    // Update existing profile
    await db
      .update(userProfiles)
      .set({
        cvMarkdown: markdownCv,
        cvUploadedAt: new Date(),
        languages: signals.languages?.length > 0 ? signals.languages : undefined,
      })
      .where(eq(userProfiles.userId, user.id));
  } else {
    // Create new profile with CV
    await db.insert(userProfiles).values({
      userId: user.id,
      cvMarkdown: markdownCv,
      cvUploadedAt: new Date(),
      languages: signals.languages?.length > 0 ? signals.languages : undefined,
    });
  }

  // Also save to settings table for backwards compatibility
  const { neon } = await import('@neondatabase/serverless');
  const url = (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!)
    .replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
  const sql = neon(url);
  const cvKey = `${user.email}:cv_content`;
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES (${cvKey}, ${markdownCv}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;

  return NextResponse.json({ ok: true, signals, preview: markdownCv.slice(0, 800) });
}
