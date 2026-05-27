/**
 * PickCard — the optional Pick block. v1 never renders this (the API
 * returns pick: null) but the component lives so the moment Pick data
 * arrives, the UI is ready.
 *
 * Layout: two-column at ≥720px (body + salary panel side-by-side),
 * single-column below. The 720px threshold is the only Brief breakpoint
 * (handoff §2 "Breakpoint").
 *
 * Action codes resolve labels via the i18n catalog server-side; the client
 * just renders them. Wiring to the Tailor & apply / Evaluate / Mute flows
 * is deferred to the same pattern as SignalCard primary actions.
 */

import type { BriefPick } from '@/lib/brief/types';
import { pick as pickStr, renderEmphasis, type Locale } from './text';
import { resolveActionLabel } from '@/lib/brief/i18n';

export function PickCard({ pick, locale }: { pick: BriefPick; locale: Locale }) {
  return (
    <article className="bg-surface border border-line rounded-card p-s5 mb-s6">
      <div className="font-mono text-[11px] uppercase tracking-[0.4px] text-ink-3 mb-s3">
        {renderEmphasis(pickStr(pick.kicker, locale))}
      </div>
      <h2 className="font-serif text-[28px] leading-[1.12] text-ink m-0 mb-s2">
        {renderEmphasis(pickStr(pick.headline, locale))}
      </h2>
      <div className="font-body text-[14px] text-ink-2 mb-s4">
        {pickStr(pick.subhead, locale)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-s5">
        <p className="font-body text-[14px] leading-[1.55] text-ink m-0">
          {renderEmphasis(pickStr(pick.editorialSummary, locale))}
        </p>
        <aside className="bg-canvas rounded-card p-s4">
          <div className="font-mono text-[10.5px] uppercase tracking-[1.2px] text-ink-3 mb-s2">
            Salary · {pick.salaryEstimate.confidence}
          </div>
          <div className="font-serif text-[22px] text-ink leading-[1.2]">
            {formatBand(pick.salaryEstimate.bandLow, pick.salaryEstimate.bandHigh, pick.salaryEstimate.currency)}
          </div>
          <div className="font-body text-[12px] text-ink-2 mt-s2">
            floor · {formatNumber(pick.salaryEstimate.floor, pick.salaryEstimate.currency)}
          </div>
        </aside>
      </div>
      {pick.hiringManager && (
        <div className="mt-s4 font-body text-[14px] text-ink-2">
          <span className="text-ink">{pick.hiringManager.name}</span>
          {pick.hiringManager.prior.length > 0 && (
            <> · prior at {pick.hiringManager.prior.join(', ')}</>
          )}
          {pick.hiringManager.mutualCount > 0 && (
            <> · {pick.hiringManager.mutualCount} mutual</>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-s2 mt-s4">
        {pick.actions.map((code, i) => {
          const label = resolveActionLabel(code);
          const isPrimary = i === 0;
          return (
            <button
              key={code}
              type="button"
              data-action={code}
              className={
                isPrimary
                  ? 'bg-accent hover:bg-accent-h text-accent-on rounded-pill px-s4 h-[36px] font-body text-[14px] font-semibold cursor-pointer border-0'
                  : 'bg-transparent hover:bg-canvas text-ink-2 hover:text-ink rounded-pill px-s3 h-[36px] font-body text-[14px] font-medium cursor-pointer border-0'
              }
            >
              {pickStr(label, locale)}
            </button>
          );
        })}
      </div>
    </article>
  );
}

function formatBand(low: number, high: number, currency: string): string {
  return `${formatNumber(low, currency)} – ${formatNumber(high, currency)}`;
}

function formatNumber(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}
