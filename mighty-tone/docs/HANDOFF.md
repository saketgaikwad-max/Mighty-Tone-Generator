# Mighty Tone Generator — Handoff (read this first in any new chat)

Full plan: `PLAN.md`, `ARCHITECTURE.md`, `AGENTS.md`, `ESTIMATES.md`, `TRACEABILITY.md`, `SOURCES.md` (this folder). Design: `../design/DESIGN_SYSTEM.md`, `../design/mockups/index.html`.

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
1. S1 Data + codec: extract amp model/param JSON; QR/.mspatch encode/decode; round-trip tests on user fixture QRs. (needs user QR exports in `/Users/saket.gaikwad/Guitar`)
2. S2 Minimal app: instrument pick, prompt, engine v1 (vocabulary + instrument rules for clean/crunch/lead/high-gain/acoustic/mandolin), QR output, feedback chips, QR import, local save. Deploy to Pages.
3. S3 Versions timeline, saved-tones filters, profile, backup.
4. S4 Delay helper, variants, lock-block, references library + Gemini/handoff.
5. S5 IR Lab (prep tool + guided flow + slot inventory).

## Fixtures (in `/Users/saket.gaikwad/Guitar/fixtures/`, confirmed by user)
- `gain-responsive-distortion-qr.png` = preset 1, amp 1987 X 50 (Gain 75, Master 60, Bass 50, Middle 67, Treble 64, Presence 61) — `preset1-amp-1987x50.png`.
- `clean-tone-qr.png` = preset 3, amp MLD (Gain 30, Master 80, Bass 86, Mid Freq 8, Middle 17, Treble 35) — `preset3-amp-MLD.png`.
- `acoustic-ir-tone-qr.png` = preset 4, user IR "Dread-35 SR25 Pz1" (Level 6 dB, Low Cut 31 Hz, High Cut 14142 Hz) — `preset4-ir-Dread-35-SR25-Pz1.png`.
- Chain order differs per preset (visible in screenshots). No delay-ms fixture yet; calibrate in S4.

## Open items
- Delay-time calibration fixture (later).
- Rotate GitHub token at end.
