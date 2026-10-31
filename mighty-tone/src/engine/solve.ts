import { BLOCK_KINDS, type BlockKind } from '../contracts/blocks.ts';
import type { DeviceKnowledge, ModelDef } from '../contracts/device.ts';
import type { BlockState, Patch } from '../contracts/patch.ts';
import { decodePreset, encodePreset } from '../codec/preset.ts';
import { parseQrString } from '../codec/qr-string.ts';
import { device as defaultDevice } from '../knowledge/device.ts';
import {
  engineKnowledge,
  type Action,
  type Archetype,
  type Condition,
  type EngineKnowledge,
  type InstrumentProfile,
  type ParamKey,
} from './knowledge.ts';
import type { Intent } from './parse.ts';

export interface SolveResult {
  patch: Patch;
  /** Ids of instrument corrections (`INST:<id>`) and rules that fired, in application order. */
  ruleTrace: string[];
  archetype: string;
  confidence: number;
}

interface Ctx {
  intent: Intent;
  archetypeId: string;
  profile: InstrumentProfile | undefined;
  blocks: Record<BlockKind, BlockState>;
  models: Map<string, ModelDef>;
  kb: EngineKnowledge;
  warnings: string[];
}

function modelIndex(device: DeviceKnowledge): Map<string, ModelDef> {
  const m = new Map<string, ModelDef>();
  for (const b of BLOCK_KINDS) for (const def of device.blocks[b].models) m.set(def.id, def);
  return m;
}

function loadTemplate(kb: EngineKnowledge, id: string): Patch {
  const t = kb.templates[id];
  if (!t) throw new Error(`unknown template "${id}"`);
  const parsed = parseQrString(t.qr);
  if (!parsed.ok) throw new Error(`template "${id}": ${parsed.error} (${parsed.detail})`);
  return decodePreset(parsed.preset, parsed.header);
}

function blockOf(key: ParamKey): BlockKind {
  return key.slice(0, key.indexOf('.')) as BlockKind;
}

/** Model-specific param name for a canonical key, or undefined when the block's current model lacks it. */
function resolve(ctx: Ctx, key: ParamKey): { state: BlockState; def: ModelDef['params'][number] } | undefined {
  const block = blockOf(key);
  const state = ctx.blocks[block];
  if (!state) return undefined;
  const model = ctx.models.get(state.modelId)!;
  const names = ctx.kb.vocabulary.paramAliases[key] ?? [key.slice(key.indexOf('.') + 1)];
  for (const n of names) {
    const def = model.params.find((p) => p.key === n);
    if (def) return { state, def };
  }
  return undefined;
}

function read(ctx: Ctx, key: ParamKey): number | undefined {
  const r = resolve(ctx, key);
  return r ? r.state.params[r.def.key] : undefined;
}

function write(ctx: Ctx, key: ParamKey, value: number | ((cur: number) => number)): void {
  const r = resolve(ctx, key);
  if (!r) return;
  const cur = r.state.params[r.def.key] ?? r.def.default;
  const v = typeof value === 'function' ? value(cur) : value;
  if (r.def.switch) {
    const allowed = r.def.switch.values;
    r.state.params[r.def.key] = allowed.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), allowed[0]!);
  } else {
    r.state.params[r.def.key] = Math.min(100, Math.max(0, Math.round(v)));
  }
}

function setModel(ctx: Ctx, block: BlockKind, id: string): void {
  const model = ctx.models.get(id);
  if (!model || model.block !== block) throw new Error(`${block}: unknown model "${id}"`);
  const params: Record<string, number> = {};
  for (const p of model.params) params[p.key] = p.default;
  ctx.blocks[block] = { block, modelId: id, enabled: ctx.blocks[block]?.enabled ?? false, params };
}

function test(ctx: Ctx, c: Condition): boolean {
  if ('all' in c) return c.all.every((x) => test(ctx, x));
  if ('any' in c) return c.any.some((x) => test(ctx, x));
  if ('not' in c) return !test(ctx, c.not);
  if ('param' in c) {
    const v = read(ctx, c.param);
    if (v === undefined || !ctx.blocks[blockOf(c.param)].enabled) return false;
    return (
      (c.gt === undefined || v > c.gt) &&
      (c.gte === undefined || v >= c.gte) &&
      (c.lt === undefined || v < c.lt) &&
      (c.lte === undefined || v <= c.lte)
    );
  }
  if ('archetype' in c) return c.archetype.includes(ctx.archetypeId);
  if ('instrument' in c) return ctx.intent.instrument !== undefined && c.instrument.includes(ctx.intent.instrument);
  if ('instrumentKind' in c) return ctx.profile !== undefined && c.instrumentKind.includes(ctx.profile.kind);
  if ('pickup' in c) return ctx.profile !== undefined && c.pickup.includes(ctx.profile.pickup);
  if ('descriptor' in c) {
    const neg = ctx.intent.negated ?? [];
    return c.descriptor.some((d) => ctx.intent.descriptors.includes(d) && !neg.includes(d));
  }
  if ('enabled' in c) return ctx.blocks[c.enabled].enabled;
  if ('disabled' in c) return !ctx.blocks[c.disabled].enabled;
  if ('modelPrefix' in c) {
    return Object.entries(c.modelPrefix).every(([b, prefix]) => ctx.blocks[b as BlockKind].modelId.startsWith(prefix));
  }
  throw new Error(`unknown rule condition ${JSON.stringify(c)}`);
}

function act(ctx: Ctx, a: Action): void {
  if ('set' in a) for (const [k, v] of Object.entries(a.set)) write(ctx, k, v);
  else if ('add' in a) for (const [k, v] of Object.entries(a.add)) write(ctx, k, (cur) => cur + v);
  else if ('min' in a) for (const [k, v] of Object.entries(a.min)) write(ctx, k, (cur) => Math.max(cur, v));
  else if ('max' in a) for (const [k, v] of Object.entries(a.max)) write(ctx, k, (cur) => Math.min(cur, v));
  else if ('enable' in a) for (const b of a.enable) ctx.blocks[b].enabled = true;
  else if ('disable' in a) for (const b of a.disable) ctx.blocks[b].enabled = false;
  else if ('warn' in a) {
    if (!ctx.warnings.includes(a.warn)) ctx.warnings.push(a.warn);
  } else throw new Error(`unknown rule action ${JSON.stringify(a)}`);
}

function confidenceOf(kb: EngineKnowledge, intent: Intent, ctx: Ctx): number {
  const w = kb.archetypes.confidence;
  let c = w.base + Math.min(w.descriptorCap, w.perDescriptor * intent.descriptors.length);
  if ((intent.archetypeScores?.[ctx.archetypeId] ?? 0) > 0) c += w.archetypeMatched;
  if (ctx.profile) c += w.instrumentKnown;
  c -= w.perUnknownTerm * intent.unknownTerms.length + w.perWarning * ctx.warnings.length;
  return Math.round(Math.min(1, Math.max(0, c)) * 100) / 100;
}

/**
 * Intent -> Patch. Order: archetype models/chain + priors, vocabulary deltas and target bands, instrument
 * corrections, expert rules; then the result is encoded over the archetype's real-fixture template.
 */
export function solve(
  intent: Intent,
  device: DeviceKnowledge = defaultDevice,
  kb: EngineKnowledge = engineKnowledge,
): SolveResult {
  const archetypeId = kb.archetypes.archetypes[intent.archetype] ? intent.archetype : kb.archetypes.default;
  const arch: Archetype = kb.archetypes.archetypes[archetypeId]!;
  const template = loadTemplate(kb, arch.template);
  const profile = intent.instrument ? kb.instruments[intent.instrument] : undefined;
  const groups = (profile?.corrections ?? []).filter((g) => !g.archetypes || g.archetypes.includes(archetypeId));
  const ruleTrace: string[] = [];
  const warnings: string[] = [];
  if (intent.instrument && !profile) warnings.push(`Unknown instrument "${intent.instrument}"; no corrections applied.`);

  const ctx: Ctx = {
    intent,
    archetypeId,
    profile,
    blocks: {} as Record<BlockKind, BlockState>,
    models: modelIndex(device),
    kb,
    warnings,
  };

  for (const block of BLOCK_KINDS) {
    let id = arch.models[block]?.[0] ?? template.blocks[block].modelId;
    for (const g of groups) id = g.models?.[block] ?? id;
    id = intent.models?.[block] ?? id;
    setModel(ctx, block, id);
    ctx.blocks[block].enabled = arch.chain[block] ?? template.blocks[block].enabled;
  }
  for (const [k, v] of Object.entries(arch.paramPriors)) write(ctx, k, v);

  for (const [b, on] of Object.entries(intent.blocks ?? {})) ctx.blocks[b as BlockKind].enabled = on;
  for (const [k, d] of Object.entries(intent.deltas)) write(ctx, k, (cur) => cur + d);
  for (const [k, [lo, hi]] of Object.entries(intent.targets ?? {})) {
    write(ctx, k, (cur) => Math.min(hi, Math.max(lo, cur)));
  }

  if (profile) {
    for (const g of groups) {
      for (const b of g.enable ?? []) ctx.blocks[b].enabled = true;
      for (const [k, d] of Object.entries(g.deltas ?? {})) write(ctx, k, (cur) => cur + d);
    }
    ruleTrace.push(`INST:${intent.instrument}`);
  }

  for (const rule of kb.rules) {
    if (!test(ctx, rule.condition)) continue;
    for (const a of rule.action) act(ctx, a);
    ruleTrace.push(rule.id);
  }

  const draft: Patch = {
    ...template,
    blocks: ctx.blocks,
    master: arch.master,
    name: arch.name.slice(0, device.name.maxLengthInQr),
    warnings: [],
  };
  const bytes = encodePreset(draft, template.raw);
  const patch = decodePreset(bytes, template.qrHeader);
  patch.warnings.push(...warnings);

  return { patch, ruleTrace, archetype: archetypeId, confidence: confidenceOf(kb, intent, ctx) };
}
