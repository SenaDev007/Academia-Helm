/**
 * FederisDelegationCard — Délégation d'accès au patronat national
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ AGRÉGATION NATIONALE (2026-10-01) — carte du module « Équipe & Comptes »
 *    du patronat DÉPARTEMENTAL (coordonnateur) :
 *
 * Le patronat national consulte l'agrégation de tous les départements en
 * lecture seule. Depuis cette carte, le coordonnateur départemental peut
 * « donner la main » à un compte du national : le compte national désigné
 * pourra alors MODIFIER les données de CE département (après avoir choisi
 * le département dans sa barre de périmètre). La délégation est révocable
 * à tout moment.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { apiClient } from '@/lib/api/client';
import { useFederisScope } from '@/lib/federis/scope-context';

interface Delegation {
  userId: string;
  email: string | null;
  name: string | null;
  grantedByName: string | null;
  grantedAt: string;
}

export default function FederisDelegationCard() {
  const { isNational, refresh } = useFederisScope();
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/federis/patronat/delegations', { timeout: 15000 });
      setDelegations(Array.isArray(res.data?.granted) ? res.data.granted : []);
    } catch {
      setDelegations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // La carte n'existe que côté départemental (le national consulte son
    // statut dans « Patronats territoriaux » et sa barre de périmètre).
    if (isNational) return;
    void load();
  }, [isNational, load]);

  if (isNational) return null;

  const grant = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.post(
        '/federis/patronat/delegations',
        { email: email.trim() },
        { timeout: 20000 },
      );
      setNotice(`Droits de modification accordés à ${email.trim()}.`);
      setEmail('');
      await load();
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de créer la délégation.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (d: Delegation) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.delete(`/federis/patronat/delegations/${d.userId}`, { timeout: 20000 });
      setNotice(`Délégation révoquée pour ${d.email ?? d.name ?? 'ce compte'}.`);
      await load();
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de révoquer la délégation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fed-card p-8 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-800 rounded-lg flex items-center justify-center shrink-0">
            <AppIcon name="network" size="dashboard" className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-900 uppercase">
              Délégation au patronat national
            </h3>
            <p className="text-slate-500 text-sm mt-1 max-w-2xl">
              Le patronat national consulte votre département en lecture seule. Donnez la main à
              un compte national pour lui permettre de modifier vos données (examens, candidats,
              notes…). Il choisira votre département dans sa barre de périmètre.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">
          {delegations.length} délégation{delegations.length > 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-xs font-semibold text-emerald-800">
          {notice}
        </div>
      )}

      {/* Comptes nationaux disposant de la main */}
      {loading ? (
        <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
      ) : delegations.length === 0 ? (
        <p className="text-sm text-slate-400 italic">
          Aucune délégation active — le patronat national consulte votre département en lecture
          seule.
        </p>
      ) : (
        <div className="space-y-2">
          {delegations.map((d) => (
            <div
              key={d.userId}
              className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {d.name ?? 'Compte national'}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {d.email}
                  {d.grantedByName ? ` — donné par ${d.grantedByName}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded uppercase">
                  Modification autorisée
                </span>
                <button
                  type="button"
                  onClick={() => revoke(d)}
                  disabled={busy}
                  className="text-xs font-semibold text-red-700 hover:text-red-800 hover:bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                >
                  Révoquer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Accorder la main */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void grant();
        }}
        className="flex flex-col sm:flex-row gap-3 sm:items-end"
      >
        <div className="flex-1">
          <label
            htmlFor="delegation-email"
            className="block text-[10px] font-bold text-slate-400 uppercase mb-1"
          >
            Email du compte national à habiliter
          </label>
          <input
            id="delegation-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ex. coordonnateur@patronat-national.bj"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-600 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="fed-btn-gold px-4 py-2.5 text-sm whitespace-nowrap disabled:opacity-50"
        >
          {busy ? 'Traitement…' : 'Donner la main'}
        </button>
      </form>
    </div>
  );
}
