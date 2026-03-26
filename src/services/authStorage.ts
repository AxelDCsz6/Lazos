import * as Keychain from 'react-native-keychain';
import { User } from '../types';

const SERVICE_TOKEN   = 'lazos_auth';
const SERVICE_USER    = 'lazos_user';
const SERVICE_REFRESH = 'lazos_refresh';

// ── Token ──────────────────────────────────────────────────────
export async function saveToken(token: string): Promise<void> {
  await Keychain.setGenericPassword('token', token, { service: SERVICE_TOKEN });
}

export async function getToken(): Promise<string | null> {
  const result = await Keychain.getGenericPassword({ service: SERVICE_TOKEN });
  return result ? result.password : null;
}

export async function removeToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE_TOKEN });
}

// ── Usuario ────────────────────────────────────────────────────
export async function saveUser(user: User): Promise<void> {
  await Keychain.setGenericPassword('user', JSON.stringify(user), { service: SERVICE_USER });
}

export async function getSavedUser(): Promise<User | null> {
  const result = await Keychain.getGenericPassword({ service: SERVICE_USER });
  if (!result) return null;
  try {
    return JSON.parse(result.password) as User;
  } catch {
    return null;
  }
}

export async function removeUser(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE_USER });
}

// ── Refresh token ───────────────────────────────────────────────
export async function saveRefreshToken(token: string): Promise<void> {
  await Keychain.setGenericPassword('refresh', token, { service: SERVICE_REFRESH });
}

export async function getRefreshToken(): Promise<string | null> {
  const result = await Keychain.getGenericPassword({ service: SERVICE_REFRESH });
  return result ? result.password : null;
}

export async function removeRefreshToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE_REFRESH });
}
