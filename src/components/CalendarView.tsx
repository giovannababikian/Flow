import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { HABIT_COLORS } from '../lib/colors.ts';
import {
  addDays,
  blocksForDate,
  dateKey,
  fmtTime,
  monthDates,
  sameDay,
  startOfWeek,
} from '../lib/dateUtils.ts';
import type { Block, PlannerState } from '../lib/types.ts';

interface CalendarViewProps {
  state: PlannerState;
  displayDate: Date;
  now: Date;
  onChangeDate: (d: Date) => void;
  onOpenDay: (d: Date) => void;
  onEditBlock: (b: Block) => void;
}

export function CalendarView({
  state,
  displayDate,
  now,
  onChangeDate,
  onOpenDay,
  onEditBlock,
}: CalendarViewProps) {
  const [mode, setMode] = useState<'week' | 'month'>('week');

  const movePeriod = (dir: -1 | 1) => {
    const next = new Date(displayDate);
    if (mode === 'month') next.setMonth(next.getMonth() + dir);
    else next.setDate(next.getDate() + dir * 7);
    onChangeDate(next);
  };

  const title =
    mode === 'month'
      ? displayDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      : `${startOfWeek(displayDate).toLocaleDateString('pt-BR', {
          day: 'numeric',
          month: 'short',
        })} – ${addDays(startOfWeek(displayDate), 6).toLocaleDateString('pt-BR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}`;

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-4 dark:border-slate-800/80 dark:bg-slate-900">
        <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {(['week', 'month'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`min-h-[36px] rounded-md px-3.5 text-xs font-semibold transition-colors ${
                mode === m
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-950 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {m === 'week' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>

        <h1 className="font-display text-base font-bold capitalize text-slate-900 sm:text-lg dark:text-white">
          {title}
        </h1>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => movePeriod(-1)}
            className="grid size-10 place-items-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            aria-label="Período anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onChangeDate(new Date())}
            className="min-h-[40px] rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => movePeriod(1)}
            className="grid size-10 place-items-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            aria-label="Próximo período"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </section>

      {mode === 'week' ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900">
          <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-7 md:divide-x md:divide-y-0 dark:divide-slate-800">
            {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(displayDate), i)).map(
              (day) => {
                const key = dateKey(day);
                const blocks = blocksForDate(state.blocks, day);
                const bullets = state.bullets.filter((b) => b.dateKey === key);
                const isToday = sameDay(day, now);
                return (
                  <div
                    key={key}
                    className="grid min-h-24 grid-cols-[72px_minmax(0,1fr)] md:block md:min-h-[460px]"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenDay(day)}
                      className={`flex flex-col items-center justify-center border-r border-slate-100 p-3 text-center transition-colors md:w-full md:border-b md:border-r-0 dark:border-slate-800 ${
                        isToday
                          ? 'bg-slate-900 text-white dark:bg-blue-600'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="text-[11px] font-semibold uppercase opacity-70">
                        {day.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)}
                      </span>
                      <span className="mt-0.5 font-mono text-xl font-bold tabular-nums">
                        {day.getDate()}
                      </span>
                      {bullets.length > 0 && (
                        <span className="mt-1 font-mono text-[10px] opacity-75">
                          {bullets.length} bullets
                        </span>
                      )}
                    </button>

                    <div className="grid grid-cols-1 gap-2 p-2.5 sm:grid-cols-2 md:flex md:flex-col">
                      {blocks.length === 0 ? (
                        <p className="py-4 text-center text-xs text-slate-400 sm:col-span-2">
                          Sem blocos
                        </p>
                      ) : (
                        blocks.map((b) => {
                          const habit = state.habits.find((h) => h.id === b.habitId);
                          if (!habit) return null;
                          const c = HABIT_COLORS[habit.color];
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => onEditBlock(b)}
                              className={`rounded-xl p-2.5 text-left ring-1 transition-transform active:scale-[0.98] ${c.soft} ${c.ring}`}
                            >
                              <span className="block font-mono text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
                                {fmtTime(b.start)}–{fmtTime(b.start + b.duration)}
                              </span>
                              <span className="mt-0.5 block truncate font-display text-xs font-semibold text-slate-900 dark:text-white">
                                {b.title}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
              <div
                key={d}
                className="py-2.5 text-center text-[11px] font-semibold uppercase text-slate-400"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDates(displayDate).map((day) => {
              const key = dateKey(day);
              const blocks = blocksForDate(state.blocks, day);
              const bulletCount = state.bullets.filter((b) => b.dateKey === key).length;
              const inMonth = day.getMonth() === displayDate.getMonth();
              const isToday = sameDay(day, now);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onOpenDay(day)}
                  className={`min-h-18 border-b border-r border-slate-100 p-1.5 text-left transition-colors hover:bg-slate-50 sm:min-h-24 sm:p-2.5 dark:border-slate-800 dark:hover:bg-slate-800/50 ${
                    inMonth ? '' : 'opacity-35'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`grid size-6 place-items-center rounded-full font-mono text-xs font-semibold tabular-nums sm:size-7 ${
                        isToday
                          ? 'bg-slate-900 text-white dark:bg-blue-600'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {bulletCount > 0 && (
                      <span className="font-mono text-[10px] tabular-nums text-slate-400">
                        •{bulletCount}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {blocks.map((b) => {
                      const habit = state.habits.find((h) => h.id === b.habitId);
                      return habit ? (
                        <span
                          key={b.id}
                          className={`size-2 rounded-full ${HABIT_COLORS[habit.color].dot}`}
                        />
                      ) : null;
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
