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
  // Pipeline-summary "YOUR PIPELINE" label and tracker CTA.
  pipelineLabel: { en: 'YOUR PIPELINE', es: 'TU PIPELINE' },
  pipelineOpenTracker: {
    en: 'Open tracker →',
    es: 'Abrir tracker →',
  },
};
