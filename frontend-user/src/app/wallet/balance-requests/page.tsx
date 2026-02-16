'use client';

import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import Link from 'next/link';

type StatusFilter = '' | 'PENDING' | 'APPROVED' | 'REJECTED';

export default function BalanceRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<any>(null);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const token = getToken()!;
        const params: Record<string, string> = { page: String(page), limit: '20' };
        if (status) params.status = status;
        const res = await api('/wallet/balance-requests', { token, params });
        setRequests(res.data);
        setMeta(res.meta);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [status, page]);

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Add Money Requests</h1>
        <Link href="/wallet/add-balance" className="text-brand-600 text-sm font-medium">+ New</Link>
      </div>

      <div className="flex gap-2 mb-4">
        {([
          { label: 'All', val: '' },
          { label: 'Pending', val: 'PENDING' },
          { label: 'Approved', val: 'APPROVED' },
          { label: 'Rejected', val: 'REJECTED' },
        ] as Array<{ label: string; val: StatusFilter }>).map((f) => (
          <button
            key={f.val}
            onClick={() => { setStatus(f.val); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${status === f.val ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="card text-center text-gray-400 text-sm py-8">No requests found</div>
        ) : (
          requests.map((r: any) => {
            const s = String(r.status || '').toUpperCase();
            const badge =
              s === 'APPROVED'
                ? 'bg-green-50 text-green-700 border-green-200'
                : s === 'REJECTED'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-yellow-50 text-yellow-700 border-yellow-200';

            return (
              <div key={r.id} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">৳{Number(r.amount).toLocaleString()}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${badge}`}>{s}</span>
                  </div>
                  <div className="text-[11px] text-gray-400">{new Date(r.createdAt).toLocaleString()}</div>
                </div>

                <div className="text-xs text-gray-600 mt-2">
                  <div>Method: <span className="font-mono">{r.paymentMethod}</span></div>
                  {r.paymentReference && <div>TrxID: <span className="font-mono">{r.paymentReference}</span></div>}
                </div>

                {s === 'REJECTED' && r.adminNote && (
                  <div className="mt-2 text-xs text-red-600">{r.adminNote}</div>
                )}
              </div>
            );
          })
        )}
      </div>

      {meta && (
        <div className="flex justify-between mt-4">
          <button disabled={!meta.hasPrev} onClick={() => setPage(page - 1)} className="px-4 py-2 text-sm bg-gray-100 rounded-xl disabled:opacity-30">← Prev</button>
          <span className="text-xs text-gray-400 self-center">{page}/{meta.totalPages}</span>
          <button disabled={!meta.hasNext} onClick={() => setPage(page + 1)} className="px-4 py-2 text-sm bg-gray-100 rounded-xl disabled:opacity-30">Next →</button>
        </div>
      )}
    </div>
  );
}

