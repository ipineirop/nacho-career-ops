import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '@/lib/require-auth';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getFile } from '@/lib/github';
import { getDb, documents, evaluations, roles, userProfiles } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getSetting } from '@/lib/settings-store';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;
  const authUser = await getAuthUserId();

  const { jd, applicationId } = await req.json();
  if (!jd?.trim()) return NextResponse.json({ error: 'No job description provided' }, { status: 400 });

  // CV for the CURRENT user: prefer the structured cv_markdown, then the
  // per-user cv_content key, then the repo file. (Was reading a global,
  // non-user-scoped key — a multi-tenant bug.)
  async function getCv() {
    try {
      if (authUser) {
        const prof = await getDb()
          .select({ cvMarkdown: userProfiles.cvMarkdown })
          .from(userProfiles)
          .where(eq(userProfiles.userId, authUser.id))
          .limit(1);
        if (prof[0]?.cvMarkdown) return prof[0].cvMarkdown;
        const byKey = await getSetting(`${authUser.email}:cv_content`);
        if (byKey) return byKey;
      }
    } catch { /* fall through */ }
    return getFile('cv.md').then((f) => f.content);
  }

  const [shared, profile, cv, pdfMode, rawTemplate] = await Promise.all([
    getFile('modes/_shared.md').then((f) => f.content),
    getFile('modes/_profile.md').then((f) => f.content),
    getCv(),
    getFile('modes/pdf.md').then((f) => f.content),
    getFile('templates/cv-template.html').then((f) => f.content),
  ]);

  // Replace local font paths with Google Fonts for browser rendering
  const template = rawTemplate
    .replace(/<style>/i, '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet">\n<style>')
    .replace(/@font-face\s*\{[^}]*font-family:\s*['"]Space Grotesk['"][^}]*\}/g, '')
    .replace(/@font-face\s*\{[^}]*font-family:\s*['"]DM Sans['"][^}]*\}/g, '');

  const system = `# IMPORTANT — API CONTEXT
You are running via the Anthropic API, NOT Claude Code.
You have NO tools. All files are pre-loaded below.
Do NOT output tool calls, file-save instructions, or any commentary.
Return ONLY the complete HTML document.

---

# System Context & Scoring Rules
${shared}

---

# User Profile & Archetypes
${profile}

---

# Candidate CV (source of truth)
${cv}

---

# CV Generation Mode (pdf.md)
${pdfMode}

---

# HTML Template (fill all {{PLACEHOLDERS}})
${template}`;

  const userMessage = `Generate a tailored CV for the job posting below.

Rules:
- Return ONLY the complete HTML document — no markdown fences, no preamble, no explanation
- Start immediately with <!DOCTYPE html> and end with </html>
- Google Fonts link is already in the template — do NOT add @font-face blocks
- Detect location from JD: US/Canada → page width 8.5in, otherwise 210mm
- Detect language from JD: use that language for section labels
- Inject JD keywords naturally — never invent experience
- Reorder bullets by relevance to this JD
- Select top 3-4 projects most relevant to this role

JOB DESCRIPTION:
${jd}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });

  let html = message.content[0].type === 'text' ? message.content[0].text.trim() : '';

  // Strip markdown fences if Claude ignored the instruction
  const fenceMatch = html.match(/```(?:html)?\s*([\s\S]+?)\s*```/);
  if (fenceMatch) html = fenceMatch[1].trim();

  // Save to documents table if linked to an evaluation
  if (applicationId && html) {
    try {
      const db = getDb();
      const [eval_] = await db.select({ userId: evaluations.userId, roleId: evaluations.roleId })
        .from(evaluations).where(eq(evaluations.id, applicationId));

      if (eval_) {
        const [roleData] = await db.select({ companyName: roles.companyName, roleTitle: roles.roleTitle })
          .from(roles).where(eq(roles.id, eval_.roleId));

        await db.insert(documents).values({
          userId: eval_.userId,
          evaluationId: applicationId,
          roleId: eval_.roleId,
          type: 'cv',
          title: `CV — ${roleData?.companyName ?? 'Unknown'} (${roleData?.roleTitle ?? ''})`,
          content: html,
        });
      }
    } catch (err) {
      console.error('Failed to save CV document:', err);
    }
  }

  return NextResponse.json({ html });
}
