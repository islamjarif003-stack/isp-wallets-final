'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/services', label: 'Services', icon: '⚡' },
  { href: '/wallet', label: 'Wallet', icon: '💰' },
  { href: '/history', label: 'History', icon: '📋' },
  { href: '/notifications', label: 'Alerts', icon: '🔔' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-200 z-50">
      <div className="flex justify-around items-center py-2">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex flex-col items-center py-1 px-3 rounded-lg transition-colors min-w-[60px]',
                active ? 'text-brand-600' : 'text-gray-400'
              )}
            >
              <span className="text-xl">{item.icon}</span>
              <span className={clsx('text-[10px] mt-0.5 font-medium', active && 'text-brand-600')}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}