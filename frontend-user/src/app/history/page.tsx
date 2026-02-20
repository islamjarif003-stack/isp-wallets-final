'use client';

import { useEffect, useState, useRef } from 'react';
import { api, getToken } from '@/lib/api';
import { copyText } from '@/lib/copy';

// Custom hook for polling
function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef<() => void>();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    function tick() {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

export default function HistoryPage() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string>('');
  const [isPolling, setIsPolling] = useState(false);

  async function fetchHistory() {
    // Don't set loading to true if we are just polling
    if (!isPolling) {
      setLoading(true);
    }
    setError(null);
    try {
      const token = getToken();
      if (!token) {
        setServices([]);
        setMeta(null);
        setError('Please log in to view your service history.');
        return;
      }
      const res = await api('/services/history', { token, params: { page: String(page), limit: '15' } });
      setServices(res.data);
      setMeta(res.meta);

      // Check if we need to continue polling
      const shouldPoll = res.data.some((svc: any) => svc.status === 'PENDING' || svc.status === 'EXECUTING');
      setIsPolling(shouldPoll);

    } catch (err) {
      setServices([]);
      setMeta(null);
      setError(err instanceof Error ? err.message : 'Failed to load service history');
      setIsPolling(false); // Stop polling on error
    }
    finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, [page]);

  // Start or stop polling based on the isPolling state
  useInterval(
    () => {
      fetchHistory();
    },
    isPolling ? 3000 : null // Poll every 3 seconds if isPolling is true
  );


  const statusColors: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    REFUNDED: 'bg-purple-100 text-purple-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    EXECUTING: 'bg-blue-100 text-blue-700',
    PROCESSING: 'bg-gray-100 text-gray-700',
  };

  const typeIcons: Record<string, string> = {
    HOME_INTERNET: '🌐',
    HOTSPOT_WIFI: '📶',
    MOBILE_RECHARGE: '📱',
    ELECTRICITY_BILL: '💡',
  };

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold mb-4">Service History</h1>

      {copied && (
        <div className="mb-3 bg-green-50 text-green-700 p-2 rounded-xl text-sm">
          {copied}
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-600">{error}</div>
        ) : services.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No service history yet</div>
        ) : (
          services.map((svc: any) => (
            <div key={svc.id} className="card">
              <button
                type="button"
                className="w-full flex items-center justify-between"
                onClick={() => setExpandedId(expandedId === svc.id ? null : svc.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                    {typeIcons[svc.serviceType] || '📦'}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-medium truncate">
                      {svc.packageName && svc.packageName !== 'N/A'
                        ? svc.packageName
                        : svc.serviceType === 'MOBILE_RECHARGE'
                          ? 'Mobile Recharge'
                          : svc.serviceType === 'ELECTRICITY_BILL'
                            ? 'Electricity Bill'
                            : svc.serviceType.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[10px] text-gray-400">{svc.serviceType.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] text-gray-400">{new Date(svc.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${statusColors[svc.status] || ''}`}>
                    {svc.status}
                  </span>
                  <p className="text-sm font-bold mt-1">
                    ৳{Number((svc.amount && svc.amount > 0) ? svc.amount : (svc.packagePrice || 0)).toLocaleString()}
                  </p>
                </div>
              </button>

              {expandedId === svc.id && (
                <div className="mt-3 border-t pt-3 space-y-2">
                  {svc.status === 'REFUNDED' && svc.errorMessage && (
                    <div className="bg-purple-50 text-purple-700 p-2 rounded-lg text-xs mb-2">
                        <strong>Reason:</strong> {svc.errorMessage}
                    </div>
                  )}
                  {svc.status === 'FAILED' && svc.errorMessage && (
                    <div className="bg-red-50 text-red-700 p-2 rounded-lg text-xs mb-2">
                        <strong>Error:</strong> {svc.errorMessage}
                    </div>
                  )}

                  {svc.serviceType === 'ELECTRICITY_BILL' && (
                    <>
                      {svc.requestPayload?.meterNumber && (
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-gray-700">
                            Meter: <span className="font-mono">{String(svc.requestPayload.meterNumber)}</span>
                          </div>
                          <button
                            type="button"
                            className="px-3 py-1 rounded-lg bg-white border text-xs font-medium hover:bg-gray-100"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const ok = await copyText(String(svc.requestPayload.meterNumber));
                              setCopied(ok ? 'Meter number copied' : 'Copy failed');
                              setTimeout(() => setCopied(''), 1500);
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      )}
                      {svc.requestPayload?.provider && (
                        <div className="text-xs text-gray-700">Provider: {String(svc.requestPayload.provider)}</div>
                      )}
                      {svc.requestPayload?.billMonth && (
                        <div className="text-xs text-gray-700">Bill month: {String(svc.requestPayload.billMonth)}</div>
                      )}
                    </>
                  )}

                  {svc.serviceType === 'MOBILE_RECHARGE' && (
                    <>
                      {svc.requestPayload?.mobileNumber && (
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-gray-700">
                            Mobile: <span className="font-mono">{String(svc.requestPayload.mobileNumber)}</span>
                          </div>
                          <button
                            type="button"
                            className="px-3 py-1 rounded-lg bg-white border text-xs font-medium hover:bg-gray-100"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const ok = await copyText(String(svc.requestPayload.mobileNumber));
                              setCopied(ok ? 'Mobile number copied' : 'Copy failed');
                              setTimeout(() => setCopied(''), 1500);
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      )}
                      {svc.requestPayload?.operator && (
                        <div className="text-xs text-gray-700">Operator: {String(svc.requestPayload.operator)}</div>
                      )}
                      {svc.requestPayload?.rechargeType && (
                        <div className="text-xs text-gray-700">Type: {String(svc.requestPayload.rechargeType)}</div>
                      )}
                    </>
                  )}

                  {!!svc.walletTransactionId && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-gray-700 truncate">
                        TX: <span className="font-mono">{String(svc.walletTransactionId)}</span>
                      </div>
                      <button
                        type="button"
                        className="px-3 py-1 rounded-lg bg-white border text-xs font-medium hover:bg-gray-100"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await copyText(String(svc.walletTransactionId));
                          setCopied(ok ? 'Transaction ID copied' : 'Copy failed');
                          setTimeout(() => setCopied(''), 1500);
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
