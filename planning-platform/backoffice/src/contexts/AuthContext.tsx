import React, { createContext, useContext, useState, useCallback } from 'react';
import { getApiBase } from '../utils/api';

interface UserInfo {
  username: string;
  display_name: string;
  permission_level: string;
}

interface AuthContextType {
  token: string | null;
  user: UserInfo | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('po_token'));
  const [user, setUser] = useState<UserInfo | null>(() => {
    try {
      const raw = sessionStorage.getItem('po_user');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.username === 'string') return parsed;
      return null;
    } catch {
      sessionStorage.removeItem('po_user');
      return null;
    }
  });

  const login = useCallback(async (username: string, password: string) => {
    const resp = await fetch(`${getApiBase()}/partner-office/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(err.detail || 'Login failed');
    }
    const data = await resp.json();
    const u: UserInfo = {
      username: data.username,
      display_name: data.display_name,
      permission_level: data.permission_level,
    };
    sessionStorage.setItem('po_token', data.access_token);
    sessionStorage.setItem('po_user', JSON.stringify(u));
    setToken(data.access_token);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('po_token');
    sessionStorage.removeItem('po_user');
    setToken(null);
    setUser(null);
    window.location.href = '/backoffice/login';
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
