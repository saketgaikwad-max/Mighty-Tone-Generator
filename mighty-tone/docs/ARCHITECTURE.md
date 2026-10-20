# Mighty Tone Generator — Architecture

Companion to [PLAN.md](./PLAN.md). Schemas here are sketches: the authoritative versions will live in
`src/contracts/*.ts` (Zod) once Phase 0 freezes them. Citations refer to [SOURCES.md](./SOURCES.md).

## 1. Repository layout

```
mighty-tone/
  index.html, vite.config.ts, tsconfig.json, package.json
  LICENSE, THIRD_PARTY_NOTICES.md, AGENTS.md, CONTRIBUTING-KNOWLEDGE.md
  .github/workflows/{ci.yml,pages.yml}
  public/            icons, manifest assets
  knowledge/         ← DATA ONLY (JSON), schema-validated in CI
    device/mighty-space.json        models, byte map, param formatters, delay tables, verified flags
    engine/vocabulary.json          descriptor → target deltas (+ synonyms, negations)
    engine/archetypes.json          tone archetypes → chain templates + param priors
    engine/rules.json               expert-practice rules (id, condition, action, rationale, exceptions)
    engine/instruments.json         instrument/pickup models (builtin profiles + generic types)
    engine/references.json          artist/song reference library (structured intents + notes)
    engine/feedback.json            feedback chip/text → contextual adjustments
    engine/base-tones.json          mandolin base tones and other seed patches
    engine/loudness.json            per-model relative loudness for level matching
    engine/confidence.json          factor weights + band thresholds
  src/
    contracts/       Zod schemas + TS types shared by all modules (frozen per phase)
    knowledge/       loaders + typed accessors for /knowledge JSON
    codec/           bytes ⇄ Patch, .mspatch, QR string, formatters, delay math
    qr/              encode (qrcode) / decode ladder (qr-scanner, jsQR) — browser only
    engine/          parse/, plan/, solve/, shape/, level/, delay/, explain/, confidence/, diff/, variants/
    llm/             gemini/, handoff/, prompts/, validate.ts
    dsp/             wav, resample, fft, minphase, fir-wls, blend, residual, fidelity; worker.ts
    store/           dexie db, repositories, migrations, backup
    services/        use-cases orchestrating modules (generateTone, applyFeedback, importQr, branch, saveTone…)
    ui/kit/          design-system adapter (filled by design track)
    ui/screens/      Sessions, SessionChat, Timeline, Library, Profile, IRInventory, IRPrep, PatchInspector
    ui/components/   QrView, ChainView, ParamTable, DiffView, ConfidenceBadge, FeedbackChips, FreqChart
  tests/
    fixtures/qr/     real amp QR images + decoded strings + expected.json
    fixtures/ir/     synthetic + license-checked IRs
    eval/            engine evaluation cases (YAML/JSON) + runner
    e2e/             Playwright specs (webkit + chromium)
  tools/extract-plugpro.ts   one-off extractor from local mightier_amp sources
  docs/
```

Dependency rule (enforced by ESLint `import/no-restricted-paths`): `knowledge ← codec ← engine ← services ← ui`;
`dsp`, `llm` depend only on `contracts`; `ui` never imports `codec`/`engine` directly except via `services`.

## 2. Data flow

### 2.1 Generate a tone
```
prompt text + SessionContext(instrument, pickup, tuning, capo, playing context, locks, current version)
  │
  ├─► engine/parse  (deterministic)  ──► Intent (source: "parser", coverage, unknownTerms[])
  │        └─ if reference unknown AND user opted in ─► llm/gemini (grounded) ─► Intent JSON ─► validate (Zod)
  │                                     └─ quota/offline/no key ─► llm/handoff (link + paste-back) ─► validate
  ▼
engine/plan    choose archetype + block models (score = intent tags × model character × instrument fit × prefs)
engine/solve   parameters from priors + vocabulary deltas + rules (constraint pass: ranges, locks, gain budget)
engine/shape   instrument/pickup/tuning/capo corrections (e.g., piezo quack cut, drop-tuning tightening)
engine/delay   tempo → ms → byte (per model table)
engine/level   master byte to target loudness
engine/explain rule trace → human explanation;  engine/confidence → score + factors;  name generator
engine/diff    vs parent version
  ▼
codec/encode (template overlay) ─► 115-byte payload ─► "nux://MightyAmp:" + base64 ─► qr/encode ─► QR image
  ▼
store: new Version (parentId, intent, patch, explanation, confidence, diff) under Session
```

### 2.2 Feedback iteration
Feedback chips + free text → `engine/parse` (feedback mode) → `FeedbackIntent` → interpreted against
(instrument, pickup, prompt archetype, current patch, locks) via `feedback.json` → new Version. If the user attached
a QR exported from the amp, it is decoded first and becomes an "amp-state" Version (author: "user") that the
feedback is applied to; diff shows what the user changed on the amp.

### 2.3 IR prep
File(s) → worker: decode WAV → resample 48 kHz → trim leading silence → (optional) blend two IRs (aligned, weighted)
→ min-phase → WLS 512-tap FIR → normalize → 64-sample (configurable) fade-out → residual analysis → EQ suggestion
→ fidelity score → WAV export. Result metadata saved on the `IRSlot` when the user records it in the inventory.

## 3. Core schemas (sketch)

```ts
// ---------- Device knowledge ----------
type BlockKind = 'gate'|'comp'|'efx'|'amp'|'eq'|'mod'|'dly'|'rvb'|'cab';
// Head byte index per block (PresetDataIndexPlugPro): comp1 efx2 amp3 eq4 gate5 mod6 dly7 rvb8 cab9
interface ParamDef {
  key: string;            // 'gain','master','bass', 'time', 'lowcut'...
  label: string;          // UI label as shown in MightyAmp
  byteIndex: number;      // absolute index in 113-byte preset (e.g. AMP_Para1 = 27)
  formatter: 'percent'|'db12'|'db15'|'lowcut'|'highcut'|'tempo'|'switch'|'enum';
  tempoTable?: 'pro'|'proMod'|'proAnalog'|'proTape'; // delay/time params only
  default: number;        // raw byte
  enumLabels?: string[];
}
interface ModelDef {
  id: string;             // stable slug, e.g. 'amp.plexi100'
  block: BlockKind;
  nuxIndex: number;       // value in low 6 bits of head byte
  name: string;
  hiddenInOfficialApp?: boolean;
  verified: boolean;      // confirmed by a real fixture or user scan
  params: ParamDef[];
  character: Record<string, number>; // tags 0..1: bright, warm, tight, sag, compression, fizz, chime, scoop…
  notes?: string;         // e.g. "Acoustic IR designed by NUX for magnetic pickups (neck single coil)"
  source: { file: string; line?: number };
}

// ---------- Patch (codec output; raw bytes are truth) ----------
interface BlockState { block: BlockKind; modelId: string; enabled: boolean; params: Record<string, number /*raw*/>; }
interface Patch {
  device: 'mighty-space';
  qrHeader: [0x0f, 0x01];            // deviceQRId 15, deviceQRVersion 1
  blocks: Record<BlockKind, BlockState>;
  chain: BlockKind[];                // 9 entries from LINK1.. (bytes 89-97)
  master: number;                    // raw byte @84 (−12..+12 dB mapped 0..100)
  name: string;                      // bytes 100-112 in QR payload (≤13 ASCII chars)
  raw: Uint8Array;                   // full 113 bytes as decoded/encoded (template for unknown bytes)
  unknownByteWarnings?: number[];    // indexes that differ from template and are not modelled
}

// ---------- Intent (shared by parser and LLM) ----------
interface Intent {
  schemaVersion: 1;
  source: 'parser'|'reference'|'gemini'|'handoff'|'feedback';
  archetype?: string;                       // id from archetypes.json
  genres: string[];
  references: { artist?: string; song?: string; era?: string; part?: 'rhythm'|'lead'|'clean'|'solo' }[];
  gain: { level?: 0|1|2|3|4|5; character?: 'clean'|'edge'|'crunch'|'drive'|'high'|'fuzz' };
  eqTargets: { band: 'sub'|'low'|'lowmid'|'mid'|'highmid'|'presence'|'air'; delta: -3|-2|-1|0|1|2|3 }[];
  descriptors: { term: string; weight: number }[];   // vocabulary terms matched (warm, glassy, spanky…)
  effects: {
    comp?: Pref; efx?: Pref & { type?: 'boost'|'od'|'dist'|'fuzz'|'wah'|'octave' };
    mod?: Pref & { type?: 'chorus'|'flanger'|'phaser'|'vibe'|'tremolo'|'rotary'|'vibrato'|'detune'|'octave' };
    dly?: Pref & { type?: 'analog'|'digital'|'mod'|'tape'|'pan'|'phi'; bpm?: number;
                   division?: '1/4'|'1/8'|'1/8d'|'1/4d'|'1/8t'|'1/4t'|'1/16'|'1/2'; ms?: number; mix?: 0|1|2|3 };
    rvb?: Pref & { type?: 'room'|'hall'|'plate'|'spring'|'shimmer'|'damp'; size?: 0|1|2|3; mix?: 0|1|2|3 };
  };
  context?: { setting?: 'home'|'band'|'recording'|'busking'; volume?: 'quiet'|'normal'|'loud' };
  preferModels?: string[]; avoidModels?: string[];   // validated against device knowledge
  wantsVariants?: number;                           // 1..5
  notes?: string;                                   // free-text rationale (shown, never executed)
  coverage: number;                                 // 0..1 share of prompt tokens understood
  unknownTerms: string[];
}
type Pref = { want: 'on'|'off'|'any'; amount?: 0|1|2|3 };

// ---------- Instruments ----------
interface PickupDef {
  id: string; label: string;
  type: 'humbucker'|'single'|'p90'|'stacked-hb'|'piezo-passive'|'piezo-active'|'mic-blend'|'other';
  output: 'low'|'medium'|'high'; brightness: -2|-1|0|1|2;
  active: boolean; noisy: boolean;
  controls: string[];                 // e.g. ['bass','treble','phase','volume'] for Fishman Isys
  shaping: string[];                  // rule ids applied, e.g. 'piezo.1Mohm.quack-cut'
}
interface Instrument {
  id: string; name: string; kind: 'electric'|'acoustic'|'mandolin'|'bass'|'other';
  pickups: PickupDef[];
  selectorPositions?: { id: string; label: string; pickups: string[] }[]; // 3-way: neck / both / bridge
  defaultPickupPosition?: string; builtin: boolean; notes?: string;
}

// ---------- IR inventory ----------
interface IRSlot {
  slot: number;                        // 1..20
  nuxIndex: number;                    // 35..54 (slot + 34)
  name: string; loaded: boolean; loadedAt?: string;
  sourceUrl?: string; license?: string; blendOf?: string[];
  prep?: { fidelity: number; eqComp: Record<'31'|'62'|'125'|'250', number>; levelDb: number; wavHash: string };
  tags: string[];                      // 'V30 4x12', 'acoustic body', …
}

// ---------- Profile ----------
interface Profile {
  id: 'me';
  amp: { model: 'mighty-space'; firmware: string /* '20230331' */; appVersion?: string };
  instruments: Instrument[];
  irSlots: IRSlot[];                   // always 20 entries
  playingContext: { setting: 'home'|'band'|'recording'; speaker: 'amp'|'headphones'|'both'; typicalVolume: 'quiet'|'normal'|'loud' };
  learned: { biases: { key: string; delta: number; evidence: number }[]; levelOffsets: Record<string, number> };
  llm: { geminiKey?: string; geminiModel: string; allowGrounding: boolean; handoffTarget: 'chatgpt'|'claude' };
  prefs: { askForVariants: boolean; defaultVariants: 1 };
}

// ---------- Sessions & versions ----------
interface Session {
  id: string; name: string; createdAt: string; updatedAt: string;
  instrumentId: string; pickupPosition?: string;
  tuning: { preset: 'standard'|'drop-d'|'eb'|'d-standard'|'dadgad'|'open-g'|'custom'; text?: string };
  capo: number;                        // 0..12
  headVersionId?: string;              // currently selected version
  archived?: boolean;
}
interface Message {                    // full chat history
  id: string; sessionId: string; at: string;
  role: 'user'|'app';
  kind: 'prompt'|'feedback'|'qr-attach'|'response'|'question'|'llm-handoff';
  text?: string; chips?: string[]; attachmentId?: string; versionIds?: string[];
}
interface Version {
  id: string; sessionId: string; parentId?: string; branchLabel?: string;
  createdAt: string; author: 'engine'|'user-amp'|'import';
  name: string;                        // renamable
  intent: Intent; patch: Patch; qr: string;
  explanation: { summary: string; steps: { ruleId?: string; text: string }[] };
  confidence: { score: number; band: 'low'|'medium'|'high'; factors: { id: string; label: string; effect: number }[] };
  diffFromParent?: DiffEntry[];
  locks: BlockKind[];
  variantGroupId?: string; variantIndex?: number;
  engineVersion: string; knowledgeVersion: string; seed: number;
}
interface DiffEntry { block: BlockKind; kind: 'model'|'enabled'|'param'|'chain'|'master'|'name';
                      key?: string; from: string; to: string; human: string /* "Gain 45% → 38%" */ }
interface SavedTone {
  id: string; versionId: string; sessionId: string; name: string; savedAt: string;
  instrumentId: string; toneType: string; genres: string[]; artists: string[]; songs: string[];
  confidence: number; usesUserIR: boolean; notes?: string;
}
```

Dexie stores: `profile`, `sessions` (`&id, updatedAt`), `messages` (`&id, sessionId, at`),
`versions` (`&id, sessionId, parentId, createdAt`), `savedTones` (`&id, instrumentId, toneType, confidence, usesUserIR, savedAt, *genres, *artists`),
`attachments` (blobs: QR images), `irFiles` (prepared WAVs, optional), `settings`.

Backup file: `{ format: 'mighty-tone-backup', schemaVersion, exportedAt, appVersion, data: {...all stores...} }`
(Zod-validated on import; Gemini key excluded unless the user ticks "include API key").

## 4. Structured intent JSON the LLM must return

The LLM receives: the user prompt, session context (instrument/pickup type, tuning, capo, playing context), the
allowed vocabulary/enum lists, and the JSON Schema generated from `IntentLLM`. It must return **only** this object
(inside a ```json fence is tolerated):

```json
{
  "schemaVersion": 1,
  "kind": "tone-intent",
  "reference": { "artist": "John Mayer", "song": "Slow Dancing in a Burning Room", "part": "clean", "era": "2006 Continuum" },
  "summary": "Glassy, slightly compressed Strat-into-Dumble/Two-Rock clean with light edge.",
  "archetype": "glassy-clean",
  "gain": { "level": 1, "character": "edge" },
  "eqTargets": [ { "band": "lowmid", "delta": -1 }, { "band": "presence", "delta": 1 } ],
  "descriptors": [ "glassy", "warm", "dynamic" ],
  "effects": {
    "comp": { "want": "on", "amount": 1 },
    "efx":  { "want": "on", "type": "od", "amount": 1 },
    "mod":  { "want": "off" },
    "dly":  { "want": "on", "type": "analog", "division": "1/8d", "mix": 1 },
    "rvb":  { "want": "on", "type": "spring", "size": 1, "mix": 1 }
  },
  "originalGear": [ { "role": "amp", "name": "Two-Rock / Dumble-style", "confidence": 0.7 },
                    { "role": "pedal", "name": "Klon / TS-style low gain", "confidence": 0.6 } ],
  "preferModels": [ "amp.budda", "amp.deluxe-rvb" ],
  "avoidModels": [],
  "confidence": 0.7,
  "sources": [ { "title": "…", "url": "https://…" } ],
  "caveats": [ "Original uses single coils; user has humbuckers — engine should brighten." ]
}
```

For IR recommendations (`"kind": "ir-recommendation"`):

```json
{
  "schemaVersion": 1, "kind": "ir-recommendation",
  "items": [ { "name": "…", "vendor": "…", "url": "https://…", "license": "free / freeware / CC-BY …",
               "mic": "SM57", "cab": "2x12 open back", "originalLengthMs": 200, "sampleRate": 48000,
               "truncationNote": "Most character in first 10 ms; low end below ~100 Hz will be lost.",
               "whyFits": "…" } ],
  "caveats": []
}
```

Validation rules (all enforced in `llm/validate.ts`, LLM output is untrusted):
- Unknown enum values are dropped, not coerced silently; drops are listed in the explanation.
- `preferModels`/`avoidModels` must exist in `mighty-space.json`; otherwise mapped by `originalGear` → model
  similarity table (`references.json` gear map) or ignored.
- Numbers are clamped to schema ranges; there is no field that maps directly to bytes.
- URLs must be `https:`; displayed as links only; never fetched automatically.
- Failure → one repair retry (send validation errors back) → handoff fallback → parser-only intent.

## 5. Patch codec details

Facts (see SOURCES.md S1–S6):
- QR text: `nux://MightyAmp:` + base64(`[0x0F, 0x01]` + 113 preset bytes). Device QR id 15 / version 1.
- Head bytes 1..9 (`Head_iCMP`..`Head_iCAB`): low 6 bits = model `nuxIndex`, bit `0x40` set = block OFF.
- Params at fixed indexes (CMP 15–18, EFX 20–25, AMP 27–34, EQ 36–47, NG 49–52, MOD 54–59, DLY 61–68, RVB 70–73,
  CAB 75–80), MASTER 84, LINK1.. 89–97 (9-slot chain), UserName 100+ (only 100–112 fit in a 113-byte payload).
- `.mspatch`: 8404 bytes, preset at offset 4..116, rest zero (reference converter).
- Decoder replicates mightier_amp's tolerance: if `raw[89]` is not a valid head index, advance the chain start by up
  to 3 bytes; record which offset was used and re-encode at the same offset (template-preserving).
- Formatters (raw ↔ human): percent (0–100), db12 `(v+12)/24*100` floor (cab level, master), db15 `(v+15)/30*100`
  floor (EQ bands), lowcut `20 + raw/100*280` Hz, highcut `10^(log10 5k + raw/100 * (log10 20k − log10 5k))`,
  tempo piecewise-linear over 5 breakpoints at raw 0/25/50/75/100.

Delay tables (seconds at raw 0/25/50/75/100) from `TempoFormatter.dart`:

| Model (formatter) | 0 | 25 | 50 | 75 | 100 |
| --- | --- | --- | --- | --- | --- |
| Digital, Pan, Phi (`tempoPro`) | 0.07973 | 0.16125 | 0.50313 | 0.73984 | 0.99023 |
| Mod (`tempoProMod`) | 0.01825 | 0.19829 | 0.59821 | 1.03996 | 1.19181 |
| Analog (`tempoProAnalog`) | 0.04027 | 0.16029 | 0.28031 | 0.33073 | 0.40077 |
| Tape (`tempoProTapeEcho`) | 0.05331 | 0.18831 | 0.39804 | 0.48815 | 0.54594 |

Worked example (acceptance test DLY-01): dotted 1/8 at 100 BPM = 60000/100 × 0.75 = **450 ms** → Digital:
segment 25–50, raw = 25 + 25 × (0.450 − 0.16125)/(0.50313 − 0.16125) = 46.1 → **46** → 448.4 ms (−1.6 ms).
Algorithm: compute target ms; for the chosen model evaluate all 101 raw values, pick min |error|; if the target is
outside the model's range, propose halving/doubling the division or switching to a model whose range covers it;
always display "set ≈ 448 ms (target 450)". BPM-only change: keep every other byte and only rewrite the time param.

## 6. Tone engine design

- **Parser**: normalise → tokenize → multi-word phrase matching against `vocabulary.json` (synonyms, stemming-lite)
  → modifiers (negation "not", "less", "without"; intensity "slightly", "very", "super") → numeric extraction (BPM,
  "dotted eighth", "450 ms", "capo 3") → reference detection (library lookup by artist/song aliases, fuzzy) →
  Intent with `coverage` and `unknownTerms`.
- **Archetypes** give a chain template (order + enabled blocks) and parameter priors per gain level.
- **Model scoring**: `score = Σ intent.tag × model.character[tag] + instrumentFit + referenceGearMatch + learnedPref − penalties`.
  Hidden amps are first-class candidates. Acoustic IRs (G-HBIRD/G-J15/M-D45) prefer magnetic pickups, especially neck
  single coil, and are the default cab for the mandolin acoustic-sim base.
- **Rules** (`rules.json`): `{ id, when: <predicate DSL on intent/context/patch>, then: <adjustments>, rationale, exceptions[] }`.
  Families: gain staging (total gain budget per archetype; boost-into-clean vs drive stacking), cut-before-boost
  (prefer cab low/high cut and EQ cuts before boosts), context (home speaker: tame lows/highs at low volume; band mix:
  more mids, less low end, less reverb/delay mix), less-is-more (cap effect count/mix) with documented exceptions
  (ambient, shoegaze, explicit user ask), noise (gate threshold scales with gain and pickup noisiness).
- **Instrument shaping** examples: EJ-200CE passive piezo into a 1 MΩ input → quacky/thin: cut ~1–2.6 kHz quack zone,
  gentle low-mid support, high cut ~8–10 kHz, compressor for piezo spikes, prefer Optima Air/Stageman; Fishman Isys
  active → assume user's onboard EQ flat, advise phase switch for feedback/boom; Avion HB101N/HB102B (LP-style, 3-way)
  → neck = warm (reduce lows for clarity), bridge = more aggressive (tighter low cut on high gain); mandolin stacked
  humbucker → narrower range, lift 2–3 kHz chop, low cut higher (~120 Hz). Tuning down → raise cab low cut and tighten;
  capo high → slight treble reduction.
- **Level matching**: `targetLevel − loudness(ampModel, gain, master) − Σ effectContribution + learnedOffset(amp)`
  → master byte; target per playing context.
- **Variants**: generate top-K candidate plans, select N maximizing min pairwise distance (model choice, gain, ambience)
  under a quality floor; each variant labelled ("tighter", "warmer", "more ambient").
- **Confidence**: `score = 100 × Σ wᵢ·fᵢ` with factors: intent coverage, reference provenance (built-in > grounded LLM
  > handoff > none), instrument fit, rule conflicts resolved, distance from a verified fixture/base tone, feedback
  convergence (fewer opposing feedbacks → higher), unknown/unverified models used (penalty). Each factor is shown.
- **Feedback rules** are context-dependent, e.g. "muddy": electric HB high gain → raise cab low cut/cut 220–500 Hz/
  lower gain; piezo acoustic → cut 220 Hz and raise low cut; mandolin → raise low cut first. "Too much gain" lowers
  amp gain before drive level, unless the drive is the main gain source.
- **Lock-a-block**: locked blocks are copied verbatim; solver and feedback skip them; a conflict produces an
  explanation ("wanted to cut mids on locked EQ — adjusted amp mid instead").

## 7. IR prep DSP design

| Step | Method | Notes |
| --- | --- | --- |
| Decode | Own RIFF/WAVE parser: PCM 16/24/32, IEEE float 32/64, mono/stereo (stereo → mid or chosen channel) | `decodeAudioData` fallback only |
| Resample | Polyphase windowed-sinc (Kaiser β≈9, ≥64 taps/phase) to 48 kHz | Deterministic, Node-testable |
| Trim | Remove leading samples below −60 dBFS relative to peak, keep 8-sample pre-roll | Also reported as ms removed |
| Blend | Align by cross-correlation peak, weighted sum (0–100%) | Before min-phase |
| Min-phase | Real cepstrum (homomorphic) with N = 65536 zero-padded FFT, fold, exp | Preserves magnitude, concentrates energy early |
| FIR design | Weighted least-squares 512-tap fit to complex min-phase target on ~2048 log-spaced bins (20 Hz–20 kHz); weights ∝ log-frequency density × perceptual emphasis (1/6-octave smoothed target); Tikhonov λ; solve 512×512 normal equations via Cholesky; optional 3–5 iterations replacing target phase with the current FIR phase (magnitude-only refinement) | Baseline comparison: naive truncation + half-Hann window |
| Normalize | Peak or energy normalization to a fixed reference (e.g., −1 dBFS peak), report level change | Level change feeds level matching |
| Fade | Raised-cosine fade over last 16–64 samples | Avoids truncation click |
| Residual | 1/3-octave error (original vs FIR) in 25–315 Hz → map to 10-band EQ 31/62/125/250 bands, clamped ±6 dB, 0.5 dB steps | Stored on IRSlot; engine applies when cab = that slot |
| Fidelity | Weighted RMS dB error over 1/3-octave bands 80 Hz–12 kHz → 0–100 score; also show worst band | Displayed with "vs naive truncation" delta |
| Export | 48 kHz, 32-bit float or 24-bit PCM mono WAV (format chosen in Phase 0 spike to match Mighty Editor) | Share sheet on iOS |

All DSP runs in a dedicated Web Worker; performance target < 3 s for two 500 ms IRs on a recent iPhone.

## 8. LLM adapters

- `llm/gemini`: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with header
  `x-goog-api-key`, `tools: [{ google_search: {} }]`, system prompt + schema text; parse first JSON object from text;
  surface grounding citations. Model id configurable (default: a current free-tier Flash model). Errors: 429/quota →
  `QuotaExceeded` → handoff; 400 safety/format → repair retry; network → offline message.
- `llm/handoff`: builds a compact prompt (≤ ~6 000 URL chars; otherwise copies to clipboard and opens the bare site),
  links `https://chatgpt.com/?q=<encoded>` and `https://claude.ai/new?q=<encoded>`; paste-back textarea → same
  validator.
- Prompts are versioned files in `src/llm/prompts/` with snapshot tests.

## 9. Design-system integration point

`src/ui/kit/index.ts` exports the only primitives screens may use. Phase 1 ships a minimal unstyled implementation.
The design track delivers: tokens (`tokens.css` custom properties: color, type scale, radius, spacing, motion), a
chosen OSS kit wired behind the adapter, and screen mocks. QA's UX check compares screens with mocks at iPhone
(390×844) and Mac (1280×800) sizes via Playwright screenshots.
