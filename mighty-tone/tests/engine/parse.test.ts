import { describe, expect, it } from 'vitest';
import { parse } from '../../src/engine/parse.ts';

describe('engine/parse', () => {
  it('UNIT-ENG-P01 "warm jazz clean" -> jazz with warm deltas and a clean gain band', () => {
    const i = parse({ prompt: 'warm jazz clean' });
    expect(i.archetype).toBe('jazz');
    expect(i.descriptors).toEqual(['warm', 'jazz', 'clean']);
    expect(i.deltas['amp.bass']).toBe(10);
    expect(i.deltas['amp.gain']).toBe(-5);
    expect(i.deltas['amp.treble']).toBe(-6);
    expect(i.targets?.['amp.gain']).toEqual([20, 35]);
    expect(i.unknownTerms).toEqual([]);
    expect(i.source).toBe('parser');
  });

  it('UNIT-ENG-P02 "heavy scooped metal" -> high-gain with a mid scoop', () => {
    const i = parse({ prompt: 'heavy scooped metal' });
    expect(i.archetype).toBe('high-gain');
    expect(i.descriptors).toEqual(['high-gain', 'scooped', 'metal']);
    expect(i.deltas['amp.mid']).toBe(-20);
    expect(i.targets?.['amp.gain']).toEqual([80, 95]);
  });

  it('UNIT-ENG-P03 "acoustic piezo" -> acoustic archetype and piezo instrument', () => {
    const i = parse({ prompt: 'acoustic piezo' });
    expect(i.archetype).toBe('acoustic');
    expect(i.instrument).toBe('acoustic-piezo');
    expect(i.unknownTerms).toEqual([]);
  });

  it('UNIT-ENG-P04 "bright crunch" -> crunch with treble/presence up', () => {
    const i = parse({ prompt: 'bright crunch' });
    expect(i.archetype).toBe('crunch');
    expect(i.deltas['amp.treble']).toBe(12);
    expect(i.deltas['amp.presence']).toBe(8);
    expect(i.targets?.['amp.gain']).toEqual([50, 65]);
  });

  it('UNIT-ENG-P05 negation inverts deltas: "not too bright", "less harsh"', () => {
    const a = parse({ prompt: 'not too bright' });
    expect(a.negated).toEqual(['bright']);
    expect(a.deltas['amp.treble']).toBe(-12);
    const b = parse({ prompt: 'less harsh' });
    expect(b.negated).toEqual(['harsh']);
    expect(b.deltas['amp.presence']).toBe(-10);
    expect(b.deltas['cab.hicut']).toBe(-10);
  });

  it('UNIT-ENG-P06 negation turns blocks off and is bounded by punctuation', () => {
    const i = parse({ prompt: 'no reverb, chorus' });
    expect(i.blocks).toEqual({ rvb: false, mod: true });
    expect(i.negated).toEqual(['reverb']);
    expect(i.models?.mod).toBe('mod.ce-2');
  });

  it('UNIT-ENG-P07 unknown words pass through to unknownTerms; stopwords do not', () => {
    const i = parse({ prompt: 'a warm tone with zorbly flux for my guitar' });
    expect(i.descriptors).toEqual(['warm']);
    expect(i.unknownTerms).toEqual(['zorbly', 'flux']);
  });

  it('UNIT-ENG-P08 synonyms map to the canonical descriptor', () => {
    expect(parse({ prompt: 'mellow' }).descriptors).toEqual(['warm']);
    expect(parse({ prompt: 'smooth' }).descriptors).toEqual(['warm']);
    expect(parse({ prompt: 'hi gain' }).descriptors).toEqual(['high-gain']);
  });

  it('UNIT-ENG-P09 intensifiers scale deltas', () => {
    expect(parse({ prompt: 'very warm' }).deltas['amp.bass']).toBe(15);
    expect(parse({ prompt: 'slightly warm' }).deltas['amp.bass']).toBe(5);
  });

  it('UNIT-ENG-P10 later descriptors win on a shared parameter', () => {
    expect(parse({ prompt: 'warm bright' }).deltas['amp.treble']).toBe(12);
    expect(parse({ prompt: 'bright warm' }).deltas['amp.treble']).toBe(-8);
  });

  it('UNIT-ENG-P11 mandolin instrument steers archetype; "acoustic" + mandolin -> mandolin-acoustic', () => {
    const e = parse({ prompt: 'mandolin' });
    expect(e.instrument).toBe('mandolin-magnetic');
    expect(e.archetype).toBe('mandolin-electric');
    expect(parse({ prompt: 'acoustic tone for my mandolin' }).archetype).toBe('mandolin-acoustic');
    expect(parse({ prompt: 'acoustic mandolin' }).instrument).toBe('mandolin-acoustic');
  });

  it('UNIT-ENG-P12 explicit instrument overrides one detected in the prompt', () => {
    const i = parse({ prompt: 'strat crunch', instrument: 'electric-humbucker' });
    expect(i.instrument).toBe('electric-humbucker');
  });

  it('UNIT-ENG-P13 empty / unmatched prompt falls back to the default archetype', () => {
    expect(parse({ prompt: '' }).archetype).toBe('clean');
    expect(parse({ prompt: 'qwerty' }).archetype).toBe('clean');
  });
});
