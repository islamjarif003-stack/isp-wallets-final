'use client';

import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { copyText } from '@/lib/copy';

export default function ServicesPage() {
  const [tab, setTab] = useState<'pending' | 'packages' | 'hotspot'>('pending');

  const [pending, setPending] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [releaseConnectionId, setReleaseConnectionId] = useState('');
  const [releaseStbNumber, setReleaseStbNumber] = useState('');

  const [packages, setPackages] = useState<any[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesPage, setPackagesPage] = useState(1);
  const [packagesMeta, setPackagesMeta] = useState<any>(null);
  const [packagesServiceType, setPackagesServiceType] = useState<string>('');

  // Hotspot State
  const [hotspotStats, setHotspotStats] = useState<any[]>([]);
  const [usedCards, setUsedCards] = useState<any[]>([]);
  const [availableCards, setAvailableCards] = useState<any[]>([]);
  const [showUsedCards, setShowUsedCards] = useState(false);
  const [showAvailableCards, setShowAvailableCards] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [hotspotLoading, setHotspotLoading] = useState(false);
  const [selectedHotspotPkg, setSelectedHotspotPkg] = useState('');
  const [hotspotCodes, setHotspotCodes] = useState('');
  const [addingCards, setAddingCards] = useState(false);

  const [passwordModal, setPasswordModal] = useState<{
    isOpen: boolean;
    action: 'edit' | 'delete' | 'delete-all' | null;
    cardId?: string;
    packageId?: string;
    currentCode?: string;
  }>({ isOpen: false, action: null });
  const [adminPassword, setAdminPassword] = useState('');
  const [editCardCode, setEditCardCode] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createServiceType, setCreateServiceType] = useState('HOME_INTERNET');
  const [createName, setCreateName] = useState('');
  const [createPrice, setCreatePrice] = useState('');
  const [createCommission, setCreateCommission] = useState('');
  const [createBandwidth, setCreateBandwidth] = useState('');
  const [createValidity, setCreateValidity] = useState('');
  const [createDataLimit, setCreateDataLimit] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createSortOrder, setCreateSortOrder] = useState('');
  const [createServer, setCreateServer] = useState('');
  const [createProtocol, setCreateProtocol] = useState('');
  const [createError, setCreateError] = useState('');
  const [createSaving, setCreateSaving] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<string>('ACTIVE');

  const fetchPending = async (silent = false) => {
    if (!silent) setPendingLoading(true);
    try {
      const token = getToken();
      const res = await api('/services/admin/pending', { token: token! });
      setPending(res.data);
    } catch (err) { console.error(err); }
    finally { if (!silent) setPendingLoading(false); }
  };

  const fetchPackages = async (nextPage?: number) => {
    setPackagesLoading(true);
    try {
      const token = getToken();
      const page = nextPage ?? packagesPage;
      const params: Record<string, string> = { page: String(page), limit: '50' };
      if (packagesServiceType) params.serviceType = packagesServiceType;
      
      let res;
      if (packagesServiceType === 'SET_TOP_BOX') {
        // STB has a separate endpoint
        res = await api('/services/stb/packages', { token: token!, params: { ...params, includeInactive: 'true' } });
        // Normalize response to match existing table structure
        // STB response: { success: true, data: [...] }
        // Generic response: { data: [...], meta: ... }
        // We need to fake meta if missing, or handle pagination differently.
        // STB endpoint currently returns all packages, no pagination.
        res = {
           data: res.data.map((p: any) => ({ ...p, serviceType: 'SET_TOP_BOX' })),
           meta: { total: res.data.length, page: 1, limit: 100, totalPages: 1, hasNext: false, hasPrev: false }
        };
      } else {
        res = await api('/services/admin/packages', { token: token!, params });
      }
      
      setPackages(res.data);
      setPackagesMeta(res.meta);
    } catch (err) {
      console.error(err);
    } finally {
      setPackagesLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
    const interval = setInterval(() => fetchPending(true), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tab === 'packages') fetchPackages();
    if (tab === 'hotspot') fetchHotspotStats();
  }, [tab, packagesPage, packagesServiceType]);

  const fetchHotspotStats = async () => {
    setHotspotLoading(true);
    try {
      const token = getToken();
      const res = await api('/services/hotspot/admin/stats', { token: token! });
      setHotspotStats(res.data);
    } catch (err) { console.error(err); }
    finally { setHotspotLoading(false); }
  };

  const fetchUsedCards = async (pkgId?: string) => {
    setHotspotLoading(true);
    try {
      const token = getToken();
      const query = pkgId ? `?packageId=${pkgId}` : '';
      const res = await api(`/services/hotspot/admin/used-cards${query}`, { token: token! });
      setUsedCards(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setHotspotLoading(false);
    }
  };

  const fetchAvailableCards = async (pkgId?: string) => {
    setHotspotLoading(true);
    try {
      const token = getToken();
      const query = pkgId ? `?packageId=${pkgId}` : '';
      const res = await api(`/services/hotspot/admin/available-cards${query}`, { token: token! });
      setAvailableCards(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setHotspotLoading(false);
    }
  };

  const handlePasswordAction = async () => {
    if (!adminPassword) return alert('Password is required');
    setPasswordLoading(true);
    try {
        const token = getToken();
        if (passwordModal.action === 'edit') {
            await api(`/services/hotspot/admin/cards/${passwordModal.cardId}`, { 
                method: 'PUT',
                token: token!,
                body: { code: editCardCode, password: adminPassword }
            });
            alert('Card updated successfully');
        } else if (passwordModal.action === 'delete') {
            await api(`/services/hotspot/admin/cards/${passwordModal.cardId}`, { 
                method: 'DELETE',
                token: token!,
                body: { password: adminPassword }
            });
            alert('Card deleted successfully');
        } else if (passwordModal.action === 'delete-all') {
            await api(`/services/hotspot/admin/cards/delete-all`, { 
                method: 'POST',
                token: token!,
                body: { packageId: passwordModal.packageId, password: adminPassword }
            });
            alert('All available cards deleted successfully');
        }
        
        setPasswordModal({ isOpen: false, action: null });
        setAdminPassword('');
        setEditCardCode('');
        fetchAvailableCards(selectedHotspotPkg);
        fetchHotspotStats();
    } catch (err: any) {
        alert(err.message || 'Action failed');
    } finally {
        setPasswordLoading(false);
    }
  };

  const handleResetCard = async (cardId: string) => {
    if (!confirm('Are you sure you want to reset this card to AVAILABLE?')) return;
    setResetLoading(true);
    try {
        const token = getToken();
        await api(`/services/hotspot/admin/cards/${cardId}/reset`, { 
            method: 'POST',
            token: token! 
        });
        alert('Card reset successfully');
        fetchUsedCards(selectedHotspotPkg);
        fetchHotspotStats();
    } catch (err: any) {
        alert(err.message || 'Failed to reset card');
    } finally {
        setResetLoading(false);
    }
  };

  const handleExportCards = async () => {
    // Mock export for now or use library
    const headers = ['Package', 'Code', 'Status', 'Used By', 'Updated At'];
    const rows = usedCards.map(c => [
        c.package.name,
        c.code,
        c.status,
        c.usedBy || '-',
        new Date(c.updatedAt).toLocaleString()
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.join(",")).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "used_hotspot_cards.csv");
    document.body.appendChild(link);
    link.click();
  };

  const handleAddCards = async () => {
    if (!selectedHotspotPkg || !hotspotCodes.trim()) return;
    setAddingCards(true);
    try {
      const codes = hotspotCodes.split('\n').map(c => c.trim()).filter(c => c.length > 0);
      const token = getToken();
      const res = await api('/services/hotspot/admin/cards', {
        method: 'POST',
        token: token!,
        body: { packageId: selectedHotspotPkg, codes }
      });
      alert(`Added ${res.data.count} cards. Duplicates skipped: ${res.data.duplicates}`);
      setHotspotCodes('');
      fetchHotspotStats();
    } catch(err: any) {
      alert(err.message || 'Failed to add cards');
    } finally {
      setAddingCards(false);
    }
  };

  const handleManualExecute = async (logId: string) => {
    setActionLoading(logId);
    try {
      const token = getToken();
      await api(`/services/admin/manual-execute/${logId}`, { method: 'POST', token: token! });
      fetchPending();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const handleManualRefund = async (logId: string) => {
    const reason = prompt('Enter refund reason:');
    if (!reason || reason.length < 5) { alert('Reason must be at least 5 characters'); return; }
    setActionLoading(logId);
    try {
      const token = getToken();
      await api(`/services/admin/manual-refund/${logId}`, { method: 'POST', token: token!, body: { reason } });
      fetchPending();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const handleReleaseOwner = async (connectionId: string) => {
    const ok = window.confirm(`Release owner for connection ${connectionId}?`);
    if (!ok) return;
    const actionId = `release:${connectionId}`;
    setActionLoading(actionId);
    try {
      const token = getToken();
      const res = await api('/services/admin/services/release-home-connection', {
        method: 'POST',
        token: token!,
        body: { connectionId }
      });
      fetchPending();
      
      let msg = 'Connection ownership released';
      if (res.data) {
         msg += `\nOwner: ${res.data.ownerName || 'N/A'} (${res.data.ownerMobile || 'N/A'})`;
         if (res.data.expiresAt) {
            msg += `\nExpires At: ${new Date(res.data.expiresAt).toLocaleString()}`;
         }
      }
      alert(msg);
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const handleReleaseStbOwner = async (stbNumber: string) => {
    const ok = window.confirm(`Release owner for STB ${stbNumber}?`);
    if (!ok) return;
    const actionId = `release:${stbNumber}`;
    setActionLoading(actionId);
    try {
      const token = getToken();
      const res = await api('/services/stb/admin/release-owner', {
        method: 'POST',
        token: token!,
        body: { stbNumber }
      });
      fetchPending();
      
      let msg = 'STB ownership released';
      if (res.data) {
         msg += `\nOwner: ${res.data.ownerName || 'N/A'} (${res.data.ownerMobile || 'N/A'})`;
         if (res.data.expiresAt) {
            msg += `\nExpires At: ${new Date(res.data.expiresAt).toLocaleString()}`;
         }
      }
      alert(msg);
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const handleCopy = async (id: string, text: string) => {
    const ok = await copyText(text);
    if (!ok) {
      alert('Copy failed. Please copy manually.');
      return;
    }
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1200);
  };

  const handleEditPackage = (pkg: any) => {
    setEditingPackageId(pkg.id);
    setCreateServiceType(pkg.serviceType);
    setCreateName(pkg.name);
    setCreatePrice(String(pkg.price));
    setCreateCommission(String(pkg.commission));
    setCreateBandwidth(pkg.bandwidth || '');
    setCreateValidity(pkg.validity ? String(pkg.validity) : '');
    setCreateDataLimit(pkg.dataLimit || '');
    setCreateDescription(pkg.description || '');
    setCreateSortOrder(pkg.sortOrder ? String(pkg.sortOrder) : '');
    setCreateServer(pkg.metadata?.server || '');
    setCreateProtocol(pkg.metadata?.protocol || '');
    setEditingStatus(pkg.status);
    setCreateError('');
    setShowCreate(true);
  };

  const handleCreatePackage = async () => {
    setCreateError('');
    setCreateSaving(true);
    try {
      const token = getToken();
      const price = Number(createPrice);
      const commission = createCommission.trim() ? Number(createCommission) : 0;
      const validity = createValidity.trim() ? Number(createValidity) : undefined;
      const sortOrder = createSortOrder.trim() ? Number(createSortOrder) : 0;

      const metadata: Record<string, any> = {};
      if (createServer.trim()) metadata.server = createServer.trim();
      if (createProtocol.trim()) metadata.protocol = createProtocol.trim();

      const body: any = {
        serviceType: createServiceType,
        name: createName.trim(),
        description: createDescription.trim() || undefined,
        price,
        commission,
        validity,
        bandwidth: createBandwidth.trim() || undefined,
        dataLimit: createDataLimit.trim() || undefined,
        sortOrder,
        metadata: Object.keys(metadata).length ? metadata : undefined,
      };

      if (createServiceType === 'SET_TOP_BOX') {
        // Use STB endpoint
        if (editingPackageId) {
           await api(`/services/stb/admin/packages/${editingPackageId}`, { 
             method: 'PUT', 
             token: token!, 
             body: {
               name: createName.trim(),
               price,
               validityDays: validity || 30,
               status: editingStatus
             } 
           });
        } else {
           // Create STB
           await api('/services/stb/admin/packages', { 
             method: 'POST', 
             token: token!, 
             body: {
               name: createName.trim(),
               price,
               validityDays: validity || 30 // Default if missing
             } 
           });
        }
      } else {
        // Existing logic for other services
        if (editingPackageId) {
          body.status = editingStatus;
          await api(`/services/admin/packages/${editingPackageId}`, { method: 'PUT', token: token!, body });
        } else {
          await api('/services/admin/packages', { method: 'POST', token: token!, body });
        }
      }

      setShowCreate(false);
      setEditingPackageId(null);
      setCreateName('');
      setCreatePrice('');
      setCreateCommission('');
      setCreateBandwidth('');
      setCreateValidity('');
      setCreateDataLimit('');
      setCreateDescription('');
      setCreateSortOrder('');
      setCreateServer('');
      setCreateProtocol('');
      setEditingStatus('ACTIVE');
      setPackagesPage(1);
      fetchPackages(1);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to save package');
    } finally {
      setCreateSaving(false);
    }
  };

  const handleToggleStatus = async (pkg: any) => {
    const newStatus = pkg.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const ok = window.confirm(`Are you sure you want to change status to ${newStatus}?`);
    if (!ok) return;

    try {
      const token = getToken();
      if (pkg.serviceType === 'SET_TOP_BOX') {
        await api(`/services/stb/admin/packages/${pkg.id}/status`, {
          method: 'PUT',
          token: token!,
          body: { status: newStatus }
        });
      } else {
        await api(`/services/admin/packages/${pkg.id}`, {
          method: 'PUT',
          token: token!,
          body: { status: newStatus }
        });
      }
      fetchPackages();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    EXECUTING: 'bg-blue-100 text-blue-800',
    FAILED: 'bg-red-100 text-red-800',
    COMPLETED: 'bg-green-100 text-green-800',
    REFUNDED: 'bg-purple-100 text-purple-800',
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">
          {tab === 'pending' ? 'Pending Services' : 'Service Packages'}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`px-3 py-2 rounded-lg text-sm border ${tab === 'pending' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700'}`}
            onClick={() => setTab('pending')}
          >
            Pending
          </button>
          <button
            type="button"
            className={`px-3 py-2 rounded-lg text-sm border ${tab === 'packages' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700'}`}
            onClick={() => setTab('packages')}
          >
            Packages
          </button>
          <button
            type="button"
            className={`px-3 py-2 rounded-lg text-sm border ${tab === 'hotspot' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700'}`}
            onClick={() => setTab('hotspot')}
          >
            Hotspot Cards
          </button>
        </div>
      </div>

      {tab === 'hotspot' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border p-4">
             <h3 className="text-lg font-bold mb-4">Add Hotspot Cards</h3>
             <div className="space-y-4">
               <div>
                 <label className="block text-sm font-medium mb-1">Select Package</label>
                 <select 
                   className="w-full px-3 py-2 border rounded-lg"
                   value={selectedHotspotPkg}
                   onChange={(e) => setSelectedHotspotPkg(e.target.value)}
                 >
                   <option value="">Select Package</option>
                   {hotspotStats.map((p: any) => (
                     <option key={p.packageId} value={p.packageId}>{p.packageName}</option>
                   ))}
                 </select>
               </div>
               <div>
                 <label className="block text-sm font-medium mb-1">Voucher Codes (One per line)</label>
                 <textarea
                   className="w-full px-3 py-2 border rounded-lg h-32 font-mono text-sm"
                   placeholder="CODE123&#10;CODE456&#10;CODE789"
                   value={hotspotCodes}
                   onChange={(e) => setHotspotCodes(e.target.value)}
                 />
               </div>
               <button
                 className="bg-primary-600 text-white px-4 py-2 rounded-lg w-full disabled:opacity-50"
                 disabled={!selectedHotspotPkg || !hotspotCodes.trim() || addingCards}
                 onClick={handleAddCards}
               >
                 {addingCards ? 'Adding...' : 'Add Cards'}
               </button>
             </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <h3 className="text-lg font-bold p-4 border-b bg-gray-50">Card Statistics</h3>
            <table className="w-full">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Package</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right text-green-600">Available</th>
                  <th className="px-4 py-3 text-right text-blue-600">Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {hotspotLoading ? (
                  <tr><td colSpan={4} className="text-center py-4">Loading...</td></tr>
                ) : hotspotStats.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-4 text-gray-400">No hotspot packages found</td></tr>
                ) : (
                  hotspotStats.map((s: any) => (
                    <tr key={s.packageId}>
                      <td className="px-4 py-3 font-medium">{s.packageName}</td>
                      <td className="px-4 py-3 text-right">{s.total}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">{s.available}</td>
                      <td className="px-4 py-3 text-right text-blue-600">{s.used}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                <h3 className="text-lg font-bold">Used Cards Management</h3>
                <div className="flex gap-2">
                    <button 
                        onClick={() => { setShowUsedCards(!showUsedCards); if(!showUsedCards) fetchUsedCards(selectedHotspotPkg); }}
                        className="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                    >
                        {showUsedCards ? 'Hide Used Cards' : 'Show Used Cards'}
                    </button>
                    {showUsedCards && (
                        <button 
                            onClick={handleExportCards}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                            Export CSV
                        </button>
                    )}
                </div>
            </div>
            
            {showUsedCards && (
                <div className="overflow-x-auto max-h-96">
                    <table className="w-full">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-left">Package</th>
                                <th className="px-4 py-2 text-left">Code</th>
                                <th className="px-4 py-2 text-left">Used By</th>
                                <th className="px-4 py-2 text-left">Used At</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {usedCards.length === 0 ? (
                                <tr><td colSpan={4} className="text-center py-4 text-gray-400">No used cards found</td></tr>
                            ) : (
                                usedCards.map((c: any) => (
                                    <tr key={c.id}>
                                        <td className="px-4 py-2 text-sm">{c.package.name}</td>
                                        <td className="px-4 py-2 text-sm font-mono">{c.code}</td>
                                        <td className="px-4 py-2 text-sm text-gray-500">{c.usedBy || '-'}</td>
                                        <td className="px-4 py-2 text-sm text-gray-500">{new Date(c.updatedAt).toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                <h3 className="text-lg font-bold">Available Cards Management</h3>
                <div className="flex gap-2">
                    <button 
                        onClick={() => { setShowAvailableCards(!showAvailableCards); if(!showAvailableCards) fetchAvailableCards(selectedHotspotPkg); }}
                        className="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                    >
                        {showAvailableCards ? 'Hide Available Cards' : 'Show Available Cards'}
                    </button>
                    {showAvailableCards && (
                        <button 
                            onClick={() => setPasswordModal({ isOpen: true, action: 'delete-all', packageId: selectedHotspotPkg })}
                            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                        >
                            Delete All
                        </button>
                    )}
                </div>
            </div>
            
            {showAvailableCards && (
                <div className="overflow-x-auto max-h-96">
                    <table className="w-full">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-left">Package</th>
                                <th className="px-4 py-2 text-left">Code</th>
                                <th className="px-4 py-2 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {availableCards.length === 0 ? (
                                <tr><td colSpan={3} className="text-center py-4 text-gray-400">No available cards found</td></tr>
                            ) : (
                                availableCards.map((c: any) => (
                                    <tr key={c.id}>
                                        <td className="px-4 py-2 text-sm">{c.package.name}</td>
                                        <td className="px-4 py-2 text-sm font-mono">{c.code}</td>
                                        <td className="px-4 py-2 text-right space-x-2">
                                            <button 
                                                onClick={() => { setEditCardCode(c.code); setPasswordModal({ isOpen: true, action: 'edit', cardId: c.id, currentCode: c.code }); }}
                                                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                onClick={() => setPasswordModal({ isOpen: true, action: 'delete', cardId: c.id })}
                                                className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
          </div>
        </div>
      )}

      {/* Password Confirmation Modal */}
      {passwordModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">
                {passwordModal.action === 'edit' ? 'Edit Card' : passwordModal.action === 'delete' ? 'Delete Card' : 'Delete All Cards'}
            </h3>
            
            {passwordModal.action === 'edit' && (
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Card Code</label>
                    <input 
                        type="text" 
                        className="w-full border rounded-lg px-3 py-2"
                        value={editCardCode}
                        onChange={(e) => setEditCardCode(e.target.value)}
                    />
                </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Admin Password</label>
              <input 
                type="password" 
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Enter your password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setPasswordModal({ isOpen: false, action: null })} 
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={handlePasswordAction} 
                disabled={passwordLoading || !adminPassword || (passwordModal.action === 'edit' && !editCardCode)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {passwordLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'packages' && (
        <>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <select
                value={packagesServiceType}
                onChange={(e) => {
                  setPackagesServiceType(e.target.value);
                  setPackagesPage(1);
                }}
                className="px-3 py-2 rounded-lg border bg-white text-sm"
              >
                <option value="">All types</option>
                <option value="HOME_INTERNET">HOME_INTERNET</option>
                <option value="HOTSPOT_WIFI">HOTSPOT_WIFI</option>
                <option value="MOBILE_RECHARGE">MOBILE_RECHARGE</option>
                <option value="ELECTRICITY_BILL">ELECTRICITY_BILL</option>
                <option value="SET_TOP_BOX">SET_TOP_BOX</option>
              </select>
              <button
                type="button"
                className="px-3 py-2 rounded-lg border bg-white text-sm hover:bg-gray-50"
                onClick={() => fetchPackages()}
                disabled={packagesLoading}
              >
                Refresh
              </button>
            </div>
            <button
              type="button"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
              onClick={() => {
                setCreateError('');
                setShowCreate(true);
              }}
            >
              + Add Package
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Server</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Protocol</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Speed</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {packagesLoading ? (
                    <tr><td colSpan={9} className="text-center py-8 text-gray-400">Loading...</td></tr>
                  ) : packages.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-8 text-gray-400">No packages</td></tr>
                  ) : (
                    packages.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs font-medium">{p.serviceType}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-gray-900">{p.name}</div>
                          {p.description && <div className="text-xs text-gray-500 max-w-md truncate">{p.description}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700">{p.metadata?.server ? String(p.metadata.server) : '-'}</td>
                        <td className="px-4 py-3 text-xs text-gray-700">{p.metadata?.protocol ? String(p.metadata.protocol) : '-'}</td>
                        <td className="px-4 py-3 text-xs text-gray-700">{p.bandwidth || '-'}</td>
                        <td className="px-4 py-3 text-xs text-gray-700">{p.validity ? `${p.validity} days` : '-'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-green-700">৳{Number(p.price || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className={`px-2 py-1 rounded ${p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : p.status === 'INACTIVE' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs flex gap-2">
                          <button
                            onClick={() => handleEditPackage(p)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleToggleStatus(p)}
                            className={p.status === 'ACTIVE' ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}
                          >
                            {p.status === 'ACTIVE' ? '🔴 Disable' : '🟢 Enable'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {packagesMeta && (
            <div className="flex justify-between mt-4">
              <button
                disabled={!packagesMeta.hasPrev}
                onClick={() => setPackagesPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 text-sm bg-gray-100 rounded-xl disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="text-xs text-gray-400 self-center">
                {packagesPage}/{packagesMeta.totalPages}
              </span>
              <button
                disabled={!packagesMeta.hasNext}
                onClick={() => setPackagesPage((p) => p + 1)}
                className="px-4 py-2 text-sm bg-gray-100 rounded-xl disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          )}

          {showCreate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-2xl shadow-xl border w-full max-w-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-lg font-semibold">{editingPackageId ? 'Edit Package' : 'Add Package'}</div>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-lg border bg-white"
                    onClick={() => setShowCreate(false)}
                    disabled={createSaving}
                  >
                    Close
                  </button>
                </div>

                {createError && (
                  <div className="mb-3 bg-red-50 text-red-700 p-3 rounded-xl text-sm">
                    {createError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Service Type</label>
                    <select
                      value={createServiceType}
                      onChange={(e) => setCreateServiceType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
                    >
                      <option value="HOME_INTERNET">HOME_INTERNET</option>
                      <option value="HOTSPOT_WIFI">HOTSPOT_WIFI</option>
                      <option value="MOBILE_RECHARGE">MOBILE_RECHARGE</option>
                      <option value="ELECTRICITY_BILL">ELECTRICITY_BILL</option>
                      <option value="SET_TOP_BOX">SET_TOP_BOX</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
                    <input
                      value={createSortOrder}
                      onChange={(e) => setCreateSortOrder(e.target.value)}
                      type="number"
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      placeholder="0"
                      min={0}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                    <input
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      placeholder="Package name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Price</label>
                    <input
                      value={createPrice}
                      onChange={(e) => setCreatePrice(e.target.value)}
                      type="number"
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      placeholder="0"
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Commission</label>
                    <input
                      value={createCommission}
                      onChange={(e) => setCreateCommission(e.target.value)}
                      type="number"
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      placeholder="0"
                      min={0}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Speed / Bandwidth</label>
                    <input
                      value={createBandwidth}
                      onChange={(e) => setCreateBandwidth(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      placeholder="e.g. 21Mbps"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Validity (days)</label>
                    <input
                      value={createValidity}
                      onChange={(e) => setCreateValidity(e.target.value)}
                      type="number"
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      placeholder="e.g. 30"
                      min={1}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Data Limit</label>
                    <input
                      value={createDataLimit}
                      onChange={(e) => setCreateDataLimit(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      placeholder="e.g. 15GB"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Protocol</label>
                    <input
                      value={createProtocol}
                      onChange={(e) => setCreateProtocol(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      placeholder="e.g. pppoe"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Server</label>
                    <input
                      value={createServer}
                      onChange={(e) => setCreateServer(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      placeholder="e.g. MAX-SPEED-NAT-01"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                    <textarea
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      rows={3}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg border bg-white text-sm"
                    onClick={() => setShowCreate(false)}
                    disabled={createSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm disabled:opacity-50"
                    onClick={handleCreatePackage}
                    disabled={createSaving || !createName.trim() || !createPrice.trim()}
                  >
                    {createSaving ? 'Saving...' : (editingPackageId ? 'Update' : 'Create')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'pending' && (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="text-sm font-semibold mb-2">Release Home Connection Owner</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={releaseConnectionId}
                onChange={(e) => setReleaseConnectionId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border text-sm"
                placeholder="Connection ID (e.g. 38030)"
              />
              <button
                type="button"
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                disabled={!releaseConnectionId.trim() || actionLoading === `release:${releaseConnectionId.trim()}`}
                onClick={() => handleReleaseOwner(releaseConnectionId.trim())}
              >
                {actionLoading === `release:${releaseConnectionId.trim()}` ? 'Releasing...' : 'Release'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="text-sm font-semibold mb-2">Release STB Owner</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={releaseStbNumber}
                onChange={(e) => setReleaseStbNumber(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border text-sm"
                placeholder="STB Number"
              />
              <button
                type="button"
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                disabled={!releaseStbNumber.trim() || actionLoading === `release:${releaseStbNumber.trim()}`}
                onClick={() => handleReleaseStbOwner(releaseStbNumber.trim())}
              >
                {actionLoading === `release:${releaseStbNumber.trim()}` ? 'Releasing...' : 'Release'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Package</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pendingLoading ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : pending.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">No pending services</td></tr>
              ) : (
                pending.map((svc) => (
                  (() => {
                    const payload = svc.requestPayload || {};
                    const isRecharge = svc.serviceType === 'MOBILE_RECHARGE';
                    const isElectricity = svc.serviceType === 'ELECTRICITY_BILL';
                    const isHome = svc.serviceType === 'HOME_INTERNET';
                    const isHotspot = svc.serviceType === 'HOTSPOT_WIFI';
                    const isStb = svc.serviceType === 'SET_TOP_BOX';

                    const mobileNumber = isRecharge ? (payload.mobileNumber || '-') : '-';
                    const operator = isRecharge ? (payload.operator || '-') : '-';
                    const rechargeType = isRecharge ? (payload.rechargeType || '-') : '-';
                    const rechargeAmount = isRecharge ? (payload.amount ?? '-') : '-';

                    const meterNumber = isElectricity ? (payload.meterNumber || '-') : '-';
                    const provider = isElectricity ? (payload.provider || '-') : '-';
                    const billMonth = isElectricity ? (payload.billMonth || '-') : '-';
                    const billAmount = isElectricity ? (payload.amount ?? '-') : '-';

                    const connectionId = isHome ? (payload.connectionId || '-') : '-';
                    const subscriberName = isHome ? (payload.subscriberName || '-') : '-';

                    const deviceMac = isHotspot ? (payload.deviceMac || '-') : '-';
                    const zoneId = isHotspot ? (payload.zoneId || '-') : '-';
                    const stbNumber = isStb ? (payload.stbNumber || '-') : '-';

                    const requester = svc.requester;

                    return (
                  <tr key={svc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{svc.serviceType}</td>
                    <td className="px-4 py-3 text-sm">{svc.packageName}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {requester ? (
                        <div className="space-y-0.5">
                          <div className="font-medium text-gray-900">{requester.fullName}</div>
                          <div className="text-[11px] text-gray-600">{requester.mobile}{requester.email ? ` • ${requester.email}` : ''}</div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-500">{svc.userId}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {isRecharge ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="space-y-0.5">
                            <div className="font-mono">{String(mobileNumber)}</div>
                            <div className="text-[11px] text-gray-600">{String(operator)} • {String(rechargeType)} • ৳{String(rechargeAmount)}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(svc.id, String(mobileNumber))}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-2 py-1 rounded text-[11px]"
                          >
                            {copiedId === svc.id ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      ) : isElectricity ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="space-y-0.5">
                            <div className="font-mono">{String(meterNumber)}</div>
                            <div className="text-[11px] text-gray-600">{String(provider)} • {String(billMonth)} • ৳{String(billAmount)}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(svc.id, String(meterNumber))}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-2 py-1 rounded text-[11px]"
                          >
                            {copiedId === svc.id ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      ) : isHome ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="space-y-0.5">
                            <div className="font-mono">{String(connectionId)}</div>
                            <div className="text-[11px] text-gray-600">{String(subscriberName)}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(svc.id, String(connectionId))}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-2 py-1 rounded text-[11px]"
                          >
                            {copiedId === svc.id ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      ) : isStb ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="space-y-0.5">
                            <div className="font-mono">{String(stbNumber)}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(svc.id, String(stbNumber))}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-2 py-1 rounded text-[11px]"
                          >
                            {copiedId === svc.id ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      ) : isHotspot ? (
                        <div className="space-y-0.5">
                          <div className="font-mono">{String(deviceMac)}</div>
                          <div className="text-[11px] text-gray-600">{String(zoneId)}</div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-1 rounded ${statusColors[svc.status] || ''}`}>{svc.status}</span></td>
                    <td className="px-4 py-3 text-xs text-red-500 max-w-xs truncate">{svc.errorMessage || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(svc.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {isHome && connectionId !== '-' && (
                          <button
                            onClick={() => handleReleaseOwner(String(connectionId))}
                            disabled={actionLoading === `release:${String(connectionId)}`}
                            className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 disabled:opacity-50"
                          >
                            Release Owner
                          </button>
                        )}
                        {isStb && stbNumber !== '-' && (
                          <button
                            onClick={() => handleReleaseStbOwner(String(stbNumber))}
                            disabled={actionLoading === `release:${String(stbNumber)}`}
                            className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 disabled:opacity-50"
                          >
                            Release Owner
                          </button>
                        )}
                        <button
                          onClick={() => handleManualExecute(svc.id)}
                          disabled={actionLoading === svc.id || svc.status === 'COMPLETED'}
                          className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600 disabled:opacity-50"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() => handleManualRefund(svc.id)}
                          disabled={actionLoading === svc.id || svc.status === 'REFUNDED'}
                          className="bg-orange-500 text-white px-2 py-1 rounded text-xs hover:bg-orange-600 disabled:opacity-50"
                        >
                          Refund
                        </button>
                      </div>
                    </td>
                  </tr>
                    );
                  })()
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
