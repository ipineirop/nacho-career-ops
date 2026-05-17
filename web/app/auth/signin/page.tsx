'use client';

import { signIn, getProviders } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function SignInPage() {
  const [hasLinkedIn, setHasLinkedIn] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Email OTP state
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [devCode, setDevCode] = useState(''); // shown in dev when no RESEND_API_KEY
  const [error, setError] = useState('');

  useEffect(() => {
    getProviders().then((p) => {
      setHasLinkedIn(!!(p && 'linkedin' in p));
      setLoaded(true);
    });
  }, []);

  async function sendCode() {
    setError('');
    setSending(true);
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to send code'); return; }
      setCodeSent(true);
      if (data.devCode) setDevCode(data.devCode);
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    setError('');
    setVerifying(true);
    try {
      const result = await signIn('email-otp', { email, code, redirect: false });
      if (result?.error) { setError('Invalid or expired code. Try again.'); }
      else { window.location.href = '/'; }
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--lm-bg, #f6f8f8)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, maxWidth: 440, width: '100%', textAlign: 'center' }}>

        {/* Brand */}
        <div>
          <div style={{ fontFamily: 'var(--font-fraunces, Georgia), serif', fontWeight: 400, fontSize: 64, lineHeight: 1, letterSpacing: '-1.8px', color: 'var(--lm-ink, #0a1f24)' }}>
            leadme<span style={{ color: 'var(--lm-accent, #0d7c89)' }}>.</span>
          </div>
          <p style={{ fontFamily: 'var(--font-albert-sans, system-ui), sans-serif', fontSize: 17, lineHeight: 1.6, color: 'var(--lm-ink-2, #455258)', margin: '12px 0 0' }}>
            Less noise. More signal.
          </p>
        </div>

        {/* Sign-in card */}
        <div style={{ background: 'var(--lm-surface, #ffffff)', border: '1px solid var(--lm-line, #e2e7e8)', borderRadius: 10, padding: '28px 32px', width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-albert-sans, system-ui), sans-serif', fontWeight: 600, fontSize: 17, color: 'var(--lm-ink, #0a1f24)', marginBottom: 4 }}>
              Sign in to continue
            </div>
            <p style={{ fontFamily: 'var(--font-albert-sans, system-ui), sans-serif', fontSize: 13.5, color: 'var(--lm-ink-2, #455258)', margin: 0, lineHeight: 1.5 }}>
              Identity only — name and email. Your depth comes from your CV.
            </p>
          </div>

          {/* LinkedIn */}
          {(hasLinkedIn || !loaded) && (
            <button
              onClick={() => signIn('linkedin', { callbackUrl: '/' })}
              disabled={!loaded}
              style={{
                width: '100%', padding: '11px 22px', borderRadius: 999, background: '#0077b5',
                color: '#ffffff', border: 'none', fontFamily: 'var(--font-albert-sans, system-ui), sans-serif',
                fontWeight: 600, fontSize: 14, cursor: !loaded ? 'default' : 'pointer',
                opacity: !loaded ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Continue with LinkedIn
            </button>
          )}

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--lm-line, #e2e7e8)' }} />
            <span style={{ fontFamily: 'var(--font-albert-sans, system-ui)', fontSize: 12, color: 'var(--lm-ink-3, #889399)' }}>or use email</span>
            <div style={{ flex: 1, height: 1, background: 'var(--lm-line, #e2e7e8)' }} />
          </div>

          {/* Email OTP */}
          {!codeSent ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && email.includes('@') && sendCode()}
                placeholder="you@example.com"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  border: '1px solid var(--lm-line, #e2e7e8)', background: 'var(--lm-canvas, #f0f4f4)',
                  fontFamily: 'var(--font-albert-sans, system-ui)', fontSize: 14,
                  color: 'var(--lm-ink, #0a1f24)', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <button
                onClick={sendCode}
                disabled={sending || !email.includes('@')}
                style={{
                  width: '100%', padding: '10px 22px', borderRadius: 999,
                  background: sending || !email.includes('@') ? 'var(--lm-line)' : 'var(--lm-ink, #0a1f24)',
                  color: sending || !email.includes('@') ? 'var(--lm-ink-3)' : '#fff',
                  border: 'none', fontFamily: 'var(--font-albert-sans, system-ui)', fontWeight: 600, fontSize: 14,
                  cursor: sending || !email.includes('@') ? 'not-allowed' : 'pointer',
                }}
              >
                {sending ? 'Sending…' : 'Send sign-in code'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontFamily: 'var(--font-albert-sans, system-ui)', fontSize: 13.5, color: 'var(--lm-ink-2)', margin: 0, textAlign: 'left' }}>
                Code sent to <strong>{email}</strong>. Check your inbox.
              </p>
              {devCode && (
                <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--lm-accent-soft)', fontFamily: 'monospace', fontSize: 18, letterSpacing: 6, color: 'var(--lm-accent)', textAlign: 'center' }}>
                  {devCode} <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 11, letterSpacing: 0, opacity: 0.7 }}>(dev mode)</span>
                </div>
              )}
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && verifyCode()}
                placeholder="6-digit code"
                maxLength={6}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  border: '1px solid var(--lm-line, #e2e7e8)', background: 'var(--lm-canvas)',
                  fontFamily: 'monospace', fontSize: 22, letterSpacing: 8, textAlign: 'center',
                  color: 'var(--lm-ink)', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <button
                onClick={verifyCode}
                disabled={verifying || code.length < 6}
                style={{
                  width: '100%', padding: '10px 22px', borderRadius: 999,
                  background: verifying || code.length < 6 ? 'var(--lm-line)' : 'var(--lm-ink)',
                  color: verifying || code.length < 6 ? 'var(--lm-ink-3)' : '#fff',
                  border: 'none', fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 14,
                  cursor: verifying || code.length < 6 ? 'not-allowed' : 'pointer',
                }}
              >
                {verifying ? 'Verifying…' : 'Sign in →'}
              </button>
              <button
                onClick={() => { setCodeSent(false); setCode(''); setDevCode(''); }}
                style={{ background: 'none', border: 'none', fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Use a different email
              </button>
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--lm-signal-soft)', fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-signal)' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {['no noise', 'LatAm comp intel', 'no subscription dance'].map((t) => (
            <span key={t} style={{ padding: '4px 14px', borderRadius: 999, border: '1px solid var(--lm-line, #e2e7e8)', background: 'var(--lm-surface, #ffffff)', fontFamily: 'var(--font-albert-sans, system-ui)', fontSize: 12, color: 'var(--lm-ink-3, #889399)' }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
