import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthUser } from '@/lib/require-auth';
import { loadPromptFiles } from '@/lib/ai/stream';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ALL_PORTALS = ['Greenhouse network', 'Ashby network', 'Lever network', 'LinkedIn LatAm', 'OCC', 'Bumeran', 'Computrabajo'];

const FALLBACK = {
  companies: [
    { name: 'Clara', why: 'Series C fintech scaling LatAm — Director/VP Ops scope', portal: 'Greenhouse' },
    { name: 'Jeeves', why: 'Global fintech with LatAm ops build-out', portal: 'Greenhouse' },
    { name: 'Clip', why: 'MX fintech marketplace at scale', portal: 'LinkedIn LatAm' },
    { name: 'Nowports', why: 'Series C logistics + supply chain ops in LatAm', portal: 'LinkedIn LatAm' },
    { name: 'Kushki', why: 'Payments infra expanding across LatAm', portal: 'Ashby' },
    { name: 'Merama', why: 'eCommerce operator — strong match for marketplace ops background', portal: 'LinkedIn LatAm' },
    { name: 'Rappi', why: 'Multi-country ops at scale — matches your multi-geo track record', portal: 'Greenhouse' },
    { name: 'OXXO Digital', why: 'Retail ops transformation at massive scale', portal: 'OCC' },
  ],
  portals: ALL_PORTALS,
  keywords: ['Director of Operations', 'VP Operations LatAm', 'Head of Ops Fintech'],
};

function extractJson(text: string) {
  // Strip markdown fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const raw = fenceMatch ? fenceMatch[1] : text.trim();
  return JSON.parse(raw);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { levels, functions, geographies, mode } = await req.json();
  const { cv } = await loadPromptFiles(user.email);

  const prompt = `Based on the candidate's CV and search preferences, recommend 10–12 target companies and which job portals to prioritize.

## Candidate CV
${cv.slice(0, 6000) || '(CV not available — use preferences only)'}

## Search Preferences
- Mode: ${mode ?? 'leverage'}
- Target levels: ${(levels ?? []).join(', ') || 'Director, VP'}
- Functions: ${(functions ?? []).join(', ') || 'Operations'}
- Geographies: ${(geographies ?? []).join(', ') || 'CDMX, Remote LatAm'}

## Instructions
1. Recommend companies with strong fit based on the candidate's background (industries: marketplace, fintech, ecommerce, SaaS, telecom).
2. Prefer companies actively hiring at Director/VP level in LatAm.
3. For each company, one short sentence on WHY it fits.
4. Suggest 3–5 search keywords derived from their background and target scope.

Return ONLY a JSON object (no markdown, no code fences, no explanation) in this exact shape:
{"companies":[{"name":"Clara","why":"Series C fintech scaling LatAm ops","portal":"Greenhouse"}],"portals":["Greenhouse","LinkedIn LatAm","OCC"],"keywords":["Director of Operations"]}`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const data = extractJson(text);

    // Validate shape
    if (!Array.isArray(data.companies) || data.companies.length === 0) {
      return NextResponse.json(FALLBACK);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[target-companies] error:', err);
    return NextResponse.json(FALLBACK);
  }
}
