import { MODEL_CATALOG } from './gemini.ts';

const CANNED: Array<{ patterns: RegExp[]; response: string }> = [
  {
    patterns: [/\bwhat (?:amp|amps)\b/i, /\bwhich (?:amp|amps)\b/i, /\bamp models?\b/i, /\bavailable amps?\b/i],
    response: `The Mighty Space has 29 amp models including:\n\n**Fender-style:** Twin Reverb, Deluxe Rvb, Super Rvb, Vibro King\n**Vox-style:** Class A15 (AC15), Class A30 (AC30), Hiwire\n**Marshall:** Plexi 100, Plexi 45, Brit 800 (JCM800), 1987x50, Brit 2000\n**High gain:** Slo 100, Fireman HBE, Dual Rect, DIE VH4, Uber HiGain\n**Boutique:** Budda, Mr. Z38, Match D30\n**Clean/Full:** MLD, Jazz Clean\n**Acoustic:** Optima Air, Stageman\n**Bass:** Bass Mate, AGL\n\nSome are hidden in the official app but fully usable via QR.`,
  },
  {
    patterns: [/\bwhat (?:effect|effects|pedal|pedals)\b/i, /\bwhich (?:effect|effects)\b/i, /\bavailable (?:effect|effects)\b/i],
    response: `The signal chain has these effect blocks:\n\n**Drive/EFX:** T Screamer, Blues Drive, RC/AC Boost, Dist One, Distortion+, Morning Drive, Muff Fuzz, Crunch, Katana, Touch Wah, and more\n**Modulation:** Chorus (CE-1/CE-2/ST), Flanger, Phase 90/100, Tremolo, Rotary, U-Vibe, Vibrato, Detune, Mono Octave\n**Delay:** Analog, Digital, Tape Echo, Modulation, Pan, Phi\n**Reverb:** Room, Hall, Plate, Spring, Shimmer, Damp\n**Utility:** Compressor (3 types), 6/10-band EQ, Noise Gate`,
  },
  {
    patterns: [/\bhow (?:does|do) (?:this|it|the app)\b/i, /\bhow to use\b/i, /\bhelp\b/i, /\bguide\b/i],
    response: `Describe the tone you want and I'll generate a QR code patch for your Mighty Space!\n\nYou can:\n• Describe a sound: "warm jazz clean", "heavy metal with tight low end"\n• Reference an artist: "John Mayer Continuum tone"\n• Get creative: "organ-like with rotary", "synth pad ambient"\n• Give feedback after: "too bright", "more gain", "add delay"\n• Lock blocks you like and regenerate the rest\n• Use the delay helper for precise BPM sync`,
  },
  {
    patterns: [/\bwhat (?:is|are|does) (?:a |the )?(?:block|blocks|signal chain)\b/i],
    response: `The Mighty Space has 9 signal chain blocks:\n\n1. **Gate** — Noise gate (set sensitivity based on gain/pickup noise)\n2. **Comp** — Compressor (even out dynamics, add sustain)\n3. **EFX** — Drive/effect pedal (boost, overdrive, distortion, fuzz, wah)\n4. **Amp** — Amp model (the core of your tone)\n5. **EQ** — Equalizer (6 or 10 band)\n6. **Mod** — Modulation (chorus, phaser, tremolo, rotary, etc.)\n7. **Dly** — Delay (analog, digital, tape, etc.)\n8. **Rvb** — Reverb (room, hall, plate, spring, shimmer)\n9. **Cab** — Cabinet IR (built-in or user-loaded)\n\nEach block can be enabled/disabled and has its own model selection and parameters.`,
  },
];

async function converseWithGemini(
  prompt: string,
  context?: { patchDescription?: string; instrument?: string; chatHistory?: string[] },
): Promise<string | null> {
  const apiKey = localStorage.getItem('gemini-key');
  if (!apiKey) return null;

  const model = localStorage.getItem('gemini-model') || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let systemText = `You are a helpful guitar tone assistant for the NUX Mighty Space amp. Keep answers concise (2-4 sentences max) since this is a mobile chat UI. Be knowledgeable about guitar gear, tone, and effects.

Available models on this device:
${MODEL_CATALOG}

If the user seems to be working toward a tone, suggest they describe it and you'll generate one. Don't generate JSON — just have a helpful conversation.`;

  let userText = prompt;
  if (context?.instrument) userText = `[Using: ${context.instrument}] ${userText}`;
  if (context?.patchDescription) systemText += `\n\nCurrent tone: ${context.patchDescription}`;
  if (context?.chatHistory?.length) {
    const recent = context.chatHistory.slice(-4).join('\n');
    userText = `Recent chat:\n${recent}\n\nUser: ${userText}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemText }] },
        contents: [{ parts: [{ text: userText }] }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const json = await response.json();
    return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function converse(
  prompt: string,
  context?: { patchDescription?: string; instrument?: string; chatHistory?: string[] },
): Promise<string> {
  const geminiResponse = await converseWithGemini(prompt, context);
  if (geminiResponse) return geminiResponse;

  const lower = prompt.toLowerCase();
  for (const entry of CANNED) {
    if (entry.patterns.some(p => p.test(lower))) return entry.response;
  }

  return `I'm best at generating tones! Try describing a sound you want, like "warm jazz clean", "heavy metal with delay", or even "John Mayer Slow Dancing tone". I'll create a QR patch for your Mighty Space.`;
}
