import type { BlockKind } from '../contracts/blocks.ts';
import type { Patch } from '../contracts/patch.ts';

/** Simple seeded pseudo-random number generator (mulberry32). */
function mulberry32(seed: number) {
  return function (): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    z = (z ^ (z + Math.imul(z ^ (z >>> 7), 61 | z))) >>> 0;
    return z / 4294967296;
  };
}

/** Deep-clone a Patch (only the blocks + scalar fields we need). */
function clonePatch(patch: Patch): Patch {
  return {
    ...patch,
    blocks: Object.fromEntries(
      Object.entries(patch.blocks).map(([k, b]) => [
        k,
        { ...b, params: { ...b.params } },
      ]),
    ) as Patch['blocks'],
    warnings: [...patch.warnings],
  };
}

/**
 * Produces `count` stable variations of a patch by applying small random-ish
 * perturbations (±5-10) to non-locked params.
 * Seed is derived from toneId so variants are stable on re-render.
 */
export function generateVariants(
  patch: Patch,
  count: number = 3,
  toneId: number = 0,
  locked: BlockKind[] = [],
): Patch[] {
  const variants: Patch[] = [];
  for (let v = 0; v < count; v++) {
    const seed = (toneId * 31 + v * 1_000_003) >>> 0;
    const rand = mulberry32(seed);
    const clone = clonePatch(patch);

    for (const [blockKey, blockState] of Object.entries(clone.blocks)) {
      if (locked.includes(blockKey as BlockKind)) continue;
      for (const paramKey of Object.keys(blockState.params)) {
        const cur = blockState.params[paramKey]!;
        // Perturbation: ±5-10
        const delta = (rand() * 10 + 5) * (rand() < 0.5 ? -1 : 1);
        blockState.params[paramKey] = Math.min(100, Math.max(0, Math.round(cur + delta)));
      }
    }

    variants.push(clone);
  }
  return variants;
}
