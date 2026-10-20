import jsQR from 'jsqr';

export interface RgbaImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface QrImageResult {
  text: string;
  strategy: string;
}

function luma(img: RgbaImage): Uint8Array {
  const out = new Uint8Array(img.width * img.height);
  for (let i = 0; i < out.length; i++) {
    const o = i * 4;
    out[i] = (img.data[o]! * 299 + img.data[o + 1]! * 587 + img.data[o + 2]! * 114) / 1000;
  }
  return out;
}

function fromGray(gray: Uint8Array, width: number, height: number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < gray.length; i++) {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = gray[i]!;
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

/** Crop a rectangle and surround it with a white quiet zone of `pad` pixels. */
export function cropPad(img: RgbaImage, x: number, y: number, w: number, h: number, pad: number): RgbaImage {
  const W = w + 2 * pad;
  const H = h + 2 * pad;
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  for (let r = 0; r < h; r++) {
    const src = ((y + r) * img.width + x) * 4;
    data.set(img.data.subarray(src, src + w * 4), ((r + pad) * W + pad) * 4);
  }
  return { data, width: W, height: H };
}

function scaleNearest(img: RgbaImage, k: number): RgbaImage {
  const W = img.width * k;
  const H = img.height * k;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = (((y / k) | 0) * img.width + ((x / k) | 0)) * 4;
      data.set(img.data.subarray(s, s + 4), (y * W + x) * 4);
    }
  }
  return { data, width: W, height: H };
}

function otsu(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of gray) hist[v]!++;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = gray.length - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

function binarize(img: RgbaImage): RgbaImage {
  const g = luma(img);
  const t = otsu(g);
  return fromGray(
    g.map((v) => (v > t ? 255 : 0)),
    img.width,
    img.height,
  );
}

/**
 * Bounding box of the QR's light background: the longest run of rows that are mostly light, then the light
 * columns within it. MightyAmp share screenshots put the code edge-to-edge between dark UI bars.
 */
export function findLightSquare(img: RgbaImage): { x: number; y: number; w: number; h: number } | undefined {
  const g = luma(img);
  const rowLight = (y: number) => {
    let n = 0;
    for (let x = 0; x < img.width; x++) if (g[y * img.width + x]! > 128) n++;
    return n / img.width;
  };
  let bestStart = 0;
  let bestLen = 0;
  let start = -1;
  for (let y = 0; y <= img.height; y++) {
    const light = y < img.height && rowLight(y) > 0.25;
    if (light && start < 0) start = y;
    if (!light && start >= 0) {
      if (y - start > bestLen) {
        bestLen = y - start;
        bestStart = start;
      }
      start = -1;
    }
  }
  if (bestLen < 21) return undefined;
  let x0 = img.width;
  let x1 = -1;
  for (let x = 0; x < img.width; x++) {
    let n = 0;
    for (let y = bestStart; y < bestStart + bestLen; y++) if (g[y * img.width + x]! > 128) n++;
    if (n / bestLen > 0.25) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
    }
  }
  if (x1 < x0) return undefined;
  return { x: x0, y: bestStart, w: x1 - x0 + 1, h: bestLen };
}

function attempt(img: RgbaImage): string | undefined {
  return jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data || undefined;
}

/**
 * Decode ladder: as-is, then crop to the light square + white quiet zone, then upscaled, then Otsu-binarized.
 * Returns the first strategy that yields text.
 */
export function decodeQrImage(img: RgbaImage): QrImageResult | undefined {
  const tries: [string, () => RgbaImage | undefined][] = [
    ['as-is', () => img],
    ['pad', () => cropPad(img, 0, 0, img.width, img.height, 32)],
  ];
  const box = findLightSquare(img);
  if (box) {
    const pad = Math.max(16, Math.round(box.w / 10));
    const cropped = () => cropPad(img, box.x, box.y, box.w, box.h, pad);
    tries.push(
      ['crop+pad', cropped],
      ['crop+pad+x2', () => scaleNearest(cropped(), 2)],
      ['crop+pad+otsu', () => binarize(cropped())],
      ['crop+pad+x2+otsu', () => binarize(scaleNearest(cropped(), 2))],
    );
  }
  tries.push(['otsu', () => binarize(img)]);
  for (const [strategy, make] of tries) {
    const candidate = make();
    if (!candidate) continue;
    const text = attempt(candidate);
    if (text) return { text, strategy };
  }
  return undefined;
}
