import type { Patch } from '../contracts/patch.ts';
import { generateTone, type ToneMeta } from '../engine/index.ts';
import { encodePreset } from '../codec/preset.ts';
import { buildQrString } from '../codec/qr-string.ts';
import { saveTone } from '../store/db.ts';

export async function generateAndSave(
  sessionId: number,
  prompt: string,
  instrument?: string,
): Promise<{ qrString: string; patch: Patch; meta: ToneMeta }> {
  const { patch, meta } = generateTone(prompt, instrument);
  const preset = encodePreset(patch);
  const qrString = buildQrString(preset);
  await saveTone(sessionId, patch, meta);
  return { qrString, patch, meta };
}
