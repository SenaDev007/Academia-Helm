'use client';

import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Vérifier si l'app est déjà installée
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Écouter l'événement beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Vérifier si l'app a été installée après le chargement
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // Vérifier dans le localStorage si l'utilisateur a déjà refusé
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      // Réafficher après 7 jours
      if (daysSinceDismissed < 7) {
        setIsVisible(false);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Afficher le prompt d'installation
    await deferredPrompt.prompt();

    // Attendre la réponse de l'utilisateur
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsVisible(false);
    } else {
      // L'utilisateur a refusé, ne pas réafficher pendant 7 jours
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Ne pas afficher si déjà installée ou si le prompt n'est pas disponible
  if (isInstalled || !isVisible || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Installer Academia Hub
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
              Installez l'application pour un accès rapide et une utilisation hors ligne.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                <Download className="w-4 h-4" />
                Installer
              </button>
              <button
                onClick={handleDismiss}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
