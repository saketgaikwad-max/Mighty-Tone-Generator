/**
 * Index of the first sample whose magnitude is within `thresholdDb` of the peak.
 * Returns 0 for an all-zero IR.
 */
export function findOnset(ir: Float32Array, thresholdDb: number): number {
  let peak = 0;
  for (let i = 0; i < ir.length; i++) peak = Math.max(peak, Math.abs(ir[i]!));
  if (peak === 0) return 0;
  const threshold = peak * Math.pow(10, -Math.abs(thresholdDb) / 20);
  for (let i = 0; i < ir.length; i++) {
    if (Math.abs(ir[i]!) >= threshold) return i;
  }
  return 0;
}

export function trimLeadingSilence(ir: Float32Array, thresholdDb: number): Float32Array {
  return ir.slice(findOnset(ir, thresholdDb));
}

/** First `length` samples, zero-padded if the IR is shorter. */
export function truncateTo(ir: Float32Array, length: number): Float32Array {
  const out = new Float32Array(length);
  out.set(ir.length > length ? ir.subarray(0, length) : ir);
  return out;
}
