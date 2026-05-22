import type { CompStrip as CompStripData } from './types';

/**
 * Block D (comp & demand) presented for the candidate — the rich comp strip
 * from the design. Renders the .comp-row markup; styling lives in globals.css
 * under .verdict-view (state-* classes carry the band-fit color).
 */
export function CompStrip({ comp }: { comp: CompStripData }) {
  const markBelow = comp.markPct < 12; // flip the label below the bar near the floor
  return (
    <div className="v-section">
      <div className="skicker">★ <b>Comp</b> — reference, not anchor</div>
      <div className={`comp-row${comp.state === 'ok' ? ' state-ok' : comp.state === 'positive' ? ' state-positive' : ''}`}>
        <div className="comp-head">
          <div className="comp-kicker">
            <span>Comp</span><span className="sep">·</span>
            <span className="grade-name">{comp.gradeLabel}</span>
            {comp.vintage ? <><span className="sep">·</span><span className="vintage">{comp.vintage}</span></> : null}
          </div>
          <div className="grade-r"><span className="dots">{comp.gradeDots}</span>{comp.gradeLabel}</div>
        </div>

        {comp.rangeLabel ? <div className="comp-range">{comp.rangeLabel}</div> : null}

        {(comp.word || comp.gloss) ? (
          <div className="comp-verdict">
            {comp.word ? <span className="word">{comp.word}<em>.</em></span> : null}
            {comp.gloss ? <span className="gloss" dangerouslySetInnerHTML={{ __html: boldify(comp.gloss) }} /> : null}
          </div>
        ) : null}

        {comp.ceilingValue > comp.floorValue ? (
          <div className="comp-track">
            <div className="track-bar"><div className="track-fill" /></div>
            <div className={`mark${markBelow ? ' below' : ''}`} style={{ left: `${comp.markPct}%` }}>
              {comp.markLabel ? <span className="lbl">{comp.markLabel}</span> : null}
              <span className="dot" />
            </div>
            <div className="track-axis">
              <span>{fmt(comp.floorValue)}</span>
              <span>{fmt(comp.ceilingValue)}</span>
            </div>
          </div>
        ) : null}

        {comp.statusText ? (
          <div className="comp-status">
            {comp.statusGlyph ? <span className="glyph">{comp.statusGlyph}</span> : null}
            <span className="txt" dangerouslySetInnerHTML={{ __html: boldify(comp.statusText) }} />
          </div>
        ) : null}

        {comp.actionText ? (
          <div className="comp-action">
            {comp.actionGlyph ? <span className="glyph">{comp.actionGlyph}</span> : null}
            <span className="txt" dangerouslySetInnerHTML={{ __html: boldify(comp.actionText) }} />
          </div>
        ) : null}

        {comp.source ? <div className="comp-source">{comp.source}</div> : null}
      </div>
    </div>
  );
}

// Render **bold** spans (model emits markdown emphasis in comp prose), escaping HTML first.
function boldify(s: string): string {
  const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

// Compact money axis label (no currency symbol — the range line carries it).
function fmt(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}
