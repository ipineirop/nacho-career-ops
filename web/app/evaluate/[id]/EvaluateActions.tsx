'use client';

import { useRouter } from 'next/navigation';
import { VerdictView } from '@/components/verdict/VerdictView';
import type { FullVerdictMeta } from '@/components/verdict/types';
import { useEvaluatePanel } from '@/components/evaluate/EvaluatePanelProvider';

/**
 * Thin client wrapper so the server page can hand the editorial verdict to
 * VerdictView with real onNew / onDiscard callbacks. "New" opens the panel
 * fresh; "Discard" sends the user to the tracker.
 */
export function EvaluateActions({ meta }: { meta: FullVerdictMeta }) {
  const router = useRouter();
  const { open } = useEvaluatePanel();

  return (
    <VerdictView
      meta={meta}
      onNew={() => { router.push('/'); open(); }}
      onDiscard={() => router.push('/tracker')}
    />
  );
}
