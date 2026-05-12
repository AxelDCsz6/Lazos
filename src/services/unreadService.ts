import * as Keychain from 'react-native-keychain';
import { DeviceEventEmitter } from 'react-native';

const SERVICE_UNREAD = 'lazos_unread';

// Evento emitido cuando cambia el contador de no leídos de un lazo.
// La UI (SideMenu) se suscribe para refrescar.
export const UNREAD_CHANGED = 'unread:changed';

type UnreadMap = Record<string, number>;

// Cache en memoria para evitar leer Keychain en cada render.
let cache: UnreadMap | null = null;

async function load(): Promise<UnreadMap> {
  if (cache) { return cache; }
  try {
    const result = await Keychain.getGenericPassword({ service: SERVICE_UNREAD });
    if (!result) { cache = {}; return cache; }
    const parsed = JSON.parse(result.password);
    cache = (parsed && typeof parsed === 'object') ? parsed as UnreadMap : {};
  } catch {
    cache = {};
  }
  return cache;
}

async function persist(map: UnreadMap): Promise<void> {
  cache = map;
  try {
    await Keychain.setGenericPassword('unread', JSON.stringify(map), { service: SERVICE_UNREAD });
  } catch {
    // Persistir es best-effort; el cache en memoria sigue siendo válido para la sesión.
  }
}

export async function getAllUnread(): Promise<UnreadMap> {
  return { ...(await load()) };
}

export async function getUnread(lazoId: string): Promise<number> {
  const map = await load();
  return map[lazoId] ?? 0;
}

export async function incrementUnread(lazoId: string, by: number = 1): Promise<number> {
  const map = await load();
  const next = (map[lazoId] ?? 0) + by;
  map[lazoId] = next;
  await persist(map);
  DeviceEventEmitter.emit(UNREAD_CHANGED, { lazoId, count: next });
  return next;
}

export async function clearUnread(lazoId: string): Promise<void> {
  const map = await load();
  if (!map[lazoId]) { return; }
  delete map[lazoId];
  await persist(map);
  DeviceEventEmitter.emit(UNREAD_CHANGED, { lazoId, count: 0 });
}

export function formatUnreadBadge(n: number): string {
  if (n <= 0) { return ''; }
  if (n > 9) { return '+9'; }
  return String(n);
}
