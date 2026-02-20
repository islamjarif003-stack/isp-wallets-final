'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import { toast } from 'react-hot-toast';
import { FaSync, FaSearch, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

interface IspLog {
  id: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PENDING' | 'REFUNDED';
  requestPayload: { 
    connectionId: string;
    amount: number;
  };
  createdAt: string;
  completedAt?: string;
  startedAt?: string;
  errorMessage?: string;
  details?: any;
}

const StatusBadge = ({ status }: { status: IspLog['status'] }) => {
  const baseClasses = 'px-2 py-1 text-xs font-semibold rounded-full';
  const statusClasses = {
    QUEUED: 'bg-gray-200 text-gray-800',
    PROCESSING: 'bg-blue-200 text-blue-800',
    COMPLETED: 'bg-green-200 text-green-800',
    FAILED: 'bg-red-200 text-red-800',
    PENDING: 'bg-yellow-200 text-yellow-800',
    REFUNDED: 'bg-purple-200 text-purple-800',
  };
  return <span className={`${baseClasses} ${statusClasses[status]}`}>{status}</span>;
};


const IspLogsPage = () => {
  const [logs, setLogs] = useState<IspLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ status: '', connectionId: '' });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchLogs = useCallback(async (pageNum: number, currentFilters: typeof filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '15',
        ...currentFilters,
      });
      const response = await api.get(`/admin/isp/logs?${params.toString()}`);
      setLogs(response.data.logs);
      setTotalPages(Math.ceil(response.data.total / 15));
      setPage(pageNum);
    } catch (error) {
      toast.error('Failed to fetch ISP logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(1, filters);
  }, [fetchLogs, filters]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchLogs(page, filters);
      }, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, page, filters, fetchLogs]);

  const handleRetry = async (logId: string) => {
    try {
      await api.post(`/admin/isp/logs/${logId}/retry`);
      toast.success('Job has been re-queued.');
      fetchLogs(page, filters);
    } catch (error) {
      toast.error('Failed to retry job.');
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };
  
  const handleFilterSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      fetchLogs(1, filters);
  }

  return (
    <div className="container mx-auto p-4 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-gray-800">ISP Automation Logs</h1>
        <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="form-checkbox h-5 w-5 text-blue-600"/>
                <span className="text-gray-700">Auto-refresh</span>
            </label>
            <button onClick={() => fetchLogs(page, filters)} className="p-2 rounded-full hover:bg-gray-200"><FaSync className={`${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      <form onSubmit={handleFilterSubmit} className="bg-white p-4 rounded-lg shadow-sm mb-4 flex items-end space-x-4">
        <div>
            <label htmlFor="connectionId" className="block text-sm font-medium text-gray-700">Connection ID</label>
            <input type="text" name="connectionId" id="connectionId" value={filters.connectionId} onChange={handleFilterChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
        <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
            <select name="status" id="status" value={filters.status} onChange={handleFilterChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                <option value="">All</option>
                <option value="QUEUED">Queued</option>
                <option value="PROCESSING">Processing</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
                <option value="PENDING">Pending</option>
                <option value="REFUNDED">Refunded</option>
            </select>
        </div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"><FaSearch /><span>Search</span></button>
      </form>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamps</th>
              <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && logs.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-10 text-gray-500">Loading logs...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-10 text-gray-500">No logs found.</td></tr>
            ) : (
              logs.map((log) => (
                <>
                  <tr key={log.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                    <td className="py-4 px-6 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{log.requestPayload?.connectionId || 'N/A'}</div>
                        <div className="text-sm text-gray-500">Amount: {log.requestPayload?.amount || 'N/A'}</div>
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap"><StatusBadge status={log.status} /></td>
                    <td className="py-4 px-6 whitespace-nowrap text-sm text-gray-500">
                        <div>Created: {new Date(log.createdAt).toLocaleString()}</div>
                        {log.startedAt && <div>Started: {new Date(log.startedAt).toLocaleString()}</div>}
                        {log.completedAt && <div>Ended: {new Date(log.completedAt).toLocaleString()}</div>}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      {log.status === 'FAILED' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRetry(log.id); }}
                          className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 text-sm"
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedLog === log.id && (
                      <tr className="bg-gray-100">
                          <td colSpan={4} className="p-4">
                              <div className="text-sm text-gray-800">
                                  <p><strong className="font-semibold">Log ID:</strong> {log.id}</p>
                                  {log.errorMessage && <p className="mt-2"><strong className="font-semibold">Error:</strong> <code className="text-red-600 bg-red-50 p-1 rounded">{log.errorMessage}</code></p>}
                                  {log.details && (
                                      <div className="mt-2">
                                          <strong className="font-semibold">Details:</strong>
                                          <pre className="bg-gray-200 p-2 rounded mt-1 text-xs overflow-auto">{JSON.stringify(log.details, null, 2)}</pre>
                                      </div>
                                  )}
                              </div>
                          </td>
                      </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 flex justify-between items-center">
        <span className="text-sm text-gray-700">Page {page} of {totalPages}</span>
        <div className="flex space-x-2">
            <button onClick={() => fetchLogs(page - 1, filters)} disabled={page <= 1} className="p-2 rounded-md bg-white border border-gray-300 disabled:opacity-50"><FaChevronLeft /></button>
            <button onClick={() => fetchLogs(page + 1, filters)} disabled={page >= totalPages} className="p-2 rounded-md bg-white border border-gray-300 disabled:opacity-50"><FaChevronRight /></button>
        </div>
      </div>
    </div>
  );
};

export default IspLogsPage;
