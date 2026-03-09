import { useState, useEffect, useCallback } from 'react';
import { getToken } from '../services/authStorage';
import { login as loginService, register as registerService, logout as logoutService } from '../services/authService';
import { User } from '../types';

interface AuthHook {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): AuthHook {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Verificar token al arrancar la app
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      // Token existe → usuario sigue logueado
      // En Sprint siguiente se puede validar el token contra el backend
      setIsLoading(false);
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

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
  };
}
