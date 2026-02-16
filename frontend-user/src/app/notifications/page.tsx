'use client';

import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const token = getToken()!;
      const res = await api('/notifications', { token, params: { limit: '50' } });
      setNotifications(res.data);
      setUnreadCount(res.unreadCount);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markAllRead = async () => {
    try {
      const token = getToken()!;
      await api('/notifications/read-all', { method: 'PATCH', token });
      fetchNotifications();
    } catch (err) { console.error(err); }
  };

  const markRead = async (id: string) => {
    try {
      const token = getToken()!;
      await api(`/notifications/${id}/read`, { method: 'PATCH', token });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) { console.error(err); }
  };

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Notifications</h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-brand-600 text-xs font-medium">Mark All Read</button>
        )}
      </div>

      {unreadCount > 0 && (
        <div className="bg-brand-50 text-brand-700 text-xs font-medium p-2 rounded-lg mb-3 text-center">
          {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No notifications yet</div>
        ) : (
          notifications.map((n: any) => (
            <div
              key={n.id}
              onClick={() => !n.isRead && markRead(n.id)}
              className={`card cursor-pointer transition ${n.isRead ? 'opacity-60' : 'border-l-4 border-l-brand-500'}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold">{n.title}</h3>
                  <p className="text-xs text-gray-600 mt-1">{n.message}</p>
                </div>
                {!n.isRead && <span className="w-2 h-2 bg-brand-500 rounded-full mt-1 flex-shrink-0"></span>}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}