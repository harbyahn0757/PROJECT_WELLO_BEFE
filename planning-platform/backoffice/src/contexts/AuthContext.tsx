import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getApiBase, fetchWithAuth } from '../utils/api';

export type PartnerType = 'hospital' | 'hospital' | 'commerce';

interface UserInfo {
  username: string;
  display_name: string;
  permission_level: string;
}

interface AuthContextType {
  token: string | null;
  user: UserInfo | null;
  partnerType: PartnerType;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const API = getApiBase();
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('po_token'));
  const [partnerType, setPartnerType] = useState<PartnerType>(
    () => (sessionStorage.getItem('po_partner_type') as PartnerType) || 'hospital'
  );
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
    // partner_type 조회
    try {
      const ptResp = await fetchWithAuth(`${API}/partner-office/partner-type`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (ptResp.ok) {
        const ptData = await ptResp.json();
        const pt = ptData.partner_type || 'hospital';
        sessionStorage.setItem('po_partner_type', pt);
        setPartnerType(pt);
      }
    } catch { /* partner_type 조회 실패 시 기본값 유지 */ }
  }, [API]);

  const logout = useCallback(() => {
    sessionStorage.removeItem('po_token');
    sessionStorage.removeItem('po_user');
    sessionStorage.removeItem('po_partner_type');
    setToken(null);
    setUser(null);
    setPartnerType('hospital');
    window.location.href = '/backoffice/login';
  }, []);

  // 이미 로그인된 상태에서 partner_type이 없으면 조회
  useEffect(() => {
    if (token && !sessionStorage.getItem('po_partner_type')) {
      fetchWithAuth(`${API}/partner-office/partner-type`)
        .then(r => r.json())
        .then(d => {
          const pt = d.partner_type || 'hospital';
          sessionStorage.setItem('po_partner_type', pt);
          setPartnerType(pt);
        })
        .catch(() => {});
    }
  }, [token, API]);

  return (
    <AuthContext.Provider value={{ token, user, partnerType, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
