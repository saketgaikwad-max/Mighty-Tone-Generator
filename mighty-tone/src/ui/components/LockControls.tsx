import type { BlockKind } from '../../contracts/blocks.ts';

const BLOCK_LABELS: Record<BlockKind, string> = {
  gate: 'Gate',
  comp: 'Comp',
  efx: 'EFX',
  amp: 'Amp',
  eq: 'EQ',
  mod: 'Mod',
  dly: 'Dly',
  rvb: 'Rvb',
  cab: 'Cab',
};

const BLOCK_KINDS: BlockKind[] = ['gate', 'comp', 'efx', 'amp', 'eq', 'mod', 'dly', 'rvb', 'cab'];

interface LockControlsProps {
  locked: BlockKind[];
  onChange: (locked: BlockKind[]) => void;
}

export function LockControls({ locked, onChange }: LockControlsProps) {
  function toggle(kind: BlockKind) {
    if (locked.includes(kind)) {
      onChange(locked.filter((k) => k !== kind));
    } else {
      onChange([...locked, kind]);
    }
  }

  return (
    <div className="flex flex-wrap gap-1 px-4 py-2">
      <span className="text-zinc-500 text-xs self-center mr-1">Lock:</span>
      {BLOCK_KINDS.map((kind) => {
        const isLocked = locked.includes(kind);
        return (
          <button
            key={kind}
            type="button"
            onClick={() => toggle(kind)}
            className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
              isLocked
                ? 'bg-amber-500 border-amber-400 text-black'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
            title={isLocked ? `Unlock ${BLOCK_LABELS[kind]}` : `Lock ${BLOCK_LABELS[kind]}`}
          >
            {isLocked ? '🔒' : '🔓'} {BLOCK_LABELS[kind]}
          </button>
        );
      })}
    </div>
  );
}
