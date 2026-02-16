'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, getToken, setTokens, clearTokens, ApiError } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface UserData {
  id: string;
  mobile: string;
  fullName: string;
  email: string | null;
  role: string;
  isVerified: boolean;
  wallet: {
    id: string;
    balance: number;
    status: string;
  } | null;
}

let profileInFlight: Promise<UserData> | null = null;
let profileCache: { token: string; user: UserData; at: number } | null = null;

export function useAuth() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();

  const fetchProfile = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      if (profileCache && profileCache.token === token) {
        setUser(profileCache.user);
        setAuthError(null);
        return;
      }

      if (!profileInFlight) {
        profileInFlight = api('/auth/profile', { token }).then((res: any) => {
          const u = res.data as UserData;
          profileCache = { token, user: u, at: Date.now() };
          return u;
        }).finally(() => {
          profileInFlight = null;
        });
      }

      const u = await profileInFlight;
      setUser(u);
      setAuthError(null);
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

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const login = async (mobile: string, password: string) => {
    const res = await api('/auth/login', { method: 'POST', body: { mobile, password } });
    setTokens(res.data.tokens.accessToken, res.data.tokens.refreshToken);
    setUser({
      ...res.data.user,
      wallet: { id: res.data.wallet.id, balance: 0, status: res.data.wallet.status },
    });
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

  const refreshProfile = () => fetchProfile();

  const hasToken = !!getToken();
  return { user, loading, login, logout, refreshProfile, hasToken, authError };
}
