'use client';

import { useState, useEffect, useMemo, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

// =====================================================================
// Onboarding page — faithful port of Design/_export/Labra Onboarding.src.html
// Five steps: 1 input · 2 reading · 3 review · 4 positioning · 5 the read
// Bilingual EN/ES, light/dark theme. Skips the browser-frame and ob-shell
// chrome from the preview document — those are only for the design doc.
// =====================================================================

type OnboardingStep = 1 | 2 | 3 | 4 | 5;

interface CVRole {
  company: string;
  role: string;
  years: number;
  current: boolean;
  metrics: string[];
  // Optional richer fields the API may return — all gracefully degrade.
  seniority?: string;
  startDate?: string;
  endDate?: string;
  teamSize?: number;
  location?: string;
  industry?: string;
}

interface CVSignals {
  roles: CVRole[];
  languages: string[];
  trajectory: string;
  pageCount?: number;
  format?: string;
  isLinkedInExport?: boolean;
  outcomeCount?: number;
  unclearRoles?: number;
  yearSpan?: number;
  primaryCity?: string;
  countryCount?: number;
  industries?: string[];
  unsure: Array<{ field: string; extracted: string; confidence: string }>;
  // Synthesis produced by the career-ops engine (Claude) from the real CV.
  pattern?: string;
  patternDetail?: string;
  // Archetypes are produced by the career-ops engine (Claude) from the real
  // CV, not synthesized client-side from templates.
  archetypes?: Array<{
    id: 'core-fit' | 'stretch-up' | 'adjacent-pivot';
    type: string;
    name: string;
    description: string;
    why: string;
  }>;
}

interface Archetype {
  id: 'core-fit' | 'stretch-up' | 'adjacent-pivot';
  number: 1 | 2 | 3;
  type: string;
  name: string;
  description: string;
  why: string;
  selected: boolean;
}

// Design tokens lifted from the spec's :root + .theme-dark blocks.
const TOKENS = {
  light: {
    bg: '#f6f8f8',
    surface: '#ffffff',
    surface2: '#fafcfc',
    canvas: '#f0f4f4',
    ink: '#0a1f24',
    ink2: '#455258',
    ink3: '#889399',
    line: '#e2e7e8',
    line2: '#eef2f2',
    accent: '#0d7c89',
    accentSoft: '#d6eef0',
    accentOn: '#ffffff',
    signal: '#c97b0e',
    signalSoft: '#fbecd6',
    signalInk: '#854F0B',
  },
  dark: {
    bg: '#0a0e14',
    surface: '#1a2230',
    surface2: '#161d27',
    canvas: '#0f1620',
    ink: '#f4f6fa',
    ink2: '#c4cad6',
    ink3: '#8893a3',
    line: '#2a3543',
    line2: '#1d2630',
    accent: '#5cb1ff',
    accentSoft: '#1a2d44',
    accentOn: '#06101c',
    signal: '#ecae4d',
    signalSoft: '#382b16',
    signalInk: '#f2c987',
  },
} as const;

// ───────────────────────────────────────────────────────────────────
// Shared context. These presentational components MUST live at module
// scope (not nested in OnboardingPage) — otherwise every render creates
// new component identities, React remounts the whole subtree, inputs lose
// focus, and the page scrolls back to the top on each keystroke.
// ───────────────────────────────────────────────────────────────────
type ThemeTokens = Record<keyof typeof TOKENS.light, string>;
interface OnbCtxValue {
  c: ThemeTokens;
  lang: 'en' | 'es';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: Record<string, any>;
  compCurrency: 'USD' | 'EUR' | 'MXN' | 'CLP' | 'ARS' | 'BRL' | 'COP';
  compPeriod: 'annual' | 'monthly';
  compBasis: 'gross' | 'net';
  isMobile: boolean;
}
const OnbCtx = createContext<OnbCtxValue | null>(null);
function useOnb(): OnbCtxValue {
  const v = useContext(OnbCtx);
  if (!v) throw new Error('useOnb must be used within OnbCtx.Provider');
  return v;
}

function H1({ a, em }: { a: string; em: string }) {
  const { c } = useOnb();
  return (
    <h1
      style={{
        fontFamily: '"Fraunces", serif',
        fontWeight: 400,
        fontSize: 46,
        lineHeight: 1.08,
        letterSpacing: '-1.2px',
        color: c.ink,
        margin: 0,
      }}
    >
      {a}
      <em style={{ fontStyle: 'italic' }}>{em}</em>
    </h1>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  const { c } = useOnb();
  return (
    <p
      style={{
        fontFamily: '"Albert Sans"',
        fontSize: 15,
        lineHeight: 1.55,
        color: c.ink2,
        margin: '-4px 0 0',
        maxWidth: 620,
      }}
    >
      {children}
    </p>
  );
}

function QBlock({ children, isLast }: { children: React.ReactNode; isLast: boolean }) {
  const { c } = useOnb();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        paddingBottom: isLast ? 0 : 22,
        borderBottom: isLast ? 'none' : `0.75px solid ${c.line}`,
      }}
    >
      {children}
    </div>
  );
}

function Inference({ children }: { children: React.ReactNode }) {
  const { c } = useOnb();
  return (
    <div
      style={{
        fontFamily: '"Geist Mono", monospace',
        fontSize: 11,
        letterSpacing: '0.4px',
        color: c.ink3,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

function Prompt({ children }: { children: React.ReactNode }) {
  const { c } = useOnb();
  return (
    <div
      style={{
        fontFamily: '"Albert Sans"',
        fontWeight: 500,
        fontSize: 17,
        color: c.ink,
        lineHeight: 1.25,
      }}
    >
      {children}
    </div>
  );
}

function Helper({ children }: { children: React.ReactNode }) {
  const { c } = useOnb();
  return (
    <p
      style={{
        fontFamily: '"Albert Sans"',
        fontSize: 12.5,
        color: c.ink3,
        margin: '-4px 0 0',
      }}
    >
      {children}
    </p>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  const { c } = useOnb();
  return (
    <div
      style={{
        fontFamily: '"Geist Mono", monospace',
        fontSize: 10.5,
        color: c.ink3,
        lineHeight: 1.55,
        letterSpacing: '0.3px',
      }}
    >
      {children}
    </div>
  );
}

function PillRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>;
}

function QPill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick?: () => void;
}) {
  const { c } = useOnb();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 999,
        fontFamily: '"Albert Sans"',
        fontWeight: 500,
        fontSize: 13,
        border: `0.75px solid ${active ? c.ink : c.line}`,
        background: active ? c.ink : c.surface,
        color: active ? c.bg : c.ink2,
        cursor: 'pointer',
        transition: 'border-color .15s, background .15s',
      }}
    >
      {children}
      {active && <span style={{ fontSize: 11, opacity: 0.9 }}>✓</span>}
    </button>
  );
}

function AddRoleButton({ onAdd }: { onAdd: (r: CVRole) => void }) {
  const { c, lang, t } = useOnb();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div
        onClick={() => setOpen(true)}
        style={{
          border: `1px dashed ${c.line}`,
          borderRadius: 12,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontFamily: '"Albert Sans"',
          fontSize: 13,
          color: c.ink3,
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: `1px dashed ${c.ink3}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
          }}
        >
          +
        </span>
        <span>
          {t.s3Add}
          <span style={{ color: c.ink2, textDecoration: 'underline', textUnderlineOffset: 3 }}>
            {t.s3AddLink}
          </span>
          .
        </span>
      </div>
    );
  }
  return (
    <RoleForm
      onSave={(r) => { onAdd(r); setOpen(false); }}
      onCancel={() => setOpen(false)}
      submitLabel={lang === 'en' ? 'Add role' : 'Añadir rol'}
    />
  );
}

function RoleForm({
  initial,
  onSave,
  onCancel,
  submitLabel,
}: {
  initial?: Partial<CVRole>;
  onSave: (r: CVRole) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const { c, lang, isMobile } = useOnb();
  const thisYear = new Date().getFullYear();
  const [company, setCompany] = useState(initial?.company ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [fromYear, setFromYear] = useState(initial?.startDate ?? '');
  const [toYear, setToYear] = useState(initial?.current ? '' : (initial?.endDate ?? ''));
  const [current, setCurrent] = useState(!!initial?.current);
  const [outcome, setOutcome] = useState(initial?.metrics?.[0] ?? '');

  const commit = () => {
    const co = company.trim();
    const ro = role.trim();
    const fromN = parseInt(fromYear, 10);
    const toN = current ? thisYear : parseInt(toYear, 10);
    if (!co || !ro) { onCancel(); return; }
    const years = Number.isFinite(fromN) && Number.isFinite(toN) && toN >= fromN ? toN - fromN : 0;
    const cleanOutcome = outcome.trim();
    onSave({
      company: co,
      role: ro,
      years,
      current,
      metrics: cleanOutcome ? [cleanOutcome] : [],
      startDate: Number.isFinite(fromN) ? String(fromN) : undefined,
      endDate: current ? undefined : (Number.isFinite(toN) ? String(toN) : undefined),
    });
  };

  const fieldStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 8,
    border: `0.75px solid ${c.line}`,
    background: c.surface,
    color: c.ink,
    fontFamily: '"Albert Sans"',
    fontSize: 13,
    outline: 'none',
    minWidth: 0,
  };

  const fromN = parseInt(fromYear, 10);
  const toN = parseInt(toYear, 10);
  const allYears = Array.from({ length: 45 }, (_, i) => thisYear - i);
  const fromOptions = Number.isFinite(toN) ? allYears.filter((y) => y <= toN) : allYears;
  const toOptions = Number.isFinite(fromN) ? allYears.filter((y) => y >= fromN) : allYears;

  return (
    <div
      style={{
        border: `1px dashed ${c.line}`,
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <input
        autoFocus={!initial}
        placeholder={lang === 'en' ? 'Company' : 'Empresa'}
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        style={fieldStyle}
      />
      <input
        placeholder={lang === 'en' ? 'Role' : 'Rol'}
        value={role}
        onChange={(e) => setRole(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        style={fieldStyle}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr auto',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <select
          value={fromYear}
          onChange={(e) => setFromYear(e.target.value)}
          style={{ ...fieldStyle, appearance: 'auto' }}
        >
          <option value="">{lang === 'en' ? 'From' : 'Desde'}</option>
          {fromOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={current ? '' : toYear}
          onChange={(e) => setToYear(e.target.value)}
          disabled={current}
          style={{ ...fieldStyle, appearance: 'auto', opacity: current ? 0.5 : 1 }}
        >
          <option value="">{lang === 'en' ? 'To' : 'Hasta'}</option>
          {toOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: '"Albert Sans"',
            fontSize: 12.5,
            color: c.ink2,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            gridColumn: isMobile ? '1 / -1' : 'auto',
          }}
        >
          <input
            type="checkbox"
            checked={current}
            onChange={(e) => setCurrent(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          {lang === 'en' ? 'Current role' : 'Rol actual'}
        </label>
      </div>
      <textarea
        placeholder={lang === 'en'
          ? 'Outcome — one line, ideally with a number'
          : 'Resultado — una línea, idealmente con un número'}
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        rows={2}
        style={{
          ...fieldStyle,
          resize: 'vertical',
          fontFamily: '"Albert Sans"',
          lineHeight: 1.4,
        }}
      />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 2 }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 14px',
            background: 'transparent',
            border: 0,
            color: c.ink3,
            fontFamily: '"Geist Mono", monospace',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {lang === 'en' ? 'Cancel' : 'Cancelar'}
        </button>
        <button
          onClick={commit}
          style={{
            padding: '8px 18px',
            borderRadius: 999,
            background: c.ink,
            color: c.bg,
            border: 0,
            fontFamily: '"Albert Sans"',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function AddOwn({ onAdd }: { onAdd?: (value: string) => void }) {
  const { c, lang, t } = useOnb();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const commit = () => {
    const v = value.trim();
    if (!v) {
      setEditing(false);
      return;
    }
    onAdd?.(v);
    setValue('');
    setEditing(false);
  };

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        style={{
          fontFamily: '"Fraunces", serif',
          fontStyle: 'italic',
          fontSize: 13.5,
          color: c.ink2,
          textDecoration: 'underline',
          textDecorationColor: c.ink3,
          textUnderlineOffset: 4,
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        {t.s4Addown}
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-start', alignItems: 'center' }}>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setValue(''); setEditing(false); }
        }}
        onBlur={commit}
        placeholder={lang === 'en' ? 'Your own…' : 'El tuyo…'}
        style={{
          padding: '6px 12px',
          borderRadius: 999,
          border: `0.75px solid ${c.line}`,
          background: c.surface,
          color: c.ink,
          fontFamily: '"Albert Sans"',
          fontSize: 13,
          outline: 'none',
          minWidth: 180,
        }}
      />
    </div>
  );
}

function CompInput({
  label,
  value,
  onChange,
  accent,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  accent: boolean;
  placeholder?: string;
}) {
  const { c, lang, compCurrency, compPeriod } = useOnb();
  return (
    <div
      style={{
        background: accent ? c.surface : c.canvas,
        border: `0.75px solid ${c.line}`,
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div
        style={{
          fontFamily: '"Geist Mono", monospace',
          fontSize: 9.5,
          letterSpacing: '0.7px',
          textTransform: 'uppercase',
          color: c.ink3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: '"Albert Sans"',
          fontWeight: 600,
          fontSize: 16,
          color: c.ink,
          lineHeight: 1.1,
          display: 'flex',
          alignItems: 'baseline',
          gap: 2,
        }}
      >
        <span style={{ color: c.ink3, fontWeight: 500 }}>$</span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 0,
            outline: 'none',
            fontFamily: 'inherit',
            fontWeight: 600,
            fontSize: 16,
            color: c.ink,
            padding: 0,
            minWidth: 0,
          }}
        />
        <span style={{ color: c.ink3, fontWeight: 500, fontSize: 11.5, marginLeft: 4 }}>
          {compCurrency}
          {compPeriod === 'monthly' ? (lang === 'en' ? '/mo' : '/mes') : ''}
        </span>
      </div>
    </div>
  );
}

function Kicker({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const { c } = useOnb();
  return (
    <div
      style={{
        fontFamily: '"Geist Mono", monospace',
        fontSize: 10,
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color: c.ink3,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [step, setStep] = useState<OnboardingStep>(1);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [cvSignals, setCvSignals] = useState<CVSignals | null>(null);
  const [readingRows, setReadingRows] = useState<boolean[]>([
    false, false, false, false, false, false, false,
  ]);
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);

  // Step 4 preferences (prefilled with sensible defaults; the user can edit).
  const [seniorityPick, setSeniorityPick] = useState<string>('');
  const [searchStatus, setSearchStatus] = useState<string>('Open to the right thing');
  const [locationPick, setLocationPick] = useState<string>('');
  const [workArrangement, setWorkArrangement] = useState<string[]>(['Hybrid OK', 'Remote-first']);
  // Custom-pill additions from the AddOwn link on Step 4.
  const [extraSeniorityPills, setExtraSeniorityPills] = useState<string[]>([]);
  const [extraWorkPills, setExtraWorkPills] = useState<string[]>([]);
  // Extra roles added via the "Missing a role? Add it." link on Step 3.
  const [extraRoles, setExtraRoles] = useState<CVRole[]>([]);
  // Role indexes the user has explicitly confirmed — suppress amber on these.
  const [confirmedAmber, setConfirmedAmber] = useState<Set<number>>(new Set());
  // Per-role edit overrides (merged on top of cvSignals.roles + extraRoles).
  const [roleOverrides, setRoleOverrides] = useState<Record<number, Partial<CVRole>>>({});
  // Index of the role currently being edited inline (or null).
  const [editingRoleIdx, setEditingRoleIdx] = useState<number | null>(null);
  // Comp settings.
  const [compCurrency, setCompCurrency] = useState<'USD' | 'EUR' | 'MXN' | 'CLP' | 'ARS' | 'BRL' | 'COP'>('USD');
  const [compPeriod, setCompPeriod] = useState<'annual' | 'monthly'>('annual');
  const [compBasis, setCompBasis] = useState<'gross' | 'net'>('gross');
  const [minComp, setMinComp] = useState<string>('');
  const [targetComp, setTargetComp] = useState<string>('');
  const [narrative, setNarrative] = useState<string>('');

  // Step 5 tooltip auto-show.
  const [tipOpen, setTipOpen] = useState(false);

  // Viewport: collapse multi-column grids and trim header chrome on small screens.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const isDark = theme === 'dark';
  const c = isDark ? TOKENS.dark : TOKENS.light;

  // Signed-in email for the topbar chrome. Falls back to the design's stub.
  const signedInEmail = session?.user?.email ?? 'nacho@galgo.mx';

  // ───────────────────────────────────────────────────────────────────
  // Labels — EN + ES. Design ships EN only; ES added per product spec.
  // ───────────────────────────────────────────────────────────────────
  const labels = {
    en: {
      stepNames: ['input', 'reading', 'review', 'positioning', 'the read'],
      signOut: 'Sign out',
      // Step 1
      s1H1a: 'Let me read your career, ',
      s1H1b: "and we'll go from there.",
      s1Sub:
        "Drop your CV or your LinkedIn export. I'll extract the trajectory, you'll review what I found on the next screen, and then we start evaluating roles.",
      s1UploadTitle: 'Upload your CV or LinkedIn export',
      s1UploadDesc:
        'A regular CV works. A LinkedIn PDF export (Profile → More → Save to PDF) works too and often extracts more completely.',
      s1Mono: 'PDF · DOCX  ·  UP TO 10MB  ·  ~30 SEC TO EXTRACT',
      s1DropBold: 'Drop your file here',
      s1DropRest: ', or ',
      s1Browse: 'browse',
      s1DropSub: 'PDF or DOCX, under 10MB',
      s1LinkedIn: 'Connect LinkedIn directly',
      s1Soon: 'Coming soon',
      s1LinkedInDesc:
        'One-click sync — no upload, no review. Working with LinkedIn on expanded data access.',
      s1Privacy: 'Your CV stays private. Used to power your evaluations, not shared with anyone. ',
      s1PrivacyB: 'Delete any time from settings.',
      // Step 2
      s2H1a: 'Reading your ',
      s2H1b: 'career.',
      s2Sub: 'Pulling out the trajectory, scope, and outcomes. About thirty seconds.',
      s2CTA: 'Review what I found →',
      // Step 3
      s3H1a: "Here's how I read ",
      s3H1b: 'your career.',
      s3SubA: ' roles, ',
      s3SubB:
        " years. The bullet under each role is the outcome I'll lean on when evaluating fit. ",
      s3SubBold: 'Click any field to correct it.',
      s3LegHigh: 'HIGH CONFIDENCE',
      s3LegMed: 'MEDIUM',
      s3LegCheck: 'CHECK THIS',
      s3Add: 'Missing a role? ',
      s3AddLink: 'Add it',
      s3Back: '‹ Back',
      s3Next: 'Looks right →',
      s3NeedsAttention: (n: number) => `${n} role${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} your attention`,
      s3Current: 'Current',
      s3CheckThis: 'Check this',
      s3AddOne: 'Add one →',
      // Step 4
      s4H1a: 'Now, ',
      s4H1b: "where you're going.",
      s4Sub:
        "I've read your trajectory. A few questions about what's next — I've prefilled what I'm guessing, correct me where I'm off.",
      s4Q1: 'Looking for…',
      s4Q2: 'Where are you in this search?',
      s4Q3: 'Open to…',
      s4Q4: 'Office, hybrid, or remote?',
      s4Q5: 'Base comp — minimum and target.',
      s4Q5Help: 'Shapes what we flag as below-market. Stays private.',
      s4Q6a: 'What are you ',
      s4Q6b: 'really',
      s4Q6c: ' looking for?',
      s4Q6Help:
        "The thing a form can't capture. A specific kind of company, a problem you want to own, something you're done with. Skip if nothing comes to mind — but this is where the good matches start.",
      s4Q4Caption1: 'I read ',
      s4Q4Caption2: ' as ',
      s4Q4Caption3: '. Not quite — ',
      s4Q4CaptionLink: 'pick a different one',
      s4MinLabel: "MINIMUM I'D CONSIDER",
      s4TargetLabel: 'TARGET',
      s4Back: '‹ Back',
      s4MidNeutral: 'Fine-tune the rest in settings.',
      s4Next: 'Save & continue →',
      s4Addown: '— or describe your own',
      // Step 5
      s5H1a: "Here's ",
      s5H1b: 'the read.',
      s5Sub: 'Three shapes that fit your trajectory. Pick the ones to evaluate against.',
      s5Pattern: '★ The pattern',
      s5Shapes: '★ The three shapes',
      s5CompCtx: '★ Comp context',
      s5InUSD: 'In USD',
      s5Orient: 'Orientation',
      s5TipBody:
        'Public sources, segment context, role level. Use as a baseline, not a ceiling.',
      s5TipDismiss: 'Got it',
      s5HandoffH: 'Now we evaluate ',
      s5HandoffHEm: 'something real.',
      s5HandoffS: "Paste a recruiter DM, a job posting, or a job URL. You'll see what a full read looks like.",
      s5HandoffCTA: 'Open Evaluate →',
      s5Back: '‹ Back',
      s5MidConfirmed: (n: number) => `${n} archetype${n === 1 ? '' : 's'} confirmed · saved to your profile`,
      s5Why: 'Why this fits — ',
    },
    es: {
      stepNames: ['entrada', 'lectura', 'revisión', 'posicionamiento', 'la lectura'],
      signOut: 'Cerrar sesión',
      s1H1a: 'Déjame leer tu carrera, ',
      s1H1b: 'y seguiremos desde ahí.',
      s1Sub:
        'Suelta tu CV o tu exportación de LinkedIn. Extraeré la trayectoria, revisarás lo que encontré en la siguiente pantalla, y luego empezamos a evaluar roles.',
      s1UploadTitle: 'Sube tu CV o tu exportación de LinkedIn',
      s1UploadDesc:
        'Un CV regular funciona. Una exportación PDF de LinkedIn (Perfil → Más → Guardar como PDF) también funciona y a menudo extrae más completamente.',
      s1Mono: 'PDF · DOCX  ·  HASTA 10MB  ·  ~30 SEG PARA EXTRAER',
      s1DropBold: 'Suelta tu archivo aquí',
      s1DropRest: ', o ',
      s1Browse: 'examina',
      s1DropSub: 'PDF o DOCX, menos de 10MB',
      s1LinkedIn: 'Conectar LinkedIn directamente',
      s1Soon: 'Próximamente',
      s1LinkedInDesc:
        'Sincronización de un clic, sin subir, sin revisar. Trabajando con LinkedIn en acceso expandido a datos.',
      s1Privacy:
        'Tu CV se mantiene privado. Se usa para tus evaluaciones, no se comparte con nadie. ',
      s1PrivacyB: 'Elimínalo cuando quieras desde configuración.',
      s2H1a: 'Leyendo tu ',
      s2H1b: 'carrera.',
      s2Sub: 'Extrayendo la trayectoria, el alcance y los resultados. Unos treinta segundos.',
      s2CTA: 'Revisa lo que encontré →',
      s3H1a: 'Así leo ',
      s3H1b: 'tu carrera.',
      s3SubA: ' roles, ',
      s3SubB: ' años. El punto bajo cada rol es el resultado en el que me apoyaré al evaluar fit. ',
      s3SubBold: 'Haz clic en cualquier campo para corregirlo.',
      s3LegHigh: 'ALTA CONFIANZA',
      s3LegMed: 'MEDIA',
      s3LegCheck: 'REVISA',
      s3Add: '¿Falta un rol? ',
      s3AddLink: 'Añádelo',
      s3Back: '‹ Atrás',
      s3Next: 'Se ve bien →',
      s3NeedsAttention: (n: number) =>
        `${n} rol${n === 1 ? '' : 'es'} necesita${n === 1 ? '' : 'n'} tu atención`,
      s3Current: 'Actual',
      s3CheckThis: 'Revisa',
      s3AddOne: 'Añade uno →',
      s4H1a: 'Ahora, ',
      s4H1b: 'hacia dónde vas.',
      s4Sub:
        'He leído tu trayectoria. Unas preguntas sobre lo que sigue — he prellenado lo que estoy adivinando, corrígeme donde me equivoque.',
      s4Q1: 'Buscando…',
      s4Q2: '¿Dónde estás en esta búsqueda?',
      s4Q3: 'Abierto a…',
      s4Q4: '¿Oficina, híbrido o remoto?',
      s4Q5: 'Comp base — mínimo y objetivo.',
      s4Q5Help: 'Da forma a lo que marcamos como por debajo del mercado. Se mantiene privado.',
      s4Q6a: '¿Qué estás ',
      s4Q6b: 'realmente',
      s4Q6c: ' buscando?',
      s4Q6Help:
        'Lo que un formulario no puede capturar. Un tipo específico de empresa, un problema que quieras tener, algo de lo que estés cansado. Sáltalo si no se te ocurre nada — pero aquí empiezan los buenos matches.',
      s4Q4Caption1: 'Leo ',
      s4Q4Caption2: ' como ',
      s4Q4Caption3: '. No exactamente — ',
      s4Q4CaptionLink: 'elige otra',
      s4MinLabel: 'MÍNIMO QUE CONSIDERARÍA',
      s4TargetLabel: 'OBJETIVO',
      s4Back: '‹ Atrás',
      s4MidNeutral: 'Afina el resto en configuración.',
      s4Next: 'Guardar y continuar →',
      s4Addown: '— o describe el tuyo',
      s5H1a: 'Aquí está ',
      s5H1b: 'la lectura.',
      s5Sub: 'Tres formas que encajan con tu trayectoria. Elige contra cuáles evaluar.',
      s5Pattern: '★ El patrón',
      s5Shapes: '★ Las tres formas',
      s5CompCtx: '★ Contexto de comp',
      s5InUSD: 'En USD',
      s5Orient: 'Orientación',
      s5TipBody:
        'Fuentes públicas, contexto de segmento, nivel del rol. Úsalo como referencia, no como techo.',
      s5TipDismiss: 'Entendido',
      s5HandoffH: 'Ahora evaluamos ',
      s5HandoffHEm: 'algo real.',
      s5HandoffS: 'Pega un DM de reclutador, una oferta, o una URL de trabajo. Verás cómo se ve una lectura completa.',
      s5HandoffCTA: 'Abrir Evaluar →',
      s5Back: '‹ Atrás',
      s5MidConfirmed: (n: number) =>
        `${n} arquetipo${n === 1 ? '' : 's'} confirmado${n === 1 ? '' : 's'} · guardado en tu perfil`,
      s5Why: 'Por qué encaja — ',
    },
  };

  const t = labels[lang];

  // ───────────────────────────────────────────────────────────────────
  // Step 2 reveal animation — runs once when signals arrive.
  // STAGGER preserved from previous implementation.
  // ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 2 || !cvSignals) return;
    const STAGGER = [200, 1400, 2800, 4400, 6200, 8000, 9800];
    setReadingRows([false, false, false, false, false, false, false]);
    const timers = STAGGER.map((delay, idx) =>
      setTimeout(() => {
        setReadingRows((prev) => {
          const next = [...prev];
          next[idx] = true;
          return next;
        });
      }, delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [step, cvSignals]);

  // Step 5 — auto-show the Orientation tooltip after 1.4s, per spec.
  useEffect(() => {
    if (step !== 5) return;
    const t = setTimeout(() => setTipOpen(true), 1400);
    return () => clearTimeout(t);
  }, [step]);

  // ───────────────────────────────────────────────────────────────────
  // Archetype generation from real CV signals.
  // Derives seniority + industries from the data; falls back gracefully.
  // ───────────────────────────────────────────────────────────────────
  // Prefer the career-ops engine's archetypes (derived from the actual CV).
  // Fall back to the local template generator only if the engine returned none
  // (older payloads, parse hiccup) so the screen never renders empty.
  function archetypesFromSignals(signals: CVSignals): Archetype[] {
    const fromEngine = signals.archetypes;
    if (fromEngine && fromEngine.length) {
      return fromEngine.slice(0, 3).map((a, i) => ({
        id: a.id,
        number: (i + 1) as 1 | 2 | 3,
        type: a.type,
        name: a.name,
        description: a.description,
        why: a.why,
        selected: true,
      }));
    }
    return generateArchetypes(signals);
  }

  function generateArchetypes(signals: CVSignals): Archetype[] {
    const currentRole = signals.roles?.[0];
    const seniority = inferSeniority(currentRole);
    const nextLevelSeniority = inferNextLevel(seniority);
    const industries = inferIndustries(signals);
    const primaryIndustry = industries[0] ?? (lang === 'en' ? 'tech' : 'tech');
    const adjacentIndustry = industries[1] ?? primaryIndustry;
    const region = signals.primaryCity ? regionFromCity(signals.primaryCity) : 'LatAm';

    const roleNames = signals.roles?.slice(0, 4).map((r) => r.company).filter(Boolean);
    const whyAnchor =
      roleNames && roleNames.length
        ? roleNames.slice(0, 2).join(' & ')
        : lang === 'en'
        ? 'your trajectory'
        : 'tu trayectoria';

    return [
      {
        id: 'core-fit',
        number: 1,
        type: lang === 'en' ? 'core-fit' : 'encaje-central',
        name:
          lang === 'en'
            ? `${seniority}, Series B–C ${region} ${primaryIndustry}`
            : `${seniority}, ${primaryIndustry} Series B–C ${region}`,
        description:
          lang === 'en'
            ? `Mid-stage ${primaryIndustry}, regional scope, the function you've already run. Where you've already been.`
            : `${primaryIndustry} de etapa media, alcance regional, la función que ya has llevado. Donde ya has estado.`,
        why:
          lang === 'en'
            ? `${whyAnchor} put you in exactly this seat.`
            : `${whyAnchor} te colocan exactamente en este asiento.`,
        selected: true,
      },
      {
        id: 'stretch-up',
        number: 2,
        type: lang === 'en' ? 'stretch up' : 'estirón',
        name:
          lang === 'en'
            ? `${nextLevelSeniority}, ${region} ${adjacentIndustry} at scale`
            : `${nextLevelSeniority}, ${adjacentIndustry} ${region} a escala`,
        description:
          lang === 'en'
            ? `Series C+ ${adjacentIndustry}, multi-country, the function as an executive seat reporting to CEO or COO.`
            : `${adjacentIndustry} Series C+, multi-país, la función como asiento ejecutivo reportando a CEO o COO.`,
        why:
          lang === 'en'
            ? `Your multi-country experience taught you the regional shape; the step is title and span, not the work.`
            : `Tu experiencia multi-país te enseñó la forma regional; el paso es título y alcance, no el trabajo.`,
        selected: true,
      },
      {
        id: 'adjacent-pivot',
        number: 3,
        type: lang === 'en' ? 'adjacent pivot' : 'pivote adyacente',
        name:
          lang === 'en'
            ? `GM, ${region} launch for a global product`
            : `GM, lanzamiento ${region} para un producto global`,
        description:
          lang === 'en'
            ? `Country GM seat at a global platform entering the region. Ops-led, P&L responsibility, builder.`
            : `Asiento de GM de país en una plataforma global que entra en la región. Liderado por operaciones, responsabilidad de P&L, builder.`,
        why:
          lang === 'en'
            ? `Your launch + regional knowledge is the same muscle — you've done the country-zero work.`
            : `Tu experiencia de lanzamiento + conocimiento regional es el mismo músculo — ya has hecho el trabajo de país-cero.`,
        selected: true,
      },
    ];
  }

  function inferSeniority(role?: CVRole): string {
    if (!role) return lang === 'en' ? 'Director' : 'Director';
    const r = (role.seniority || role.role || '').toLowerCase();
    if (/\b(c[ée]o|cto|coo|cfo|chief)\b/.test(r)) return lang === 'en' ? 'Chief' : 'Chief';
    if (/\bvp|vice president\b/.test(r)) return 'VP';
    if (/head of/.test(r)) return lang === 'en' ? 'Head of' : 'Head of';
    if (/director/.test(r)) return 'Director';
    if (/manager|lead/.test(r)) return lang === 'en' ? 'Manager' : 'Manager';
    return lang === 'en' ? 'Senior' : 'Senior';
  }

  function inferNextLevel(s: string): string {
    if (s === 'Chief') return 'Chief';
    if (s === 'VP') return 'Chief';
    if (s === 'Director' || s === 'Head of') return 'VP';
    if (s === 'Manager') return 'Director';
    return 'Director';
  }

  function inferIndustries(signals: CVSignals): string[] {
    if (signals.industries && signals.industries.length) return signals.industries.slice(0, 3);
    const text = (signals.trajectory ?? '').toLowerCase();
    const candidates: string[] = [];
    if (/fintech|payments|credit|lending/.test(text)) candidates.push('fintech');
    if (/marketplace/.test(text)) candidates.push('marketplaces');
    if (/saas|b2b/.test(text)) candidates.push('SaaS');
    if (/telecom|telco/.test(text)) candidates.push('telecom');
    if (/retail|commerce|ecommerce/.test(text)) candidates.push('commerce');
    return candidates.length ? candidates : ['tech'];
  }

  function regionFromCity(city: string): string {
    const c = city.toLowerCase();
    if (/cdmx|mexico|bogot|santiago|lima|buenos|s[aã]o paulo|rio|monterrey/.test(c)) return 'LatAm';
    if (/london|berlin|paris|madrid|amsterdam|dublin/.test(c)) return 'EMEA';
    if (/singapore|tokyo|bangalore|jakarta|seoul/.test(c)) return 'APAC';
    return 'global';
  }

  // ───────────────────────────────────────────────────────────────────
  // Step 1 — upload handler (preserved from previous implementation).
  // ───────────────────────────────────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  }

  async function processFile(file: File) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();

    setUploading(true);
    setReadingRows([false, false, false, false, false, false, false]);
    setStep(2);

    const callApi = async (body: object) => {
      const res = await fetch('/api/settings/cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setCvSignals(data.signals);
        setArchetypes(archetypesFromSignals(data.signals));
      } else {
        const errBody = await res.text().catch(() => '');
        alert(`Failed to upload resume.${errBody ? ` (${res.status})` : ''} Please try again.`);
        setStep(1);
      }
      setUploading(false);
    };

    try {
      if (ext === 'pdf') {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = (event.target?.result as string).split(',')[1];
          callApi({ base64, filename: file.name });
        };
        reader.readAsDataURL(file);
      } else if (ext === 'txt' || ext === 'md') {
        const text = await file.text();
        callApi({ text, filename: file.name });
      } else if (ext === 'docx' || ext === 'doc') {
        // mammoth is a small (~75KB) browser-friendly docx→html/text extractor.
        // Dynamic import keeps it out of the initial bundle.
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const { value: text } = await mammoth.extractRawText({ arrayBuffer });
        if (!text?.trim()) {
          alert('Could not extract text from this document. Try saving as PDF.');
          setStep(1);
          setUploading(false);
          return;
        }
        callApi({ text, filename: file.name });
      } else {
        alert('Unsupported file type. Use PDF, DOCX, TXT, or MD.');
        setStep(1);
        setUploading(false);
        return;
      }
    } catch {
      alert('Error uploading resume. Please try again.');
      setStep(1);
      setUploading(false);
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────────────────
  const totalRoles = cvSignals?.roles?.length ?? 0;
  const totalYears =
    cvSignals?.yearSpan ?? cvSignals?.roles?.reduce((s, r) => s + (r.years || 0), 0) ?? 0;

  // For Step 3 — assign confidence dots: first 2 + last 2 high, middle medium,
  // Amber assignment, strictly capped at cvSignals.unclearRoles. We score each
  // role's likelihood of being the unclear one (field-mention beats no-metrics),
  // then mark the top N. Otherwise the unsure[] array can mention multiple
  // facets of a single role and the count drifts above what Step 2 reported.
  const roleConfidence = useMemo(() => {
    const roles = cvSignals?.roles ?? [];
    const budget = cvSignals?.unclearRoles ?? 0;
    if (budget === 0) {
      return roles.map((_, idx) =>
        idx < 2 || idx >= roles.length - 2 ? ('high' as const) : ('medium' as const)
      );
    }
    const unsureFields = (cvSignals?.unsure ?? [])
      .map((u) => (u.field ?? '').toLowerCase())
      .filter(Boolean);
    const scored = roles.map((r, idx) => {
      const company = (r.company ?? '').toLowerCase();
      const fieldHits = company ? unsureFields.filter((f) => f.includes(company)).length : 0;
      const noMetrics = !r.metrics || r.metrics.length === 0;
      const score = fieldHits * 10 + (noMetrics ? 1 : 0);
      return { idx, score };
    });
    const amberIndexes = new Set(
      scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, budget)
        .map((s) => s.idx)
    );
    return roles.map((_, idx) => {
      if (amberIndexes.has(idx) && !confirmedAmber.has(idx)) return 'amber' as const;
      if (idx < 2 || idx >= roles.length - 2) return 'high' as const;
      return 'medium' as const;
    });
  }, [cvSignals, confirmedAmber]);

  const amberCount = roleConfidence.filter((c) => c === 'amber').length;
  const archConfirmedCount = archetypes.filter((a) => a.selected).length;

  const primaryCity = cvSignals?.primaryCity ?? 'CDMX';
  const countryCount = cvSignals?.countryCount ?? cvSignals?.languages?.length ?? 4;
  const industries = cvSignals ? inferIndustries(cvSignals) : ['fintech', 'marketplaces'];

  // For the work arrangement caption — derive a quoted phrase from narrative
  // that mentions "remote-first" if present, otherwise use a placeholder.
  const arrangementQuote = useMemo(() => {
    const m = narrative.match(/[“"']?([^."'']*remote-?first[^."'']*)[."'']?/i);
    return m ? m[1].trim() : 'open to remote-first in fintech';
  }, [narrative]);

  function togglePill(arr: string[], val: string, setter: (v: string[]) => void) {
    if (arr.includes(val)) setter(arr.filter((v) => v !== val));
    else setter([...arr, val]);
  }

  // ───────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────
  return (
    <OnbCtx.Provider value={{ c, lang, t, compCurrency, compPeriod, compBasis, isMobile }}>
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: c.bg,
        color: c.ink,
        fontFamily: '"Albert Sans", system-ui, sans-serif',
        transition: 'background .25s, color .25s',
        overflowX: 'hidden',
      }}
    >
      {/* ─────────── Top chrome ─────────── */}
      <div
        className="sticky top-0 z-50"
        style={{
          background: c.bg,
          borderBottom: `1px solid ${c.line}`,
          padding: '14px 24px',
        }}
      >
        <div
          className="max-w-5xl mx-auto"
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16, flexWrap: 'wrap' }}>
            {/* Brand */}
            <div
              style={{
                fontFamily: '"Fraunces", serif',
                fontWeight: 500,
                fontSize: 22,
                letterSpacing: '-0.5px',
                color: c.ink,
              }}
            >
              labra
              <span style={{ color: c.accent, fontStyle: 'italic' }}>.</span>
            </div>

            {/* Step kicker */}
            <div
              style={{
                fontFamily: '"Geist Mono", monospace',
                fontSize: 11,
                letterSpacing: '0.9px',
                textTransform: 'uppercase',
                color: c.ink3,
              }}
            >
              Step <span style={{ color: c.ink, fontWeight: 600 }}>{step}</span> of 5
              {!isMobile && <> — {t.stepNames[step - 1]}</>}
            </div>

            {/* Step bars — done/current use --ink, future use --line */}
            <div style={{ display: 'flex', gap: 4, flex: 1, maxWidth: 220, minWidth: 80 }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  style={{
                    height: 3,
                    flex: 1,
                    borderRadius: 2,
                    background: s <= step ? c.ink : c.line,
                  }}
                />
              ))}
            </div>

            <div style={{ flex: 1 }} />

            {/* Theme + lang toggles */}
            <div style={{ display: 'flex', gap: 6 }}>
              <div
                style={{
                  display: 'inline-flex',
                  gap: 2,
                  padding: 4,
                  borderRadius: 999,
                  border: `1px solid ${c.line}`,
                  background: c.surface,
                }}
              >
                {(['light', 'dark'] as const).map((th) => (
                  <button
                    key={th}
                    onClick={() => setTheme(th)}
                    style={{
                      border: 0,
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: 'pointer',
                      background: theme === th ? c.ink : 'transparent',
                      color: theme === th ? c.bg : c.ink3,
                    }}
                  >
                    {th === 'light' ? 'Light' : 'Dark'}
                  </button>
                ))}
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  gap: 2,
                  padding: 4,
                  borderRadius: 999,
                  border: `1px solid ${c.line}`,
                  background: c.surface,
                }}
              >
                {(['en', 'es'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    style={{
                      border: 0,
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: 'pointer',
                      background: lang === l ? c.ink : 'transparent',
                      color: lang === l ? c.bg : c.ink3,
                    }}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Signed-in */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  paddingLeft: 12,
                  fontFamily: '"Geist Mono", monospace',
                  fontSize: 11,
                  color: c.ink3,
                }}
              >
                {!isMobile && (
                  <>
                    <span>{signedInEmail}</span>
                    <span style={{ opacity: 0.5 }}>·</span>
                  </>
                )}
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  style={{
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    color: c.ink2,
                    textDecoration: 'underline',
                    textUnderlineOffset: 2,
                  }}
                >
                  {t.signOut}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────── Page body ─────────── */}
      <div
        className="flex-1 mx-auto w-full"
        style={{
          maxWidth: step === 3 ? 920 : step === 4 || step === 5 ? 820 : 720,
          padding: '32px 24px 60px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && cvSignals && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && archetypes.length > 0 && renderStep5()}
      </div>

      {/* Global keyframes used in Step 2 reveal */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in .3s ease-out; }
        .animate-fade-up { animation: fade-up .4s ease-out forwards; opacity: 0; }
      `}</style>
    </div>
    </OnbCtx.Provider>
  );

  // ═══════════════════════════════════════════════════════════════════
  // STEP RENDERERS
  // ═══════════════════════════════════════════════════════════════════

  // ─── Step 1 ────────────────────────────────────────────────────────
  function renderStep1() {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <H1 a={t.s1H1a} em={t.s1H1b} />
        <Sub>{t.s1Sub}</Sub>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.6fr) minmax(0, 1fr)',
            gap: 16,
            marginTop: 6,
          }}
        >
          {/* Upload card (emph) */}
          <label
            style={{ cursor: 'pointer', display: 'block' }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); if (!uploading) setDragOver(true); }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!uploading) setDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
              if (uploading) return;
              const file = e.dataTransfer.files?.[0];
              if (file) void processFile(file);
            }}
          >
            <input
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={handleFileUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
            <div
              style={{
                background: dragOver ? c.canvas : c.surface,
                border: `1.5px solid ${c.ink}`,
                borderRadius: 14,
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                cursor: uploading ? 'not-allowed' : 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* glyph-tile */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 11,
                    background: c.ink,
                    color: c.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                    <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
                    <path d="M9 9h1M9 13h6M9 17h6" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: '"Albert Sans"',
                      fontWeight: 600,
                      fontSize: 15.5,
                      color: c.ink,
                      lineHeight: 1.2,
                    }}
                  >
                    {t.s1UploadTitle}
                  </div>
                  <div
                    style={{
                      fontFamily: '"Albert Sans"',
                      fontSize: 13,
                      color: c.ink2,
                      lineHeight: 1.55,
                      marginTop: 4,
                    }}
                  >
                    {t.s1UploadDesc}
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontFamily: '"Geist Mono", monospace',
                  fontSize: 10.5,
                  color: c.ink3,
                  letterSpacing: '0.7px',
                  textTransform: 'uppercase',
                }}
              >
                {t.s1Mono}
              </div>
              <div
                style={{
                  border: `1px dashed ${c.line}`,
                  borderRadius: 12,
                  background: c.canvas,
                  padding: '32px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    background: c.surface,
                    border: `1px solid ${c.line}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: c.ink2,
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 4v12" />
                    <path d="m6 10 6-6 6 6" />
                    <path d="M4 20h16" />
                  </svg>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: c.ink2 }}>
                  <b style={{ color: c.ink, fontWeight: 600 }}>
                    {uploading ? (lang === 'en' ? 'Uploading…' : 'Subiendo…') : t.s1DropBold}
                  </b>
                  {!uploading && (
                    <>
                      {t.s1DropRest}
                      <span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
                        {t.s1Browse}
                      </span>
                    </>
                  )}
                  <br />
                  <span style={{ color: c.ink3, fontSize: 12.5 }}>{t.s1DropSub}</span>
                </p>
              </div>
            </div>
          </label>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* LinkedIn (disabled) */}
            <div
              style={{
                background: c.surface,
                border: `0.75px solid ${c.line}`,
                borderRadius: 14,
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                opacity: 0.72,
                cursor: 'not-allowed',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 11,
                    background: c.canvas,
                    color: c.ink3,
                    border: `1px solid ${c.line}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 2v6" />
                    <path d="M15 2v6" />
                    <path d="M5 8h14v4a7 7 0 0 1-14 0z" />
                    <path d="M12 19v3" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontFamily: '"Albert Sans"',
                        fontWeight: 600,
                        fontSize: 15.5,
                        color: c.ink,
                      }}
                    >
                      {t.s1LinkedIn}
                    </span>
                    <span
                      style={{
                        fontFamily: '"Geist Mono", monospace',
                        fontSize: 10,
                        letterSpacing: '0.7px',
                        textTransform: 'uppercase',
                        padding: '4px 9px',
                        borderRadius: 999,
                        border: `0.75px solid ${c.line}`,
                        background: c.surface,
                        color: c.ink2,
                      }}
                    >
                      {t.s1Soon}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: '"Albert Sans"',
                      fontSize: 12.5,
                      color: c.ink2,
                      marginTop: 4,
                      lineHeight: 1.55,
                    }}
                  >
                    {t.s1LinkedInDesc}
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy strip — canvas bg, no border */}
            <div
              style={{
                background: c.canvas,
                borderRadius: 12,
                padding: '12px 16px',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                fontFamily: '"Albert Sans"',
                fontSize: 12.5,
                lineHeight: 1.55,
                color: c.ink2,
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: c.surface,
                  border: `1px solid ${c.line}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: c.ink2,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <span>
                {t.s1Privacy}
                <b style={{ color: c.ink, fontWeight: 600 }}>{t.s1PrivacyB}</b>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 2 ────────────────────────────────────────────────────────
  function renderStep2() {
    const currentRole = cvSignals?.roles?.[0];
    const priorRoles = cvSignals?.roles?.slice(1, 5).map((r) => r.company).filter(Boolean) ?? [];
    const priorRolesStr =
      priorRoles.join(', ') + ((cvSignals?.roles?.length ?? 0) > 5 ? ', …' : '');
    const outcomeCount =
      cvSignals?.outcomeCount ??
      (cvSignals?.roles ?? []).reduce((s, r) => s + (r.metrics?.length || 0), 0);
    const hasUnclear = (cvSignals?.unclearRoles ?? 0) > 0;

    // Build the rows. Each row supports bold-by-class via {b: '...'} markup.
    const rows = cvSignals
      ? [
          {
            check: 'ok' as const,
            body: (
              <>
                {lang === 'en' ? 'Read the document  ·  ' : 'Documento leído  ·  '}
                <b style={{ color: c.ink, fontWeight: 600 }}>
                  {cvSignals.pageCount ?? 2} {lang === 'en' ? 'pages' : 'páginas'}
                </b>
                {'  ·  '}
                {cvSignals.format ?? 'PDF'}
                {cvSignals.isLinkedInExport && (
                  <>
                    {'  ·  '}
                    <span style={{ color: c.ink3 }}>
                      {lang === 'en' ? 'LinkedIn export detected' : 'exportación de LinkedIn detectada'}
                    </span>
                  </>
                )}
              </>
            ),
          },
          {
            check: 'ok' as const,
            body: (
              <>
                {lang === 'en' ? 'Found the experience section  ·  ' : 'Sección de experiencia  ·  '}
                <b style={{ color: c.ink, fontWeight: 600 }}>
                  {totalRoles} {lang === 'en' ? 'roles' : 'roles'}
                </b>
                {'  ·  '}
                {totalYears} {lang === 'en' ? 'years span' : 'años de alcance'}
              </>
            ),
          },
          {
            check: 'ok' as const,
            body: (
              <>
                {lang === 'en' ? 'Pulled current role  ·  ' : 'Rol actual  ·  '}
                <b style={{ color: c.ink, fontWeight: 600 }}>
                  {currentRole
                    ? `${currentRole.company} · ${currentRole.role}${
                        currentRole.startDate ? ` · ${currentRole.startDate}` : ''
                      }`
                    : '–'}
                </b>
              </>
            ),
          },
          {
            check: 'ok' as const,
            body: (
              <>
                {lang === 'en' ? 'Pulled prior roles  ·  ' : 'Roles anteriores  ·  '}
                {priorRolesStr || '–'}
              </>
            ),
          },
          {
            check: hasUnclear ? ('amber' as const) : ('ok' as const),
            body: (
              <>
                {lang === 'en' ? 'Extracted quantified outcomes  ·  ' : 'Resultados cuantificados  ·  '}
                <b style={{ color: c.ink, fontWeight: 600 }}>
                  {outcomeCount} {lang === 'en' ? 'found' : 'encontrados'}
                </b>
                {hasUnclear && (
                  <>
                    {'  ·  '}
                    <span style={{ color: c.signalInk }}>
                      {cvSignals.unclearRoles} {lang === 'en' ? 'role' : 'rol'}
                      {(cvSignals.unclearRoles ?? 0) > 1 ? (lang === 'en' ? 's' : 'es') : ''}{' '}
                      {lang === 'en' ? 'unclear' : 'poco claro'}
                    </span>
                  </>
                )}
              </>
            ),
          },
          {
            check: 'ok' as const,
            body: (
              <>
                {lang === 'en' ? 'Inferred trajectory  ·  ' : 'Trayectoria inferida  ·  '}
                <b style={{ color: c.ink, fontWeight: 600 }}>{cvSignals.trajectory || '–'}</b>
              </>
            ),
          },
          {
            check: 'ok' as const,
            done: true,
            body: (
              <>
                {lang === 'en' ? 'Ready.' : 'Listo.'}{' '}
                <span style={{ color: c.ink }}>
                  {lang === 'en' ? 'Your turn to check my work.' : 'Tu turno para verificar mi trabajo.'}
                </span>
              </>
            ),
          },
        ]
      : [];

    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <H1 a={t.s2H1a} em={t.s2H1b} />
        <Sub>{t.s2Sub}</Sub>

        <div
          style={{
            background: c.surface,
            border: `0.75px solid ${c.line}`,
            borderRadius: 14,
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {!cvSignals ? (
            <div style={{ display: 'flex', gap: 12, padding: '12px 0', alignItems: 'center' }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: c.accent,
                  color: c.accentOn,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
                className="animate-pulse"
              >
                ⋮
              </div>
              <div style={{ fontSize: 14.5, color: c.ink2 }}>
                {lang === 'en' ? 'Analyzing your resume…' : 'Analizando tu CV…'}
              </div>
            </div>
          ) : (
            rows.map((r, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  opacity: readingRows[idx] ? 1 : 0,
                  transform: readingRows[idx] ? 'translateY(0)' : 'translateY(6px)',
                  transition: 'opacity .4s ease, transform .4s ease',
                  fontFamily: '"Albert Sans"',
                  fontSize: 14.5,
                  lineHeight: 1.5,
                  color: r.done ? c.ink : c.ink2,
                  fontWeight: r.done ? 500 : 400,
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: r.check === 'amber' ? c.signal : c.accent,
                    color: r.check === 'amber' ? c.bg : c.accentOn,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {r.check === 'amber' ? '!' : '✓'}
                </div>
                <div style={{ flex: 1 }}>{r.body}</div>
              </div>
            ))
          )}
        </div>

        {cvSignals && readingRows[6] && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }} className="animate-fade-in">
            <button
              onClick={() => setStep(3)}
              style={{
                padding: '14px 26px',
                borderRadius: 999,
                background: c.ink,
                color: c.bg,
                border: `1px solid ${c.ink}`,
                fontFamily: '"Albert Sans"',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              {t.s2CTA}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Step 3 ────────────────────────────────────────────────────────
  function renderStep3() {
    if (!cvSignals) return null;
    const baseRoles = [...(cvSignals.roles ?? []), ...extraRoles];
    const roles = baseRoles.map((r, i) => ({ ...r, ...(roleOverrides[i] ?? {}) }));
    const thisYear = new Date().getFullYear();
    // Display order: most recent first.
    //
    // Anthropic's JSON omits startDate/endDate for CV roles — it only returns
    // `years`. To merge those with user-added roles that DO have dates, we
    // synthesize an end-year for the undated ones from their position in the
    // (already-chronological) CV list, decaying by 1y per slot. That keeps the
    // CV's original order intact while letting any dated role slot in by year.
    const sortKey = (r: CVRole, fallbackIdx: number) => {
      const end = r.current ? thisYear : parseInt(r.endDate ?? '', 10);
      const start = parseInt(r.startDate ?? '', 10);
      if (Number.isFinite(end)) {
        // Dated: end year primary, start year as tiebreaker (later start wins).
        return end * 10000 + (Number.isFinite(start) ? start : 0);
      }
      // Undated CV role — synthesize from position so order matches the CV.
      return (thisYear - fallbackIdx) * 10000;
    };
    const displayOrder = roles
      .map((r, idx) => ({ idx, key: sortKey(r, idx) }))
      .sort((a, b) => b.key - a.key)
      .map((o) => o.idx);

    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <H1 a={t.s3H1a} em={t.s3H1b} />
          <p
            style={{
              fontFamily: '"Albert Sans"',
              fontSize: 15,
              lineHeight: 1.55,
              color: c.ink2,
              margin: '8px 0 0',
              maxWidth: 720,
            }}
          >
            {totalRoles}
            {t.s3SubA}
            {totalYears}
            {t.s3SubB}
            <b style={{ color: c.ink, fontWeight: 600 }}>{t.s3SubBold}</b>
          </p>
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            gap: 18,
            flexWrap: 'wrap',
            fontFamily: '"Geist Mono", monospace',
            fontSize: 10,
            color: c.ink3,
            letterSpacing: '0.4px',
          }}
        >
          <span>
            <span style={{ color: c.ink }}>●●●</span> &nbsp;{t.s3LegHigh}
          </span>
          <span>
            <span style={{ color: c.ink }}>●●○</span> &nbsp;{t.s3LegMed}
          </span>
          <span>
            <span style={{ color: c.signal }}>●○○</span> &nbsp;{t.s3LegCheck}
          </span>
        </div>

        {/* Role rows */}
        {displayOrder.map((idx, displayPos) => {
          const role = roles[idx];
          const conf = roleConfidence[idx];
          const isAmber = conf === 'amber';
          const dots = conf === 'high' ? '●●●' : conf === 'medium' ? '●●○' : '●○○';
          if (editingRoleIdx === idx) {
            return (
              <RoleForm
                key={`edit-${idx}`}
                initial={role}
                onSave={(r) => {
                  setRoleOverrides((prev) => ({ ...prev, [idx]: r }));
                  setEditingRoleIdx(null);
                  // Editing implicitly confirms — drop the amber state.
                  setConfirmedAmber((prev) => {
                    const next = new Set(prev);
                    next.add(idx);
                    return next;
                  });
                }}
                onCancel={() => setEditingRoleIdx(null)}
                submitLabel={lang === 'en' ? 'Save changes' : 'Guardar cambios'}
              />
            );
          }
          return (
            <div
              key={idx}
              className="animate-fade-up"
              style={{
                animationDelay: `${displayPos * 40}ms`,
                display: 'grid',
                gridTemplateColumns: isMobile
                  ? '56px minmax(0, 1fr) auto'
                  : '56px minmax(0, 1.6fr) minmax(0, 1fr) 100px',
                gap: isMobile ? 12 : 18,
                alignItems: 'start',
                background: isAmber ? c.signalSoft : c.surface,
                border: `0.75px solid ${isAmber ? c.signal : c.line}`,
                borderRadius: 13,
                padding: '16px 18px',
              }}
            >
              {/* role-num */}
              <div
                style={{
                  width: 56,
                  height: 56,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: '"Geist Mono", monospace',
                  fontWeight: 500,
                  fontSize: 13,
                  letterSpacing: '0.5px',
                  color: isAmber ? c.signalInk : c.ink3,
                  border: `0.75px solid ${isAmber ? c.signal : c.line}`,
                  background: isAmber ? 'rgba(255,255,255,.55)' : c.surface,
                  borderRadius: 11,
                  flexShrink: 0,
                }}
              >
                {String(displayPos + 1).padStart(2, '0')}
              </div>

              {/* meta */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: '"Albert Sans"',
                      fontWeight: 600,
                      fontSize: 16,
                      color: isAmber ? c.signalInk : c.ink,
                      lineHeight: 1.1,
                    }}
                  >
                    {role.company}
                  </span>
                  {role.current && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 11px',
                        borderRadius: 999,
                        fontFamily: '"Geist Mono", monospace',
                        fontSize: 10,
                        letterSpacing: '0.7px',
                        textTransform: 'uppercase',
                        background: c.ink,
                        color: c.bg,
                        border: `0.75px solid ${c.ink}`,
                      }}
                    >
                      {t.s3Current}
                    </span>
                  )}
                  {isAmber && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 11px',
                        borderRadius: 999,
                        fontFamily: '"Geist Mono", monospace',
                        fontSize: 10,
                        letterSpacing: '0.7px',
                        textTransform: 'uppercase',
                        background: c.signalSoft,
                        color: c.signalInk,
                        border: `0.75px solid ${c.signal}`,
                      }}
                    >
                      {t.s3CheckThis}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: '"Albert Sans"',
                    fontSize: 13.5,
                    color: isAmber ? c.signalInk : c.ink2,
                    marginTop: 3,
                  }}
                >
                  {role.role}
                  {role.seniority && (
                    <>
                      {' · '}
                      <b style={{ color: isAmber ? c.signalInk : c.ink, fontWeight: 500 }}>
                        {role.seniority}
                      </b>
                    </>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: '"Geist Mono", monospace',
                    fontSize: 10.5,
                    color: isAmber ? c.signalInk : c.ink3,
                    letterSpacing: '0.3px',
                    marginTop: 5,
                    textTransform: 'uppercase',
                  }}
                >
                  {(() => {
                    const sN = parseInt(role.startDate ?? '', 10);
                    const eN = parseInt(role.endDate ?? '', 10);
                    let dateStr = '';
                    if (Number.isFinite(sN) || Number.isFinite(eN)) {
                      const lo = Number.isFinite(sN) && Number.isFinite(eN) ? Math.min(sN, eN) : (Number.isFinite(sN) ? sN : eN);
                      const hi = Number.isFinite(sN) && Number.isFinite(eN) ? Math.max(sN, eN) : (Number.isFinite(eN) ? eN : sN);
                      const hiStr = role.current ? (lang === 'en' ? 'present' : 'presente') : String(hi);
                      dateStr = Number.isFinite(sN) && Number.isFinite(eN) && sN !== eN
                        ? `${lo} – ${hiStr}`
                        : (role.current ? `${lo} – ${hiStr}` : String(lo));
                    } else {
                      dateStr = role.years > 0
                        ? `${role.years} ${lang === 'en' ? 'yrs' : 'años'}`
                        : '—';
                    }
                    return [
                      dateStr,
                      role.teamSize ? `${lang === 'en' ? 'Team' : 'Equipo'} ${role.teamSize}` : null,
                      role.location ?? null,
                    ]
                      .filter(Boolean)
                      .join('  ·  ');
                  })()}
                </div>
              </div>

              {/* outcome callout */}
              <div
                style={{
                  borderLeft: `2px solid ${isAmber ? c.signal : c.ink}`,
                  background: isAmber ? 'rgba(255,255,255,.55)' : c.canvas,
                  padding: '10px 13px',
                  borderRadius: '0 9px 9px 0',
                  fontFamily: '"Albert Sans"',
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: isAmber ? c.signalInk : c.ink2,
                  ...(isMobile ? { gridColumn: '1 / -1' } : null),
                }}
              >
                {role.metrics?.[0] ? (
                  <span>{role.metrics[0]}</span>
                ) : isAmber ? (
                  <>
                    {lang === 'en'
                      ? "Couldn't extract a clear quantified outcome."
                      : 'No se pudo extraer un resultado cuantificado claro.'}
                  </>
                ) : (
                  <span style={{ opacity: 0.82 }}>
                    {lang === 'en' ? 'No specific outcome extracted.' : 'Sin resultado específico extraído.'}
                  </span>
                )}
                {isAmber && (
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 8,
                      borderTop: `0.5px dashed ${c.signal}`,
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      onClick={() =>
                        setConfirmedAmber((prev) => {
                          const next = new Set(prev);
                          next.add(idx);
                          return next;
                        })
                      }
                      style={{
                        padding: '7px 16px',
                        borderRadius: 999,
                        background: c.signal,
                        color: '#1a1208',
                        border: `1.5px solid ${c.signal}`,
                        fontFamily: '"Geist Mono", monospace',
                        fontSize: 11,
                        letterSpacing: '0.7px',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {lang === 'en' ? 'Looks right ✓' : 'Se ve bien ✓'}
                    </button>
                    <button
                      onClick={() => setEditingRoleIdx(idx)}
                      style={{
                        padding: '7px 16px',
                        borderRadius: 999,
                        background: 'transparent',
                        color: c.signalInk,
                        border: `1.5px solid ${c.signal}`,
                        fontFamily: '"Geist Mono", monospace',
                        fontSize: 11,
                        letterSpacing: '0.7px',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {lang === 'en' ? 'Edit role →' : 'Editar rol →'}
                    </button>
                  </div>
                )}
              </div>

              {/* confidence dots */}
              <div
                style={{
                  textAlign: 'right',
                  paddingTop: 4,
                  ...(isMobile ? { gridColumn: 3, gridRow: 1, alignSelf: 'center', paddingTop: 0 } : null),
                }}
              >
                <span
                  style={{
                    fontFamily: '"Geist Mono", monospace',
                    fontSize: 12,
                    letterSpacing: '1.5px',
                    color: isAmber ? c.signal : c.ink,
                  }}
                >
                  {dots}
                </span>
              </div>
            </div>
          );
        })}

        {/* Add row */}
        <AddRoleButton onAdd={(r) => setExtraRoles((prev) => [...prev, r])} />

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginTop: 12,
            paddingTop: 18,
            borderTop: `0.75px solid ${c.line}`,
          }}
        >
          <button
            onClick={() => setStep(2)}
            style={{
              background: 'transparent',
              border: 0,
              padding: 0,
              fontFamily: '"Albert Sans"',
              fontSize: 13.5,
              color: c.ink2,
              cursor: 'pointer',
            }}
          >
            {t.s3Back}
          </button>
          <span
            style={{
              flex: 1,
              fontFamily: '"Geist Mono", monospace',
              fontSize: 10.5,
              letterSpacing: '0.7px',
              textTransform: 'uppercase',
              color: amberCount > 0 ? c.signalInk : c.ink3,
              textAlign: 'center',
            }}
          >
            {amberCount > 0 ? t.s3NeedsAttention(amberCount) : ''}
          </span>
          <button
            onClick={() => setStep(4)}
            style={{
              padding: '12px 22px',
              borderRadius: 999,
              background: c.ink,
              color: c.bg,
              border: `1px solid ${c.ink}`,
              fontFamily: '"Albert Sans"',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {t.s3Next}
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 4 ────────────────────────────────────────────────────────
  function renderStep4() {
    const seniorityFromCV = cvSignals ? inferSeniority(cvSignals.roles?.[0]) : 'Director';
    const indStr = industries.slice(0, 2).join(' & ');

    // Currency-aware comp hint: net/gross matters everywhere, but a few LatAm
    // markets have quirks worth surfacing (Chile quotes líquido, Colombia adds
    // a prima that effectively makes ~13 monthly salaries).
    const compHint = (() => {
      const en = lang === 'en';
      const basisNote = compBasis === 'net'
        ? (en
            ? 'Enter take-home (net). '
            : 'Ingresa el neto (líquido). ')
        : (en
            ? 'Enter gross, before tax. '
            : 'Ingresa el bruto, antes de impuestos. ');
      const perCurrency: Partial<Record<typeof compCurrency, string>> = {
        CLP: en
          ? 'In Chile, offers are usually quoted líquido — toggle Net if that\'s what you mean.'
          : 'En Chile se cotiza líquido — usa Líquido si es a lo que te refieres.',
        COP: en
          ? 'In Colombia, base excludes the prima (~2 extra months) — enter base only.'
          : 'En Colombia la base excluye la prima (~2 meses extra) — ingresa solo la base.',
        MXN: en
          ? 'In Mexico, exclude aguinaldo and bonuses — enter base only.'
          : 'En México, excluye aguinaldo y bonos — ingresa solo la base.',
        ARS: en
          ? 'In Argentina, base excludes the SAC (aguinaldo) — enter base only.'
          : 'En Argentina la base excluye el SAC (aguinaldo) — ingresa solo la base.',
        BRL: en
          ? 'In Brazil, base excludes the 13º salário — enter base only.'
          : 'En Brasil la base excluye el 13º salário — ingresa solo a base.',
      };
      return basisNote + (perCurrency[compCurrency] ?? '');
    })();

    // Question 1: archetype-shaped pills derived from CV, plus user-added customs.
    // De-duplicated because industries[0] and industries[1] can match.
    const lookingForPills = Array.from(
      new Set([
        `${seniorityFromCV}, ${industries[0] ?? 'fintech'}`,
        `${seniorityFromCV}, ${industries[1] ?? industries[0] ?? 'marketplaces'}`,
        `${inferNextLevel(seniorityFromCV)}, ${industries[0] ?? 'fintech'}`,
        ...extraSeniorityPills,
      ])
    );

    const searchStatusPills =
      lang === 'en'
        ? ['Just looking — high bar', 'Open to the right thing', 'Actively searching']
        : ['Solo mirando — listón alto', 'Abierto a la opción correcta', 'Buscando activamente'];

    const locationPills =
      lang === 'en'
        ? [`${primaryCity} only`, 'Anywhere LatAm', 'LatAm + remote global', 'Open globally']
        : [`Solo ${primaryCity}`, 'Cualquier parte LatAm', 'LatAm + remoto global', 'Abierto globalmente'];

    const workPills = [
      ...(lang === 'en'
        ? ['Onsite OK', 'Hybrid OK', 'Remote-first', 'No preference']
        : ['Oficina OK', 'Híbrido OK', 'Remoto primero', 'Sin preferencia']),
      ...extraWorkPills,
    ];

    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <H1 a={t.s4H1a} em={t.s4H1b} />
          <p
            style={{
              fontFamily: '"Albert Sans"',
              fontSize: 15,
              lineHeight: 1.55,
              color: c.ink2,
              margin: '8px 0 0',
              maxWidth: 720,
            }}
          >
            {t.s4Sub}
          </p>
        </div>

        {/* Q-card: a single card with internal dividers */}
        <div
          style={{
            background: c.surface,
            border: `0.75px solid ${c.line}`,
            borderRadius: 14,
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 26,
          }}
        >
          {/* Q1 — Looking for */}
          <QBlock isLast={false}>
            <Inference>
              {lang === 'en' ? 'I read you as ' : 'Te leo como '}
              <b style={{ color: c.ink, fontWeight: 500 }}>
                {seniorityFromCV}
                {lang === 'en' ? '-level' : ''}
              </b>
              , {indStr} {lang === 'en' ? 'operator.' : 'operador.'}
            </Inference>
            <Prompt>{t.s4Q1}</Prompt>
            <PillRow>
              {lookingForPills.map((p) => (
                <QPill
                  key={p}
                  active={seniorityPick === p}
                  onClick={() => setSeniorityPick(p)}
                >
                  {p}
                </QPill>
              ))}
            </PillRow>
            <AddOwn
              onAdd={(v) => {
                setExtraSeniorityPills((prev) => (prev.includes(v) ? prev : [...prev, v]));
                setSeniorityPick(v);
              }}
            />
          </QBlock>

          {/* Q2 — Search status */}
          <QBlock isLast={false}>
            <Prompt>{t.s4Q2}</Prompt>
            <PillRow>
              {searchStatusPills.map((p) => (
                <QPill key={p} active={searchStatus === p} onClick={() => setSearchStatus(p)}>
                  {p}
                </QPill>
              ))}
            </PillRow>
          </QBlock>

          {/* Q3 — Location */}
          <QBlock isLast={false}>
            <Inference>
              {lang === 'en' ? 'Based in ' : 'Basado en '}
              <b style={{ color: c.ink, fontWeight: 500 }}>{primaryCity}</b>,{' '}
              <b style={{ color: c.ink, fontWeight: 500 }}>
                {countryCount} {lang === 'en' ? 'countries' : 'países'}
              </b>{' '}
              {lang === 'en' ? 'on the CV.' : 'en el CV.'}
            </Inference>
            <Prompt>{t.s4Q3}</Prompt>
            <PillRow>
              {locationPills.map((p) => (
                <QPill key={p} active={locationPick === p} onClick={() => setLocationPick(p)}>
                  {p}
                </QPill>
              ))}
            </PillRow>
          </QBlock>

          {/* Q4 — Work arrangement (multi-select) */}
          <QBlock isLast={false}>
            <Prompt>{t.s4Q4}</Prompt>
            <PillRow>
              {workPills.map((p) => (
                <QPill
                  key={p}
                  active={workArrangement.includes(p)}
                  onClick={() => togglePill(workArrangement, p, setWorkArrangement)}
                >
                  {p}
                </QPill>
              ))}
            </PillRow>
            <AddOwn
              onAdd={(v) => {
                setExtraWorkPills((prev) => (prev.includes(v) ? prev : [...prev, v]));
                setWorkArrangement((prev) => (prev.includes(v) ? prev : [...prev, v]));
              }}
            />
            <Caption>
              {t.s4Q4Caption1}
              <b style={{ color: c.ink, fontWeight: 500 }}>"{arrangementQuote}"</b>
              {t.s4Q4Caption2}
              <b style={{ color: c.ink, fontWeight: 500 }}>
                {lang === 'en' ? 'Remote-first' : 'Remoto primero'}
              </b>
              {t.s4Q4Caption3}
              <span style={{ textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>
                {t.s4Q4CaptionLink}
              </span>
              .
            </Caption>
          </QBlock>

          {/* Q5 — Comp */}
          <QBlock isLast={false}>
            <Prompt>{t.s4Q5}</Prompt>
            <Helper>{t.s4Q5Help}</Helper>
            {/* Currency + period controls */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <div
                style={{
                  display: 'inline-flex',
                  gap: 2,
                  padding: 3,
                  borderRadius: 999,
                  border: `0.75px solid ${c.line}`,
                  background: c.surface,
                }}
              >
                {(['USD', 'EUR', 'MXN', 'CLP', 'ARS', 'BRL', 'COP'] as const).map((cur) => (
                  <button
                    key={cur}
                    onClick={() => setCompCurrency(cur)}
                    style={{
                      border: 0,
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontFamily: '"Geist Mono", monospace',
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: '0.5px',
                      cursor: 'pointer',
                      background: compCurrency === cur ? c.ink : 'transparent',
                      color: compCurrency === cur ? c.bg : c.ink3,
                    }}
                  >
                    {cur}
                  </button>
                ))}
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  gap: 2,
                  padding: 3,
                  borderRadius: 999,
                  border: `0.75px solid ${c.line}`,
                  background: c.surface,
                }}
              >
                {(['annual', 'monthly'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCompPeriod(p)}
                    style={{
                      border: 0,
                      padding: '4px 12px',
                      borderRadius: 999,
                      fontFamily: '"Albert Sans"',
                      fontSize: 11.5,
                      fontWeight: 500,
                      cursor: 'pointer',
                      background: compPeriod === p ? c.ink : 'transparent',
                      color: compPeriod === p ? c.bg : c.ink3,
                    }}
                  >
                    {p === 'annual'
                      ? (lang === 'en' ? 'Annual' : 'Anual')
                      : (lang === 'en' ? 'Monthly' : 'Mensual')}
                  </button>
                ))}
              </div>
              {/* Gross / net basis — matters in LatAm where líquido ≠ bruto */}
              <div
                style={{
                  display: 'inline-flex',
                  gap: 2,
                  padding: 3,
                  borderRadius: 999,
                  border: `0.75px solid ${c.line}`,
                  background: c.surface,
                }}
              >
                {(['gross', 'net'] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => setCompBasis(b)}
                    style={{
                      border: 0,
                      padding: '4px 12px',
                      borderRadius: 999,
                      fontFamily: '"Albert Sans"',
                      fontSize: 11.5,
                      fontWeight: 500,
                      cursor: 'pointer',
                      background: compBasis === b ? c.ink : 'transparent',
                      color: compBasis === b ? c.bg : c.ink3,
                    }}
                  >
                    {b === 'gross'
                      ? (lang === 'en' ? 'Gross' : 'Bruto')
                      : (lang === 'en' ? 'Net' : 'Líquido')}
                  </button>
                ))}
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 12,
                maxWidth: 480,
              }}
            >
              <CompInput
                label={t.s4MinLabel}
                value={minComp}
                onChange={setMinComp}
                accent={false}
                placeholder={compPeriod === 'monthly' ? '8,000' : '120,000'}
              />
              <CompInput
                label={t.s4TargetLabel}
                value={targetComp}
                onChange={setTargetComp}
                accent={true}
                placeholder={compPeriod === 'monthly' ? '10,000' : '150,000'}
              />
            </div>
            {compHint && <Caption>{compHint}</Caption>}
          </QBlock>

          {/* Q6 — Narrative (free text) */}
          <QBlock isLast={true}>
            <Prompt>
              {t.s4Q6a}
              <em style={{ fontFamily: '"Fraunces", serif', fontStyle: 'italic', fontWeight: 500 }}>
                {t.s4Q6b}
              </em>
              {t.s4Q6c}
            </Prompt>
            <Helper>{t.s4Q6Help}</Helper>
            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder={lang === 'en'
                ? "e.g. I'm looking for operator scope at a company past the early chaos — where I can run the function end-to-end. Team small enough that I still build, not just review."
                : 'p. ej. Busco alcance de operador en una empresa que ya pasó el caos inicial — donde pueda dirigir la función de punta a punta. Un equipo lo bastante pequeño para seguir construyendo, no solo revisar.'}
              rows={4}
              style={{
                background: c.canvas,
                border: `0.75px solid ${c.line}`,
                borderRadius: 12,
                padding: '14px 16px',
                minHeight: 100,
                fontFamily: '"Albert Sans"',
                fontSize: 13.5,
                lineHeight: 1.6,
                color: c.ink2,
                fontStyle: 'italic',
                width: '100%',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </QBlock>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginTop: 12,
            paddingTop: 18,
            borderTop: `0.75px solid ${c.line}`,
          }}
        >
          <button
            onClick={() => setStep(3)}
            style={{
              background: 'transparent',
              border: 0,
              padding: 0,
              fontFamily: '"Albert Sans"',
              fontSize: 13.5,
              color: c.ink2,
              cursor: 'pointer',
            }}
          >
            {t.s4Back}
          </button>
          <span
            style={{
              flex: 1,
              fontFamily: '"Geist Mono", monospace',
              fontSize: 10.5,
              letterSpacing: '0.7px',
              textTransform: 'uppercase',
              color: c.ink3,
              textAlign: 'center',
            }}
          >
            {t.s4MidNeutral}
          </span>
          <button
            onClick={() => setStep(5)}
            style={{
              padding: '12px 22px',
              borderRadius: 999,
              background: c.ink,
              color: c.bg,
              border: `1px solid ${c.ink}`,
              fontFamily: '"Albert Sans"',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {t.s4Next}
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 5 ────────────────────────────────────────────────────────
  function renderStep5() {
    const indStr = industries.slice(0, 3).join(', ');
    const enginePattern = cvSignals?.pattern;
    const enginePatternDetail = cvSignals?.patternDetail;

    // Final, user-corrected role list (parsed roles + manually added, with
    // per-role edits applied) — same merge step 3 uses, persisted on save.
    const finalRoles = [...(cvSignals?.roles ?? []), ...extraRoles].map(
      (r, i) => ({ ...r, ...(roleOverrides[i] ?? {}) })
    );

    // Format the comp range from what the user actually entered in step 4.
    const fmtComp = (raw: string): string | null => {
      const n = Number(raw.replace(/[^0-9.]/g, ''));
      if (!Number.isFinite(n) || n <= 0) return null;
      return n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n));
    };
    const minFmt = fmtComp(minComp);
    const targetFmt = fmtComp(targetComp);
    const perSuffix = compPeriod === 'monthly' ? (lang === 'en' ? '/mo' : '/mes') : '';
    const compRange = minFmt && targetFmt
      ? `$${minFmt} – $${targetFmt}`
      : targetFmt
        ? `$${targetFmt}`
        : minFmt
          ? `$${minFmt}+`
          : (lang === 'en' ? 'Not specified' : 'Sin especificar');
    const compCurrencyLabel = `${lang === 'en' ? 'In' : 'En'} ${compCurrency}${perSuffix}${compBasis === 'net' ? (lang === 'en' ? ' · net' : ' · líquido') : ''}`;

    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <H1 a={t.s5H1a} em={t.s5H1b} />
          <p
            style={{
              fontFamily: '"Albert Sans"',
              fontSize: 15,
              lineHeight: 1.55,
              color: c.ink2,
              margin: '8px 0 0',
              maxWidth: 720,
            }}
          >
            {t.s5Sub}
          </p>
        </div>

        {/* The pattern */}
        <div
          style={{
            background: c.surface2,
            padding: '24px 28px',
            border: `0.75px solid ${c.line}`,
            borderRadius: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <Kicker>{t.s5Pattern}</Kicker>
          <p
            style={{
              fontFamily: '"Fraunces", serif',
              fontWeight: 500,
              fontSize: 28,
              lineHeight: 1.25,
              letterSpacing: '-0.5px',
              color: c.ink,
              margin: 0,
            }}
          >
            {enginePattern
              ? enginePattern
              : (
                <>
                  {lang === 'en' ? "You're an operator who scales " : 'Eres un operador que escala '}
                  <em style={{ fontStyle: 'italic' }}>{lang === 'en' ? 'by context' : 'por contexto'}</em>
                  {lang === 'en' ? ' — ' : ' — '}
                  {indStr}.
                </>
              )}
          </p>
          <p
            style={{
              fontFamily: '"Albert Sans"',
              fontSize: 14.5,
              lineHeight: 1.6,
              color: c.ink2,
              margin: 0,
              maxWidth: 660,
            }}
          >
            {enginePatternDetail
              ? enginePatternDetail
              : (
                <>
                  {lang === 'en'
                    ? `${countryCount} countries, multiple markets, ${indStr}. The scope keeps growing; the function stays consistent. That makes you durable across messy categories — `
                    : `${countryCount} países, múltiples mercados, ${indStr}. El alcance sigue creciendo; la función se mantiene. Eso te hace duradero en categorías desordenadas — `}
                  <span style={{ color: c.ink, fontWeight: 500 }}>
                    {lang === 'en'
                      ? 'and less obviously placed at companies looking for a deep functional specialist.'
                      : 'y menos obviamente colocado en empresas que buscan un especialista funcional profundo.'}
                  </span>
                </>
              )}
          </p>
        </div>

        <Kicker style={{ marginTop: 4 }}>{t.s5Shapes}</Kicker>

        {/* Three archetype cards grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
            gap: 14,
          }}
        >
          {archetypes.map((arch) => {
            const on = arch.selected;
            return (
              <div
                key={arch.id}
                onClick={() =>
                  setArchetypes((prev) =>
                    prev.map((a) => (a.id === arch.id ? { ...a, selected: !a.selected } : a))
                  )
                }
                style={{
                  background: c.surface,
                  border: on ? `1.5px solid ${c.ink}` : `0.75px solid ${c.line}`,
                  borderRadius: 14,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                {/* toggle */}
                <div
                  style={{
                    position: 'absolute',
                    top: 14,
                    right: 14,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: on ? c.ink : 'transparent',
                    color: on ? c.bg : 'transparent',
                    border: on ? 'none' : `1.2px solid ${c.line}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  ✓
                </div>
                <div
                  style={{
                    fontFamily: '"Geist Mono", monospace',
                    fontSize: 10,
                    letterSpacing: '0.7px',
                    color: c.ink3,
                    textTransform: 'uppercase',
                  }}
                >
                  {lang === 'en' ? 'Archetype' : 'Arquetipo'} {String(arch.number).padStart(2, '0')} ·{' '}
                  {arch.type}
                </div>
                <div
                  style={{
                    fontFamily: '"Fraunces", serif',
                    fontWeight: 500,
                    fontSize: 19,
                    lineHeight: 1.2,
                    color: c.ink,
                    letterSpacing: '-0.35px',
                    paddingRight: 34,
                  }}
                >
                  {arch.name}
                </div>
                <div
                  style={{
                    fontFamily: '"Albert Sans"',
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: c.ink2,
                  }}
                >
                  {arch.description}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    paddingTop: 10,
                    borderTop: `0.5px solid ${c.line}`,
                    fontFamily: '"Fraunces", serif',
                    fontStyle: 'italic',
                    fontSize: 12.5,
                    lineHeight: 1.45,
                    color: c.ink3,
                  }}
                >
                  {t.s5Why}
                  {arch.why}
                </div>
              </div>
            );
          })}
        </div>

        {/* Comp strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.6fr) minmax(0, 1fr)',
            border: `0.75px solid ${c.line}`,
            borderRadius: 13,
            // overflow: visible (not hidden) so the orientation tooltip can pop
            // outside the strip without being clipped. Inner cells get explicit
            // corner radii below to keep the rounded look.
            background: c.surface,
          }}
        >
          <div
            style={{
              padding: '18px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <Kicker>{t.s5CompCtx}</Kicker>
            <div
              style={{
                fontFamily: '"Geist Mono", monospace',
                fontWeight: 500,
                fontSize: 22,
                color: c.ink,
                letterSpacing: '-0.4px',
                lineHeight: 1.1,
              }}
            >
              {compRange}{perSuffix}
            </div>
            <div
              style={{
                fontFamily: '"Albert Sans"',
                fontSize: 12.5,
                lineHeight: 1.55,
                color: c.ink2,
                maxWidth: 400,
              }}
            >
              {lang === 'en'
                ? "A reference, not an anchor. We'll sharpen as peers in your segment contribute outcome data."
                : 'Una referencia, no un anclaje. Afinaremos a medida que los pares en tu segmento contribuyan datos.'}
            </div>
          </div>
          <div
            style={{
              background: c.canvas,
              padding: '18px 22px',
              [isMobile ? 'borderTop' : 'borderLeft']: `0.75px solid ${c.line}`,
              borderRadius: isMobile ? '0 0 12px 12px' : '0 12px 12px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <Kicker>{compCurrencyLabel}</Kicker>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  gap: 8,
                  fontFamily: '"Geist Mono", monospace',
                  fontSize: 11,
                  letterSpacing: '0.5px',
                  color: c.ink3,
                }}
              >
                <span style={{ color: c.ink3, fontSize: 12, letterSpacing: '1.5px' }}>○○○</span>
                <span
                  onClick={() => setTipOpen(true)}
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.9px',
                    borderBottom: `0.5px dotted ${c.ink3}`,
                    paddingBottom: 1,
                    cursor: 'help',
                  }}
                >
                  {t.s5Orient}
                </span>
              </span>
              {tipOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    bottom: 'calc(100% + 10px)',
                    width: 'min(280px, calc(100vw - 48px))',
                    background: c.ink,
                    color: c.bg,
                    borderRadius: 11,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    boxShadow: '0 12px 32px -10px rgba(0,0,0,.35)',
                    zIndex: 4,
                  }}
                >
                  <div
                    style={{
                      fontFamily: '"Geist Mono", monospace',
                      fontSize: 10,
                      letterSpacing: '0.9px',
                      textTransform: 'uppercase',
                      color: c.ink3,
                      opacity: 0.85,
                    }}
                  >
                    {t.s5Orient}
                  </div>
                  <div
                    style={{
                      fontFamily: '"Albert Sans"',
                      fontSize: 12.5,
                      lineHeight: 1.55,
                    }}
                  >
                    {t.s5TipBody}
                  </div>
                  <button
                    onClick={() => setTipOpen(false)}
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: 2,
                      fontFamily: '"Geist Mono", monospace',
                      fontSize: 10.5,
                      color: c.bg,
                      textDecoration: 'underline',
                      textUnderlineOffset: 2,
                      background: 'transparent',
                      border: 0,
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    {t.s5TipDismiss}
                  </button>
                  <span
                    style={{
                      content: '""',
                      position: 'absolute',
                      top: '100%',
                      right: 30,
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: `6px solid ${c.ink}`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Handoff */}
        <div
          style={{
            background: c.accentSoft,
            borderRadius: 14,
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: '"Fraunces", serif',
                fontWeight: 500,
                fontSize: 19,
                color: c.ink,
                lineHeight: 1.2,
              }}
            >
              {t.s5HandoffH}
              <em style={{ fontStyle: 'italic' }}>{t.s5HandoffHEm}</em>
            </div>
            <div
              style={{
                fontFamily: '"Albert Sans"',
                fontSize: 13,
                color: c.ink2,
                lineHeight: 1.5,
                marginTop: 4,
              }}
            >
              {t.s5HandoffS}
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                const selectedArchetype = archetypes.find((a) => a.selected)?.id;
                await fetch('/api/onboarding/save', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    cvSignals,
                    roles: finalRoles,
                    seniorityPick,
                    searchStatus,
                    locationPick,
                    workArrangement,
                    compCurrency,
                    compPeriod,
                    compBasis,
                    minComp,
                    targetComp,
                    narrative,
                    archetype: selectedArchetype,
                  }),
                });
              } catch {
                // Persistence failed — still mark complete so the user isn't
                // trapped re-onboarding. The gate falls back to cv_content.
                try { await fetch('/api/settings/onboarding', { method: 'POST' }); } catch {}
              }
              router.push('/evaluate');
            }}
            style={{
              padding: '14px 26px',
              borderRadius: 999,
              background: c.accent,
              color: c.accentOn,
              border: `1px solid ${c.accent}`,
              fontFamily: '"Albert Sans"',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            {t.s5HandoffCTA}
          </button>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginTop: 12,
            paddingTop: 18,
            borderTop: `0.75px solid ${c.line}`,
          }}
        >
          <button
            onClick={() => setStep(4)}
            style={{
              background: 'transparent',
              border: 0,
              padding: 0,
              fontFamily: '"Albert Sans"',
              fontSize: 13.5,
              color: c.ink2,
              cursor: 'pointer',
            }}
          >
            {t.s5Back}
          </button>
          <span
            style={{
              flex: 1,
              fontFamily: '"Geist Mono", monospace',
              fontSize: 10.5,
              letterSpacing: '0.7px',
              textTransform: 'uppercase',
              color: c.ink3,
              textAlign: 'center',
            }}
          >
            {t.s5MidConfirmed(archConfirmedCount)}
          </span>
        </div>
      </div>
    );
  }

}
