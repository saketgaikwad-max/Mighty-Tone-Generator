/** Scale so the peak absolute sample equals `targetPeak`. An all-zero IR is returned as-is. */
export function normalise(ir: Float32Array, targetPeak: number): Float32Array {
  if (!(targetPeak > 0 && targetPeak <= 1)) throw new Error('targetPeak must be in (0, 1]');
  let peak = 0;
  for (let i = 0; i < ir.length; i++) peak = Math.max(peak, Math.abs(ir[i]!));
  if (peak === 0) return ir.slice();
  const gain = targetPeak / peak;
  const out = new Float32Array(ir.length);
  for (let i = 0; i < ir.length; i++) out[i] = ir[i]! * gain;
  return out;
}
