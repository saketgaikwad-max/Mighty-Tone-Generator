import { useEffect, useState } from 'react';
import { listVersions, type Version } from '../../store/db.ts';
import { QrView } from './QrView.tsx';

interface Props {
  toneId: number;
  onRestore: (qrString: string) => void;
}

export function VersionTimeline({ toneId, onRestore }: Props) {
  const [versions, setVersions] = useState<Version[]>([]);

  useEffect(() => {
    void listVersions(toneId).then(setVersions);
  }, [toneId]);

  if (versions.length === 0) {
    return <p className="text-zinc-600 text-xs px-2">No version history.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-zinc-500 text-xs font-medium px-2">Version history</p>
      {versions.map((v, idx) => {
        const meta = (() => {
          try {
            return JSON.parse(v.meta) as { archetype?: string };
          } catch {
            return {};
          }
        })();
        return (
          <div key={v.id} className="flex gap-3 items-center bg-zinc-950 rounded-xl px-3 py-2">
            <div className="flex flex-col items-center">
              <span className="text-zinc-600 text-xs font-mono">v{idx + 1}</span>
              {idx < versions.length - 1 && (
                <div className="w-px h-4 bg-zinc-800 mt-1" />
              )}
            </div>
            <QrView qrString={v.qrString} size={48} />
            <div className="flex-1 min-w-0">
              <p className="text-zinc-300 text-xs font-medium">{meta.archetype ?? '—'}</p>
              <p className="text-zinc-600 text-xs">
                {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRestore(v.qrString)}
              className="text-blue-400 text-xs font-medium shrink-0"
            >
              Restore
            </button>
          </div>
        );
      })}
    </div>
  );
}
