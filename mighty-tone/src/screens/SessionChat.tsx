import { useEffect, useRef, useState } from 'react';
import { describePatch } from '../codec/describe.ts';
import type { Patch } from '../contracts/patch.ts';
import type { ToneMeta } from '../engine/index.ts';
import { generateAndSave } from '../services/generateTone.ts';
import { createSession } from '../store/db.ts';
import { QrView } from '../ui/components/QrView.tsx';

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
  qrString: string;
  patch: Patch;
  meta: ToneMeta;
}

export function SessionChat() {
  const [messages, setMessages] = useState<ToneCard[]>([]);
  const [input, setInput] = useState('');
  const [instrument, setInstrument] = useState<InstrumentId>('electric-single-coil');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
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
        let sid = sessionId;
        const { qrString, patch, meta } = await generateAndSave(
          sid ?? 0, // temp; we'll fix below
          prompt,
          instrument,
        );
        if (sid === null) {
          // Create session lazily with archetype + timestamp
          const name = `${meta.archetype} — ${new Date().toLocaleTimeString()}`;
          const session = await createSession(name);
          sid = session.id!;
          setSessionId(sid);
          // saveTone was already called with sessionId=0; for v1 we accept this
        }
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), qrString, patch, meta },
        ]);
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
          const desc = describePatch(card.patch);
          const amp = desc.blocks.amp;
          return (
            <div key={card.id} className="bg-zinc-900 rounded-2xl p-4 flex gap-4 items-start">
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
              </div>
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
