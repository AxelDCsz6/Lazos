import { Response } from 'express';
import fs from 'fs';
import { db } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { notifyNewMessage } from '../services/notificationService';
import { isImageMime, isVideoMime } from '../middleware/upload';
import { emitToLazo } from '../realtime';

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
         m.media_url,
         m.media_mime,
         m.media_width,
         m.media_height,
         m.media_duration_ms,
         r.content   AS reply_content,
         r.sender_id AS reply_sender_id,
         r.type      AS reply_type,
         r.media_url AS reply_media_url,
         r.media_mime AS reply_media_mime,
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
        `SELECT content, sender_id, type, media_url, media_mime FROM messages WHERE id = $1`,
        [msg.reply_to_id],
      );
      if (replyResult.rows.length > 0) {
        msg.reply_content = replyResult.rows[0].content;
        msg.reply_sender_id = replyResult.rows[0].sender_id;
        msg.reply_type = replyResult.rows[0].type;
        msg.reply_media_url = replyResult.rows[0].media_url;
        msg.reply_media_mime = replyResult.rows[0].media_mime;
      }
    }

    msg.reactions = [];

    res.status(201).json({ message: msg });

    // Realtime: avisar a los miembros del lazo (incluye al emisor; el cliente
    // hace dedupe por id, evitando duplicados con el optimistic update).
    emitToLazo(lazoId, 'message:new', msg);

    // Notificación al compañero (fire-and-forget, no bloquea la respuesta)
    notifyNewMessage(lazoId, userId, content.trim()).catch(() => {});
  } catch (err) {
    console.error('[messages/send]', err);
    res.status(500).json({ message: 'Error enviando mensaje' });
  }
}

// ─── POST /api/lazos/:id/messages/media ────────────────────────
// Recibe multipart con field `file`. El middleware uploadMessageMedia
// ya validó mime y guardó el archivo en uploads/<lazoId>/<uuid>.<ext>.
export async function sendMediaMessage(req: AuthRequest, res: Response): Promise<void> {
  const cleanupFile = () => {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => { /* best-effort */ });
    }
  };

  try {
    const userId = req.userId;
    if (!userId) {
      cleanupFile();
      res.status(401).json({ message: 'No autorizado' });
      return;
    }

    const lazoId = req.params.id;
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: 'Archivo requerido (field "file")' });
      return;
    }

    const hasAccess = await checkLazoAccess(lazoId, userId);
    if (!hasAccess) {
      cleanupFile();
      res.status(403).json({ message: 'No tienes acceso a este lazo' });
      return;
    }

    const replyToId = typeof req.body?.reply_to_id === 'string' ? req.body.reply_to_id : null;
    if (replyToId) {
      const replyCheck = await db.query(
        `SELECT id FROM messages WHERE id = $1 AND lazo_id = $2`,
        [replyToId, lazoId],
      );
      if (replyCheck.rows.length === 0) {
        cleanupFile();
        res.status(400).json({ message: 'Mensaje de respuesta no válido' });
        return;
      }
    }

    const type = isVideoMime(file.mimetype) ? 'video' : isImageMime(file.mimetype) ? 'photo' : null;
    if (!type) {
      cleanupFile();
      res.status(400).json({ message: 'Tipo de archivo no permitido' });
      return;
    }

    // Límites más estrictos por tipo (multer ya filtró por tamaño global de 50MB)
    if (type === 'photo' && file.size > 10 * 1024 * 1024) {
      cleanupFile();
      res.status(400).json({ message: 'Imagen demasiado grande (máx 10MB)' });
      return;
    }

    // URL relativa que el cliente compondrá con API_BASE_URL
    const mediaUrl = `/media/${lazoId}/${file.filename}`;

    // Dimensiones/duración opcionales (llegan como strings en multipart)
    const toPositiveInt = (v: unknown): number | null => {
      const n = parseInt(String(v ?? ''), 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const mediaWidth = toPositiveInt(req.body?.media_width);
    const mediaHeight = toPositiveInt(req.body?.media_height);
    const mediaDurationMs = toPositiveInt(req.body?.media_duration_ms);

    const result = await db.query(
      `INSERT INTO messages
         (lazo_id, sender_id, content, type, status, reply_to_id,
          media_url, media_mime, media_size, media_width, media_height, media_duration_ms)
       VALUES ($1, $2, '', $3, 'sent', $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, lazo_id, sender_id, content, type, status, created_at,
                 reply_to_id, media_url, media_mime, media_width, media_height,
                 media_duration_ms`,
      [lazoId, userId, type, replyToId, mediaUrl, file.mimetype, file.size,
       mediaWidth, mediaHeight, mediaDurationMs],
    );

    const msg = result.rows[0];

    if (msg.reply_to_id) {
      const replyResult = await db.query(
        `SELECT content, sender_id, type, media_url, media_mime FROM messages WHERE id = $1`,
        [msg.reply_to_id],
      );
      if (replyResult.rows.length > 0) {
        msg.reply_content = replyResult.rows[0].content;
        msg.reply_sender_id = replyResult.rows[0].sender_id;
        msg.reply_type = replyResult.rows[0].type;
        msg.reply_media_url = replyResult.rows[0].media_url;
        msg.reply_media_mime = replyResult.rows[0].media_mime;
      }
    }

    msg.reactions = [];

    res.status(201).json({ message: msg });

    // Realtime: ver comentario en sendMessage
    emitToLazo(lazoId, 'message:new', msg);

    const preview = type === 'photo' ? '📷 Foto' : '🎬 Video';
    notifyNewMessage(lazoId, userId, preview).catch(() => {});
  } catch (err) {
    cleanupFile();
    console.error('[messages/sendMedia]', err);
    res.status(500).json({ message: 'Error enviando archivo' });
  }
}
