'use client';

/**
 * ============================================================================
 * APP GATE — Garde client-side pour Tauri (remplace middleware.ts)
 * ============================================================================
 *
 * ⭐ Dans Tauri, le middleware Next.js ne tourne pas. Cette garde remplace
 *    la résolution de tenant + la validation de session côté client.
 *
 * Rôle :
 *   1. Vérifier si une session locale existe (localStorage)
 *   2. Si oui → laisser passer vers /app
 *   3. Si non → redirect vers /login
 *
 * En Tauri, on fait confiance à la session locale (pas de validation réseau).
 * Le token est validé par le sync engine Rust qui a accès au backend.
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isTauriEnvironment } from '@/lib/offline/tauri-sql-fetch';

interface AppGateProps {
  children: React.ReactNode;
}

export default function AppGate({ children }: AppGateProps) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ⭐ En mode web (pas Tauri), ne pas activer la garde
    //    Le middleware.ts s'en charge côté serveur.
    if (!isTauriEnvironment()) {
      setAuthorized(true);
      setLoading(false);
      return;
    }

    // ⭐ En mode Tauri : vérifier la session locale
    try {
      const session = localStorage.getItem('session');
      if (session) {
        const parsed = JSON.parse(session);
        // Vérifier qu'on a un token + un tenant
        if (parsed.accessToken && (parsed.tenantId || parsed.tenant?.id)) {
          setAuthorized(true);
          setLoading(false);
          return;
        }
      }

      // Aussi vérifier le token séparé (client-access-token)
      const token = localStorage.getItem('accessToken');
      if (token) {
        setAuthorized(true);
        setLoading(false);
        return;
      }

      // Pas de session → redirect vers login
      router.push('/login');
    } catch {
      // Erreur de parsing → redirect
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null; // Le redirect est en cours
  }

  return <>{children}</>;
}
