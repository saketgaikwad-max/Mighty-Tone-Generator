function peakIndex(ir: Float32Array): number {
  let idx = 0;
  let peak = -1;
  for (let i = 0; i < ir.length; i++) {
    const v = Math.abs(ir[i]!);
    if (v > peak) {
      peak = v;
      idx = i;
    }
  }
  return idx;
}

/**
 * Crossfade two IRs (mix 0 = all a, 1 = all b) after shifting the later-peaking IR
 * earlier so both peaks land on the same sample.
 */
export function blendIrs(a: Float32Array, b: Float32Array, mix: number): Float32Array {
  const m = Math.min(1, Math.max(0, mix));
  const pa = peakIndex(a);
  const pb = peakIndex(b);
  const p = Math.min(pa, pb);
  const shiftA = pa - p;
  const shiftB = pb - p;
  const out = new Float32Array(Math.max(a.length, b.length));
  for (let i = 0; i < out.length; i++) {
    const va = a[i + shiftA] ?? 0;
    const vb = b[i + shiftB] ?? 0;
    out[i] = (1 - m) * va + m * vb;
  }
  return out;
}
