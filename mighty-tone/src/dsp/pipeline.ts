import { blendIrs } from './blend.ts';
import { firWls } from './firWls.ts';
import { toMinPhase } from './minphase.ts';
import { normalise } from './normalise.ts';
import { resample } from './resample.ts';
import { findOnset } from './trim.ts';
import { decodeWav, toMono } from './wav.ts';

export interface IrPrepOptions {
  targetSampleRate: 48000;
  targetLength: 512;
  trimThresholdDb: number;
  minPhase: boolean;
  /** `b` must already be mono at `targetSampleRate`. */
  blend?: { b: Float32Array; mix: number };
  normalisePeak: number;
}

export interface IrPrepResult {
  /** `targetLength` samples at `targetSampleRate`. */
  ir: Float32Array;
  originalLength: number;
  originalSampleRate: number;
  trimmedSamples: number;
  log: string[];
}

export const DEFAULT_IR_PREP_OPTIONS: IrPrepOptions = {
  targetSampleRate: 48000,
  targetLength: 512,
  trimThresholdDb: -60,
  minPhase: true,
  normalisePeak: 0.99,
};

export function prepareIr(wav: ArrayBuffer, options?: Partial<IrPrepOptions>): IrPrepResult {
  const opts: IrPrepOptions = { ...DEFAULT_IR_PREP_OPTIONS, ...options };
  const log: string[] = [];

  const decoded = decodeWav(wav);
  const originalLength = Math.floor(decoded.samples.length / decoded.channels);
  log.push(
    `Decoded WAV: ${originalLength} samples, ${decoded.channels} channel(s) @ ${decoded.sampleRate} Hz`,
  );

  let ir = toMono(decoded.samples, decoded.channels);
  if (decoded.channels > 1) log.push(`Mixed ${decoded.channels} channels to mono`);

  if (decoded.sampleRate !== opts.targetSampleRate) {
    ir = resample(ir, decoded.sampleRate, opts.targetSampleRate);
    log.push(
      `Resampled ${decoded.sampleRate} Hz → ${opts.targetSampleRate} Hz (${ir.length} samples)`,
    );
  }

  const trimmedSamples = findOnset(ir, opts.trimThresholdDb);
  if (trimmedSamples > 0) {
    ir = ir.slice(trimmedSamples);
    log.push(`Trimmed ${trimmedSamples} leading samples below ${opts.trimThresholdDb} dB`);
  }

  if (opts.minPhase) {
    ir = toMinPhase(ir);
    log.push('Converted to minimum phase (cepstrum)');
  }

  if (opts.blend) {
    ir = blendIrs(ir, opts.blend.b, opts.blend.mix);
    log.push(`Blended with second IR at ${Math.round(opts.blend.mix * 100)}%`);
  }

  const fittedFrom = ir.length;
  ir = firWls(ir, opts.targetLength, opts.targetSampleRate);
  log.push(
    fittedFrom > opts.targetLength
      ? `Fitted ${opts.targetLength}-tap FIR (least squares) from ${fittedFrom} samples`
      : `Zero-padded ${fittedFrom} → ${opts.targetLength} samples`,
  );

  ir = normalise(ir, opts.normalisePeak);
  log.push(`Normalised peak to ${opts.normalisePeak}`);

  return {
    ir,
    originalLength,
    originalSampleRate: decoded.sampleRate,
    trimmedSamples,
    log,
  };
}
