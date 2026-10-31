import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';

interface QrViewProps {
  qrString: string;
  size?: number;
}

export function QrView({ qrString, size = 180 }: QrViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qrString, {
      width: fullscreen ? Math.min(window.innerWidth - 48, 320) : size,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(console.error);
  }, [qrString, size, fullscreen]);

  return (
    <>
      <canvas
        ref={canvasRef}
        onClick={() => setFullscreen(true)}
        className="cursor-pointer rounded"
        style={{ width: size, height: size }}
      />
      {fullscreen && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setFullscreen(false)}
        >
          <canvas
            ref={undefined}
            id="qr-fullscreen"
            className="rounded-xl"
          />
          {/* Re-render large QR in fullscreen overlay */}
          <FullscreenQr qrString={qrString} onClose={() => setFullscreen(false)} />
        </div>
      )}
    </>
  );
}

function FullscreenQr({ qrString, onClose }: { qrString: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fsSize = Math.min(window.innerWidth - 48, 320);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qrString, {
      width: fsSize,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(console.error);
  }, [qrString, fsSize]);

  return (
    <canvas
      ref={canvasRef}
      onClick={onClose}
      className="rounded-xl cursor-pointer"
    />
  );
}
