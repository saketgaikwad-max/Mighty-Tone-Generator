import type { ParamDef, TempoTableId } from '../contracts/device.ts';
import { device } from '../knowledge/device.ts';

const LOG_5K = Math.log10(5e3);
const LOG_20K = Math.log10(2e4);

/** Seconds at raw 0/25/50/75/100, interpolated linearly in between (TempoFormatter.percentageToTime). */
export function tempoSeconds(table: TempoTableId, raw: number): number {
  const t = device.tempoTables[table];
  const pos = Math.min(100, Math.max(0, raw)) / 25;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const f = pos - lo;
  return t[lo]! * (1 - f) + t[hi]! * f;
}

export function tempoMs(table: TempoTableId, raw: number): number {
  return tempoSeconds(table, raw) * 1000;
}

/** Nearest raw byte (0-100) for a target delay time; ties go to the lower byte. */
export function nearestTempoRaw(table: TempoTableId, targetMs: number): { raw: number; ms: number; errorMs: number } {
  let best = { raw: 0, ms: tempoMs(table, 0), errorMs: Infinity };
  for (let raw = 0; raw <= 100; raw++) {
    const ms = tempoMs(table, raw);
    const err = ms - targetMs;
    if (Math.abs(err) < Math.abs(best.errorMs)) best = { raw, ms, errorMs: err };
  }
  return best;
}

export function tempoRangeMs(table: TempoTableId): { min: number; max: number } {
  return { min: tempoMs(table, 0), max: tempoMs(table, 100) };
}

export function highCutHz(raw: number): number {
  return 10 ** (LOG_5K + (LOG_20K - LOG_5K) * (raw / 100));
}

export function lowCutHz(raw: number): number {
  return 20 + (raw / 100) * 280;
}

export function db12(raw: number): number {
  return (raw / 100) * 24 - 12;
}

export function db15(raw: number): number {
  return (raw / 100) * 30 - 15;
}

export interface HumanValue {
  value: number;
  unit: '%' | 'dB' | 'Hz' | 'ms' | '';
  /** Text as the MightyAmp app displays it on the knob (rounded). */
  text: string;
}

/** Raw byte -> human units, matching the MightyAmp knob display. */
export function toHuman(param: Pick<ParamDef, 'formatter' | 'tempoTable' | 'switch'>, raw: number): HumanValue {
  switch (param.formatter) {
    case 'percent':
      return { value: raw, unit: '%', text: String(raw) };
    case 'db12': {
      const v = db12(raw);
      return { value: v, unit: 'dB', text: String(Math.round(v)) };
    }
    case 'db15': {
      const v = db15(raw);
      return { value: v, unit: 'dB', text: v.toFixed(1) };
    }
    case 'lowcut': {
      const v = lowCutHz(raw);
      return { value: v, unit: 'Hz', text: String(Math.round(v)) };
    }
    case 'highcut': {
      const v = highCutHz(raw);
      return { value: v, unit: 'Hz', text: String(Math.round(v)) };
    }
    case 'tempo': {
      const v = tempoMs(param.tempoTable ?? 'pro', raw);
      return { value: v, unit: 'ms', text: String(Math.round(v)) };
    }
    case 'switch': {
      const i = param.switch?.values.indexOf(raw) ?? -1;
      return { value: raw, unit: '', text: i >= 0 ? param.switch!.labels[i]! : `?${raw}` };
    }
  }
}

/** Human units -> nearest raw byte (0-100). Switch params take the raw value directly. */
export function fromHuman(param: Pick<ParamDef, 'formatter' | 'tempoTable'>, value: number): number {
  const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)));
  switch (param.formatter) {
    case 'percent':
    case 'switch':
      return clamp(value);
    case 'db12':
      return clamp(((value + 12) / 24) * 100);
    case 'db15':
      return clamp(((value + 15) / 30) * 100);
    case 'lowcut':
      return clamp(((value - 20) / 280) * 100);
    case 'highcut':
      return clamp(((Math.log10(value) - LOG_5K) / (LOG_20K - LOG_5K)) * 100);
    case 'tempo':
      return nearestTempoRaw(param.tempoTable ?? 'pro', value).raw;
  }
}
