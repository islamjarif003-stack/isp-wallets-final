'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import BottomNav from './BottomNav';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, hasToken, authError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && !hasToken) router.push('/login');
  }, [loading, user, hasToken, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!user && hasToken) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-sm text-gray-700">
            {authError || 'Unable to load profile. Please try again.'}
          </div>
          <button
            className="mt-4 btn-primary"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="pb-20">
      {children}
      <BottomNav />
    </div>
  );
}
