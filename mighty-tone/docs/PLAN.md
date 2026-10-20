# Mighty Tone Generator — Build Plan (v1)

Status: PLANNING ONLY. No code has been written. This document is the single source of truth for the
build; the ORCHESTRATOR agent owns it and updates `docs/STATUS.md` (created in Phase 0) as work progresses.

Supporting documents:

| Doc | Purpose |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Module boundaries, data flow, schemas (Patch, Intent, Session, Version, Instrument, IRSlot, Profile), LLM intent JSON, codec and DSP design |
| [AGENTS.md](./AGENTS.md) | Orchestrator, worker and QUALITY agent definitions, handoffs, parallelism, integration checkpoints |
| [ESTIMATES.md](./ESTIMATES.md) | Wall-clock and token estimates per phase, assumptions |
| [TRACEABILITY.md](./TRACEABILITY.md) | Requirement → phase/module → acceptance test matrix (every requirement in the product summary) |
| [SOURCES.md](./SOURCES.md) | Verified facts with file/line citations and web sources |

---

## 0. Product in one paragraph

A free, offline-capable, installable PWA (GitHub Pages, repo `saketgaikwad-max/Mighty-Tone-Generator`) that turns
a natural-language tone request into an exact NUX Mighty Space patch (firmware 20230331), rendered as a QR code the
MightyAmp iOS app (3.6.6) can scan. A deterministic, data-driven tone engine does the work — instrument/pickup aware,
tuning/capo aware, explains every choice and rates its own confidence. Users iterate in chat-style sessions with a
version timeline (diffs, branching, lock-a-block, variants), save tones to a searchable library, and optionally use
Gemini (user's own free key) or a ChatGPT/Claude copy-paste handoff for unknown artist/song references and external IR
recommendations. An in-browser IR prep tool converts downloaded IRs into the best possible 512-tap / 48 kHz user IR
and computes low-end EQ compensation the engine applies. All data is local (IndexedDB) with file backup.
Runtime never depends on an enterprise AI account; the core never needs any LLM.

---

## 1. Recommended tech stack

| Concern | Choice | Why (and rejected alternatives) |
| --- | --- | --- |
| Language | **TypeScript (strict)** | Byte-exact codec + DSP need types; maintainers with free tools (VS Code + tsc) get safety. |
| Build | **Vite 6+** | Fast, zero-config static output for Pages; `base: '/Mighty-Tone-Generator/'`. |
| UI framework | **React 19** (+ `react-dom`), function components | The parallel design track will pick an open-source, dark, Apple-like kit; nearly all candidates (Konsta UI, shadcn/ui + Radix, Framework7-React, Ionic React) ship React bindings first. Preact would save ~30 KB but risks kit incompatibility; Svelte narrows the kit choice. Revisit only if the design track picks a Svelte-only kit. |
| Design-system integration point | `src/ui/kit/` adapter + `src/ui/tokens.css` | All screens import primitives only from `src/ui/kit/index.ts` (Button, Sheet, List, Chip, SegmentedControl, TextArea, Toast, NavBar, TabBar). The design track fills the adapter; a temporary unstyled kit lets UI work proceed before the design lands. |
| State | **Zustand** (tiny, no boilerplate) | UI state only; durable state lives in the store module. |
| Routing | **wouter** (hash-based) or React Router hash mode | Hash routes avoid 404s on GitHub Pages deep links. |
| Persistence | **Dexie 4** over IndexedDB (+ `fake-indexeddb` in tests) | Indexed queries for library filters, versioned schema migrations, transactions. `navigator.storage.persist()` requested on every launch. |
| Validation | **Zod** (+ `zod-to-json-schema`) | One schema definition validates LLM intent JSON, backup files, knowledge data files; JSON Schema exported for the LLM prompt. |
| QR encode | **`qrcode`** (node-qrcode, MIT) | Byte-mode, configurable ECC; renders canvas/SVG/PNG. Payload ~170 chars → QR version ~8-10. |
| QR decode | **`qr-scanner`** (MIT, Web Worker) primary, **`jsQR`** (Apache-2.0) fallback, with a preprocessing ladder (downscale, crop-to-largest-square, grayscale + adaptive threshold, invert) | Screenshots from MightyAmp contain UI chrome; multiple strategies raise success rate. Same lib family the reference converter uses (`QrScanner.scanImage`). |
| DSP (IR prep) | **Pure TypeScript** in a **Web Worker**: own radix-2 FFT (or `fft.js`, MIT), own WAV parser/writer, windowed-sinc (Kaiser) resampler, cepstral minimum-phase, weighted least-squares FIR via Cholesky | Deterministic, unit-testable in Node, works offline on iOS. Avoid `decodeAudioData`/`OfflineAudioContext` for the core path (Safari resamples to context rate and results vary by device); keep it only as a fallback decoder for exotic formats. |
| Charts | Small custom **SVG** log-frequency plot component | Two curves + residual; avoids a chart dependency and matches the design kit. (uPlot is the fallback if needs grow.) |
| Search | **MiniSearch** (MIT, ~7 KB) | Saved Tones full-text + facet filters offline. |
| PWA | **vite-plugin-pwa** (Workbox `generateSW`, `registerType: 'prompt'`) + manual iOS meta (`apple-touch-icon`, `apple-mobile-web-app-capable`, status-bar style) | Precache app shell + knowledge data; update prompt so iOS users get new versions deliberately. |
| Unit / property tests | **Vitest** (+ `fast-check` for codec round-trip properties) | Same config as Vite; runs in Node for codec, engine, DSP. |
| E2E | **Playwright** with **WebKit** project + `iPhone 15` device emulation, Chromium project for desktop | WebKit is the closest free proxy for iOS Safari. Real-device checks are user checkpoints. |
| Lint/format | ESLint (typescript-eslint) + Prettier | Free, standard. |
| CI/CD | **GitHub Actions**: `ci.yml` (lint, typecheck, unit, eval suite, e2e-webkit, build) and `pages.yml` (`actions/upload-pages-artifact` + `actions/deploy-pages`) | Free for public repos; Pages source = "GitHub Actions". |
| Speech input | None in-app; rely on **iOS keyboard dictation** in a plain `<textarea>` | Zero code, works offline on device. |
| LLM | Gemini REST (`generativelanguage.googleapis.com`, `google_search` tool) called directly from the browser with the user's key; handoff links `https://chatgpt.com/?q=` and `https://claude.ai/new?q=` | No backend. Engine never requires it. |

Bundle budget: < 250 KB gzip for the initial route; IR prep worker and QR decoder lazy-loaded.

---

## 2. Architecture (summary — full detail in ARCHITECTURE.md)

```
          ┌───────────────────────── UI (React + design kit) ─────────────────────────┐
          │ Sessions/Chat · Timeline · QR view · Feedback · Library · Profile · IR Prep │
          └───────┬───────────────┬──────────────┬──────────────┬─────────────┬───────┘
                  │               │              │              │             │
           app services (use-cases: generateTone, applyFeedback, branch, importQR, backup)
                  │               │              │              │             │
   ┌──────────────▼──┐  ┌─────────▼────────┐ ┌───▼─────────┐ ┌──▼─────────┐ ┌─▼──────────┐
   │  tone-engine    │  │  llm adapters    │ │  store      │ │ qr (enc/dec)│ │ ir-prep DSP│
   │ parse→intent→   │  │ gemini, handoff, │ │ Dexie: prof,│ │ + image     │ │ (worker)   │
   │ plan→solve→     │  │ intent validator │ │ sessions,   │ │ preprocess  │ │            │
   │ level→explain→  │  │ (Zod)            │ │ versions,   │ └──┬─────────┘ └─┬──────────┘
   │ confidence→diff │  └──────────────────┘ │ library, IR │    │             │
   └──────┬──────────┘                       └─────────────┘    │             │
          │                                                      │             │
   ┌──────▼──────────────────────────────────────────────────────▼─────────────▼──┐
   │ patch-codec (byte-exact 113-byte Plug Pro preset ⇄ typed Patch; .mspatch; QR string) │
   └──────┬───────────────────────────────────────────────────────────────────────┘
   ┌──────▼──────────────────────────────────────────────────────────────────────┐
   │ knowledge/ (JSON data, schema-validated): device models + byte map + formatters│
   │ + delay tables, vocabulary, rules, instruments, references, feedback rules,     │
   │ base tones, confidence weights                                                  │
   └─────────────────────────────────────────────────────────────────────────────────┘
```

Key principles:

1. **Raw bytes are the source of truth.** A `Patch` stores raw 0–100 (or index) values per parameter; human units
   (dB, Hz, ms) are derived via formatters ported from `value_formatters/*.dart`. No float round-trip drift.
2. **Template-based encoding.** Encoding starts from a known-good 113-byte template (from a real amp fixture) and
   overlays only fields the codec understands, so undocumented bytes (0 WAH, 10 SR head, 81–83 SR, 85–88
   delay_time_flag/bpm/BITCTRL) keep device-valid values. Decoding preserves unknown bytes in `Patch.raw`.
3. **Deterministic engine.** Same (prompt, context, profile, seed) → same patch. Variants use explicit seeds and a
   diversity constraint, not randomness.
4. **Data-driven knowledge.** Vocabulary, rules, instruments, references, feedback rules and confidence weights are
   JSON files with Zod schemas and a contributor guide, so the app can be maintained without an LLM.
5. **LLMs only emit intents.** Gemini / handoff output is a structured Intent JSON validated by the same schema the
   deterministic parser produces; it never writes bytes or parameters directly.
6. **Pure core, thin UI.** `knowledge`, `codec`, `engine`, `dsp`, `llm` (minus fetch) are framework-free modules
   testable in Node.

Schemas (Patch, Intent, Session, Version, Instrument, IRSlot, Profile, LLM intent JSON) are in
ARCHITECTURE.md §3–§4.

---

## 3. Setup tasks (Phase 0)

| # | Task | Owner | Output |
| --- | --- | --- | --- |
| S1 | Scaffold repo at `/Users/saket.gaikwad/Guitar/mighty-tone` (Vite React TS), folder layout per ARCHITECTURE §1, strict tsconfig, ESLint/Prettier, path aliases | W1 Platform | Builds, `npm test` green on empty suites |
| S2 | `git remote` → `saketgaikwad-max/Mighty-Tone-Generator`; branch protection off (single user); conventional commits; `main` deploys | ORCH | First push only after user approves Phase 0 output |
| S3 | GitHub Actions: `ci.yml` (lint, typecheck, vitest, eval, playwright webkit, build) and `pages.yml` (deploy on push to `main`) | W1 | Green CI; Pages URL live with placeholder shell |
| S4 | Enable Pages with source "GitHub Actions" (via `gh api` if the stored credential allows; else user checkpoint U2) | ORCH / user | `https://saketgaikwad-max.github.io/Mighty-Tone-Generator/` |
| S5 | PWA manifest, icons (192/512/maskable, apple-touch-icon 180), iOS meta, `storage.persist()` | W1 | Lighthouse PWA installable; WebKit e2e smoke |
| S6 | Licensing: repo `LICENSE` (MIT recommended), `THIRD_PARTY_NOTICES.md` with full MIT texts for **mightier_amp** (© 2020-2021 Dian Iliev "Tuntorius") and **mighty-patch-convert** (© 2023 tuntorius); every derived data file carries a `"source"` header (file + commit) | W2 + ORCH | Notices file; `knowledge/*.json` provenance fields |
| S7 | Fixtures layout: `tests/fixtures/qr/<name>.png` + `<name>.txt` (decoded string) + `<name>.expected.json` (what the MightyAmp app shows: models, knob values, delay ms); copy the user's exported QRs from `/Users/saket.gaikwad/Guitar` | W2 + user U1 | Fixture README; at least 3 real fixtures before codec sign-off |
| S8 | Spikes (time-boxed, throwaway branches, results recorded in `docs/spikes/*.md`): (a) QR decode of real MightyAmp screenshots in WebKit; (b) Gemini browser call with `google_search` + JSON output parse, CORS, error/quota codes; (c) iOS Add-to-Home-Screen storage + file download/share of WAV; (d) QR **encode** ECC level/version accepted by MightyAmp scanner | W1, W8, W2 | Go/no-go notes feeding Phases 1–4 |
| S9 | Knowledge extraction tool `tools/extract-plugpro.ts`: reads the Dart sources from a local path (`.research/mightier_amp`, not committed), emits `knowledge/device/mighty-space.json`; CI only validates the committed JSON | W2 | Reproducible data; counts check (29 amps, 34 cabs + 20 user IR slots, 6 delays, 6 reverbs, 14 mods, 3 comps, 14 EFX, 2 EQs, gate) |
| S10 | `docs/STATUS.md`, `docs/DECISIONS.md` (ADR log), `AGENTS.md` copy at repo root for future maintainers, `CONTRIBUTING-KNOWLEDGE.md` (how to edit vocabulary/rules/references without code) | ORCH | Docs present |

---

## 4. Agent structure (summary — full detail in AGENTS.md)

| Agent | Scope | Effort |
| --- | --- | --- |
| **ORCH — Orchestrator** | Owns PLAN/STATUS/DECISIONS, sequencing, interface contracts, integration branches, merges, user checkpoint requests, status reports | high |
| **W1 — Platform & PWA** | Scaffold, CI/CD, Pages, PWA/offline, iOS quirks, perf budget | medium |
| **W2 — Device Knowledge & Patch Codec** | Byte map, model tables, formatters, delay tables, codec, .mspatch, QR encode/decode + image preprocessing | high |
| **W3 — Tone Engine Core** | Prompt parser, intent model, planner, parameter solver, instrument shaping, level matching, delay helper, variants, diff, explanation, confidence | high |
| **W4 — Tone Knowledge Content** | Vocabulary, genre/archetype templates, expert-practice rules, instrument profiles, reference library, feedback rules, mandolin base tones — all as data + rationale docs | high (content quality) |
| **W5 — Store & Sessions** | Dexie schema/migrations, sessions, version DAG, branching, lock state, saved tones + search/filters, profile, learned preferences, backup/export/import | medium |
| **W6 — UI/UX** | All screens via design-kit adapter, chat flow, timeline, QR view, feedback chips, QR attach, library, profile, IR inventory, IR prep UI | medium (high for chat/timeline) |
| **W7 — IR Prep DSP** | WAV I/O, resampling, trim, min-phase, weighted-LS 512-tap FIR, blend, normalize, fade, residual → EQ suggestion, fidelity score, worker | high |
| **W8 — LLM Adapters** | Gemini client (grounding, key storage, quota handling), handoff link builder + paste-back parser, prompts, IR recommendation flow, intent validation glue | medium |
| **QA — Quality** | Code review, byte-exact codec tests vs real fixtures, engine evaluation suite, requirement traceability, UX check vs mocks, per-phase sign-off | high |

Parallelism: W2 ∥ W5 ∥ W7 ∥ W1 in Phase 1; W3 ∥ W4 ∥ W6 in Phase 2; W8 and W7-UI run alongside Phase 3. QA runs
continuously and gates every phase exit.

---

## 5. Phased task breakdown

Effort levels: H = high, M = medium. IDs are referenced by the DAG and TRACEABILITY.md.

### Phase 0 — Setup & risk spikes (H for ORCH/W2 spikes, M otherwise)
- P0.1 Scaffold, lint, test harness, folder layout (S1, S10) — W1
- P0.2 CI + Pages + PWA skeleton (S3–S5) — W1
- P0.3 Licensing & provenance (S6) — ORCH/W2
- P0.4 Knowledge extraction tool + `mighty-space.json` draft (S9) — W2
- P0.5 Spikes a–d (S8) — W1/W2/W8
- P0.6 Fixture intake (S7) — **User U1**, then W2
- Exit gate G0 (QA): CI green, Pages live, extraction counts match, ≥3 real QR fixtures decoded to plausible values, spike verdicts recorded.

### Phase 1 — Foundations (codec, store, shell, DSP core)
- P1.1 Formatters + delay tables ported, unit-tested against Dart formulas (W2, H)
- P1.2 Patch codec: decode 113 bytes → `Patch` (tolerant LINK offset per the "fix for QR" logic), encode via template overlay, `.mspatch` 8404-byte read/write, QR string build/parse, name (≤13 chars in QR bytes 100–112) (W2, H)
- P1.3 QR image decode ladder + QR render component (W2, M)
- P1.4 Golden tests: every fixture decode → expected.json; decode→encode byte-identical; fast-check round-trip on synthetic patches (QA + W2, H)
- P1.5 Dexie schema v1 (profile, instruments, sessions, messages, versions, savedTones, irSlots, settings), repositories, backup/export/import JSON with Zod (W5, M)
- P1.6 App shell: routes, temporary kit adapter, tab bar (Sessions, Library, IR, Profile), design tokens hook (W6, M)
- P1.7 DSP core (pure functions, Node-tested): WAV parse/write, resampler, FFT, trim, min-phase (W7, H) — starts early because independent
- P1.8 "Patch inspector" debug screen: paste/scan QR → table of blocks/params → re-encode QR (W6+W2, M). Doubles as the parked "explain this tone" seed.
- Exit gate G1: byte-exact on all fixtures; **User U3**: re-encoded fixture QR scanned in MightyAmp loads identically; backup round-trip test green.

### Phase 2 — Tone engine MVP + core loop
- P2.1 Intent schema + deterministic prompt parser (tokenize, synonyms, negation, intensity, BPM/division regex, artist/song detection against library) (W3, H)
- P2.2 Knowledge content v1: vocabulary (≥150 descriptors), 12–15 archetypes (clean, glassy clean, edge-of-breakup, blues crunch, classic rock, hard rock, metal, djent/modern, fuzz, ambient/shimmer, country chicken-pickin, jazz, funk, acoustic-sim, mandolin bases), expert rules (gain staging, cut-before-boost, home vs band mix, less-is-more + documented exceptions), instrument profiles (Avion AV-6 HH, Jumbo King Fishman Isys, EJ-200CE passive piezo with 1 MΩ compensation, mandolin stacked HB) (W4, H)
- P2.3 Planner (archetype + model scoring incl. 8 hidden amps), solver (params with constraints, locks), instrument/pickup/tuning/capo shaping, gain staging checks (W3, H)
- P2.4 Level matching (master byte from per-model loudness table + effect contributions + learned offsets) (W3+W4, H)
- P2.5 Delay helper: type + BPM + division → ms → nearest byte per model table; BPM-only edit of an existing patch; out-of-range model suggestions; tap-tempo note (W3, M)
- P2.6 Explanation generator (rule trace → plain language) + confidence model (factor breakdown) + naming (W3, M)
- P2.7 Mandolin base tones (magnetic-electric; acoustic-sim via Optima Air/Stageman + G-HBIRD/G-J15/M-D45) as data + tests (W4, M)
- P2.8 UI: create/name session, instrument/pickup/tuning/capo pickers with smart defaults, prompt box (dictation-friendly), response card (chain, params, explanation, confidence, QR, rename) (W6, H)
- P2.9 Engine evaluation suite v1: ≥80 prompt→expected-chain cases (instrument awareness, tuning/capo, delay math, mandolin, gain staging invariants) (QA, H)
- Exit gate G2: eval suite ≥90% pass with zero invariant violations; **User U4** amp listening test (5–10 patches across all 4 instruments); **User U5** PWA install on iPhone.

### Phase 3 — Iteration loop, versions, library, profile
- P3.1 Feedback chips (muddy, harsh, thin, boomy, too much gain, too wet, + louder/quieter, more/less delay) + free text → feedback intents interpreted in instrument/prompt context (W3+W4, H)
- P3.2 Attach QR exported from amp → decode → becomes the new "current state" version (user tweaks captured) with diff vs last generated (W2+W6, M)
- P3.3 Version DAG: timeline, version selector, "what changed" diffs (block/param/human units), branch from any version, rename versions/tones (W5+W6, H)
- P3.4 Lock-a-block (block-level locks respected by solver and feedback) (W3+W6, M)
- P3.5 Variants: app asks "want options?"; 1–5 variants with diversity constraint; default one per iteration (W3+W6, M)
- P3.6 Saved Tones library: save from any version; search + filters (instrument, tone type, genre, artist/song, confidence, uses user IR, date) (W5+W6, M)
- P3.7 Profile: instruments CRUD (any manual instrument/pickup), amp firmware, IR slot inventory (20 slots, indexes 35–54), playing context, learned preferences (from feedback history), Gemini key field (W5+W6, M)
- P3.8 Learned preferences applied by engine (bounded biases, explainable) (W3, M)
- P3.9 Eval suite v2: feedback cases (e.g., "muddy" on EJ-200CE piezo vs on Avion neck HB → different fixes) (QA, H)
- Exit gate G3: full loop e2e in WebKit (create → generate → feedback → attach QR → branch → save → search); backup/import across devices simulated.

### Phase 4 — References & LLM (parallel with Phase 3 after P2 interfaces freeze)
- P4.1 Built-in reference library v1 (≈60–100 artist/song entries as structured intents with sources/notes) (W4, H)
- P4.2 Gemini adapter: key storage, model id setting, `google_search` tool, JSON intent extraction + Zod validation + one repair retry, grounding citations shown, quota/429 detection → handoff fallback (W8, M)
- P4.3 Handoff: prompt builder (schema + context, URL-length aware), `chatgpt.com/?q=` / `claude.ai/new?q=` links, copy button, paste-back parser (W8, M)
- P4.4 UI: "unknown reference" flow, provenance badges (built-in / Gemini / handoff), privacy notice (free tier data use) (W6, M)
- P4.5 Eval: intent validation fuzzing (malformed/hostile LLM JSON never crashes or writes out-of-range bytes) (QA, M)
- Exit gate G4: engine works with network off; Gemini path and handoff path produce valid intents in e2e (Gemini mocked in CI; **User U6** live key test).

### Phase 5 — IR prep tool & external IR flow (DSP core from P1.7; parallel with Phases 3–4)
- P5.1 Weighted least-squares 512-tap FIR (log-frequency weighting, min-phase complex target, Tikhonov, optional magnitude-refinement iterations), blend of two IRs, normalization, fade (W7, H)
- P5.2 Low-end residual (31–250 Hz) → 10-band EQ compensation suggestion (31/62/125/250 bands, clamped) stored on IRSlot; engine applies it when that slot is used (W7+W3, H)
- P5.3 Fidelity score + frequency-response chart (original vs 512-tap vs naive truncation; residual) (W7+W6, M)
- P5.4 Export 48 kHz WAV (Web Share API on iOS, download on Mac) + record in IR inventory (W6+W5, M)
- P5.5 Gemini IR recommendation (only on explicit request): best few free trusted IRs with links + truncation notes; handoff fallback (W8, M)
- P5.6 DSP verification: synthetic IRs with known responses, published-IR regression set (license-checked), performance on iPhone (< 3 s for 2 IRs) (QA, H)
- Exit gate G5: DSP tests green; **User U7** loads a prepared IR via Mighty Editor, records slot, engine-generated patch using it sounds right.

### Phase 6 — Hardening & release
- P6.1 Offline/update UX, storage persistence prompts, backup reminders, error states (W1+W6, M)
- P6.2 Accessibility (Dynamic Type-ish scaling, VoiceOver labels), performance budget, Lighthouse (W6+W1, M)
- P6.3 Maintainer docs: README, CONTRIBUTING-KNOWLEDGE, "how to add an instrument/reference/rule", "how to verify a new firmware's byte map" (ORCH+W4, M)
- P6.4 Final traceability audit + regression run + UX check vs mocks (QA, H)
- P6.5 Release v1.0 tag, Pages deploy, changelog (ORCH, M)
- Exit gate G6 (final sign-off): all TRACEABILITY rows "pass"; **User U8** acceptance on amp + iPhone + Mac; **User U9** rotate/revoke the GitHub credential.

### DAG (task dependencies)

```
P0.1 ─► P0.2 ─► P0.5(a,c)
P0.1 ─► P0.4 ─► P1.1 ─► P1.2 ─► P1.4 ─► G1
U1 ───► P0.6 ─────────────────► P1.4
P0.5(b) ─────────────────────────────────────► P4.2
P0.5(d) ─► P1.3 ─► P1.8
P0.1 ─► P1.5 ─────────► P3.3, P3.6, P3.7
P0.1 ─► P1.6 ─► P2.8 ─► P3.*  (design kit drop-in any time after P1.6)
P0.1 ─► P1.7 ─► P5.1 ─► P5.2 ─► P5.3 ─► P5.4 ─► G5
P1.2 ─► P2.3 ;  P2.1 ─► P2.3 ;  P2.2 ─► P2.3 ─► P2.4, P2.5, P2.6, P2.7 ─► P2.9 ─► G2
G2 ─► P3.1 ─► P3.9 ;  G2 ─► P3.4, P3.5, P3.8
G1 + P1.5 ─► P3.2, P3.3
P2.1 (intent schema frozen) ─► P4.1, P4.2, P4.3 ─► P4.4 ─► G4
P5.2 ─► (engine applies EQ comp) requires P2.3
G3 + G4 + G5 ─► P6.* ─► G6
```

Critical path: P0.1 → P0.4 → P1.1 → P1.2 → P1.4/G1 (needs U1, U3) → P2.3 → P2.9/G2 (U4) → P3.1/P3.3 → G3 → P6 → G6.

Parallel tracks: (A) codec chain; (B) store + shell; (C) DSP core → IR prep; (D) knowledge content (W4 can start
vocabulary/instrument data right after P0.1 using the draft device JSON); (E) LLM adapters after intent schema freeze.

### User checkpoints (only the user can do these)

| ID | When | Action |
| --- | --- | --- |
| U1 | Phase 0 (blocking G1) | Export 3–5 QR codes from MightyAmp into `/Users/saket.gaikwad/Guitar` (clean; high-gain; delay+reverb). Strongly preferred extras: one delay patch with a noted ms/BPM shown in the app; one using a hidden amp; one using an Acoustic IR (G-HBIRD/G-J15/M-D45); one using a user IR slot; one with non-default chain order. For each, a screenshot of the app's parameter pages (to build `expected.json`). |
| U2 | Phase 0 (if needed) | Enable GitHub Pages "Source: GitHub Actions" in repo settings, if the agent cannot via `gh api`. |
| U3 | End of Phase 1 (gate) | Scan 2–3 app-re-encoded QR codes in MightyAmp; confirm each loads identically (models, knobs, chain order, name). |
| U4 | End of Phase 2 (gate) | Play 5–10 generated patches on the amp with Avion, Jumbo King, EJ-200CE, mandolin; give feedback in-app. |
| U5 | Phase 2 | Install the PWA via Safari "Add to Home Screen" on iPhone (and "Add to Dock" on Mac); confirm offline launch. |
| U6 | Phase 4 | Create a free Gemini API key in Google AI Studio, paste it in Profile; try 2–3 unknown-artist prompts. |
| U7 | Phase 5 | Download a recommended free IR, run IR prep, load the WAV into a user slot with Mighty Editor (Mac), record it in the IR inventory, test a patch using it. |
| U8 | Phase 6 | Final acceptance: full loop on amp; backup export on iPhone → import on Mac. |
| U9 | Release | Rotate/revoke the GitHub token/credential stored in macOS Keychain used by the agents. |

---

## 6. Risks and mitigations

| # | Risk | Likelihood / impact | Mitigation |
| --- | --- | --- | --- |
| R1 | **Byte map errors** (reverse-engineered, Plug Pro map assumed for Space; LINK offset shifts — mightier_amp has a "fix for QR" that skips up to 3 bytes before the chain; undocumented bytes 0, 10, 81–83, 85–88; name truncated to 13 chars in QR) | Med / High | Template-based encoding preserving unknown bytes; golden real fixtures; byte-identical re-encode test; user scan gate U3 before engine work ships; codec reports "unknown byte changed" warnings on decode. |
| R2 | **Delay time tables** may differ on firmware 20230331; Analog V2 stores time in Para1 labelled "Rate" (naming trap); steps 3–14 ms | Med / Med | Per-model data table with param index; fixture with known ms (U1); show achieved ms + error; tap-tempo fallback guidance; QA test for 100 BPM dotted 1/8 → Digital byte 46 ≈ 448 ms. |
| R3 | **Tone quality is subjective**; engine credibility | High / High | Expert rules encoded with rationale; eval suite with invariants (no gain stacking beyond budget, cut-before-boost, level match); explainable confidence; fast feedback loop + learned prefs; U4 listening gate; knowledge files editable later. |
| R4 | **Gemini free tier changes** (limits, model deprecations, Gemini 3+ grounding billed per query; free tier data may be used to improve Google products; JSON-mode + search tool combination may be restricted) | Med / Med | Engine never needs LLM; model id configurable; parse JSON from text + Zod + 1 repair retry; quota/429 → handoff; privacy notice; spike S8(b). |
| R5 | **iOS PWA quirks**: home-screen app storage is separate from Safari tab storage; eviction under pressure unless persisted; downloads/file export behave differently; no Web Bluetooth/MIDI | Med / High | `storage.persist()` each launch; prominent backup/export + reminders; Web Share API for WAV/backup; tell users to use the installed app only; QR flow needs no BLE. |
| R6 | **QR decode from screenshots** unreliable (UI chrome, compression, small modules) | Med / Med | Multi-strategy decode ladder, crop helper UI, manual paste of `nux://` string, camera-roll images; WebKit e2e on real fixture screenshots. |
| R7 | **QR encode accepted by MightyAmp** (ECC/version/quiet zone/size) | Low-Med / High | Spike S8(d) + U3; match reference converter output style; render large with quiet zone; offer PNG save. |
| R8 | **IR prep quality claims**: 512 taps @48 kHz (~10.7 ms, ~94 Hz bin spacing) cannot reproduce sub-100 Hz detail or room tails | High (inherent) / Med | Honest fidelity score and chart; low-end residual → EQ compensation; wording "best 512-tap approximation", never "identical"; compare vs naive truncation in UI. |
| R9 | **Hidden amps / firmware differences** (8 hidden amps may behave differently or be absent; ChopTones IRs unverified) | Low-Med / Med | Hidden-amp fixture (U1) or U3 scan test; flag `verified: false` in data until confirmed; exclude ChopTones from engine until a fixture proves index. |
| R10 | **Level matching without audio measurement** | High / Low-Med | Heuristic loudness table + per-user learned offsets from "louder/quieter" chips; label as estimate. |
| R11 | **Licensing/attribution** for MIT-derived tables; third-party IR licenses | Low / Med | THIRD_PARTY_NOTICES; provenance fields; never bundle third-party IRs; Gemini recommendations link to sources only. |
| R12 | **Scope creep / agent drift** across many parallel agents | Med / Med | Frozen interface contracts per phase (`src/contracts/*.ts`), ADR log, QA gates, ORCH-only merges. |
| R13 | Credential exposure (push token on the machine; Gemini key on device) | Low / Med | Agents never print secrets; Gemini key stored only in IndexedDB, excluded from backups by default; U9 rotation. |

---

## 7. Estimates (summary — detail and assumptions in ESTIMATES.md)

| Phase | Agent wall-clock | Tokens (M) | Effort mix |
| --- | --- | --- | --- |
| P0 Setup & spikes | 3–6 h | 0.6–1.0 | M (H spikes) |
| P1 Foundations | 6–12 h | 2.0–3.5 | H codec/DSP, M store/shell |
| P2 Engine MVP + core loop | 8–16 h | 2.8–4.8 | H |
| P3 Iteration, versions, library, profile | 8–14 h | 2.2–3.8 | M/H |
| P4 References & LLM (parallel) | 4–8 h | 1.2–2.2 | M (H content) |
| P5 IR prep & IR flow (parallel) | 6–12 h | 1.6–3.0 | H |
| P6 Hardening & release | 4–8 h | 1.0–2.0 | M (H QA) |
| **Total** | **critical path ≈ 30–56 h agent time; 2–4 calendar weeks incl. user checkpoints** | **11.4–20.3 M (central ≈ 15 M)** | |

Totals include ORCH and QA shares and a 15–25% parallel-agent overhead. This is above the earlier 8–15 M guidance
because of the IR prep DSP, version DAG/branching, variants, delay helper and reference library.

---

## 8. Requirements traceability

The full matrix (97 rows, R01–R97: every requirement in the product summary → phase/task → module → acceptance test ID) is
in [TRACEABILITY.md](./TRACEABILITY.md). QA owns it; every phase gate requires all rows scheduled for that phase to
be "pass" or have an ORCH-approved waiver recorded in `DECISIONS.md`.

---

## 9. Parked for later phases (explicitly out of v1)

Slot planning / setlists; "explain this tone" for arbitrary QR (P1.8 inspector is the seed); live BLE/USB control
(not possible in iOS Safari anyway); IR audio preview player; Apple on-device model via Shortcuts.
