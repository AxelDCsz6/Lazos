import { formatUnreadBadge } from '../src/services/unreadService';

describe('formatUnreadBadge', () => {
  it('0 → cadena vacía', () => {
    expect(formatUnreadBadge(0)).toBe('');
  });

  it('negativo → cadena vacía', () => {
    expect(formatUnreadBadge(-3)).toBe('');
  });

  it('1 → "1"', () => {
    expect(formatUnreadBadge(1)).toBe('1');
  });

  it('9 → "9" (límite sin sufijo)', () => {
    expect(formatUnreadBadge(9)).toBe('9');
  });

  it('10 → "9+"', () => {
    expect(formatUnreadBadge(10)).toBe('9+');
  });

  it('150 → "9+"', () => {
    expect(formatUnreadBadge(150)).toBe('9+');
  });
});
