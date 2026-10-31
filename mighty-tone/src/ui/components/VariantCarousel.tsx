import type { Patch } from '../../contracts/patch.ts';
import { generateVariants } from '../../engine/variants.ts';
import { encodePreset } from '../../codec/preset.ts';
import { buildQrString } from '../../codec/qr-string.ts';
import { QrView } from './QrView.tsx';

interface VariantCarouselProps {
  patch: Patch;
  toneId: number;
  onSaveVariant: (patch: Patch, qrString: string) => void;
}

export function VariantCarousel({ patch, toneId, onSaveVariant }: VariantCarouselProps) {
  const variants = generateVariants(patch, 3, toneId);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 mt-1">
      {variants.map((variant, i) => {
        let qrString = '';
        try {
          const preset = encodePreset(variant);
          qrString = buildQrString(preset);
        } catch {
          return null;
        }
        const archetypeLabel = (variant.name || patch.blocks.amp?.modelId) ?? `Variant ${i + 1}`;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSaveVariant(variant, qrString)}
            className="shrink-0 flex flex-col items-center gap-1 bg-zinc-800 rounded-xl p-2 hover:bg-zinc-700 transition-colors"
            title="Tap to save as new version"
          >
            <QrView qrString={qrString} size={64} />
            <span className="text-zinc-400 text-xs max-w-[72px] truncate">{archetypeLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
