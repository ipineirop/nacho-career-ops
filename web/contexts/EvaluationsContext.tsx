'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';

export type EvalStatus = 'streaming' | 'done' | 'error';

export interface Evaluation {
  id: string;
  jd: string;
  label: string;       // company name or first line of JD
  status: EvalStatus;
  text: string;
  reportId?: string;
  startedAt: Date;
  endedAt?: Date;
}

interface EvaluationsCtx {
  evaluations: Evaluation[];
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  startEvaluation: (jd: string) => void;
  clearDone: () => void;
}

const Ctx = createContext<EvaluationsCtx | null>(null);

export function EvaluationsProvider({ children }: { children: React.ReactNode }) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const counterRef = useRef(0);

  const startEvaluation = useCallback((jd: string) => {
    const id = `eval-${Date.now()}-${counterRef.current++}`;
    const label = jd.split('\n').find((l) => l.trim())?.slice(0, 60) ?? 'Evaluation';

    const newEval: Evaluation = {
      id, jd, label, status: 'streaming', text: '', startedAt: new Date(),
    };

    setEvaluations((prev) => [newEval, ...prev]);
    setPanelOpen(true);

    // Start streaming in background
    (async () => {
      try {
        const res = await fetch('/api/ai/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jd }),
        });

        if (!res.ok || !res.body) throw new Error('Stream failed');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const snapshot = accumulated;
          setEvaluations((prev) =>
            prev.map((e) => e.id === id ? { ...e, text: snapshot } : e)
          );
        }

        // Extract company name once done
        const companyMatch = accumulated.match(/Evaluaci[oó]n:\s*([^—\n\r]+)/i);
        const company = companyMatch?.[1]?.trim().replace(/\*+/g, '').slice(0, 50) ?? label;

        setEvaluations((prev) =>
          prev.map((e) =>
            e.id === id
              ? { ...e, status: 'done', text: accumulated, label: company, endedAt: new Date() }
              : e
          )
        );
      } catch {
        setEvaluations((prev) =>
          prev.map((e) => e.id === id ? { ...e, status: 'error', endedAt: new Date() } : e)
        );
      }
    })();
  }, []);

  const clearDone = useCallback(() => {
    setEvaluations((prev) => prev.filter((e) => e.status === 'streaming'));
  }, []);

  return (
    <Ctx.Provider value={{ evaluations, panelOpen, setPanelOpen, startEvaluation, clearDone }}>
      {children}
    </Ctx.Provider>
  );
}

export function useEvaluations() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEvaluations must be used inside EvaluationsProvider');
  return ctx;
}
