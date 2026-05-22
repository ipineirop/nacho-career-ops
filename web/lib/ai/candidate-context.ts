import {
  getDb,
  users,
  userProfiles,
  userPreferences,
  userSignalsDerived,
  userCareerHistory,
  userCompensation,
  userLocations,
} from '@/lib/db';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { getSetting as getStoreSetting } from '@/lib/settings-store';
import { resolveCompany } from '@/lib/matching/resolve';

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
      .map((r) => {
        // Resolve each employer against the canonical table so the evaluate
        // flow can match a role's company to where the user already worked.
        const resolved = r.company ? resolveCompany(r.company) : null;
        return {
          userId,
          companyName: r.company || 'Unknown',
          canonicalId: resolved?.resolved_canonical_id ?? undefined,
          matchStatus: resolved?.resolved_canonical_id ? 'resolved' : 'unmatched',
          roleTitle: r.role || 'Unknown',
          function: r.industry || undefined,
          seniorityAtRole: r.seniority || undefined,
          locationDuringRole: r.location || undefined,
          startedAt: yearToDate(r.startDate) ?? undefined,
          endedAt: r.current ? undefined : (yearToDate(r.endDate) ?? undefined),
          keyOutcomesMarkdown: r.metrics?.length ? r.metrics.map((m) => `- ${m}`).join('\n') : undefined,
          proofPoints: r.metrics?.length ? r.metrics : undefined,
        };
      });
    if (rows.length) await db.insert(userCareerHistory).values(rows);
  } catch (err) {
    console.error('persistCareerHistory failed:', err);
  }
}

/**
 * Render the user's "avoid" tags (nice_to_haves) into the scoring prompt,
 * grouped by dimension prefix (spec §6.2). Soft signals, model-judged — no
 * code-side penalty math. Returns '' when there are no tags so the block is
 * omitted entirely.
 */
function renderAvoidBlock(tags: string[]): string {
  if (!tags.length) return '';
  const buckets: Record<'industry' | 'culture' | 'title' | 'other', string[]> = {
    industry: [],
    culture: [],
    title: [],
    other: [],
  };
  for (const raw of tags) {
    const idx = raw.indexOf(':');
    if (idx > 0) {
      const key = raw.slice(0, idx).trim().toLowerCase();
      const val = raw.slice(idx + 1).trim();
      if (val && (key === 'industry' || key === 'culture' || key === 'title')) {
        buckets[key].push(val);
        continue;
      }
    }
    const fallback = raw.trim();
    if (fallback) buckets.other.push(fallback);
  }

  const labelLines: string[] = [];
  if (buckets.industry.length) labelLines.push(`- Industries: ${buckets.industry.join(', ')}`);
  if (buckets.culture.length) labelLines.push(`- Culture / company shape: ${buckets.culture.join(', ')}`);
  if (buckets.title.length) labelLines.push(`- Titles / scope mandates: ${buckets.title.join(', ')}`);
  if (buckets.other.length) labelLines.push(`- Other preferences to avoid: ${buckets.other.join(', ')}`);
  if (!labelLines.length) return '';

  return [
    '## What the user wants to avoid (soft signals — do not cap recommendation)',
    labelLines.join('\n'),
    '',
    'Treat these as soft signals: they should reduce the role\'s fit score when the role clearly exhibits these properties, but should not cap the recommendation at "pass." A role that\'s a strong fit on other dimensions can still surface as worth considering even if it hits one or two of these.',
    '',
    'Be cautious with culture tags, which are subjective — only count a hit if the role clearly exhibits the property the user flagged, not on weak inference.',
    '',
    'If you identify hits, list them in the verdict as qualitative observations (one line per hit) under a "Pattern hits" section. Do not assign numeric penalties per hit; let the holistic fit score reflect your overall judgment.',
  ].join('\n');
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
  // Structured comp targets — the comp strip needs raw numbers to position the
  // "your floor" marker on the band, not just the rendered markdown line.
  compFloorUsd: number | null;
  compTargetUsd: number | null;
  compCurrency: string | null;
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

  const [profileRow, prefRow, sigRow, careerRows, compRow, locRow] = await Promise.all([
    db.select({
      seniorityLevel: userProfiles.seniorityLevel,
      primaryFunction: userProfiles.primaryFunction,
      industries: userProfiles.industries,
      yearsOfExperience: userProfiles.yearsOfExperience,
      remotePreference: userProfiles.remotePreference,
      relocationWillingness: userProfiles.relocationWillingness,
      skills: userProfiles.skills,
      languages: userProfiles.languages,
    }).from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1),
    db.select().from(userPreferences)
      .where(and(eq(userPreferences.userId, userId), isNull(userPreferences.supersededAt)))
      .limit(1),
    db.select().from(userSignalsDerived).where(eq(userSignalsDerived.userId, userId)).limit(1),
    db.select().from(userCareerHistory)
      .where(eq(userCareerHistory.userId, userId))
      .orderBy(asc(userCareerHistory.startedAt)),
    db.select().from(userCompensation)
      .where(and(eq(userCompensation.userId, userId), eq(userCompensation.recordType, 'target')))
      .limit(1),
    db.select().from(userLocations)
      .where(and(eq(userLocations.userId, userId), eq(userLocations.locationType, 'current_residence'), isNull(userLocations.untilDate)))
      .limit(1),
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
  const comp = compRow[0];
  const loc = locRow[0];

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
  if (arr(profile?.skills).length) lines.push(`- Skills: ${arr(profile?.skills).join(', ')}`);
  // Languages are stored as [{code, fluency}] jsonb
  const langs = Array.isArray(profile?.languages)
    ? (profile?.languages as Array<{ code?: string; fluency?: string }>).map((l) => l?.code).filter(Boolean)
    : [];
  if (langs.length) lines.push(`- Languages: ${langs.join(', ')}`);
  if (loc?.city || loc?.countryIso) lines.push(`- Currently based in: ${[loc?.city, loc?.countryIso].filter(Boolean).join(', ')}`);
  if (profile?.remotePreference) lines.push(`- Remote preference: ${profile.remotePreference}`);
  if (profile?.relocationWillingness) lines.push(`- Relocation: ${profile.relocationWillingness}`);

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
    // Exact original figure + gross/net basis (the *_usd above are approximate).
    if (comp?.baseAmount) {
      const basisNote = typeof comp.bonusStructureMarkdown === 'string' ? comp.bonusStructureMarkdown : '';
      lines.push(`- Comp target (exact): ${Number(comp.baseAmount).toLocaleString('en-US')} ${comp.baseCurrency ?? ''}${basisNote ? ` (${basisNote})` : ''}`);
    }
    // Hard filters the role must clear (deal-breakers win over a high score).
    if (arr(pref.dealBreakers).length) lines.push(`- DEAL-BREAKERS (hard no): ${arr(pref.dealBreakers).join('; ')}`);
    // nice_to_haves (avoid signals) are rendered as their own grouped block below.
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
  const avoidBlock = renderAvoidBlock(arr(pref?.niceToHaves));
  if (avoidBlock) block += `\n${avoidBlock}\n`;
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

  return {
    email,
    markdown: block.trim(),
    cvMarkdown,
    hasProfile,
    compFloorUsd: pref?.floorCompUsd != null ? Number(pref.floorCompUsd) : null,
    compTargetUsd: pref?.targetCompUsd != null ? Number(pref.targetCompUsd) : null,
    compCurrency: pref?.compCurrencyDisplay ? String(pref.compCurrencyDisplay).toUpperCase() : null,
  };
}
