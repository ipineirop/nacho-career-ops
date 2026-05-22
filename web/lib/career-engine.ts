import Anthropic from '@anthropic-ai/sdk';

// =====================================================================
// Career engine — the part of the system that reads a candidate's CV and
// produces a structured career *profile*: who they are, the through-line
// of their trajectory, the role shapes they can credibly target next, and
// the derived signals the rest of the product scores against.
//
// This is intentionally a standalone module (not inline in a route) so it
// can be reused: onboarding, re-generation on language switch, and the
// evaluate flow all consume the same profiling brain. It encodes the
// career-ops methodology (evidence-grounded, anti-template, seniority-
// calibrated, the three archetype shapes) rather than ad-hoc prompt text.
// =====================================================================

// Bound the per-call time and retries so a slow/overloaded model response
// fails fast inside the function instead of hanging until the platform's
// gateway timeout (which surfaces to the user as a 504).
const client = new Anthropic({ timeout: 90_000, maxRetries: 1 });

const MODEL = 'claude-sonnet-4-6';

export type SeniorityLevel =
  | 'ic' | 'senior_ic' | 'manager' | 'director' | 'head_of' | 'vp' | 'c_level';

export type ArchetypeId = 'core-fit' | 'stretch-up' | 'adjacent-pivot';

export interface EngineRole {
  company: string;
  role: string;
  years: number;
  current: boolean;
  metrics: string[];
  seniority?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  industry?: string;
}

export interface EngineArchetype {
  id: ArchetypeId;
  type: string;
  name: string;
  description: string;
  why: string;
}

export interface EngineEducation {
  institution: string;
  degree?: string;
  field?: string;
  year?: string | number;
  country?: string;
}

export interface CareerProfile {
  // ── Parsed CV ──────────────────────────────────────────────────
  roles: EngineRole[];
  summary: string;
  skills: string[];
  education: EngineEducation[];
  languages: string[];
  trajectory: string;
  industries: string[];
  primaryCity?: string;
  primaryCountry?: string; // ISO 3166-1 alpha-2, derived by the engine
  countryCount?: number;
  yearSpan?: number;
  pageCount?: number;
  format?: string;
  isLinkedInExport?: boolean;
  outcomeCount?: number;
  unclearRoles?: number;
  unsure: Array<{ field: string; extracted: string; confidence: string }>;
  // ── Engine synthesis ───────────────────────────────────────────
  seniorityLevel: SeniorityLevel | null;
  primaryFunction: string | null;
  pattern: string;
  patternDetail: string;
  trajectoryVelocity: 'slow' | 'steady' | 'fast' | 'stalled' | null;
  domainConsistency: 'specialist' | 'generalist' | 'pivoting' | null;
  strengths: string[];
  gaps: string[];
  archetypes: EngineArchetype[];
}

export interface AnalyzeResult {
  markdownCv: string;
  profile: CareerProfile;
}

const EMPTY_PROFILE: CareerProfile = {
  roles: [], summary: '', skills: [], education: [], languages: [], trajectory: '',
  industries: [], unsure: [], seniorityLevel: null, primaryFunction: null,
  pattern: '', patternDetail: '', trajectoryVelocity: null, domainConsistency: null,
  strengths: [], gaps: [], archetypes: [],
};

// The methodology is split into two passes so neither blocks the upload
// request for too long:
//   1. PARSE  — fast, factual extraction (markdown + structured facts).
//   2. SYNTH  — interpretive (pattern, archetypes, strengths/gaps); runs as a
//      separate request once the user leaves the role-review step.
// The hard rules exist because LLMs love to flatten everyone into a generic
// startup-operator template — the engine must reflect the ACTUAL candidate.

const PARSE_SYSTEM = `You read one candidate's CV and produce (1) a clean markdown CV and (2) a structured JSON of FACTS. You are precise, evidence-grounded, and never embellish or invent companies, metrics, titles, or dates. Calibrate seniority strictly to the evidence.`;

const PARSE_TASK = `Convert the CV into clean, well-structured markdown:
- Start with a ## Summary (2–3 sentences).
- For each role: ### Company · Role (Year–Year) with 3–5 bullets including metrics.
- Preserve ALL numbers, percentages, money, and dates exactly.
- Include ## Education and ## Skills.

Then, on its own line after the markdown, output a JSON block in EXACTLY this shape:
\`\`\`json
{
  "roles": [
    { "company": "Company", "role": "Title", "years": 2, "current": false, "metrics": ["metric 1"], "startDate": "2019", "endDate": "2021", "seniority": "senior", "location": "City, Country", "industry": "fintech" }
  ],
  "summary": "Senior financial journalist with 12 years across Chilean and Mexican markets…",
  "skills": ["investigative reporting", "data journalism", "editing"],
  "education": [{ "institution": "Universidad de Chile", "degree": "BA", "field": "Journalism", "year": 2011, "country": "CL" }],
  "languages": ["Spanish", "English"],
  "trajectory": "Reporter to senior business editor over 8 years",
  "industries": ["financial journalism", "media"],
  "primaryCity": "Santiago",
  "primaryCountry": "CL",
  "countryCount": 2,
  "pageCount": 2,
  "format": "PDF",
  "isLinkedInExport": false,
  "outcomeCount": 11,
  "unclearRoles": 1,
  "yearSpan": 12,
  "unsure": [{ "field": "team size at X", "extracted": "12", "confidence": "low" }],
  "seniorityLevel": "senior_ic",
  "primaryFunction": "financial journalism"
}
\`\`\`

Field rules:
- roles: include startDate/endDate as 4-digit years when known; current:true if it's the present role.
- summary: 2–3 sentence professional summary, factual, in the candidate's field.
- skills: concrete skills/tools, flat array.
- education: array of { institution, degree, field, year, country }; empty array if none.
- industries: 1–3 lowercase domain labels the candidate actually worked in. Specific — never default to "tech".
- primaryCity: most-recent city; omit if genuinely unknown.
- primaryCountry: ISO 3166-1 alpha-2 code for the primary city / current location (e.g. "MX", "CL", "US"). Derive it from the city or country in the CV. Omit only if location is truly unknown.
- countryCount: distinct countries worked in.
- seniorityLevel: one of ic | senior_ic | manager | director | head_of | vp | c_level — calibrated to the CV.
- primaryFunction: the candidate's core function in their own field's vocabulary (e.g. "financial journalism", "backend engineering", "ICU nursing", "corporate litigation").`;

const SYNTH_SYSTEM = `You are a career strategist. Given a candidate's already-extracted factual profile, you produce an interpretive read: their through-line and the role shapes they can credibly target next. Evidence-grounded; cite real companies/domains from the facts. Never flatten them into a generic "startup operator / GM / Series B–C" template unless the facts genuinely are that. Calibrate to their real seniority and profession.`;

function synthTask(factsJson: string): string {
  return `Here is the candidate's extracted factual profile:
\`\`\`json
${factsJson}
\`\`\`

Output ONLY a JSON block in EXACTLY this shape:
\`\`\`json
{
  "trajectoryVelocity": "steady",
  "domainConsistency": "specialist",
  "strengths": ["cross-market financial reporting", "source network across LatAm"],
  "gaps": ["no people-management scope yet"],
  "pattern": "You're a financial journalist whose scope keeps growing while the craft stays constant.",
  "patternDetail": "Across 2 countries and multiple markets, your editorial function held steady while the categories shifted — durable across messy beats, less obviously placed at outlets wanting a single-vertical specialist.",
  "archetypes": [
    { "id": "core-fit", "type": "core-fit", "name": "Senior business reporter/editor, LatAm financial media", "description": "The seat you've effectively run for years.", "why": "Diario Financiero plus staff roles at El Mercurio map onto a senior editorial seat." },
    { "id": "stretch-up", "type": "stretch up", "name": "Editorial director, regional business newsroom", "description": "A step up in org scope — strategy and commissioning.", "why": "Your cross-country coverage gives the multi-market breadth editorial leadership needs." },
    { "id": "adjacent-pivot", "type": "adjacent pivot", "name": "Content lead, fintech or B2B SaaS", "description": "Same storytelling craft, applied to a company's content engine.", "why": "Financial-journalism rigor transfers directly to credible B2B content." }
  ]
}
\`\`\`

Rules:
- trajectoryVelocity: slow | steady | fast | stalled. domainConsistency: specialist | generalist | pivoting.
- strengths / gaps: 2–4 each, concrete and grounded in the facts.
- pattern: ONE second-person sentence ("You're a …"). Avoid the word "operator" unless they truly are one.
- patternDetail: 1–2 sentences citing concrete scope.
- archetypes: EXACTLY 3, ids in order core-fit, stretch-up, adjacent-pivot. Must fit this candidate's real field and seniority. The journalist example is an EXAMPLE — generate fresh.`;
}

function parseLangInstruction(lang?: string): string {
  return lang === 'es'
    ? 'Write the "summary" in neutral LatAm SPANISH. Keep the markdown CV in its original language; keep JSON keys and enum ids in English.'
    : 'Write the "summary" in ENGLISH.';
}

function synthLangInstruction(lang?: string): string {
  return lang === 'es'
    ? 'Write pattern, patternDetail, strengths, gaps, and every archetype name/description/why in neutral LatAm SPANISH. Keep JSON keys and enum ids (core-fit, senior_ic, etc.) in English.'
    : 'Write pattern, patternDetail, strengths, gaps, and archetype text in ENGLISH.';
}

const VALID_SENIORITY = new Set<SeniorityLevel>([
  'ic', 'senior_ic', 'manager', 'director', 'head_of', 'vp', 'c_level',
]);

function coerceProfile(raw: unknown): CareerProfile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const numOrU = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

  const seniority = str(r.seniorityLevel) as SeniorityLevel;
  const archetypes = arr<Record<string, unknown>>(r.archetypes)
    .slice(0, 3)
    .map((a) => ({
      id: (['core-fit', 'stretch-up', 'adjacent-pivot'].includes(str(a.id)) ? str(a.id) : 'core-fit') as ArchetypeId,
      type: str(a.type),
      name: str(a.name),
      description: str(a.description),
      why: str(a.why),
    }))
    .filter((a) => a.name);

  return {
    roles: arr<EngineRole>(r.roles),
    summary: str(r.summary),
    skills: arr<string>(r.skills),
    education: arr<EngineEducation>(r.education),
    languages: arr<string>(r.languages),
    trajectory: str(r.trajectory),
    industries: arr<string>(r.industries),
    primaryCity: str(r.primaryCity) || undefined,
    primaryCountry: str(r.primaryCountry).toUpperCase().slice(0, 2) || undefined,
    countryCount: numOrU(r.countryCount),
    yearSpan: numOrU(r.yearSpan),
    pageCount: numOrU(r.pageCount),
    format: str(r.format) || undefined,
    isLinkedInExport: typeof r.isLinkedInExport === 'boolean' ? r.isLinkedInExport : undefined,
    outcomeCount: numOrU(r.outcomeCount),
    unclearRoles: numOrU(r.unclearRoles),
    unsure: arr(r.unsure),
    seniorityLevel: VALID_SENIORITY.has(seniority) ? seniority : null,
    primaryFunction: str(r.primaryFunction) || null,
    pattern: str(r.pattern),
    patternDetail: str(r.patternDetail),
    trajectoryVelocity: (['slow', 'steady', 'fast', 'stalled'].includes(str(r.trajectoryVelocity))
      ? str(r.trajectoryVelocity) : null) as CareerProfile['trajectoryVelocity'],
    domainConsistency: (['specialist', 'generalist', 'pivoting'].includes(str(r.domainConsistency))
      ? str(r.domainConsistency) : null) as CareerProfile['domainConsistency'],
    strengths: arr<string>(r.strengths),
    gaps: arr<string>(r.gaps),
    archetypes,
  };
}

export type ProfileSynthesis = Pick<
  CareerProfile,
  'pattern' | 'patternDetail' | 'trajectoryVelocity' | 'domainConsistency' | 'strengths' | 'gaps' | 'archetypes'
>;

function coerceSynth(raw: unknown): ProfileSynthesis {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const archetypes = arr<Record<string, unknown>>(r.archetypes)
    .slice(0, 3)
    .map((a) => ({
      id: (['core-fit', 'stretch-up', 'adjacent-pivot'].includes(str(a.id)) ? str(a.id) : 'core-fit') as ArchetypeId,
      type: str(a.type),
      name: str(a.name),
      description: str(a.description),
      why: str(a.why),
    }))
    .filter((a) => a.name);
  return {
    pattern: str(r.pattern),
    patternDetail: str(r.patternDetail),
    trajectoryVelocity: (['slow', 'steady', 'fast', 'stalled'].includes(str(r.trajectoryVelocity))
      ? str(r.trajectoryVelocity) : null) as CareerProfile['trajectoryVelocity'],
    domainConsistency: (['specialist', 'generalist', 'pivoting'].includes(str(r.domainConsistency))
      ? str(r.domainConsistency) : null) as CareerProfile['domainConsistency'],
    strengths: arr<string>(r.strengths),
    gaps: arr<string>(r.gaps),
    archetypes,
  };
}

function extractJsonBlock(text: string): string | null {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1];
  const bare = text.match(/(\{[\s\S]*\})/);
  return bare ? bare[1] : null;
}

/**
 * PASS 1 — fast, factual. Read a CV (text or base64 PDF) and produce a clean
 * markdown CV plus the structured facts. Synthesis fields are left empty;
 * call synthesizeProfile() for those. Throws if the model call fails.
 */
export async function parseCv(input: {
  text?: string;
  base64?: string;
  lang?: string;
}): Promise<AnalyzeResult> {
  const { text, base64, lang } = input;
  const instructions = `${PARSE_TASK}\n\n${parseLangInstruction(lang)}`;

  const userContent = base64
    ? [
        { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } },
        { type: 'text' as const, text: `The CV is the PDF above.\n\n${instructions}` },
      ]
    : `${instructions}\n\nCV text:\n${(text ?? '').slice(0, 20000)}`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: PARSE_SYSTEM,
    messages: [{ role: 'user', content: userContent }],
  });

  const block = message.content.find((b) => b.type === 'text') as { text: string } | undefined;
  const fullOutput = block?.text ?? '';
  const jsonStr = extractJsonBlock(fullOutput);
  const markdownCv = fullOutput.replace(/```json[\s\S]*?```/, '').trim();

  let profile = EMPTY_PROFILE;
  if (jsonStr) {
    try { profile = coerceProfile(JSON.parse(jsonStr)); }
    catch { /* keep empty profile; markdown CV is still useful */ }
  }
  return { markdownCv, profile };
}

/**
 * PASS 2 — interpretive. Given the already-extracted facts, produce the
 * pattern, archetypes, strengths/gaps. Small input, runs in its own request
 * so it never blocks the upload path. Throws if the model call fails.
 */
export async function synthesizeProfile(input: {
  facts: Partial<CareerProfile>;
  lang?: string;
}): Promise<ProfileSynthesis> {
  const { facts, lang } = input;
  // Send only the fields that inform synthesis (keeps the prompt small).
  const slim = {
    roles: (facts.roles ?? []).map((r) => ({ company: r.company, role: r.role, years: r.years, current: r.current, metrics: r.metrics, industry: r.industry })),
    summary: facts.summary,
    industries: facts.industries,
    trajectory: facts.trajectory,
    seniorityLevel: facts.seniorityLevel,
    primaryFunction: facts.primaryFunction,
    primaryCity: facts.primaryCity,
    countryCount: facts.countryCount,
    yearSpan: facts.yearSpan,
  };
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYNTH_SYSTEM,
    messages: [{ role: 'user', content: `${synthTask(JSON.stringify(slim))}\n\n${synthLangInstruction(lang)}` }],
  });
  const block = message.content.find((b) => b.type === 'text') as { text: string } | undefined;
  const jsonStr = extractJsonBlock(block?.text ?? '');
  if (!jsonStr) return coerceSynth({});
  try { return coerceSynth(JSON.parse(jsonStr)); }
  catch { return coerceSynth({}); }
}

// ── Re-translation ─────────────────────────────────────────────────
// The interpretive fields are generated in the language at upload time.
// When the user switches EN↔ES afterward, translate just those fields
// (fast + cheap) rather than re-running the whole CV analysis.

export interface TranslatableProfile {
  pattern: string;
  patternDetail: string;
  strengths: string[];
  gaps: string[];
  archetypes: EngineArchetype[];
}

export async function translateProfile(
  fields: TranslatableProfile,
  targetLang: 'en' | 'es',
): Promise<TranslatableProfile> {
  const langName = targetLang === 'es' ? 'neutral LatAm Spanish' : 'English';
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You translate career-profile copy into ${langName}. Preserve meaning, tone, and any proper nouns (company names, product names). Return ONLY a JSON object with the same shape you receive — do not add commentary, do not change ids or types.`,
    messages: [{
      role: 'user',
      content: `Translate the human-readable text in this JSON to ${langName}. Keep keys, archetype "id", and archetype "type" UNCHANGED. Translate only pattern, patternDetail, strengths[], gaps[], and each archetype's name/description/why.\n\n\`\`\`json\n${JSON.stringify(fields)}\n\`\`\``,
    }],
  });

  const block = message.content.find((b) => b.type === 'text') as { text: string } | undefined;
  const out = block?.text ?? '';
  const m = out.match(/```json\s*([\s\S]*?)\s*```/) ?? out.match(/(\{[\s\S]*\})/);
  if (!m) return fields; // translation failed — keep original
  try {
    const parsed = JSON.parse(m[1]) as Partial<TranslatableProfile>;
    return {
      pattern: typeof parsed.pattern === 'string' ? parsed.pattern : fields.pattern,
      patternDetail: typeof parsed.patternDetail === 'string' ? parsed.patternDetail : fields.patternDetail,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : fields.strengths,
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : fields.gaps,
      archetypes: Array.isArray(parsed.archetypes) && parsed.archetypes.length === fields.archetypes.length
        ? parsed.archetypes.map((a, i) => ({
            id: fields.archetypes[i].id,
            type: fields.archetypes[i].type,
            name: typeof a?.name === 'string' ? a.name : fields.archetypes[i].name,
            description: typeof a?.description === 'string' ? a.description : fields.archetypes[i].description,
            why: typeof a?.why === 'string' ? a.why : fields.archetypes[i].why,
          }))
        : fields.archetypes,
    };
  } catch {
    return fields;
  }
}

// ── Markdown rendering ─────────────────────────────────────────────
// Render a CV markdown document from STRUCTURED data. This is what makes
// the markdown a derived view: when roles are corrected (or any structured
// field changes), we re-render rather than letting the prose drift.

export interface RenderableRole {
  company?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  seniority?: string;
  location?: string;
  metrics?: string[];
}

export interface RenderableCv {
  summary?: string;
  roles: RenderableRole[];
  education?: EngineEducation[];
  skills?: string[];
  languages?: string[];
}

function span(r: RenderableRole): string {
  const start = (r.startDate ?? '').toString().slice(0, 4);
  const end = r.current ? 'Present' : (r.endDate ?? '').toString().slice(0, 4);
  if (!start && !end) return '';
  return ` (${[start, end].filter(Boolean).join('–')})`;
}

export function renderCvMarkdown(cv: RenderableCv): string {
  const out: string[] = [];

  if (cv.summary?.trim()) {
    out.push(`## Summary\n\n${cv.summary.trim()}`);
  }

  const roles = (cv.roles ?? []).filter((r) => r.company || r.role);
  if (roles.length) {
    const blocks = roles.map((r) => {
      const head = `### ${r.company ?? 'Company'} · ${r.role ?? 'Role'}${span(r)}`;
      const bullets = (r.metrics ?? []).filter(Boolean).map((m) => `- ${m}`);
      return [head, ...bullets].join('\n');
    });
    out.push(`## Experience\n\n${blocks.join('\n\n')}`);
  }

  const edu = (cv.education ?? []).filter((e) => e.institution || e.degree);
  if (edu.length) {
    const items = edu.map((e) => {
      const left = [e.degree, e.field].filter(Boolean).join(', ');
      const right = [e.institution, e.year].filter(Boolean).join(', ');
      return `- ${[left, right].filter(Boolean).join(' — ')}`;
    });
    out.push(`## Education\n\n${items.join('\n')}`);
  }

  if (cv.skills?.length) {
    out.push(`## Skills\n\n${cv.skills.join(', ')}`);
  }

  if (cv.languages?.length) {
    out.push(`## Languages\n\n${cv.languages.join(', ')}`);
  }

  return out.join('\n\n').trim();
}
