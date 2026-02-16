'use client';

import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';

export default function WalletsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = getToken();
      const res = await api('/wallet/admin/balance-requests', { token: token!, params: { status: 'PENDING' } });
      setRequests(res.data);
    } catch (err) { console.error(err); }
    finally { if (!silent) setLoading(false); }
  };

  useEffect(() => { 
    fetchRequests(); 
    const interval = setInterval(() => fetchRequests(true), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const token = getToken();
      await api('/wallet/admin/approve-balance', { method: 'POST', token: token!, body: { requestId } });
      fetchRequests();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (requestId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason || reason.length < 5) { alert('Reason must be at least 5 characters'); return; }
    setActionLoading(requestId);
    try {
      const token = getToken();
      await api('/wallet/admin/reject-balance', { method: 'POST', token: token!, body: { requestId, adminNote: reason } });
      fetchRequests();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Pending Balance Requests</h1>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No pending requests</td></tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{req.user?.fullName}</div>
                    <div className="text-xs text-gray-500">{req.user?.mobile}</div>
                  </td>
                  <td className="px-4 py-3 font-bold text-green-600">৳{req.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{req.paymentMethod}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{req.paymentReference || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(req.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={actionLoading === req.id}
                        className="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600 disabled:opacity-50"
                      >
                        {actionLoading === req.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={actionLoading === req.id}
                        className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}