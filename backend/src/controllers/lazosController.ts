import { Response } from 'express';
import { db } from '../config/database';
import { AuthRequest } from '../middleware/auth';

// ─── Helpers ──────────────────────────────────────────────────
function computePlantPhase(xp: number): string {
  if (xp >= 2500) { return 'flower'; }
  if (xp >= 1000) { return 'big'; }
  if (xp >= 500)  { return 'small'; }
  if (xp >= 100)  { return 'sprout'; }
  return 'seed';
}

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
         CASE WHEN l.user1_id = $1 THEN l.user2_id  ELSE l.user1_id  END AS partner_id,
         EXISTS (
           SELECT 1 FROM daily_watering dw
           WHERE dw.lazo_id = l.id AND dw.user_id = $1 AND dw.watered_on = CURRENT_DATE
         ) AS i_watered_today,
         EXISTS (
           SELECT 1 FROM daily_watering dw
           WHERE dw.lazo_id = l.id
             AND dw.user_id = CASE WHEN l.user1_id = $1 THEN l.user2_id ELSE l.user1_id END
             AND dw.watered_on = CURRENT_DATE
         ) AS partner_watered_today,
         CASE
           WHEN l.last_mutual_watering_on IS NULL THEN (CURRENT_DATE - l.created_at::date)
           ELSE (CURRENT_DATE - l.last_mutual_watering_on)
         END AS days_without_mutual
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

// ─── POST /api/lazos/:id/regar ────────────────────────────────
export async function waterLazo(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    const lazoId = req.params.id;
    if (!userId) { res.status(401).json({ message: 'No autorizado' }); return; }

    // Verificar que el lazo existe y el usuario pertenece a él
    const lazoResult = await db.query(
      `SELECT id, user1_id, user2_id, streak, plant_phase, plant_xp
       FROM lazos WHERE id = $1 AND is_active = TRUE`,
      [lazoId],
    );

    if (lazoResult.rows.length === 0) {
      res.status(404).json({ message: 'Lazo no encontrado' }); return;
    }

    const lazo = lazoResult.rows[0];
    const isUser1 = String(lazo.user1_id) === String(userId);
    const isUser2 = String(lazo.user2_id) === String(userId);

    if (!isUser1 && !isUser2) {
      res.status(403).json({ message: 'No tienes acceso a este lazo' }); return;
    }

    const partnerId = isUser1 ? lazo.user2_id : lazo.user1_id;

    // Registrar riego (idempotente: ON CONFLICT DO NOTHING)
    const insertResult = await db.query(
      `INSERT INTO daily_watering (lazo_id, user_id, watered_on)
       VALUES ($1, $2, CURRENT_DATE)
       ON CONFLICT (lazo_id, user_id, watered_on) DO NOTHING
       RETURNING id`,
      [lazoId, userId],
    );

    const isFirstWateringToday = insertResult.rows.length > 0;

    // Comprobar si el compañero ya regó hoy
    const partnerResult = await db.query(
      `SELECT 1 FROM daily_watering
       WHERE lazo_id = $1 AND user_id = $2 AND watered_on = CURRENT_DATE`,
      [lazoId, partnerId],
    );
    const partnerWateredToday = partnerResult.rows.length > 0;

    let streak = Number(lazo.streak);
    let plantXp = Number(lazo.plant_xp);
    let plantPhase = lazo.plant_phase as string;
    let justStreaked = false;

    // Si el compañero ya regó y yo acabo de regar por primera vez hoy
    if (partnerWateredToday && isFirstWateringToday) {
      if (plantPhase === 'dead') {
        // Revivir la planta: restaurar fase según XP actual, racha a 1
        plantPhase = computePlantPhase(plantXp);
        const reviveResult = await db.query(
          `UPDATE lazos
           SET streak = 1, plant_phase = $1, last_mutual_watering_on = CURRENT_DATE, updated_at = NOW()
           WHERE id = $2
           RETURNING streak, plant_phase, plant_xp`,
          [plantPhase, lazoId],
        );
        if (reviveResult.rows.length > 0) {
          streak = Number(reviveResult.rows[0].streak);
          plantXp = Number(reviveResult.rows[0].plant_xp);
          plantPhase = reviveResult.rows[0].plant_phase;
          justStreaked = true;
        }
      } else {
        // Incremento atómico de racha — la condición last_mutual_watering_on < CURRENT_DATE
        // garantiza idempotencia ante llamadas concurrentes
        const updateResult = await db.query(
          `UPDATE lazos
           SET streak = streak + 1,
               plant_xp = plant_xp + 10,
               plant_phase = CASE
                 WHEN plant_xp + 10 >= 2500 THEN 'flower'
                 WHEN plant_xp + 10 >= 1000 THEN 'big'
                 WHEN plant_xp + 10 >= 500  THEN 'small'
                 WHEN plant_xp + 10 >= 100  THEN 'sprout'
                 ELSE 'seed'
               END,
               last_mutual_watering_on = CURRENT_DATE,
               updated_at = NOW()
           WHERE id = $1
             AND (last_mutual_watering_on IS NULL OR last_mutual_watering_on < CURRENT_DATE)
           RETURNING streak, plant_phase, plant_xp`,
          [lazoId],
        );
        if (updateResult.rows.length > 0) {
          streak = Number(updateResult.rows[0].streak);
          plantXp = Number(updateResult.rows[0].plant_xp);
          plantPhase = updateResult.rows[0].plant_phase;
          justStreaked = true;
        }
      }
    }

    res.json({
      success: true,
      alreadyWateredToday: !isFirstWateringToday,
      partnerWateredToday,
      streak,
      plantPhase,
      plantXp,
      justStreaked,
    });
  } catch (err) {
    console.error('[lazos/regar]', err);
    res.status(500).json({ message: 'Error al regar' });
  }
}
