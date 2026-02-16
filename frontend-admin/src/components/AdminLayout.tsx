'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { api, getToken } from '@/lib/api';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/users', label: 'Users', icon: '👥' },
  { href: '/wallets', label: 'Wallets', icon: '💰' },
  { href: '/services', label: 'Services', icon: '⚡' },
  { href: '/audit-logs', label: 'Audit Logs', icon: '📋' },
  { href: '/reports', label: 'Reports', icon: '📈' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, hasToken, authError } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingServicesCount, setPendingServicesCount] = useState(0);
  const [pendingWalletsCount, setPendingWalletsCount] = useState(0);

  const activeLabel = useMemo(() => {
    return navItems.find((n) => pathname.startsWith(n.href))?.label || 'Admin';
  }, [pathname]);

  const fetchCounts = async () => {
    try {
      const token = getToken();
      if (!token) return;

      const [servicesRes, walletsRes] = await Promise.all([
        api('/services/admin/pending', { token }),
        api('/wallet/admin/balance-requests', { token, params: { status: 'PENDING' } })
      ]);

      setPendingServicesCount(servicesRes.data?.length || 0);
      setPendingWalletsCount(walletsRes.data?.length || 0);
    } catch (err) {
      console.error('Failed to fetch pending counts', err);
    }
  };

  useEffect(() => {
    if (!loading && !user && !hasToken) router.push('/login');
  }, [loading, user, hasToken, router]);

  useEffect(() => {
    if (user) {
      fetchCounts();
      const interval = setInterval(fetchCounts, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
            className="mt-4 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded text-sm transition"
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
    <div className="min-h-screen flex">
      <div
        className={clsx(
          'fixed inset-0 bg-black/40 z-30 md:hidden',
          sidebarOpen ? 'block' : 'hidden'
        )}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={clsx(
          'w-64 bg-primary-900 text-white flex flex-col fixed h-full z-40 transform transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0'
        )}
      >
        <div className="p-6 border-b border-primary-700">
          <h1 className="text-xl font-bold">ISP Wallet</h1>
          <p className="text-primary-300 text-sm mt-1">Admin Panel</p>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={clsx(
                'flex items-center px-6 py-3 text-sm transition-colors',
                pathname === item.href || pathname.startsWith(item.href + '/')
                  ? 'bg-primary-700 text-white border-r-4 border-white'
                  : 'text-primary-200 hover:bg-primary-800 hover:text-white'
              )}
            >
              <span className="mr-3 text-lg">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.href === '/services' && pendingServicesCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {pendingServicesCount}
                </span>
              )}
              {item.href === '/wallets' && pendingWalletsCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {pendingWalletsCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-primary-700">
          <div className="text-sm text-primary-300 mb-2">
            <div className="font-medium text-white">{user.fullName}</div>
            <div>{user.role}</div>
          </div>
          <button
            onClick={logout}
            className="w-full bg-danger-500 hover:bg-danger-700 text-white py-2 rounded text-sm transition"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64">
        <header className="bg-white shadow-sm border-b px-4 md:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="md:hidden px-3 py-2 rounded border bg-white"
              onClick={() => setSidebarOpen(true)}
            >
              Menu
            </button>
            <h2 className="text-lg font-semibold text-gray-800 truncate">{activeLabel}</h2>
          </div>
          <div className="text-xs md:text-sm text-gray-500 whitespace-nowrap">
            {new Date().toLocaleDateString('en-BD', { dateStyle: 'full' })}
          </div>
        </header>
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
