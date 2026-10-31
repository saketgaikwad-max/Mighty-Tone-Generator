import { useRef, useState } from 'react';
import { describePatch } from '../codec/describe.ts';
import { decodePreset } from '../codec/preset.ts';
import { parseQrString } from '../codec/qr-string.ts';
import { decodeQrImage, type RgbaImage } from '../qr/decode-image.ts';
import { db } from '../store/db.ts';
import { exportBackup, importBackup } from '../services/backup.ts';

const INSTRUMENTS = [
  { id: 'electric-single-coil', label: 'Single Coil' },
  { id: 'electric-humbucker', label: 'Humbucker' },
  { id: 'electric-p90', label: 'P90' },
  { id: 'acoustic-piezo', label: 'Acoustic Piezo' },
  { id: 'acoustic-magnetic', label: 'Acoustic Mag' },
  { id: 'mandolin-magnetic', label: 'Mandolin Mag' },
  { id: 'mandolin-acoustic', label: 'Mandolin Acoustic' },
] as const;

interface DecodedInfo {
  ampName: string;
  knobs: Record<string, string>;
  error?: string;
}

export function Profile() {
  const inputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [decoded, setDecoded] = useState<DecodedInfo | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Settings state
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini-key') ?? '');
  const [geminiKeyVisible, setGeminiKeyVisible] = useState(false);
  const [defaultInstrument, setDefaultInstrument] = useState(
    localStorage.getItem('default-instrument') ?? 'electric-single-coil',
  );
  const [importMsg, setImportMsg] = useState<string | null>(null);

  async function handleFile(file: File) {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    const img: RgbaImage = {
      data: imageData.data,
      width: bitmap.width,
      height: bitmap.height,
    };
    const qrResult = decodeQrImage(img);
    if (!qrResult) {
      setDecoded({ ampName: '', knobs: {}, error: 'No QR code found in image.' });
      setShowModal(true);
      return;
    }
    const parsed = parseQrString(qrResult.text);
    if (!parsed.ok) {
      setDecoded({ ampName: '', knobs: {}, error: `QR parse error: ${parsed.error} — ${parsed.detail}` });
      setShowModal(true);
      return;
    }
    try {
      const patch = decodePreset(parsed.preset, parsed.header);
      const desc = describePatch(patch);
      const amp = desc.blocks.amp;
      setDecoded({
        ampName: amp?.model ?? '—',
        knobs: amp?.params ?? {},
      });
    } catch (err) {
      setDecoded({ ampName: '', knobs: {}, error: String(err) });
    }
    setShowModal(true);
  }

  function handleSaveGeminiKey() {
    localStorage.setItem('gemini-key', geminiKey);
  }

  function handleDefaultInstrumentChange(val: string) {
    setDefaultInstrument(val);
    localStorage.setItem('default-instrument', val);
  }

  async function handleClearData() {
    const confirmed = window.confirm('Delete ALL sessions, tones, and versions? This cannot be undone.');
    if (!confirmed) return;
    await db.delete();
    await db.open();
  }

  async function handleExport() {
    try {
      await exportBackup();
    } catch (err) {
      alert(`Export failed: ${String(err)}`);
    }
  }

  async function handleImport(file: File) {
    try {
      const result = await importBackup(file);
      setImportMsg(`Imported ${result.imported} rows, skipped ${result.skipped} duplicates.`);
    } catch (err) {
      setImportMsg(`Import failed: ${String(err)}`);
    }
  }

  return (
    <div className="flex flex-col h-full bg-black p-4 gap-6 overflow-y-auto">
      <h1 className="text-white text-xl font-semibold">Profile</h1>

      {/* QR Import */}
      <section className="flex flex-col gap-2">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">QR Import</h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="bg-zinc-800 text-white rounded-2xl px-5 py-3 text-sm font-medium w-fit"
        >
          Import QR image
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
      </section>

      {/* Gemini API Key */}
      <section className="flex flex-col gap-2">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">AI Settings</h2>
        <label className="text-zinc-300 text-sm">
          Gemini API key (optional — for AI tone suggestions)
        </label>
        <div className="flex gap-2">
          <input
            type={geminiKeyVisible ? 'text' : 'password'}
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIza…"
            className="flex-1 bg-zinc-800 text-white rounded-xl px-4 py-2 text-sm outline-none placeholder:text-zinc-600"
          />
          <button
            type="button"
            onClick={() => setGeminiKeyVisible((v) => !v)}
            className="bg-zinc-700 text-zinc-300 rounded-xl px-3 py-2 text-xs"
          >
            {geminiKeyVisible ? 'Hide' : 'Show'}
          </button>
          <button
            type="button"
            onClick={handleSaveGeminiKey}
            className="bg-blue-600 text-white rounded-xl px-3 py-2 text-xs font-medium"
          >
            Save
          </button>
        </div>
      </section>

      {/* Default Instrument */}
      <section className="flex flex-col gap-2">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Default Instrument</h2>
        <select
          value={defaultInstrument}
          onChange={(e) => handleDefaultInstrumentChange(e.target.value)}
          className="bg-zinc-800 text-white rounded-xl px-4 py-2 text-sm outline-none"
        >
          {INSTRUMENTS.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {inst.label}
            </option>
          ))}
        </select>
      </section>

      {/* Backup & Restore */}
      <section className="flex flex-col gap-2">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Backup & Restore</h2>
        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => void handleExport()}
            className="bg-zinc-800 text-white rounded-2xl px-5 py-3 text-sm font-medium"
          >
            Export backup
          </button>
          <button
            type="button"
            onClick={() => backupInputRef.current?.click()}
            className="bg-zinc-800 text-white rounded-2xl px-5 py-3 text-sm font-medium"
          >
            Import backup
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
              e.target.value = '';
            }}
          />
        </div>
        {importMsg && (
          <p className="text-zinc-400 text-xs mt-1">{importMsg}</p>
        )}
      </section>

      {/* Danger zone */}
      <section className="flex flex-col gap-2">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Danger Zone</h2>
        <button
          type="button"
          onClick={() => void handleClearData()}
          className="bg-red-900 text-red-300 rounded-2xl px-5 py-3 text-sm font-medium w-fit"
        >
          Clear all data
        </button>
      </section>

      {/* QR decode modal */}
      {showModal && decoded && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-zinc-900 rounded-t-3xl p-6 w-full max-w-md pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white text-lg font-semibold">Decoded Patch</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-zinc-500 text-sm"
              >
                Close
              </button>
            </div>
            {decoded.error ? (
              <p className="text-red-400 text-sm">{decoded.error}</p>
            ) : (
              <>
                <p className="text-white text-base font-medium mb-3">{decoded.ampName}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {Object.entries(decoded.knobs).map(([k, v]) => (
                    <span key={k} className="text-zinc-400 text-sm">
                      {k}: <span className="text-zinc-200">{v}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
