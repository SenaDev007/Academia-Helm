/**
 * FederisSchoolsPage — Écoles rattachées au patronat
 *
 * Cahier des charges §7.3 / §8.3 / wireframe §10.4 :
 *   - Rechercher une école Academia Helm existante et envoyer une demande de
 *     rattachement (validation par l'école — accès en lecture contrôlée).
 *   - Consulter le statut (en attente / validée).
 *   - Créer une école minimale si elle n'existe pas dans Academia Helm.
 *   - L'accès aux données des écoles n'est JAMAIS total (§10.4 du cadrage).
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface LinkedSchool {
  id: string;
  kind: 'HELM';
  name: string;
  slug?: string;
  logo?: string | null;
  status: string;
  accessLevel: string;
  joinedAt?: string | null;
  academicYear?: string;
  candidatesCount: number;
}

interface ManualSchool {
  id: string;
  kind: 'MANUAL';
  name: string;
  address?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  status: string;
  createdAt: string;
}

interface HelmSchoolResult {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'En attente de validation', className: 'bg-amber-100 text-amber-800' },
  JOINED: { label: 'Rattachée', className: 'bg-green-100 text-green-800' },
  SUSPENDED: { label: 'Suspendue', className: 'bg-red-100 text-red-700' },
  MANUAL: { label: 'Hors Helm (manuelle)', className: 'bg-gray-100 text-gray-700' },
};

const EMPTY_MANUAL_FORM = {
  name: '',
  address: '',
  contactPerson: '',
  phone: '',
  email: '',
};

export default function FederisSchoolsPage() {
  const [linked, setLinked] = useState<LinkedSchool[]>([]);
  const [manual, setManual] = useState<ManualSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Recherche d'écoles Helm
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HelmSchoolResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // École manuelle
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState(EMPTY_MANUAL_FORM);
  const [manualErrors, setManualErrors] = useState<Record<string, string>>({});
  const [submittingManual, setSubmittingManual] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSchools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/federis/patronat/schools', { timeout: 30000 });
      setLinked(res.data?.linked ?? []);
      setManual(res.data?.manual ?? []);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          'Impossible de charger les écoles rattachées. Veuillez réessayer.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSchools();
  }, [loadSchools]);

  // Recherche debounced des écoles Academia Helm
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await apiClient.get('/federis/patronat/schools/search', {
          params: { q },
          timeout: 15000,
        });
        setSearchResults(res.data ?? []);
      } catch (err) {
        console.error('[FederisSchools] Erreur recherche :', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  const handleRequestLink = async (school: HelmSchoolResult) => {
    setLinking(school.id);
    setMessage(null);
    try {
      await apiClient.post(
        '/federis/patronat/schools/request-link',
        { schoolTenantId: school.id },
        { timeout: 30000 },
      );
      setMessage({
        type: 'success',
        text: `Demande de rattachement envoyée à « ${school.name} ». L'école doit valider la demande avant que les données partagées deviennent accessibles.`,
      });
      setSearchQuery('');
      setSearchResults([]);
      await loadSchools();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Erreur lors de la demande de rattachement.';
      setMessage({ type: 'error', text: Array.isArray(msg) ? msg.join(' ') : String(msg) });
    } finally {
      setLinking(null);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!manualForm.name.trim()) errs.name = "Le nom de l'école est requis";
    setManualErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmittingManual(true);
    try {
      await apiClient.post(
        '/federis/patronat/schools/manual',
        {
          name: manualForm.name.trim(),
          ...(manualForm.address.trim() ? { address: manualForm.address.trim() } : {}),
          ...(manualForm.contactPerson.trim()
            ? { contactPerson: manualForm.contactPerson.trim() }
            : {}),
          ...(manualForm.phone.trim() ? { phone: manualForm.phone.trim() } : {}),
          ...(manualForm.email.trim() ? { email: manualForm.email.trim().toLowerCase() } : {}),
        },
        { timeout: 30000 },
      );
      setMessage({
        type: 'success',
        text: `École « ${manualForm.name.trim()} » créée. Elle pourra être rapprochée d'un compte Academia Helm réel ultérieurement.`,
      });
      setManualForm(EMPTY_MANUAL_FORM);
      setShowManual(false);
      await loadSchools();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Erreur lors de la création de l’école.';
      setManualErrors({ submit: Array.isArray(msg) ? msg.join(' ') : String(msg) });
    } finally {
      setSubmittingManual(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Écoles rattachées</h1>
          <p className="text-gray-600 mt-1 text-sm">
            {linked.filter((s) => s.status === 'JOINED').length} école(s) rattachée(s) ·{' '}
            {linked.filter((s) => s.status === 'PENDING').length} en attente · {manual.length}{' '}
            hors Academia Helm
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="px-5 py-2.5 border border-blue-800 text-blue-800 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors inline-flex items-center gap-2 flex-shrink-0"
        >
          <AppIcon name={showManual ? 'close' : 'add'} size="submenu" />
          {showManual ? 'Annuler' : 'Créer une école hors Helm'}
        </button>
      </div>

      {message && (
        <div
          className={cn(
            'p-4 border rounded-lg text-sm',
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-700',
          )}
        >
          {message.text}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Recherche d'écoles Academia Helm */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-gray-900 mb-1">Rattacher une école</h2>
        <p className="text-sm text-gray-500 mb-4">
          Recherchez une école déjà présente dans Academia Helm. Elle devra valider votre demande
          avant tout partage d&rsquo;informations — l&rsquo;accès reste contrôlé et jamais total.
        </p>
        <div className="relative">
          <AppIcon
            name="search"
            size="submenu"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
            placeholder="Nom de l'école (minimum 2 caractères)…"
          />
          {searching && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              Recherche…
            </span>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {searchResults.map((school) => (
              <div
                key={school.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">{school.name}</div>
                  <div className="text-xs text-gray-400">{school.slug}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRequestLink(school)}
                  disabled={linking === school.id}
                  className="px-4 py-1.5 bg-blue-800 text-white rounded-md text-xs font-semibold hover:bg-blue-900 transition-colors disabled:opacity-50"
                >
                  {linking === school.id ? 'Envoi…' : 'Demander le rattachement'}
                </button>
              </div>
            ))}
          </div>
        )}
        {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
          <p className="mt-4 text-sm text-gray-500">
            Aucune école Academia Helm trouvée pour « {searchQuery} ». Vous pouvez créer une école
            minimale ci-dessous ou inviter l&rsquo;établissement à rejoindre Academia Helm.
          </p>
        )}
      </section>

      {/* Formulaire école manuelle */}
      {showManual && (
        <form
          onSubmit={handleCreateManual}
          className="bg-white border border-blue-200 rounded-xl p-6 space-y-5"
        >
          <div>
            <h2 className="text-base font-bold text-gray-900">Nouvelle école (hors Academia Helm)</h2>
            <p className="text-sm text-gray-500 mt-1">
              École minimale pour la gestion des candidats — rapprochement possible plus tard
              d&rsquo;un compte réel.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom de l&rsquo;école <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={manualForm.name}
                onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                className={cn(
                  'w-full px-4 py-2 border rounded-md',
                  manualErrors.name ? 'border-red-300' : 'border-gray-300',
                  'focus:ring-2 focus:ring-blue-800 focus:border-blue-800',
                )}
                placeholder="Ex : Complexe Scolaire La Réussite"
              />
              {manualErrors.name && (
                <p className="mt-1 text-sm text-red-600">{manualErrors.name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Adresse</label>
              <input
                type="text"
                value={manualForm.address}
                onChange={(e) => setManualForm({ ...manualForm, address: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
                placeholder="Ville, quartier…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Personne de contact
              </label>
              <input
                type="text"
                value={manualForm.contactPerson}
                onChange={(e) => setManualForm({ ...manualForm, contactPerson: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
                placeholder="Directeur / Directrice"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
                <input
                  type="tel"
                  value={manualForm.phone}
                  onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
                  placeholder="+229 …"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={manualForm.email}
                  onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
                  placeholder="contact@ecole.com"
                />
              </div>
            </div>
          </div>

          {manualErrors.submit && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{manualErrors.submit}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submittingManual}
              className="px-6 py-2.5 bg-blue-800 text-white rounded-md font-semibold hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingManual ? 'Création…' : 'Créer l’école'}
            </button>
          </div>
        </form>
      )}

      {/* Liste des écoles */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl h-64 animate-pulse" />
      ) : linked.length + manual.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl px-6 py-14 text-center">
          <AppIcon name="building" size="dashboard" className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            Aucune école rattachée pour le moment. Utilisez la recherche ci-dessus pour envoyer une
            demande de rattachement.
          </p>
        </div>
      ) : (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-3 font-semibold">École</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 font-semibold text-center">Candidats</th>
                  <th className="px-4 py-3 font-semibold">Année</th>
                </tr>
              </thead>
              <tbody>
                {linked.map((school) => {
                  const badge =
                    STATUS_BADGES[school.status] ??
                    ({ label: school.status, className: 'bg-gray-100 text-gray-700' } as const);
                  return (
                    <tr key={school.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-3.5">
                        <div className="font-medium text-gray-900">{school.name}</div>
                        <div className="text-xs text-gray-400">
                          {school.joinedAt
                            ? `Rattachée le ${new Date(school.joinedAt).toLocaleDateString('fr-FR')}`
                            : 'Demande en attente'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">Academia Helm</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn('px-2 py-0.5 rounded text-xs font-medium', badge.className)}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center text-gray-700">
                        {school.candidatesCount}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{school.academicYear ?? '—'}</td>
                    </tr>
                  );
                })}
                {manual.map((school) => {
                  const badge = STATUS_BADGES[school.status] ?? {
                    label: school.status,
                    className: 'bg-gray-100 text-gray-700',
                  };
                  return (
                    <tr key={school.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-3.5">
                        <div className="font-medium text-gray-900">{school.name}</div>
                        <div className="text-xs text-gray-400">
                          {school.address ?? '—'}
                          {school.contactPerson ? ` · ${school.contactPerson}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">Hors Helm</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn('px-2 py-0.5 rounded text-xs font-medium', badge.className)}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center text-gray-400">—</td>
                      <td className="px-4 py-3.5 text-gray-600">—</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
