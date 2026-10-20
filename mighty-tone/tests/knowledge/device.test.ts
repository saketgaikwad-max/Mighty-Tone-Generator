import { describe, expect, it } from 'vitest';
import raw from '../../knowledge/device/mighty-space.json' with { type: 'json' };
import { BLOCK_KINDS, DeviceKnowledgeSchema } from '../../src/contracts/device.ts';
import { device, modelById, modelsOf, userIrSlotOf } from '../../src/knowledge/device.ts';

describe('device knowledge (mighty-space.json)', () => {
  it('UNIT-KN-01 validates against the schema', () => {
    expect(() => DeviceKnowledgeSchema.parse(raw)).not.toThrow();
  });

  it('UNIT-KN-02 has 29 amps including 8 hidden ones', () => {
    const amps = modelsOf('amp');
    expect(amps).toHaveLength(29);
    expect(amps.filter((m) => m.hiddenInOfficialApp).map((m) => m.name)).toEqual([
      'Twin Reverb',
      'Class A15',
      'Vibro King',
      'Budda',
      'Brit Blues',
      'Match D30',
      'Brit 2000',
      'Uber HiGain',
    ]);
    expect(modelById('amp.optima-air')?.nuxIndex).toBe(28);
    expect(modelById('amp.stageman')?.nuxIndex).toBe(29);
  });

  it('UNIT-KN-02 has the expected model counts per block', () => {
    const counts = Object.fromEntries(BLOCK_KINDS.map((b) => [b, modelsOf(b).length]));
    expect(counts).toEqual({ gate: 1, comp: 3, efx: 14, amp: 29, eq: 2, mod: 14, dly: 6, rvb: 6, cab: 54 });
  });

  it('UNIT-KN-03 has 34 cabs ending with the acoustic IRs, then 20 user IR slots 35-54', () => {
    const cabs = modelsOf('cab');
    const builtin = cabs.filter((m) => m.userIrSlot === undefined);
    expect(builtin).toHaveLength(34);
    expect(builtin.slice(-3).map((m) => [m.name, m.nuxIndex])).toEqual([
      ['G-HBIRD', 32],
      ['G-J15', 33],
      ['M-D45', 34],
    ]);
    const user = cabs.filter((m) => m.userIrSlot !== undefined);
    expect(user.map((m) => m.nuxIndex)).toEqual(Array.from({ length: 20 }, (_, i) => 35 + i));
  });

  it('UNIT-IR-01 user IR slot n <-> cab index n + 34', () => {
    for (let n = 1; n <= 20; n++) expect(userIrSlotOf(n + 34)).toBe(n);
    expect(userIrSlotOf(34)).toBeUndefined();
    expect(userIrSlotOf(55)).toBeUndefined();
  });

  it('UNIT-KN-04 every model carries a source reference and the file carries provenance', () => {
    expect(device.source.license).toBe('MIT');
    expect(device.source.commit).toMatch(/^[0-9a-f]{40}$/);
    for (const b of BLOCK_KINDS) for (const m of modelsOf(b)) expect(m.source.file).toMatch(/\.dart$/);
  });

  it('model ids are unique and params have unique keys and byte indexes per model', () => {
    const ids = BLOCK_KINDS.flatMap((b) => modelsOf(b).map((m) => m.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      const m = modelById(id)!;
      expect(new Set(m.params.map((p) => p.key)).size).toBe(m.params.length);
      expect(new Set(m.params.map((p) => p.byteIndex)).size).toBe(m.params.length);
    }
  });

  it('matches the knob layouts seen in the fixture screenshots', () => {
    const labels = (id: string) => modelById(id)!.params.map((p) => p.label);
    expect(labels('amp.1987x50')).toEqual(['Gain', 'Master', 'Bass', 'Middle', 'Treble', 'Presence']);
    expect(labels('amp.mld')).toEqual(['Gain', 'Master', 'Bass', 'Mid Freq', 'Middle', 'Treble']);
    expect(labels('cab.user-ir-1')).toEqual(['Level', 'Low Cut', 'High Cut']);
  });

  it('R88 Analog Delay V2 keeps its time in Para1 labelled "Rate"', () => {
    const time = modelById('dly.analog')!.params.find((p) => p.formatter === 'tempo')!;
    expect([time.label, time.byteName, time.tempoTable]).toEqual(['Rate', 'DLY_Para1', 'proAnalog']);
  });
});
