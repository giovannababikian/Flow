export type HabitColor =
  | 'exercise'
  | 'dj'
  | 'reading'
  | 'focus'
  | 'wellness'
  | 'cyan'
  | 'slate';

export type BulletType = 'task' | 'event' | 'note' | 'priority';

export type AppScreen = 'today' | 'focus';

export interface Habit {
  id: string;
  name: string;
  color: HabitColor;
  mark: string;
  updatedAt: number;
}

export interface Block {
  id: string;
  habitId?: string;
  color: HabitColor;
  title: string;
  start: number; // minutes from 00:00
  duration: number; // minutes
  days: number[]; // 0 (Sun) - 6 (Sat), empty if dateOverride is used
  dateOverride?: string; // YYYY-MM-DD for one-off scheduled items
  updatedAt: number;
}

export interface BulletItem {
  id: string;
  dateKey: string; // YYYY-MM-DD
  type: BulletType;
  color?: HabitColor;
  text: string;
  done: boolean;
  migratedTo?: string; // YYYY-MM-DD if migrated forward
  blockId?: string;
  timeMinutes?: number;
  durationMinutes?: number;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface CustomTimer {
  id: string;
  label: string;
  minutes: number;
  updatedAt: number;
}

export interface FocusSession {
  id: string;
  title: string;
  dateKey: string;
  durationSeconds: number;
  blockId?: string;
  bulletId?: string;
  habitId?: string;
  completedAt: number;
}

export interface DayRange {
  start: number;
  end: number;
  updatedAt: number;
}

export interface PlannerState {
  version: number;
  habits: Habit[];
  blocks: Block[];
  bullets: BulletItem[];
  customTimers: CustomTimer[];
  focusSessions: FocusSession[];
  completions: Record<string, string[]>;
  completionsUpdatedAt: Record<string, number>;
  dayRange: DayRange;
  deletedIds: Record<string, number>;
  updatedAt: number;
}

export interface CloudBackupMeta {
  id: string;
  createdAt: number;
  label: string;
  sizeBytes: number;
  itemCounts: {
    blocks: number;
    bullets: number;
    focusSessions: number;
  };
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'pending' | 'error';
