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

const client = new Anthropic();

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

export interface CareerProfile {
  // ── Parsed CV ──────────────────────────────────────────────────
  roles: EngineRole[];
  languages: string[];
  trajectory: string;
  industries: string[];
  primaryCity?: string;
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
  roles: [], languages: [], trajectory: '', industries: [], unsure: [],
  seniorityLevel: null, primaryFunction: null, pattern: '', patternDetail: '',
  trajectoryVelocity: null, domainConsistency: null, strengths: [], gaps: [],
  archetypes: [],
};

// The methodology. Two parts: faithful CV parsing, then an evidence-grounded
// synthesis. The hard rules exist because LLMs love to flatten everyone into
// a generic startup-operator template — the engine must reflect the ACTUAL
// candidate (a nurse gets nursing archetypes, a lawyer gets legal ones).
const SYSTEM_PROMPT = `You are the profiling engine for a career-search product. You read one candidate's CV and produce (1) a clean markdown CV and (2) a structured JSON profile. You are precise, evidence-grounded, and never embellish.

Hard rules:
- Use ONLY what's in the CV. Never invent companies, metrics, titles, or dates.
- Calibrate seniority to the evidence. Do not promote a junior to Director or demote a VP.
- Be specific to THIS candidate's real profession. Never flatten them into a generic "startup operator / GM / Series B–C" template unless the CV genuinely is that.
- Cite concrete evidence (real company names, domains, outcomes) in the "why" of each archetype and in patternDetail.`;

const TASK_PROMPT = `Convert the CV into clean, well-structured markdown:
- Start with a ## Summary (2–3 sentences).
- For each role: ### Company · Role (Year–Year) with 3–5 bullets including metrics.
- Preserve ALL numbers, percentages, money, and dates exactly.
- Include ## Education and ## Skills.

Then, on its own line after the markdown, output a JSON block in EXACTLY this shape:
\`\`\`json
{
  "roles": [
    { "company": "Company", "role": "Title", "years": 2, "current": false, "metrics": ["metric 1"], "location": "City, Country", "industry": "fintech" }
  ],
  "languages": ["Spanish", "English"],
  "trajectory": "Reporter to senior business editor over 8 years",
  "industries": ["financial journalism", "media"],
  "primaryCity": "Santiago",
  "countryCount": 2,
  "pageCount": 2,
  "format": "PDF",
  "isLinkedInExport": false,
  "outcomeCount": 11,
  "unclearRoles": 1,
  "yearSpan": 12,
  "unsure": [{ "field": "team size at X", "extracted": "12", "confidence": "low" }],
  "seniorityLevel": "senior_ic",
  "primaryFunction": "financial journalism",
  "trajectoryVelocity": "steady",
  "domainConsistency": "specialist",
  "strengths": ["cross-market financial reporting", "source network across LatAm"],
  "gaps": ["no people-management scope yet"],
  "pattern": "You're a financial journalist whose scope keeps growing while the craft stays constant.",
  "patternDetail": "Across 2 countries and multiple markets, your editorial function held steady while the categories shifted — durable across messy beats, less obviously placed at outlets wanting a single-vertical specialist.",
  "archetypes": [
    { "id": "core-fit", "type": "core-fit", "name": "Senior business reporter/editor, LatAm financial media", "description": "The seat you've effectively run for years.", "why": "Diario Financiero plus staff roles at El Mercurio map directly onto a senior editorial seat." },
    { "id": "stretch-up", "type": "stretch up", "name": "Editorial director, regional business newsroom", "description": "A step up in org scope — strategy and commissioning rather than producing copy.", "why": "Your cross-country coverage gives the multi-market breadth editorial leadership needs." },
    { "id": "adjacent-pivot", "type": "adjacent pivot", "name": "Content lead, fintech or B2B SaaS", "description": "Same storytelling craft, applied to a company's content engine.", "why": "Financial-journalism rigor transfers directly to credible B2B content." }
  ]
}
\`\`\`

Field rules:
- industries: 1–3 lowercase domain labels the candidate actually worked in. Specific — never default to "tech".
- primaryCity: most-recent city; omit if genuinely unknown.
- countryCount: distinct countries worked in.
- seniorityLevel: one of ic | senior_ic | manager | director | head_of | vp | c_level — calibrated to the CV.
- primaryFunction: the candidate's core function in their own field's vocabulary (e.g. "financial journalism", "backend engineering", "ICU nursing", "corporate litigation").
- trajectoryVelocity: slow | steady | fast | stalled — pace of scope/title growth.
- domainConsistency: specialist | generalist | pivoting.
- strengths / gaps: 2–4 each, concrete and CV-grounded.
- pattern: ONE second-person sentence ("You're a …") naming who they are and their through-line. Avoid the word "operator" unless they truly are one.
- patternDetail: 1–2 sentences citing concrete scope from the CV.
- archetypes: EXACTLY 3, ids in order core-fit, stretch-up, adjacent-pivot. name/description/why must fit THIS candidate's real field and seniority. The journalist example above is an EXAMPLE — generate fresh for the real CV.`;

function langInstruction(lang?: string): string {
  return lang === 'es'
    ? 'Write pattern, patternDetail, strengths, gaps, and every archetype name/description/why in neutral LatAm SPANISH. Keep the markdown CV in its original language, and keep JSON keys and enum ids (core-fit, senior_ic, etc.) in English.'
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
    languages: arr<string>(r.languages),
    trajectory: str(r.trajectory),
    industries: arr<string>(r.industries),
    primaryCity: str(r.primaryCity) || undefined,
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

/**
 * Read a CV (as extracted text or a base64 PDF) and produce the full career
 * profile plus a clean markdown CV. Throws if the model call fails; callers
 * decide how to surface that.
 */
export async function analyzeCv(input: {
  text?: string;
  base64?: string;
  lang?: string;
}): Promise<AnalyzeResult> {
  const { text, base64, lang } = input;
  const instructions = `${TASK_PROMPT}\n\n${langInstruction(lang)}`;

  const userContent = base64
    ? [
        { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } },
        { type: 'text' as const, text: `The CV is the PDF above.\n\n${instructions}` },
      ]
    : `${instructions}\n\nCV text:\n${(text ?? '').slice(0, 20000)}`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const block = message.content.find((b) => b.type === 'text') as { text: string } | undefined;
  const fullOutput = block?.text ?? '';

  const jsonMatch = fullOutput.match(/```json\s*([\s\S]*?)\s*```/);
  const markdownCv = fullOutput.replace(/```json[\s\S]*?```/, '').trim();

  let profile = EMPTY_PROFILE;
  if (jsonMatch) {
    try { profile = coerceProfile(JSON.parse(jsonMatch[1])); }
    catch { /* keep empty profile; markdown CV is still useful */ }
  }

  return { markdownCv, profile };
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
