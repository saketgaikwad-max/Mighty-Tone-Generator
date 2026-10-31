import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Patch } from '../../contracts/patch.ts';
import { bpmToDelayByte, tempoDelayModels, type DelayDivision } from '../../engine/delay.ts';

const DIVISIONS: Array<{ value: DelayDivision; label: string }> = [
  { value: '1/4', label: '1/4' },
  { value: 'dotted-1/8', label: 'Dot 1/8' },
  { value: '1/8', label: '1/8' },
  { value: 'triplet-1/4', label: 'Trip' },
];

const TYPE_LABELS = ['Analog', 'Digital', 'Tape', 'Mod', 'Pan', 'Phi'];

interface DelayHelperProps {
  latestPatch: Patch | null;
  onApply: (delayByte: number, modelId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function DelayHelper({ latestPatch, onApply, isOpen, onClose }: DelayHelperProps) {
  const [bpm, setBpm] = useState(120);
  const [division, setDivision] = useState<DelayDivision>('1/4');

  const delayModels = tempoDelayModels();
  const currentDlyModelId = latestPatch?.blocks.dly?.modelId;
  const defaultModel = delayModels.find((m) => m.id === currentDlyModelId)?.id ?? delayModels[0]?.id ?? '';
  const [modelId, setModelId] = useState(defaultModel);
  const [typeIndex, setTypeIndex] = useState(0);

  // Tap tempo
  const tapTimestamps = useRef<number[]>([]);
  function handleTap() {
    const now = Date.now();
    tapTimestamps.current = [...tapTimestamps.current, now].slice(-5);
    if (tapTimestamps.current.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < tapTimestamps.current.length; i++) {
        intervals.push(tapTimestamps.current[i]! - tapTimestamps.current[i - 1]!);
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const computed = Math.round(60000 / avg);
      if (computed >= 20 && computed <= 300) setBpm(computed);
    }
  }

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  let result: { byte: number; ms: number } | null = null;
  let errorMsg = '';
  if (modelId) {
    try {
      result = bpmToDelayByte(bpm, division, modelId);
    } catch (e) {
      errorMsg = String(e);
    }
  }

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#171b2c] rounded-t-[26px] border-t border-white/[0.08] shadow-[0_-8px_40px_rgba(0,0,0,0.5)]"
        style={{ height: '50vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2 shrink-0">
          <div className="w-8" />
          <p className="text-[#F2F3F8] text-base font-semibold">Delay helper</p>
          <button
            type="button"
            onClick={onClose}
            style={{ minWidth: 32, minHeight: 32 }}
            className="text-[#9AA0B8] text-lg flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col gap-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Type segmented */}
          <div>
            <p className="text-[#62677E] text-xs uppercase tracking-widest mb-2">Type</p>
            <div className="flex gap-1 bg-white/5 rounded-[12px] p-1">
              {TYPE_LABELS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setTypeIndex(i);
                    if (delayModels[i]) setModelId(delayModels[i]!.id);
                  }}
                  style={{ minHeight: 32 }}
                  className={[
                    'flex-1 text-xs font-medium rounded-[8px] transition-all',
                    typeIndex === i
                      ? 'bg-gradient-to-br from-[#7C6CFF] to-[#4F8BFF] text-white shadow-[0_0_12px_rgba(124,108,255,0.35)]'
                      : 'text-[#9AA0B8]',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tempo row */}
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-baseline gap-2">
              <input
                type="number"
                min={20}
                max={300}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="w-24 bg-white/5 text-[#F2F3F8] rounded-[12px] px-3 py-2 outline-none text-center border border-white/10"
                style={{ fontSize: 28, fontVariantNumeric: 'tabular-nums' }}
              />
              <span className="text-[#9AA0B8] text-sm font-medium">BPM</span>
            </div>
            <button
              type="button"
              onClick={handleTap}
              style={{ minHeight: 44, minWidth: 80 }}
              className="bg-white/10 hover:bg-white/20 active:bg-[#7C6CFF]/40 border border-white/10 text-[#F2F3F8] text-sm font-semibold rounded-[12px] px-4 transition-colors"
            >
              Tap ●
            </button>
          </div>

          {/* Division segmented */}
          <div>
            <p className="text-[#62677E] text-xs uppercase tracking-widest mb-2">Division</p>
            <div className="flex gap-1 bg-white/5 rounded-[12px] p-1">
              {DIVISIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDivision(d.value)}
                  style={{ minHeight: 32 }}
                  className={[
                    'flex-1 text-xs font-medium rounded-[8px] transition-all',
                    division === d.value
                      ? 'bg-gradient-to-br from-[#7C6CFF] to-[#4F8BFF] text-white'
                      : 'text-[#9AA0B8]',
                  ].join(' ')}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {errorMsg && <p className="text-red-400 text-xs">{errorMsg}</p>}

          {/* Result card */}
          {result && (
            <div className="bg-[rgba(28,32,52,0.62)] backdrop-blur-xl border border-white/[0.08] rounded-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.35)] px-5 py-4 flex flex-col gap-1">
              <p className="text-[#F2F3F8] font-semibold tabular-nums" style={{ fontSize: 32 }}>
                {result.ms.toFixed(1)} <span className="text-lg font-normal text-[#9AA0B8]">ms</span>
              </p>
              <p className="text-[#9AA0B8] text-xs">
                Nearest device value {result.ms.toFixed(1)} ms (byte {result.byte})
              </p>
            </div>
          )}

          {/* Apply button */}
          <button
            type="button"
            onClick={() => result && onApply(result.byte, modelId)}
            disabled={!latestPatch || !result}
            style={{ minHeight: 50 }}
            className="w-full bg-gradient-to-br from-[#7C6CFF] to-[#4F8BFF] shadow-[0_0_24px_rgba(124,108,255,0.45)] text-white font-semibold rounded-full text-base disabled:opacity-40 transition-opacity"
          >
            Apply to current tone
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
