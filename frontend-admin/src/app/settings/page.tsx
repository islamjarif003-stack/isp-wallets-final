'use client';

import SupportSettings from '@/components/SupportSettings';

import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';

interface Setting {
  id: string;
  key: string;
  value: string;
  type: string;
  label: string | null;
  group: string | null;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const token = getToken();
      const res = await api('/admin/settings', { token: token! });
      setSettings(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleEdit = (setting: Setting) => {
    setEditingKey(setting.key);
    setEditValue(setting.value);
  };

  const handleSave = async (key: string) => {
    setSaving(true);
    try {
      const token = getToken();
      await api('/admin/settings', { method: 'PUT', token: token!, body: { key, value: editValue } });
      setEditingKey(null);
      fetchSettings();
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleToggle = async (setting: Setting) => {
    if (togglingKey) return;
    const nextValue = String(setting.value).toLowerCase() === 'true' ? 'false' : 'true';
    setTogglingKey(setting.key);
    try {
      const token = getToken();
      await api('/admin/settings', { method: 'PUT', token: token!, body: { key: setting.key, value: nextValue } });
      await fetchSettings();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTogglingKey(null);
    }
  };

  const isSensitiveKey = (key: string) => {
    const k = key.toLowerCase();
    return k.includes('api_key') || k.includes('secret') || k.includes('token');
  };

  const formatValueForDisplay = (setting: Setting) => {
    if (setting.type === 'boolean') {
      return String(setting.value).toLowerCase() === 'true' ? 'true' : 'false';
    }
    if (isSensitiveKey(setting.key)) {
      const raw = setting.value || '';
      if (raw.length <= 4) return '••••';
      return `••••••••${raw.slice(-4)}`;
    }
    return setting.value;
  };

  const grouped = settings.reduce((acc, s) => {
    const group = s.group || 'other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(s);
    return acc;
  }, {} as Record<string, Setting[]>);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">System Settings</h1>
      <SupportSettings />

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : (
        Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="bg-white rounded-xl shadow-sm border overflow-hidden mb-6">
            <div className="px-4 py-3 bg-gray-50 border-b font-semibold capitalize">{group}</div>
            <div className="divide-y">
              {items.map((setting) => (
                <div key={setting.key} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{setting.label || setting.key}</div>
                    <div className="text-xs text-gray-400 font-mono">{setting.key}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {editingKey === setting.key ? (
                      <>
                        <input
                          type={isSensitiveKey(setting.key) ? 'password' : 'text'}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="px-3 py-1 border rounded text-sm w-40 focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                        <button onClick={() => handleSave(setting.key)} disabled={saving} className="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600 disabled:opacity-50">Save</button>
                        <button onClick={() => setEditingKey(null)} className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-xs hover:bg-gray-400">Cancel</button>
                      </>
                    ) : (
                      <>
                        {setting.type === 'boolean' ? (
                          <button
                            type="button"
                            onClick={() => handleToggle(setting)}
                            disabled={togglingKey === setting.key}
                            className={`px-3 py-1 rounded text-xs font-semibold border ${
                              String(setting.value).toLowerCase() === 'true'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-gray-50 text-gray-700 border-gray-200'
                            } disabled:opacity-50`}
                          >
                            {String(setting.value).toLowerCase() === 'true' ? 'Enabled' : 'Disabled'}
                          </button>
                        ) : (
                          <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded">{formatValueForDisplay(setting)}</span>
                        )}
                        <button onClick={() => handleEdit(setting)} className="text-primary-600 hover:text-primary-800 text-xs font-medium">Edit</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
