import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, evaluations } from '@/lib/db';
import { runBackgroundPipeline } from '@/lib/evaluate/pipeline';
import type { InputType } from '@/lib/evaluate/types';

export const runtime = 'nodejs';
export const maxDuration = 300; // Fluid Compute graceful shutdown for the after() pipeline.

const VALID_INPUT_TYPES: InputType[] = ['dm', 'jd', 'url'];

/**
 * POST /api/evaluations — create an evaluations row in 'processing' state and
 * kick off the canonical evaluation in the background. Returns { id } so the
 * panel can navigate to /evaluate/[id] immediately.
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthUserId();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { rawInput?: unknown; inputType?: unknown; classificationConfidence?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rawInput = typeof body.rawInput === 'string' ? body.rawInput.trim() : '';
  const inputType = typeof body.inputType === 'string' && (VALID_INPUT_TYPES as string[]).includes(body.inputType)
    ? body.inputType as InputType
    : null;
  const confRaw = Number(body.classificationConfidence);
  const classificationConfidence = Number.isFinite(confRaw) ? Math.max(0, Math.min(1, confRaw)) : 0;

  if (!rawInput) {
    return NextResponse.json({ error: 'rawInput is required' }, { status: 400 });
  }
  if (!inputType) {
    return NextResponse.json({ error: 'inputType must be dm | jd | url' }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .insert(evaluations)
    .values({
      userId: authUser.id,
      status: 'processing',
      rawInput,
      inputType,
      classificationConfidence,
    } as any)
    .returning({ id: evaluations.id });

  const evaluationId = row.id;

  // Fire-and-forget: runs after the response is sent (Vercel Fluid Compute
  // keeps the function alive up to maxDuration to finish this).
  after(async () => {
    await runBackgroundPipeline({
      evaluationId,
      userId: authUser.id,
      rawInput,
    });
  });

  return NextResponse.json({ id: evaluationId }, { status: 201 });
}
