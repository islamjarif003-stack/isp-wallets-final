'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, getToken } from '@/lib/api';

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || '';
  const initialCategory = searchParams.get('category') || '';

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [typeFilter, setTypeFilter] = useState('');

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (typeFilter) params.type = typeFilter;

      const res = await api('/wallet/admin/transactions', { token: token!, params });
      setTransactions(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, statusFilter, categoryFilter, typeFilter]);

  const statusColors: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    FAILED: 'bg-red-100 text-red-800',
    REVERSED: 'bg-gray-100 text-gray-800',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Transaction History</h1>

      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex flex-wrap gap-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">All Status</option>
          <option value="COMPLETED">Completed</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
          <option value="REVERSED">Reversed</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">All Types</option>
          <option value="CREDIT">Credit (+)</option>
          <option value="DEBIT">Debit (-)</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">All Categories</option>
          <option value="BALANCE_ADD">Add Balance</option>
          <option value="SERVICE_PURCHASE">Purchase</option>
          <option value="SERVICE_REFUND">Refund</option>
          <option value="ADMIN_ADJUSTMENT">Adjustment</option>
          <option value="COMMISSION">Commission</option>
        </select>

        <button 
            onClick={fetchTransactions}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 ml-auto"
        >
            Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No transactions found</td></tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{tx.wallet?.user?.fullName || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{tx.wallet?.user?.mobile || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${tx.type === 'CREDIT' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {tx.type}
                        </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{tx.category}</td>
                    <td className="px-4 py-3 text-sm font-bold">
                        <span className={tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}>
                            {tx.type === 'CREDIT' ? '+' : '-'}৳{Number(tx.amount).toLocaleString()}
                        </span>
                    </td>
                    <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${statusColors[tx.status] || 'bg-gray-100'}`}>
                            {tx.status}
                        </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate" title={tx.description}>
                        {tx.description || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <div className="text-sm text-gray-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, meta.total)} of {meta.total}
            </div>
            <div className="flex gap-2">
              <button
                disabled={!meta.hasPrev}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-100"
              >
                Previous
              </button>
              <button
                disabled={!meta.hasNext}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
