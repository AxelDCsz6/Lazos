"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.refresh = refresh;
exports.updateFcmToken = updateFcmToken;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const database_1 = require("../config/database");
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'dev_refresh_secret';
const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || '30d';
async function register(req, res) {
    const { username, password } = req.body;
    // Verificar si el usuario ya existe
    const existing = await database_1.db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
        res.status(409).json({ message: 'El nombre de usuario ya está en uso' });
        return;
    }
    const hash = await bcryptjs_1.default.hash(password, 12);
    const id = (0, uuid_1.v4)();
    await database_1.db.query('INSERT INTO users (id, username, password) VALUES ($1, $2, $3)', [id, username, hash]);
    const token = jsonwebtoken_1.default.sign({ userId: id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = jsonwebtoken_1.default.sign({ userId: id, type: 'refresh' }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
    res.status(201).json({
        token,
        refreshToken,
        user: { id, username, createdAt: new Date().toISOString() },
    });
}
async function login(req, res) {
    const { username, password } = req.body;
    const result = await database_1.db.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) {
        res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        return;
    }
    const valid = await bcryptjs_1.default.compare(password, user.password);
    if (!valid) {
        res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        return;
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id, type: 'refresh' }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
    res.json({
        token,
        refreshToken,
        user: { id: user.id, username: user.username, createdAt: user.created_at },
    });
}
// ─── POST /api/auth/refresh ────────────────────────────────────
async function refresh(req, res) {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        res.status(400).json({ message: 'refreshToken requerido' });
        return;
    }
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(refreshToken, REFRESH_SECRET);
    }
    catch {
        res.status(401).json({ message: 'Token inválido o expirado' });
        return;
    }
    if (payload.type !== 'refresh') {
        res.status(401).json({ message: 'Token inválido' });
        return;
    }
    const result = await database_1.db.query('SELECT id FROM users WHERE id = $1', [payload.userId]);
    if (result.rows.length === 0) {
        res.status(401).json({ message: 'Usuario no encontrado' });
        return;
    }
    const token = jsonwebtoken_1.default.sign({ userId: payload.userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ token });
}
// ─── PUT /api/auth/fcm-token ───────────────────────────────────
async function updateFcmToken(req, res) {
    const userId = req.userId;
    if (!userId) {
        res.status(401).json({ message: 'No autorizado' });
        return;
    }
    const { token } = req.body;
    if (!token) {
        res.status(400).json({ message: 'Token requerido' });
        return;
    }
    await database_1.db.query('UPDATE users SET fcm_token = $1 WHERE id = $2', [token, userId]);
    console.log(`[auth] FCM token actualizado para user ${userId}: ${token.slice(0, 12)}…`);
    res.json({ success: true });
}
