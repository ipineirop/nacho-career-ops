import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import {
  getDb,
  userProfiles,
  userPreferences,
  userCompensation,
  userLocations,
  userEvents,
} from '@/lib/db';
import { eq, and, isNull } from 'drizzle-orm';
import { neon } from '@neondatabase/serverless';

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

// Approximate FX to USD for normalizing the comp floor/target. These are
// rough — the exact figure + original currency is stored verbatim in
// user_compensation; the *_usd fields are only for cross-currency benchmarks.
const FX_TO_USD: Record<string, number> = {
  USD: 1, EUR: 1.08, MXN: 0.058, CLP: 0.00105, ARS: 0.0011, BRL: 0.18, COP: 0.00025,
};

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toAnnualUsd(amount: number | null, currency: string, period: 'annual' | 'monthly'): number | null {
  if (amount == null) return null;
  const annual = period === 'monthly' ? amount * 12 : amount;
  const rate = FX_TO_USD[currency] ?? 1;
  return Math.round(annual * rate);
}

// Common LatAm/EU cities → ISO country, so we can populate the (notNull)
// country on user_locations. Unknown cities skip the locations insert
// rather than writing a bogus country.
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
    countryCount?: number;
    languages?: string[];
    trajectory?: string;
    roles?: unknown[];
    yearSpan?: number;
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
  archetype?: string;
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
  const minUsd = toAnnualUsd(minAmt, currency, period);
  const targetUsd = toAnnualUsd(targetAmt, currency, period);

  // ── Derive structured positioning fields ─────────────────────────
  const [levelPart, industryPart] = (body.seniorityPick || '').split(',').map((s) => s.trim());
  const seniorityLevel = levelPart ? mapSeniority(levelPart) : null;
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
    primaryFunction: body.primaryFunction || undefined,
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
    targetFunctions: body.primaryFunction ? [body.primaryFunction] : null,
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

  // ── 4) user_locations (current residence) — only if we can resolve ISO
  const iso = primaryCity ? isoFromCity(primaryCity) : null;
  if (primaryCity && iso) {
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
      city: primaryCity,
      source: 'cv_parse',
      verified: false,
    });
  }

  // ── 5) activity log ──────────────────────────────────────────────
  await db.insert(userEvents).values({
    userId: user.id,
    eventType: 'onboarding_completed',
    eventData: { mode, currency, period, basis, archetype: body.archetype ?? null },
  });

  // ── 6) settings back-compat blobs (scanner + settings UI read these)
  const sql = settingsDb();
  const prefsBlob = {
    mode,
    levels: seniorityLevel ? [seniorityLevel] : [],
    functions: body.primaryFunction ? [body.primaryFunction] : [],
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

  // Persist the final, user-corrected CV roles (no dedicated schema table —
  // they live alongside cv_content as structured JSON for re-use).
  const finalRoles = body.roles ?? body.cvSignals?.roles;
  if (finalRoles) {
    await sql`
      INSERT INTO settings (key, value, updated_at)
      VALUES (${`${user.email}:cv_roles`}, ${JSON.stringify(finalRoles)}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
  }

  // ── 7) mark onboarding complete ──────────────────────────────────
  await sql`
    INSERT INTO settings (key, value, updated_at)
    VALUES (${`${user.email}:leadme_onboarding_complete`}, 'true', NOW())
    ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()
  `;

  return NextResponse.json({ ok: true });
}
