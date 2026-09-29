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

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { FedPage } from '@/components/federis/federis-motion';
import FederisSchoolDetail from '@/components/federis/FederisSchoolDetail';

interface LinkedSchool {
  id: string;
  kind: 'HELM';
  /** ⭐ Identifiant du tenant école — ouvre la fiche détail au clic. */
  schoolTenantId?: string;
  name: string;
  slug?: string;
  logo?: string | null;
  city?: string | null;
  department?: string | null;
  /** ⭐ Département résolu (fiche, sinon ville → département) — vision nationale. */
  resolvedDepartment?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  status: string;
  accessLevel: string;
  joinedAt?: string | null;
  academicYear?: string;
  candidatesCount: number;
  /** ⭐ Patronat dépositaire du lien (vision nationale uniquement). */
  patronat?: string | null;
  patronatTerritory?: string | null;
  /** ⭐ Candidats présentés PAR EXAMEN (CEP/BEPC/BAC/CAP) — compteurs de la
   *  ligne, ouverture de la fiche détail au clic sur l'école. */
  candidatesByExam?: { CEP: number; BEPC: number; BAC: number; CAP: number };
}

/** ⭐ Totaux globaux du module (toutes écoles rattachées confondues). */
interface SchoolsTotals {
  attached: number;
  pending: number;
  candidates: { CEP: number; BEPC: number; BAC: number; CAP: number };
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
  /** ⭐ Département résolu (fiche, sinon ville → département) — catégorisation. */
  resolvedDepartment?: string | null;
  /** ⭐ Ville ET département absents de la fiche — proposée à confirmer. */
  locationUnknown?: boolean;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  /** PENDING / JOINED / REJECTED / SUSPENDED / null = jamais sollicitée */
  linkStatus: string | null;
  /** ⭐ Patronat dépositaire du lien (vision nationale — ex. patronat du Borgou). */
  linkPatronat?: string | null;
}

interface DiscoverResponse {
  scope: 'DEPARTMENT' | 'COUNTRY' | null;
  territoryName: string | null;
  country?: string | null;
  orgLevel?: string | null;
  message?: string | null;
  total: number;
  schools: DiscoveredSchool[];
  /** ⭐ Écoles sans localisation renseignée (patronat territorial uniquement). */
  unlocatedSchools?: DiscoveredSchool[];
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'En attente de validation', className: 'bg-amber-100 text-amber-800' },
  JOINED: { label: 'Rattachée', className: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Demande refusée', className: 'bg-red-100 text-red-700' },
  SUSPENDED: { label: 'Suspendue', className: 'bg-red-100 text-red-700' },
  MANUAL: { label: 'Hors Helm (manuelle)', className: 'bg-gray-100 text-slate-700' },
};

// ⭐ (2026-09-29) Plus AUCUN badge de type d'établissement (mixte / école /
//    ministère…) : seuls les logos des écoles sont affichés.

const EMPTY_MANUAL_FORM = {
  name: '',
  address: '',
  contactPerson: '',
  phone: '',
  email: '',
};

/** Logo d'école (image ou initiales) — ⭐ aucun badge de type (mixte/école/ministère). */
function SchoolLogo({
  name,
  logo,
  size = 'md',
}: {
  name: string;
  logo?: string | null;
  size?: 'sm' | 'md';
}) {
  const cls = size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs';
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={name}
        className={`${cls} rounded-lg object-cover ring-1 ring-slate-200 bg-white flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${cls} rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold flex-shrink-0`}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/**
 * Ligne d'école découverte — logo + nom + localisation + statut de
 * rattachement + action. ⭐ Aucun badge de type d'établissement : seule la
 * workflow (demande en attente / rattachée) est indiquée, avec le patronat
 * dépositaire du lien le cas échéant (vision nationale).
 */
function SchoolRow({
  school,
  linking,
  onRequestLink,
}: {
  school: DiscoveredSchool;
  linking: string | null;
  onRequestLink: (school: { id: string; name: string }) => Promise<void>;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 hover:bg-[#f7f9fc]">
      <div className="flex items-center gap-3 min-w-0">
        <SchoolLogo name={school.name} logo={school.logo} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-blue-900 truncate">{school.name}</div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">
            {[school.city, school.department, school.phone].filter(Boolean).join(' · ') ||
              school.slug}
          </div>
        </div>
      </div>
      {!school.linkStatus || school.linkStatus === 'REJECTED' || school.linkStatus === 'SUSPENDED' ? (
        <button
          type="button"
          onClick={() => onRequestLink(school)}
          disabled={linking === school.id}
          className="fed-btn-navy px-4 py-1.5 text-xs disabled:opacity-50 flex-shrink-0"
        >
          {linking === school.id ? 'Envoi…' : 'Demander l\u2019adhésion'}
        </button>
      ) : (
        <span className="text-xs text-slate-400 flex-shrink-0 italic sm:text-right max-w-[16rem]">
          {school.linkStatus === 'PENDING' ? (
            <>
              Demande envoyée — en attente de l&rsquo;école
              {school.linkPatronat ? (
                <span className="block not-italic text-slate-500">{school.linkPatronat}</span>
              ) : null}
            </>
          ) : (
            <>
              Rattachée
              {school.linkPatronat ? (
                <span className="block not-italic text-slate-500">{school.linkPatronat}</span>
              ) : null}
            </>
          )}
        </span>
      )}
    </div>
  );
}

/** Champs du formulaire « école hors Academia Helm ». */
function ManualSchoolFormFields({
  manualForm,
  setManualForm,
  manualErrors,
  submittingManual,
}: {
  manualForm: typeof EMPTY_MANUAL_FORM;
  setManualForm: React.Dispatch<React.SetStateAction<typeof EMPTY_MANUAL_FORM>>;
  manualErrors: Record<string, string>;
  submittingManual: boolean;
}) {
  return (
    <>
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
          {manualErrors.name && <p className="mt-1 text-sm text-red-600">{manualErrors.name}</p>}
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
            Adresse
          </label>
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
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
              Téléphone
            </label>
            <input
              type="tel"
              value={manualForm.phone}
              onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
              className="fed-input-light px-4 py-2"
              placeholder="+229 …"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
              Email
            </label>
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
    </>
  );
}

export default function FederisSchoolsPage() {
  const [linked, setLinked] = useState<LinkedSchool[]>([]);
  const [manual, setManual] = useState<ManualSchool[]>([]);
  const [totals, setTotals] = useState<SchoolsTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ⭐ Fiche détail d'une école rattachée (2026-09-29 #3) — le clic sur une
  //    école JOINED ouvre sa fiche complète : informations, niveaux, effectifs
  //    par série et sous-onglets dynamiques des candidats présentés.
  const [selectedSchoolTenantId, setSelectedSchoolTenantId] = useState<string | null>(null);

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
      setTotals(res.data?.totals ?? null);
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
      const res = await apiClient.post(
        '/federis/patronat/schools/request-link',
        { schoolTenantId: school.id },
        { timeout: 30000 },
      );
      // ⭐ Attribution départementale : lorsque la demande est émise par le
      //    patronat NATIONAL, le lien est porté par le patronat du
      //    département de l'école — à l'acceptation, l'école se retrouve
      //    rattachée au patronat de SON département.
      const attributedTo = res.data?.attributedTo as { name: string; territoryName: string | null } | null | undefined;
      setMessage({
        type: 'success',
        text: attributedTo
          ? `Demande d'adhésion envoyée à « ${school.name} » — elle est gérée par le patronat départemental de ${attributedTo.territoryName ?? 'son département'} (${attributedTo.name}). Lorsque l'école acceptera, elle sera rattachée au patronat de son département.`
          : `Demande d'adhésion envoyée à « ${school.name} ». L'école doit accepter la demande avant que ses informations deviennent accessibles.`,
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
  const unlocatedSchools = discovery?.unlocatedSchools ?? [];
  const suggestedSchools = discovered.filter(
    (s) => !s.linkStatus || s.linkStatus === 'REJECTED' || s.linkStatus === 'SUSPENDED',
  );
  const alreadyInFlow = discovered.filter(
    (s) => s.linkStatus === 'PENDING' || s.linkStatus === 'JOINED',
  );

  // ⭐ Patronat NATIONAL — catégorisation PAR DÉPARTEMENT : chaque école est
  //    rangée sous son département résolu (fiche, sinon ville → département) ;
  //    les écoles sans département identifiable forment un groupe dédié.
  const isNationalScope = discovery?.scope === 'COUNTRY';
  const departmentGroups = useMemo(() => {
    if (!isNationalScope) return [];
    const byDept = new Map<string, DiscoveredSchool[]>();
    for (const s of discovered) {
      const key = s.resolvedDepartment ?? '__NON_RENSEIGNE__';
      if (!byDept.has(key)) byDept.set(key, []);
      byDept.get(key)!.push(s);
    }
    return [...byDept.entries()]
      .map(([dept, schools]) => ({
        department: dept === '__NON_RENSEIGNE__' ? null : dept,
        schools,
        attached: schools.filter(
          (s) => s.linkStatus === 'PENDING' || s.linkStatus === 'JOINED',
        ).length,
      }))
      .sort((a, b) => {
        // Départements avec écoles rattachées d'abord, puis ordre alphabétique ;
        // « non renseigné » toujours en dernier.
        if (a.department === null) return 1;
        if (b.department === null) return -1;
        if (b.attached !== a.attached) return b.attached - a.attached;
        return a.department.localeCompare(b.department, 'fr');
      });
  }, [discovered, isNationalScope]);

  // ⭐ Tableau des rattachées — catégorisé par département (patronat national)
  const linkedByDepartment = useMemo(() => {
    if (!isNationalScope) return [];
    const byDept = new Map<string, LinkedSchool[]>();
    for (const s of linked) {
      const key = s.resolvedDepartment ?? s.department ?? '__NON_RENSEIGNE__';
      if (!byDept.has(key)) byDept.set(key, []);
      byDept.get(key)!.push(s);
    }
    return [...byDept.entries()]
      .map(([dept, schools]) => ({
        department: dept === '__NON_RENSEIGNE__' ? null : dept,
        schools,
      }))
      .sort((a, b) => {
        if (a.department === null) return 1;
        if (b.department === null) return -1;
        return a.department!.localeCompare(b.department!, 'fr');
      });
  }, [linked, isNationalScope]);

  // ⭐ Fiche détail d'une école — remplace la liste tant qu'une école est
  //    sélectionnée (retour via le bouton « Retour aux écoles rattachées »).
  if (selectedSchoolTenantId) {
    return (
      <FederisSchoolDetail
        schoolTenantId={selectedSchoolTenantId}
        onBack={() => setSelectedSchoolTenantId(null)}
      />
    );
  }

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
          {/* ⭐ Compteurs globaux de candidats PAR EXAMEN (2026-09-29 #3) —
              mis à jour automatiquement dès qu'une école présente officiellement
              ses élèves ; le clic sur une école ouvre ses données spécifiques. */}
          {totals && (
            <div className="flex flex-wrap gap-2 mt-3">
              {(
                [
                  { key: 'CEP', label: 'Candidats CEP' },
                  { key: 'BEPC', label: 'Candidats BEPC' },
                  { key: 'BAC', label: 'Candidats Baccalauréat' },
                  { key: 'CAP', label: 'Candidats CAP' },
                ] as const
              ).map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-900/[0.04] border border-blue-100 text-[11px] font-bold text-blue-900"
                  title={`${chip.label} — toutes les écoles rattachées confondues`}
                >
                  {chip.label}
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-900 text-white tabular-nums">
                    {totals.candidates[chip.key]}
                  </span>
                </span>
              ))}
            </div>
          )}
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

      {/* ⭐ Recherche d'écoles Academia Helm — EN HAUT, juste après le bouton Créer */}
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
                <div className="flex items-center gap-3 min-w-0">
                  <SchoolLogo name={school.name} logo={school.logo ?? null} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-blue-900 truncate">{school.name}</div>
                    <div className="text-xs text-slate-400">{school.slug}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRequestLink(school)}
                  disabled={linking === school.id}
                  className="fed-btn-navy px-4 py-1.5 text-xs disabled:opacity-50 flex-shrink-0"
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
          <ManualSchoolFormFields
            manualForm={manualForm}
            setManualForm={setManualForm}
            manualErrors={manualErrors}
            submittingManual={submittingManual}
          />
        </form>
      )}

      {/* ⭐ Écoles de votre territoire — listage automatique et dynamique.
          Patronat NATIONAL : catégorisé PAR DÉPARTEMENT. */}
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
                    ? `Établissements Academia Helm de ${discovery.territoryName ?? 'votre pays'}, catégorisés par département — le patronat national coordonne l'ensemble du réseau.`
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
        ) : discovery && discovered.length === 0 && unlocatedSchools.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Aucune école Academia Helm trouvée dans votre périmètre pour le moment. Utilisez la
            recherche ci-dessus pour trouver un établissement par son nom, ou créez une école
            hors Academia Helm.
          </p>
        ) : isNationalScope ? (
          /* ── PATRONAT NATIONAL — écoles catégorisées PAR DÉPARTEMENT ── */
          <div className="mt-3 space-y-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase">
              {discovery?.total ?? 0} école(s) Academia Helm dans le pays ·{' '}
              {departmentGroups.length} département(s)
            </p>
            {departmentGroups.map((group) => (
              <div key={group.department ?? '__unknown__'} className="border border-blue-100 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-[#f7f9fc] border-b border-blue-50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <AppIcon name="building" size="submenu" className="text-blue-900 flex-shrink-0" />
                    <span className="text-sm font-bold text-blue-900 truncate">
                      {group.department ? `Département de ${group.department}` : 'Département non renseigné'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase flex-shrink-0">
                    {group.schools.length} école(s)
                    {group.attached > 0 && ` · ${group.attached} en rattachement`}
                  </span>
                </div>
                <div className="divide-y divide-blue-50">
                  {group.schools.map((school) => (
                    <SchoolRow
                      key={school.id}
                      school={school}
                      linking={linking}
                      onRequestLink={handleRequestLink}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── PATRONAT DÉPARTEMENTAL — écoles du département ── */
          <>
            {(suggestedSchools.length > 0 || alreadyInFlow.length > 0) && (
              <p className="mt-3 text-[10px] font-bold text-slate-400 uppercase">
                {discovered.length} école(s) Academia Helm dans le périmètre
                {suggestedSchools.length > 0 && ` · ${suggestedSchools.length} à solliciter`}
                {alreadyInFlow.length > 0 && ` · ${alreadyInFlow.length} déjà en rattachement`}
              </p>
            )}
            {discovered.length > 0 && (
              <div className="mt-3 border border-blue-100 rounded-xl divide-y divide-blue-50 max-h-96 overflow-y-auto">
                {discovered.map((school) => (
                  <SchoolRow
                    key={school.id}
                    school={school}
                    linking={linking}
                    onRequestLink={handleRequestLink}
                  />
                ))}
              </div>
            )}

            {/* ⭐ Écoles sans localisation renseignée (ville + département
                absents) — proposées pour ne bloquer aucune adhésion. */}
            {unlocatedSchools.length > 0 && (
              <div className="mt-4 border border-amber-200 bg-amber-50/40 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-amber-200/60">
                  <p className="text-sm font-bold text-amber-800">Localisation non renseignée</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Ces écoles Academia Helm n&rsquo;ont pas encore précisé leur ville ni leur
                    département — sollicitez-les ici si elles se trouvent dans votre périmètre.
                  </p>
                </div>
                <div className="divide-y divide-amber-100 bg-white">
                  {unlocatedSchools.map((school) => (
                    <SchoolRow
                      key={school.id}
                      school={school}
                      linking={linking}
                      onRequestLink={handleRequestLink}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

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
          {/* ⭐ Patronat NATIONAL — écoles rattachées catégorisées PAR DÉPARTEMENT */}
          {isNationalScope && linkedByDepartment.length > 0 && (
            <>
              <div className="px-6 py-3 bg-blue-900/[0.03] border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Écoles rattachées par département — vision nationale
                </p>
              </div>
              {linkedByDepartment.map((group) => (
                <div key={group.department ?? '__unknown__'}>
                  <div className="px-6 py-2.5 bg-[#f7f9fc] border-b border-slate-100 flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-blue-900">
                      {group.department ? `Département de ${group.department}` : 'Département non renseigné'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {group.schools.length} école(s)
                    </span>
                  </div>
                  <LinkedSchoolsTable
                    schools={group.schools}
                    showPatronat
                    onSelectSchool={setSelectedSchoolTenantId}
                  />
                </div>
              ))}
            </>
          )}

          {/* Patronat DÉPARTEMENTAL — tableau simple */}
          {!isNationalScope && linked.length > 0 && (
            <LinkedSchoolsTable schools={linked} onSelectSchool={setSelectedSchoolTenantId} />
          )}

          {/* Écoles hors Academia Helm (manuelles) */}
          {manual.length > 0 && (
            <>
              <div className="px-6 py-2.5 bg-[#f7f9fc] border-y border-slate-100">
                <span className="text-sm font-bold text-blue-900">
                  Hors Academia Helm ({manual.length})
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
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
            </>
          )}
        </section>
      )}
    </FedPage>
  );
}

/** Tableau des écoles rattachées (Helm) — logo + informations, avec patronat
 * dépositaire en vision nationale. ⭐ Aucun badge de type.
 *
 * ⭐ (2026-09-29 #3) Le clic sur une école RATTACHÉE (JOINED) ouvre sa fiche
 *    complète : informations de l'établissement, niveaux scolaires, effectifs
 *    des classes d'examen (Terminale par série, CAP par filière) et listes
 *    officielles des candidats par sous-onglets dynamiques CEP/BEPC/BAC/CAP.
 *    La colonne « Candidats » affiche la répartition PAR EXAMEN.
 */
function LinkedSchoolsTable({
  schools,
  showPatronat = false,
  onSelectSchool,
}: {
  schools: LinkedSchool[];
  showPatronat?: boolean;
  onSelectSchool?: (schoolTenantId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#f7f9fc] text-left text-xs text-slate-500 uppercase tracking-wide">
            <th className="px-6 py-3 font-semibold">École</th>
            <th className="px-4 py-3 font-semibold">Localisation</th>
            <th className="px-4 py-3 font-semibold">Type</th>
            {showPatronat && <th className="px-4 py-3 font-semibold">Patronat</th>}
            <th className="px-4 py-3 font-semibold">Statut</th>
            <th className="px-4 py-3 font-semibold text-center">Candidats présentés</th>
            <th className="px-4 py-3 font-semibold">Année</th>
          </tr>
        </thead>
        <tbody>
          {schools.map((school) => {
            const badge =
              STATUS_BADGES[school.status] ??
              ({ label: school.status, className: 'bg-gray-100 text-slate-700' } as const);
            // ⭐ Seule une école ayant ACCEPTÉ l'invitation (JOINED) est
            //    consultable — l'accès aux données reste contrôlé (§10.4).
            const clickable = school.status === 'JOINED' && !!onSelectSchool;
            const byExam = school.candidatesByExam;
            const exams =
              byExam && school.candidatesCount > 0
                ? (['CEP', 'BEPC', 'BAC', 'CAP'] as const).filter((k) => byExam[k] > 0)
                : [];
            return (
              <tr
                key={school.id}
                onClick={
                  clickable && school.schoolTenantId
                    ? () => onSelectSchool!(school.schoolTenantId!)
                    : undefined
                }
                className={cn(
                  'border-t border-slate-100',
                  clickable
                    ? 'cursor-pointer hover:bg-blue-50/60 transition-colors'
                    : 'hover:bg-[#f7f9fc]',
                )}
                title={
                  clickable
                    ? `Consulter la fiche de ${school.name} — informations, niveaux, effectifs et candidats présentés`
                    : undefined
                }
              >
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <SchoolLogo name={school.name} logo={school.logo ?? null} size="sm" />
                    <div className="min-w-0">
                      <div className="font-medium text-blue-900 truncate flex items-center gap-1.5">
                        <span className="truncate">{school.name}</span>
                        {clickable && (
                          <AppIcon
                            name="chevronRight"
                            size="submenu"
                            className="text-slate-300 flex-shrink-0"
                          />
                        )}
                      </div>
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
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-slate-600">
                  {school.city || school.department || school.resolvedDepartment ? (
                    <div>
                      {school.city ?? '—'}
                      {(school.department ?? school.resolvedDepartment) && (
                        <div className="text-xs text-slate-400">
                          {school.department ?? school.resolvedDepartment}
                        </div>
                      )}
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3.5 text-slate-600">Academia Helm</td>
                {showPatronat && (
                  <td className="px-4 py-3.5 text-slate-600 text-xs">
                    {school.patronat ?? '—'}
                  </td>
                )}
                <td className="px-4 py-3.5">
                  <span
                    className={cn('px-2.5 py-1 rounded-full text-[9px] font-bold uppercase', badge.className)}
                  >
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center">
                  {school.candidatesCount === 0 ? (
                    <span className="text-xs text-slate-400 italic">Aucun</span>
                  ) : exams.length > 0 ? (
                    <div className="inline-flex flex-wrap gap-1 justify-center">
                      {exams.map((k) => (
                        <span
                          key={k}
                          className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-900 text-[10px] font-bold"
                        >
                          {k} {byExam![k]}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-700 tabular-nums">{school.candidatesCount}</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-slate-600">{school.academicYear ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
