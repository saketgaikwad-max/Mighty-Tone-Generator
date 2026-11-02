import type { BlockKind } from '../contracts/blocks.ts';
import type { Patch } from '../contracts/patch.ts';
import { generateTone, solve, refinePatch, type ToneMeta } from '../engine/index.ts';
import { encodePreset } from '../codec/preset.ts';
import { buildQrString } from '../codec/qr-string.ts';
import { saveTone } from '../store/db.ts';
import { callGemini } from '../llm/gemini.ts';

function applyUserIrSlot(patch: Patch, slotNumber: number): Patch {
  const cabModelId = `cab.user-ir-${slotNumber}`;
  const cabBlock = patch.blocks['cab'];
  if (!cabBlock) return patch;
  const updatedCab = { ...cabBlock, modelId: cabModelId, enabled: true };
  const eq = patch.blocks['eq'];
  const updatedEq = eq
    ? {
        ...eq,
        params: {
          ...eq.params,
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

export async function generateToneAsync(
  prompt: string,
  instrument?: string,
  locks?: BlockKind[],
  userIrSlot?: number,
  context?: { chatHistory?: string[] },
): Promise<{ patch: Patch; meta: ToneMeta }> {
  const apiKey = localStorage.getItem('gemini-key');
  let result: { patch: Patch; meta: ToneMeta };

  if (apiKey) {
    try {
      const { intent, reasoning } = await callGemini(prompt, instrument, {
        chatHistory: context?.chatHistory,
        locks: locks?.map(String),
      });
      const { patch, ruleTrace, archetype, confidence } = solve(intent, undefined, undefined, locks ?? []);
      result = {
        patch,
        meta: {
          archetype,
          ruleTrace: reasoning ? [reasoning, ...ruleTrace] : ruleTrace,
          confidence,
          unknownTerms: intent.unknownTerms,
        },
      };
    } catch {
      result = generateTone(prompt, instrument, locks);
    }
  } else {
    result = generateTone(prompt, instrument, locks);
  }

  if (userIrSlot) {
    result = { ...result, patch: applyUserIrSlot(result.patch, userIrSlot) };
  }
  return result;
}

export async function refineToneAsync(
  basePatch: Patch,
  feedbackPrompt: string,
  instrument?: string,
  locks?: BlockKind[],
  userIrSlot?: number,
): Promise<{ patch: Patch; meta: ToneMeta }> {
  const apiKey = localStorage.getItem('gemini-key');
  let intent;

  if (apiKey) {
    try {
      const result = await callGemini(feedbackPrompt, instrument);
      intent = result.intent;
    } catch {
      const { parse } = await import('../engine/parse.ts');
      intent = parse({ prompt: feedbackPrompt, instrument });
    }
  } else {
    const { parse } = await import('../engine/parse.ts');
    intent = parse({ prompt: feedbackPrompt, instrument });
  }

  const { patch, ruleTrace, archetype, confidence } = refinePatch(
    basePatch,
    intent,
    undefined,
    undefined,
    locks ?? [],
  );

  let result = {
    patch,
    meta: {
      archetype,
      ruleTrace,
      confidence,
      unknownTerms: intent.unknownTerms,
    } as ToneMeta,
  };

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
