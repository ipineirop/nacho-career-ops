import { NextRequest, NextResponse } from 'next/server';
import { getFile, updateFile } from '@/lib/github';
import { parseApplications, updateApplicationStatus } from '@/lib/parsers';
import { requireAuth } from '@/lib/require-auth';

const APPLICATIONS_PATH = 'data/applications.md';

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const { content } = await getFile(APPLICATIONS_PATH);
  const applications = parseApplications(content);
  return NextResponse.json(applications);
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id, status } = await req.json();
  if (!id || !status) {
    return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
  }

  const { content, sha } = await getFile(APPLICATIONS_PATH);
  const updated = updateApplicationStatus(content, id, status);
  await updateFile(
    APPLICATIONS_PATH,
    updated,
    sha,
    `ui: update application #${id} status → ${status}`,
  );

  const applications = parseApplications(updated);
  const app = applications.find((a) => a.id === id);
  return NextResponse.json(app ?? { id, status });
}
