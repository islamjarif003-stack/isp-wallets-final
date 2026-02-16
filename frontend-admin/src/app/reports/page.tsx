'use client';

import { useState } from 'react';
import { api, getToken } from '@/lib/api';

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [inflowData, setInflowData] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const token = getToken()!;
      const params = { startDate, endDate };

      const [inflowRes, revenueRes, topRes] = await Promise.all([
        api('/reports/inflow-outflow', { token, params }),
        api('/reports/revenue', { token, params: { ...params, groupBy: 'day' } }),
        api('/reports/top-users', { token, params: { limit: '10' } }),
      ]);

      setInflowData(inflowRes.data);
      setRevenueData(revenueRes.data);
      setTopUsers(topRes.data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: string) => {
    const token = getToken()!;
    const url = `${process.env.NEXT_PUBLIC_API_URL}/reports/export/${type}?startDate=${startDate}&endDate=${endDate}`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${type}_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reports & Analytics</h1>

      {/* Date Range */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 border rounded-lg" />
          </div>
          <button onClick={fetchReports} disabled={loading} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {loading ? 'Loading...' : 'Generate Reports'}
          </button>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <button onClick={() => handleExport('transactions')} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">📥 Export Transactions</button>
        <button onClick={() => handleExport('users')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">📥 Export Users</button>
        <button onClick={() => handleExport('service-logs')} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700">📥 Export Service Logs</button>
        <button onClick={() => handleExport('revenue')} className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700">📥 Export Revenue</button>
      </div>

      {/* Inflow/Outflow Summary */}
      {inflowData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="text-sm text-gray-500">Total Inflow</div>
            <div className="text-2xl font-bold text-green-600">৳{inflowData.inflow.total.toLocaleString()}</div>
            <div className="text-xs text-gray-400">{inflowData.inflow.count} transactions</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="text-sm text-gray-500">Total Outflow</div>
            <div className="text-2xl font-bold text-red-600">৳{inflowData.outflow.total.toLocaleString()}</div>
            <div className="text-xs text-gray-400">{inflowData.outflow.count} transactions</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="text-sm text-gray-500">Net Balance</div>
            <div className={`text-2xl font-bold ${inflowData.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>৳{inflowData.net.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Revenue Table */}
      {revenueData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-6">
          <h3 className="px-4 py-3 font-semibold border-b">Daily Revenue</h3>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Period</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Credits</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Debits</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Commission</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Net</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">TXN Count</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {revenueData.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 text-sm">
                  <td className="px-4 py-2 font-medium">{row.period}</td>
                  <td className="px-4 py-2 text-green-600">৳{row.totalCredits.toLocaleString()}</td>
                  <td className="px-4 py-2 text-red-600">৳{row.totalDebits.toLocaleString()}</td>
                  <td className="px-4 py-2 text-purple-600">৳{row.totalCommission.toLocaleString()}</td>
                  <td className={`px-4 py-2 font-bold ${row.netRevenue >= 0 ? 'text-green-700' : 'text-red-700'}`}>৳{row.netRevenue.toLocaleString()}</td>
                  <td className="px-4 py-2 text-gray-500">{row.transactionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Top Users */}
      {topUsers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <h3 className="px-4 py-3 font-semibold border-b">Top Users by Spending</h3>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">#</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">User</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Mobile</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Total Spent</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Transactions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {topUsers.map((user, i) => (
                <tr key={user.userId} className="hover:bg-gray-50 text-sm">
                  <td className="px-4 py-2 font-bold text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2 font-medium">{user.fullName}</td>
                  <td className="px-4 py-2 text-gray-600">{user.mobile}</td>
                  <td className="px-4 py-2 font-bold text-primary-700">৳{user.totalSpent.toLocaleString()}</td>
                  <td className="px-4 py-2 text-gray-500">{user.transactionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}