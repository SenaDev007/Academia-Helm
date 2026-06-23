'use client';

/**
 * ============================================================================
 * DOMAINES & SOUS-DOMAINES — Page back-office
 * ============================================================================
 *
 * Affiche la liste des tenants avec leur sous-domaine et l'URL complète
 *   {subdomain}.academiahelm.com
 *
 * Source : GET /api/platform/tenants?limit=100
 *
 * Fonctionnalités :
 *   - Barre de recherche (nom / slug / sous-domaine)
 *   - Tableau : nom de l'établissement, sous-domaine, URL complète, statut
 *     (active/suspended), statut DNS (placeholder "Configuré")
 *   - Lien cliquable pour visiter chaque sous-domaine (ouverture nouvel onglet)
 *
 * Palette AH : blue-900 (titres), amber-500/600 (or, accents), red-600 (erreurs).
 * ============================================================================
 */

import { useState, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  ExternalLink,
  Globe,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '@/components/platform/PlatformStates';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  subdomain?: string | null;
  status: string;
  planStatus?: string | null;
  country?: string;
  city?: string;
}

interface TenantsData {
  tenants: Tenant[];
  total: number;
  page: number;
  limit: number;
}

const BASE_DOMAIN = 'academiahelm.com';

function buildFullUrl(subdomain?: string | null): string | null {
  if (!subdomain) return null;
  return `https://${subdomain}.${BASE_DOMAIN}`;
}

function isActiveStatus(status: string, planStatus?: string | null): boolean {
  const s = (status || '').toLowerCase();
  const ps = (planStatus || '').toUpperCase();
  if (s === 'suspended' || ps === 'SUSPENDED' || ps === 'BLOCKED') return false;
  return true;
}

export default function DomainsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data, loading, error, refetch } = usePlatformData<TenantsData>('/tenants?limit=100');

  const filtered = useMemo(() => {
    if (!data?.tenants) return [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return data.tenants;
    return data.tenants.filter(
      (t) =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.slug || '').toLowerCase().includes(q) ||
        (t.subdomain || '').toLowerCase().includes(q),
    );
  }, [data, searchTerm]);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Domaines &amp; Sous-domaines</h1>
          <p className="text-slate-500">
            Sous-domaines des établissements sur <span className="font-mono">{BASE_DOMAIN}</span>
          </p>
        </div>
        <button
          onClick={refetch}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Rafraîchir
        </button>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, slug ou sous-domaine..."
            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <PlatformLoading label="Chargement des sous-domaines…" />
      ) : error ? (
        <PlatformError message={error} onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <PlatformEmpty
          title="Aucun sous-domaine"
          description="Aucun établissement ne correspond à votre recherche."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100 text-xs text-slate-500">
            {filtered.length} établissement(s) — base{' '}
            <span className="font-mono">{BASE_DOMAIN}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Établissement</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Sous-domaine</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">URL complète</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">DNS</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Ouvrir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((t) => {
                  const fullUrl = buildFullUrl(t.subdomain);
                  const active = isActiveStatus(t.status, t.planStatus);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{t.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{t.slug}</div>
                      </td>
                      <td className="px-6 py-4">
                        {t.subdomain ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-mono font-bold">
                            <Globe className="w-3.5 h-3.5" />
                            {t.subdomain}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Non configuré</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {fullUrl ? (
                          <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 hover:underline font-mono"
                            title={`Ouvrir ${fullUrl} dans un nouvel onglet`}
                          >
                            {fullUrl.replace(/^https?:\/\//, '')}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {active ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">
                            <CheckCircle2 className="w-3 h-3" /> Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-bold uppercase">
                            <XCircle className="w-3 h-3" /> Suspendu
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {t.subdomain ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-bold uppercase">
                            <CheckCircle2 className="w-3 h-3" /> Configuré
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold uppercase">
                            <XCircle className="w-3 h-3" /> N/A
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {fullUrl ? (
                          <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Visiter ${fullUrl}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-900 text-white rounded-lg text-xs font-semibold hover:bg-blue-800 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Ouvrir
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer note */}
      {!loading && !error && filtered.length > 0 && (
        <p className="text-xs text-slate-400">
          ℹ️ Le statut DNS affiché est un placeholder. L&apos;intégration avec un service de vérification
          DNS temps-réel (Cloudflare, Dig) est planifiée.
        </p>
      )}
    </div>
  );
}
