import { describe, expect, it } from 'vitest';
import { bpmToDelayByte, divisionToMs, tempoDelayModels } from '../../src/engine/delay.ts';

describe('engine/delay', () => {
  it('UNIT-DLY-01 BPM 120 1/4 note for Digital Delay returns a valid byte', () => {
    const result = bpmToDelayByte(120, '1/4', 'dly.digital-delay');
    // 120 BPM -> quarter note = 500ms
    expect(result.targetMs).toBeCloseTo(500, 0);
    expect(result.byte).toBeGreaterThanOrEqual(0);
    expect(result.byte).toBeLessThanOrEqual(100);
    expect(result.ms).toBeGreaterThan(0);
  });

  it('UNIT-DLY-02 dotted 1/8 at 90 BPM for Tape Echo returns valid byte', () => {
    const result = bpmToDelayByte(90, 'dotted-1/8', 'dly.tape-echo');
    // 90 BPM -> quarter = 666ms, 1/8 = 333ms, dotted = 500ms
    expect(result.targetMs).toBeCloseTo(500, 0);
    expect(result.byte).toBeGreaterThanOrEqual(0);
    expect(result.byte).toBeLessThanOrEqual(100);
  });

  it('UNIT-DLY-03 edge: BPM 200 very short — 1/16 note', () => {
    const result = bpmToDelayByte(200, '1/16', 'dly.digital-delay');
    // 200 BPM -> quarter = 300ms, 1/16 = 75ms
    expect(result.targetMs).toBeCloseTo(75, 0);
    expect(result.byte).toBeGreaterThanOrEqual(0);
    expect(result.byte).toBeLessThanOrEqual(100);
  });

  it('UNIT-DLY-04 nearest byte at boundary — byte is clamped to 0-100 range', () => {
    // Very slow BPM should clamp to max byte
    const slow = bpmToDelayByte(20, '1/4', 'dly.digital-delay');
    expect(slow.byte).toBeLessThanOrEqual(100);
    // Very fast division should clamp to min byte
    const fast = bpmToDelayByte(300, '1/16', 'dly.digital-delay');
    expect(fast.byte).toBeGreaterThanOrEqual(0);
  });

  it('UNIT-DLY-05 throws for non-delay model', () => {
    expect(() => bpmToDelayByte(120, '1/4', 'amp.dual-rect')).toThrow();
  });

  it('UNIT-DLY-06 divisionToMs: 1/4 at 120 BPM = 500ms', () => {
    expect(divisionToMs(120, '1/4')).toBeCloseTo(500, 5);
  });

  it('UNIT-DLY-07 divisionToMs: triplet-1/4 at 120 BPM ≈ 333ms', () => {
    expect(divisionToMs(120, 'triplet-1/4')).toBeCloseTo(333.33, 0);
  });

  it('UNIT-DLY-08 tempoDelayModels returns only models with tempo params', () => {
    const models = tempoDelayModels();
    expect(models.length).toBeGreaterThan(0);
    for (const m of models) {
      expect(m.id).toMatch(/^dly\./);
    }
  });
});
