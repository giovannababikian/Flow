import type { PlannerState } from './types.ts';

function mergeEntitiesById<T extends { id: string; updatedAt: number }>(
  a: T[],
  b: T[],
  deletedIds: Record<string, number>
): T[] {
  const map = new Map<string, T>();
  for (const item of a) {
    const delAt = deletedIds[item.id] ?? 0;
    if (delAt >= item.updatedAt) continue;
    map.set(item.id, item);
  }
  for (const item of b) {
    const delAt = deletedIds[item.id] ?? 0;
    if (delAt >= item.updatedAt) continue;
    const prev = map.get(item.id);
    if (!prev || item.updatedAt >= prev.updatedAt) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

export function mergePlannerStates(local: PlannerState, remote: PlannerState): PlannerState {
  const deletedIds: Record<string, number> = { ...local.deletedIds };
  for (const [id, ts] of Object.entries(remote.deletedIds || {})) {
    if (!deletedIds[id] || ts > deletedIds[id]) {
      deletedIds[id] = ts;
    }
  }

  // Prune tombstones older than 30 days to keep payload lean
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const [id, ts] of Object.entries(deletedIds)) {
    if (ts < thirtyDaysAgo) {
      delete deletedIds[id];
    }
  }

  const habits = mergeEntitiesById(local.habits || [], remote.habits || [], deletedIds);
  const blocks = mergeEntitiesById(local.blocks || [], remote.blocks || [], deletedIds);
  const bullets = mergeEntitiesById(local.bullets || [], remote.bullets || [], deletedIds)
    .sort((x, y) => x.order - y.order || x.createdAt - y.createdAt);
  const notes = mergeEntitiesById(local.notes || [], remote.notes || [], deletedIds)
    .sort((x, y) => Number(y.pinned) - Number(x.pinned) || y.updatedAt - x.updatedAt);

  // Focus sessions are append-only (immutable once logged, use completedAt)
  const sessionMap = new Map<string, (typeof local.focusSessions)[number]>();
  for (const s of [...(local.focusSessions || []), ...(remote.focusSessions || [])]) {
    if (deletedIds[s.id]) continue;
    sessionMap.set(s.id, s);
  }
  const focusSessions = Array.from(sessionMap.values())
    .sort((x, y) => y.completedAt - x.completedAt)
    .slice(0, 500);

  const completions: Record<string, string[]> = {};
  const completionsUpdatedAt: Record<string, number> = {};
  const allDates = new Set([
    ...Object.keys(local.completions || {}),
    ...Object.keys(remote.completions || {}),
  ]);

  for (const dk of allDates) {
    const localTs = local.completionsUpdatedAt?.[dk] ?? 0;
    const remoteTs = remote.completionsUpdatedAt?.[dk] ?? 0;
    if (remoteTs > localTs) {
      completions[dk] = [...(remote.completions[dk] || [])];
      completionsUpdatedAt[dk] = remoteTs;
    } else {
      completions[dk] = [...(local.completions[dk] || [])];
      completionsUpdatedAt[dk] = localTs;
    }
  }

  const dayRange =
    (remote.dayRange?.updatedAt ?? 0) > (local.dayRange?.updatedAt ?? 0)
      ? remote.dayRange
      : local.dayRange;

  return {
    version: Math.max(local.version || 1, remote.version || 1),
    habits,
    blocks,
    bullets,
    notes,
    focusSessions,
    completions,
    completionsUpdatedAt,
    dayRange,
    deletedIds,
    updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0),
  };
}
