/**
 * Portal Layout
 *
 * Layout serveur pour /portal (sélection des portails).
 *
 * ⭐ PWA — /portal est le start_url de l'app PWA sur le domaine principal :
 * cette page est liée à /manifest-app.webmanifest (installation de
 * L'APPLICATION, distincte du site institutionnel).
 */

import type { Metadata } from 'next';
import { PWAInstallPrompt } from '@/components/pwa/PWAInstallPrompt';

export const metadata: Metadata = {
  manifest: '/manifest-app.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Academia Helm',
  },
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      {/* ⭐ PWA — bannière d'installation de l'application */}
      <PWAInstallPrompt />
    </>
  );
}
