'use client';

import { useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SalaryBand } from '@/components/ui/salary-band';

type Step = 1 | '2a' | '2t' | '2b' | 3 | 4 | 5 | 6;

interface CvSignals {
  roles: Array<{ company: string; role: string; years: number; current: boolean; metrics: string[] }>;
  languages: string[];
  trajectory: string;
  unsure: Array<{ field: string; extracted: string; confidence: string }>;
}

interface Company { name: string; why: string; portal: string }

const STEP_LABELS = [
  { id: 1,    label: 'Connect' },
  { id: '2a', label: 'Import' },
  { id: '2t', label: 'Reading…' },
  { id: '2b', label: 'Review' },
  { id: 3,    label: 'Intake' },
  { id: 4,    label: 'Comp' },
  { id: 5,    label: 'Targets' },
  { id: 6,    label: 'Preview' },
];

const DEFAULT_LEVELS = ['Sr IC', 'Director', 'VP / Head of', 'C-level'];
const DEFAULT_FUNCTIONS = ['Operations', 'Growth Ops', 'Strategy & Ops', 'Risk Ops'];
const DEFAULT_GEOS = ['CDMX (base)', 'Remote, LatAm TZ', 'Bogotá', 'Santiago', 'São Paulo'];
const ALL_PORTALS = ['Greenhouse network', 'Ashby network', 'Lever network', 'LinkedIn LatAm', 'OCC', 'Bumeran', 'Computrabajo'];
const BENEFITS_LIST = [
  { key: 'aguinaldo', label: '★ aguinaldo > 30 días', req: true },
  { key: 'sgmm', label: '★ seguro de gastos médicos', req: true },
  { key: 'pto', label: '★ 25+ días PTO', req: true },
  { key: 'despensa', label: 'vales de despensa', req: false },
  { key: 'learning', label: 'learning $2k+/yr', req: false },
  { key: 'hardware', label: 'hardware (Mac)', req: false },
  { key: 'remote', label: '+ remote stipend', req: false },
];

function fmt(n: number | string) {
  return Number(n || 0).toLocaleString('en-US');
}

export default function OnboardingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const fileRef = useRef<HTMLInputElement>(null);

  // CV state — use ref so it survives back navigation
  const cvSignalsRef = useRef<CvSignals | null>(null);
  const [cvSignals, setCvSignalsState] = useState<CvSignals | null>(null);
  const [cvFilename, setCvFilename] = useState('');
  const [cvLoading, setCvLoading] = useState(false);
  const [cvProgress, setCvProgress] = useState<string[]>([]);

  function setCvSignals(s: CvSignals | null) {
    cvSignalsRef.current = s;
    setCvSignalsState(s);
  }

  // Unsure corrections
  const [dismissedUnsure, setDismissedUnsure] = useState<Set<number>>(new Set());
  const [editingUnsure, setEditingUnsure] = useState<Record<number, boolean>>({});
  const [unsureEdits, setUnsureEdits] = useState<Record<number, string>>({});

  // Step 3 state
  const [mode, setMode] = useState<'need' | 'leverage' | 'open'>('leverage');
  const [selectedLevels, setSelectedLevels] = useState<string[]>(['Director', 'VP / Head of']);
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>(['Operations', 'Growth Ops']);
  const [selectedGeos, setSelectedGeos] = useState<string[]>(['CDMX (base)', 'Remote, LatAm TZ']);
  const [floorSalary, setFloorSalary] = useState('1900000');
  const [currency, setCurrency] = useState<'MXN' | 'USD'>('MXN');
  const [salaryType, setSalaryType] = useState<'gross' | 'net'>('gross');
  const [humanAnswer, setHumanAnswer] = useState('');

  // Step 4 state
  const [baseSalaryFloor, setBaseSalaryFloor] = useState('1900000');
  const [baseSalaryStretch, setBaseSalaryStretch] = useState('2600000');
  const [bonusPct, setBonusPct] = useState('15');
  const [equityPct, setEquityPct] = useState('0.15');
  const [skippedBonus, setSkippedBonus] = useState(false);
  const [skippedEquity, setSkippedEquity] = useState(false);
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>(['aguinaldo', 'sgmm', 'pto']);

  // Step 5: AI targets
  const [targetCompanies, setTargetCompanies] = useState<Company[]>([]);
  const [deselectedCompanies, setDeselectedCompanies] = useState<Set<number>>(new Set());
  const [customCompany, setCustomCompany] = useState('');
  const [selectedPortals, setSelectedPortals] = useState<Set<string>>(new Set(ALL_PORTALS));
  const [searchKeywords, setSearchKeywords] = useState<string[]>([]);
  const [customKeyword, setCustomKeyword] = useState('');
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetLoaded, setTargetLoaded] = useState(false);

  // Saving state
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  function goNext(s: Step) {
    setStep(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggle<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  const handleFileUpload = useCallback(async (file: File) => {
    setCvFilename(file.name);
    setCvLoading(true);
    setCvProgress([]);
    goNext('2t');

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    const payload = await new Promise<Record<string, string>>((resolve) => {
      const reader = new FileReader();
      if (isPdf) {
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string ?? '';
          const base64 = dataUrl.split(',')[1] ?? '';
          resolve({ base64, filename: file.name });
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = (e) => resolve({ text: e.target?.result as string ?? '', filename: file.name });
        reader.readAsText(file);
      }
    });

    setCvProgress(['parsed file · reading content…']);

    try {
      const res = await fetch('/api/settings/cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setCvSignals(data.signals);
        setCvProgress(prev => [...prev, `✓ extracted ${data.signals?.roles?.length ?? '?'} roles`, '✓ saved to your profile', '✓ ready for evaluations']);
        setTimeout(() => goNext('2b'), 800);
      } else {
        setCvProgress(prev => [...prev, '⚠ parse failed — try pasting text directly']);
      }
    } catch {
      setCvProgress(prev => [...prev, '⚠ network error — try again']);
    } finally {
      setCvLoading(false);
    }
  }, []);

  async function loadTargets() {
    setTargetLoading(true);
    try {
      const res = await fetch('/api/ai/target-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levels: selectedLevels, functions: selectedFunctions, geographies: selectedGeos, mode }),
      });
      if (res.ok) {
        const data = await res.json();
        setTargetCompanies(data.companies ?? []);
        setSelectedPortals(new Set(data.portals ?? ALL_PORTALS));
        setSearchKeywords(data.keywords ?? []);
      }
    } catch (e) {
      console.error('loadTargets:', e);
    } finally {
      setTargetLoading(false);
      setTargetLoaded(true); // always surface the UI, even if API failed (shows empty + custom add)
    }
  }

  async function savePreferencesAndComp() {
    setSaving(true);
    try {
      await fetch('/api/settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          levels: selectedLevels,
          functions: selectedFunctions,
          geographies: selectedGeos,
          floorSalaryMXN: parseInt(floorSalary) || 0,
          currency,
          salaryType,
          humanAnswer,
          baseSalaryFloor: parseInt(baseSalaryFloor) || 0,
          baseSalaryStretch: parseInt(baseSalaryStretch) || 0,
          bonusPct: skippedBonus ? null : parseFloat(bonusPct) || null,
          equityPct: skippedEquity ? null : parseFloat(equityPct) || null,
          benefits: selectedBenefits,
          targetCompanies: targetCompanies.filter((_, i) => !deselectedCompanies.has(i)).map(c => c.name),
          portals: [...selectedPortals],
          searchKeywords,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function completeOnboarding() {
    setCompleting(true);
    await savePreferencesAndComp();
    await fetch('/api/settings/onboarding', { method: 'POST' });
    // Trigger first scan then go to pipeline
    fetch('/api/scan', { method: 'POST' }).catch(() => {});
    router.push('/pipeline');
  }

  const activeIdx = STEP_LABELS.findIndex((s) => s.id === step);
  const userName = session?.user?.name?.split(' ')[0] ?? 'there';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--lm-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px 80px' }}>

      {/* Step strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '12px 20px', borderRadius: 10, border: '1px dashed var(--lm-line)', background: 'var(--lm-surface)', marginBottom: 32, maxWidth: 920, width: '100%' }}>
        {STEP_LABELS.map((s, i) => (
          <span key={String(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, border: '1px solid var(--lm-line)', background: i < activeIdx ? 'var(--lm-accent)' : i === activeIdx ? 'var(--lm-ink)' : 'var(--lm-surface)', color: i <= activeIdx ? 'white' : 'var(--lm-ink-3)', fontFamily: 'var(--font-albert-sans)', fontSize: 13, fontWeight: 500 }}>
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10, width: 18, height: 18, borderRadius: '50%', border: `1px solid ${i <= activeIdx ? 'rgba(255,255,255,0.4)' : 'var(--lm-line)'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {i < activeIdx ? '✓' : i + 1}
              </span>
              {s.label}
            </span>
            {i < STEP_LABELS.length - 1 && <span style={{ color: 'var(--lm-ink-3)', fontSize: 14 }}>→</span>}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'var(--lm-ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>~5 MIN</span>
      </div>

      <div style={{ maxWidth: 920, width: '100%' }}>

        {/* ===== STEP 1: Connect ===== */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center' }}>
            <div className="font-editorial" style={{ fontSize: 68, lineHeight: 1, color: 'var(--lm-ink)', letterSpacing: '-1.8px' }}>
              leadme<span style={{ color: 'var(--lm-accent)' }}>.</span>
            </div>
            <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 17, lineHeight: 1.6, color: 'var(--lm-ink-2)', maxWidth: 520, margin: 0 }}>
              An AI companion for the job hunt. <strong style={{ color: 'var(--lm-ink)' }}>Less noise. More signal.</strong>
            </p>
            {session ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: '12px 20px', borderRadius: 10, background: 'var(--lm-accent-soft)', fontFamily: 'var(--font-albert-sans)', fontSize: 14, color: 'var(--lm-ink)' }}>
                  ✓ Signed in as <strong>{session.user?.name}</strong> · {session.user?.email}
                </div>
                <button onClick={() => goNext('2a')} style={{ padding: '11px 24px', borderRadius: 999, background: 'var(--lm-accent)', color: 'var(--lm-accent-on)', border: 'none', fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  Continue → import your story
                </button>
              </div>
            ) : (
              <a href="/auth/signin" style={{ padding: '11px 24px', borderRadius: 999, background: 'var(--lm-accent)', color: 'var(--lm-accent-on)', border: 'none', fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
                Sign in to continue →
              </a>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {['I never message your network', 'your CV stays yours', 'no subscription dance'].map((t) => (
                <span key={t} style={{ padding: '4px 14px', borderRadius: 999, background: 'var(--lm-accent-soft)', color: 'var(--lm-accent)', fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500 }}>✓ {t}</span>
              ))}
            </div>
          </div>
        )}

        {/* ===== STEP 2A: Import ===== */}
        {step === '2a' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <ProgressBar pct={35} step="STEP 02 / 06 · IMPORT YOUR STORY" />
            <h2 className="font-editorial" style={{ fontSize: 36, lineHeight: 1.05, color: 'var(--lm-ink)', margin: 0 }}>
              {session ? `${userName}, let's add depth.` : 'Import your story.'}
            </h2>

            {/* If already parsed, show shortcut */}
            {cvSignalsRef.current && (
              <div style={{ background: 'var(--lm-accent-soft)', border: '1px solid var(--lm-accent)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14, color: 'var(--lm-ink)' }}>
                  ✓ {cvFilename} · {cvSignalsRef.current.roles.length} roles already extracted
                </span>
                <button onClick={() => { setCvSignals(cvSignalsRef.current); goNext('2b'); }} style={{ padding: '6px 16px', borderRadius: 999, background: 'var(--lm-accent)', color: 'var(--lm-accent-on)', border: 'none', fontFamily: 'var(--font-albert-sans)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  Continue with this CV →
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* LinkedIn gave */}
              <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>FROM SIGN-IN</span>
                  <span style={{ padding: '3px 11px', borderRadius: 999, background: 'var(--lm-accent-soft)', color: 'var(--lm-accent)', fontFamily: 'var(--font-albert-sans)', fontSize: 12 }}>✓ connected</span>
                </div>
                {[['name', session?.user?.name ?? '—'], ['email', session?.user?.email ?? '—']].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 12 }}>
                    <span style={{ width: 60, fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)' }}>{k}</span>
                    <span style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 14, color: 'var(--lm-ink)' }}>{v}</span>
                  </div>
                ))}
                <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-3)', margin: '4px 0 0' }}>that's all OAuth gives — by design</p>
              </div>

              {/* Import paths */}
              <div style={{ background: 'var(--lm-signal-soft)', borderRadius: 10, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14, color: 'var(--lm-signal)', fontWeight: 600 }}>✦ add the depth</span>
                <input ref={fileRef} type="file" accept=".txt,.md,.pdf,.docx" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                <div style={{ background: 'var(--lm-surface)', border: '1.5px solid var(--lm-accent)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--lm-accent-soft)', color: 'var(--lm-accent)', fontFamily: 'var(--font-albert-sans)', fontSize: 11 }}>recommended</span>
                    <strong style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14.5, color: 'var(--lm-ink)' }}>Upload CV</strong>
                    <button onClick={() => fileRef.current?.click()} style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 999, background: 'var(--lm-accent)', color: 'var(--lm-accent-on)', border: 'none', fontFamily: 'var(--font-albert-sans)', fontSize: 12, cursor: 'pointer' }}>↑ choose file</button>
                  </div>
                  <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12.5, color: 'var(--lm-ink-2)', margin: '6px 0 0' }}>richest signal — P&L scope, team size, outcomes, dates</p>
                  <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 11, color: 'var(--lm-ink-3)', margin: '4px 0 0' }}>.txt · .md · .pdf · .docx</p>
                </div>
                <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14.5, color: 'var(--lm-ink)' }}>Skip for now</strong>
                    <button onClick={() => goNext(3)} style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 999, border: '1px solid var(--lm-line)', background: 'var(--lm-surface)', fontFamily: 'var(--font-albert-sans)', fontSize: 12, cursor: 'pointer', color: 'var(--lm-ink)' }}>continue →</button>
                  </div>
                  <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12.5, color: 'var(--lm-ink-2)', margin: '6px 0 0' }}>set preferences first, add CV later from Settings</p>
                </div>
              </div>
            </div>
            <StepFooter note="your CV is stored securely and used only to tailor evaluations" onBack={() => goNext(1)} />
          </div>
        )}

        {/* ===== STEP 2T: Reading ===== */}
        {step === '2t' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center', paddingTop: 40 }}>
            <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 18, color: 'var(--lm-accent)' }}>✦ reading your CV…</div>
            <h2 className="font-editorial" style={{ fontSize: 28, color: 'var(--lm-ink)', margin: 0 }}>{cvFilename} · extracting your story</h2>
            <div style={{ width: 360, height: 8, borderRadius: 4, background: 'var(--lm-track)', overflow: 'hidden' }}>
              <div style={{ width: cvLoading ? '64%' : '100%', height: '100%', background: 'var(--lm-accent)', borderRadius: 4, transition: 'width 2s ease' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', maxWidth: 440, textAlign: 'left' }}>
              {cvProgress.map((line, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-albert-sans)', fontSize: 13.5, color: line.startsWith('✓') ? 'var(--lm-ink)' : line.startsWith('⚠') ? 'var(--lm-signal)' : 'var(--lm-ink-3)' }}>
                  <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 11, background: line.startsWith('✓') ? 'var(--lm-accent-soft)' : line.startsWith('⚠') ? 'var(--lm-signal-soft)' : 'var(--lm-canvas)', color: line.startsWith('✓') ? 'var(--lm-accent)' : line.startsWith('⚠') ? 'var(--lm-signal)' : 'var(--lm-ink-3)' }}>
                    {line.startsWith('✓') ? '✓' : line.startsWith('⚠') ? '⚠' : '…'}
                  </span>
                  {line.replace(/^[✓⚠] /, '')}
                </div>
              ))}
              {cvLoading && <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)' }}>I'm reading the whole thing, not just keywords…</div>}
            </div>
          </div>
        )}

        {/* ===== STEP 2B: Review ===== */}
        {step === '2b' && cvSignals && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <ProgressBar pct={45} step="STEP 02 / 06 · REVIEW WHAT I EXTRACTED" />
            <h2 className="font-editorial" style={{ fontSize: 36, lineHeight: 1.05, color: 'var(--lm-ink)', margin: 0 }}>
              Here&apos;s what I read. Correct anything wrong.
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ padding: '4px 14px', borderRadius: 999, background: 'var(--lm-accent-soft)', color: 'var(--lm-accent)', fontFamily: 'var(--font-albert-sans)', fontSize: 12 }}>✓ {cvFilename} · {cvSignals.roles.length} roles extracted</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px]" style={{ gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>ROLES EXTRACTED</span>
                  {cvSignals.roles.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.current ? 'var(--lm-accent)' : 'var(--lm-ink-3)', flexShrink: 0, marginTop: 5 }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 13.5, color: 'var(--lm-ink)' }}>{r.company}</span>
                        <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-2)' }}> · {r.role}</span>
                        {r.metrics[0] && <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-3)' }}>{r.metrics[0]}</div>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Unsure — now actionable */}
                {cvSignals.unsure.filter((_, i) => !dismissedUnsure.has(i)).length > 0 && (
                  <div style={{ background: 'var(--lm-signal-soft)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14, color: 'var(--lm-signal)', fontWeight: 600 }}>✦ I need your help on these</span>
                    <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12.5, color: 'var(--lm-ink-2)', margin: 0 }}>Confirm or correct — this improves scoring accuracy.</p>
                    {cvSignals.unsure.map((u, i) => {
                      if (dismissedUnsure.has(i)) return null;
                      const isEditing = editingUnsure[i];
                      return (
                        <div key={i} style={{ background: 'var(--lm-surface)', borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--lm-signal)', color: 'var(--lm-signal-on)', fontFamily: 'var(--font-albert-sans)', fontSize: 11 }}>⚠ {u.field}</span>
                            <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-2)', flex: 1 }}>
                              read &quot;{unsureEdits[i] ?? u.extracted}&quot;
                            </span>
                          </div>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <input
                                defaultValue={unsureEdits[i] ?? u.extracted}
                                onChange={(e) => setUnsureEdits(prev => ({ ...prev, [i]: e.target.value }))}
                                style={{ flex: 1, border: '1px solid var(--lm-line)', borderRadius: 6, padding: '5px 10px', fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink)', background: 'var(--lm-canvas)', outline: 'none' }}
                                autoFocus
                              />
                              <button onClick={() => setEditingUnsure(prev => ({ ...prev, [i]: false }))}
                                style={{ padding: '5px 14px', borderRadius: 999, background: 'var(--lm-accent)', color: 'var(--lm-accent-on)', border: 'none', fontFamily: 'var(--font-albert-sans)', fontSize: 12, cursor: 'pointer' }}>
                                Save
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => setDismissedUnsure(prev => new Set([...prev, i]))}
                                style={{ padding: '4px 14px', borderRadius: 999, background: 'var(--lm-accent-soft)', color: 'var(--lm-accent)', border: 'none', fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                                ✓ Looks right
                              </button>
                              <button onClick={() => setEditingUnsure(prev => ({ ...prev, [i]: true }))}
                                style={{ padding: '4px 14px', borderRadius: 999, border: '1px solid var(--lm-line)', background: 'transparent', fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-2)', cursor: 'pointer' }}>
                                ✎ Edit
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ background: 'var(--lm-accent-soft)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14, color: 'var(--lm-accent)', fontWeight: 600 }}>✦ signals derived</span>
                {cvSignals.trajectory && <div style={{ display: 'flex', gap: 8 }}><span style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--lm-accent)', color: 'var(--lm-accent-on)', fontFamily: 'var(--font-albert-sans)', fontSize: 11 }}>trajectory</span><span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12.5 }}>{cvSignals.trajectory}</span></div>}
                {cvSignals.languages.map((l) => (<div key={l} style={{ display: 'flex', gap: 8 }}><span style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--lm-accent)', color: 'var(--lm-accent-on)', fontFamily: 'var(--font-albert-sans)', fontSize: 11 }}>language</span><span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12.5 }}>{l}</span></div>))}
              </div>
            </div>
            <StepFooter note="these signals power every score and tailored CV" onBack={() => goNext('2a')} onNext={() => goNext(3)} nextLabel="Looks right → intake" />
          </div>
        )}

        {/* ===== STEP 3: Intake ===== */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <ProgressBar pct={55} step="STEP 03 / 06 · INTAKE — FILTER GATES" />
            <div>
              <h2 className="font-editorial" style={{ fontSize: 36, lineHeight: 1.05, color: 'var(--lm-ink)', margin: '0 0 6px' }}>5 fast filters.</h2>
              <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13.5, color: 'var(--lm-ink-2)', margin: 0 }}>Each answer is a gate — anything outside doesn&apos;t make the brief.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 16 }}>
              {/* Q1: Mode */}
              <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14, color: 'var(--lm-accent)', fontWeight: 600 }}>✦ your situation</span>
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: 'var(--lm-ink-3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Q 1</span>
                </div>
                <p style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 18, color: 'var(--lm-ink)', margin: 0 }}>Which mode should I run in?</p>
                {[
                  { id: 'need' as const, label: 'Need a job (soon)', desc: '2×/day · 12–15 picks · score gate 65 · broader net' },
                  { id: 'leverage' as const, label: 'Looking with leverage', desc: 'daily 8am · 5–7 picks · gate 75 · candid tone · comp filter strict' },
                  { id: 'open' as const, label: 'Open to the right thing', desc: 'weekly · 3–5 picks · gate 85 · above-band only' },
                ].map((m) => (
                  <div key={m.id} onClick={() => setMode(m.id)} style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', background: mode === m.id ? (m.id === 'need' ? 'var(--lm-signal-soft)' : m.id === 'leverage' ? 'var(--lm-accent-soft)' : 'var(--lm-canvas)') : 'var(--lm-canvas)', border: `${mode === m.id ? 2 : 1}px solid ${mode === m.id ? (m.id === 'need' ? 'var(--lm-signal)' : 'var(--lm-accent)') : 'var(--lm-line)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ padding: '3px 10px', borderRadius: 999, background: mode === m.id ? 'var(--lm-ink)' : 'var(--lm-surface)', color: mode === m.id ? 'var(--lm-bg)' : 'var(--lm-ink-3)', fontFamily: 'var(--font-albert-sans)', fontSize: 11 }}>{m.label}</span>
                      {mode === m.id && <span style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 999, background: 'var(--lm-accent-soft)', color: 'var(--lm-accent)', fontFamily: 'var(--font-albert-sans)', fontSize: 11 }}>✓ selected</span>}
                    </div>
                    <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-2)', margin: '6px 0 0', lineHeight: 1.4 }}>{m.desc}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Q2: Scope */}
                <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-accent)', fontWeight: 600 }}>✦ scope</span>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: 'var(--lm-ink-3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Q 2</span>
                  </div>
                  <p style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 16, color: 'var(--lm-ink)', margin: 0 }}>Level & scope?</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedLevels.filter(l => !DEFAULT_LEVELS.includes(l)).concat(DEFAULT_LEVELS).map((l) => (
                      <PillToggle key={l} label={l} selected={selectedLevels.includes(l)} onToggle={() => setSelectedLevels(prev => toggle(prev, l))} />
                    ))}
                    <CustomPillInput placeholder="+ add level" onAdd={(v) => setSelectedLevels(prev => [...new Set([...prev, v])])} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedFunctions.filter(f => !DEFAULT_FUNCTIONS.includes(f)).concat(DEFAULT_FUNCTIONS).map((f) => (
                      <PillToggle key={f} label={f} selected={selectedFunctions.includes(f)} onToggle={() => setSelectedFunctions(prev => toggle(prev, f))} />
                    ))}
                    <CustomPillInput placeholder="+ add function" onAdd={(v) => setSelectedFunctions(prev => [...new Set([...prev, v])])} />
                  </div>
                </div>

                {/* Q3: Geography */}
                <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-accent)', fontWeight: 600 }}>✦ geography</span>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: 'var(--lm-ink-3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Q 3</span>
                  </div>
                  <p style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 16, color: 'var(--lm-ink)', margin: 0 }}>Where do you want to work?</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedGeos.filter(g => !DEFAULT_GEOS.includes(g)).concat(DEFAULT_GEOS).map((g) => (
                      <PillToggle key={g} label={g} selected={selectedGeos.includes(g)} onToggle={() => setSelectedGeos(prev => toggle(prev, g))} />
                    ))}
                    <CustomPillInput placeholder="+ add city" onAdd={(v) => setSelectedGeos(prev => [...new Set([...prev, v])])} />
                  </div>
                </div>

                {/* Q4: Walk-away floor */}
                <div style={{ background: 'var(--lm-signal-soft)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-signal)', fontWeight: 600 }}>★ the gate</span>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: 'var(--lm-ink-3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Q 4</span>
                  </div>
                  <p style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 16, color: 'var(--lm-ink)', margin: 0 }}>Walk-away floor.</p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['MXN', 'USD'] as const).map((c) => <button key={c} onClick={() => setCurrency(c)} style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid var(--lm-line)', background: currency === c ? 'var(--lm-ink)' : 'var(--lm-surface)', color: currency === c ? 'var(--lm-bg)' : 'var(--lm-ink-2)', fontFamily: 'var(--font-albert-sans)', fontSize: 12, cursor: 'pointer' }}>{c}</button>)}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['gross', 'net'] as const).map((t) => <button key={t} onClick={() => setSalaryType(t)} style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid var(--lm-line)', background: salaryType === t ? 'var(--lm-ink)' : 'var(--lm-surface)', color: salaryType === t ? 'var(--lm-bg)' : 'var(--lm-ink-2)', fontFamily: 'var(--font-albert-sans)', fontSize: 12, cursor: 'pointer', textTransform: 'capitalize' }}>{t}</button>)}
                    </div>
                    <input type="number" value={floorSalary} onChange={(e) => setFloorSalary(e.target.value)} style={{ flex: 1, minWidth: 120, border: '1px solid var(--lm-line)', borderRadius: 8, padding: '6px 10px', fontFamily: 'var(--font-geist-mono)', fontSize: 14, background: 'var(--lm-surface)', color: 'var(--lm-ink)', outline: 'none' }} />
                  </div>
                  <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-3)', margin: 0 }}>
                    Annual {salaryType} base — I'll never show you anything below it.
                    {salaryType === 'net' && <span style={{ color: 'var(--lm-signal)' }}> I'll estimate gross for comparison (~30% effective MX rate).</span>}
                  </p>
                </div>

                {/* Q5: Human one */}
                <div style={{ background: 'var(--lm-signal-soft)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-signal)', fontWeight: 600 }}>✦ the human one</span>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: 'var(--lm-ink-3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Q 5</span>
                  </div>
                  <p style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 500, fontSize: 15, color: 'var(--lm-ink)', margin: 0 }}>In one sentence — what makes you say &quot;yes&quot; tomorrow?</p>
                  <textarea value={humanAnswer} onChange={(e) => setHumanAnswer(e.target.value)} placeholder="e.g. A role where I own the full ops org and the company treats ops as a strategic lever…" rows={3} style={{ width: '100%', border: '1px dashed var(--lm-line)', borderRadius: 8, background: 'var(--lm-surface)', padding: '8px 12px', fontFamily: 'var(--font-albert-sans)', fontSize: 13, lineHeight: 1.5, color: 'var(--lm-ink)', resize: 'none', outline: 'none' }} />
                </div>
              </div>
            </div>
            <StepFooter note="everything editable later from Settings" onBack={() => goNext('2a')} onNext={() => goNext(4)} nextLabel="Continue → build full comp picture" />
          </div>
        )}

        {/* ===== STEP 4: Total Comp ===== */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <ProgressBar pct={70} step="STEP 04 / 06 · TOTAL COMP · THE FULL PICTURE" />
            <div>
              <h2 className="font-editorial" style={{ fontSize: 36, lineHeight: 1.05, color: 'var(--lm-ink)', margin: '0 0 6px' }}>Now let&apos;s build the full picture.</h2>
              <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13.5, color: 'var(--lm-ink-2)', margin: 0 }}>So I can tell you when a recruiter&apos;s offer is real or theater.</p>
            </div>

            {/* Currency + gross/net row */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-2)' }}>All amounts are:</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['MXN', 'USD'] as const).map((c) => <button key={c} onClick={() => setCurrency(c)} style={{ padding: '4px 12px', borderRadius: 999, border: '1px solid var(--lm-line)', background: currency === c ? 'var(--lm-ink)' : 'var(--lm-surface)', color: currency === c ? 'var(--lm-bg)' : 'var(--lm-ink-2)', fontFamily: 'var(--font-albert-sans)', fontSize: 12, cursor: 'pointer' }}>{c}</button>)}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['gross', 'net'] as const).map((t) => <button key={t} onClick={() => setSalaryType(t)} style={{ padding: '4px 12px', borderRadius: 999, border: '1px solid var(--lm-line)', background: salaryType === t ? 'var(--lm-ink)' : 'var(--lm-surface)', color: salaryType === t ? 'var(--lm-bg)' : 'var(--lm-ink-2)', fontFamily: 'var(--font-albert-sans)', fontSize: 12, cursor: 'pointer', textTransform: 'capitalize' }}>{t}</button>)}
              </div>
              <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-3)' }}>annual</span>
              {salaryType === 'net' && <span style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--lm-signal-soft)', color: 'var(--lm-signal)', fontFamily: 'var(--font-albert-sans)', fontSize: 12 }}>I'll estimate gross for market comparison</span>}
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {/* Base */}
              <div style={{ flex: 1, minWidth: 240, background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>BASE SALARY · / YEAR</span>
                  <span style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--lm-ink)', color: 'var(--lm-bg)', fontFamily: 'var(--font-albert-sans)', fontSize: 11 }}>required</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'var(--lm-ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>FLOOR</div>
                    <input type="number" value={baseSalaryFloor} onChange={(e) => setBaseSalaryFloor(e.target.value)} style={{ width: '100%', border: '1px solid var(--lm-line)', borderRadius: 8, padding: '6px 10px', fontFamily: 'var(--font-geist-mono)', fontSize: 13, background: 'var(--lm-surface)', color: 'var(--lm-ink)', outline: 'none' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'var(--lm-ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>STRETCH</div>
                    <input type="number" value={baseSalaryStretch} onChange={(e) => setBaseSalaryStretch(e.target.value)} style={{ width: '100%', border: '1px solid var(--lm-line)', borderRadius: 8, padding: '6px 10px', fontFamily: 'var(--font-geist-mono)', fontSize: 13, background: 'var(--lm-surface)', color: 'var(--lm-ink)', outline: 'none' }} />
                  </div>
                </div>
                <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 11.5, color: 'var(--lm-ink-3)', margin: 0 }}>Annual {salaryType} base before taxes</p>
              </div>

              {/* Bonus */}
              <div style={{ flex: 1, minWidth: 200, background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>VARIABLE / BONUS</span>
                  <span style={{ padding: '3px 10px', borderRadius: 999, border: '1px solid var(--lm-line)', background: 'var(--lm-surface)', fontFamily: 'var(--font-albert-sans)', fontSize: 11, color: 'var(--lm-ink-3)' }}>optional</span>
                </div>
                {!skippedBonus ? (
                  <>
                    <input type="number" value={bonusPct} onChange={(e) => setBonusPct(e.target.value)} placeholder="% of annual base (e.g. 15)" style={{ width: '100%', border: '1px solid var(--lm-line)', borderRadius: 8, padding: '6px 10px', fontFamily: 'var(--font-geist-mono)', fontSize: 13, background: 'var(--lm-surface)', color: 'var(--lm-ink)', outline: 'none' }} />
                    <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 11.5, color: 'var(--lm-ink-3)', margin: 0 }}>% of annual base salary</p>
                    <button onClick={() => setSkippedBonus(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-3)', textDecoration: 'underline', textAlign: 'left' }}>skip for now</button>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)' }}>skipped ✓</span>
                    <button onClick={() => setSkippedBonus(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-accent)', textDecoration: 'underline' }}>add</button>
                  </div>
                )}
              </div>

              {/* Equity */}
              <div style={{ flex: 1, minWidth: 200, background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>EQUITY</span>
                  <span style={{ padding: '3px 10px', borderRadius: 999, border: '1px solid var(--lm-line)', background: 'var(--lm-surface)', fontFamily: 'var(--font-albert-sans)', fontSize: 11, color: 'var(--lm-ink-3)' }}>optional</span>
                </div>
                {!skippedEquity ? (
                  <>
                    <input type="number" value={equityPct} onChange={(e) => setEquityPct(e.target.value)} placeholder="% ownership (e.g. 0.15)" style={{ width: '100%', border: '1px solid var(--lm-line)', borderRadius: 8, padding: '6px 10px', fontFamily: 'var(--font-geist-mono)', fontSize: 13, background: 'var(--lm-surface)', color: 'var(--lm-ink)', outline: 'none' }} />
                    <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 11.5, color: 'var(--lm-ink-3)', margin: 0 }}>% of company ownership</p>
                    <button onClick={() => setSkippedEquity(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-3)', textDecoration: 'underline', textAlign: 'left' }}>skip for now</button>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)' }}>skipped ✓</span>
                    <button onClick={() => setSkippedEquity(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-accent)', textDecoration: 'underline' }}>add</button>
                  </div>
                )}
              </div>
            </div>

            {/* Benefits */}
            <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>BENEFITS THAT MATTER</span>
                <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-3)' }}><span style={{ color: 'var(--lm-accent)' }}>★</span> = non-negotiable · no star = nice to have</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {BENEFITS_LIST.map((b) => (
                  <button key={b.key} onClick={() => setSelectedBenefits(prev => toggle(prev, b.key))} style={{ padding: '5px 14px', borderRadius: 999, border: '1px solid var(--lm-line)', background: selectedBenefits.includes(b.key) ? (b.req ? 'var(--lm-accent-soft)' : 'var(--lm-canvas)') : 'var(--lm-surface)', color: selectedBenefits.includes(b.key) ? (b.req ? 'var(--lm-accent)' : 'var(--lm-ink)') : 'var(--lm-ink-3)', fontFamily: 'var(--font-albert-sans)', fontSize: 12, cursor: 'pointer' }}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rollup */}
            <div style={{ background: (skippedBonus || skippedEquity) ? 'var(--lm-signal-soft)' : 'var(--lm-accent-soft)', border: `2px solid ${(skippedBonus || skippedEquity) ? 'var(--lm-signal)' : 'var(--lm-accent)'}`, borderRadius: 10, padding: '18px 20px' }}>
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: (skippedBonus || skippedEquity) ? 'var(--lm-signal)' : 'var(--lm-accent)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 }}>★ TOTAL COMP TARGET</div>
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 700, fontSize: 24, color: 'var(--lm-ink)', marginBottom: 4 }}>
                {currency} {fmt(baseSalaryFloor)} – {fmt(baseSalaryStretch)} / yr
                {!skippedBonus && bonusPct && ` + ${bonusPct}% bonus`}
              </div>
              <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-3)' }}>
                Annual {salaryType} base{salaryType === 'net' ? ' · gross estimated for market comparison' : ''}
              </div>
              {(skippedBonus || skippedEquity) && (
                <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-2)', margin: '8px 0 0' }}>
                  ⚠ {[skippedBonus && 'bonus', skippedEquity && 'equity'].filter(Boolean).join(' & ')} skipped — fill in from Settings later.
                </p>
              )}
            </div>

            <StepFooter note="my market data updates as more LatAm comparables come in" onBack={() => goNext(3)} onNext={async () => { await savePreferencesAndComp(); goNext(5); }} nextLabel={saving ? 'Saving…' : 'Continue → where to look'} />
          </div>
        )}

        {/* ===== STEP 5: AI Targets ===== */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <ProgressBar pct={85} step="STEP 05 / 06 · WHERE SHOULD I LOOK FOR YOU?" />
            <div>
              <h2 className="font-editorial" style={{ fontSize: 36, lineHeight: 1.05, color: 'var(--lm-ink)', margin: '0 0 6px' }}>Where to look.</h2>
              <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13.5, color: 'var(--lm-ink-2)', margin: 0 }}>Based on your background, I&apos;ll suggest the best companies and portals.</p>
            </div>

            {!targetLoaded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  onClick={loadTargets}
                  disabled={targetLoading}
                  style={{ alignSelf: 'flex-start', padding: '10px 22px', borderRadius: 999, background: targetLoading ? 'var(--lm-line)' : 'var(--lm-accent)', color: targetLoading ? 'var(--lm-ink-3)' : 'var(--lm-accent-on)', border: 'none', fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 14, cursor: targetLoading ? 'not-allowed' : 'pointer' }}
                >
                  {targetLoading ? '✦ Analysing your background…' : '✦ Suggest companies for me'}
                </button>
                {targetLoading && <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)', margin: 0 }}>Matching your ops/fintech background to the best targets…</p>}
              </div>
            )}

            {targetLoaded && (
              <>
                {/* Companies */}
                <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>TARGET COMPANIES</span>
                    <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-3)' }}>{targetCompanies.filter((_, i) => !deselectedCompanies.has(i)).length} selected · click to deselect</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {targetCompanies.map((co, i) => {
                      const selected = !deselectedCompanies.has(i);
                      return (
                        <button key={i} onClick={() => setDeselectedCompanies(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; })}
                          title={co.why}
                          style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid var(--lm-line)', background: selected ? 'var(--lm-accent-soft)' : 'var(--lm-surface)', color: selected ? 'var(--lm-accent)' : 'var(--lm-ink-3)', fontFamily: 'var(--font-albert-sans)', fontSize: 13, fontWeight: selected ? 500 : 400, cursor: 'pointer', textDecoration: selected ? 'none' : 'line-through' }}>
                          {co.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* Add custom company */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={customCompany}
                      onChange={(e) => setCustomCompany(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customCompany.trim()) {
                          setTargetCompanies(prev => [...prev, { name: customCompany.trim(), why: 'Added manually', portal: 'Greenhouse' }]);
                          setCustomCompany('');
                        }
                      }}
                      placeholder="Add a company…"
                      style={{ flex: 1, border: '1px dashed var(--lm-line)', borderRadius: 8, padding: '6px 12px', fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink)', background: 'var(--lm-canvas)', outline: 'none' }}
                    />
                    <button onClick={() => { if (customCompany.trim()) { setTargetCompanies(prev => [...prev, { name: customCompany.trim(), why: 'Added manually', portal: 'Greenhouse' }]); setCustomCompany(''); } }}
                      style={{ padding: '6px 14px', borderRadius: 8, background: 'var(--lm-ink)', color: 'var(--lm-bg)', border: 'none', fontFamily: 'var(--font-albert-sans)', fontSize: 12, cursor: 'pointer' }}>
                      +
                    </button>
                  </div>
                </div>

                {/* Portals */}
                <div style={{ background: 'var(--lm-canvas)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>JOB PORTALS TO SCAN</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {ALL_PORTALS.map((p) => (
                      <button key={p} onClick={() => setSelectedPortals(prev => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s; })}
                        style={{ padding: '5px 14px', borderRadius: 999, border: '1px solid var(--lm-line)', background: selectedPortals.has(p) ? 'var(--lm-ink)' : 'var(--lm-surface)', color: selectedPortals.has(p) ? 'var(--lm-bg)' : 'var(--lm-ink-3)', fontFamily: 'var(--font-albert-sans)', fontSize: 12, cursor: 'pointer' }}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Keywords */}
                <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>SEARCH KEYWORDS</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {searchKeywords.map((kw, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: 'var(--lm-accent-soft)', color: 'var(--lm-accent)', fontFamily: 'var(--font-albert-sans)', fontSize: 12 }}>
                        {kw}
                        <button onClick={() => setSearchKeywords(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--lm-accent)', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input value={customKeyword} onChange={(e) => setCustomKeyword(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && customKeyword.trim()) { setSearchKeywords(prev => [...prev, customKeyword.trim()]); setCustomKeyword(''); } }}
                        placeholder="+ add keyword" style={{ border: '1px dashed var(--lm-line)', borderRadius: 8, padding: '4px 10px', fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink)', background: 'var(--lm-canvas)', outline: 'none', width: 160 }} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Skip option */}
            {!targetLoaded && (
              <button onClick={() => { setSelectedPortals(new Set(ALL_PORTALS)); setTargetLoaded(true); }} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)', cursor: 'pointer', textDecoration: 'underline' }}>
                Skip — use all portals
              </button>
            )}

            <StepFooter note="you can refine targeting anytime from Settings" onBack={() => goNext(4)} onNext={async () => { await savePreferencesAndComp(); goNext(6); }} nextLabel="Continue → preview" />
          </div>
        )}

        {/* ===== STEP 6: Preview ===== */}
        {step === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <ProgressBar pct={100} step="STEP 06 / 06 · PREVIEW" />
            <div>
              <h2 className="font-editorial" style={{ fontSize: 36, lineHeight: 1.05, color: 'var(--lm-ink)', margin: '0 0 6px' }}>
                You&apos;re all set, {userName}.
              </h2>
              <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14.5, color: 'var(--lm-ink-2)', margin: 0 }}>
                Preferences saved. I&apos;ll find your first leads right now.
              </p>
            </div>

            <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>WHAT I NOW KNOW ABOUT YOU</span>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                {[
                  ['Mode', mode === 'need' ? 'Need a job (soon)' : mode === 'open' ? 'Open to the right thing' : 'Looking with leverage'],
                  ['Score gate', mode === 'need' ? '65/100 minimum' : mode === 'open' ? '85/100 minimum' : '75/100 minimum'],
                  ['Target scope', [...selectedLevels, ...selectedFunctions].slice(0, 3).join(', ') || 'Director / VP'],
                  ['Geography', selectedGeos.slice(0, 2).join(', ') || 'CDMX / Remote'],
                  ['Walk-away floor', `${currency} ${fmt(floorSalary)} / yr ${salaryType}`],
                  ['Companies targeted', String(targetCompanies.filter((_, i) => !deselectedCompanies.has(i)).length || 'all portals')],
                  ['CV', cvSignals ? `${cvSignals.roles.length} roles extracted` : 'not uploaded yet'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: 'var(--lm-ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{k}</div>
                    <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14, color: 'var(--lm-ink)', fontWeight: 500 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px]" style={{ gap: 16 }}>
              <div style={{ background: 'var(--lm-accent-soft)', border: `2px solid var(--lm-accent)`, borderRadius: 10, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 20, color: 'var(--lm-ink)' }}>Find my first leads →</div>
                <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13.5, color: 'var(--lm-ink-2)', margin: 0, lineHeight: 1.5 }}>
                  I&apos;ll scan your target companies and portals right now. Your first brief should be ready in under a minute.
                </p>
                <button onClick={completeOnboarding} disabled={completing} style={{ alignSelf: 'flex-start', padding: '10px 22px', borderRadius: 999, background: 'var(--lm-accent)', color: 'var(--lm-accent-on)', border: 'none', fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 14, cursor: completing ? 'default' : 'pointer', opacity: completing ? 0.7 : 1 }}>
                  {completing ? '⟳ Scanning…' : 'Enter leadme. →'}
                </button>
              </div>
              <div style={{ background: 'var(--lm-canvas)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14, color: 'var(--lm-accent)', fontWeight: 600 }}>✦ my promise</span>
                <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, lineHeight: 1.55, color: 'var(--lm-ink-2)', margin: 0 }}>
                  If the first 3 evaluations aren&apos;t useful, tune from Settings. <strong style={{ color: 'var(--lm-ink)' }}>No subscription dance.</strong>
                </p>
              </div>
            </div>

            <StepFooter onBack={() => goNext(5)} />
          </div>
        )}
      </div>
    </div>
  );
}

function PillToggle({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{ padding: '4px 12px', borderRadius: 999, border: '1px solid var(--lm-line)', background: selected ? 'var(--lm-ink)' : 'var(--lm-surface)', color: selected ? 'var(--lm-bg)' : 'var(--lm-ink-2)', fontFamily: 'var(--font-albert-sans)', fontSize: 12, cursor: 'pointer' }}>
      {label}
    </button>
  );
}

function CustomPillInput({ placeholder, onAdd }: { placeholder: string; onAdd: (val: string) => void }) {
  const [val, setVal] = useState('');
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ padding: '4px 10px', borderRadius: 999, border: '1px dashed var(--lm-line)', background: 'transparent', fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-3)', cursor: 'pointer' }}>
        {placeholder}
      </button>
    );
  }
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && val.trim()) { onAdd(val.trim()); setVal(''); setOpen(false); }
          if (e.key === 'Escape') { setOpen(false); setVal(''); }
        }}
        placeholder="type + Enter"
        autoFocus
        style={{ padding: '3px 10px', borderRadius: 999, border: '1px solid var(--lm-accent)', background: 'var(--lm-surface)', fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink)', outline: 'none', width: 120 }}
      />
      <button onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(''); } setOpen(false); }} style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--lm-accent)', color: 'var(--lm-accent-on)', border: 'none', fontFamily: 'var(--font-albert-sans)', fontSize: 11, cursor: 'pointer' }}>+</button>
    </div>
  );
}

function ProgressBar({ pct, step }: { pct: number; step: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1.2px', textTransform: 'uppercase', flexShrink: 0 }}>{step}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--lm-track)', maxWidth: 280 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--lm-accent)', borderRadius: 3 }} />
      </div>
    </div>
  );
}

function StepFooter({ note, onBack, onNext, nextLabel }: { note?: string; onBack?: () => void; onNext?: () => void; nextLabel?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px dashed var(--lm-line)' }}>
      {note && <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12.5, color: 'var(--lm-ink-3)' }}>{note}</span>}
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
        {onBack && <button onClick={onBack} style={{ padding: '8px 16px', borderRadius: 999, border: 'none', background: 'transparent', fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)', cursor: 'pointer' }}>← back</button>}
        {onNext && <button onClick={onNext} style={{ padding: '9px 20px', borderRadius: 999, background: 'var(--lm-accent)', color: 'var(--lm-accent-on)', border: 'none', fontFamily: 'var(--font-albert-sans)', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>{nextLabel ?? 'Continue →'}</button>}
      </div>
    </div>
  );
}
