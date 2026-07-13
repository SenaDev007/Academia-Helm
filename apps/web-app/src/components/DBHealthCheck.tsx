/**
 * ============================================================================
 * DB HEALTH CHECK — Composant qui vérifie la santé de la BDD au démarrage
 * ============================================================================
 *
 * Si la BDD est inaccessible (quota dépassé, connexion timeout, etc.),
 * affiche une page de maintenance élégante au lieu d'une erreur brute.
 *
 * Intégré dans le layout racine de l'app.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Database, RefreshCw, AlertTriangle } from 'lucide-react';

interface DBHealthState {
  status: 'checking' | 'ok' | 'error';
  message?: string;
}

export function DBHealthCheck({ children }: { children: React.ReactNode }) {
  const [health, setHealth] = useState<DBHealthState>({ status: 'checking' });

  useEffect(() => {
    checkDBHealth();
  }, []);

  const checkDBHealth = async () => {
    setHealth({ status: 'checking' });
    try {
      // Faire une requête simple vers le backend
      // Si ça répond, la BDD est accessible
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (res.ok) {
        setHealth({ status: 'ok' });
      } else {
        setHealth({ status: 'error', message: 'Service temporairement indisponible' });
      }
    } catch (e: any) {
      setHealth({ status: 'error', message: 'Connexion au serveur impossible' });
    }
  };

  if (health.status === 'ok') {
    return <>{children}</>;
  }

  if (health.status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Connexion en cours...</h2>
          <p className="text-sm text-slate-500 mt-1">Academia Helm se prépare</p>
        </div>
      </div>
    );
  }

  // État d'erreur — page de maintenance élégante
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-6 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Maintenance en cours</h1>
            <p className="text-sm text-white/80 mt-1">Academia Helm</p>
          </div>
          <div className="p-6 text-center">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-sm font-semibold text-amber-800">Service temporairement indisponible</p>
                <p className="text-xs text-amber-700 mt-1">
                  Notre équipe technique a été notifiée. Le service sera rétabli dans les plus brefs délais.
                </p>
              </div>
            </div>
            <button
              onClick={checkDBHealth}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </button>
            <p className="text-[10px] text-slate-400 mt-4">
              Si le problème persiste, contactez le support : support@academiahelm.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
