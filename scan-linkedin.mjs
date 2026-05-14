#!/usr/bin/env node

/**
 * scan-linkedin.mjs — LinkedIn Jobs scanner via Playwright
 *
 * Uses your LinkedIn credentials to search for jobs matching your
 * target queries. Persists session cookies so login only happens once.
 *
 * Usage:
 *   node scan-linkedin.mjs                  # run all linkedin_queries
 *   node scan-linkedin.mjs --dry-run        # preview without writing files
 *   node scan-linkedin.mjs --headless       # headless mode (faster, more detectable)
 *
 * Credentials (in order of priority):
 *   1. LINKEDIN_EMAIL + LINKEDIN_PASSWORD env vars
 *   2. config/secrets.yml → linkedin.email / linkedin.password
 *
 * Session cookies are cached in config/.linkedin-session.json (gitignored).
 * Login only happens when the session expires.
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import yaml from 'js-yaml';

// ── Config ──────────────────────────────────────────────────────────

const PORTALS_PATH      = 'portals.yml';
const SECRETS_PATH      = 'config/secrets.yml';
const SESSION_PATH      = 'config/.linkedin-session.json';
const SCAN_HISTORY_PATH = 'data/scan-history.tsv';
const PIPELINE_PATH     = 'data/pipeline.md';
const APPLICATIONS_PATH = 'data/applications.md';

const SCROLL_DELAY_MS  = 1500;
const ACTION_DELAY_MS  = () => 800 + Math.random() * 1200; // 0.8–2s
const MAX_RESULTS      = 25; // per query — LinkedIn shows 25 per page

// ── Credentials ─────────────────────────────────────────────────────

function loadCredentials() {
  // 1. Env vars
  if (process.env.LINKEDIN_EMAIL && process.env.LINKEDIN_PASSWORD) {
    return { email: process.env.LINKEDIN_EMAIL, password: process.env.LINKEDIN_PASSWORD };
  }
  // 2. secrets.yml
  if (existsSync(SECRETS_PATH)) {
    const secrets = yaml.load(readFileSync(SECRETS_PATH, 'utf-8'));
    if (secrets?.linkedin?.email && secrets?.linkedin?.password) {
      return { email: secrets.linkedin.email, password: secrets.linkedin.password };
    }
  }
  console.error('No LinkedIn credentials found.');
  console.error('Set LINKEDIN_EMAIL + LINKEDIN_PASSWORD env vars, or create config/secrets.yml.');
  console.error('See config/secrets.example.yml for the format.');
  process.exit(1);
}

// ── Session ──────────────────────────────────────────────────────────

function loadSession() {
  if (existsSync(SESSION_PATH)) {
    try {
      return JSON.parse(readFileSync(SESSION_PATH, 'utf-8'));
    } catch { return null; }
  }
  return null;
}

function saveSession(cookies) {
  writeFileSync(SESSION_PATH, JSON.stringify(cookies, null, 2), 'utf-8');
}

// ── Dedup ────────────────────────────────────────────────────────────

function loadSeenUrls() {
  const seen = new Set();
  if (existsSync(SCAN_HISTORY_PATH)) {
    for (const line of readFileSync(SCAN_HISTORY_PATH, 'utf-8').split('\n').slice(1)) {
      const url = line.split('\t')[0];
      if (url) seen.add(url.trim());
    }
  }
  if (existsSync(PIPELINE_PATH)) {
    for (const match of readFileSync(PIPELINE_PATH, 'utf-8').matchAll(/- \[[ x]\] (https?:\/\/\S+)/g)) {
      seen.add(match[1]);
    }
  }
  if (existsSync(APPLICATIONS_PATH)) {
    for (const match of readFileSync(APPLICATIONS_PATH, 'utf-8').matchAll(/https?:\/\/[^\s|)]+/g)) {
      seen.add(match[0]);
    }
  }
  return seen;
}

// ── Title filter ─────────────────────────────────────────────────────

function buildTitleFilter(titleFilter) {
  const positive = (titleFilter?.positive || []).map(k => k.toLowerCase());
  const negative = (titleFilter?.negative || []).map(k => k.toLowerCase());
  return (title) => {
    const lower = title.toLowerCase();
    return (positive.length === 0 || positive.some(k => lower.includes(k)))
      && !negative.some(k => lower.includes(k));
  };
}

// ── Pipeline / history writers ────────────────────────────────────────

function appendToPipeline(offers) {
  if (!offers.length) return;
  let text = readFileSync(PIPELINE_PATH, 'utf-8');
  const marker = '## Pendientes';
  const idx = text.indexOf(marker);
  const afterMarker = idx + marker.length;
  const nextSection = text.indexOf('\n## ', afterMarker);
  const insertAt = nextSection === -1 ? text.length : nextSection;
  const block = '\n' + offers.map(o => `- [ ] ${o.url} | ${o.company} | ${o.title}`).join('\n') + '\n';
  text = text.slice(0, insertAt) + block + text.slice(insertAt);
  writeFileSync(PIPELINE_PATH, text, 'utf-8');
}

function appendToHistory(offers, date) {
  if (!existsSync(SCAN_HISTORY_PATH)) {
    writeFileSync(SCAN_HISTORY_PATH, 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\n', 'utf-8');
  }
  const lines = offers.map(o =>
    `${o.url}\t${date}\tlinkedin\t${o.title}\t${o.company}\tadded\t${o.location || ''}`
  ).join('\n') + '\n';
  appendFileSync(SCAN_HISTORY_PATH, lines, 'utf-8');
}

// ── LinkedIn login ────────────────────────────────────────────────────

async function isLoggedIn(page) {
  try {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    const url = page.url().toString();
    return url.includes('/feed') && !url.includes('/login');
  } catch { return false; }
}

async function login(page, email, password) {
  console.log('Logging in to LinkedIn...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Try multiple known selectors for the email field
  await page.waitForSelector('#username', { timeout: 15000, state: 'visible' });
  await page.fill('#username', email);
  await page.waitForTimeout(ACTION_DELAY_MS());

  // Dismiss passkey prompt if present
  try {
    const passkeyBtn = page.locator('button:has-text("Sign in with a passkey"), button:has-text("Use a passkey")');
    if (await passkeyBtn.count() > 0) {
      const dismissBtn = page.locator('button:has-text("Sign in with a password"), button:has-text("Use password")');
      if (await dismissBtn.count() > 0) await dismissBtn.click();
    }
  } catch { /* no passkey prompt */ }

  await page.waitForSelector('#password', { timeout: 10000, state: 'visible' });
  await page.fill('#password', password);
  await page.waitForTimeout(ACTION_DELAY_MS());

  await Promise.all([
    page.waitForNavigation({ timeout: 40000, waitUntil: 'domcontentloaded' }),
    page.click('[type="submit"]'),
  ]);
  await page.waitForTimeout(2000);

  const currentUrl = page.url().toString();
  if (currentUrl.includes('/checkpoint') || currentUrl.includes('/challenge') || currentUrl.includes('/login')) {
    console.error('\n⚠️  LinkedIn needs verification. Complete it in the browser window, then press Enter...');
    await new Promise(resolve => process.stdin.once('data', resolve));
  }

  console.log('Login successful.');
}

// ── Job search ────────────────────────────────────────────────────────

async function searchJobs(page, query, titleFilter, seenUrls) {
  const { keywords, location, remote_only } = query;

  const params = new URLSearchParams({ keywords, location: location || '' });
  if (remote_only) params.set('f_WT', '2'); // LinkedIn remote filter
  params.set('sortBy', 'DD'); // Most recent first

  const url = `https://www.linkedin.com/jobs/search/?${params}`;
  console.log(`  Searching: "${keywords}" in "${location || 'Anywhere'}"${remote_only ? ' (remote)' : ''}`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(SCROLL_DELAY_MS);

  // Scroll to load more results
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(SCROLL_DELAY_MS);
  }

  // Extract job cards
  const jobs = await page.evaluate(() => {
    const results = [];
    const cards = document.querySelectorAll('.job-card-container, [data-job-id]');
    for (const card of cards) {
      // Title: prefer strong/span inside the job link, fall back to link text
      const linkEl = card.querySelector('a[href*="/jobs/view/"]');
      if (!linkEl) continue;

      const rawHref = linkEl.href || '';
      const match = rawHref.match(/\/jobs\/view\/(\d+)/);
      if (!match) continue;
      const jobUrl = `https://www.linkedin.com/jobs/view/${match[1]}/`;

      // Title from link text (strip whitespace/newlines)
      const title = (linkEl.querySelector('strong, span, [class*="title"]')?.textContent || linkEl.textContent || '').replace(/\s+/g, ' ').trim();

      // Company: primary-description or subtitle element
      const companyEl = card.querySelector(
        '.job-card-container__primary-description, [class*="primary-description"], [class*="company-name"], [class*="subtitle"]'
      );
      const company = (companyEl?.textContent || '').replace(/\s+/g, ' ').trim();

      // Location
      const locationEl = card.querySelector('[class*="metadata-item"], [class*="location"]');
      const location = (locationEl?.textContent || '').replace(/\s+/g, ' ').trim();

      if (!title) continue;
      results.push({ title, company, url: jobUrl, location });
    }
    return results;
  });

  const newOffers = [];
  for (const job of jobs) {
    if (!job.title || !job.url) continue;
    if (!titleFilter(job.title)) continue;
    if (seenUrls.has(job.url)) continue;
    seenUrls.add(job.url); // prevent intra-scan dupes
    newOffers.push(job);
  }

  console.log(`    Found ${jobs.length} listings → ${newOffers.length} new after filter+dedup`);
  return newOffers;
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun   = args.includes('--dry-run');
  const headless = args.includes('--headless');

  // Load config
  if (!existsSync(PORTALS_PATH)) {
    console.error('portals.yml not found.');
    process.exit(1);
  }
  const config = yaml.load(readFileSync(PORTALS_PATH, 'utf-8'));
  const queries = (config.linkedin_queries || []).filter(q => q.enabled !== false);

  if (!queries.length) {
    console.error('No linkedin_queries found in portals.yml. Add some and retry.');
    process.exit(1);
  }

  const titleFilter = buildTitleFilter(config.title_filter);
  const seenUrls    = loadSeenUrls();
  const creds       = loadCredentials();
  const date        = new Date().toISOString().slice(0, 10);

  console.log(`LinkedIn scan — ${date}`);
  console.log(`Queries: ${queries.length} | Headless: ${headless} | Dry run: ${dryRun}\n`);

  // Launch browser
  const browser = await chromium.launch({
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  // Restore session if available
  const savedCookies = loadSession();
  if (savedCookies?.length) {
    await context.addCookies(savedCookies);
    console.log('Restored saved session.');
  }

  const page = await context.newPage();

  // Check / perform login
  const loggedIn = await isLoggedIn(page);
  if (!loggedIn) {
    await login(page, creds.email, creds.password);
  } else {
    console.log('Session active — skipping login.');
  }

  // Save fresh cookies
  const cookies = await context.cookies();
  saveSession(cookies);

  // Run queries
  const allNewOffers = [];
  for (const query of queries) {
    try {
      const offers = await searchJobs(page, query, titleFilter, seenUrls);
      allNewOffers.push(...offers);
      await page.waitForTimeout(ACTION_DELAY_MS() * 2); // pause between queries
    } catch (err) {
      console.error(`  ✗ Query "${query.keywords}": ${err.message}`);
    }
  }

  await browser.close();

  // Write results
  if (!dryRun && allNewOffers.length > 0) {
    appendToPipeline(allNewOffers);
    appendToHistory(allNewOffers, date);
  }

  // Summary
  console.log(`\n${'━'.repeat(45)}`);
  console.log(`LinkedIn Scan — ${date}`);
  console.log(`${'━'.repeat(45)}`);
  console.log(`Queries run:       ${queries.length}`);
  console.log(`New offers added:  ${allNewOffers.length}`);

  if (allNewOffers.length > 0) {
    console.log('\nNew offers:');
    for (const o of allNewOffers) {
      console.log(`  + ${o.company} | ${o.title} | ${o.location || 'N/A'}`);
      console.log(`    ${o.url}`);
    }
    if (dryRun) {
      console.log('\n(dry run — run without --dry-run to save)');
    } else {
      console.log(`\nSaved to ${PIPELINE_PATH}`);
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
