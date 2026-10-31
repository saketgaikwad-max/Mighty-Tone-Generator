import type { Patch } from '../contracts/patch.ts';
import { parse } from './parse.ts';
import { solve } from './solve.ts';

export interface ToneMeta {
  archetype: string;
  ruleTrace: string[];
  confidence: number;
  unknownTerms: string[];
}

/** Deterministic prompt -> Mighty Space patch. Same prompt and instrument always give byte-identical output. */
export function generateTone(prompt: string, instrument?: string): { patch: Patch; meta: ToneMeta } {
  const intent = parse(instrument === undefined ? { prompt } : { prompt, instrument });
  const { patch, ruleTrace, archetype, confidence } = solve(intent);
  return { patch, meta: { archetype, ruleTrace, confidence, unknownTerms: intent.unknownTerms } };
}

export { parse, type Intent, type ParseInput } from './parse.ts';
export { solve, type SolveResult } from './solve.ts';
export { engineKnowledge, type EngineKnowledge } from './knowledge.ts';
