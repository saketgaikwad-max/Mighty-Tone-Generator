import { useEffect, useRef, useState } from 'react';
import { describePatch } from '../codec/describe.ts';
import type { Patch } from '../contracts/patch.ts';
import type { ToneMeta } from '../engine/index.ts';
import { generateTone } from '../engine/index.ts';
import { encodePreset } from '../codec/preset.ts';
import { buildQrString } from '../codec/qr-string.ts';
import { createSession, saveTone } from '../store/db.ts';
import { QrView } from '../ui/components/QrView.tsx';
import { VersionTimeline } from '../ui/components/VersionTimeline.tsx';

const INSTRUMENTS = [
  { id: 'electric-single-coil', label: 'Single Coil' },
  { id: 'electric-humbucker', label: 'Humbucker' },
  { id: 'electric-p90', label: 'P90' },
  { id: 'acoustic-piezo', label: 'Acoustic Piezo' },
  { id: 'acoustic-magnetic', label: 'Acoustic Mag' },
  { id: 'mandolin-magnetic', label: 'Mandolin Mag' },
  { id: 'mandolin-acoustic', label: 'Mandolin Acoustic' },
] as const;

type InstrumentId = (typeof INSTRUMENTS)[number]['id'];

interface ToneCard {
  id: string;
  toneId: number;
  qrString: string;
  patch: Patch;
  meta: ToneMeta;
}

export function SessionChat() {
  const [messages, setMessages] = useState<ToneCard[]>([]);
  const [input, setInput] = useState('');
  const defaultInstrument = (localStorage.getItem('default-instrument') as InstrumentId | null) ?? 'electric-single-coil';
  const [instrument, setInstrument] = useState<InstrumentId>(defaultInstrument as InstrumentId);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const prompt = input.trim();
    if (!prompt || loading) return;
    setInput('');
    setLoading(true);
    setTimeout(async () => {
      try {
        // Ensure session exists before saving tone
        let sid = sessionId;
        if (sid === null) {
          const { patch: tempPatch, meta: tempMeta } = generateTone(prompt, instrument);
          const name = `${tempMeta.archetype} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          const session = await createSession(name);
          sid = session.id!;
          setSessionId(sid);
          // Now save the tone with the real sessionId
          const preset = encodePreset(tempPatch);
          const qrString = buildQrString(preset);
          const { tone } = await saveTone(sid, tempPatch, tempMeta);
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), toneId: tone.id!, qrString, patch: tempPatch, meta: tempMeta },
          ]);
        } else {
          const { patch, meta } = generateTone(prompt, instrument);
          const preset = encodePreset(patch);
          const qrString = buildQrString(preset);
          const { tone } = await saveTone(sid, patch, meta);
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), toneId: tone.id!, qrString, patch, meta },
          ]);
        }
      } catch (err) {
        console.error('generateAndSave failed', err);
      } finally {
        setLoading(false);
      }
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleRestore(qrString: string) {
    // Re-queue the restored QR as a new card by setting input — or just show it
    // For v1: add it as a new card in the timeline
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        toneId: -1, // restored version, no new DB row
        qrString,
        patch: {} as Patch,
        meta: { archetype: 'Restored' } as ToneMeta,
      },
    ]);
  }

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Message area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {messages.length === 0 && !loading && (
          <p className="text-zinc-600 text-sm text-center mt-8">
            No messages yet. Describe your tone below.
          </p>
        )}
        {messages.map((card) => {
          const desc = card.patch && card.patch.blocks ? describePatch(card.patch) : null;
          const amp = desc?.blocks.amp;
          const isExpanded = expandedCardId === card.id;
          return (
            <div key={card.id} className="flex flex-col gap-2">
              <button
                type="button"
                className="bg-zinc-900 rounded-2xl p-4 flex gap-4 items-start text-left w-full"
                onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
              >
                <QrView qrString={card.qrString} size={96} />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">{card.meta.archetype}</p>
                  <p className="text-zinc-400 text-xs mt-0.5">{amp?.model ?? '—'}</p>
                  {amp && (
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                      {Object.entries(amp.params)
                        .slice(0, 4)
                        .map(([k, v]) => (
                          <span key={k} className="text-zinc-500 text-xs">
                            {k}: <span className="text-zinc-300">{v}</span>
                          </span>
                        ))}
                    </div>
                  )}
                  <p className="text-zinc-600 text-xs mt-1">{isExpanded ? '▲ Hide history' : '▼ Version history'}</p>
                </div>
              </button>
              {isExpanded && card.toneId > 0 && (
                <div className="ml-4">
                  <VersionTimeline toneId={card.toneId} onRestore={handleRestore} />
                </div>
              )}
            </div>
          );
        })}
        {loading && (
          <div className="bg-zinc-900 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <span className="text-zinc-400 text-sm">Generating tone…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Instrument chips */}
      <div className="flex gap-2 px-4 py-2 overflow-x-auto border-t border-zinc-800 bg-zinc-950">
        {INSTRUMENTS.map((inst) => (
          <button
            key={inst.id}
            type="button"
            onClick={() => setInstrument(inst.id)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              instrument === inst.id
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {inst.label}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div className="border-t border-zinc-800 bg-zinc-950 p-3 flex items-center gap-2">
        <input
          type="text"
          placeholder="Describe your tone…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-zinc-800 text-white rounded-xl px-4 py-2 text-sm outline-none placeholder:text-zinc-500"
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
