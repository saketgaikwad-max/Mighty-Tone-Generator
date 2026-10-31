import { describe, expect, it } from 'vitest';
import { generateVariants } from '../../src/engine/variants.ts';
import { solve } from '../../src/engine/solve.ts';
import { parse } from '../../src/engine/parse.ts';
import { BLOCK_KINDS } from '../../src/contracts/blocks.ts';

function makePatch() {
  return solve(parse({ prompt: 'warm crunch blues' })).patch;
}

describe('engine/variants', () => {
  it('UNIT-VAR-01 produces the requested count of patches', () => {
    const patch = makePatch();
    const variants = generateVariants(patch, 3, 42);
    expect(variants).toHaveLength(3);
  });

  it('UNIT-VAR-02 all params are in range 0-100', () => {
    const patch = makePatch();
    const variants = generateVariants(patch, 3, 1);
    for (const v of variants) {
      for (const block of BLOCK_KINDS) {
        for (const [, val] of Object.entries(v.blocks[block]?.params ?? {})) {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('UNIT-VAR-03 re-running with same seed gives same result', () => {
    const patch = makePatch();
    const a = generateVariants(patch, 3, 99);
    const b = generateVariants(patch, 3, 99);
    for (let i = 0; i < 3; i++) {
      for (const block of BLOCK_KINDS) {
        expect(a[i]!.blocks[block]?.params).toEqual(b[i]!.blocks[block]?.params);
      }
    }
  });

  it('UNIT-VAR-04 variants differ from original patch', () => {
    const patch = makePatch();
    const variants = generateVariants(patch, 3, 7);
    let atLeastOneDiff = false;
    for (const v of variants) {
      for (const block of BLOCK_KINDS) {
        const origParams = patch.blocks[block]?.params ?? {};
        const varParams = v.blocks[block]?.params ?? {};
        for (const key of Object.keys(origParams)) {
          if (origParams[key] !== varParams[key]) atLeastOneDiff = true;
        }
      }
    }
    expect(atLeastOneDiff).toBe(true);
  });

  it('UNIT-VAR-05 locked blocks are not perturbed', () => {
    const patch = makePatch();
    const variants = generateVariants(patch, 3, 42, ['amp']);
    for (const v of variants) {
      expect(v.blocks.amp.params).toEqual(patch.blocks.amp.params);
    }
  });
});
