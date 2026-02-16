'use client';

import { Suspense, useState, useEffect } from 'react';
import { api, getToken } from '@/lib/api';
import { useSearchParams, useRouter } from 'next/navigation';

function BuyInternetContent() {
  const searchParams = useSearchParams();
  const packageId = searchParams.get('packageId') || '';
  const [pkg, setPkg] = useState<any>(null);
  const [connectionId, setConnectionId] = useState('');
  const [subscriberName, setSubscriberName] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!packageId) return;
    api(`/services/packages/${packageId}`, { token: getToken()! })
      .then((res) => setPkg(res.data))
      .catch(console.error);
  }, [packageId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = getToken()!;
      const res = await api('/services/purchase/home-internet', {
        method: 'POST',
        token,
        body: {
          packageId,
          connectionId,
          subscriberName,
          address,
          area: area || undefined,
        },
      });
      setSuccess(res.message || 'Purchase successful!');
      setTimeout(() => router.push('/history'), 2000);
    } catch (err: any) {
      if (err.body?.details?.expiresAt) {
        const date = new Date(err.body.details.expiresAt).toLocaleString();
        setError(`${err.message}. Available after: ${date}`);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold mb-4">Buy Home Internet</h1>
      {pkg && (
        <div className="card mb-4">
          <h3 className="font-semibold">{pkg.name}</h3>
          <p className="text-2xl font-bold text-brand-700 mt-1">
            ৳{pkg.price}
          </p>
          <div className="flex gap-2 mt-2">
            {pkg.bandwidth && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                {pkg.bandwidth}
              </span>
            )}
            {pkg.validity && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                {pkg.validity} days
              </span>
            )}
          </div>
        </div>
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
            Connection ID
          </label>
          <input
            type="text"
            value={connectionId}
            onChange={(e) => setConnectionId(e.target.value)}
            className="input-field"
            required
            minLength={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Subscriber Name
          </label>
          <input
            type="text"
            value={subscriberName}
            onChange={(e) => setSubscriberName(e.target.value)}
            className="input-field"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="input-field"
            required
            rows={2}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Area (optional)
          </label>
          <input
            type="text"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="input-field"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Processing...' : `Pay ৳${pkg?.price || 0}`}
        </button>
      </form>
    </div>
  );
}

export default function BuyInternetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      }
    >
      <BuyInternetContent />
    </Suspense>
  );
}