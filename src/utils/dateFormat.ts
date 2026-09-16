// Utilidades de formato de fechas para el chat.

// Nombres de día propios para no depender del locale del dispositivo.
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function startOfDay(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

function diffInCalendarDays(date: Date, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
}

export function isSameCalendarDay(dateIsoA: string, dateIsoB: string): boolean {
  return startOfDay(new Date(dateIsoA)) === startOfDay(new Date(dateIsoB));
}

/**
 * Formato del separador de día del chat:
 * - Mismo día (o futuro)        → "Hoy"
 * - 1 día atrás                 → "Ayer"
 * - 2 a 3 días atrás            → nombre del día en español ("jueves")
 * - Más de 3 días, mismo año    → "dd/mm"
 * - Distinto año (más de 1 año) → "dd/mm/aa"
 */
export function formatChatDateSeparator(dateIso: string, now: Date = new Date()): string {
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) { return ''; }

  const diffDays = diffInCalendarDays(d, now);
  if (diffDays <= 0) { return 'Hoy'; }
  if (diffDays === 1) { return 'Ayer'; }
  if (diffDays <= 3) { return WEEKDAYS[d.getDay()]; }

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  if (d.getFullYear() !== now.getFullYear()) {
    const yy = String(d.getFullYear() % 100).padStart(2, '0');
    return `${dd}/${mm}/${yy}`;
  }
  return `${dd}/${mm}`;
}
