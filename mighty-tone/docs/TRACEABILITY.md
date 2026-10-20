# Requirements Traceability Matrix

Owner: QA agent. Every requirement from the agreed product summary maps to phase/task (PLAN.md §5), module
(ARCHITECTURE.md §1) and an acceptance test. Test ID prefixes: `UNIT-` (Vitest), `PROP-` (fast-check), `GOLD-`
(real-fixture golden), `EVAL-` (engine evaluation suite), `E2E-` (Playwright WebKit/Chromium), `DSP-`, `LLM-`,
`MAN-` (manual/user checkpoint), `DOC-` (doc review). Status column is filled by QA at each gate
(`todo` / `pass` / `waived:<ADR>`).

## Platform, hosting, maintainability

| ID | Requirement | Phase / task | Module | Acceptance test | Status |
| --- | --- | --- | --- | --- | --- |
| R01 | Working title "Mighty Tone Generator" in manifest, title, About | P0.2 | ui, public | E2E-001 manifest name + `<title>` | todo |
| R02 | Public repo `saketgaikwad-max/Mighty-Tone-Generator`; nothing pushed until approved | P0 S2 | ops | MAN-001 ORCH confirms first push after user approval | todo |
| R03 | Hosted free on GitHub Pages | P0.2 | CI | E2E-002 smoke test against deployed URL in `pages.yml` | todo |
| R04 | Installable PWA via Safari "Add to Home Screen" (iPhone) | P0.2, P2 | PWA | E2E-003 manifest/SW checks (WebKit); MAN-U5 iPhone install + offline launch | todo |
| R05 | Installable on personal Mac | P2 | PWA | MAN-U5 Mac Safari "Add to Dock" + offline launch | todo |
| R06 | No backend, no paid services, no accounts | all | architecture | UNIT-ARCH-01 no network calls except opt-in Gemini/handoff links (fetch spy across e2e); DOC-001 | todo |
| R07 | No runtime dependency on enterprise Cursor/Opus account | all | architecture | E2E-004 full loop with network disabled; DOC-002 dependency audit | todo |
| R08 | Maintainable with free tools: data-driven knowledge files, docs, tests | P0 S10, P6.3 | knowledge, docs | UNIT-KN-01 all `knowledge/**/*.json` schema-valid; DOC-003 CONTRIBUTING-KNOWLEDGE walkthrough adds an instrument without code | todo |
| R09 | Design system from parallel track via integration point | P1.6, P2+ | ui/kit | UNIT-ARCH-02 screens import only `ui/kit`; E2E-UX screenshots vs mocks | todo |

## Hardware and instruments

| ID | Requirement | Phase / task | Module | Acceptance test | Status |
| --- | --- | --- | --- | --- | --- |
| R10 | Target NUX Mighty Space, firmware 20230331 (Plug Pro protocol) | P0.4, P1.2 | knowledge/device, codec | GOLD-001 all user fixtures decode; profile default firmware `20230331` UNIT-PROF-01 | todo |
| R11 | Generated QR loads in MightyAmp iOS 3.6.6 | P1 G1 | codec, qr | MAN-U3 scan re-encoded fixtures; MAN-U4 scan engine patches | todo |
| R12 | Mighty Editor (Mac) is the user-IR loading path | P5.4 | ui/IR | DOC-004 in-app instructions; MAN-U7 | todo |
| R13 | Avion AV-6 profile: LP-style, HB101N neck/HB102B bridge, 3-way, 2 vol/2 tone | P2.2 | knowledge/instruments | UNIT-INST-01 profile fields; EVAL-INST-AV (neck vs bridge produce different shaping) | todo |
| R14 | Jumbo King with Fishman Isys (active; bass, treble, phase, volume) | P2.2 | knowledge/instruments | UNIT-INST-02; EVAL-INST-JK (acoustic prompt → Optima Air/Stageman family, phase advice on boom/feedback) | todo |
| R15 | EJ-200CE passive under-saddle piezo, no knobs; 1 MΩ input → thin/quacky compensation | P2.2, P2.3 | knowledge/instruments, engine/shape | EVAL-INST-EJ (quack-zone cut, low-mid support, high cut, comp on) | todo |
| R16 | HB F-style mandolin, single-coil-sized stacked humbucker (quiet), volume+tone | P2.2 | knowledge/instruments | UNIT-INST-03; EVAL-INST-MD (gate light, low cut ≥ ~100 Hz) | todo |
| R17 | Users can add any other instrument/pickup manually | P3.7 | store, ui/Profile | E2E-010 add instrument with custom pickup → selectable in session → engine uses generic pickup type | todo |

## Sessions and core loop

| ID | Requirement | Phase / task | Module | Acceptance test | Status |
| --- | --- | --- | --- | --- | --- |
| R18 | Chat-style sessions: create, name/rename, full history stored | P1.5, P2.8 | store, ui | E2E-011 create/rename/reload keeps all messages; UNIT-STORE-01 | todo |
| R19 | Per-session instrument + pickup, smart defaults from profile or manual | P2.8 | services, ui | E2E-012 default = last used/profile default; override persists | todo |
| R20 | Tuning: standard or custom text | P2.8 | engine/shape, ui | EVAL-TUNE-01 drop/low tunings tighten low end; custom text stored | todo |
| R21 | Capo fret | P2.8 | engine/shape, ui | EVAL-CAPO-01 capo ≥5 slightly reduces treble; stored per session | todo |
| R22 | Type or dictate prompt (iOS keyboard dictation) | P2.8 | ui | E2E-013 plain textarea, no input blocking; MAN-U5 dictation works | todo |
| R23 | Deterministic, data-driven engine produces exact chain + parameters | P2.1–P2.6 | engine | PROP-ENG-01 same input+seed → byte-identical; UNIT-ENG-* | todo |
| R24 | Engine names the tone; user can rename | P2.6, P3.3 | engine/explain, store | UNIT-NAME-01 name ≤13 chars for QR + longer display name; E2E-014 rename | todo |
| R25 | Explains choices | P2.6 | engine/explain | EVAL-EXPL-01 every changed param has a rule trace entry | todo |
| R26 | Explainable confidence rating | P2.6 | engine/confidence | UNIT-CONF-01 factors sum to score; EVAL-CONF-01 piezo + metal → low band with reason | todo |
| R27 | Renders NUX QR code | P1.3, P2.8 | qr, ui | GOLD-002 rendered QR decodes back to identical payload; MAN-U4 | todo |
| R28 | Feedback chips (muddy/harsh/thin/boomy/too much gain/too wet) + free text | P3.1 | engine, ui | EVAL-FB-* per chip × instrument; E2E-020 | todo |
| R29 | Attach QR image exported from amp → decoded exact current state | P3.2 | qr, codec, services | GOLD-003 fixture screenshots decode; E2E-021 attach → "amp-state" version + diff | todo |
| R30 | Iterate (repeat generate/feedback) | P3 | services | E2E-022 5-iteration loop keeps history and lineage | todo |
| R31 | Version timeline + version selector | P3.3 | store, ui | E2E-023 select any version → QR/params shown | todo |
| R32 | "What changed" diffs | P3.3 | engine/diff, ui | UNIT-DIFF-01 human-unit diff ("Gain 45% → 38%", "Delay 448 → 482 ms") | todo |
| R33 | Branch from any version | P3.3 | store, ui | UNIT-STORE-02 DAG ancestry; E2E-024 branch from v2 after v5 | todo |
| R34 | Lock-a-block | P3.4 | engine, ui | PROP-ENG-02 locked blocks byte-identical across generate/feedback | todo |
| R35 | Variants: app asks; user picks 1–5; otherwise one per iteration | P3.5 | engine/variants, ui | EVAL-VAR-01 N distinct (min pairwise distance > threshold); E2E-025 | todo |
| R36 | Saved Tones library | P3.6 | store, ui | E2E-026 save from any version; survives reload | todo |
| R37 | Library search + filters: instrument, tone type, genre, artist/song, confidence, uses user IR, date | P3.6 | store (MiniSearch, Dexie indexes) | UNIT-LIB-01 each filter; E2E-027 combined filters | todo |

## Profile, storage, backup

| ID | Requirement | Phase / task | Module | Acceptance test | Status |
| --- | --- | --- | --- | --- | --- |
| R38 | Profile: instruments | P3.7 | store, ui | E2E-010 | todo |
| R39 | Profile: amp firmware | P3.7 | store | UNIT-PROF-01; firmware ≠ 20230331 shows warning | todo |
| R40 | IR slot inventory: 20 user slots = nuxIndex 35–54 | P3.7, P5.4 | store, knowledge | UNIT-IR-01 slot n ↔ index n+34; GOLD-004 user-IR fixture decodes to correct slot | todo |
| R41 | Playing context | P3.7 | store, engine | EVAL-CTX-01 home vs band produce documented differences | todo |
| R42 | Learned preferences | P3.8 | store, engine | EVAL-LRN-01 repeated "harsh" on Avion bridge → bounded bias applied + explained | todo |
| R43 | Gemini key stored on device | P3.7, P4.2 | store, llm | UNIT-LLM-01 key only in IndexedDB; excluded from backup by default; never logged | todo |
| R44 | Data stays on device (IndexedDB), persistence requested | P1.5, P6.1 | store | UNIT-STORE-03 `storage.persist()` called at launch; E2E-005 no remote writes | todo |
| R45 | Backup / export / import file | P1.5, P6.1 | store | UNIT-BAK-01 export→wipe→import deep-equal; MAN-U8 iPhone → Mac transfer | todo |

## Level matching and delay helper

| ID | Requirement | Phase / task | Module | Acceptance test | Status |
| --- | --- | --- | --- | --- | --- |
| R46 | Master volume level matching across patches | P2.4 | engine/level | EVAL-LVL-01 estimated loudness spread ≤ target band across 20 diverse patches; "louder/quieter" chip adjusts offset | todo |
| R47 | Delay helper: type + BPM + division → ms → nearest device value | P2.5 | engine/delay | UNIT-DLY-01 (100 BPM dotted 1/8 = 450 ms → Digital raw 46 ≈ 448 ms); UNIT-DLY-02 all models' ranges | todo |
| R48 | Changing only BPM on existing patch works | P2.5 | engine/delay | UNIT-DLY-03 only the time byte changes | todo |
| R49 | Out-of-range handling (e.g., Analog max ~401 ms) | P2.5 | engine/delay | UNIT-DLY-04 suggests division change or model switch | todo |
| R50 | Tap tempo in NUX app as alternative | P2.5 | ui | DOC-005 helper text shown | todo |
| R51 | Delay time mapping matches device (firmware) | P1.1, G1 | knowledge/device | GOLD-005 fixture with known ms decodes within one step | todo |

## Mandolin base tones

| ID | Requirement | Phase / task | Module | Acceptance test | Status |
| --- | --- | --- | --- | --- | --- |
| R52 | Base tone: magnetic-electric mandolin | P2.7 | knowledge/base-tones | EVAL-MD-01 mandolin prompt w/o acoustic intent → this base | todo |
| R53 | Base tone: acoustic-sim via Optima Air/Stageman + Acoustic IR G-HBIRD/G-J15/M-D45 | P2.7 | knowledge/base-tones | EVAL-MD-02 "acoustic" mandolin prompt → amp ∈ {28,29}, cab ∈ {32,33,34} | todo |
| R54 | Other mandolin requests build on the bases | P2.7 | engine/plan | EVAL-MD-03 "bluegrass chop with slapback" keeps base amp/cab, adds delay | todo |

## External IR flow and IR prep tool

| ID | Requirement | Phase / task | Module | Acceptance test | Status |
| --- | --- | --- | --- | --- | --- |
| R55 | External IR flow only when user explicitly asks | P5.5 | services, ui | E2E-030 engine never proposes downloads unprompted | todo |
| R56 | Gemini (search grounding, free tier, user key) recommends best few free trusted IRs with links + truncation notes | P5.5 | llm | LLM-010 mocked response validates `ir-recommendation`; MAN-U6 live | todo |
| R57 | IR prep: decode WAV | P1.7 | dsp | DSP-001 PCM16/24/32/float, mono/stereo | todo |
| R58 | Resample to 48 kHz | P1.7 | dsp | DSP-002 ripple/stopband specs; 44.1/96 kHz inputs | todo |
| R59 | Trim leading silence | P1.7 | dsp | DSP-003 synthetic pre-delay removed within 1 sample | todo |
| R60 | Minimum-phase conversion | P1.7 | dsp | DSP-004 magnitude preserved < 0.05 dB; energy front-loaded | todo |
| R61 | Log-frequency weighted LS 512-tap FIR approximating full IR magnitude | P5.1 | dsp | DSP-005 beats naive truncation on 100% of corpus; exactly 512 taps | todo |
| R62 | Optional blend of two IRs | P5.1 | dsp | DSP-006 aligned blend; 50/50 of identical IRs = original | todo |
| R63 | Level normalisation | P5.1 | dsp | DSP-007 output peak/energy at reference; level change reported | todo |
| R64 | Short fade | P5.1 | dsp | DSP-008 last N samples raised-cosine, no click (end sample = 0) | todo |
| R65 | Low-end residual → auto-suggest 10-band EQ comp (31–250 Hz) applied by engine | P5.2 | dsp, engine | DSP-009 synthetic residual recovered ±1 dB; EVAL-IR-01 patch using that slot has EQ comp + explanation | todo |
| R66 | Frequency-response chart + fidelity score | P5.3 | dsp, ui | DSP-010 score monotonic with error; E2E-031 chart renders 3 curves | todo |
| R67 | Export 48 kHz WAV | P5.4 | dsp, ui | DSP-011 header 48000 Hz, 512 frames; E2E-032 download/share | todo |
| R68 | IR prep works in-browser, offline | P5 | dsp worker | E2E-033 offline run in WebKit | todo |
| R69 | Load into slot via Mighty Editor and record in IR inventory | P5.4 | store, ui | E2E-034 record slot → selectable as cab; MAN-U7 | todo |

## References and LLM

| ID | Requirement | Phase / task | Module | Acceptance test | Status |
| --- | --- | --- | --- | --- | --- |
| R70 | Built-in reference library consulted first | P4.1 | knowledge/references, engine/parse | EVAL-REF-01 known artist resolves with `source: reference`, no network | todo |
| R71 | Gemini with search grounding for unknown references → structured intent JSON validated by engine | P4.2 | llm | LLM-001 schema-valid; LLM-002 grounding citations shown | todo |
| R72 | LLM never writes bytes | P4.2 | llm/validate | LLM-003 hostile corpus (out-of-range, extra fields, fake models) → clamped/dropped, codec untouched | todo |
| R73 | Fallback handoff: chatgpt.com/?q=, claude.ai/new?q= prefilled links + paste-back | P4.3 | llm/handoff, ui | LLM-004 URL builder length-aware; E2E-035 paste-back → intent | todo |
| R74 | Gemini quota hit → handoff; core engine never needs LLM | P4.2 | llm, services | LLM-005 mocked 429 → handoff offered; E2E-004 offline loop | todo |

## Expert tone practice

| ID | Requirement | Phase / task | Module | Acceptance test | Status |
| --- | --- | --- | --- | --- | --- |
| R75 | Gain staging | P2.2, P2.3 | knowledge/rules, engine | EVAL-GS-* total gain budget per archetype; boost-into-clean vs stacking cases | todo |
| R76 | Cut before boost | P2.3 | engine/solve | EVAL-CUT-* "less muddy" → cut/low-cut before any boost | todo |
| R77 | Context: home speaker vs band mix | P2.3 | engine | EVAL-CTX-01 | todo |
| R78 | "Less is more" with documented exceptions | P2.2 | knowledge/rules | EVAL-LIM-01 effect count/mix caps; EVAL-LIM-02 ambient/shoegaze exception applied + explained | todo |
| R79 | Instrument/pickup-aware shaping | P2.3 | engine/shape | EVAL-INST-* (all four instruments + manual) | todo |
| R80 | Feedback interpreted in context of instrument and prompt | P3.1 | engine, knowledge/feedback | EVAL-FB-CTX-01 "muddy" on EJ-200CE ≠ "muddy" on Avion neck high-gain | todo |

## Device knowledge and codec

| ID | Requirement | Phase / task | Module | Acceptance test | Status |
| --- | --- | --- | --- | --- | --- |
| R81 | Use all 29 amps incl. 8 hidden ones | P0.4, P2.3 | knowledge, engine/plan | UNIT-KN-02 counts; EVAL-HID-01 hidden amps selected when best fit; MAN-U3/U4 hidden-amp patch loads | todo |
| R82 | 34 cabs incl. Acoustic IR G-HBIRD(32)/G-J15(33)/M-D45(34), favoured for magnetic pickups | P0.4, P2.3 | knowledge, engine | UNIT-KN-03; EVAL-ACIR-01 neck single coil + acoustic intent → acoustic IR | todo |
| R83 | QR payload `nux://MightyAmp:` + base64([0x0F,0x01]+113 bytes) | P1.2 | codec | GOLD-001; PROP-CODEC-01 | todo |
| R84 | `.mspatch` 8404 bytes, preset at offset 4 | P1.2 | codec | UNIT-CODEC-02 matches converter.js | todo |
| R85 | Byte map: heads 1–9 low 6 bits + 0x40 OFF; params; MASTER 84; chain 89+; name 100+ | P1.2 | codec | GOLD-001; UNIT-CODEC-03 per field | todo |
| R86 | Unused/undocumented bytes preserved (85–87 delay flags/BPM, etc.) | P1.2 | codec | GOLD-006 decode→encode byte-identical | todo |
| R87 | Param ranges/formatters (cab level ±12 dB, low cut 20–300 Hz, high cut 5–20 kHz log, EQ ±15 dB 6/10-band) | P1.1 | codec/formatters | UNIT-FMT-* vs Dart formulas | todo |
| R88 | Delay model time ranges (Analog 40–401, Digital/Pan/Phi 80–990, Mod 18–1192, Tape 53–546 ms) | P1.1 | knowledge/device | UNIT-DLY-02 | todo |
| R89 | QR decode of user-supplied screenshots must work | P1.3, P3.2 | qr | GOLD-003 all fixture screenshots (incl. app chrome) decode; E2E-021 | todo |
| R90 | Golden fixtures: user exports 3–5 real QR codes (clean, high-gain, delay+reverb) | P0.6 | tests/fixtures | MAN-U1; GOLD-001 | todo |
| R91 | Optional extra fixtures from mightypatches.com | P1.4 | tests/fixtures | GOLD-007 (optional; license note per file) | todo |
| R92 | MIT licensing/attribution for derived data | P0.3 | docs | DOC-006 THIRD_PARTY_NOTICES + provenance fields; UNIT-KN-04 every model has `source` | todo |
| R93 | ChopTones IRs not used until verified | P0.4 | knowledge | UNIT-KN-05 unverified models excluded from engine | todo |

## Process, user checkpoints, scope

| ID | Requirement | Phase / task | Module | Acceptance test | Status |
| --- | --- | --- | --- | --- | --- |
| R94 | Orchestrator + workers + QA agent structure with sign-off per phase | all | process | DOC-007 `docs/qa/gate-N.md` exists per gate | todo |
| R95 | Rotate GitHub token at end | P6 | ops | MAN-U9 | todo |
| R96 | Parked items (setlists, explain-any-QR, BLE/USB, IR preview, Apple on-device model) stay out of v1 | all | process | DOC-008 scope review at each gate | todo |
| R97 | iOS has no Web Bluetooth/Web MIDI — v1 relies on QR only | all | architecture | DOC-009; no BLE/MIDI code paths | todo |
