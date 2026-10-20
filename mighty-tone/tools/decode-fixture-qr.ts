/**
 * Decode every tests/fixtures/qr/*.png and write the QR text next to it as <name>.txt.
 * Prints a human summary of each decoded patch for building <name>.expected.json.
 * Usage: npm run decode-fixtures
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { describePatch } from '../src/codec/describe.ts';
import { decodePreset } from '../src/codec/preset.ts';
import { parseQrString } from '../src/codec/qr-string.ts';
import { decodeQrImage } from '../src/qr/decode-image.ts';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures', 'qr');

for (const file of readdirSync(dir).filter((f) => f.endsWith('.png')).sort()) {
  const png = PNG.sync.read(readFileSync(join(dir, file)));
  const result = decodeQrImage({ data: new Uint8ClampedArray(png.data), width: png.width, height: png.height });
  if (!result) {
    console.log(`${file}: NO QR FOUND`);
    continue;
  }
  writeFileSync(join(dir, file.replace(/\.png$/, '.txt')), result.text + '\n');
  const parsed = parseQrString(result.text);
  console.log(`\n=== ${file} (strategy: ${result.strategy})`);
  console.log(result.text);
  if (!parsed.ok) {
    console.log(`parse error: ${parsed.error} ${parsed.detail}`);
    continue;
  }
  const patch = decodePreset(parsed.preset, parsed.header);
  console.log(Buffer.from(parsed.preset).toString('hex').replace(/(.{2})/g, '$1 ').trim());
  console.log(JSON.stringify(describePatch(patch), null, 2));
}
