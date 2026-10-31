import Dexie, { type EntityTable } from 'dexie';
import type { Patch } from '../contracts/patch.ts';
import type { ToneMeta } from '../engine/index.ts';
import { encodePreset } from '../codec/preset.ts';
import { buildQrString } from '../codec/qr-string.ts';

/** A chat session containing a sequence of tone requests. */
export interface Session {
  id?: number;
  name: string;
  createdAt: number;
}

/** A tone preset generated from a session message. */
export interface Tone {
  id?: number;
  sessionId: number;
  archetype: string;
  instrument: string;
  createdAt: number;
}

/** A versioned snapshot of a tone's patch bytes. */
export interface Version {
  id?: number;
  toneId: number;
  parentVersionId?: number;
  qrString: string;
  patchJson: string;
  meta: string;
  createdAt: number;
}

/** An IR impulse response assigned to a NUX Mighty Space user slot (slots 35-54). */
export interface IrSlot {
  id?: number;
  /** 1-20, maps to device IR slots 35-54 */
  slotNumber: number;
  name: string;
  notes?: string;
  loadedAt: number;
}

class MightyToneDb extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  tones!: EntityTable<Tone, 'id'>;
  versions!: EntityTable<Version, 'id'>;
  irSlots!: EntityTable<IrSlot, 'id'>;

  constructor() {
    super('MightyToneDb');
    this.version(1).stores({
      sessions: '++id, createdAt, name',
      tones: '++id, sessionId, createdAt, archetype, instrument',
      versions: '++id, toneId, createdAt, qrString, patchJson, meta',
    });
    this.version(2).stores({
      sessions: '++id, createdAt, name',
      tones: '++id, sessionId, createdAt, archetype, instrument',
      versions: '++id, toneId, parentVersionId, createdAt, qrString, patchJson, meta',
    });
    this.version(3).stores({
      sessions: '++id, createdAt, name',
      tones: '++id, sessionId, createdAt, archetype, instrument',
      versions: '++id, toneId, parentVersionId, createdAt, qrString, patchJson, meta',
      irSlots: '++id, slotNumber, name, loadedAt',
    });
  }
}

export const db = new MightyToneDb();

export async function createSession(name: string): Promise<Session> {
  const createdAt = Date.now();
  const id = await db.sessions.add({ name, createdAt } as Session);
  return { id: id as number, name, createdAt };
}

export async function saveTone(
  sessionId: number,
  patch: Patch,
  meta: ToneMeta,
): Promise<{ tone: Tone; version: Version }> {
  const createdAt = Date.now();
  const preset = encodePreset(patch);
  const qrString = buildQrString(preset);
  const tone: Omit<Tone, 'id'> = {
    sessionId,
    archetype: meta.archetype,
    instrument: patch.blocks.amp?.modelId ?? 'unknown',
    createdAt,
  };
  const toneId = (await db.tones.add(tone as Tone)) as number;
  const version: Omit<Version, 'id'> = {
    toneId,
    qrString,
    patchJson: JSON.stringify(patch),
    meta: JSON.stringify(meta),
    createdAt,
  };
  const versionId = (await db.versions.add(version as Version)) as number;
  return {
    tone: { ...tone, id: toneId },
    version: { ...version, id: versionId },
  };
}

export async function listSessions(): Promise<Session[]> {
  return db.sessions.orderBy('createdAt').reverse().toArray();
}

export async function listTones(sessionId: number): Promise<Tone[]> {
  return db.tones.where('sessionId').equals(sessionId).sortBy('createdAt');
}

export async function getLatestVersion(toneId: number): Promise<Version | undefined> {
  return db.versions.where('toneId').equals(toneId).last();
}

export async function listVersions(toneId: number): Promise<Version[]> {
  return db.versions.where('toneId').equals(toneId).sortBy('createdAt');
}

export async function saveIrSlot(slotNumber: number, name: string, notes?: string): Promise<IrSlot> {
  const loadedAt = Date.now();
  // Replace existing slot with same number if present
  const existing = await db.irSlots.where('slotNumber').equals(slotNumber).first();
  if (existing?.id != null) {
    await db.irSlots.update(existing.id, { name, notes, loadedAt });
    return { ...existing, name, notes, loadedAt };
  }
  const id = await db.irSlots.add({ slotNumber, name, notes, loadedAt } as IrSlot);
  return { id: id as number, slotNumber, name, notes, loadedAt };
}

export async function listIrSlots(): Promise<IrSlot[]> {
  return db.irSlots.orderBy('slotNumber').toArray();
}

export async function deleteIrSlot(id: number): Promise<void> {
  await db.irSlots.delete(id);
}
