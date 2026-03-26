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

// Auto-refresh en 401
let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function flushQueue(token: string) {
  pendingQueue.forEach(p => p.resolve(token));
  pendingQueue = [];
}

function rejectQueue(err: unknown) {
  pendingQueue.forEach(p => p.reject(err));
  pendingQueue = [];
}

api.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config;
    const status  = error.response?.status;

    // Solo intentar refresh en 401, y no en el propio endpoint de refresh
    if (status === 401 && !original._retry && !original.url?.includes('/auth/refresh')) {
      original._retry = true;

      if (isRefreshing) {
        // Encolar hasta que termine el refresh en curso
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (token: string) => {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(api(original));
            },
            reject,
          });
        });
      }

      isRefreshing = true;
      try {
        const { getRefreshToken, saveToken, removeToken, removeRefreshToken, removeUser } =
          await import('./authStorage');
        const refreshToken = await getRefreshToken();

        if (!refreshToken) { throw new Error('no_refresh'); }

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        const newToken: string = data.token;

        await saveToken(newToken);
        flushQueue(newToken);

        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        rejectQueue(new Error('Sesión expirada'));
        const { removeToken, removeRefreshToken, removeUser } = await import('./authStorage');
        await Promise.all([removeToken(), removeRefreshToken(), removeUser()]);
        DeviceEventEmitter.emit('auth:sessionExpired');
        return Promise.reject(new Error('Sesión expirada. Por favor inicia sesión de nuevo.'));
      } finally {
        isRefreshing = false;
      }
    }

    const message = error.response?.data?.message || 'Error de conexión';
    return Promise.reject(new Error(message));
  },
);
