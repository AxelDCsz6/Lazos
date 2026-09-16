import * as Keychain from 'react-native-keychain';
import { deleteLazoRemote } from './lazosService';

const SERVICE_PENDING_DELETES = 'lazos_pending_deletes';

// Outbox de borrados: si el usuario mata la app dentro de la ventana de
// "Deshacer" (4s), el DELETE remoto nunca se ejecuta y el lazo reaparece al
// reiniciar. Aquí persistimos los ids pendientes en Keychain y ejecutamos
// los DELETE pendientes al arrancar la sesión (patrón de unreadService).

let cache: string[] | null = null;

async function load(): Promise<string[]> {
  if (cache) { return cache; }
  try {
    const result = await Keychain.getGenericPassword({ service: SERVICE_PENDING_DELETES });
    if (!result) { cache = []; return cache; }
    const parsed = JSON.parse(result.password);
    cache = Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function persist(ids: string[]): Promise<void> {
  cache = ids;
  try {
    await Keychain.setGenericPassword('pending_deletes', JSON.stringify(ids), {
      service: SERVICE_PENDING_DELETES,
    });
  } catch {
    // Persistir es best-effort; el cache en memoria sigue siendo válido.
  }
}

export async function getPendingDeletes(): Promise<string[]> {
  return [...(await load())];
}

export async function addPendingDelete(lazoId: string): Promise<void> {
  const ids = await load();
  if (!ids.includes(lazoId)) {
    await persist([...ids, lazoId]);
  }
}

export async function removePendingDelete(lazoId: string): Promise<void> {
  const ids = await load();
  if (ids.includes(lazoId)) {
    await persist(ids.filter(id => id !== lazoId));
  }
}

// Ejecuta los DELETE pendientes. Los que tienen éxito (incluye 404: el lazo
// ya no existe) salen de la cola; los que fallan por red se conservan para
// el próximo intento.
export async function flushPendingDeletes(): Promise<void> {
  const ids = await load();
  if (ids.length === 0) { return; }
  const remaining: string[] = [];
  for (const id of ids) {
    try {
      await deleteLazoRemote(id);
    } catch (err: any) {
      if (err?.status === 404) { continue; }
      remaining.push(id);
    }
  }
  await persist(remaining);
}
