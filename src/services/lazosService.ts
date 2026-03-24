import { API_BASE_URL } from '../constants';
import { getToken } from './authStorage';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── Genera un código de invitación ──────────────────────────
export async function generateInviteCode(): Promise<{ code: string; expiresAt: string }> {
  const res = await fetch(`${API_BASE_URL}/lazos/generate`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  const data = await res.json() as { message?: string; code: string; expiresAt: string };
  if (!res.ok) { throw new Error(data.message ?? 'Error generando código'); }
  return data;
}

// ─── Unirse a un lazo con un código ──────────────────────────
export async function joinWithCode(code: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/lazos/join`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ code: code.toLowerCase().trim() }),
  });
  const data = await res.json() as { message?: string };
  if (!res.ok) { throw new Error(data.message ?? 'Código inválido o expirado'); }
}

// ─── Obtener lista de lazos ───────────────────────────────────
export async function fetchLazos(): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/lazos`, {
    headers: await authHeaders(),
  });
  const data = await res.json() as { message?: string; lazos: any[] };
  if (!res.ok) { throw new Error(data.message ?? 'Error obteniendo lazos'); }
  return data.lazos;
}

// ─── Regar la planta de un lazo ───────────────────────────────
export async function waterLazo(lazoId: string): Promise<{
  success: boolean;
  alreadyWateredToday: boolean;
  partnerWateredToday: boolean;
  streak: number;
  plantPhase: string;
  plantXp: number;
  justStreaked: boolean;
}> {
  const res = await fetch(`${API_BASE_URL}/lazos/${lazoId}/regar`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  const data = await res.json() as {
    message?: string;
    success: boolean;
    alreadyWateredToday: boolean;
    partnerWateredToday: boolean;
    streak: number;
    plantPhase: string;
    plantXp: number;
    justStreaked: boolean;
  };
  if (!res.ok) { throw new Error(data.message ?? 'Error al regar'); }
  return data;
}
