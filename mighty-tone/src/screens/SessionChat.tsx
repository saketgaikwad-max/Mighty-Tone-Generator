import { useEffect, useRef, useState } from 'react';
import { describePatch } from '../codec/describe.ts';
import type { BlockKind } from '../contracts/blocks.ts';
import type { Patch } from '../contracts/patch.ts';
import type { ToneMeta } from '../engine/index.ts';
import { encodePreset } from '../codec/preset.ts';
import { buildQrString } from '../codec/qr-string.ts';
import { createSession, saveTone } from '../store/db.ts';
import { generateToneAsync } from '../services/generateTone.ts';
import { QrView } from '../ui/components/QrView.tsx';
import { VersionTimeline } from '../ui/components/VersionTimeline.tsx';
import { LockControls } from '../ui/components/LockControls.tsx';
import { DelayHelper } from '../ui/components/DelayHelper.tsx';
import { VariantCarousel } from '../ui/components/VariantCarousel.tsx';

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
  versionId: number;
  qrString: string;
  patch: Patch;
  meta: ToneMeta;
}

interface SessionChatProps {
  onGoToIrLab?: () => void;
}

export function SessionChat({ onGoToIrLab }: SessionChatProps = {}) {
  const [messages, setMessages] = useState<ToneCard[]>([]);
  const [input, setInput] = useState('');
  const defaultInstrument = (localStorage.getItem('default-instrument') as InstrumentId | null) ?? 'electric-single-coil';
  const [instrument, setInstrument] = useState<InstrumentId>(defaultInstrument as InstrumentId);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [locked, setLocked] = useState<BlockKind[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const latestCard = messages.length > 0 ? messages[messages.length - 1]! : null;

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
        const { patch, meta } = await generateToneAsync(prompt, instrument, locked);
        if (sid === null) {
          const name = `${meta.archetype} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          const session = await createSession(name);
          sid = session.id!;
          setSessionId(sid);
        }
        const preset = encodePreset(patch);
        const qrString = buildQrString(preset);
        const { tone, version } = await saveTone(sid, patch, meta);
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), toneId: tone.id!, versionId: version.id!, qrString, patch, meta },
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

  function handleRestore(qrString: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        toneId: -1,
        versionId: -1,
        qrString,
        patch: {} as Patch,
        meta: { archetype: 'Restored' } as ToneMeta,
      },
    ]);
  }

  async function handleSaveVariant(patch: Patch, qrString: string, _parentToneId: number) {
    if (!sessionId) return;
    try {
      const meta: ToneMeta = {
        archetype: latestCard?.meta.archetype ?? 'variant',
        ruleTrace: [],
        confidence: 0,
        unknownTerms: [],
      };
      const { tone, version } = await saveTone(sessionId, patch, meta);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), toneId: tone.id!, versionId: version.id!, qrString, patch, meta },
      ]);
    } catch (err) {
      console.error('saveVariant failed', err);
    }
  }

  async function handleApplyDelay(delayByte: number, modelId: string) {
    if (!latestCard || !latestCard.patch?.blocks) return;
    const patch = latestCard.patch;
    // Update the dly time param byte value
    const dlyBlock = patch.blocks.dly;
    if (!dlyBlock) return;
    // Find the time/rate param (first tempo param)
    const updatedParams = { ...dlyBlock.params };
    // Apply to 'time' if it exists, else 'rate'
    const timeKey = 'time' in updatedParams ? 'time' : 'rate' in updatedParams ? 'rate' : null;
    if (!timeKey) return;
    updatedParams[timeKey] = delayByte;

    const updatedPatch: Patch = {
      ...patch,
      blocks: {
        ...patch.blocks,
        dly: { ...dlyBlock, modelId, params: updatedParams },
      },
    };

    if (!sessionId) return;
    try {
      const { tone, version } = await saveTone(sessionId, updatedPatch, latestCard.meta);
      const preset = encodePreset(updatedPatch);
      const qrString = buildQrString(preset);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), toneId: tone.id!, versionId: version.id!, qrString, patch: updatedPatch, meta: latestCard.meta },
      ]);
    } catch (err) {
      console.error('applyDelay failed', err);
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
              {/* Variant carousel */}
              {card.patch?.blocks && card.toneId > 0 && (
                <div className="px-4">
                  <p className="text-zinc-600 text-xs mb-1">Variants — tap to save</p>
                  <VariantCarousel
                    patch={card.patch}
                    toneId={card.toneId}
                    onSaveVariant={(p, q) => void handleSaveVariant(p, q, card.toneId)}
                  />
                </div>
              )}
              {/* Acoustic IR banner */}
              {card.meta.archetype?.toLowerCase().includes('acoustic') && onGoToIrLab && (
                <button
                  type="button"
                  onClick={onGoToIrLab}
                  className="w-full text-left bg-amber-900/40 border border-amber-700/60 rounded-xl px-4 py-2.5 text-xs text-amber-300"
                >
                  🎙 This tone uses a user IR slot. <span className="underline">Tap to manage IR slots.</span>
                </button>
              )}
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

      {/* Lock controls */}
      <LockControls locked={locked} onChange={setLocked} />

      {/* Delay Helper */}
      <DelayHelper
        latestPatch={latestCard?.patch ?? null}
        onApply={(byte, modelId) => void handleApplyDelay(byte, modelId)}
      />

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
