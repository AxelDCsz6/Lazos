import { Response } from 'express';
import { db } from '../config/database';
import { AuthRequest } from '../middleware/auth';

// ─── Helpers ──────────────────────────────────────────────────
function randomSet(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function generateInviteCode(): string {
  return `${randomSet()}-${randomSet()}-${randomSet()}`;
}

// ─── POST /api/lazos/generate ─────────────────────────────────
export async function generateCode(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) { res.status(401).json({ message: 'No autorizado' }); return; }

    const code = generateInviteCode();

    // Si el usuario ya tiene un código activo, lo reemplazamos
    await db.query(
      `DELETE FROM invite_codes WHERE creator_id = $1`,
      [userId],
    );

    await db.query(
      `INSERT INTO invite_codes (code, creator_id, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
      [code, userId],
    );

    const result = await db.query(
      `SELECT expires_at FROM invite_codes WHERE code = $1`,
      [code],
    );

    res.json({ code, expiresAt: result.rows[0].expires_at });
  } catch (err) {
    console.error('[lazos/generate]', err);
    res.status(500).json({ message: 'Error generando código' });
  }
}

// ─── POST /api/lazos/join ─────────────────────────────────────
export async function joinLazo(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) { res.status(401).json({ message: 'No autorizado' }); return; }

    const raw  = (req.body.code as string) ?? '';
    const code = raw.toLowerCase().trim();

    if (!code) {
      res.status(400).json({ message: 'Código requerido' });
      return;
    }

    // Buscar código válido y no usado, no expirado
    const codeResult = await db.query(
      `SELECT * FROM invite_codes
       WHERE code = $1 AND used = FALSE AND expires_at > NOW()`,
      [code],
    );

    if (codeResult.rows.length === 0) {
      res.status(404).json({ message: 'Código inválido o expirado' });
      return;
    }

    const invite = codeResult.rows[0];

    // No puedes usar tu propio código
    if (String(invite.creator_id) === String(userId)) {
      res.status(400).json({ message: 'No puedes usar tu propio código' });
      return;
    }

    // Evitar lazos duplicados
    const existing = await db.query(
      `SELECT id FROM lazos
       WHERE (user1_id = $1 AND user2_id = $2)
          OR (user1_id = $2 AND user2_id = $1)`,
      [invite.creator_id, userId],
    );

    if (existing.rows.length > 0) {
      res.status(409).json({ message: 'Ya tienes un lazo con este usuario' });
      return;
    }

    // Crear el lazo (user1 = creador del código, user2 = quien se une)
    const lazoResult = await db.query(
      `INSERT INTO lazos (user1_id, user2_id)
       VALUES ($1, $2)
       RETURNING id`,
      [invite.creator_id, userId],
    );

    // Marcar código como usado (el cleanup job lo borrará, pero marcamos ya)
    await db.query(
      `UPDATE invite_codes SET used = TRUE WHERE code = $1`,
      [code],
    );

    res.json({
      success: true,
      message: 'Lazo creado correctamente',
      lazoId: lazoResult.rows[0].id,
    });
  } catch (err) {
    console.error('[lazos/join]', err);
    res.status(500).json({ message: 'Error al unirse al lazo' });
  }
}

// ─── GET /api/lazos ───────────────────────────────────────────
export async function getLazos(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) { res.status(401).json({ message: 'No autorizado' }); return; }

    const result = await db.query(
      `SELECT
         l.id,
         l.streak,
         l.plant_phase,
         l.plant_xp,
         l.created_at,
         CASE WHEN l.user1_id = $1 THEN u2.username ELSE u1.username END AS partner_username,
         CASE WHEN l.user1_id = $1 THEN l.user2_id  ELSE l.user1_id  END AS partner_id
       FROM lazos l
       JOIN users u1 ON u1.id = l.user1_id
       JOIN users u2 ON u2.id = l.user2_id
       WHERE (l.user1_id = $1 OR l.user2_id = $1) AND l.is_active = TRUE
       ORDER BY l.updated_at DESC`,
      [userId],
    );

    res.json({ lazos: result.rows });
  } catch (err) {
    console.error('[lazos/get]', err);
    res.status(500).json({ message: 'Error obteniendo lazos' });
  }
}
