import type { Tone } from '../../store/db.ts';

interface Props {
  tones: Tone[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export function ToneFilters({ tones, activeFilter, onFilterChange }: Props) {
  const archetypes = Array.from(new Set(tones.map((t) => t.archetype))).filter(Boolean);
  const instruments = Array.from(new Set(tones.map((t) => t.instrument))).filter(Boolean);

  const chips = [
    { key: 'all', label: 'All' },
    ...archetypes.map((a) => ({ key: `archetype:${a}`, label: a })),
    ...instruments.map((i) => ({ key: `instrument:${i}`, label: i })),
  ];

  return (
    <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b border-zinc-800 bg-zinc-950">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onFilterChange(chip.key)}
          className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            activeFilter === chip.key
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
