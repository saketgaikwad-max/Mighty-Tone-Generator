import { describe, expect, it } from 'vitest';
import { decodePreset, encodePreset } from '../../src/codec/preset.ts';
import { buildQrString, parseQrString } from '../../src/codec/qr-string.ts';
import { generateTone } from '../../src/engine/index.ts';

describe('engine/generateTone', () => {
  it('UNIT-ENG-I01 "warm jazz clean" returns a valid patch that round-trips through the codec', () => {
    const { patch, meta } = generateTone('warm jazz clean');
    expect(meta.archetype).toBe('jazz');
    expect(meta.unknownTerms).toEqual([]);
    expect(meta.confidence).toBeGreaterThan(0.5);
    expect(patch.device).toBe('mighty-space');
    expect(patch.raw).toHaveLength(113);

    const bytes = encodePreset(patch);
    expect(Array.from(bytes)).toEqual(Array.from(patch.raw));
    const again = decodePreset(bytes, patch.qrHeader);
    expect(again.blocks).toEqual(patch.blocks);
    expect(again.chain).toEqual(patch.chain);
    expect(again.master).toBe(patch.master);
    expect(again.name).toBe('Jazz');

    const qr = parseQrString(buildQrString(bytes));
    expect(qr.ok).toBe(true);
    if (qr.ok) expect(Array.from(qr.preset)).toEqual(Array.from(bytes));
  });

  it('UNIT-ENG-I02 every sample prompt round-trips byte-identically', () => {
    const prompts: [string, string?][] = [
      ['heavy scooped metal', 'electric-single-coil'],
      ['acoustic piezo'],
      ['bright crunch'],
      ['ambient lead with chorus'],
      ['mandolin'],
      ['acoustic mandolin'],
      ['not too bright, less harsh, dry funk'],
    ];
    for (const [prompt, instrument] of prompts) {
      const { patch } = generateTone(prompt, instrument);
      expect(Array.from(encodePreset(patch)), prompt).toEqual(Array.from(patch.raw));
    }
  });

  it('UNIT-ENG-I03 surfaces unknown terms and lowers confidence for them', () => {
    const known = generateTone('warm clean').meta;
    const fuzzy = generateTone('warm clean zorbly flux').meta;
    expect(fuzzy.unknownTerms).toEqual(['zorbly', 'flux']);
    expect(fuzzy.confidence).toBeLessThan(known.confidence);
  });
});
