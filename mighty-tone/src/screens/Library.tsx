import { useEffect, useState } from 'react';
import { getLatestVersion, listSessions, listTones, type Tone } from '../store/db.ts';
import { QrView } from '../ui/components/QrView.tsx';
import { applyToneFilter } from '../ui/utils/toneFilter.ts';

// Archetype → gradient colours
function archetypeGradient(archetype: string): string {
  const key = archetype.toLowerCase();
  const gradients: Record<string, string> = {
    clean: 'linear-gradient(135deg, #1e3a5f, #4F8BFF)',
    crunch: 'linear-gradient(135deg, #7c2d12, #f97316)',
    lead: 'linear-gradient(135deg, #7f1d1d, #ef4444)',
    acoustic: 'linear-gradient(135deg, #14532d, #22c55e)',
    'high-gain': 'linear-gradient(135deg, #3b0764, #a855f7)',
  };
  return gradients[key] ?? 'linear-gradient(135deg, #1e1b4b, #7C6CFF)';
}

function archetypeColor(archetype: string): string {
  const map: Record<string, string> = {
    clean: '#4F8BFF',
    crunch: '#f97316',
    lead: '#ef4444',
    acoustic: '#22c55e',
    'high-gain': '#a855f7',
  };
  return map[archetype.toLowerCase()] ?? '#7C6CFF';
}

interface ToneWithQr extends Tone {
  qrString?: string;
}

interface BottomSheetProps {
  tone: ToneWithQr;
  onClose: () => void;
}

function ToneBottomSheet({ tone, onClose }: BottomSheetProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[26px] p-6 pb-10 flex flex-col gap-4"
        style={{
          background: 'rgba(28,32,52,0.96)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[#F2F3F8] text-lg font-bold">{tone.archetype}</p>
            <p className="text-[#9AA0B8] text-sm mt-0.5">{tone.instrument}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#62677E] text-sm min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            ✕
          </button>
        </div>
        {tone.qrString ? (
          <div className="flex flex-col items-center gap-4">
            <QrView qrString={tone.qrString} size={220} />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(tone.qrString ?? '');
              }}
              className="min-h-[44px] px-6 py-2 rounded-[999px] text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#7C6CFF,#4F8BFF)' }}
            >
              Share QR
            </button>
          </div>
        ) : (
          <p className="text-[#62677E] text-sm text-center">No QR available</p>
        )}
      </div>
    </div>
  );
}

export function Library() {
  const [allTones, setAllTones] = useState<ToneWithQr[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedTone, setSelectedTone] = useState<ToneWithQr | null>(null);

  useEffect(() => {
    async function load() {
      const sessions = await listSessions();
      const collected: ToneWithQr[] = [];
      for (const session of sessions) {
        const tones = await listTones(session.id!);
        for (const tone of tones) {
          const v = await getLatestVersion(tone.id!);
          collected.push({ ...tone, qrString: v?.qrString });
        }
      }
      setAllTones(collected);
      setLoading(false);
    }
    void load();
  }, []);

  // Build filter chips
  const archetypes = Array.from(new Set(allTones.map((t) => t.archetype))).filter(Boolean);
  const instruments = Array.from(new Set(allTones.map((t) => t.instrument))).filter(Boolean);
  const chips = [
    { key: 'all', label: 'All' },
    ...archetypes.map((a) => ({ key: `archetype:${a}`, label: a })),
    ...instruments.map((i) => ({ key: `instrument:${i}`, label: i })),
  ];

  // Apply search + filter
  const afterFilter = applyToneFilter(allTones, activeFilter);
  const filtered = searchQuery.trim()
    ? afterFilter.filter((t) => {
        const q = searchQuery.toLowerCase();
        return (
          t.archetype?.toLowerCase().includes(q) ||
          t.instrument?.toLowerCase().includes(q)
        );
      })
    : afterFilter;

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: '#0B0D14' }}
    >
      {/* Header */}
      <div className="px-4 pt-6 pb-2 shrink-0">
        <h1 className="text-[#F2F3F8] font-bold" style={{ fontSize: 34, lineHeight: '41px' }}>
          Saved Tones
        </h1>
      </div>

      {/* Search bar */}
      <div className="px-4 pb-3 shrink-0">
        <input
          type="search"
          placeholder="Search tones, artists, songs"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full outline-none text-[#F2F3F8] placeholder-[#62677E] text-sm"
          style={{
            background: 'rgba(28,32,52,0.62)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 999,
            padding: '10px 18px',
            height: 44,
          }}
        />
      </div>

      {/* Filter chips */}
      <div
        className="flex gap-2 px-4 pb-3 overflow-x-auto shrink-0"
        style={{ scrollbarWidth: 'none' }}
      >
        {chips.map((chip) => {
          const active = activeFilter === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setActiveFilter(chip.key)}
              className="shrink-0 text-xs font-medium transition-colors"
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 999,
                background: active ? 'rgba(124,108,255,0.22)' : 'rgba(20,24,38,1)',
                border: active
                  ? '1px solid #7C6CFF'
                  : '1px solid rgba(255,255,255,0.08)',
                color: active ? '#9A8CFF' : '#9AA0B8',
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading && (
          <p className="text-[#62677E] text-sm text-center mt-12">Loading tones…</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-[#62677E] text-sm text-center mt-12">No saved tones yet.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((tone) => (
            <button
              key={tone.id}
              type="button"
              onClick={() => setSelectedTone(tone)}
              className="text-left flex flex-col overflow-hidden"
              style={{
                background: 'rgba(28,32,52,0.62)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 18,
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                minHeight: 44,
              }}
            >
              {/* Artwork */}
              <div
                style={{
                  height: 80,
                  background: archetypeGradient(tone.archetype),
                  borderRadius: '18px 18px 0 0',
                }}
              />
              {/* Info */}
              <div className="p-3 flex flex-col gap-1.5">
                <p className="text-[#F2F3F8] font-bold text-sm truncate">{tone.archetype}</p>
                {/* Instrument badge */}
                <span
                  className="text-xs w-fit"
                  style={{
                    color: '#9AA0B8',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 999,
                    padding: '1px 8px',
                  }}
                >
                  {tone.instrument}
                </span>
                {/* Archetype chip */}
                <span
                  className="text-xs w-fit font-medium"
                  style={{
                    color: archetypeColor(tone.archetype),
                    background: `${archetypeColor(tone.archetype)}22`,
                    border: `1px solid ${archetypeColor(tone.archetype)}55`,
                    borderRadius: 999,
                    padding: '1px 8px',
                  }}
                >
                  {tone.archetype}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom sheet */}
      {selectedTone && (
        <ToneBottomSheet tone={selectedTone} onClose={() => setSelectedTone(null)} />
      )}
    </div>
  );
}
