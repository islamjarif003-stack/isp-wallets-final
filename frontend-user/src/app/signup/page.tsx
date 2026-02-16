'use client';

import { useState } from 'react';
import { api, setTokens } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Step = 'info' | 'otp' | 'password';

export default function SignupPage() {
  const [step, setStep] = useState<Step>('info');
  const [mobile, setMobile] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await api('/auth/signup/request-otp', {
        method: 'POST',
        body: { mobile, fullName },
      });
      setNotice('OTP sent to your mobile number');
      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyAndComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await api('/auth/signup/complete', {
        method: 'POST',
        body: { mobile, fullName, otp, password },
      });
      setTokens(res.data.tokens.accessToken, res.data.tokens.refreshToken);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
        <p className="text-gray-500 mt-1">
          {step === 'info' && 'Enter your details'}
          {step === 'otp' && 'Verify your mobile number'}
        </p>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-4 text-sm text-center">{error}</div>}
      {notice && <div className="bg-green-50 text-green-700 p-4 rounded-xl mb-4 text-sm text-center">{notice}</div>}

      {step === 'info' && (
        <form onSubmit={requestOtp} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="input-field" required minLength={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
            <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="01XXXXXXXXX" className="input-field" required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={verifyAndComplete} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">OTP Code</label>
            <input type="text" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" className="input-field text-center text-2xl tracking-widest" required maxLength={6} inputMode="numeric" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 chars, upper+lower+number" className="input-field" required minLength={6} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" className="input-field" required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
          <button type="button" onClick={() => setStep('info')} className="btn-outline w-full">Back</button>
        </form>
      )}

      <div className="mt-6 text-center">
        <span className="text-gray-400 text-sm">Already have an account? </span>
        <Link href="/login" className="text-brand-600 text-sm font-medium">Sign In</Link>
      </div>
    </div>
  );
}
