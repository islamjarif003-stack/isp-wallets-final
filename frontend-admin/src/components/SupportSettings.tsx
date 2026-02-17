
'use client';

import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';

interface SupportSettingsData {
  support_whatsapp_number?: string;
  support_telegram_link?: string;
  support_message_template?: string;
}

export default function SupportSettings() {
  const [settings, setSettings] = useState<SupportSettingsData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const token = getToken();
      // This endpoint needs to be created on the backend.
      // For now, we'll use the general settings endpoint and filter.
      const res = await api('/admin/settings', { token: token! });
      const supportSettings = res.data.reduce((acc: any, setting: any) => {
        if (['support_whatsapp_number', 'support_telegram_link', 'support_message_template'].includes(setting.key)) {
          acc[setting.key] = setting.value;
        }
        return acc;
      }, {});
      setSettings(supportSettings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = getToken();
      const payload = {
        support_whatsapp_number: settings.support_whatsapp_number || '',
        support_telegram_link: settings.support_telegram_link || '',
        support_message_template: settings.support_message_template || '',
      };
      await api('/admin/settings/support-channels', {
        method: 'PUT',
        token: token!,
        body: payload,
      });
      alert('Settings saved successfully!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-6">
      <div className="px-4 py-3 bg-gray-50 border-b font-semibold">Support Channels</div>
      {loading ? (
        <div className="p-4 text-center">Loading...</div>
      ) : (
        <form onSubmit={handleSave}>
          <div className="p-4 space-y-4">
            <div>
              <label htmlFor="support_whatsapp_number" className="block text-sm font-medium text-gray-700">
                WhatsApp Number
              </label>
              <input
                type="text"
                id="support_whatsapp_number"
                name="support_whatsapp_number"
                value={settings.support_whatsapp_number || ''}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="support_telegram_link" className="block text-sm font-medium text-gray-700">
                Telegram Link
              </label>
              <input
                type="text"
                id="support_telegram_link"
                name="support_telegram_link"
                value={settings.support_telegram_link || ''}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="support_message_template" className="block text-sm font-medium text-gray-700">
                Support Message Template
              </label>
              <textarea
                id="support_message_template"
                name="support_message_template"
                value={settings.support_message_template || ''}
                onChange={handleChange}
                rows={3}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              ></textarea>
              <p className="mt-2 text-xs text-gray-500">
                Use {'{{userId}}'} as a placeholder for the user's ID.
              </p>
            </div>
          </div>
          <div className="px-4 py-3 bg-gray-50 text-right">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
