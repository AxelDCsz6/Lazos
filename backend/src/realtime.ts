import type { Server as HttpServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { db } from './config/database';

// ─── Estado en memoria ────────────────────────────────────────
let io: IOServer | null = null;

// Mapa userId → set de socket ids. Permite emitir directamente a un usuario
// (todas sus pestañas/dispositivos conectados) sin pasar por salas globales.
const userSockets = new Map<string, Set<string>>();

function addUserSocket(userId: string, socketId: string): void {
  let set = userSockets.get(userId);
  if (!set) {
    set = new Set();
    userSockets.set(userId, set);
  }
  set.add(socketId);
}

function removeUserSocket(userId: string, socketId: string): void {
  const set = userSockets.get(userId);
  if (!set) { return; }
  set.delete(socketId);
  if (set.size === 0) { userSockets.delete(userId); }
}

// ─── Helpers públicos para emitir desde los controllers ───────
export function emitToLazo(lazoId: string, event: string, payload: unknown): void {
  if (!io) { return; }
  io.to(`lazo:${lazoId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!io) { return; }
  const set = userSockets.get(String(userId));
  if (!set) { return; }
  set.forEach(socketId => {
    io!.to(socketId).emit(event, payload);
  });
}

// ─── Inicialización del servidor de sockets ───────────────────
export function initRealtime(server: HttpServer): IOServer {
  io = new IOServer(server, {
    cors: { origin: '*' },
    // Acepta polling y websocket; el cliente fija websocket para evitar fallback
    transports: ['websocket', 'polling'],
  });

  // Middleware de autenticación por JWT (mismo secret que auth REST)
  io.use((socket, next) => {
    try {
      const token = (socket.handshake.auth?.token as string | undefined)
        ?? (socket.handshake.headers?.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
      if (!token) { return next(new Error('Token requerido')); }
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret') as { userId: string };
      (socket.data as { userId?: string }).userId = String(payload.userId);
      next();
    } catch {
      next(new Error('Token inválido o expirado'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = String((socket.data as { userId?: string }).userId ?? '');
    if (!userId) { socket.disconnect(true); return; }

    addUserSocket(userId, socket.id);

    // El cliente envía un join con la lista de lazoIds a los que desea suscribirse.
    // Verificamos pertenencia en BD antes de unir a las salas — un cliente malicioso
    // no debe poder escuchar lazos ajenos.
    socket.on('join', async (rawIds: unknown) => {
      if (!Array.isArray(rawIds)) { return; }
      const lazoIds = rawIds.filter((x): x is string => typeof x === 'string' && x.length > 0);
      if (lazoIds.length === 0) { return; }

      try {
        const result = await db.query(
          `SELECT id FROM lazos
           WHERE id = ANY($1::uuid[])
             AND (user1_id = $2 OR user2_id = $2)
             AND is_active = TRUE`,
          [lazoIds, userId],
        );
        const allowed = new Set(result.rows.map(r => String(r.id)));
        for (const id of lazoIds) {
          if (allowed.has(String(id))) {
            socket.join(`lazo:${id}`);
          }
        }
      } catch (err) {
        console.error('[realtime] error verificando lazos en join:', err);
      }
    });

    socket.on('disconnect', () => {
      removeUserSocket(userId, socket.id);
    });
  });

  return io;
}
