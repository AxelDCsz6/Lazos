// ─── Usuarios ─────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// ─── Lazos ────────────────────────────────────────────────────────────────────
export interface Lazo {
  id: string;
  user1Id: string;
  user2Id: string;
  partnerId: string;
  partnerUsername: string;
  createdAt: string;
  streak: number;
  plantPhase: PlantPhase;
  plantXp: number;
}

export type PlantPhase = 'seed' | 'sprout' | 'small' | 'big' | 'flower';

// ─── Mensajes ─────────────────────────────────────────────────────────────────
export type MessageStatus = 'pending' | 'sent' | 'delivered';
export type MessageType = 'text' | 'photo';

export interface Message {
  id: string;
  lazoId: string;
  senderId: string;
  content: string;
  type: MessageType;
  status: MessageStatus;
  createdAt: string;
}

// ─── Planta ───────────────────────────────────────────────────────────────────
export interface PlantState {
  phase: PlantPhase;
  xp: number;
  streak: number;
  lastWateredAt: string | null;
  user1Watered: boolean;
  user2Watered: boolean;
  isDead: boolean;
  daysWithoutWater: number;
}

// ─── Navegación ───────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppTabParamList = {
  Lazos: undefined;
  Settings: undefined;
};

export type LazosStackParamList = {
  LazosList: undefined;
  Chat: { lazoId: string; partnerUsername: string };
  InviteCode: undefined;
  JoinLazo: undefined;
};

// ─── API ──────────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
}
