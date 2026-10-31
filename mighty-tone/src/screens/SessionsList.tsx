import { useEffect, useRef, useState } from 'react';
import { createSession, listSessions } from '../store/db.ts';
import type { Session } from '../store/db.ts';
import { QrView } from '../ui/components/QrView.tsx';
import { listTones, getLatestVersion } from '../store/db.ts';

// ── design tokens ────────────────────────────────────────────────────────────
const GLASS =
  'bg-[rgba(28,32,52,0.62)] backdrop-blur-xl border border-white/[0.08] rounded-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.35)]';
const GRADIENT_BTN =
  'bg-gradient-to-br from-[#7C6CFF] to-[#4F8BFF] text-white font-semibold rounded-full shadow-[0_0_24px_rgba(124,108,255,0.45)]';

// ── instruments ───────────────────────────────────────────────────────────────
const INSTRUMENTS = [
  { id: 'greg-bennett', label: 'Greg Bennett Avion AV-6', emoji: '🎸' },
  { id: 'hb-jumbo', label: 'HB Jumbo King', emoji: '🎸' },
  { id: 'epiphone-ej200', label: 'Epiphone EJ-200CE', emoji: '🎸' },
  { id: 'hb-mandolin', label: 'HB F-style mandolin', emoji: '🎻' },
  { id: 'other', label: 'Other', emoji: '🎵' },
] as const;

type InstrumentId = (typeof INSTRUMENTS)[number]['id'];

const PICKUP_POSITIONS = ['Neck', 'Both', 'Bridge'] as const;
const PLAYING_CONTEXTS = ['Home speaker', 'Headphones', 'Band mix'] as const;

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(diff / 86400000);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

interface SessionRowProps {
  session: Session;
  onSelect: (id: number) => void;
}

function SessionRow({ session, onSelect }: SessionRowProps) {
  const [qrString, setQrString] = useState<string | null>(null);

  useEffect(() => {
    if (!session.id) return;
    listTones(session.id).then(async (tones) => {
      if (!tones.length) return;
      const ver = await getLatestVersion(tones[tones.length - 1]!.id!);
      if (ver) setQrString(ver.qrString);
    }).catch(() => {/* silent */});
  }, [session.id]);

  return (
    <button
      type="button"
      onClick={() => session.id != null && onSelect(session.id)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left ${GLASS} mb-2`}
      style={{ minHeight: 64 }}
    >
      {/* Instrument icon */}
      <span className="text-2xl shrink-0">🎸</span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[#F2F3F8] font-semibold text-[15px] leading-snug truncate">{session.name}</p>
        <p className="text-[#9AA0B8] text-[12px] mt-0.5">{relativeTime(session.createdAt)}</p>
      </div>

      {/* QR thumbnail */}
      {qrString ? (
        <div className="shrink-0 opacity-70 pointer-events-none">
          <QrView qrString={qrString} size={36} />
        </div>
      ) : null}

      {/* chevron */}
      <span className="text-[#62677E] text-sm shrink-0">›</span>
    </button>
  );
}

interface NewSessionSheetProps {
  onCancel: () => void;
  onCreate: (name: string, instrumentId: string) => void;
}

function NewSessionSheet({ onCancel, onCreate }: NewSessionSheetProps) {
  const [name, setName] = useState('');
  const [instrument, setInstrument] = useState<InstrumentId>('greg-bennett');
  const [pickup, setPickup] = useState<string>('Neck');
  const [tuning, setTuning] = useState<'Standard' | 'Custom'>('Standard');
  const [customTuning, setCustomTuning] = useState('');
  const [capo, setCapo] = useState(0);
  const [context, setContext] = useState<string>('Home speaker');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  function handleCreate() {
    const finalName = name.trim() || 'New Session';
    onCreate(finalName, instrument);
  }

  const segBtn = (active: boolean) =>
    `flex-1 py-2 text-[13px] font-medium rounded-full transition-colors ${
      active
        ? 'bg-gradient-to-br from-[#7C6CFF] to-[#4F8BFF] text-white'
        : 'text-[#9AA0B8]'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* sheet */}
      <div
        className="relative bg-[rgba(20,24,38,0.98)] backdrop-blur-xl border-t border-white/[0.08] rounded-t-[26px] px-4 pt-3 pb-8 flex flex-col gap-4"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* drag handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-1" />

        {/* header */}
        <div className="flex items-center justify-between mb-1">
          <button type="button" onClick={onCancel} className="text-[#7C6CFF] text-[15px]">Cancel</button>
          <p className="text-[#F2F3F8] font-semibold text-[17px]">New Session</p>
          <div className="w-12" />
        </div>

        {/* Name */}
        <div>
          <label className="text-[#9AA0B8] text-[12px] uppercase tracking-wider mb-1 block">Session name</label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Blues Jam"
            className="w-full bg-[rgba(28,32,52,0.62)] border border-white/[0.08] rounded-[12px] px-4 py-3 text-[#F2F3F8] text-[15px] outline-none placeholder:text-[#62677E]"
          />
        </div>

        {/* Instrument */}
        <div>
          <label className="text-[#9AA0B8] text-[12px] uppercase tracking-wider mb-2 block">Instrument</label>
          <div className="flex flex-col gap-1">
            {INSTRUMENTS.map(inst => (
              <button
                key={inst.id}
                type="button"
                onClick={() => setInstrument(inst.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-[12px] text-left transition-colors ${
                  instrument === inst.id
                    ? 'bg-gradient-to-br from-[#7C6CFF]/20 to-[#4F8BFF]/20 border border-[#7C6CFF]/40'
                    : 'bg-[rgba(28,32,52,0.62)] border border-white/[0.08]'
                }`}
              >
                <span className="text-xl">{inst.emoji}</span>
                <span className={`text-[15px] font-medium ${instrument === inst.id ? 'text-[#F2F3F8]' : 'text-[#9AA0B8]'}`}>
                  {inst.label}
                </span>
                {instrument === inst.id && <span className="ml-auto text-[#7C6CFF]">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Pickup */}
        <div>
          <label className="text-[#9AA0B8] text-[12px] uppercase tracking-wider mb-2 block">Pickup position</label>
          <div className="flex gap-1 bg-[rgba(28,32,52,0.62)] rounded-full p-1 border border-white/[0.08]">
            {PICKUP_POSITIONS.map(pos => (
              <button key={pos} type="button" onClick={() => setPickup(pos)} className={segBtn(pickup === pos)}>
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Tuning */}
        <div>
          <label className="text-[#9AA0B8] text-[12px] uppercase tracking-wider mb-2 block">Tuning</label>
          <div className="flex gap-1 bg-[rgba(28,32,52,0.62)] rounded-full p-1 border border-white/[0.08] mb-2">
            {(['Standard', 'Custom'] as const).map(t => (
              <button key={t} type="button" onClick={() => setTuning(t)} className={segBtn(tuning === t)}>
                {t}
              </button>
            ))}
          </div>
          {tuning === 'Custom' && (
            <input
              type="text"
              value={customTuning}
              onChange={e => setCustomTuning(e.target.value)}
              placeholder="e.g. DADGAD"
              className="w-full bg-[rgba(28,32,52,0.62)] border border-white/[0.08] rounded-[12px] px-4 py-3 text-[#F2F3F8] text-[15px] outline-none placeholder:text-[#62677E]"
            />
          )}
        </div>

        {/* Capo */}
        <div>
          <label className="text-[#9AA0B8] text-[12px] uppercase tracking-wider mb-2 block">Capo</label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setCapo(Math.max(0, capo - 1))}
              className="w-11 h-11 rounded-full bg-[rgba(28,32,52,0.62)] border border-white/[0.08] text-[#F2F3F8] text-xl flex items-center justify-center"
            >−</button>
            <span className="text-[#F2F3F8] text-[17px] font-semibold tabular-nums w-8 text-center">{capo}</span>
            <button
              type="button"
              onClick={() => setCapo(Math.min(12, capo + 1))}
              className="w-11 h-11 rounded-full bg-[rgba(28,32,52,0.62)] border border-white/[0.08] text-[#F2F3F8] text-xl flex items-center justify-center"
            >+</button>
          </div>
        </div>

        {/* Playing context */}
        <div>
          <label className="text-[#9AA0B8] text-[12px] uppercase tracking-wider mb-2 block">Playing context</label>
          <div className="flex gap-1 bg-[rgba(28,32,52,0.62)] rounded-full p-1 border border-white/[0.08]">
            {PLAYING_CONTEXTS.map(ctx => (
              <button key={ctx} type="button" onClick={() => setContext(ctx)} className={segBtn(context === ctx)}>
                {ctx}
              </button>
            ))}
          </div>
        </div>

        {/* Create button */}
        <button
          type="button"
          onClick={handleCreate}
          className={`${GRADIENT_BTN} w-full py-4 text-[17px] mt-2`}
          style={{ minHeight: 52 }}
        >
          Create session
        </button>
      </div>
    </div>
  );
}

interface SessionsListProps {
  onSelectSession: (sessionId: number) => void;
  onNewSession: (sessionId: number, instrumentId: string) => void;
}

export function SessionsList({ onSelectSession, onNewSession }: SessionsListProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [search, setSearch] = useState('');
  const [showSheet, setShowSheet] = useState(false);

  useEffect(() => {
    listSessions().then(setSessions).catch(() => {/* silent */});
  }, []);

  const filtered = sessions.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate(name: string, instrumentId: string) {
    setShowSheet(false);
    const session = await createSession(name);
    setSessions(prev => [session, ...prev]);
    onNewSession(session.id!, instrumentId);
  }

  return (
    <div className="flex flex-col h-full bg-[#0B0D14]">
      {/* Header */}
      <div className="px-4 pt-12 pb-2">
        <h1 className="text-[#F2F3F8] font-bold text-[34px] leading-[41px]">Sessions</h1>
      </div>

      {/* Search bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 bg-[rgba(28,32,52,0.62)] border border-white/[0.08] rounded-full px-4 py-2.5">
          <span className="text-[#62677E] text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sessions, tones, songs"
            className="flex-1 bg-transparent text-[#F2F3F8] text-[15px] outline-none placeholder:text-[#62677E]"
          />
        </div>
      </div>

      {/* New session button */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={() => setShowSheet(true)}
          className={`${GRADIENT_BTN} w-full py-3.5 text-[17px]`}
          style={{ minHeight: 52 }}
        >
          ＋ New session
        </button>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-4">
        {filtered.length === 0 && !search && (
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <p className="text-[#62677E] text-[15px] text-center">No sessions yet.<br />Tap "＋ New session" to get started.</p>
          </div>
        )}
        {filtered.length === 0 && search && (
          <p className="text-[#62677E] text-[15px] text-center mt-8">No results for "{search}"</p>
        )}
        {filtered.map(session => (
          <SessionRow key={session.id} session={session} onSelect={onSelectSession} />
        ))}
      </div>

      {/* New session sheet */}
      {showSheet && (
        <NewSessionSheet
          onCancel={() => setShowSheet(false)}
          onCreate={(name, inst) => void handleCreate(name, inst)}
        />
      )}
    </div>
  );
}
