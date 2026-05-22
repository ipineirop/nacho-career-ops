import {
  getDb,
  users,
  userProfiles,
  userPreferences,
  userSignalsDerived,
  userCareerHistory,
} from '@/lib/db';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { getSetting as getStoreSetting } from '@/lib/settings-store';

// Shape the engine + onboarding produce for a single role.
export interface RoleInput {
  company?: string;
  role?: string;
  years?: number;
  current?: boolean;
  metrics?: string[];
  seniority?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  industry?: string;
}

function yearToDate(raw?: string): string | null {
  if (!raw) return null;
  const y = parseInt(String(raw).replace(/\D/g, ''), 10);
  return Number.isFinite(y) && y > 1900 && y < 2100 ? `${y}-01-01` : null;
}

/**
 * Replace the user's structured career history with `roles`. user_career_history
 * is the source of truth for role facts; the CV markdown is a derived rendering.
 * Best-effort — never throw into the caller's flow.
 */
export async function persistCareerHistory(
  userId: string,
  roles: RoleInput[],
  source: 'cv_parse' | 'user_input',
): Promise<void> {
  if (!Array.isArray(roles) || !roles.length) return;
  try {
    const db = getDb();
    await db.delete(userCareerHistory).where(eq(userCareerHistory.userId, userId));
    const rows = roles
      .filter((r) => (r.company || r.role))
      .map((r) => ({
        userId,
        companyName: r.company || 'Unknown',
        roleTitle: r.role || 'Unknown',
        function: r.industry || undefined,
        seniorityAtRole: r.seniority || undefined,
        locationDuringRole: r.location || undefined,
        startedAt: yearToDate(r.startDate) ?? undefined,
        endedAt: r.current ? undefined : (yearToDate(r.endDate) ?? undefined),
        keyOutcomesMarkdown: r.metrics?.length ? r.metrics.map((m) => `- ${m}`).join('\n') : undefined,
        proofPoints: r.metrics?.length ? r.metrics : undefined,
      }));
    if (rows.length) await db.insert(userCareerHistory).values(rows);
  } catch (err) {
    console.error('persistCareerHistory failed:', err);
  }
}

// =====================================================================
// Candidate context — the read model the AI flows consume. Onboarding
// writes the normalized tables + a few settings blobs; this assembles
// them into one markdown profile block so evaluations, CV generation,
// and outreach are personalized to the ACTUAL user instead of a
// hardcoded template profile.
// =====================================================================

async function getSetting(email: string, key: string): Promise<string> {
  return (await getStoreSetting(`${email}:${key}`)) ?? '';
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

  const [profileRow, prefRow, sigRow, careerRows] = await Promise.all([
    db.select({
      seniorityLevel: userProfiles.seniorityLevel,
      primaryFunction: userProfiles.primaryFunction,
      industries: userProfiles.industries,
      yearsOfExperience: userProfiles.yearsOfExperience,
      remotePreference: userProfiles.remotePreference,
    }).from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1),
    db.select().from(userPreferences)
      .where(and(eq(userPreferences.userId, userId), isNull(userPreferences.supersededAt)))
      .limit(1),
    db.select().from(userSignalsDerived).where(eq(userSignalsDerived.userId, userId)).limit(1),
    db.select().from(userCareerHistory)
      .where(eq(userCareerHistory.userId, userId))
      .orderBy(asc(userCareerHistory.startedAt)),
  ]);

  const [cvMarkdown, archetypesRaw] = email
    ? await Promise.all([
        getSetting(email, 'cv_content'),
        getSetting(email, 'leadme_archetypes'),
      ])
    : ['', ''];

  const profile = profileRow[0];
  const pref = prefRow[0];
  const sig = sigRow[0];

  let archetypes: ArchetypeBlob = {};
  try { archetypes = archetypesRaw ? JSON.parse(archetypesRaw) : {}; } catch { /* ignore */ }

  const hasProfile = !!(profile || pref || sig || cvMarkdown || archetypesRaw || careerRows.length);

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
  if (careerRows.length) {
    // Structured career history is authoritative over the parsed CV markdown.
    const yr = (d: unknown): string => (typeof d === 'string' && d.length >= 4 ? d.slice(0, 4) : (d instanceof Date ? String(d.getFullYear()) : ''));
    block += `\n## Career History (structured — authoritative over the CV text)\n`;
    block += careerRows
      .map((r) => {
        const span = [yr(r.startedAt), r.endedAt ? yr(r.endedAt) : 'present'].filter(Boolean).join('–');
        const outcomes = typeof r.keyOutcomesMarkdown === 'string' && r.keyOutcomesMarkdown
          ? ` — ${r.keyOutcomesMarkdown.replace(/\n/g, '; ').replace(/^- /, '').replace(/; - /g, '; ')}`
          : '';
        return `- ${r.roleTitle} @ ${r.companyName}${span ? ` (${span})` : ''}${r.seniorityAtRole ? ` · ${r.seniorityAtRole}` : ''}${outcomes}`;
      })
      .join('\n');
    block += '\n';
  }

  return { email, markdown: block.trim(), cvMarkdown, hasProfile };
}
