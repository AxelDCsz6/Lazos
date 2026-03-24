import { db } from '../config/database';

const TZ = 'America/Mexico_City';

// Mata plantas que llevan 5 o más días sin riego mutuo.
// CURRENT_DATE en las queries ya opera en hora CDMX gracias al
// timezone configurado en database.ts.
async function checkPlantDeaths(): Promise<void> {
  try {
    const result = await db.query(
      `UPDATE lazos
       SET plant_phase = 'dead', streak = 0, updated_at = NOW()
       WHERE is_active = TRUE
         AND plant_phase != 'dead'
         AND (
           (last_mutual_watering_on IS NULL     AND CURRENT_DATE - created_at::date >= 5)
           OR
           (last_mutual_watering_on IS NOT NULL AND CURRENT_DATE - last_mutual_watering_on >= 5)
         )
       RETURNING id`,
    );
    if (result.rowCount && result.rowCount > 0) {
      console.log(`[streakJob] ${result.rowCount} planta(s) murieron por falta de riego`);
    }
  } catch (err) {
    console.error('[streakJob] Error en checkPlantDeaths:', err);
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
      scheduleNext();
    }, delay);
  };

  scheduleNext();
}
