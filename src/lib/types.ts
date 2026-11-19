export type HabitColor = 'exercise' | 'dj' | 'reading' | 'focus' | 'wellness';

export type BulletType = 'task' | 'event' | 'note' | 'priority';

export type AppScreen = 'today' | 'notes' | 'focus' | 'calendar';

export interface Habit {
  id: string;
  name: string;
  color: HabitColor;
  mark: string;
  updatedAt: number;
}

export interface Block {
  id: string;
  habitId: string;
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
  text: string;
  done: boolean;
  migratedTo?: string; // YYYY-MM-DD if migrated forward
  blockId?: string; // linked timeline block
  timeMinutes?: number;
  durationMinutes?: number;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface NoteDoc {
  id: string;
  title: string;
  content: string;
  folder: string;
  pinned: boolean;
  createdAt: number;
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
  notes: NoteDoc[];
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
    notes: number;
    focusSessions: number;
  };
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'pending' | 'error';
