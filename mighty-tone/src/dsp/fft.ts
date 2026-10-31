function assertPow2(n: number): void {
  if (n < 1 || (n & (n - 1)) !== 0) throw new Error(`FFT length must be a power of 2 (got ${n})`);
}

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function transform(real: Float64Array, imag: Float64Array, inverse: boolean): void {
  const n = real.length;
  if (imag.length !== n) throw new Error('real and imag must have equal length');
  assertPow2(n);

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = real[i]!;
      real[i] = real[j]!;
      real[j] = tr;
      const ti = imag[i]!;
      imag[i] = imag[j]!;
      imag[j] = ti;
    }
  }

  const sign = inverse ? 1 : -1;
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const theta = (sign * 2 * Math.PI) / size;
    const wr = Math.cos(theta);
    const wi = Math.sin(theta);
    for (let start = 0; start < n; start += size) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = start + k;
        const b = a + half;
        const xr = real[b]! * cr - imag[b]! * ci;
        const xi = real[b]! * ci + imag[b]! * cr;
        real[b] = real[a]! - xr;
        imag[b] = imag[a]! - xi;
        real[a] = real[a]! + xr;
        imag[a] = imag[a]! + xi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      real[i] = real[i]! / n;
      imag[i] = imag[i]! / n;
    }
  }
}

/** In-place radix-2 Cooley-Tukey forward FFT. Length must be a power of 2. */
export function fft(real: Float64Array, imag: Float64Array): void {
  transform(real, imag, false);
}

/** In-place inverse FFT (scaled by 1/N). Length must be a power of 2. */
export function ifft(real: Float64Array, imag: Float64Array): void {
  transform(real, imag, true);
}

export function magnitude(real: Float64Array, imag: Float64Array): Float64Array {
  const out = new Float64Array(real.length);
  for (let i = 0; i < real.length; i++) out[i] = Math.hypot(real[i]!, imag[i]!);
  return out;
}
