import { db } from '../config/database';

// Mata plantas que llevan 5 o más días sin riego mutuo
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

function msUntilNextMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  ));
  return midnight.getTime() - now.getTime();
}

export function startStreakJob(): void {
  const scheduleNext = () => {
    const delay = msUntilNextMidnightUTC();
    const nextRun = new Date(Date.now() + delay).toISOString();
    console.log(`[streakJob] Próxima ejecución: ${nextRun}`);

    setTimeout(async () => {
      await checkPlantDeaths();
      scheduleNext();
    }, delay);
  };

  scheduleNext();
}
