import {
  ArrowLeft,
  CheckSquare,
  ListChecks,
  Pin,
  Plus,
  Search,
  Send,
  Square,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { NoteDoc } from '../lib/types.ts';

interface NotesViewProps {
  notes: NoteDoc[];
  onCreateNote: (folder?: string) => string;
  onUpdateNote: (id: string, patch: Partial<Pick<NoteDoc, 'title' | 'content' | 'folder' | 'pinned'>>) => void;
  onDeleteNote: (id: string) => void;
  onSendToTodayBullet: (text: string) => void;
}

export function NotesView({
  notes,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onSendToTodayBullet,
}: NotesViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(() => notes[0]?.id ?? null);
  const [mobileOpenEditor, setMobileOpenEditor] = useState(false);
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState<string>('Todas');
  const [editorMode, setEditorMode] = useState<'edit' | 'checklist'>('edit');
  const [sentFeedback, setSentFeedback] = useState<string | null>(null);

  const folders = useMemo(() => {
    const set = new Set<string>(['Todas']);
    for (const n of notes) {
      if (n.folder.trim()) set.add(n.folder.trim());
    }
    return Array.from(set);
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes
      .filter((n) => (folderFilter === 'Todas' ? true : n.folder === folderFilter))
      .filter((n) =>
        q
          ? n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
          : true
      )
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  }, [notes, folderFilter, search]);

  const activeNote =
    notes.find((n) => n.id === selectedId) ?? filteredNotes[0] ?? null;

  const handleSelectNote = (id: string) => {
    setSelectedId(id);
    setMobileOpenEditor(true);
  };

  const handleNewNote = () => {
    const id = onCreateNote(folderFilter === 'Todas' ? 'Geral' : folderFilter);
    setSelectedId(id);
    setMobileOpenEditor(true);
    setEditorMode('edit');
  };

  const toggleChecklistLine = (lineIdx: number) => {
    if (!activeNote) return;
    const lines = activeNote.content.split('\n');
    const line = lines[lineIdx];
    if (line === undefined) return;
    if (/^\s*- \[ \] /.test(line)) {
      lines[lineIdx] = line.replace('- [ ] ', '- [x] ');
    } else if (/^\s*- \[x\] /i.test(line)) {
      lines[lineIdx] = line.replace(/- \[x\] /i, '- [ ] ');
    }
    onUpdateNote(activeNote.id, { content: lines.join('\n') });
  };

  const wordCount = activeNote
    ? activeNote.content.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* Notes List Pane */}
      <section
        className={`rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800/80 dark:bg-slate-900 ${
          mobileOpenEditor ? 'hidden lg:block' : 'block'
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Notas
          </h1>
          <button
            type="button"
            onClick={handleNewNote}
            className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white transition-transform active:scale-95 dark:bg-blue-600"
          >
            <Plus className="size-4" />
            <span>Nova nota</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar em notas..."
            className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800/70 dark:text-white"
          />
        </div>

        {/* Folder Segmented Strip */}
        {folders.length > 1 && (
          <div className="mb-3 flex gap-1 overflow-x-auto pb-1 no-scrollbar">
            {folders.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFolderFilter(f)}
                className={`min-h-[34px] shrink-0 rounded-lg px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  folderFilter === f
                    ? 'bg-slate-900 text-white dark:bg-blue-600'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* List */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {filteredNotes.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {notes.length === 0
                  ? 'Nenhuma nota criada ainda.'
                  : 'Nenhuma nota encontrada para esta busca.'}
              </p>
              {notes.length === 0 && (
                <button
                  type="button"
                  onClick={handleNewNote}
                  className="mt-3 min-h-[40px] rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white lg:hidden dark:bg-blue-600"
                >
                  Criar primeira nota
                </button>
              )}
            </div>
          ) : (
            filteredNotes.map((n) => {
              const selected = activeNote?.id === n.id;
              const preview = n.content.replace(/\n+/g, ' ').trim() || 'Nota vazia';
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleSelectNote(n.id)}
                  className={`flex w-full flex-col items-start rounded-xl px-3 py-3 text-left transition-colors ${
                    selected
                      ? 'bg-slate-100 dark:bg-slate-800/80'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="truncate font-display text-sm font-semibold text-slate-900 dark:text-white">
                      {n.title || 'Sem título'}
                    </span>
                    {n.pinned && <Pin className="size-3.5 shrink-0 text-blue-600 dark:text-blue-400" />}
                  </div>
                  <p className="mt-1 line-clamp-1 w-full text-xs text-slate-500 dark:text-slate-400">
                    {preview}
                  </p>
                  <p className="mt-1.5 font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                    {n.folder || 'Geral'} ·{' '}
                    {new Date(n.updatedAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Distraction-Free Note Editor */}
      <section
        className={`flex min-h-[540px] flex-col rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 dark:border-slate-800/80 dark:bg-slate-900 ${
          mobileOpenEditor ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {!activeNote ? (
          <div className="m-auto text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Selecione uma nota ou crie uma nova para começar.
            </p>
            <button
              type="button"
              onClick={handleNewNote}
              className="mt-3 min-h-[44px] rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white dark:bg-blue-600"
            >
              Criar primeira nota
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileOpenEditor(false)}
                  className="grid size-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label="Voltar para lista de notas"
                >
                  <ArrowLeft className="size-4" />
                </button>

                <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditorMode('edit')}
                    className={`min-h-[34px] rounded-md px-2.5 text-xs font-semibold transition-colors ${
                      editorMode === 'edit'
                        ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-950 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Texto
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('checklist')}
                    className={`flex min-h-[34px] items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition-colors ${
                      editorMode === 'checklist'
                        ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-950 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <ListChecks className="size-3.5" />
                    <span>Interativo</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  value={activeNote.folder}
                  onChange={(e) => onUpdateNote(activeNote.id, { folder: e.target.value })}
                  placeholder="Pasta"
                  className="h-9 w-24 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => onUpdateNote(activeNote.id, { pinned: !activeNote.pinned })}
                  className={`grid size-9 place-items-center rounded-lg transition-colors ${
                    activeNote.pinned
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'
                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title={activeNote.pinned ? 'Desafixar' : 'Fixar no topo'}
                  aria-label="Fixar nota"
                >
                  <Pin className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteNote(activeNote.id);
                    setSelectedId(null);
                    setMobileOpenEditor(false);
                  }}
                  className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                  title="Excluir nota"
                  aria-label="Excluir nota"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>

            <input
              value={activeNote.title}
              onChange={(e) => onUpdateNote(activeNote.id, { title: e.target.value })}
              placeholder="Título da nota"
              className="mb-2 bg-transparent font-display text-xl font-bold tracking-tight text-slate-900 outline-none placeholder:text-slate-300 sm:text-2xl dark:text-white dark:placeholder:text-slate-600"
            />

            <p className="mb-4 font-mono text-xs tabular-nums text-slate-400 dark:text-slate-500">
              {wordCount} palavras · Atualizada às{' '}
              {new Date(activeNote.updatedAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>

            {editorMode === 'edit' ? (
              <textarea
                value={activeNote.content}
                onChange={(e) => onUpdateNote(activeNote.id, { content: e.target.value })}
                placeholder="Escreva livremente ou use '- [ ] tarefa' para criar checklists interativos..."
                className="min-h-[340px] flex-1 resize-none bg-transparent text-sm leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-600"
              />
            ) : (
              <div className="flex-1 space-y-1.5 overflow-y-auto">
                {activeNote.content.split('\n').map((line, idx) => {
                  const isUnchecked = /^\s*- \[ \] /.test(line);
                  const isChecked = /^\s*- \[x\] /i.test(line);
                  if (isUnchecked || isChecked) {
                    const label = line.replace(/^\s*- \[[ xX]\] /, '');
                    return (
                      <div
                        key={idx}
                        className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl px-2 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <button
                          type="button"
                          onClick={() => toggleChecklistLine(idx)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        >
                          {isChecked ? (
                            <CheckSquare className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Square className="size-4 shrink-0 text-slate-400" />
                          )}
                          <span
                            className={`text-sm ${
                              isChecked
                                ? 'text-slate-400 line-through dark:text-slate-500'
                                : 'text-slate-800 dark:text-slate-100'
                            }`}
                          >
                            {label}
                          </span>
                        </button>
                        {!isChecked && label.trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              onSendToTodayBullet(label.trim());
                              setSentFeedback(`"${label.trim().slice(0, 24)}..." enviado para Hoje`);
                              setTimeout(() => setSentFeedback(null), 2200);
                            }}
                            className="flex min-h-[34px] shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                            title="Enviar para Bullets de Hoje"
                          >
                            <Send className="size-3" />
                            <span className="hidden sm:inline">Hoje</span>
                          </button>
                        )}
                      </div>
                    );
                  }
                  return (
                    <p
                      key={idx}
                      className="px-2 py-0.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
                    >
                      {line || '\u00A0'}
                    </p>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {sentFeedback ?? 'Dica: use "- [ ] item" para checklists clicáveis'}
              </span>
              <button
                type="button"
                onClick={() => {
                  onUpdateNote(activeNote.id, {
                    content: `${activeNote.content ? activeNote.content + '\n' : ''}- [ ] `,
                  });
                  setEditorMode('edit');
                }}
                className="min-h-[36px] rounded-lg bg-slate-100 px-3 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
              >
                + Inserir tarefa
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
