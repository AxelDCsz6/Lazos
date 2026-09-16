import { db } from '../config/database';
import { notifyStreakLost } from '../services/notificationService';

const TZ = 'America/Mexico_City';

// Mata plantas que llevan 5 o más días sin riego mutuo.
// CURRENT_DATE en las queries ya opera en hora CDMX gracias al
// timezone configurado en database.ts.
async function checkPlantDeaths(): Promise<void> {
  try {
    // Seleccionar primero para capturar el streak ANTES de reiniciarlo a 0
    // (se usa en la notificación de racha perdida).
    const select = await db.query(
      `SELECT id, streak
       FROM lazos
       WHERE is_active = TRUE
         AND plant_phase != 'dead'
         AND (
           (last_mutual_watering_on IS NULL     AND CURRENT_DATE - created_at::date >= 5)
           OR
           (last_mutual_watering_on IS NOT NULL AND CURRENT_DATE - last_mutual_watering_on >= 5)
         )`,
    );
    if (select.rows.length === 0) { return; }
    const ids = select.rows.map((r: { id: string }) => r.id);
    await db.query(
      `UPDATE lazos
       SET plant_phase = 'dead', streak = 0, updated_at = NOW()
       WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    console.log(`[streakJob] ${ids.length} planta(s) murieron por falta de riego`);
    // Notificar racha perdida a ambos usuarios de cada lazo (fire-and-forget)
    for (const row of select.rows) {
      notifyStreakLost(row.id, Number(row.streak)).catch(() => {});
    }
  } catch (err) {
    console.error('[streakJob] Error en checkPlantDeaths:', err);
  }
}

// Inserta mensajes de sistema "No se ha regado, quedan N días" en lazos
// activos que llevan 1-4 días sin riego mutuo (la planta muere a los 5).
// sender_id = user1_id del lazo: es un mensaje de sistema, el render del
// cliente no atribuye remitente.
async function sendWateringWarnings(): Promise<void> {
  try {
    const result = await db.query(
      `SELECT l.id, l.user1_id,
              (CURRENT_DATE - COALESCE(l.last_mutual_watering_on, l.created_at::date)) AS days_without
       FROM lazos l
       WHERE l.is_active = TRUE
         AND l.plant_phase != 'dead'
         AND (CURRENT_DATE - COALESCE(l.last_mutual_watering_on, l.created_at::date))
               BETWEEN 1 AND 4`,
    );
    for (const row of result.rows) {
      const remaining = 5 - Number(row.days_without);
      const content = remaining === 1
        ? 'No se ha regado, queda 1 día'
        : `No se ha regado, quedan ${remaining} días`;
      await db.query(
        `INSERT INTO messages (lazo_id, sender_id, content, type, status)
         VALUES ($1, $2, $3, 'system', 'sent')`,
        [row.id, row.user1_id, content],
      );
    }
    if (result.rowCount && result.rowCount > 0) {
      console.log(`[streakJob] ${result.rowCount} aviso(s) de riego insertados`);
    }
  } catch (err) {
    console.error('[streakJob] Error en sendWateringWarnings:', err);
  }
}

// Calcula los ms que faltan hasta las 00:00:00 en zona CDMX.
// Usa Intl para manejar automáticamente el cambio de horario de verano.
function msUntilNextMidnightCDMX(): number {
  const now = new Date();

  // Hora actual descompuesta en CDMX
  const timeStr = now.toLocaleTimeString('en-GB', {
    timeZone: TZ,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const [h, m, s] = timeStr.split(':').map(Number);

  const secsFromMidnight = h * 3600 + m * 60 + s;
  const secsUntilMidnight = 86400 - secsFromMidnight;
  return secsUntilMidnight * 1000;
}

export function startStreakJob(): void {
  const scheduleNext = () => {
    const delay = msUntilNextMidnightCDMX();

    // Log en hora CDMX para que sea legible
    const nextRun = new Date(Date.now() + delay).toLocaleString('es-MX', {
      timeZone: TZ, dateStyle: 'short', timeStyle: 'short',
    });
    console.log(`[streakJob] Próxima ejecución: ${nextRun} CDMX`);

    setTimeout(async () => {
      console.log('[streakJob] Ejecutando revisión de plantas...');
      await checkPlantDeaths();
      await sendWateringWarnings();
      scheduleNext();
    }, delay);
  };

  scheduleNext();
}
