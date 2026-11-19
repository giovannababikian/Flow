import type { Block, PlannerState } from './types.ts';

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  result.setHours(0, 0, 0, 0);
  return result;
}

export function sameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

export function monthDates(date: Date): Date[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

export function fmtTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function fmtCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function frequencyLabel(days: number[], dateOverride?: string): string {
  if (dateOverride) return 'Pontual';
  if (days.length === 7) return 'Todos os dias';
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'Dias úteis';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Fim de semana';
  return days.map((d) => DAY_SHORT[d]).join(', ');
}

export function blocksForDate(blocks: Block[], date: Date): Block[] {
  const key = dateKey(date);
  const weekday = date.getDay();
  return blocks
    .filter((b) => (b.dateOverride ? b.dateOverride === key : b.days.includes(weekday)))
    .sort((a, b) => a.start - b.start);
}

export function habitStreak(state: PlannerState, habitId: string, referenceDate = new Date()): number {
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = addDays(referenceDate, -i);
    const key = dateKey(d);
    const dayBlocks = blocksForDate(state.blocks, d).filter((b) => b.habitId === habitId);
    if (dayBlocks.length === 0) continue;
    const doneIds = state.completions[key] ?? [];
    const anyDone = dayBlocks.some((b) => doneIds.includes(b.id));
    if (anyDone) {
      streak++;
    } else if (i === 0) {
      // Today hasn't finished yet; don't break yesterday's streak
      continue;
    } else {
      break;
    }
  }
  return streak;
}

export function weekSummary(state: PlannerState, referenceDate = new Date()) {
  const start = startOfWeek(referenceDate);
  const todayKey = dateKey(new Date());
  return Array.from({ length: 7 }, (_, idx) => {
    const d = addDays(start, idx);
    const key = dateKey(d);
    const blocks = blocksForDate(state.blocks, d);
    const doneIds = state.completions[key] ?? [];
    const doneBlocks = blocks.filter((b) => doneIds.includes(b.id));
    let dominantColor: string | null = null;
    if (doneBlocks.length > 0) {
      const h = state.habits.find((item) => item.id === doneBlocks[0].habitId);
      dominantColor = doneBlocks[0].color ?? h?.color ?? null;
    }
    return {
      key,
      date: d,
      label: DAY_SHORT[d.getDay()].slice(0, 3),
      dayNumber: d.getDate(),
      done: doneBlocks.length,
      total: blocks.length,
      isToday: key === todayKey,
      dominantColor,
    };
  });
}
