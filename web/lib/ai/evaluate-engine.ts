import Anthropic from '@anthropic-ai/sdk';
import { getDb, roles, evaluations, evaluationGaps, companies, userCareerHistory, userPreferences, userEvents, NewRole } from '@/lib/db';
import { eq, and, isNull } from 'drizzle-orm';
import { loadCandidateContext } from './candidate-context';
import { resolveCompany } from '@/lib/matching/resolve';
import { matchPastEmployer, type UserEmployer, type PastEmployerMatch } from '@/lib/matching/past-employer';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { lintBriefBilingual, type BriefLintFinding } from './brief-linter';
import { buildFallbackEditorsNote } from './brief-fallback';

interface EvaluationInput {
  jd: string;
  url?: string;
  userId: string;
  // What the user pasted: a recruiter DM, a posting URL, or raw role details.
  // Drives the verdict word (a DM you "Reply" to; a posting you "Pursue").
  source?: 'dm' | 'url' | 'jd';
  // When set, UPDATE this existing evaluations row instead of inserting a new
  // one. Used by the FAB+panel flow: the row is created up-front by the route
  // (status='processing') and filled in here when the background work finishes.
  existingEvaluationId?: string;
}

export type Verdict = 'reply' | 'pursue' | 'watch' | 'skip';
export type Legitimacy = 'High Confidence' | 'Proceed with Caution' | 'Suspicious';

// Presentation of Block D (comp & demand) + the user's stored floor/target.
// The model fills this from web-searched market data; code clamps markPct.
export interface CompStrip {
  state: 'amber' | 'ok' | 'positive';
  rangeLabel: string;   // "$280k – $340k total · referential"
  gradeLabel: string;   // "Orientation"
  gradeDots: string;    // "○○○"
  vintage: string;      // "Data Q1 2026 · 3 mo old"
  word: string;         // "Fits", "Strong", "Below"
  gloss: string;        // "Floor clears the band by $10k · $50k headroom"
  floorValue: number;
  ceilingValue: number;
  markValue: number;
  markPct: number;      // 0–100, marker position on the band
  markLabel: string;    // "your floor · $290k"
  statusGlyph: string;  // "✓ Within range"
  statusText: string;
  actionGlyph: string;  // "→ Next move"
  actionText: string;
  source: string;       // "Levels.fyi · Director band · n=58 · Q1 2026"
}

// Structured payload the editorial verdict UI renders (the markdown report is
// the full A–G; this is the concise hero derived from it).
export interface VerdictPayload {
  verdict: Verdict;
  score: number;            // 1–5 (canonical)
  reasoningLede: string;    // strong opening sentence
  reasoningBody: string;    // 1–2 sentences after the lede
  gaps: Array<{ text: string; severity: 'hard' | 'soft' }>;
  comp: CompStrip | null;   // null when comp is undisclosed and unsearchable
  legitimacy: Legitimacy;
  patternHits: string[];    // §3.5b — "things you said you're avoiding"
}

interface EvaluationResult {
  roleId: string;
  evaluationId: string;
  displayId: string;
  score: number;            // 1–5
  recommendation: 'apply' | 'hold' | 'pass';
  verdict: Verdict;
  payload: VerdictPayload;
  reportMarkdown: string;   // canonical A–G report
  // §3.5b — qualitative "things you said you're avoiding" hits, model-judged.
  patternHits: string[];
  // §2.3 — past-employer match record (or null).
  pastEmployerMatch: PastEmployerMatch | null;
}

// Score band → verdict word, per modes/_shared.md interpretation, adjusted for
// source: a recruiter DM is something you "Reply" to; a posting you "Pursue".
function deriveVerdict(score: number, source: EvaluationInput['source']): Verdict {
  const isDm = source === 'dm';
  if (score < 3.5) return 'skip';
  if (isDm) return 'reply';        // worth engaging the person
  return score >= 4.0 ? 'pursue' : 'watch';
}

const URL_ONLY = /^https?:\/\/\S+$/i;

/**
 * Read an evaluation mode file from the deployment filesystem (bundled via
 * next.config outputFileTracingIncludes). cwd is the web app root on Vercel and
 * locally. Best-effort: returns '' on failure so the eval degrades, not crashes.
 */
async function readModeFile(rel: string): Promise<string> {
  try {
    return await readFile(join(process.cwd(), rel), 'utf-8');
  } catch (err) {
    console.error('readModeFile failed', rel, (err as Error)?.message);
    return '';
  }
}

/**
 * Fetch a job posting URL and return readable text. Prefers JSON-LD JobPosting
 * (most ATS + LinkedIn guest pages embed it), falls back to stripped HTML.
 * Returns null when the page yields too little (e.g. a hard login wall).
 */
async function fetchJobText(url: string): Promise<string | null> {
  let html = '';
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const parts: string[] = [];

  // 1) JSON-LD JobPosting — the cleanest source when present.
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].trim());
      for (const node of Array.isArray(data) ? data : [data]) {
        if (node && (node['@type'] === 'JobPosting' || node.title || node.description)) {
          const org = node.hiringOrganization?.name ?? '';
          const loc = node.jobLocation?.address?.addressLocality ?? node.jobLocation?.address?.addressRegion ?? '';
          if (node.title) parts.push(`Title: ${node.title}`);
          if (org) parts.push(`Company: ${org}`);
          if (loc) parts.push(`Location: ${loc}`);
          if (node.description) parts.push(stripHtml(String(node.description)));
        }
      }
    } catch { /* not valid JSON-LD, skip */ }
  }

  // 2) Fallback: <title> + stripped body text.
  if (parts.join(' ').length < 200) {
    const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
    if (title) parts.unshift(`Title: ${title}`);
    parts.push(stripHtml(html));
  }

  const text = parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 12000);
  return text.length >= 200 ? text : null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function evaluateRole(input: EvaluationInput): Promise<EvaluationResult> {
  const db = getDb();

  // Step 0a: If the input is a bare URL (or a URL was passed), fetch the page so
  // there's actual content to evaluate. The user pastes a link; we read it.
  const bareUrl = URL_ONLY.test(input.jd.trim()) ? input.jd.trim() : undefined;
  const effectiveUrl = input.url || bareUrl;
  let jdText = input.jd.trim();
  if (bareUrl || (input.url && jdText === input.url)) {
    const fetched = await fetchJobText(effectiveUrl as string);
    if (!fetched) {
      throw new Error(
        "I couldn't read that link — the site may require a login (LinkedIn often does). Paste the role description or the recruiter's message instead.",
      );
    }
    jdText = `Source URL: ${effectiveUrl}\n\n${fetched}`;
  }

  // Step 0b: Check for duplicate evaluation if a URL identifies the role.
  // Skip when we're refilling an existing row (the route already created it).
  if (effectiveUrl && !input.existingEvaluationId) {
    const existingEval = await db
      .select({ id: evaluations.id, roleId: evaluations.roleId })
      .from(evaluations)
      .innerJoin(roles, eq(evaluations.roleId, roles.id))
      .where(and(eq(evaluations.userId, input.userId), eq(roles.sourceRef, effectiveUrl)))
      .limit(1);

    if (existingEval.length > 0) {
      throw new Error(
        `This role has already been evaluated. Role ID: ${existingEval[0].roleId}`
      );
    }
  }

  // Step 1: Extract role info from the posting text using Claude
  const extractionPrompt = `Extract the job role information from this job description or recruiter message:

${jdText}

Return a JSON object with:
{
  "company_name": "Company Name",
  "role_title": "Role Title",
  "role_archetype": "Operations Director|Technical PM|LLMOps|etc",
  "function": "Operations|Engineering|Product|etc",
  "domain": "fintech|marketplace|saas|etc",
  "seniority_level": "senior_ic|manager|director|head_of|vp",
  "location": "Mexico City, MX|Remote|etc",
  "remote_policy": "remote|hybrid|onsite",
  "team_description": "Brief description of the team",
  "comp_range_low": null or number,
  "comp_range_high": null or number,
  "comp_currency": "USD|MXN|etc",
  "key_requirements": ["req1", "req2", "req3", ...],
  "source": "${effectiveUrl || 'paste'}"
}`;

  const extractionResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: extractionPrompt,
      },
    ],
  });

  let roleData: Partial<NewRole>;
  try {
    const jsonMatch = (extractionResponse.content[0] as any).text.match(/\{[\s\S]*\}/);
    roleData = JSON.parse(jsonMatch![0]);
  } catch {
    throw new Error('Failed to extract role information');
  }

  // Normalize field names (Claude returns snake_case, schema is camelCase)
  const company_name = (roleData as any).company_name;
  const role_title = (roleData as any).role_title;
  const role_archetype = (roleData as any).role_archetype;
  const comp_range_low = (roleData as any).comp_range_low;
  const comp_range_high = (roleData as any).comp_range_high;
  const comp_currency = (roleData as any).comp_currency;
  const seniority_level = (roleData as any).seniority_level;
  const remote_policy = (roleData as any).remote_policy;
  const team_description = (roleData as any).team_description;

  // Step 2: Find or create company record
  let companyId: string | undefined;
  if (company_name) {
    const existingCompany = await db
      .select()
      .from(companies)
      .where(eq(companies.name, company_name))
      .limit(1);

    if (existingCompany.length > 0) {
      companyId = existingCompany[0].id;
    } else {
      const newCompany = await db.insert(companies).values({
        name: company_name,
      }).returning({ id: companies.id });
      companyId = newCompany[0].id;
    }
  }

  // Step 2.5: Past-employer matching (spec §3) — resolve the role's company to
  // a canonical id and check it against where the user already worked. Pure
  // logic in lib/matching; this only loads the user's employers + preferences.
  const pastEmployerMatch = await computePastEmployerMatch(db, input.userId, company_name);

  // Step 3: Create or find role record
  const sourceRef = `${effectiveUrl || company_name}-${role_title}`;
  let roleId: string;
  const existingRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.sourceRef, sourceRef))
    .limit(1);

  if (existingRoles.length > 0) {
    roleId = existingRoles[0].id;
  } else {
    const roleValues: any = {
      source: effectiveUrl ? 'url' : 'paste',
      sourceRef: sourceRef,
      companyName: company_name || 'Unknown',
      roleTitle: role_title || 'Unknown Role',
      roleArchetype: role_archetype,
      function: roleData.function,
      domain: roleData.domain,
      seniorityLevel: seniority_level,
      location: roleData.location,
      remotePolicy: remote_policy,
      teamDescription: team_description,
      compCurrency: comp_currency,
      rawJdText: jdText,
    };

    if (companyId) roleValues.companyId = companyId;
    if (comp_range_low) roleValues.compRangeLow = comp_range_low;
    if (comp_range_high) roleValues.compRangeHigh = comp_range_high;

    const newRole = await db.insert(roles).values(roleValues).returning({ id: roles.id });
    roleId = newRole[0].id;
  }

  // Step 4: Run the CANONICAL evaluation. The engine is the /career-ops modes
  // (oferta.md + _shared.md = universal methodology), executed PER-USER against
  // this candidate's stored onboarding profile. The single-user _profile.md file
  // is NOT loaded — candidate-context (DB) is the per-user personalization layer.
  const ctx = await loadCandidateContext(input.userId);
  const candidateBlock = ctx.hasProfile
    ? `${ctx.markdown}${ctx.cvMarkdown ? `\n\n## CV\n${ctx.cvMarkdown.slice(0, 6000)}` : ''}`
    : `- (No profile on file yet — score conservatively and note that the candidate hasn't completed onboarding.)`;

  // Universal methodology only (no santifer-specific _profile.md). Read from the
  // deployment filesystem (bundled via outputFileTracingIncludes) — NOT the GitHub
  // API, which depends on a token that can expire. Best-effort: fall back to empty
  // methodology rather than failing the whole evaluation.
  const [shared, oferta] = await Promise.all([
    readModeFile('modes/_shared.md'),
    readModeFile('modes/oferta.md'),
  ]);
  if (!shared || !oferta) {
    console.error('Modes not loaded from filesystem', { sharedLen: shared.length, ofertaLen: oferta.length, cwd: process.cwd() });
  }

  const compTargetLine = [
    ctx.compFloorUsd != null ? `floor ≈ ${Math.round(ctx.compFloorUsd).toLocaleString('en-US')} USD/yr` : null,
    ctx.compTargetUsd != null ? `target ≈ ${Math.round(ctx.compTargetUsd).toLocaleString('en-US')} USD/yr` : null,
    ctx.compCurrency ? `display currency ${ctx.compCurrency}` : null,
  ].filter(Boolean).join(' · ') || 'not stated';

  const evalSystem = `# IMPORTANT — API CONTEXT
You are running the career-ops evaluation via the Anthropic API. You have the web_search tool for Block D (comp & demand) and Block G (company hiring signals) — use it; never invent comp or layoff data. All other inputs are pre-loaded below.

# Evaluation methodology (universal — apply to THIS candidate)
${shared}

---

${oferta}

---

# How this differs from the CLI
- The candidate's personalization (target archetypes / North Stars, comp floor & target, deal-breakers, avoid signals) comes from their stored profile below — NOT from any example archetypes in the methodology above. The methodology's archetype list is illustrative of the method; use THIS candidate's own targets.
- Produce the full A–G report in English (the candidate's UI is English). Do not use the word "JD" in any candidate-facing prose; say "the posting" or "the role".`;

  const evalUser = `Evaluate the role below for this candidate. Produce the complete canonical report (Blocks A–G; H only if score ≥ 4.5), then a machine-readable verdict block.

# Candidate profile (onboarding — authoritative)
${candidateBlock}

Candidate comp targets (for the comp strip marker): ${compTargetLine}

If the profile lists DEAL-BREAKERS, treat them as hard filters: if the role clearly violates one, say so in Block B / red flags, and keep the score low (≤ 3.0) regardless of other strengths.

# The role to evaluate
${jdText}

---

OUTPUT FORMAT — produce exactly two parts:

1. The full Markdown report. Start with the canonical header:
   # Evaluation: {Company} — {Role}
   **Date:** ${new Date().toISOString().split('T')[0]}
   **Archetype:** {best-fit from the candidate's own target archetypes}
   **Score:** {X.X}/5
   **Legitimacy:** {High Confidence | Proceed with Caution | Suspicious}

   Then Blocks A–G (## A) … through ## G) Posting Legitimacy), per the methodology.

2. After the report, a fenced \`\`\`json code block containing EXACTLY this shape (no comments):
{
  "score": 4.2,
  "legitimacy": "High Confidence",
  "reasoningLede": "One strong opening sentence — the headline of the verdict.",
  "reasoningBody": "1–2 sentences expanding the lede: the core fit, the main tension.",
  "gaps": [{ "text": "What the posting doesn't say, or a real gap. Use **bold** for the key term.", "severity": "soft" }],
  "patternHits": [],
  "comp": {
    "state": "ok",
    "rangeLabel": "$280k – $340k total · referential",
    "gradeLabel": "Orientation",
    "gradeDots": "○○○",
    "vintage": "Data Q1 2026 · 3 mo old",
    "word": "Fits",
    "gloss": "FLOOR CLEARS THE BAND BY $10K",
    "floorValue": 280000,
    "ceilingValue": 340000,
    "markValue": 290000,
    "markPct": 17,
    "markLabel": "your floor · $290k",
    "statusGlyph": "✓ Within range",
    "statusText": "Sits at the low end. Equity not in the band — treat as upside.",
    "actionGlyph": "→ Next move",
    "actionText": "Ask for total comp + equity refresh before any call.",
    "source": "Levels.fyi · band · n=247 · Q1 2026"
  }
}

JSON rules:
- "score": number 1–5 (one decimal), MUST equal the report's **Score**.
- "legitimacy": MUST equal the report's **Legitimacy** (this is Block G; it does NOT change the score).
- "gaps": 2–4 items from Block B / what the posting omits. severity "hard" (deal-breaker / blocker) or "soft".
- "patternHits": ONLY if the profile listed things to avoid. Each is one short line prefixed with its dimension (Industry/Culture/Title). Empty array [] otherwise. No numeric penalties.
- "comp": Block D presented for the candidate. Use web_search for the market band; numbers in the candidate's display currency where possible. "state" = "amber" (below floor / stale / undisclosed), "ok" (within range), or "positive" (clears comfortably / strong). "markValue" = the candidate's floor. "markPct" = where markValue sits between floorValue and ceilingValue, 0–100. If comp is genuinely undisclosed AND no market estimate is possible, set "comp": null. Keep "gloss" SHORT and uppercase-friendly.`;

  let reportMarkdown = '';
  let payloadRaw: any = {};
  try {
    const evalResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: evalSystem,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 } as any],
      messages: [{ role: 'user', content: evalUser }],
    });
    const fullText = evalResponse.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');
    // Split the report (markdown) from the trailing ```json verdict block.
    const jsonFence = fullText.match(/```json\s*([\s\S]*?)```\s*$/);
    if (jsonFence) {
      reportMarkdown = fullText.slice(0, jsonFence.index).trim();
      try { payloadRaw = JSON.parse(jsonFence[1]); } catch { payloadRaw = {}; }
    } else {
      // No fenced block — fall back to the last {...} object, keep report as-is.
      reportMarkdown = fullText.trim();
      const obj = fullText.match(/\{[\s\S]*\}\s*$/);
      if (obj) { try { payloadRaw = JSON.parse(obj[0]); } catch { payloadRaw = {}; } }
    }
  } catch (err) {
    console.error('Canonical evaluation failed:', err);
    throw new Error('Failed to evaluate the role');
  }

  // Step 5: Normalize the structured payload.
  const score = Math.max(1, Math.min(5, Number(payloadRaw.score) || 3));
  // A fetched URL is a posting (Pursue/Watch/Skip), even if pasted in the DM tab.
  const verdict = deriveVerdict(score, effectiveUrl ? 'url' : input.source);
  const recommendation: 'apply' | 'hold' | 'pass' =
    verdict === 'skip' ? 'pass' : verdict === 'watch' ? 'hold' : 'apply';

  const patternHits: string[] = Array.isArray(payloadRaw.patternHits)
    ? payloadRaw.patternHits.filter((h: unknown) => typeof h === 'string' && h.trim()).map((h: string) => h.trim())
    : [];

  const gaps: Array<{ text: string; severity: 'hard' | 'soft' }> = Array.isArray(payloadRaw.gaps)
    ? payloadRaw.gaps
        .filter((g: any) => g && typeof g.text === 'string' && g.text.trim())
        .map((g: any) => ({ text: String(g.text).trim(), severity: (g.severity === 'hard' ? 'hard' : 'soft') as 'hard' | 'soft' }))
    : [];

  const legitimacy: Legitimacy =
    payloadRaw.legitimacy === 'Suspicious' || payloadRaw.legitimacy === 'Proceed with Caution'
      ? payloadRaw.legitimacy
      : 'High Confidence';

  let comp: CompStrip | null = null;
  const c = payloadRaw.comp;
  if (c && typeof c === 'object') {
    const floorValue = Number(c.floorValue) || 0;
    const ceilingValue = Number(c.ceilingValue) || 0;
    const markValue = Number(c.markValue) || 0;
    const span = ceilingValue - floorValue;
    const markPct = Number.isFinite(Number(c.markPct))
      ? Math.max(0, Math.min(100, Number(c.markPct)))
      : span > 0 ? Math.max(0, Math.min(100, ((markValue - floorValue) / span) * 100)) : 0;
    comp = {
      state: c.state === 'positive' || c.state === 'ok' ? c.state : 'amber',
      rangeLabel: String(c.rangeLabel ?? ''),
      gradeLabel: String(c.gradeLabel ?? 'Orientation'),
      gradeDots: String(c.gradeDots ?? '○○○'),
      vintage: String(c.vintage ?? ''),
      word: String(c.word ?? ''),
      gloss: String(c.gloss ?? ''),
      floorValue, ceilingValue, markValue, markPct,
      markLabel: String(c.markLabel ?? ''),
      statusGlyph: String(c.statusGlyph ?? ''),
      statusText: String(c.statusText ?? ''),
      actionGlyph: String(c.actionGlyph ?? ''),
      actionText: String(c.actionText ?? ''),
      source: String(c.source ?? ''),
    };
  }

  const reasoningLede = String(payloadRaw.reasoningLede ?? '').trim();
  const reasoningBody = String(payloadRaw.reasoningBody ?? '').trim();
  const verdictSummary = [reasoningLede, reasoningBody].filter(Boolean).join(' ');

  const payload: VerdictPayload = {
    verdict, score, reasoningLede, reasoningBody, gaps, comp, legitimacy, patternHits,
  };

  // Guard against an empty report (model returned only JSON).
  if (!reportMarkdown) {
    reportMarkdown = `# Evaluation: ${company_name ?? 'Unknown'} — ${role_title ?? 'Role'}\n\n**Score:** ${score.toFixed(1)}/5\n**Legitimacy:** ${legitimacy}\n\n${verdictSummary}`;
  }

  // Step 6: Assign displayId (sequential report number)
  const userEvals = await db
    .select({ id: evaluations.id })
    .from(evaluations)
    .where(eq(evaluations.userId, input.userId));
  const nextNum = userEvals.length + 1;
  const displayId = String(nextNum).padStart(3, '0');

  // Step 7: Persist the evaluation. Two paths:
  //   • existingEvaluationId set (FAB+panel flow) → UPDATE the row created by
  //     the route, flipping status from 'processing' → 'complete'.
  //   • Otherwise → INSERT a fresh row (legacy /api/ai/evaluate path).
  const evaluationValues: Record<string, unknown> = {
    roleId,
    overallScore: Math.round(score * 20), // 0–100 for the dashboard/tracker
    recommendation,
    verdict, // denormalized top-level enum (migration 0011)
    verdictSummary,
    fullReportMarkdown: reportMarkdown,
    verdictPayload: payload,
    modelUsed: 'claude-sonnet-4-6',
    promptVersion: '2.0-modes',
    displayId,
    pastEmployerMatch,
    status: 'complete',
  };

  let evaluationId: string;
  if (input.existingEvaluationId) {
    const updated = await db
      .update(evaluations)
      .set(evaluationValues)
      .where(and(eq(evaluations.id, input.existingEvaluationId), eq(evaluations.userId, input.userId)))
      .returning({ id: evaluations.id });
    if (updated.length === 0) {
      throw new Error('Evaluation row not found or not owned by user');
    }
    evaluationId = updated[0].id;
  } else {
    evaluationValues.userId = input.userId;
    const evaluation = await db.insert(evaluations).values(evaluationValues as any).returning({ id: evaluations.id });
    evaluationId = evaluation[0].id;
  }

  // Store gaps so downstream (tracker / analysis) isn't empty.
  if (gaps.length > 0) {
    await db.insert(evaluationGaps).values(
      gaps.map((g) => ({
        evaluationId,
        gapDescription: g.text,
        blockerSeverity: g.severity,
      })) as any
    ).catch((err) => console.error('Failed to store gaps:', err));
  }

  return {
    roleId,
    evaluationId,
    displayId,
    score,
    recommendation,
    verdict,
    payload,
    reportMarkdown,
    patternHits,
    pastEmployerMatch: pastEmployerMatch ?? null,
  };
}

/**
 * Resolve the role's company and match it against the user's past employers
 * (spec §3). Applies the surface toggle (§1.2) and suppressions (§5.1), which
 * can only turn surfacing OFF. Logs instrumentation (§3.1.1 / §8). Best-effort:
 * never throws into the evaluate flow.
 */
async function computePastEmployerMatch(
  db: ReturnType<typeof getDb>,
  userId: string,
  companyName: string | undefined,
): Promise<PastEmployerMatch | null> {
  try {
    if (!companyName) {
      await db.insert(userEvents).values({
        userId,
        eventType: 'company_extraction_failed',
        eventData: { reason: 'no company_name extracted from input' },
      });
      return null;
    }

    const resolved = resolveCompany(companyName);

    // User's past employers, canonical-resolved at CV-parse time (A4).
    const history = await db
      .select({
        canonicalId: userCareerHistory.canonicalId,
        companyName: userCareerHistory.companyName,
        startedAt: userCareerHistory.startedAt,
        endedAt: userCareerHistory.endedAt,
      })
      .from(userCareerHistory)
      .where(eq(userCareerHistory.userId, userId));

    const employers: UserEmployer[] = history.map((h) => ({
      canonical_id: h.canonicalId ?? null,
      display_name: h.companyName,
      startedAt: h.startedAt as string | null,
      endedAt: h.endedAt as string | null,
    }));

    const match = matchPastEmployer(resolved, employers);

    // Apply preferences: surface toggle + per-canonical suppression can only
    // turn surfacing OFF, never on.
    const pref = (
      await db
        .select({
          surfaceOn: userPreferences.pastEmployerSurfaceOnMatch,
          suppressions: userPreferences.matchSuppressions,
        })
        .from(userPreferences)
        .where(and(eq(userPreferences.userId, userId), isNull(userPreferences.supersededAt)))
        .limit(1)
    )[0];

    if (pref) {
      if (pref.surfaceOn === false) match.surface = false;
      const suppressed = Array.isArray(pref.suppressions)
        ? (pref.suppressions as Array<{ canonical_id?: string }>).some(
            (s) => s.canonical_id && s.canonical_id === match.resolved_canonical_id,
          )
        : false;
      if (suppressed) match.surface = false;
    }

    // Instrumentation (§3.1.1 / §8): one event per resolution; unmatched
    // strings become the canonical-table backlog.
    await db.insert(userEvents).values({
      userId,
      eventType: resolved.resolved_canonical_id ? 'company_resolution' : 'company_unmatched',
      eventData: {
        role_company_input: companyName,
        normalized: resolved.normalized,
        resolved_canonical_id: resolved.resolved_canonical_id,
        resolved_confidence: resolved.resolved_confidence,
        matches_user_past_employer: match.matches_user_past_employer,
        surfaced: match.surface,
        relation: match.matches_via?.relation ?? null,
      },
    });

    return match;
  } catch (err) {
    console.error('computePastEmployerMatch failed:', err);
    return null;
  }
}

// ============================================================
// BRIEF GENERATION — Labra Brief editorial path
// ============================================================
// Companion to evaluateRole(): one Anthropic call per user per user-local day
// producing bilingual {en, es} for the editor's note, optional pick editorial
// summary, and every triggered signal body. Lint → regenerate-once-then-
// fallback per the handoff §5. The signals themselves are computed
// upstream by lib/brief/signals/* and supplied here as "seeds" so the LLM
// only writes prose, never invents facts.

/**
 * A signal occurrence handed to the LLM for body prose generation. The
 * orchestrator (lib/brief/signals/index.ts) has already verified the
 * grounding rule (each seed names at least one entity or count) and that
 * the user has not snoozed/dismissed this occurrence.
 */
export interface BriefSignalSeed {
  /** Stable per-render identifier. The API echoes this as `signal.id`. */
  id: string;
  type: 'freshness' | 'drift' | 'bar' | 'pipeline.cold' | 'pipeline.next';
  /** Entities/counts the body MUST reference (grounding tokens for the
   *  linter and for the prompt's voice instruction). Examples:
   *  ['Mercado Libre', '7d'], ['comp floor', '6mo']. */
  groundingTokens: string[];
  /** Structured context the LLM uses to draft the body. Kept open-ended;
   *  each signal module provides what its prose needs (cadence days,
   *  contact name, mismatch summary, etc.). */
  context: Record<string, unknown>;
}

export interface BriefPickSeed {
  /** Name, role, location — facts the LLM must reference verbatim. */
  groundingTokens: string[];
  /** Structured Pick context (company, role, segment, salary band). */
  context: Record<string, unknown>;
}

export interface BriefGenerateParams {
  userId: string;
  /** ISO date the Brief is keyed to (user-local). Used for logging only. */
  today: string;
  /** Issue number (days since users.createdAt). Powers the fallback. */
  issueNumber: number;
  /** Caller's normalized locale: 'en' or 'es'. Drives the locale instruction
   *  at the top of the prompt. The output still contains BOTH languages. */
  primaryLocale: 'en' | 'es';
  /** Compact prose summary of the user's pipeline + identity the LLM uses
   *  to write the editor's note. Built by the assembler. */
  userContext: string;
  signals: BriefSignalSeed[];
  pick: BriefPickSeed | null;
}

export interface BriefGenerated {
  editorsNote: { en: string; es: string };
  generationMethod: 'llm' | 'fallback';
  pickEditorialSummary: { en: string; es: string } | null;
  signals: Array<{ id: string; body: { en: string; es: string } }>;
  /** Anthropic usage for cost tracking (handoff §9.5). The assembler writes
   *  a user_events row of type 'brief.generation_cost' from this. */
  cost: {
    model: string;
    inputTokens: number;
    outputTokens: number;
  };
  /** Linter findings on the final accepted output (may be empty when the
   *  first attempt passes). Useful for offline quality monitoring. */
  lintFindings: {
    editorsNote: { en: BriefLintFinding[]; es: BriefLintFinding[] };
    signals: Array<{ id: string; en: BriefLintFinding[]; es: BriefLintFinding[] }>;
  };
}

const BRIEF_MODEL = 'claude-sonnet-4-6';

function buildBriefPrompt(
  params: BriefGenerateParams,
  strictRetry: boolean,
): string {
  const { primaryLocale, userContext, signals, pick, issueNumber } = params;

  const voiceRules = `
Voice (Labra Design System v2 §16):
- Candid, dry, informed. Peer-to-peer voice — not top-down, not salesy.
- First-person "I" / "yo" is allowed (this is the editor speaking).
- "We" / "nosotros" as the product is BANNED. Never write "we found", "we offer", "te traemos", "te encontramos".
- 1–3 sentences per editorial paragraph. Max 1 italicized phrase (markdown *like-this*) per language version.
- BOLD proper nouns (companies, people) with double-star markdown: \`**Kavak**\`, \`**Mercado Libre**\`, \`**Susana M.**\`. Bold is for entity identity, italic is for editorial emphasis. Bold spans are unlimited; use bold whenever a proper noun appears so the reader's eye can find the named entities at a glance.
- Every body MUST reference at least one specific entity by name or a specific count from the supplied data. Generic copy is rejected.

English-specific:
- Em-dashes "—" are allowed.

Spanish-specific (§17.1):
- Em-dashes "—" are BANNED. Use semicolons, colons, or commas.
- Use the "tú" form. Never "vos".

Both languages — banned phrases (do not use, exact-or-substring match):
- Gamification: amazing, incredible, spectacular, extraordinary / increíble, asombroso, espectacular, fantástico, extraordinario
- Urgency: don't miss out, last chance, exclusive, limited time / no te lo pierdas, imperdible, última oportunidad, exclusivo
- Sales CTAs: next level, take the next step, apply now, act now / lleva tu carrera al siguiente nivel, da el siguiente paso, transforma tu carrera, actúa ahora, aplica ya, no esperes más
- Product "we": we found, we bring you, we offer / te encontramos, encontramos para ti, te traemos, te ofrecemos
- Recruiter jargon: the standalone token "JD" — use "job description" / "descripción del puesto" instead.
- Universal: no emoji, no exclamation marks ("!" or "¡").
`.trim();

  const localeInstruction = `
The user's primary locale is "${primaryLocale}", but you MUST produce both English ("en") and Spanish ("es") versions of every text field regardless of the language of any source material you are given. This is non-negotiable: output language follows the user's preference, not the input.
`.trim();

  const strictPreamble = strictRetry
    ? `
You produced text on the previous attempt that violated the rules above. Re-read every voice rule and banned phrase. Then write tighter, more grounded prose. If you cannot ground a signal body in a named entity or count from its provided context, omit nothing — the linter will already have stopped it from reaching you.
`.trim()
    : '';

  const signalsJson = JSON.stringify(
    signals.map((s) => ({
      id: s.id,
      type: s.type,
      grounding_tokens: s.groundingTokens,
      context: s.context,
    })),
    null,
    2,
  );

  const pickJson = pick
    ? JSON.stringify(
        { grounding_tokens: pick.groundingTokens, context: pick.context },
        null,
        2,
      )
    : 'null';

  return `${strictPreamble ? strictPreamble + '\n\n' : ''}${localeInstruction}

${voiceRules}

You are writing today's Labra Brief — a daily editorial surface for a single user. The brief has its own masthead (issue number, date, city) rendered separately above this text. The editor's note is pure editorial; it is NEVER a status report.

HARD BANS on the editor's note text:
- Do NOT mention or repeat the issue number anywhere in the body (no "Issue №14", no "Number 10", no "№10").
- Do NOT mention the date anywhere in the body (no "today's date is…", no "Thursday May 14").
- Do NOT mention the city anywhere in the body (no "Mexico City", no "CDMX").
- Do NOT render pipeline counts as a literal sentence (no "1 pursue, 18 replies, nothing on watch" prose). Counts can inform what you choose to highlight, but the prose itself should be editorial.
- Do NOT open with metadata. Open with an editorial observation, an entity, or an "I" sentence.

The editor's note voice — STRUCTURE example only (locked DS v2). The entity names in this example are PLACEHOLDERS; you must NEVER use "Kavak", "Mercado Libre", "Clip", or any other name from this example unless it also appears in the SIGNALS or PICK data below:

  "Tight slate today. **<EntityA>** just opened a <role> seat that matches your scope at <PriorEmployer> almost *line-for-line*; I quieted 18 listings — mostly senior IC and one recruiter pitching comp 40% under market. The **<EntityB>** thread has gone quiet on day nine, and nine is the tipping window."

Observe the STRUCTURE: editorial opener, two named-and-bolded entities pulled from the user's actual data, one italic phrase, first-person "I quieted", specific numbers used as detail (18 listings, 40% under market, day nine) — never as raw count prose. Three sentences total. Entity names come from the SIGNALS / PICK / USER CONTEXT blocks below, NEVER invented.

The editor's note MUST name at least one specific entity from today's signals — a company name, person, or role title — and bold it with \`**Name**\`. The bolded entity MUST appear in the FIRST sentence. If no signals are firing today, anchor on a Pick entity, or on a single specific fact (a number with editorial framing). Abstract pipeline-vibe-checks ("the queue is calm", "nothing urgent today") without a named entity are rejected.

USER CONTEXT (data for your reasoning — do NOT echo verbatim):
${userContext}

SIGNALS TO WRITE BODIES FOR (each must reference its grounding_tokens):
${signalsJson}

PICK (write a pickEditorialSummary if non-null; otherwise return null):
${pickJson}

Return ONLY valid JSON matching this exact shape, no prose, no markdown fences:
{
  "editorsNote": { "en": "...", "es": "..." },
  "pickEditorialSummary": { "en": "...", "es": "..." } | null,
  "signals": [
    { "id": "<echo from input>", "body": { "en": "...", "es": "..." } }
  ]
}

Each signal body must reference at least one of its grounding_tokens, and should bold every proper noun it mentions. Stay within 1–3 sentences per text field. Use at most one \`*italicized*\` phrase per language version.`;
}

interface RawBriefOutput {
  editorsNote: { en: string; es: string };
  pickEditorialSummary: { en: string; es: string } | null;
  signals: Array<{ id: string; body: { en: string; es: string } }>;
}

function parseBriefResponse(text: string): RawBriefOutput {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in brief response');
  return JSON.parse(match[0]);
}

/**
 * Single Anthropic call producing the bilingual Brief payload, with one
 * stricter retry on linter rejection and a deterministic fallback for the
 * editor's note on second rejection. Signal bodies that can't pass on retry
 * are dropped from the returned `signals` array (callers should treat them
 * as omitted occurrences).
 */
export async function generateBrief(
  params: BriefGenerateParams,
): Promise<BriefGenerated> {
  // Grounding for the editor's note.
  //   - When signals are firing today, the only acceptable grounding is
  //     the name (or grounding token) of one of those signals. This stops
  //     the LLM from borrowing entity names from the prompt's STRUCTURE
  //     example (e.g. "Mercado Libre", "Kavak"); it must reference a
  //     real entity from the user's day.
  //   - When no signals fire, fall back to verdict-word / count tokens so
  //     a Brief without signals can still anchor on counts.
  //   - The issue number is NEVER a grounding token (prompt bans it).
  const signalTokens = params.signals.flatMap((s) => s.groundingTokens);
  const groundingForEditorsNote: string[] =
    signalTokens.length > 0
      ? signalTokens
      : [
          'pursue', 'pursues', 'pursuit',
          'reply', 'replies',
          'watch', 'watches',
          'avanza', 'avance', 'búsqueda', 'búsquedas',
          'responde', 'respuesta', 'respuestas',
          'observa', 'observación', 'observaciones',
          'candidatura', 'candidaturas',
        ];

  async function callOnce(strict: boolean): Promise<{
    raw: RawBriefOutput;
    usage: { input_tokens: number; output_tokens: number };
  }> {
    const prompt = buildBriefPrompt(params, strict);
    const response = await anthropic.messages.create({
      model: BRIEF_MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = (response.content[0] as { type: string; text: string }).text;
    return {
      raw: parseBriefResponse(text),
      usage: {
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
      },
    };
  }

  let attempt: { raw: RawBriefOutput; usage: { input_tokens: number; output_tokens: number } };
  let totalIn = 0;
  let totalOut = 0;

  try {
    attempt = await callOnce(false);
    totalIn += attempt.usage.input_tokens;
    totalOut += attempt.usage.output_tokens;
  } catch (err) {
    console.error('generateBrief: first call failed', (err as Error).message);
    return {
      editorsNote: buildFallbackEditorsNote({
        issueNumber: params.issueNumber,
        signalCount: params.signals.length,
      }),
      generationMethod: 'fallback',
      pickEditorialSummary: null,
      signals: [],
      cost: { model: BRIEF_MODEL, inputTokens: 0, outputTokens: 0 },
      lintFindings: {
        editorsNote: { en: [], es: [] },
        signals: [],
      },
    };
  }

  // Lint pass 1
  const noteLint1 = lintBriefBilingual(attempt.raw.editorsNote, groundingForEditorsNote);
  const signalLints1 = attempt.raw.signals.map((s) => {
    const seed = params.signals.find((x) => x.id === s.id);
    const tokens = seed ? seed.groundingTokens : [];
    return { id: s.id, body: s.body, lint: lintBriefBilingual(s.body, tokens) };
  });

  const anyFailure =
    !noteLint1.ok ||
    signalLints1.some((s) => !s.lint.ok);

  let finalNote = attempt.raw.editorsNote;
  let finalNoteFindings = noteLint1.ok
    ? { en: [], es: [] }
    : { en: noteLint1.en, es: noteLint1.es };
  let finalSignals = signalLints1
    .filter((s) => s.lint.ok)
    .map((s) => ({ id: s.id, body: s.body }));
  let finalSignalFindings = signalLints1.map((s) => ({
    id: s.id,
    en: s.lint.ok ? [] : s.lint.en,
    es: s.lint.ok ? [] : s.lint.es,
  }));
  let pick = attempt.raw.pickEditorialSummary;
  let method: 'llm' | 'fallback' = 'llm';

  if (anyFailure) {
    // Retry once with the strict preamble.
    try {
      const retry = await callOnce(true);
      totalIn += retry.usage.input_tokens;
      totalOut += retry.usage.output_tokens;

      const noteLint2 = lintBriefBilingual(retry.raw.editorsNote, groundingForEditorsNote);
      const signalLints2 = retry.raw.signals.map((s) => {
        const seed = params.signals.find((x) => x.id === s.id);
        const tokens = seed ? seed.groundingTokens : [];
        return { id: s.id, body: s.body, lint: lintBriefBilingual(s.body, tokens) };
      });

      // Editor's note: take retry if it passed; otherwise fall back.
      if (noteLint2.ok) {
        finalNote = retry.raw.editorsNote;
        finalNoteFindings = { en: [], es: [] };
      } else {
        finalNote = buildFallbackEditorsNote({
          issueNumber: params.issueNumber,
          signalCount: params.signals.length,
        });
        finalNoteFindings = { en: noteLint2.en, es: noteLint2.es };
        method = 'fallback';
      }

      // Signals: keep only those that pass on the retry. (Signals from the
      // first attempt are discarded on retry to keep prose consistent within
      // a single Brief.)
      finalSignals = signalLints2
        .filter((s) => s.lint.ok)
        .map((s) => ({ id: s.id, body: s.body }));
      finalSignalFindings = signalLints2.map((s) => ({
        id: s.id,
        en: s.lint.ok ? [] : s.lint.en,
        es: s.lint.ok ? [] : s.lint.es,
      }));

      pick = retry.raw.pickEditorialSummary;
    } catch (err) {
      console.error('generateBrief: retry failed', (err as Error).message);
      // Keep first-attempt-passing parts; fall back the note if it failed.
      if (!noteLint1.ok) {
        finalNote = buildFallbackEditorsNote({
          issueNumber: params.issueNumber,
          signalCount: params.signals.length,
        });
        method = 'fallback';
      }
    }
  }

  return {
    editorsNote: finalNote,
    generationMethod: method,
    pickEditorialSummary: pick,
    signals: finalSignals,
    cost: { model: BRIEF_MODEL, inputTokens: totalIn, outputTokens: totalOut },
    lintFindings: {
      editorsNote: finalNoteFindings,
      signals: finalSignalFindings,
    },
  };
}

