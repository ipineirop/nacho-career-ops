'use client';

import { useState } from 'react';
import type { InputType } from './useClassification';

interface Props {
  type: InputType | null;
  confidence: number | null;
  onChange: (newType: InputType) => void;
}

const LABEL: Record<InputType, string> = {
  dm: 'recruiter message',
  jd: 'job description',
  url: 'URL',
};

const OPTIONS: InputType[] = ['dm', 'jd', 'url'];

/**
 * "Reading as: {label} · change" — only surfaces when the classifier is
 * unsure (confidence < 0.9). The picker is inline (no popover / sheet)
 * per the v1 design — three buttons in a row that collapse on select.
 * Rule 10: words over glyphs — no icons.
 */
export function ClassificationChip({ type, confidence, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const visible = type !== null && confidence !== null && confidence < 0.9;

  function pick(t: InputType) {
    onChange(t);
    setPickerOpen(false);
  }

  return (
    <div
      // Always rendered so the opacity transition is smooth. Inert when invisible.
      className={[
        'mt-s3 transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      ].join(' ')}
      aria-hidden={!visible}
    >
      <div className="font-mono text-[12px] text-ink-2">
        Reading as: <span>{type ? LABEL[type] : ''}</span>
        <span className="text-ink-3"> · </span>
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="text-ink underline underline-offset-2 bg-transparent border-0 p-0 font-mono text-[12px] cursor-pointer"
        >
          change
        </button>
      </div>

      {pickerOpen && (
        <div className="mt-s2 flex flex-wrap gap-s2">
          {OPTIONS.map((opt) => {
            const isCurrent = opt === type;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => pick(opt)}
                className={[
                  'px-s3 h-[28px] rounded-pill font-mono text-[11px] border cursor-pointer',
                  isCurrent
                    ? 'bg-ink text-bg border-ink'
                    : 'bg-surface text-ink-2 border-line hover:text-ink hover:border-ink-3',
                ].join(' ')}
              >
                {LABEL[opt]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
