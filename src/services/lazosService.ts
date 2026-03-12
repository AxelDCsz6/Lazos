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
  const data = await res.json();
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
  const data = await res.json();
  if (!res.ok) { throw new Error(data.message ?? 'Código inválido o expirado'); }
}

// ─── Obtener lista de lazos ───────────────────────────────────
export async function fetchLazos(): Promise<
  Array<{ id: number; partner_username: string; partner_id: number; created_at: string }>
> {
  const res = await fetch(`${API_BASE_URL}/lazos`, {
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) { throw new Error(data.message ?? 'Error obteniendo lazos'); }
  return data.lazos;
}
