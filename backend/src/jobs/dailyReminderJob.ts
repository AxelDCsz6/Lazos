import { sendDailyWateringReminders } from '../services/notificationService';

const TZ = 'America/Mexico_City';
const REMINDER_HOUR = 20; // 8 pm CDMX

function msUntilNextReminderCDMX(): number {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-GB', {
    timeZone: TZ,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const [h, m, s] = timeStr.split(':').map(Number);

  const secsNow = h * 3600 + m * 60 + s;
  const secsTarget = REMINDER_HOUR * 3600;

  // Si aún no llegamos a las 8pm, esperamos la diferencia; si ya pasó, esperamos hasta mañana
  const secsUntil = secsTarget > secsNow
    ? secsTarget - secsNow
    : 86400 - secsNow + secsTarget;

  return secsUntil * 1000;
}

export function startDailyReminderJob(): void {
  const scheduleNext = () => {
    const delay = msUntilNextReminderCDMX();

    const nextRun = new Date(Date.now() + delay).toLocaleString('es-MX', {
      timeZone: TZ, dateStyle: 'short', timeStyle: 'short',
    });
    console.log(`[reminderJob] Próximo recordatorio: ${nextRun} CDMX`);

    setTimeout(async () => {
      console.log('[reminderJob] Enviando recordatorios diarios...');
      await sendDailyWateringReminders();
      scheduleNext();
    }, delay);
  };

  scheduleNext();
}
