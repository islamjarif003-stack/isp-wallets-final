import { Suspense } from 'react';
import TransactionsClientComponent from './TransactionsClientComponent';

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div>Loading transactions...</div>}>
      <TransactionsClientComponent />
    </Suspense>
  );
}