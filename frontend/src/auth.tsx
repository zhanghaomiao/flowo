import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { client } from './client/client.gen';
import { usersCurrentUser } from './client/sdk.gen';
import type { UserRead } from './client/types.gen';

export interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  user: UserRead | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Configure client to use the token from localStorage for all authenticated requests
client.setConfig({
  auth: () => localStorage.getItem('token') || undefined,
});

// Add interceptor for 401 Unauthorized errors and general error handling
client.interceptors.response.use((response) => {
  if (response.status === 401) {
    localStorage.removeItem('token');
    const currentPath = window.location.pathname + window.location.search;
    if (!currentPath.includes('/login')) {
      window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
    }
  }
  return response;
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('token'),
  );
  const [user, setUser] = useState<UserRead | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const response = await usersCurrentUser();
      if (response.data) {
        setUser(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  }, []);

  useEffect(() => {
    if (token) {
      void fetchUser();
    } else {
      setUser(null);
    }
  }, [token, fetchUser]);

  const login = useCallback((newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }, []);

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, token, user, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
