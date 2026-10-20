# Mighty Tone Generator — Agent Structure

Companion to [PLAN.md](./PLAN.md). A copy of the "maintainer" parts of this file goes to the repo root as
`AGENTS.md` in Phase 0 so future free-tool agents (or humans) can follow the same conventions.

## 1. Operating model

- **One integration branch per phase** (`phase/N`), worker branches `wN/<task-id>-<slug>` off it. Only ORCH merges
  into `phase/N` and from `phase/N` into `main`. `main` auto-deploys to Pages.
- **Contracts first.** At the start of each phase ORCH freezes the relevant `src/contracts/*.ts` (Zod + types).
  Workers may propose changes via a short ADR in `docs/DECISIONS.md`; ORCH approves and announces.
- **Definition of done (every task):** code + unit tests + updated docs/knowledge rationale + TRACEABILITY row(s)
  referenced in the PR/commit message + `npm run verify` (lint, typecheck, unit, eval, build) green.
- **No secrets in logs.** No agent prints tokens or keys; no agent runs login flows.
- **Status reporting.** ORCH updates `docs/STATUS.md` after every merge and posts a short status to the user at
  each gate: done / in progress / blocked / user checkpoint needed / risks changed.

## 2. Roster

### ORCH — Orchestrator (effort: high)
- **Scope:** owns PLAN.md, STATUS.md, DECISIONS.md, contracts, task assignment, sequencing per DAG, integration,
  conflict resolution, merges, phase gates (with QA), user communication and checkpoint requests.
- **Inputs:** this plan, worker outputs, QA reports, user feedback.
- **Outputs:** frozen contracts per phase, merged phase branches, release tags, status reports.
- **Acceptance:** every gate has a QA sign-off record; DAG respected; no merge with red CI; user checkpoints
  requested with exact instructions and file locations.

### W1 — Platform & PWA (effort: medium)
- **Scope:** Vite/React/TS scaffold, ESLint/Prettier, Vitest/Playwright config (WebKit + iPhone emulation),
  GitHub Actions CI and Pages deploy, vite-plugin-pwa, iOS meta/icons, `storage.persist()`, update prompt, perf budget,
  spikes S8(a)(c).
- **Inputs:** PLAN §1/§3, ARCHITECTURE §1.
- **Outputs:** green CI, live Pages URL, installable PWA shell, spike notes.
- **Acceptance:** `npm run verify` < 3 min locally; Pages serves under `/Mighty-Tone-Generator/`; offline reload
  works in Playwright WebKit; Lighthouse PWA installable; bundle < 250 KB gzip initial.

### W2 — Device Knowledge & Patch Codec (effort: high)
- **Scope:** `tools/extract-plugpro.ts`, `knowledge/device/mighty-space.json`, formatters, delay tables, codec
  (decode/encode/template overlay/LINK tolerance/name), `.mspatch`, QR string, QR encode/decode ladder, Patch
  Inspector logic; spike S8(d).
- **Inputs:** mightier_amp `NuxConstants.dart` (PresetDataIndexPlugPro), `plug_pro/*.dart`, `PlugProPreset.dart`,
  `value_formatters/*.dart`, `plugProCommunication.dart`; mighty-patch-convert `converter.js`; real fixtures.
- **Outputs:** typed device knowledge with provenance + `verified` flags, codec module, QR module, fixture tests.
- **Acceptance:** model counts 29 amps / 34 cabs (+20 user IR slots 35–54) / 6 delays / 6 reverbs / 14 mods /
  3 comps / 14 EFX / 2 EQs / gate; every real fixture decodes to its `expected.json`; decode→encode is byte-identical
  for every fixture; property test: encode→decode identity on 10k random valid patches; `.mspatch` round-trip
  matches converter.js behaviour; QR images decodable by the decode ladder in WebKit.

### W3 — Tone Engine Core (effort: high)
- **Scope:** parser, intent builder, planner, solver, instrument/tuning/capo shaping, gain-staging checks, level
  matching, delay helper, variants, locks, feedback interpretation engine, learned-preference application, diff,
  explanation, confidence, naming.
- **Inputs:** Intent/Patch contracts, device knowledge, W4 content files.
- **Outputs:** `src/engine/**` pure functions; `generate(context, prompt, seed) → Version draft`;
  `applyFeedback(version, feedback) → Version draft`.
- **Acceptance:** deterministic (same input → byte-identical output); all eval suite invariants hold; DLY-01
  (100 BPM dotted 1/8 → Digital raw 46 ≈ 448 ms); locks never modified; every parameter change carries a rule trace.

### W4 — Tone Knowledge Content (effort: high)
- **Scope:** vocabulary, archetypes, expert rules with rationale + exceptions, instrument profiles (4 builtin +
  generic pickup types), feedback rules, mandolin base tones, loudness table, built-in reference library (≈60–100
  entries), gear→model similarity map, model character tags; `CONTRIBUTING-KNOWLEDGE.md`.
- **Inputs:** device knowledge, contracts, public gear knowledge (cite sources in entries), user's instrument facts.
- **Outputs:** `knowledge/engine/*.json` (schema-valid), rationale notes.
- **Acceptance:** schema validation in CI; every rule has rationale + at least one eval case; every reference entry
  has a source note; instrument profiles reflect the stated hardware (HB101N/HB102B 3-way; Fishman Isys active
  bass/treble/phase/volume; EJ-200CE passive piezo + 1 MΩ compensation; mandolin stacked HB vol/tone).

### W5 — Store & Sessions (effort: medium)
- **Scope:** Dexie schema + migrations, repositories, sessions/messages, version DAG (branch, head, rename),
  saved tones with MiniSearch index + facet filters, profile + IR inventory, learned-preference storage, backup
  export/import (Zod), persistence requests.
- **Outputs:** `src/store/**`, `src/services/*` persistence parts.
- **Acceptance:** migrations tested from v1 forward; backup→wipe→import yields deep-equal data; 1 000 versions /
  200 saved tones queries < 50 ms in fake-indexeddb; branching from any version keeps ancestry intact.

### W6 — UI/UX (effort: medium; high for chat + timeline)
- **Scope:** kit adapter (temporary), all screens and components, chat flow (prompt, response card, variant
  question, feedback chips, QR attach), timeline + diff + branch, library, profile, IR inventory, IR prep UI + chart,
  reference/LLM flows, error/offline states, accessibility. Integrates the design track's kit and tokens.
- **Outputs:** `src/ui/**`, Playwright e2e specs per flow, screenshot baselines.
- **Acceptance:** all flows usable at 390×844 and 1280×800; WebKit e2e green; dictation-friendly textarea; QR shown
  large with save/share; no direct imports of codec/engine (services only).

### W7 — IR Prep DSP (effort: high)
- **Scope:** WAV I/O, resampler, FFT, trim, blend, min-phase, WLS FIR, normalization, fade, residual → EQ
  suggestion, fidelity score, worker wrapper; DSP test corpus.
- **Outputs:** `src/dsp/**`, `tests/fixtures/ir/**`.
- **Acceptance:** resampler passband ripple < 0.1 dB to 20 kHz, stopband > 80 dB; min-phase magnitude error < 0.05 dB;
  WLS FIR beats naive truncation on weighted error for 100% of the corpus; known-answer tests (delta, synthetic
  resonant cab) pass; EQ suggestion within ±1 dB of analytic residual on synthetic cases; < 3 s for two IRs on
  iPhone-class CPU (measured in WebKit with CPU throttling as a proxy, confirmed at U7).

### W8 — LLM Adapters (effort: medium)
- **Scope:** Gemini client (grounding, citations, quota detection, model setting), prompts, handoff link builder +
  paste-back, intent/IR-recommendation validation glue, privacy notice copy; spike S8(b).
- **Outputs:** `src/llm/**` with mocked tests and recorded fixture responses.
- **Acceptance:** malformed/hostile JSON corpus never throws past the adapter and never yields out-of-range values;
  429 path falls back to handoff; works with network off (adapter disabled, engine unaffected); no key ever logged.

### QA — Quality (effort: high; independent of workers, reports to ORCH and user)
- **Scope:**
  1. Code review of every merge into `phase/N` (correctness, contracts, tests, comments policy, security).
  2. **Byte-exact codec tests** against real QR fixtures (decode→expected, decode→encode identity, unknown-byte warnings).
  3. **Tone-engine evaluation suite** `tests/eval/*.yaml`: prompt + context → expected chain/model families/param
     bands/invariants; instrument awareness cases for all 4 instruments + a manual instrument; tuning/capo; delay math;
     mandolin bases; feedback interpretation; variants diversity; lock respect; level matching spread
     (master variance across a session's versions within target band).
  4. **Requirements traceability matrix** (TRACEABILITY.md) kept current; every row has a test ID and status.
  5. **UX check** vs design mocks (Playwright screenshots at iPhone/Mac sizes) + heuristic checklist.
  6. **Phase sign-off** record in `docs/qa/gate-N.md` (pass/waivers/risks).
- **Acceptance:** no gate passes with a failing TRACEABILITY row for that phase unless waived by ORCH in DECISIONS.md.

### External: Design track (parallel, not managed by ORCH)
Delivers tokens, OSS kit choice (dark, Apple-like), mocks for: Sessions list, Session chat, Response card, Timeline,
Diff, Library, Profile, IR inventory, IR prep. Integration point: `src/ui/kit/` + `tokens.css` (ARCHITECTURE §9).
ORCH schedules the drop-in after P1.6; W6 swaps the temporary kit.

## 3. Handoffs

| From → To | Artifact | When |
| --- | --- | --- |
| ORCH → all | Frozen contracts `src/contracts/*` | Start of each phase |
| User → W2 | Real QR fixtures + app screenshots (U1) | Phase 0 |
| W2 → W3/W4/W6/QA | `mighty-space.json`, codec API, Patch Inspector | P0.4 draft; P1.2 final |
| W4 → W3 | Content files (vocab, archetypes, rules, instruments, feedback, loudness, references) | Rolling from P1; v1 by mid-P2 |
| W3 → W6 | `services/generateTone`, `applyFeedback`, delay helper API | P2 |
| W5 → W6 | Repositories + hooks; backup API | P1.5, P3 |
| W7 → W6/W3 | Worker API `prepareIR(files, options) → result`; EQ comp on IRSlot | P5 |
| W8 → W6/W3 | `resolveReference(prompt, ctx) → Intent | Handoff`; `recommendIRs(ctx)` | P4/P5 |
| QA → ORCH/user | Gate reports, failing cases, traceability status | Every gate + every merge review |

## 4. Parallelism map

| Phase | Parallel workers | Serial dependencies |
| --- | --- | --- |
| P0 | W1 (scaffold/CI) ∥ W2 (extraction) ∥ W8 (Gemini spike) | Fixtures need U1 |
| P1 | W2 (codec) ∥ W5 (store) ∥ W6 (shell) ∥ W7 (DSP core) ∥ W4 (early vocab/instruments) | Codec gate needs U3 |
| P2 | W3 (engine) ∥ W4 (content) ∥ W6 (session UI) ∥ QA (eval suite) | Engine needs codec + content v1 |
| P3 | W3+W4 (feedback) ∥ W5+W6 (timeline/library/profile) | Needs G2 |
| P4 | W8 ∥ W4 (references) ∥ W6 (LLM UI) — overlaps P3 | Needs frozen Intent schema |
| P5 | W7 ∥ W6 (IR UI) ∥ W8 (IR recommend) — overlaps P3/P4 | EQ-comp in engine needs P2.3 |
| P6 | W1 ∥ W6 ∥ ORCH docs ∥ QA audit | Needs G3–G5 |

Max concurrent workers recommended: 4 (overhead grows beyond that; see ESTIMATES.md).

## 5. Integration checkpoints

| Gate | Checks | User checkpoint |
| --- | --- | --- |
| G0 | CI green, Pages live, extraction counts, fixtures decoded plausibly, spikes recorded | U1 (+U2) |
| G1 | Byte-exact codec on all fixtures; backup round-trip; shell routes | **U3** re-encoded QR scan |
| G2 | Eval ≥90% + 0 invariant violations; generate flow e2e; QR renders | **U4** amp test, **U5** PWA install |
| G3 | Full loop e2e incl. attach QR, branch, lock, variants, library filters | — |
| G4 | Offline engine OK; Gemini (mocked) + handoff valid intents | **U6** Gemini key test |
| G5 | DSP test suite; IR inventory + EQ comp applied in patches | **U7** Mighty Editor IR load |
| G6 | All TRACEABILITY rows pass; docs complete; release tagged | **U8** acceptance, **U9** token rotation |

## 6. Prompt skeleton for spawning a worker

```
Role: <Wn name>. Repo: /Users/saket.gaikwad/Guitar/mighty-tone (branch wN/<task>).
Read: docs/PLAN.md §<x>, docs/ARCHITECTURE.md §<y>, src/contracts/<files>, docs/TRACEABILITY.md rows <ids>.
Do: <task list with IDs>. Do not change contracts; propose ADRs instead. Do not push; ORCH merges.
Tests: <required tests>. Done when: <acceptance criteria>. Report: summary, files changed, tests, open risks.
```
