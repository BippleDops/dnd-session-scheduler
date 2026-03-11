'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cancelByToken } from '@/lib/api';
import CandleLoader from '@/components/ui/CandleLoader';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';

export default function CancelPage() { return <Suspense><CancelInner /></Suspense>; }
function CancelInner() {
  usePageTitle('Cancel Registration');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!token) { setResult({ success: false, message: 'Invalid cancel link.' }); return; }
    cancelByToken(token).then(r => setResult({ success: r.success, message: r.message || '' })).catch(() => setResult({ success: false, message: 'Something went wrong.' }));
  }, [token]);

  if (!result) return <CandleLoader text="Processing cancellation..." />;

  return (
    <ParchmentPanel className="text-center py-10 max-w-lg mx-auto">
      <h2 className={`font-[var(--font-heading)] text-xl ${result.success ? 'text-green-700' : 'text-red-700'}`}>
        {result.success ? '✅ Registration Cancelled' : '❌ Cannot Cancel'}
      </h2>
      <p className="text-[var(--ink)] mt-2">{result.message}</p>
      <WoodButton variant="primary" href="/" className="mt-4">Back to Quest Board</WoodButton>
    </ParchmentPanel>
  );
}

