import { fft, ifft, nextPow2 } from './fft.ts';
import { truncateTo } from './trim.ts';

/**
 * Fit a `targetLength`-tap FIR to `ir` by least squares on an N-point DFT grid
 * (N ≥ ir.length): minimise Σ_k W_k |H(k) − F(k)|² with uniform W_k = 1.
 * Uniform weighting makes the normal matrix AᴴA = N·I, so the solution is
 * h = Re(AᴴD) / N, i.e. the first `targetLength` samples of IFFT(D).
 * Non-uniform weights would need a full Toeplitz solve.
 */
export function firWls(ir: Float32Array, targetLength: 512, _sampleRate: 48000): Float32Array {
  if (ir.length <= targetLength) return truncateTo(ir, targetLength);

  const n = nextPow2(ir.length);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < ir.length; i++) re[i] = ir[i]!;
  fft(re, im);
  ifft(re, im);

  const out = new Float32Array(targetLength);
  for (let i = 0; i < targetLength; i++) out[i] = re[i]!;
  return out;
}
