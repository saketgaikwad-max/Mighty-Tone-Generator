# Real device fixtures

Exported by the user from MightyAmp iOS 3.6.6 (NUX Mighty Space, firmware 20230331) on 2026-10-20.

| Fixture | Preset | What it covers | App screenshot |
| --- | --- | --- | --- |
| `qr/gain-responsive-distortion` | 1 | Amp 1987 X 50, drive, default-ish chain | `screens/preset1-amp-1987x50.png` |
| `qr/clean-tone` | 3 | Amp MLD (has Mid Freq), EQ before EFX | `screens/preset3-amp-MLD.png` |
| `qr/acoustic-ir-tone` | 4 | User IR slot 3 ("Dread-35 SR25 Pz1" in the app), amp off, IR early in chain | `screens/preset4-ir-Dread-35-SR25-Pz1.png` |

Per fixture:

- `<name>.png`: the share screenshot as exported (QR edge-to-edge, no quiet zone).
- `<name>.txt`: decoded QR text (`npm run decode-fixtures` regenerates it from the PNG).
- `<name>.expected.json`: `confirmed` holds what the app screenshot shows (used as test expectations);
  `decoded` pins the full decode as a regression snapshot. Values outside `confirmed` are not independently verified.

The QR-to-preset mapping was settled by decoding: each QR's amp/IR knob values and chain order match exactly one
screenshot. Observations from these exports: the name bytes (100-112) are empty and the master byte (84) is 0 in
all three; the caption under each QR is not part of the payload.

To add a fixture: drop `<name>.png` here, run `npm run decode-fixtures`, write `<name>.expected.json` from the app's
screens, and the golden tests pick it up (update the fixture count in `tests/golden/fixtures.test.ts`).
