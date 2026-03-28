import { api } from './api';
import { saveToken, removeToken, saveUser, removeUser, saveRefreshToken, removeRefreshToken } from './authStorage';
import { User } from '../types';

interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { username, password });
  if (!data.token || !data.refreshToken || !data.user) {
    throw new Error('Respuesta inesperada del servidor');
  }
  await saveToken(data.token);
  await saveRefreshToken(data.refreshToken);
  await saveUser(data.user);
  return data;
}

export async function register(username: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', { username, password });
  if (!data.token || !data.refreshToken || !data.user) {
    throw new Error('Respuesta inesperada del servidor');
  }
  await saveToken(data.token);
  await saveRefreshToken(data.refreshToken);
  await saveUser(data.user);
  return data;
}

export async function logout(): Promise<void> {
  await removeToken();
  await removeRefreshToken();
  await removeUser();
}
