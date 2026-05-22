import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/require-auth';
import { getSql } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Known company → portal slug mapping
const COMPANY_PORTALS: Record<string, { portal: 'greenhouse' | 'ashby' | 'lever'; slug: string }> = {
  'Nubank':        { portal: 'greenhouse', slug: 'nubank' },
  'Kueski':        { portal: 'greenhouse', slug: 'kueski' },
  'iFood':         { portal: 'greenhouse', slug: 'ifood' },
  'Kavak':         { portal: 'ashby',      slug: 'kavak' },
  'Clara':         { portal: 'ashby',      slug: 'Clara' },
  'Jeeves':        { portal: 'ashby',      slug: 'Jeeves' },
  'Stori':         { portal: 'ashby',      slug: 'stori' },
  'Jüsto':         { portal: 'ashby',      slug: 'justo' },
  'Justo':         { portal: 'ashby',      slug: 'justo' },
  'Clip':          { portal: 'lever',      slug: 'clip' },
  'Rappi':         { portal: 'lever',      slug: 'rappi' },
  'LATAM Airlines':{ portal: 'lever',      slug: 'latamairlines' },
  'Spotify':       { portal: 'lever',      slug: 'spotify' },
  'Kushki':        { portal: 'greenhouse', slug: 'kushki' },
  'Nowports':      { portal: 'greenhouse', slug: 'nowports' },
  'Merama':        { portal: 'greenhouse', slug: 'merama' },
  'Yuno':          { portal: 'greenhouse', slug: 'yuno' },
  'VTEX':          { portal: 'greenhouse', slug: 'VTEX' },
  'Konfio':        { portal: 'greenhouse', slug: 'konfio' },
  'Bitso':         { portal: 'greenhouse', slug: 'bitso' },
  'Pomelo':        { portal: 'greenhouse', slug: 'pomelo' },
  'Truora':        { portal: 'greenhouse', slug: 'truora' },
  'Incode':        { portal: 'greenhouse', slug: 'incode' },
  'Loft':          { portal: 'ashby',      slug: 'loft' },
  'QuintoAndar':   { portal: 'greenhouse', slug: 'quintoandar' },
};

interface Job { title: string; url: string; company: string; location: string }

async function fetchGreenhouse(slug: string, company: string): Promise<Job[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=false`, {
    headers: { 'User-Agent': 'leadme-scanner/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.jobs ?? []).map((j: { title: string; absolute_url: string; location?: { name: string } }) => ({
    title: j.title,
    url: j.absolute_url,
    company,
    location: j.location?.name ?? '',
  }));
}

async function fetchAshby(slug: string, company: string): Promise<Job[]> {
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, {
    headers: { 'User-Agent': 'leadme-scanner/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.jobPostings ?? []).map((j: { title: string; jobUrl: string; isRemote: boolean; locationName?: string }) => ({
    title: j.title,
    url: j.jobUrl,
    company,
    location: j.locationName ?? (j.isRemote ? 'Remote' : ''),
  }));
}

async function fetchLever(slug: string, company: string): Promise<Job[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`, {
    headers: { 'User-Agent': 'leadme-scanner/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data ?? []).map((j: { text: string; hostedUrl: string; categories?: { location?: string } }) => ({
    title: j.text,
    url: j.hostedUrl,
    company,
    location: j.categories?.location ?? '',
  }));
}

function matchesKeywords(title: string, keywords: string[]): boolean {
  if (!keywords.length) return true;
  const t = title.toLowerCase();
  return keywords.some((kw) => t.includes(kw.toLowerCase()));
}

const DEFAULT_KEYWORDS = [
  'director', 'head of', 'vp ', 'vice president', 'general manager',
  'country manager', 'chief operating', 'coo',
  'director de operaciones', 'gerente general', 'gerente de operaciones',
];

export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sql = getSql();

  // Load user preferences for target companies + keywords
  const rows = await sql`SELECT value FROM settings WHERE key = ${user.email + ':leadme_preferences'} LIMIT 1`;
  const prefs = rows[0] ? JSON.parse((rows[0] as { value: string }).value) : {};
  const targetCompanies: string[] = prefs.targetCompanies ?? [];
  const keywords: string[] = prefs.searchKeywords?.length
    ? prefs.searchKeywords
    : DEFAULT_KEYWORDS;

  // Determine which companies to scan
  const toScan = targetCompanies.length > 0
    ? targetCompanies.filter((c) => COMPANY_PORTALS[c])
    : Object.keys(COMPANY_PORTALS);

  // Get existing URLs to skip duplicates
  const existingRows = await sql`SELECT url FROM jobs WHERE user_email = ${user.email}`;
  const existingUrls = new Set((existingRows as unknown as { url: string }[]).map((r) => r.url));

  // Fetch all companies in parallel (concurrency ~10)
  const fetchers = toScan.map(async (companyName) => {
    const conf = COMPANY_PORTALS[companyName];
    if (!conf) return [];
    try {
      let jobs: Job[] = [];
      if (conf.portal === 'greenhouse') jobs = await fetchGreenhouse(conf.slug, companyName);
      else if (conf.portal === 'ashby')  jobs = await fetchAshby(conf.slug, companyName);
      else if (conf.portal === 'lever')  jobs = await fetchLever(conf.slug, companyName);
      return jobs;
    } catch { return []; }
  });

  const allJobs = (await Promise.all(fetchers)).flat();

  // Filter by keywords + deduplicate
  const today = new Date().toISOString().split('T')[0];
  const newJobs = allJobs.filter(
    (j) => matchesKeywords(j.title, keywords) && !existingUrls.has(j.url)
  );

  // Batch insert
  let inserted = 0;
  for (const j of newJobs) {
    try {
      await sql`
        INSERT INTO jobs (user_email, url, company, role, portal, first_seen, status)
        VALUES (${user.email}, ${j.url}, ${j.company}, ${j.title}, ${COMPANY_PORTALS[j.company]?.portal ?? ''}, ${today}, 'pending')
        ON CONFLICT (url) DO NOTHING
      `;
      inserted++;
    } catch { /* skip on conflict */ }
  }

  return NextResponse.json({
    ok: true,
    scanned: toScan.length,
    found: allJobs.length,
    matched: newJobs.length,
    inserted,
  });
}
