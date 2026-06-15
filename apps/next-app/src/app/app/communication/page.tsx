'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CommunicationPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/app/communication/dashboard');
  }, [router]);

  return null;
}
