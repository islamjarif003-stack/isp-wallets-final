'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Step = 'request' | 'reset';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('request');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const router = useRouter();

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await api('/auth/forgot-password/request', { method: 'POST', body: { mobile } });
      setNotice('OTP sent to your mobile number');
      setStep('reset');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await api('/auth/forgot-password/reset', { method: 'POST', body: { mobile, otp, newPassword } });
      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-4 text-sm text-center">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-4 rounded-xl mb-4 text-sm text-center">{success}</div>}
      {notice && <div className="bg-green-50 text-green-700 p-4 rounded-xl mb-4 text-sm text-center">{notice}</div>}

      {step === 'request' && (
        <form onSubmit={requestOtp} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
            <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="01XXXXXXXXX" className="input-field" required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Sending...' : 'Send Reset OTP'}</button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={resetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">OTP Code</label>
            <input type="text" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" className="input-field text-center text-2xl tracking-widest" required maxLength={6} inputMode="numeric" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 chars" className="input-field" required minLength={6} />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Resetting...' : 'Reset Password'}</button>
        </form>
      )}

      <div className="mt-6 text-center">
        <Link href="/login" className="text-brand-600 text-sm font-medium">Back to Login</Link>
      </div>
    </div>
  );
}
