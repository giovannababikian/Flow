import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Pause, Play, Timer as TimerIcon, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BlockEditorSheet } from './components/BlockEditorSheet.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { FocusView, type ActiveTimerState } from './components/FocusView.tsx';
import { SyncBackupSheet } from './components/SyncBackupSheet.tsx';
import { TodayView } from './components/TodayView.tsx';
import { TopBar } from './components/TopBar.tsx';
import { addDays, dateKey, fmtCountdown, uid } from './lib/dateUtils.ts';
import {
  getStoredTheme,
  getWorkspaceId,
  loadLocalStateAsync,
  loadLocalStateSync,
  saveLocalState,
  setPendingSync,
  setStoredTheme,
  setWorkspaceId as persistWorkspaceId,
} from './lib/storage.ts';
import {
  CLIENT_ID,
  createManualCloudBackup,
  fetchWorkspaceFromCloud,
  getInitialLastSync,
  markSynced,
  mergeStatesSafely,
  pushSyncToCloud,
  resolveSyncStatus,
  restoreCloudBackup,
  useOnlineStatus,
} from './lib/syncEngine.ts';
import type {
  AppScreen,
  Block,
  BulletItem,
  BulletType,
  CloudBackupMeta,
  HabitColor,
  PlannerState,
} from './lib/types.ts';

export default function App() {
  const [state, setState] = useState<PlannerState>(() => loadLocalStateSync());
  const [screen, setScreen] = useState<AppScreen>('today');
  const [displayDate, setDisplayDate] = useState<Date>(() => new Date());
  const [now, setNow] = useState<Date>(() => new Date());
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getStoredTheme());

  // Sync & Cloud state
  const isOnline = useOnlineStatus();
  const [workspaceId, setWorkspaceId] = useState<string>(() => getWorkspaceId());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<number | null>(() => getInitialLastSync());
  const [connectedClients, setConnectedClients] = useState(1);
  const [backups, setBackups] = useState<CloudBackupMeta[]>([]);

  // Modals / Sheets
  const [editorState, setEditorState] = useState<{
    block: Block | null;
    start: number;
    defaultTitle?: string;
    initialTab?: 'block' | 'habit';
  } | null>(null);
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);

  // Time Management Focus Timer
  const [timer, setTimer] = useState<ActiveTimerState>({
    title: 'Sessão de foco profundo',
    totalSeconds: 25 * 60,
    remainingSeconds: 25 * 60,
    running: false,
  });

  const isRemoteRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Apply theme class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    setStoredTheme(theme);
  }, [theme]);

  // Hydrate from IndexedDB if fresher
  useEffect(() => {
    let active = true;
    loadLocalStateAsync().then((idbState) => {
      if (!active) return;
      if (idbState.updatedAt > stateRef.current.updatedAt) {
        isRemoteRef.current = true;
        setState(idbState);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Clock tick
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  // Focus Timer tick
  useEffect(() => {
    if (!timer.running) return;
    const interval = window.setInterval(() => {
      setTimer((prev) => {
        if (!prev.running) return prev;
        if (prev.remainingSeconds <= 1) {
          // Complete focus session
          const completedAt = Date.now();
          setState((s) => ({
            ...s,
            focusSessions: [
              {
                id: uid(),
                title: prev.title,
                dateKey: dateKey(new Date()),
                durationSeconds: prev.totalSeconds,
                blockId: prev.blockId,
                bulletId: prev.bulletId,
                habitId: prev.habitId,
                completedAt,
              },
              ...s.focusSessions,
            ],
            updatedAt: completedAt,
          }));
          return {
            ...prev,
            running: false,
            remainingSeconds: prev.totalSeconds,
          };
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timer.running]);

  const flushSync = useCallback(
    async (targetState: PlannerState, targetWorkspace: string) => {
      if (!navigator.onLine) {
        setPendingSync(true);
        return;
      }
      setIsSyncing(true);
      setSyncError(false);
      try {
        const res = await pushSyncToCloud(targetWorkspace, targetState);
        markSynced(res.serverTime);
        setLastCloudSyncAt(res.serverTime);
        if (res.newBackup) {
          setBackups((prev) => [res.newBackup!, ...prev].slice(0, 25));
        }
        // Only apply merged remote state if it actually brings newer updates
        if (res.state.updatedAt > stateRef.current.updatedAt) {
          isRemoteRef.current = true;
          setState(res.state);
          void saveLocalState(res.state);
        }
      } catch {
        setPendingSync(true);
        setSyncError(true);
      } finally {
        setIsSyncing(false);
      }
    },
    []
  );

  // Persist locally on every state change & debounce cloud sync
  useEffect(() => {
    void saveLocalState(state);
    if (isRemoteRef.current) {
      isRemoteRef.current = false;
      return;
    }
    setPendingSync(true);
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      void flushSync(stateRef.current, workspaceId);
    }, 220);

    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [state, workspaceId, flushSync]);

  // Initial fetch & WebSocket real-time subscription per workspaceId
  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimeout: number | null = null;

    const initCloud = async () => {
      if (!navigator.onLine) return;
      try {
        const { state: remoteState, backups: cloudBackups } =
          await fetchWorkspaceFromCloud(workspaceId);
        if (cancelled) return;
        setBackups(cloudBackups);
        if (remoteState) {
          const merged = mergeStatesSafely(stateRef.current, remoteState);
          isRemoteRef.current = true;
          setState(merged);
          void saveLocalState(merged);
          await flushSync(merged, workspaceId);
        } else {
          await flushSync(stateRef.current, workspaceId);
        }
      } catch {
        // Offline or transient failure handled cleanly
      }
    };

    const connectWs = () => {
      if (cancelled || !navigator.onLine) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/ws?workspace=${encodeURIComponent(
        workspaceId
      )}&clientId=${encodeURIComponent(CLIENT_ID)}`;
      ws = new WebSocket(url);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            state?: PlannerState;
            count?: number;
            senderClientId?: string;
            serverTime?: number;
          };
          if (msg.type === 'presence:count' && typeof msg.count === 'number') {
            setConnectedClients(msg.count);
          } else if (msg.type === 'sync:state' && msg.state && msg.senderClientId !== CLIENT_ID) {
            const merged = mergeStatesSafely(stateRef.current, msg.state);
            isRemoteRef.current = true;
            setState(merged);
            void saveLocalState(merged);
            if (msg.serverTime) {
              markSynced(msg.serverTime);
              setLastCloudSyncAt(msg.serverTime);
            }
          }
        } catch {
          // Ignore malformed WS frame
        }
      };

      ws.onclose = () => {
        if (!cancelled) {
          reconnectTimeout = window.setTimeout(connectWs, 3000);
        }
      };
    };

    void initCloud();
    connectWs();

    return () => {
      cancelled = true;
      if (reconnectTimeout) window.clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [workspaceId, isOnline, flushSync]);

  // Flush pending offline edits automatically when back online
  useEffect(() => {
    if (isOnline) {
      void flushSync(stateRef.current, workspaceId);
    }
  }, [isOnline, workspaceId, flushSync]);

  const activeDateKey = dateKey(displayDate);
  const pendingBulletsCount = useMemo(
    () =>
      state.bullets.filter(
        (b) => b.dateKey === dateKey(now) && !b.done && b.type !== 'note'
      ).length,
    [state.bullets, now]
  );

  // Mutations
  const mutateState = useCallback((updater: (prev: PlannerState) => PlannerState) => {
    setState((prev) => {
      const next = updater(prev);
      return { ...next, updatedAt: Date.now() };
    });
  }, []);

  const handleToggleBlockDone = (blockId: string) => {
    const ts = Date.now();
    mutateState((s) => {
      const cur = s.completions[activeDateKey] ?? [];
      const next = cur.includes(blockId)
        ? cur.filter((id) => id !== blockId)
        : [...cur, blockId];
      return {
        ...s,
        completions: { ...s.completions, [activeDateKey]: next },
        completionsUpdatedAt: { ...s.completionsUpdatedAt, [activeDateKey]: ts },
      };
    });
  };

  const handleMoveBlockTime = (blockId: string, newStart: number) => {
    const ts = Date.now();
    mutateState((s) => ({
      ...s,
      blocks: s.blocks.map((b) =>
        b.id === blockId ? { ...b, start: newStart, updatedAt: ts } : b
      ),
    }));
  };

  const handleSaveBlock = (block: Block) => {
    mutateState((s) => ({
      ...s,
      blocks: s.blocks.some((b) => b.id === block.id)
        ? s.blocks.map((b) => (b.id === block.id ? block : b))
        : [...s.blocks, block],
    }));
  };

  const handleDeleteBlock = (blockId: string) => {
    const ts = Date.now();
    mutateState((s) => {
      const completions: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(s.completions)) {
        completions[k] = v.filter((id) => id !== blockId);
      }
      return {
        ...s,
        blocks: s.blocks.filter((b) => b.id !== blockId),
        completions,
        deletedIds: { ...s.deletedIds, [blockId]: ts },
      };
    });
  };

  const handleAddHabit = (name: string, color: HabitColor): string => {
    const id = `hab-${uid()}`;
    const ts = Date.now();
    mutateState((s) => ({
      ...s,
      habits: [
        ...s.habits,
        { id, name, color, mark: name.charAt(0).toUpperCase() || 'H', updatedAt: ts },
      ],
    }));
    return id;
  };

  const handleUpdateDayRange = (start: number, end: number) => {
    mutateState((s) => ({
      ...s,
      dayRange: { start, end, updatedAt: Date.now() },
    }));
  };

  const handleAddBullet = (type: BulletType, text: string, targetKey = activeDateKey) => {
    const ts = Date.now();
    mutateState((s) => ({
      ...s,
      bullets: [
        ...s.bullets,
        {
          id: `bul-${uid()}`,
          dateKey: targetKey,
          type,
          text: text.slice(0, 280),
          done: false,
          order: s.bullets.length,
          createdAt: ts,
          updatedAt: ts,
        },
      ],
    }));
  };

  const handleToggleBullet = (id: string) => {
    const ts = Date.now();
    mutateState((s) => ({
      ...s,
      bullets: s.bullets.map((b) =>
        b.id === id ? { ...b, done: !b.done, updatedAt: ts } : b
      ),
    }));
  };

  const handleEditBulletText = (id: string, text: string) => {
    const ts = Date.now();
    mutateState((s) => ({
      ...s,
      bullets: s.bullets.map((b) =>
        b.id === id ? { ...b, text: text.slice(0, 280), updatedAt: ts } : b
      ),
    }));
  };

  const handleMigrateBulletTomorrow = (id: string) => {
    const ts = Date.now();
    const tomorrowKey = dateKey(addDays(displayDate, 1));
    mutateState((s) => ({
      ...s,
      bullets: s.bullets.map((b) =>
        b.id === id
          ? { ...b, dateKey: tomorrowKey, migratedTo: tomorrowKey, updatedAt: ts }
          : b
      ),
    }));
  };

  const handleDeleteBullet = (id: string) => {
    const ts = Date.now();
    mutateState((s) => ({
      ...s,
      bullets: s.bullets.filter((b) => b.id !== id),
      deletedIds: { ...s.deletedIds, [id]: ts },
    }));
  };

  const handleScheduleBullet = (bullet: BulletItem) => {
    const defaultStart = Math.max(
      state.dayRange.start,
      Math.min(state.dayRange.end - 60, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30)
    );
    setEditorState({
      block: null,
      start: bullet.timeMinutes ?? defaultStart,
      defaultTitle: bullet.text,
    });
  };

  // Custom Timer handlers
  const handleCreateCustomTimer = (minutes: number, label: string) => {
    const ts = Date.now();
    const id = `tmr-${uid()}`;
    mutateState((s) => ({
      ...s,
      customTimers: [...s.customTimers, { id, label, minutes, updatedAt: ts }],
    }));
    const secs = minutes * 60;
    setTimer({
      title: label,
      totalSeconds: secs,
      remainingSeconds: secs,
      running: false,
    });
  };

  const handleDeleteCustomTimer = (id: string) => {
    const ts = Date.now();
    mutateState((s) => ({
      ...s,
      customTimers: s.customTimers.filter((t) => t.id !== id),
      deletedIds: { ...s.deletedIds, [id]: ts },
    }));
  };

  // Focus handlers
  const handleStartFocus = (
    title: string,
    durationMinutes: number,
    refs?: { blockId?: string; bulletId?: string; habitId?: string }
  ) => {
    const secs = Math.max(60, durationMinutes * 60);
    setTimer({
      title,
      totalSeconds: secs,
      remainingSeconds: secs,
      running: true,
      blockId: refs?.blockId,
      bulletId: refs?.bulletId,
      habitId: refs?.habitId,
    });
    setScreen('focus');
  };

  const handleCompleteFocusSession = () => {
    const elapsed = Math.max(60, timer.totalSeconds - timer.remainingSeconds);
    const completedAt = Date.now();
    mutateState((s) => ({
      ...s,
      focusSessions: [
        {
          id: uid(),
          title: timer.title,
          dateKey: dateKey(new Date()),
          durationSeconds: elapsed,
          blockId: timer.blockId,
          bulletId: timer.bulletId,
          habitId: timer.habitId,
          completedAt,
        },
        ...s.focusSessions,
      ],
    }));
    setTimer((prev) => ({
      ...prev,
      running: false,
      remainingSeconds: prev.totalSeconds,
    }));
  };

  // Cloud backup handlers
  const handleChangeWorkspace = (nextId: string) => {
    persistWorkspaceId(nextId);
    setWorkspaceId(nextId);
  };

  const handleManualBackup = async () => {
    const res = await createManualCloudBackup(workspaceId, state, 'Backup manual');
    setBackups(res.backups);
  };

  const handleRestoreBackup = async (backupId: string) => {
    const restored = await restoreCloudBackup(workspaceId, backupId);
    isRemoteRef.current = true;
    setState(restored);
    void saveLocalState(restored);
    const ts = Date.now();
    markSynced(ts);
    setLastCloudSyncAt(ts);
  };

  const handleImportState = (imported: PlannerState) => {
    setState(imported);
  };

  const syncStatus = resolveSyncStatus(isOnline, isSyncing, syncError);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen overflow-x-hidden bg-[#F6F7F9] text-slate-900 pb-24 md:pb-12 dark:bg-[#0B0F17] dark:text-slate-100">
        <TopBar
          screen={screen}
          onNavigate={setScreen}
          syncStatus={syncStatus}
          connectedClients={connectedClients}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onOpenSync={() => setSyncSheetOpen(true)}
          onQuickAdd={() => setEditorState({ block: null, start: 9 * 60 })}
        />

        {!isOnline && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/60 dark:text-amber-200">
            <span className="inline-flex items-center gap-1.5">
              <WifiOff className="size-3.5" />
              Modo offline — todas as edições estão seguras localmente e serão sincronizadas ao reconectar.
            </span>
          </div>
        )}

        <main className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6">
          <AnimatePresence mode="wait">
            {screen === 'today' && (
              <motion.div
                key="today"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              >
                <TodayView
                  state={state}
                  displayDate={displayDate}
                  now={now}
                  onSelectDate={setDisplayDate}
                  onToggleBlockDone={handleToggleBlockDone}
                  onMoveBlockTime={handleMoveBlockTime}
                  onOpenBlockEditor={(block, start, defaultTitle) =>
                    setEditorState({ block, start, defaultTitle })
                  }
                  onUpdateDayRange={handleUpdateDayRange}
                  onAddBullet={(type, text) => handleAddBullet(type, text)}
                  onToggleBullet={handleToggleBullet}
                  onEditBulletText={handleEditBulletText}
                  onMigrateBulletTomorrow={handleMigrateBulletTomorrow}
                  onDeleteBullet={handleDeleteBullet}
                  onScheduleBullet={handleScheduleBullet}
                  onStartFocus={handleStartFocus}
                />
              </motion.div>
            )}

            {screen === 'focus' && (
              <motion.div
                key="focus"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              >
                <FocusView
                  state={state}
                  displayDate={displayDate}
                  timer={timer}
                  onSetPreset={(minutes, label) =>
                    setTimer({
                      title: label ?? 'Sessão de foco profundo',
                      totalSeconds: minutes * 60,
                      remainingSeconds: minutes * 60,
                      running: false,
                    })
                  }
                  onCreateCustomTimer={handleCreateCustomTimer}
                  onDeleteCustomTimer={handleDeleteCustomTimer}
                  onSelectTarget={(title, minutes, refs) =>
                    setTimer({
                      title,
                      totalSeconds: minutes * 60,
                      remainingSeconds: minutes * 60,
                      running: false,
                      blockId: refs?.blockId,
                      bulletId: refs?.bulletId,
                      habitId: refs?.habitId,
                    })
                  }
                  onToggleRun={() =>
                    setTimer((prev) => ({ ...prev, running: !prev.running }))
                  }
                  onResetTimer={() =>
                    setTimer((prev) => ({
                      ...prev,
                      running: false,
                      remainingSeconds: prev.totalSeconds,
                    }))
                  }
                  onCompleteSession={handleCompleteFocusSession}
                  onOpenNewHabit={() =>
                    setEditorState({ block: null, start: 9 * 60, initialTab: 'habit' })
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Floating Mini-Timer when running outside Focus screen */}
        <AnimatePresence>
          {timer.running && screen !== 'focus' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="fixed bottom-20 right-3 z-30 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-900 px-3 py-2 text-white shadow-lg md:bottom-5 md:right-6 dark:border-slate-700"
            >
              <button
                type="button"
                onClick={() => setScreen('focus')}
                className="flex items-center gap-2 text-left"
              >
                <TimerIcon className="size-4 text-blue-400" />
                <span className="font-mono text-sm font-bold tabular-nums">
                  {fmtCountdown(timer.remainingSeconds)}
                </span>
                <span className="hidden max-w-[140px] truncate text-xs text-slate-300 sm:inline">
                  {timer.title}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTimer((prev) => ({ ...prev, running: !prev.running }))}
                className="grid size-8 place-items-center rounded-lg bg-white/15 hover:bg-white/25"
                aria-label={timer.running ? 'Pausar timer' : 'Retomar timer'}
              >
                {timer.running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <BottomNav
          screen={screen}
          onNavigate={setScreen}
          pendingBulletsCount={pendingBulletsCount}
        />

        <AnimatePresence>
          {editorState && (
            <BlockEditorSheet
              state={state}
              initial={editorState.block}
              initialTab={editorState.initialTab}
              defaultStart={editorState.start}
              defaultDateKey={activeDateKey}
              defaultTitle={editorState.defaultTitle}
              onClose={() => setEditorState(null)}
              onAddHabit={handleAddHabit}
              onSave={handleSaveBlock}
              onDelete={handleDeleteBlock}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {syncSheetOpen && (
            <SyncBackupSheet
              workspaceId={workspaceId}
              onChangeWorkspace={handleChangeWorkspace}
              syncStatus={syncStatus}
              lastCloudSyncAt={lastCloudSyncAt}
              connectedClients={connectedClients}
              backups={backups}
              state={state}
              onManualBackup={handleManualBackup}
              onRestoreBackup={handleRestoreBackup}
              onImportState={handleImportState}
              onClose={() => setSyncSheetOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
