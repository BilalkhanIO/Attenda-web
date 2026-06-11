'use client';
import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useRouter } from 'next/navigation';
import { authApi, usersApi, onAccessTokenRefreshed, getAccessToken, storeTokens, clearTokens } from './api';
import { setDisplayTimezone } from './utils';
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
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  loginWithTokens: (accessToken: string, refreshToken: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshCapabilities: () => Promise<void>;
  isAuthenticated: boolean;
  hasPermission: (key: string) => boolean;
  hasFeature: (key: string) => boolean;
  /** Exact role match (JWT role or assigned org_role slug) */
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
    if (!authUser) {
      setCapabilities(null);
      setCapabilitiesLoading(false);
      return;
    }
    setCapabilitiesLoading(true);
    try {
      const { data } = await usersApi.getMyCapabilities();
      const caps = data.data as UserCapabilities;
      setCapabilities(caps);
      // Platform staff aren't bound to a tenant org — don't let the SYSTEM
      // org override the browser timezone for them.
      if (authUser.role !== 'platform_admin') {
        // Drive all org-local time rendering from the org's timezone.
        setDisplayTimezone(caps.timezone);
      }
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
    const token = getAccessToken();
    if (token) {
      try {
        const decoded = jwtDecode<AuthUser>(token);
        if (decoded.exp * 1000 > Date.now()) {
          setUser(decoded);
        } else {
          clearTokens();
        }
      } catch {
        clearTokens();
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!user) {
      setCapabilities(null);
      return;
    }
    // Platform users need capabilities too — platform_permissions drives the
    // admin console nav (platform_admin vs platform_assistant).
    loadCapabilities(user);
  }, [user?.sub, user?.org_id, user?.role, loadCapabilities]);

  useEffect(() => {
    return onAccessTokenRefreshed(() => {
      loadCapabilities(user);
    });
  }, [user, loadCapabilities]);

  const applyTokens = useCallback(async (accessToken: string, refreshToken: string, rememberMe = false) => {
    storeTokens(accessToken, refreshToken, rememberMe);
    const decoded = jwtDecode<AuthUser>(accessToken);
    setUser(decoded);
    await loadCapabilities(decoded);
    if (decoded.role === 'platform_admin') {
      router.push('/admin');
    }
  }, [loadCapabilities, router]);

  const login = async (email: string, password: string, rememberMe = false) => {
    const { data } = await authApi.login(email, password);
    const { access_token, refresh_token } = data.data;
    await applyTokens(access_token, refresh_token, rememberMe);
  };

  const loginWithTokens = async (accessToken: string, refreshToken: string, rememberMe = false) => {
    await applyTokens(accessToken, refreshToken, rememberMe);
  };

  const logout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearTokens();
    setUser(null);
    setCapabilities(null);
    window.location.href = '/login';
  };

  const hasPermission = useCallback((key: string): boolean => {
    if (!user) return false;
    return permissionSet.has(key);
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
