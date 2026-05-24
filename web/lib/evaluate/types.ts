/**
 * Shared types for the FAB+panel Evaluate flow. The full editorial verdict
 * payload lives in components/verdict/types — these are the contracts for the
 * panel → API → /evaluate/[id] handoff.
 */

export type InputType = 'dm' | 'jd' | 'url';
export type EvaluationStatus = 'processing' | 'complete' | 'failed';

export interface CreateEvaluationBody {
  rawInput: string;
  inputType: InputType;
  classificationConfidence: number; // 0..1
}

export interface CreateEvaluationResponse {
  id: string;
}

export interface ClassifyRequest {
  text: string;
}

export interface ClassifyResponse {
  type: InputType | null;
  confidence: number | null;
}
