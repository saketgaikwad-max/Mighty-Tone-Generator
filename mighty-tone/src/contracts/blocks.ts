export const BLOCK_KINDS = ['gate', 'comp', 'efx', 'amp', 'eq', 'mod', 'dly', 'rvb', 'cab'] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];
