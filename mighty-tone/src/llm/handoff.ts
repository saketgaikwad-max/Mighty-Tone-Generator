import { z } from 'zod';
import type { Intent } from '../engine/parse.ts';

const IntentSchema = z.object({
  archetype: z.string().min(1),
  descriptors: z.array(z.string()),
  deltas: z.record(z.string(), z.number()),
});

/**
 * Returns a ready-to-paste ChatGPT/Claude prompt that asks for the Intent JSON.
 */
export function buildHandoffPrompt(prompt: string, instrument?: string): string {
  const instLine = instrument ? `\nInstrument: ${instrument}` : '';
  return `You are a guitar tone expert. Given the tone description below, return ONLY a valid JSON object with these fields:
- archetype: string (e.g. "clean", "crunch", "high-gain", "jazz", "blues", "metal")
- descriptors: string[] (tone quality keywords like "warm", "bright", "thick", "crunchy")
- deltas: Record<string, number> (parameter adjustments, e.g. {"amp.gain": 20, "amp.treble": -10})

Return ONLY the JSON object, no other text.${instLine}

Tone description: ${prompt}`;
}

/**
 * Tries to extract and validate Intent JSON from a pasted LLM response.
 * Returns null on garbage input or validation failure.
 */
export function parseHandoffResponse(text: string): Intent | null {
  if (!text || !text.trim()) return null;

  // Try to extract JSON block (handle markdown code fences)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  const raw = jsonMatch ? jsonMatch[1]!.trim() : text.trim();

  try {
    const parsed = JSON.parse(raw);
    const validated = IntentSchema.parse(parsed);
    return {
      archetype: validated.archetype,
      descriptors: validated.descriptors,
      deltas: validated.deltas as Record<string, number>,
      unknownTerms: [],
      source: 'parser',
    };
  } catch {
    return null;
  }
}
