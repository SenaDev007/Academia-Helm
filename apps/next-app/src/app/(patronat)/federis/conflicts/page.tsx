/**
 * Gestion des Conflits de Synchronisation
 * 
 * Interface pour résoudre manuellement les conflits de données
 * identifiés lors de la synchronisation entre SQLite local et PostgreSQL.
 * 
 * RÈGLE : Section 12 du Cahier Technique
 */

'use client';

import { useEffect, useState } from 'react';
import { conflictResolverService, ConflictResolutionStrategy } from '@/lib/offline/conflict-resolver.service';
import { AlertTriangle, CheckCircle, Database, History, ArrowRight, ShieldCheck } from 'lucide-react';

export default function ConflictsPage() {
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    loadConflicts();
  }, []);

  async function loadConflicts() {
    const list = await conflictResolverService.getPendingConflicts();
    setConflicts(list);
    setIsLoading(false);
  }

  async function handleResolve(id: string, strategy: ConflictResolutionStrategy) {
    setResolvingId(id);
    const success = await conflictResolverService.resolve(id, strategy);
    if (success) {
      setConflicts(prev => prev.filter(c => c.id !== id));
    }
    setResolvingId(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-blue-900 flex items-center gap-3">
            <AlertTriangle className="text-orange-500" />
            Gestion des Conflits
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Résolvez les divergences entre vos données locales et le serveur institutionnel.
          </p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2">
          <Database size={14} />
          {conflicts.length} conflit{conflicts.length > 1 ? 's' : ''} en attente
        </div>
      </div>

      {conflicts.length === 0 ? (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-600 w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-green-900">Aucun conflit détecté</h3>
          <p className="text-sm text-green-700 mt-2">Votre base locale est parfaitement synchronisée avec le serveur.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {conflicts.map((conflict) => (
            <div key={conflict.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="bg-blue-900 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">
                    {conflict.table_name}
                  </span>
                  <span className="text-xs text-gray-500">Détecté le {new Date(conflict.detected_at).toLocaleString()}</span>
                </div>
                <ShieldCheck size={16} className="text-gray-400" />
              </div>
              
              <div className="p-6 grid md:grid-cols-2 gap-8">
                {/* Version Locale */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Database size={14} /> Version Locale (Vôtre)
                  </h4>
                  <pre className="bg-gray-50 p-4 rounded-xl text-[10px] overflow-auto max-h-[200px] border border-gray-100">
                    {JSON.stringify(JSON.parse(conflict.local_data), null, 2)}
                  </pre>
                </div>

                {/* Version Serveur */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <History size={14} /> Version Serveur
                  </h4>
                  <pre className="bg-blue-50 p-4 rounded-xl text-[10px] overflow-auto max-h-[200px] border border-blue-100">
                    {JSON.stringify(JSON.parse(conflict.server_data), null, 2)}
                  </pre>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => handleResolve(conflict.id, 'SERVER_WINS')}
                  disabled={resolvingId === conflict.id}
                  className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Accepter le serveur
                </button>
                <button
                  onClick={() => handleResolve(conflict.id, 'MERGE_FIELDS')}
                  disabled={resolvingId === conflict.id}
                  className="px-4 py-2 text-xs font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                >
                  Fusionner les champs
                </button>
                <button
                  onClick={() => handleResolve(conflict.id, 'LAST_WRITE_WINS')}
                  disabled={resolvingId === conflict.id}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-md transition-all flex items-center gap-2"
                >
                  {resolvingId === conflict.id ? 'Résolution...' : 'Appliquer Stratégie Temporelle'}
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
