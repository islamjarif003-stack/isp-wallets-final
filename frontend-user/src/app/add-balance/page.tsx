'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { copyText } from '@/lib/copy';

const methods = [
  { value: 'BKASH', label: 'bKash', icon: '💜' },
  { value: 'NAGAD', label: 'Nagad', icon: '🧡' },
  { value: 'ROCKET', label: 'Rocket', icon: '💛' },
  { value: 'BANK_TRANSFER', label: 'Bank', icon: '🏦' },
  { value: 'CASH', label: 'Cash', icon: '💵' },
];

type AddBalanceInstructions = {
  bkashSendMoneyNumber: string | null;
  nagadSendMoneyNumber: string | null;
  rocketSendMoneyNumber: string | null;
};

export default function AddBalancePage() {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BKASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [instructions, setInstructions] = useState<AddBalanceInstructions | null>(null);
  const router = useRouter();
  const submittedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = getToken()!;
        const res = await api('/wallet/add-balance/instructions', { token });
        if (!mounted) return;
        setInstructions(res.data);
      } catch (e: any) {
        if (!mounted) return;
        if (e instanceof ApiError && e.status === 429) {
          setError('Too many requests. Please try again later.');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const sendMoneyNumber = useMemo(() => {
    if (!instructions) return null;
    if (paymentMethod === 'BKASH') return instructions.bkashSendMoneyNumber;
    if (paymentMethod === 'NAGAD') return instructions.nagadSendMoneyNumber;
    if (paymentMethod === 'ROCKET') return instructions.rocketSendMoneyNumber;
    return null;
  }, [instructions, paymentMethod]);

  const trxRequired = paymentMethod === 'BKASH' || paymentMethod === 'NAGAD' || paymentMethod === 'ROCKET';
  const trxLabel = paymentMethod === 'BKASH' ? 'bKash TrxID' : paymentMethod === 'NAGAD' ? 'Nagad TrxID' : paymentMethod === 'ROCKET' ? 'Rocket TrxID' : 'Payment Reference';

  const normalizedTrx = paymentReference.trim();
  const trxValid = !normalizedTrx || /^[A-Za-z0-9_-]{6,64}$/.test(normalizedTrx);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || submittedRef.current) return;
    setError('');
    setLoading(true);
    try {
      if (trxRequired && !normalizedTrx) {
        setError('Transaction ID is required');
        return;
      }
      if (!trxValid) {
        setError('Invalid transaction ID format');
        return;
      }

      submittedRef.current = true;
      const token = getToken()!;
      await api('/wallet/add-balance', {
        method: 'POST',
        token,
        body: { amount: parseFloat(amount), paymentMethod, paymentReference: normalizedTrx || undefined },
      });
      setSuccess('Balance request submitted! Awaiting admin approval.');
      setTimeout(() => router.push('/wallet'), 2000);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 429) {
        setError('Too many requests. Please try again later.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      submittedRef.current = false;
    }
  };

  const quickAmounts = [100, 200, 500, 1000, 2000, 5000];

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold mb-4">Add Balance</h1>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-3 rounded-xl mb-4 text-sm">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Amount (৳)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" className="input-field text-xl font-bold" required min={10} max={100000} />
          <p className="text-xs text-gray-500 mt-2">
            Bonus (if any) is applied only after admin approval.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {quickAmounts.map((a) => (
              <button key={a} type="button" onClick={() => setAmount(String(a))} className="px-3 py-1.5 bg-gray-100 hover:bg-brand-100 rounded-lg text-sm font-medium transition">
                ৳{a}
              </button>
            ))}
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
          <div className="grid grid-cols-3 gap-2">
            {methods.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setPaymentMethod(m.value)}
                className={`p-3 rounded-xl border-2 text-center transition ${paymentMethod === m.value ? 'border-brand-600 bg-brand-50' : 'border-gray-200'}`}
              >
                <span className="text-xl">{m.icon}</span>
                <p className="text-xs mt-1 font-medium">{m.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Reference */}
        <div>
          {sendMoneyNumber && (
            <div className="bg-gray-50 border rounded-xl p-3 mb-3">
              <div className="text-xs text-gray-600">Send Money Number</div>
              <div className="flex items-center justify-between gap-3 mt-1">
                <div className="font-mono text-sm font-semibold text-gray-900">{sendMoneyNumber}</div>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyText(sendMoneyNumber);
                    if (!ok) {
                      setError('Copy failed. Please copy manually.');
                    }
                  }}
                  className="px-3 py-1 rounded-lg bg-white border text-xs font-medium hover:bg-gray-100"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          <label className="block text-sm font-medium text-gray-700 mb-1">
            {trxLabel}{trxRequired ? '' : ' (optional)'}
          </label>
          <input
            type="text"
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value.replace(/\s+/g, ' ').trimStart())}
            placeholder={trxRequired ? 'Enter transaction ID (TrxID)' : 'Optional reference'}
            className="input-field"
            required={trxRequired}
          />
          {!trxValid && (
            <div className="text-xs text-red-600 mt-2">
              Transaction ID must be 6-64 characters (letters, numbers, _ or -).
            </div>
          )}
        </div>

        <button type="submit" disabled={loading || !amount} className="btn-primary w-full">
          {loading ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
}
