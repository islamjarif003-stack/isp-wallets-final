
'use client';

import { Suspense, useState, useEffect } from 'react';
import { api, getToken } from '@/lib/api';
import { useSearchParams, useRouter } from 'next/navigation';

function BuyStbContent() {
  const searchParams = useSearchParams();
  const packageId = searchParams.get('packageId') || '';
  const [pkg, setPkg] = useState<any>(null);
  const [stbNumber, setStbNumber] = useState('');
  const [walletId, setWalletId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  // Fetch package details
  useEffect(() => {
    async function fetchPackage() {
      if (!packageId) return;
      try {
        const token = getToken()!;
        // Since there's no single package endpoint for STB, we fetch all and find the one
        const res = await api('/services/stb/packages', { token });
        const found = res.data.find((p: any) => p.id === packageId);
        if (found) setPkg(found);
      } catch (err) {
        console.error(err);
      }
    }
    fetchPackage();
  }, [packageId]);

  // Fetch Wallet ID
  useEffect(() => {
    async function fetchWallet() {
      try {
        const token = getToken()!;
        const res = await api('/wallet/balance', { token });
        if (res.data?.walletId) {
            setWalletId(res.data.walletId);
        }
      } catch (err) {
        console.error("Failed to fetch wallet info", err);
      }
    }
    fetchWallet();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!walletId) {
        setError('Wallet information not found. Please refresh.');
        setLoading(false);
        return;
    }

    try {
      const token = getToken()!;
      const res = await api('/services/stb/purchase', {
        method: 'POST',
        token,
        body: {
          packageId,
          stbNumber,
          walletId
        },
      });
      setSuccess(res.message || 'STB Service purchased successfully!');
      setTimeout(() => router.push('/history'), 2000);
    } catch (err: any) {
      if (err.body?.details?.expiresAt) {
        const date = new Date(err.body.details.expiresAt).toLocaleString();
        setError(`${err.message}. Available after: ${date}`);
      } else {
        setError(err.message || 'Purchase failed');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!packageId) {
    return <div className="p-4 text-center text-gray-500">No package selected</div>;
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold mb-4">Buy Set Top Box Service</h1>
      
      {pkg ? (
        <div className="card mb-4">
          <h3 className="font-semibold">{pkg.name}</h3>
          <p className="text-2xl font-bold text-brand-700 mt-1">
            ৳{pkg.price}
          </p>
          <div className="flex gap-2 mt-2">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                {pkg.validityDays} days
            </span>
          </div>
        </div>
      ) : (
        <div className="animate-pulse h-24 bg-gray-100 rounded-xl mb-4"></div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 p-3 rounded-xl mb-4 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            STB Number / Card Number
          </label>
          <input
            type="text"
            value={stbNumber}
            onChange={(e) => setStbNumber(e.target.value)}
            className="input-field"
            placeholder="Enter STB ID"
            required
            minLength={3}
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Example: STB-123456789
          </p>
        </div>

        <button 
            type="submit" 
            disabled={loading || !pkg || !stbNumber || !walletId} 
            className="btn-primary w-full"
        >
          {loading ? 'Processing...' : `Pay ৳${pkg?.price || 0}`}
        </button>
      </form>
    </div>
  );
}

export default function BuyStbPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      }
    >
      <BuyStbContent />
    </Suspense>
  );
}
