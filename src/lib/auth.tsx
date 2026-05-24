'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import { authApi } from './api';

export type UserRole = 'super_admin' | 'hr_admin' | 'manager' | 'employee';

export interface AuthUser {
  sub: string;
  org_id: string;
  role: UserRole;
  name: string;
  email: string;
  exp: number;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = Cookies.get('access_token');
    if (token) {
      try {
        const decoded = jwtDecode<AuthUser>(token);
        if (decoded.exp * 1000 > Date.now()) {
          setUser(decoded);
        } else {
          Cookies.remove('access_token');
        }
      } catch {
        Cookies.remove('access_token');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    const { access_token, refresh_token } = data.data;
    Cookies.set('access_token', access_token, { expires: 1 / 3 });
    Cookies.set('refresh_token', refresh_token, { expires: 30 });
    const decoded = jwtDecode<AuthUser>(access_token);
    setUser(decoded);
  };

  const logout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    Cookies.remove('access_token');
    Cookies.remove('refresh_token');
    setUser(null);
    window.location.href = '/login';
  };

  const hasRole = (...roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      logout,
      isAuthenticated: !!user,
      hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
