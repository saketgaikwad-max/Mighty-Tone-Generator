import { device } from '../knowledge/device.ts';
import { PRESET_LENGTH } from './preset.ts';

export const QR_PREFIX = device.qr.prefix;
export const QR_HEADER = [device.qr.deviceQRId, device.qr.deviceQRVersion] as const;

export type QrParseError = 'UnsupportedFormat' | 'BadBase64' | 'WrongDevice' | 'WrongFWVersion' | 'BadLength';

export type QrParseResult =
  | { ok: true; header: readonly [number, number]; preset: Uint8Array }
  | { ok: false; error: QrParseError; detail: string };

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Parse "nux://MightyAmp:<base64>" (Preset.setupPresetFromQRData). */
export function parseQrString(text: string): QrParseResult {
  const t = text.trim();
  if (!t.startsWith(QR_PREFIX)) return { ok: false, error: 'UnsupportedFormat', detail: 'missing nux://MightyAmp: prefix' };
  let data: Uint8Array;
  try {
    data = base64ToBytes(t.slice(QR_PREFIX.length));
  } catch {
    return { ok: false, error: 'BadBase64', detail: 'payload is not valid base64' };
  }
  if (data[0] !== QR_HEADER[0]) return { ok: false, error: 'WrongDevice', detail: `device id ${data[0]}` };
  if (data[1] !== QR_HEADER[1]) return { ok: false, error: 'WrongFWVersion', detail: `QR version ${data[1]}` };
  if (data.length !== PRESET_LENGTH + 2) {
    return { ok: false, error: 'BadLength', detail: `expected ${PRESET_LENGTH + 2} bytes, got ${data.length}` };
  }
  return { ok: true, header: [data[0]!, data[1]!], preset: data.slice(2) };
}

export function buildQrString(preset: Uint8Array): string {
  if (preset.length !== PRESET_LENGTH) throw new Error(`Preset must be ${PRESET_LENGTH} bytes`);
  const payload = new Uint8Array(PRESET_LENGTH + 2);
  payload.set(QR_HEADER, 0);
  payload.set(preset, 2);
  return QR_PREFIX + bytesToBase64(payload);
}
