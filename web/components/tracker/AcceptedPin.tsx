/**
 * AcceptedPin — ◆ findability glyph that sits inside `.co` next to the
 * company name. Mono Geist, color `--lm-win`, opacity .85 — matches v0.2
 * source line 488 (`.row .who .co .pin`).
 *
 * Universal Unicode character — NOT localized. Only the title attribute
 * is catalog content.
 */

import { TRACKER_STRINGS, type Locale } from '@/lib/brief/i18n';

export function AcceptedPin({ locale = 'en' }: { locale?: Locale }) {
  const tip = TRACKER_STRINGS.acceptedPinTooltip[locale];
  return (
    <span className="pin" title={tip} aria-label={tip}>◆</span>
  );
}
