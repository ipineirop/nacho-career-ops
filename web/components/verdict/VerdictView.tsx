'use client';

import { VerdictSurfaces } from '@/components/evaluations/VerdictSurfaces';
import { CompStrip } from './CompStrip';
import { VERDICT_LABEL, type FullVerdictMeta, type Verdict } from './types';

const Icon = {
  ext: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7" /><path d="M7 7h10v10" /></svg>,
  check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>,
  arrow: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>,
};

const SENIORITY_LABEL: Record<string, string> = {
  ic: 'IC', senior_ic: 'Senior IC', manager: 'Manager', director: 'Director',
  head_of: 'Head of', vp: 'VP', c_level: 'C-level',
};

function PrimaryAction({ verdict, url, displayId }: { verdict: Verdict; url: string | null; displayId?: string }) {
  if (verdict === 'pursue' && url) {
    return <a className="primary" href={url} target="_blank" rel="noreferrer">Open posting<Icon.ext /></a>;
  }
  if (verdict === 'pursue' || verdict === 'watch') {
    return <a className="primary" href="/tracker">Open in Tracker<Icon.arrow /></a>;
  }
  // reply / skip — acknowledge in place, then view the full report
  return <a className="primary" href={displayId ? `/reports/${displayId}` : '/tracker'}>{verdict === 'reply' ? 'Mark as replied' : 'Acknowledge'}<Icon.check /></a>;
}

export function VerdictView({
  meta,
  onNew,
  onDiscard,
}: {
  meta: FullVerdictMeta;
  onNew: () => void;
  onDiscard: () => void;
}) {
  const v = meta.verdict;
  const role = meta.role;
  if (!v) return null;

  const label = VERDICT_LABEL[v.verdict];
  const metaLine = role
    ? [role.company, role.location, role.remotePolicy, role.sourceLabel].filter(Boolean)
    : [];
  const subLine = role
    ? [SENIORITY_LABEL[role.seniority] || role.seniority, v.legitimacy].filter(Boolean)
    : [];

  return (
    <div className="verdict-view">
      {/* Summary header */}
      {role ? (
        <div className="v-summary">
          {metaLine.length > 0 && (
            <div className="meta-line">
              {metaLine.map((part, i) => (
                <span key={i}>{i > 0 && <span className="sep">·</span>}{part}</span>
              ))}
            </div>
          )}
          {role.title && <h2 className="role">{role.title}.</h2>}
          {subLine.length > 0 && (
            <div className="role-sub">
              {subLine.map((part, i) => (
                <span key={i}>{i > 0 && <span className="sep">·</span>}{part}</span>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Verdict — the editorial moment */}
      <div className="v-verdict">
        <div className="kicker-label">★ VERDICT</div>
        <h1 className="label">{label}<em>.</em></h1>
        {(v.reasoningLede || v.reasoningBody) && (
          <p className="reasoning">
            {v.reasoningLede && <span className="lede">{v.reasoningLede}</span>}
            {v.reasoningBody && (v.reasoningLede ? ' ' : '') + v.reasoningBody}
          </p>
        )}
      </div>

      {/* Gaps */}
      {v.gaps.length > 0 && (
        <div className="v-section">
          <div className="skicker">★ <b>Gaps</b> — what the posting doesn&apos;t say</div>
          <ul className="gap-list">
            {v.gaps.map((g, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: boldify(g.text) }} />
            ))}
          </ul>
        </div>
      )}

      {/* Comp strip (Block D) */}
      {v.comp && <CompStrip comp={v.comp} />}

      {/* Past-employer match + pattern hits */}
      <VerdictSurfaces meta={meta} />

      {/* Actions */}
      <div className="v-actions">
        <PrimaryAction verdict={v.verdict} url={role?.url ?? null} displayId={meta.displayId} />
        {meta.displayId && (
          <a className="ghost" href={`/reports/${meta.displayId}`} style={{ color: 'var(--lm-ink-2)' }}>
            View full report<Icon.arrow />
          </a>
        )}
        <div className="spacer" />
        <button className="ghost" onClick={onNew}>New evaluation</button>
        <button className="ghost" onClick={onDiscard}>Discard</button>
      </div>
    </div>
  );
}

function boldify(s: string): string {
  const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}
