# Decisions (ADR log)

Short records of choices made during the build. Newest last.

## ADR-001 (S1): Node 24 native TypeScript for tools; ESLint deferred to S2
Tools (`tools/*.ts`) run with `node` directly (type stripping), so `tsx` is not needed; code uses only erasable
TS syntax (`erasableSyntaxOnly`) and explicit `.ts` import extensions. ESLint/Prettier are set up with the S2 Vite app
scaffold; until then `npm run verify` = typecheck + unit/golden tests. Reason: very slow registry access during S1.

## ADR-002 (S1): Device knowledge is generated, with overrides as data
`knowledge/device/mighty-space.json` is written by `tools/extract-plugpro.ts` from the local mightier_amp clone and
is not hand-edited. Facts the Dart code cannot provide (hidden amps, fixture-verified models) live in
`tools/plugpro-overrides.json`. A model is `verified: true` only when a real fixture **and** an app screenshot confirm
its name and knob values (currently `amp.1987x50`, `amp.mld`, `cab.user-ir-3`). Models that merely appear in a fixture
decode stay unverified.

## ADR-003 (S1): Codec decodes tolerantly, encodes strictly
`decodePreset` never throws on content: unknown model indexes, odd chain bytes and non-ASCII names become
`warnings` (unknown models are shown as the first model, like the reference app, while the original byte is kept for
re-encoding). `encodePreset` overlays only modelled fields onto the template and throws `PatchEncodeError` on any
out-of-range value, unknown model/param, non-permutation chain or name longer than 13 printable ASCII characters.
High bits of head bytes and all unmodelled bytes are preserved.

## ADR-004 (S1): Fixture expected.json has `confirmed` and `decoded`
`confirmed` holds only what the user's app screenshots show (model, knob texts, chain order); these are the real
acceptance expectations. `decoded` pins the full decode as a regression snapshot; values in it beyond `confirmed`
(e.g. effect model names) are not independently verified.

## ADR-005 (S1): Fixture-to-preset mapping settled by decode
Decoding the three QR payloads gave exact matches: gain QR = preset 1 (1987 X 50), clean QR = preset 3 (MLD),
acoustic QR = preset 4 (user IR slot 3). Each match covers the model, every visible knob value and the chain order,
so the mapping is recorded as `verified-by-decode` in each `expected.json`.

## ADR-006 (S1): Runtime code does not import Zod
`src/contracts/blocks.ts` holds `BLOCK_KINDS` so the codec and knowledge accessors stay Zod-free; the Zod schema in
`src/contracts/device.ts` validates the knowledge JSON in tests (UNIT-KN-01). Keeps the initial bundle small.

## ADR-007 (S1): Dev dependency versions follow the committed lockfile
`package-lock.json` comes from the first `npm install` that completed: vitest 3.2.7, typescript 5.9.3, zod 4.6.7,
fast-check 4.10.2, jsqr 1.4.0, pngjs 7.0.0, @types/node 24.19.2. `npm run verify` passes on it. The suite also
passed on vitest 5.0.5 / typescript 6.0.3 from a partial install, so upgrading later is low risk. `tsconfig.json`
uses `paths` without `baseUrl` (deprecated in TypeScript 6). Use `npm ci` for reproducible installs.

## Open questions (need a user check or later fixture)
- **Master byte 84 is 0 in all three official-app exports** (= −12 dB by the Plug Pro formatter). Unknown whether
  the amp applies it as patch level when a QR is loaded or ignores it. Until U3 settles it, generated patches should
  keep the template's master byte; level matching (R46) may need to use amp Master instead.
- **Name bytes 100–112 are empty** in official exports; the caption under the QR is app-side only. Whether MightyAmp
  shows a name written into these bytes is unknown (check during U3).
- Delay time calibration (R51): the clean fixture's Digital Delay decodes to ≈692 ms (raw 70). If the app's DLY page
  for preset 3 shows ≈692 ms (or the equivalent BPM), that verifies the `pro` tempo table without a new fixture.
