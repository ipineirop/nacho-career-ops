import { NextRequest, NextResponse } from 'next/server';
import { getFile, updateFile } from '@/lib/github';
import { parsePipeline, discardPipelineItem } from '@/lib/parsers';
import { requireAuth } from '@/lib/require-auth';

const PIPELINE_PATH = 'data/pipeline.md';

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const { content } = await getFile(PIPELINE_PATH);
  const jobs = parsePipeline(content);
  return NextResponse.json(jobs);
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { url, action } = await req.json();
  if (!url || action !== 'discard') {
    return NextResponse.json({ error: 'url and action=discard are required' }, { status: 400 });
  }

  const { content, sha } = await getFile(PIPELINE_PATH);
  const updated = discardPipelineItem(content, url);
  await updateFile(
    PIPELINE_PATH,
    updated,
    sha,
    `ui: discard pipeline item ${url}`,
  );

  return NextResponse.json({ ok: true });
}
