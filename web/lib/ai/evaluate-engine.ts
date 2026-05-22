import Anthropic from '@anthropic-ai/sdk';
import { getDb, roles, evaluations, evaluationDimensions, evaluationGaps, evaluationProofPoints, companies, NewRole, NewEvaluation } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { loadCandidateContext } from './candidate-context';

interface EvaluationInput {
  jd: string;
  url?: string;
  userId: string;
}

interface EvaluationResult {
  roleId: string;
  evaluationId: string;
  score: number;
  recommendation: 'apply' | 'hold' | 'pass';
  summary: string;
  dimensions: Array<{
    name: string;
    grade: string;
    score: number;
    reasoning: string;
  }>;
  gaps: Array<{
    description: string;
    severity: 'hard' | 'soft' | 'none';
    mitigation: string;
  }>;
  proofPoints: Array<{
    requirement: string;
    evidence: string;
    matchStrength: 'match' | 'partial' | 'miss';
  }>;
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

  // Step 4: Score the evaluation — personalized to the candidate's stored
  // profile (from onboarding), not a hardcoded template.
  const ctx = await loadCandidateContext(input.userId);
  const candidateBlock = ctx.hasProfile
    ? `${ctx.markdown}${ctx.cvMarkdown ? `\n\n## CV\n${ctx.cvMarkdown.slice(0, 6000)}` : ''}`
    : `- (No profile on file yet — score conservatively and note that the candidate hasn't completed onboarding.)`;

  const scoringPrompt = `You are an expert career consultant evaluating a job role for a specific candidate. Use ONLY the candidate's profile below — do not assume a generic persona.

Job Description:
${input.jd}

Candidate's profile:
${candidateBlock}

If the candidate profile lists DEAL-BREAKERS, treat them as hard filters: if the role clearly violates one, say so explicitly in Red Flags (severity "hard"), cap the recommendation at "pass", and keep the overall score low regardless of other strengths.

Score this opportunity on the following dimensions, each from 0-100:

1. **CV Match** (0-100): How well the role aligns with the candidate's actual experience, skills, seniority, and function (use the Career History + Skills + CV).
2. **North Star** (0-100): How well it matches their chosen Target Archetypes and target seniority/industries.
3. **Compensation** (0-100): Pay vs the candidate's stated floor/target. Respect the comp basis — if their target is net (take-home), compare like-for-like; note currency. If the JD omits comp, say so and score on market estimate.
4. **Culture/Company** (0-100): Cultural fit, stability, growth — and fit with their stated work modes, geographies/current location, and "in their own words" preferences.
5. **Red Flags** (-30 to 0): Concerns, including any deal-breaker violations (hard) and location/work-mode/comp mismatches (soft).

Each dimension should also have:
- A letter grade (A, B+, B, B-, C, etc.)
- A 2-3 sentence reasoning

Return a JSON object:
{
  "dimensions": [
    {
      "name": "CV Match",
      "grade": "B+",
      "score": 75,
      "reasoning": "Your experience in FinOps aligns well with payment processing requirements..."
    },
    ...
  ],
  "red_flags": [
    {
      "flag": "description",
      "severity": "soft|hard|none",
      "mitigation": "how to address"
    },
    ...
  ],
  "overall_score": 78,
  "recommendation": "apply|hold|pass",
  "summary": "One paragraph summary of the opportunity and recommendation"
}`;

  const scoringResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: scoringPrompt,
      },
    ],
  });

  let scoringData: any;
  try {
    const jsonMatch = (scoringResponse.content[0] as any).text.match(/\{[\s\S]*\}/);
    scoringData = JSON.parse(jsonMatch![0]);
  } catch {
    throw new Error('Failed to score evaluation');
  }

  // Step 5: Calculate weighted overall score (0-5 scale)
  const dimensionScores = scoringData.dimensions.map((d: any) => d.score / 20);
  const redFlagAdjustment = Math.min(0, scoringData.red_flags.reduce((acc: number, flag: any) => {
    if (flag.severity === 'hard') return acc - 0.5;
    if (flag.severity === 'soft') return acc - 0.2;
    return acc;
  }, 0));

  const overallScore = Math.max(0, Math.min(5, (dimensionScores.reduce((a: number, b: number) => a + b) / dimensionScores.length) + redFlagAdjustment));

  // Step 6: Generate proof points mapping
  const proofPointsPrompt = `Given this job description and the requirements, identify what proof points from the candidate's experience would demonstrate capability. Return a JSON array:

[
  {
    "requirement": "5+ years in fraud/disputes operations",
    "evidence": "How the candidate's CV demonstrates this",
    "matchStrength": "match|partial|miss"
  },
  ...
]

Job description:
${input.jd}

Return a JSON array with 5-8 proof points.`;

  const proofPointsResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: proofPointsPrompt,
      },
    ],
  });

  let proofPointsData: Array<any> = [];
  try {
    const jsonMatch = (proofPointsResponse.content[0] as any).text.match(/\[[\s\S]*\]/);
    proofPointsData = JSON.parse(jsonMatch![0]);
  } catch {
    proofPointsData = [];
  }

  // Step 7: Generate full report markdown
  const reportMarkdown = `# ${company_name} · ${role_title}

**Date:** ${new Date().toISOString().split('T')[0]}

## Overall Score: ${Math.round(overallScore * 20)}/100

**Recommendation:** ${scoringData.recommendation.toUpperCase()}

${scoringData.summary}

## Dimension Scores

${scoringData.dimensions.map((d: any) => `### ${d.name}: ${d.grade} (${d.score}/100)
${d.reasoning}`).join('\n\n')}

## Red Flags & Concerns

${scoringData.red_flags && scoringData.red_flags.length > 0 ? scoringData.red_flags.map((flag: any) => `- **${flag.flag || flag.description}** (${flag.severity})
  - Mitigation: ${flag.mitigation}`).join('\n') : 'None identified'}
`;

  // Step 8: Assign displayId (sequential report number)
  const userEvals = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.userId, input.userId));
  const nextNum = userEvals.length + 1;
  const displayId = String(nextNum).padStart(3, '0');

  // Step 9: Store evaluation and related data
  const evaluationValues: any = {
    userId: input.userId,
    roleId,
    overallScore: Math.round(overallScore * 20), // Convert to 0-100
    recommendation: scoringData.recommendation,
    verdictSummary: scoringData.summary,
    fullReportMarkdown: reportMarkdown,
    modelUsed: 'claude-sonnet-4-6',
    promptVersion: '1.0',
    displayId,
  };

  if (scoringData.dimensions[0]) evaluationValues.cvMatchScore = scoringData.dimensions[0].score;
  if (scoringData.dimensions[1]) evaluationValues.northStarScore = scoringData.dimensions[1].score;
  if (scoringData.dimensions[2]) evaluationValues.compScore = scoringData.dimensions[2].score;
  if (scoringData.dimensions[3]) evaluationValues.culturalScore = scoringData.dimensions[3].score;
  if (redFlagAdjustment) evaluationValues.redFlagAdjustment = redFlagAdjustment * 20;

  const evaluation = await db.insert(evaluations).values(evaluationValues as any).returning({ id: evaluations.id });
  const evaluationId = evaluation[0].id;

  // Store dimensions
  await db.insert(evaluationDimensions).values(
    scoringData.dimensions.map((d: any) => ({
      evaluationId,
      dimensionName: d.name.toLowerCase().replace(/ /g, '_'),
      grade: d.grade,
      scoreNumeric: d.score,
      reasoningMarkdown: d.reasoning,
    })) as any
  );

  // Store gaps
  await db.insert(evaluationGaps).values(
    scoringData.red_flags.map((flag: any) => ({
      evaluationId,
      gapDescription: flag.description || flag.flag,
      blockerSeverity: flag.severity,
      mitigationStrategy: flag.mitigation,
    })) as any
  );

  // Store proof points
  if (proofPointsData.length > 0) {
    await db.insert(evaluationProofPoints).values(
      proofPointsData.map((pp: any) => ({
        evaluationId,
        requirement: pp.requirement,
        evidence: pp.evidence,
        matchStrength: pp.matchStrength,
      })) as any
    );
  }

  return {
    roleId,
    evaluationId,
    score: overallScore,
    recommendation: scoringData.recommendation,
    summary: scoringData.summary,
    dimensions: scoringData.dimensions,
    gaps: scoringData.red_flags,
    proofPoints: proofPointsData,
  };
}
