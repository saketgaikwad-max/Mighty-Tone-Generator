import { describe, expect, it } from 'vitest';
import {
  fromHuman,
  highCutHz,
  lowCutHz,
  nearestTempoRaw,
  tempoMs,
  tempoRangeMs,
  toHuman,
} from '../../src/codec/formatters.ts';
import { modelById } from '../../src/knowledge/device.ts';

const cab = modelById('cab.user-ir-1')!;
const param = (key: string) => cab.params.find((p) => p.key === key)!;

describe('formatters (UNIT-FMT-*)', () => {
  it('UNIT-FMT-01 high cut is log-spaced 5-20 kHz; knob 75 reads 14142 Hz (user-confirmed)', () => {
    expect(highCutHz(0)).toBeCloseTo(5000, 6);
    expect(highCutHz(100)).toBeCloseTo(20000, 6);
    expect(toHuman(param('hicut'), 75).text).toBe('14142');
    expect(fromHuman(param('hicut'), 14142)).toBe(75);
  });

  it('UNIT-FMT-02 low cut is linear 20-300 Hz', () => {
    expect(lowCutHz(0)).toBe(20);
    expect(lowCutHz(100)).toBe(300);
    expect(toHuman(param('lowcut'), 4).text).toBe('31');
    expect(fromHuman(param('lowcut'), 31)).toBe(4);
  });

  it('UNIT-FMT-03 cab level / master is -12..+12 dB', () => {
    expect(toHuman(param('level'), 0).value).toBe(-12);
    expect(toHuman(param('level'), 50).value).toBe(0);
    expect(toHuman(param('level'), 75).text).toBe('6');
    expect(fromHuman(param('level'), 6)).toBe(75);
  });

  it('UNIT-FMT-04 EQ bands are -15..+15 dB', () => {
    const band = modelById('eq.10-band')!.params[1]!;
    expect(band.label).toBe('31');
    expect(toHuman(band, 50).value).toBe(0);
    expect(toHuman(band, 100).value).toBe(15);
    expect(fromHuman(band, -15)).toBe(0);
  });

  it('UNIT-FMT-05 switch params show their labels', () => {
    const bright = modelById('amp.jazz-clean')!.params.find((p) => p.key === 'bright')!;
    expect(toHuman(bright, 0).text).toBe('Off');
    expect(toHuman(bright, 1).text).toBe('On');
  });
});

describe('delay tables', () => {
  it('UNIT-DLY-02 / R88 model time ranges (ms)', () => {
    const r = (t: Parameters<typeof tempoRangeMs>[0]) => {
      const { min, max } = tempoRangeMs(t);
      return [Math.round(min), Math.round(max)];
    };
    expect(r('proAnalog')).toEqual([40, 401]);
    expect(r('pro')).toEqual([80, 990]);
    expect(r('proMod')).toEqual([18, 1192]);
    expect(r('proTape')).toEqual([53, 546]);
  });

  it('interpolates linearly between the 25-step breakpoints', () => {
    expect(tempoMs('pro', 25)).toBeCloseTo(161.247, 2);
    expect(tempoMs('pro', 37.5)).toBeCloseTo((161.247 + 503.129) / 2, 2);
  });

  it('DLY-01 worked example: 100 BPM dotted 1/8 = 450 ms -> Digital raw 46 ~ 448 ms', () => {
    const digitalTime = modelById('dly.digital-delay')!.params.find((p) => p.key === 'time')!;
    const best = nearestTempoRaw(digitalTime.tempoTable!, 450);
    expect(best.raw).toBe(46);
    expect(Math.round(best.ms)).toBe(448);
  });
});
