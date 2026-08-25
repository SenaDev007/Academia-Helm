'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * ⭐ Redirects to /app/communication/messages (the WhatsApp-like chat).
 *    No header, no tabs — the chat IS the communication module.
 */

export default function CommunicationPage() {
  const router = useRouter();
  useEffect(() => {
    router.push('/app/communication/messages');
  }, [router]);
  return null;
}
