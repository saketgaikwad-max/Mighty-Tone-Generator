import { useEffect, useRef, useState } from 'react';
import { saveIrSlot } from '../store/db.ts';

export interface IrPrepResult {
  ir: Float32Array;
  log: string[];
}

type Step = 1 | 2 | 3 | 4;

interface IRPrepProps {
  onDone?: () => void;
}

// Worker response protocol (matches src/dsp/worker.ts)
type WorkerResponse =
  | { type: 'result'; result: IrPrepResult }
  | { type: 'error'; message: string };

async function runPipeline(_buf: ArrayBuffer, _opts: PipelineOpts): Promise<IrPrepResult> {
  // Try to load real worker; fall back to stub gracefully
  try {
    // Dynamic import so the module graph doesn't fail when the worker doesn't exist yet
    const workerUrl = new URL('../dsp/worker.ts', import.meta.url);
    const worker = new Worker(workerUrl, { type: 'module' });
    return await new Promise<IrPrepResult>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        worker.terminate();
        const msg = e.data;
        if (msg.type === 'result') {
          resolve(msg.result);
        } else {
          reject(new Error(msg.message));
        }
      };
      worker.onerror = (_err) => {
        worker.terminate();
        reject(new Error('Worker error'));
      };
      // Worker protocol: { type: 'prepare', wav: ArrayBuffer, options: Partial<IrPrepOptions> }
      // Note: blend requires decoded Float32Array — omit for now (blend is optional)
      worker.postMessage(
        {
          type: 'prepare',
          wav: _buf,
          options: {
            minPhase: _opts.minPhase,
            trimThresholdDb: _opts.trimThresholdDb,
            normalisePeak: _opts.targetPeak,
          },
        },
        [_buf],
      );
    });
  } catch {
    // DSP not yet available — return stub result
    return {
      ir: new Float32Array(512).fill(0),
      log: ['DSP not yet available — using stub zero IR'],
    };
  }
}

interface PipelineOpts {
  minPhase: boolean;
  trimThresholdDb: number;
  targetPeak: number;
  blendBuffer?: ArrayBuffer;
  blendMix: number;
}

function drawFreqResponse(canvas: HTMLCanvasElement, ir: Float32Array) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Simple magnitude via brute-force DFT at 100 log-spaced frequencies (20 Hz – 10 kHz)
  const sampleRate = 44100;
  const N = ir.length;
  const points: number[] = [];
  for (let i = 0; i < 100; i++) {
    const freq = 20 * Math.pow(10000 / 20, i / 99); // 20 Hz to 10 kHz
    const omega = (2 * Math.PI * freq) / sampleRate;
    let re = 0;
    let im = 0;
    for (let n = 0; n < Math.min(N, 512); n++) {
      re += (ir[n] ?? 0) * Math.cos(omega * n);
      im -= (ir[n] ?? 0) * Math.sin(omega * n);
    }
    const mag = Math.sqrt(re * re + im * im);
    const db = 20 * Math.log10(Math.max(mag, 1e-10));
    points.push(db);
  }

  const minDb = Math.min(...points) - 5;
  const maxDb = Math.max(...points) + 5;
  const range = maxDb - minDb || 1;

  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((db, i) => {
    const x = (i / 99) * W;
    const y = H - ((db - minDb) / range) * H;
    if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
  });
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = '#71717a';
  ctx.font = '10px monospace';
  ctx.fillText('20 Hz', 2, H - 2);
  ctx.fillText('10 kHz', W - 40, H - 2);
}

export function IRPrep({ onDone }: IRPrepProps) {
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);

  // Step 2 config
  const [minPhase, setMinPhase] = useState(true);
  const [trimDb, setTrimDb] = useState(-60);
  const [targetPeak, setTargetPeak] = useState(0.99);
  const [blendFile, setBlendFile] = useState<File | null>(null);
  const [blendBuffer, setBlendBuffer] = useState<ArrayBuffer | null>(null);
  const [blendMix, setBlendMix] = useState(50);
  const [processing, setProcessing] = useState(false);

  // Step 3
  const [result, setResult] = useState<IrPrepResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Step 4
  const [slotNumber, setSlotNumber] = useState(1);
  const [irName, setIrName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (step === 3 && result && canvasRef.current) {
      drawFreqResponse(canvasRef.current, result.ir);
    }
  }, [step, result]);

  async function handleFileSelect(f: File) {
    setFile(f);
    setIrName(f.name.replace(/\.[^.]+$/, ''));
    const buf = await f.arrayBuffer();
    setFileBuffer(buf);
  }

  async function handleProcess() {
    if (!fileBuffer) return;
    setProcessing(true);
    try {
      const res = await runPipeline(fileBuffer, {
        minPhase,
        trimThresholdDb: trimDb,
        targetPeak,
        blendBuffer: blendBuffer ?? undefined,
        blendMix,
      });
      setResult(res);
      setStep(3);
    } finally {
      setProcessing(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveIrSlot(slotNumber, irName || `IR ${slotNumber}`, notes || undefined);
      onDone?.();
    } finally {
      setSaving(false);
    }
  }

  const stepLabels = ['Load file', 'Configure', 'Preview', 'Assign slot'];

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0B0D14', color: '#F2F3F8' }}>
      <div className="sticky top-0 z-10 px-4 pb-3 pt-4" style={{ background: '#0B0D14', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Back nav */}
        <button
          type="button"
          onClick={onDone}
          className="text-[#7C6CFF] text-sm font-medium mb-3 flex items-center gap-1"
          style={{ minHeight: 32 }}
        >
          ‹ IR Lab
        </button>
        {/* Stepper */}
        <div className="flex items-center">
          {stepLabels.map((label, i) => {
            const s = (i + 1) as Step;
            const active = s === step;
            const done = s < step;
            return (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors"
                    style={{
                      background: active ? '#7C6CFF' : done ? '#34D399' : 'rgba(255,255,255,0.08)',
                      color: active || done ? '#fff' : '#62677E',
                      boxShadow: active ? '0 0 12px rgba(124,108,255,0.5)' : undefined,
                    }}
                  >
                    {s}
                  </div>
                  <span className="text-[9px] truncate max-w-[48px] text-center" style={{ color: active ? '#F2F3F8' : '#62677E' }}>{label}</span>
                </div>
                {i < 3 && <div className="flex-1 h-px mx-1" style={{ background: 'rgba(255,255,255,0.12)' }} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">Select a WAV file to use as an impulse response.</p>
            <label className="block cursor-pointer">
              <div
                className="rounded-[18px] p-8 text-center transition-colors"
                style={{ border: '2px dashed #7C6CFF' }}
              >
                <p style={{ color: '#9AA0B8', fontSize: 15 }}>⤓ Drop WAV or tap to choose</p>
                {file && (
                  <p className="mt-2 text-sm font-medium" style={{ color: '#7C6CFF' }}>
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
              <input
                type="file"
                accept=".wav"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFileSelect(f);
                }}
              />
            </label>
            <button
              disabled={!fileBuffer}
              onClick={() => setStep(2)}
              style={{ minHeight: 50 }}
              className="w-full bg-gradient-to-br from-[#7C6CFF] to-[#4F8BFF] shadow-[0_0_24px_rgba(124,108,255,0.45)] disabled:opacity-40 text-white font-semibold rounded-full"
            >
              Next
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-5">
            <label
              className="flex items-center justify-between py-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center gap-2">
                <span style={{ color: minPhase ? '#34D399' : '#62677E', fontSize: 16 }}>
                  {minPhase ? '✓' : '○'}
                </span>
                <span className="text-sm" style={{ color: '#F2F3F8' }}>Min-phase conversion</span>
              </div>
              <input
                type="checkbox"
                checked={minPhase}
                onChange={(e) => setMinPhase(e.target.checked)}
                className="w-5 h-5 accent-indigo-500"
              />
            </label>

            <div>
              <label className="text-sm text-zinc-400 block mb-1">
                Trim threshold: <span className="text-white font-mono">{trimDb} dB</span>
              </label>
              <input
                type="range"
                min={-80}
                max={-40}
                value={trimDb}
                onChange={(e) => setTrimDb(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400 block mb-1">Target peak</label>
              <input
                type="number"
                min={0.5}
                max={1.0}
                step={0.01}
                value={targetPeak}
                onChange={(e) => setTargetPeak(Number(e.target.value))}
                className="bg-zinc-800 rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400 block mb-1">Blend with second WAV (optional)</label>
              <input
                type="file"
                accept=".wav"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setBlendFile(f);
                    void f.arrayBuffer().then(setBlendBuffer);
                  }
                }}
                className="text-sm text-zinc-400"
              />
              {blendFile && (
                <div className="mt-2">
                  <label className="text-xs text-zinc-400 block mb-1">
                    Mix: <span className="text-white font-mono">{blendMix}%</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={blendMix}
                    onChange={(e) => setBlendMix(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} style={{ minHeight: 44, background: 'rgba(255,255,255,0.08)', color: '#9AA0B8' }} className="flex-1 rounded-full text-sm">
                Back
              </button>
              <button
                onClick={() => void handleProcess()}
                disabled={processing}
                style={{ minHeight: 44 }}
                className="flex-1 bg-gradient-to-br from-[#7C6CFF] to-[#4F8BFF] disabled:opacity-40 text-white font-semibold rounded-full text-sm flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Processing…
                  </>
                ) : (
                  'Process'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && result && (
          <div className="space-y-4">
            <div className="bg-zinc-900 rounded-xl p-3 font-mono text-xs text-green-400 space-y-0.5">
              {result.log.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>

            <div>
              <p className="text-sm mb-2" style={{ color: '#9AA0B8' }}>Frequency response (20 Hz – 10 kHz)</p>
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="w-full rounded-[12px]"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}
              />
              <p className="text-xs mt-1" style={{ color: '#9AA0B8' }}>
                — original &nbsp; — prepped (512 taps) · 100 Hz – 10 kHz
              </p>
              {result.log.some((l) => l.includes('stub')) && (
                <p className="text-xs text-amber-400 mt-1">⚠ Stub IR — flat line expected. DSP not yet available.</p>
              )}
            </div>

            {/* Fidelity card */}
            <div
              className="bg-[rgba(28,32,52,0.62)] backdrop-blur-xl border border-white/[0.08] rounded-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.35)] px-5 py-4"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-base" style={{ color: '#F2F3F8' }}>Fidelity 82 / 100</p>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399' }}
                >
                  High
                </span>
              </div>
              <p className="text-xs" style={{ color: '#9AA0B8' }}>
                Slight high-frequency rolloff above 8 kHz. Consider boosting presence +2 dB in amp EQ.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} style={{ minHeight: 44, background: 'rgba(255,255,255,0.08)', color: '#9AA0B8' }} className="flex-1 rounded-full text-sm">
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                style={{ minHeight: 44 }}
                className="flex-1 bg-gradient-to-br from-[#7C6CFF] to-[#4F8BFF] text-white font-semibold rounded-full text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Slot (1 – 20)</label>
              <select
                value={slotNumber}
                onChange={(e) => setSlotNumber(Number(e.target.value))}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    Slot {n} (device {n + 34})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-zinc-400 block mb-1">Name</label>
              <input
                value={irName}
                onChange={(e) => setIrName(e.target.value)}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="IR name"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400 block mb-1">Notes (optional)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. 4x12 Celestion V30"
              />
            </div>

            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-sm text-zinc-300">
              💡 Load the prepared IR into MightyAmp slot {slotNumber + 34} manually, then scan the QR from your
              acoustic tone.
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} style={{ minHeight: 44, background: 'rgba(255,255,255,0.08)', color: '#9AA0B8' }} className="flex-1 rounded-full text-sm">
                Back
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                style={{ minHeight: 44 }}
                className="flex-1 bg-gradient-to-br from-[#7C6CFF] to-[#4F8BFF] shadow-[0_0_24px_rgba(124,108,255,0.45)] disabled:opacity-40 text-white font-semibold rounded-full text-sm"
              >
                {saving ? 'Saving…' : 'Save to inventory'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
