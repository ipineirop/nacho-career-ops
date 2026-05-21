import { neon } from '@neondatabase/serverless';
import {
  getDb,
  users,
  userProfiles,
  userPreferences,
  userSignalsDerived,
} from '@/lib/db';
import { eq, and, isNull } from 'drizzle-orm';

// =====================================================================
// Candidate context — the read model the AI flows consume. Onboarding
// writes the normalized tables + a few settings blobs; this assembles
// them into one markdown profile block so evaluations, CV generation,
// and outreach are personalized to the ACTUAL user instead of a
// hardcoded template profile.
// =====================================================================

function getDbUrl() {
  return (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!)
    .replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
}

async function getSetting(email: string, key: string): Promise<string> {
  const sql = neon(getDbUrl());
  const rows = await sql`SELECT value FROM settings WHERE key = ${`${email}:${key}`} LIMIT 1`;
  return (rows as { value: string }[])[0]?.value ?? '';
}

interface ArchetypeBlob {
  archetypes?: Array<{ id: string; name: string; description: string; why: string; selected?: boolean }>;
  selected?: string[];
}

export interface CandidateContext {
  email: string;
  markdown: string; // assembled profile block for prompts
  cvMarkdown: string;
  hasProfile: boolean;
}

/**
 * Assemble the candidate's stored profile into a single markdown block.
 * Returns empty-ish context (hasProfile=false) if the user never onboarded.
 */
export async function loadCandidateContext(userId: string): Promise<CandidateContext> {
  const db = getDb();

  const userRow = await db
    .select({ email: users.email, name: users.nameFull })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const email = userRow[0]?.email ?? '';

  const [profileRow, prefRow, sigRow] = await Promise.all([
    db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1),
    db.select().from(userPreferences)
      .where(and(eq(userPreferences.userId, userId), isNull(userPreferences.supersededAt)))
      .limit(1),
    db.select().from(userSignalsDerived).where(eq(userSignalsDerived.userId, userId)).limit(1),
  ]);

  const [cvMarkdown, archetypesRaw, cvRolesRaw] = email
    ? await Promise.all([
        getSetting(email, 'cv_content'),
        getSetting(email, 'leadme_archetypes'),
        getSetting(email, 'cv_roles'),
      ])
    : ['', '', ''];

  const profile = profileRow[0];
  const pref = prefRow[0];
  const sig = sigRow[0];

  let archetypes: ArchetypeBlob = {};
  try { archetypes = archetypesRaw ? JSON.parse(archetypesRaw) : {}; } catch { /* ignore */ }

  const hasProfile = !!(profile || pref || sig || cvMarkdown || archetypesRaw);

  // ── Assemble the markdown block ──────────────────────────────────
  const lines: string[] = [];
  const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

  if (profile?.seniorityLevel) lines.push(`- Seniority: ${profile.seniorityLevel}`);
  if (profile?.primaryFunction) lines.push(`- Primary function: ${profile.primaryFunction}`);
  if (arr(profile?.industries).length) lines.push(`- Industries: ${arr(profile?.industries).join(', ')}`);
  if (typeof profile?.yearsOfExperience === 'number') lines.push(`- Years of experience: ${profile?.yearsOfExperience}`);
  if (profile?.remotePreference) lines.push(`- Remote preference: ${profile.remotePreference}`);

  if (sig?.careerArcDescription) lines.push(`- Career arc: ${sig.careerArcDescription}`);
  if (sig?.trajectoryVelocity) lines.push(`- Trajectory velocity: ${sig.trajectoryVelocity}`);
  if (sig?.domainConsistency) lines.push(`- Domain consistency: ${sig.domainConsistency}`);
  if (arr(sig?.inferredStrengths).length) lines.push(`- Strengths: ${arr(sig?.inferredStrengths).join('; ')}`);
  if (arr(sig?.inferredGaps).length) lines.push(`- Gaps: ${arr(sig?.inferredGaps).join('; ')}`);

  // Search criteria (what the candidate is actually looking for)
  if (pref) {
    if (pref.mode) lines.push(`- Search mode: ${pref.mode}`);
    if (arr(pref.targetSeniorityLevels).length) lines.push(`- Target seniority: ${arr(pref.targetSeniorityLevels).join(', ')}`);
    if (arr(pref.targetIndustries).length) lines.push(`- Target industries: ${arr(pref.targetIndustries).join(', ')}`);
    if (arr(pref.targetGeographies).length) lines.push(`- Target geographies: ${arr(pref.targetGeographies).join(', ')}`);
    if (arr(pref.targetRemoteModes).length) lines.push(`- Acceptable work modes: ${arr(pref.targetRemoteModes).join(', ')}`);
    if (pref.floorCompUsd) lines.push(`- Comp floor (USD/yr, approx): ${Math.round(Number(pref.floorCompUsd)).toLocaleString('en-US')}`);
    if (pref.targetCompUsd) lines.push(`- Comp target (USD/yr, approx): ${Math.round(Number(pref.targetCompUsd)).toLocaleString('en-US')}`);
    if (pref.compCurrencyDisplay) lines.push(`- Comp currency: ${String(pref.compCurrencyDisplay).toUpperCase()}`);
    if (pref.humanAnswer) lines.push(`- In their own words: "${pref.humanAnswer}"`);
  }

  // Target archetypes (North Stars) — the shapes to score "North Star" against
  const selectedIds = new Set(archetypes.selected ?? []);
  const targetArchetypes = (archetypes.archetypes ?? []).filter(
    (a) => selectedIds.size === 0 || selectedIds.has(a.id)
  );

  let block = '';
  if (lines.length) {
    block += `## Candidate Profile\n${lines.join('\n')}\n`;
  }
  if (targetArchetypes.length) {
    block += `\n## Target Archetypes (North Stars)\nScore "North Star" fit against these target role shapes the candidate chose:\n`;
    block += targetArchetypes
      .map((a, i) => `${i + 1}. ${a.name} — ${a.description}${a.why ? ` (why: ${a.why})` : ''}`)
      .join('\n');
    block += '\n';
  }
  if (cvRolesRaw) {
    // Corrected roles are authoritative over the parsed CV markdown.
    try {
      const rolesList = JSON.parse(cvRolesRaw) as Array<{ company?: string; role?: string; years?: number; current?: boolean; metrics?: string[] }>;
      if (Array.isArray(rolesList) && rolesList.length) {
        block += `\n## Confirmed Roles (user-corrected — authoritative)\n`;
        block += rolesList
          .map((r) => `- ${r.role ?? 'Role'} @ ${r.company ?? 'Company'}${r.years ? ` (${r.years}y${r.current ? ', current' : ''})` : ''}${r.metrics?.length ? ` — ${r.metrics.join('; ')}` : ''}`)
          .join('\n');
        block += '\n';
      }
    } catch { /* ignore */ }
  }

  return { email, markdown: block.trim(), cvMarkdown, hasProfile };
}
