'use client';

import { useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';

const providers = ['DPDC', 'DESCO', 'NESCO', 'BPDB', 'WZPDCL', 'BREB'];

export default function ElectricityPage() {
  const [meterNumber, setMeterNumber] = useState('');
  const [provider, setProvider] = useState('DPDC');
  const [accountHolder, setAccountHolder] = useState('');
  const [amount, setAmount] = useState('');
  const [billMonth, setBillMonth] = useState('');
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
      const res = await api('/services/purchase/electricity', {
        method: 'POST', token,
        body: { meterNumber, provider, accountHolder: accountHolder || undefined, amount: parseFloat(amount), billMonth: billMonth || undefined },
      });
      setSuccess(res.message || 'Bill paid successfully!');
      setTimeout(() => router.push('/history'), 2000);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold mb-4">Pay Electricity Bill</h1>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-3 rounded-xl mb-4 text-sm">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="block text-sm font-medium mb-1">Meter Number</label><input type="text" value={meterNumber} onChange={(e) => setMeterNumber(e.target.value)} className="input-field" required minLength={5} /></div>
        <div>
          <label className="block text-sm font-medium mb-1">Provider</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="input-field">
            {providers.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div><label className="block text-sm font-medium mb-1">Account Holder (optional)</label><input type="text" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} className="input-field" /></div>
        <div><label className="block text-sm font-medium mb-1">Amount (৳)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field text-xl font-bold" required min={50} max={100000} /></div>
        <div><label className="block text-sm font-medium mb-1">Bill Month (optional)</label><input type="month" value={billMonth} onChange={(e) => setBillMonth(e.target.value)} className="input-field" /></div>
        <button type="submit" disabled={loading || !amount} className="btn-primary w-full">{loading ? 'Processing...' : `Pay ৳${amount || 0}`}</button>
      </form>
    </div>
  );
}