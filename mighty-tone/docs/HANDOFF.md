# Mighty Tone Generator — Handoff (read this first in any new chat)

Full plan: `PLAN.md`, `ARCHITECTURE.md`, `AGENTS.md`, `ESTIMATES.md`, `TRACEABILITY.md`, `SOURCES.md` (this folder). Design: `../design/DESIGN_SYSTEM.md`, `../design/mockups/index.html`.

## Setup already DONE by the user — do NOT ask again
- GitHub repo EXISTS: https://github.com/saketgaikwad-max/Mighty-Tone-Generator (public, branch `main`, has a README commit). Do not create a new repo.
- Push access WORKS from this Mac: a fine-grained token (Contents/Pages/Workflows read-write, this repo only) is stored in the macOS Keychain via `git credential-osxkeychain` for user `saketgaikwad-max`; a `git push --dry-run` succeeded on 2026-10-19. Use plain HTTPS remotes; never ask for or print the token. Git commands that touch the Keychain need to run outside the sandbox (required_permissions: all).
- To use it: `git clone https://github.com/saketgaikwad-max/Mighty-Tone-Generator.git` into `/Users/saket.gaikwad/Guitar/mighty-tone/app` (or add it as `origin` to the project folder), then commit and push to `main`.
- Gemini API key: user has it; it is NEVER given to agents. The app's Profile screen stores it on-device (S4). Use a mock in tests.
- GitHub Pages: not enabled yet; guide the user through Settings > Pages (source: GitHub Actions) when the first deploy workflow is pushed.

## Decisions (final)
- Installable PWA (React + Vite + TS), GitHub Pages: repo `saketgaikwad-max/Mighty-Tone-Generator` (push creds in macOS Keychain). No backend, no paid services, data on device + backup/export.
- Amp: NUX Mighty Space, firmware 20230331, MightyAmp iOS 3.6.6. Patch delivery via NUX QR (`nux://MightyAmp:` + base64([0x0F,0x01] + 113 bytes)); `.mspatch` = 8404 bytes, preset at offset 4. Build new patches on top of real fixture QRs.
- Reference code (MIT): `../../.research/mightier_amp` (plug_pro effects, NuxConstants byte map), `../../.research/mighty-patch-convert`. Extract once into JSON data files; do not re-read Dart afterwards.
- Tone engine is deterministic and data-driven; LLM (user's free Gemini key, entered in app Profile; fallback ChatGPT/Claude copy-paste handoff) only returns structured intent JSON. Never needs the enterprise model at runtime.
- UI: Konsta UI v5 iOS theme + Tailwind, dark only, Lucide icons, system font.
- Instruments store pickup TYPE only (smart defaults or typed). The app SUGGESTS pickup position and guitar volume/tone knob settings per tone.
- Defaults: variants = swipe; signal chain read-only in v1; mandolin has two base tones (magnetic electric; Optima Air/Stageman + G-HBIRD/G-J15/M-D45).
- IR: user IRs truncated to 512 samples @48k; in-app IR prep tool (trim, min-phase, 512-tap weighted LS fit, blend, normalise, EQ compensation) + guided step-by-step IR flow. External IR recommendations only on explicit request.
- Delay helper: type + BPM + division -> nearest device value (0-100 byte, ~7-14 ms steps).

## Token budget strategy
- User has a limited enterprise token budget. Work in small, sequential slices; one agent at a time; start a NEW chat per slice with this file as context.
- Prefer automated tests over agent review; keep messages short.

## Slice order (MVP first)
1. S1 Data + codec: **DONE 2026-10-20** (see `STATUS.md`, `DECISIONS.md`). `knowledge/device/mighty-space.json` (generated; re-run `npm run extract`), `src/codec/*`, `src/qr/decode-image.ts`, fixtures in `tests/fixtures/`. `npm run verify` = typecheck + Vitest (ESLint arrives with S2, ADR-001).
2. S2 Minimal app: instrument pick, prompt, engine v1 (vocabulary + instrument rules for clean/crunch/lead/high-gain/acoustic/mandolin), QR output, feedback chips, QR import, local save. Deploy to Pages.
3. S3 Versions timeline, saved-tones filters, profile, backup.
4. S4 Delay helper, variants, lock-block, references library + Gemini/handoff.
5. S5 IR Lab (prep tool + guided flow + slot inventory).

## Fixtures (copied to `tests/fixtures/`; originals in `/Users/saket.gaikwad/Guitar/fixtures/`)
QR-to-preset mapping **verified by decoding the payloads** (ADR-005): model, every knob and chain order match exactly.
- `qr/gain-responsive-distortion` = preset 1, amp 1987 X 50 (Gain 75, Master 60, Bass 50, Middle 67, Treble 64, Presence 61).
- `qr/clean-tone` = preset 3, amp MLD (Gain 30, Master 80, Bass 86, Mid Freq 8, Middle 17, Treble 35).
- `qr/acoustic-ir-tone` = preset 4, cab = user IR slot 3 (app name "Dread-35 SR25 Pz1"; QR stores only the slot), Level 6 dB, Low Cut 31 Hz, High Cut 14142 Hz.
- Chain order differs per preset and decodes correctly. Official exports have empty name bytes and master byte 0 (open question in DECISIONS.md). No delay-ms fixture yet; the clean fixture's Digital Delay decodes to ≈692 ms (cheap check for R51).

## Open items
- Delay-time calibration fixture (later), or confirm preset 3 DLY shows ≈692 ms.
- Master byte 0 / empty name in official QR exports: settle at U3 (needs QR render from S2).
- Rotate GitHub token at end.

---

## NEXT TASK: UI Polish Pass (start here in a new chat)

**Status:** All slices S1–S5 done, app is live at https://saketgaikwad-max.github.io/Mighty-Tone-Generator/
The logic (codec, engine, store, DSP, LLM) is fully built and tested (125 tests). The UI is functional but does not match the design mocks. This pass brings the app visually and functionally in line with the mocks.

**Design mocks:** `/Users/saket.gaikwad/Guitar/mighty-tone/design/mockups/png/all-screens.png` — READ THIS IMAGE before starting any screen.
**Design system:** `/Users/saket.gaikwad/Guitar/mighty-tone/design/DESIGN_SYSTEM.md` — "Midnight Studio" dark theme, Konsta UI v5, Tailwind v4, glass cards, violet→blue accent glow.

**Git:** repo root `/Users/saket.gaikwad/Guitar`, remote `origin` = https://github.com/saketgaikwad-max/Mighty-Tone-Generator. Push creds in macOS Keychain (run git push with `required_permissions: all`). Commit identity: `-c user.name="Saket Gaikwad" -c user.email="saketgaikwad-max@users.noreply.github.com"`.

**Tests:** `npm run verify` must stay green (125 tests) after every change. `npm run build` must pass before every push.

### What exists in src/screens/ and src/ui/components/
- `SessionChat.tsx` — works but bare: plain chips + text input, QR card with no rich detail, variants not styled
- `Library.tsx` — basic list, no Saved Tones grid, no tone artwork
- `Profile.tsx` — has Gemini key + backup buttons but plain, no instruments list
- `IRInventory.tsx` + `IRPrep.tsx` — functional stubs, close to mock but needs polish
- `QrView.tsx`, `VersionTimeline.tsx`, `LockControls.tsx`, `DelayHelper.tsx`, `VariantCarousel.tsx` — all exist

### Work to do — launch these 3 agents IN PARALLEL (Sonnet for all):

**Agent A — Sessions + Chat response card:**
- Sessions list screen: search bar, list of past sessions (name, tone count, date), "New session +" button. Tap → opens chat.
- Chat response card: amp name large, archetype badge, confidence score, 3-line patch summary (describePatch), QR large and tappable (fullscreen on tap), variant swipe cards (3) below, feedback text input, "Signal chain" expand button.
- Use glass card style from design system (dark bg, blur, violet accent on active state).

**Agent B — Library (Saved Tones) + Profile:**
- Saved Tones: grid of tone cards (2-col), each with a generated colour gradient "artwork" based on archetype (clean=blue, crunch=orange, lead=red, acoustic=green), tone name, instrument badge, archetype chip. Filter chips at top (All / archetype / instrument).
- Profile: grouped list sections — Instruments (list of user's instruments with add/remove), Mighty Space section (firmware info), Gemini key field, Backup section (export/import buttons), Clear data. Match the mock's grouped iOS list style.

**Agent C — Signal chain view + Delay helper modal + general polish:**
- Signal chain: a horizontal scrollable block chain (Gate → Comp → EFX → Amp → EQ → Mod → Dly → Rvb → Cab). Each block: icon, name, on/off toggle. Tap → expand params as sliders. Read-only in v1 (no param editing, just display).
- Delay helper: full bottom sheet modal (not a widget). BPM number input, note division segmented control (1/4, 1/8, dotted 1/8, triplet), model picker dropdown, large ms readout, "Apply" button.
- General: ensure all screens use the Midnight Studio token colours (near-black #0a0a0f bg, glass cards, violet #7c3aed accent), system font, 44pt touch targets, safe area insets.

### Per-agent commit pattern:
Each agent: small commits per screen/component + `npm run build` + `git push origin main`.

### After all 3 finish:
Run `npm run verify` + `npm run build` locally, then do one final push. The GitHub Actions workflow deploys automatically on push to main.

### Token usage strategy for the new chat
- **Do NOT read** PLAN.md, ARCHITECTURE.md, SOURCES.md, ESTIMATES.md, TRACEABILITY.md — they are not needed for UI work.
- **Read only:** this HANDOFF.md + the mocks image + DESIGN_SYSTEM.md (first 60 lines only). That's it.
- **Each agent gets a tight brief** (file paths + what to build + stop rule). No agent reads docs beyond what's listed in its brief.
- **Models:** Sonnet for all 3 UI agents (no Opus needed — this is layout/styling work, not DSP math or engine logic).
- **One attempt per problem** — if a component doesn't render correctly, fix it once and move on. No loops.
- **Stop rules are hard** — each agent stops the moment its commits are pushed. It does not review other agents' work.
- **No agent installs new npm packages** unless strictly necessary. All needed packages (Konsta, Tailwind, Lucide, Radix) are already installed.
