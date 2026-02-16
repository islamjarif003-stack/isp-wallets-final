'use client';

import { Suspense, useState, useEffect } from 'react';
import { api, getToken } from '@/lib/api';
import { useSearchParams, useRouter } from 'next/navigation';

function BuyHotspotContent() {
  const searchParams = useSearchParams();
  const packageId = searchParams.get('packageId') || '';
  const [pkg, setPkg] = useState<any>(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [walletId, setWalletId] = useState('');
  const [stock, setStock] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!packageId) return;
    const token = getToken()!;
    api(`/services/packages/${packageId}`, { token })
      .then((res) => setPkg(res.data))
      .catch(console.error);
    
    api(`/services/hotspot/stock/${packageId}`, { token })
      .then((res) => setStock(res.data.available))
      .catch(console.error);

    api('/wallet/summary', { token })
       .then(res => {
           if (res.data?.walletId) setWalletId(res.data.walletId);
       })
      .catch(console.error);
  }, [packageId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!walletId) {
       setError('Wallet not found. Please contact support.');
       return;
    }

    setLoading(true);
    try {
      const token = getToken()!;
      // Updated endpoint: /services/hotspot/purchase
      const res = await api('/services/hotspot/purchase', {
        method: 'POST',
        token,
        body: {
          packageId,
          mobileNumber,
          walletId
        },
      });
      setSuccess(res.message || 'Hotspot activated!');
      if (res.data?.serviceRecordId) {
        const services = await api('/services/my/hotspot-services', {
          token,
        });
        const latest = services.data?.[0];
        if (latest?.voucherCode) setVoucherCode(latest.voucherCode);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold mb-4">Buy Hotspot WiFi</h1>
      {pkg && (
        <div className="card mb-4">
          <h3 className="font-semibold">{pkg.name}</h3>
          <p className="text-2xl font-bold text-brand-700 mt-1">
            ৳{pkg.price}
          </p>
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
      {voucherCode && (
        <div className="bg-brand-50 border-2 border-brand-200 rounded-2xl p-6 text-center mb-4">
          <p className="text-sm text-gray-500 mb-1">Your Voucher Code</p>
          <p className="text-2xl font-mono font-bold text-brand-800 tracking-widest">
            {voucherCode}
          </p>
        </div>
      )}

      {!success && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Mobile Number
            </label>
            <input
              type="text"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              className="input-field"
              placeholder="017xxxxxxxx"
              maxLength={11}
            />
          </div>
          
          {stock !== null && (
             <div className={`text-sm font-medium ${stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stock > 0 ? `Available Stock: ${stock}` : 'Out of Stock'}
             </div>
          )}

          <button
            type="submit"
            disabled={loading || stock === 0 || !mobileNumber.match(/^01\d{9}$/)}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : stock === 0 ? 'Out of Stock' : `Pay ৳${pkg?.price || 0}`}
          </button>
        </form>
      )}
    </div>
  );
}

export default function BuyHotspotPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      }
    >
      <BuyHotspotContent />
    </Suspense>
  );
}