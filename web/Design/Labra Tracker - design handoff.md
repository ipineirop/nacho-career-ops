# Labra Tracker — design handoff

For the design team. This is a **delta handoff** — the existing Tracker mockup is strong and most of its design language stays. The work here is updating the mockup to match decisions locked during the review session, plus locking visual treatment for a few new elements.

Source of truth for all locked decisions: `Labra Tracker - wiring.md`. This handoff translates the wiring decisions into design-specific instructions.

---

## 1. What you're producing

Updated `Labra Tracker.html` covering:

- All nine existing screen states (heavy, light, empty, outcome, status-flows, board, mobile, edges, copy)
- All visual updates per §A of the wiring doc (seven changes, listed below)
- Both locales (EN + ES) consistent throughout
- The new `offer_accepted` / Aceptada status with a visual treatment defined
- The verdict shape inline display on every row

The Tracker also runs in parallel with the bilingual + status-taxonomy updates landing in DS v3 — you don't need to wait for that release, but reference `Labra Design System - bilingual update.md` for the taxonomy + voice rules.

---

## 2. What stays — preserve the strong parts of the existing mockup

The Tracker's design language is well-defined. Keep all of this intact:

- **The "private deal log" framing** — quiet, structured, dense, scannable. *"Like a private deal log a lawyer or investor would keep — not a TODO app, not a CRM, not a kanban game."*
- **Hairline-divided single-line row density** at scale (the heavy state with 19 active items)
- **Closed-30d group** below a soft divider, collapsible-but-visible. *"The user's record, not a cemetery."*
- **Status pill visual language** for active rows (interviewing, applied, evaluating, offer_pending)
- **Way-A "Labra suggests" inline confirmation pattern** (in-row, in-place, with single-tap confirm or close — no notification feed, no modal)
- **Way-B manual status change** — tap the pill, change anytime
- **Outcome capture inline-expansion** (no modal — *"a modal cuts the act of logging from the work environment"*)
- **No "Are you sure?" dialogs** — just a 6-second undo toast
- **Default sort: most-recently-touched**
- **No alphabetical sort** offered (the explicit rejection in the mockup — *"it's not how you think about your pipeline"*)
- **Kanban-as-toggle** with telemetry-driven kill criteria documented in the edges screen
- **"No traffic light, no ring, no bar"** rationale — visual weight differentiates priority without color-coding or gamified prominence
- **Score chip visual treatment** (56×56 verdict, 44×44 list) — preserved on the Report and Brief Pick surfaces, just removed from the Tracker row (see §3.5 below)

These decisions are defensible and the design language depends on them. The updates below are corrections + new elements, not a rethink.

---

## 3. Visual updates required

Seven items, each with rationale in the wiring doc §A. Listed here in priority order for design work.

### 3.1 — Add verdict shape to every Tracker row

**What.** Display the row's verdict shape (Reply / Pursue / Watch / Skip → Responde / Avanza / Observa / Pasa) inline in the row meta.

**Why.** The verdict is the most editorially distinctive thing the system produces. Without it on the row, the user can't scan their pipeline and see the system's recommendations without clicking through each row.

**My proposal (open to your push-back):** italicized Fraunces register in the meta line, between company name and status pill. Marks the verdict as *editorial recommendation* (historical, set at evaluation time) distinct from the *operational status* (pill, current state).

Example row format:
```
Stori · *Avanza* · en entrevista · 2d
```

Alternative treatments to consider — your call:
- Small caps Geist Mono (matches the kicker / meta vocabulary)
- Color-tinted text (each shape has a subtle tint — risk of looking like a status indicator)
- A small chip (could compete visually with the status pill — risk of muddling the two roles)

I'd lean italic Fraunces because it preserves the editorial register and is visually distinct from the operational status pill. But you have better intuition on the visual rhythm of the row.

### 3.2 — Migrate visual weight from score-based to shape-based

**What.** The current mockup uses three score-based weight tiers: strong (≥80), mid (60–79), weak (<60). With score removed from rows (see 3.5), the weight needs a new anchor.

**Why.** Visual weight differentiates priority across rows without color-coding. The rationale — *"no traffic light, no ring, no bar"* — stays; the anchor migrates from score to verdict shape.

**New mapping:**
- Pursue / Reply rows → strong weight (bolder, more prominent)
- Watch rows → mid weight (neutral)
- Skip rows (only present when user overrode the system and applied anyway — rare) → weak weight (muted)

Implementation calls you own:
- Exactly how bold is "strong"? Same as the previous score-based strong?
- Mid weight — match the previous score-based mid, or recalibrate?
- The Skip case is rare; you may want to design for it but not over-invest

### 3.3 — Remove score chip from Tracker rows

**What.** The `.scorechip` element is removed from row layouts entirely.

**Why.** Verdict shape now carries the priority signal (per 3.1). Score added granularity not needed for row-scan use cases; it lives in the Report alongside the analytical context where 84 vs 82 is meaningful.

**Where score still lives** (unchanged):
- Report surface — alongside comp benchmarks and reasoning
- Brief Pick — the score chip on the highlighted opportunity stays

**Local-to-Tracker change only.** Don't propagate to other surfaces.

### 3.4 — Add active-only toggle to the filter strip

**What.** A toggle that switches between two visibility states:

- **Default (off):** active rows prominent + closed-30d shown in soft-divided group below (current mockup behavior)
- **Toggle on:** closed-30d group hidden entirely; just active rows visible

**Why.** Sometimes users want pure focus on active work without the historical record cluttering the view. The mockup already separates terminal rows visually — the toggle makes that filter more aggressive when needed.

**Design calls you own:**
- Visual pattern: segmented chip in the filter strip (matches existing filter chips), or a small switch toggle, or a different affordance
- Placement: with the existing filter chips, or set apart
- Label: I'd suggest `Active only` / `Solo activos`

### 3.5 — Add `offer_accepted` / Aceptada status

**What.** A new ninth status that captures "the user took the job." Currently the mockup has no terminal status for the success case — only rejected/withdrew/passed/ghosted (all loss flavors).

**Why.** *"It might not be a signal for the user but it's data we need to capture for the intelligence model"* — accepted offers are the most important data point in the user's pipeline, comparable against everything they rejected/passed/withdrew from. A Tracker that only captures losses is a survivorship-bias product.

**Design work needed:**

1. **Status pill visual** for Aceptada — must be visually distinct from rejected / withdrew / passed (which are losses) AND distinct from interviewing / applied / offer_pending (which are active). This is a *complete-win* state. Suggested direction: a calm, settled color (sage, slate, deep teal) that reads as resolution rather than alarm. Avoid celebratory colors that would feel out of register with the rest of the surface.

2. **Sample row in the closed-30d group** with status Aceptada — locks the row treatment for the win case.

3. **Outcome capture flow update** — after `"Recibí oferta"` opens the optional fields (already in the mockup), add `"Acepté"` as the natural follow-on action that transitions the row to Aceptada.

4. **Editorial consideration:** the Aceptada row is the most significant in the user's entire history. Worth considering if it gets a small visual marker (a small star, a subtle bookmark glyph) to make it findable later. Open call — could also just be a normal pill that the user navigates to via filter or sort.

### 3.6 — Fix JD jargon (one EN string)

**What.** Line 2189 in the FAB onboarding hint:

| Current EN | Replace with |
|---|---|
| `Paste anything — DM, link, JD` | `Paste anything — DM, link, job description` |

**Why.** "JD" is recruiter jargon banned per DS v3 §16 banlist update. The Spanish side already says `descripción` — only the EN copy needs updating.

### 3.7 — Fix Spanish em-dashes in UI copy (18 instances)

**What.** Replace em-dashes with semicolons, colons, commas, or middle dots per the locked table.

**Why.** Em-dashes are banned in Spanish editorial copy per DS v2 §17.1 — they're an English-only device.

Full table is in `Labra Tracker - wiring.md` §A.2. Includes:

- Button text: `Omitir — dejar como oferta` → `Omitir (dejar como oferta)`
- Button restructure: `Lo envié — marcar aplicada` → `Marcar como aplicada` (cleaner verb, drops first-person framing)
- Role-title format: `Operations Manager — LatAm` (3 instances) → `Operations Manager · LatAm` (middle dot)
- Outcome flow labels, filter labels, FAB hint, etc.

See wiring doc for the complete list.

---

## 4. Cross-cutting rules

All from DS v2 / pending v3. Don't reinvent any of these:

- **Voice rules** — DS v3 §16 (English) + §17.1 (Spanish-specific divergence on em-dashes)
- **Status taxonomy** — DS v3 §11 (the nine status values with bilingual labels — pending DS v3 release; full text in `Labra Design System - bilingual update.md` §11)
- **Verdict shape vocabulary** — DS v3 §17.2 (Reply/Pursue/Watch/Skip → Responde/Avanza/Observa/Pasa)
- **Date formatting** — DS v3 §17.3 (lowercase Spanish weekdays/months, no comma between weekday and day)
- **Kicker pattern** — DS v3 §17.8 (verdict shape display should respect this if you go the kicker route)
- **Currency / numbers / opening `¿`** — DS v3 §17.10
- **Locale toggle** lives in global navigation per DS v3 §17.5; the Tracker just respects it
- **Locale switch is instant** per DS v3 §17.6 — no transitions, no loading state

---

## 5. Aspirational content in the mockup — DO NOT update or remove

The mockup contains one Way-A "Labra suggests" example that requires Gmail integration:

> Reply from recruiter@stori.com mentioned 'next steps'. Mark as interviewing?

This is **vision-only** for v1. Engineering will not build it. The decision is to **preserve it in the mockup** so the product vision is visible, but it should be understood as v1.5+ work.

You may want to add a small annotation in the mockup's `copy` or `edges` screen flagging this clearly so future readers don't get confused about what ships. Your call on whether the annotation is needed.

---

## 6. Open design decisions

Things you'll resolve as you update the mockup. None are blockers for review; flagging so they don't get missed.

1. **Verdict shape inline treatment** — italic Fraunces is my proposal; you may have a better visual call.
2. **Aceptada pill color** — distinct from losses and from active states; the "calm settled win" color choice.
3. **Aceptada row marker** — does the win row get a small visual flag for findability, or stay a normal pill?
4. **Active-only toggle visual pattern** — chip, switch, or other.
5. **Skip row weight treatment** — rare case; design but don't over-invest.
6. **Mockup annotation for aspirational Way-A** — add a clarifying label, or leave the example as-is.
7. **Verdict shape format consistency check** — at 720px and below (mobile breakpoint per DS v2 §17.5), the row meta gets tighter. Verify the verdict shape display still works at narrow widths without wrapping or truncating.

---

## 7. Out of scope for design

Things the wiring doc explicitly decided against — don't design these:

- **Verdict-shape filter** in the filter strip (Issue 4) — no.
- **Verdict-shape sort** — no.
- **Score chip on Tracker rows** — removed.
- **Chapter UI on the Report** — v1.5, design when Pattern log work begins.
- **Separate Verdict-only route from Tracker** — Issue 4 decided one route; the Verdict-Report component handles both states.
- **Gmail integration UI** — v1.5+, no design work here.

---

## 8. Definition of design done

The Tracker mockup is ready for the code handoff when:

1. All seven items in §3 are applied to `Labra Tracker.html`
2. Both locales (EN + ES) render the updates consistently across all nine screens
3. The new Aceptada status has a locked visual treatment across status pill, sample row, and outcome flow
4. Verdict shape display is verified at desktop and mobile (720px) breakpoints
5. The mockup's aspirational Way-A example either has a clarifying annotation or has been confirmed acceptable as-is
6. The Spanish em-dash table from `Labra Tracker - wiring.md` §A.2 is fully resolved

When done, the updated mockup + the wiring doc become the inputs for the Tracker code handoff.

---

## 9. References

- `Labra Tracker - wiring.md` — source of truth for all locked decisions
- `Labra Design System v2.html` — current DS (v3 pending)
- `Labra Design System - bilingual update.md` — pending v3 content including the status taxonomy
- `Labra Tracker.html` (existing) — the file to update
- `Labra Brief - standalone.html` — reference for locale toggle pattern, FAB, and overall product visual consistency
- `Labra Brief - design handoff.md` — Brief's design handoff, useful as a stylistic reference for how the handoff docs read
