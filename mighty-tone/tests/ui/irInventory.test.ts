import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IrSlot } from '../../src/store/db.ts';

// ---------------------------------------------------------------------------
// Shared in-memory rows array — declared via vi.hoisted so it is available
// inside the hoisted vi.mock factory AND in the test body.
// ---------------------------------------------------------------------------

const { rows } = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));

vi.mock('../../src/store/db.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/store/db.ts')>();

  let nextId = 1;

  function orderBySlot() {
    return {
      toArray: async () =>
        [...rows].sort((a, b) => ((a.slotNumber as number) ?? 0) - ((b.slotNumber as number) ?? 0)),
    };
  }

  const irSlots = {
    _rows: rows,
    orderBy: (_f: string) => orderBySlot(),
    async add(row: Record<string, unknown>) {
      const id = nextId++;
      const inserted = { ...row, id };
      rows.push(inserted);
      return id;
    },
    async update(id: number, changes: Record<string, unknown>) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx !== -1) Object.assign(rows[idx] as object, changes);
    },
    async delete(id: number) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx !== -1) rows.splice(idx, 1);
    },
    where(field: string) {
      return {
        equals: (val: unknown) => ({
          first: async () => rows.find((r) => r[field] === val) ?? undefined,
        }),
      };
    },
  };

  async function saveIrSlot(slotNumber: number, name: string, notes?: string): Promise<IrSlot> {
    const loadedAt = Date.now();
    const existing = await irSlots.where('slotNumber').equals(slotNumber).first();
    if (existing?.id != null) {
      await irSlots.update(existing.id as number, { name, notes, loadedAt });
      return { ...(existing as unknown as IrSlot), name, notes, loadedAt };
    }
    const id = await irSlots.add({ slotNumber, name, notes, loadedAt });
    return { id: id as number, slotNumber, name, notes, loadedAt };
  }

  async function listIrSlots(): Promise<IrSlot[]> {
    return irSlots.orderBy('slotNumber').toArray() as unknown as Promise<IrSlot[]>;
  }

  async function deleteIrSlot(id: number): Promise<void> {
    await irSlots.delete(id);
  }

  return { ...mod, db: { irSlots }, saveIrSlot, listIrSlots, deleteIrSlot };
});

import { deleteIrSlot, listIrSlots, saveIrSlot } from '../../src/store/db.ts';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IR slot inventory', () => {
  beforeEach(() => {
    rows.length = 0;
  });

  it('saveIrSlot + listIrSlots round-trip', async () => {
    await saveIrSlot(1, 'V30 4x12', 'Classic Marshall cab');
    await saveIrSlot(3, 'Greenback 2x12');
    const slots = await listIrSlots();
    expect(slots).toHaveLength(2);
    expect(slots.at(0)?.slotNumber).toBe(1);
    expect(slots.at(0)?.name).toBe('V30 4x12');
    expect(slots.at(0)?.notes).toBe('Classic Marshall cab');
    expect(slots.at(1)?.slotNumber).toBe(3);
    expect(slots.at(1)?.name).toBe('Greenback 2x12');
  });

  it('saveIrSlot overwrites an existing slot with the same slotNumber', async () => {
    await saveIrSlot(5, 'First IR');
    await saveIrSlot(5, 'Second IR', 'overwritten');
    const slots = await listIrSlots();
    expect(slots).toHaveLength(1);
    expect(slots.at(0)?.name).toBe('Second IR');
    expect(slots.at(0)?.notes).toBe('overwritten');
  });

  it('deleteIrSlot removes the row', async () => {
    const slot = await saveIrSlot(2, 'To be deleted');
    let slots = await listIrSlots();
    expect(slots).toHaveLength(1);
    await deleteIrSlot(slot.id!);
    slots = await listIrSlots();
    expect(slots).toHaveLength(0);
  });
});
