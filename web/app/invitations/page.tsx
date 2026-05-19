'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Invitation {
  code: string;
  status: string;
  expiresAt: string;
  claimedBy?: string;
  claimedAt?: string;
  createdAt: string;
  notes?: string;
}

export default function InvitationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [codes, setCodes] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expiryDays, setExpiryDays] = useState(30);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Load codes
  useEffect(() => {
    if (status === 'authenticated') {
      fetchCodes();
    }
  }, [status]);

  async function fetchCodes() {
    try {
      setLoading(true);
      const res = await fetch('/api/invitations');
      if (!res.ok) throw new Error('Failed to load codes');
      const data = await res.json();
      setCodes(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load codes');
    } finally {
      setLoading(false);
    }
  }

  async function generateCode() {
    try {
      setError('');
      setGenerating(true);
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiryDays, notes: notes || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate code');
      }
      const data = await res.json();
      setNotes('');
      setExpiryDays(30);
      fetchCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate code');
    } finally {
      setGenerating(false);
    }
  }

  function copyToClipboard(code: string, shareUrl: string) {
    navigator.clipboard.writeText(shareUrl);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  if (status === 'loading') {
    return <div style={{ padding: 40 }}>Loading...</div>;
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 600 }}>Test User Invitations</h1>
        <p style={{ margin: 0, color: '#666', fontSize: 14 }}>Generate invitation codes to invite test users</p>
      </div>

      {/* Generate form */}
      <div style={{
        border: '1px solid #e2e7e8',
        borderRadius: 10,
        padding: 24,
        marginBottom: 32,
        background: '#ffffff',
      }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 600 }}>Generate New Code</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#0a1f24' }}>
              Expires in (days)
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={expiryDays}
              onChange={(e) => setExpiryDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 30)))}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #e2e7e8',
                fontSize: 14,
                fontFamily: 'monospace',
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#0a1f24' }}>
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., For Jane Doe"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #e2e7e8',
                fontSize: 14,
              }}
            />
          </div>
          <button
            onClick={generateCode}
            disabled={generating}
            style={{
              alignSelf: 'flex-end',
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: generating ? '#e2e7e8' : '#0077b5',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: 14,
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? 'Generating…' : 'Generate Code'}
          </button>
        </div>
        {error && (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 6, background: '#ffeaea', color: '#d92e1b', fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>

      {/* Codes list */}
      <div>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>Your Invitation Codes</h2>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>Loading codes...</div>
        ) : codes.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>No codes generated yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: '#ffffff',
              borderRadius: 10,
              overflow: 'hidden',
            }}>
              <thead>
                <tr style={{ background: '#f6f8f8', borderBottom: '1px solid #e2e7e8' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#455258' }}>Code</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#455258' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#455258' }}>Expires</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#455258' }}>Claimed By</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#455258' }}>Notes</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#455258' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((inv, i) => {
                  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/signin?code=${inv.code}`;
                  const expiresDate = new Date(inv.expiresAt);
                  const isExpired = new Date() > expiresDate;
                  const statusColor = inv.status === 'active' ? '#107c8c' : inv.status === 'claimed' ? '#888' : '#d92e1b';

                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #e2e7e8' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <code style={{ background: '#f6f8f8', padding: '4px 8px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace' }}>
                          {inv.code}
                        </code>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ color: statusColor, fontWeight: 600, fontSize: 12, textTransform: 'capitalize' }}>
                          {inv.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>
                        {expiresDate.toLocaleDateString()} {isExpired && '(expired)'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>
                        {inv.claimedBy ? (
                          <>
                            <div>{inv.claimedBy}</div>
                            <div style={{ color: '#888', fontSize: 12 }}>{new Date(inv.claimedAt || '').toLocaleDateString()}</div>
                          </>
                        ) : (
                          <span style={{ color: '#888' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>
                        {inv.notes ? (
                          <span style={{ maxWidth: 150, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {inv.notes}
                          </span>
                        ) : (
                          <span style={{ color: '#888' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => copyToClipboard(inv.code, shareUrl)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: '1px solid #e2e7e8',
                            background: '#ffffff',
                            fontSize: 12,
                            cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          {copied === inv.code ? '✓ Copied' : 'Copy Link'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 40, padding: 20, borderRadius: 10, background: '#f6f8f8', fontSize: 13, color: '#455258', lineHeight: 1.6 }}>
        <strong>How it works:</strong>
        <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
          <li>Generate a code above</li>
          <li>Click "Copy Link" to copy the signup URL</li>
          <li>Share the link with test users</li>
          <li>When they sign up, the code is automatically claimed</li>
        </ol>
      </div>
    </div>
  );
}
