import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from './auth';

export async function requireAuth(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function getAuthUser(): Promise<{ email: string; name: string } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return { email: session.user.email, name: session.user.name ?? '' };
}
