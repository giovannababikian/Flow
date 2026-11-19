import { CheckCircle2, Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { useMemo } from 'react';
import { HABIT_COLORS } from '../lib/colors.ts';
import {
  blocksForDate,
  computeTimeBudget,
  dateKey,
  fmtCountdown,
  fmtDuration,
  habitStreak,
  weekSummary,
} from '../lib/dateUtils.ts';
import type { HabitColor, PlannerState } from '../lib/types.ts';

export interface ActiveTimerState {
  title: string;
  totalSeconds: number;
  remainingSeconds: number;
  running: boolean;
  blockId?: string;
  bulletId?: string;
  habitId?: string;
}

interface FocusViewProps {
  state: PlannerState;
  displayDate: Date;
  timer: ActiveTimerState;
  onSetPreset: (minutes: number) => void;
  onSelectTarget: (
    title: string,
    durationMinutes: number,
    refs?: { blockId?: string; bulletId?: string; habitId?: string }
  ) => void;
  onToggleRun: () => void;
  onResetTimer: () => void;
  onCompleteSession: () => void;
  onOpenNewHabit: () => void;
}

export function FocusView({
  state,
  displayDate,
  timer,
  onSetPreset,
  onSelectTarget,
  onToggleRun,
  onResetTimer,
  onCompleteSession,
  onOpenNewHabit,
}: FocusViewProps) {
  const activeKey = dateKey(displayDate);
  const todayBlocks = useMemo(
    () => blocksForDate(state.blocks, displayDate),
    [state.blocks, displayDate]
  );
  const pendingBullets = useMemo(
    () => state.bullets.filter((b) => b.dateKey === activeKey && !b.done && b.type !== 'note'),
    [state.bullets, activeKey]
  );

  const budget = useMemo(() => computeTimeBudget(state, displayDate), [state, displayDate]);
  const week = useMemo(() => weekSummary(state, displayDate), [state, displayDate]);
  const weekPct = Math.round(
    (week.reduce((a, d) => a + d.done, 0) /
      Math.max(1, week.reduce((a, d) => a + d.total, 0))) *
      100
  );

  const todaySessions = useMemo(
    () => state.focusSessions.filter((s) => s.dateKey === activeKey),
    [state.focusSessions, activeKey]
  );

  const progress = timer.totalSeconds > 0 ? 1 - timer.remainingSeconds / timer.totalSeconds : 0;
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* Left: Time Management & Focus Timer */}
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6 dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Tempo & Foco
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cronômetro integrado ao seu orçamento diário
              </p>
            </div>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {[15, 25, 50].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onSetPreset(m)}
                  className={`min-h-[34px] rounded-md px-2.5 font-mono text-xs font-semibold tabular-nums transition-colors ${
                    Math.round(timer.totalSeconds / 60) === m
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-950 dark:text-white'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          {/* Circular Countdown */}
          <div className="my-6 flex flex-col items-center">
            <div className="relative grid size-48 place-items-center sm:size-52">
              <svg className="size-full -rotate-90" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="7"
                  className="text-slate-100 dark:text-slate-800"
                />
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="text-blue-600 transition-[stroke-dashoffset] duration-500 dark:text-blue-400"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                <span className="font-mono text-4xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
                  {fmtCountdown(timer.remainingSeconds)}
                </span>
                <span className="mt-1.5 line-clamp-2 max-w-[140px] text-xs font-medium text-slate-500 dark:text-slate-400">
                  {timer.title}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={onResetTimer}
                className="grid size-12 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Reiniciar timer"
                title="Reiniciar"
              >
                <RotateCcw className="size-4" />
              </button>

              <button
                type="button"
                onClick={onToggleRun}
                className="flex min-h-[48px] min-w-[148px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white transition-transform hover:bg-slate-800 active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                {timer.running ? (
                  <>
                    <Pause className="size-4" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    <span>Iniciar foco</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onCompleteSession}
                className="grid size-12 place-items-center rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400"
                aria-label="Registrar sessão concluída"
                title="Registrar foco concluído"
              >
                <CheckCircle2 className="size-5" />
              </button>
            </div>
          </div>

          {(todayBlocks.length > 0 || pendingBullets.length > 0) && (
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Vincular a uma atividade de hoje
              </p>
              <div className="flex flex-wrap gap-1.5">
                {todayBlocks.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() =>
                      onSelectTarget(b.title, Math.min(90, b.duration), {
                        blockId: b.id,
                        habitId: b.habitId,
                      })
                    }
                    className={`min-h-[36px] rounded-lg px-3 text-xs font-medium transition-colors ${
                      timer.blockId === b.id
                        ? 'bg-slate-900 text-white dark:bg-blue-600'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {b.title} · {b.duration}m
                  </button>
                ))}
                {pendingBullets.slice(0, 4).map((bul) => (
                  <button
                    key={bul.id}
                    type="button"
                    onClick={() => onSelectTarget(bul.text, 25, { bulletId: bul.id })}
                    className={`min-h-[36px] max-w-[220px] truncate rounded-lg px-3 text-xs font-medium transition-colors ${
                      timer.bulletId === bul.id
                        ? 'bg-slate-900 text-white dark:bg-blue-600'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    • {bul.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Clean Unboxed Time Budget */}
        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900">
          <h2 className="mb-4 font-display text-base font-bold text-slate-900 dark:text-white">
            Orçamento do dia
          </h2>
          <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">
            <div className="pr-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">Planejado</p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {fmtDuration(budget.plannedMinutes)}
              </p>
            </div>
            <div className="px-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">Focado</p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums text-blue-600 dark:text-blue-400">
                {budget.focusedMinutes}m
              </p>
            </div>
            <div className="pl-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">Livre</p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {fmtDuration(budget.freeMinutes)}
              </p>
            </div>
          </div>

          {todaySessions.length > 0 && (
            <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100 pt-2 dark:divide-slate-800 dark:border-slate-800">
              {todaySessions.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 text-xs">
                  <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                    {s.title}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {Math.max(1, Math.round(s.durationSeconds / 60))}m ·{' '}
                    {new Date(s.completedAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Right: Streaks & Weekly Rhythm */}
      <aside className="space-y-5">
        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Hábitos
            </h2>
            <button
              type="button"
              onClick={onOpenNewHabit}
              className="flex min-h-[34px] items-center gap-1 rounded-lg bg-slate-100 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            >
              <Plus className="size-3.5" />
              <span>Novo</span>
            </button>
          </div>

          {state.habits.length === 0 ? (
            <p className="py-5 text-center text-xs text-slate-400 dark:text-slate-500">
              Nenhum hábito criado ainda. Adicione o primeiro para acompanhar sequências.
            </p>
          ) : (
            <div className="space-y-4">
              {state.habits.map((h) => {
                const streak = habitStreak(state, h.id, displayDate);
                const pct = Math.min(100, Math.round((streak / 21) * 100));
                const c = HABIT_COLORS[h.color];
                return (
                  <div key={h.id} className="flex items-center gap-3">
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold ${c.bg} ${c.doneText}`}
                    >
                      {h.mark}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between">
                        <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {h.name}
                        </span>
                        <span className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                          {streak}d
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full ${c.bg}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-slate-900 p-5 text-white dark:border dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Esta semana</h2>
            <span className="font-mono text-xs tabular-nums text-slate-400">
              {todayBlocks.length} no dia
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {week.map((d) => {
              const colorClass = d.dominantColor
                ? HABIT_COLORS[d.dominantColor as HabitColor].bg
                : d.isToday
                  ? 'bg-white/10 ring-1 ring-white/30'
                  : 'bg-white/5';
              return (
                <div key={d.key} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`grid aspect-square w-full place-items-center rounded-lg text-xs font-bold ${colorClass}`}
                  >
                    {d.done > 0 ? '✓' : '·'}
                  </div>
                  <span
                    className={`text-[10px] ${
                      d.isToday ? 'font-bold text-white' : 'text-slate-400'
                    }`}
                  >
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
            <span className="text-xs text-slate-300">Conclusão semanal</span>
            <span className="font-mono text-lg font-bold tabular-nums">{weekPct}%</span>
          </div>
        </section>
      </aside>
    </div>
  );
}
