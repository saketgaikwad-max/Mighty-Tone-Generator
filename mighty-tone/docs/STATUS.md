# Status

Updated: 2026-10-20 (end of slice S1).

| Slice | State | Notes |
| --- | --- | --- |
| S1 Data + codec | **done** | Device JSON extracted; codec, QR string, `.mspatch`, QR image decode; 3 real fixtures byte-exact. |
| S2 Minimal app | next | Vite/React/PWA scaffold (+ ESLint/Prettier, see ADR-001), engine v1, QR render + import, deploy. |
| S3–S5 | todo | |

## S1 delivered
- `tools/extract-plugpro.ts` → `knowledge/device/mighty-space.json` (counts: 29 amps incl. 8 hidden, 34 cabs + 20
  user IR slots 35–54, 3 comps, 14 EFX, 2 EQs, 14 mods, 6 delays, 6 reverbs, gate) with source refs + verified flags.
- `src/codec`: `decodePreset` / `encodePreset` (template overlay), formatters + delay tables, `parseQrString` /
  `buildQrString`, `toMspatch` / `fromMspatch`, `describePatch` (app-style knob texts).
- `src/qr/decode-image.ts`: jsQR decode ladder for share screenshots.
- Fixtures in `tests/fixtures/` with `expected.json`; mapping verified by decode (ADR-005).
- Tests: `npm run verify` (typecheck + Vitest: knowledge, formatters, preset fields, QR/.mspatch, 10k-run property
  test, golden fixtures).

## User checkpoints
- U1 fixtures: done (3 QR exports + 3 screenshots).
- U3 (gate G1): scan re-encoded QRs in MightyAmp. Needs QR rendering (S2). Also answers the master-byte and
  name-byte questions in DECISIONS.md.
- Optional quick check: in MightyAmp, preset 3 → DLY page; does Time read ≈692 ms? (verifies delay table, R51)

## Risks changed
- R1 (byte map): reduced. Three real exports decode with zero warnings and re-encode byte-identically.
- New: master byte is 0 in official exports (see DECISIONS.md open questions); affects R46 level matching.
