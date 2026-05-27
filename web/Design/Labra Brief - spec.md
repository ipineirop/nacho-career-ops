# Labra Brief — structural spec

Handoff artifact for design and code. Defines what the Brief is made of, what data each block consumes, how each block behaves, and what's deferred for v1. Does not specify visual design (Design owns) or implementation details (Code owns). Companion to the LeadMe Design System and to the locked Verdict + Tracker screens.

---

## 1. Purpose & non-goals

The Brief is the daily editorial surface. It reflects the user's pipeline and behavior back at them in the editor's voice (see LeadMe Design System §16). It is the only Labra surface that reads across the whole pipeline plus the only one that surfaces forward-looking content (a new opportunity from portal scan).

Sits alongside two other product surfaces: **Verdict** = the locked decision moment for a single evaluation (Reply / Pursue / Watch / Skip), and **Tracker** = the operational status view of applications. The Brief is neither.

**Non-goals.** Not a dashboard. Not a feed. Not a content destination for generic market editorial (no salary trend articles, no "hiring climate" commentary, no advice posts). Not a replacement for Tracker.

**The mirror principle, enforced.** Every block that surfaces content must reference specific entities (companies, roles, counts) from the user's data. If a signal can't name proper nouns or a count, the system suppresses it rather than rendering generic prose. Empty Brief is acceptable and honest. Generic Brief is destructive.

## 2. Anatomy

The Brief is a fixed sequence of five content blocks plus a persistent FAB. Order is fixed.

| Order | Block | Conditional? |
|---|---|---|
| 1 | Masthead | Always present |
| 2 | Editor's note | Always present (with fallback) |
| 3 | The Pick | Conditional — renders only if scan hit clears quality threshold |
| 4 | Signal stack | Conditional — renders only if at least one signal is grounded |
| 5 | Pipeline summary | Always present |
| — | FAB | Persistent overlay, not a block |

Empty Brief renders blocks 1, 2, 5, and FAB. Blocks 3 and 4 omit entirely if their gating conditions fail.

## 3. Block-by-block

### 3.1 Masthead

**Purpose.** Editorial frame. Establishes daily cadence and gives access to past issues.

**Data inputs.**
- `issueNumber` — integer, monotonically increasing per user; increments on first Brief render of each user-local day
- `date` — today's date in user's timezone
- `location` — user's primary city, set in onboarding, editable in Settings (e.g., CDMX, BOG, SCL). Distinct from `locale`
- `locale` — user's language preference (`en` or `es`); set in onboarding, editable in Settings. Determines which language version of every content field is rendered

**Content format.** Universal `№` symbol carries the "issue number" meaning in both languages — no "Issue" word in English, no "Número/Edición" in Spanish. Date conventions follow locale rules.
- `en`: `№ {n} · {Weekday Mon DD} · {LOCATION}` — e.g., `№ 14 · Thursday May 14 · CDMX`
- `es`: `№ {n} · {weekday DD de month} · {LOCATION}` — e.g., `№ 14 · jueves 14 de mayo · CDMX`

This is a change from Design System §12 which currently uses `Issue №14`. The DS needs updating — see §10.5.

**States.** Always rendered.

**Actions.** Secondary link `view past issues` — navigates to chronological archive when the archive UI ships. Omitted from the masthead entirely in v1; a disabled link reads as broken, and an absent link reads as not-yet-built. Re-introduced when the archive lands.

### 3.2 Editor's note

**Purpose.** One-paragraph daily lede in the editor's voice. Sets tone for everything below.

**Data inputs.** Structured summary built from today's data:
- `signals[]` triggered today, with entity names and counts
- `pick` (if present)
- `scanSummary` — total listings reviewed, total surfaced, total quieted (rejected)
- `userActivity7d` — rough activity summary (evaluations completed, status updates logged)

**Generation.** Single LLM call per user per day, producing both English and Spanish versions together. Output schema: `{ en: "...", es: "..." }`. Cached. Page refreshes do not regenerate. No separate translation flow — both languages produced in one pass to preserve voice consistency across locales.

**Content constraints (apply to both languages unless noted).**
- 1 to 3 sentences
- Must reference at least one specific entity (company, role, or count) from the structured input
- First-person `I` / `yo` allowed (editor persona). `We` / `nosotros` banned.
- No exclamation marks, no emoji, no sales language, no urgency tactics
- Maximum one italicized phrase per language version
- **Em-dashes (—)** — allowed in English (per Design System §16). **Banned in Spanish.** Spanish editorial copy uses semicolons, colons, or commas to introduce modifiers and appositions. The em-dash is not standard in neutral LatAm editorial Spanish.
- Spanish uses neutral LatAm forms — `tú` (informal), never `vos` / Argentine voseo. `vos`-form variants (`es-AR`, `es-UY`, `es-CR`) deferred to a future locale split — see §7 backlog
- English voice rules in Design System §16. Spanish voice rules locked in §10.1 of this spec, pending fold into §16 by design

**Post-generation linter (runs per language).**
- Reject if either language version contains any banned phrase from its banlist
- Reject if more than 3 sentences in either version
- Reject if more than 1 italicized span in either version
- Reject if either version contains emoji or exclamation marks
- Reject if the Spanish version contains an em-dash (`—`). English version may contain em-dashes per §16
- On reject: regenerate once with stricter prompt (both languages re-rolled together)
- On second reject: fall back to deterministic template per language
  - `en`: `№ {n}. {signalCount} on the table today.`
  - `es`: `№ {n}. {signalCount} en juego hoy.`

**States.**
- `live` — LLM-generated text
- `fallback` — deterministic template (regeneration failed twice)
- `loading` — skeleton during generation (only ever visible on the first-ever Brief for a user; subsequent days are cached)

**Actions.** None.

### 3.3 The Pick *(conditional)*

**Purpose.** Surface one new opportunity from the portal scanner. The Brief's only forward-looking content.

**Data inputs.**
- `topScanHit` — best result from today's portal scan (Greenhouse, Ashby, Lever, etc., per existing scanner in repo)
- `qualityThreshold` — numeric score below which the Pick is suppressed entirely. v1 value: **80** (see §6.1 for rationale and tuning protocol)
- `companyMeta` — avatar, name, role, location, work model, segment
- `salaryEstimate` — band + confidence level (high / medium / low)
- `hiringManager` — name, prior companies, mutual connection count (if discoverable)
- `editorialSummary` — 1-paragraph LLM-generated read of why this matches the user's archetype. Bilingual output `{ en, es }` produced in same single call as the Editor's note where possible (§3.2 generation rules apply)

**Visibility rule.** Block renders only when `topScanHit.score >= qualityThreshold`. Otherwise, block omits entirely; signal stack and pipeline summary move up.

**Content structure.**
- Kicker: `№ 1 · {fitRead} · {ageOnPortal} · {sourcePortal}` — e.g., `№ 1 · Strong fit · 2d · LinkedIn LatAm`
- Headline: editorial line in Fraunces italic, pattern `{Company} just opened *your seat*.`
- Subhead: role title · company · location · segment
- Score chip: numeric score (preserved from Design System §12). The Pick uses a numeric score because it precedes user interaction; the Verdict screen uses shape language (Reply / Pursue / Watch / Skip) because that's the decision the user is being asked to confirm. Different surfaces, different jobs
- Body: 1-paragraph editorial summary, voice rules apply, linter enforced
- Salary panel: band visualization with floor pin and confidence indicator

**States.** `present` (full card renders) or `absent` (block omitted). No empty-state placeholder.

**Actions.**
- Primary: `Tailor & apply` — launches CV tailoring flow (existing route)
- Secondary: `Evaluate` — runs a fresh evaluation against current data. The Pick already carries an implicit verdict from the scanner; this action is for re-evaluation when comp, stage, or listing status may have shifted
- Ghost: `Mute` — suppresses this specific role from future surfacing. Logged as user feedback for scan tuning. Role-level only in v1; company-level and portal-source muting are out of scope

### 3.4 Signal stack *(conditional, 0 to 5 visible)*

**Purpose.** Surface observations grounded in the user's data. The mirror.

**Five signal types** in v1. Kicker labels shown in English; Spanish equivalents are suggested starting points pending copywriter sign-off (see §10).

| Kicker (en / es suggested) | Trigger source | What it surfaces |
|---|---|---|
| `*YOUR FRESHNESS*` / `*TU FRESHNESS*` | Age check on user inputs (comp floor, story bank, archetype prefs) | An input the system depends on is stale |
| `*YOUR DRIFT*` / `*TU DERIVA*` | Mismatch between stated preferences and recent behavior | User's actions diverge from what they said they wanted |
| `*YOUR BAR*` / `*TU VARA*` | Override-pattern detection on user's Verdict overrides | User's bar is calibrated differently than the model assumes |
| `*YOUR PIPELINE · cold*` / `*TU PIPELINE · frío*` | Cadence threshold crossed (uses existing `followup-cadence.mjs`) | A live thread has gone quiet |
| `*YOUR PIPELINE · next*` / `*TU PIPELINE · siguiente*` | Status-change hook on user-logged updates | A recent status change has an obvious next step |

**Common card structure.**
- Kicker: `*KICKER LABEL · CONTEXT*` — context is entity or timeframe, e.g., `· MERCADO LIBRE · 7D` or `· 7 MO`. Entity names (companies, roles) are never translated; the localized portion is the kicker label and time abbreviation
- Body: 1 paragraph in editor's voice, must reference specific entities / counts. Bilingual `{ en, es }` produced together per §3.2 generation rules; linter applies to both
- Primary action — signal-type-specific, label localized per i18n catalog
- Secondary action — signal-type-specific, label localized per i18n catalog
- Ghost action — `Snooze` / `Posponer` or `Dismiss` / `Descartar` (always present)

**Actions per signal type.**

| Type | Primary | Secondary | Ghost |
|---|---|---|---|
| Freshness | `Recalibrate {input}` | `Keep as-is` | `Snooze 30d` |
| Drift | `Update preferences` | `Show the list` | `Dismiss` |
| Bar | `Tighten model` | `Show the {n} overrides` | `Keep as-is` |
| Pipeline · cold | `Draft nudge` | `Mark closed` | `Snooze 3d` |
| Pipeline · next | `Open prep` / context-specific | `Skip` | — |

**Snooze durations are system-imposed in v1**, not user-configurable. Defaults are locked in the Actions table above. Revisit after 30 days of telemetry if dismissal patterns suggest a default needs adjusting.

**When the entire signal stack omits** (no grounded signals today), the Pipeline summary (§3.5) flows immediately below the Editor's note or the Pick block. No placeholder, no padding — a quiet day is visibly quiet.

**Display rules.**
- Maximum 5 cards visible
- Priority order (top to bottom): Pipeline cold → Pipeline next → Bar → Drift → Freshness (time-urgency first, behavioral next, maintenance last)
- Cards beyond 5 collapse under `more signals ({n})` expand control
- Grounding rule (non-optional): a signal renders only if its body can reference at least one specific entity by name or a specific count. Generic copy is suppressed at the data layer, not at render.

**States.**
- `live` — signal triggered, card renders
- `snoozed` — card hidden until snooze window expires; stored in user state
- `dismissed` — card hidden permanently for this specific occurrence; same signal type can re-surface on a new trigger
- `empty (stack-level)` — no signals grounded today; entire block omits

**Observation logging.** Every signal that surfaces is written to a structured log: signal type, entity references, timestamp, user action taken, snooze/dismiss state. Logging is non-optional in v1 — even though no UI consumes it yet, the data is needed for Pattern log when it lands.

### 3.5 Pipeline summary

**Purpose.** State-of-pipeline single sentence at the bottom of the Brief. Links to Tracker. Reading material, not stats.

**Data inputs.**
- `pursueOpenCount`
- `replyLiveCount`
- `watchCount`

**Content format.** Single sentence in editor's voice, locale-specific. Verdict shapes are localized at display only — internal codes stay English (see §10.2 mapping).
- `en`: e.g., `12 Pursues open · 4 Replies live · 7 Watches`
- `es`: e.g., `12 en *Avanza* · 4 en *Responde* · 7 en *Observa*`

**States.**
- `live` — counts > 0
- `empty` — at least one count = 0; sentence rewrites to acknowledge. `en`: `Nothing in flight right now.` `es`: `Nada en juego ahora mismo.`

**Actions.** Whole line links to Tracker. No separate buttons.

### 3.6 FAB

**Purpose.** Universal `evaluate this URL` entry. Persistent across all surfaces, not specific to Brief.

**Behavior.** Tap opens URL paste / evaluation entry flow (defined elsewhere, not in this spec).

**Position on Brief.** Bottom-right, persistent. Signal stack respects FAB safe area on small screens — the bottommost signal card must not be obscured.

## 4. Cross-cutting rules

**Voice.** Per LeadMe Design System §16. The linter described in §3.2 applies to all LLM-generated text on the Brief — Editor's note (3.2) and Pick editorial summary (3.3).

**Caching.** Brief payload generated and cached on the first view of the day for each user. Subsequent views the same day return the cached payload. Manual force-regenerate is out of scope for v1.

**Editor's note never regenerates within a day.** Cached at first view, immutable until user-local midnight. Pull-to-refresh updates data shown but does not re-roll the note. Signal cards reflect mid-day changes; the editor's note frames the day's character and does not chase data.

**Frequency.** Brief content updates daily at the user's local-morning anchor time (default 06:00 user-local; configurable in Settings).

**Accessibility.** All actionable elements keyboard-accessible. Snooze and Dismiss are buttons, not links. Editor's note and signal cards use semantic heading hierarchy. Italics use `<em>`, not styling alone, so screen readers respect emphasis.

**Language model.** Labra ships bilingual from day one — English and Spanish — with both versions of every content field produced together and stored together.

- Two locales in v1: `en` (English) and `es` (Spanish — neutral LatAm, `tú` form, no regional voseo). `vos`-form variants (`es-AR`, `es-UY`, `es-CR`) are intentionally deferred — they are real, but adding them in v1 doubles the voice work without proven user need. See §7 backlog
- **Punctuation divergence by language.** English allows em-dashes (per Design System §16); Spanish bans them. Spanish uses semicolons, colons, or commas for the modifier pattern. Linter enforces (§3.2)
- **Input language does not determine output language.** User-facing system output (Verdict, Brief, signal bodies, editorial copy, Tracker) always follows the user's locale preference, regardless of the language of source material the user pastes. A Spanish-locale user evaluating an English recruiter DM receives the Verdict in Spanish. Entity names (companies, roles, recruiter names) preserve source language as proper nouns. Direct quotes from source material may preserve source language for fidelity; the system's commentary around the quote follows user locale
- **Locale toggle lives in global navigation**, not buried in Settings. Accessible from any surface
- **Locale switch is instant** — both language versions of every content field already exist in cache, so switching is a render-time concern. No re-fetch, no re-generation, no async
- User has a `locale` preference (set in onboarding, editable in Settings), distinct from `location` (city). Locale determines which language version of each content field is rendered. Switching locale is instant and never depends on async translation
- Static UI strings (kickers, action labels, fallback templates, system copy) live in an i18n catalog covering both locales
- LLM-generated content (Editor's note §3.2, Pick editorial summary §3.3, signal bodies §3.4) is produced in **both languages in a single LLM call**, stored as `{ en, es }`. No separate translation step, no async re-translation
- Linter (§3.2) applies per language with separate banlists. The Spanish banlist must be authored before v1 ships — see §10 follow-ups
- Voice rules (Design System §16) are English-only today. A Spanish equivalent voice spec must be written before ship — see §10 follow-ups
- Date formats follow locale conventions
- Entity names (companies, roles, recruiters, locations) are never translated

**Empty Brief.** Acceptable. Renders Masthead + Editor's note (acknowledging quiet day) + Pipeline summary + FAB. No padding cards, no synthetic signals.

## 5. Data shape (for code)

The Brief should be served by a single endpoint returning a payload with this rough shape. All LLM-generated text fields are bilingual objects `{ en, es }`; the client picks the field matching the user's `locale` preference at render time.

```
GET /api/brief?date=YYYY-MM-DD

{
  masthead: {
    issueNumber,
    date,                       // ISO date; client formats per locale
    location                    // city code, not translated
  },
  editorsNote: {
    text: { en, es },           // both languages produced in one LLM call
    generationMethod: "llm" | "fallback"
  },
  pick: null | {
    score,
    kicker:    { en, es },      // entity names embedded; locale wraps labels
    headline:  { en, es },
    subhead:   { en, es },
    companyMeta,                // company / role / location entities — not translated
    salaryEstimate,
    hiringManager,
    editorialSummary: { en, es },
    actions: [ "tailor", "evaluate", "mute" ]
  },
  signals: {
    visible: [ ...SignalPayload, max 5 ],
    collapsed: number
  },
  pipelineSummary: {
    sentence: { en, es },
    trackerLink
  }
}
```

Each `SignalPayload` carries:
```
{
  id,
  type,
  kicker: { en, es },
  body:   { en, es },           // both languages produced together
  actions: { primary, secondary, ghost },  // labels resolved from i18n catalog at render
  snoozeUntil: null | timestamp,
  dismissedAt: null | timestamp
}
```

Cache headers: `Cache-Control: private, max-age=until-end-of-user-day`. Cache invalidates on user-local midnight or on user action that materially changes signals (e.g., logging an interview status change that suppresses a pending Pipeline · next signal).

## 6. Decisions resolved

These were open during scoping. Locked in now so design and code can build without ambiguity. Reasoning kept terse; the full discussion is in conversation history and the decision log (§9).

1. **Pick quality threshold: 80.** Below 80, the editor would have to hedge in copy, which violates the dry-and-direct voice. Above 80 reads as "worth your time." Tune after 30 days of telemetry — target 40–60% of days surfacing a Pick, with >30% of surfaced Picks getting tailored.

2. **Pick is an implicit verdict.** Score and editorial summary on the Pick imply evaluation has already happened in the scanner. `Tailor & apply` proceeds directly to tailoring. `Evaluate` is for re-evaluation when data may have shifted (comp disclosed, listing aged, stage changed). When a Pick surfaces, the underlying evaluation record is already written and flows into Tracker. Confirmed: the scanner runs the same evaluation flow as direct URLs, so Picks are pre-evaluated by the time they surface.

3. **Snooze is system-imposed, not user-configurable.** Defaults: Freshness 30d, Pipeline · cold 3d. Drift / Bar / Pipeline · next use Dismiss or Skip, not snooze. Configurability adds settings sprawl with marginal value; revisit after 30 days if telemetry shows repeat dismissals on the same signal type.

4. **Empty signal stack: Pipeline summary flows up flush.** No padding, no inflated Editor's note. Empty Brief is visibly tight — a quiet day reads as quiet.

5. **Mobile breakpoint: 720px.** Above 720, Pick allows two-column layout (body + salary panel). Below 720, single column throughout. Design owns this call if their token system specifies differently.

6. **Mute is role-level only.** Muting a Pick suppresses that specific role. Does not affect company-level visibility or portal source weighting. Aggregate mute patterns feed scanner tuning over time; if usage suggests company-level suppression is warranted, a future *Drift* signal can propose opt-in deprioritization. Opt-in, never silent.

7. **Editor's note never regenerates within a day.** Cached at first view, immutable until user-local midnight. Signal cards reflect mid-day changes; the note frames the day, not the minute. Pull-to-refresh updates data shown but does not re-roll the note.

## 7. Out of scope for v1 (backlog)

- **External signals as a trigger source** — funding rounds, news, comp shifts. Different product, different data pipeline. Deferred indefinitely.
- **Pattern log** — standalone surface showing every observation made about the user with action taken and outcome. Observation logging starts day one (see §3.4) so data accumulates; UI lands v1.5.
- **Outcome tracking for Bar / Drift / Pick signals** — mechanical for Freshness and Pipeline; non-trivial for the rest. When Pattern log ships, untracked outcomes show as `Not yet measured`.
- **Brief archive UI** beyond the stub `view past issues` link.
- **ATS integrations** — Greenhouse, Lever, Workday status sync. Manual status updates in v1.
- **`vos`-form Spanish variants** (`es-AR`, `es-UY`, `es-CR`) — verb conjugations and pronouns differ enough from neutral LatAm Spanish that they need their own voice spec and prompt tuning. Deferred until v1 usage data justifies the extra voice work.
- **Portuguese (Brazil) and other LatAm locales** — plausible future work, out of v1. Architecture supports adding locales without changing the data shape.
- **Distributed history** (per-card history drawers as an alternative to Pattern log) — *rejected, not deferred.* See decision log §9.

## 8. Reference documents

- `Labra Brief - spec.md` — *this file*
- `web/Design/system/LeadMe Design System.html` — design tokens, voice rules (§16), existing Brief section (§12)
- `web/Design/screens/Labra Evaluate Verdict.html` — locked Verdict screen, source of truth for verdict shape language
- `web/Design/screens/Labra Tracker.html` — locked Tracker screen; Brief must not duplicate its job
- `followup-cadence.mjs` — existing time-based cadence detection logic in repo
- `Portal Scanner` (per README) — source of `topScanHit` for §3.3

## 9. Decision log (for context, not action)

Decisions made during scoping. Not action items for design or code, but useful background if anything is challenged downstream.

- **Brief is editorial, not a dashboard.** Generic market content rejected at scope.
- **YOUR / THE prefix** on signal kickers is the organizing principle. Tells the reader the subject before they read a word. If the YOUR/THE ratio ever flips heavily toward THE, the product has drifted.
- **Verdict treatment** on the Brief follows the locked Verdict screen's shape language (Reply / Pursue / Watch / Skip). No letter grades. Numeric score on Pick is preserved from Design System §12 but open to revisit if it clashes with Verdict shapes.
- **Editor's note voice rules** inherit from Design System §16. First-person "I" allowed for the editor persona; "we" as the product is banned.
- **Editor's note generated once per day**, cached. Refreshes do not regenerate.
- **Empty Brief is acceptable and honest.** No padding, no synthetic signals.
- **Distributed history rejected** in favor of a future Pattern log surface. The system's hit-rate observation needs a top-down view; per-card drawers can't host it.
- **Bilingual EN/ES from day one** (decision added during verification pass). LatAm focus makes English-only architecturally wrong — voice work, prompts, linters, and copy would have to be redone. Single-call bilingual LLM generation chosen over post-hoc translation to keep voice consistent across languages.

## 10. Language follow-ups (must resolve before v1 ships)

These are real blockers introduced by the bilingual decision. None require design or code architecture changes; they are content / copy work to be done before launch.

1. **Spanish voice spec for Design System §16.** **RESOLVED — pending fold into §16 by design.** Content locked below.

   **Tono.** Franco, sobrio, informado. Le habla de tú a tú a un Director; no le habla desde arriba al usuario.

   **Dicción.** Frases cortas. Punto y coma, dos puntos o comas para introducir modificadores y aposiciones. **Sin guiones largos (—)** : el guión largo no se usa en redacción neutral LatAm, contrario al uso en inglés. Cursivas con moderación. Sin signos de exclamación.

   **Honestidad.** Cuando algo no es claro, dilo. *"Confianza media; 2 fuentes"* supera la falsa certeza.

   **Nunca.** Gamificación, urgencia, emoji, CTAs de venta, *"nosotros"* como producto.

   **Ejemplos a seguir (Do):**

   > "Kavak acaba de abrir *tu puesto*."
   >
   > "Vale la pena: *con matices*."
   >
   > "'Competitivo' está cargando mucho en ese DM. El mercado para Head of Ops en una fintech mexicana en Serie C con tu alcance: $1.9–2.4M MXN + 0.1–0.25% equity."

   **Ejemplos a evitar (Don't):**

   > ✕ "🎉 ¡Encontramos 7 oportunidades increíbles para ti!"
   >
   > ✕ "¡No te pierdas estas coincidencias; aplica ahora!"
   >
   > ✕ "Puntuación: 82/100. Buena coincidencia."
   >
   > ✕ "Es hora de llevar tu carrera al siguiente nivel."

   **Banlist (palabras y frases prohibidas en español):**

   - *Gamificación / superlativos:* `increíble`, `asombroso`, `espectacular`, `fantástico`, `extraordinario`
   - *Urgencia / escasez:* `no te lo pierdas`, `imperdible`, `última oportunidad`, `oportunidad única`, `exclusivo / exclusiva` (cuando se usa para crear escasez)
   - *CTAs de venta:* `lleva tu carrera al siguiente nivel`, `da el siguiente paso`, `transforma tu carrera`, `actúa ahora`, `aplica ya`, `no esperes más`
   - *"Nosotros" como producto:* `encontramos`, `te traemos`, `te ofrecemos`
   - *Universales:* todo emoji, todo signo de exclamación, todo guión largo (—)

2. **Verdict shape vocabulary in Spanish.** **RESOLVED.** Display-only localization with English internal codes. Spanish form is imperative (matches the English verb-as-verdict shape, preserves editorial voice). Canonical mapping:

   | Internal code | English UI | Spanish UI |
   |---|---|---|
   | `reply` | Reply | Responde |
   | `pursue` | Pursue | Avanza |
   | `watch` | Watch | Observa |
   | `skip` | Skip | Pasa |

   Internal codes (database value, API value, analytics, logs, cross-team comms) stay English. The i18n catalog maps to the locale-specific UI label at render. This decision applies wherever Verdict shape names appear in user-facing copy — Brief Pipeline summary (§3.5), Tracker, Verdict screen itself, anywhere else.

3. **Kicker labels in Spanish.** **RESOLVED.** Locked table below. Internal codes stay English; UI labels resolve via i18n catalog at render. Pattern (uppercase, italicized, monospace-ish, YOUR/THE prefix) is a Design System concern; specific vocabulary is Brief-specific.

   | Internal code | English UI | Spanish UI |
   |---|---|---|
   | `freshness` | YOUR FRESHNESS | TU FRESHNESS |
   | `drift` | YOUR DRIFT | TU DERIVA |
   | `bar` | YOUR BAR | TU VARA |
   | `pipeline.cold` | YOUR PIPELINE · cold | TU PIPELINE · frío |
   | `pipeline.next` | YOUR PIPELINE · next | TU PIPELINE · siguiente |
   | `pick` | THE PICK | LA SELECCIÓN |

   Note: `TU FRESHNESS` keeps the English noun as a product term (parallel to `TU PIPELINE`, which is also a tech loanword in LatAm Spanish). Validated with native-speaker testing — confirmed in DS v2.

4. **Spanish fallback template for Editor's note.** Spec proposes `Número {n}. {signalCount} en juego hoy.` as a starting wording. Copywriter to finalize before ship. Owner: copywriter.

5. **Spanish date formatting conventions.** **RESOLVED.** Locked:

   - Weekdays and months **lowercase** in Spanish prose (RAE convention)
   - **No comma** between weekday and day-of-month: `jueves 14 de mayo` (not `jueves, 14 de mayo`)
   - Day-of-month: cardinal (`14`, not `14º`)
   - No year in the masthead
   - Issue number prefix: universal `№` symbol in both languages. English drops the "Issue" word it currently has, Spanish does not gain a "Número/Edición" word — symmetric, minimal, no translation needed
   - Masthead format both languages: `№ {n} · {date} · {LOCATION}`

   **Action required in DS handoff:** LeadMe Design System §12 currently shows `Issue №14`. Update to `№ 14`. Spanish masthead format is new content for §12 — add it.

6. **Onboarding language selector.** **PARTIALLY RESOLVED** (DS-level portion locked; onboarding-flow placement deferred to onboarding session).

   **DS-level (locked here, folds into DS handoff):**
   - Default locale detection: explicit user choice wins; else browser locale (`en-*` → English, `es-*` → Spanish); else **Spanish default** (LatAm-focused product — not English)
   - Locale toggle lives in **global navigation**, accessible from any surface
   - Locale switch is **instant** (both language versions of every content field already cached)
   - **Input-output language independence**: system output always follows user locale, regardless of source material language. See §4 Language model for the full rule

   **Deferred to onboarding session:**
   - Whether onboarding has an explicit locale-selection step or relies entirely on default detection plus the global nav toggle
   - Default position: explicit step not required; detection runs, user can switch via nav anytime
