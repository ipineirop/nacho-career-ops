// Standalone HTML preview for the Don't-Want Capture & Past-Employer Matching
// surfaces (Phase B). Mock data only — no auth, no DB, no real onboarding flow.
// Mirrors the /demo convention. View at /preview/dont-want.

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Labra · Don't-Want & Past-Employer (preview)</title>
  <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Albert+Sans:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #f6f8f8; --surface: #ffffff; --surface-2: #fafcfc; --canvas: #f0f4f4;
      --ink: #0a1f24; --ink-2: #455258; --ink-3: #889399;
      --line: #e2e7e8; --line-soft: #eef2f2;
      --accent: #0d7c89; --accent-soft: #d6eef0; --accent-on: #ffffff;
      --warn: #b4690e; --warn-soft: #fdf1de;
      --radius: 14px;
    }
    body { font-family: "Albert Sans", system-ui, sans-serif; background: var(--bg); color: var(--ink); font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
    .wrap { max-width: 760px; margin: 0 auto; padding: 56px 24px 120px; }

    .brand { font-family: "Fraunces", serif; font-weight: 500; font-size: 22px; color: var(--ink); }
    .brand .dot { color: var(--accent); font-style: italic; }
    .kicker { font-family: "Geist Mono", monospace; font-size: 10.5px; letter-spacing: 1.4px; text-transform: uppercase; color: var(--ink-3); margin: 40px 0 10px; }
    .section-title { font-family: "Fraunces", serif; font-weight: 400; font-size: 30px; line-height: 1.1; letter-spacing: -0.8px; }
    .section-sub { color: var(--ink-2); margin-top: 8px; }

    .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 28px; margin-top: 18px; }

    /* ── avoid block ─────────────────────────────────────────── */
    .block-head { font-family: "Fraunces", serif; font-size: 21px; font-weight: 400; letter-spacing: -0.4px; }
    .optional { font-family: "Geist Mono", monospace; font-size: 10.5px; letter-spacing: 0.8px; text-transform: uppercase; color: var(--ink-3); margin-left: 8px; vertical-align: middle; }
    .block-sub { color: var(--ink-2); margin-top: 6px; font-style: italic; }
    .field { margin-top: 24px; }
    .field-label { font-weight: 600; font-size: 13.5px; color: var(--ink); }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; align-items: center; }
    .chip { display: inline-flex; align-items: center; gap: 7px; background: var(--accent-soft); color: var(--accent); border-radius: 999px; padding: 6px 10px 6px 12px; font-size: 13px; font-weight: 500; }
    .chip button { border: none; background: none; color: var(--accent); cursor: pointer; font-size: 14px; line-height: 1; opacity: 0.65; padding: 0; }
    .chip button:hover { opacity: 1; }
    .chip.warn { background: var(--warn-soft); color: var(--warn); }
    .chip.warn button { color: var(--warn); }
    .add-input { flex: 1; min-width: 160px; border: none; outline: none; background: none; font-family: inherit; font-size: 13px; color: var(--ink); padding: 6px 4px; }
    .add-input::placeholder { color: var(--ink-3); }
    .field-line { border-bottom: 1px solid var(--line); padding-bottom: 4px; }
    .hint { font-size: 12px; color: var(--ink-3); margin-top: 7px; }

    /* ── past-employer toggle ───────────────────────────────── */
    .divider { height: 1px; background: var(--line-soft); margin: 30px 0 24px; }
    .sub-head { font-weight: 600; font-size: 14px; }
    .emp-label { font-family: "Geist Mono", monospace; font-size: 10.5px; letter-spacing: 0.6px; text-transform: uppercase; color: var(--ink-3); margin: 14px 0 8px; }
    .emp-list { list-style: none; display: flex; flex-direction: column; gap: 4px; }
    .emp-list li { color: var(--ink-2); }
    .emp-list .co { color: var(--ink); font-weight: 500; }
    .emp-list .yr { font-family: "Geist Mono", monospace; font-size: 12px; color: var(--ink-3); }
    .toggle-row { display: flex; gap: 12px; align-items: flex-start; margin-top: 20px; cursor: pointer; }
    .switch { flex: none; width: 40px; height: 23px; border-radius: 999px; background: var(--accent); position: relative; transition: background 0.15s; margin-top: 1px; }
    .switch.off { background: #cdd6d7; }
    .switch::after { content: ""; position: absolute; top: 2px; left: 19px; width: 19px; height: 19px; border-radius: 50%; background: #fff; transition: left 0.15s; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
    .switch.off::after { left: 2px; }
    .toggle-copy .t { font-weight: 500; }
    .toggle-copy .d { color: var(--ink-3); font-size: 12.5px; margin-top: 3px; max-width: 460px; }

    /* ── verdict ────────────────────────────────────────────── */
    .switcher { position: sticky; top: 0; z-index: 5; background: var(--bg); padding: 14px 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; border-bottom: 1px solid var(--line); }
    .switcher .lbl { font-family: "Geist Mono", monospace; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-3); margin-right: 4px; }
    .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; overflow: hidden; background: var(--surface); }
    .seg button { border: none; background: none; padding: 6px 12px; font-family: inherit; font-size: 12.5px; color: var(--ink-2); cursor: pointer; }
    .seg button.active { background: var(--ink); color: #fff; font-weight: 500; }

    .verdict-head { display: flex; align-items: baseline; gap: 14px; }
    .score { font-family: "Fraunces", serif; font-size: 40px; font-weight: 400; letter-spacing: -1px; }
    .score small { font-size: 18px; color: var(--ink-3); }
    .rec { font-family: "Geist Mono", monospace; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; padding: 5px 10px; border-radius: 6px; }
    .rec.hold { background: var(--warn-soft); color: var(--warn); }
    .role-line { color: var(--ink-2); margin-top: 4px; }
    .role-line b { color: var(--ink); font-weight: 600; }

    /* past-employer line (§3.5a) */
    .pe-line { margin-top: 18px; padding: 13px 15px; background: var(--canvas); border: 1px solid var(--line); border-radius: 10px; display: flex; gap: 11px; align-items: flex-start; }
    .pe-line .icon { flex: none; width: 18px; height: 18px; color: var(--accent); margin-top: 1px; }
    .pe-line .txt { flex: 1; }
    .pe-line .not-same { background: none; border: none; color: var(--ink-3); font-family: inherit; font-size: 12.5px; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; padding: 0; }
    .pe-line .not-same:hover { color: var(--ink-2); }
    .pe-line.dismissed { color: var(--ink-3); font-style: italic; }

    .sec { margin-top: 26px; }
    .sec-h { font-family: "Geist Mono", monospace; font-size: 10.5px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--ink-3); margin-bottom: 9px; }
    .reason { color: var(--ink-2); }

    /* pattern hits (§3.5b) */
    .ph { margin-top: 26px; padding: 18px 18px 16px; border: 1px solid var(--warn-soft); background: #fffaf2; border-radius: 12px; }
    .ph-h { font-weight: 600; display: flex; align-items: center; gap: 7px; }
    .ph-h .star { color: var(--warn); }
    .ph ul { list-style: none; margin: 12px 0 0; display: flex; flex-direction: column; gap: 8px; }
    .ph li { color: var(--ink-2); padding-left: 2px; }
    .ph li .dim { color: var(--ink); font-weight: 500; }
    .ph .close { margin-top: 13px; font-size: 12.5px; color: var(--ink-3); font-style: italic; }

    /* §5.2 missed-match affordance */
    .missed { margin-top: 18px; }
    .missed .link { background: none; border: none; color: var(--accent); font-family: inherit; font-size: 13px; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; padding: 0; }
    .missed .picker { margin-top: 12px; padding: 14px; border: 1px dashed var(--line); border-radius: 10px; background: var(--surface-2); display: none; }
    .missed .picker.open { display: block; }
    .missed .picker .q { font-weight: 500; margin-bottom: 9px; }
    .missed .opt { display: block; width: 100%; text-align: left; border: 1px solid var(--line); background: #fff; border-radius: 8px; padding: 9px 12px; margin-bottom: 6px; font-family: inherit; font-size: 13px; color: var(--ink); cursor: pointer; }
    .missed .opt:hover { border-color: var(--accent); background: var(--accent-soft); }

    .footer-actions { margin-top: 30px; display: flex; gap: 10px; }
    .btn { font-family: inherit; font-size: 13.5px; font-weight: 500; padding: 10px 18px; border-radius: 10px; cursor: pointer; border: 1px solid var(--line); background: var(--surface); color: var(--ink); }
    .btn.primary { background: var(--ink); color: #fff; border-color: var(--ink); }

    /* tracker row marker (§3.5c) */
    .tracker-row { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); margin-top: 14px; }
    .tracker-row .co { font-weight: 600; }
    .tracker-row .role { color: var(--ink-2); }
    .tracker-row .spacer { flex: 1; }
    .tracker-row .marker { font-family: "Geist Mono", monospace; font-size: 10.5px; letter-spacing: 0.5px; color: var(--warn); background: var(--warn-soft); padding: 4px 9px; border-radius: 999px; cursor: pointer; }
    .tracker-pop { font-size: 12.5px; color: var(--ink-2); margin-top: 8px; padding-left: 16px; display: none; }
    .tracker-pop.open { display: block; }

    .note { font-size: 12px; color: var(--ink-3); margin-top: 10px; font-style: italic; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">labra<span class="dot">.</span> <span class="optional">preview · mock data</span></div>

    <!-- ════════════ ONBOARDING: AVOID BLOCK (§1.1) ════════════ -->
    <div class="kicker">Onboarding · screen 04 · positioning</div>
    <h1 class="section-title">The avoid block</h1>
    <p class="section-sub">Appended below the six positioning questions. Entirely optional.</p>

    <div class="card">
      <div>
        <span class="block-head">And what you're not looking for.</span>
        <span class="optional">optional</span>
      </div>
      <p class="block-sub">The shape of your "no" tells me as much as your yes.</p>

      <div class="field" data-dim="industry">
        <div class="field-label">Industries</div>
        <div class="field-line"><div class="chips" id="chips-industry">
          <input class="add-input" placeholder="+ add — e.g. consulting firms" />
        </div></div>
      </div>

      <div class="field" data-dim="culture">
        <div class="field-label">Culture / company shape</div>
        <div class="field-line"><div class="chips" id="chips-culture">
          <input class="add-input" placeholder="+ add — e.g. founder-still-CEO companies" />
        </div></div>
      </div>

      <div class="field" data-dim="title">
        <div class="field-label">Titles / scope</div>
        <div class="field-line"><div class="chips" id="chips-title">
          <input class="add-input" placeholder="+ add — e.g. VP of everything" />
        </div></div>
      </div>
      <p class="hint">Press enter or comma to add. These are soft signals — they nudge a role's score, they don't rule it out.</p>

      <!-- past-employer toggle (§1.2) -->
      <div class="divider"></div>
      <div class="sub-head">Companies you've already been through</div>
      <div class="emp-label">Pulled from your CV</div>
      <ul class="emp-list">
        <li><span class="co">Rappi</span> · <span class="yr">2021–2024</span></li>
        <li><span class="co">Kavak</span> · <span class="yr">2019–2021</span></li>
        <li><span class="co">Cornershop</span> · <span class="yr">2017–2019</span></li>
      </ul>
      <div class="toggle-row" id="peToggle">
        <div class="switch" id="peSwitch"></div>
        <div class="toggle-copy">
          <div class="t">Flag when a role looks like a past employer</div>
          <div class="d">I'll catch the obvious cases. Acquisitions, subsidiaries, and roles where the company isn't clearly named will sometimes slip through — you can flag them from any verdict.</div>
        </div>
      </div>
    </div>

    <!-- ════════════ EVALUATE VERDICT SURFACES ════════════ -->
    <div class="kicker">Evaluate · verdict</div>
    <h1 class="section-title">What shows up on a verdict</h1>
    <p class="section-sub">Flip the states below to see each surface.</p>

    <div class="switcher">
      <span class="lbl">Past employer</span>
      <div class="seg" id="segMatch">
        <button data-v="direct" class="active">Direct</button>
        <button data-v="lineage">Acquisition</button>
        <button data-v="none">No match</button>
      </div>
      <span class="lbl" style="margin-left:10px">Pattern hits</span>
      <div class="seg" id="segHits">
        <button data-v="on" class="active">On</button>
        <button data-v="off">Off</button>
      </div>
    </div>

    <div class="card">
      <div class="verdict-head">
        <div class="score">71<small>/100</small></div>
        <div class="rec hold">Worth a look</div>
      </div>
      <div class="role-line">Director of Operations · <b id="vCompany">Rappi</b></div>

      <!-- past-employer line (§3.5a) + not-the-same (§5.1) -->
      <div class="pe-line" id="peVerdictLine">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>
        <div class="txt">
          <span id="peText">This is at Rappi, where you worked '21–'24.</span>
          <div style="margin-top:7px"><button class="not-same" id="notSame">not the same</button></div>
        </div>
      </div>

      <!-- §5.2 missed-match affordance (shown when no past-employer line) -->
      <div class="missed" id="missed" style="display:none">
        <button class="link" id="missedLink">This is actually at one of my past employers</button>
        <div class="picker" id="missedPicker">
          <div class="q">Which one?</div>
          <button class="opt">Rappi · 2021–2024</button>
          <button class="opt">Kavak · 2019–2021</button>
          <button class="opt">Cornershop · 2017–2019</button>
        </div>
      </div>

      <div class="sec">
        <div class="sec-h">Summary</div>
        <p class="reason">Strong operational fit and the comp clears your floor. The scope is broad and the org is mid-restructure — read the team section before committing.</p>
      </div>

      <!-- pattern hits (§3.5b) -->
      <div class="ph" id="patternHits">
        <div class="ph-h"><span class="star">★</span> Pattern hits — things you said you're avoiding</div>
        <ul>
          <li>— <span class="dim">Culture:</span> founder is still CEO, you flagged this kind of stage</li>
          <li>— <span class="dim">Title:</span> scope reads like the "VP of everything" pattern you flagged</li>
        </ul>
        <div class="close">The score above factors these in.</div>
      </div>

      <div class="footer-actions">
        <button class="btn primary">Add to tracker</button>
        <button class="btn">Draft a reply</button>
      </div>
    </div>

    <!-- ════════════ TRACKER ROW MARKER (§3.5c) ════════════ -->
    <div class="kicker">Tracker · row</div>
    <h1 class="section-title">The ambient marker</h1>
    <p class="section-sub">A role kept past Evaluate, carrying its pattern hits.</p>
    <div class="tracker-row" id="trackerRow">
      <div class="co">Rappi</div>
      <div class="role">Director of Operations</div>
      <div class="spacer"></div>
      <div class="marker" id="trackerMarker">pattern hits</div>
    </div>
    <div class="tracker-pop" id="trackerPop">
      — Culture: founder is still CEO, you flagged this kind of stage<br/>
      — Title: scope reads like the "VP of everything" pattern you flagged
    </div>
    <p class="note">No count shown — "hits" is a qualitative judgment, not a discrete set (spec §3.5c).</p>
  </div>

  <script>
    // ── chip inputs (free-add, x-to-remove, enter/comma commit, >60 warn) ──
    function wireChips(id) {
      const root = document.getElementById(id);
      const input = root.querySelector('.add-input');
      function addChip(val) {
        const v = val.trim().replace(/,$/, '').trim();
        if (!v) return;
        const chip = document.createElement('span');
        chip.className = 'chip' + (v.length > 60 ? ' warn' : '');
        chip.innerHTML = '<span></span><button title="remove">×</button>';
        chip.querySelector('span').textContent = v;
        chip.querySelector('button').onclick = () => chip.remove();
        root.insertBefore(chip, input);
      }
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addChip(input.value); input.value = ''; }
        else if (e.key === 'Backspace' && !input.value) {
          const chips = root.querySelectorAll('.chip'); if (chips.length) chips[chips.length - 1].remove();
        }
      });
      input.addEventListener('blur', () => { if (input.value.trim()) { addChip(input.value); input.value = ''; } });
    }
    ['chips-industry', 'chips-culture', 'chips-title'].forEach(wireChips);
    // seed a couple so the empty + filled states are both visible
    (function seed(){
      const map = { 'chips-industry': ['consulting firms'], 'chips-culture': ['early-stage chaos'], 'chips-title': [] };
      for (const [id, vals] of Object.entries(map)) { const root = document.getElementById(id); const input = root.querySelector('.add-input');
        vals.forEach(v => { const c = document.createElement('span'); c.className='chip'; c.innerHTML='<span></span><button title="remove">×</button>'; c.querySelector('span').textContent=v; c.querySelector('button').onclick=()=>c.remove(); root.insertBefore(c, input); }); }
    })();

    // ── past-employer onboarding toggle (default ON) ──
    let peOn = true;
    const peSwitch = document.getElementById('peSwitch');
    document.getElementById('peToggle').onclick = () => { peOn = !peOn; peSwitch.classList.toggle('off', !peOn); };

    // ── verdict state machine ──
    const state = { match: 'direct', hits: 'on' };
    const peLine = document.getElementById('peVerdictLine');
    const peText = document.getElementById('peText');
    const missed = document.getElementById('missed');
    const patternHits = document.getElementById('patternHits');
    const vCompany = document.getElementById('vCompany');
    const copy = {
      direct: { co: 'Rappi', txt: "This is at Rappi, where you worked '21–'24." },
      lineage: { co: 'Uber Eats LatAm', txt: "This is at Uber Eats LatAm — which absorbed Cornershop in 2021. You were at Cornershop '18–'21." },
      none: { co: 'Mercado Libre', txt: '' },
    };
    function render() {
      const c = copy[state.match];
      vCompany.textContent = c.co;
      if (state.match === 'none') { peLine.style.display = 'none'; missed.style.display = 'block'; }
      else {
        peLine.style.display = 'flex'; missed.style.display = 'none';
        peLine.classList.remove('dismissed');
        peText.textContent = c.txt;
        peLine.querySelector('.not-same').style.display = '';
        peLine.querySelector('.not-same').parentElement.style.display = '';
        peLine.querySelector('.icon').style.display = '';
      }
      patternHits.style.display = state.hits === 'on' ? 'block' : 'none';
    }
    document.querySelectorAll('#segMatch button').forEach(b => b.onclick = () => {
      document.querySelectorAll('#segMatch button').forEach(x => x.classList.remove('active')); b.classList.add('active');
      state.match = b.dataset.v; render();
    });
    document.querySelectorAll('#segHits button').forEach(b => b.onclick = () => {
      document.querySelectorAll('#segHits button').forEach(x => x.classList.remove('active')); b.classList.add('active');
      state.hits = b.dataset.v; render();
    });

    // §5.1 not-the-same → collapse + confirmation copy
    document.getElementById('notSame').onclick = () => {
      peLine.classList.add('dismissed');
      peLine.querySelector('.icon').style.display = 'none';
      peText.textContent = "Got it — won't flag this match again.";
      document.getElementById('notSame').parentElement.style.display = 'none';
    };
    // §5.2 missed-match picker
    document.getElementById('missedLink').onclick = () => document.getElementById('missedPicker').classList.toggle('open');
    document.querySelectorAll('#missedPicker .opt').forEach(o => o.onclick = () => {
      const t = o.textContent.split('·')[0].trim();
      document.getElementById('missedPicker').classList.remove('open');
      missed.innerHTML = '<div class="pe-line"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg><div class="txt">Flagged — this role is at <b>' + t + '</b>, a past employer. (Score unchanged.)</div></div>';
    });

    // §3.5c tracker marker tap
    document.getElementById('trackerMarker').onclick = () => document.getElementById('trackerPop').classList.toggle('open');

    render();
  </script>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
