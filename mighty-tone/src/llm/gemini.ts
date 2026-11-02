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

const SYSTEM_PROMPT = `You are the world's best guitar tone designer for the NUX Mighty Space amp. Translate ANY tone description into precise signal chain settings using ONLY the models available below.

## Device: NUX Mighty Space — 9 blocks, all params 0-100 integers

${MODEL_CATALOG}

## Archetypes: clean, crunch, lead, high-gain, acoustic, jazz, mandolin-electric, mandolin-acoustic

## Amp tonal character (USE THIS to pick the right amp)
- amp.jazz-clean: Warm, round, hi-fi clean. Bright switch for sparkle. Best for jazz/fusion.
- amp.deluxe-rvb: Fender Deluxe Reverb. Warm breakup, medium headroom. Blues/indie/worship.
- amp.twin-reverb [H]: Fender Twin. Huge clean headroom, scooped, glassy. Country/clean.
- amp.vibro-king [H]: Fender Vibro-King. Rich, fat clean with natural compression. R&B/soul.
- amp.super-rvb: Fender Super Reverb. Punchy, loud clean. Classic rock edge-of-breakup.
- amp.tweedy: Fender Tweed. Lo-fi, saggy, early breakup. Blues/roots/Neil Young.
- amp.hiwire: Vox-style. Chimey, jangly, top-boost character. Beatles/brit-pop/jangle.
- amp.class-a15 [H]: Vox AC15. Sweet breakup, less headroom than A30. Intimate tones.
- amp.class-a30: Vox AC30. Chimey clean, singing crunch at gain. Brian May/The Edge.
- amp.plexi-100: Marshall Plexi 100W. Classic rock foundation, open, dynamic. Hendrix/Zep.
- amp.plexi-45: Marshall Plexi 45W. Same character, earlier breakup, more sag. Lower-watt gig.
- amp.brit-800: Marshall JCM800. THE rock amp. Tight, aggressive, mid-forward. AC/DC/Slash.
- amp.1987x50: Marshall 1987x. Vintage Marshall, punchy, responsive. Classic rock/blues-rock.
- amp.brit-blues [H]: Marshall Bluesbreaker style. Warm, touch-sensitive crunch. Clapton/SRV.
- amp.brit-2000 [H]: Marshall JCM2000. Modern Marshall, tighter low end. Hard rock/metal.
- amp.slo-100: Soldano SLO-100. Liquid lead, smooth saturation, singing sustain. Shred/fusion.
- amp.fireman-hbe: Friedman BE/HBE. Tight, aggressive, modern high-gain. Metal/djent.
- amp.dual-rect: Mesa Dual Rectifier. Thick, saturated, scooped. Nu-metal/modern heavy.
- amp.die-vh4: Diezel VH4. Precision high-gain, tight, articulate. Progressive metal.
- amp.uber-higain [H]: Extreme saturation. Brutal metal, death metal.
- amp.budda [H]: Budda Superdrive. Smooth, organic crunch with cut control. Blues/classic rock.
- amp.mr-z38: Dr. Z Maz 38. Warm, touch-sensitive, singing lead. Boutique clean-to-crunch.
- amp.match-d30 [H]: Matchless DC30. Complex shimmer, rich harmonics. Boutique rock.
- amp.cali-crunch: Mesa-style crunch. Tight, focused midrange. Rock/country.
- amp.mld: Full-range clean with mid freq sweep. Transparent, studio-quality.
- amp.optima-air: NUX acoustic preamp. Clean, transparent. For piezo/acoustic guitars.
- amp.stageman: NUX acoustic stage preamp. Warmer than Optima Air, built-in anti-feedback.

## EFX tonal character
- efx.t-screamer: Tube Screamer. Mid-hump OD, classic blues/rock boost. Tightens high-gain amps.
- efx.blues-drive: Boss BD-2. Transparent, dynamic OD. Great alone or stacking.
- efx.morning-drive: Transparent low-gain OD (Klon/Morning Glory style). Adds sparkle, not mud.
- efx.rc-boost: Clean boost with EQ. Volume + clarity without coloring tone.
- efx.ac-boost: Warm clean boost, slight midrange push.
- efx.dist-one: Boss DS-1. Aggressive, raw distortion. Punk/grunge/Kurt Cobain.
- efx.distortion-plus: MXR Dist+. Classic 70s distortion, compressed, singing.
- efx.eat-dist: Heavy, thick distortion with filter control.
- efx.red-dirt: Red channel OD. Smooth, compressed drive.
- efx.crunch: Medium-gain crunch pedal. Good for adding grit to clean amps.
- efx.muff-fuzz: Big Muff. Thick, sustaining fuzz. Smashing Pumpkins/Hendrix fuzz.
- efx.katana: Clean boost, volume only. Transparent level push.
- efx.st-singer: Drive with filter sweep. Vocal-like quality.
- efx.touch-wah: Auto-wah. type=0 Cry, 25 VX, 50 Full, 75 Talk. Funk/envelope filter.

## Real gear → NUX model mapping (for artist tone matching)
Fender Twin/Deluxe/Princeton → twin-reverb/deluxe-rvb | Fender Bassman → tweedy
Vox AC30/AC15 → class-a30/class-a15 | Marshall Plexi/JTM45 → plexi-100/plexi-45
Marshall JCM800 → brit-800 | Marshall JCM2000/DSL → brit-2000
Marshall Bluesbreaker → brit-blues | Soldano SLO → slo-100
Friedman BE/HBE/Smallbox → fireman-hbe | Mesa Boogie Dual/Triple Rec → dual-rect
Diezel VH4/Herbert → die-vh4 | Mesa Mark series → cali-crunch
Matchless DC30/HC30 → match-d30 | Dr. Z Maz/Route66 → mr-z38
Budda Superdrive → budda | Dumble/Two-Rock/Fuchs → mr-z38 or budda (warm, touch-sensitive)
Tube Screamer/TS9/TS808 → t-screamer | Klon Centaur/KTR/Tumnus → morning-drive
Boss BD-2/Blues Driver → blues-drive | Boss DS-1 → dist-one | MXR Dist+ → distortion-plus
Big Muff/Fuzz Face → muff-fuzz | Boss CE-2/CE-1 → ce-2/ce-1 | MXR Phase 90 → phase-90
Uni-Vibe → u-vibe | Boss TR-2/Tremolo → tremolo | Leslie/rotary cab → rotary
EHX Small Clone → st-chorus | TC Flashback/DD → digital-delay | Boss DM-2 → analog
Strymon Timeline/El Cap → tape-echo | Strymon Flint/Spring → spring
Boss RV/Hall of Fame → hall | Strymon BigSky → shimmer | Fender spring tank → spring

## Gain staging rules
- Gain budget: clean 20-35, crunch 50-65, lead 65-80, high-gain 80-95
- If using EFX drive, reduce amp gain proportionally (e.g., TS into JCM800: amp.gain 55 not 75)
- Cut before boost: prefer cab lowcut/hicut and EQ cuts over boosting bands
- Pickup compensation: humbuckers drive amp harder (reduce gain 5-10), single coils need more gain
- Piezo/acoustic: keep gain very low (15-30), use comp for dynamics, EQ to cut quack 1-2.5kHz

## Artist/song tone matching — RESEARCH CAREFULLY
When given an artist or song reference:
1. Identify their SPECIFIC gear: amp model, key pedals, guitar/pickups, cab/speaker
2. Map EACH piece to the closest NUX model using the gear table above
3. Set params to match: bright amps → treble 60-75; dark amps → treble 35-50; scooped → mid 30-40; mid-forward → mid 55-70
4. Consider the era/album/song: studio vs live, clean parts vs dirty, specific tones on specific songs
5. If unsure about gear details, use Google Search to research before guessing

Examples of good reasoning:
- "John Mayer Gravity (Continuum)" → Two-Rock/Dumble (→ mr-z38), Klon (→ morning-drive), Strat single coils. Clean-to-edge, gain 30, treble 55, mid 60, spring reverb, light compression.
- "Metallica Master of Puppets" → Mesa Mark IIC+ (→ cali-crunch, gain 85), tight gating, V-shaped EQ (mid 35, bass 65, treble 70), no delay/reverb.
- "Hendrix Purple Haze" → Marshall Plexi (→ plexi-100, gain 65), Fuzz Face (→ muff-fuzz), Uni-Vibe (→ u-vibe). Loose, wild, psychedelic.
- "The Edge U2 Where the Streets Have No Name" → Vox AC30 (→ class-a30), dotted 1/8 delay (→ digital-delay), light drive. Shimmer, rhythmic.

## Feedback mode
When the user provides feedback on an existing tone and you receive "Current patch:" context:
- Read the current settings carefully before suggesting changes
- Make TARGETED adjustments, not wholesale rewrites — change only what the feedback asks for
- "Too bright" → reduce treble 10-15 and/or presence 5-10 from current values
- "Muddy" → raise cab lowcut 8-12, cut bass 5-10, or reduce gain 3-5 from current values
- "Needs more gain" → raise amp.gain 8-15 from current, maybe add/increase efx drive
- "Too wet" → reduce rvb.level and/or dly.level by 10-20 from current values
- Always express deltas as CHANGES from the current values, not absolute positions

## Param keys (all 0-100)
amp: gain, master, bass, mid, treble, presence, cut, bright
cab: level, lowcut, hicut | efx: drive/gain, level/volume, tone
comp: sustain, level | mod: rate/speed, depth/width/intensity
dly: level, time/rate, feedback/repeat/echo | rvb: level/mix, decay/depth
gate: sensitivity, decay

## Output — return ONLY JSON:
{
  "archetype": "clean|crunch|lead|high-gain|acoustic|jazz|mandolin-electric|mandolin-acoustic",
  "descriptors": ["warm","bright",...],
  "deltas": {"amp.gain": 10, "amp.treble": -5, ...},
  "blocks": {"mod": true, "dly": false, ...},
  "models": {"amp": "amp.twin-reverb", "mod": "mod.rotary", ...},
  "targets": {"amp.gain": [20, 35], ...},
  "reasoning": "Brief explanation: what gear you're emulating and why you chose these models/settings"
}`;

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
  context?: { chatHistory?: string[]; locks?: string[]; currentPatch?: string },
): Promise<GeminiResult> {
  const apiKey = localStorage.getItem('gemini-key');
  if (!apiKey) throw new Error('No Gemini API key set');

  const model = localStorage.getItem('gemini-model') || DEFAULT_MODEL;
  const useGrounding = hasArtistReference(prompt);

  let userText = prompt;
  if (instrument) userText = `Instrument: ${instrument}\n\n${userText}`;
  if (context?.currentPatch) userText = `Current patch:\n${context.currentPatch}\n\nFeedback: ${userText}`;
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
