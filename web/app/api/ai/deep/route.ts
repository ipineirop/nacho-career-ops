import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/require-auth';
import { loadPromptFiles, loadModeFile, streamClaude } from '@/lib/ai/stream';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { company, jd } = await req.json();
  if (!company?.trim()) return new Response('Company required', { status: 400 });

  const [{ shared, profile }, deep] = await Promise.all([
    loadPromptFiles(user.email),
    Promise.resolve(loadModeFile('deep')),
  ]);

  const system = `# IMPORTANT — API CONTEXT
You are running via the Anthropic API. You have NO tools. Do NOT output tool calls. All source files are pre-loaded below.

---

# System Context
${shared}

---

# User Profile
${profile}

---

# Deep Research Protocol
${deep}`;

  const userMessage = jd
    ? `Research this company and role:\n\nCompany: ${company}\n\nJob Description:\n${jd}`
    : `Research this company: ${company}`;

  return new Response(streamClaude(system, userMessage), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
