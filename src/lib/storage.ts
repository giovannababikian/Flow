import type { PlannerState } from './types.ts';

const DB_NAME = 'rhythm_flow_db';
const DB_VERSION = 2;
const STORE_NAME = 'kv';
const IDB_STATE_KEY = 'planner_state_v2';
const LS_STATE_KEY = 'rhythm_flow_state_v2';
const LS_WORKSPACE_KEY = 'rhythm_flow_workspace_id_v2';
const LS_PENDING_KEY = 'rhythm_flow_pending_sync_v2';
const LS_LAST_SYNC_KEY = 'rhythm_flow_last_sync_v2';
const LS_THEME_KEY = 'rhythm_flow_theme';

export function createInitialState(): PlannerState {
  const now = Date.now();
  return {
    version: 2,
    habits: [],
    blocks: [],
    bullets: [],
    notes: [],
    focusSessions: [],
    completions: {},
    completionsUpdatedAt: {},
    dayRange: {
      start: 6 * 60,
      end: 23 * 60,
      updatedAt: now,
    },
    deletedIds: {},
    updatedAt: now,
  };
}

function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export function loadLocalStateSync(): PlannerState {
  try {
    const raw = localStorage.getItem(LS_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlannerState;
      if (parsed && Array.isArray(parsed.habits) && Array.isArray(parsed.blocks)) {
        return {
          ...createInitialState(),
          ...parsed,
          bullets: parsed.bullets ?? [],
          notes: parsed.notes ?? [],
          focusSessions: parsed.focusSessions ?? [],
          deletedIds: parsed.deletedIds ?? {},
          completionsUpdatedAt: parsed.completionsUpdatedAt ?? {},
        };
      }
    }
  } catch {
    // Fallback to empty initial state
  }
  return createInitialState();
}

export async function loadLocalStateAsync(): Promise<PlannerState> {
  try {
    const db = await openDB();
    if (db) {
      const val = await new Promise<PlannerState | undefined>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(IDB_STATE_KEY);
        req.onsuccess = () => resolve(req.result as PlannerState | undefined);
        req.onerror = () => resolve(undefined);
      });
      if (val && Array.isArray(val.habits)) {
        return val;
      }
    }
  } catch {
    // Ignore IDB errors and fall back to localStorage
  }
  return loadLocalStateSync();
}

export async function saveLocalState(state: PlannerState): Promise<void> {
  try {
    localStorage.setItem(LS_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors
  }
  try {
    const db = await openDB();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(state, IDB_STATE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
  } catch {
    // Ignore IDB errors
  }
}

export function getWorkspaceId(): string {
  try {
    const existing = localStorage.getItem(LS_WORKSPACE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{3,48}$/.test(existing)) return existing;
    const generated = `rhythm-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(LS_WORKSPACE_KEY, generated);
    return generated;
  } catch {
    return 'rhythm-pessoal';
  }
}

export function setWorkspaceId(id: string): void {
  try {
    localStorage.setItem(LS_WORKSPACE_KEY, id);
  } catch {
    // Ignore
  }
}

export function getPendingSync(): boolean {
  try {
    return localStorage.getItem(LS_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function setPendingSync(pending: boolean): void {
  try {
    localStorage.setItem(LS_PENDING_KEY, pending ? '1' : '0');
  } catch {
    // Ignore
  }
}

export function getLastCloudSyncAt(): number | null {
  try {
    const raw = localStorage.getItem(LS_LAST_SYNC_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function setLastCloudSyncAt(ts: number): void {
  try {
    localStorage.setItem(LS_LAST_SYNC_KEY, String(ts));
  } catch {
    // Ignore
  }
}

export function getStoredTheme(): 'light' | 'dark' {
  try {
    const t = localStorage.getItem(LS_THEME_KEY);
    if (t === 'dark' || t === 'light') return t;
  } catch {
    // Ignore
  }
  return 'light';
}

export function setStoredTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(LS_THEME_KEY, theme);
  } catch {
    // Ignore
  }
}
