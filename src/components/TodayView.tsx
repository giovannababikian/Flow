import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  CalendarPlus,
  Check,
  Circle,
  Clock,
  GripVertical,
  Minus,
  MoreHorizontal,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { HABIT_COLORS } from '../lib/colors.ts';
import {
  addDays,
  blocksForDate,
  computeTimeBudget,
  dateKey,
  fmtDuration,
  fmtTime,
  frequencyLabel,
  parseTime,
  sameDay,
  startOfWeek,
} from '../lib/dateUtils.ts';
import type { Block, BulletItem, BulletType, PlannerState } from '../lib/types.ts';

interface TodayViewProps {
  state: PlannerState;
  displayDate: Date;
  now: Date;
  onSelectDate: (d: Date) => void;
  onToggleBlockDone: (blockId: string) => void;
  onMoveBlockTime: (blockId: string, newStart: number) => void;
  onOpenBlockEditor: (block: Block | null, startMinutes: number, defaultTitle?: string) => void;
  onUpdateDayRange: (start: number, end: number) => void;
  onAddBullet: (type: BulletType, text: string) => void;
  onToggleBullet: (id: string) => void;
  onEditBulletText: (id: string, text: string) => void;
  onMigrateBulletTomorrow: (id: string) => void;
  onDeleteBullet: (id: string) => void;
  onScheduleBullet: (bullet: BulletItem) => void;
  onStartFocus: (
    title: string,
    durationMinutes: number,
    refs?: { blockId?: string; bulletId?: string; habitId?: string }
  ) => void;
}

const BULLET_META: Record<BulletType, { label: string; symbol: string }> = {
  task: { label: 'Tarefa', symbol: '•' },
  priority: { label: 'Prioridade', symbol: '!' },
  event: { label: 'Evento', symbol: '◦' },
  note: { label: 'Nota', symbol: '–' },
};

export function TodayView({
  state,
  displayDate,
  now,
  onSelectDate,
  onToggleBlockDone,
  onMoveBlockTime,
  onOpenBlockEditor,
  onUpdateDayRange,
  onAddBullet,
  onToggleBullet,
  onEditBulletText,
  onMigrateBulletTomorrow,
  onDeleteBullet,
  onScheduleBullet,
  onStartFocus,
}: TodayViewProps) {
  const [mobilePane, setMobilePane] = useState<'all' | 'bullets' | 'timeline'>('all');
  const [bulletType, setBulletType] = useState<BulletType>('task');
  const [bulletInput, setBulletInput] = useState('');
  const [expandedBulletId, setExpandedBulletId] = useState<string | null>(null);
  const [editingBulletId, setEditingBulletId] = useState<string | null>(null);
  const [editingBulletText, setEditingBulletText] = useState('');

  // Timeline drag state
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragPreviewStart, setDragPreviewStart] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ blockId: string; pointerId: number; offset: number } | null>(null);
  const dragPreviewRef = useRef<number | null>(null);

  const activeKey = dateKey(displayDate);
  const isToday = sameDay(displayDate, now);
  const weekDays = useMemo(() => {
    const start = startOfWeek(displayDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [displayDate]);

  const dayBullets = useMemo(
    () =>
      state.bullets
        .filter((b) => b.dateKey === activeKey)
        .sort(
          (a, b) => Number(a.done) - Number(b.done) || a.order - b.order || a.createdAt - b.createdAt
        ),
    [state.bullets, activeKey]
  );

  const dayBlocks = useMemo(
    () => blocksForDate(state.blocks, displayDate),
    [state.blocks, displayDate]
  );

  const visibleBlocks = useMemo(
    () =>
      dayBlocks.filter(
        (b) => b.start < state.dayRange.end && b.start + b.duration > state.dayRange.start
      ),
    [dayBlocks, state.dayRange.end, state.dayRange.start]
  );

  const doneSet = useMemo(
    () => new Set(state.completions[activeKey] ?? []),
    [state.completions, activeKey]
  );

  const budget = useMemo(() => computeTimeBudget(state, displayDate), [state, displayDate]);

  const handleBulletInputChange = (val: string) => {
    if (val === '! ') {
      setBulletType('priority');
      setBulletInput('');
      return;
    }
    if (val === '- ') {
      setBulletType('note');
      setBulletInput('');
      return;
    }
    if (val === 'o ' || val === 'O ') {
      setBulletType('event');
      setBulletInput('');
      return;
    }
    if (val === '* ') {
      setBulletType('task');
      setBulletInput('');
      return;
    }
    setBulletInput(val);
  };

  const submitBullet = (e: FormEvent) => {
    e.preventDefault();
    const text = bulletInput.trim();
    if (!text) return;
    onAddBullet(bulletType, text);
    setBulletInput('');
  };

  const rangeSpan = Math.max(60, state.dayRange.end - state.dayRange.start);
  const timelineHeight = Math.max(440, (rangeSpan / 60) * 58);

  const minutesFromPointer = (clientY: number) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return null;
    const ratio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    return state.dayRange.start + ratio * rangeSpan;
  };

  const beginDrag = (event: ReactPointerEvent<HTMLElement>, block: Block) => {
    if (event.button !== 0 || !timelineRef.current) return;
    const pointerMinute = minutesFromPointer(event.clientY);
    if (pointerMinute === null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      blockId: block.id,
      pointerId: event.pointerId,
      offset: pointerMinute - block.start,
    };
    dragPreviewRef.current = block.start;
    setDraggedBlockId(block.id);
    setDragPreviewStart(block.start);
  };

  const updateDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const pointerMinute = minutesFromPointer(event.clientY);
    const block = state.blocks.find((item) => item.id === drag.blockId);
    if (pointerMinute === null || !block) return;
    const latestStart = state.dayRange.end - block.duration;
    const proposed = Math.round((pointerMinute - drag.offset) / 5) * 5;
    const nextStart = Math.max(state.dayRange.start, Math.min(latestStart, proposed));
    dragPreviewRef.current = nextStart;
    setDragPreviewStart(nextStart);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const finalStart = dragPreviewRef.current;
    if (finalStart !== null) {
      onMoveBlockTime(drag.blockId, finalStart);
    }
    dragRef.current = null;
    dragPreviewRef.current = null;
    setDraggedBlockId(null);
    setDragPreviewStart(null);
  };

  const cancelDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    dragPreviewRef.current = null;
    setDraggedBlockId(null);
    setDragPreviewStart(null);
  };

  const nowMin = now.getHours() * 60 + now.getMinutes();

  const showBullets = mobilePane === 'all' || mobilePane === 'bullets';
  const showTimeline = mobilePane === 'all' || mobilePane === 'timeline';

  return (
    <div className="space-y-5">
      {/* Unboxed Clean Date Header + 7-Day Thumb Scroller */}
      <section className="space-y-3 border-b border-slate-200/80 pb-4 dark:border-slate-800/80">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h1 className="font-display text-xl font-bold capitalize tracking-tight text-slate-900 sm:text-2xl dark:text-white">
              {displayDate.toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
              })}
            </h1>
            <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {fmtDuration(budget.plannedMinutes)} planejado · {fmtDuration(budget.freeMinutes)} livre ·{' '}
              {budget.focusedMinutes}m focado
            </p>
          </div>

          {!isToday && (
            <button
              type="button"
              onClick={() => onSelectDate(new Date())}
              className="min-h-[36px] shrink-0 rounded-lg bg-slate-200/70 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100"
            >
              Hoje
            </button>
          )}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {weekDays.map((d) => {
            const active = sameDay(d, displayDate);
            const todayMarker = sameDay(d, now);
            const key = dateKey(d);
            const hasActivity =
              state.bullets.some((b) => b.dateKey === key && !b.done) ||
              blocksForDate(state.blocks, d).length > 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDate(d)}
                className={`flex min-h-[54px] flex-col items-center justify-center rounded-xl py-1.5 transition-all active:scale-95 ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-blue-600'
                    : todayMarker
                      ? 'bg-blue-50/90 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300'
                      : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-900'
                }`}
              >
                <span className="text-[11px] font-medium uppercase opacity-70">
                  {d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)}
                </span>
                <span className="mt-0.5 font-mono text-sm font-bold tabular-nums">
                  {d.getDate()}
                </span>
                <span
                  className={`mt-1 size-1 rounded-full ${
                    active
                      ? 'bg-white/75'
                      : hasActivity
                        ? 'bg-blue-600 dark:bg-blue-400'
                        : 'bg-transparent'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Mobile Segmented Sub-Switch */}
        <div className="grid grid-cols-3 rounded-xl bg-slate-200/70 p-1 lg:hidden dark:bg-slate-900">
          {[
            { id: 'all', label: 'Tudo' },
            { id: 'bullets', label: `Bullets · ${dayBullets.filter((b) => !b.done).length}` },
            { id: 'timeline', label: `Linha · ${visibleBlocks.length}` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobilePane(tab.id as 'all' | 'bullets' | 'timeline')}
              className={`min-h-[38px] rounded-lg px-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                mobilePane === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Main Responsive Split: Timeline + Bullet Notes */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
        {/* Bullet Notes Panel (first on mobile for thumb-speed capture) */}
        {showBullets && (
          <section className="order-1 rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-5 lg:order-2 dark:border-slate-800/80 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Bullet Notes
              </h2>
              {dayBullets.length > 0 && (
                <span className="font-mono text-xs tabular-nums text-slate-400">
                  {dayBullets.filter((b) => b.done).length}/{dayBullets.length}
                </span>
              )}
            </div>

            {/* Rapid Capture Form */}
            <form onSubmit={submitBullet} className="mb-3 space-y-2">
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-1 focus-within:border-blue-600 focus-within:bg-white dark:border-slate-700/80 dark:bg-slate-800/50 dark:focus-within:border-blue-400 dark:focus-within:bg-slate-950">
                <button
                  type="button"
                  onClick={() => {
                    const order: BulletType[] = ['task', 'priority', 'event', 'note'];
                    const next = order[(order.indexOf(bulletType) + 1) % order.length];
                    setBulletType(next);
                  }}
                  className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-sm font-bold text-slate-800 ring-1 ring-slate-200/70 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
                  title={`Tipo: ${BULLET_META[bulletType].label}`}
                  aria-label={`Alternar tipo de bullet (${BULLET_META[bulletType].label})`}
                >
                  {BULLET_META[bulletType].symbol}
                </button>
                <input
                  value={bulletInput}
                  onChange={(e) => handleBulletInputChange(e.target.value)}
                  placeholder={`Adicionar ${BULLET_META[bulletType].label.toLowerCase()}...`}
                  className="min-h-[40px] min-w-0 flex-1 bg-transparent px-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-900 text-white transition-transform active:scale-95 dark:bg-blue-600"
                  aria-label="Adicionar bullet"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {(Object.keys(BULLET_META) as BulletType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBulletType(t)}
                    className={`min-h-[32px] shrink-0 rounded-lg px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      bulletType === t
                        ? 'bg-slate-900 text-white dark:bg-slate-700'
                        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    {BULLET_META[t].symbol} {BULLET_META[t].label}
                  </button>
                ))}
              </div>
            </form>

            {/* Clean Bullet List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {dayBullets.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                  Lista vazia · digite acima ou use <span className="font-mono">!</span>,{' '}
                  <span className="font-mono">-</span>, <span className="font-mono">o</span> para
                  alternar o tipo.
                </p>
              ) : (
                <AnimatePresence initial={false}>
                  {dayBullets.map((item) => {
                    const isExpanded = expandedBulletId === item.id;
                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.14 }}
                        className="py-2"
                      >
                        <div className="flex min-h-[44px] items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onToggleBullet(item.id)}
                            className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 transition-transform hover:bg-slate-100 active:scale-90 dark:text-slate-300 dark:hover:bg-slate-800"
                            aria-label={item.done ? 'Marcar como pendente' : 'Concluir bullet'}
                          >
                            {item.done ? (
                              <span className="grid size-5 place-items-center rounded-md bg-slate-900 text-white dark:bg-blue-600">
                                <Check className="size-3.5" strokeWidth={3} />
                              </span>
                            ) : item.type === 'priority' ? (
                              <Sparkles className="size-4 text-amber-500" />
                            ) : item.type === 'event' ? (
                              <Circle className="size-4 text-blue-600 dark:text-blue-400" />
                            ) : item.type === 'note' ? (
                              <Minus className="size-4 text-slate-400" />
                            ) : (
                              <span className="size-2.5 rounded-full bg-slate-900 dark:bg-slate-200" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            {editingBulletId === item.id ? (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (editingBulletText.trim()) {
                                    onEditBulletText(item.id, editingBulletText.trim());
                                  }
                                  setEditingBulletId(null);
                                }}
                              >
                                <input
                                  autoFocus
                                  value={editingBulletText}
                                  onChange={(e) => setEditingBulletText(e.target.value)}
                                  onBlur={() => {
                                    if (editingBulletText.trim()) {
                                      onEditBulletText(item.id, editingBulletText.trim());
                                    }
                                    setEditingBulletId(null);
                                  }}
                                  className="w-full rounded-lg border border-blue-500 bg-white px-2 py-1 text-sm text-slate-900 outline-none dark:bg-slate-950 dark:text-white"
                                />
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBulletId(item.id);
                                  setEditingBulletText(item.text);
                                }}
                                className={`w-full text-left text-sm leading-snug ${
                                  item.done
                                    ? 'text-slate-400 line-through dark:text-slate-500'
                                    : item.type === 'priority'
                                      ? 'font-semibold text-slate-950 dark:text-white'
                                      : 'text-slate-800 dark:text-slate-100'
                                }`}
                              >
                                {item.text}
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedBulletId((cur) => (cur === item.id ? null : item.id))
                            }
                            className={`grid size-10 shrink-0 place-items-center rounded-lg transition-colors ${
                              isExpanded
                                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800'
                            }`}
                            aria-label="Ações do bullet"
                            aria-expanded={isExpanded}
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </div>

                        {/* Clean Contextual Action Bar (saves horizontal space on mobile!) */}
                        {isExpanded && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-12">
                            {!item.done && item.type !== 'note' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedBulletId(null);
                                    onStartFocus(item.text, 25, { bulletId: item.id });
                                  }}
                                  className="flex min-h-[36px] items-center gap-1 rounded-lg bg-slate-100 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                                >
                                  <Play className="size-3" />
                                  <span>Focar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedBulletId(null);
                                    onScheduleBullet(item);
                                  }}
                                  className="flex min-h-[36px] items-center gap-1 rounded-lg bg-slate-100 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                                >
                                  <CalendarPlus className="size-3" />
                                  <span>Agendar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedBulletId(null);
                                    onMigrateBulletTomorrow(item.id);
                                  }}
                                  className="flex min-h-[36px] items-center gap-1 rounded-lg bg-slate-100 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                                >
                                  <ArrowRight className="size-3" />
                                  <span>Amanhã</span>
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedBulletId(null);
                                onDeleteBullet(item.id);
                              }}
                              className="flex min-h-[36px] items-center gap-1 rounded-lg bg-rose-50 px-2.5 text-xs font-medium text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400"
                            >
                              <Trash2 className="size-3" />
                              <span>Excluir</span>
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </section>
        )}

        {/* Interactive Vertical Timeline */}
        {showTimeline && (
          <section className="order-2 min-w-0 rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-6 lg:order-1 dark:border-slate-800/80 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5 dark:border-slate-800">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Linha do tempo
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {visibleBlocks.length === 0
                    ? 'Toque em qualquer horário para agendar'
                    : 'Arraste para mover · toque para editar'}
                </p>
              </div>
              <DayRangeEditor
                start={state.dayRange.start}
                end={state.dayRange.end}
                onChange={onUpdateDayRange}
              />
            </div>

            <div
              ref={timelineRef}
              className={`relative ml-12 border-l border-slate-200/80 sm:ml-14 dark:border-slate-800 ${
                draggedBlockId ? 'select-none' : ''
              }`}
              style={{ height: timelineHeight }}
              onDoubleClick={(e) => {
                const m = minutesFromPointer(e.clientY);
                if (m !== null) onOpenBlockEditor(null, Math.round(m / 15) * 15);
              }}
            >
              {Array.from(
                { length: Math.floor(rangeSpan / 60) + 1 },
                (_, i) => state.dayRange.start + i * 60
              ).map((minute) => (
                <button
                  key={minute}
                  type="button"
                  onClick={() => onOpenBlockEditor(null, minute)}
                  className="group absolute left-0 right-0 h-11 border-t border-slate-100 text-left transition-colors hover:bg-slate-50/80 dark:border-slate-800/80 dark:hover:bg-slate-800/30"
                  style={{ top: `${((minute - state.dayRange.start) / rangeSpan) * 100}%` }}
                  aria-label={`Agendar às ${fmtTime(minute)}`}
                >
                  <span className="absolute -left-12 w-10 -translate-y-1/2 text-right font-mono text-[11px] font-medium tabular-nums text-slate-400 group-hover:text-blue-600 sm:-left-14 sm:w-11 sm:text-xs dark:text-slate-500">
                    {fmtTime(minute)}
                  </span>
                </button>
              ))}

              {visibleBlocks.map((block) => {
                const habit = state.habits.find((h) => h.id === block.habitId);
                if (!habit) return null;
                const c = HABIT_COLORS[habit.color];
                const isDone = doneSet.has(block.id);
                const renderedStart =
                  draggedBlockId === block.id && dragPreviewStart !== null
                    ? dragPreviewStart
                    : block.start;

                return (
                  <div
                    key={block.id}
                    className={`absolute left-2 right-0 z-10 flex items-center justify-between gap-1.5 overflow-hidden rounded-xl pr-2 transition-shadow sm:left-3 sm:pr-2.5 ${
                      draggedBlockId === block.id ? 'z-30 shadow-xl ring-2 ring-blue-600' : ''
                    } ${
                      isDone
                        ? `${c.bg} ${c.doneText}`
                        : `${c.soft} ring-1 ${c.ring} text-slate-900 backdrop-blur-xs dark:text-white`
                    }`}
                    style={{
                      top: `${((renderedStart - state.dayRange.start) / rangeSpan) * 100}%`,
                      height: Math.max(46, (block.duration / rangeSpan) * timelineHeight),
                    }}
                  >
                    <button
                      type="button"
                      onPointerDown={(e) => beginDrag(e, block)}
                      onPointerMove={updateDrag}
                      onPointerUp={finishDrag}
                      onPointerCancel={cancelDrag}
                      className="grid h-full w-10 shrink-0 cursor-grab touch-none place-items-center border-r border-black/10 opacity-55 hover:opacity-100 active:cursor-grabbing dark:border-white/10"
                      aria-label={`Mover ${block.title}`}
                      title="Arrastar para alterar horário"
                    >
                      <GripVertical className="size-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenBlockEditor(block, block.start)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 py-1 text-left"
                    >
                      <span
                        className={`hidden size-6 shrink-0 place-items-center rounded-lg text-xs font-bold sm:grid ${
                          isDone ? 'bg-black/15' : `${c.bg} ${c.doneText}`
                        }`}
                      >
                        {habit.mark}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-display text-sm font-semibold">
                          {block.title}
                        </span>
                        <span className="block truncate font-mono text-[11px] tabular-nums opacity-75">
                          {fmtTime(renderedStart)}–{fmtTime(renderedStart + block.duration)} ·{' '}
                          {frequencyLabel(block.days, block.dateOverride)}
                        </span>
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      {!isDone && (
                        <button
                          type="button"
                          onClick={() =>
                            onStartFocus(block.title, Math.min(90, block.duration), {
                              blockId: block.id,
                              habitId: block.habitId,
                            })
                          }
                          className="grid size-9 place-items-center rounded-lg bg-white/75 text-slate-700 hover:bg-white dark:bg-slate-900/60 dark:text-slate-200"
                          title="Iniciar cronômetro de foco"
                          aria-label={`Focar em ${block.title}`}
                        >
                          <Play className="size-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleBlockDone(block.id)}
                        className={`grid size-9 place-items-center rounded-lg text-sm font-bold transition-transform active:scale-90 ${
                          isDone
                            ? 'bg-white/25 text-current'
                            : 'bg-white text-slate-800 shadow-2xs ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700'
                        }`}
                        title={isDone ? 'Marcar como pendente' : 'Concluir atividade'}
                        aria-label={isDone ? 'Desmarcar conclusão' : 'Concluir atividade'}
                      >
                        {isDone ? (
                          <Check className="size-4" strokeWidth={2.5} />
                        ) : (
                          <Plus className="size-4" />
                        )}
                      </button>
                    </div>

                    {draggedBlockId === block.id && (
                      <span className="pointer-events-none absolute right-2 top-1 rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-white shadow-md">
                        {fmtTime(renderedStart)}
                      </span>
                    )}
                  </div>
                );
              })}

              {isToday && nowMin >= state.dayRange.start && nowMin <= state.dayRange.end && (
                <div
                  className="pointer-events-none absolute left-0 right-0 z-20"
                  style={{ top: `${((nowMin - state.dayRange.start) / rangeSpan) * 100}%` }}
                >
                  <div className="relative border-t-2 border-blue-600 dark:border-blue-400">
                    <span className="absolute -left-1.5 -top-1.5 size-2.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                    <span className="absolute -top-2.5 right-0 rounded-md bg-blue-600 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-white dark:bg-blue-500">
                      {fmtTime(nowMin)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {state.habits.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                {state.habits.map((h) => (
                  <span
                    key={h.id}
                    className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    <span className={`size-2.5 rounded-xs ${HABIT_COLORS[h.color].dot}`} />
                    {h.name}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function DayRangeEditor({
  start,
  end,
  onChange,
}: {
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(fmtTime(start));
  const [draftEnd, setDraftEnd] = useState(fmtTime(end));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setDraftStart(fmtTime(start));
          setDraftEnd(fmtTime(end));
          setOpen((v) => !v);
        }}
        className="flex min-h-[38px] items-center gap-1.5 rounded-lg bg-slate-100 px-3 font-mono text-xs font-medium tabular-nums text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
        aria-expanded={open}
      >
        <Clock className="size-3.5" />
        <span>
          {fmtTime(start)}–{fmtTime(end)}
        </span>
      </button>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const s = parseTime(draftStart);
            const en = parseTime(draftEnd);
            if (en - s >= 60) {
              onChange(s, en);
              setOpen(false);
            }
          }}
          className="absolute right-0 top-11 z-40 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <p className="mb-3 text-xs font-semibold text-slate-900 dark:text-white">
            Janela do dia
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Início
              <input
                type="time"
                step={300}
                value={draftStart}
                onChange={(e) => setDraftStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </label>
            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Fim
              <input
                type="time"
                step={300}
                value={draftEnd}
                onChange={(e) => setDraftEnd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </label>
          </div>
          <button
            type="submit"
            className="mt-3 min-h-[38px] w-full rounded-lg bg-slate-900 text-xs font-semibold text-white dark:bg-blue-600"
          >
            Aplicar janela
          </button>
        </form>
      )}
    </div>
  );
}
