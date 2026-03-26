import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'dev_refresh_secret';
const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || '30d';

export async function register(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;

  // Verificar si el usuario ya existe
  const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.rows.length > 0) {
    res.status(409).json({ message: 'El nombre de usuario ya está en uso' });
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const id = uuidv4();

  await db.query(
    'INSERT INTO users (id, username, password) VALUES ($1, $2, $3)',
    [id, username, hash],
  );

  const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as object);
  const refreshToken = jwt.sign({ userId: id, type: 'refresh' }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN } as object);

  res.status(201).json({
    token,
    refreshToken,
    user: { id, username, createdAt: new Date().toISOString() },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;

  const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = result.rows[0];

  if (!user) {
    res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    return;
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as object);
  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN } as object);

  res.json({
    token,
    refreshToken,
    user: { id: user.id, username: user.username, createdAt: user.created_at },
  });
}

// ─── POST /api/auth/refresh ────────────────────────────────────
export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ message: 'refreshToken requerido' });
    return;
  }

  let payload: { userId: string; type: string };
  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET) as { userId: string; type: string };
  } catch {
    res.status(401).json({ message: 'Token inválido o expirado' });
    return;
  }

  if (payload.type !== 'refresh') {
    res.status(401).json({ message: 'Token inválido' });
    return;
  }

  const result = await db.query('SELECT id FROM users WHERE id = $1', [payload.userId]);
  if (result.rows.length === 0) {
    res.status(401).json({ message: 'Usuario no encontrado' });
    return;
  }

  const token = jwt.sign({ userId: payload.userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as object);
  res.json({ token });
}

// ─── PUT /api/auth/fcm-token ───────────────────────────────────
export async function updateFcmToken(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ message: 'No autorizado' }); return; }

  const { token } = req.body as { token?: string };
  if (!token) { res.status(400).json({ message: 'Token requerido' }); return; }

  await db.query('UPDATE users SET fcm_token = $1 WHERE id = $2', [token, userId]);
  res.json({ success: true });
}
