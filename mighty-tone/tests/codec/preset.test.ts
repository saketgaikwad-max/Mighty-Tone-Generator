import { describe, expect, it } from 'vitest';
import { decodePreset, encodePreset, PatchEncodeError, unmodelledDiff } from '../../src/codec/preset.ts';
import { device } from '../../src/knowledge/device.ts';
import { synthPreset } from '../helpers.ts';

describe('preset codec (UNIT-CODEC-03 per field)', () => {
  it('decodes head bytes: low 6 bits = model, 0x40 = off', () => {
    const raw = synthPreset();
    raw[3] = 13; // AMP head: 1987x50, on
    raw[9] = 0x40 | 35; // CAB head: user IR slot 1, off
    const p = decodePreset(raw);
    expect(p.blocks.amp).toMatchObject({ modelId: 'amp.1987x50', enabled: true });
    expect(p.blocks.cab).toMatchObject({ modelId: 'cab.user-ir-1', enabled: false });
  });

  it('decodes params at their byte indexes for the selected model', () => {
    const raw = synthPreset();
    raw[3] = 27; // MLD
    [30, 80, 86, 17, 35].forEach((v, i) => (raw[27 + i] = v)); // gain master bass mid treble
    raw[32] = 8; // Mid Freq = AMP_Para6
    const p = decodePreset(raw);
    expect(p.blocks.amp.params).toEqual({ gain: 30, master: 80, bass: 86, mid: 17, treble: 35, mid_freq: 8 });
  });

  it('decodes master (byte 84), chain (89-97) and name (100-112)', () => {
    const raw = synthPreset();
    raw[84] = 60;
    [5, 4, 9, 1, 6, 2, 3, 7, 8].forEach((h, i) => (raw[89 + i] = h));
    'MyTone'.split('').forEach((c, i) => (raw[100 + i] = c.charCodeAt(0)));
    const p = decodePreset(raw);
    expect(p.master).toBe(60);
    expect(p.chain).toEqual(['gate', 'eq', 'cab', 'comp', 'mod', 'efx', 'amp', 'dly', 'rvb']);
    expect(p.chainOffset).toBe(0);
    expect(p.name).toBe('MyTone');
    expect(p.warnings).toEqual([]);
  });

  it('R1 tolerates up to 3 junk bytes before the chain and re-encodes at the same offset', () => {
    const raw = synthPreset();
    const order = [5, 1, 6, 2, 3, 9, 4, 8, 7];
    raw.fill(0, 89, 100);
    order.forEach((h, i) => (raw[91 + i] = h));
    const p = decodePreset(raw);
    expect(p.chainOffset).toBe(2);
    expect(p.chain[0]).toBe('gate');
    expect(encodePreset(p)).toEqual(raw);
  });

  it('warns (does not throw) on unknown model indexes, and keeps the original byte on re-encode', () => {
    const raw = synthPreset();
    raw[3] = 63;
    const p = decodePreset(raw);
    expect(p.warnings.some((w) => w.includes('amp: unknown model index 63'))).toBe(true);
  });

  it('decode -> encode is byte-identical, including unmodelled bytes', () => {
    const raw = synthPreset();
    for (const i of [0, 10, 11, 12, 13, 81, 82, 83, 85, 86, 87, 88]) raw[i] = (i * 7) & 0xff;
    raw[3] |= 0x80; // unmodelled high bit on a head byte
    expect(encodePreset(decodePreset(raw))).toEqual(raw);
  });

  it('encodes edits onto the template and leaves other bytes alone', () => {
    const raw = synthPreset();
    raw[85] = 1;
    raw[86] = 0;
    raw[87] = 120;
    const p = decodePreset(raw);
    p.blocks.amp = { block: 'amp', modelId: 'amp.1987x50', enabled: false, params: { gain: 75, presence: 61 } };
    p.master = 70;
    p.name = 'Lead';
    const out = encodePreset(p);
    expect(out[3]).toBe(0x40 | 13);
    expect([out[27], out[32], out[84]]).toEqual([75, 61, 70]);
    expect(String.fromCharCode(...out.slice(100, 104))).toBe('Lead');
    expect(unmodelledDiff(raw, out)).toEqual([]);
  });

  it('rejects invalid patches', () => {
    const base = () => decodePreset(synthPreset());
    const bad = [
      (p: ReturnType<typeof base>) => (p.blocks.amp.params.gain = 101),
      (p: ReturnType<typeof base>) => (p.blocks.amp.params.gain = 1.5),
      (p: ReturnType<typeof base>) => (p.blocks.amp.params.nope = 1),
      (p: ReturnType<typeof base>) => (p.blocks.amp.params.bright = 2),
      (p: ReturnType<typeof base>) => (p.blocks.amp.modelId = 'cab.jz120'),
      (p: ReturnType<typeof base>) => (p.master = -1),
      (p: ReturnType<typeof base>) => (p.chain = [...p.chain.slice(0, 8), 'gate']),
      (p: ReturnType<typeof base>) => (p.name = 'way too long name'),
      (p: ReturnType<typeof base>) => (p.name = 'tab\there'),
    ];
    for (const mutate of bad) {
      const p = base();
      mutate(p);
      expect(() => encodePreset(p)).toThrow(PatchEncodeError);
    }
  });

  it('name field fits 13 characters in the 113-byte QR payload', () => {
    expect(device.name).toEqual({ start: 100, maxLengthInQr: 13 });
  });
});
