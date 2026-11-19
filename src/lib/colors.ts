import type { HabitColor } from './types.ts';

export interface ColorStyle {
  label: string;
  bg: string;
  soft: string;
  text: string;
  ring: string;
  doneText: string;
  dot: string;
}

export const HABIT_COLORS: Record<HabitColor, ColorStyle> = {
  exercise: {
    label: 'Coral',
    bg: 'bg-rose-500',
    soft: 'bg-rose-500/10 dark:bg-rose-500/15',
    text: 'text-rose-600 dark:text-rose-400',
    ring: 'ring-rose-500/35 dark:ring-rose-400/35',
    doneText: 'text-white',
    dot: 'bg-rose-500',
  },
  dj: {
    label: 'Índigo',
    bg: 'bg-indigo-600',
    soft: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    text: 'text-indigo-600 dark:text-indigo-400',
    ring: 'ring-indigo-500/35 dark:ring-indigo-400/35',
    doneText: 'text-white',
    dot: 'bg-indigo-600',
  },
  reading: {
    label: 'Âmbar',
    bg: 'bg-amber-400',
    soft: 'bg-amber-400/15 dark:bg-amber-400/15',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-500/40 dark:ring-amber-400/35',
    doneText: 'text-slate-950',
    dot: 'bg-amber-400',
  },
  focus: {
    label: 'Cobalto',
    bg: 'bg-blue-600',
    soft: 'bg-blue-600/10 dark:bg-blue-500/15',
    text: 'text-blue-600 dark:text-blue-400',
    ring: 'ring-blue-500/35 dark:ring-blue-400/35',
    doneText: 'text-white',
    dot: 'bg-blue-600',
  },
  wellness: {
    label: 'Esmeralda',
    bg: 'bg-emerald-600',
    soft: 'bg-emerald-600/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
    ring: 'ring-emerald-500/35 dark:ring-emerald-400/35',
    doneText: 'text-white',
    dot: 'bg-emerald-600',
  },
};

export const HABIT_COLOR_KEYS: HabitColor[] = ['exercise', 'dj', 'reading', 'focus', 'wellness'];
