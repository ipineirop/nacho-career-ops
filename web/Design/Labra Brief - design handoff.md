# Labra Brief — design handoff

For the design team. Defines what the Brief is, what it contains, what content rules apply, and what's locked vs. open for design's call. Does not specify code (data shape, caching, API). The complete structural reference lives in `Labra Brief - spec.md`.

This handoff assumes Design System v2 is the source of truth for all bilingual rules, voice, tokens, and patterns. Anything mentioned in DS v2 is not restated here — referenced by section.

---

## 1. What you're producing

A complete visual design of the Brief surface, ready for code to implement. Deliverables:

- `Labra Brief.html` mockup matching the conventions of existing screen files (`Labra Dashboard.html`, `Labra Tracker.html`, `Labra Evaluate Verdict.html`)
- **Desktop + mobile** frames, breakpoint at 720px (DS v2 §17.5 conventions for the toggle; Brief layout breakpoint locked at 720px in the structural spec)
- **Both locales:** `en` and `es` versions of the Brief — at minimum the masthead, editor's note, Pick, one or two signal cards, and pipeline summary in each language. The bilingual variants prove the kicker overflow rules (DS v2 §17.8) and date conventions (DS v2 §17.3) hold in real layout
- **All non-trivial states** for each block (see §3 below for the per-block list)
- **Edge-case frames:** an empty Brief (no signals, no Pick), a signal-heavy Brief (5 visible + collapsed), a Pick-only Brief (no signals)

What you do **not** need to invent: voice rules, banlists, verdict shape vocabulary, date conventions, kicker pattern, locale toggle pattern, color tokens, typography, spacing scale. All in DS v2.

---

## 2. Purpose & non-goals

The Brief is the daily editorial surface. It reflects the user's pipeline and behavior back at them in the editor's voice (DS v2 §16). The only Labra surface that reads across the whole pipeline plus the only one that surfaces forward-looking content from the portal scanner.

Sits alongside **Verdict** (locked decision moment for a single evaluation — Reply / Pursue / Watch / Skip) and **Tracker** (operational status of applications). The Brief is neither.

**Non-goals.** Not a dashboard. Not a feed. Not a content destination for generic market editorial (no salary trend articles, no "hiring climate" commentary). Not a replacement for Tracker.

**The mirror principle, enforced visually.** Every block that surfaces content must reference specific entities (companies, roles, counts) from the user's data. If a signal can't name proper nouns or a count, it doesn't render. Empty Brief is acceptable and honest. Generic Brief is destructive. Your design must make an empty Brief look intentional, not broken.

---

## 3. Anatomy

Fixed sequence, top to bottom:

| Order | Block | Conditional? |
|---|---|---|
| 1 | Masthead | Always present |
| 2 | Editor's note | Always present (fallback if LLM fails) |
| 3 | The Pick | Conditional — renders only if scan hit clears quality threshold (80) |
| 4 | Signal stack | Conditional — renders only if at least one signal is grounded |
| 5 | Pipeline summary | Always present |
| — | FAB | Persistent overlay; not a block |

Empty Brief renders blocks 1, 2, 5, and FAB. Blocks 3 and 4 omit entirely if their gating conditions fail; the surface above moves up flush.

---

## 4. Block-by-block

### 4.1 Masthead

**Purpose.** Editorial frame. Establishes daily cadence.

**Content format** (per DS v2 §17.3 dates + §5 masthead format):
- `en`: `№ 14 · Thursday May 14 · CDMX`
- `es`: `№ 14 · jueves 14 de mayo · CDMX`

**Data fields rendered.** `issueNumber`, `date` (locale-formatted), `location` (city code, untranslated).

**States.** Always rendered.

**Actions.** No "view past issues" link in v1 — explicitly omitted (a disabled link reads as broken; absent link reads as not-yet-built). Re-introduce when the archive surface ships.

### 4.2 Editor's note

**Purpose.** 1-paragraph daily lede in editor's voice. Sets tone for everything below.

**Content rules** (DS v2 §16 voice rules apply; differences by language per DS v2 §17.1 punctuation):
- 1 to 3 sentences
- Must reference at least one specific entity (company, role, count) from the user's data
- Editor speaks first-person `I` / `yo` (persona); `we` / `nosotros` banned
- Maximum one italicized phrase per language version
- English allows em-dashes; Spanish bans them

**States to design:**
- *Live* — LLM-generated text, full editorial paragraph
- *Fallback* — deterministic template when LLM generation fails twice. Templates: `en`: `№ 14. 3 on the table today.` / `es`: `№ 14. 3 en juego hoy.` Visually identical to live state; user shouldn't be able to tell which path produced the note
- *Loading* — skeleton, only ever visible on first-ever Brief view for a user (cached on subsequent days)

**Actions.** None.

### 4.3 The Pick *(conditional)*

**Purpose.** Surface one new opportunity from the portal scanner. The Brief's only forward-looking content.

**Renders only when scan hit clears quality threshold (80).** Otherwise the entire block omits.

**Content structure** (based on DS §12 existing Pick treatment, kept consistent):
- Kicker: `№ 1 · {fitRead} · {ageOnPortal} · {sourcePortal}` — e.g., `№ 1 · Strong fit · 2d · LinkedIn LatAm` / `№ 1 · Buen ajuste · 2d · LinkedIn LatAm`
- Headline: editorial line in Fraunces italic, pattern `{Company} just opened *your seat*.` / `{Company} acaba de abrir *tu puesto*.`
- Subhead: role title · company · location · segment
- Score chip: numeric score (preserved from DS §12). Pick uses a numeric score because it precedes user interaction; Verdict uses shape language because that's the decision being confirmed. Different surfaces, different jobs.
- Body: 1-paragraph editorial summary (LLM-generated; voice rules apply)
- Salary panel: band visualization with floor pin and confidence indicator (existing DS §12 pattern)

**States.** `present` (full card) or `absent` (omitted). No empty-state placeholder.

**Actions:**
- Primary: `Tailor & apply` / `Adapta y aplica`
- Secondary: `Evaluate` / `Evalúa` — re-evaluation against current data (Pick already carries an implicit verdict from the scanner)
- Ghost: `Mute` / `Silenciar` — suppresses this specific role from future surfacing

### 4.4 Signal stack *(conditional, 0 to 5 visible)*

**Purpose.** Surface observations grounded in the user's data. The mirror.

**Five signal types** (DS v2 §17.8 kicker pattern applies to all):

| Internal code | EN kicker | ES kicker | What it surfaces |
|---|---|---|---|
| `freshness` | *YOUR FRESHNESS* | *TU FRESHNESS* | An input the system depends on is stale (`TU FRESHNESS` keeps the English noun as a product term, parallel to `TU PIPELINE`) |
| `drift` | *YOUR DRIFT* | *TU DERIVA* | Stated preferences vs actual behavior diverge |
| `bar` | *YOUR BAR* | *TU VARA* | User's bar is calibrated differently than the model assumes |
| `pipeline.cold` | *YOUR PIPELINE · cold* | *TU PIPELINE · frío* | A live thread has gone quiet |
| `pipeline.next` | *YOUR PIPELINE · next* | *TU PIPELINE · siguiente* | A recent status change has an obvious next step |

**Common card structure:**
- Kicker: `*KICKER · CONTEXT*` — context is entity or timeframe (e.g., `· MERCADO LIBRE · 7D` or `· 7 MO`). Entity names never translated; timeframes use universal single-letter abbreviations (D / W / M / Y) per DS v2 §17.8
- Body: 1 paragraph in editor's voice (LLM-generated, bilingual, linter-enforced)
- Primary action — signal-type-specific
- Secondary action — signal-type-specific
- Ghost action — `Snooze` / `Posponer` or `Dismiss` / `Descartar` (always present)

**Actions per signal type:**

| Type | Primary | Secondary | Ghost |
|---|---|---|---|
| Freshness | `Recalibrate {input}` | `Keep as-is` | `Snooze 30d` |
| Drift | `Update preferences` | `Show the list` | `Dismiss` |
| Bar | `Tighten model` | `Show the {n} overrides` | `Keep as-is` |
| Pipeline · cold | `Draft nudge` | `Mark closed` | `Snooze 3d` |
| Pipeline · next | `Open prep` / context-specific | `Skip` | — |

**Display rules:**
- Maximum 5 cards visible above the fold
- Priority order: Pipeline cold → Pipeline next → Bar → Drift → Freshness (time-urgency first)
- Cards beyond 5 collapse under `more signals (n)` / `más señales (n)` expand control
- Snooze durations are system-imposed in v1, not user-configurable

**States to design:**
- *Live* — signal triggered, card renders
- *Snoozed* — card hidden until snooze window expires (no in-Brief representation; just absent until trigger re-fires)
- *Dismissed* — card hidden permanently for this occurrence (same signal type can re-surface on a new trigger)
- *Empty (stack-level)* — no signals grounded today; entire block omits. Pipeline summary flows up flush below editor's note or Pick. No placeholder, no padding — a quiet day is visibly quiet.
- *More signals expanded* — what happens when user expands the collapsed remainder. Inline reveal vs sheet vs modal — your call.

### 4.5 Pipeline summary

**Purpose.** State-of-pipeline single sentence at the bottom of the Brief. Links to Tracker. Reading material, not stats.

**Content format** (verdict shapes per DS v2 §17.2):
- `en`: e.g., `12 Pursues open · 4 Replies live · 7 Watches`
- `es`: e.g., `12 en *Avanza* · 4 en *Responde* · 7 en *Observa*`

**States to design:**
- *Live* — counts > 0
- *Empty* — at least one count = 0; sentence rewrites. `en`: `Nothing in flight right now.` / `es`: `Nada en juego ahora mismo.`

**Actions.** Whole line links to Tracker. No separate buttons.

### 4.6 FAB

**Purpose.** Universal `evaluate this URL` entry point. Persistent across all surfaces, not specific to Brief.

**Position on Brief.** Bottom-right, persistent. Signal stack respects FAB safe area on small screens — the bottommost signal card must not be obscured.

---

## 5. Cross-cutting rules (all from DS v2)

For the avoidance of duplication, the design references DS v2 directly. Do not reinvent any of these:

- **Voice rules** — DS v2 §16. English + Spanish, side by side, do/don't, banlists.
- **Punctuation by language** — DS v2 §17.1. Em-dashes EN-only; Spanish uses semicolons, colons, or commas.
- **Verdict shape vocabulary** — DS v2 §17.2. Reply/Pursue/Watch/Skip → Responde/Avanza/Observa/Pasa. Display-only localization; internal codes stay English.
- **Date formatting** — DS v2 §17.3. Lowercase Spanish weekdays/months, no comma between weekday and day, cardinal day-of-month, no year in compact contexts.
- **Default locale detection** — DS v2 §17.4. Explicit choice wins; else browser locale; else Spanish default.
- **Locale toggle in global navigation** — DS v2 §17.5. The toggle isn't a Brief concern, but the Brief must coexist with it.
- **Locale switch behavior: instant** — DS v2 §17.6. Both languages cached in the same payload; switching is render-time.
- **Input ≠ output language** — DS v2 §17.7. The Brief always renders in user locale regardless of source-material language.
- **Kicker pattern** — DS v2 §17.8. Visual treatment, structure (SUBJECT · CONTEXT), overflow rule (auto-shrink at narrow widths, never wrap or truncate).
- **Numbers, currency, quotes** — DS v2 §17.10. Opening `¿` in Spanish, currency follows currency-locale not user-locale, quote conventions.

---

## 6. Empty Brief — what design must get right

Empty Brief is the trickiest state because it has to feel intentional, not broken.

What an empty Brief looks like: Masthead, Editor's note (acknowledging the quiet day in its own voice — see DS v2 §16), Pipeline summary, FAB. No padding cards, no placeholder slots, no "no signals to show right now" filler text.

The visual challenge: don't let the Editor's note balloon vertically to fill the void. Spec is locked: Editor's note stays its normal height; the page is shorter. A short Brief reads as honest. A tall padded Brief reads as a product hiding the fact that there's nothing to say.

Acceptable patterns: tight vertical rhythm, maybe a subtle bottom-fade or footer note that reads as deliberate (not as "scroll for more"). Avoid hero illustrations, motivational quotes, or "stay tuned" framings.

---

## 7. Open design decisions

These are locked at the structural level but design owns the visual treatment:

1. **Card density in the signal stack.** Five cards on desktop is the cap, but the visual rhythm between them is your call. Tighter (closer to feed-like) vs more breathing room (closer to magazine-like). The voice register suggests magazine. Confirm.
2. **The `more signals (n)` expand control.** Inline reveal vs sheet vs modal vs separate route. The signals don't lose their state when collapsed — they're just hidden. Design call.
3. **Snooze / Dismiss button treatment.** Per the voice rules, no sales-y micro-interactions. But these are functional buttons — they should feel respectful, not punishing. Consider: are they always visible, or revealed on hover/long-press? Mobile + desktop both matter.
4. **Loading skeleton.** Only ever appears on a user's first-ever Brief view. Should still feel like Labra — not a generic shimmer. Probably the masthead renders immediately (no LLM dependency) and the Editor's note + Pick + signals come in. Design what that progression looks like.
5. **Dismissal animation.** When a user dismisses a signal card, does it fade, slide, or just disappear on next render? Spec is silent — your call. Recommend: instant or near-instant, no celebratory animation (per voice rules).
6. **Pick → Verdict transition.** Tapping `Evaluate` on the Pick opens a fresh Verdict screen with current data. The transition is a design question — modal, route, slide-over? Coordinate with the Verdict surface owner.
7. **Mobile FAB safe area.** The FAB lives bottom-right. Signal cards must not be obscured at any scroll position. Spec the safe area visually.
8. **`en` ↔ `es` toggle feedback.** Per DS v2 §17.6, the switch is instant — no spinner. But subtle visual confirmation (a flicker on the toggle, or a 100ms fade through) may help the user trust the change happened. Or it may feel gimmicky. Test it visually.

---

## 8. Out of scope for v1 (do NOT design these)

- **Brief archive UI** — the "view past issues" link is omitted in v1. Don't design an archive surface.
- **Pattern log** — separate v1.5 surface; observation logging happens in the background but no UI in v1.
- **External-signal triggered cards** (funding news, comp shifts) — different product, deferred.
- **`vos`-form Spanish variants** (`es-AR` / `es-UY` / `es-CR`) — toggle structure should anticipate the third state but v1 renders only `en` and neutral `es`.
- **ATS integration UI** — status updates are manual in v1.
- **Onboarding language-selector placement** — owned by the onboarding redesign session, not the Brief.
- **Manual force-regenerate of the Brief** — no pull-to-refresh causing regeneration. Pull-to-refresh updates data shown but does not re-roll the Editor's note (DS v2 §17.6 instant switch behavior).

---

## 9. References

- `Labra Design System v2.html` — source of truth for all bilingual rules, voice, tokens, kicker patterns, locale toggle, masthead format, dates, verdict vocabulary
- `Labra Brief - spec.md` — complete structural spec including data shape for code (for your reference if needed)
- `Labra Evaluate Verdict.html` — locked Verdict screen, source of truth for verdict shape language and visual treatment of the Verdict-to-Brief relationship
- `Labra Tracker.html` — locked Tracker; the Brief must not duplicate its job
- `Labra Navigation.html` — global navigation pattern (hosts the locale toggle)
- DS §12 (within DS v2) — existing Brief section, now extended for bilingual

---

## 10. After design ships

When the visual mockup is ready, the next handoff is to code. That handoff combines:

- This document (structural definition + states + content rules)
- The visual mockup you produce
- `Labra Brief - spec.md` (which includes the data shape, caching, LLM prompt requirements)
- DS v2 (tokens, patterns, voice, bilingual rules)

Code should have zero design decisions to make at that point.
