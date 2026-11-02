import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
      width: size,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(console.error);
  }, [qrString, size]);

  return (
    <>
      <canvas
        ref={canvasRef}
        onClick={() => setFullscreen(true)}
        className="cursor-pointer rounded"
        style={{ width: size, height: size }}
      />
      {fullscreen && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setFullscreen(false)}
        >
          <div className="flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
            <FullscreenQr qrString={qrString} />
            <p className="text-white/60 text-[13px]">Tap outside to close</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function FullscreenQr({ qrString }: { qrString: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fsSize = Math.min(window.innerWidth - 64, window.innerHeight - 160, 480);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qrString, {
      width: fsSize,
      margin: 3,
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(console.error);
  }, [qrString, fsSize]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-2xl shadow-[0_0_60px_rgba(124,108,255,0.3)]"
      style={{ width: fsSize, height: fsSize }}
    />
  );
}
