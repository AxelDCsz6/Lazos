import {
  splitTextByUrls,
  extractFirstUrl,
  normalizeUrlForOpen,
} from '../src/utils/links';

describe('links utils', () => {
  describe('splitTextByUrls', () => {
    it('devuelve vacío para texto vacío', () => {
      expect(splitTextByUrls('')).toEqual([]);
    });

    it('texto sin URLs queda como un solo segmento', () => {
      expect(splitTextByUrls('hola mundo')).toEqual([
        { type: 'text', value: 'hola mundo' },
      ]);
    });

    it('solo una URL queda como segmento url', () => {
      expect(splitTextByUrls('https://lazos.app')).toEqual([
        { type: 'url', value: 'https://lazos.app' },
      ]);
    });

    it('trocea texto antes y después de la URL', () => {
      expect(splitTextByUrls('mira https://vm.tiktok.com/abc/ esto')).toEqual([
        { type: 'text', value: 'mira ' },
        { type: 'url', value: 'https://vm.tiktok.com/abc/' },
        { type: 'text', value: ' esto' },
      ]);
    });

    it('maneja múltiples URLs', () => {
      const segments = splitTextByUrls('a http://x.com b https://y.com');
      expect(segments).toEqual([
        { type: 'text', value: 'a ' },
        { type: 'url', value: 'http://x.com' },
        { type: 'text', value: ' b ' },
        { type: 'url', value: 'https://y.com' },
      ]);
    });

    it('no detecta texto sin protocolo (www.)', () => {
      expect(splitTextByUrls('visita www.ejemplo.com')).toEqual([
        { type: 'text', value: 'visita www.ejemplo.com' },
      ]);
    });

    it('detiene la URL en paréntesis de cierre', () => {
      const segments = splitTextByUrls('(ver https://a.com/x) listo');
      expect(segments.some(s => s.type === 'url' && s.value === 'https://a.com/x')).toBe(true);
    });
  });

  describe('extractFirstUrl', () => {
    it('null si no hay URL', () => {
      expect(extractFirstUrl('sin links aqui')).toBeNull();
    });

    it('devuelve la primera URL', () => {
      expect(extractFirstUrl('mira https://a.com/1 y https://b.com/2')).toBe('https://a.com/1');
    });
  });

  describe('normalizeUrlForOpen', () => {
    it('mantiene URLs con protocolo', () => {
      expect(normalizeUrlForOpen('http://a.com')).toBe('http://a.com');
      expect(normalizeUrlForOpen('https://a.com')).toBe('https://a.com');
    });

    it('antepone https:// si falta protocolo', () => {
      expect(normalizeUrlForOpen('a.com')).toBe('https://a.com');
    });
  });
});
