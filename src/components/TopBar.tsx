import { Cloud, CloudOff, Moon, Plus, RefreshCw, Sun } from 'lucide-react';
import type { AppScreen, SyncStatus } from '../lib/types.ts';

interface TopBarProps {
  screen: AppScreen;
  onNavigate: (s: AppScreen) => void;
  syncStatus: SyncStatus;
  connectedClients: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSync: () => void;
  onQuickAdd: () => void;
}

const NAV_ITEMS: { id: AppScreen; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'focus', label: 'Foco' },
];

export function TopBar({
  screen,
  onNavigate,
  syncStatus,
  connectedClients,
  theme,
  onToggleTheme,
  onOpenSync,
  onQuickAdd,
}: TopBarProps) {
  const syncLabel =
    syncStatus === 'offline'
      ? 'Offline'
      : syncStatus === 'pending'
        ? 'Pendente'
        : syncStatus === 'syncing'
          ? 'Sincronizando'
          : syncStatus === 'error'
            ? 'Erro sync'
            : connectedClients > 1
              ? `Sincronizado · ${connectedClients}`
              : 'Nuvem ativa';

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-slate-200/80 bg-[#F6F7F9]/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0B0F17]/90">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:gap-8 sm:px-6">
        <button
          type="button"
          onClick={() => onNavigate('today')}
          className="flex min-h-[44px] shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-slate-900 font-display text-sm font-extrabold text-white dark:bg-slate-100 dark:text-slate-950">
            R
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Rhythm
          </span>
        </button>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => {
            const active = screen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative shrink-0 whitespace-nowrap rounded py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  active
                    ? 'text-slate-950 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onOpenSync}
            className="flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white"
            title="Sincronização em tempo real e backups em nuvem"
            aria-label="Sincronização e backup"
          >
            {syncStatus === 'offline' || syncStatus === 'error' ? (
              <CloudOff className="size-4 text-amber-600 dark:text-amber-400" />
            ) : syncStatus === 'syncing' ? (
              <RefreshCw className="size-4 animate-spin text-blue-600 dark:text-blue-400" />
            ) : (
              <Cloud className="size-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <span className="hidden sm:inline">{syncLabel}</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="grid size-11 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white"
            aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>

          <button
            type="button"
            onClick={onQuickAdd}
            className="flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-slate-900 px-3.5 text-sm font-semibold text-white transition-transform hover:bg-slate-800 active:scale-[0.97] dark:bg-blue-600 dark:hover:bg-blue-500"
            aria-label="Novo bloco"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Novo bloco</span>
          </button>
        </div>
      </div>
    </header>
  );
}
