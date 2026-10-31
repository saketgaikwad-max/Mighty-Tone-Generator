import type { BlockKind } from '../contracts/blocks.ts';
import type { Patch } from '../contracts/patch.ts';
import { generateTone, solve, type ToneMeta } from '../engine/index.ts';
import { encodePreset } from '../codec/preset.ts';
import { buildQrString } from '../codec/qr-string.ts';
import { saveTone } from '../store/db.ts';
import { callGemini } from '../llm/gemini.ts';

/**
 * Generates a tone: tries Gemini first (if key exists), falls back to deterministic parser.
 */
export async function generateToneAsync(
  prompt: string,
  instrument?: string,
  locks?: BlockKind[],
): Promise<{ patch: Patch; meta: ToneMeta }> {
  const apiKey = localStorage.getItem('gemini-key');
  if (apiKey) {
    try {
      const intent = await callGemini(prompt, instrument);
      const { patch, ruleTrace, archetype, confidence } = solve(intent, undefined, undefined, locks ?? []);
      return { patch, meta: { archetype, ruleTrace, confidence, unknownTerms: intent.unknownTerms } };
    } catch {
      // fall through to deterministic parser
    }
  }
  return generateTone(prompt, instrument, locks);
}

export async function generateAndSave(
  sessionId: number,
  prompt: string,
  instrument?: string,
): Promise<{ qrString: string; patch: Patch; meta: ToneMeta }> {
  const { patch, meta } = await generateToneAsync(prompt, instrument);
  const preset = encodePreset(patch);
  const qrString = buildQrString(preset);
  await saveTone(sessionId, patch, meta);
  return { qrString, patch, meta };
}
