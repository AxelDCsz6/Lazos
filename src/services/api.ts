import axios from 'axios';
import { DeviceEventEmitter } from 'react-native';
import { API_BASE_URL, API_TIMEOUT } from '../constants';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

// Inyectar token en cada request
api.interceptors.request.use(async config => {
  const { getToken } = await import('./authStorage');
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Cerrar sesión automáticamente en 401
api.interceptors.response.use(
  response => response,
  async error => {
    const status = error.response?.status;

    if (status === 401) {
      const { removeToken, removeUser } = await import('./authStorage');
      await Promise.all([removeToken(), removeUser()]);
      DeviceEventEmitter.emit('auth:sessionExpired');
      return Promise.reject(new Error('Sesión expirada. Por favor inicia sesión de nuevo.'));
    }

    const message = error.response?.data?.message || 'Error de conexión';
    return Promise.reject(new Error(message));
  },
);
