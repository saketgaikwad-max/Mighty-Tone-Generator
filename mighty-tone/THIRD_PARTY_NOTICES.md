# Third-party notices

Mighty Tone Generator derives device data and codec behaviour from the projects below. Derived files carry a
provenance header (`knowledge/device/mighty-space.json` → `source`, per-model `source.file`/`line`).

| Project | Used for | Derived files |
| --- | --- | --- |
| [mightier_amp](https://github.com/tuntorius/mightier_amp) (commit `e05b6d06fadc6cfc301bbeefa4647cdda33e5210`) | Plug Pro / Mighty Space preset byte map, model and parameter tables, value formatters, delay time tables, QR header and decode tolerance | `knowledge/device/mighty-space.json` (via `tools/extract-plugpro.ts`), `src/codec/*` |
| [mighty-patch-convert](https://github.com/tuntorius/mighty-patch-convert) (commit `67d6c5bd1b4367f3b3241b106288b5b156dca5f0`) | `.mspatch` / `.mppropatch` layout (8404 bytes, preset at offset 4) | `src/codec/mspatch.ts` |

Runtime/test dependencies installed from npm keep their own licenses in `node_modules/*/LICENSE`.

## mightier_amp

```
MIT License

Copyright (c) 2020-2021 Dian Iliev (Tuntorius)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## mighty-patch-convert

```
MIT License

Copyright (c) 2023 tuntorius

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
