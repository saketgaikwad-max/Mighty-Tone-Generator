import archetypesData from '../../knowledge/engine/archetypes.json' with { type: 'json' };
import instrumentsData from '../../knowledge/engine/instruments.json' with { type: 'json' };
import rulesData from '../../knowledge/engine/rules.json' with { type: 'json' };
import templatesData from '../../knowledge/engine/templates.json' with { type: 'json' };
import vocabularyData from '../../knowledge/engine/vocabulary.json' with { type: 'json' };
import type { BlockKind } from '../contracts/blocks.ts';

/** Canonical parameter address `<block>.<param>`, resolved per model via `Vocabulary.paramAliases`. */
export type ParamKey = string;
export type Range = [number, number];

export interface VocabTerm {
  synonyms?: string[];
  deltas?: Record<ParamKey, number>;
  targets?: Record<ParamKey, Range>;
  archetypes?: Record<string, number>;
  blocks?: Partial<Record<BlockKind, boolean>>;
  models?: Partial<Record<BlockKind, string>>;
}

export interface Vocabulary {
  modifiers: { negators: string[]; negationWindow: number; intensifiers: Record<string, number> };
  stopwords: string[];
  paramAliases: Record<ParamKey, string[]>;
  terms: Record<string, VocabTerm>;
}

export interface Archetype {
  name: string;
  template: string;
  models: Partial<Record<BlockKind, string[]>>;
  chain: Partial<Record<BlockKind, boolean>>;
  paramPriors: Record<ParamKey, number>;
  master: number;
  match?: { descriptors?: string[]; instrumentKind?: string[]; score: number }[];
}

export interface ConfidenceWeights {
  base: number;
  perDescriptor: number;
  descriptorCap: number;
  archetypeMatched: number;
  instrumentKnown: number;
  perUnknownTerm: number;
  perWarning: number;
}

export interface ArchetypeSet {
  default: string;
  confidence: ConfidenceWeights;
  archetypes: Record<string, Archetype>;
}

export interface CorrectionGroup {
  archetypes?: string[];
  models?: Partial<Record<BlockKind, string>>;
  enable?: BlockKind[];
  deltas?: Record<ParamKey, number>;
}

export interface InstrumentProfile {
  label: string;
  kind: 'electric' | 'acoustic' | 'mandolin';
  pickup: string;
  aliases: string[];
  archetypeBias?: Record<string, number>;
  corrections: CorrectionGroup[];
  notes: string[];
}

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { param: ParamKey; gt?: number; gte?: number; lt?: number; lte?: number }
  | { archetype: string[] }
  | { instrument: string[] }
  | { instrumentKind: string[] }
  | { pickup: string[] }
  | { descriptor: string[] }
  | { enabled: BlockKind }
  | { disabled: BlockKind }
  | { modelPrefix: Partial<Record<BlockKind, string>> };

export type Action =
  | { set: Record<ParamKey, number> }
  | { add: Record<ParamKey, number> }
  | { min: Record<ParamKey, number> }
  | { max: Record<ParamKey, number> }
  | { enable: BlockKind[] }
  | { disable: BlockKind[] }
  | { warn: string };

export interface Rule {
  id: string;
  condition: Condition;
  action: Action[];
  rationale: string;
  exceptions?: string[];
  notes?: string;
}

export interface EngineKnowledge {
  vocabulary: Vocabulary;
  archetypes: ArchetypeSet;
  instruments: Record<string, InstrumentProfile>;
  rules: Rule[];
  templates: Record<string, { qr: string; fixture: string }>;
}

/** Shape-checked by tests/engine (knowledge references); cast so the runtime bundle does not parse it. */
export const engineKnowledge: EngineKnowledge = {
  vocabulary: vocabularyData as unknown as Vocabulary,
  archetypes: archetypesData as unknown as ArchetypeSet,
  instruments: (instrumentsData as unknown as { instruments: Record<string, InstrumentProfile> }).instruments,
  rules: (rulesData as unknown as { rules: Rule[] }).rules,
  templates: (templatesData as unknown as { templates: EngineKnowledge['templates'] }).templates,
};
