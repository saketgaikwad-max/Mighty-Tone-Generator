import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { IrSlot } from '../store/db.ts';
import { deleteIrSlot, listIrSlots, saveIrSlot } from '../store/db.ts';

const SLOT_COUNT = 20;

type Segment = 'recommended' | 'prep' | 'slots';

interface InlineForm {
  slotNumber: number;
  name: string;
  notes: string;
}

interface IRInventoryProps {
  onPrepNew?: () => void;
}

export function IRInventory({ onPrepNew }: IRInventoryProps) {
  const [slots, setSlots] = useState<IrSlot[]>([]);
  const [form, setForm] = useState<InlineForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [segment, setSegment] = useState<Segment>('recommended');

  async function reload() {
    const data = await listIrSlots();
    setSlots(data);
  }

  useEffect(() => {
    void reload();
  }, []);

  function slotForNumber(n: number): IrSlot | undefined {
    return slots.find((s) => s.slotNumber === n);
  }

  async function handleDelete(id: number) {
    await deleteIrSlot(id);
    await reload();
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      await saveIrSlot(form.slotNumber, form.name || `IR ${form.slotNumber}`, form.notes || undefined);
      setForm(null);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  const SEGMENTS: Array<{ id: Segment; label: string }> = [
    { id: 'recommended', label: 'Recommended' },
    { id: 'prep', label: 'Prep tool' },
    { id: 'slots', label: 'Slots' },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0B0D14', color: '#F2F3F8' }}>
      {/* Large title */}
      <div className="sticky top-0 z-10 px-4 pt-5 pb-3" style={{ background: '#0B0D14' }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, lineHeight: '41px', color: '#F2F3F8' }}>IR Lab</h1>

        {/* Segmented control */}
        <div
          className="flex mt-3 rounded-[12px] p-1 gap-1"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          {SEGMENTS.map((seg) => (
            <button
              key={seg.id}
              type="button"
              onClick={() => setSegment(seg.id)}
              style={{ minHeight: 32 }}
              className={[
                'flex-1 text-xs font-semibold rounded-[8px] transition-all',
                segment === seg.id
                  ? 'bg-gradient-to-br from-[#7C6CFF] to-[#4F8BFF] text-white shadow-[0_0_12px_rgba(124,108,255,0.3)]'
                  : 'text-[#9AA0B8]',
              ].join(' ')}
            >
              {seg.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3 flex-1">
        {/* Recommended tab */}
        {segment === 'recommended' && (
          <div
            className="bg-[rgba(28,32,52,0.62)] backdrop-blur-xl border border-white/[0.08] rounded-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.35)] px-5 py-8 text-center"
          >
            <p style={{ color: '#9AA0B8', fontSize: 15 }}>
              Load your amp tone first to get IR recommendations.
            </p>
          </div>
        )}

        {/* Prep tool tab */}
        {segment === 'prep' && (
          <div className="flex flex-col gap-3">
            <button
              onClick={onPrepNew}
              style={{ minHeight: 50 }}
              className="w-full bg-gradient-to-br from-[#7C6CFF] to-[#4F8BFF] shadow-[0_0_24px_rgba(124,108,255,0.45)] text-white font-semibold rounded-full text-base"
            >
              Go to IR Prep →
            </button>
          </div>
        )}

        {/* Slots tab */}
        {segment === 'slots' && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map((n) => {
              const slot = slotForNumber(n);
              const isEditing = form?.slotNumber === n;
              return (
                <div
                  key={n}
                  className="bg-[rgba(28,32,52,0.62)] backdrop-blur-xl border border-white/[0.08] rounded-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.35)] p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span style={{ color: '#62677E', fontFamily: 'monospace', fontSize: 12 }}>
                        Slot {n} · device {n + 34}
                      </span>
                      <p className="font-semibold text-sm mt-0.5" style={{ color: slot ? '#F2F3F8' : '#62677E' }}>
                        {slot ? slot.name : 'Empty'}
                      </p>
                      {slot?.notes && <p className="text-xs mt-0.5" style={{ color: '#9AA0B8' }}>{slot.notes}</p>}
                      {slot?.loadedAt && (
                        <p className="text-xs mt-0.5" style={{ color: '#62677E' }}>{new Date(slot.loadedAt).toLocaleString()}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setForm(
                            isEditing
                              ? null
                              : { slotNumber: n, name: slot?.name ?? '', notes: slot?.notes ?? '' },
                          )
                        }
                        style={{ minHeight: 32, background: 'rgba(255,255,255,0.08)', color: '#9AA0B8' }}
                        className="text-xs px-2 py-1 rounded-[8px]"
                      >
                        {isEditing ? 'Cancel' : 'Set slot'}
                      </button>
                      {slot?.id != null && (
                        <button
                          onClick={() => handleDelete(slot.id!)}
                          className="text-red-400 hover:text-red-300"
                          aria-label="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="space-y-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <input
                        className="w-full rounded-[12px] px-3 py-2 text-sm outline-none"
                        style={{ background: 'rgba(255,255,255,0.07)', color: '#F2F3F8', border: '1px solid rgba(255,255,255,0.1)' }}
                        placeholder="Name"
                        value={form!.name}
                        onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })}
                      />
                      <input
                        className="w-full rounded-[12px] px-3 py-2 text-sm outline-none"
                        style={{ background: 'rgba(255,255,255,0.07)', color: '#F2F3F8', border: '1px solid rgba(255,255,255,0.1)' }}
                        placeholder="Notes (optional)"
                        value={form!.notes}
                        onChange={(e) => setForm((f) => f && { ...f, notes: e.target.value })}
                      />
                      <button
                        onClick={() => void handleSave()}
                        disabled={saving}
                        style={{ minHeight: 40 }}
                        className="bg-gradient-to-br from-[#7C6CFF] to-[#4F8BFF] disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-full"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
