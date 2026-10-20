import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { describePatch } from '../../src/codec/describe.ts';
import { decodePreset, encodePreset, unmodelledDiff } from '../../src/codec/preset.ts';
import { buildQrString, parseQrString } from '../../src/codec/qr-string.ts';
import { fromMspatch, toMspatch } from '../../src/codec/mspatch.ts';
import { decodeQrImage } from '../../src/qr/decode-image.ts';

const dir = join(import.meta.dirname, '..', 'fixtures', 'qr');
const names = readdirSync(dir)
  .filter((f) => f.endsWith('.expected.json'))
  .map((f) => f.replace('.expected.json', ''))
  .sort();

function load(name: string) {
  const text = readFileSync(join(dir, `${name}.txt`), 'utf8').trim();
  const expected = JSON.parse(readFileSync(join(dir, `${name}.expected.json`), 'utf8'));
  const parsed = parseQrString(text);
  if (!parsed.ok) throw new Error(`${name}: ${parsed.error}`);
  return { text, expected, preset: parsed.preset, patch: decodePreset(parsed.preset, parsed.header) };
}

describe('real MightyAmp fixtures', () => {
  it('has at least 3 real fixtures (R90)', () => {
    expect(names).toEqual(['acoustic-ir-tone', 'clean-tone', 'gain-responsive-distortion']);
  });

  describe.each(names)('%s', (name) => {
    it('GOLD-003 the screenshot PNG decodes to the stored QR text', () => {
      const png = PNG.sync.read(readFileSync(join(dir, `${name}.png`)));
      const result = decodeQrImage({ data: new Uint8ClampedArray(png.data), width: png.width, height: png.height });
      expect(result?.text).toBe(load(name).text);
    });

    it('GOLD-001 decodes to what the app shows (confirmed) and to the pinned snapshot', () => {
      const { patch, expected } = load(name);
      const d = describePatch(patch);
      expect(patch.warnings).toEqual([]);
      expect(d.chain).toEqual(expected.confirmed.chain);
      expect(d.blocks).toMatchObject(expected.confirmed.blocks);
      expect(JSON.parse(JSON.stringify(d))).toEqual(expected.decoded);
    });

    it('GOLD-006 decode -> encode is byte-identical, QR string included (R86)', () => {
      const { text, preset, patch } = load(name);
      const encoded = encodePreset(patch);
      expect(encoded).toEqual(preset);
      expect(unmodelledDiff(preset, encoded)).toEqual([]);
      expect(buildQrString(encoded)).toBe(text);
    });

    it('UNIT-CODEC-02 survives a .mspatch round trip', () => {
      const { text, preset } = load(name);
      expect(buildQrString(fromMspatch(toMspatch(preset)))).toBe(text);
    });
  });

  it('GOLD-004 the user-IR fixture decodes to user IR slot 3 with the user-confirmed knob values', () => {
    const d = describePatch(load('acoustic-ir-tone').patch);
    expect(d.blocks.cab).toMatchObject({
      userIrSlot: 3,
      enabled: true,
      params: { Level: '6', 'Low Cut': '31', 'High Cut': '14142' },
    });
  });

  it('chain order differs per preset and is stored per patch', () => {
    const chains = names.map((n) => load(n).patch.chain.join(','));
    expect(new Set(chains).size).toBe(names.length);
  });

  it('records what the official app writes: no name bytes and master byte 0', () => {
    for (const n of names) {
      const { patch } = load(n);
      expect(patch.name).toBe('');
      expect(patch.master).toBe(0);
      expect(patch.chainOffset).toBe(0);
    }
  });
});
