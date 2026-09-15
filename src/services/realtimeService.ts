import { DeviceEventEmitter } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { SOCKET_BASE_URL } from '../constants';
import { getToken } from './authStorage';

// ─── Estado del módulo ────────────────────────────────────────
let socket: Socket | null = null;
// Última lista de lazoIds a la que el cliente quiso unirse. Se reenvía en
// cada reconexión para que el servidor vuelva a meternos en las salas.
let lastJoinedIds: string[] = [];

// ─── Conexión ─────────────────────────────────────────────────
export async function connectRealtime(): Promise<void> {
  // Idempotente: si ya hay socket vivo, no hacemos nada.
  if (socket && socket.connected) { return; }
  // Si hay un socket viejo desconectado, límpialo antes.
  if (socket) {
    try { socket.removeAllListeners(); socket.disconnect(); } catch { /* noop */ }
    socket = null;
  }

  const token = await getToken();
  if (!token) { return; }

  socket = io(SOCKET_BASE_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on('connect', () => {
    // Rejoin a todas las salas tras (re)conectar.
    if (lastJoinedIds.length > 0 && socket) {
      socket.emit('join', lastJoinedIds);
    }
  });

  socket.on('connect_error', err => {
    // Silencioso pero loggeado: la red caída es esperable.
    console.warn('[realtime] connect_error:', err?.message ?? err);
  });

  // ── Eventos del servidor → DeviceEventEmitter (consumido por las pantallas)
  socket.on('message:new', (m: unknown) => {
    DeviceEventEmitter.emit('rt:message:new', m);
  });
  socket.on('message:reaction', (p: unknown) => {
    DeviceEventEmitter.emit('rt:message:reaction', p);
  });
  socket.on('watering:update', (p: unknown) => {
    DeviceEventEmitter.emit('rt:watering', p);
  });
  socket.on('lazo:deleted', (p: unknown) => {
    DeviceEventEmitter.emit('rt:lazo:deleted', p);
  });
  socket.on('lazo:created', (p: unknown) => {
    DeviceEventEmitter.emit('rt:lazo:created', p);
  });
}

// ─── Salas ────────────────────────────────────────────────────
export function joinLazos(ids: string[]): void {
  const clean = Array.from(new Set(ids.filter(x => typeof x === 'string' && x.length > 0)));
  lastJoinedIds = clean;
  if (socket && socket.connected && clean.length > 0) {
    socket.emit('join', clean);
  }
}

// ─── Desconexión ──────────────────────────────────────────────
export function disconnectRealtime(): void {
  lastJoinedIds = [];
  if (!socket) { return; }
  try { socket.removeAllListeners(); socket.disconnect(); } catch { /* noop */ }
  socket = null;
}

export function isRealtimeConnected(): boolean {
  return !!socket && socket.connected;
}
