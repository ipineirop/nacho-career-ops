/**
 * Editor's note — exact match to the canonical source at
 * `Labra Brief.html` lines 271-299. Every value is taken from there;
 * any deviation should be re-validated against the source.
 *
 *   .ednote        → accent-soft bg, 14px radius, 22/26/24 padding, position: relative
 *   .ednote .tab   → absolute top:-10 left:22, mono 10px / 1.2px tracking,
 *                    accent text, page-bg fill, 1px accent border, line-height 1.6
 *   .ednote p      → Fraunces 18px / 1.5 / 400, ink color
 *   .ednote p b    → weight 500
 *   .ednote p em   → italic
 *   .ednote .sig   → mono 10px / 1.2px tracking, uppercase, accent;
 *                    inner <em> swaps to Fraunces italic 11.5px non-uppercase,
 *                    letter-spacing 0.4, still accent.
 */

import type { BriefEditorsNote } from '@/lib/brief/types';
import { BRIEF_STRINGS } from '@/lib/brief/i18n';
import { pick, renderEmphasis, type Locale } from './text';

export function EditorsNote({
  note,
  locale,
}: {
  note: BriefEditorsNote;
  locale: Locale;
}) {
  const text = pick(note.text, locale);
  return (
    <section
      className="relative bg-accent-soft"
      style={{
        borderRadius: '14px',
        padding: '22px 26px 24px',
        marginBottom: '36px',
      }}
      data-generation-method={note.generationMethod}
    >
      <span
        className="absolute font-mono uppercase text-accent"
        style={{
          top: '-10px',
          left: '22px',
          fontSize: '10px',
          letterSpacing: '1.2px',
          padding: '2px 10px',
          borderRadius: '999px',
          background: 'var(--lm-bg)',
          border: '1px solid var(--lm-accent)',
          lineHeight: 1.6,
          textTransform: 'uppercase',
        }}
      >
        {pick(BRIEF_STRINGS.editorsNoteChip, locale)}
      </span>

      <p
        className="font-serif text-ink m-0"
        style={{ fontSize: '18px', lineHeight: 1.5, fontWeight: 400 }}
      >
        {renderEmphasis(text)}
      </p>

      {/* Sign-off: mono em-dash prefix + Fraunces-italic role label.
          Both pieces are accent-colored. */}
      <span
        className="font-mono uppercase text-accent"
        style={{
          display: 'inline-block',
          marginTop: '14px',
          fontSize: '10px',
          letterSpacing: '1.2px',
        }}
      >
        {pick(BRIEF_STRINGS.editorSignOffPrefix, locale)}{' '}
        <em
          className="not-italic"
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '11.5px',
            letterSpacing: '0.4px',
            textTransform: 'none',
          }}
        >
          {pick(BRIEF_STRINGS.editorSignOffRole, locale)}
        </em>
      </span>
    </section>
  );
}
