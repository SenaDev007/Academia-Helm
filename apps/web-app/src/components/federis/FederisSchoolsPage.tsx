/**
 * FederisSchoolsPage — Écoles rattachées au patronat
 *
 * Cahier des charges §7.3 / §8.3 / wireframe §10.4 :
 *   - ⭐ « Écoles de votre territoire » (2026-09-29) : listage AUTOMATIQUE et
 *     dynamique des écoles Academia Helm du même département que le patronat
 *     (ou du même pays pour un patronat national) — GET
 *     /federis/patronat/schools/discover. Chaque école est proposée avec son
 *     statut de rattachement et un bouton « Demander le rattachement ».
 *   - Rechercher une école Academia Helm existante et envoyer une demande de
 *     rattachement (validation par l'école — accès en lecture contrôlée).
 *   - Consulter le statut (en attente / validée) + informations de l'école
 *     (ville, département, contact) une fois le rattachement validé.
 *   - Créer une école minimale si elle n'existe pas dans Academia Helm.
 *   - L'accès aux données des écoles n'est JAMAIS total (§10.4 du cadrage).
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { FedPage } from '@/components/federis/federis-motion';

interface LinkedSchool {
  id: string;
  kind: 'HELM';
  name: string;
  slug?: string;
  logo?: string | null;
  city?: string | null;
  department?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
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

/** École du périmètre territorial proposée automatiquement (discover). */
interface DiscoveredSchool {
  id: string;
  name: string;
  slug: string;
  subdomain?: string | null;
  tenantType?: string | null;
  logo?: string | null;
  city?: string | null;
  department?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  /** PENDING / JOINED / REJECTED / SUSPENDED / null = jamais sollicitée */
  linkStatus: string | null;
}

interface DiscoverResponse {
  scope: 'DEPARTMENT' | 'COUNTRY' | null;
  territoryName: string | null;
  country?: string | null;
  orgLevel?: string | null;
  message?: string | null;
  total: number;
  schools: DiscoveredSchool[];
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'En attente de validation', className: 'bg-amber-100 text-amber-800' },
  JOINED: { label: 'Rattachée', className: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Demande refusée', className: 'bg-red-100 text-red-700' },
  SUSPENDED: { label: 'Suspendue', className: 'bg-red-100 text-red-700' },
  MANUAL: { label: 'Hors Helm (manuelle)', className: 'bg-gray-100 text-slate-700' },
};

/** Libellé lisible du type d'établissement (tenant.type Helm). */
const TENANT_TYPE_LABELS: Record<string, string> = {
  MATERNELLE: 'Maternelle',
  PRIMAIRE: 'Primaire',
  SECONDAIRE: 'Secondaire',
  MIXTE: 'Mixte',
  SCHOOL: 'École',
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

  // ⭐ Découverte automatique — écoles du même département / pays
  const [discovery, setDiscovery] = useState<DiscoverResponse | null>(null);
  const [discovering, setDiscovering] = useState(true);

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

  /** ⭐ Découverte automatique — écoles Academia Helm du périmètre. */
  const loadDiscovery = useCallback(async () => {
    setDiscovering(true);
    try {
      const res = await apiClient.get('/federis/patronat/schools/discover', { timeout: 30000 });
      setDiscovery(res.data ?? null);
    } catch {
      // La découverte est une aide — son échec ne bloque jamais la page
      setDiscovery(null);
    } finally {
      setDiscovering(false);
    }
  }, []);

  useEffect(() => {
    void loadSchools();
    void loadDiscovery();
  }, [loadSchools, loadDiscovery]);

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
      } catch (err: any) {
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

  /** Envoi d'une demande de rattachement (école découverte OU recherchée). */
  const handleRequestLink = async (school: { id: string; name: string }) => {
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
        text: `Demande d'adhésion envoyée à « ${school.name} ». L'école doit accepter la demande avant que ses informations deviennent accessibles.`,
      });
      setSearchQuery('');
      setSearchResults([]);
      await Promise.all([loadSchools(), loadDiscovery()]);
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

  // ── Écoles suggérées : jamais sollicitées ou refusées/suspendues
  //    (rattachées & en attente = déjà dans le flux, affichées avec statut)
  const discovered = discovery?.schools ?? [];
  const suggestedSchools = discovered.filter(
    (s) => !s.linkStatus || s.linkStatus === 'REJECTED' || s.linkStatus === 'SUSPENDED',
  );
  const alreadyInFlow = discovered.filter(
    (s) => s.linkStatus === 'PENDING' || s.linkStatus === 'JOINED',
  );

  return (
    <FedPage className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="fed-badge mb-3">Module réseau</div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900 tracking-tight">Écoles rattachées</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">
            {linked.filter((s) => s.status === 'JOINED').length} école(s) rattachée(s) ·{' '}
            {linked.filter((s) => s.status === 'PENDING').length} en attente · {manual.length}{' '}
            hors Academia Helm
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="fed-btn-gold px-4 py-2.5 text-sm flex-shrink-0"
        >
          <AppIcon name={showManual ? 'close' : 'add'} size="submenu" />
          {showManual ? 'Annuler' : 'Créer une école hors Helm'}
        </button>
      </div>

      {message && (
        <div
          className={cn(
            'p-4 border rounded-xl text-sm',
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-700',
          )}
        >
          {message.text}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ⭐ Écoles de votre territoire — listage automatique et dynamique */}
      <section className="fed-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
          <div>
            <h2 className="text-base font-bold text-blue-900 flex items-center gap-2">
              <AppIcon name="network" size="submenu" className="text-blue-900" />
              Écoles de votre territoire
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {discovering
                ? 'Recherche des écoles Academia Helm de votre périmètre…'
                : discovery?.scope === 'DEPARTMENT'
                  ? `Établissements Academia Helm du département de ${discovery.territoryName ?? 'votre territoire'} — cliquez sur « Demander l'adhésion » pour lancer le rattachement.`
                  : discovery?.scope === 'COUNTRY'
                    ? `Établissements Academia Helm de ${discovery.territoryName ?? 'votre pays'} — le patronat national coordonne l'ensemble du réseau.`
                    : (discovery?.message ??
                      'Les écoles de votre département apparaîtront ici automatiquement.')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadDiscovery()}
            disabled={discovering}
            className="flex-shrink-0 px-3 py-2 bg-blue-50 text-blue-900 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50"
            title="Rafraîchir la liste des écoles du territoire"
          >
            <AppIcon name="refresh" size="submenu" />
            Actualiser
          </button>
        </div>

        {discovering ? (
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : discovery && discovered.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Aucune école Academia Helm trouvée dans votre périmètre pour le moment. Utilisez la
            recherche ci-dessous pour trouver un établissement par son nom, ou créez une école
            hors Academia Helm.
          </p>
        ) : (
          <>
            {(suggestedSchools.length > 0 || alreadyInFlow.length > 0) && (
              <p className="mt-3 text-[10px] font-bold text-slate-400 uppercase">
                {discovery?.total ?? 0} école(s) Academia Helm dans le périmètre
                {suggestedSchools.length > 0 && ` · ${suggestedSchools.length} à solliciter`}
                {alreadyInFlow.length > 0 && ` · ${alreadyInFlow.length} déjà en rattachement`}
              </p>
            )}
            {discovered.length > 0 && (
              <div className="mt-3 border border-blue-100 rounded-xl divide-y divide-blue-50 max-h-96 overflow-y-auto">
                {discovered.map((school) => {
                  const badge = school.linkStatus
                    ? (STATUS_BADGES[school.linkStatus] ?? {
                        label: school.linkStatus,
                        className: 'bg-gray-100 text-slate-700',
                      })
                    : null;
                  return (
                    <div
                      key={school.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 hover:bg-[#f7f9fc]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-blue-900">{school.name}</span>
                          {school.tenantType && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-50 text-blue-800">
                              {TENANT_TYPE_LABELS[school.tenantType] ?? school.tenantType}
                            </span>
                          )}
                          {badge && (
                            <span
                              className={cn(
                                'px-2.5 py-1 rounded-full text-[9px] font-bold uppercase',
                                badge.className,
                              )}
                            >
                              {badge.label}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {[school.city, school.department, school.phone]
                            .filter(Boolean)
                            .join(' · ') || school.slug}
                        </div>
                      </div>
                      {!school.linkStatus || school.linkStatus === 'REJECTED' || school.linkStatus === 'SUSPENDED' ? (
                        <button
                          type="button"
                          onClick={() => handleRequestLink(school)}
                          disabled={linking === school.id}
                          className="fed-btn-navy px-4 py-1.5 text-xs disabled:opacity-50 flex-shrink-0"
                        >
                          {linking === school.id ? 'Envoi…' : 'Demander l\u2019adhésion'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 flex-shrink-0 italic">
                          {school.linkStatus === 'PENDING'
                            ? 'Demande envoyée — en attente de l\u2019école'
                            : 'Rattachée'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      {/* Recherche d'écoles Academia Helm */}
      <section className="fed-card p-6">
        <h2 className="text-base font-bold text-blue-900 mb-1">Rechercher une école</h2>
        <p className="text-sm text-slate-500 mb-4">
          Vous ne trouvez pas une école dans la liste de votre territoire ? Recherchez-la par son
          nom dans tout Academia Helm. Elle devra accepter votre demande avant tout partage
          d&rsquo;informations — l&rsquo;accès reste contrôlé et jamais total.
        </p>
        <div className="relative">
          <AppIcon
            name="search"
            size="submenu"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="fed-input-light w-full pl-11 pr-4 py-3"
            placeholder="Nom de l'école (minimum 2 caractères)…"
          />
          {searching && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              Recherche…
            </span>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 border border-blue-100 rounded-xl divide-y divide-blue-50 max-h-72 overflow-y-auto">
            {searchResults.map((school) => (
              <div
                key={school.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-[#f7f9fc]"
              >
                <div>
                  <div className="text-sm font-medium text-blue-900">{school.name}</div>
                  <div className="text-xs text-slate-400">{school.slug}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRequestLink(school)}
                  disabled={linking === school.id}
                  className="fed-btn-navy px-4 py-1.5 text-xs disabled:opacity-50"
                >
                  {linking === school.id ? 'Envoi…' : 'Demander le rattachement'}
                </button>
              </div>
            ))}
          </div>
        )}
        {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">
            Aucune école Academia Helm trouvée pour « {searchQuery} ». Vous pouvez créer une école
            minimale ci-dessous ou inviter l&rsquo;établissement à rejoindre Academia Helm.
          </p>
        )}
      </section>

      {/* Formulaire école manuelle */}
      {showManual && (
        <form
          onSubmit={handleCreateManual}
          className="fed-card p-6 space-y-5"
        >
          <div>
            <h2 className="text-base font-bold text-blue-900">Nouvelle école (hors Academia Helm)</h2>
            <p className="text-sm text-slate-500 mt-1">
              École minimale pour la gestion des candidats — rapprochement possible plus tard
              d&rsquo;un compte réel.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Nom de l&rsquo;école <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={manualForm.name}
                onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                className={cn(
                  'fed-input-light px-4 py-2',
                  manualErrors.name ? '!border-red-400' : '',
                )}
                placeholder="Ex : Complexe Scolaire La Réussite"
              />
              {manualErrors.name && (
                <p className="mt-1 text-sm text-red-600">{manualErrors.name}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Adresse</label>
              <input
                type="text"
                value={manualForm.address}
                onChange={(e) => setManualForm({ ...manualForm, address: e.target.value })}
                className="fed-input-light px-4 py-2"
                placeholder="Ville, quartier…"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Personne de contact
              </label>
              <input
                type="text"
                value={manualForm.contactPerson}
                onChange={(e) => setManualForm({ ...manualForm, contactPerson: e.target.value })}
                className="fed-input-light px-4 py-2"
                placeholder="Directeur / Directrice"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Téléphone</label>
                <input
                  type="tel"
                  value={manualForm.phone}
                  onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                  className="fed-input-light px-4 py-2"
                  placeholder="+229 …"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Email</label>
                <input
                  type="email"
                  value={manualForm.email}
                  onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                  className="fed-input-light px-4 py-2"
                  placeholder="contact@ecole.com"
                />
              </div>
            </div>
          </div>

          {manualErrors.submit && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{manualErrors.submit}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submittingManual}
              className="fed-btn-gold px-6 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingManual ? 'Création…' : 'Créer l’école'}
            </button>
          </div>
        </form>
      )}

      {/* Liste des écoles rattachées — informations complètes de l'établissement */}
      {loading ? (
        <div className="fed-card h-64 animate-pulse" />
      ) : linked.length + manual.length === 0 ? (
        <div className="fed-card px-6 py-14 text-center">
          <AppIcon name="building" size="dashboard" className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            Aucune école rattachée pour le moment. Sollicitez les écoles de votre territoire
            ci-dessus ou utilisez la recherche pour envoyer une demande d&apos;adhésion.
          </p>
        </div>
      ) : (
        <section className="fed-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f7f9fc] text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-6 py-3 font-semibold">École</th>
                  <th className="px-4 py-3 font-semibold">Localisation</th>
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
                    ({ label: school.status, className: 'bg-gray-100 text-slate-700' } as const);
                  return (
                    <tr key={school.id} className="border-t border-slate-100 hover:bg-[#f7f9fc]">
                      <td className="px-6 py-3.5">
                        <div className="font-medium text-blue-900">{school.name}</div>
                        <div className="text-xs text-slate-400">
                          {school.joinedAt
                            ? `Rattachée le ${new Date(school.joinedAt).toLocaleDateString('fr-FR')}`
                            : 'Demande en attente'}
                        </div>
                        {(school.phone || school.email) && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            {[school.phone, school.email].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {school.city || school.department ? (
                          <div>
                            {school.city ?? '—'}
                            {school.department ? (
                              <div className="text-xs text-slate-400">{school.department}</div>
                            ) : null}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">Academia Helm</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn('px-2.5 py-1 rounded-full text-[9px] font-bold uppercase', badge.className)}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-700">
                        {school.candidatesCount}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{school.academicYear ?? '—'}</td>
                    </tr>
                  );
                })}
                {manual.map((school) => {
                  const badge = STATUS_BADGES[school.status] ?? {
                    label: school.status,
                    className: 'bg-gray-100 text-slate-700',
                  };
                  return (
                    <tr key={school.id} className="border-t border-slate-100 hover:bg-[#f7f9fc]">
                      <td className="px-6 py-3.5">
                        <div className="font-medium text-blue-900">{school.name}</div>
                        <div className="text-xs text-slate-400">
                          {school.address ?? '—'}
                          {school.contactPerson ? ` · ${school.contactPerson}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">—</td>
                      <td className="px-4 py-3.5 text-slate-600">Hors Helm</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn('px-2.5 py-1 rounded-full text-[9px] font-bold uppercase', badge.className)}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-400">—</td>
                      <td className="px-4 py-3.5 text-slate-600">—</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </FedPage>
  );
}
