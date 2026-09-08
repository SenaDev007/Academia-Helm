/**
 * Public Layout
 *
 * Layout pour les pages publiques (landing, pricing, etc.)
 *
 * ⭐ PWA — le site corporate est installable (manifest /manifest.json lié
 * par le layout racine sur le domaine principal) : on y monte la bannière
 * d'installation PWAInstallPrompt (Chrome/Edge desktop + Android + iOS).
 */

import { PWAInstallPrompt } from '@/components/pwa/PWAInstallPrompt';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {/* Spacer pour le header fixe (responsive h-14 md:h-16) */}
      <div className="h-14 md:h-16" />
      {children}
      {/* ⭐ PWA — bannière d'installation du site Academia Helm */}
      <PWAInstallPrompt appName="Academia Helm" />
    </div>
  );
}
