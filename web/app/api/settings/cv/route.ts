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
  ],
  "pattern": "You're a financial journalist whose scope keeps growing while the craft stays constant.",
  "patternDetail": "Across 2 countries and multiple markets, your editorial function held steady while the categories shifted. That makes you durable across messy beats — and less obviously placed at outlets looking for a single-vertical specialist.",
  "archetypes": [
    {
      "id": "core-fit",
      "type": "core-fit",
      "name": "Senior editor, LatAm financial media",
      "description": "The role you've already run — same function, same kind of newsroom, regional scope.",
      "why": "Diario Financiero and your independent-media work put you in exactly this seat."
    },
    {
      "id": "stretch-up",
      "type": "stretch up",
      "name": "Editorial director, multi-market newsroom",
      "description": "A step up in title and span — the same craft as an executive editorial seat.",
      "why": "Your multi-country reporting taught you the regional shape; the step is scope, not the work."
    },
    {
      "id": "adjacent-pivot",
      "type": "adjacent pivot",
      "name": "Content lead, fintech or B2B SaaS",
      "description": "Same storytelling muscle, applied to a company's content engine instead of a newsroom.",
      "why": "Financial-journalism rigor transfers directly to credible B2B content."
    }
  ]
}
\`\`\`

Notes for the JSON fields:
- industries: 1–3 industry/domain labels the candidate has actually worked in, inferred from the companies and role descriptions (e.g. "fintech", "marketplaces", "SaaS", "healthcare", "logistics", "financial journalism", "media"). Lowercase, most-recent/most-relevant first. Be specific to THIS candidate — do not default to generic "tech".
- primaryCity: the candidate's current/most-recent city (e.g. "Mexico City", "Santiago", "Bogotá"). Use the most recent role's location or an explicit location/header in the CV. If genuinely unknown, omit the field.
- countryCount: number of distinct countries the candidate has worked in across their roles.
- pageCount: approximate number of pages in the source
- format: "PDF" or "DOCX" or "TEXT"
- isLinkedInExport: true ONLY if the document has clear LinkedIn export markers (e.g., "linkedin.com/in/" URL, LinkedIn-style headers, "Top Skills" section). Otherwise false.
- outcomeCount: total number of quantified outcomes/metrics across all roles
- unclearRoles: number of roles where dates, scope, or outcomes are ambiguous
- yearSpan: total span in years from earliest to latest role
- pattern: ONE sentence naming who this candidate is and the through-line of their career, in second person ("You're a …"). Specific to their actual profession — the example is for a journalist; DO NOT reuse it. Avoid the generic word "operator" unless the CV is genuinely an operations/GM profile.
- patternDetail: 1–2 sentences expanding the pattern, citing concrete scope (countries, markets, domains) from the CV and what it makes them strong/weak at. Grounded in THIS CV, not generic.
- archetypes: EXACTLY 3 role shapes this specific candidate could credibly target next, grounded in THEIR actual CV. This is the most important field — it must reflect the candidate's real profession, not a generic startup-operator template.
  - The example above is for a financial journalist — DO NOT reuse it. Generate fresh archetypes for the actual CV. A nurse gets nursing archetypes; a backend engineer gets engineering archetypes; a lawyer gets legal archetypes.
  - id MUST be exactly one of: "core-fit", "stretch-up", "adjacent-pivot" (in that order).
    - core-fit: the same function/level the candidate already does — where they've already been.
    - stretch-up: one level up in title/scope, same craft.
    - adjacent-pivot: a different context that uses the same core skill.
  - type: a short human label ("core-fit", "stretch up", "adjacent pivot").
  - name: a concrete role title + context, specific to this candidate's field and seniority. No "Series B–C" or "GM" boilerplate unless the CV is actually a startup operator.
  - description: 1–2 sentences on what the role is and why it fits the trajectory.
  - why: one sentence citing SPECIFIC evidence from the CV (real company names, domains, or outcomes). Never generic.
  - Match seniority to the CV: do not promote a junior candidate to Director, and do not demote a VP.

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
    max_tokens: 8192,
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
