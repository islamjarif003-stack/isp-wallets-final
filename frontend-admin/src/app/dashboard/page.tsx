'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getToken } from '@/lib/api';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalWalletBalance: number;
  totalRevenue: number;
  totalCommission: number;
  pendingBalanceRequests: number;
  pendingServices: number;
  todayTransactions: number;
  todayRevenue: number;
  successTransactions: number;
  failedTransactions: number;
  refundedTransactions: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string>('');
  const [notificationState, setNotificationState] = useState<'unsupported' | 'default' | 'granted' | 'denied'>('default');
  const [notificationError, setNotificationError] = useState<string>('');
  const [voiceState, setVoiceState] = useState<'unsupported' | 'disabled' | 'enabled'>('disabled');
  const [voiceLastError, setVoiceLastError] = useState<string>('');
  const [voiceLastSpokenAt, setVoiceLastSpokenAt] = useState<number>(0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>('');
  const [alertLang, setAlertLang] = useState<'bn' | 'en'>('bn');
  const [alertTemplate, setAlertTemplate] = useState<string>('বস, নতুন রিকুয়েস্ট এসেছে।');
  const lastPendingRef = useRef<{ balance: number; services: number } | null>(null);
  const lastSpokenAtRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const scoreVoice = (v: SpeechSynthesisVoice) => {
    const name = (v.name || '').toLowerCase();
    const lang = (v.lang || '').toLowerCase();
    let s = 0;
    if (lang.startsWith('bn')) s += 25;
    if (lang.startsWith('en')) s += 20;
    if (name.includes('natural') || name.includes('neural')) s += 30;
    if (name.includes('microsoft')) s += 15;
    if (name.includes('google')) s += 12;
    if (name.includes('aria') || name.includes('jenny') || name.includes('zira') || name.includes('samantha')) s += 10;
    if (v.localService) s += 3;
    if (v.default) s += 2;
    return s;
  };

  const speakText = useCallback(
    (text: string, opts?: { force?: boolean }) => {
      if (typeof window === 'undefined') return;
      if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
      const enabled = window.localStorage.getItem('admin_voice_alert_enabled') === 'true';
      if (!enabled) return;

      const now = Date.now();
      if (!opts?.force && now - lastSpokenAtRef.current < 5000) return; // Reduced to 5s
      lastSpokenAtRef.current = now;

      try {
        setVoiceLastError('');
        window.speechSynthesis.cancel();
        
        // Fix for Chrome bug where speech stops working after a while
        // We need to pause and resume to "wake up" the engine
        if (window.speechSynthesis.paused) {
             window.speechSynthesis.resume();
        }

        const voices = window.speechSynthesis.getVoices();
        const hasBnVoice = voices.some((v) => (v.lang || '').toLowerCase().startsWith('bn'));

        const textToSpeak =
          alertLang === 'bn' && !hasBnVoice
            ? 'Boss, new request arrived.'
            : text;

        const u = new SpeechSynthesisUtterance(textToSpeak);
        // Keep reference to prevent garbage collection (Chrome bug)
        activeUtteranceRef.current = u;
        
        const voiceUri = window.localStorage.getItem('admin_voice_alert_voice_uri') || selectedVoiceUri;
        const voice = voices.find((v) => v.voiceURI === voiceUri);
        if (voice) {
          u.voice = voice;
          u.lang = voice.lang || (alertLang === 'bn' ? 'bn-BD' : 'en-US');
        } else {
          u.lang = alertLang === 'bn' ? 'bn-BD' : 'en-US';
        }
        u.rate = 0.95;
        u.pitch = 1.05;
        u.volume = 1;
        u.onend = () => {
          setVoiceLastSpokenAt(Date.now());
          activeUtteranceRef.current = null; // Release reference
        };
        u.onerror = (e: any) => {
          setVoiceLastError(String(e?.error || e?.name || 'Voice blocked by browser'));
          activeUtteranceRef.current = null;
        };
        window.speechSynthesis.speak(u);
      } catch {}
    },
    [alertLang, selectedVoiceUri]
  );

  useEffect(() => {
    const updateNotificationState = () => {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        setNotificationState('unsupported');
        return;
      }
      setNotificationState(Notification.permission as any);
    };

    const updateVoiceState = () => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
        setVoiceState('unsupported');
        return;
      }
      // Force enabled by default if not set
      let raw = window.localStorage.getItem('admin_voice_alert_enabled');
      if (raw === null) {
          raw = 'true';
          window.localStorage.setItem('admin_voice_alert_enabled', 'true');
      }
      setVoiceState(raw === 'true' ? 'enabled' : 'disabled');
    };

    const updateAlertSettings = () => {
      if (typeof window === 'undefined') return;
      const storedLang = window.localStorage.getItem('admin_new_request_alert_lang');
      const storedTemplate = window.localStorage.getItem('admin_new_request_alert_template');
      if (storedLang === 'en' || storedLang === 'bn') setAlertLang(storedLang);
      if (storedTemplate && storedTemplate.trim()) setAlertTemplate(storedTemplate);
    };

    const loadVoices = () => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;
      setAvailableVoices(voices);

      const stored = window.localStorage.getItem('admin_voice_alert_voice_uri') || '';
      const storedOk = stored && voices.some((v) => v.voiceURI === stored);
      if (storedOk) {
        setSelectedVoiceUri(stored);
        return;
      }

      const best = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
      if (best?.voiceURI) {
        setSelectedVoiceUri(best.voiceURI);
        window.localStorage.setItem('admin_voice_alert_voice_uri', best.voiceURI);
      }
    };

    const renderTemplate = (balanceDelta: number, serviceDelta: number) => {
      const t = (window.localStorage.getItem('admin_new_request_alert_template') || alertTemplate || '').trim();
      const lang = (window.localStorage.getItem('admin_new_request_alert_lang') as any) || alertLang;
      const balanceText = lang === 'bn' ? String(balanceDelta) : String(balanceDelta);
      const serviceText = lang === 'bn' ? String(serviceDelta) : String(serviceDelta);
      return t
        .replace(/\{\{\s*balance\s*\}\}/g, balanceText)
        .replace(/\{\{\s*service\s*\}\}/g, serviceText)
        .replace(/\{\{\s*total\s*\}\}/g, String(Math.max(0, balanceDelta) + Math.max(0, serviceDelta)));
    };

    async function fetchStats(triggeredByPoll: boolean) {
      try {
        const token = getToken();
        const res = await api('/admin/dashboard', { token: token! });
        const next = res.data as DashboardStats;
        setStats(next);

        const prev = lastPendingRef.current;
        if (prev && triggeredByPoll) {
          const balanceDelta = next.pendingBalanceRequests - prev.balance;
          const serviceDelta = next.pendingServices - prev.services;
          if (balanceDelta > 0 || serviceDelta > 0) {
            // Check if voice is enabled specifically before speaking
            const voiceEnabled = window.localStorage.getItem('admin_voice_alert_enabled') === 'true';
            
            const msg = renderTemplate(Math.max(0, balanceDelta), Math.max(0, serviceDelta));
            setNotice(msg);

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('New request', { body: msg });
              } catch {}
            }

            if (voiceEnabled) {
                speakText(msg);
            }
          }
        }

        lastPendingRef.current = { balance: next.pendingBalanceRequests, services: next.pendingServices };
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    updateNotificationState();
    updateVoiceState();
    updateAlertSettings();
    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => loadVoices();
    }
    fetchStats(false);

    intervalRef.current = window.setInterval(() => {
      fetchStats(true);
    }, 15000);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [alertLang, alertTemplate, selectedVoiceUri, speakText]);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>;
  if (error) return <div className="bg-danger-50 text-danger-700 p-4 rounded-lg">{error}</div>;
  if (!stats) return null;

  const canRequestNotification =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    (window.isSecureContext || window.location.hostname === 'localhost');

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: 'bg-blue-500' },
    { label: 'Active Users', value: stats.activeUsers, icon: '✅', color: 'bg-green-500' },
    { label: 'Suspended', value: stats.suspendedUsers, icon: '🚫', color: 'bg-red-500' },
    { label: 'Total Balance', value: `৳${stats.totalWalletBalance.toLocaleString()}`, icon: '💰', color: 'bg-yellow-500' },
    { label: 'Total Revenue', value: `৳${stats.totalRevenue.toLocaleString()}`, icon: '📈', color: 'bg-indigo-500' },
    { label: 'Total Commission', value: `৳${stats.totalCommission.toLocaleString()}`, icon: '💎', color: 'bg-purple-500' },
    { label: 'Pending Balance', value: stats.pendingBalanceRequests, icon: '⏳', color: 'bg-orange-500' },
    { label: 'Pending Services', value: stats.pendingServices, icon: '🔄', color: 'bg-pink-500' },
    { label: 'Today Transactions', value: stats.todayTransactions, icon: '📊', color: 'bg-teal-500' },
    { label: 'Today Revenue', value: `৳${stats.todayRevenue.toLocaleString()}`, icon: '💵', color: 'bg-emerald-500' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {notice && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl flex items-center justify-between gap-3">
          <div className="text-sm font-medium">{notice}</div>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="text-xs font-semibold px-3 py-1 rounded bg-white border hover:bg-gray-50"
          >
            Dismiss
          </button>
        </div>
      )}

      {notificationState !== 'unsupported' && notificationState !== 'granted' && (
        <div className="mb-4 bg-white border rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-gray-700">
            Browser notification enable করলে new request এ alert পাবেন।
            {!canRequestNotification && (
              <div className="mt-2 text-xs text-amber-700">
                Android Chrome এ HTTP (LAN IP) থেকে notification permission কাজ করে না। HTTPS লাগবে।
              </div>
            )}
            {notificationError && (
              <div className="mt-2 text-xs text-red-600">
                Notification error: {notificationError}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={notificationState === 'denied' || !canRequestNotification}
            onClick={async () => {
              if (typeof window === 'undefined' || !('Notification' in window)) return;
              try {
                setNotificationError('');
                const p = await Notification.requestPermission();
                setNotificationState(p as any);
              } catch (e: any) {
                setNotificationError(e instanceof Error ? e.message : String(e));
              }
            }}
            className="text-xs font-semibold px-3 py-2 rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Enable
          </button>
        </div>
      )}

      {voiceState !== 'unsupported' && (
        <div className="mb-4 bg-white border rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-gray-700 flex-1">
            Voice alert enable করলে new request এ আপনার সেট করা কথাই বলবে।
            {availableVoices.length > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                Voice select করলে sound আরও human হবে।
              </div>
            )}
            {voiceLastError && (
              <div className="mt-2 text-xs text-red-600">
                Voice error: {voiceLastError}. Browser block করলে একবার “Test” চাপুন।
              </div>
            )}
            {alertLang === 'bn' && availableVoices.length > 0 && !availableVoices.some((v) => (v.lang || '').toLowerCase().startsWith('bn')) && (
              <div className="mt-2 text-xs text-amber-700">
                এই Chrome/Windows এ বাংলা voice নেই, তাই voice fallback ইংরেজিতে হবে।
              </div>
            )}
            {voiceLastSpokenAt > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                Last voice: {new Date(voiceLastSpokenAt).toLocaleTimeString()}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window === 'undefined') return;
                const next = voiceState !== 'enabled';
                window.localStorage.setItem('admin_voice_alert_enabled', next ? 'true' : 'false');
                setVoiceState(next ? 'enabled' : 'disabled');
                if (next) {
                  const t = (window.localStorage.getItem('admin_new_request_alert_template') || alertTemplate || '').trim() || 'বস, নতুন রিকুয়েস্ট এসেছে।';
                  speakText(t, { force: true });
                }
              }}
              className={`text-xs font-semibold px-3 py-2 rounded border ${
                voiceState === 'enabled'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-gray-50 text-gray-700 border-gray-200'
              }`}
            >
              {voiceState === 'enabled' ? 'Voice: ON' : 'Voice: OFF'}
            </button>

            <select
              value={alertLang}
              onChange={(e) => {
                if (typeof window === 'undefined') return;
                const v = e.target.value === 'en' ? 'en' : 'bn';
                setAlertLang(v);
                window.localStorage.setItem('admin_new_request_alert_lang', v);
              }}
              className="text-xs px-2 py-2 rounded border bg-white"
            >
              <option value="bn">বাংলা</option>
              <option value="en">English</option>
            </select>

            {availableVoices.length > 0 && (
              <select
                value={selectedVoiceUri}
                onChange={(e) => {
                  if (typeof window === 'undefined') return;
                  const v = e.target.value;
                  setSelectedVoiceUri(v);
                  window.localStorage.setItem('admin_voice_alert_voice_uri', v);
                }}
                className="text-xs px-2 py-2 rounded border bg-white max-w-[260px]"
              >
                {availableVoices
                  .slice()
                  .sort((a, b) => scoreVoice(b) - scoreVoice(a))
                  .map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {(v.lang || 'unknown')} - {v.name}
                    </option>
                  ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => {
                if (typeof window === 'undefined') return;
                window.localStorage.setItem('admin_voice_alert_enabled', 'true');
                setVoiceState('enabled');
                try {
                  const t = (window.localStorage.getItem('admin_new_request_alert_template') || alertTemplate || '').trim() || 'বস, নতুন রিকুয়েস্ট এসেছে।';
                  speakText(t, { force: true });
                } catch {}
              }}
              className="text-xs font-semibold px-3 py-2 rounded bg-primary-600 text-white hover:bg-primary-700"
            >
              Test
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 bg-white border rounded-xl p-4">
        <div className="text-sm font-semibold text-gray-900 mb-2">Boss Alert Message</div>
        <div className="text-xs text-gray-600 mb-2">
          আপনি যেটা লিখবেন সেটাই notification/voice এ যাবে। Placeholder: {'{{balance}}'}, {'{{service}}'}, {'{{total}}'}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={alertTemplate}
            onChange={(e) => {
              const v = e.target.value;
              setAlertTemplate(v);
              if (typeof window !== 'undefined') window.localStorage.setItem('admin_new_request_alert_template', v);
            }}
            className="flex-1 px-3 py-2 border rounded text-sm"
            placeholder="উদাহরণ: বস, নতুন রিকুয়েস্ট এসেছে।"
          />
          <button
            type="button"
            onClick={() => {
              const v = 'বস, নতুন রিকুয়েস্ট এসেছে।';
              setAlertTemplate(v);
              if (typeof window !== 'undefined') window.localStorage.setItem('admin_new_request_alert_template', v);
            }}
            className="px-3 py-2 rounded bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">Total Users</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
          <p className="text-xs text-green-600 mt-1">{stats.activeUsers} Active</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">Wallet Balance</p>
          <p className="text-2xl font-bold text-gray-900">৳{stats.totalWalletBalance.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">System Liability</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900">৳{stats.totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-green-600 mt-1">৳{stats.todayRevenue.toLocaleString()} Today</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">Commission</p>
          <p className="text-2xl font-bold text-gray-900">৳{stats.totalCommission.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Total Distributed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <a href="/transactions?status=COMPLETED" className="block">
            <div className="bg-green-50 p-4 rounded-xl shadow-sm border border-green-100 hover:shadow-md transition cursor-pointer">
            <p className="text-sm text-green-600 font-medium">Successful Transactions</p>
            <p className="text-2xl font-bold text-green-700">{stats.successTransactions}</p>
            </div>
        </a>
        <a href="/transactions?status=FAILED" className="block">
            <div className="bg-red-50 p-4 rounded-xl shadow-sm border border-red-100 hover:shadow-md transition cursor-pointer">
            <p className="text-sm text-red-600 font-medium">Failed Transactions</p>
            <p className="text-2xl font-bold text-red-700">{stats.failedTransactions}</p>
            </div>
        </a>
        <a href="/transactions?category=SERVICE_REFUND" className="block">
            <div className="bg-orange-50 p-4 rounded-xl shadow-sm border border-orange-100 hover:shadow-md transition cursor-pointer">
            <p className="text-sm text-orange-600 font-medium">Refunded Transactions</p>
            <p className="text-2xl font-bold text-orange-700">{stats.refundedTransactions}</p>
            </div>
        </a>
      </div>
    </div>
  );
}
