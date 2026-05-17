import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // TODO: Refactor for new schema (evaluations/roles/pipelineStatus tables)
  // Currently uses old neon() + applications table; gracefully fail until complete
  return new Response('Evaluate endpoint pending refactor for Supabase schema', { status: 503 });
}
