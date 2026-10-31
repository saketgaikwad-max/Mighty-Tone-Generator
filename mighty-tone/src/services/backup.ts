import { db, type Session, type Tone, type Version } from '../store/db.ts';

export interface BackupData {
  version: 1;
  exportedAt: string;
  sessions: Session[];
  tones: Tone[];
  versions: Version[];
}

export async function exportBackup(): Promise<void> {
  const [sessions, tones, versions] = await Promise.all([
    db.sessions.toArray(),
    db.tones.toArray(),
    db.versions.toArray(),
  ]);
  const data: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions,
    tones,
    versions,
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `mighty-tone-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

function isValidBackup(data: unknown): data is BackupData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d['sessions']) && Array.isArray(d['tones']) && Array.isArray(d['versions']);
}

export async function importBackup(file: File): Promise<ImportResult> {
  const text = await file.text();
  const data: unknown = JSON.parse(text);
  if (!isValidBackup(data)) {
    throw new Error('Invalid backup file: missing sessions, tones, or versions arrays.');
  }

  let imported = 0;
  let skipped = 0;

  // Import sessions
  for (const session of data.sessions) {
    if (session.id !== undefined) {
      const existing = await db.sessions.get(session.id);
      if (existing) { skipped++; continue; }
    }
    await db.sessions.add(session as Session);
    imported++;
  }

  // Import tones
  for (const tone of data.tones) {
    if (tone.id !== undefined) {
      const existing = await db.tones.get(tone.id);
      if (existing) { skipped++; continue; }
    }
    await db.tones.add(tone as Tone);
    imported++;
  }

  // Import versions
  for (const version of data.versions) {
    if (version.id !== undefined) {
      const existing = await db.versions.get(version.id);
      if (existing) { skipped++; continue; }
    }
    await db.versions.add(version as Version);
    imported++;
  }

  return { imported, skipped };
}
