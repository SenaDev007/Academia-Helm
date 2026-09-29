/**
 * Mobile Layout
 *
 * Layout serveur pour /mobile/* (portails mobiles élève / parent).
 *
 * ⭐ PWA — ces portails sont pensés pour une utilisation mobile :
 * liaison au manifest de l'application (/manifest-app.webmanifest)
 * pour l'installation sur écran d'accueil.
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  manifest: '/manifest-app.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Academia Helm',
  },
};

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
