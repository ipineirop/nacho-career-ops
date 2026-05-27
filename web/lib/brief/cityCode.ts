/**
 * City code resolution for the Masthead. Handoff §17.3 examples: `CDMX`,
 * `BOG`, `SCL`. Codes are NEVER translated — they're city identity, not UI.
 *
 * Strategy:
 *   1. Look up the canonical LatAm map.
 *   2. Otherwise, take the first three letters of the city name, uppercased.
 *
 * Falls back to "—" if no city is on file (the Brief still renders; the
 * masthead loses the location segment but stays valid).
 */

const CITY_MAP: Record<string, string> = {
  // LatAm capitals + major hubs (handoff §17.3 examples + obvious extensions)
  'mexico city': 'CDMX',
  'ciudad de mexico': 'CDMX',
  'ciudad de méxico': 'CDMX',
  bogota: 'BOG',
  bogotá: 'BOG',
  santiago: 'SCL',
  'buenos aires': 'BUE',
  lima: 'LIM',
  'sao paulo': 'SAO',
  'são paulo': 'SAO',
  'rio de janeiro': 'RIO',
  'monterrey': 'MTY',
  guadalajara: 'GDL',
  medellin: 'MDE',
  medellín: 'MDE',
  // Common non-LatAm hubs Labra users sometimes target
  'new york': 'NYC',
  'san francisco': 'SFO',
  london: 'LON',
  madrid: 'MAD',
  barcelona: 'BCN',
  miami: 'MIA',
};

export function cityCodeFor(city: string | null | undefined): string {
  if (!city) return '—';
  const normalized = city.trim().toLowerCase();
  if (CITY_MAP[normalized]) return CITY_MAP[normalized];
  // Fallback: first three uppercase letters, alpha only.
  const alpha = normalized.replace(/[^a-záéíóúñ]/g, '');
  return alpha.slice(0, 3).toUpperCase() || '—';
}

/** Title-cased city name for the right-meta block. Keeps source-language
 *  (we don't translate `Mexico City` to `Ciudad de México` or vice versa
 *  — the city is its own identity). Returns an empty string when no city
 *  is on file. */
export function cityNameFor(city: string | null | undefined): string {
  if (!city) return '';
  return city
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}
