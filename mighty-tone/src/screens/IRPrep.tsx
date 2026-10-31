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

// Stub DSP — replaced by real pipeline once S5-DSP delivers src/dsp/pipeline.ts
async function runPipeline(_buf: ArrayBuffer, _opts: PipelineOpts): Promise<IrPrepResult> {
  // Try to load real worker; fall back to stub gracefully
  try {
    // Dynamic import so the module graph doesn't fail when the worker doesn't exist yet
    const workerUrl = new URL('../dsp/worker.ts', import.meta.url);
    const worker = new Worker(workerUrl, { type: 'module' });
    return await new Promise<IrPrepResult>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<IrPrepResult>) => {
        worker.terminate();
        resolve(e.data);
      };
      worker.onerror = (_err) => {
        worker.terminate();
        reject(new Error('Worker error'));
      };
      worker.postMessage({ buffer: _buf, opts: _opts });
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
    <div className="flex flex-col h-full bg-zinc-950 text-white overflow-y-auto">
      <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-4 py-3 z-10">
        <h1 className="text-lg font-bold mb-3">IR Prep</h1>
        {/* Stepper */}
        <div className="flex items-center gap-1">
          {stepLabels.map((label, i) => {
            const s = (i + 1) as Step;
            const active = s === step;
            const done = s < step;
            return (
              <div key={s} className="flex items-center gap-1 flex-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    active
                      ? 'bg-indigo-600 text-white'
                      : done
                        ? 'bg-green-600 text-white'
                        : 'bg-zinc-700 text-zinc-400'
                  }`}
                >
                  {s}
                </div>
                <span className={`text-xs truncate ${active ? 'text-white' : 'text-zinc-500'}`}>{label}</span>
                {i < 3 && <div className="flex-1 h-px bg-zinc-700 mx-1" />}
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
              <div className="border-2 border-dashed border-zinc-700 hover:border-indigo-500 rounded-xl p-8 text-center transition-colors">
                <p className="text-zinc-400 text-sm">Click to select a .wav file</p>
                {file && (
                  <p className="mt-2 text-indigo-400 text-sm font-medium">
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
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl"
            >
              Next
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-5">
            <label className="flex items-center justify-between">
              <span className="text-sm">Min-phase conversion</span>
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
              <button onClick={() => setStep(1)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-xl text-sm">
                Back
              </button>
              <button
                onClick={() => void handleProcess()}
                disabled={processing}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
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
              <p className="text-sm text-zinc-400 mb-2">Frequency response (20 Hz – 10 kHz)</p>
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="w-full rounded-xl border border-zinc-800"
              />
              {result.log.some((l) => l.includes('stub')) && (
                <p className="text-xs text-amber-400 mt-1">⚠ Stub IR — flat line expected. DSP not yet available.</p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-xl text-sm">
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl text-sm"
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
              <button onClick={() => setStep(3)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-xl text-sm">
                Back
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm"
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
