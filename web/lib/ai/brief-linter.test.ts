import { describe, expect, it } from 'vitest';
import { lintBriefText, lintBriefBilingual, __internals } from './brief-linter';

// Grounding tokens that pass — every "ok" case below includes "Kavak" in the
// body so the grounding check doesn't flag it.
const G = ['Kavak'];

describe('lintBriefText — happy path', () => {
  it('accepts a clean grounded EN sentence', () => {
    expect(
      lintBriefText('Kavak just opened a seat worth your attention.', {
        language: 'en',
        groundingTokens: G,
      }),
    ).toEqual({ ok: true });
  });

  it('accepts a clean grounded ES sentence (no em-dash)', () => {
    expect(
      lintBriefText('Kavak abrió un puesto que vale tu atención.', {
        language: 'es',
        groundingTokens: G,
      }),
    ).toEqual({ ok: true });
  });

  it('accepts a single italicized span', () => {
    const r = lintBriefText('Kavak opened *your seat* today.', {
      language: 'en',
      groundingTokens: G,
    });
    expect(r.ok).toBe(true);
  });

  it('skips grounding when no tokens supplied (fallback templates)', () => {
    const r = lintBriefText('No 14. 3 on the table today.', {
      language: 'en',
      groundingTokens: [],
    });
    expect(r.ok).toBe(true);
  });
});

describe('lintBriefText — banlists', () => {
  it('rejects EN banlist: amazing', () => {
    const r = lintBriefText('Kavak has an amazing opportunity for you.', {
      language: 'en',
      groundingTokens: G,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings.map((f) => f.reason)).toContain('banlist_phrase');
  });

  it('rejects EN banlist: apply now', () => {
    const r = lintBriefText('Kavak is hiring. Apply now.', {
      language: 'en',
      groundingTokens: G,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings.map((f) => f.detail)).toContain('apply now');
  });

  it('rejects ES banlist: increíble', () => {
    const r = lintBriefText('Kavak tiene una oportunidad increíble.', {
      language: 'es',
      groundingTokens: G,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings.map((f) => f.reason)).toContain('banlist_phrase');
  });

  it('rejects ES banlist: te traemos', () => {
    const r = lintBriefText('Kavak: te traemos un puesto nuevo.', {
      language: 'es',
      groundingTokens: G,
    });
    expect(r.ok).toBe(false);
  });

  it('EN banlist does not fire on Spanish-only phrases', () => {
    const r = lintBriefText('Kavak has increíble vibes.', {
      language: 'en',
      groundingTokens: G,
    });
    // "increíble" is in ES banlist, not EN. No exclamation, no JD. Should pass.
    expect(r.ok).toBe(true);
  });
});

describe('lintBriefText — emoji + exclamation', () => {
  it('rejects emoji', () => {
    const r = lintBriefText('Kavak opened a seat 🎉.', {
      language: 'en',
      groundingTokens: G,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings.map((f) => f.reason)).toContain('emoji');
  });

  it('rejects exclamation (!)', () => {
    const r = lintBriefText('Kavak opened a seat!', {
      language: 'en',
      groundingTokens: G,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings.map((f) => f.reason)).toContain('exclamation');
  });

  it('rejects Spanish opening exclamation (¡)', () => {
    const r = lintBriefText('¡Kavak abrió un puesto.', {
      language: 'es',
      groundingTokens: G,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings.map((f) => f.reason)).toContain('exclamation');
  });
});

describe('lintBriefText — em-dash (ES only)', () => {
  it('rejects em-dash in Spanish', () => {
    const r = lintBriefText('Kavak abrió un puesto — vale tu atención.', {
      language: 'es',
      groundingTokens: G,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings.map((f) => f.reason)).toContain('em_dash_es');
  });

  it('accepts em-dash in English', () => {
    const r = lintBriefText('Kavak opened a seat — worth your attention.', {
      language: 'en',
      groundingTokens: G,
    });
    expect(r.ok).toBe(true);
  });
});

describe('lintBriefText — sentence + italic limits', () => {
  it('rejects more than 3 sentences', () => {
    const r = lintBriefText(
      'Kavak opened a seat. It looks strong. The team is great. You should check it.',
      { language: 'en', groundingTokens: G },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings.map((f) => f.reason)).toContain('too_many_sentences');
  });

  it('accepts exactly 3 sentences', () => {
    const r = lintBriefText(
      'Kavak opened a seat. It looks strong. The team is great.',
      { language: 'en', groundingTokens: G },
    );
    expect(r.ok).toBe(true);
  });

  it('rejects more than 1 italic span', () => {
    const r = lintBriefText('Kavak opened *your seat* in *Mexico City* today.', {
      language: 'en',
      groundingTokens: G,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings.map((f) => f.reason)).toContain('too_many_italics');
  });

  it('countSentences strips italics before counting', () => {
    expect(__internals.countSentences('Kavak opened *your seat*. Worth a look.')).toBe(2);
  });
});

describe('lintBriefText — JD jargon', () => {
  it('rejects standalone JD', () => {
    const r = lintBriefText('The JD lists every system you owned at Kavak.', {
      language: 'en',
      groundingTokens: G,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings.map((f) => f.reason)).toContain('jd_jargon');
  });

  it('rejects lowercase jd as standalone token', () => {
    const r = lintBriefText('Kavak jd is long.', {
      language: 'en',
      groundingTokens: G,
    });
    expect(r.ok).toBe(false);
  });

  it('does not flag JD inside larger words', () => {
    const r = lintBriefText('Kavak is a JDM-themed startup in JDMville.', {
      language: 'en',
      groundingTokens: G,
    });
    expect(r.ok).toBe(true);
  });

  it('rejects JD in Spanish too', () => {
    const r = lintBriefText('La JD enlista cada sistema en Kavak.', {
      language: 'es',
      groundingTokens: G,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings.map((f) => f.reason)).toContain('jd_jargon');
  });
});

describe('lintBriefText — grounding', () => {
  it('rejects when no grounding token appears in body', () => {
    const r = lintBriefText('You should follow up on some applications.', {
      language: 'en',
      groundingTokens: ['Mercado Libre', 'Kavak'],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings.map((f) => f.reason)).toContain('ungrounded');
  });

  it('grounding match is case-insensitive', () => {
    const r = lintBriefText('mercado libre opened a seat.', {
      language: 'en',
      groundingTokens: ['Mercado Libre'],
    });
    expect(r.ok).toBe(true);
  });

  it('count tokens like "3" satisfy grounding', () => {
    const r = lintBriefText('You have 3 active threads worth a check.', {
      language: 'en',
      groundingTokens: ['3'],
    });
    expect(r.ok).toBe(true);
  });
});

describe('lintBriefText — bold vs italic interaction', () => {
  it('counts unlimited **bold** spans without flagging them as italics', () => {
    const r = lintBriefText('**Kavak** opened a seat and **Clara** went quiet.', {
      language: 'en',
      groundingTokens: G,
    });
    expect(r.ok).toBe(true);
  });

  it('still caps *italic* spans at 1 alongside any number of bolds', () => {
    const r = lintBriefText('**Kavak** opened *your seat* and *another seat*.', {
      language: 'en',
      groundingTokens: G,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings.map((f) => f.reason)).toContain('too_many_italics');
  });

  it('accepts one bold + one italic', () => {
    const r = lintBriefText('**Kavak** matches your scope *line-for-line* today.', {
      language: 'en',
      groundingTokens: G,
    });
    expect(r.ok).toBe(true);
  });

  it('countSentences strips both bold and italic before counting', () => {
    expect(__internals.countSentences('**Kavak** opened *your seat*. Worth a look.')).toBe(2);
  });
});

describe('lintBriefBilingual', () => {
  it('passes when both versions are clean', () => {
    const r = lintBriefBilingual(
      {
        en: 'Kavak just opened a seat worth your attention.',
        es: 'Kavak abrió un puesto que vale tu atención.',
      },
      G,
    );
    expect(r.ok).toBe(true);
  });

  it('fails when only the ES version has an em-dash', () => {
    const r = lintBriefBilingual(
      {
        en: 'Kavak opened a seat — worth your attention.',
        es: 'Kavak abrió un puesto — vale tu atención.',
      },
      G,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.en).toEqual([]);
      expect(r.es.map((f) => f.reason)).toContain('em_dash_es');
    }
  });

  it('reports findings on both sides when both fail', () => {
    const r = lintBriefBilingual(
      { en: 'Apply now!', es: '¡Aplica ya!' },
      G,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.en.length).toBeGreaterThan(0);
      expect(r.es.length).toBeGreaterThan(0);
    }
  });
});
