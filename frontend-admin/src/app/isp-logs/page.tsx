'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import { toast } from 'react-hot-toast';

interface IspLog {
  id: string;
  status: string;
  requestPayload: { connectionId: string };
  createdAt: string;
  errorMessage?: string;
}

const IspLogsPage = () => {
  const [logs, setLogs] = useState<IspLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const response = await api.get(`/admin/isp/logs?page=${pageNum}&limit=10`);
      setLogs(response.data.logs);
      setTotalPages(Math.ceil(response.data.total / 10));
      setPage(pageNum);
    } catch (error) {
      toast.error('Failed to fetch ISP logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const handleRetry = async (logId: string) => {
    try {
      await api.post(`/admin/isp/logs/${logId}/retry`);
      toast.success('Job has been re-queued.');
      fetchLogs(page); // Refresh logs
    } catch (error) {
      toast.error('Failed to retry job.');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">ISP Automation Logs</h1>
      {/* Add filter controls here later */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Log ID</th>
              <th className="py-2 px-4 border-b">Connection ID</th>
              <th className="py-2 px-4 border-b">Status</th>
              <th className="py-2 px-4 border-b">Created At</th>
              <th className="py-2 px-4 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-4">Loading...</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2 px-4 border-b">{log.id}</td>
                  <td className="py-2 px-4 border-b">{log.requestPayload?.connectionId || 'N/A'}</td>
                  <td className="py-2 px-4 border-b">{log.status}</td>
                  <td className="py-2 px-4 border-b">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="py-2 px-4 border-b">
                    {log.status === 'FAILED' && (
                      <button 
                        onClick={() => handleRetry(log.id)}
                        className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Add pagination controls here */}
    </div>
  );
};

export default IspLogsPage;
