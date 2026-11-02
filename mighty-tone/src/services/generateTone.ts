import type { BlockKind } from '../contracts/blocks.ts';
import type { Patch } from '../contracts/patch.ts';
import { generateTone, solve, type ToneMeta } from '../engine/index.ts';
import { encodePreset } from '../codec/preset.ts';
import { buildQrString } from '../codec/qr-string.ts';
import { saveTone } from '../store/db.ts';
import { callGemini } from '../llm/gemini.ts';

/**
 * After solving, if the user has selected a user IR slot, swap the cab block
 * to reference that slot and apply compensating EQ (cut presence/high-mid
 * since the IR handles cabinet colouration).
 */
function applyUserIrSlot(patch: Patch, slotNumber: number): Patch {
  const cabModelId = `cab.user-ir-${slotNumber}`;
  const cabBlock = patch.blocks['cab'];
  if (!cabBlock) return patch;
  const updatedCab = { ...cabBlock, modelId: cabModelId, enabled: true };
  // Compensating EQ: pull back presence and hi-mid when using a real IR
  const eq = patch.blocks['eq'];
  const updatedEq = eq
    ? {
        ...eq,
        params: {
          ...eq.params,
          // Reduce presence-like bands (keys may vary by model; clip to valid 0-100 range)
          ...(eq.params['Presence'] != null ? { Presence: Math.max(0, (eq.params['Presence'] ?? 50) - 15) } : {}),
          ...(eq.params['Hi'] != null ? { Hi: Math.max(0, (eq.params['Hi'] ?? 50) - 10) } : {}),
        },
      }
    : eq;
  return {
    ...patch,
    blocks: {
      ...patch.blocks,
      cab: updatedCab,
      ...(updatedEq ? { eq: updatedEq } : {}),
    },
  };
}

/**
 * Generates a tone: tries Gemini first (if key exists), falls back to deterministic parser.
 * Pass userIrSlot (1-20) to pin the cab block to your prepped user IR slot.
 */
export async function generateToneAsync(
  prompt: string,
  instrument?: string,
  locks?: BlockKind[],
  userIrSlot?: number,
): Promise<{ patch: Patch; meta: ToneMeta }> {
  const apiKey = localStorage.getItem('gemini-key');
  let result: { patch: Patch; meta: ToneMeta };
  if (apiKey) {
    try {
      const intent = await callGemini(prompt, instrument);
      const { patch, ruleTrace, archetype, confidence } = solve(intent, undefined, undefined, locks ?? []);
      result = { patch, meta: { archetype, ruleTrace, confidence, unknownTerms: intent.unknownTerms } };
    } catch {
      result = await generateTone(prompt, instrument, locks);
    }
  } else {
    result = await generateTone(prompt, instrument, locks);
  }
  if (userIrSlot) {
    result = { ...result, patch: applyUserIrSlot(result.patch, userIrSlot) };
  }
  return result;
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
