import { Response } from 'express';
import { db } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { notifyNewMessage } from '../services/notificationService';

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
      `SELECT
         m.id,
         m.lazo_id,
         m.sender_id,
         m.content,
         m.type,
         m.status,
         m.created_at,
         m.reply_to_id,
         r.content   AS reply_content,
         r.sender_id AS reply_sender_id,
         COALESCE(
           (SELECT json_agg(json_build_object('userId', rx.user_id, 'type', rx.type))
            FROM reactions rx
            WHERE rx.message_id = m.id),
           '[]'
         ) AS reactions
       FROM messages m
       LEFT JOIN messages r ON r.id = m.reply_to_id
       WHERE m.lazo_id = $1
       ORDER BY m.created_at DESC
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
    const { content, reply_to_id } = req.body as { content?: string; reply_to_id?: string };

    if (!content || !content.trim()) {
      res.status(400).json({ message: 'El mensaje no puede estar vacío' });
      return;
    }

    const hasAccess = await checkLazoAccess(lazoId, userId);
    if (!hasAccess) {
      res.status(403).json({ message: 'No tienes acceso a este lazo' });
      return;
    }

    // Validate reply_to_id belongs to this lazo if provided
    if (reply_to_id) {
      const replyCheck = await db.query(
        `SELECT id FROM messages WHERE id = $1 AND lazo_id = $2`,
        [reply_to_id, lazoId],
      );
      if (replyCheck.rows.length === 0) {
        res.status(400).json({ message: 'Mensaje de respuesta no válido' });
        return;
      }
    }

    const result = await db.query(
      `INSERT INTO messages (lazo_id, sender_id, content, type, status, reply_to_id)
       VALUES ($1, $2, $3, 'text', 'sent', $4)
       RETURNING id, lazo_id, sender_id, content, type, status, created_at, reply_to_id`,
      [lazoId, userId, content.trim(), reply_to_id ?? null],
    );

    const msg = result.rows[0];

    // Fetch reply content if present
    if (msg.reply_to_id) {
      const replyResult = await db.query(
        `SELECT content, sender_id FROM messages WHERE id = $1`,
        [msg.reply_to_id],
      );
      if (replyResult.rows.length > 0) {
        msg.reply_content = replyResult.rows[0].content;
        msg.reply_sender_id = replyResult.rows[0].sender_id;
      }
    }

    msg.reactions = [];

    res.status(201).json({ message: msg });

    // Notificación al compañero (fire-and-forget, no bloquea la respuesta)
    notifyNewMessage(lazoId, userId, content.trim()).catch(() => {});
  } catch (err) {
    console.error('[messages/send]', err);
    res.status(500).json({ message: 'Error enviando mensaje' });
  }
}
