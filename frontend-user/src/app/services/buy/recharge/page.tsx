'use client';

import { useState, useEffect } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

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
  const [mobileNumberError, setMobileNumberError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (mobileNumberError) {
      setMobileNumberError(false);
    }
  }, [mobileNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setMobileNumberError(false);

    if (!mobileNumber || mobileNumber.length !== 11) {
      setError('Please enter a valid 11-digit mobile number.');
      setMobileNumberError(true);
      setLoading(false);
      return;
    }
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="px-4 pt-6"
    >
      <h1 className="text-xl font-bold mb-4">Mobile Recharge</h1>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4 text-sm">{error}</div>}
      {success && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="bg-green-50 text-green-700 p-3 rounded-xl mb-4 text-sm flex items-center justify-center"
        >
          <motion.span
            initial={{ scale: 0, rotate: 0 }}
            animate={{ scale: 1, rotate: 360 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
            className="text-2xl mr-2"
          >✅</motion.span>
          {success}
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="block text-sm font-medium mb-1">Mobile Number</label>
          <motion.div
            key={mobileNumberError ? "error" : "no-error"} // Key change to re-trigger animation
            animate={mobileNumberError ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <input type="tel" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} className="input-field" placeholder="01XXXXXXXXX" required />
          </motion.div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Operator</label>
          <div className="grid grid-cols-5 gap-2">
            {operators.map((op) => (
              <motion.button
                key={op.value}
                type="button"
                onClick={() => setOperator(op.value)}
                whileTap={{ scale: 0.94 }}
                animate={operator === op.value ? { scale: 1.05, boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)" } : { scale: 1, boxShadow: "0 0px 0px rgba(0, 0, 0, 0)" }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className={`p-2 rounded-xl border-2 text-center ${operator === op.value ? 'border-brand-600 bg-brand-50' : 'border-gray-200'}`}>
                <span className="text-lg">{op.icon}</span>
                <p className="text-[10px] mt-0.5 font-medium">{op.label}</p>
              </motion.button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Amount (৳)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field text-xl font-bold" required min={10} max={10000} />
          <div className="flex flex-wrap gap-2 mt-2">
            {[20, 50, 100, 200, 500, 1000].map((a) => (
              <motion.button
                key={a}
                type="button"
                onClick={() => setAmount(String(a))}
                whileTap={{ scale: 0.9 }}
                animate={amount === String(a) ? { scale: 1.05, backgroundColor: "#FEE2E2" } : { scale: 1, backgroundColor: "#F3F4F6" }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${amount === String(a) ? 'bg-brand-100 text-brand-700' : 'bg-gray-100'}`}>
                ৳{a}
              </motion.button>
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

        <motion.button
          type="submit"
          disabled={loading || !amount}
          whileTap={{ scale: 0.96 }}
          animate={!loading && amount ? { scale: [1, 1.03, 1] } : {}}
          transition={!loading && amount ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" } : {}}
          className="btn-primary w-full"
        >
          {loading ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="inline-block mr-2"
            >⚙️</motion.span>
          ) : null}
          {loading ? 'Processing...' : `Recharge ৳${amount || 0}`}
        </motion.button>
      </form>
    </motion.div>
  );
}