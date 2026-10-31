import { describe, expect, it } from 'vitest';
import { resample } from '../../src/dsp/resample.ts';
import { decodeWav, toMono } from '../../src/dsp/wav.ts';
import { encodeWav16, encodeWavFloat } from './wavHelpers.ts';

describe('dsp/wav', () => {
  it('decodes a synthetic 16-bit mono WAV with correct rate and sample count', () => {
    const src = new Float32Array(1000).map((_, i) => Math.sin((2 * Math.PI * i) / 50) * 0.5);
    const { samples, sampleRate, channels } = decodeWav(encodeWav16(src, 44100));
    expect(sampleRate).toBe(44100);
    expect(channels).toBe(1);
    expect(samples.length).toBe(1000);
    for (let i = 0; i < src.length; i++) expect(samples[i]).toBeCloseTo(src[i]!, 3);
  });

  it('decodes a 32-bit float WAV losslessly', () => {
    const src = Float32Array.from([0, 0.25, -0.75, 1, -1]);
    const { samples } = decodeWav(encodeWavFloat(src, 48000));
    expect(Array.from(samples)).toEqual(Array.from(src));
  });

  it('rejects non-WAV input', () => {
    const junk = new TextEncoder().encode('definitely not a wav file').buffer;
    expect(() => decodeWav(junk as ArrayBuffer)).toThrow(/Not a WAV/);
  });

  it('toMono averages interleaved channels', () => {
    const stereo = Float32Array.from([1, 0, 0.5, 0.5, -1, 1]);
    expect(Array.from(toMono(stereo, 2))).toEqual([0.5, 0.5, 0]);
  });

  it('decodes stereo 16-bit and reports channel count', () => {
    const stereo = Float32Array.from([0.5, -0.5, 0.25, -0.25]);
    const decoded = decodeWav(encodeWav16(stereo, 48000, 2));
    expect(decoded.channels).toBe(2);
    expect(toMono(decoded.samples, 2).length).toBe(2);
  });
});

describe('dsp/resample', () => {
  it('resamples 44.1k → 48k with proportional length', () => {
    const out = resample(new Float32Array(4410), 44100, 48000);
    expect(out.length).toBe(4800);
  });

  it('preserves a DC signal', () => {
    const out = resample(new Float32Array(100).fill(0.3), 96000, 48000);
    expect(out.length).toBe(50);
    for (const v of out) expect(v).toBeCloseTo(0.3, 6);
  });
});
