import { fft, ifft, nextPow2 } from './fft.ts';

/** Floor for |H| before taking the log, so spectral nulls don't produce -Infinity. */
const MAG_FLOOR = 1e-10;

/** Convert an IR to minimum phase via the real-cepstrum (homomorphic) method. */
export function toMinPhase(ir: Float32Array): Float32Array {
  if (ir.length === 0) return new Float32Array(0);
  const n = nextPow2(2 * ir.length);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < ir.length; i++) re[i] = ir[i]!;

  fft(re, im);
  for (let k = 0; k < n; k++) {
    re[k] = Math.log(Math.max(Math.hypot(re[k]!, im[k]!), MAG_FLOOR));
    im[k] = 0;
  }

  ifft(re, im);
  const half = n >> 1;
  for (let i = 0; i < n; i++) {
    const w = i === 0 || i === half ? 1 : i < half ? 2 : 0;
    re[i] = re[i]! * w;
    im[i] = 0;
  }

  fft(re, im);
  for (let k = 0; k < n; k++) {
    const mag = Math.exp(re[k]!);
    const phase = im[k]!;
    re[k] = mag * Math.cos(phase);
    im[k] = mag * Math.sin(phase);
  }

  ifft(re, im);
  const out = new Float32Array(ir.length);
  for (let i = 0; i < ir.length; i++) out[i] = re[i]!;
  return out;
}
