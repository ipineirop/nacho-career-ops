/**
 * /preview/tracker — auth-free, DB-free visual preview of the v0.2 Tracker.
 *
 * Sample data mirrors the v0.2 mockup's exemplar rows (Stori, Bitso, Clara,
 * Jeeves, dLocal, Ekumen, Nowports, …) so the layout matches the design
 * file 1:1. Pass `?locale=es` to flip to Spanish.
 *
 * NOT a production route — preview-only.
 */

import { TrackerShell, type AppRow } from '@/components/tracker/TrackerShell';
import type { WayARenderable } from '@/lib/tracker/wayA';
import type { Locale } from '@/lib/brief/i18n';

const NOW = Date.now();
const day = (n: number) => new Date(NOW - n * 86_400_000);
const iso = (d: Date) => d.toISOString().split('T')[0];

const APPS: AppRow[] = [
  // ---- active ----
  { id: 'e1', roleId: 'r1', company: 'Stori',           role: 'Head of Operations',
    meta: ['Mexico City', 'Series C · Fintech'],
    status: 'interviewing', verdict: 'reply', scoreNum: 4.5,
    date: iso(day(3)), statusChangedAt: day(2), reportId: '042' },

  { id: 'e2', roleId: 'r2', company: 'Bitso',           role: 'Head of Operations',
    meta: ['Mexico City', 'Series E · Crypto'],
    status: 'offer_pending', verdict: 'pursue', scoreNum: 4.6,
    date: iso(day(1)), statusChangedAt: day(1), reportId: '043' },

  { id: 'e3', roleId: 'r3', company: 'Clara',           role: 'Head of Operations',
    meta: ['Mexico City', 'Series C · Fintech'],
    status: 'applied', verdict: 'pursue', scoreNum: 4.2,
    date: iso(day(9)), statusChangedAt: day(9), reportId: '040' },

  { id: 'e4', roleId: 'r4', company: 'Jeeves',          role: 'Head of Global Revenue Operations',
    meta: ['Remote LatAm', 'Series D · Fintech'],
    status: 'interviewing', verdict: 'watch', scoreNum: 3.9,
    date: iso(day(4)), statusChangedAt: day(4), reportId: '041' },

  { id: 'e5', roleId: 'r5', company: 'dLocal',          role: 'Operations Manager · LatAm',
    meta: ['Remote', 'Public · Payments'],
    status: 'applied', verdict: 'watch', scoreNum: 3.6,
    date: iso(day(3)), statusChangedAt: day(3), reportId: '039' },

  { id: 'e6', roleId: 'r6', company: 'Ekumen',          role: 'Head of Operations',
    meta: ['Buenos Aires', 'Series B · Robotics'],
    status: 'evaluating', verdict: 'watch', scoreNum: 3.4,
    date: iso(day(1)), statusChangedAt: day(1), reportId: '038' },

  { id: 'e7', roleId: 'r7', company: 'Nowports',        role: 'Director of Operations LatAm',
    meta: ['Monterrey', 'Series C · Logistics'],
    status: 'interviewing', verdict: 'watch', scoreNum: 3.7,
    date: iso(day(12)), statusChangedAt: day(12), reportId: '037' },

  { id: 'e8', roleId: 'r8', company: 'The Knot Worldwide', role: 'Senior Director, Retail Marketplace Partnerships',
    meta: ['Remote', 'Public · Marketplace'],
    status: 'evaluating', verdict: 'watch', scoreNum: 3.3,
    date: iso(day(2)), statusChangedAt: day(2), reportId: '036' },

  { id: 'e9', roleId: 'r9', company: 'Rappi',           role: 'Senior Data Engineer',
    meta: ['Bogotá', 'Public · Delivery'],
    status: 'evaluating', verdict: 'skip', scoreNum: 2.1,
    date: iso(day(1)), statusChangedAt: day(1), reportId: '035' },

  // ---- closed (terminal) ----
  { id: 'e10', roleId: 'r10', company: 'Mercado Libre',  role: 'Director of Operations · LatAm',
    meta: ['São Paulo', 'Public · Ecommerce'],
    status: 'offer_accepted', verdict: 'pursue', scoreNum: 4.7,
    date: iso(day(22)), statusChangedAt: day(8), reportId: '034' },

  { id: 'e11', roleId: 'r11', company: 'Clip',           role: 'Head of Growth',
    meta: ['Mexico City', 'Series D · Payments'],
    status: 'rejected', verdict: 'watch', scoreNum: 3.1,
    date: iso(day(18)), statusChangedAt: day(14), reportId: '033' },

  { id: 'e12', roleId: 'r12', company: 'Konfio',         role: 'Engineering Manager · Risk',
    meta: ['Mexico City', 'Series E · Fintech'],
    status: 'ghosted', verdict: 'pursue', scoreNum: 4.0,
    date: iso(day(35)), statusChangedAt: day(34), reportId: '032' },
];

const wayAByRole: Record<string, WayARenderable> = {
  // Clara: applied + 9 days quiet — stale-touch follow-up (the design shows
  // "9d since touch" in signal-amber in the followup column; we surface the
  // Way-A under the row too so the suggestion engine is visible).
  r3: {
    trigger: {
      code: 'applied_14d',
      kind: 'threshold',
      templateKey: 'followUp',
      roleId: 'r3',
      vars: { company: 'Clara' },
    },
    rendered: {
      en: 'Send follow-up to Clara?',
      es: '¿Enviar seguimiento a Clara?',
    },
  },
};

export default async function TrackerPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const localeParam = typeof sp.locale === 'string' ? sp.locale : 'en';
  const locale: Locale = localeParam === 'es' ? 'es' : 'en';

  return (
    <div style={{ background: 'var(--lm-bg)', color: 'var(--lm-ink)', minHeight: '100vh', padding: '28px 36px 44px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 12 }}>
          /preview/tracker · locale={locale}
        </div>
        <TrackerShell apps={APPS} locale={locale} initialActiveOnly={false} wayAByRole={wayAByRole} />
      </div>
    </div>
  );
}
