/**
 * Way-A — deterministic data-driven suggestions surfaced inside Tracker
 * rows. The Tracker has no LLM-generated content (wiring doc §G); these
 * are template strings filled at render time with user-data variables.
 *
 * Surface placement: inside the row, below the meta line. Distinct from
 * Brief signals (`lib/brief/signals/`) which live on the Brief surface.
 * The two systems are intentionally namespace-separated with no shared
 * dismissal state.
 */

import type { WayATemplateKey } from '@/lib/brief/i18n';
import type { PipelineStatus } from '@/lib/api/validation';

/** All nine v1 trigger codes. */
export type TriggerCode =
  | 'applied_14d'
  | 'applied_30d'
  | 'interviewing_21d'
  | 'interviewing_45d'
  | 'offer_pending_5d'
  | 'offer_pending_14d'
  | 'evaluating_60d'
  | 'interviewing_freshTransition'
  | 'offer_pending_freshTransition';

/** Triggers split into two flavors — threshold (continues firing while the
 *  condition holds) and one-shot (suppress after a single render). */
export type TriggerKind = 'threshold' | 'oneShot';

export interface WayATrigger {
  code: TriggerCode;
  kind: TriggerKind;
  templateKey: WayATemplateKey;
  /** The row this trigger refers to. */
  roleId: string;
  /** Variables consumed by the template (e.g. `{company}` → "Stori"). */
  vars: Record<string, string>;
  /** Suggested primary action when the user acts on the suggestion. */
  primaryActionStatus?: PipelineStatus;
}

/** Rendered output ready for the Row component. */
export interface WayARenderable {
  trigger: WayATrigger;
  rendered: { en: string; es: string };
}
