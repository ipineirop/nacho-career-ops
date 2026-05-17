import { NextRequest, NextResponse } from 'next/server';
import { getDb, applications } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { getAuthUser, requireAuth } from '@/lib/require-auth';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await getDb()
    .select()
    .from(applications)
    .where(eq(applications.userEmail, user.email))
    .orderBy(applications.id);
  return NextResponse.json(rows);
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, status, notes } = body;

  if (!id || (status === undefined && notes === undefined)) {
    return NextResponse.json({ error: 'id and status or notes required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;

  const [updated] = await getDb()
    .update(applications)
    .set(updates)
    .where(and(eq(applications.id, id), eq(applications.userEmail, user.email)))
    .returning();

  return NextResponse.json(updated);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const [created] = await getDb()
    .insert(applications)
    .values({ ...body, userEmail: user.email })
    .returning();
  return NextResponse.json(created, { status: 201 });
}
