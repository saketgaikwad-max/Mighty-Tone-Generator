import { describe, expect, it } from 'vitest';
import { fft, ifft, magnitude } from '../../src/dsp/fft.ts';
import { toMinPhase } from '../../src/dsp/minphase.ts';

describe('dsp/fft', () => {
  it('pure sine peaks at the correct bin', () => {
    const n = 256;
    const bin = 17;
    const re = new Float64Array(n).map((_, i) => Math.sin((2 * Math.PI * bin * i) / n));
    const im = new Float64Array(n);
    fft(re, im);
    const mag = magnitude(re, im);
    let peak = 0;
    for (let k = 1; k < n / 2; k++) if (mag[k]! > mag[peak]!) peak = k;
    expect(peak).toBe(bin);
    expect(mag[bin]).toBeCloseTo(n / 2, 6);
  });

  it('IFFT(FFT(x)) ≈ x within 1e-9', () => {
    const n = 1024;
    const x = new Float64Array(n).map((_, i) => Math.sin(i * 0.37) + Math.cos(i * 1.3) * 0.2);
    const re = x.slice();
    const im = new Float64Array(n);
    fft(re, im);
    ifft(re, im);
    for (let i = 0; i < n; i++) {
      expect(Math.abs(re[i]! - x[i]!)).toBeLessThan(1e-9);
      expect(Math.abs(im[i]!)).toBeLessThan(1e-9);
    }
  });

  it('rejects non power-of-2 lengths', () => {
    expect(() => fft(new Float64Array(6), new Float64Array(6))).toThrow(/power of 2/);
  });
});

describe('dsp/minphase', () => {
  it('moves the energy of a delayed impulse to the start', () => {
    const ir = new Float32Array(64);
    ir[20] = 1;
    const mp = toMinPhase(ir);
    expect(mp.length).toBe(64);
    expect(Math.abs(mp[0]!)).toBeCloseTo(1, 4);
    let tail = 0;
    for (let i = 1; i < mp.length; i++) tail += mp[i]! * mp[i]!;
    expect(tail).toBeLessThan(1e-6);
  });
});
