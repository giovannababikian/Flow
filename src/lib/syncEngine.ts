import { useEffect, useState } from 'react';
import { mergePlannerStates } from './mergeState.ts';
import {
  getLastCloudSyncAt,
  getPendingSync,
  setLastCloudSyncAt,
  setPendingSync,
} from './storage.ts';
import type { CloudBackupMeta, PlannerState, SyncStatus } from './types.ts';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}

export const CLIENT_ID = `cli_${Math.random().toString(36).slice(2, 10)}`;

export async function fetchWorkspaceFromCloud(
  workspaceId: string
): Promise<{ state: PlannerState | null; backups: CloudBackupMeta[] }> {
  const res = await fetch(`/api/workspace/${encodeURIComponent(workspaceId)}`);
  if (!res.ok) throw new Error('Falha ao conectar com a nuvem');
  const data = (await res.json()) as {
    state: PlannerState | null;
    backups: CloudBackupMeta[];
  };
  return data;
}

export async function pushSyncToCloud(
  workspaceId: string,
  state: PlannerState
): Promise<{ state: PlannerState; serverTime: number; newBackup: CloudBackupMeta | null }> {
  const res = await fetch(`/api/workspace/${encodeURIComponent(workspaceId)}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, clientId: CLIENT_ID }),
  });
  if (!res.ok) throw new Error('Falha na sincronização');
  return (await res.json()) as {
    state: PlannerState;
    serverTime: number;
    newBackup: CloudBackupMeta | null;
  };
}

export async function createManualCloudBackup(
  workspaceId: string,
  state: PlannerState,
  label = 'Backup manual'
): Promise<{ backup: CloudBackupMeta; backups: CloudBackupMeta[] }> {
  const res = await fetch(`/api/workspace/${encodeURIComponent(workspaceId)}/backup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, label }),
  });
  if (!res.ok) throw new Error('Falha ao criar backup');
  return (await res.json()) as { backup: CloudBackupMeta; backups: CloudBackupMeta[] };
}

export async function restoreCloudBackup(
  workspaceId: string,
  backupId: string
): Promise<PlannerState> {
  const res = await fetch(
    `/api/workspace/${encodeURIComponent(workspaceId)}/restore/${encodeURIComponent(backupId)}`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error('Falha ao restaurar backup');
  const data = (await res.json()) as { state: PlannerState };
  return data.state;
}

export function resolveSyncStatus(isOnline: boolean, isSyncing: boolean, hasError: boolean): SyncStatus {
  if (!isOnline) return getPendingSync() ? 'pending' : 'offline';
  if (isSyncing) return 'syncing';
  if (hasError) return 'error';
  if (getPendingSync()) return 'pending';
  return 'synced';
}

export function markSynced(ts: number): void {
  setPendingSync(false);
  setLastCloudSyncAt(ts);
}

export function getInitialLastSync(): number | null {
  return getLastCloudSyncAt();
}

export function mergeStatesSafely(local: PlannerState, remote: PlannerState): PlannerState {
  return mergePlannerStates(local, remote);
}
