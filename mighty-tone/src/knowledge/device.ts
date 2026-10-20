import data from '../../knowledge/device/mighty-space.json' with { type: 'json' };
import { BLOCK_KINDS, type BlockKind } from '../contracts/blocks.ts';
import type { DeviceKnowledge, ModelDef } from '../contracts/device.ts';

/** Validated in tests (UNIT-KN-01); cast here so the runtime bundle does not need to parse it. */
export const device = data as unknown as DeviceKnowledge;

const byId = new Map<string, ModelDef>();
const byNux = new Map<string, ModelDef>();
for (const block of BLOCK_KINDS) {
  for (const m of device.blocks[block].models) {
    byId.set(m.id, m);
    byNux.set(`${block}:${m.nuxIndex}`, m);
  }
}

const headToBlock = new Map<number, BlockKind>(BLOCK_KINDS.map((b) => [device.blocks[b].headIndex, b]));

export function modelById(id: string): ModelDef | undefined {
  return byId.get(id);
}

export function modelByNuxIndex(block: BlockKind, nuxIndex: number): ModelDef | undefined {
  return byNux.get(`${block}:${nuxIndex}`);
}

export function modelsOf(block: BlockKind): readonly ModelDef[] {
  return device.blocks[block].models;
}

export function headIndexOf(block: BlockKind): number {
  return device.blocks[block].headIndex;
}

export function blockForHeadIndex(head: number): BlockKind | undefined {
  return headToBlock.get(head);
}

export function userIrSlotOf(cabNuxIndex: number): number | undefined {
  const { first, count } = device.userIr;
  return cabNuxIndex >= first && cabNuxIndex < first + count ? cabNuxIndex - first + 1 : undefined;
}
