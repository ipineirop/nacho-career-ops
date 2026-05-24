import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';

export const runtime = 'nodejs';

/**
 * Classify a pasted snippet as one of: recruiter message ('dm'), job
 * description ('jd'), or a URL.
 *
 * Returns `{ type, confidence }`. The chip in the panel uses confidence to
 * decide whether to surface the "Reading as: …" line — sub-0.9 reveals it.
 *
 * TODO(infra): replace the heuristic below with a real Haiku 4.5 call:
 *   Prompt: classify the following text as 'dm' | 'jd' | 'url'.
 *   Return JSON: { type, confidence: 0..1 }.
 * The heuristic keeps the chip flow testable end-to-end without burning tokens
 * during scaffolding; the contract returned here matches what Haiku will return.
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthUserId();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let text = '';
  try {
    const body = await req.json();
    text = String(body?.text ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ type: null, confidence: null });
  }

  // URL fast-path (the hook handles this too, but keep belt-and-braces).
  if (/^https?:\/\/\S+$/i.test(text)) {
    return NextResponse.json({ type: 'url', confidence: 1.0 });
  }

  // Heuristic classifier — stand-in for Haiku.
  const len = text.length;
  const lower = text.toLowerCase();
  const dmPatterns = /\b(hi|hello|hey|hola|buenas|saludos|interested in|just came across|reaching out|vacante|tu perfil)\b/i;
  const jdPatterns = /\b(responsibilities|requirements|qualifications|experience required|nice to have|what you('|’)ll do|responsabilidades|requisitos|experiencia requerida)\b/i;

  if (len < 400 && dmPatterns.test(lower)) {
    return NextResponse.json({ type: 'dm', confidence: 0.85 });
  }
  if (len >= 400 && jdPatterns.test(lower)) {
    return NextResponse.json({ type: 'jd', confidence: 0.92 });
  }
  // Ambiguous — return low-confidence DM so the chip surfaces.
  return NextResponse.json({ type: 'dm', confidence: 0.55 });
}
