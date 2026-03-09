import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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

  res.status(201).json({
    token,
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

  res.json({
    token,
    user: { id: user.id, username: user.username, createdAt: user.created_at },
  });
}
