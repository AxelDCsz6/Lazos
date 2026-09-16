import { formatChatDateSeparator, isSameCalendarDay } from '../src/utils/dateFormat';

const at = (y: number, m: number, d: number, h = 12): Date => new Date(y, m - 1, d, h, 0, 0);

const iso = (date: Date): string => date.toISOString();

describe('formatChatDateSeparator', () => {
  it('hoy → "Hoy"', () => {
    expect(formatChatDateSeparator(iso(at(2026, 9, 15, 8)), at(2026, 9, 15, 20))).toBe('Hoy');
  });

  it('ayer → "Ayer"', () => {
    expect(formatChatDateSeparator(iso(at(2026, 9, 14, 23)), at(2026, 9, 15, 1))).toBe('Ayer');
  });

  it('2 días atrás → nombre de día', () => {
    // 2026-09-13 es domingo
    expect(formatChatDateSeparator(iso(at(2026, 9, 13)), at(2026, 9, 15))).toBe('domingo');
  });

  it('3 días exactos → nombre de día', () => {
    // 2026-09-12 es sábado
    expect(formatChatDateSeparator(iso(at(2026, 9, 12)), at(2026, 9, 15))).toBe('sábado');
  });

  it('4 días → dd/mm', () => {
    expect(formatChatDateSeparator(iso(at(2026, 9, 11)), at(2026, 9, 15))).toBe('11/09');
  });

  it('cambio de mes → dd/mm', () => {
    // 31 ago → 15 sep (más de 3 días)
    expect(formatChatDateSeparator(iso(at(2026, 8, 31)), at(2026, 9, 15))).toBe('31/08');
  });

  it('cambio de año → dd/mm/aa', () => {
    // 25 dic 2025 visto el 2 ene 2026: 8 días, distinto año
    expect(formatChatDateSeparator(iso(at(2025, 12, 25)), at(2026, 1, 2))).toBe('25/12/25');
  });

  it('menos de 3 días cruzando año → nombre de día', () => {
    // 31 dic 2025 visto el 2 ene 2026: 2 días → weekday (miércoles)
    expect(formatChatDateSeparator(iso(at(2025, 12, 31)), at(2026, 1, 2))).toBe('miércoles');
  });

  it('más de 1 año → dd/mm/aa', () => {
    expect(formatChatDateSeparator(iso(at(2024, 5, 10)), at(2026, 9, 15))).toBe('10/05/24');
  });

  it('medianoche local cuenta como día calendario, no 24h', () => {
    // 23:59 de ayer vs 00:01 de hoy: menos de 24h pero es "Ayer"
    expect(formatChatDateSeparator(iso(new Date(2026, 8, 14, 23, 59)), new Date(2026, 8, 15, 0, 1))).toBe('Ayer');
  });

  it('fecha futura → "Hoy"', () => {
    expect(formatChatDateSeparator(iso(at(2026, 9, 16)), at(2026, 9, 15))).toBe('Hoy');
  });
});

describe('isSameCalendarDay', () => {
  it('mismo día aunque difiera la hora', () => {
    expect(isSameCalendarDay(iso(new Date(2026, 8, 15, 1, 0)), iso(new Date(2026, 8, 15, 23, 0)))).toBe(true);
  });

  it('días distintos', () => {
    expect(isSameCalendarDay(iso(at(2026, 9, 14)), iso(at(2026, 9, 15)))).toBe(false);
  });
});
