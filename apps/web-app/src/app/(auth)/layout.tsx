/**
 * Auth Layout
 *
 * Layout pour les pages d'authentification (/login, /forgot-password,
 * /reset-password).
 *
 * ⭐ PWA — ces pages sont l'entrée de L'APPLICATION (start_url du manifest
 * app) : elles surchargent le manifest racine (site institutionnel) par
 * /manifest-app.webmanifest pour que l'installation depuis la page de
 * connexion installe l'app de gestion (et non le site vitrine).
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

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      {children}
      {/* ⭐ PWA — bannière d'installation de l'application */}
      <PWAInstallPrompt />
    </div>
  );
}
