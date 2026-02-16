'use client';

import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<any>(null);

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      try {
        const token = getToken();
        const res = await api('/admin/audit-logs', { token: token!, params: { page: String(page), limit: '30' } });
        setLogs(res.data);
        setMeta(res.meta);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    fetchLogs();
  }, [page]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Audit Logs</h1>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No audit logs found</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 text-sm">
                    <td className="px-4 py-3"><span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-mono">{log.action}</span></td>
                    <td className="px-4 py-3">{log.admin?.fullName || '-'}</td>
                    <td className="px-4 py-3">{log.target?.fullName || '-'}</td>
                    <td className="px-4 py-3 text-xs">{log.resourceType} / {log.resourceId?.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">{log.reason || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{log.ipAddress || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <div className="text-sm text-gray-500">Page {page} of {meta.totalPages} ({meta.total} total)</div>
            <div className="flex gap-2">
              <button disabled={!meta.hasPrev} onClick={() => setPage(page - 1)} className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-100">Previous</button>
              <button disabled={!meta.hasNext} onClick={() => setPage(page + 1)} className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-100">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}