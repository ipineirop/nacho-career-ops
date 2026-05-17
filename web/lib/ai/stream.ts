import Anthropic from '@anthropic-ai/sdk';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const MODEL = 'claude-sonnet-4-6';

function getDbUrl() {
  return (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!)
    .replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
}

function readModeFile(name: string): string {
  const filePath = path.join(process.cwd(), 'modes', name);
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; }
}

async function getUserSetting(userEmail: string, key: string): Promise<string> {
  const sql = neon(getDbUrl());
  const rows = await sql`SELECT value FROM settings WHERE key = ${userEmail + ':' + key} LIMIT 1`;
  return (rows as { value: string }[])[0]?.value ?? '';
}

export async function loadPromptFiles(userEmail: string) {
  const [cv, profile] = await Promise.all([
    getUserSetting(userEmail, 'cv_content'),
    getUserSetting(userEmail, 'profile_content'),
  ]);
  const shared = readModeFile('_shared.md');
  return { shared, profile: profile || '', cv: cv || '' };
}

export function loadModeFile(mode: string): string {
  return readModeFile(`${mode}.md`);
}

export function streamClaude(system: string, userMessage: string): ReadableStream<Uint8Array> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  return new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: MODEL,
          max_tokens: 8192,
          system,
          messages: [{ role: 'user', content: userMessage }],
        });

        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(new TextEncoder().encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
