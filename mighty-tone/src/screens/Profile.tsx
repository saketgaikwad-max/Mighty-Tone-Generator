import { useEffect, useRef, useState } from 'react';
import { describePatch } from '../codec/describe.ts';
import { decodePreset } from '../codec/preset.ts';
import { parseQrString } from '../codec/qr-string.ts';
import { decodeQrImage, type RgbaImage } from '../qr/decode-image.ts';
import { db, createSession, saveTone, listIrSlots } from '../store/db.ts';
import { exportBackup, importBackup } from '../services/backup.ts';
import { solve } from '../engine/solve.ts';
import { buildHandoffPrompt, parseHandoffResponse } from '../llm/handoff.ts';
import type { ToneMeta } from '../engine/index.ts';

const DEFAULT_INSTRUMENTS = [
  'Greg Bennett Avion AV-6',
  'HB Jumbo King',
  'Epiphone EJ-200CE',
  'HB F-style mandolin',
];

function instrumentEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('mandolin')) return '🪕';
  return '🎸';
}

interface DecodedInfo {
  ampName: string;
  knobs: Record<string, string>;
  error?: string;
}

// ─── Glass section card ───────────────────────────────────────────────────────
function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0">
      {title && (
        <p
          className="text-xs font-semibold uppercase tracking-wider px-1 pb-1"
          style={{ color: '#62677E', letterSpacing: '0.04em' }}
        >
          {title}
        </p>
      )}
      <div
        style={{
          background: 'rgba(28,32,52,0.62)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 18,
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({
  children,
  last,
}: {
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-center px-4 gap-3"
      style={{
        minHeight: 52,
        borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {children}
    </div>
  );
}

function Chevron() {
  return <span style={{ color: '#62677E', fontSize: 18, lineHeight: 1 }}>›</span>;
}

export function Profile() {
  const inputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [decoded, setDecoded] = useState<DecodedInfo | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Settings state
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini-key') ?? '');
  const [geminiKeyVisible, setGeminiKeyVisible] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [handoffPrompt, setHandoffPrompt] = useState('');
  const [handoffInstrument, setHandoffInstrument] = useState('');
  const [handoffGeneratedPrompt, setHandoffGeneratedPrompt] = useState('');
  const [handoffPasted, setHandoffPasted] = useState('');
  const [handoffMsg, setHandoffMsg] = useState<string | null>(null);

  // Instruments section
  const [instruments, setInstruments] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('profile-instruments');
      if (raw) return JSON.parse(raw) as string[];
    } catch { /* ignore */ }
    return DEFAULT_INSTRUMENTS;
  });
  const [addingInstrument, setAddingInstrument] = useState(false);
  const [newInstrumentName, setNewInstrumentName] = useState('');

  // Gemini key saved confirmation
  const [geminiSaved, setGeminiSaved] = useState(false);

  // Instrument detail + edit sheet
  const [detailInstrument, setDetailInstrument] = useState<string | null>(null);
  const [editingInstrumentName, setEditingInstrumentName] = useState('');
  const [isEditingInstrument, setIsEditingInstrument] = useState(false);

  // IR slots count
  const [irSlotCount, setIrSlotCount] = useState(0);

  useEffect(() => {
    void listIrSlots().then((slots) => setIrSlotCount(slots.length));
  }, []);

  function saveInstruments(list: string[]) {
    setInstruments(list);
    localStorage.setItem('profile-instruments', JSON.stringify(list));
  }

  function removeInstrument(idx: number) {
    const updated = instruments.filter((_, i) => i !== idx);
    saveInstruments(updated);
  }

  function addInstrument() {
    const name = newInstrumentName.trim();
    if (!name) return;
    saveInstruments([...instruments, name]);
    setNewInstrumentName('');
    setAddingInstrument(false);
  }

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
    setGeminiSaved(true);
    setTimeout(() => setGeminiSaved(false), 2500);
  }

  async function handleClearData() {
    const confirmed = window.confirm('Delete ALL sessions, tones, and versions? This cannot be undone.');
    if (!confirmed) return;
    await db.delete();
    await db.open();
  }

  async function exportBackupAction() {
    try {
      await exportBackup();
    } catch (err) {
      alert(`Export failed: ${String(err)}`);
    }
  }

  function handleBuildHandoffPrompt() {
    const p = buildHandoffPrompt(handoffPrompt, handoffInstrument || undefined);
    setHandoffGeneratedPrompt(p);
  }

  async function handleHandoffPaste() {
    const intent = parseHandoffResponse(handoffPasted);
    if (!intent) {
      setHandoffMsg('Could not parse response. Make sure it is valid JSON with archetype, descriptors, deltas.');
      return;
    }
    try {
      const { patch, ruleTrace, archetype, confidence } = solve(intent);
      const meta: ToneMeta = { archetype, ruleTrace, confidence, unknownTerms: intent.unknownTerms };
      const session = await createSession(`Handoff: ${archetype}`);
      await saveTone(session.id!, patch, meta);
      setHandoffMsg(`Saved tone: ${archetype} (confidence ${Math.round(confidence * 100)}%)`);
      setHandoffPasted('');
    } catch (err) {
      setHandoffMsg(`Error saving tone: ${String(err)}`);
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
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: '#0B0D14' }}
    >
      <div className="px-4 pt-6 pb-4 shrink-0">
        <h1 className="text-[#F2F3F8] font-bold" style={{ fontSize: 34, lineHeight: '41px' }}>
          Profile
        </h1>
      </div>

      <div className="flex flex-col gap-5 px-4 pb-8">

        {/* ── Instruments ── */}
        <Section title="Instruments">
          {instruments.map((inst, idx) => (
            <Row key={inst + String(idx)} last={idx === instruments.length - 1 && !addingInstrument}>
              <span className="text-lg">{instrumentEmoji(inst)}</span>
              <button
                type="button"
                className="flex-1 flex items-center gap-1 text-left"
                style={{ minHeight: 44 }}
                onClick={() => setDetailInstrument(inst)}
              >
                <span className="flex-1 text-[#F2F3F8] text-[15px]">{inst}</span>
                <Chevron />
              </button>
              <button
                type="button"
                onClick={() => removeInstrument(idx)}
                className="flex items-center justify-center"
                style={{ minWidth: 44, minHeight: 44, color: '#F87171' }}
                aria-label="Remove instrument"
              >
                🗑
              </button>
            </Row>
          ))}
          {addingInstrument ? (
            <Row last>
              <input
                autoFocus
                type="text"
                placeholder="Instrument name"
                value={newInstrumentName}
                onChange={(e) => setNewInstrumentName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addInstrument(); if (e.key === 'Escape') setAddingInstrument(false); }}
                className="flex-1 bg-transparent outline-none text-[#F2F3F8] text-sm placeholder-[#62677E]"
              />
              <button type="button" onClick={addInstrument} style={{ color: '#7C6CFF', minHeight: 44, padding: '0 8px', fontSize: 14, fontWeight: 600 }}>Add</button>
              <button type="button" onClick={() => setAddingInstrument(false)} style={{ color: '#62677E', minHeight: 44, padding: '0 8px', fontSize: 14 }}>Cancel</button>
            </Row>
          ) : (
            <Row last>
              <button
                type="button"
                onClick={() => setAddingInstrument(true)}
                className="w-full text-left text-sm font-semibold"
                style={{ color: '#7C6CFF', minHeight: 44 }}
              >
                ＋ Add instrument
              </button>
            </Row>
          )}
        </Section>

        {/* ── Mighty Space amp ── */}
        <Section title="Mighty Space amp">
          <Row>
            <span className="flex-1 text-[#F2F3F8] text-[15px]">Mighty Space firmware</span>
            <span className="text-[#9AA0B8] text-sm">v20230331</span>
          </Row>
          <Row last>
            <span className="flex-1 text-[#F2F3F8] text-[15px]">IR slots (35–54)</span>
            <span className="text-[#9AA0B8] text-sm">{irSlotCount} used</span>
            <Chevron />
          </Row>
        </Section>

        {/* ── Learned preferences ── */}
        <Section title="Learned preferences">
          <Row last>
            <p className="flex-1 text-[#9AA0B8] text-sm">
              Tap{' '}
              <button
                type="button"
                onClick={() => localStorage.removeItem('learned-prefs')}
                style={{ color: '#7C6CFF', fontWeight: 600 }}
              >
                Reset
              </button>
              {' '}to clear all learned preferences.
            </p>
          </Row>
        </Section>

        {/* ── AI engine ── */}
        <Section title="AI engine">
          <Row>
            <span className="text-[#F2F3F8] text-[15px] shrink-0">Gemini API key</span>
            <input
              type={geminiKeyVisible ? 'text' : 'password'}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIza…"
              className="flex-1 bg-transparent outline-none text-[#F2F3F8] text-sm placeholder-[#62677E] min-w-0"
            />
            <button
              type="button"
              onClick={() => setGeminiKeyVisible((v) => !v)}
              className="text-xs font-medium"
              style={{ color: '#9AA0B8', minHeight: 44, minWidth: 44 }}
            >
              {geminiKeyVisible ? 'Hide' : 'Show'}
            </button>
            <button
              type="button"
              onClick={handleSaveGeminiKey}
              className="text-xs font-semibold px-3 rounded-[8px] transition-all"
              style={{
                background: geminiSaved ? '#34D399' : 'linear-gradient(135deg,#7C6CFF,#4F8BFF)',
                color: 'white',
                height: 32,
                minWidth: 52,
              }}
            >
              {geminiSaved ? '✓ Saved' : 'Save'}
            </button>
          </Row>
          {/* ChatGPT/Claude handoff toggle */}
          <div className="px-4 py-3 border-t border-white/[0.06]">
            <p className="text-[#9AA0B8] text-xs mb-2">Build a prompt to paste into ChatGPT/Claude, then paste the response back.</p>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Describe your tone…"
                value={handoffPrompt}
                onChange={(e) => setHandoffPrompt(e.target.value)}
                className="flex-1 bg-[#141826] text-[#F2F3F8] rounded-[12px] px-3 py-2 text-sm outline-none placeholder-[#62677E]"
                style={{ minWidth: 120 }}
              />
              <input
                type="text"
                placeholder="Instrument"
                value={handoffInstrument}
                onChange={(e) => setHandoffInstrument(e.target.value)}
                className="w-28 bg-[#141826] text-[#F2F3F8] rounded-[12px] px-3 py-2 text-sm outline-none placeholder-[#62677E]"
              />
              <button
                type="button"
                onClick={handleBuildHandoffPrompt}
                className="bg-[#141826] text-[#9AA0B8] rounded-[12px] px-3 py-2 text-xs font-medium"
                style={{ minHeight: 44 }}
              >
                Build Prompt
              </button>
            </div>
            {handoffGeneratedPrompt && (
              <textarea
                readOnly
                value={handoffGeneratedPrompt}
                rows={4}
                className="mt-2 w-full bg-[#141826] text-[#9AA0B8] rounded-[12px] px-3 py-2 text-xs resize-none outline-none font-mono"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
            )}
            <label className="text-[#62677E] text-xs mt-2 block">Paste AI response here:</label>
            <textarea
              value={handoffPasted}
              onChange={(e) => setHandoffPasted(e.target.value)}
              placeholder='{"archetype": "crunch", "descriptors": ["warm"], "deltas": {"amp.gain": 10}}'
              rows={3}
              className="mt-1 w-full bg-[#141826] text-[#9AA0B8] rounded-[12px] px-3 py-2 text-xs resize-none outline-none font-mono placeholder-[#62677E]"
            />
            <button
              type="button"
              onClick={() => void handleHandoffPaste()}
              disabled={!handoffPasted.trim()}
              className="mt-2 text-sm font-semibold px-5 rounded-[12px] disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg,#7C6CFF,#4F8BFF)',
                color: 'white',
                height: 44,
              }}
            >
              Parse &amp; Save Tone
            </button>
            {handoffMsg && <p className="text-[#9AA0B8] text-xs mt-1">{handoffMsg}</p>}
          </div>
        </Section>

        {/* ── Data ── */}
        <Section title="Data">
          <Row>
            <button
              type="button"
              onClick={() => void exportBackupAction()}
              className="flex-1 text-left text-[15px] font-medium"
              style={{ color: '#7C6CFF', minHeight: 44 }}
            >
              Back up now
            </button>
          </Row>
          <Row>
            <button
              type="button"
              onClick={() => void exportBackupAction()}
              className="flex-1 text-left text-[15px] font-medium"
              style={{ color: '#7C6CFF', minHeight: 44 }}
            >
              Export .json
            </button>
          </Row>
          <Row last>
            <button
              type="button"
              onClick={() => backupInputRef.current?.click()}
              className="flex-1 text-left text-[15px] font-medium"
              style={{ color: '#7C6CFF', minHeight: 44 }}
            >
              Import…
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
          </Row>
          {importMsg && (
            <div className="px-4 pb-3">
              <p className="text-[#9AA0B8] text-xs">{importMsg}</p>
            </div>
          )}
        </Section>

        {/* ── QR Import ── */}
        <Section title="QR Import">
          <Row last>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex-1 text-left text-[15px] font-medium"
              style={{ color: '#7C6CFF', minHeight: 44 }}
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
          </Row>
        </Section>

        {/* ── Danger ── */}
        <Section title="Danger">
          <Row last>
            <button
              type="button"
              onClick={() => void handleClearData()}
              className="flex-1 text-left text-[15px] font-semibold"
              style={{ color: '#F87171', minHeight: 44 }}
            >
              Clear all data
            </button>
          </Row>
        </Section>

      </div>

      {/* Instrument detail sheet */}
      {detailInstrument && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => { setDetailInstrument(null); setIsEditingInstrument(false); }}
        >
          <div
            className="w-full flex flex-col gap-4 px-4 pt-3 pb-10"
            style={{
              background: 'rgba(20,24,38,0.98)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '26px 26px 0 0',
              maxHeight: '75vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* drag handle */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-1" />

            {/* header */}
            <div className="flex items-center justify-between">
              <p className="text-[#F2F3F8] font-bold text-[20px]">
                {instrumentEmoji(detailInstrument)} {detailInstrument}
              </p>
              <button
                type="button"
                onClick={() => { setDetailInstrument(null); setIsEditingInstrument(false); }}
                style={{ color: '#7C6CFF', minHeight: 44, minWidth: 44, fontSize: 15, fontWeight: 600 }}
              >
                Done
              </button>
            </div>

            {/* instrument metadata — derived from known instruments or inferred */}
            {(() => {
              const lower = detailInstrument.toLowerCase();
              const isAcoustic = lower.includes('jumbo') || lower.includes('ej-200') || lower.includes('acoustic') || lower.includes('dreadnought');
              const isMandolin = lower.includes('mandolin');
              const type = isMandolin ? 'Mandolin' : 'Guitar';
              const kind = isAcoustic ? 'Acoustic' : isMandolin ? 'Mandolin (electric)' : 'Electric';
              const pickup = lower.includes('avion') ? 'Humbuckers (HH passive)'
                : lower.includes('jumbo') ? 'Fishman Isys (active bass/treble/phase)'
                : lower.includes('ej-200') ? 'Under-saddle passive piezo'
                : lower.includes('mandolin') ? 'Stacked HB (vol/tone)'
                : 'Unknown — engine uses generic corrections';
              const engineId = lower.includes('avion') ? 'electric-humbucker'
                : lower.includes('jumbo') ? 'acoustic-magnetic'
                : lower.includes('ej-200') ? 'acoustic-piezo'
                : lower.includes('mandolin') ? 'mandolin-magnetic'
                : 'electric-humbucker';
              const rows = [
                { label: 'Type', value: type },
                { label: 'Kind', value: kind },
                { label: 'Pickup', value: pickup },
                { label: 'Engine ID', value: engineId },
              ];
              return (
                <div
                  className="flex flex-col rounded-[18px] overflow-hidden"
                  style={{ background: 'rgba(28,32,52,0.62)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {rows.map(({ label, value }, i) => (
                    <div
                      key={label}
                      className="flex items-start px-4 gap-3"
                      style={{ minHeight: 48, borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', paddingTop: 12, paddingBottom: 12 }}
                    >
                      <span className="text-[#9AA0B8] text-[13px] w-20 shrink-0 pt-0.5">{label}</span>
                      <span className="text-[#F2F3F8] text-[14px] flex-1">{value}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            <p className="text-[#62677E] text-[12px] px-1">
              The engine applies pickup-specific corrections (gain, EQ, gate) automatically based on the instrument kind and pickup type above.
            </p>

            {/* Edit name */}
            {isEditingInstrument ? (
              <div className="flex flex-col gap-2">
                <label className="text-[#9AA0B8] text-[12px] uppercase tracking-wider">Rename instrument</label>
                <input
                  autoFocus
                  type="text"
                  value={editingInstrumentName}
                  onChange={e => setEditingInstrumentName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const trimmed = editingInstrumentName.trim();
                      if (trimmed) {
                        const idx = instruments.indexOf(detailInstrument);
                        if (idx !== -1) {
                          const updated = [...instruments];
                          updated[idx] = trimmed;
                          saveInstruments(updated);
                          setDetailInstrument(trimmed);
                        }
                      }
                      setIsEditingInstrument(false);
                    }
                    if (e.key === 'Escape') setIsEditingInstrument(false);
                  }}
                  className="w-full bg-[#141826] border border-[#7C6CFF]/40 rounded-[12px] px-4 py-3 text-[#F2F3F8] text-[15px] outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = editingInstrumentName.trim();
                      if (trimmed) {
                        const idx = instruments.indexOf(detailInstrument);
                        if (idx !== -1) {
                          const updated = [...instruments];
                          updated[idx] = trimmed;
                          saveInstruments(updated);
                          setDetailInstrument(trimmed);
                        }
                      }
                      setIsEditingInstrument(false);
                    }}
                    className="flex-1 py-3 rounded-[14px] text-[15px] font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg,#7C6CFF,#4F8BFF)' }}
                  >
                    Save name
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingInstrument(false)}
                    className="px-6 py-3 rounded-[14px] text-[15px] font-medium text-[#9AA0B8]"
                    style={{ background: 'rgba(28,32,52,0.62)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {/* Edit button */}
                <button
                  type="button"
                  onClick={() => { setEditingInstrumentName(detailInstrument); setIsEditingInstrument(true); }}
                  className="flex-1 py-3 rounded-[14px] text-[15px] font-semibold"
                  style={{ background: 'rgba(124,108,255,0.15)', color: '#9A8CFF', border: '1px solid rgba(124,108,255,0.3)' }}
                >
                  ✎ Edit name
                </button>
                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => {
                    const idx = instruments.indexOf(detailInstrument);
                    if (idx !== -1) removeInstrument(idx);
                    setDetailInstrument(null);
                    setIsEditingInstrument(false);
                  }}
                  className="flex-1 py-3 rounded-[14px] text-[15px] font-semibold"
                  style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171', border: '1px solid rgba(248,113,113,0.25)' }}
                >
                  🗑 Remove
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR decode modal */}
      {showModal && decoded && (
        <div
          className="fixed inset-0 flex items-end justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.70)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md p-6 pb-10"
            style={{
              background: 'rgba(28,32,52,0.96)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '26px 26px 0 0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[#F2F3F8] text-lg font-semibold">Decoded Patch</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-[#62677E] text-sm"
                style={{ minHeight: 44, minWidth: 44 }}
              >
                Close
              </button>
            </div>
            {decoded.error ? (
              <p className="text-[#F87171] text-sm">{decoded.error}</p>
            ) : (
              <>
                <p className="text-[#F2F3F8] text-base font-medium mb-3">{decoded.ampName}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {Object.entries(decoded.knobs).map(([k, v]) => (
                    <span key={k} className="text-[#9AA0B8] text-sm">
                      {k}: <span className="text-[#F2F3F8]">{v}</span>
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
