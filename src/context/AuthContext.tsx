import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getToken, getSavedUser } from '../services/authStorage';
import {
  login as loginService,
  register as registerService,
  logout as logoutService,
} from '../services/authService';
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
        if (savedUser) setUser(savedUser);
      } catch {
        // sesión no disponible
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { user: loggedUser } = await loginService(username, password);
    setUser(loggedUser);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const { user: newUser } = await registerService(username, password);
    setUser(newUser);
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
