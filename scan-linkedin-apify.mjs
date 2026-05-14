#!/usr/bin/env node

/**
 * scan-linkedin-apify.mjs — LinkedIn Jobs scanner via Apify
 *
 * Uses the cheap_scraper/linkedin-job-scraper actor. For each query in
 * portals.yml it runs the actor, applies a 3-stage filter (title → location
 * → industry), saves the full JD to jds/linkedin-{id}.md, and appends
 * local:jds/... entries to pipeline.md — no LinkedIn login needed at eval time.
 *
 * Usage:
 *   node scan-linkedin-apify.mjs                # run all linkedin_queries
 *   node scan-linkedin-apify.mjs --dry-run      # preview without writing files
 *   node scan-linkedin-apify.mjs --query "Head of Operations"  # single query
 *
 * Credentials (in order of priority):
 *   1. APIFY_API_TOKEN env var
 *   2. config/secrets.yml → apify.api_token
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import yaml from 'js-yaml';

// ── Constants ────────────────────────────────────────────────────────

const ACTOR_ID         = 'cheap_scraper~linkedin-job-scraper';
const APIFY_BASE       = 'https://api.apify.com/v2';
const PORTALS_PATH     = 'portals.yml';
const SECRETS_PATH     = 'config/secrets.yml';
const SCAN_HISTORY     = 'data/scan-history.tsv';
const PIPELINE_PATH    = 'data/pipeline.md';
const APPLICATIONS     = 'data/applications.md';
const JDS_DIR          = 'jds';

const JOBS_PER_QUERY   = 25;
const RUN_TIMEOUT_S    = 300;
const DELAY_BETWEEN_MS = 2000;

// ── Credentials ──────────────────────────────────────────────────────

function loadToken() {
  if (process.env.APIFY_API_TOKEN) return process.env.APIFY_API_TOKEN;
  if (existsSync(SECRETS_PATH)) {
    const s = yaml.load(readFileSync(SECRETS_PATH, 'utf-8'));
    if (s?.apify?.api_token) return s.apify.api_token;
  }
  console.error('No Apify API token found.');
  console.error('Set APIFY_API_TOKEN env var, or add apify.api_token to config/secrets.yml.');
  console.error('Get your token at: https://console.apify.com/account/integrations');
  process.exit(1);
}

// ── Apify REST helpers ───────────────────────────────────────────────

function apifyUrl(path, token, extra = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const qs = new URLSearchParams({ token, ...extra }).toString();
  return `${APIFY_BASE}${path}${sep}${qs}`;
}

async function apifyPost(path, token, body) {
  const res = await fetch(apifyUrl(path, token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Apify POST ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function apifyGet(path, token) {
  const res = await fetch(apifyUrl(path, token, { limit: '500' }));
  if (!res.ok) throw new Error(`Apify GET ${path} → ${res.status}`);
  return res.json();
}

// ── Run one actor query ──────────────────────────────────────────────

async function runActorQuery(query, token) {
  let input;
  if (query.remote_only) {
    const params = new URLSearchParams({ keywords: query.keywords, location: query.location || '' });
    params.set('f_WT', '2');
    params.set('sortBy', 'DD');
    input = {
      startUrls:   [{ url: `https://www.linkedin.com/jobs/search/?${params}` }],
      publishedAt: 'r2592000',
    };
  } else {
    input = {
      keyword:     [query.keywords],
      location:    query.location || '',
      publishedAt: 'r2592000',
    };
  }

  const runRes = await apifyPost(
    `/acts/${ACTOR_ID}/runs?waitForFinish=${RUN_TIMEOUT_S}`,
    token,
    input,
  );

  const run = runRes.data;
  if (!run) throw new Error('Empty run response from Apify');
  if (run.status === 'FAILED' || run.status === 'ABORTED') {
    throw new Error(`Actor run ${run.status}: ${run.statusMessage || ''}`);
  }
  if (run.status !== 'SUCCEEDED') {
    process.stdout.write(`[partial:${run.status}] `);
  }

  const datasetId = run.defaultDatasetId;
  if (!datasetId) throw new Error('No dataset ID in run response');

  const itemsRes = await apifyGet(`/datasets/${datasetId}/items`, token);
  return Array.isArray(itemsRes) ? itemsRes : (itemsRes.items || []);
}

// ── Normalize actor output ───────────────────────────────────────────

function normalizeJob(raw) {
  const title       = raw.jobTitle    || raw.title       || raw.positionName   || '';
  const company     = raw.companyName || raw.company     || raw.organization   || '';
  const location    = raw.location    || raw.place       || raw.jobLocation    || '';
  const posted      = raw.publishedAt || raw.postedAt    || raw.date           || '';
  const description = raw.jobDescription || raw.description || '';
  const salary      = Array.isArray(raw.salaryInfo)
    ? raw.salaryInfo.join(' – ')
    : (raw.salaryInfo || raw.salary || '');

  const url =
    raw.jobUrl || raw.url || raw.link || raw.applyUrl || raw.externalApplyLink || '';

  const jobId = (url.match(/\/jobs\/view\/(\d+)/) || (raw.jobId ? [, String(raw.jobId)] : []))?.[1];
  const urlNorm = jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : url;

  return {
    title: title.trim(),
    company: company.trim(),
    location: location.trim(),
    url: urlNorm,
    jobId,
    posted,
    salary,
    description,
    contractType:     raw.contractType     || '',
    experienceLevel:  raw.experienceLevel  || '',
    workType:         raw.workType         || '',
    sector:           raw.sector           || '',
    applicationsCount: raw.applicationsCount || '',
  };
}

// ── Title filter ─────────────────────────────────────────────────────

function buildTitleFilter(tf) {
  const pos = (tf?.positive || []).map(k => k.toLowerCase());
  const neg = (tf?.negative || []).map(k => k.toLowerCase());
  return (title) => {
    const t = title.toLowerCase();
    return (pos.length === 0 || pos.some(k => t.includes(k))) && !neg.some(k => t.includes(k));
  };
}

// ── Location pre-filter ──────────────────────────────────────────────
// Checks the actual job location field against the query's intended geography.
// Prevents US/EU roles from flooding LATAM-targeted queries.

const MEXICO_TERMS = [
  'mexico', 'méxico', 'cdmx', 'ciudad de mexico', 'monterrey', 'guadalajara',
  'puebla', 'querétaro', 'queretaro', 'tijuana', 'juárez', 'juarez',
  'leon', 'mérida', 'merida', 'hermosillo', 'mexicali', 'aguascalientes',
];

const LATAM_TERMS = [
  ...MEXICO_TERMS,
  'colombia', 'bogotá', 'bogota', 'medellín', 'medellin',
  'argentina', 'buenos aires',
  'brazil', 'brasil', 'são paulo', 'sao paulo', 'rio de janeiro',
  'chile', 'santiago',
  'peru', 'perú', 'lima',
  'ecuador', 'quito',
  'uruguay', 'montevideo',
  'panama', 'panamá',
  'costa rica', 'san josé',
  'guatemala', 'el salvador', 'honduras', 'nicaragua',
  'latam', 'latin america', 'latinoamerica', 'latinoamérica',
  'south america', 'central america',
  'remote',   // remote roles are valid for any LATAM query
  'anywhere', // "Anywhere" is LinkedIn's global remote label
];

// Caribbean micro-markets excluded from LATAM remote queries (low relevance)
const EXCLUDE_LOCATIONS = [
  'barbados', 'cayman', 'british virgin islands', 'bahamas', 'suriname',
  'anegada', 'bridgetown', 'nassau', 'george town', 'paramaribo',
];

function buildLocationFilter() {
  return function locationFilter(job, query) {
    const loc = (job.location || '').toLowerCase();

    // Always exclude Caribbean micro-markets regardless of query
    if (EXCLUDE_LOCATIONS.some(t => loc.includes(t))) return false;

    // Remote queries: accept any remaining location
    if (query.remote_only) return true;

    const ql = (query.location || '').toLowerCase();

    if (ql.includes('mexico') || ql.includes('méxico')) {
      return MEXICO_TERMS.some(t => loc.includes(t));
    }
    if (ql.includes('latin america') || ql.includes('latam')) {
      return LATAM_TERMS.some(t => loc.includes(t));
    }
    return true;
  };
}

// ── Industry pre-filter ──────────────────────────────────────────────
// Excludes industries that don't match the candidate's target sectors.
// Checks title + first 400 chars of description to avoid false positives.

const DEFAULT_EXCLUDE_INDUSTRIES = [
  // Healthcare / medical (unless explicitly digital health)
  'dental', 'dentist', 'orthodont', 'pediatric', 'optometri', 'ophthalmol',
  'eyecare', 'vision care', 'veterinar', 'animal health',
  'long-term care', 'skilled nursing', 'hospice', 'dialysis',
  // Physical / industrial
  'fire protection', 'firefight', 'irrigation', 'landscap',
  'wastewater', 'water treatment', 'sewage',
  'injection mold', 'castpart', 'fabricat',
  'concrete', 'pallet', 'lath and plaster', 'lath & plaster',
  // Food & beverage / cleaning / facilities
  'restaurant chain', 'food service management', 'bao', 'quick service',
  'food and beverage', 'limpieza', 'cleaning service', 'janitorial',
  // Warehouse / last-mile logistics ops
  'fulfillment center', 'sort center', 'last mile', 'last-mile',
  // Call center / BPO
  'call center', 'contact center', 'centro de llamadas',
  // Funeral / cemetery
  'funeral', 'cemetery', 'mortuary',
  // Non-profit social services (low comp)
  'ymca', 'scouting america',
];

function buildIndustryFilter(config) {
  const excluded = [
    ...DEFAULT_EXCLUDE_INDUSTRIES,
    ...(config.linkedin_prefilter?.exclude_industries || []),
  ].map(s => s.toLowerCase());

  return function industryFilter(job) {
    const haystack = (
      job.title + ' ' +
      (job.sector || '') + ' ' +
      job.description.slice(0, 400)
    ).toLowerCase();
    return !excluded.some(term => haystack.includes(term));
  };
}

// ── Dedup ────────────────────────────────────────────────────────────

function loadSeenUrls() {
  const seen = new Set();
  const addFromFile = (path, pattern) => {
    if (!existsSync(path)) return;
    for (const m of readFileSync(path, 'utf-8').matchAll(pattern)) seen.add(m[1]);
  };
  addFromFile(SCAN_HISTORY,  /^(https?:\/\/\S+)/gm);
  addFromFile(PIPELINE_PATH, /https?:\/\/www\.linkedin\.com\/jobs\/view\/(\d+)/g);
  addFromFile(APPLICATIONS,  /https?:\/\/www\.linkedin\.com\/jobs\/view\/(\d+)/g);
  return seen; // stores job IDs for LinkedIn URLs, full URLs for others
}

function seenKey(job) {
  return job.jobId || job.url;
}

// ── JD saver ─────────────────────────────────────────────────────────

function saveJd(job, date) {
  if (!job.jobId) return null;
  mkdirSync(JDS_DIR, { recursive: true });
  const path = `${JDS_DIR}/linkedin-${job.jobId}.md`;

  const lines = [
    `# ${job.title} — ${job.company}`,
    '',
    `**URL:** ${job.url}`,
    `**Location:** ${job.location}`,
    `**Posted:** ${job.posted}`,
    `**Scraped:** ${date}`,
  ];
  if (job.salary)           lines.push(`**Salary:** ${job.salary}`);
  if (job.contractType)     lines.push(`**Contract:** ${job.contractType}`);
  if (job.experienceLevel)  lines.push(`**Seniority:** ${job.experienceLevel}`);
  if (job.workType)         lines.push(`**Work type:** ${job.workType}`);
  if (job.sector)           lines.push(`**Sector:** ${job.sector}`);
  if (job.applicationsCount) lines.push(`**Applicants:** ${job.applicationsCount}`);
  lines.push('', '---', '', job.description || '*(no description)*');

  writeFileSync(path, lines.join('\n'), 'utf-8');
  return path;
}

// ── Writers ──────────────────────────────────────────────────────────

function appendToPipeline(offers) {
  if (!offers.length) return;
  let text = readFileSync(PIPELINE_PATH, 'utf-8');
  const marker   = '## Pendientes';
  const idx      = text.indexOf(marker);
  const after    = idx + marker.length;
  const next     = text.indexOf('\n## ', after);
  const insertAt = next === -1 ? text.length : next;

  const block = '\n' + offers.map(o => {
    const ref = o.localJd ? `local:${o.localJd}` : o.url;
    return `- [ ] ${ref} | ${o.company} | ${o.title} | ${o.location}`;
  }).join('\n') + '\n';

  writeFileSync(PIPELINE_PATH, text.slice(0, insertAt) + block + text.slice(insertAt), 'utf-8');
}

function appendToHistory(offers, date) {
  mkdirSync('data', { recursive: true });
  if (!existsSync(SCAN_HISTORY)) {
    writeFileSync(SCAN_HISTORY, 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\n', 'utf-8');
  }
  const lines = offers.map(o =>
    `${o.url}\t${date}\tlinkedin-apify\t${o.title}\t${o.company}\tadded\t${o.location}`
  ).join('\n') + '\n';
  appendFileSync(SCAN_HISTORY, lines, 'utf-8');
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  const args     = process.argv.slice(2);
  const dryRun   = args.includes('--dry-run');
  const queryArg = args.find((_, i) => args[i - 1] === '--query');

  if (!existsSync(PORTALS_PATH)) {
    console.error('portals.yml not found.'); process.exit(1);
  }

  const config   = yaml.load(readFileSync(PORTALS_PATH, 'utf-8'));
  let queries    = (config.linkedin_queries || []).filter(q => q.enabled !== false);

  if (queryArg) {
    queries = [{ keywords: queryArg, location: '', remote_only: false }];
  }

  if (!queries.length) {
    console.error('No linkedin_queries in portals.yml.'); process.exit(1);
  }

  const token          = loadToken();
  const titleFilter    = buildTitleFilter(config.title_filter);
  const locationFilter = buildLocationFilter();
  const industryFilter = buildIndustryFilter(config);
  const seenUrls       = loadSeenUrls();
  const date           = new Date().toISOString().slice(0, 10);

  console.log(`LinkedIn scan via Apify — ${date}`);
  console.log(`Actor:    ${ACTOR_ID}`);
  console.log(`Queries:  ${queries.length} | Jobs/query: ${JOBS_PER_QUERY} | Dry run: ${dryRun}`);
  console.log(`Filters:  title → location → industry → dedup\n`);

  const allNew = [];
  let totalRaw = 0, totalTitle = 0, totalLocation = 0, totalIndustry = 0;

  for (const query of queries) {
    const label = `"${query.keywords}" in "${query.location || 'Anywhere'}"${query.remote_only ? ' (remote)' : ''}`;
    process.stdout.write(`  ${label} ... `);

    try {
      const raw = await runActorQuery(query, token);
      totalRaw += raw.length;

      const fresh = [];
      for (const rawJob of raw) {
        const job = normalizeJob(rawJob);
        if (!job.title || !job.url) continue;

        if (!titleFilter(job.title))            { totalTitle++;    continue; }
        if (!locationFilter(job, query))         { totalLocation++; continue; }
        if (!industryFilter(job))                { totalIndustry++; continue; }
        if (seenUrls.has(seenKey(job)))          continue;

        seenUrls.add(seenKey(job));
        if (!dryRun) {
          job.localJd = saveJd(job, date);
        }
        fresh.push(job);
      }

      console.log(`${raw.length} raw → ${fresh.length} passed`);
      allNew.push(...fresh);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
    }

    if (queries.indexOf(query) < queries.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_MS));
    }
  }

  if (!dryRun && allNew.length > 0) {
    appendToPipeline(allNew);
    appendToHistory(allNew, date);
  }

  // Summary
  const dropped = totalTitle + totalLocation + totalIndustry;
  console.log(`\n${'━'.repeat(55)}`);
  console.log(`LinkedIn Apify Scan — ${date}`);
  console.log(`${'━'.repeat(55)}`);
  console.log(`Queries run:         ${queries.length}`);
  console.log(`Raw results:         ${totalRaw}`);
  console.log(`Dropped (title):     ${totalTitle}`);
  console.log(`Dropped (location):  ${totalLocation}`);
  console.log(`Dropped (industry):  ${totalIndustry}`);
  console.log(`New offers added:    ${allNew.length}`);

  if (allNew.length > 0) {
    console.log('\nNew offers:');
    for (const o of allNew) {
      console.log(`  + ${o.company} | ${o.title} | ${o.location}`);
      if (o.localJd) console.log(`    ${o.localJd}`);
      else           console.log(`    ${o.url}`);
    }
    if (dryRun) {
      console.log('\n(dry run — run without --dry-run to save)');
    } else {
      console.log(`\nJDs saved to ${JDS_DIR}/`);
      console.log(`Pipeline updated: ${PIPELINE_PATH}`);
      console.log('→ Run /career-ops pipeline to evaluate.');
    }
  } else {
    console.log('\nNo new matching offers found.');
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
