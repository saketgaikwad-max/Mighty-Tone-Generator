export interface DecodedWav {
  /** Interleaved samples in [-1, 1]. */
  samples: Float32Array;
  sampleRate: number;
  channels: number;
}

const FORMAT_PCM = 1;
const FORMAT_FLOAT = 3;
const FORMAT_EXTENSIBLE = 0xfffe;

function fourcc(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

export function decodeWav(buffer: ArrayBuffer): DecodedWav {
  const view = new DataView(buffer);
  if (buffer.byteLength < 12 || fourcc(view, 0) !== 'RIFF' || fourcc(view, 8) !== 'WAVE') {
    throw new Error('Not a WAV file (missing RIFF/WAVE header)');
  }

  let format = -1;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataLength = 0;

  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const id = fourcc(view, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      if (size < 16) throw new Error('Malformed WAV fmt chunk');
      format = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
      if (format === FORMAT_EXTENSIBLE && size >= 26) {
        format = view.getUint16(body + 24, true);
      }
    } else if (id === 'data') {
      dataOffset = body;
      dataLength = Math.min(size, buffer.byteLength - body);
    }
    offset = body + size + (size % 2);
  }

  if (format < 0) throw new Error('WAV is missing fmt chunk');
  if (dataOffset < 0) throw new Error('WAV is missing data chunk');
  if (channels < 1) throw new Error('WAV has no channels');
  if (sampleRate <= 0) throw new Error('WAV has invalid sample rate');

  const bytesPerSample = bitsPerSample / 8;
  const count = Math.floor(dataLength / bytesPerSample);
  const samples = new Float32Array(count);

  if (format === FORMAT_PCM && bitsPerSample === 16) {
    for (let i = 0; i < count; i++) samples[i] = view.getInt16(dataOffset + i * 2, true) / 32768;
  } else if (format === FORMAT_PCM && bitsPerSample === 24) {
    for (let i = 0; i < count; i++) {
      const p = dataOffset + i * 3;
      let v = view.getUint8(p) | (view.getUint8(p + 1) << 8) | (view.getUint8(p + 2) << 16);
      if (v & 0x800000) v -= 0x1000000;
      samples[i] = v / 8388608;
    }
  } else if (format === FORMAT_PCM && bitsPerSample === 32) {
    for (let i = 0; i < count; i++) {
      samples[i] = view.getInt32(dataOffset + i * 4, true) / 2147483648;
    }
  } else if (format === FORMAT_FLOAT && bitsPerSample === 32) {
    for (let i = 0; i < count; i++) samples[i] = view.getFloat32(dataOffset + i * 4, true);
  } else {
    throw new Error(`Unsupported WAV encoding (format ${format}, ${bitsPerSample}-bit)`);
  }

  return { samples, sampleRate, channels };
}

/** Average interleaved channels down to a single mono channel. */
export function toMono(samples: Float32Array, channels: number): Float32Array {
  if (channels <= 1) return samples.slice();
  const frames = Math.floor(samples.length / channels);
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += samples[f * channels + c]!;
    out[f] = sum / channels;
  }
  return out;
}
