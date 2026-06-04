'use client';
import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import { useRouter } from 'next/navigation';
import { authApi, usersApi, onAccessTokenRefreshed } from './api';
import { legacyRoleHasPermission } from './rbac';
import type { AuthRole, PlanFeatures, UserCapabilities } from '@/types';

export type UserRole = AuthRole;

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
  capabilities: UserCapabilities | null;
  capabilitiesLoading: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshCapabilities: () => Promise<void>;
  isAuthenticated: boolean;
  hasPermission: (key: string) => boolean;
  hasFeature: (key: string) => boolean;
  /** Exact legacy role match (JWT role or assigned org_role slug) */
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [capabilities, setCapabilities] = useState<UserCapabilities | null>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const permissionSet = useMemo(
    () => new Set(capabilities?.permissions ?? []),
    [capabilities?.permissions],
  );

  const loadCapabilities = useCallback(async (authUser: AuthUser | null) => {
    if (!authUser || authUser.role === 'platform_admin') {
      setCapabilities(null);
      setCapabilitiesLoading(false);
      return;
    }
    setCapabilitiesLoading(true);
    try {
      const { data } = await usersApi.getMyCapabilities();
      setCapabilities(data.data as UserCapabilities);
    } catch {
      setCapabilities(null);
    } finally {
      setCapabilitiesLoading(false);
    }
  }, []);

  const refreshCapabilities = useCallback(async () => {
    await loadCapabilities(user);
  }, [loadCapabilities, user]);

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

  useEffect(() => {
    if (!user || user.role === 'platform_admin') {
      setCapabilities(null);
      return;
    }
    loadCapabilities(user);
  }, [user?.sub, user?.org_id, user?.role, loadCapabilities]);

  useEffect(() => {
    return onAccessTokenRefreshed(() => {
      loadCapabilities(user);
    });
  }, [user, loadCapabilities]);

  const applyTokens = useCallback(async (accessToken: string, refreshToken: string) => {
    Cookies.set('access_token', accessToken, { expires: 1 / 3 });
    Cookies.set('refresh_token', refreshToken, { expires: 30 });
    const decoded = jwtDecode<AuthUser>(accessToken);
    setUser(decoded);
    await loadCapabilities(decoded);
    if (decoded.role === 'platform_admin') {
      router.push('/admin');
    }
  }, [loadCapabilities, router]);

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    const { access_token, refresh_token } = data.data;
    await applyTokens(access_token, refresh_token);
  };

  const loginWithTokens = async (accessToken: string, refreshToken: string) => {
    await applyTokens(accessToken, refreshToken);
  };

  const logout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    Cookies.remove('access_token');
    Cookies.remove('refresh_token');
    setUser(null);
    setCapabilities(null);
    window.location.href = '/login';
  };

  const hasPermission = useCallback((key: string): boolean => {
    if (!user) return false;
    if (permissionSet.has(key)) return true;
    return legacyRoleHasPermission(user.role, key);
  }, [user, permissionSet]);

  const hasFeature = useCallback((key: string): boolean => {
    if (!user) return false;
    if (!capabilities?.features) return true;
    return capabilities.features[key] === true;
  }, [user, capabilities?.features]);

  const hasRole = useCallback((...roles: UserRole[]): boolean => {
    if (!user) return false;
    if (roles.includes(user.role)) return true;
    const slug = capabilities?.org_role?.slug as UserRole | undefined;
    if (slug && roles.includes(slug)) return true;
    return false;
  }, [user, capabilities?.org_role?.slug]);

  return (
    <AuthContext.Provider value={{
      user,
      capabilities,
      capabilitiesLoading,
      isLoading,
      login,
      loginWithTokens,
      logout,
      refreshCapabilities,
      isAuthenticated: !!user,
      hasPermission,
      hasFeature,
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
