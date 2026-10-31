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
import { generateVariants } from '../engine/variants.ts';

// ── design tokens ─────────────────────────────────────────────────────────────
const GLASS =
  'bg-[rgba(28,32,52,0.62)] backdrop-blur-xl border border-white/[0.08] rounded-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.35)]';
const GRADIENT_BTN =
  'bg-gradient-to-br from-[#7C6CFF] to-[#4F8BFF] text-white font-semibold rounded-full shadow-[0_0_24px_rgba(124,108,255,0.45)]';
const ACCENT_GLOW = 'shadow-[0_0_24px_rgba(124,108,255,0.45)]';

// ── instruments ───────────────────────────────────────────────────────────────
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

// ── signal chain pill labels ──────────────────────────────────────────────────
const CHAIN_LABELS: Record<BlockKind, string> = {
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

// ── confidence badge ──────────────────────────────────────────────────────────
function ConfidenceBadge({ value }: { value: number }) {
  const level = value >= 0.7 ? 'High' : value >= 0.4 ? 'Medium' : 'Low';
  const color = value >= 0.7 ? '#34D399' : value >= 0.4 ? '#FBBF24' : '#F87171';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: `${color}22`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
      {level}
    </span>
  );
}

// ── signal chain strip ────────────────────────────────────────────────────────
function SignalChainStrip({ patch }: { patch: Patch }) {
  const chain = patch.chain ?? [];
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
      {chain.map((block) => {
        const enabled = patch.blocks[block]?.enabled ?? false;
        return (
          <span
            key={block}
            className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
              enabled
                ? 'bg-[rgba(124,108,255,0.18)] border-[#7C6CFF]/40 text-[#9A8CFF]'
                : 'bg-[rgba(28,32,52,0.4)] border-white/[0.06] text-[#62677E] opacity-40'
            }`}
          >
            {CHAIN_LABELS[block] ?? block}
          </span>
        );
      })}
    </div>
  );
}

// ── tone card (AI response) ───────────────────────────────────────────────────
interface ToneCard {
  id: string;
  toneId: number;
  versionId: number;
  qrString: string;
  patch: Patch;
  meta: ToneMeta;
  userPrompt?: string;
}

interface ToneResponseCardProps {
  card: ToneCard;
  sessionId: number | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSave: () => Promise<void>;
  onSaveVariant: (patch: Patch, qrString: string) => Promise<void>;
  onApplyDelay: (byte: number, modelId: string) => Promise<void>;
}

function ToneResponseCard({
  card,
  sessionId: _sessionId,
  isExpanded,
  onToggleExpand,
  onSave,
  onSaveVariant,
  onApplyDelay,
}: ToneResponseCardProps) {
  const [editingName, setEditingName] = useState(false);
  const [toneName, setToneName] = useState(card.meta.archetype ?? 'Tone');
  const [showVariants, setShowVariants] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showDelay, setShowDelay] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const desc = card.patch?.blocks ? describePatch(card.patch) : null;
  const ruleTrace = card.meta.ruleTrace ?? [];
  const whyText = ruleTrace.slice(0, 3).join('; ').slice(0, 120);

  const variants =
    card.patch?.blocks && card.toneId > 0
      ? (() => {
          try { return generateVariants(card.patch, 3, card.toneId); } catch { return []; }
        })()
      : [];
  const variantLabels = ['Darker', 'Balanced', 'Brighter'];

  return (
    <div className={`${GLASS} p-4 flex flex-col gap-3`}>

      {/* ── top row: QR + name + confidence ── */}
      <div className="flex gap-3 items-start">
        {/* QR */}
        <div className="shrink-0">
          <QrView qrString={card.qrString} size={88} />
        </div>

        {/* Name + confidence + reason */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {editingName ? (
              <input
                ref={nameRef}
                type="text"
                value={toneName}
                onChange={e => setToneName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={e => { if (e.key === 'Enter') setEditingName(false); }}
                className="flex-1 bg-transparent border-b border-[#7C6CFF] text-[#F2F3F8] text-[17px] font-semibold outline-none"
                autoFocus
              />
            ) : (
              <p className="text-[#F2F3F8] font-semibold text-[17px] leading-snug truncate flex-1">{toneName}</p>
            )}
            <button
              type="button"
              onClick={() => { setEditingName(true); setTimeout(() => nameRef.current?.focus(), 0); }}
              className="text-[#62677E] text-sm w-7 h-7 flex items-center justify-center"
              aria-label="Rename tone"
            >✎</button>
          </div>

          <ConfidenceBadge value={card.meta.confidence ?? 0} />

          {ruleTrace[0] && (
            <p className="text-[#9AA0B8] text-[12px] mt-1 leading-snug line-clamp-2">
              {ruleTrace[0].slice(0, 80)}
            </p>
          )}
        </div>
      </div>

      {/* ── Why section ── */}
      {whyText && (
        <div>
          <p className="text-[#62677E] text-[11px] uppercase tracking-wider font-medium mb-1">Why</p>
          <p className="text-[#9AA0B8] text-[13px] leading-snug">{whyText}</p>
        </div>
      )}

      {/* ── Signal chain strip ── */}
      {desc && (
        <div>
          <p className="text-[#62677E] text-[11px] uppercase tracking-wider font-medium mb-1.5">Signal chain</p>
          <SignalChainStrip patch={card.patch} />
        </div>
      )}

      {/* ── Action buttons row 1 ── */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => void onSave()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[rgba(28,32,52,0.62)] border border-white/[0.08] text-[#9AA0B8] text-[13px] font-medium"
          style={{ minHeight: 36 }}
        >
          ♡ <span>Save</span>
        </button>
        <button
          type="button"
          onClick={() => setShowVariants(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[rgba(28,32,52,0.62)] border border-white/[0.08] text-[#9AA0B8] text-[13px] font-medium"
          style={{ minHeight: 36 }}
        >
          ⧉ <span>Variants</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (navigator.share) {
              navigator.share({ text: card.qrString }).catch(() => {/* ignore */});
            } else {
              navigator.clipboard.writeText(card.qrString).catch(() => {/* ignore */});
            }
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[rgba(28,32,52,0.62)] border border-white/[0.08] text-[#9AA0B8] text-[13px] font-medium"
          style={{ minHeight: 36 }}
        >
          ⇪ <span>Share QR</span>
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[rgba(28,32,52,0.62)] border border-white/[0.08] text-[#9AA0B8] text-[13px] font-medium"
          style={{ minHeight: 36 }}
        >
          {isExpanded ? '▲' : '▼'} <span>{isExpanded ? 'Hide' : 'History'}</span>
        </button>
      </div>

      {/* ── Action buttons row 2 ── */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowFeedback(f => !f)}
          className={`${GRADIENT_BTN} flex-1 py-2 text-[14px]`}
          style={{ minHeight: 40 }}
        >
          Give feedback
        </button>
        <button
          type="button"
          onClick={() => setShowDelay(d => !d)}
          className="px-3 py-2 rounded-full bg-[rgba(28,32,52,0.62)] border border-white/[0.08] text-[#9AA0B8] text-[13px] font-medium"
          style={{ minHeight: 40 }}
        >
          ⏱ Delay helper
        </button>
      </div>

      {/* ── Feedback input ── */}
      {showFeedback && (
        <div className="flex gap-2">
          <input
            type="text"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="What would you change?"
            className="flex-1 bg-[rgba(28,32,52,0.62)] border border-white/[0.08] rounded-[12px] px-3 py-2 text-[#F2F3F8] text-[14px] outline-none placeholder:text-[#62677E]"
            autoFocus
          />
          <button
            type="button"
            onClick={() => { setFeedback(''); setShowFeedback(false); }}
            className={`${GRADIENT_BTN} px-4 py-2 text-[14px]`}
          >
            Send
          </button>
        </div>
      )}

      {/* ── Delay helper ── */}
      <DelayHelper
        latestPatch={card.patch}
        onApply={(byte, modelId) => void onApplyDelay(byte, modelId)}
        isOpen={showDelay}
        onClose={() => setShowDelay(false)}
      />

      {/* ── Version history ── */}
      {isExpanded && card.toneId > 0 && (
        <VersionTimeline toneId={card.toneId} onRestore={() => {/* TODO */}} />
      )}

      {/* ── Variants row ── */}
      {showVariants && variants.length > 0 && (
        <div>
          <p className="text-[#62677E] text-[11px] uppercase tracking-wider font-medium mb-2">Variants</p>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {variants.map((variant, i) => {
              let vqr = '';
              try {
                vqr = buildQrString(encodePreset(variant));
              } catch {
                return null;
              }
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => void onSaveVariant(variant, vqr)}
                  className={`shrink-0 ${GLASS} p-3 flex flex-col items-center gap-2`}
                  style={{ minWidth: 120 }}
                >
                  <span className="text-[#9AA0B8] text-[12px] font-semibold">{variantLabels[i] ?? `Variant ${i+1}`}</span>
                  <QrView qrString={vqr} size={88} />
                  <ConfidenceBadge value={(card.meta.confidence ?? 0) * (i === 1 ? 1 : 0.85)} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Acoustic IR banner */}
      {card.meta.archetype?.toLowerCase().includes('acoustic') && (
        <div className="text-[12px] text-amber-300 bg-amber-900/30 border border-amber-700/40 rounded-[12px] px-3 py-2">
          🎙 This tone uses a user IR slot.
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface SessionChatProps {
  sessionId?: number;
  instrumentId?: string;
  onGoToIrLab?: () => void;
}

export function SessionChat({ sessionId: initialSessionId, instrumentId: initialInstrumentId, onGoToIrLab: _onGoToIrLab }: SessionChatProps = {}) {
  const [messages, setMessages] = useState<Array<{ type: 'user'; text: string } | { type: 'tone'; card: ToneCard }>>([]);
  const [input, setInput] = useState('');
  const defaultInstrument = (initialInstrumentId ?? localStorage.getItem('default-instrument') ?? 'electric-single-coil') as InstrumentId;
  const [instrument, setInstrument] = useState<InstrumentId>(defaultInstrument);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(initialSessionId ?? null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [locked, setLocked] = useState<BlockKind[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const toneCards = messages.filter((m): m is { type: 'tone'; card: ToneCard } => m.type === 'tone').map(m => m.card);
  const latestCard = toneCards.length > 0 ? toneCards[toneCards.length - 1]! : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const prompt = input.trim();
    if (!prompt || loading) return;
    setInput('');
    setLoading(true);
    // push user bubble
    setMessages(prev => [...prev, { type: 'user', text: prompt }]);
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
        const card: ToneCard = {
          id: crypto.randomUUID(),
          toneId: tone.id!,
          versionId: version.id!,
          qrString,
          patch,
          meta,
          userPrompt: prompt,
        };
        setMessages(prev => [...prev, { type: 'tone', card }]);
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

  async function handleSaveVariant(patch: Patch, qrString: string) {
    if (!sessionId) return;
    try {
      const meta: ToneMeta = {
        archetype: latestCard?.meta.archetype ?? 'variant',
        ruleTrace: [],
        confidence: 0,
        unknownTerms: [],
      };
      const { tone, version } = await saveTone(sessionId, patch, meta);
      const card: ToneCard = {
        id: crypto.randomUUID(),
        toneId: tone.id!,
        versionId: version.id!,
        qrString,
        patch,
        meta,
      };
      setMessages(prev => [...prev, { type: 'tone', card }]);
    } catch (err) {
      console.error('saveVariant failed', err);
    }
  }

  async function handleSaveTone(card: ToneCard) {
    if (!sessionId) return;
    try {
      await saveTone(sessionId, card.patch, card.meta);
    } catch (err) {
      console.error('saveTone failed', err);
    }
  }

  async function handleApplyDelay(delayByte: number, modelId: string) {
    if (!latestCard || !latestCard.patch?.blocks) return;
    const patch = latestCard.patch;
    const dlyBlock = patch.blocks.dly;
    if (!dlyBlock) return;
    const updatedParams = { ...dlyBlock.params };
    const timeKey = 'time' in updatedParams ? 'time' : 'rate' in updatedParams ? 'rate' : null;
    if (!timeKey) return;
    updatedParams[timeKey] = delayByte;

    const updatedPatch: Patch = {
      ...patch,
      blocks: { ...patch.blocks, dly: { ...dlyBlock, modelId, params: updatedParams } },
    };

    if (!sessionId) return;
    try {
      const { tone, version } = await saveTone(sessionId, updatedPatch, latestCard.meta);
      const preset = encodePreset(updatedPatch);
      const qrString = buildQrString(preset);
      const card: ToneCard = {
        id: crypto.randomUUID(),
        toneId: tone.id!,
        versionId: version.id!,
        qrString,
        patch: updatedPatch,
        meta: latestCard.meta,
      };
      setMessages(prev => [...prev, { type: 'tone', card }]);
    } catch (err) {
      console.error('applyDelay failed', err);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0B0D14]">
      {/* Message area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center flex-1 mt-16 gap-3">
            <span className="text-5xl">🎸</span>
            <p className="text-[#62677E] text-[15px] text-center">Describe your tone below to get started.</p>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.type === 'user') {
            return (
              <div key={i} className="flex justify-end">
                <div
                  className="max-w-[75%] px-4 py-2.5 rounded-[18px] rounded-tr-[6px] text-[15px] text-white leading-snug"
                  style={{ background: 'linear-gradient(135deg, #7C6CFF, #4F8BFF)' }}
                >
                  {msg.text}
                </div>
              </div>
            );
          }
          // tone card
          const { card } = msg;
          return (
            <div key={card.id} className="flex flex-col gap-2">
              <ToneResponseCard
                card={card}
                sessionId={sessionId}
                isExpanded={expandedCardId === card.id}
                onToggleExpand={() => setExpandedCardId(expandedCardId === card.id ? null : card.id)}
                onSave={() => handleSaveTone(card)}
                onSaveVariant={handleSaveVariant}
                onApplyDelay={handleApplyDelay}
              />
            </div>
          );
        })}

        {loading && (
          <div className={`${GLASS} p-4 flex items-center gap-3`}>
            <div className="w-5 h-5 rounded-full border-2 border-[#7C6CFF] border-t-transparent animate-spin shrink-0" />
            <span className="text-[#9AA0B8] text-[14px]">Generating tone…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Collapsible settings panel */}
      {settingsOpen && (
        <div className="border-t border-white/[0.08] bg-[#141826] px-4 py-3 flex flex-col gap-3">
          <LockControls locked={locked} onChange={setLocked} />
          <DelayHelper
            latestPatch={latestCard?.patch ?? null}
            onApply={(byte, modelId) => void handleApplyDelay(byte, modelId)}
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
          />
        </div>
      )}

      {/* Instrument chips + settings toggle */}
      <div className="flex gap-2 px-3 py-2 overflow-x-auto border-t border-white/[0.08] bg-[#141826] items-center no-scrollbar">
        {/* ⚙ icon button */}
        <button
          type="button"
          onClick={() => setSettingsOpen(o => !o)}
          className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-full border transition-all text-[16px] ${
            settingsOpen
              ? `bg-gradient-to-br from-[#7C6CFF] to-[#4F8BFF] border-transparent text-white ${ACCENT_GLOW}`
              : 'bg-[rgba(28,32,52,0.62)] border-white/[0.08] text-[#62677E]'
          }`}
          aria-label="Toggle settings"
        >
          ⚙
        </button>

        {INSTRUMENTS.map(inst => (
          <button
            key={inst.id}
            type="button"
            onClick={() => setInstrument(inst.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all border ${
              instrument === inst.id
                ? `bg-gradient-to-br from-[#7C6CFF] to-[#4F8BFF] border-transparent text-white ${ACCENT_GLOW}`
                : 'bg-[rgba(28,32,52,0.62)] border-white/[0.08] text-[#9AA0B8]'
            }`}
            style={{ minHeight: 36 }}
          >
            {inst.label}
          </button>
        ))}
      </div>

      {/* Composer bar */}
      <div className="border-t border-white/[0.08] bg-[#141826] p-3 flex items-end gap-2">
        <textarea
          rows={1}
          placeholder="Describe a tone… (hold 🎙 to dictate)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-[rgba(28,32,52,0.62)] border border-white/[0.08] text-[#F2F3F8] rounded-[12px] px-4 py-3 text-[15px] outline-none placeholder:text-[#62677E] resize-none"
          disabled={loading}
          style={{ minHeight: 44, maxHeight: 120 }}
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={loading || !input.trim()}
          className={`${GRADIENT_BTN} px-4 py-3 text-[15px] disabled:opacity-40`}
          style={{ minHeight: 44 }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
