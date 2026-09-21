// Utilidades de detección de URLs en textos de mensajes.
// Decisión: parser propio con regex en lugar de `react-native-parsed-text`
// (sin mantenimiento desde 2019, peer-deps de React 16.x — incompatible
// con React 19 / RN 0.84). Mantenido minimal y testeable.

export const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+)/gi;

export type TextSegment =
  | { type: 'text'; value: string }
  | { type: 'url'; value: string };

// Trocea un texto en segmentos de texto plano y URLs clickeables.
export function splitTextByUrls(text: string): TextSegment[] {
  if (!text) { return []; }
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_REGEX)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, idx) });
    }
    segments.push({ type: 'url', value: match[0] });
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}

// Primera URL del texto (para el preview de link), o null.
export function extractFirstUrl(text: string): string | null {
  const m = text.match(URL_REGEX);
  return m && m.length > 0 ? m[0] : null;
}

// Normaliza una URL para abrirla con Linking: si no trae protocolo,
// asume https://.
export function normalizeUrlForOpen(url: string): string {
  if (/^https?:\/\//i.test(url)) { return url; }
  return `https://${url}`;
}
