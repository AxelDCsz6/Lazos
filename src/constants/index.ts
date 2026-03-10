// ─── API ──────────────────────────────────────────────────────────────────────
export const API_BASE_URL = __DEV__
  ? 'http://192.168.1.109:3000/api' // Android emulator → localhost del host
  : 'https://tu-backend.railway.app/api';

export const API_TIMEOUT = 10000; // 10s

// ─── Planta ───────────────────────────────────────────────────────────────────
export const PLANT_PHASES = {
  seed:   { minXp: 0,    label: 'Semilla' },
  sprout: { minXp: 100,  label: 'Brote' },
  small:  { minXp: 500,  label: 'Planta pequeña' },
  big:    { minXp: 1000, label: 'Planta grande' },
  flower: { minXp: 2500, label: 'Flor' },
} as const;

export const XP_REWARDS = {
  water:               10,
  message:              1,
  photo:                5,
  MESSAGE_DAILY_LIMIT: 20,
} as const;

export const PLANT_DEATH_DAYS   = 5; // días sin riego → planta muere
export const PLANT_WARNING_DAYS = 3; // días sin riego → notificación de aviso

// ─── Invitación ───────────────────────────────────────────────────────────────
export const INVITE_CODE_DURATION_MS = 15 * 60 * 1000; // 15 minutos

// ─── Paginación ───────────────────────────────────────────────────────────────
export const MESSAGES_PAGE_SIZE = 20;

// ─── Storage keys ─────────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA:  'user_data',
} as const;
