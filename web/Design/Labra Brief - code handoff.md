# Labra Brief — code handoff

For the engineering team building the Brief. Combines the structural spec, the locked design mockup, and DS v2 into one artifact. Defines what to build, what data it consumes, what behaviors it implements, and what's deferred. Code should have zero design decisions to make at this point.

## Reference artifacts (all locked)

- `web/Design/Labra Brief - standalone.html` — **the design mockup**. Nine screen states covering: live Brief, Evaluate FAB open, signal-heavy (5 + collapsed), Pick-only, empty Brief, loading skeleton, mobile 720px, EN/ES proof, and signal lifecycle states (live / snoozed / dismissed). All locale variants present (`data-lang="en"` / `data-lang="es"`).
- `web/Design/Labra Design System v2.html` — **the design system**, source of truth for all bilingual rules, voice, tokens, kicker patterns, locale toggle, masthead format, dates, verdict vocabulary, em-dash divergence, and number/currency/quote conventions.
- `web/Design/Labra Brief - spec.md` — **the structural spec**, source of truth for data shape, caching, LLM prompt requirements, and per-block behavioral rules.
- `web/Design/Labra Brief - design handoff.md` — the design's working doc; useful background.
- `web/Design/Labra Design System - bilingual update.md` — recorded DS-level decisions, supersedes parts of DS v2 (notably the JD banlist addition — see §6.5 below).
- `web/Design/screens/Labra Evaluate Verdict.html` — locked Verdict screen, source of truth for the verdict shape language Brief pipeline summary mirrors.
- `web/Design/screens/Labra Tracker.html` — locked Tracker screen, Brief links to it from the pipeline summary line.
- `web/Design/screens/Labra Navigation.html` — global nav pattern that hosts the locale toggle.

## 1. What you're building

A new route `/brief` (or whatever the existing convention dictates — Next.js app router based on the existing repo structure) that:

- Renders the Brief surface as defined in the mockup, with all blocks and states
- Pulls data from a new `GET /api/brief` endpoint (data shape in §3 below)
- Honors the user's locale preference (`en` / `es`) end-to-end — UI strings, LLM-generated content, dates, verdict shapes
- Supports instant locale switching via the global nav toggle (already specced in DS v2 §17.5 — the toggle is hosted by the navigation, not the Brief)
- Implements the LLM linter rules (§5 below) so generated content never reaches the user with banned phrases or punctuation violations
- Writes observation logs every time a signal renders (data is needed for the future Pattern log surface — write the logs even though no UI consumes them in v1)

## 2. Page structure and routing

### Surface

Single route. The Brief is a stateful page that depends on the user being authenticated and onboarded. Anonymous visitors should be redirected to landing/onboarding.

### Render order (top to bottom — fixed)

1. **Masthead** — always renders
2. **Editor's note** — always renders (live or fallback)
3. **The Pick** — conditional; renders only when `pick !== null` in payload
4. **Signal stack** — conditional; renders only when `signals.visible.length > 0`
5. **Pipeline summary** — always renders
6. **FAB** — persistent overlay, not part of the page flow

Empty Brief (no Pick, no signals): blocks 1, 2, 5, FAB only. Pipeline summary flows up flush below the Editor's note. No placeholders, no padding, no synthetic content. Per the mockup screen `04 Empty Brief`.

### Breakpoint

Single layout breakpoint at **720px**. Above: two-column allowed for the Pick (body + salary panel side-by-side per DS v2 §12). Below: single column throughout. Reference mockup screen `06 Mobile — 720px breakpoint`.

## 3. Data shape

Single endpoint serves the Brief. All LLM-generated text fields are bilingual objects `{ en, es }`; the client picks the field matching the user's `locale` at render time. No client-side translation.

```
GET /api/brief?date=YYYY-MM-DD

{
  masthead: {
    issueNumber: number,
    date: string,        // ISO date; client formats per locale per DS v2 §17.3
    location: string     // city code (CDMX, BOG, SCL, etc.) — never translated
  },
  editorsNote: {
    text: { en: string, es: string },
    generationMethod: "llm" | "fallback"
  },
  pick: null | {
    score: number,                            // 0-100; only present if >= 80
    kicker: { en: string, es: string },
    headline: { en: string, es: string },
    subhead: { en: string, es: string },
    companyMeta: {
      name: string,                           // not translated
      avatar: string | null,
      role: string,                           // not translated
      location: string,                       // city code
      workModel: "remote" | "hybrid" | "onsite",
      segment: string
    },
    salaryEstimate: {
      bandLow: number,
      bandHigh: number,
      currency: string,                       // ISO 4217; format follows currency-locale per DS v2 §17.10
      confidence: "high" | "medium" | "low",
      floor: number                           // user's stored floor for visualization
    },
    hiringManager: null | {
      name: string,
      prior: string[],
      mutualCount: number
    },
    editorialSummary: { en: string, es: string },
    actions: ["tailor", "evaluate", "mute"]
  },
  signals: {
    visible: SignalPayload[],                 // max 5
    collapsed: number                         // count of additional signals not shown
  },
  pipelineSummary: {
    sentence: { en: string, es: string },
    trackerLink: string
  }
}
```

Where `SignalPayload` is:

```
{
  id: string,                                 // stable signal occurrence id
  type: "freshness" | "drift" | "bar" | "pipeline.cold" | "pipeline.next",
  kicker: { en: string, es: string },         // includes context segment if applicable
  body: { en: string, es: string },
  actions: {
    primary: { code: string, label: { en: string, es: string } },
    secondary: { code: string, label: { en: string, es: string } } | null,
    ghost: { code: "snooze" | "dismiss" | "skip" | "keep", label: { en: string, es: string }, durationDays?: number } | null
  },
  snoozeUntil: string | null,                 // ISO datetime
  dismissedAt: string | null
}
```

**Action codes** (i18n catalog resolves labels):

| Code | EN label | ES label |
|---|---|---|
| `tailor` | Tailor & apply | Adapta y aplica |
| `evaluate` | Evaluate | Evalúa |
| `mute` | Mute | Silenciar |
| `draft_nudge` | Draft nudge | Redactar mensaje |
| `open_prep` | Open prep | Abrir prep |
| `tighten_model` | Tighten model | Afinar modelo |
| `update_preferences` | Update preferences | Actualizar preferencias |
| `recalibrate_cv` | Recalibrate CV | Recalibrar CV |
| `recalibrate_set` | Recalibrate set | Recalibrar set |
| `mark_closed` | Mark closed | Marcar cerrado |
| `show_list` | Show the list | Mostrar la lista |
| `show_overrides` | Show the {n} overrides | Mostrar los {n} overrides |
| `keep_as_is` | Keep as-is | Dejar como está |
| `snooze` | Snooze | Posponer |
| `dismiss` | Dismiss | Descartar |
| `skip` | Skip | Saltar |

Full mockup string mappings are in `Labra Brief - standalone.html`; treat the mockup as the i18n catalog seed for v1.

### Caching

- `Cache-Control: private, max-age=<seconds-until-user-local-midnight>`
- Cache invalidates on user-local midnight OR on user actions that materially change signals (e.g., logging an interview status change that would suppress a pending `pipeline.next` signal)
- Editor's note **never regenerates within a day** (DS v2 §17.6) — strictly TTL'd to user-local midnight; no event-based invalidation touches it
- Pull-to-refresh updates data shown but does not re-roll the editor's note

## 4. Locale handling

### Locale source of truth

User has a `locale` field on their profile (`en` or `es`). Two locales in v1; `vos` variants (`es-AR`, `es-UY`, `es-CR`) deferred. See DS v2 §17.4 for default detection logic if user has no explicit preference.

### Render

The Brief payload always contains **both** `en` and `es` versions of every LLM-generated text field. Client picks the appropriate field at render time from `user.locale`. No fetch on locale change.

### Instant locale switch

When the global nav toggle fires a locale change:
1. Update `user.locale` in client state (optimistic; persist async)
2. Re-render the current Brief from the already-cached payload
3. Date formatters and number formatters re-run against new locale per DS v2 §17.3 and §17.10
4. No spinner, no transition, no skeleton

Mockup reference: screens `01 Active Brief` and `07 EN/ES proof` show both states from the same data.

### Input does not determine output

Per DS v2 §17.7 — system output always follows user locale regardless of the language of source material the user pasted. The LLM prompt enforces this (§5 below); code does not need to do language detection on input. Just always pass user locale to the LLM and always show user-locale output.

## 5. LLM generation and linting

### Generation

Single LLM call per user per day. Produces:
- Editor's note text — both `en` and `es` versions in one response
- Pick editorial summary (if a Pick is being surfaced) — both `en` and `es`
- All signal bodies for today's triggered signals — both `en` and `es` each

Recommended output schema: structured JSON with `{ en, es }` objects for every text field. Both languages produced together preserves voice consistency.

Cached on first view of the day for each user. Subsequent views return cached payload; page refreshes do not regenerate.

### Prompt requirements

Every prompt that generates user-facing text must include:

1. The user's locale (`en` or `es`) AND an explicit instruction to produce output in that locale regardless of source material language. Without this, LLMs mirror the input language.
2. The structured user data summary (pipeline state, recent activity, entity references the prompt may use)
3. Voice rules referenced or inlined from DS v2 §16:
   - Tone: candid, dry, informed. Peer-to-peer voice.
   - First-person `I` / `yo` allowed; `we` / `nosotros` banned
   - 1 to 3 sentences for editorial paragraphs
   - Must reference at least one specific entity by name or count
   - Max one italicized phrase per language version
   - English: em-dashes allowed
   - Spanish: em-dashes banned; use semicolons, colons, or commas
   - Spanish: `tú` form, never `vos`
4. Banlists per language (see §5.3 below)

### Linter (post-generation, pre-cache)

Reject the LLM output and regenerate (once, with stricter prompt) if any of the following are true for either language version:

| Rule | EN | ES |
|---|---|---|
| Contains any banlist phrase | yes | yes |
| Contains emoji | yes | yes |
| Contains exclamation marks (`!` or `¡`) | yes | yes |
| Contains em-dash (`—`) | no | **yes** |
| More than 3 sentences | yes | yes |
| More than 1 italicized span | yes | yes |
| No reference to a specific entity / count in source data | yes | yes |
| Contains JD (case-insensitive standalone) | yes | yes |

On second reject (after one regeneration attempt), fall back to deterministic template:
- `en`: `№ {n}. {signalCount} on the table today.`
- `es`: `№ {n}. {signalCount} en juego hoy.`

The fallback is visually identical to a live editor's note (same Fraunces type, same width). User shouldn't be able to tell which path produced it.

### Banlists

**EN banlist** (extends DS v2 §16 with one addition):

- Gamification / superlatives: `amazing`, `incredible`, `spectacular`, `extraordinary`
- Urgency / scarcity: `don't miss out`, `last chance`, `exclusive`, `limited time`
- Sales CTAs: `next level`, `take the next step`, `apply now`, `act now`
- "We" as product: `we found`, `we bring you`, `we offer`
- **Recruiter jargon (v3 addition):** `JD` — use `job description` instead
- Universal: all emoji, all exclamation marks

**ES banlist** (extends DS v2 §16 with one addition):

- Gamificación / superlativos: `increíble`, `asombroso`, `espectacular`, `fantástico`, `extraordinario`
- Urgencia / escasez: `no te lo pierdas`, `imperdible`, `última oportunidad`, `oportunidad única`, `exclusivo / exclusiva` (cuando se usa para crear escasez)
- CTAs de venta: `lleva tu carrera al siguiente nivel`, `da el siguiente paso`, `transforma tu carrera`, `actúa ahora`, `aplica ya`, `no esperes más`
- "Nosotros" como producto: `te encontramos`, `encontramos para ti`, `te traemos`, `te ofrecemos`
- **Jerga recruiter (v3 addition):** `JD` — usar `descripción del puesto`
- Universales: todo emoji, todo signo de exclamación, todo guión largo (—)

Special case carried from DS v2 §16: standalone `encontramos` in editorial commentary (e.g., *"encontramos 3 fuentes públicas"*) is allowed; banned only in product-voice constructions (`te encontramos`, `encontramos para ti`).

### Grounding rule

Hard requirement: a signal renders only if its body can reference at least one specific entity by name OR a specific count. Generic copy is suppressed at the data layer, not at render. If the LLM produces ungrounded output (e.g., "you should follow up on some applications"), the linter rejects it and the signal omits entirely.

## 6. Surface behaviors

### 6.1 FAB (Evaluate)

Universal entry to the evaluation flow. Persists across all surfaces; defined globally, not Brief-specific.

Mockup reference: screen `01b Evaluate FAB — desktop panel + mobile sheet`. Behavior:
- Desktop: pill in the bottom-right ("L. Evaluate"). Click opens a panel sliding in from the right. Brief stays visible behind it.
- Mobile (below 720px): circular FAB ("L."). Tap opens a bottom sheet pulled up from below. Brief stays visible behind it (dimmed).
- Either case: pasting a URL or message triggers the evaluation flow (out of scope for this handoff; existing route).
- Safe area: on mobile, the bottommost signal card must not be obscured. Padding the signal stack's bottom margin to clear the FAB.

### 6.2 Signal interaction

- **Snooze.** Per-signal action. Sets `snoozeUntil` on the signal occurrence. The card disappears immediately on the client; server persists async. Re-renders on the next eligible trigger after the snooze window expires. Default windows per signal type are locked: Freshness 30 days, Pipeline · cold 3 days. No user-configurable durations in v1.
- **Dismiss.** Per-signal action (only on Drift and the per-card ghost where applicable). Sets `dismissedAt`. That specific occurrence is hidden permanently; the same signal type can re-surface on a new trigger.
- **Skip / Keep as-is.** Closes the card without storing state. The signal can re-surface on the same data.
- **Primary actions** route to existing flows (CV tailoring, prep generation, model calibration, outreach drafting) — out of scope for this handoff; route to existing handlers.

Mockup reference: screen `08 Signal states — live, snoozed, dismissed`.

### 6.3 More signals expansion

If `signals.collapsed > 0`, render a `more signals ({n})` / `más señales ({n})` expand control after the visible cards. On click, reveal the rest of the collapsed signals inline (no modal, no navigation). State (snoozed/dismissed) persists across expand/collapse.

Mockup reference: screen `02 Signal-heavy — 5 + collapsed remainder`.

### 6.4 Loading skeleton

Only ever visible on a user's first-ever Brief view (no cached payload exists). Subsequent days return the cached payload immediately.

Skeleton structure (mockup screen `05 Loading skeleton — first ever Brief view`):
- Masthead renders immediately as real text (no LLM dependency)
- Editor's note: skeleton block matching the shape of the eventual paragraph
- Pick: skeleton block matching the eventual two-column structure
- Two signal placeholders matching the signal card shape
- Pipeline summary: skeleton matching the eventual single line

Skeleton mimics shape, not shimmer aesthetics. No animation in v1.

### 6.5 Observation logging

Every signal that renders is written to a structured log table. Schema (minimum):

```
{
  signalId: string,
  signalType: "freshness" | "drift" | "bar" | "pipeline.cold" | "pipeline.next",
  entitiesReferenced: string[],   // proper nouns extracted from the rendered body
  timestamp: ISO datetime,
  userAction: null | "primary" | "secondary" | "ghost" | "snoozed" | "dismissed",
  userId: string
}
```

Non-optional. Pattern log surface (v1.5) reads from this table. Starting day one means six months of data exists by the time Pattern log ships.

## 7. Accessibility

- All actionable elements (action buttons, snooze/dismiss controls, expand control, FAB) keyboard-accessible
- Snooze and Dismiss are `<button>` elements, not links
- Masthead and signal kickers use semantic heading hierarchy (Masthead = page heading; signal kickers are scoped to their cards)
- Italics use `<em>`, not styling alone — screen readers respect emphasis
- Locale toggle in global nav must be reachable from any focus position via predictable Tab order; this is a Nav concern but flagging because Brief must coexist
- FAB: `aria-label="Evaluate"` / `aria-label="Evalúa"` per user locale; the floating element should not trap focus

## 8. Out of scope for v1 (do NOT build)

- **Brief archive UI** — no "view past issues" surface, no historical browse
- **Pattern log** — observation logging happens (§6.5) but no UI consumes it in v1
- **External-signal triggered cards** (funding news, comp shifts) — different product, deferred
- **`vos`-form Spanish variants** — toggle structure should anticipate the third state but only `en` and neutral `es` rendered
- **ATS integration** — status updates are manual, surfaced as Pipeline · next signals when the user logs them
- **Manual force-regenerate** — pull-to-refresh updates data shown but does not re-roll the editor's note or signal bodies
- **Per-user configurable snooze durations** — system-imposed defaults in v1
- **Mid-day editor's note regeneration** — strict TTL to user-local midnight

## 9. Open questions delegated to code

These are minor calls code can make without re-opening design or product:

1. **Endpoint shape.** I sketched `GET /api/brief?date=YYYY-MM-DD` but the existing repo has `web/app/api/` conventions — adopt those. The shape in §3 is normative; the URL is suggestive.
2. **Caching backend.** TTL until user-local midnight is the behavioral spec. Whether that's Redis, Postgres-with-expiry, or HTTP `Cache-Control` headers terminating at a CDN is your call based on existing infrastructure.
3. **Observation log storage.** A new table vs. extending an existing event log table. Whatever fits the existing analytics schema.
4. **LLM provider and model.** Not specified — use whatever the repo currently uses for the scanner and Verdict generation, since the Brief's editorial generation uses the same voice rules.
5. **Cost monitoring.** Bilingual single-call generation doubles output tokens. Worth surfacing per-user daily cost metric so the team can detect drift as user base grows. Optional in v1; recommended.

## 10. Acceptance criteria

A Brief implementation is shippable when:

- All five blocks render per spec on both desktop and mobile (≥ 720px and < 720px)
- Both locales render correctly with instant switching from the global nav toggle
- The Brief on user-local midnight transitions cleanly to issue №(n+1) — issue numbering increments, content re-generates
- LLM linter rejects every banlist phrase, every emoji, every exclamation mark, em-dashes in Spanish, JD in either language, and ungrounded content
- The fallback template renders cleanly when LLM regeneration fails twice; user cannot distinguish it visually from live
- The mockup's nine screen states (`Labra Brief - standalone.html`) all match observable production behavior in their respective conditions
- Observation logs are being written for every signal render
- Pull-to-refresh on mobile updates data but does not re-roll the editor's note
- Empty Brief (no Pick, no signals) renders three blocks + FAB with no padding placeholders

## 11. Known issues in the mockup (content, not structural)

These are content-level violations that surfaced during verification. They do NOT block code implementation because production content is LLM-generated and bound by linter rules — code will never paste these exact strings.

- **Lede 2 EN** contains `JD` jargon (`The JD lists every system...`). Linter rule §5 rejects this in production.
- **Lede 2 ES** contains both `JD` jargon and Spanish em-dashes (`La JD enlista cada sistema que poseías en Clip — motor de reglas de fraude...`). Linter rules §5 reject both in production.
- Lede 2 ES also uses `poseías` (literal "possessed") where `tenías a tu cargo` or `manejabas` reads more native. Copy-quality concern, not a linter rule.

These are documented here so they are not silently inherited as production strings.
