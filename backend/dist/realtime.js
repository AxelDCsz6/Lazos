"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitToLazo = emitToLazo;
exports.emitToUser = emitToUser;
exports.initRealtime = initRealtime;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("./config/database");
// ─── Estado en memoria ────────────────────────────────────────
let io = null;
// Mapa userId → set de socket ids. Permite emitir directamente a un usuario
// (todas sus pestañas/dispositivos conectados) sin pasar por salas globales.
const userSockets = new Map();
function addUserSocket(userId, socketId) {
    let set = userSockets.get(userId);
    if (!set) {
        set = new Set();
        userSockets.set(userId, set);
    }
    set.add(socketId);
}
function removeUserSocket(userId, socketId) {
    const set = userSockets.get(userId);
    if (!set) {
        return;
    }
    set.delete(socketId);
    if (set.size === 0) {
        userSockets.delete(userId);
    }
}
// ─── Helpers públicos para emitir desde los controllers ───────
function emitToLazo(lazoId, event, payload) {
    if (!io) {
        return;
    }
    io.to(`lazo:${lazoId}`).emit(event, payload);
}
function emitToUser(userId, event, payload) {
    if (!io) {
        return;
    }
    const set = userSockets.get(String(userId));
    if (!set) {
        return;
    }
    set.forEach(socketId => {
        io.to(socketId).emit(event, payload);
    });
}
// ─── Inicialización del servidor de sockets ───────────────────
function initRealtime(server) {
    io = new socket_io_1.Server(server, {
        cors: { origin: '*' },
        // Acepta polling y websocket; el cliente fija websocket para evitar fallback
        transports: ['websocket', 'polling'],
    });
    // Middleware de autenticación por JWT (mismo secret que auth REST)
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token
                ?? socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
            if (!token) {
                return next(new Error('Token requerido'));
            }
            const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'dev_secret');
            socket.data.userId = String(payload.userId);
            next();
        }
        catch {
            next(new Error('Token inválido o expirado'));
        }
    });
    io.on('connection', (socket) => {
        const userId = String(socket.data.userId ?? '');
        if (!userId) {
            socket.disconnect(true);
            return;
        }
        addUserSocket(userId, socket.id);
        // El cliente envía un join con la lista de lazoIds a los que desea suscribirse.
        // Verificamos pertenencia en BD antes de unir a las salas — un cliente malicioso
        // no debe poder escuchar lazos ajenos.
        socket.on('join', async (rawIds) => {
            if (!Array.isArray(rawIds)) {
                return;
            }
            const lazoIds = rawIds.filter((x) => typeof x === 'string' && x.length > 0);
            if (lazoIds.length === 0) {
                return;
            }
            try {
                const result = await database_1.db.query(`SELECT id FROM lazos
           WHERE id = ANY($1::uuid[])
             AND (user1_id = $2 OR user2_id = $2)
             AND is_active = TRUE`, [lazoIds, userId]);
                const allowed = new Set(result.rows.map(r => String(r.id)));
                for (const id of lazoIds) {
                    if (allowed.has(String(id))) {
                        socket.join(`lazo:${id}`);
                    }
                }
            }
            catch (err) {
                console.error('[realtime] error verificando lazos en join:', err);
            }
        });
        socket.on('disconnect', () => {
            removeUserSocket(userId, socket.id);
        });
    });
    return io;
}
