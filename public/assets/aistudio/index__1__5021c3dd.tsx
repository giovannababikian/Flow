import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  ALL_DAYS,
  DAY_SHORT,
  blocksForDay,
  fmtTime,
  frequencyLabel,
  parseTime,
  dateKey,
  habitStreak,
  loadState,
  saveState,
  uid,
  weekSummary,
  type Block,
  type HabitColor,
  type PlannerState,
} from "@/lib/planner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rhythm — Agenda e hábitos" },
      {
        name: "description",
        content:
          "Organize atividades em uma linha do tempo e acompanhe seus hábitos no dia, na semana e no mês.",
      },
      { property: "og:title", content: "Rhythm — Agenda e hábitos" },
      {
        property: "og:description",
        content:
          "Organize atividades em uma linha do tempo e acompanhe seus hábitos no dia, na semana e no mês.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const COLOR_TEXT: Record<HabitColor, string> = {
  exercise: "text-exercise",
  dj: "text-dj",
  reading: "text-reading",
};
const COLOR_BG: Record<HabitColor, string> = {
  exercise: "bg-exercise",
  dj: "bg-dj",
  reading: "bg-reading",
};
const COLOR_SOFT: Record<HabitColor, string> = {
  exercise: "bg-exercise/15 ring-exercise",
  dj: "bg-dj/15 ring-dj",
  reading: "bg-reading/15 ring-reading",
};
const COLOR_RING: Record<HabitColor, string> = {
  exercise: "ring-exercise/40",
  dj: "ring-dj/40",
  reading: "ring-reading/40",
};

type ViewMode = "day" | "week" | "month";

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  result.setHours(0, 0, 0, 0);
  return result;
}

function sameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function monthDates(date: Date): Date[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function Index() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="min-h-screen bg-paper" aria-label="Carregando agenda" />;
  }

  return <Planner />;
}

function Planner() {
  const [state, setState] = useState<PlannerState>(() => loadState());
  const [now, setNow] = useState<Date | null>(null);
  const [anchorDate, setAnchorDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragPreviewStart, setDragPreviewStart] = useState<number | null>(null);
  const [editor, setEditor] = useState<{ block: Block | null; start: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ blockId: string; pointerId: number; offset: number } | null>(null);
  const dragPreviewRef = useRef<number | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const current = new Date();
    setNow(current);
    setAnchorDate(current);
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const displayDate = anchorDate ?? new Date(2000, 0, 3);
  const activeDateKey = dateKey(displayDate);
  const doneToday = state.completions[activeDateKey] ?? [];
  const doneSet = useMemo(() => new Set(doneToday), [doneToday]);

  const weekday = displayDate.getDay();
  const todayBlocks = useMemo(() => blocksForDay(state.blocks, weekday), [state.blocks, weekday]);

  const visibleBlocks = useMemo(
    () => todayBlocks.filter((block) => block.start < state.dayRange.end && block.start + block.duration > state.dayRange.start),
    [state.dayRange.end, state.dayRange.start, todayBlocks],
  );

  const toggleBlock = (blockId: string) => {
    setState((s) => {
      const cur = s.completions[activeDateKey] ?? [];
      const next = cur.includes(blockId)
        ? cur.filter((id) => id !== blockId)
        : [...cur, blockId];
      return { ...s, completions: { ...s.completions, [activeDateKey]: next } };
    });
  };

  const removeBlock = (blockId: string) => {
    setState((s) => {
      const completions: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(s.completions)) {
        completions[k] = v.filter((id) => id !== blockId);
      }
      return {
        ...s,
        blocks: s.blocks.filter((b) => b.id !== blockId),
        completions,
      };
    });
  };

  const saveBlock = (block: Block) => {
    setState((s) => ({
      ...s,
      blocks: s.blocks.some((b) => b.id === block.id)
        ? s.blocks.map((b) => (b.id === block.id ? block : b))
        : [...s.blocks, block],
    }));
  };

  const addHabit = (name: string, color: HabitColor) => {
    setState((s) => ({
      ...s,
      habits: [
        ...s.habits,
        { id: uid(), name, color, mark: name.charAt(0).toUpperCase() },
      ],
    }));
  };

  const week = useMemo(() => weekSummary(state), [state]);
  const weekPct = Math.round(
    (week.reduce((a, d) => a + d.done, 0) /
      Math.max(1, week.reduce((a, d) => a + d.total, 0))) *
      100,
  );

  const dateLabel = anchorDate
    ? displayDate.toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "Hoje";

  const calendarLabel = anchorDate
    ? viewMode === "month"
      ? displayDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : viewMode === "week"
        ? `${startOfWeek(displayDate).toLocaleDateString("pt-BR", { month: "short", day: "numeric" })} – ${addDays(startOfWeek(displayDate), 6).toLocaleDateString("pt-BR", { month: "short", day: "numeric", year: "numeric" })}`
        : displayDate.toLocaleDateString("pt-BR", { weekday: "long", month: "long", day: "numeric" })
    : "Carregando calendário";

  const moveCalendar = (direction: -1 | 1) => {
    if (!anchorDate) return;
    const next = new Date(anchorDate);
    if (viewMode === "month") next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction * (viewMode === "week" ? 7 : 1));
    setAnchorDate(next);
  };

  const minutesFromPointer = (clientY: number) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return null;
    const ratio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    return state.dayRange.start + ratio * (state.dayRange.end - state.dayRange.start);
  };

  const beginDrag = (event: ReactPointerEvent<HTMLElement>, block: Block) => {
    if (event.button !== 0 || !timelineRef.current) return;
    const pointerMinute = minutesFromPointer(event.clientY);
    if (pointerMinute === null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { blockId: block.id, pointerId: event.pointerId, offset: pointerMinute - block.start };
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
      setState((current) => ({
        ...current,
        blocks: current.blocks.map((block) => block.id === drag.blockId ? { ...block, start: finalStart } : block),
      }));
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

  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : null;

  return (
    <div className="min-h-screen bg-paper text-ink font-sans selection:bg-reading/40">
      {/* top bar */}
      <header className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-4 sm:flex sm:flex-wrap sm:justify-between sm:gap-5 sm:px-6 sm:py-6">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink sm:size-11 sm:rounded-2xl">
            <span className="font-display text-xl font-black leading-none text-reading">
              R
            </span>
          </div>
          <div className="leading-none">
            <p className="truncate font-display text-xl font-black tracking-tight sm:text-[22px]">
              RHYTHM
            </p>
            <p className="mt-1.5 text-sm text-ink/55">Agenda diária</p>
          </div>
        </div>
        <div className="contents sm:flex sm:items-center sm:gap-2.5">
          <span className="col-span-2 row-start-2 inline-flex min-w-0 items-center justify-center gap-2 rounded-lg bg-white/60 px-3 py-2 text-sm font-medium ring-1 ring-black/5 sm:col-auto sm:row-auto sm:justify-start sm:rounded-full sm:px-3.5">
            {state.habits.slice(0, 4).map((h) => (
              <span
                key={h.id}
                className={`size-2 rounded-full ${COLOR_BG[h.color]}`}
              />
            ))}
            <span className="truncate text-ink/70">{dateLabel}</span>
          </span>
          <button
            type="button"
            onClick={() => setEditor({ block: null, start: 9 * 60 })}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-xl font-semibold text-paper ring-1 ring-ink/10 transition-transform hover:-translate-y-0.5 sm:flex sm:size-auto sm:px-4 sm:py-2.5 sm:text-sm"
            aria-label="Adicionar atividade"
            title="Adicionar atividade"
          >
            <span aria-hidden="true" className="sm:hidden">+</span>
            <span className="hidden sm:inline">Adicionar atividade</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-3 pb-12 sm:px-6 sm:pb-16">
        <section className="mb-3 grid gap-3 border-y border-black/10 py-3 sm:mb-5 sm:grid-cols-[216px_minmax(0,1fr)_216px] sm:items-center sm:py-4">
          <div className="grid w-full grid-cols-3 rounded-lg bg-black/5 p-1 sm:flex sm:w-fit" aria-label="Visualização do calendário">
            {(["day", "week", "month"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`min-w-0 rounded-md px-2 py-2 text-sm font-semibold capitalize transition-colors sm:min-w-16 sm:px-3 ${viewMode === mode ? "bg-ink text-paper" : "text-ink/55 hover:text-ink"}`}
              >
                {{ day: "Dia", week: "Semana", month: "Mês" }[mode]}
              </button>
            ))}
          </div>
          <p className="min-w-0 text-center font-display text-base font-semibold sm:text-lg">{calendarLabel}</p>
          <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 sm:flex sm:justify-self-end">
            <button type="button" onClick={() => moveCalendar(-1)} disabled={!anchorDate} className="grid size-11 place-items-center rounded-md bg-black/5 text-lg font-semibold text-ink disabled:opacity-30 sm:size-9" title="Período anterior" aria-label="Período anterior">←</button>
            <button type="button" onClick={() => setAnchorDate(new Date())} className="h-11 rounded-md bg-black/5 px-3 py-2 text-sm font-semibold text-ink sm:h-9">Hoje</button>
            <button type="button" onClick={() => moveCalendar(1)} disabled={!anchorDate} className="grid size-11 place-items-center rounded-md bg-black/5 text-lg font-semibold text-ink disabled:opacity-30 sm:size-9" title="Próximo período" aria-label="Próximo período">→</button>
          </div>
        </section>

        <div className={`grid grid-cols-1 items-start gap-5 ${viewMode === "day" ? "lg:grid-cols-[minmax(0,1fr)_300px]" : ""}`}>
          {viewMode === "day" && (
            <section className="min-w-0 rounded-xl bg-white/50 p-3 ring-1 ring-black/5 sm:rounded-2xl sm:p-6">
              <div className="mb-4 grid gap-3 border-b border-black/5 pb-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <h2 className="font-display text-lg font-semibold tracking-tight">Linha do tempo</h2>
                <DayRangeEditor
                  start={state.dayRange.start}
                  end={state.dayRange.end}
                  onChange={(dayRange) => setState((current) => ({ ...current, dayRange }))}
                />
              </div>
              <div
                ref={timelineRef}
                className={`relative ml-12 touch-pan-y border-l border-black/10 sm:ml-14 ${draggedBlockId ? "select-none" : ""}`}
                style={{ height: Math.max(480, ((state.dayRange.end - state.dayRange.start) / 60) * 64) }}
                onDoubleClick={(event) => {
                  const minute = minutesFromPointer(event.clientY);
                  if (minute !== null) setEditor({ block: null, start: Math.round(minute / 5) * 5 });
                }}
              >
                {Array.from({ length: Math.floor((state.dayRange.end - state.dayRange.start) / 60) + 1 }, (_, index) => state.dayRange.start + index * 60).map((minute) => (
                  <div key={minute} className="pointer-events-none absolute left-0 right-0 border-t border-black/10" style={{ top: `${((minute - state.dayRange.start) / (state.dayRange.end - state.dayRange.start)) * 100}%` }}>
                    <span className="absolute -left-12 w-10 -translate-y-1/2 text-right text-[11px] font-medium tabular-nums text-ink/45 sm:-left-14 sm:w-11 sm:text-xs">{fmtTime(minute)}</span>
                  </div>
                ))}
                {visibleBlocks.map((block) => {
                  const habit = state.habits.find((item) => item.id === block.habitId);
                  if (!habit) return null;
                  const isDone = doneSet.has(block.id);
                  const renderedStart = draggedBlockId === block.id && dragPreviewStart !== null ? dragPreviewStart : block.start;
                  const rangeDuration = state.dayRange.end - state.dayRange.start;
                  return (
                    <div
                      key={block.id}
                      data-activity={block.title}
                      className={`absolute left-2 right-0 z-10 flex touch-pan-y items-center justify-between gap-1 overflow-hidden rounded-lg pr-2 sm:left-3 sm:gap-2 sm:pr-3 ${draggedBlockId === block.id ? "z-30 shadow-lg ring-offset-2 ring-offset-paper" : ""} ${isDone ? `${COLOR_BG[habit.color]} ${habit.color === "reading" ? "text-ink" : "text-paper"}` : `ring-2 ${COLOR_SOFT[habit.color]} text-ink`}`}
                      style={{ top: `${((renderedStart - state.dayRange.start) / rangeDuration) * 100}%`, height: Math.max(46, (block.duration / rangeDuration) * Math.max(480, (rangeDuration / 60) * 64)) }}
                    >
                      <button
                        type="button"
                        onPointerDown={(event) => beginDrag(event, block)}
                        onPointerMove={updateDrag}
                        onPointerUp={finishDrag}
                        onPointerCancel={cancelDrag}
                        className="grid h-full w-11 shrink-0 cursor-grab touch-none place-items-center border-r border-black/10 text-lg font-bold opacity-50 active:cursor-grabbing active:opacity-100 sm:w-10"
                        aria-label={`Mover ${block.title}. Horário atual ${fmtTime(renderedStart)}`}
                        title="Toque e arraste para alterar o horário"
                      >
                        <span className="select-none" aria-hidden="true">⠿</span>
                      </button>
                      <button type="button" onClick={() => setEditor({ block, start: block.start })} className="flex min-w-0 flex-1 items-center gap-2 text-left sm:gap-2.5" title="Editar atividade">
                        <span className={`hidden size-6 shrink-0 place-items-center rounded-full min-[360px]:grid ${isDone ? "bg-black/15" : COLOR_BG[habit.color]}`}><span className={`text-[13px] font-black leading-none ${!isDone && habit.color !== "reading" ? "text-paper" : ""}`}>{habit.mark}</span></span>
                        <span className="min-w-0"><span className="block truncate font-display text-sm font-semibold">{block.title}</span><span className="block truncate text-[11px] opacity-70">{fmtTime(renderedStart)}–{fmtTime(renderedStart + block.duration)} · {frequencyLabel(block.days)}</span></span>
                      </button>
                      <button type="button" onClick={() => toggleBlock(block.id)} className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-black transition-transform hover:scale-110 sm:size-8 ${isDone ? `${habit.color === "reading" ? "bg-ink" : "bg-paper"} ${COLOR_TEXT[habit.color]}` : `bg-white ring-1 ${COLOR_RING[habit.color]} ${COLOR_TEXT[habit.color]}`}`} title={isDone ? "Marcar como pendente" : "Marcar como concluída"}>{isDone ? "✓" : "+"}</button>
                      {draggedBlockId === block.id && (
                        <span className="pointer-events-none absolute right-2 top-1 rounded-md bg-ink px-2 py-1 text-[11px] font-bold tabular-nums text-paper shadow-lg" aria-live="polite">
                          {fmtTime(renderedStart)}
                        </span>
                      )}
                    </div>
                  );
                })}
                {now && nowMin !== null && sameDay(displayDate, now) && nowMin >= state.dayRange.start && nowMin <= state.dayRange.end && (
                  <div className="pointer-events-none absolute left-0 right-0 z-20" style={{ top: `${((nowMin - state.dayRange.start) / (state.dayRange.end - state.dayRange.start)) * 100}%` }}>
                    <div className="relative border-t-2 border-dashed border-ink/50"><span className="absolute -top-2.5 right-0 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-paper">{fmtTime(nowMin)} · agora</span><span className="nowline absolute -top-1.5 left-0 size-3 rounded-full bg-ink" /></div>
                  </div>
                )}
              </div>
              <HabitLegend state={state} />
            </section>
          )}

          {viewMode === "week" && anchorDate && <WeekCalendar date={displayDate} state={state} today={now} onEdit={(block) => setEditor({ block, start: block.start })} />}
          {viewMode === "month" && anchorDate && <MonthCalendar date={displayDate} state={state} today={now} onSelectDay={(date) => { setAnchorDate(date); setViewMode("day"); }} />}

          {viewMode === "day" && (
            <aside className="flex flex-col gap-6">
              <section className="rounded-2xl bg-white/50 p-5 ring-1 ring-black/5">
                <div className="mb-5 flex items-center justify-between"><h2 className="font-display text-lg font-semibold tracking-tight">Sequências</h2><span className="text-xs font-medium uppercase tracking-wider text-ink/45">dias seguidos</span></div>
                <div className="flex flex-col gap-5">
                  {state.habits.map((h) => {
                    const streak = habitStreak(state, h.id);
                    const pct = Math.min(100, Math.round((streak / 21) * 100));
                    return <div key={h.id} className="flex items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${COLOR_BG[h.color]}`}><span className={`text-sm font-black ${h.color === "reading" ? "text-ink" : "text-paper"}`}>{h.mark}</span></span><div className="min-w-0 flex-1"><div className="flex items-baseline justify-between"><p className="font-display text-sm font-semibold text-ink">{h.name}</p><p className="font-display text-lg font-black leading-none">{streak}</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5"><div className={`sbar h-full rounded-full ${COLOR_BG[h.color]}`} style={{ width: `${pct}%` }} /></div></div></div>;
                  })}
                </div>
              </section>
              <section className="rounded-2xl bg-ink p-5 text-paper">
                <div className="mb-5 flex items-center justify-between"><h2 className="font-display text-lg font-semibold tracking-tight">Esta semana</h2><span className="text-xs font-medium uppercase tracking-wider text-paper/50">{todayBlocks.length} no dia</span></div>
                <div className="grid grid-cols-7 gap-1.5">{week.map((d) => <div key={d.key} className="flex flex-col items-center gap-1.5"><div className={`grid aspect-square w-full place-items-center rounded-lg ${d.dominantColor ? `${COLOR_BG[d.dominantColor]}/90` : d.isToday ? "bg-white/5 ring-1 ring-paper/30" : "bg-white/10"}`}><span className={`text-[11px] font-black ${d.dominantColor === "reading" ? "text-ink" : d.dominantColor ? "text-paper" : "text-paper/40"}`}>{d.done > 0 ? "✓" : "·"}</span></div><span className={`text-[10px] ${d.isToday ? "font-semibold text-paper/80" : "text-paper/55"}`}>{d.label}</span></div>)}</div>
                <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3"><span className="text-sm text-paper/70">Conclusão semanal</span><span className="font-display text-lg font-black">{weekPct}%</span></div>
              </section>
            </aside>
          )}
        </div>
      </main>

      {editor && (
        <BlockDialog
          state={state}
          initial={editor.block}
          defaultStart={editor.start}
          onClose={() => setEditor(null)}
          onAddHabit={addHabit}
          onSave={saveBlock}
          onDelete={removeBlock}
        />
      )}
    </div>
  );
}


function HabitLegend({ state }: { state: PlannerState }) {
  return (
    <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-black/5 pt-4 sm:mt-6 sm:gap-5 sm:pt-5">
      {state.habits.map((habit) => <span key={habit.id} className="inline-flex items-center gap-2 text-sm text-ink/70"><span className={`size-3 rounded-[4px] ${COLOR_BG[habit.color]}`} />{habit.name}</span>)}
    </div>
  );
}

function DayRangeEditor({ start, end, onChange }: { start: number; end: number; onChange: (range: { start: number; end: number }) => void }) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(fmtTime(start));
  const [draftEnd, setDraftEnd] = useState(fmtTime(end));
  return (
    <div className="relative">
      <button type="button" onClick={() => { setDraftStart(fmtTime(start)); setDraftEnd(fmtTime(end)); setOpen((value) => !value); }} className="w-full rounded-md bg-black/5 px-3 py-2 text-sm font-semibold tabular-nums text-ink/70 sm:w-auto" aria-expanded={open}>
        {fmtTime(start)} — {fmtTime(end)} · Editar dia
      </button>
      {open && (
        <form className="absolute left-0 top-11 z-40 w-full min-w-64 rounded-lg bg-paper p-4 shadow-xl ring-1 ring-black/10 sm:left-auto sm:right-0 sm:w-64" onSubmit={(event) => { event.preventDefault(); const nextStart = parseTime(draftStart); const nextEnd = parseTime(draftEnd); if (nextEnd - nextStart < 60) return; onChange({ start: nextStart, end: nextEnd }); setOpen(false); }}>
          <p className="mb-3 text-sm font-semibold">Duração do dia</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-ink/55">Início<input type="time" step={300} value={draftStart} onChange={(event) => setDraftStart(event.target.value)} className="mt-1 w-full rounded-md bg-white/70 px-2 py-2 text-sm ring-1 ring-black/10" /></label>
            <label className="text-xs font-semibold text-ink/55">Fim<input type="time" step={300} value={draftEnd} onChange={(event) => setDraftEnd(event.target.value)} className="mt-1 w-full rounded-md bg-white/70 px-2 py-2 text-sm ring-1 ring-black/10" /></label>
          </div>
          <button type="submit" className="mt-4 w-full rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper">Aplicar</button>
        </form>
      )}
    </div>
  );
}

function WeekCalendar({ date, state, today, onEdit }: { date: Date; state: PlannerState; today: Date | null; onEdit: (block: Block) => void }) {
  const start = startOfWeek(date);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  return (
    <section className="overflow-hidden rounded-xl bg-white/50 ring-1 ring-black/5 sm:rounded-2xl">
      <div>
        <div className="grid grid-cols-1 divide-y divide-black/10 md:grid-cols-7 md:divide-x md:divide-y-0">
          {dates.map((day) => {
            const blocks = blocksForDay(state.blocks, day.getDay());
            const isToday = today ? sameDay(day, today) : false;
            return (
              <div key={dateKey(day)} className="grid min-h-24 grid-cols-[64px_minmax(0,1fr)] md:block md:min-h-[520px]">
                <div className={`grid place-items-center border-r border-black/10 px-3 py-4 text-center md:block md:border-b md:border-r-0 ${isToday ? "bg-ink text-paper" : ""}`}><div><p className="text-xs font-semibold uppercase text-current opacity-60">{day.toLocaleDateString("pt-BR", { weekday: "short" })}</p><p className="mt-1 font-display text-2xl font-black">{day.getDate()}</p></div></div>
                <div className="grid grid-cols-1 gap-2 p-2.5 sm:grid-cols-2 md:flex md:flex-col">
                  {blocks.length === 0 && <p className="py-5 text-center text-xs text-ink/35 sm:col-span-2 md:py-7">Dia livre</p>}
                  {blocks.map((block) => {
                    const habit = state.habits.find((item) => item.id === block.habitId);
                    if (!habit) return null;
                    return <button key={block.id} type="button" onClick={() => onEdit(block)} className={`min-h-20 rounded-lg p-3 text-left ring-1 ${COLOR_SOFT[habit.color]}`}><span className="block text-xs font-semibold tabular-nums text-ink/55">{fmtTime(block.start)}–{fmtTime(block.start + block.duration)}</span><span className="mt-1 block font-display text-sm font-semibold text-ink">{block.title}</span><span className={`mt-2 block h-1.5 w-8 rounded-full ${COLOR_BG[habit.color]}`} /></button>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="px-5 pb-5"><HabitLegend state={state} /></div>
    </section>
  );
}

function MonthCalendar({ date, state, today, onSelectDay }: { date: Date; state: PlannerState; today: Date | null; onSelectDay: (date: Date) => void }) {
  const dates = monthDates(date);
  return (
    <section className="overflow-hidden rounded-xl bg-white/50 ring-1 ring-black/5 sm:rounded-2xl">
      <div>
        <div>
          <div className="grid grid-cols-7 border-b border-black/10 bg-black/[0.03]">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <div key={day} className="px-0.5 py-2 text-center text-[10px] font-semibold uppercase text-ink/45 sm:px-3 sm:py-3 sm:text-xs">{day}</div>)}</div>
          <div className="grid grid-cols-7">
            {dates.map((day) => {
              const blocks = blocksForDay(state.blocks, day.getDay());
              const inMonth = day.getMonth() === date.getMonth();
              const isToday = today ? sameDay(day, today) : false;
              return (
                <button key={dateKey(day)} type="button" onClick={() => onSelectDay(day)} className={`min-h-16 border-b border-r border-black/10 p-1 text-left transition-colors hover:bg-white/70 sm:min-h-28 sm:p-3 ${inMonth ? "" : "opacity-30"}`} aria-label={`Abrir ${day.toLocaleDateString("pt-BR", { month: "long", day: "numeric" })}`}>
                  <span className={`grid size-6 place-items-center rounded-full text-xs font-semibold sm:size-7 sm:text-sm ${isToday ? "bg-ink text-paper" : "text-ink"}`}>{day.getDate()}</span>
                  <span className="mt-2 flex flex-wrap gap-1 sm:mt-4 sm:gap-1.5">
                    {blocks.map((block) => {
                      const habit = state.habits.find((item) => item.id === block.habitId);
                      return habit ? <span key={block.id} className={`size-2 rounded-full sm:size-2.5 ${COLOR_BG[habit.color]}`} title={`${fmtTime(block.start)} ${block.title}`} /> : null;
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="px-3 pb-3 sm:px-5 sm:pb-5"><HabitLegend state={state} /></div>
    </section>
  );
}

function BlockDialog({
  state,
  initial,
  defaultStart,
  onClose,
  onAddHabit,
  onSave,
  onDelete,
}: {
  state: PlannerState;
  initial: Block | null;
  defaultStart: number;
  onClose: () => void;
  onAddHabit: (name: string, color: HabitColor) => void;
  onSave: (b: Block) => void;
  onDelete: (id: string) => void;
}) {
  const [mode, setMode] = useState<"block" | "habit">("block");
  const [habitId, setHabitId] = useState(initial?.habitId ?? state.habits[0]?.id ?? "");
  const [start, setStart] = useState(fmtTime(initial?.start ?? defaultStart));
  const [duration, setDuration] = useState(initial?.duration ?? 60);
  const [days, setDays] = useState<number[]>(initial?.days ?? ALL_DAYS);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [name, setName] = useState("");
  const [color, setColor] = useState<HabitColor>("dj");
  const labelCls = "text-xs font-semibold uppercase tracking-wider text-ink/50";
  const inputCls = "rounded-xl bg-white/70 px-3 py-2.5 text-sm ring-1 ring-black/10 placeholder:text-ink/35";
  const endMin = parseTime(start) + Number(duration || 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-end overflow-y-auto bg-ink/40 p-2 sm:place-items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-xl bg-paper p-4 ring-1 ring-black/10 sm:rounded-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex gap-2">
          <button onClick={() => setMode("block")} className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "block" ? "bg-ink text-paper" : "bg-black/5 text-ink/60"}`}>
            {initial ? "Editar atividade" : "Agendar atividade"}
          </button>
          {!initial && (
            <button onClick={() => setMode("habit")} className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "habit" ? "bg-ink text-paper" : "bg-black/5 text-ink/60"}`}>
              Novo hábito
            </button>
          )}
        </div>

        {mode === "block" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!habitId || !title.trim() || days.length === 0 || duration <= 0) return;
              onSave({ id: initial?.id ?? uid(), habitId, title: title.trim(), start: parseTime(start), duration: Number(duration), days: [...days].sort() });
              onClose();
            }}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Título</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Corrida matinal" className={inputCls} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Hábito</span>
              <select value={habitId} onChange={(e) => setHabitId(e.target.value)} className={inputCls}>
                {state.habits.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Início</span>
                <input type="time" step={300} value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Minutos</span>
                <input type="number" min={5} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputCls} />
              </label>
            </div>
            <p className="-mt-2 text-xs text-ink/55">Termina às {fmtTime(endMin)}</p>
            <div className="flex flex-col gap-1.5">
              <span className={labelCls}>Repete · {days.length ? frequencyLabel(days) : "selecione os dias"}</span>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const on = days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                      className={`h-9 flex-1 rounded-lg text-xs font-semibold ${on ? "bg-ink text-paper" : "bg-black/5 text-ink/60"}`}
                    >
                      {DAY_SHORT[d]?.slice(0, 2)}
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={() => setDays(days.length === 7 ? [] : ALL_DAYS)} className="self-start text-xs font-semibold text-ink/55 underline">
                {days.length === 7 ? "Limpar" : "Todos os dias"}
              </button>
            </div>
            <div className="mt-1 flex gap-2">
              {initial && (
                <button type="button" onClick={() => { onDelete(initial.id); onClose(); }} className="rounded-full bg-black/5 px-4 py-2.5 text-sm font-semibold text-ink/70">
                  Excluir
                </button>
              )}
              <button type="submit" className="flex-1 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper">
                {initial ? "Salvar alterações" : "Adicionar à agenda"}
              </button>
            </div>
          </form>
        )}

        {mode === "habit" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              onAddHabit(name.trim(), color);
              setMode("block");
            }}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Nome</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Meditação" className={inputCls} />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className={labelCls}>Cor</span>
              <div className="flex gap-2">
                {(["exercise", "dj", "reading"] as HabitColor[]).map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)} className={`size-9 rounded-xl ${COLOR_BG[c]} ${color === c ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : ""}`} />
                ))}
              </div>
            </div>
            <button type="submit" className="mt-1 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper">Criar hábito</button>
          </form>
        )}
      </div>
    </div>
  );
}