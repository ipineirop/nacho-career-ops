# Labra Design System — bilingual update

Handoff artifact for the design team. Captures every change needed to the LeadMe Design System to support bilingual operation (English + Spanish) across all Labra surfaces. Companion to `Labra Brief - spec.md` (which specifies the Brief surface itself).

The decisions in this document are **system-wide** — they apply to Brief, Verdict, Tracker, Settings, Navigation, and any future Labra surface. Not specific to any one surface.

---

## Context

Labra is LatAm-focused, so English-only is architecturally wrong. The system ships bilingual from day one: English (`en`) and neutral LatAm Spanish (`es`, `tú` form). Both versions of every content field are produced together and stored together — no async translation flow.

`vos`-form Spanish variants (`es-AR`, `es-UY`, `es-CR`) are deliberately deferred for v1. They're real and important, but adding them at launch doubles the voice authoring work without proven need.

The decisions below are the DS-level work required to make the bilingual architecture real. They were resolved alongside the Brief structural spec.

---

## 1. Spanish voice rules — for §16

LeadMe DS §16 currently defines voice rules in English only. The Spanish equivalent below should fold into §16 as a parallel sub-section. Native-speaker review by your team recommended before publish.

### Tono

Franco, sobrio, informado. Le habla de tú a tú a un Director; no le habla desde arriba al usuario.

### Dicción

Frases cortas. Punto y coma, dos puntos o comas para introducir modificadores y aposiciones. **Sin guiones largos (—)**: el guión largo no se usa en redacción neutral LatAm, contrario al uso en inglés. Cursivas con moderación. Sin signos de exclamación.

### Honestidad

Cuando algo no es claro, dilo. *"Confianza media; 2 fuentes"* supera la falsa certeza.

### Nunca

Gamificación, urgencia, emoji, CTAs de venta, *"nosotros"* como producto.

### Ejemplos a seguir (Do)

> "Kavak acaba de abrir *tu puesto*."
>
> "Vale la pena: *con matices*."
>
> "'Competitivo' está cargando mucho en ese DM. El mercado para Head of Ops en una fintech mexicana en Serie C con tu alcance: $1.9–2.4M MXN + 0.1–0.25% equity."

### Ejemplos a evitar (Don't)

> ✕ "🎉 ¡Encontramos 7 oportunidades increíbles para ti!"
>
> ✕ "¡No te pierdas estas coincidencias; aplica ahora!"
>
> ✕ "Puntuación: 82/100. Buena coincidencia."
>
> ✕ "Es hora de llevar tu carrera al siguiente nivel."

### Banlist (palabras y frases prohibidas en español)

- *Gamificación / superlativos:* `increíble`, `asombroso`, `espectacular`, `fantástico`, `extraordinario`
- *Urgencia / escasez:* `no te lo pierdas`, `imperdible`, `última oportunidad`, `oportunidad única`, `exclusivo / exclusiva` (cuando se usa para crear escasez)
- *CTAs de venta:* `lleva tu carrera al siguiente nivel`, `da el siguiente paso`, `transforma tu carrera`, `actúa ahora`, `aplica ya`, `no esperes más`
- *"Nosotros" como producto:* `encontramos`, `te traemos`, `te ofrecemos`
- *Jerga recruiter:* `JD` (use `descripción del puesto`)
- *Universales:* todo emoji, todo signo de exclamación, todo guión largo (—)

> **Note for §16 EN banlist as well:** the recruiter-jargon category applies to both languages. Add `JD` (use `job description`) to the existing English banlist in §16. DS v2 ships without this entry — it's a known correction for v3.

---

## 2. Punctuation divergence by language

This is the structural rule that makes Spanish editorial copy work without em-dashes.

- **English** — em-dashes allowed (per existing §16 dicción rules)
- **Spanish** — em-dashes **banned**. Use semicolons, colons, or commas for the modifier pattern
- **Linter enforces:** any LLM-generated Spanish content containing `—` is rejected and regenerated

Implication for code: the LLM linter has two banlists, one per language. The em-dash rule is one entry on the Spanish banlist; not on the English one.

---

## 3. Verdict shape vocabulary

The four verdict shapes (Reply / Pursue / Watch / Skip) are locked English vocabulary in the Verdict screen. Localization is display-only — internal codes stay English; UI labels resolve via the i18n catalog at render time. Spanish form is **imperative** (matches the English verb-as-verdict frame and preserves the editorial voice).

| Internal code | English UI | Spanish UI |
|---|---|---|
| `reply` | Reply | Responde |
| `pursue` | Pursue | Avanza |
| `watch` | Watch | Observa |
| `skip` | Skip | Pasa |

Applies wherever Verdict shape names appear in user-facing copy: Verdict screen itself, Brief Pipeline summary, Tracker, and any future surface that references these primitives.

Internal codes (database value, API value, analytics, logs, cross-team communication) stay English. This avoids translation-consistency risk and keeps engineering vocabulary stable.

---

## 4. Date formatting conventions in Spanish

For all Labra surfaces that display dates in Spanish copy:

- Weekdays and months are **lowercase** (RAE convention) — `jueves`, `mayo`, not `Jueves`, `Mayo`
- **No comma** between weekday and day-of-month — `jueves 14 de mayo`, not `jueves, 14 de mayo`
- Day-of-month: **cardinal** — `14`, not `14º`
- No year in compact contexts (masthead, kicker timestamps); include only when temporal disambiguation is required

English follows existing DS conventions — capitalized weekday and month, no comma — for consistency with current §12 examples.

---

## 5. Masthead format update — drop "Issue" prefix in English

LeadMe DS §12 currently shows the Brief masthead as `Issue №14 · Thursday May 14 · CDMX`. Update to drop the word "Issue" in favor of the universal `№` symbol — symmetric with Spanish, minimal, no translation required.

**New masthead format both languages:**

- `en`: `№ {n} · {Weekday Mon DD} · {LOCATION}` — e.g., `№ 14 · Thursday May 14 · CDMX`
- `es`: `№ {n} · {weekday DD de month} · {LOCATION}` — e.g., `№ 14 · jueves 14 de mayo · CDMX`

The `№` symbol is universal (Cyrillic origin, recognized in both English and Spanish typographic conventions). Carries the "issue number" meaning without a word. Spanish doesn't gain a "Número" or "Edición" prefix; English loses its "Issue" prefix. Symmetric.

This is the only change required in §12 to support bilingual mastheads.

---

## 6. Default locale detection logic

For users who have not explicitly chosen a locale, the system defaults to:

1. **Explicit user choice always wins.** If the user has set a locale (in onboarding, in Settings, or via the global nav toggle), that choice is honored regardless of any other signal.
2. **Else: browser locale** (`navigator.language` / `Accept-Language` header):
   - Any `en-*` variant → English UI
   - Any `es-*` variant → Spanish UI (neutral LatAm `tú` form, regardless of country code — vos variants are deferred)
3. **Else: Spanish default.** For browsers reporting any other locale (Portuguese, French, etc.), default to **Spanish, not English**. Labra is LatAm-focused; a Brazilian Portuguese speaker (likely passable in Spanish, rarely English-first) gets a better first impression in Spanish than in English.

This is a product positioning decision as much as a technical one. English-default is the safe choice for global products; for LatAm-focused products, it's the wrong default.

---

## 7. Locale toggle in global navigation

The locale toggle lives in **main / global navigation**, not buried in Settings. Accessible from every surface.

Design implication: every Labra screen needs to surface the global nav (and therefore the toggle) on every viewport. This is consistent with the existing navigation pattern in `Labra Navigation.html`.

The toggle is a simple two-state control in v1 — English / Spanish. When `vos` variants ship, this becomes a three-state or grouped control; structure should anticipate that without over-engineering it now.

---

## 8. Input-output language independence

A cross-cutting rule that applies to every surface that consumes user-provided input (Verdict, Brief, Tracker outreach, anywhere else).

**The rule:** user-facing system output always follows the user's locale preference, regardless of the language of the source material the user pasted or linked.

Example: a Spanish-locale user pastes an English recruiter DM into the evaluate flow. The Verdict, the Brief signals about this evaluation, the editorial summary, and any commentary are all generated in **Spanish** — the user's locale — not in English, the source language.

**Sub-rules:**
- **Entity names stay in source language as proper nouns.** "Head of Operations" is not translated to "Jefe de Operaciones" if that's the actual role title in the source. Company names, recruiter names, real role titles preserve source form.
- **Direct quotes from source material may preserve source language** for fidelity. Example in Spanish output: *"El recruiter cita 'competitive comp' en su DM — vale la pena pedir el rango."*
- **The system's commentary around the quote follows user locale.**

Implication for the LLM prompt: every prompt that generates user-facing text must include the user's locale and an explicit instruction to produce output in that locale regardless of source language. Without this instruction, LLMs tend to mirror the input language ("helpfully"). The bilingual single-call generation pattern (`{en, es}` produced together) makes this enforcement automatic — both versions exist, user locale picks at render.

---

## 9. Locale switch behavior

When a user toggles locale via the global nav, the change is **instant**. No re-fetch, no re-generation, no async loading state.

This works because the bilingual generation pattern caches both language versions of every LLM-generated field in the same payload. Switching locale is a render-time concern: the client picks the matching field from the existing object.

Implication for code:
- All `text` / `body` / `headline` / `summary` fields on user-facing payloads are bilingual objects `{ en, es }`
- All static UI strings live in an i18n catalog covering both locales
- Locale state lives in the client session and is broadcast to all rendered components — no per-component fetching

Implication for design: the toggle UX should reflect the instant behavior. No spinner, no transition, no "loading…" — the page just re-renders in the new language.

---

## 10. Kicker pattern (system-wide rule)

The kicker is a pattern used wherever a category or context label sits above a content unit (Brief signal cards, Pick card, anywhere else this pattern lands).

**Visual pattern** (already in DS — confirming, not introducing):
- Geist Mono, uppercase, letter-spaced
- Subdued color (ink-3 token equivalent)
- Italicized when used as content type label (e.g., `*YOUR FRESHNESS*`)
- Plain when used as metadata (e.g., `№ 1 · Strong fit · 2d · LinkedIn LatAm`)

**Structural pattern:**
- Optional `SUBJECT` prefix — `YOUR` (introspective) or `THE` (extrospective). Tells the reader the perspective.
- `KICKER LABEL` — the category name (e.g., `FRESHNESS`, `PICK`)
- Optional `· CONTEXT` — entity or timeframe (e.g., `· MERCADO LIBRE · 7D`)

**Localization:**
- Subject prefixes are localized (`YOUR` → `TU`, `THE` → `LA / EL` depending on noun gender)
- Category labels are localized via the i18n catalog
- Entity context segments stay in source language (proper nouns)
- Timeframes use universal abbreviations where possible (`D`, `W`, `M`, `Y`) — single letters work in both languages

The Brief defines its own specific kicker vocabulary; that's documented in `Labra Brief - spec.md` §3.4. Other surfaces that adopt this pattern define their own vocabularies in their own specs.

---

## 11. Status taxonomy

A system-wide primitive added to DS v3 alongside the bilingual rules above. Used by:

- **Tracker** — primary consumer. Row status display, status pill, filter strip, outcome capture, status change flows.
- **Brief** — `pipeline.next` signals fire on status transitions; pipeline summary counts items by active status (distinct from verdict-shape counts).
- **Verdict** — sets initial status `evaluating` when a Verdict is rendered.
- **Pattern log** (v1.5) — per-status outcome tracking will read from this taxonomy.

Each Tracker row has exactly one status at any time. Status is **distinct from verdict shape**: verdict shape is the system's recommendation set at evaluation time; status is the operational state that evolves as the application progresses.

### Internal codes and bilingual UI labels

Internal codes (DB, API, analytics, logs) stay English snake_case. UI labels resolve via i18n catalog at render. **Nine statuses total**: four active, five terminal.

#### Active phase

| Internal code | EN UI | ES UI |
|---|---|---|
| `evaluating` | Evaluating | Evaluando |
| `applied` | Applied | Aplicada |
| `interviewing` | Interviewing | En entrevista |
| `offer_pending` | Offer pending | Oferta pendiente |

#### Terminal phase

| Internal code | EN UI | ES UI |
|---|---|---|
| `offer_accepted` | Offer accepted | Aceptada |
| `rejected` | Rejected | Rechazada |
| `withdrew` | Withdrew | Retirada |
| `passed` | Passed | Descartada |
| `ghosted` | Ghosted | Sin respuesta |

### Canonical happy-path flow

`evaluating` → `applied` → `interviewing` → `offer_pending` → `offer_accepted`

This is the documented success path. Surfaces that visualize progress (horizontal status indicators, milestone graphics) should follow this sequence.

### Transition rules

**Loose in v1.** Users can move any row to any other status at any time. The taxonomy documents the canonical flow for reference, but transitions are not strictly enforced.

Reasons:
- Real recruiter behavior frequently skips stages — direct CV-to-offer happens; ghosting can occur mid-interview; an offer can be rejected and then re-extended
- Forcing intermediate statuses just to "follow the flow" creates fake data
- Telemetry can surface misuse patterns; formalize enforcement later if needed

Allowed transitions:
- Any active → any active (forward, backward, or sideways)
- Any active → any terminal
- Any terminal → any active (reversal of a mistake; or a rejected decision that gets re-opened)

### Why `offer_accepted` is a captured status, not an implicit pipeline exit

When a user accepts an offer, the role is functionally done — they're no longer actively job-hunting it. The temptation is to make this an implicit completion that removes the row from the pipeline entirely.

This is wrong for two reasons:

1. **Intelligence-model signal.** The accepted offer is the most important data point in the user's entire history. It captures what they actually chose, comparable against everything they rejected/passed/withdrew from. The signal calibration in the Brief (Bar drift, Pipeline behavior, future Pattern log analysis) depends on having both wins and losses to triangulate from. A Tracker that only captures losses produces a survivorship-bias product.

2. **Historical record.** The Tracker is *"a private deal log a lawyer or investor would keep"* — wins are part of the log, not just losses. The accepted offer is the user's "this is the job I took, and this is the pipeline that led to it."

Therefore: `offer_accepted` is a normal terminal status. The row stays in the user's Tracker (in the closed-30d group), visible in counts and historical analysis, available to the intelligence model.

---

## Open items for the design team

These are real follow-ups before this update lands in production:

1. **Native-speaker review of §1 (Spanish voice rules).** Drafted by a non-native author; need a native Spanish speaker (LatAm preference) to read the tone description, examples, and banlist for nuance the draft may have missed.

2. **§16 layout for the bilingual structure.** Decision: side-by-side EN/ES columns, or sequential sub-sections (English first, then Spanish)? Either works; pick what reads better in the DS file.

3. **Kicker pattern visual specs** — confirm the existing tokens (font, color, letter-spacing) handle the longer Spanish kickers well (`TU PIPELINE · siguiente` is longer than `YOUR PIPELINE · next`). May require adjusting max-width or breakpoints.

4. **Locale toggle visual design** — the actual chip/control in the global nav. Two-state toggle vs dropdown. Behavior at narrow viewports.

5. **Date display patterns in other surfaces.** This doc locks formats for the Brief masthead. Other surfaces (Tracker timestamps, Verdict received-on dates, etc.) may have different conventions; revisit when those surfaces get bilingual updates.

6. **Status taxonomy visualization in DS v3** — the table above is the content; design owns the visual treatment of the status pills, the canonical-flow progress indicator (if one is built), and the active-vs-terminal distinction (color, weight, position in the row).

---

## Reference

- `LeadMe Design System.html` — current DS file to update with this content
- `Labra Brief - spec.md` — companion spec for the Brief surface
- `Labra Evaluate Verdict.html` — Verdict screen, source of truth for verdict shape language (affected by §3 above)
- `Labra Tracker.html` — Tracker screen (affected by §3 and §4)
- `Labra Navigation.html` — Navigation pattern, hosts the locale toggle (affected by §7)
