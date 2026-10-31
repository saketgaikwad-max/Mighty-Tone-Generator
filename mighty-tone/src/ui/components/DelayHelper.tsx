import { useState } from 'react';
import type { Patch } from '../../contracts/patch.ts';
import { bpmToDelayByte, tempoDelayModels, type DelayDivision } from '../../engine/delay.ts';

const DIVISIONS: Array<{ value: DelayDivision; label: string }> = [
  { value: '1/4', label: '1/4' },
  { value: '1/8', label: '1/8' },
  { value: '1/16', label: '1/16' },
  { value: 'dotted-1/8', label: 'Dot 1/8' },
  { value: 'triplet-1/4', label: 'Trip 1/4' },
];

interface DelayHelperProps {
  latestPatch: Patch | null;
  onApply: (delayByte: number, modelId: string) => void;
}

export function DelayHelper({ latestPatch, onApply }: DelayHelperProps) {
  const [open, setOpen] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [division, setDivision] = useState<DelayDivision>('1/4');

  const delayModels = tempoDelayModels();
  const currentDlyModelId = latestPatch?.blocks.dly?.modelId;
  const defaultModel = delayModels.find((m) => m.id === currentDlyModelId)?.id ?? delayModels[0]?.id ?? '';
  const [modelId, setModelId] = useState(defaultModel);

  let result: { byte: number; ms: number } | null = null;
  let errorMsg = '';
  if (modelId) {
    try {
      result = bpmToDelayByte(bpm, division, modelId);
    } catch (e) {
      errorMsg = String(e);
    }
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-950">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200"
        onClick={() => setOpen((o) => !o)}
      >
        <span>⏱ Delay BPM Helper</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 flex flex-col gap-2">
          <div className="flex gap-2 items-center flex-wrap">
            <label className="text-xs text-zinc-400">BPM</label>
            <input
              type="number"
              min={20}
              max={300}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-16 bg-zinc-800 text-white rounded px-2 py-1 text-xs outline-none"
            />
            <label className="text-xs text-zinc-400">Division</label>
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value as DelayDivision)}
              className="bg-zinc-800 text-white rounded px-2 py-1 text-xs outline-none"
            >
              {DIVISIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <label className="text-xs text-zinc-400">Model</label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="bg-zinc-800 text-white rounded px-2 py-1 text-xs outline-none"
            >
              {delayModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          {errorMsg && <p className="text-red-400 text-xs">{errorMsg}</p>}
          {result && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-300">
                Byte: <span className="text-white font-bold">{result.byte}</span>
              </span>
              <span className="text-xs text-zinc-300">
                Time: <span className="text-white font-bold">{result.ms.toFixed(1)} ms</span>
              </span>
              <button
                type="button"
                onClick={() => onApply(result!.byte, modelId)}
                disabled={!latestPatch}
                className="ml-auto bg-blue-600 text-white rounded px-3 py-1 text-xs font-medium disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
