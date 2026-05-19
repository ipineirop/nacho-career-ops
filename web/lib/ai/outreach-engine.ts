import Anthropic from '@anthropic-ai/sdk';
import { getDb, roles, evaluations } from '@/lib/db';
import { eq } from 'drizzle-orm';

interface OutreachInput {
  roleId: string;
  userId: string;
  tone: 'warm' | 'cool' | 'decline';
}

interface OutreachResult {
  roleId: string;
  tone: 'warm' | 'cool' | 'decline';
  subject: string;
  body: string;
  nextSteps: string;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function draftOutreach(input: OutreachInput): Promise<OutreachResult> {
  const db = getDb();

  // Get role and evaluation context
  const roleData = await db.select().from(roles).where(eq(roles.id, input.roleId)).limit(1);

  if (!roleData.length) {
    throw new Error('Role not found');
  }

  const role = roleData[0];

  // Get latest evaluation for context
  const evalData = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.roleId, input.roleId))
    .orderBy((e) => e.evaluatedAt)
    .limit(1);

  const evaluation = evalData[0];

  const toneInstructions = {
    warm: `You are writing an enthusiastic YES response. The candidate is excited about this opportunity. Tone: warm, professional, specific about what excites them about the role.`,
    cool: `You are writing a polite MAYBE response. The candidate is interested but has questions or needs more info. Tone: professional, curious, ask clarifying questions about: comp, team structure, timeline.`,
    decline: `You are writing a respectful NO response. The candidate appreciates the opportunity but it's not a fit. Tone: gracious, brief, explain (2-3 sentences) why respectfully.`,
  };

  const prompt = `You are a career advisor helping draft an outreach response to a recruiter.

Opportunity:
- Company: ${role.companyName}
- Role: ${role.roleTitle}
- Level: ${role.seniorityLevel}
- Location: ${role.location} (${role.remotePolicy})
- Comp: ${role.compRangeLow ? `$${role.compRangeLow}` : 'not disclosed'} - ${role.compRangeHigh ? `$${role.compRangeHigh}` : 'not disclosed'}

${evaluation ? `Evaluation score: ${evaluation.overallScore}/100\nRecommendation: ${evaluation.recommendation}\nKey concerns: ${evaluation.verdictSummary?.split('\n')[0]}` : 'No evaluation yet'}

${toneInstructions[input.tone]}

Generate a response with:
1. Subject line (email subject)
2. Body (2-4 paragraphs, professional but personable)
3. Next steps (what to ask for or offer next)

Return as JSON:
{
  "subject": "...",
  "body": "...",
  "nextSteps": "..."
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  let draftData: any;
  try {
    const jsonMatch = (response.content[0] as any).text.match(/\{[\s\S]*\}/);
    draftData = JSON.parse(jsonMatch![0]);
  } catch {
    throw new Error('Failed to generate outreach response');
  }

  return {
    roleId: input.roleId,
    tone: input.tone,
    subject: draftData.subject,
    body: draftData.body,
    nextSteps: draftData.nextSteps,
  };
}
