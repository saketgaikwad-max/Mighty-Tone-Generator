import { useEffect, useState } from 'react';
import { getLatestVersion, listSessions, listTones, type Session, type Tone } from '../store/db.ts';
import { QrView } from '../ui/components/QrView.tsx';

export function Library() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [tones, setTones] = useState<Tone[]>([]);
  const [toneQrs, setToneQrs] = useState<Record<number, string>>({});

  useEffect(() => {
    void listSessions().then(setSessions);
  }, []);

  async function openSession(session: Session) {
    setSelectedSession(session);
    const list = await listTones(session.id!);
    setTones(list);
    // Load QR strings for each tone
    const qrs: Record<number, string> = {};
    for (const tone of list) {
      const v = await getLatestVersion(tone.id!);
      if (v) qrs[tone.id!] = v.qrString;
    }
    setToneQrs(qrs);
  }

  if (selectedSession) {
    return (
      <div className="flex flex-col h-full bg-black">
        <div className="flex items-center gap-2 p-4 border-b border-zinc-800">
          <button
            type="button"
            onClick={() => setSelectedSession(null)}
            className="text-blue-400 text-sm"
          >
            ← Back
          </button>
          <h1 className="text-white text-base font-semibold truncate">{selectedSession.name}</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {tones.length === 0 && (
            <p className="text-zinc-600 text-sm text-center mt-8">No tones in this session.</p>
          )}
          {tones.map((tone) => (
            <div key={tone.id} className="bg-zinc-900 rounded-2xl p-4 flex gap-4 items-center">
              {toneQrs[tone.id!] ? (
                <QrView qrString={toneQrs[tone.id!]!} size={72} />
              ) : (
                <div className="w-18 h-18 bg-zinc-800 rounded" />
              )}
              <div>
                <p className="text-white text-sm font-semibold">{tone.archetype}</p>
                <p className="text-zinc-500 text-xs">{tone.instrument}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black">
      <h1 className="text-white text-xl font-semibold px-4 pt-4 pb-2">Library</h1>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {sessions.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-zinc-600 text-sm">No saved tones yet.</p>
          </div>
        )}
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            onClick={() => void openSession(session)}
            className="bg-zinc-900 rounded-2xl p-4 text-left flex flex-col gap-1"
          >
            <p className="text-white text-sm font-semibold">{session.name}</p>
            <p className="text-zinc-500 text-xs">
              {new Date(session.createdAt).toLocaleString()}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
