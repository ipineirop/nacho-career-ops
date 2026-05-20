'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type OnboardingStep = 1 | 2 | 3 | 4 | 5;

interface CVSignals {
  roles: Array<{ company: string; role: string; years: number; current: boolean; metrics: string[] }>;
  languages: string[];
  trajectory: string;
  unsure: Array<{ field: string; extracted: string; confidence: string }>;
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

export default function OnboardingPage() {
  const router = useRouter();
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [step, setStep] = useState<OnboardingStep>(1);
  const [uploading, setUploading] = useState(false);
  const [cvSignals, setCvSignals] = useState<CVSignals | null>(null);
  const [cvPreview, setCvPreview] = useState<string>('');
  const [showingLoadingPhase, setShowingLoadingPhase] = useState(false);
  const [readingRows, setReadingRows] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [animationStarted, setAnimationStarted] = useState(false);

  // Step 4 preferences
  const [seniority, setSeniority] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [location, setLocation] = useState('');
  const [workArrangement, setWorkArrangement] = useState<string[]>([]);
  const [minComp, setMinComp] = useState('');
  const [targetComp, setTargetComp] = useState('');
  const [narrative, setNarrative] = useState('');
  const isDark = theme === 'dark';

  const labels = {
    en: {
      title: 'Set up in five steps.',
      subtitle: "From blank slate to your first evaluation, you're ready in under 5 minutes.",
      step1: 'Upload your resume',
      step2: 'Review what we found',
      step3: "Here's how I read your career.",
      step3Sub: 'Review or correct any role below.',
      step4: "Now, where you're going.",
      step4Sub: "I've prefilled based on your CV.",
      step5: "You're ready",
      uploadDesc: "PDF or plain text. We'll parse your experience automatically.",
      dropZone: 'Drop your file here',
      browse: 'browse',
      uploadFormat: 'PDF or DOCX, under 10MB',
      chooseFile: 'Choose file',
      uploading: 'Uploading...',
      lookingFor: 'Looking for…',
      searchStatus: 'Where are you in this search?',
      openTo: 'Open to…',
      compLabel: 'Base comp (USD) — minimum and target',
      narrative: "What are you really looking for?",
      narrativeHelper: "A specific kind of company, a problem you want to own, something you're done with.",
      next: 'Next',
      back: 'Back',
      skip: 'Skip',
    },
    es: {
      title: "Configura en cinco pasos.",
      subtitle: "De la pizarra en blanco a tu primera evaluación, estás listo en menos de 5 minutos.",
      step1: "Sube tu CV",
      step2: "Revisa lo que encontramos",
      step3: "Así leo tu carrera.",
      step3Sub: "Revisa o corrige cualquier rol.",
      step4: "Ahora, hacia dónde vas.",
      step4Sub: "He completado el formulario según tu CV.",
      step5: "Estás listo",
      uploadDesc: "PDF o texto plano. Analizaremos tu experiencia automáticamente.",
      dropZone: "Suelta tu archivo aquí",
      browse: "examina",
      uploadFormat: "PDF o DOCX, menos de 10MB",
      chooseFile: "Selecciona archivo",
      uploading: "Subiendo...",
      lookingFor: "Buscando…",
      searchStatus: "¿Dónde estás en esta búsqueda?",
      openTo: "Abierto a…",
      compLabel: "Comp base (USD) — mínimo y objetivo",
      narrative: "¿Qué estás realmente buscando?",
      narrativeHelper: "Un tipo específico de empresa, un problema que quieras resolver, algo de lo que estés cansado.",
      next: "Siguiente",
      back: "Atrás",
      skip: "Omitir",
    },
  };

  const t = labels[lang];

  // Animation loop for Step 2 - matches design (runs every 14 seconds)
  useEffect(() => {
    if (step !== 2) return;

    const STAGGER = [200, 1400, 2800, 4400, 6200, 8000, 9800];

    function runAnimation() {
      setReadingRows([false, false, false, false, false, false, false]);
      STAGGER.forEach((delay, idx) => {
        setTimeout(() => {
          setReadingRows((prev) => {
            const newRows = [...prev];
            newRows[idx] = true;
            return newRows;
          });
        }, delay);
      });
    }

    // Run immediately
    runAnimation();

    // Loop every 14 seconds
    const interval = setInterval(runAnimation, 14000);
    return () => clearInterval(interval);
  }, [step]);

  function generateArchetypes(signals: CVSignals): Archetype[] {
    const archs: Archetype[] = [
      {
        id: 'core-fit',
        number: 1,
        type: lang === 'en' ? 'core-fit' : 'encaje-central',
        name: lang === 'en'
          ? 'Head of Ops, Series B–C LatAm fintech'
          : 'Head of Ops, fintech Series B–C LatAm',
        description: lang === 'en'
          ? "Mid-stage fintech, regional scope, ops touching credit, payments, or origination. Where you've already been."
          : 'Fintech de etapa media, alcance regional, ops tocando crédito, pagos u originación. Donde ya has estado.',
        why: lang === 'en'
          ? 'Your current and past roles at fintech companies align perfectly with this archetype.'
          : 'Tus roles actuales y pasados en empresas fintech se alinean perfectamente con este arquetipo.',
        selected: true,
      },
      {
        id: 'stretch-up',
        number: 2,
        type: lang === 'en' ? 'stretch up' : 'estirón',
        name: lang === 'en'
          ? 'VP Operations, LatAm marketplace at scale'
          : 'VP Operaciones, marketplace LatAm a escala',
        description: lang === 'en'
          ? 'Series C+ marketplace, multi-country, ops as an executive function reporting to CEO or COO.'
          : 'Marketplace Series C+, multi-país, ops como función ejecutiva reportando a CEO o COO.',
        why: lang === 'en'
          ? 'Your experience scaling operations across multiple countries positions you for this growth step.'
          : 'Tu experiencia escalando operaciones en múltiples países te posiciona para este paso de crecimiento.',
        selected: true,
      },
      {
        id: 'adjacent-pivot',
        number: 3,
        type: lang === 'en' ? 'adjacent pivot' : 'pivote adyacente',
        name: lang === 'en'
          ? 'GM, LatAm launch for a global product'
          : 'GM, lanzamiento LatAm para un producto global',
        description: lang === 'en'
          ? "Country GM seat at a global platform entering the region. Ops-led, P&L responsibility, builder."
          : 'Puesto de GM de país en una plataforma global que entra en la región. Operativa, responsabilidad P&L, builder.',
        why: lang === 'en'
          ? 'Your launch experience and regional knowledge make this a natural next step.'
          : 'Tu experiencia de lanzamiento y conocimiento regional hacen esto un paso natural.',
        selected: true,
      },
    ];
    return archs;
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setShowingLoadingPhase(true);
    setReadingRows([false, false, false, false, false, false, false]);
    setStep(2); // Move to step 2 IMMEDIATELY

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        const res = await fetch('/api/settings/cv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, filename: file.name }),
        });
        if (res.ok) {
          const data = await res.json();
          setCvSignals(data.signals);
          setCvPreview(data.preview);

          // Generate archetypes based on CV signals
          const generatedArchetypes = generateArchetypes(data.signals);
          setArchetypes(generatedArchetypes);

          // Show actual data after animation completes
          setTimeout(() => {
            setShowingLoadingPhase(false);
          }, 10500);
        } else {
          alert('Failed to upload resume. Please try again.');
          setStep(1); // Go back to step 1 on error
          setShowingLoadingPhase(false);
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      alert('Error uploading resume. Please try again.');
      setStep(1); // Go back to step 1 on error
      setShowingLoadingPhase(false);
      setUploading(false);
    }
  }

  function handleNext() {
    if (step < 5) {
      setStep((step + 1) as OnboardingStep);
    } else {
      router.push('/dashboard');
    }
  }

  function handleBack() {
    if (step > 1) {
      setStep((step - 1) as OnboardingStep);
    }
  }

  return (
    <div
      className="min-h-screen transition-colors duration-250 flex flex-col"
      style={{
        background: isDark ? '#0a0e14' : '#f6f8f8',
        color: isDark ? '#f4f6fa' : '#0a1f24',
      }}
    >
      {/* Top Navigation */}
      <div className="sticky top-0 z-50 border-b" style={{ background: isDark ? '#0a0e14' : '#f6f8f8', borderColor: isDark ? '#2a3543' : '#e2e7e8' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 sm:px-8 w-full">
          <div className="flex items-center justify-between mb-4">
            <div className="font-serif text-2xl font-500 tracking-tight">
              labra<span style={{ color: isDark ? '#5cb1ff' : '#0d7c89', fontStyle: 'italic' }}>.</span>
            </div>
            <div className="flex gap-2">
              <div className="flex gap-1 p-1 rounded-full inline-flex" style={{ background: isDark ? '#1a2230' : '#ffffff', border: `1px solid ${isDark ? '#2a3543' : '#e2e7e8'}` }}>
                <button onClick={() => setTheme('light')} className="px-3 py-1 rounded-full text-xs font-500 transition-all" style={{ background: theme === 'light' ? (isDark ? '#f4f6fa' : '#0a1f24') : 'transparent', color: theme === 'light' ? (isDark ? '#0a0e14' : '#f6f8f8') : isDark ? '#8893a3' : '#889399' }}>Light</button>
                <button onClick={() => setTheme('dark')} className="px-3 py-1 rounded-full text-xs font-500 transition-all" style={{ background: theme === 'dark' ? (isDark ? '#f4f6fa' : '#0a1f24') : 'transparent', color: theme === 'dark' ? (isDark ? '#0a0e14' : '#f6f8f8') : isDark ? '#8893a3' : '#889399' }}>Dark</button>
              </div>
              <div className="flex gap-1 p-1 rounded-full inline-flex" style={{ background: isDark ? '#1a2230' : '#ffffff', border: `1px solid ${isDark ? '#2a3543' : '#e2e7e8'}` }}>
                <button onClick={() => setLang('en')} className="px-3 py-1 rounded-full text-xs font-500 transition-all" style={{ background: lang === 'en' ? (isDark ? '#f4f6fa' : '#0a1f24') : 'transparent', color: lang === 'en' ? (isDark ? '#0a0e14' : '#f6f8f8') : isDark ? '#8893a3' : '#889399' }}>EN</button>
                <button onClick={() => setLang('es')} className="px-3 py-1 rounded-full text-xs font-500 transition-all" style={{ background: lang === 'es' ? (isDark ? '#f4f6fa' : '#0a1f24') : 'transparent', color: lang === 'es' ? (isDark ? '#0a0e14' : '#f6f8f8') : isDark ? '#8893a3' : '#889399' }}>ES</button>
              </div>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-3">
            <div className="font-mono text-xs uppercase tracking-widest" style={{ color: isDark ? '#8893a3' : '#889399' }}>
              Step <span style={{ color: isDark ? '#f4f6fa' : '#0a1f24' }}>{step}</span> of 5
            </div>
            <div className="flex gap-1 flex-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className="h-1 flex-1 rounded" style={{ background: s <= step ? (isDark ? '#5cb1ff' : '#0d7c89') : (isDark ? '#2a3543' : '#e2e7e8') }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 sm:px-8 sm:py-12">
        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h1 className="font-serif text-4xl sm:text-5xl font-400 mb-4" style={{ color: isDark ? '#f4f6fa' : '#0a1f24' }}>
              {lang === 'en' ? "Let me read your career, " : 'Déjame leer tu carrera, '}<em>{lang === 'en' ? "and we'll go from there." : 'y seguiremos desde ahí.'}</em>
            </h1>
            <p className="text-base sm:text-lg mb-8" style={{ color: isDark ? '#c4cad6' : '#455258' }}>
              {lang === 'en'
                ? "Drop your CV or your LinkedIn export. I'll extract the trajectory, you'll review what I found on the next screen, and then we start evaluating roles."
                : 'Suelta tu CV o tu exportación de LinkedIn. Extraeré la trayectoria, revisarás lo que encontré en la siguiente pantalla, y luego comenzamos a evaluar roles.'}
            </p>

            <div className="max-w-4xl grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Upload Card - Main */}
              <div className="lg:col-span-2">
                <label style={{ cursor: 'pointer', display: 'block' }}>
                  <input type="file" accept=".pdf,.txt,.doc,.docx" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} />
                  <div className="p-6 rounded-lg border transition-all h-full" style={{ borderColor: isDark ? '#2a3543' : '#e2e7e8', background: isDark ? '#1a2230' : '#ffffff', cursor: uploading ? 'not-allowed' : 'pointer' }}>
                    {/* Header with icon and title */}
                    <div className="flex gap-4 mb-4">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: isDark ? '#8893a3' : '#889399', flexShrink: 0 }}>
                        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                        <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
                        <path d="M9 9h1M9 13h6M9 17h6" />
                      </svg>
                      <div className="flex-1">
                        <div className="font-500 text-sm" style={{ color: isDark ? '#f4f6fa' : '#0a1f24' }}>
                          {lang === 'en' ? 'Upload your CV or LinkedIn export' : 'Sube tu CV o tu exportación de LinkedIn'}
                        </div>
                        <p className="text-xs mt-2" style={{ color: isDark ? '#c4cad6' : '#455258' }}>
                          {lang === 'en'
                            ? 'A regular CV works. A LinkedIn PDF export (Profile → More → Save to PDF) works too and often extracts more completely.'
                            : 'Un CV regular funciona. Una exportación PDF de LinkedIn (Perfil → Más → Guardar como PDF) también funciona y a menudo extrae más completamente.'}
                        </p>
                      </div>
                    </div>

                    {/* Upload meta */}
                    <div className="font-mono text-xs mb-4 tracking-widest" style={{ color: isDark ? '#8893a3' : '#889399' }}>
                      PDF · DOCX · UP TO 10MB · ~30 SEC TO EXTRACT
                    </div>

                    {/* Drop zone */}
                    <div className="border-2 border-dashed rounded-lg p-8 text-center transition-all" style={{ borderColor: isDark ? '#2a3543' : '#e2e7e8', background: isDark ? '#0a0e14' : '#f6f8f8' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3" style={{ color: isDark ? '#8893a3' : '#889399' }}>
                        <path d="M12 4v12" />
                        <path d="m6 10 6-6 6 6" />
                        <path d="M4 20h16" />
                      </svg>
                      <p className="text-sm font-500" style={{ color: isDark ? '#f4f6fa' : '#0a1f24' }}>
                        {lang === 'en' ? 'Drop your file here' : 'Suelta tu archivo aquí'}, {lang === 'en' ? 'or' : 'o'} <span style={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}>{lang === 'en' ? 'browse' : 'examina'}</span>
                      </p>
                      <p className="text-xs mt-2" style={{ color: isDark ? '#8893a3' : '#889399' }}>
                        {lang === 'en' ? 'PDF or DOCX, under 10MB' : 'PDF o DOCX, menos de 10MB'}
                      </p>
                    </div>
                  </div>
                </label>
              </div>

              {/* Right Column - LinkedIn + Privacy */}
              <div className="space-y-4">
                {/* LinkedIn Card - Disabled */}
                <div className="p-6 rounded-lg border transition-all" style={{ borderColor: isDark ? '#2a3543' : '#e2e7e8', background: isDark ? '#1a2230' : '#ffffff', opacity: 0.72, cursor: 'not-allowed' }}>
                  <div className="flex gap-4">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: isDark ? '#8893a3' : '#889399', opacity: 0.5, flexShrink: 0 }}>
                      <path d="M9 2v6" />
                      <path d="M15 2v6" />
                      <path d="M5 8h14v4a7 7 0 0 1-14 0z" />
                      <path d="M12 19v3" />
                    </svg>
                    <div className="flex-1">
                      <div className="flex gap-2 items-center mb-2">
                        <div className="font-500 text-sm" style={{ color: isDark ? '#f4f6fa' : '#0a1f24' }}>
                          {lang === 'en' ? 'Connect LinkedIn directly' : 'Conectar LinkedIn directamente'}
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full font-500" style={{ background: isDark ? '#2a3543' : '#e2e7e8', color: isDark ? '#8893a3' : '#889399' }}>
                          {lang === 'en' ? 'Coming soon' : 'Próximamente'}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: isDark ? '#c4cad6' : '#455258' }}>
                        {lang === 'en'
                          ? 'One-click sync — no upload, no review. Working with LinkedIn on expanded data access.'
                          : 'Sincronización de un clic, sin cargar, sin revisar. Trabajando con LinkedIn en acceso expandido a datos.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Privacy Strip */}
                <div className="p-4 rounded-lg border" style={{ borderColor: isDark ? '#2a3543' : '#e2e7e8', background: isDark ? '#1a2230' : '#ffffff' }}>
                  <div className="flex gap-3 text-xs" style={{ color: isDark ? '#c4cad6' : '#455258' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                      <rect x="4" y="11" width="16" height="10" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                    <div>
                      {lang === 'en'
                        ? "Your CV stays private. Used to power your evaluations, not shared with anyone. "
                        : 'Tu CV se mantiene privado. Se utiliza para impulsar tus evaluaciones, no se comparte con nadie. '}
                      <span style={{ color: isDark ? '#f4f6fa' : '#0a1f24', fontWeight: 500 }}>
                        {lang === 'en' ? 'Delete any time from settings.' : 'Elimina en cualquier momento desde configuración.'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Review with Loading Animation */}
        {step === 2 && (
          <div className="animate-fade-in" style={{ position: 'relative' }}>
            <div>
              <h1 className="font-serif text-4xl sm:text-5xl font-400 mb-4" style={{ color: isDark ? '#f4f6fa' : '#0a1f24' }}>
                {lang === 'en' ? 'Reading your ' : 'Leyendo tu '}<em>{lang === 'en' ? 'career.' : 'carrera.'}</em>
              </h1>
              <p className="text-base sm:text-lg mb-8" style={{ color: isDark ? '#c4cad6' : '#455258' }}>
                {lang === 'en' ? 'Pulling out the trajectory, scope, and outcomes. About thirty seconds.' : 'Extrayendo la trayectoria, alcance y resultados. Unos treinta segundos.'}
              </p>

              <div className="max-w-2xl p-5 rounded-lg border" style={{ background: isDark ? '#1a2230' : '#ffffff', borderColor: isDark ? '#2a3543' : '#e2e7e8' }}>
                {/* Reading rows with staggered animation - loops continuously */}
                {[
                  lang === 'en' ? 'Read the document · 2 pages · PDF · LinkedIn export detected' : 'Leer el documento · 2 páginas · PDF · Exportación de LinkedIn detectada',
                  lang === 'en' ? 'Found the experience section · 7 roles · 14 years span' : 'Encontrada la sección de experiencia · 7 roles · 14 años de alcance',
                  lang === 'en' ? 'Pulled current role · ' + (cvSignals.roles?.[0]?.company || 'Company') + ' · ' + (cvSignals.roles?.[0]?.role || 'Role') + ' · 2024–present' : 'Rol actual · ' + (cvSignals.roles?.[0]?.company || 'Empresa') + ' · ' + (cvSignals.roles?.[0]?.role || 'Puesto') + ' · 2024–presente',
                  lang === 'en' ? 'Pulled prior roles · ' + (cvSignals.roles?.slice(1, 4).map(r => r.company).join(', ') || 'roles') + ', …' : 'Roles anteriores · ' + (cvSignals.roles?.slice(1, 4).map(r => r.company).join(', ') || 'roles') + ', …',
                  lang === 'en' ? 'Extracted quantified outcomes · 11 found · 1 role unclear' : 'Resultados cuantificados extraídos · 11 encontrados · 1 rol poco claro',
                  lang === 'en' ? 'Inferred trajectory · ' + (cvSignals.trajectory || 'trajectory') : 'Trayectoria inferida · ' + (cvSignals.trajectory || 'trayectoria'),
                  lang === 'en' ? 'Ready. Your turn to check my work.' : 'Listo. Tu turno para verificar mi trabajo.',
                ].map((text, idx) => (
                  <div
                    key={idx}
                    className="flex gap-3 py-3 border-b transition-all duration-400"
                    style={{
                      borderColor: idx === 6 ? 'transparent' : isDark ? '#2a3543' : '#e2e7e8',
                      opacity: readingRows[idx] ? 1 : 0.2,
                    }}
                  >
                    <div className="flex-shrink-0 text-lg" style={{ color: idx === 4 ? '#c97b0e' : (isDark ? '#5cb1ff' : '#0d7c89') }}>
                      {idx === 4 ? '!' : '✓'}
                    </div>
                    <div className="text-sm" style={{ color: isDark ? '#c4cad6' : '#455258' }}>
                      {text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {showingLoadingPhase === false && (
              <div>
                <h1 className="font-serif text-4xl sm:text-5xl font-400 mb-4" style={{ color: isDark ? '#f4f6fa' : '#0a1f24' }}>
                  {t.step2}
                </h1>
                <p className="text-base sm:text-lg mb-8" style={{ color: isDark ? '#c4cad6' : '#455258' }}>
                  {lang === 'en' ? "Here's what we extracted from your CV. Review and continue." : 'Aquí está lo que extrajimos de tu CV. Revisa y continúa.'}
                </p>

                <div className="max-w-2xl space-y-6">
                  {cvSignals.trajectory && (
                    <div className="p-5 rounded-lg border" style={{ background: isDark ? '#1a2230' : '#ffffff', borderColor: isDark ? '#2a3543' : '#e2e7e8' }}>
                      <div className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: isDark ? '#8893a3' : '#889399' }}>
                        {lang === 'en' ? 'Trajectory' : 'Trayectoria'}
                      </div>
                      <p className="font-500">{cvSignals.trajectory}</p>
                    </div>
                  )}

                  {cvSignals.languages && cvSignals.languages.length > 0 && (
                    <div className="p-5 rounded-lg border" style={{ background: isDark ? '#1a2230' : '#ffffff', borderColor: isDark ? '#2a3543' : '#e2e7e8' }}>
                      <div className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: isDark ? '#8893a3' : '#889399' }}>
                        {lang === 'en' ? 'Languages' : 'Idiomas'}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cvSignals.languages.map((language) => (
                          <span key={language} className="px-3 py-1 rounded-full text-sm" style={{ background: isDark ? '#0d7c89' : '#d6eef0', color: isDark ? '#f4f6fa' : '#0d7c89' }}>
                            {language}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {cvSignals.roles && cvSignals.roles.length > 0 && (
                    <div className="p-5 rounded-lg border" style={{ background: isDark ? '#1a2230' : '#ffffff', borderColor: isDark ? '#2a3543' : '#e2e7e8' }}>
                      <div className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: isDark ? '#8893a3' : '#889399' }}>
                        {lang === 'en' ? 'Roles' : 'Roles'}
                      </div>
                      <div className="space-y-3">
                        {cvSignals.roles.slice(0, 3).map((role, idx) => (
                          <div key={idx} className="text-sm">
                            <p className="font-500">{role.role}</p>
                            <p style={{ color: isDark ? '#8893a3' : '#889399' }}>{role.company}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review Roles */}
        {step === 3 && cvSignals && (
          <div className="animate-fade-in">
            <h1 className="font-serif text-4xl sm:text-5xl font-400 mb-4" style={{ color: isDark ? '#f4f6fa' : '#0a1f24' }}>
              {lang === 'en' ? "Here's how I read " : "Así leo "}<em>{lang === 'en' ? 'your career.' : 'tu carrera.'}</em>
            </h1>
            <p className="text-base sm:text-lg mb-8" style={{ color: isDark ? '#c4cad6' : '#455258' }}>
              {cvSignals.roles?.length || 0} roles, {cvSignals.trajectory}. {t.step3Sub}
            </p>

            <div className="max-w-4xl space-y-4">
              {cvSignals.roles && cvSignals.roles.slice(0, 5).map((role, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-lg border animate-fade-up"
                  style={{
                    background: isDark ? '#1a2230' : '#ffffff',
                    borderColor: isDark ? '#2a3543' : '#e2e7e8',
                    animationDelay: `${idx * 50}ms`
                  }}
                >
                  <div className="flex gap-4">
                    <div className="font-mono font-600 text-lg" style={{ color: isDark ? '#8893a3' : '#889399', minWidth: '32px' }}>
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-500 text-lg">{role.role}</div>
                      <p style={{ color: isDark ? '#8893a3' : '#889399' }} className="text-sm">
                        {role.company}
                      </p>
                      {role.metrics && role.metrics.length > 0 && (
                        <p className="text-sm mt-2" style={{ color: isDark ? '#c4cad6' : '#455258' }}>
                          {role.metrics[0]}
                        </p>
                      )}
                    </div>
                    <div className="text-2xl" style={{ color: isDark ? '#5cb1ff' : '#0d7c89' }}>●●●</div>
                  </div>
                </div>
              ))}

              {cvSignals.unsure && cvSignals.unsure.length > 0 && (
                <div
                  className="p-5 rounded-lg border animate-fade-up"
                  style={{
                    background: isDark ? '#382b16' : '#fbecd6',
                    borderColor: '#c97b0e',
                    animationDelay: `${5 * 50}ms`
                  }}
                >
                  <div className="flex gap-4">
                    <div className="font-mono font-600 text-lg" style={{ color: '#c97b0e', minWidth: '32px' }}>?</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-500">{lang === 'en' ? 'Needs attention' : 'Necesita atención'}</div>
                      <p style={{ color: isDark ? '#f2c987' : '#854F0B' }} className="text-sm mt-1">
                        {cvSignals.unsure[0].field} — {lang === 'en' ? "couldn't extract clearly" : 'no se pudo extraer claramente'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Positioning & Preferences */}
        {step === 4 && (
          <div className="animate-fade-in">
            <h1 className="font-serif text-4xl sm:text-5xl font-400 mb-4" style={{ color: isDark ? '#f4f6fa' : '#0a1f24' }}>
              {lang === 'en' ? 'Now, ' : 'Ahora, '}<em>{lang === 'en' ? "where you're going." : 'hacia dónde vas.'}</em>
            </h1>
            <p className="text-base sm:text-lg mb-8" style={{ color: isDark ? '#c4cad6' : '#455258' }}>
              {t.step4Sub}
            </p>

            <div className="max-w-2xl space-y-8">
              {/* Seniority */}
              <div className="animate-fade-up" style={{ animationDelay: '50ms' }}>
                <label className="font-500 block mb-3">{t.lookingFor}</label>
                <div className="flex flex-wrap gap-3">
                  {(lang === 'en' ? ['Director-level', 'Stretch up', 'Open to lateral'] : ['Nivel Director', 'Estirar arriba', 'Abierto a lateral']).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSeniority(opt)}
                      className="px-4 py-2 rounded-full text-sm font-500 border transition-all"
                      style={{
                        background: seniority === opt ? (isDark ? '#0d7c89' : '#d6eef0') : 'transparent',
                        borderColor: seniority === opt ? (isDark ? '#5cb1ff' : '#0d7c89') : (isDark ? '#2a3543' : '#e2e7e8'),
                        color: seniority === opt ? (isDark ? '#f4f6fa' : '#0d7c89') : (isDark ? '#c4cad6' : '#455258'),
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Status */}
              <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
                <label className="font-500 block mb-3">{t.searchStatus}</label>
                <div className="flex flex-wrap gap-3">
                  {(lang === 'en' ? ['Just looking', 'Open to the right thing', 'Actively searching'] : ['Solo mirando', 'Abierto a la opción correcta', 'Buscando activamente']).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSearchStatus(opt)}
                      className="px-4 py-2 rounded-full text-sm font-500 border transition-all"
                      style={{
                        background: searchStatus === opt ? (isDark ? '#0d7c89' : '#d6eef0') : 'transparent',
                        borderColor: searchStatus === opt ? (isDark ? '#5cb1ff' : '#0d7c89') : (isDark ? '#2a3543' : '#e2e7e8'),
                        color: searchStatus === opt ? (isDark ? '#f4f6fa' : '#0d7c89') : (isDark ? '#c4cad6' : '#455258'),
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="animate-fade-up" style={{ animationDelay: '150ms' }}>
                <label className="font-500 block mb-3">{t.openTo}</label>
                <div className="flex flex-wrap gap-3">
                  {(lang === 'en' ? ['Remote only', 'Hybrid', 'Onsite', 'Anywhere global'] : ['Solo remoto', 'Híbrido', 'En sitio', 'En cualquier lugar global']).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setLocation(opt)}
                      className="px-4 py-2 rounded-full text-sm font-500 border transition-all"
                      style={{
                        background: location === opt ? (isDark ? '#0d7c89' : '#d6eef0') : 'transparent',
                        borderColor: location === opt ? (isDark ? '#5cb1ff' : '#0d7c89') : (isDark ? '#2a3543' : '#e2e7e8'),
                        color: location === opt ? (isDark ? '#f4f6fa' : '#0d7c89') : (isDark ? '#c4cad6' : '#455258'),
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compensation */}
              <div className="animate-fade-up" style={{ animationDelay: '200ms' }}>
                <label className="font-500 block mb-3">{t.compLabel}</label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder={lang === 'en' ? 'Minimum' : 'Mínimo'}
                    value={minComp}
                    onChange={(e) => setMinComp(e.target.value)}
                    className="px-4 py-2 rounded-lg border"
                    style={{
                      background: isDark ? '#161d27' : '#f6f8f8',
                      borderColor: isDark ? '#2a3543' : '#e2e7e8',
                      color: isDark ? '#f4f6fa' : '#0a1f24',
                    }}
                  />
                  <input
                    type="text"
                    placeholder={lang === 'en' ? 'Target' : 'Objetivo'}
                    value={targetComp}
                    onChange={(e) => setTargetComp(e.target.value)}
                    className="px-4 py-2 rounded-lg border"
                    style={{
                      background: isDark ? '#1a2230' : '#ffffff',
                      borderColor: isDark ? '#2a3543' : '#e2e7e8',
                      color: isDark ? '#f4f6fa' : '#0a1f24',
                    }}
                  />
                </div>
              </div>

              {/* Narrative */}
              <div className="animate-fade-up" style={{ animationDelay: '250ms' }}>
                <label className="font-500 block mb-3">{lang === 'en' ? 'What are you ' : '¿Qué estás '}<em>{lang === 'en' ? 'really' : 'realmente'}</em>{lang === 'en' ? ' looking for?' : ' buscando?'}</label>
                <p style={{ color: isDark ? '#8893a3' : '#889399' }} className="text-sm mb-3">
                  {t.narrativeHelper}
                </p>
                <textarea
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  placeholder={lang === 'en' ? 'E.g., I want operator scope at a company past the chaos but before the calcification. Fintech or marketplaces.' : 'P. ej., quiero responsabilidad operativa en una empresa pasada el caos pero antes de la calcificación. Fintech o mercados.'}
                  className="w-full px-4 py-3 rounded-lg border"
                  rows={4}
                  style={{
                    background: isDark ? '#161d27' : '#f6f8f8',
                    borderColor: isDark ? '#2a3543' : '#e2e7e8',
                    color: isDark ? '#f4f6fa' : '#0a1f24',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 5: The Read - Archetypes */}
        {step === 5 && archetypes.length > 0 && (
          <div className="animate-fade-in">
            <h1 className="font-serif text-4xl sm:text-5xl font-400 mb-4" style={{ color: isDark ? '#f4f6fa' : '#0a1f24' }}>
              {lang === 'en' ? "Here's " : 'Aquí está '}<em>{lang === 'en' ? 'the read.' : 'el análisis.'}</em>
            </h1>
            <p className="text-base sm:text-lg mb-8" style={{ color: isDark ? '#c4cad6' : '#455258' }}>
              {lang === 'en'
                ? 'Three role shapes I\'d weight you toward. Click to confirm or deselect — we\'ll use these to score every role you evaluate from here.'
                : 'Tres formas de rol hacia las que te dirigiría. Haz clic para confirmar o deselecciona — usaremos estos para calificar cada rol que evalúes.'}
            </p>

            <div className="max-w-4xl space-y-8">
              {/* Pattern Card */}
              <div className="p-6 rounded-lg border animate-fade-up" style={{ background: isDark ? '#1a2230' : '#ffffff', borderColor: isDark ? '#2a3543' : '#e2e7e8' }}>
                <div className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: isDark ? '#8893a3' : '#889399' }}>★ {lang === 'en' ? 'The pattern' : 'El patrón'}</div>
                <p className="font-serif text-lg mb-3" style={{ color: isDark ? '#f4f6fa' : '#0a1f24' }}>
                  {lang === 'en'
                    ? "You're a generalist operator who specializes by context — geo-by-geo, not function-by-function."
                    : 'Eres un operador generalista que se especializa por contexto, geo a geo, no función por función.'}
                </p>
                <p style={{ color: isDark ? '#c4cad6' : '#455258' }} className="text-sm">
                  {lang === 'en'
                    ? 'Four countries, eleven LatAm markets, fintech to marketplaces to telecom. The scope keeps growing; the function stays operations. That makes you durable across messy categories — and less obviously placed at companies looking for a deep functional specialist.'
                    : 'Cuatro países, once mercados LatAm, fintech a marketplaces a telecom. El alcance sigue creciendo; la función sigue siendo operaciones. Eso te hace duradero en categorías desordenadas, y menos obviamente colocado en empresas que buscan un especialista funcional profundo.'}
                </p>
              </div>

              {/* Archetypes Grid */}
              <div>
                <div className="font-mono text-xs uppercase tracking-widest mb-4" style={{ color: isDark ? '#8893a3' : '#889399' }}>★ {lang === 'en' ? 'The three shapes' : 'Las tres formas'}</div>
                <div className="space-y-4">
                  {archetypes.map((arch, idx) => (
                    <div
                      key={arch.id}
                      className="p-6 rounded-lg border animate-fade-up"
                      style={{
                        background: isDark ? '#1a2230' : '#ffffff',
                        borderColor: isDark ? '#2a3543' : '#e2e7e8',
                        animationDelay: `${(idx + 1) * 50}ms`,
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-mono text-xs uppercase tracking-widest" style={{ color: isDark ? '#8893a3' : '#889399' }}>
                            Archetype {arch.number} · {arch.type}
                          </div>
                          <h3 className="font-serif text-lg mt-2" style={{ color: isDark ? '#f4f6fa' : '#0a1f24' }}>
                            {arch.name}
                          </h3>
                        </div>
                        <button
                          onClick={() => {
                            setArchetypes((prev) =>
                              prev.map((a) =>
                                a.id === arch.id ? { ...a, selected: !a.selected } : a
                              )
                            );
                          }}
                          className="flex-shrink-0 text-lg transition-opacity"
                          style={{ color: arch.selected ? (isDark ? '#5cb1ff' : '#0d7c89') : (isDark ? '#8893a3' : '#889399') }}
                        >
                          {arch.selected ? '✓' : '○'}
                        </button>
                      </div>
                      <p style={{ color: isDark ? '#c4cad6' : '#455258' }} className="text-sm mb-3">
                        {arch.description}
                      </p>
                      <p style={{ color: isDark ? '#8893a3' : '#889399' }} className="text-xs">
                        {lang === 'en' ? 'Why this fits — ' : 'Por qué encaja — '}{arch.why}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comp Context */}
              <div className="p-6 rounded-lg border" style={{ background: isDark ? '#1a2230' : '#ffffff', borderColor: isDark ? '#2a3543' : '#e2e7e8' }}>
                <div className="flex flex-col sm:flex-row gap-8 justify-between">
                  <div>
                    <div className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: isDark ? '#8893a3' : '#889399' }}>★ {lang === 'en' ? 'Comp context' : 'Contexto de comp'}</div>
                    <p style={{ color: isDark ? '#c4cad6' : '#455258' }} className="text-sm">
                      {lang === 'en'
                        ? "A reference, not an anchor. We'll sharpen as peers in your segment contribute outcome data."
                        : 'Una referencia, no un anclaje. Afinaremos a medida que los pares en tu segmento contribuyan datos de resultados.'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: isDark ? '#8893a3' : '#889399' }}>In USD</div>
                    <div className="font-serif text-2xl" style={{ color: isDark ? '#f4f6fa' : '#0a1f24' }}>$140k – $210k</div>
                    <div className="font-mono text-xs mt-2" style={{ color: isDark ? '#8893a3' : '#889399' }}>○○○ Orientation</div>
                  </div>
                </div>
              </div>

              {/* Handoff */}
              <div className="p-6 rounded-lg" style={{ background: isDark ? '#0d4f5b' : '#d6eef0' }}>
                <div className="font-serif text-lg mb-2" style={{ color: isDark ? '#f4f6fa' : '#0d7c89' }}>
                  {lang === 'en' ? 'Now we evaluate something real.' : 'Ahora evaluamos algo real.'}
                </div>
                <p style={{ color: isDark ? '#c4cad6' : '#455258' }} className="text-sm">
                  {lang === 'en'
                    ? 'Paste a recruiter DM, a JD, or a job URL. You\'ll see what a full read looks like.'
                    : 'Pega un MD de reclutador, JD, o URL de trabajo. Verás cómo se ve un análisis completo.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer with Navigation */}
      <div className="border-t max-w-4xl mx-auto w-full px-6 py-6 sm:px-8" style={{ borderColor: isDark ? '#2a3543' : '#e2e7e8' }}>
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="px-6 py-2 rounded-full font-500 transition-all disabled:opacity-50"
            style={{ color: isDark ? '#c4cad6' : '#455258', cursor: step === 1 ? 'not-allowed' : 'pointer' }}
          >
            {t.back}
          </button>
          <button
            onClick={handleNext}
            disabled={uploading}
            className="px-8 py-2 rounded-full font-500 transition-all"
            style={{
              background: isDark ? '#5cb1ff' : '#0d7c89',
              color: isDark ? '#06101c' : '#ffffff',
              opacity: uploading ? 0.6 : 1,
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {step === 5 ? "Let's go" : t.next}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .animate-fade-up {
          animation: fade-up 0.4s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
