import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { IrSlot } from '../store/db.ts';
import { deleteIrSlot, listIrSlots, saveIrSlot } from '../store/db.ts';

const SLOT_COUNT = 20;

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

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white overflow-y-auto">
      <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex items-center justify-between z-10">
        <h1 className="text-lg font-bold">IR Lab — Slot Inventory</h1>
        {onPrepNew && (
          <button
            onClick={onPrepNew}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-3 py-1.5 rounded-lg"
          >
            Prep new IR
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map((n) => {
          const slot = slotForNumber(n);
          const isEditing = form?.slotNumber === n;
          return (
            <div key={n} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-500 font-mono">Slot {n} (device {n + 34})</span>
                  <p className="font-semibold text-sm mt-0.5">{slot ? slot.name : 'Empty'}</p>
                  {slot?.notes && <p className="text-xs text-zinc-400 mt-0.5">{slot.notes}</p>}
                  {slot?.loadedAt && (
                    <p className="text-xs text-zinc-500 mt-0.5">{new Date(slot.loadedAt).toLocaleString()}</p>
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
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded"
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
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <input
                    className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Name"
                    value={form!.name}
                    onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })}
                  />
                  <input
                    className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Notes (optional)"
                    value={form!.notes}
                    onChange={(e) => setForm((f) => f && { ...f, notes: e.target.value })}
                  />
                  <button
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-lg"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
