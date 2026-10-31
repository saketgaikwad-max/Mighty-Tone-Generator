/** Linear-interpolation resampler. Output length is round(n * toRate / fromRate). */
export function resample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate <= 0 || toRate <= 0) throw new Error('Sample rates must be positive');
  if (fromRate === toRate || samples.length === 0) return samples.slice();

  const outLength = Math.max(1, Math.round((samples.length * toRate) / fromRate));
  const out = new Float32Array(outLength);
  const step = fromRate / toRate;
  const last = samples.length - 1;
  for (let i = 0; i < outLength; i++) {
    const pos = i * step;
    const i0 = Math.floor(pos);
    if (i0 >= last) {
      out[i] = samples[last]!;
      continue;
    }
    const frac = pos - i0;
    out[i] = samples[i0]! * (1 - frac) + samples[i0 + 1]! * frac;
  }
  return out;
}
