import type { BlockKind } from '../contracts/blocks.ts';
import { modelsOf } from '../knowledge/device.ts';
import { nearestTempoRaw, tempoMs } from '../codec/formatters.ts';
import type { TempoTableId } from '../contracts/device.ts';

export type DelayDivision = '1/4' | '1/8' | '1/16' | 'dotted-1/8' | 'triplet-1/4';

/** BPM + division -> milliseconds. */
export function divisionToMs(bpm: number, division: DelayDivision): number {
  const beatMs = 60_000 / bpm;
  switch (division) {
    case '1/4':
      return beatMs;
    case '1/8':
      return beatMs / 2;
    case '1/16':
      return beatMs / 4;
    case 'dotted-1/8':
      return (beatMs / 2) * 1.5;
    case 'triplet-1/4':
      return (beatMs * 2) / 3;
  }
}

/** Find the tempo param for a delay model (the param with formatter 'tempo'). */
function tempoParamOf(modelId: string): { tempoTable: TempoTableId } | undefined {
  const models = modelsOf('dly' as BlockKind);
  const model = models.find((m) => m.id === modelId);
  if (!model) return undefined;
  const param = model.params.find((p) => p.formatter === 'tempo');
  if (!param?.tempoTable) return undefined;
  return { tempoTable: param.tempoTable };
}

export interface DelayByteResult {
  byte: number;
  ms: number;
  errorMs: number;
  targetMs: number;
}

/**
 * Converts BPM + note division to milliseconds, then finds the nearest byte value (0-100)
 * in the model's tempo table.
 */
export function bpmToDelayByte(
  bpm: number,
  division: DelayDivision,
  modelId: string,
): DelayByteResult {
  const targetMs = divisionToMs(bpm, division);
  const tempoParam = tempoParamOf(modelId);
  if (!tempoParam) {
    throw new Error(`Model "${modelId}" is not a delay model with a tempo parameter`);
  }
  const { raw, ms, errorMs } = nearestTempoRaw(tempoParam.tempoTable, targetMs);
  return { byte: raw, ms, errorMs, targetMs };
}

/** Returns all delay model ids from the device. */
export function delayModelIds(): string[] {
  return modelsOf('dly' as BlockKind).map((m) => m.id);
}

/** Returns delay models that have a tempo param (i.e., support BPM sync). */
export function tempoDelayModels(): Array<{ id: string; name: string }> {
  return modelsOf('dly' as BlockKind)
    .filter((m) => m.params.some((p) => p.formatter === 'tempo'))
    .map((m) => ({ id: m.id, name: m.name }));
}

/** Returns formatted ms for a given model at a given byte value. */
export function delayByteToMs(modelId: string, byte: number): number | undefined {
  const tempoParam = tempoParamOf(modelId);
  if (!tempoParam) return undefined;
  return tempoMs(tempoParam.tempoTable, byte);
}
