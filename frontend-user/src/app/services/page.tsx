'use client';

import { Suspense, useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const serviceTypes = [
  { value: '', label: 'All' },
  { value: 'HOME_INTERNET', label: '🌐 Internet' },
  { value: 'HOTSPOT_WIFI', label: '📶 Hotspot' },
  { value: 'MOBILE_RECHARGE', label: '📱 Recharge' },
  { value: 'ELECTRICITY_BILL', label: '💡 Electricity' },
  { value: 'SET_TOP_BOX', label: '📺 STB' },
];

function ServicesContent() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get('type') || '';
  const [type, setType] = useState(initialType);
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPackages() {
      setLoading(true);
      try {
        const token = getToken()!;
        const params: Record<string, string> = {};
        if (type && type !== 'SET_TOP_BOX') params.serviceType = type;
        
        let res;
        if (type === 'SET_TOP_BOX') {
           res = await api('/services/stb/packages', { token });
           // STB endpoint returns { success: true, data: [...] }
           // Map STB fields to standard fields for display
           const mappedData = res.data.map((p: any) => ({
             ...p,
             serviceType: 'SET_TOP_BOX',
             validity: p.validityDays // Map validityDays to validity for display
           }));
           setPackages(mappedData);
        } else {
           res = await api('/services/packages', { token, params });
           setPackages(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchPackages();
  }, [type]);

  const purchaseUrl = (pkg: any) => {
    switch (pkg.serviceType) {
      case 'HOME_INTERNET':
        return `/services/buy/internet?packageId=${pkg.id}`;
      case 'HOTSPOT_WIFI':
        return `/services/buy/hotspot?packageId=${pkg.id}`;
      case 'MOBILE_RECHARGE':
        return `/services/buy/recharge`;
      case 'ELECTRICITY_BILL':
        return `/services/buy/electricity`;
      case 'SET_TOP_BOX':
        return `/services/buy/stb?packageId=${pkg.id}`;
      default:
        return '#';
    }
  };

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold mb-4">Services</h1>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {serviceTypes.map((st) => (
          <button
            key={st.value}
            onClick={() => setType(st.value)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition ${
              type === st.value
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {type === '' && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Link
            href="/services/buy/recharge"
            className="card flex flex-col items-center justify-center p-4 hover:shadow-md transition aspect-square"
          >
            <span className="text-3xl mb-2">📱</span>
            <p className="text-sm font-semibold">Mobile Recharge</p>
            <p className="text-xs text-gray-400">Any operator</p>
          </Link>
          
          <Link
            href="/services/buy/electricity"
            className="card flex flex-col items-center justify-center p-4 hover:shadow-md transition aspect-square"
          >
            <span className="text-3xl mb-2">💡</span>
            <p className="text-sm font-semibold">Electricity Bill</p>
            <p className="text-xs text-gray-400">All providers</p>
          </Link>

          <button
            onClick={() => setType('HOME_INTERNET')}
            className="card flex flex-col items-center justify-center p-4 hover:shadow-md transition aspect-square"
          >
            <span className="text-3xl mb-2">🌐</span>
            <p className="text-sm font-semibold">Home Internet</p>
            <p className="text-xs text-gray-400">Broadband Packages</p>
          </button>

          <button
            onClick={() => setType('HOTSPOT_WIFI')}
            className="card flex flex-col items-center justify-center p-4 hover:shadow-md transition aspect-square"
          >
            <span className="text-3xl mb-2">📶</span>
            <p className="text-sm font-semibold">WiFi Hotspot</p>
            <p className="text-xs text-gray-400">Instant Access</p>
          </button>

          <button
            onClick={() => setType('SET_TOP_BOX')}
            className="card flex flex-col items-center justify-center p-4 hover:shadow-md transition aspect-square"
          >
            <span className="text-3xl mb-2">📺</span>
            <p className="text-sm font-semibold">STB Recharge</p>
            <p className="text-xs text-gray-400">TV Channels</p>
          </button>
        </div>
      )}

      {/* Hide package list here as requested, users will click into categories */}
      {/* BUT, if a specific category is selected (type !== ''), we should show packages for that category below the grid? 
          The user said: "package gula page ar samne je silo seta thabe amn na je vitoreo thakbena .. vitore thakbe age jevabe cilo"
          Meaning: On the main "All" view, hide packages. But if I click "Internet", I should see Internet packages.
      */}
      
      {type !== '' && (
        <div className="mt-6">
          {type === 'MOBILE_RECHARGE' ? (
             <div className="text-center py-8">
               <p className="text-gray-500 mb-4">Mobile recharge is not package-based.</p>
               <Link href="/services/buy/recharge" className="bg-brand-600 text-white px-6 py-2 rounded-xl font-semibold">
                 Start Recharge
               </Link>
             </div>
          ) : type === 'ELECTRICITY_BILL' ? (
             <div className="text-center py-8">
               <p className="text-gray-500 mb-4">Electricity bill payment is not package-based.</p>
               <Link href="/services/buy/electricity" className="bg-brand-600 text-white px-6 py-2 rounded-xl font-semibold">
                 Pay Bill
               </Link>
             </div>
          ) : (
            <>
            <h2 className="text-lg font-bold mb-3">Available Packages</h2>
            {loading ? (
                <div className="text-center py-8 text-gray-400">Loading packages...</div>
            ) : packages.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No packages available</div>
            ) : (
                <div className="space-y-3">
                {packages
                    .filter(
                    (p: any) =>
                        p.serviceType !== 'MOBILE_RECHARGE' &&
                        p.serviceType !== 'ELECTRICITY_BILL'
                    )
                    .map((pkg: any) => (
                    <Link
                        key={pkg.id}
                        href={purchaseUrl(pkg)}
                        className="card flex items-center justify-between hover:shadow-md transition"
                    >
                        <div>
                        <h3 className="font-semibold text-sm">{pkg.name}</h3>
                        <div className="flex gap-2 mt-1">
                            {pkg.bandwidth && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                {pkg.bandwidth}
                            </span>
                            )}
                            {pkg.dataLimit && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                {pkg.dataLimit}
                            </span>
                            )}
                            {pkg.validity && (
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                {pkg.validity}d
                            </span>
                            )}
                        </div>
                        </div>
                        <div className="text-right">
                        <div className="text-lg font-bold text-brand-700">
                            ৳{pkg.price}
                        </div>
                        <span className="text-[10px] text-brand-600 font-medium">
                            Buy →
                        </span>
                        </div>
                    </Link>
                    ))}
                </div>
            )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      }
    >
      <ServicesContent />
    </Suspense>
  );
}