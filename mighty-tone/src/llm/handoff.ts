import { z } from 'zod';
import type { BlockKind } from '../contracts/blocks.ts';
import type { Intent } from '../engine/parse.ts';
import { MODEL_CATALOG } from './gemini.ts';

const IntentSchema = z.object({
  archetype: z.string().min(1),
  descriptors: z.array(z.string()),
  deltas: z.record(z.string(), z.number()),
  blocks: z.record(z.string(), z.boolean()).optional(),
  models: z.record(z.string(), z.string()).optional(),
  targets: z.record(z.string(), z.tuple([z.number(), z.number()])).optional(),
});

export function buildHandoffPrompt(prompt: string, instrument?: string): string {
  const instLine = instrument ? `\nInstrument: ${instrument}` : '';
  return `You are a guitar tone expert for the NUX Mighty Space amp. Given the tone description below, return ONLY a valid JSON object.

Available models on this device:
${MODEL_CATALOG}

Archetypes: clean, crunch, lead, high-gain, acoustic, jazz, mandolin-electric, mandolin-acoustic

Output JSON with these fields:
- archetype: string (one of the archetypes above)
- descriptors: string[] (tone quality keywords)
- deltas: Record<string, number> (param adjustments, e.g. {"amp.gain": 10, "amp.treble": -5})
- blocks: Record<string, boolean> (optional — which blocks to enable/disable)
- models: Record<string, string> (optional — specific model selections from the catalog above)
- targets: Record<string, [number, number]> (optional — hard param ranges)

Param keys: amp.gain, amp.master, amp.bass, amp.mid, amp.treble, amp.presence, cab.level, cab.lowcut, cab.hicut, efx.drive, efx.level, efx.tone, comp.sustain, comp.level, mod.rate, mod.depth, dly.level, dly.time, dly.feedback, rvb.level, rvb.decay, gate.sensitivity. All 0-100 integers.

If the description references an artist or song, research their gear and map to the closest available models.

Return ONLY the JSON object, no other text.${instLine}

Tone description: ${prompt}`;
}

export function parseHandoffResponse(text: string): Intent | null {
  if (!text || !text.trim()) return null;

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  const raw = jsonMatch ? jsonMatch[1]!.trim() : text.trim();

  try {
    const parsed = JSON.parse(raw);
    const validated = IntentSchema.parse(parsed);
    const intent: Intent = {
      archetype: validated.archetype,
      descriptors: validated.descriptors,
      deltas: validated.deltas as Record<string, number>,
      unknownTerms: [],
      source: 'parser',
    };
    if (validated.blocks) intent.blocks = validated.blocks as Partial<Record<BlockKind, boolean>>;
    if (validated.models) intent.models = validated.models as Partial<Record<BlockKind, string>>;
    if (validated.targets) intent.targets = validated.targets as Record<string, [number, number]>;
    return intent;
  } catch {
    return null;
  }
}
