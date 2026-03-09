import { api } from './api';
import { saveToken, removeToken } from './authStorage';
import { User } from '../types';

interface AuthResponse {
  token: string;
  user: User;
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { username, password });
  await saveToken(data.token);
  return data;
}

export async function register(username: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', { username, password });
  await saveToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  await removeToken();
}
