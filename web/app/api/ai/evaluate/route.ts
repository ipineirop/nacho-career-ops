import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { evaluateRole } from '@/lib/ai/evaluate-engine';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const authUser = await getAuthUserId();
    if (!authUser) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { jd, url } = await req.json();
    if (!jd || !jd.trim()) {
      return new Response(JSON.stringify({ error: 'JD required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Run evaluation
    const result = await evaluateRole({
      jd: jd.trim(),
      url,
      userId: authUser.id,
    });

    // Stream response with formatting
    const encoder = new TextEncoder();
    let sent = false;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send header
          const header = `# Evaluación: ${result.summary.split('\n')[0]}\n\n`;
          controller.enqueue(encoder.encode(header));

          // Send score
          const scoreSection = `**Score:** ${Math.round(result.score * 20)}/100 (${result.score.toFixed(1)}/5)\n`;
          controller.enqueue(encoder.encode(scoreSection));

          const recSection = `**Recomendación:** ${result.recommendation.toUpperCase()}\n\n`;
          controller.enqueue(encoder.encode(recSection));

          // Send dimensions
          const dimSection = `## Dimensiones de Evaluación\n\n`;
          controller.enqueue(encoder.encode(dimSection));

          for (const dim of result.dimensions) {
            const dimText = `### ${dim.name}\n**Calificación:** ${dim.grade} (${dim.score}/100)\n\n${dim.reasoning}\n\n`;
            controller.enqueue(encoder.encode(dimText));
          }

          // Send gaps
          if (result.gaps.length > 0) {
            const gapSection = `## Señales de Alerta\n\n`;
            controller.enqueue(encoder.encode(gapSection));

            for (const gap of result.gaps) {
              const gapText = `- **${gap.description}** [${gap.severity}]\n  Mitigación: ${gap.mitigation}\n\n`;
              controller.enqueue(encoder.encode(gapText));
            }
          }

          // Send proof points
          if (result.proofPoints.length > 0) {
            const ppSection = `## Puntos de Evidencia\n\n`;
            controller.enqueue(encoder.encode(ppSection));

            for (const pp of result.proofPoints) {
              const ppText = `| ${pp.requirement} | ${pp.matchStrength} |\n`;
              controller.enqueue(encoder.encode(ppText));
            }
          }

          // Send summary
          const summarySection = `\n## Resumen\n\n${result.summary}\n`;
          controller.enqueue(encoder.encode(summarySection));

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Evaluate error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
