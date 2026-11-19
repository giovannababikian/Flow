import { CheckSquare, Timer } from 'lucide-react';
import type { AppScreen } from '../lib/types.ts';

interface BottomNavProps {
  screen: AppScreen;
  onNavigate: (s: AppScreen) => void;
  pendingBulletsCount: number;
}

const TABS: { id: AppScreen; label: string; icon: typeof CheckSquare }[] = [
  { id: 'today', label: 'Hoje', icon: CheckSquare },
  { id: 'focus', label: 'Foco', icon: Timer },
];

export function BottomNav({ screen, onNavigate, pendingBulletsCount }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/90 bg-white/95 pb-safe backdrop-blur-md md:hidden dark:border-slate-800/90 dark:bg-slate-950/95"
      aria-label="Navegação móvel"
    >
      <div className="grid h-16 grid-cols-2 items-center">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = screen === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`relative flex min-h-[48px] flex-col items-center justify-center gap-1 transition-transform active:scale-95 ${
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className="size-5" strokeWidth={active ? 2.25 : 1.8} />
                {tab.id === 'today' && pendingBulletsCount > 0 && (
                  <span className="absolute -right-2.5 -top-1 font-mono text-[10px] font-bold tabular-nums text-blue-600 dark:text-blue-400">
                    {pendingBulletsCount > 9 ? '9+' : pendingBulletsCount}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
