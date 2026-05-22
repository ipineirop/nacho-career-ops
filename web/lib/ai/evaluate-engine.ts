import Anthropic from '@anthropic-ai/sdk';
import { getDb, roles, evaluations, evaluationGaps, companies, userCareerHistory, userPreferences, userEvents, NewRole } from '@/lib/db';
import { eq, and, isNull } from 'drizzle-orm';
import { loadCandidateContext } from './candidate-context';
import { resolveCompany } from '@/lib/matching/resolve';
import { matchPastEmployer, type UserEmployer, type PastEmployerMatch } from '@/lib/matching/past-employer';
import { getFile } from '@/lib/github';

interface EvaluationInput {
  jd: string;
  url?: string;
  userId: string;
  // What the user pasted: a recruiter DM, a posting URL, or raw role details.
  // Drives the verdict word (a DM you "Reply" to; a posting you "Pursue").
  source?: 'dm' | 'url' | 'jd';
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

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function evaluateRole(input: EvaluationInput): Promise<EvaluationResult> {
  const db = getDb();

  // Step 0: Check for duplicate evaluation if sourceRef provided
  if (input.url) {
    const sourceRef = input.url;
    const existingEval = await db
      .select({ id: evaluations.id, roleId: evaluations.roleId })
      .from(evaluations)
      .innerJoin(roles, eq(evaluations.roleId, roles.id))
      .where(and(eq(evaluations.userId, input.userId), eq(roles.sourceRef, sourceRef)))
      .limit(1);

    if (existingEval.length > 0) {
      throw new Error(
        `This role has already been evaluated. Role ID: ${existingEval[0].roleId}`
      );
    }
  }

  // Step 1: Extract role info from JD using Claude
  const extractionPrompt = `Extract the job role information from this job description or recruiter message:

${input.jd}

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
  "source": "${input.url || 'paste'}"
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
  const sourceRef = `${input.url || company_name}-${role_title}`;
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
      source: input.url ? 'url' : 'paste',
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
      rawJdText: input.jd,
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

  // Universal methodology only (no santifer-specific _profile.md). Best-effort:
  // if the repo files are unreachable, fall back to an empty methodology rather
  // than failing the whole evaluation.
  const [shared, oferta] = await Promise.all([
    getFile('modes/_shared.md').then((f) => f.content).catch(() => ''),
    getFile('modes/oferta.md').then((f) => f.content).catch(() => ''),
  ]);

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
${input.jd}

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
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 } as any],
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
  const verdict = deriveVerdict(score, input.source);
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

  // Step 7: Persist the evaluation.
  const evaluationValues: any = {
    userId: input.userId,
    roleId,
    overallScore: Math.round(score * 20), // 0–100 for the dashboard/tracker
    recommendation,
    verdictSummary,
    fullReportMarkdown: reportMarkdown,
    verdictPayload: payload, // editorial verdict (drives the live hero + future report parity)
    modelUsed: 'claude-sonnet-4-6',
    promptVersion: '2.0-modes',
    displayId,
    pastEmployerMatch, // §2.3 — persisted so the verdict renders on revisit
  };

  const evaluation = await db.insert(evaluations).values(evaluationValues as any).returning({ id: evaluations.id });
  const evaluationId = evaluation[0].id;

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
