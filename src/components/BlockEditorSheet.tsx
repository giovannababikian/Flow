import { Copy, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
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
  defaultColor?: HabitColor;
  onClose: () => void;
  onAddHabit: (name: string, color: HabitColor) => string;
  onSave: (block: Block) => void;
  onDuplicate: (block: Block) => void;
  onDelete: (id: string) => void;
}

export function BlockEditorSheet({
  state,
  initial,
  initialTab = 'block',
  defaultStart,
  defaultDateKey,
  defaultTitle = '',
  defaultColor,
  onClose,
  onAddHabit,
  onSave,
  onDuplicate,
  onDelete,
}: BlockEditorSheetProps) {
  const initialHabit = initial?.habitId
    ? state.habits.find((h) => h.id === initial.habitId)
    : undefined;

  const [mode, setMode] = useState<'block' | 'habit'>(initialTab);
  const [habitId, setHabitId] = useState(initial?.habitId ?? '');
  const [color, setColor] = useState<HabitColor>(
    initial?.color ?? initialHabit?.color ?? defaultColor ?? 'focus'
  );
  const [title, setTitle] = useState(initial?.title ?? defaultTitle);
  const [start, setStart] = useState(fmtTime(initial?.start ?? defaultStart));
  const [durationText, setDurationText] = useState(String(initial?.duration ?? 45));
  const [scheduleType, setScheduleType] = useState<'recurring' | 'once'>(
    initial ? (initial.dateOverride ? 'once' : 'recurring') : 'once'
  );
  const [days, setDays] = useState<number[]>(
    initial?.days?.length ? initial.days : [1, 2, 3, 4, 5]
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dedicated new habit fields
  const [habitName, setHabitName] = useState('');
  const [habitColor, setHabitColor] = useState<HabitColor>('focus');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const parsedDuration = Math.max(5, Math.min(720, Number(durationText) || 45));
  const endMin = parseTime(start) + parsedDuration;

  const buildBlockPayload = (newId?: string): Block => ({
    id: newId ?? initial?.id ?? uid(),
    habitId: habitId || undefined,
    color,
    title: title.trim().slice(0, 120),
    start: parseTime(start),
    duration: parsedDuration,
    days: scheduleType === 'recurring' ? [...days].sort() : [],
    dateOverride: scheduleType === 'once' ? (initial?.dateOverride ?? defaultDateKey) : undefined,
    updatedAt: Date.now(),
  });

  const handleSaveBlock = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Digite um nome para a tarefa.');
      return;
    }
    const numDur = Number(durationText);
    if (!Number.isFinite(numDur) || numDur < 5) {
      setErrorMsg('A duração mínima é de 5 minutos.');
      return;
    }
    if (scheduleType === 'recurring' && days.length === 0) {
      setErrorMsg('Selecione ao menos um dia da semana.');
      return;
    }

    setErrorMsg(null);
    onSave(buildBlockPayload());
    onClose();
  };

  const handleDuplicate = () => {
    if (!title.trim()) {
      setErrorMsg('Digite um nome antes de duplicar.');
      return;
    }
    const base = buildBlockPayload(uid());
    const nextStart = Math.min(23 * 60 - base.duration, base.start + base.duration);
    onDuplicate({
      ...base,
      start: Math.max(0, nextStart),
      updatedAt: Date.now(),
    });
    onClose();
  };

  const handleCreateHabit = (e: FormEvent) => {
    e.preventDefault();
    if (!habitName.trim()) {
      setErrorMsg('Digite o nome do hábito.');
      return;
    }
    setErrorMsg(null);
    const newId = onAddHabit(habitName.trim().slice(0, 48), habitColor);
    setHabitId(newId);
    setColor(habitColor);
    setHabitName('');
    setMode('block');
  };

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={initial ? 'Editar tarefa' : 'Nova tarefa'}
    >
      <div
        className="max-h-[86dvh] w-full max-w-md overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-3xl border border-slate-200/80 bg-white p-5 pb-6 shadow-2xl sm:rounded-2xl sm:p-6 dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-700" />

        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setMode('block');
              }}
              className={`min-h-[36px] rounded-md px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                mode === 'block'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {initial ? 'Editar tarefa' : 'Nova tarefa'}
            </button>
            {!initial && (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setMode('habit');
                }}
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
            className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        {errorMsg && (
          <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
            {errorMsg}
          </p>
        )}

        {mode === 'block' && (
          <form onSubmit={handleSaveBlock} className="flex flex-col gap-4">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Nome da tarefa
              </span>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Ex.: Revisão, Treino, Reunião"
                className="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white sm:text-sm dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:focus:border-blue-400 dark:focus:bg-slate-950"
              />
            </label>

            {/* Per-Task Color Picker */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Cor da tarefa · {HABIT_COLORS[color].label}
              </span>
              <div className="flex flex-wrap gap-2">
                {HABIT_COLOR_KEYS.map((key) => {
                  const cfg = HABIT_COLORS[key];
                  const selected = color === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setColor(key)}
                      className={`size-9 rounded-xl transition-transform active:scale-95 ${cfg.bg} ${
                        selected
                          ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-slate-900'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      aria-label={`Cor ${cfg.label}`}
                      title={cfg.label}
                    />
                  );
                })}
              </div>
            </div>

            {state.habits.length > 0 && (
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Vincular hábito (opcional)
                </span>
                <select
                  value={habitId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setHabitId(nextId);
                    const matched = state.habits.find((h) => h.id === nextId);
                    if (matched) setColor(matched.color);
                  }}
                  className="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-base text-slate-900 outline-none focus:border-blue-600 sm:text-sm dark:border-slate-700 dark:bg-slate-800/70 dark:text-white"
                >
                  <option value="">Sem vínculo de hábito</option>
                  {state.habits.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Início
                </span>
                <input
                  type="time"
                  step={300}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 px-3 font-mono text-base tabular-nums text-slate-900 outline-none focus:border-blue-600 sm:text-sm dark:border-slate-700 dark:bg-slate-800/70 dark:text-white"
                />
              </label>

              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Duração (min)
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={durationText}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, '');
                    setDurationText(digits);
                  }}
                  className="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 px-3 font-mono text-base tabular-nums text-slate-900 outline-none focus:border-blue-600 sm:text-sm dark:border-slate-700 dark:bg-slate-800/70 dark:text-white"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
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
                    onClick={() => setDurationText(String(preset))}
                    className={`min-h-[32px] rounded-md px-2.5 font-mono text-xs font-medium tabular-nums transition-colors ${
                      Number(durationText) === preset
                        ? 'bg-slate-900 text-white dark:bg-blue-600'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Frequência
                </span>
                <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setScheduleType('once')}
                    className={`min-h-[32px] rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      scheduleType === 'once'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Apenas este dia
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('recurring')}
                    className={`min-h-[32px] rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      scheduleType === 'recurring'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Recorrente
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

            <div className="mt-1 flex flex-wrap items-center gap-2">
              {initial && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(initial.id);
                      onClose();
                    }}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-rose-200 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    title="Excluir tarefa"
                  >
                    <Trash2 className="size-4" />
                    <span>Excluir</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    title="Duplicar tarefa"
                  >
                    <Copy className="size-4" />
                    <span>Duplicar</span>
                  </button>
                </>
              )}
              <button
                type="submit"
                className="min-h-[44px] flex-1 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-slate-800 active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                {initial ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </form>
        )}

        {mode === 'habit' && (
          <form onSubmit={handleCreateHabit} className="flex flex-col gap-4">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Nome do hábito
              </span>
              <input
                value={habitName}
                onChange={(e) => {
                  setHabitName(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Ex.: Meditação, Inglês, Exercício"
                className="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-base text-slate-900 outline-none focus:border-blue-600 sm:text-sm dark:border-slate-700 dark:bg-slate-800/70 dark:text-white"
              />
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Cor identificadora
              </span>
              <div className="flex flex-wrap gap-2">
                {HABIT_COLOR_KEYS.map((key) => {
                  const cfg = HABIT_COLORS[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setHabitColor(key)}
                      className={`grid size-10 place-items-center rounded-xl transition-transform active:scale-95 ${cfg.bg} ${
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
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
