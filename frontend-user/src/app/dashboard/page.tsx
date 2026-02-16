'use client';

import { useAuth } from '@/hooks/useAuth';
import { useEffect, useRef, useState } from 'react';
import { api, getToken } from '@/lib/api';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [balanceRequests, setBalanceRequests] = useState<any[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [notice, setNotice] = useState('');
  const [notificationState, setNotificationState] = useState<'unsupported' | 'default' | 'granted' | 'denied'>('default');
  const lastReqStateRef = useRef<Map<string, string>>(new Map());
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const updateNotificationState = () => {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        setNotificationState('unsupported');
        return;
      }
      setNotificationState(Notification.permission as any);
    };

    async function fetchData(triggeredByPoll: boolean) {
      try {
        const token = getToken()!;
        const [balRes, txRes] = await Promise.all([
          api('/wallet/balance', { token }),
          api('/wallet/transactions', { token, params: { limit: '5' } }),
        ]);
        setBalance(balRes.data.balance);
        setRecentTx(txRes.data);
        const brRes = await api('/wallet/balance-requests', { token, params: { limit: '5' } });
        const nextReqs = brRes.data as any[];
        setBalanceRequests(nextReqs);

        if (triggeredByPoll) {
          const nextMap = new Map<string, string>();
          for (const r of nextReqs) nextMap.set(String(r.id), String(r.status || 'PENDING'));

          const prevMap = lastReqStateRef.current;
          let changedMsg = '';
          for (let i = 0; i < nextReqs.length; i++) {
            const id = String(nextReqs[i].id);
            const nextStatus = String(nextReqs[i].status || 'PENDING');
            const prevStatus = prevMap.get(id);
            if (!prevStatus) {
              changedMsg = 'Boss, your add money request submitted.';
              break;
            }
            if (prevStatus !== nextStatus && (nextStatus === 'APPROVED' || nextStatus === 'REJECTED')) {
              changedMsg =
                nextStatus === 'APPROVED'
                  ? 'Boss, your add money request approved.'
                  : 'Boss, your add money request rejected.';
              break;
            }
          }

          if (changedMsg) {
            setNotice(changedMsg);
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('Wallet Update', { body: changedMsg });
              } catch {}
            }
          }

          lastReqStateRef.current = nextMap;
        } else {
          const initMap = new Map<string, string>();
          for (const r of nextReqs) initMap.set(String(r.id), String(r.status || 'PENDING'));
          lastReqStateRef.current = initMap;
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingBalance(false);
      }
    }

    updateNotificationState();
    fetchData(false);

    intervalRef.current = window.setInterval(() => {
      fetchData(true);
    }, 15000);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, []);

  const quickServices = [
    { icon: '🌐', label: 'Internet', href: '/services?type=HOME_INTERNET', color: 'bg-blue-100' },
    { icon: '📶', label: 'Hotspot', href: '/services?type=HOTSPOT_WIFI', color: 'bg-purple-100' },
    { icon: '📱', label: 'Recharge', href: '/services?type=MOBILE_RECHARGE', color: 'bg-green-100' },
    { icon: '💡', label: 'Electricity', href: '/services?type=ELECTRICITY_BILL', color: 'bg-yellow-100' },
  ];

  return (
    <div className="px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500">Welcome back,</p>
          <h1 className="text-xl font-bold text-gray-900">{user?.fullName}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={logout}
            className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-xl"
          >
            Logout
          </button>
          <Link href="/notifications" className="relative">
            <span className="text-2xl">🔔</span>
          </Link>
        </div>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-6 text-white mb-6 shadow-lg">
        <p className="text-brand-200 text-sm mb-1">Available Balance</p>
        {loadingBalance ? (
          <div className="h-10 bg-white/20 rounded animate-pulse w-40"></div>
        ) : (
          <h2 className="text-3xl font-bold">৳{balance.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</h2>
        )}
        <div className="flex gap-3 mt-4">
          <Link href="/wallet/add-balance" className="bg-white/20 hover:bg-white/30 backdrop-blur px-4 py-2 rounded-xl text-sm font-medium transition flex-1 text-center">
            + Add Money
          </Link>
          <Link href="/wallet" className="bg-white/20 hover:bg-white/30 backdrop-blur px-4 py-2 rounded-xl text-sm font-medium transition flex-1 text-center">
            Transactions
          </Link>
        </div>
      </div>

      {notice && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl flex items-center justify-between gap-3">
          <div className="text-sm font-medium">{notice}</div>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="text-xs font-semibold px-3 py-1 rounded bg-white border hover:bg-gray-50"
          >
            Dismiss
          </button>
        </div>
      )}

      {notificationState !== 'unsupported' && notificationState !== 'granted' && (
        <div className="mb-4 bg-white border rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="text-sm text-gray-700">
            Browser notification enable করলে approval/reject alert পাবেন।
          </div>
          <button
            type="button"
            disabled={notificationState === 'denied'}
            onClick={async () => {
              if (typeof window === 'undefined' || !('Notification' in window)) return;
              try {
                const p = await Notification.requestPermission();
                setNotificationState(p as any);
              } catch {}
            }}
            className="text-xs font-semibold px-3 py-2 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Enable
          </button>
        </div>
      )}

      {/* Quick Services */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Services</h3>
      <div className="grid grid-cols-4 gap-3 mb-6">
        {quickServices.map((svc) => (
          <Link key={svc.label} href={svc.href} className="flex flex-col items-center">
            <div className={`w-14 h-14 ${svc.color} rounded-2xl flex items-center justify-center text-2xl mb-1`}>
              {svc.icon}
            </div>
            <span className="text-xs text-gray-600 font-medium">{svc.label}</span>
          </Link>
        ))}
      </div>

      {/* Add Money Requests */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Add Money Requests</h3>
        <Link href="/wallet/balance-requests" className="text-brand-600 text-xs font-medium">See All</Link>
      </div>

      <div className="space-y-2 mb-6">
        {balanceRequests.length === 0 ? (
          <div className="card text-center text-gray-400 text-sm py-6">No add money requests</div>
        ) : (
          balanceRequests.map((r: any) => {
            const status = String(r.status || '').toUpperCase();
            const badge =
              status === 'APPROVED'
                ? 'bg-green-50 text-green-700 border-green-200'
                : status === 'REJECTED'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-yellow-50 text-yellow-700 border-yellow-200';
            return (
              <div key={r.id} className="card flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">৳{Number(r.amount).toLocaleString()}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${badge}`}>{status || 'PENDING'}</span>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {r.paymentMethod}{r.paymentReference ? ` • ${r.paymentReference}` : ''} • {new Date(r.createdAt).toLocaleDateString()}
                  </div>
                  {status === 'REJECTED' && r.adminNote && (
                    <div className="text-[11px] text-red-600 mt-1 truncate max-w-[260px]">{r.adminNote}</div>
                  )}
                </div>
                <Link href="/wallet/add-balance" className="text-brand-600 text-xs font-medium">New</Link>
              </div>
            );
          })
        )}
      </div>

      {/* Recent Transactions */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent Activity</h3>
        <Link href="/wallet" className="text-brand-600 text-xs font-medium">See All</Link>
      </div>

      <div className="space-y-2">
        {recentTx.length === 0 ? (
          <div className="card text-center text-gray-400 text-sm py-8">No transactions yet</div>
        ) : (
          recentTx.map((tx: any) => (
            <div key={tx.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${tx.type === 'CREDIT' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {tx.type === 'CREDIT' ? '↓' : '↑'}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">
                    {tx.description || tx.category}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <span className={`font-bold text-sm ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                {tx.type === 'CREDIT' ? '+' : '-'}৳{tx.amount.toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
