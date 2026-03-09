import axios from 'axios';
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

// Manejar errores globales
api.interceptors.response.use(
  response => response,
  error => {
    const message = error.response?.data?.message || 'Error de conexión';
    return Promise.reject(new Error(message));
  },
);
