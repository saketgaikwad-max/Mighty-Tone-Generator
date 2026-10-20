import type { BlockKind } from './blocks.ts';

/** One effect block as stored in the patch. Raw bytes (0-100 or switch values) are the source of truth. */
export interface BlockState {
  block: BlockKind;
  modelId: string;
  enabled: boolean;
  params: Record<string, number>;
}

/** A decoded 113-byte Plug Pro / Mighty Space preset. */
export interface Patch {
  device: 'mighty-space';
  qrHeader: readonly [number, number];
  blocks: Record<BlockKind, BlockState>;
  /** Signal chain, first to last, 9 entries. */
  chain: BlockKind[];
  /** Bytes skipped before the chain (0-3), per the reference decoder's "fix for QR". Re-encoded at the same offset. */
  chainOffset: number;
  /** Raw master byte (0-100 maps to -12..+12 dB). */
  master: number;
  /** ASCII name stored in preset bytes 100-112 (empty when unused). */
  name: string;
  /** Full 113 bytes as decoded; used as the template when encoding so unmodelled bytes are preserved. */
  raw: Uint8Array;
  warnings: string[];
}
