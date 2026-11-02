import { z } from 'zod';
import type { BlockKind } from '../contracts/blocks.ts';
import type { Intent } from '../engine/parse.ts';
import { device } from '../knowledge/device.ts';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const TONE_TIMEOUT_MS = 12_000;

const IntentResponseSchema = z.object({
  archetype: z.string().min(1),
  descriptors: z.array(z.string()),
  deltas: z.record(z.string(), z.number()),
  blocks: z.record(z.string(), z.boolean()).optional(),
  models: z.record(z.string(), z.string()).optional(),
  targets: z.record(z.string(), z.tuple([z.number(), z.number()])).optional(),
  reasoning: z.string().optional(),
});

function buildModelCatalog(): string {
  const lines: string[] = [];
  const blockOrder = ['amp', 'cab', 'efx', 'comp', 'eq', 'gate', 'mod', 'dly', 'rvb'] as const;
  for (const bk of blockOrder) {
    const block = device.blocks[bk];
    const models = block.models
      .filter((m: { id: string }) => !m.id.startsWith('cab.user-ir-'))
      .map((m: { id: string; name: string; params: { key: string }[]; hiddenInOfficialApp?: boolean; category?: string }) => {
        const p = m.params.map((pp: { key: string }) => pp.key).join('/');
        const tag = m.hiddenInOfficialApp ? ' [H]' : '';
        const cat = m.category ? ` (${m.category})` : '';
        return `${m.id}=${m.name}${tag}${cat} [${p}]`;
      });
    lines.push(`${bk.toUpperCase()}: ${models.join(' | ')}`);
  }
  lines.push('CAB also has user-ir-1..20 for user-loaded IRs [level/lowcut/hicut]');
  return lines.join('\n');
}

const MODEL_CATALOG = buildModelCatalog();

const SYSTEM_PROMPT = `You are the world's best guitar tone designer for the NUX Mighty Space amp. Your job is to translate ANY tone description — genres, artists, songs, creative concepts, non-guitar sounds — into precise signal chain settings using ONLY the models and parameters available on this device.

## Device: NUX Mighty Space
9 signal chain blocks. Each block has selectable models. All params are 0-100 integers.

${MODEL_CATALOG}

## Archetypes (pick one): clean, crunch, lead, high-gain, acoustic, jazz, mandolin-electric, mandolin-acoustic

## Amp character guide
- Fender-style cleans: twin-reverb, deluxe-rvb, vibro-king, super-rvb (bright switch adds sparkle)
- Vox-style: class-a15 (AC15), class-a30 (AC30), hiwire — chimey, mid-forward
- Marshall crunch/rock: plexi-100, plexi-45, brit-800 (JCM800), 1987x50, brit-2000, brit-blues
- High gain: slo-100 (Soldano), fireman-hbe (Friedman), dual-rect (Mesa), die-vh4 (Diezel), uber-higain
- Boutique: budda (cut control), mr-z38 (Dr.Z), match-d30 (Matchless), vibro-king
- Full-range/clean: mld (mid freq sweep), jazz-clean (bright switch)
- Acoustic preamp: optima-air, stageman
- Bass: bass-mate, agl

## Creative/non-guitar sound mapping
- Organ/Hammond/Leslie → mod.rotary + clean amp, comp on, gain low, mid boosted
- Synth/pad → mod.mono-octave (sub+up mix) + shimmer reverb + comp, clean amp
- Octave/bass synth → mod.mono-octave (sub high, dry low)
- Psychedelic/vibe → mod.u-vibe + crunch amp
- Surf → spring reverb + tremolo mod + clean amp with bright
- Ambient/ethereal → rvb.shimmer + long delay + chorus mod
- Wah/funk filter → efx.touch-wah (type: Cry=0/VX=25/Full=50/Talk=75)

## Gain staging rules
- Total gain budget: clean 20-35, crunch 50-65, lead 65-80, high-gain 80-95
- If using an EFX drive pedal, reduce amp gain proportionally
- Cut before boost: prefer cab lowcut/hicut and EQ cuts over boosting

## Artist/song research
When given an artist or song reference, think step by step:
1. Identify the artist's known gear (amp, pedals, guitar, pickups)
2. Map each piece to the closest available NUX model
3. Set params to match the character (bright amps get higher treble, dark amps lower)
4. Consider the era and specific song if given (live vs studio, clean vs dirty parts)

## Param key reference (canonical names used in deltas)
amp: amp.gain, amp.master, amp.bass, amp.mid, amp.treble, amp.presence, amp.cut, amp.bright
cab: cab.level, cab.lowcut, cab.hicut
efx: efx.drive/efx.gain, efx.level/efx.volume, efx.tone
comp: comp.sustain, comp.level
mod: mod.rate/mod.speed, mod.depth/mod.width/mod.intensity
dly: dly.level, dly.time/dly.rate, dly.feedback/dly.repeat/dly.echo
rvb: rvb.level/rvb.mix, rvb.decay/rvb.depth
gate: gate.sensitivity, gate.decay
All values 0-100 integers. Deltas are ADJUSTMENTS from archetype defaults (positive = increase, negative = decrease).

## Output format
Return ONLY a JSON object:
{
  "archetype": "clean|crunch|lead|high-gain|acoustic|jazz|mandolin-electric|mandolin-acoustic",
  "descriptors": ["warm","bright",...],
  "deltas": {"amp.gain": 10, "amp.treble": -5, ...},
  "blocks": {"mod": true, "dly": false, ...},
  "models": {"amp": "amp.twin-reverb", "mod": "mod.rotary", ...},
  "targets": {"amp.gain": [20, 35], ...},
  "reasoning": "Brief explanation of gear mapping choices"
}

- archetype: best-fit category
- descriptors: tone quality keywords
- deltas: param adjustments from archetype defaults (only non-zero)
- blocks: which blocks to enable/disable (only if changing from archetype default)
- models: specific model selections (only if you want something specific)
- targets: hard param ranges [min, max] (only for gain staging)
- reasoning: 1-2 sentences explaining your choices`;

async function geminiRequest(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userText: string,
  timeoutMs: number,
  useGrounding: boolean,
): Promise<string> {
  const url = `${GEMINI_BASE}${model}:generateContent?key=${apiKey}`;

  const body: Record<string, unknown> = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: userText }] }],
    generationConfig: { responseMimeType: 'application/json' },
  };

  if (useGrounding) {
    body['tools'] = [{ google_search: {} }];
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini ${response.status}: ${errText.slice(0, 200)}`);
  }

  const json = await response.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function hasArtistReference(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const artistPatterns = [
    /\b(?:like|sound(?:s)?\s+like|style\s+of|tone\s+of|rig\s+of)\b/,
    /\b(?:cover(?:ing)?|playing)\b/,
    /\b(?:artist|band|guitarist|player)\b/,
  ];
  if (artistPatterns.some(p => p.test(lower))) return true;
  const words = lower.split(/\s+/);
  const capitalWords = prompt.split(/\s+/).filter(w => /^[A-Z][a-z]/.test(w));
  return capitalWords.length >= 2 || (capitalWords.length >= 1 && words.length <= 8);
}

export interface GeminiResult {
  intent: Intent;
  reasoning?: string;
}

export async function callGemini(
  prompt: string,
  instrument?: string,
  context?: { chatHistory?: string[]; locks?: string[] },
): Promise<GeminiResult> {
  const apiKey = localStorage.getItem('gemini-key');
  if (!apiKey) throw new Error('No Gemini API key set');

  const model = localStorage.getItem('gemini-model') || DEFAULT_MODEL;
  const useGrounding = hasArtistReference(prompt);

  let userText = prompt;
  if (instrument) userText = `Instrument: ${instrument}\n\n${userText}`;
  if (context?.locks?.length) userText += `\n\nLocked blocks (do not change): ${context.locks.join(', ')}`;
  if (context?.chatHistory?.length) {
    const recent = context.chatHistory.slice(-3).join('\n');
    userText = `Previous context:\n${recent}\n\nCurrent request: ${userText}`;
  }

  const text = await geminiRequest(apiKey, model, SYSTEM_PROMPT, userText, TONE_TIMEOUT_MS, useGrounding);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) throw new Error('Gemini returned no valid JSON');
    parsed = JSON.parse(jsonMatch[1]!.trim());
  }

  let validated;
  try {
    validated = IntentResponseSchema.parse(parsed);
  } catch (validationError) {
    const retryText = `Your previous response had validation errors: ${String(validationError)}\n\nPlease fix and return valid JSON for: ${userText}`;
    const retryResponse = await geminiRequest(apiKey, model, SYSTEM_PROMPT, retryText, TONE_TIMEOUT_MS, false);
    const retryParsed = JSON.parse(retryResponse);
    validated = IntentResponseSchema.parse(retryParsed);
  }

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
  if (instrument !== undefined) intent.instrument = instrument;
  return { intent, reasoning: validated.reasoning };
}

export { SYSTEM_PROMPT, MODEL_CATALOG, buildModelCatalog };
