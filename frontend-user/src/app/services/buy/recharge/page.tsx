'use client';

import { useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';

const operators = [
  { value: 'GRAMEENPHONE', label: 'GP', icon: '🟢' },
  { value: 'ROBI', label: 'Robi', icon: '🔴' },
  { value: 'BANGLALINK', label: 'BL', icon: '🟠' },
  { value: 'TELETALK', label: 'TT', icon: '🔵' },
  { value: 'AIRTEL', label: 'Airtel', icon: '⚪' },
];

export default function RechargePage() {
  const [mobileNumber, setMobileNumber] = useState('');
  const [operator, setOperator] = useState('GRAMEENPHONE');
  const [amount, setAmount] = useState('');
  const [rechargeType, setRechargeType] = useState('PREPAID');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = getToken()!;
      const res = await api('/services/purchase/mobile-recharge', {
        method: 'POST', token,
        body: { mobileNumber, operator, amount: parseFloat(amount), rechargeType },
      });
      setSuccess(res.message || 'Recharge successful!');
      setTimeout(() => router.push('/history'), 2000);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold mb-4">Mobile Recharge</h1>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-3 rounded-xl mb-4 text-sm">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="block text-sm font-medium mb-1">Mobile Number</label><input type="tel" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} className="input-field" placeholder="01XXXXXXXXX" required /></div>

        <div>
          <label className="block text-sm font-medium mb-2">Operator</label>
          <div className="grid grid-cols-5 gap-2">
            {operators.map((op) => (
              <button key={op.value} type="button" onClick={() => setOperator(op.value)}
                className={`p-2 rounded-xl border-2 text-center transition ${operator === op.value ? 'border-brand-600 bg-brand-50' : 'border-gray-200'}`}>
                <span className="text-lg">{op.icon}</span>
                <p className="text-[10px] mt-0.5 font-medium">{op.label}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Amount (৳)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field text-xl font-bold" required min={10} max={10000} />
          <div className="flex flex-wrap gap-2 mt-2">
            {[20, 50, 100, 200, 500, 1000].map((a) => (
              <button key={a} type="button" onClick={() => setAmount(String(a))} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm font-medium">৳{a}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select value={rechargeType} onChange={(e) => setRechargeType(e.target.value)} className="input-field">
            <option value="PREPAID">Prepaid</option>
            <option value="POSTPAID">Postpaid</option>
            <option value="DATA_PACK">Data Pack</option>
          </select>
        </div>

        <button type="submit" disabled={loading || !amount} className="btn-primary w-full">{loading ? 'Processing...' : `Recharge ৳${amount || 0}`}</button>
      </form>
    </div>
  );
}