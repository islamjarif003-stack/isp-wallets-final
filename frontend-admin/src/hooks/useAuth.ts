'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, getToken, setTokens, clearTokens, ApiError } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface AdminUser {
  id: string;
  mobile: string;
  fullName: string;
  role: string;
}

let profileInFlight: Promise<AdminUser> | null = null;
let profileCache: { token: string; user: AdminUser; at: number } | null = null;

export function useAuth() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();

  const fetchProfile = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    try {
      if (profileCache && profileCache.token === token) {
        const userData = profileCache.user;
        if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userData.role)) {
          clearTokens();
          profileCache = null;
          profileInFlight = null;
          setUser(null);
          setAuthError(null);
        } else {
          setUser(userData);
          setAuthError(null);
        }
        return;
      }

      if (!profileInFlight) {
        profileInFlight = api('/auth/profile', { token }).then((res: any) => {
          const u = res.data as AdminUser;
          profileCache = { token, user: u, at: Date.now() };
          return u;
        }).finally(() => {
          profileInFlight = null;
        });
      }

      const userData = await profileInFlight;
      if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userData.role)) {
        clearTokens();
        profileCache = null;
        profileInFlight = null;
        setUser(null);
        setAuthError(null);
      } else {
        setUser(userData);
        setAuthError(null);
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearTokens();
        profileCache = null;
        profileInFlight = null;
        setUser(null);
        setAuthError(null);
      } else {
        setAuthError(err instanceof Error ? err.message : 'Request failed');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const login = async (mobile: string, password: string) => {
    const res = await api('/auth/login', { method: 'POST', body: { mobile, password } });
    const { user: userData, tokens } = res.data;

    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userData.role)) {
      throw new Error('Access denied. Admin privileges required.');
    }

    setTokens(tokens.accessToken, tokens.refreshToken);
    setUser(userData);
    router.push('/dashboard');
  };

  const logout = () => {
    clearTokens();
    profileCache = null;
    profileInFlight = null;
    setUser(null);
    setAuthError(null);
    router.push('/login');
  };

  const hasToken = !!getToken();
  return { user, loading, login, logout, hasToken, authError };
}
