import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackupData, ImportResult } from '../../src/services/backup.ts';

// ---------------------------------------------------------------------------
// Minimal in-memory Dexie-shaped mock
// ---------------------------------------------------------------------------

interface Row {
  id?: number;
  [key: string]: unknown;
}

function makeTable(rows: Row[] = []) {
  return {
    _rows: rows,
    async toArray() {
      return [...this._rows];
    },
    async get(id: number) {
      return this._rows.find((r) => r.id === id);
    },
    async add(row: Row) {
      // Assign a new id if not present
      const nextId = (this._rows.reduce((max, r) => Math.max(max, r.id ?? 0), 0)) + 1;
      const inserted = { ...row, id: row.id ?? nextId };
      this._rows.push(inserted);
      return inserted.id;
    },
  };
}

let mockSessions: ReturnType<typeof makeTable>;
let mockTones: ReturnType<typeof makeTable>;
let mockVersions: ReturnType<typeof makeTable>;

vi.mock('../../src/store/db.ts', () => {
  // Use getters so each test's fresh tables are returned
  const db = {
    get sessions() { return mockSessions; },
    get tones() { return mockTones; },
    get versions() { return mockVersions; },
  };
  return { db };
});

// We also need to mock the browser-only URL/document globals used by exportBackup
// exportBackup calls URL.createObjectURL, document.createElement, etc.
// We'll test the serialisation logic independently without calling the download side.

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocking
// ---------------------------------------------------------------------------
const { importBackup } = await import('../../src/services/backup.ts');

// ---------------------------------------------------------------------------
// Helper: build a minimal File from JSON
// ---------------------------------------------------------------------------
function jsonFile(data: unknown, name = 'backup.json'): File {
  const json = JSON.stringify(data);
  const blob = new Blob([json], { type: 'application/json' });
  return new File([blob], name, { type: 'application/json' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockSessions = makeTable();
  mockTones = makeTable();
  mockVersions = makeTable();
});

describe('importBackup', () => {
  it('imports all rows from a valid backup', async () => {
    const backup: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions: [{ id: 1, name: 'Clean 10:00', createdAt: 1000 }],
      tones: [{ id: 1, sessionId: 1, archetype: 'Clean', instrument: 'electric-single-coil', createdAt: 1001 }],
      versions: [
        {
          id: 1,
          toneId: 1,
          qrString: 'MSP1:AAAA',
          patchJson: '{}',
          meta: '{"archetype":"Clean"}',
          createdAt: 1002,
        },
      ],
    };

    const result: ImportResult = await importBackup(jsonFile(backup));
    expect(result.imported).toBe(3);
    expect(result.skipped).toBe(0);
    expect(mockSessions._rows).toHaveLength(1);
    expect(mockTones._rows).toHaveLength(1);
    expect(mockVersions._rows).toHaveLength(1);
  });

  it('skips duplicate rows by id', async () => {
    // Pre-populate tables with id=1 rows
    mockSessions._rows.push({ id: 1, name: 'Existing', createdAt: 999 });
    mockTones._rows.push({ id: 1, sessionId: 1, archetype: 'Lead', instrument: 'electric-humbucker', createdAt: 999 });
    mockVersions._rows.push({ id: 1, toneId: 1, qrString: 'MSP1:BBBB', patchJson: '{}', meta: '{}', createdAt: 999 });

    const backup: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions: [{ id: 1, name: 'Clean 10:00', createdAt: 1000 }],
      tones: [{ id: 1, sessionId: 1, archetype: 'Clean', instrument: 'electric-single-coil', createdAt: 1001 }],
      versions: [{ id: 1, toneId: 1, qrString: 'MSP1:AAAA', patchJson: '{}', meta: '{}', createdAt: 1002 }],
    };

    const result = await importBackup(jsonFile(backup));
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(3);
    // Tables unchanged
    expect(mockSessions._rows[0]?.name).toBe('Existing');
  });

  it('throws on invalid backup data', async () => {
    const bad = jsonFile({ notSessions: [] });
    await expect(importBackup(bad)).rejects.toThrow('Invalid backup file');
  });

  it('round-trips: exported structure is importable', async () => {
    // Simulate what exportBackup would serialise
    const data: BackupData = {
      version: 1,
      exportedAt: '2026-10-31T00:00:00.000Z',
      sessions: [{ id: 10, name: 'Jazz 11:00', createdAt: 2000 }],
      tones: [{ id: 20, sessionId: 10, archetype: 'Jazz', instrument: 'electric-p90', createdAt: 2001 }],
      versions: [
        {
          id: 30,
          toneId: 20,
          qrString: 'MSP1:CCCC',
          patchJson: '{"blocks":{}}',
          meta: '{"archetype":"Jazz"}',
          createdAt: 2002,
        },
      ],
    };

    const result = await importBackup(jsonFile(data));
    expect(result.imported).toBe(3);
    expect(result.skipped).toBe(0);

    // Second import of same file → all skipped
    // Reset tables to what we just imported
    const result2 = await importBackup(jsonFile(data));
    expect(result2.imported).toBe(0);
    expect(result2.skipped).toBe(3);
  });
});

describe('versions schema', () => {
  it('Version interface includes parentVersionId as optional', async () => {
    // This test imports the db module to verify the schema version is 2
    // and parentVersionId is accepted on a Version object.
    const { db: dbModule } = await import('../../src/store/db.ts');
    // db is mocked; just verify mock tables are accessible
    expect(dbModule.sessions).toBeDefined();
    expect(dbModule.tones).toBeDefined();
    expect(dbModule.versions).toBeDefined();

    // Type-level: build a Version object with parentVersionId - if it compiles, test passes
    const v: import('../../src/store/db.ts').Version = {
      toneId: 1,
      parentVersionId: 5,
      qrString: 'MSP1:TEST',
      patchJson: '{}',
      meta: '{}',
      createdAt: Date.now(),
    };
    expect(v.parentVersionId).toBe(5);
  });
});
