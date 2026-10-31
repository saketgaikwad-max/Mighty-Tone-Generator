import Dexie, { type EntityTable } from 'dexie';

/** A chat session containing a sequence of tone requests. */
export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

/** A tone preset generated from a session message. */
export interface Tone {
  id: string;
  sessionId: string;
  name: string;
  description: string;
  createdAt: number;
}

/** A versioned snapshot of a tone's patch bytes. */
export interface Version {
  id: string;
  toneId: string;
  patchBytes: Uint8Array;
  qrString: string;
  createdAt: number;
}

class MightyToneDb extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  tones!: EntityTable<Tone, 'id'>;
  versions!: EntityTable<Version, 'id'>;

  constructor() {
    super('MightyToneDb');
    this.version(1).stores({
      sessions: 'id, updatedAt',
      tones: 'id, sessionId, createdAt',
      versions: 'id, toneId, createdAt',
    });
  }
}

export const db = new MightyToneDb();
