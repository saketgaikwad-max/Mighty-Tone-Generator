import { BLOCK_KINDS } from '../src/contracts/blocks.ts';
import { device, headIndexOf, modelsOf } from '../src/knowledge/device.ts';

/** A synthetic 113-byte preset: first model of every block, all defaults, default chain order, master 50. */
export function synthPreset(): Uint8Array {
  const raw = new Uint8Array(113);
  for (const block of BLOCK_KINDS) {
    const model = modelsOf(block)[0]!;
    raw[headIndexOf(block)] = model.nuxIndex;
    for (const p of model.params) raw[p.byteIndex] = p.default;
  }
  raw[device.master.byteIndex] = 50;
  device.chain.defaultOrder.forEach((b, i) => (raw[device.chain.start + i] = headIndexOf(b)));
  return raw;
}
