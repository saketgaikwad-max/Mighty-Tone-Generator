import { z } from 'zod';
import type { Intent } from '../engine/parse.ts';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const TIMEOUT_MS = 3_000;

const IntentResponseSchema = z.object({
  archetype: z.string().min(1),
  descriptors: z.array(z.string()),
  deltas: z.record(z.string(), z.number()),
});

/** Calls Gemini API and returns a validated Intent (partial: archetype + descriptors + deltas). */
export async function callGemini(prompt: string, instrument?: string): Promise<Intent> {
  const apiKey = localStorage.getItem('gemini-key');
  if (!apiKey) throw new Error('No Gemini API key set');

  const systemInstruction =
    'You are a guitar tone expert. Given a tone description, return a JSON object with fields: archetype (string), descriptors (string[]), deltas (Record<string, number>). Only return valid JSON.';

  const userText = instrument ? `Instrument: ${instrument}\n\nTone: ${prompt}` : prompt;

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ parts: [{ text: userText }] }],
    generationConfig: { responseMimeType: 'application/json' },
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = JSON.parse(text);
  const validated = IntentResponseSchema.parse(parsed);

  const intent: Intent = {
    archetype: validated.archetype,
    descriptors: validated.descriptors,
    deltas: validated.deltas as Record<string, number>,
    unknownTerms: [],
    source: 'parser',
  };
  if (instrument !== undefined) intent.instrument = instrument;
  return intent;
}
