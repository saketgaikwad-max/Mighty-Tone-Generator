import type { BlockKind } from '../contracts/blocks.ts';
import { engineKnowledge, type EngineKnowledge, type ParamKey, type Range } from './knowledge.ts';

export interface Intent {
  archetype: string;
  /** Matched vocabulary keys (canonical, not synonyms), in prompt order. Includes negated ones. */
  descriptors: string[];
  /** Merged raw-step deltas; for a shared key the later descriptor wins; negated descriptors invert sign. */
  deltas: Record<ParamKey, number>;
  instrument?: string;
  unknownTerms: string[];
  source: 'parser';
  /** Subset of `descriptors` that were negated ("not too bright", "less harsh"). */
  negated?: string[];
  /** Hard bands applied after deltas (e.g. "clean" -> amp.gain 20-35). */
  targets?: Record<ParamKey, Range>;
  blocks?: Partial<Record<BlockKind, boolean>>;
  models?: Partial<Record<BlockKind, string>>;
  archetypeScores?: Record<string, number>;
}

export interface ParseInput {
  prompt: string;
  instrument?: string;
}

type LexEntry = { kind: 'term'; key: string } | { kind: 'instrument'; id: string };

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, ' ')
    .split(' ')
    .map((w) => w.replace(/^[-']+|[-']+$/g, ''))
    .filter((w) => w.length > 0);
}

const lexCache = new WeakMap<EngineKnowledge, { lex: Map<string, LexEntry>; maxLen: number }>();

function lexicon(kb: EngineKnowledge): { lex: Map<string, LexEntry>; maxLen: number } {
  const cached = lexCache.get(kb);
  if (cached) return cached;
  const lex = new Map<string, LexEntry>();
  let maxLen = 1;
  const add = (phrase: string, entry: LexEntry) => {
    const w = words(phrase);
    if (w.length === 0) return;
    maxLen = Math.max(maxLen, w.length);
    const k = w.join(' ');
    if (!lex.has(k)) lex.set(k, entry);
  };
  for (const [key, term] of Object.entries(kb.vocabulary.terms)) {
    add(key, { kind: 'term', key });
    for (const s of term.synonyms ?? []) add(s, { kind: 'term', key });
  }
  for (const [id, inst] of Object.entries(kb.instruments)) {
    for (const a of inst.aliases) add(a, { kind: 'instrument', id });
  }
  const built = { lex, maxLen };
  lexCache.set(kb, built);
  return built;
}

/** Deterministic prompt -> Intent. Clauses (split on punctuation) bound negation and intensity. */
export function parse(input: ParseInput, kb: EngineKnowledge = engineKnowledge): Intent {
  const { vocabulary: vocab, archetypes, instruments } = kb;
  const { lex, maxLen } = lexicon(kb);
  const negators = new Set(vocab.modifiers.negators.map((w) => w.replace(/'/g, '')));
  const stop = new Set(vocab.stopwords);
  const intens = vocab.modifiers.intensifiers;

  const descriptors: string[] = [];
  const negated: string[] = [];
  const deltas: Record<ParamKey, number> = {};
  const targets: Record<ParamKey, Range> = {};
  const blocks: Partial<Record<BlockKind, boolean>> = {};
  const models: Partial<Record<BlockKind, string>> = {};
  const scores: Record<string, number> = {};
  const unknown: string[] = [];
  let detectedInstrument: string | undefined;

  for (const clause of input.prompt.split(/[,.;:!?\n]+/)) {
    const tokens = words(clause);
    let negateUntil = -1;
    let scale = 1;
    let i = 0;
    while (i < tokens.length) {
      let entry: LexEntry | undefined;
      let n = Math.min(maxLen, tokens.length - i);
      for (; n > 0; n--) {
        entry = lex.get(tokens.slice(i, i + n).join(' '));
        if (entry) break;
      }
      if (!entry) {
        const t = tokens[i]!;
        const bare = t.replace(/'/g, '');
        if (negators.has(bare)) negateUntil = i + vocab.modifiers.negationWindow;
        else if (intens[t] !== undefined) scale = intens[t];
        else if (!stop.has(t) && !unknown.includes(t)) unknown.push(t);
        i++;
        continue;
      }
      if (entry.kind === 'instrument') {
        detectedInstrument = entry.id;
      } else {
        const term = vocab.terms[entry.key]!;
        const neg = i <= negateUntil;
        const sign = neg ? -1 : 1;
        if (!descriptors.includes(entry.key)) descriptors.push(entry.key);
        if (neg && !negated.includes(entry.key)) negated.push(entry.key);
        for (const [k, v] of Object.entries(term.deltas ?? {})) deltas[k] = Math.round(v * scale * sign);
        for (const [a, w] of Object.entries(term.archetypes ?? {})) scores[a] = (scores[a] ?? 0) + w * sign;
        for (const [b, on] of Object.entries(term.blocks ?? {})) blocks[b as BlockKind] = neg ? !on : on;
        if (!neg) {
          for (const [k, r] of Object.entries(term.targets ?? {})) targets[k] = [r[0], r[1]];
          for (const [b, m] of Object.entries(term.models ?? {})) models[b as BlockKind] = m;
        }
        negateUntil = -1;
      }
      scale = 1;
      i += n;
    }
  }

  const instrument = input.instrument ?? detectedInstrument;
  const profile = instrument ? instruments[instrument] : undefined;
  for (const [a, w] of Object.entries(profile?.archetypeBias ?? {})) scores[a] = (scores[a] ?? 0) + w;
  const positive = descriptors.filter((d) => !negated.includes(d));
  for (const [id, arch] of Object.entries(archetypes.archetypes)) {
    for (const m of arch.match ?? []) {
      const descOk = (m.descriptors ?? []).every((d) => positive.includes(d));
      const kindOk = !m.instrumentKind || (profile !== undefined && m.instrumentKind.includes(profile.kind));
      if (descOk && kindOk) scores[id] = (scores[id] ?? 0) + m.score;
    }
  }

  let archetype = archetypes.default;
  let best = 0;
  for (const id of Object.keys(archetypes.archetypes)) {
    const s = scores[id] ?? 0;
    if (s > best) {
      best = s;
      archetype = id;
    }
  }

  const intent: Intent = {
    archetype,
    descriptors,
    deltas,
    unknownTerms: unknown,
    source: 'parser',
    negated,
    targets,
    blocks,
    models,
    archetypeScores: scores,
  };
  if (instrument !== undefined) intent.instrument = instrument;
  return intent;
}
