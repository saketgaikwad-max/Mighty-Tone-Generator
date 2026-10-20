import { BLOCK_KINDS, type BlockKind } from '../contracts/blocks.ts';
import type { ModelDef } from '../contracts/device.ts';
import type { BlockState, Patch } from '../contracts/patch.ts';
import { blockForHeadIndex, device, headIndexOf, modelById, modelByNuxIndex, modelsOf } from '../knowledge/device.ts';

export const PRESET_LENGTH = device.qr.presetLength;
const { modelMask, offBit } = device.head;
const NAME_START = device.name.start;
const NAME_MAX = device.name.maxLengthInQr;

export class PatchEncodeError extends Error {}

function decodeName(raw: Uint8Array): string {
  let s = '';
  for (let i = NAME_START; i < PRESET_LENGTH; i++) {
    const c = raw[i]!;
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

/**
 * Decode 113 preset bytes. Mirrors PlugProPreset.setupPresetFromNuxDataArray, except that unknown model
 * indexes are reported as warnings instead of silently mapped to the first model.
 */
export function decodePreset(bytes: Uint8Array, qrHeader: readonly [number, number] = [15, 1]): Patch {
  if (bytes.length !== PRESET_LENGTH) {
    throw new Error(`Preset must be ${PRESET_LENGTH} bytes, got ${bytes.length}`);
  }
  const raw = Uint8Array.from(bytes);
  const warnings: string[] = [];

  const blocks = {} as Record<BlockKind, BlockState>;
  for (const block of BLOCK_KINDS) {
    const head = raw[headIndexOf(block)]!;
    const nuxIndex = head & modelMask;
    let model = modelByNuxIndex(block, nuxIndex);
    if (!model) {
      model = modelsOf(block)[0]!;
      warnings.push(`${block}: unknown model index ${nuxIndex}; shown as ${model.name}`);
    }
    const params: Record<string, number> = {};
    for (const p of model.params) params[p.key] = raw[p.byteIndex]!;
    blocks[block] = { block, modelId: model.id, enabled: (head & offBit) === 0, params };
  }

  let start = device.chain.start;
  for (let i = 0; i < device.chain.maxOffsetSkip; i++) {
    if (blockForHeadIndex(raw[start]!) === undefined) start++;
  }
  const chainOffset = start - device.chain.start;
  const chain: BlockKind[] = [];
  for (let i = 0; i < device.chain.length; i++) {
    const b = blockForHeadIndex(raw[start + i]!);
    if (b) chain.push(b);
    else warnings.push(`chain slot ${i + 1}: invalid block id ${raw[start + i]}`);
  }
  if (new Set(chain).size !== chain.length || chain.length !== BLOCK_KINDS.length) {
    warnings.push('chain is not a permutation of the 9 blocks');
  }
  if (chainOffset > 0) warnings.push(`chain starts ${chainOffset} byte(s) late (reference "fix for QR")`);

  const name = decodeName(raw);
  if (/[^\x20-\x7e]/.test(name)) warnings.push('name contains non-printable characters');

  return {
    device: 'mighty-space',
    qrHeader: [qrHeader[0], qrHeader[1]],
    blocks,
    chain,
    chainOffset,
    master: raw[device.master.byteIndex]!,
    name,
    raw,
    warnings,
  };
}

function checkParam(model: ModelDef, key: string, value: number): void {
  const p = model.params.find((x) => x.key === key);
  if (!p) throw new PatchEncodeError(`${model.id}: unknown param "${key}"`);
  if (!Number.isInteger(value)) throw new PatchEncodeError(`${model.id}.${key}: ${value} is not an integer`);
  if (p.switch ? !p.switch.values.includes(value) : value < 0 || value > 100) {
    throw new PatchEncodeError(`${model.id}.${key}: ${value} out of range`);
  }
}

/**
 * Encode a patch to 113 bytes by overlaying the modelled fields onto `patch.raw` (or a given template),
 * so undocumented bytes keep device-valid values. Throws PatchEncodeError on any invalid field.
 */
export function encodePreset(patch: Patch, template: Uint8Array = patch.raw): Uint8Array {
  if (template.length !== PRESET_LENGTH) throw new PatchEncodeError('template must be 113 bytes');
  const out = Uint8Array.from(template);

  for (const block of BLOCK_KINDS) {
    const state = patch.blocks[block];
    const model = modelById(state.modelId);
    if (!model || model.block !== block) throw new PatchEncodeError(`${block}: unknown model "${state.modelId}"`);
    const h = headIndexOf(block);
    out[h] = (out[h]! & ~(modelMask | offBit)) | model.nuxIndex | (state.enabled ? 0 : offBit);
    for (const [key, value] of Object.entries(state.params)) {
      checkParam(model, key, value);
      out[model.params.find((p) => p.key === key)!.byteIndex] = value;
    }
  }

  if (!Number.isInteger(patch.master) || patch.master < 0 || patch.master > 100) {
    throw new PatchEncodeError(`master ${patch.master} out of range`);
  }
  out[device.master.byteIndex] = patch.master;

  if (patch.chain.length !== BLOCK_KINDS.length || new Set(patch.chain).size !== BLOCK_KINDS.length) {
    throw new PatchEncodeError('chain must contain each of the 9 blocks exactly once');
  }
  if (patch.chainOffset < 0 || patch.chainOffset > device.chain.maxOffsetSkip) {
    throw new PatchEncodeError(`chainOffset ${patch.chainOffset} out of range`);
  }
  const start = device.chain.start + patch.chainOffset;
  patch.chain.forEach((b, i) => (out[start + i] = headIndexOf(b)));

  if (patch.name !== decodeName(template)) {
    if (patch.name.length > NAME_MAX || /[^\x20-\x7e]/.test(patch.name)) {
      throw new PatchEncodeError(`name must be at most ${NAME_MAX} printable ASCII characters`);
    }
    for (let i = 0; i < NAME_MAX; i++) out[NAME_START + i] = i < patch.name.length ? patch.name.charCodeAt(i) : 0;
  }
  return out;
}

/** Byte indexes the codec models (heads, every model's params, master, chain, name). */
export function modelledByteIndexes(): Set<number> {
  const s = new Set<number>([device.master.byteIndex]);
  for (const block of BLOCK_KINDS) {
    s.add(headIndexOf(block));
    for (const m of modelsOf(block)) for (const p of m.params) s.add(p.byteIndex);
  }
  for (let i = 0; i < device.chain.length + device.chain.maxOffsetSkip; i++) s.add(device.chain.start + i);
  for (let i = NAME_START; i < PRESET_LENGTH; i++) s.add(i);
  return s;
}

/** Indexes of bytes the codec does not model that differ between two presets (unknown-byte warnings). */
export function unmodelledDiff(a: Uint8Array, b: Uint8Array): number[] {
  const modelled = modelledByteIndexes();
  const out: number[] = [];
  for (let i = 0; i < PRESET_LENGTH; i++) if (!modelled.has(i) && a[i] !== b[i]) out.push(i);
  return out;
}
