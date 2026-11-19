import { motion } from 'motion/react';
import {
  Check,
  Cloud,
  CloudUpload,
  Copy,
  Download,
  History,
  RotateCcw,
  Smartphone,
  Upload,
  WifiOff,
  X,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import type { CloudBackupMeta, PlannerState, SyncStatus } from '../lib/types.ts';
import { usePWAInstall } from '../lib/usePWAInstall.ts';

interface SyncBackupSheetProps {
  workspaceId: string;
  onChangeWorkspace: (nextId: string) => void;
  syncStatus: SyncStatus;
  lastCloudSyncAt: number | null;
  connectedClients: number;
  backups: CloudBackupMeta[];
  state: PlannerState;
  onManualBackup: () => Promise<void>;
  onRestoreBackup: (backupId: string) => Promise<void>;
  onImportState: (imported: PlannerState) => void;
  onClose: () => void;
}

export function SyncBackupSheet({
  workspaceId,
  onChangeWorkspace,
  syncStatus,
  lastCloudSyncAt,
  connectedClients,
  backups,
  state,
  onManualBackup,
  onRestoreBackup,
  onImportState,
  onClose,
}: SyncBackupSheetProps) {
  const [draftKey, setDraftKey] = useState(workspaceId);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(workspaceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback ignored
    }
  };

  const handleSwitchWorkspace = () => {
    const cleaned = draftKey.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (cleaned.length < 3) {
      setFeedback('Use ao menos 3 caracteres (letras, números ou hífen).');
      return;
    }
    onChangeWorkspace(cleaned);
    setFeedback('Chave de sincronização atualizada.');
  };

  const handleBackupNow = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await onManualBackup();
      setFeedback('Snapshot salvo na nuvem.');
    } catch {
      setFeedback('Sem conexão no momento. Seus dados continuam salvos offline.');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (backupId: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await onRestoreBackup(backupId);
      setFeedback('Workspace restaurado com sucesso.');
    } catch {
      setFeedback('Não foi possível restaurar o backup agora.');
    } finally {
      setBusy(false);
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rhythm-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as PlannerState;
      if (!parsed || !Array.isArray(parsed.habits) || !Array.isArray(parsed.blocks)) {
        setFeedback('Arquivo de backup inválido.');
        return;
      }
      onImportState({ ...parsed, updatedAt: Date.now() });
      setFeedback('Backup JSON importado e sincronizado.');
    } catch {
      setFeedback('Erro ao ler arquivo JSON.');
    } finally {
      e.target.value = '';
    }
  };

  const lastSyncLabel = lastCloudSyncAt
    ? new Date(lastCloudSyncAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Ainda não sincronizado';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-slate-950/50 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Sincronização em tempo real e backup em nuvem"
    >
      <motion.div
        initial={{ y: 28, opacity: 0.9 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 28, opacity: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="max-h-[88dvh] w-full max-w-lg overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-3xl border border-slate-200 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6 dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-700" />

        <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-slate-800">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Nuvem, Offline & Backups
            </h2>
            <p className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {syncStatus === 'offline' ? (
                <>
                  <WifiOff className="size-3.5 text-amber-500" />
                  <span>Modo offline ativo · alterações salvas localmente</span>
                </>
              ) : (
                <>
                  <Cloud className="size-3.5 text-emerald-500" />
                  <span>
                    Tempo real ativo · {connectedClients} dispositivo(s) · último sync {lastSyncLabel}
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Workspace Sync Key */}
        <div className="mt-4 space-y-2">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            Chave do espaço (use a mesma chave no celular e no computador)
          </label>
          <div className="flex gap-2">
            <input
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              placeholder="Ex.: meu-rhythm-2026"
            />
            <button
              type="button"
              onClick={handleCopyKey}
              className="grid min-h-[44px] min-w-[44px] place-items-center rounded-xl border border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              title="Copiar chave"
              aria-label="Copiar chave"
            >
              {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            </button>
            <button
              type="button"
              onClick={handleSwitchWorkspace}
              disabled={draftKey.trim() === workspaceId}
              className="min-h-[44px] rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white disabled:opacity-40 dark:bg-blue-600"
            >
              Conectar
            </button>
          </div>
        </div>

        {/* PWA Install Block */}
        {!isInstalled && (isInstallable || isIOS) && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/30">
            <div className="flex items-center gap-3">
              <Smartphone className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="text-xs">
                <p className="font-semibold text-slate-900 dark:text-white">
                  Instalar aplicativo offline
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  Acesso instantâneo na tela inicial mesmo sem internet.
                </p>
              </div>
            </div>
            {isInstallable ? (
              <button
                type="button"
                onClick={install}
                className="min-h-[40px] shrink-0 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Instalar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowIOSGuide((v) => !v)}
                className="min-h-[40px] shrink-0 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white dark:bg-blue-600"
              >
                Como instalar
              </button>
            )}
          </div>
        )}

        {showIOSGuide && (
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
            No Safari (iPhone/iPad), toque em <strong>Compartilhar</strong> e escolha{' '}
            <strong>Adicionar à Tela de Início</strong>.
          </div>
        )}

        {/* Cloud Backups & Export/Import */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <History className="size-4 text-slate-500" />
            <span>Backups automáticos na nuvem</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBackupNow}
              disabled={busy || syncStatus === 'offline'}
              className="flex min-h-[38px] items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-40 dark:bg-blue-600"
            >
              <CloudUpload className="size-3.5" />
              <span>Salvar agora</span>
            </button>
          </div>
        </div>

        {feedback && (
          <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400">{feedback}</p>
        )}

        <div className="mt-3 max-h-52 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200/80 dark:divide-slate-800 dark:border-slate-800">
          {backups.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
              Snapshots automáticos são criados a cada minuto de edição ativa.
            </p>
          ) : (
            backups.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {b.label}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    {new Date(b.createdAt).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {b.itemCounts.blocks} blocos · {b.itemCounts.bullets} bullets
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestore(b.id)}
                  disabled={busy}
                  className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Restaurar</span>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-200/80 pt-4 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">Backup local em arquivo</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download className="size-3.5" />
              <span>Exportar JSON</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Upload className="size-3.5" />
              <span>Importar</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
