import { BLOCK_KINDS, type BlockKind } from '../contracts/blocks.ts';
import type { Patch } from '../contracts/patch.ts';
import { modelById, userIrSlotOf } from '../knowledge/device.ts';
import { db12, toHuman } from './formatters.ts';

export interface BlockDescription {
  model: string;
  modelId: string;
  enabled: boolean;
  /** Knob label -> text as shown in the MightyAmp app. */
  params: Record<string, string>;
  userIrSlot?: number;
}

export interface PatchDescription {
  name: string;
  masterDb: number;
  chain: BlockKind[];
  blocks: Record<BlockKind, BlockDescription>;
  warnings: string[];
}

/** Human view of a patch (model names, knob texts as the app shows them); used by fixtures and the inspector. */
export function describePatch(patch: Patch): PatchDescription {
  const blocks = {} as Record<BlockKind, BlockDescription>;
  for (const block of BLOCK_KINDS) {
    const state = patch.blocks[block];
    const model = modelById(state.modelId)!;
    const params: Record<string, string> = {};
    for (const p of model.params) params[p.label] = toHuman(p, state.params[p.key]!).text;
    const d: BlockDescription = { model: model.name, modelId: model.id, enabled: state.enabled, params };
    const slot = block === 'cab' ? userIrSlotOf(model.nuxIndex) : undefined;
    if (slot !== undefined) d.userIrSlot = slot;
    blocks[block] = d;
  }
  return {
    name: patch.name,
    masterDb: Math.round(db12(patch.master) * 10) / 10,
    chain: patch.chain,
    blocks,
    warnings: patch.warnings,
  };
}
