import { getDb, userProfiles } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/auth-bridge';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EvaluateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authUser = await getAuthUserId();
  if (!authUser) redirect('/auth/signin');

  // Check if user has completed onboarding by checking for a profile
  const db = getDb();
  const profileRecord = await db.select().from(userProfiles).where(eq(userProfiles.userId, authUser.id)).limit(1);

  // If user doesn't have a profile yet, redirect to onboarding
  if (!profileRecord || profileRecord.length === 0) {
    redirect('/onboarding');
  }

  return children;
}
