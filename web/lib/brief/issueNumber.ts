/**
 * Issue number = days since users.createdAt (signup), 1-indexed so a brand
 * new user's first Brief reads "№ 1" rather than "№ 0".
 *
 * Per the plan: not "days since first Brief view" (which would mean a user
 * who skips the surface for a week sees jump from 1 to 8), and not a global
 * calendar index (which would couple users together). Just elapsed days
 * since the account was created.
 */

export function issueNumberFor(
  signupAt: Date | string | null | undefined,
  now: Date = new Date(),
): number {
  if (!signupAt) return 1;
  const start = typeof signupAt === 'string' ? new Date(signupAt) : signupAt;
  const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, days + 1);
}
