import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLOCK_KINDS } from '../../src/contracts/blocks.ts';
import { engineKnowledge } from '../../src/engine/knowledge.ts';
import { parse, type Intent } from '../../src/engine/parse.ts';
import { solve } from '../../src/engine/solve.ts';
import { modelById } from '../../src/knowledge/device.ts';

const intent = (archetype: string, extra: Partial<Intent> = {}): Intent => ({
  archetype,
  descriptors: [],
  deltas: {},
  unknownTerms: [],
  source: 'parser',
  ...extra,
});

describe('engine/solve', () => {
  it('UNIT-ENG-S01 clean intent produces amp gain < 40', () => {
    const { patch, archetype } = solve(parse({ prompt: 'warm jazz clean' }));
    expect(archetype).toBe('jazz');
    expect(patch.blocks.amp.enabled).toBe(true);
    expect(patch.blocks.amp.params.gain).toBeLessThan(40);
    expect(patch.blocks.efx.enabled).toBe(false);
    expect(solve(intent('clean', { deltas: { 'amp.gain': 40 } })).patch.blocks.amp.params.gain).toBe(40);
  });

  it('UNIT-ENG-S02 high-gain intent produces amp gain > 70 and an active gate', () => {
    const { patch, ruleTrace } = solve(parse({ prompt: 'heavy scooped metal' }));
    expect(patch.blocks.amp.modelId).toBe('amp.dual-rect');
    expect(patch.blocks.amp.params.gain).toBeGreaterThan(70);
    expect(patch.blocks.amp.params.mid).toBe(25);
    expect(patch.blocks.gate.enabled).toBe(true);
    expect(ruleTrace).toContain('R-GATE-HG');
  });

  it('UNIT-ENG-S03 acoustic intent disables the amp and uses an IR cab', () => {
    const { patch, ruleTrace } = solve(parse({ prompt: 'acoustic piezo' }));
    expect(patch.blocks.amp.enabled).toBe(false);
    expect(patch.blocks.cab.modelId).toBe('cab.user-ir-3');
    expect(patch.blocks.eq.modelId).toBe('eq.10-band');
    expect(patch.blocks.eq.params.eq_b7).toBeLessThan(50);
    expect(ruleTrace).toEqual(['INST:acoustic-piezo', 'R-USER-IR-NOTE', 'R-PIEZO-LOWCUT']);
    expect(patch.warnings.some((w) => w.includes('User IR'))).toBe(true);
  });

  it('UNIT-ENG-S04 R-MUD fires when bass and gain are both high', () => {
    const { patch, ruleTrace } = solve(intent('crunch', { deltas: { 'amp.bass': 30, 'amp.gain': 10 } }));
    expect(ruleTrace).toContain('R-MUD');
    expect(patch.blocks.amp.params.bass).toBe(60);
    expect(solve(intent('crunch', { deltas: { 'amp.bass': 30 } })).ruleTrace).not.toContain('R-MUD');
  });

  it('UNIT-ENG-S05 high-gain + single coil raises gate sensitivity to 60', () => {
    const { patch, ruleTrace } = solve(parse({ prompt: 'metal', instrument: 'electric-single-coil' }));
    expect(ruleTrace).toContain('R-GATE-HG-SC');
    expect(patch.blocks.gate.params.sensitivity).toBe(60);
  });

  it('UNIT-ENG-S06 delay + reverb pulls reverb mix down by 15, except for ambient', () => {
    const lead = solve(intent('lead'));
    expect(lead.ruleTrace).toContain('R-DLY-RVB-CLARITY');
    expect(lead.patch.blocks.rvb.params.level).toBe(7);
    expect(solve(parse({ prompt: 'ambient lead' })).ruleTrace).not.toContain('R-DLY-RVB-CLARITY');
  });

  it('UNIT-ENG-S07 acoustic instrument on an electric amp warns', () => {
    const { patch, ruleTrace } = solve(parse({ prompt: 'crunch', instrument: 'acoustic-piezo' }));
    expect(ruleTrace).toContain('R-ACOUSTIC-AMP-WARN');
    expect(patch.warnings.some((w) => w.includes('electric amp'))).toBe(true);
  });

  it('UNIT-ENG-S08 mandolin rules: low cut >= ~100 Hz, light gate, no bass boost', () => {
    const { patch, ruleTrace } = solve(parse({ prompt: 'warm mandolin' }));
    expect(patch.blocks.cab.params.lowcut).toBeGreaterThanOrEqual(29);
    expect(patch.blocks.gate.params.sensitivity).toBeLessThanOrEqual(25);
    expect(patch.blocks.amp.params.bass).toBeLessThanOrEqual(50);
    expect(ruleTrace).toContain('R-MANDOLIN-LOWCUT');
  });

  it('UNIT-ENG-S09 is deterministic', () => {
    const a = solve(parse({ prompt: 'bright crunch with delay' })).patch.raw;
    const b = solve(parse({ prompt: 'bright crunch with delay' })).patch.raw;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('UNIT-ENG-S10 every block of every archetype encodes to a valid patch', () => {
    for (const id of Object.keys(engineKnowledge.archetypes.archetypes)) {
      const { patch, confidence } = solve(intent(id));
      expect(patch.warnings.filter((w) => !w.includes('User IR'))).toEqual([]);
      expect(patch.chain).toHaveLength(9);
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe('engine knowledge references', () => {
  const kb = engineKnowledge;

  it('UNIT-ENG-K01 every referenced model id exists on the device and in the right block', () => {
    const refs: [string, string][] = [];
    for (const a of Object.values(kb.archetypes.archetypes)) {
      for (const [b, ids] of Object.entries(a.models)) for (const id of ids) refs.push([b, id]);
    }
    for (const t of Object.values(kb.vocabulary.terms)) for (const [b, id] of Object.entries(t.models ?? {})) refs.push([b, id]);
    for (const inst of Object.values(kb.instruments)) {
      for (const g of inst.corrections) for (const [b, id] of Object.entries(g.models ?? {})) refs.push([b, id]);
    }
    for (const [block, id] of refs) expect(modelById(id)?.block, id).toBe(block);
  });

  it('UNIT-ENG-K02 at least 30 descriptors, 8 archetypes, 7 instruments, 12 rules with rationale', () => {
    expect(Object.keys(kb.vocabulary.terms).length).toBeGreaterThanOrEqual(30);
    expect(Object.keys(kb.archetypes.archetypes)).toEqual(
      expect.arrayContaining(['clean', 'crunch', 'lead', 'high-gain', 'acoustic', 'jazz', 'mandolin-electric', 'mandolin-acoustic']),
    );
    expect(Object.keys(kb.instruments)).toHaveLength(7);
    expect(kb.rules.length).toBeGreaterThanOrEqual(12);
    expect(new Set(kb.rules.map((r) => r.id)).size).toBe(kb.rules.length);
    for (const r of kb.rules) expect(r.rationale.length, r.id).toBeGreaterThan(10);
  });

  it('UNIT-ENG-K03 every canonical param key resolves on at least one model of its block', () => {
    const keys = new Set<string>();
    for (const a of Object.values(kb.archetypes.archetypes)) for (const k of Object.keys(a.paramPriors)) keys.add(k);
    for (const t of Object.values(kb.vocabulary.terms)) {
      for (const k of Object.keys({ ...t.deltas, ...t.targets })) keys.add(k);
    }
    for (const inst of Object.values(kb.instruments)) {
      for (const g of inst.corrections) for (const k of Object.keys(g.deltas ?? {})) keys.add(k);
    }
    for (const key of keys) {
      const [block, name] = key.split('.') as [string, string];
      expect(BLOCK_KINDS as readonly string[], key).toContain(block);
      const names = kb.vocabulary.paramAliases[key] ?? [name];
      const models = Object.values(kb.archetypes.archetypes).flatMap((a) => a.models[block as never] ?? []);
      const found = models.some((id) => modelById(id)!.params.some((p) => names.includes(p.key)));
      expect(found, key).toBe(true);
    }
  });

  it('UNIT-ENG-K04 templates match the real QR fixtures verbatim', () => {
    for (const [id, t] of Object.entries(kb.templates)) {
      expect(t.qr, id).toBe(readFileSync(new URL(`../../${t.fixture}`, import.meta.url), 'utf8').trim());
    }
  });
});
