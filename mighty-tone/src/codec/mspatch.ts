import { device } from '../knowledge/device.ts';
import { PRESET_LENGTH } from './preset.ts';

export const MSPATCH_LENGTH = device.mspatch.length;
const OFFSET = device.mspatch.presetOffset;

/** Preset bytes -> 8404-byte .mspatch / .mppropatch (preset at offset 4, rest zero), as converter.js does. */
export function toMspatch(preset: Uint8Array): Uint8Array {
  if (preset.length !== PRESET_LENGTH) throw new Error(`Preset must be ${PRESET_LENGTH} bytes`);
  const out = new Uint8Array(MSPATCH_LENGTH);
  out.set(preset, OFFSET);
  return out;
}

/** .mspatch -> preset bytes (bytes 4..116), as converter.js does. */
export function fromMspatch(file: Uint8Array): Uint8Array {
  if (file.length < OFFSET + PRESET_LENGTH) throw new Error('File too short to contain a preset');
  return file.slice(OFFSET, OFFSET + PRESET_LENGTH);
}
