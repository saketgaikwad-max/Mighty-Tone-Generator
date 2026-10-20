import { describe, expect, it } from 'vitest';
import { fromMspatch, MSPATCH_LENGTH, toMspatch } from '../../src/codec/mspatch.ts';
import { base64ToBytes, buildQrString, bytesToBase64, parseQrString } from '../../src/codec/qr-string.ts';
import { synthPreset } from '../helpers.ts';

describe('QR string (R83)', () => {
  it('builds nux://MightyAmp: + base64([0x0F, 0x01] + 113 bytes) and parses it back', () => {
    const preset = synthPreset();
    const s = buildQrString(preset);
    expect(s.startsWith('nux://MightyAmp:')).toBe(true);
    const payload = base64ToBytes(s.slice('nux://MightyAmp:'.length));
    expect(payload.length).toBe(115);
    expect([payload[0], payload[1]]).toEqual([0x0f, 0x01]);
    const parsed = parseQrString(s);
    expect(parsed.ok && parsed.preset).toEqual(preset);
  });

  it('reports the reference error kinds', () => {
    const body = (bytes: number[]) => 'nux://MightyAmp:' + bytesToBase64(Uint8Array.from(bytes));
    const err = (s: string) => {
      const r = parseQrString(s);
      return r.ok ? 'ok' : r.error;
    };
    expect(err('https://example.com')).toBe('UnsupportedFormat');
    expect(err('nux://MightyAmp:%%%')).toBe('BadBase64');
    expect(err(body([14, 1, ...synthPreset()]))).toBe('WrongDevice');
    expect(err(body([15, 2, ...synthPreset()]))).toBe('WrongFWVersion');
    expect(err(body([15, 1, 1, 2, 3]))).toBe('BadLength');
  });
});

describe('.mspatch (UNIT-CODEC-02, matches converter.js)', () => {
  it('QR -> patch: 8404 bytes, preset at offset 4, everything else zero', () => {
    const preset = synthPreset();
    const file = toMspatch(preset);
    expect(file.length).toBe(MSPATCH_LENGTH);
    expect(file.length).toBe(8404);
    expect(Array.from(file.slice(0, 4))).toEqual([0, 0, 0, 0]);
    expect(file.slice(4, 117)).toEqual(preset);
    expect(file.slice(117).every((b) => b === 0)).toBe(true);
  });

  it('patch -> QR: header [0x0F, 0x01] + bytes 4..116', () => {
    const preset = synthPreset();
    const file = toMspatch(preset);
    file[200] = 9; // trailing data is ignored, as in converter.js
    expect(buildQrString(fromMspatch(file))).toBe(buildQrString(preset));
  });
});
