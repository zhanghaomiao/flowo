import React, { createContext, useCallback, useContext, useState } from 'react';

import { client } from './client/client.gen';

export interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Configure client to use the token from localStorage for all authenticated requests
// This dynamic handler ensures the latest token is always used, even after page reloads.
client.setConfig({
  auth: () => localStorage.getItem('token') || undefined,
});

// Add interceptor for 401 Unauthorized errors
client.interceptors.response.use((response) => {
  if (response.status === 401) {
    localStorage.removeItem('token');
    // Using window.location instead of router to avoid complex dependency cycles in auth.tsx
    // The router context needs auth, and auth might need router for navigation.
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

  const login = useCallback((newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    window.location.href = '/login';
  }, []);

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ isAuthenticated, token, login, logout }}>
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
