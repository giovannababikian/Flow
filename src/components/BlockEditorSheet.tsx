import { motion } from 'motion/react';
import { Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { HABIT_COLORS, HABIT_COLOR_KEYS } from '../lib/colors.ts';
import { ALL_DAYS, DAY_SHORT, fmtTime, frequencyLabel, parseTime, uid } from '../lib/dateUtils.ts';
import type { Block, HabitColor, PlannerState } from '../lib/types.ts';

interface BlockEditorSheetProps {
  state: PlannerState;
  initial: Block | null;
  initialTab?: 'block' | 'habit';
  defaultStart: number;
  defaultDateKey: string;
  defaultTitle?: string;
  onClose: () => void;
  onAddHabit: (name: string, color: HabitColor) => string;
  onSave: (block: Block) => void;
  onDelete: (id: string) => void;
}

export function BlockEditorSheet({
  state,
  initial,
  initialTab = 'block',
  defaultStart,
  defaultDateKey,
  defaultTitle = '',
  onClose,
  onAddHabit,
  onSave,
  onDelete,
}: BlockEditorSheetProps) {
  const [mode, setMode] = useState<'block' | 'habit'>(initialTab);
  const [habitId, setHabitId] = useState(initial?.habitId ?? state.habits[0]?.id ?? '');
  const [inlineHabitName, setInlineHabitName] = useState('');
  const [inlineHabitColor, setInlineHabitColor] = useState<HabitColor>('focus');
  const [title, setTitle] = useState(initial?.title ?? defaultTitle);
  const [start, setStart] = useState(fmtTime(initial?.start ?? defaultStart));
  const [duration, setDuration] = useState(initial?.duration ?? 45);
  const [scheduleType, setScheduleType] = useState<'recurring' | 'once'>(
    initial?.dateOverride ? 'once' : 'recurring'
  );
  const [days, setDays] = useState<number[]>(
    initial?.days?.length ? initial.days : [1, 2, 3, 4, 5]
  );

  // Dedicated new habit fields
  const [habitName, setHabitName] = useState('');
  const [habitColor, setHabitColor] = useState<HabitColor>('focus');

  const endMin = parseTime(start) + Math.max(5, Number(duration || 0));

  const handleSaveBlock = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || duration <= 0) return;
    if (scheduleType === 'recurring' && days.length === 0) return;

    let resolvedHabitId = habitId;
    if (!resolvedHabitId) {
      const nameToCreate = inlineHabitName.trim() || 'Rotina';
      resolvedHabitId = onAddHabit(nameToCreate.slice(0, 48), inlineHabitColor);
    }

    onSave({
      id: initial?.id ?? uid(),
      habitId: resolvedHabitId,
      title: title.trim().slice(0, 120),
      start: parseTime(start),
      duration: Math.max(5, Math.min(720, Number(duration))),
      days: scheduleType === 'recurring' ? [...days].sort() : [],
      dateOverride: scheduleType === 'once' ? (initial?.dateOverride ?? defaultDateKey) : undefined,
      updatedAt: Date.now(),
    });
    onClose();
  };

  const handleCreateHabit = (e: FormEvent) => {
    e.preventDefault();
    if (!habitName.trim()) return;
    const newId = onAddHabit(habitName.trim().slice(0, 48), habitColor);
    setHabitId(newId);
    setHabitName('');
    setMode('block');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={initial ? 'Editar atividade' : 'Agendar atividade'}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-200/80 bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6 dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-700" />

        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setMode('block')}
              className={`min-h-[36px] rounded-md px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                mode === 'block'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {initial ? 'Editar bloco' : 'Agendar bloco'}
            </button>
            {!initial && (
              <button
                type="button"
                onClick={() => setMode('habit')}
                className={`min-h-[36px] rounded-md px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  mode === 'habit'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Novo hábito
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        {mode === 'block' && (
          <form onSubmit={handleSaveBlock} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Atividade
              </span>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Revisão de projeto ou Corrida"
                className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:focus:border-blue-400 dark:focus:bg-slate-950"
              />
            </label>

            {state.habits.length > 0 ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Categoria / Hábito
                </span>
                <select
                  value={habitId}
                  onChange={(e) => setHabitId(e.target.value)}
                  className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white"
                >
                  {state.habits.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Criar categoria inicial
                </span>
                <div className="flex items-center gap-2">
                  <input
                    value={inlineHabitName}
                    onChange={(e) => setInlineHabitName(e.target.value)}
                    placeholder="Ex.: Foco, Saúde, Estudo"
                    className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white"
                  />
                  <div className="flex shrink-0 gap-1.5">
                    {HABIT_COLOR_KEYS.map((key) => {
                      const cfg = HABIT_COLORS[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setInlineHabitColor(key)}
                          className={`size-7 rounded-lg transition-transform ${cfg.bg} ${
                            inlineHabitColor === key
                              ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-slate-900'
                              : 'opacity-65 hover:opacity-100'
                          }`}
                          aria-label={cfg.label}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Início
                </span>
                <input
                  type="time"
                  step={300}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/70 px-3 font-mono text-sm tabular-nums text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Duração (min)
                </span>
                <input
                  type="number"
                  min={5}
                  max={720}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/70 px-3 font-mono text-sm tabular-nums text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white"
                />
              </label>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>
                Termina às{' '}
                <strong className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                  {fmtTime(endMin)}
                </strong>
              </span>
              <div className="flex gap-1.5">
                {[25, 45, 60, 90].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDuration(preset)}
                    className={`rounded-md px-2 py-1 font-mono text-[11px] font-medium tabular-nums transition-colors ${
                      duration === preset
                        ? 'bg-slate-900 text-white dark:bg-blue-600'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {preset}m
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Frequência
                </span>
                <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setScheduleType('recurring')}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      scheduleType === 'recurring'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Recorrente
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('once')}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      scheduleType === 'once'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Apenas este dia
                  </button>
                </div>
              </div>

              {scheduleType === 'recurring' && (
                <>
                  <div className="grid grid-cols-7 gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                      const on = days.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() =>
                            setDays(on ? days.filter((x) => x !== d) : [...days, d])
                          }
                          className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                            on
                              ? 'bg-slate-900 text-white dark:bg-blue-600'
                              : 'bg-slate-100 text-slate-500 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {DAY_SHORT[d].slice(0, 2)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{days.length ? frequencyLabel(days) : 'Selecione os dias'}</span>
                    <button
                      type="button"
                      onClick={() => setDays(days.length === 7 ? [1, 2, 3, 4, 5] : ALL_DAYS)}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {days.length === 7 ? 'Dias úteis' : 'Todos os dias'}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2">
              {initial && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(initial.id);
                    onClose();
                  }}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-rose-200 px-3.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="size-4" />
                  <span>Excluir</span>
                </button>
              )}
              <button
                type="submit"
                className="min-h-[44px] flex-1 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-slate-800 active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                {initial ? 'Salvar alterações' : 'Adicionar à agenda'}
              </button>
            </div>
          </form>
        )}

        {mode === 'habit' && (
          <form onSubmit={handleCreateHabit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Nome do hábito
              </span>
              <input
                autoFocus
                value={habitName}
                onChange={(e) => setHabitName(e.target.value)}
                placeholder="Ex.: Meditação, Inglês, Exercício"
                className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white"
              />
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Cor identificadora
              </span>
              <div className="flex gap-2.5">
                {HABIT_COLOR_KEYS.map((key) => {
                  const cfg = HABIT_COLORS[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setHabitColor(key)}
                      className={`grid size-11 place-items-center rounded-xl transition-transform active:scale-95 ${cfg.bg} ${
                        habitColor === key
                          ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-slate-900'
                          : 'opacity-75 hover:opacity-100'
                      }`}
                      aria-label={cfg.label}
                      title={cfg.label}
                    />
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="mt-2 min-h-[44px] rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              Criar hábito
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
