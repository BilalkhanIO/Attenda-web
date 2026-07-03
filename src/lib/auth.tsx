'use client';
import { createContext, useContext, useEffect, useState, useCallback, useMemo, useSyncExternalStore, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useRouter } from 'next/navigation';
import { authApi, usersApi, onAccessTokenRefreshed, getAccessToken, storeTokens, clearTokens } from './api';
import { setDisplayTimezone } from './utils';
import type { AuthRole, UserCapabilities } from '@/types';

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

// ─── Stored-session external store ─────────────────────────────────
// The token cookie is an external system, so the session restore is a
// useSyncExternalStore read instead of a setState-in-effect. The server
// snapshot (null) is also used for the hydration render, so server and
// client markup stay identical; React then re-renders with the real
// cookie value right after hydration.
const noopSubscribe = () => () => {};
const getServerSnapshot = () => null;

// Identity key a capabilities payload belongs to.
const capsKey = (u: AuthUser) => `${u.sub}|${u.org_id}|${u.role}`;

async function fetchCapabilities(authUser: AuthUser): Promise<UserCapabilities> {
  const { data } = await usersApi.getMyCapabilities();
  const caps = data.data as UserCapabilities;
  // Platform staff aren't bound to a tenant org — don't let the SYSTEM
  // org override the browser timezone for them.
  if (authUser.role !== 'platform_admin') {
    // Drive all org-local time rendering from the org's timezone.
    setDisplayTimezone(caps.timezone);
  }
  return caps;
}

function decodeValidUser(token: string | null): AuthUser | null {
  if (!token) return null;
  try {
    const decoded = jwtDecode<AuthUser>(token);
    if (decoded.exp * 1000 > Date.now()) return decoded;
  } catch { /* malformed token */ }
  return null;
}

// getSnapshot must return a referentially-stable value, so cache the
// decoded user per token string.
let cachedToken: string | null = null;
let cachedUser: AuthUser | null = null;
function readStoredUser(): AuthUser | null {
  const token = getAccessToken();
  if (token !== cachedToken) {
    cachedToken = token;
    cachedUser = decodeValidUser(token);
  }
  return cachedUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Session restored from the cookie store (null until hydration completes).
  const restoredUser = useSyncExternalStore(noopSubscribe, readStoredUser, getServerSnapshot);
  // True only after hydration — mirrors the old "restore effect has run" flag.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  // Explicit login/logout events override the restored session for this page load.
  const [sessionUser, setSessionUser] = useState<AuthUser | null | undefined>(undefined);
  const user = sessionUser !== undefined ? sessionUser : restoredUser;
  const isLoading = !hydrated;
  // Capabilities are stored with the session key they were loaded for, so
  // "loading" is derived (key mismatch) rather than a second state flag.
  const [capsState, setCapsState] = useState<{ key: string | null; caps: UserCapabilities | null }>({ key: null, caps: null });
  const capabilities = capsState.caps;
  const capabilitiesLoading = !!user && capsState.key !== capsKey(user);
  const router = useRouter();

  const permissionSet = useMemo(
    () => new Set(capabilities?.permissions ?? []),
    [capabilities?.permissions],
  );

  const loadCapabilities = useCallback(async (authUser: AuthUser | null) => {
    if (!authUser) return;
    const key = capsKey(authUser);
    try {
      const caps = await fetchCapabilities(authUser);
      setCapsState({ key, caps });
    } catch {
      setCapsState({ key, caps: null });
    }
  }, []);

  const refreshCapabilities = useCallback(async () => {
    await loadCapabilities(user);
  }, [loadCapabilities, user]);

  useEffect(() => {
    // Purge an expired/malformed stored token so the optimistic proxy.ts
    // redirects stop trusting it. (Capabilities need no clearing here:
    // they start null and logout clears them in its event handler.)
    if (hydrated && !restoredUser && getAccessToken()) clearTokens();
  }, [hydrated, restoredUser]);

  useEffect(() => {
    if (!user) return;
    // Platform users need capabilities too — platform_permissions drives the
    // admin console nav (platform_admin vs platform_assistant).
    const key = capsKey(user);
    let stale = false;
    fetchCapabilities(user)
      .then(caps => { if (!stale) setCapsState({ key, caps }); })
      .catch(() => { if (!stale) setCapsState({ key, caps: null }); });
    return () => { stale = true; };
  }, [user]);

  useEffect(() => {
    return onAccessTokenRefreshed(() => {
      loadCapabilities(user);
    });
  }, [user, loadCapabilities]);

  const applyTokens = useCallback(async (accessToken: string, refreshToken: string, rememberMe = false) => {
    storeTokens(accessToken, refreshToken, rememberMe);
    const decoded = jwtDecode<AuthUser>(accessToken);
    setSessionUser(decoded);
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
    setSessionUser(null);
    setCapsState({ key: null, caps: null });
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
  }, [user, capabilities]);

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
