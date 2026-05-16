/**
 * Offline Guard Component
 * 
 * Composant de sécurité pour empêcher l'accès aux espaces connectés
 * si le bootstrap initial n'a pas été effectué (Première connexion Internet obligatoire).
 * 
 * RÈGLE : Section 5.3 du Cahier Technique
 */

'use client';

import { useEffect, useState } from 'react';
import { offlineBootstrapService } from '@/lib/offline/offline-bootstrap.service';
import { syncEngine } from '@/lib/offline/sync-engine.service';
import { Wifi, AlertTriangle, RefreshCw } from 'lucide-react';

interface OfflineGuardProps {
  children: React.ReactNode;
}

export default function OfflineGuard({ children }: OfflineGuardProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [access, setAccess] = useState<{ allowed: boolean; message?: string }>({ allowed: true });

  useEffect(() => {
    async function check() {
      const result = await offlineBootstrapService.checkOfflineAccess();
      
      // Sécurité : Section 20.3 (Expiration session locale après 7 jours offline)
      const lastSync = localStorage.getItem('last_bootstrap_at');
      if (lastSync && !syncEngine.isOnline()) {
        const lastSyncDate = new Date(lastSync);
        const now = new Date();
        const diffDays = (now.getTime() - lastSyncDate.getTime()) / (1000 * 3600 * 24);
        
        if (diffDays > 7) {
          setAccess({
            allowed: false,
            message: 'Votre session locale a expiré (limite de 7 jours hors ligne). Une connexion Internet est requise pour renouveler vos accès sécurisés.'
          });
          setIsChecking(false);
          return;
        }
      }

      setAccess(result);
      setIsChecking(false);
    }
    check();
  }, []);

  if (isChecking) {
    return (
      <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Vérification de l'environnement...</h2>
        <p className="text-gray-500 mt-2">Préparation de l'accès sécurisé Academia Federis.</p>
      </div>
    );
  }

  if (!access.allowed) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-[9999] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center border border-orange-100">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Wifi className="w-10 h-10 text-orange-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-4">Connexion Requise</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            {access.message || "Une connexion Internet est nécessaire pour la première initialisation de votre espace Federis."}
          </p>
          
          <div className="bg-orange-50 rounded-xl p-4 mb-8 flex items-start space-x-3 text-left">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-orange-800">
              Cette étape est obligatoire une seule fois pour configurer vos permissions et synchroniser votre contexte institutionnel en toute sécurité.
            </p>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-blue-900 text-white rounded-xl font-bold hover:bg-blue-800 transition-all shadow-lg active:scale-[0.98]"
          >
            Réessayer la connexion
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
