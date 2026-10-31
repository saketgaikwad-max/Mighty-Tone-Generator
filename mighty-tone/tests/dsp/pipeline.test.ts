import { describe, expect, it } from 'vitest';
import { blendIrs } from '../../src/dsp/blend.ts';
import { firWls } from '../../src/dsp/firWls.ts';
import { normalise } from '../../src/dsp/normalise.ts';
import { prepareIr } from '../../src/dsp/pipeline.ts';
import { trimLeadingSilence, truncateTo } from '../../src/dsp/trim.ts';
import { handleIrPrepMessage } from '../../src/dsp/worker.ts';
import { encodeWav16, encodeWavFloat } from './wavHelpers.ts';

function peakAbs(x: Float32Array): number {
  let p = 0;
  for (const v of x) p = Math.max(p, Math.abs(v));
  return p;
}

describe('dsp/pipeline prepareIr', () => {
  it('Dirac delta @48k → 512-sample IR with energy near sample 0', () => {
    const dirac = new Float32Array(2048);
    dirac[0] = 1;
    const res = prepareIr(encodeWavFloat(dirac, 48000));
    expect(res.ir.length).toBe(512);
    expect(res.originalLength).toBe(2048);
    expect(res.originalSampleRate).toBe(48000);
    expect(res.trimmedSamples).toBe(0);
    let total = 0;
    let head = 0;
    for (let i = 0; i < res.ir.length; i++) {
      total += res.ir[i]! ** 2;
      if (i < 4) head += res.ir[i]! ** 2;
    }
    expect(head / total).toBeGreaterThan(0.99);
    expect(peakAbs(res.ir)).toBeCloseTo(0.99, 5);
    expect(res.log.length).toBeGreaterThan(0);
  });

  it('resamples a 44.1k input to 48k (length proportional)', () => {
    const src = new Float32Array(441).map((_, i) => Math.exp(-i / 40) * (i % 2 ? -1 : 1));
    const res = prepareIr(encodeWav16(src, 44100), { minPhase: false, trimThresholdDb: -200 });
    expect(res.originalSampleRate).toBe(44100);
    expect(res.log.some((l) => l.includes('44100 Hz → 48000 Hz (480 samples)'))).toBe(true);
    expect(res.ir.length).toBe(512);
  });

  it('reports trimmed leading samples', () => {
    const src = new Float32Array(1000);
    src[100] = 1;
    src[101] = 0.5;
    const res = prepareIr(encodeWavFloat(src, 48000), { minPhase: false });
    expect(res.trimmedSamples).toBe(100);
    expect(res.ir[0]).toBeCloseTo(0.99, 5);
  });

  it('blends with a second IR when provided', () => {
    const a = new Float32Array(100);
    a[0] = 1;
    const b = new Float32Array(100);
    b[0] = 1;
    b[1] = 1;
    const res = prepareIr(encodeWavFloat(a, 48000), { minPhase: false, blend: { b, mix: 0.5 } });
    expect(res.ir[0]).toBeCloseTo(0.99, 5);
    expect(res.ir[1]).toBeCloseTo(0.495, 4);
  });
});

describe('dsp/trim + normalise + fir + blend', () => {
  it('trimLeadingSilence removes leading zeros', () => {
    const ir = Float32Array.from([0, 0, 0, 0.8, 0.2, 0]);
    expect(Array.from(trimLeadingSilence(ir, -60))).toEqual(Array.from(ir.slice(3)));
  });

  it('truncateTo zero-pads and truncates', () => {
    expect(Array.from(truncateTo(Float32Array.from([1, 2]), 4))).toEqual([1, 2, 0, 0]);
    expect(Array.from(truncateTo(Float32Array.from([1, 2, 3]), 2))).toEqual([1, 2]);
  });

  it('normalise sets peak to target', () => {
    const out = normalise(Float32Array.from([0.1, -0.4, 0.2]), 0.9);
    expect(peakAbs(out)).toBeCloseTo(0.9, 6);
    expect(out[1]).toBeCloseTo(-0.9, 6);
  });

  it('firWls returns 512 taps matching the IR head', () => {
    const ir = new Float32Array(3000).map((_, i) => Math.exp(-i / 300) * Math.cos(i * 0.2));
    const fir = firWls(ir, 512, 48000);
    expect(fir.length).toBe(512);
    for (let i = 0; i < 512; i++) expect(fir[i]).toBeCloseTo(ir[i]!, 5);
  });

  it('blendIrs aligns peaks before crossfading', () => {
    const a = Float32Array.from([0, 0, 1, 0]);
    const b = Float32Array.from([1, 0, 0, 0, 0]);
    const out = blendIrs(a, b, 0.5);
    expect(out.length).toBe(5);
    expect(out[0]).toBeCloseTo(1, 6);
  });
});

describe('dsp/worker', () => {
  it('returns an error message for invalid WAV data', () => {
    const res = handleIrPrepMessage({ type: 'prepare', wav: new ArrayBuffer(4), options: {} });
    expect(res.type).toBe('error');
  });
});
