import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOCK_KINDS, type BlockKind } from '../../src/contracts/blocks.ts';
import type { BlockState, Patch } from '../../src/contracts/patch.ts';
import { decodePreset, encodePreset } from '../../src/codec/preset.ts';
import { buildQrString, parseQrString } from '../../src/codec/qr-string.ts';
import { modelsOf } from '../../src/knowledge/device.ts';

const fixtureText = readFileSync(join(import.meta.dirname, '..', 'fixtures', 'qr', 'clean-tone.txt'), 'utf8');
const parsed = parseQrString(fixtureText);
if (!parsed.ok) throw new Error('fixture');
const template = decodePreset(parsed.preset);

const blockArb = (block: BlockKind): fc.Arbitrary<BlockState> =>
  fc.constantFrom(...modelsOf(block)).chain((model) =>
    fc.record({
      block: fc.constant(block),
      modelId: fc.constant(model.id),
      enabled: fc.boolean(),
      params: fc.record(
        Object.fromEntries(
          model.params.map((p) => [p.key, p.switch ? fc.constantFrom(...p.switch.values) : fc.integer({ min: 0, max: 100 })]),
        ),
      ),
    }),
  );

const patchArb: fc.Arbitrary<Patch> = fc
  .record({
    blocks: fc.record(Object.fromEntries(BLOCK_KINDS.map((b) => [b, blockArb(b)])) as Record<BlockKind, fc.Arbitrary<BlockState>>),
    chain: fc.shuffledSubarray([...BLOCK_KINDS], { minLength: 9, maxLength: 9 }),
    master: fc.integer({ min: 0, max: 100 }),
    name: fc.stringMatching(/^[ -~]{0,13}$/),
  })
  .map((r) => ({ ...template, ...r, raw: template.raw, warnings: [] }));

describe('codec properties', () => {
  it('PROP-CODEC-01 encode -> decode is the identity on 10k random valid patches', () => {
    fc.assert(
      fc.property(patchArb, (patch) => {
        const decoded = decodePreset(parseQrStringOrThrow(buildQrString(encodePreset(patch))));
        expect(decoded.blocks).toEqual(patch.blocks);
        expect(decoded.chain).toEqual(patch.chain);
        expect(decoded.master).toBe(patch.master);
        expect(decoded.name).toBe(patch.name.replace(/\0.*$/, ''));
        expect(decoded.warnings).toEqual([]);
      }),
      { numRuns: 10_000 },
    );
  });
});

function parseQrStringOrThrow(s: string): Uint8Array {
  const r = parseQrString(s);
  if (!r.ok) throw new Error(r.error);
  return r.preset;
}
