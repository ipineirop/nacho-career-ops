/**
 * Static bilingual strings for the Brief surface — kicker labels, action
 * labels, pipeline-summary vocabulary, fallback prose.
 *
 * Action codes (§3 of the handoff) are i18n catalog entries: the API returns
 * `{ code, label: { en, es } }` and the client renders the label matching
 * the user's locale.
 *
 * Kicker labels follow handoff §17.8: `[SUBJECT] LABEL · CONTEXT`. The
 * subject (`YOUR` / `TU` / `THE` / `LA`) is uppercase and italicized in the
 * mockup; we emit the kicker as plain text and the renderer wraps the
 * label segment in `<em>`.
 */

export type Locale = 'en' | 'es';

// ---------------------------------------------------------------------------
// Action labels (handoff §3)
// ---------------------------------------------------------------------------

export const ACTION_LABELS: Record<string, { en: string; es: string }> = {
  tailor: { en: 'Tailor & apply', es: 'Adapta y aplica' },
  evaluate: { en: 'Evaluate', es: 'Evalúa' },
  mute: { en: 'Mute', es: 'Silenciar' },
  draft_nudge: { en: 'Draft nudge', es: 'Redactar mensaje' },
  open_prep: { en: 'Open prep', es: 'Abrir prep' },
  tighten_model: { en: 'Tighten model', es: 'Afinar modelo' },
  update_preferences: { en: 'Update preferences', es: 'Actualizar preferencias' },
  recalibrate_cv: { en: 'Recalibrate CV', es: 'Recalibrar CV' },
  recalibrate_set: { en: 'Recalibrate set', es: 'Recalibrar set' },
  mark_closed: { en: 'Mark closed', es: 'Marcar cerrado' },
  show_list: { en: 'Show the list', es: 'Mostrar la lista' },
  show_overrides: { en: 'Show the {n} overrides', es: 'Mostrar los {n} overrides' },
  keep_as_is: { en: 'Keep as-is', es: 'Dejar como está' },
  snooze: { en: 'Snooze', es: 'Posponer' },
  dismiss: { en: 'Dismiss', es: 'Descartar' },
  skip: { en: 'Skip', es: 'Saltar' },
};

/** Resolve an action code to its bilingual label, substituting {n} when a
 *  count is supplied. */
export function resolveActionLabel(
  code: string,
  count?: number,
): { en: string; es: string } {
  const raw = ACTION_LABELS[code];
  if (!raw) return { en: code, es: code };
  if (count === undefined) return raw;
  return {
    en: raw.en.replace('{n}', String(count)),
    es: raw.es.replace('{n}', String(count)),
  };
}

/** Append a duration suffix to a snooze action label, e.g. "Snooze 3d" /
 *  "Posponer 3d". Format kept universal (the "d" is not translated). */
export function snoozeLabelWithDuration(days: number): { en: string; es: string } {
  return {
    en: `Snooze ${days}d`,
    es: `Posponer ${days}d`,
  };
}

// ---------------------------------------------------------------------------
// Kicker labels for each signal type (handoff §17.8 + screen mockup)
// ---------------------------------------------------------------------------

/** Pattern: `*<SUBJECT> <LABEL>* · <CONTEXT> · <TIMEFRAME>`.
 *  The label is italicized (*...*) so the renderer knows what to emphasize.
 *  Context (entity name) and timeframe stay source-language. */
export function buildKicker(
  parts: { subject: { en: string; es: string }; label: { en: string; es: string }; context?: string; timeframe?: string },
): { en: string; es: string } {
  const tail = [parts.context, parts.timeframe].filter(Boolean).join(' · ');
  const suffix = tail ? ` · ${tail}` : '';
  return {
    en: `*${parts.subject.en} ${parts.label.en}*${suffix}`,
    es: `*${parts.subject.es} ${parts.label.es}*${suffix}`,
  };
}

export const KICKER_LABELS = {
  freshness: { en: 'FRESHNESS', es: 'FRESHNESS' },
  drift: { en: 'DRIFT', es: 'DERIVA' },
  bar: { en: 'BAR', es: 'VARA' },
  pipelineCold: { en: 'PIPELINE · cold', es: 'PIPELINE · frío' },
  pipelineNext: { en: 'PIPELINE · next', es: 'PIPELINE · siguiente' },
} as const;

export const KICKER_SUBJECT_YOUR = { en: 'YOUR', es: 'TU' };
export const KICKER_SUBJECT_THE = { en: 'THE', es: 'LA' };

// ---------------------------------------------------------------------------
// Pipeline summary verdict words (handoff §17.8 verdict shape vocabulary)
// ---------------------------------------------------------------------------

/** Internal verdict codes (used in DB) → display-only localization. */
export const VERDICT_WORDS = {
  reply: { en: 'Reply', es: 'Responde' },
  pursue: { en: 'Pursue', es: 'Avanza' },
  watch: { en: 'Watch', es: 'Observa' },
  skip: { en: 'Skip', es: 'Pasa' },
} as const;

export type VerdictCode = keyof typeof VERDICT_WORDS;

/** Glyph for each verdict pill (wiring v0.2 mockup, source lines 529–532).
 *  Universal Unicode characters — NOT localized. */
export const VERDICT_GLYPHS: Record<VerdictCode, string> = {
  reply: '↪',
  pursue: '▲',
  watch: '○',
  skip: '✕',
};

// ---------------------------------------------------------------------------
// Pipeline-status taxonomy (DS §11 v3)
// ---------------------------------------------------------------------------

/** Bilingual label for each of the nine canonical statuses. Mirrors
 *  `PIPELINE_STATUS` in `lib/api/validation.ts`. The internal code is
 *  what's written to the DB; this catalog renders the user-facing label. */
export const STATUS_LABELS = {
  evaluating:      { en: 'Evaluating',     es: 'Evaluando' },
  applied:         { en: 'Applied',        es: 'Aplicada' },
  interviewing:    { en: 'Interviewing',   es: 'En entrevista' },
  offer_pending:   { en: 'Offer pending',  es: 'Oferta pendiente' },
  offer_accepted:  { en: 'Offer accepted', es: 'Aceptada' },
  rejected:        { en: 'Rejected',       es: 'Rechazada' },
  withdrew:        { en: 'Withdrew',       es: 'Retirada' },
  passed:          { en: 'Passed',         es: 'Descartada' },
  ghosted:         { en: 'Ghosted',        es: 'Sin respuesta' },
} as const;

export type StatusCode = keyof typeof STATUS_LABELS;

// ---------------------------------------------------------------------------
// Way-A trigger templates (§G of the wiring doc, all 9 v1 triggers)
// ---------------------------------------------------------------------------

/** Way-A is a data-driven deterministic template engine — no LLM. Templates
 *  hold `{company}` placeholders resolved at render via `interpolate()`. */
export const WAY_A_TEMPLATES = {
  // applied → 14d quiet
  followUp: {
    en: 'Send follow-up to {company}?',
    es: '¿Enviar seguimiento a {company}?',
  },
  // applied → 30d quiet
  markGhosted: {
    en: 'Mark {company} as ghosted?',
    es: '¿Marcar {company} sin respuesta?',
  },
  // interviewing → 21d quiet
  statusCheck: {
    en: 'Status check on {company}?',
    es: '¿Pedir status a {company}?',
  },
  // interviewing → 45d quiet
  didThisGoQuiet: {
    en: 'Did this go quiet? Mark ghosted?',
    es: '¿Se enfrió esto? ¿Marcar sin respuesta?',
  },
  // offer_pending → 5d
  captureOffer: {
    en: 'Capture the offer details: comp, deadline?',
    es: '¿Capturar detalles de oferta: comp, plazo?',
  },
  // offer_pending → 14d
  offerAging: {
    en: 'Offer aging. Respond or withdraw?',
    es: 'Oferta envejeciendo. ¿Responder o retirarse?',
  },
  // evaluating → 60d no movement
  stillConsidering: {
    en: 'Still considering {company}, or pass?',
    es: '¿Sigues considerando {company}, o pasas?',
  },
  // one-shot: status just changed → interviewing
  spinUpPrep: {
    en: 'Spin up prep?',
    es: '¿Abrir prep?',
  },
  // one-shot: status just changed → offer_pending
  captureOfferDetails: {
    en: 'Capture offer details?',
    es: '¿Capturar detalles de oferta?',
  },
} as const;

export type WayATemplateKey = keyof typeof WAY_A_TEMPLATES;

/** Substitute `{company}` (and any future `{var}`) in a template string. */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

/** Resolve a Way-A template to a bilingual rendered string. */
export function resolveWayATemplate(
  key: WayATemplateKey,
  vars: Record<string, string> = {},
): { en: string; es: string } {
  const t = WAY_A_TEMPLATES[key];
  return { en: interpolate(t.en, vars), es: interpolate(t.es, vars) };
}

// ---------------------------------------------------------------------------
// Tracker UI strings (filter strip, toggles, sort, FAB, outcome flow)
// ---------------------------------------------------------------------------

/** Exhaustive sweep of every user-facing string on the Tracker surface.
 *  The wiring doc requires the catalog to be the single source of truth —
 *  no hardcoded English in the row template. */
export const TRACKER_STRINGS = {
  // Header
  pipelineHeading: (active: number): { en: string; es: string } => ({
    en: `Pipeline · ${active} active`,
    es: `Pipeline · ${active} activas`,
  }),

  // View toggle
  viewList: { en: '≡ List', es: '≡ Lista' },
  viewBoard: { en: '⊞ Board', es: '⊞ Tablero' },

  // Filter strip (status filters and the kept Score chip)
  filterAll: { en: 'All', es: 'Todas' },
  filterActive: { en: 'Active', es: 'Activas' },
  filterApplied: { en: 'Applied', es: 'Aplicadas' },
  filterInterviewing: { en: 'Interviewing', es: 'En entrevista' },
  filterOfferPending: { en: 'Offer pending', es: 'Oferta pendiente' },
  filterScore: { en: 'Score', es: 'Score' },

  // Active-only toggle (chip with rail/thumb switch)
  activeOnlyLabel: { en: 'Active only', es: 'Sólo activas' },

  // Sort dropdown
  sortMostRecent: { en: 'Most recently touched', es: 'Toque más reciente' },
  sortGroupByStatus: { en: 'Group by status', es: 'Agrupar por estado' },

  // Closed-30d group header
  closedGroupHeader: (n: number): { en: string; es: string } => ({
    en: `${n} closed in the last 30d`,
    es: `${n} cerradas en los últimos 30 días`,
  }),

  // Row CTA (restructured from "I sent it — mark applied")
  rowMarkApplied: { en: 'Mark as applied', es: 'Marcar como aplicada' },

  // Recency token suffix on rows
  daysAgo: (n: number): { en: string; es: string } => ({
    en: `${n}d`,
    es: `${n}d`,
  }),

  // Journey view
  journeyHeader: { en: 'Journey view', es: 'Vista de trayecto' },
  journeyTotalsCaption: (n: number): { en: string; es: string } => ({
    en: `${n} total · as a route`,
    es: `${n} totales · como ruta`,
  }),

  // Empty state — points at the global Evaluate FAB
  emptyStateHeading: {
    en: 'Nothing in flight yet.',
    es: 'Nada en juego todavía.',
  },
  // FAB-pointer callout. The "L." chip + arrow are decorative; only the
  // text below is catalog content. Note: "job description" (not "JD") per
  // §16 banlist; verified against full wiring §A.2 em-dash table.
  fabPointerBody: {
    en: 'Tap Evaluate bottom-right to paste a DM, link, or job description.',
    es: 'Toca Evaluate abajo a la derecha para pegar un DM, link, o descripción.',
  },

  // Global FAB label (matches the Brief surface FAB)
  fabLabel: { en: 'Evaluate', es: 'Evaluate' },

  // Outcome capture flow (inline-expansion triggered by "I got an offer")
  outcomeGotOffer: { en: 'I got an offer', es: 'Recibí oferta' },
  outcomeAccepted: { en: 'I accepted', es: 'Acepté · tomo el puesto' },
  outcomeRejected: { en: 'They passed', es: 'Pasaron' },
  outcomeWithdrew: { en: 'I withdrew', es: 'Me retiré' },
  outcomeStillPending: { en: 'Still pending', es: 'Sigue pendiente' },

  // Aceptada findability tooltip on the ◆ pin glyph
  acceptedPinTooltip: { en: 'Accepted offer', es: 'Oferta aceptada' },

  // Status-change confirmation
  statusChangedToast: (label: string): { en: string; es: string } => ({
    en: `Status set to ${label}`,
    es: `Estado en ${label}`,
  }),

  // Edge-case: row with no evaluation history (manually added)
  noEvaluationRowHint: {
    en: 'No evaluation yet — open Evaluate to score this.',
    es: 'Sin evaluación todavía. Abre Evaluate para puntuarla.',
  },
} as const;

export type TrackerStringKey = keyof typeof TRACKER_STRINGS;

// ---------------------------------------------------------------------------
// Static UI strings used by surface components
// ---------------------------------------------------------------------------

export const BRIEF_STRINGS = {
  moreSignals: (n: number): { en: string; es: string } => ({
    en: `more signals (${n})`,
    es: `más señales (${n})`,
  }),
  emptyPipeline: {
    en: 'Nothing in flight right now.',
    es: 'Nada en juego ahora mismo.',
  },
  // Headline below the masthead. `brief` is italicized as the editorial
  // flourish; in EN the period sits inside the italic span ("brief.") so
  // the flourish reads at end-of-phrase. In ES "brief" lives mid-phrase
  // and the period stays plain at end. renderEmphasis() turns `*…*`
  // spans into <em>.
  todaysBrief: {
    en: "Today's *brief.*",
    es: 'El *brief* de hoy.',
  },
  // Right-meta strings for the header (handoff design + spec). The time
  // and minute count come from the client at render.
  lastRefresh: {
    en: 'LAST REFRESH',
    es: 'ÚLTIMA ACTUALIZACIÓN',
  },
  refreshMinutes: (n: number): { en: string; es: string } => ({
    en: `${n} MIN`,
    es: `${n} MIN`,
  }),
  refreshHours: (n: number): { en: string; es: string } => ({
    en: `${n} ${n === 1 ? 'HOUR' : 'HOURS'}`,
    es: `${n} ${n === 1 ? 'HORA' : 'HORAS'}`,
  }),
  refreshDays: (n: number): { en: string; es: string } => ({
    en: `${n} ${n === 1 ? 'DAY' : 'DAYS'}`,
    es: `${n} ${n === 1 ? 'DÍA' : 'DÍAS'}`,
  }),
  editorsNoteChip: {
    en: "Editor's note",
    es: 'Nota del editor',
  },
  // The sign-off has two parts (per source): a mono prefix and a Fraunces
  // italic role label. The component renders them as separate spans.
  editorSignOffPrefix: { en: '—', es: '—' },
  editorSignOffRole: { en: 'the editor', es: 'la editora' },
  // Stack head: "Signals · grounded today" + 2-digit count rendered as a
  // separate ink-colored span. The component composes the two parts.
  signalsHeadLabel: {
    en: 'Signals · grounded today',
    es: 'Señales · fundadas hoy',
  },
  // Quiet-day variants. Used when computeSignals() returns an empty array
  // AND no signals are firing — the Brief skips the LLM call and renders
  // deterministic copy instead of risking a "1 on the table" hallucination.
  signalsHeadQuiet: {
    en: 'Signals · all quiet',
    es: 'Señales · todo en calma',
  },
  signalsQuietBody: {
    en: 'Nothing pressing today. The pipeline below is the next place to look.',
    es: 'Nada urgente hoy. La pipeline abajo es el siguiente lugar para mirar.',
  },
  // Deterministic editor's note for quiet days. Matches the existing tone
  // (short, declarative, no exclamations, no recruiter jargon).
  editorsNoteQuietDay: {
    en: 'All quiet today. Nothing on the table that needs you.',
    es: 'Día tranquilo. Nada en la mesa que te necesite.',
  },
  // Pipeline-summary "YOUR PIPELINE" label and tracker CTA.
  pipelineLabel: { en: 'YOUR PIPELINE', es: 'TU PIPELINE' },
  pipelineOpenTracker: {
    en: 'Open tracker →',
    es: 'Abrir tracker →',
  },
};
