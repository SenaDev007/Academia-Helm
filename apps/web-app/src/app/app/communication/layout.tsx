'use client';

import React from 'react';

/**
 * ⭐ SIMPLIFIED: No header, no tabs — the chat fills the entire page.
 *    When the user clicks "Communication" in the sidebar, they land
 *    directly in the WhatsApp-like chat interface.
 */

export default function CommunicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ⭐ No ModuleHeader, no SubModuleNavigation — just render the chat directly.
  //    The WhatsAppChat component already has its own header (sidebar + top bar).
  return <div className="h-[calc(100vh-64px)]">{children}</div>;
}
