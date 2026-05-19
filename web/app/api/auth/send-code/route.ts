import { NextRequest, NextResponse } from 'next/server';
import { getDb, signinCodes } from '@/lib/db';
import { eq } from 'drizzle-orm';


async function sendEmail(to: string, code: string): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM ?? 'leadme <noreply@leadme.app>';

  if (!resendKey) {
    // Dev mode: log the code
    console.log(`[send-code] DEV — code for ${to}: ${code}`);
    return true;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject: `${code} — your leadme sign-in code`,
      text: `Your leadme sign-in code is: ${code}\n\nIt expires in 10 minutes. If you didn't request this, ignore this email.`,
      html: `<p style="font-family:sans-serif;font-size:15px">Your leadme sign-in code:</p><p style="font-family:monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#0d7c89">${code}</p><p style="font-family:sans-serif;font-size:13px;color:#889399">Expires in 10 minutes. If you didn't request this, ignore this email.</p>`,
    }),
  });
  return res.ok;
}

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email?.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const normalized = email.toLowerCase().trim();
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  try {
    const db = getDb();

    // Delete any existing code for this email
    await db.delete(signinCodes).where(eq(signinCodes.email, normalized));

    // Insert new code
    await db.insert(signinCodes).values({
      email: normalized,
      code,
      expiresAt,
    });

    const sent = await sendEmail(normalized, code);
    if (!sent) return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });

    // In dev (no RESEND_API_KEY), return code so it can be shown in UI
    const devMode = !process.env.RESEND_API_KEY;
    return NextResponse.json({ ok: true, ...(devMode ? { devCode: code } : {}) });
  } catch (err) {
    console.error('Error sending signin code:', err);
    return NextResponse.json({ error: 'Failed to send code' }, { status: 500 });
  }
}
