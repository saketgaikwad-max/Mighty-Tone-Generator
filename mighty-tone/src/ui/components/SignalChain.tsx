import { useState } from 'react';
import type { BlockKind } from '../../contracts/blocks.ts';
import type { Patch } from '../../contracts/patch.ts';
import { describePatch } from '../../codec/describe.ts';

const BLOCK_SHORT: Record<BlockKind, string> = {
  gate: 'Gate',
  comp: 'Comp',
  efx: 'EFX',
  amp: 'Amp',
  cab: 'Cab',
  eq: 'EQ',
  mod: 'Mod',
  dly: 'Dly',
  rvb: 'Rvb',
};

interface SignalChainProps {
  patch: Patch;
  locked: BlockKind[];
}

export function SignalChain({ patch, locked }: SignalChainProps) {
  const [expanded, setExpanded] = useState<BlockKind | null>(null);

  if (!patch?.blocks || !patch?.chain) return null;

  const desc = describePatch(patch);

  function toggleBlock(kind: BlockKind) {
    setExpanded((prev) => (prev === kind ? null : kind));
  }

  const expandedBlock = expanded ? desc.blocks[expanded] : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Horizontal scrollable pill strip */}
      <div className="flex gap-2 overflow-x-auto px-1 py-1 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
        {patch.chain.map((kind) => {
          const block = desc.blocks[kind];
          const isEnabled = block.enabled;
          const isExpanded = expanded === kind;
          const isLocked = locked.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              onClick={() => toggleBlock(kind)}
              style={{ minHeight: 44, minWidth: 52 }}
              className={[
                'shrink-0 flex flex-col items-center justify-center px-3 py-1.5 rounded-[12px] border text-xs font-semibold transition-all',
                isExpanded
                  ? 'border-[#7C6CFF] bg-[rgba(124,108,255,0.18)] text-white shadow-[0_0_12px_rgba(124,108,255,0.35)]'
                  : isEnabled
                    ? 'border-[#7C6CFF] text-white bg-transparent'
                    : 'border-white/10 text-white/40 bg-transparent opacity-40',
              ].join(' ')}
            >
              <span>{BLOCK_SHORT[kind]}</span>
              <span className="text-[9px] mt-0.5 opacity-60">{isLocked ? '🔒' : '🔓'}</span>
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      {expandedBlock && expanded && (
        <div
          className="bg-[rgba(28,32,52,0.62)] backdrop-blur-xl border border-white/[0.08] rounded-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.35)] px-4 py-3 flex flex-col gap-2"
        >
          <p className="text-[#F2F3F8] text-sm font-semibold">{expandedBlock.model}</p>
          <div className="flex flex-col gap-2">
            {Object.entries(expandedBlock.params).map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <div className="flex justify-between items-center">
                  <span className="text-[#9AA0B8] text-xs">{label}</span>
                  <span className="text-[#F2F3F8] text-xs font-mono tabular-nums">{value}</span>
                </div>
                {/* Read-only slider visual */}
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#7C6CFF] to-[#4F8BFF]"
                    style={{ width: '60%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
