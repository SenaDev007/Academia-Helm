'use client';

import { useAppSession } from '@/contexts/AppSessionContext';
import WhatsAppChat from '@/components/communication/WhatsAppChat';
import { Loader2 } from 'lucide-react';

/**
 * ⭐ Communication page — renders the WhatsApp-like chat directly.
 *    No ModuleHeader, no tabs, no ModuleContentArea wrapper.
 *    The chat fills the entire viewport (minus the 64px app sidebar).
 */

export default function MessagesPage() {
  const { user } = useAppSession();
  const currentUserId = user?.id || '';

  if (!currentUserId) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <WhatsAppChat
      currentUserId={currentUserId}
      heightClass="h-full"
    />
  );
}
