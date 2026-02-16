
import { Suspense } from 'react';

export default function BuyStbLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
