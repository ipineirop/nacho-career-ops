import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/require-auth';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

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
  "unsure": [
    { "field": "team size at Company X", "extracted": "12", "confidence": "low" }
  ]
}
\`\`\`

CV text to convert:
`;

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
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

  // Save to DB (no GitHub commit — avoids spurious Vercel deploys)
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
