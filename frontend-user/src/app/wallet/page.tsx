'use client';

import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import Link from 'next/link';

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<any>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const token = getToken()!;
        const params: Record<string, string> = { page: String(page), limit: '15' };
        if (filter) params.type = filter;

        const [balRes, txRes] = await Promise.all([
          api('/wallet/balance', { token }),
          api('/wallet/transactions', { token, params }),
        ]);
        setBalance(balRes.data.balance);
        setTransactions(txRes.data);
        setMeta(txRes.meta);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    fetch();
  }, [page, filter]);

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold mb-4">My Wallet</h1>

      {/* Balance */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-5 text-white mb-4">
        <p className="text-brand-200 text-xs">Balance</p>
        <h2 className="text-3xl font-bold">৳{balance.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</h2>
        <Link href="/wallet/add-balance" className="mt-3 inline-block bg-white/20 px-4 py-2 rounded-xl text-sm">+ Add Money</Link>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {[{ label: 'All', val: '' }, { label: 'In', val: 'CREDIT' }, { label: 'Out', val: 'DEBIT' }].map((f) => (
          <button
            key={f.val}
            onClick={() => { setFilter(f.val); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${filter === f.val ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Transactions */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No transactions found</div>
        ) : (
          transactions.map((tx: any) => (
            <div key={tx.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'CREDIT' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {tx.type === 'CREDIT' ? '↓' : '↑'}
                </div>
                <div>
                  <p className="text-sm font-medium truncate max-w-[200px]">{tx.description || tx.category}</p>
                  <p className="text-[10px] text-gray-400">{new Date(tx.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`font-bold text-sm ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.type === 'CREDIT' ? '+' : '-'}৳{tx.amount}
                </span>
                <p className="text-[10px] text-gray-400">Bal: ৳{tx.balanceAfter}</p>
              </div>
            </div>
          ))
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
