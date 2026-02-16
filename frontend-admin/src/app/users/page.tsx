'use client';

import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';

interface User {
  id: string;
  mobile: string;
  fullName: string;
  email: string | null;
  status: string;
  role: { name: string; label: string };
  wallet: { id: string; cachedBalance: number; status: string } | null;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  
  const [newRole, setNewRole] = useState('');
  const [roleReason, setRoleReason] = useState('');
  const [roleLoading, setRoleLoading] = useState(false);

  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceType, setBalanceType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [balanceReason, setBalanceReason] = useState('');
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [passwordReason, setPasswordReason] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api('/admin/users', { token: token!, params });
      setUsers(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [page, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleUpdateRole = async () => {
    if (!selectedUser || !newRole || !roleReason) return;
    setRoleLoading(true);
    try {
      const token = getToken();
      await api(`/admin/users/role`, {
        method: 'POST',
        token: token!,
        body: { 
          userId: selectedUser.id,
          roleName: newRole,
          reason: roleReason
        }
      });
      setShowRoleModal(false);
      setRoleReason('');
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    } finally {
      setRoleLoading(false);
    }
  };

  const handleUpdateBalance = async () => {
    if (!selectedUser || !balanceAmount || !balanceReason) return;
    
    if (balanceReason.length < 10) {
        alert('Reason must be at least 10 characters long');
        return;
    }

    setBalanceLoading(true);
    try {
      const token = getToken();
      await api(`/wallet/admin/adjustment`, { // Fixed endpoint: /wallets -> /wallet
        method: 'POST',
        token: token!,
        body: {
          walletId: selectedUser.wallet?.id,
          amount: parseFloat(balanceAmount),
          type: balanceType,
          reason: balanceReason // Note: Backend requires min 10 chars for reason
        }
      });
      setShowBalanceModal(false);
      setBalanceAmount('');
      setBalanceReason('');
      fetchUsers();
    } catch (err: any) {
      // Show backend validation error details if available
      const msg = err.errors ? err.errors.map((e: any) => e.message).join('\n') : (err.message || 'Failed to update balance');
      alert(msg);
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedUser || !newStatus || !statusReason) return;
    
    if (statusReason.length < 5) {
        alert('Reason must be at least 5 characters long');
        return;
    }

    setStatusLoading(true);
    try {
      const token = getToken();
      await api(`/admin/users/status`, {
        method: 'POST',
        token: token!,
        body: { 
          userId: selectedUser.id,
          status: newStatus,
          reason: statusReason
        }
      });
      setShowStatusModal(false);
      setStatusReason('');
      fetchUsers();
    } catch (err: any) {
      const msg = err.errors ? err.errors.map((e: any) => e.message).join('\n') : (err.message || 'Failed to update status');
      alert(msg);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!selectedUser || !newPassword || !passwordReason) return;
    
    if (newPassword.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }

    if (passwordReason.length < 5) {
        alert('Reason must be at least 5 characters long');
        return;
    }

    setPasswordLoading(true);
    try {
      const token = getToken();
      await api(`/admin/users/reset-password`, {
        method: 'POST',
        token: token!,
        body: {
          userId: selectedUser.id,
          newPassword,
          reason: passwordReason
        }
      });
      setShowPasswordModal(false);
      setNewPassword('');
      setPasswordReason('');
      alert('Password reset successfully');
    } catch (err: any) {
      const msg = err.errors ? err.errors.map((e: any) => e.message).join('\n') : (err.message || 'Failed to reset password');
      alert(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    SUSPENDED: 'bg-yellow-100 text-yellow-800',
    BANNED: 'bg-red-100 text-red-800',
    PENDING_VERIFICATION: 'bg-gray-100 text-gray-800',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">User Management</h1>

      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-4 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by mobile or name..."
            className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="BANNED">Banned</option>
          </select>
          <button type="submit" className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition">
            Search
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mobile</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No users found</td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{user.fullName}</div>
                      <div className="text-xs text-gray-500">{user.email || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{user.mobile}</td>
                    <td className="px-4 py-3"><span className="text-xs font-medium bg-primary-100 text-primary-800 px-2 py-1 rounded">{user.role.name}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-1 rounded ${statusColors[user.status] || ''}`}>{user.status}</span></td>
                    <td className="px-4 py-3 text-sm font-medium">৳{user.wallet?.cachedBalance.toLocaleString() || '0'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button 
                        onClick={() => { setSelectedUser(user); setNewRole(user.role.name); setShowRoleModal(true); }}
                        className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100"
                      >
                        Edit Role
                      </button>
                      <button 
                        onClick={() => { setSelectedUser(user); setShowBalanceModal(true); }}
                        className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded border border-purple-200 hover:bg-purple-100"
                      >
                        Edit Balance
                      </button>
                      <button 
                        onClick={() => { setSelectedUser(user); setShowPasswordModal(true); }}
                        className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded border border-red-200 hover:bg-red-100"
                      >
                        Reset Pass
                      </button>
                      <button 
                        onClick={() => { setSelectedUser(user); setNewStatus(user.status); setShowStatusModal(true); }}
                        className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded border border-orange-200 hover:bg-orange-100"
                      >
                        Status
                      </button>
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

      {/* Role Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Edit Role: {selectedUser.fullName}</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Select Role</label>
              <select 
                className="w-full border rounded-lg px-3 py-2"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="USER">USER</option>
                <option value="MANAGER">MANAGER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Reason</label>
              <input 
                type="text" 
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Reason for role change"
                value={roleReason}
                onChange={(e) => setRoleReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRoleModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button 
                onClick={handleUpdateRole} 
                disabled={roleLoading || !roleReason}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {roleLoading ? 'Updating...' : 'Update Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Modal */}
      {showBalanceModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Edit Balance: {selectedUser.fullName}</h3>
            <div className="mb-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Action</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setBalanceType('CREDIT')}
                    className={`flex-1 py-2 text-sm rounded-lg border ${balanceType === 'CREDIT' ? 'bg-green-50 border-green-500 text-green-700 font-bold' : 'bg-white text-gray-600'}`}
                  >
                    Add (+)
                  </button>
                  <button 
                    onClick={() => setBalanceType('DEBIT')}
                    className={`flex-1 py-2 text-sm rounded-lg border ${balanceType === 'DEBIT' ? 'bg-red-50 border-red-500 text-red-700 font-bold' : 'bg-white text-gray-600'}`}
                  >
                    Deduct (-)
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input 
                  type="number" 
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="0.00"
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <input 
                  type="text" 
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Reason for adjustment"
                  value={balanceReason}
                  onChange={(e) => setBalanceReason(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowBalanceModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button 
                onClick={handleUpdateBalance} 
                disabled={balanceLoading || !balanceAmount || !balanceReason}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {balanceLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Password Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Reset Password: {selectedUser.fullName}</h3>
            <div className="mb-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">New Password</label>
                <input 
                  type="password" 
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="New password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <input 
                  type="text" 
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Reason for reset"
                  value={passwordReason}
                  onChange={(e) => setPasswordReason(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowPasswordModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button 
                onClick={handleUpdatePassword} 
                disabled={passwordLoading || !newPassword || !passwordReason}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {passwordLoading ? 'Processing...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {showStatusModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Change Status: {selectedUser.fullName}</h3>
            <div className="mb-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select 
                  className="w-full border rounded-lg px-3 py-2"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="BANNED">BANNED</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <input 
                  type="text" 
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Reason for status change"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowStatusModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button 
                onClick={handleUpdateStatus} 
                disabled={statusLoading || !newStatus || !statusReason}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {statusLoading ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}