import { Response } from 'express';
import { db } from '../config/database';
import { AuthRequest } from '../middleware/auth';

// ─── Helper: verifica que el usuario pertenece al lazo ────────
async function checkLazoAccess(lazoId: string, userId: string): Promise<boolean> {
  const result = await db.query(
    `SELECT id FROM lazos
     WHERE id = $1 AND (user1_id = $2 OR user2_id = $2) AND is_active = TRUE`,
    [lazoId, userId],
  );
  return result.rows.length > 0;
}

// ─── GET /api/lazos/:id/messages?page=1 ───────────────────────
export async function getMessages(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) { res.status(401).json({ message: 'No autorizado' }); return; }

    const lazoId = req.params.id;
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const hasAccess = await checkLazoAccess(lazoId, userId);
    if (!hasAccess) {
      res.status(403).json({ message: 'No tienes acceso a este lazo' });
      return;
    }

    const result = await db.query(
      `SELECT id, lazo_id, sender_id, content, type, status, created_at
       FROM messages
       WHERE lazo_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [lazoId, limit, offset],
    );

    res.json({ messages: result.rows });
  } catch (err) {
    console.error('[messages/get]', err);
    res.status(500).json({ message: 'Error obteniendo mensajes' });
  }
}

// ─── POST /api/lazos/:id/messages ─────────────────────────────
export async function sendMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) { res.status(401).json({ message: 'No autorizado' }); return; }

    const lazoId = req.params.id;
    const { content } = req.body as { content?: string };

    if (!content || !content.trim()) {
      res.status(400).json({ message: 'El mensaje no puede estar vacío' });
      return;
    }

    const hasAccess = await checkLazoAccess(lazoId, userId);
    if (!hasAccess) {
      res.status(403).json({ message: 'No tienes acceso a este lazo' });
      return;
    }

    const result = await db.query(
      `INSERT INTO messages (lazo_id, sender_id, content, type, status)
       VALUES ($1, $2, $3, 'text', 'sent')
       RETURNING id, lazo_id, sender_id, content, type, status, created_at`,
      [lazoId, userId, content.trim()],
    );

    res.status(201).json({ message: result.rows[0] });
  } catch (err) {
    console.error('[messages/send]', err);
    res.status(500).json({ message: 'Error enviando mensaje' });
  }
}
