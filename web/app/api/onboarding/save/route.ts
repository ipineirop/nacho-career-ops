import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import {
  getDb,
  userProfiles,
  userPreferences,
  userCompensation,
  userLocations,
  userEvents,
  userSignalsDerived,
} from '@/lib/db';
import { eq, and, isNull } from 'drizzle-orm';
import { neon } from '@neondatabase/serverless';
import { persistCareerHistory, type RoleInput } from '@/lib/ai/candidate-context';
import { renderCvMarkdown, type RenderableCv } from '@/lib/career-engine';

export const maxDuration = 60;

// ── Mapping helpers ────────────────────────────────────────────────
// The onboarding UI collects human-readable answers. Here we translate
// them to the canonical enums/shapes the schema expects.

const SENIORITY_MAP: Record<string, string> = {
  'senior': 'senior_ic',
  'manager': 'manager',
  'lead': 'manager',
  'director': 'director',
  'head of': 'head_of',
  'vp': 'vp',
  'chief': 'c_level',
  'c-level': 'c_level',
};

function mapSeniority(level: string): string | null {
  const l = level.trim().toLowerCase();
  for (const [k, v] of Object.entries(SENIORITY_MAP)) {
    if (l.includes(k)) return v;
  }
  return null;
}

// searchStatus → preferences.mode (need|leverage|open|paused)
function mapMode(searchStatus: string): string {
  const s = searchStatus.toLowerCase();
  if (s.includes('actively') || s.includes('activamente')) return 'need';
  if (s.includes('just looking') || s.includes('solo mirando')) return 'open';
  return 'leverage'; // "Open to the right thing" — the default middle gear
}

// workArrangement chips → canonical remote modes
function mapRemoteMode(chip: string): string {
  const s = chip.toLowerCase();
  if (s.includes('onsite') || s.includes('oficina')) return 'onsite';
  if (s.includes('hybrid') || s.includes('híbrido') || s.includes('hibrido')) return 'hybrid';
  if (s.includes('remote') || s.includes('remoto')) return 'remote';
  if (s.includes('no pref') || s.includes('sin pref')) return 'any';
  return chip; // custom chip — keep verbatim
}

// locationPick → target geographies
function mapGeographies(locationPick: string, primaryCity: string): string[] {
  const s = locationPick.toLowerCase();
  if (s.includes('only') || s.includes('solo')) return [primaryCity].filter(Boolean);
  if (s.includes('latam') && (s.includes('global') || s.includes('remote'))) return ['LatAm', 'Global'];
  if (s.includes('latam')) return ['LatAm'];
  if (s.includes('global')) return ['Global'];
  return locationPick ? [locationPick] : [];
}

// Static FX fallback (used only if the live rate fetch fails). The exact
// figure + original currency is always stored verbatim in user_compensation;
// the *_usd fields are approximate, for cross-currency benchmarks.
const FX_TO_USD_FALLBACK: Record<string, number> = {
  USD: 1, EUR: 1.08, MXN: 0.058, CLP: 0.00105, ARS: 0.0011, BRL: 0.18, COP: 0.00025,
};

// Fetch a live USD conversion rate for one currency. open.er-api.com is free
// and keyless; we time out fast and fall back to the static table so a comp
// figure is always normalized even if the FX service is down.
async function rateToUsd(currency: string): Promise<number> {
  const cur = currency.toUpperCase();
  if (cur === 'USD') return 1;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`https://open.er-api.com/v6/latest/${cur}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { rates?: Record<string, number> };
      const perUsd = data.rates?.USD; // 1 <cur> = perUsd USD
      if (typeof perUsd === 'number' && perUsd > 0) return perUsd;
    }
  } catch { /* fall through to static */ }
  return FX_TO_USD_FALLBACK[cur] ?? 1;
}

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toAnnualUsd(amount: number | null, period: 'annual' | 'monthly', rate: number): number | null {
  if (amount == null) return null;
  const annual = period === 'monthly' ? amount * 12 : amount;
  return Math.round(annual * rate);
}

// Country resolution is now global: the engine derives the ISO country code
// for the candidate's primary city (it knows every city). We validate it's a
// real ISO 3166-1 alpha-2 code; a tiny city map remains only as a fallback
// for the rare case the engine omits it.
const ISO_3166_1: Set<string> = new Set([
  'AF','AX','AL','DZ','AS','AD','AO','AI','AQ','AG','AR','AM','AW','AU','AT','AZ','BS','BH','BD','BB','BY','BE','BZ','BJ','BM','BT','BO','BQ','BA','BW','BV','BR','IO','BN','BG','BF','BI','CV','KH','CM','CA','KY','CF','TD','CL','CN','CX','CC','CO','KM','CG','CD','CK','CR','CI','HR','CU','CW','CY','CZ','DK','DJ','DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FK','FO','FJ','FI','FR','GF','PF','TF','GA','GM','GE','DE','GH','GI','GR','GL','GD','GP','GU','GT','GG','GN','GW','GY','HT','HM','VA','HN','HK','HU','IS','IN','ID','IR','IQ','IE','IM','IL','IT','JM','JP','JE','JO','KZ','KE','KI','KP','KR','KW','KG','LA','LV','LB','LS','LR','LY','LI','LT','LU','MO','MG','MW','MY','MV','ML','MT','MH','MQ','MR','MU','YT','MX','FM','MD','MC','MN','ME','MS','MA','MZ','MM','NA','NR','NP','NL','NC','NZ','NI','NE','NG','NU','NF','MK','MP','NO','OM','PK','PW','PS','PA','PG','PY','PE','PH','PN','PL','PT','PR','QA','RE','RO','RU','RW','BL','SH','KN','LC','MF','PM','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SX','SK','SI','SB','SO','ZA','GS','SS','ES','LK','SD','SR','SJ','SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TK','TO','TT','TN','TR','TM','TC','TV','UG','UA','AE','GB','US','UM','UY','UZ','VU','VE','VN','VG','VI','WF','EH','YE','ZM','ZW',
]);

function validIso(code?: string): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  return ISO_3166_1.has(c) ? c : null;
}

// Last-resort fallback for a handful of common cities if the engine omits the
// country (it almost never should now that it derives primaryCountry).
const CITY_TO_ISO: Record<string, string> = {
  'mexico city': 'MX', 'cdmx': 'MX', 'ciudad de méxico': 'MX', 'monterrey': 'MX', 'guadalajara': 'MX',
  'santiago': 'CL', 'bogotá': 'CO', 'bogota': 'CO', 'medellín': 'CO', 'medellin': 'CO',
  'buenos aires': 'AR', 'são paulo': 'BR', 'sao paulo': 'BR', 'rio de janeiro': 'BR',
  'lima': 'PE', 'madrid': 'ES', 'barcelona': 'ES', 'london': 'GB', 'berlin': 'DE',
};

function isoFromCity(city: string): string | null {
  return CITY_TO_ISO[city.trim().toLowerCase()] ?? null;
}

interface OnboardingPayload {
  cvSignals?: {
    industries?: string[];
    primaryCity?: string;
    primaryCountry?: string;
    countryCount?: number;
    languages?: string[];
    trajectory?: string;
    roles?: unknown[];
    yearSpan?: number;
    summary?: string;
    skills?: string[];
    education?: Array<{ institution?: string; degree?: string; field?: string; year?: string | number; country?: string }>;
    // Engine synthesis fields
    seniorityLevel?: string;
    primaryFunction?: string;
    pattern?: string;
    patternDetail?: string;
    trajectoryVelocity?: string;
    domainConsistency?: string;
    strengths?: string[];
    gaps?: string[];
  };
  roles?: unknown[]; // final, user-corrected role list from step 3
  seniorityPick?: string; // "Senior, fintech"
  primaryFunction?: string;
  searchStatus?: string;
  locationPick?: string;
  workArrangement?: string[];
  relocationWillingness?: string;
  compCurrency?: string;
  compPeriod?: 'annual' | 'monthly';
  compBasis?: 'gross' | 'net';
  minComp?: string;
  targetComp?: string;
  narrative?: string;
  summary?: string;
  skills?: string[];
  education?: Array<{ institution?: string; degree?: string; field?: string; year?: string | number; country?: string }>;
  archetypes?: Array<{
    id: string; type: string; name: string;
    description: string; why: string; selected: boolean;
  }>;
  selectedArchetypes?: string[];
}

function settingsDb() {
  const url = (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!)
    .replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
  return neon(url);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUserId();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as OnboardingPayload;
  const db = getDb();

  // ── Parse the comp answers ───────────────────────────────────────
  const currency = (body.compCurrency || 'USD').toUpperCase();
  const period = body.compPeriod === 'monthly' ? 'monthly' : 'annual';
  const basis = body.compBasis === 'net' ? 'net' : 'gross';
  const minAmt = parseAmount(body.minComp || '');
  const targetAmt = parseAmount(body.targetComp || '');
  const fxRate = await rateToUsd(currency);
  const minUsd = toAnnualUsd(minAmt, period, fxRate);
  const targetUsd = toAnnualUsd(targetAmt, period, fxRate);

  // ── Derive structured positioning fields ─────────────────────────
  const [levelPart, industryPart] = (body.seniorityPick || '').split(',').map((s) => s.trim());
  // Engine's calibrated seniority wins; fall back to the user's pill choice.
  const seniorityLevel = body.cvSignals?.seniorityLevel || (levelPart ? mapSeniority(levelPart) : null);
  const primaryFunction = body.cvSignals?.primaryFunction || body.primaryFunction || null;
  const industries = body.cvSignals?.industries?.length
    ? body.cvSignals.industries
    : industryPart ? [industryPart] : [];
  const targetIndustries = Array.from(new Set([industryPart, ...(industries ?? [])].filter(Boolean))) as string[];
  const remoteModes = Array.from(new Set((body.workArrangement ?? []).map(mapRemoteMode)));
  const remotePreference = remoteModes.includes('remote')
    ? 'remote'
    : remoteModes.includes('hybrid')
      ? 'hybrid'
      : remoteModes.includes('onsite')
        ? 'onsite'
        : 'any';
  const primaryCity = body.cvSignals?.primaryCity || '';
  const geographies = mapGeographies(body.locationPick || '', primaryCity);
  const mode = mapMode(body.searchStatus || '');
  const languages = (body.cvSignals?.languages ?? []).map((l) => ({ code: l, fluency: 'professional' }));

  // ── 1) user_profiles (upsert) ────────────────────────────────────
  const profilePatch = {
    seniorityLevel: seniorityLevel ?? undefined,
    primaryFunction: primaryFunction || undefined,
    industries: targetIndustries.length ? targetIndustries : undefined,
    domains: industries?.length ? industries : undefined,
    languages: languages.length ? languages : undefined,
    remotePreference,
    relocationWillingness: body.relocationWillingness || undefined,
    yearsOfExperience: body.cvSignals?.yearSpan ?? undefined,
    lastMeaningfulUpdateAt: new Date(),
    updatedAt: new Date(),
  };

  const existingProfile = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  if (existingProfile.length > 0) {
    await db.update(userProfiles).set(profilePatch).where(eq(userProfiles.userId, user.id));
  } else {
    await db.insert(userProfiles).values({ userId: user.id, ...profilePatch });
  }

  // ── 2) user_preferences (supersede prior current, insert new) ─────
  await db
    .update(userPreferences)
    .set({ supersededAt: new Date() })
    .where(and(eq(userPreferences.userId, user.id), isNull(userPreferences.supersededAt)));

  await db.insert(userPreferences).values({
    userId: user.id,
    mode,
    floorCompUsd: minUsd != null ? String(minUsd) : null,
    targetCompUsd: targetUsd != null ? String(targetUsd) : null,
    compCurrencyDisplay: currency.toLowerCase(),
    targetGeographies: geographies.length ? geographies : null,
    targetRemoteModes: remoteModes.length ? remoteModes : null,
    targetIndustries: targetIndustries.length ? targetIndustries : null,
    targetSeniorityLevels: seniorityLevel ? [seniorityLevel] : null,
    targetFunctions: primaryFunction ? [primaryFunction] : null,
    humanAnswer: body.narrative || null,
  });

  // ── 3) user_compensation (target record, exact original figures) ──
  if (targetAmt != null || minAmt != null) {
    await db.insert(userCompensation).values({
      userId: user.id,
      recordType: 'target',
      baseAmount: targetAmt != null ? String(targetAmt) : (minAmt != null ? String(minAmt) : null),
      baseCurrency: currency,
      totalCompUsdNormalized: targetUsd != null ? String(targetUsd) : null,
      source: 'user_input',
      confidence: 'high',
      private: true,
      // basis (gross/net) + period captured in the note since there's no column
      bonusStructureMarkdown: `${basis} · ${period}${minAmt != null ? ` · floor ${minAmt} ${currency}` : ''}`,
    });
  }

  // ── 4) user_locations (current residence)
  // Prefer the engine-derived ISO country (global), fall back to the city map.
  const iso = validIso(body.cvSignals?.primaryCountry) ?? (primaryCity ? isoFromCity(primaryCity) : null);
  if (iso) {
    // Close any existing open current_residence, then insert fresh
    await db
      .update(userLocations)
      .set({ untilDate: new Date().toISOString().split('T')[0] })
      .where(and(
        eq(userLocations.userId, user.id),
        eq(userLocations.locationType, 'current_residence'),
        isNull(userLocations.untilDate),
      ));
    await db.insert(userLocations).values({
      userId: user.id,
      locationType: 'current_residence',
      countryIso: iso,
      city: primaryCity || undefined,
      source: 'cv_parse',
      verified: false,
    });
  }

  // ── 5) user_signals_derived (Labra's model of the user) ──────────
  const sig = body.cvSignals;
  if (sig?.pattern || sig?.strengths?.length || sig?.trajectoryVelocity) {
    const arc = [sig.pattern, sig.patternDetail].filter(Boolean).join(' ');
    const signalsPatch = {
      careerArcDescription: arc || undefined,
      trajectoryVelocity: sig.trajectoryVelocity || undefined,
      domainConsistency: sig.domainConsistency || undefined,
      inferredStrengths: sig.strengths?.length ? sig.strengths : undefined,
      inferredGaps: sig.gaps?.length ? sig.gaps : undefined,
      lastCalculatedAt: new Date(),
      calculationVersion: 'career-engine-1',
    };
    const existingSig = await db
      .select({ id: userSignalsDerived.id })
      .from(userSignalsDerived)
      .where(eq(userSignalsDerived.userId, user.id))
      .limit(1);
    if (existingSig.length > 0) {
      await db.update(userSignalsDerived).set(signalsPatch).where(eq(userSignalsDerived.userId, user.id));
    } else {
      await db.insert(userSignalsDerived).values({ userId: user.id, ...signalsPatch });
    }
  }

  // ── 6) activity log ──────────────────────────────────────────────
  await db.insert(userEvents).values({
    userId: user.id,
    eventType: 'onboarding_completed',
    eventData: { mode, currency, period, basis, selectedArchetypes: body.selectedArchetypes ?? [] },
  });

  // ── 7) settings back-compat blobs (scanner + settings UI read these)
  const sql = settingsDb();
  const prefsBlob = {
    mode,
    levels: seniorityLevel ? [seniorityLevel] : [],
    functions: primaryFunction ? [primaryFunction] : [],
    geographies,
    floorSalaryMXN: 0,
    currency,
    salaryType: basis,
    period,
    humanAnswer: body.narrative ?? '',
    baseSalaryFloor: minAmt ?? 0,
    baseSalaryStretch: targetAmt ?? 0,
    remoteModes,
    targetIndustries,
    searchKeywords: targetIndustries,
    savedAt: new Date().toISOString(),
  };
  await sql`
    INSERT INTO settings (key, value, updated_at)
    VALUES (${`${user.email}:leadme_preferences`}, ${JSON.stringify(prefsBlob)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;

  // Persist the final, user-corrected roles as the authoritative structured
  // career history (source of truth for role facts; the CV markdown is a
  // derived rendering). Overwrites whatever the parse seeded.
  const finalRoles = (body.roles ?? body.cvSignals?.roles ?? []) as RoleInput[];
  if (finalRoles.length) {
    await persistCareerHistory(user.id, finalRoles, 'user_input');
  }

  // The user-reviewed sections from step 3 (summary/skills/education) are
  // authoritative. Persist them, then re-render the CV markdown from the
  // structured data so the document reflects every correction.
  try {
    const reviewedSummary = body.summary ?? body.cvSignals?.summary ?? '';
    const reviewedSkills = body.skills ?? body.cvSignals?.skills ?? [];
    const reviewedEducation = (body.education ?? body.cvSignals?.education ?? []) as RenderableCv['education'];

    await db.update(userProfiles).set({
      summaryMarkdown: reviewedSummary || undefined,
      skills: reviewedSkills.length ? reviewedSkills : undefined,
      education: reviewedEducation && reviewedEducation.length ? reviewedEducation : undefined,
    }).where(eq(userProfiles.userId, user.id));

    if (finalRoles.length) {
      const regenerated = renderCvMarkdown({
        summary: reviewedSummary || undefined,
        roles: finalRoles.map((r) => ({
          company: r.company, role: r.role,
          startDate: r.startDate, endDate: r.endDate, current: r.current,
          seniority: r.seniority, location: r.location, metrics: r.metrics,
        })),
        education: reviewedEducation ?? [],
        skills: reviewedSkills,
        languages: body.cvSignals?.languages ?? [],
      });
      if (regenerated) {
        await db.update(userProfiles).set({ cvMarkdown: regenerated }).where(eq(userProfiles.userId, user.id));
        await sql`
          INSERT INTO settings (key, value, updated_at)
          VALUES (${`${user.email}:cv_content`}, ${regenerated}, NOW())
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `;
      }
    }
  } catch (err) {
    console.error('CV section persist / re-render skipped:', err);
  }

  // Persist the engine's archetypes + which the user confirmed. These are the
  // user's "North Stars" — the evaluate flow scores roles against them.
  if (body.archetypes?.length) {
    await sql`
      INSERT INTO settings (key, value, updated_at)
      VALUES (${`${user.email}:leadme_archetypes`}, ${JSON.stringify({
        archetypes: body.archetypes,
        selected: body.selectedArchetypes ?? body.archetypes.filter((a) => a.selected).map((a) => a.id),
        savedAt: new Date().toISOString(),
      })}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
  }

  // ── 8) mark onboarding complete ──────────────────────────────────
  await sql`
    INSERT INTO settings (key, value, updated_at)
    VALUES (${`${user.email}:leadme_onboarding_complete`}, 'true', NOW())
    ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()
  `;

  return NextResponse.json({ ok: true });
}
