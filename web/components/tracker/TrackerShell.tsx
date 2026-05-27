/**
 * TrackerShell — Tracker list surface, v0.2.
 *
 * Markup ported from `web/Design/screens/Labra Tracker.html` v0.2
 * (lines 1444–1620). All visual styling lives in globals.css under the
 * `.tracker-list` scope — this component is responsible only for layout
 * order, locale label selection, and state wiring.
 */

'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { ActiveOnlyToggle } from './ActiveOnlyToggle';
import { AcceptedPin } from './AcceptedPin';
import { StatusBadge } from './StatusBadge';
import { VerdictPill } from './VerdictPill';
import { KanbanBoard } from './KanbanBoard';
import { useLocale } from '@/components/locale/LocaleProvider';
import {
  TRACKER_STRINGS,
  STATUS_LABELS,
  type Locale,
  type StatusCode,
  type VerdictCode,
} from '@/lib/brief/i18n';
import { ACTIVE_PIPELINE_STATUSES, isTerminalStatus } from '@/lib/api/validation';
import type { WayARenderable } from '@/lib/tracker/wayA';

export interface AppRow {
  id: string;
  roleId: string | null;
  company: string;
  role: string;
  status: string;
  verdict: VerdictCode | null;
  scoreNum: number;
  date: string;
  statusChangedAt: Date | null;
  reportId: string | null;
  /** Optional meta segments rendered in the role line with `·` separators
   *  (e.g. `["Mexico City", "Series C · Fintech"]`). When omitted the line
   *  just shows the role title. */
  meta?: string[];
}

interface TrackerShellProps {
  apps: AppRow[];
  /** Initial locale used for the SSR render. Once mounted, the shell
   *  reads from the global `useLocale()` context so the sidebar EN/ES
   *  toggle takes effect instantly without a page reload. */
  locale?: Locale;
  initialActiveOnly?: boolean;
  wayAByRole?: Record<string, WayARenderable>;
}

const STATUS_SORT_ORDER: StatusCode[] = [
  'evaluating', 'applied', 'interviewing', 'offer_pending',
  'offer_accepted', 'rejected', 'withdrew', 'passed', 'ghosted',
];

type FilterId = 'active' | 'all' | 'terminal';
type SortId = 'recent' | 'status';

function daysSince(d: Date | string | null): number {
  if (!d) return 0;
  const t = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(t.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - t.getTime()) / 86_400_000));
}

export function TrackerShell({ apps, locale: initialLocale = 'en', initialActiveOnly = false, wayAByRole = {} }: TrackerShellProps) {
  // The sidebar EN/ES toggle drives the global LocaleProvider context.
  // Pull from it so the toggle takes effect on this surface without a
  // server re-render. `initialLocale` is consumed only as a hint to keep
  // the lint happy; the runtime source of truth is the context.
  const { locale: ctxLocale } = useLocale();
  const locale: Locale = ctxLocale ?? initialLocale;

  const [view, setView] = useState<'list' | 'board'>('list');
  const [activeOnly, setActiveOnly] = useState(initialActiveOnly);
  const [filter, setFilter] = useState<FilterId>('active');
  const [sort, setSort] = useState<SortId>('recent');
  const [, startTransition] = useTransition();

  function patchActiveOnly(next: boolean) {
    setActiveOnly(next);
    startTransition(() => {
      fetch('/api/preferences/tracker-active-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: next }),
      }).catch(() => { /* swallow */ });
    });
  }

  const counts = useMemo(() => {
    let active = 0, terminal = 0;
    for (const a of apps) {
      if (isTerminalStatus(a.status)) terminal += 1;
      else active += 1;
    }
    return { active, all: apps.length, terminal };
  }, [apps]);

  const headCountLabel =
    locale === 'es'
      ? `· ${counts.active} activos · ${counts.terminal} cerrados últimos 30d`
      : `· ${counts.active} active · ${counts.terminal} closed last 30d`;

  return (
    <div className="tracker-list">
      {/* Header */}
      <div className="tracker-head">
        <div className="title-block">
          <div className="kicker">{locale === 'es' ? 'Pipeline' : 'Pipeline'}</div>
          <h1>
            <em>{locale === 'es' ? 'Pipeline' : 'Pipeline'}</em>
            <span className="count">{headCountLabel}</span>
          </h1>
        </div>
        <div className="right-actions">
          <div className="ctrl-seg" aria-label="view">
            <button
              type="button"
              className={view === 'list' ? 'on' : ''}
              onClick={() => setView('list')}
            >
              {locale === 'es' ? 'Lista' : 'List'}
            </button>
            <button
              type="button"
              className={view === 'board' ? 'on' : ''}
              onClick={() => setView('board')}
            >
              {locale === 'es' ? 'Tablero' : 'Board'}
            </button>
          </div>
        </div>
      </div>

      {/* Board view — the existing Kanban surface, mapped to the v3 statuses.
          The filter strip + group-head are list-specific (the design's A.6
          decision) so we hide them on board. */}
      {view === 'board' ? (
        <KanbanBoard
          applications={apps.map((a) => ({
            id: a.id,
            roleId: a.roleId,
            company: a.company,
            role: a.role,
            status: a.status,
            scoreNum: a.scoreNum,
            date: a.date,
            reportId: a.reportId,
          }))}
        />
      ) : (
        <ListView
          apps={apps}
          locale={locale}
          activeOnly={activeOnly}
          setActiveOnly={patchActiveOnly}
          filter={filter}
          setFilter={setFilter}
          sort={sort}
          setSort={setSort}
          counts={counts}
          wayAByRole={wayAByRole}
        />
      )}
    </div>
  );
}

interface ListViewProps {
  apps: AppRow[];
  locale: Locale;
  activeOnly: boolean;
  setActiveOnly: (v: boolean) => void;
  filter: FilterId;
  setFilter: (v: FilterId) => void;
  sort: SortId;
  setSort: (v: SortId) => void;
  counts: { active: number; all: number; terminal: number };
  wayAByRole: Record<string, WayARenderable>;
}

function ListView({ apps, locale, activeOnly, setActiveOnly, filter, setFilter, sort, setSort, counts, wayAByRole }: ListViewProps) {
  const showLabel = locale === 'es' ? 'Mostrar' : 'Show';
  const sortLabelMono = 'SORT';

  const filtered = apps.filter((a) => {
    if (filter === 'active') return (ACTIVE_PIPELINE_STATUSES as readonly string[]).includes(a.status);
    if (filter === 'terminal') return isTerminalStatus(a.status);
    return true;
  });
  const visible = activeOnly ? filtered.filter((a) => !isTerminalStatus(a.status)) : filtered;
  const sorted = [...visible].sort((a, b) => {
    if (sort === 'recent') {
      const ta = a.statusChangedAt ? new Date(a.statusChangedAt).getTime() : new Date(a.date).getTime();
      const tb = b.statusChangedAt ? new Date(b.statusChangedAt).getTime() : new Date(b.date).getTime();
      return tb - ta;
    }
    const ia = STATUS_SORT_ORDER.indexOf(a.status as StatusCode);
    const ib = STATUS_SORT_ORDER.indexOf(b.status as StatusCode);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const activeRows = sorted.filter((a) => !isTerminalStatus(a.status));
  const closedRows = activeOnly ? [] : sorted.filter((a) => isTerminalStatus(a.status));

  return (
    <>
      {/* Filter strip */}
      <div className="filter-strip">
        <span className="label">{showLabel}</span>
        <button
          type="button"
          className={`chip${filter === 'active' ? ' on' : ''}`}
          onClick={() => setFilter('active')}
        >
          {locale === 'es' ? 'Activos' : 'Active'}
          <span className="n">{counts.active}</span>
        </button>
        <button
          type="button"
          className={`chip${filter === 'all' ? ' on' : ''}`}
          onClick={() => setFilter('all')}
        >
          {locale === 'es' ? 'Todas' : 'All'}
          <span className="n">{counts.all}</span>
        </button>
        <button
          type="button"
          className={`chip${filter === 'terminal' ? ' on' : ''}`}
          onClick={() => setFilter('terminal')}
        >
          {locale === 'es' ? 'Cerradas' : 'Terminal'}
          <span className="n">{counts.terminal}</span>
        </button>

        <span className="divider" />

        {/* Score filter is preserved from v0.2 — UI-only chip (no behavior in v1).
            The underlying scoreNum data drives the filter wired up in a follow-up. */}
        <span className="chip">
          {TRACKER_STRINGS.filterScore[locale]}
          <span className="caret">▾</span>
        </span>

        <span className="divider" />

        <ActiveOnlyToggle on={activeOnly} onChange={setActiveOnly} locale={locale} />

        <span className="spacer" />

        <button
          type="button"
          className="sort"
          onClick={() => setSort(sort === 'recent' ? 'status' : 'recent')}
        >
          <span className="mono">{sortLabelMono}</span>
          {sort === 'recent' ? TRACKER_STRINGS.sortMostRecent[locale] : TRACKER_STRINGS.sortGroupByStatus[locale]}
          <span className="caret">▾</span>
        </button>
      </div>

      {/* List */}
      <div className="list">
        {activeRows.length === 0 && closedRows.length === 0 ? (
          <div style={{ padding: '32px 8px', color: 'var(--lm-ink-3)', fontFamily: 'var(--font-albert-sans)', fontSize: 14 }}>
            {TRACKER_STRINGS.emptyStateHeading[locale]} {TRACKER_STRINGS.fabPointerBody[locale]}
          </div>
        ) : null}

        {activeRows.map((app) => (
          <Row
            key={app.id}
            app={app}
            locale={locale}
            wayA={app.roleId ? wayAByRole[app.roleId] : undefined}
          />
        ))}

        {closedRows.length > 0 && (
          <>
            <div className="group-head">
              <span className="n">{closedRows.length}</span>
              <span>{locale === 'es' ? 'cerradas en los últimos 30 días' : 'closed in the last 30d'}</span>
              <span className="ln" />
            </div>
            {closedRows.map((app) => (
              <Row
                key={app.id}
                app={app}
                locale={locale}
                terminal
                wayA={app.roleId ? wayAByRole[app.roleId] : undefined}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}

function Row({
  app,
  locale,
  terminal,
  wayA,
}: {
  app: AppRow;
  locale: Locale;
  terminal?: boolean;
  wayA?: WayARenderable;
}) {
  const isAccepted = app.status === 'offer_accepted';
  const days = daysSince(app.statusChangedAt ?? app.date);

  // Role line with `·` separators
  const segments = [app.role, ...(app.meta ?? [])].filter(Boolean);
  const roleNode = segments.map((seg, i) => (
    <span key={i}>
      {i > 0 && <span className="sep">·</span>}
      <span>{seg}</span>
    </span>
  ));

  // Follow-up cell content. Priority: outcome affordance > stale touch > calm.
  const followUpContent = (() => {
    if (app.status === 'offer_pending') {
      return (
        <button
          type="button"
          className="outcome-aff"
          onClick={() => {
            if (!app.roleId) return;
            fetch('/api/pipeline/status', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roleId: app.roleId, status: 'offer_accepted' }),
            }).catch(() => { /* swallow */ });
          }}
        >
          {locale === 'es' ? '¿Qué pasó?' : 'What happened?'}
          <span className="ar">→</span>
        </button>
      );
    }
    if (app.status === 'applied' && days >= 7) {
      return (
        <span className="followup stale">
          <span className="pulse" />
          {locale === 'es' ? `${days}d desde toque` : `${days}d since touch`}
        </span>
      );
    }
    return <span className="followup"><span className="calm">—</span></span>;
  })();

  return (
    <>
      <div
        className={`row${terminal ? ' terminal' : ''}${isAccepted ? ' accepted-row' : ''}`}
      >
        <span className={`sdot ${app.status}`} aria-hidden="true" />
        <div className="who">
          <span className="co">
            {app.company}
            {isAccepted && <AcceptedPin locale={locale} />}
          </span>
          <span className="role">{roleNode}</span>
        </div>
        {/* Verdict slot — always present (empty span when no verdict) so the
            grid column doesn't collapse and adjacent columns don't shift. */}
        <span>
          <VerdictPill verdict={app.verdict} locale={locale} />
        </span>
        <StatusBadge
          status={app.status}
          locale={locale}
          onChange={app.roleId
            ? async (next) => {
                await fetch('/api/pipeline/status', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ roleId: app.roleId, status: next }),
                }).catch(() => { /* swallow */ });
                // Soft refresh so the row + counts re-render against the
                // server. v1 keeps this best-effort; v1.1 may add
                // optimistic local state.
                if (typeof window !== 'undefined') window.location.reload();
              }
            : undefined}
        />
        {followUpContent}
        <span className="days">
          <b>{days}d</b>&nbsp;{locale === 'es' ? 'atrás' : 'ago'}
        </span>
        {app.reportId ? (
          <Link href={`/reports/${app.reportId}`} className="reportlink">
            {locale === 'es' ? 'Informe →' : 'Report →'}
          </Link>
        ) : (
          <span />
        )}
      </div>

      {wayA && (
        <div className="wayA-line">
          <span className="lead" aria-hidden="true">›</span>
          <span className="body">{wayA.rendered[locale]}</span>
          {wayA.trigger.primaryActionStatus && app.roleId && (
            <button
              type="button"
              onClick={() => {
                fetch('/api/pipeline/status', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ roleId: app.roleId, status: wayA.trigger.primaryActionStatus }),
                }).catch(() => {});
              }}
            >
              {wayA.trigger.primaryActionStatus === 'ghosted'
                ? (locale === 'es' ? 'Marcar' : 'Mark')
                : (locale === 'es' ? 'Aplicar' : 'Apply')}
            </button>
          )}
          <button
            type="button"
            className="dismiss"
            aria-label={locale === 'es' ? 'Descartar' : 'Dismiss'}
            onClick={() => {
              if (!app.roleId) return;
              fetch('/api/tracker/wayA/dismiss', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roleId: app.roleId, triggerCode: wayA.trigger.code }),
              }).catch(() => {});
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

export { STATUS_LABELS };
