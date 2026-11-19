import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { mergePlannerStates } from './src/lib/mergeState.ts';
import type { CloudBackupMeta, PlannerState } from './src/lib/types.ts';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), '.rhythm-cloud');
const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

fs.mkdirSync(WORKSPACES_DIR, { recursive: true });
fs.mkdirSync(BACKUPS_DIR, { recursive: true });

function sanitizeWorkspaceId(raw: string): string | null {
  const cleaned = (raw || '').trim();
  if (!/^[a-zA-Z0-9_-]{3,48}$/.test(cleaned)) return null;
  return cleaned;
}

function sanitizeBackupId(raw: string): string | null {
  const cleaned = (raw || '').trim();
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(cleaned)) return null;
  return cleaned;
}

function workspacePath(id: string): string {
  return path.join(WORKSPACES_DIR, `${id}.json`);
}

function workspaceBackupDir(id: string): string {
  const dir = path.join(BACKUPS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readWorkspace(id: string): PlannerState | null {
  const file = workspacePath(id);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as PlannerState;
  } catch {
    return null;
  }
}

function writeWorkspace(id: string, state: PlannerState): void {
  fs.writeFileSync(workspacePath(id), JSON.stringify(state, null, 2), 'utf8');
}

function listBackups(id: string): CloudBackupMeta[] {
  const dir = workspaceBackupDir(id);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const metas: CloudBackupMeta[] = [];
  for (const file of files) {
    try {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as {
        id: string;
        createdAt: number;
        label: string;
        state: PlannerState;
      };
      metas.push({
        id: parsed.id,
        createdAt: parsed.createdAt,
        label: parsed.label,
        sizeBytes: stat.size,
        itemCounts: {
          blocks: parsed.state.blocks?.length ?? 0,
          bullets: parsed.state.bullets?.length ?? 0,
          notes: parsed.state.notes?.length ?? 0,
          focusSessions: parsed.state.focusSessions?.length ?? 0,
        },
      });
    } catch {
      // Ignore malformed backup
    }
  }
  return metas.sort((a, b) => b.createdAt - a.createdAt);
}

function createBackupSnapshot(id: string, state: PlannerState, label: string): CloudBackupMeta {
  const dir = workspaceBackupDir(id);
  const createdAt = Date.now();
  const backupId = `bkp_${createdAt}_${Math.random().toString(36).slice(2, 6)}`;
  const payload = { id: backupId, createdAt, label, state };
  const serialized = JSON.stringify(payload);
  const fullPath = path.join(dir, `${backupId}.json`);
  fs.writeFileSync(fullPath, serialized, 'utf8');

  // Keep latest 25 snapshots
  const all = listBackups(id);
  if (all.length > 25) {
    for (const old of all.slice(25)) {
      const oldPath = path.join(dir, `${old.id}.json`);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
  }

  return {
    id: backupId,
    createdAt,
    label,
    sizeBytes: Buffer.byteLength(serialized, 'utf8'),
    itemCounts: {
      blocks: state.blocks?.length ?? 0,
      bullets: state.bullets?.length ?? 0,
      notes: state.notes?.length ?? 0,
      focusSessions: state.focusSessions?.length ?? 0,
    },
  };
}

const lastAutoBackupAt = new Map<string, number>();

interface ClientSocket {
  ws: WebSocket;
  workspaceId: string;
  clientId: string;
  isAlive: boolean;
}

const clients = new Set<ClientSocket>();

function broadcastToWorkspace(
  workspaceId: string,
  payload: unknown,
  excludeClientId?: string
): void {
  const msg = JSON.stringify(payload);
  for (const client of clients) {
    if (
      client.workspaceId === workspaceId &&
      client.clientId !== excludeClientId &&
      client.ws.readyState === WebSocket.OPEN
    ) {
      client.ws.send(msg);
    }
  }
}

function broadcastPresence(workspaceId: string): void {
  let count = 0;
  for (const client of clients) {
    if (client.workspaceId === workspaceId && client.ws.readyState === WebSocket.OPEN) {
      count++;
    }
  }
  broadcastToWorkspace(workspaceId, { type: 'presence:count', count });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.get('/api/workspace/:id', (req, res) => {
    const id = sanitizeWorkspaceId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Chave de workspace inválida.' });
    const state = readWorkspace(id);
    const backups = listBackups(id);
    return res.json({ workspaceId: id, state, backups });
  });

  app.post('/api/workspace/:id/sync', (req, res) => {
    const id = sanitizeWorkspaceId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Chave de workspace inválida.' });
    const incoming = req.body?.state as PlannerState | undefined;
    const senderClientId = typeof req.body?.clientId === 'string' ? req.body.clientId : undefined;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'Payload de estado inválido.' });
    }

    const existing = readWorkspace(id);
    const merged = existing ? mergePlannerStates(existing, incoming) : incoming;
    writeWorkspace(id, merged);

    // Automatic cloud backup every 60s on changes
    const now = Date.now();
    const lastBkp = lastAutoBackupAt.get(id) ?? 0;
    let newBackup: CloudBackupMeta | null = null;
    if (now - lastBkp >= 60_000) {
      newBackup = createBackupSnapshot(id, merged, 'Backup automático em nuvem');
      lastAutoBackupAt.set(id, now);
    }

    broadcastToWorkspace(
      id,
      { type: 'sync:state', state: merged, senderClientId, serverTime: now },
      senderClientId
    );

    return res.json({
      ok: true,
      state: merged,
      serverTime: now,
      newBackup,
    });
  });

  app.get('/api/workspace/:id/backups', (req, res) => {
    const id = sanitizeWorkspaceId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Chave de workspace inválida.' });
    return res.json({ backups: listBackups(id) });
  });

  app.post('/api/workspace/:id/backup', (req, res) => {
    const id = sanitizeWorkspaceId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Chave de workspace inválida.' });
    const incoming = req.body?.state as PlannerState | undefined;
    const label = typeof req.body?.label === 'string' && req.body.label.trim()
      ? req.body.label.trim().slice(0, 60)
      : 'Backup manual';

    const existing = readWorkspace(id);
    const target = incoming ? (existing ? mergePlannerStates(existing, incoming) : incoming) : existing;
    if (!target) return res.status(404).json({ error: 'Nenhum dado encontrado para backup.' });

    writeWorkspace(id, target);
    const backup = createBackupSnapshot(id, target, label);
    lastAutoBackupAt.set(id, Date.now());
    return res.json({ ok: true, backup, backups: listBackups(id) });
  });

  app.post('/api/workspace/:id/restore/:backupId', (req, res) => {
    const id = sanitizeWorkspaceId(req.params.id);
    const backupId = sanitizeBackupId(req.params.backupId);
    if (!id || !backupId) return res.status(400).json({ error: 'Parâmetros inválidos.' });
    const fullPath = path.join(workspaceBackupDir(id), `${backupId}.json`);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Backup não encontrado.' });
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as { state: PlannerState };
      const restored: PlannerState = { ...parsed.state, updatedAt: Date.now() };
      writeWorkspace(id, restored);
      broadcastToWorkspace(id, { type: 'sync:state', state: restored, serverTime: Date.now() });
      return res.json({ ok: true, state: restored });
    } catch {
      return res.status(500).json({ error: 'Falha ao ler o backup.' });
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/ws', `http://localhost:${PORT}`);
    const workspaceId = sanitizeWorkspaceId(url.searchParams.get('workspace') || 'rhythm-pessoal') || 'rhythm-pessoal';
    const clientId = url.searchParams.get('clientId') || Math.random().toString(36).slice(2);

    const entry: ClientSocket = { ws, workspaceId, clientId, isAlive: true };
    clients.add(entry);

    ws.on('pong', () => {
      entry.isAlive = true;
    });

    // Send latest cloud state immediately upon WS connect
    const latest = readWorkspace(workspaceId);
    if (latest) {
      ws.send(JSON.stringify({ type: 'sync:state', state: latest, serverTime: Date.now() }));
    }
    broadcastPresence(workspaceId);

    ws.on('close', () => {
      clients.delete(entry);
      broadcastPresence(workspaceId);
    });

    ws.on('error', () => {
      clients.delete(entry);
      broadcastPresence(workspaceId);
    });
  });

  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.isAlive) {
        client.ws.terminate();
        clients.delete(client);
        continue;
      }
      client.isAlive = false;
      client.ws.ping();
    }
  }, 25_000);

  wss.on('close', () => clearInterval(heartbeat));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Rhythm Flow server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
