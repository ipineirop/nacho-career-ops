# Labra Tracker — wiring before handoff

Living document. Tracks internal updates that need to happen before the Tracker can be handed off to design or code. Updated as each Tracker review issue is resolved.

## Status

| Issue | Topic | Resolved? | Wiring done? |
|---|---|---|---|
| 1 | JD jargon in mockup | Yes | No (mockup update pending) |
| 2 | Spanish em-dashes in UI copy (18 instances) | Yes | No (mockup update pending) |
| 3 | Status taxonomy | Yes | DS update done; mockup update pending |
| 4 | Verdict-shape exposure on Tracker (filter, row display, score removal, sort, weight) | Yes | No (mockup update pending) |
| 5 | Per-row LLM commentary scope | Yes | Architecture locked (see §G); no mockup update needed |

This file gets updated as each issue resolves. When every row is "Wiring done? — Yes," the Tracker is ready for design or code handoff.

---

## A. Mockup updates required

Changes to `web/Design/screens/Labra Tracker.html` before the Tracker can be handed off.

### A.1 — JD jargon (from Issue 1)

Line 2189 EN copy:

| Current | Replace with |
|---|---|
| `Paste anything — DM, link, JD` | `Paste anything — DM, link, job description` |

(Spanish side already says `descripción`, no change needed there for the JD rule. But the em-dash in the ES version of this line is also a violation — see A.2.)

### A.2 — Spanish em-dashes in UI copy (from Issue 2)

Replace em-dashes with punctuation per the locked table:

| Original | Fix |
|---|---|
| `Pega cualquier cosa — DM, link, descripción` | `Pega cualquier cosa: DM, link, descripción` |
| `· Tap "¿Qué pasó?" — el formulario expande en línea` | `· Tap "¿Qué pasó?": el formulario expande en línea` |
| `· "Recibí oferta" — aparecen campos opcionales` | `· "Recibí oferta": aparecen campos opcionales` |
| `· Guardado — la única pregunta de seguimiento` | `· Guardado: la única pregunta de seguimiento` |
| `Omitir — dejar como oferta` | `Omitir (dejar como oferta)` |
| `· Fila reformulada — estado permanente` | `· Fila reformulada: estado permanente` |
| `Vía B · Cambio manual — toca el pill, en cualquier momento` | `Vía B · Cambio manual: toca el pill en cualquier momento` |
| `— o cerrar la vacante —` | `· o cerrar la vacante ·` (matches meta-dot pattern) |
| `· Menú de orden — abierto` | `· Menú de orden · abierto` |
| `· Filtro de Score — abierto` | `· Filtro de Score · abierto` |
| `El orden alfabético no se ofrece — no es como piensas tu pipeline.` | `El orden alfabético no se ofrece; no es como piensas tu pipeline.` |

Plus two judgment calls already locked:

- **Button restructure:** `Lo envié — marcar aplicada` → `Marcar como aplicada`. Cleaner verb. Drops first-person confirmation framing.
- **Role-title format:** `Operations Manager — LatAm` (appears 3× in sample rows) → `Operations Manager · LatAm` (middle dot, Labra's display format for role · scope). Reverts to em-dash only if a specific role title is preserved entity data from the recruiter's actual posting.

### A.3 — Status taxonomy additions (from Issue 3)

Add `offer_accepted` / Aceptada to the Tracker mockup:

- Add a sample row in the closed-30d group with status Aceptada — locks the visual treatment for the win case
- Extend the outcome capture flow: after `"Recibí oferta"` (which opens optional fields), add `"Acepté"` as the natural follow-on that transitions the row to Aceptada
- Define a distinct status-pill visual for Aceptada — this is a win, not a loss; the treatment should differ from rejected/withdrew/passed in color or weight to reflect that

### A.4 — Verdict shape now visible on every Tracker row (from Issue 4)

Add verdict shape display inline in the row meta — italicized Fraunces register (not status-pill style) to mark it as editorial recommendation vs operational status. Example row format:

`Stori · *Avanza* · en entrevista · 2d`

In English: `Stori · *Pursue* · interviewing · 2d`

Position: between company and status, before status. Visually distinct from the status pill (which is operational). The verdict shape is the system's editorial read; the status is the operational state. Two different vocabularies, both visible, both readable.

### A.5 — Remove score from Tracker rows (from Issue 4)

The score chip is dropped from row meta. Verdict shape now carries the priority signal; score adds granularity not needed for row-scan use cases.

- Remove `.scorechip` from row layouts
- Score still lives in the Report (alongside comp data and reasoning) — unchanged
- Score still lives on the Brief Pick — unchanged
- This change is local to the Tracker only

### A.6 — Active-only toggle in filter strip (from Issue 4)

Add a toggle that switches between two visibility states:

- **Default (off):** active rows prominent + closed-30d shown in soft-divided group below (current mockup behavior)
- **Toggle on:** closed-30d group hidden entirely; just active rows

Existing filter chips (status filters, etc.) remain. Sort options stay as: most-recently-touched (default), group by status. Drop any score-based sort and don't add verdict-shape sort.

### A.7 — Visual weight migrates from score-based to shape-based (from Issue 4)

Current mockup uses three score-based weights: strong (≥80), mid (60–79), weak (<60). With score off the row, weight needs a new anchor.

Migrate to verdict-shape-based weight:
- Pursue / Reply rows → strong weight (bolder, prominent)
- Watch rows → mid weight (neutral)
- Skip rows (only present when user overrode the system's recommendation and applied anyway) → weak weight (muted)

Preserves the rationale of *"no traffic light, no ring, no bar"* — visual weight differentiates priority without color-coding or numeric prominence. Shape is the editorial signal; weight follows it.

---

## B. Design System v3 updates required

Already tracked in `Labra Design System - bilingual update.md`. Listing here so this wiring doc is the single complete reference.

The DS v3 update needs to include:

- §1 Spanish voice rules (folds into existing §16)
- §2 Punctuation divergence (em-dashes EN-only)
- §3 Verdict shape vocabulary mapping (Reply/Pursue/Watch/Skip ↔ Responde/Avanza/Observa/Pasa)
- §4 Spanish date formatting conventions
- §5 Masthead format update (drop "Issue" prefix in English)
- §6 Default locale detection logic
- §7 Locale toggle in global navigation
- §8 Input-output language independence
- §9 Locale switch behavior (instant)
- §10 Kicker pattern (system-wide)
- §11 **Status taxonomy** (new — nine statuses, internal codes, bilingual labels, canonical happy-path flow, loose transition rules)
- JD added to §16 EN banlist (recruiter-jargon category)

Source of truth for all of the above: `Labra Design System - bilingual update.md`.

---

## C. Other docs touched

Decisions in the Tracker review that touch already-locked docs.

### Brief spec (`Labra Brief - spec.md`)

- §3.4 `pipeline.next` signal: triggers on Tracker status transitions. The status taxonomy now formally lives in DS v3 §11. No spec change required; reader should know taxonomy is canonical there.
- §3.5 Pipeline summary: counts verdict shapes (`12 Pursues · 4 Replies · 7 Watches`), not statuses. Tracker uses operational status; Brief summary uses verdict shape. Two distinct vocabularies, both legitimate, both consumed from the user's pipeline data.

### Brief code handoff (`Labra Brief - code handoff.md`)

- §5.3 EN banlist: JD entry added (recruiter-jargon category). ✓ Done.
- §5.3 ES banlist: JD entry added (jerga recruiter category). ✓ Done.
- §3 SignalPayload: no schema change needed; signal-generation logic references the status taxonomy at runtime, not in the data shape.

### Verdict-Report architecture (locked decision, deferred UI)

Surfaced during Tracker review (Issue 4 thread on Verdict accessibility). The Verdict-Report component becomes a chaptered editorial surface over a role's lifecycle.

**v1 implementation (ships with Tracker code):**
- Every re-evaluation writes a new Verdict record to the database with a timestamp; original Verdicts are never overwritten
- All Verdict records for a role are linked to the same role ID
- The Report UI displays the latest Verdict (current locked behavior); historical Verdicts exist in data but are not yet surfaced as a chaptered UI
- Manual re-evaluation (via the `Evaluate` button on the Report, Pick, or elsewhere) creates a new chapter record

**v1.5 implementation (ships with Pattern log):**
- Report UI surfaces all linked Verdicts as chronological chapters
- Each chapter has its own editorial header (`Original read · April 14`, `Re-read · May 1`, etc.) with the editor-written framing
- Chapter pattern uses the existing Verdict component as the chapter body, with the kicker localized per occurrence type

**Deferred entirely:**
- Input-triggered re-evaluations (system detects comp disclosed → auto-creates a new chapter). Requires input-matching logic; saved for future work.

Implications for Tracker code: the row's "report" link opens the latest Verdict (displayed) but the data API should already support pulling all historical Verdicts for a role even though no v1 UI consumes them. Future-proofing the schema for the v1.5 chapter UI.

---

## D. Linter rule updates required

For the Tracker code handoff (when written):

- **No runtime LLM linter needed on Tracker.** Per §G below, the Tracker has no LLM-generated content — Way-A suggestions are deterministic templates, and verdict reasoning lives on the Report surface (Brief code handoff §5 covers its linter rules).
- **i18n catalog review** instead of runtime linter: the Way-A template strings (EN + ES) live in the i18n catalog and must be reviewed once for voice compliance (no banlisted phrases, no em-dashes in ES, no exclamation marks, Spanish opening `¿` where applicable). One-time review, not per-render check.
- **Status validation:** any API endpoint that writes a Tracker row's status must validate against the nine values in DS §11. Reject anything else.
- **Status transition logging:** write to the observation log when a status changes (parallels the Brief signal observation logging pattern). Needed for Pattern log v1.5.

---

## E. Open review issues (still to resolve)

These will add to A–D above when resolved:

### Issue 4 — Verdict-shape exposure on Tracker (RESOLVED)

Outcome:
- **No verdict-shape filter** in the filter strip. Score sorting / status filtering serve the operational use cases; verdict-shape introspection lives in the Pattern log (v1.5).
- **Verdict shape now visible per row** as italicized inline label (see A.4 in mockup updates above).
- **Score removed from Tracker rows** entirely (see A.5).
- **Active-only toggle added** to filter strip (see A.6).
- **Visual weight migrates from score-based to shape-based** (see A.7).
- **Verdict-Report architecture confirmed as chaptered**: re-evaluations create chapters; v1 ships single-chapter UI with multi-chapter data, v1.5 ships chapter UI (see Verdict-Report architecture in §C above).

### Issue 5 — Per-row LLM commentary scope (RESOLVED)

Outcome: **no LLM-generated content on the Tracker.** Way-A "Labra suggests" prompts are data-driven deterministic templates filled with user variables at render time. No per-row commentary, no per-row LLM call, no runtime linter on Tracker content. Full architecture in §G below.

The mockup's Gmail-dependent Way-A example (`Reply from recruiter@stori.com mentioned 'next steps'...`) is preserved in the mockup as aspirational v1.5+ vision; v1 build is limited to the nine deterministic triggers in §G.

---

## G. Tracker Way-A suggestion logic (Issue 5 resolution)

Way-A "Labra suggests" is **data-driven deterministic templates**, not LLM-generated content. No LLM call per suggestion, no runtime linter required on output. Templates are populated with user-data variables (company name, status, days-since-status-change, etc.) at render time. The i18n catalog provides the EN/ES strings; locale picks at render per DS v2 §17.6.

### Substrate (data the system has in v1)

- Every Verdict generated for the user (with timestamps)
- Every status transition the user has logged (with timestamps)
- User preferences (archetype, comp floor, story bank — same as Brief)
- User overrides
- Time elapsed since each event

**No external integrations in v1:** no Gmail, no Calendar, no Workday/Greenhouse status sync. All Way-A triggers fire from the substrate above.

### v1 trigger conditions (locked)

| Trigger condition | Suggestion (EN) | Suggestion (ES) |
|---|---|---|
| `applied` + 14d no status change | Send follow-up to {company}? | ¿Enviar seguimiento a {company}? |
| `applied` + 30d no status change | Mark {company} as ghosted? | ¿Marcar {company} sin respuesta? |
| `interviewing` + 21d no status change | Status check on {company}? | ¿Pedir status a {company}? |
| `interviewing` + 45d no status change | Did this go quiet? Mark ghosted? | ¿Se enfrió esto? ¿Marcar sin respuesta? |
| `offer_pending` + 5d | Capture the offer details: comp, deadline? | ¿Capturar detalles de oferta: comp, plazo? |
| `offer_pending` + 14d | Offer aging. Respond or withdraw? | Oferta envejeciendo. ¿Responder o retirarse? |
| `evaluating` + 60d no movement | Still considering {company}, or pass? | ¿Sigues considerando {company}, o pasas? |
| Status just changed to `interviewing` (one-shot, surfaces on first view after transition) | Spin up prep? | ¿Abrir prep? |
| Status just changed to `offer_pending` (one-shot, surfaces on first view after transition) | Capture offer details? | ¿Capturar detalles de oferta? |

Thresholds are v1 defaults. Tune from telemetry after 30 days of usage data; same approach as the Pick quality threshold of 80 in the Brief.

### Aspirational Way-A in the mockup (NOT for v1 build)

The mockup contains a Way-A example that requires Gmail integration:

> Reply from recruiter@stori.com mentioned 'next steps'. Mark as interviewing?

This example shows the product vision but requires inbox-read functionality not in v1 scope. **Engineering should not attempt to build this.** Way-A v1 is limited to the nine deterministic triggers above. The Gmail-dependent vision is preserved as v1.5+ work.

Mockup will not be updated to remove the aspirational example — deliberate design choice to keep the vision visible in the file even though it won't ship in the first release.

### Voice for Way-A templates

Template strings still respect DS v2 voice rules (one-time catalog review, not runtime check):

- No em-dashes in Spanish (use semicolons, colons, or commas)
- No exclamation marks in either language
- No emoji
- No banlisted phrases (JD, sales CTAs, urgency, gamification, "we" as product)
- Spanish opening `¿` for questions per DS v2 §17.10

### Where Way-A is NOT used

The Tracker has no other system-generated content:

- Tracker rows contain only structured data (company name, role title, status pill, verdict shape, dates) — no per-row commentary
- Verdict reasoning lives on the Report surface (reachable from Tracker via the row's report link), not on the Tracker row itself
- Brief signals (Cadence, Drift, Bar, Freshness) live on the Brief, not the Tracker

This keeps the Tracker quiet, scannable, and operationally focused.

---

## F. Definition of done

The Tracker is ready for handoff when:

1. Every row in the Status table at the top of this doc shows "Wiring done? — Yes"
2. Mockup updates A.1, A.2, A.3 are applied to `Labra Tracker.html`
3. DS team has confirmed they'll fold §1–§11 of the bilingual-update doc into DS v3 on the same release
4. Issues 4 and 5 are resolved and any resulting wiring items are added and completed

When done, write the Tracker design handoff (if needed) and/or proceed directly to the Tracker code handoff using `Labra Brief - design handoff.md` and `Labra Brief - code handoff.md` as structural templates.
