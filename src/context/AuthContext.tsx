import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getToken, getSavedUser } from '../services/authStorage';
import {
  login as loginService,
  register as registerService,
  logout as logoutService,
} from '../services/authService';
import { registerForPushNotifications, listenForTokenRefresh } from '../services/notificationService';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const savedUser = await getSavedUser();
        if (savedUser) {
          setUser(savedUser);
          // Registrar token FCM al restaurar sesión
          registerForPushNotifications().catch(() => {});
        }
      } catch {
        // sesión no disponible
      } finally {
        setIsLoading(false);
      }
    })();

    // Escuchar rotación de token mientras la sesión esté activa
    const unsubscribeRefresh = listenForTokenRefresh();
    return unsubscribeRefresh;
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { user: loggedUser } = await loginService(username, password);
    setUser(loggedUser);
    // Pequeño delay para que la UI esté montada antes de mostrar el diálogo
    setTimeout(() => { registerForPushNotifications().catch(() => {}); }, 1000);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const { user: newUser } = await registerService(username, password);
    setUser(newUser);
    setTimeout(() => { registerForPushNotifications().catch(() => {}); }, 1000);
  }, []);

  const logout = useCallback(async () => {
    await logoutService();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
