# Sources and verified facts

Local reference code lives outside the repo at `/Users/saket.gaikwad/Guitar/.research/` (not committed).
Paths below are relative to that folder.

| ID | Fact | Source |
| --- | --- | --- |
| S1 | Plug Pro preset byte map: head bytes `Head_iWAH`=0, `Head_iCMP`=1 … `Head_iCAB`=9, `Head_iSR`=10; params CMP 15–18, EFX 20–25, AMP 27–34, EQ 36–47, NG 49–52, MOD 54–59, DLY 61–68, RVB 70–73, CAB 75–80, SR 82–83; `MASTER`=84; `delay_time_flag`=85, `bpmH`=86, `bpmL`=87, `BITCTRL`=88; `LINK1..LINK11`=89–99; `UserName1..16`=100–115 | `mightier_amp/lib/bluetooth/devices/NuxConstants.dart` lines ~201–343 (`PresetDataIndexPlugPro`) |
| S2 | QR payload = `[deviceQRId, deviceQRVersion]` + 113-byte preset; Plug Pro `deviceQRId`=15, `deviceQRVersion`=1; 9-slot chain (`effectsChainLength`=9); Mighty Space subclasses Plug Pro without overriding these | `presets/PlugProPreset.dart` (`qrDataLength`=113, `createNuxDataFromPreset`), `NuxMightyPlugPro.dart` lines ~100, 132–134, `NuxMightySpace.dart` |
| S3 | Head byte: model index = `byte & 0x3f`; ON when `(byte & 0x40) == 0` | `PlugProPreset.dart` `setupPresetFromNuxDataArray` (~line 486–489) |
| S4 | Decoder tolerance: if the byte at `LINK1` is not a valid head index, start index advances (up to 3 times) — "fix for QR" | `PlugProPreset.dart` ~lines 508–519 |
| S5 | QR prefix `nux://MightyAmp:`; base64 decode; header check `data[0]`, `data[1]` | `presets/Preset.dart` `setupPresetFromQRData` (~line 185) |
| S6 | `.mspatch`/`.mppropatch`: 8404 bytes, preset at offset 4 (113 bytes), rest zero; QR → patch and patch → QR | `mighty-patch-convert/converter.js` lines ~104–170 |
| S7 | Model lists: 29 amps (incl. Twin Rvb, Class A15, Vibro King, Budda, Brit Blues, Match D30, Brit 2000, Uber HiGain, Optima Air nuxIndex 28, Stageman 29), 34 cabs ending G-HBIRD, G-J15, M-D45, then 20 user IRs with `nuxIndex = i + customIRStart(34) + 1` → 35–54; 3 comps, 14 EFX, 14 mods, 6 delays, 6 reverbs, 2 EQs | `PlugProPreset.dart` constructor lines ~84–219; `plug_pro/Amps.dart`; `communication/plugProCommunication.dart` lines 45–47 |
| S8 | Delay time tables (s at raw 0/25/50/75/100) and piecewise-linear mapping; Pro formatters store raw 0–100 | `value_formatters/TempoFormatter.dart` |
| S9 | Analog Delay V2: time is Para1 (named "Rate", formatter `tempoProAnalog`), "Echo" is Para2, "Intensity" Para3 | `effects/plug_pro/Delay.dart` `AnalogDelayV2` (~lines 75–109) |
| S10 | Formatters: percent raw=value; cab level/master dB −12..+12 → `floor((v+12)/24*100)`; EQ ±15 dB → `floor((v+15)/30*100)`; low cut `20 + raw/100*280` Hz; high cut log 5 k–20 kHz | `value_formatters/PercentageFormatter.dart`, `DecibelFormatter.dart`, `FrequencyFormatter.dart`; master uses `decibelMPPro` (`NuxMightyPlugPro.dart` line 129) |
| S11 | Cab params: Level = CAB_Para4, Low Cut = CAB_Para5, High Cut = CAB_Para6 | `effects/plug_pro/Cabinet.dart` lines ~46–67 |
| S12 | Licenses: mightier_amp MIT © 2020-2021 Dian Iliev (Tuntorius); mighty-patch-convert MIT © 2023 tuntorius | `mightier_amp/LICENSE.md`, `mighty-patch-convert/LICENSE` |
| S13 | Gemini API free tier: Grounding with Google Search free up to 500 RPD for 2.5 Flash (shared with Flash-Lite); Gemini 3+ grounding billed per search query; free-tier content "used to improve our products"; RPD resets at midnight Pacific; limits per project | https://ai.google.dev/gemini-api/docs/pricing (updated 2026-10-16), https://ai.google.dev/gemini-api/docs/google-search, https://ai.google.dev/gemini-api/docs/rate-limits |
| S14 | iOS Home Screen web apps: storage separate from Safari; not subject to ITP 7-day eviction; best-effort eviction under pressure unless `navigator.storage.persist()` granted (heuristic) | https://bugs.webkit.org/show_bug.cgi?id=181849, https://webkit.org/blog/14403/updates-to-storage-policy/, https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria |

Facts verified against the user's real exports (`tests/fixtures/`, 2026-10-20):

| ID | Fact | Evidence |
| --- | --- | --- |
| S15 | The Plug Pro byte map, head encoding, 9-slot chain at 89 (offset 0) and QR header `[15, 1]` hold for Mighty Space firmware 20230331 / MightyAmp iOS 3.6.6 | 3 fixtures decode with zero warnings, match the app screenshots, and re-encode byte-identically (GOLD-001/006) |
| S16 | High cut knob 75 = 14142 Hz; cab level 75 = +6 dB; low cut raw 4 = 31 Hz | `acoustic-ir-tone` fixture vs preset 4 screenshot |
| S17 | User IR cab index 37 = user slot 3; the QR payload stores only the slot, not the IR name | `acoustic-ir-tone` fixture |
| S18 | Official exports leave name bytes 100–112 empty and master byte 84 = 0 | all 3 fixtures |

Facts given by the user and **not independently verified** in this planning pass (treat as `verified: false` until a
fixture or user test confirms): user IR truncation to 512 samples @ 48 kHz; IRs loaded only via Mighty Editor
desktop; Acoustic IR cabs designed by NUX for magnetic pickups; 7 preset slots on the amp; NUX "ChopTones Custom IRs"
(Bogna-T75, BritJH-G) existence and indexes; firmware 20230331 matching the Plug Pro map (now confirmed for the fields the fixtures exercise, see S15).
