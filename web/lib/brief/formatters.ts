/**
 * Date and pipeline-sentence formatters per handoff §17.3 + §17.8.
 *
 * Masthead date format:
 *   EN  → "Thursday May 14"   (weekday + month + day, no year, no comma)
 *   ES  → "jueves 14 de mayo" (weekday + day + "de" + month, lowercase)
 *
 * Pipeline summary sentence (handoff §17.8 + screen mockup):
 *   EN  → "12 Pursues open · 4 Replies live · 7 Watches"
 *   ES  → "12 en *Avanza* · 4 en *Responde* · 7 en *Observa*"
 *
 * Empty pipeline:
 *   EN  → "Nothing in flight right now."
 *   ES  → "Nada en juego ahora mismo."
 */

import { BRIEF_STRINGS, VERDICT_WORDS } from './i18n';

const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const ES_WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const ES_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function formatMastheadDate(date: Date): { en: string; es: string } {
  const dow = date.getDay();
  const day = date.getDate();
  const month = date.getMonth();
  return {
    en: `${EN_WEEKDAYS[dow]} ${EN_MONTHS[month]} ${day}`,
    es: `${ES_WEEKDAYS[dow]} ${day} de ${ES_MONTHS[month]}`,
  };
}

export interface PipelineCounts {
  reply: number;
  pursue: number;
  watch: number;
}

/**
 * Pipeline summary sentence. We surface a verdict-word segment only when its
 * count is > 0; if all counts are zero the empty-pipeline string applies.
 *
 * EN forms use pluralized labels: "Pursues open", "Replies live", "Watches".
 * ES forms use the localized verdict words in italics: "en *Avanza*" etc.
 */
export function formatPipelineSentence(counts: PipelineCounts): { en: string; es: string } {
  const total = counts.reply + counts.pursue + counts.watch;
  if (total === 0) {
    return BRIEF_STRINGS.emptyPipeline;
  }

  const enParts: string[] = [];
  const esParts: string[] = [];

  if (counts.pursue > 0) {
    enParts.push(`${counts.pursue} ${pluralEn('Pursue', counts.pursue)} open`);
    esParts.push(`${counts.pursue} en *${VERDICT_WORDS.pursue.es}*`);
  }
  if (counts.reply > 0) {
    enParts.push(`${counts.reply} ${pluralEn('Reply', counts.reply, 'Replies')} live`);
    esParts.push(`${counts.reply} en *${VERDICT_WORDS.reply.es}*`);
  }
  if (counts.watch > 0) {
    enParts.push(`${counts.watch} ${pluralEn('Watch', counts.watch, 'Watches')}`);
    esParts.push(`${counts.watch} en *${VERDICT_WORDS.watch.es}*`);
  }

  return {
    en: enParts.join(' · '),
    es: esParts.join(' · '),
  };
}

function pluralEn(singular: string, n: number, irregularPlural?: string): string {
  if (n === 1) return singular;
  return irregularPlural ?? singular + 's';
}
