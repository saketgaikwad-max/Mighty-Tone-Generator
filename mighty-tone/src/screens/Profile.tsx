import { useRef, useState } from 'react';
import { describePatch } from '../codec/describe.ts';
import { decodePreset } from '../codec/preset.ts';
import { parseQrString } from '../codec/qr-string.ts';
import { decodeQrImage, type RgbaImage } from '../qr/decode-image.ts';

interface DecodedInfo {
  ampName: string;
  knobs: Record<string, string>;
  error?: string;
}

export function Profile() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [decoded, setDecoded] = useState<DecodedInfo | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function handleFile(file: File) {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    const img: RgbaImage = {
      data: imageData.data,
      width: bitmap.width,
      height: bitmap.height,
    };
    const qrResult = decodeQrImage(img);
    if (!qrResult) {
      setDecoded({ ampName: '', knobs: {}, error: 'No QR code found in image.' });
      setShowModal(true);
      return;
    }
    const parsed = parseQrString(qrResult.text);
    if (!parsed.ok) {
      setDecoded({ ampName: '', knobs: {}, error: `QR parse error: ${parsed.error} — ${parsed.detail}` });
      setShowModal(true);
      return;
    }
    try {
      const patch = decodePreset(parsed.preset, parsed.header);
      const desc = describePatch(patch);
      const amp = desc.blocks.amp;
      setDecoded({
        ampName: amp?.model ?? '—',
        knobs: amp?.params ?? {},
      });
    } catch (err) {
      setDecoded({ ampName: '', knobs: {}, error: String(err) });
    }
    setShowModal(true);
  }

  return (
    <div className="flex flex-col h-full bg-black p-4">
      <h1 className="text-white text-xl font-semibold mb-4">Profile</h1>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="bg-zinc-800 text-white rounded-2xl px-5 py-3 text-sm font-medium w-fit"
      >
        Import QR image
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />

      {showModal && decoded && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-zinc-900 rounded-t-3xl p-6 w-full max-w-md pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white text-lg font-semibold">Decoded Patch</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-zinc-500 text-sm"
              >
                Close
              </button>
            </div>
            {decoded.error ? (
              <p className="text-red-400 text-sm">{decoded.error}</p>
            ) : (
              <>
                <p className="text-white text-base font-medium mb-3">{decoded.ampName}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {Object.entries(decoded.knobs).map(([k, v]) => (
                    <span key={k} className="text-zinc-400 text-sm">
                      {k}: <span className="text-zinc-200">{v}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
