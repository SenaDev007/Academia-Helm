'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CommunicationPage() {
  const router = useRouter();

  useEffect(() => {
    // ⭐ Redirige vers la Messagerie unifiée (le seul onglet restant)
    router.push('/app/communication/messages');
  }, [router]);

  return null;
}
