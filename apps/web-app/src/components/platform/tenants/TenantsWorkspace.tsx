'use client';

import { useState, useCallback } from 'react';
import {
  Search,
  Loader2,
  AlertCircle,
  Pause,
  Play,
  Pencil,
  Trash2,
  X,
  Check,
  Languages,
  AlertTriangle,
  Clock,
  Plus,
  School,
  CreditCard,
  User,
} from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  subdomain?: string;
  type?: string;
  country: string;
  city: string;
  /** Adresse postale (School.address) — modifiable depuis le back-office. */
  address?: string | null;
  /** Téléphone principal (School.primaryPhone) — modifiable depuis le back-office. */
  phone?: string | null;
  /** Email principal (School.primaryEmail) — modifiable depuis le back-office. */
  email?: string | null;
  plan: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
  /** Statut précis de l'abonnement Helm (ACTIVE, TRIALING, GRACE_PERIOD, SUSPENDED, BLOCKED). */
  planStatus?: string | null;
  billingCycle?: string | null;
  /** Jours restants avant expiration (couleur si < 7). null si non applicable. */
  daysRemaining?: number | null;
  /** Date de fin d'essai (ISO) ou null. */
  trialEnd?: string | null;
  /** Mode bilingue activé pour l'abonnement. */
  bilingualEnabled?: boolean;
  /** Ajout d'élèves bloqué (dépassement + période de grâce expirée). */
  studentEnrollmentBlocked?: boolean;
  students: number;
  lastActivity: string;
  expiration: string | null;
  createdAt: string;
}

interface TenantsData {
  tenants: Tenant[];
  total: number;
  page: number;
  limit: number;
}

const PLANS = [
  { code: 'SEED', label: 'Helm Seed' },
  { code: 'GROW', label: 'Helm Grow' },
  { code: 'LEAD', label: 'Helm Lead' },
  { code: 'NETWORK', label: 'Helm Network' },
] as const;

const TENANT_TYPES = [
  { code: 'SCHOOL', label: 'École' },
] as const;

const PLAN_STATUSES = [
  { code: 'ACTIVE', label: 'Actif' },
  { code: 'TRIALING', label: 'Période d\'essai' },
  { code: 'GRACE_PERIOD', label: 'Période de grâce' },
  { code: 'SUSPENDED', label: 'Suspendu' },
  { code: 'BLOCKED', label: 'Bloqué' },
] as const;

const BILLING_CYCLES = [
  { code: 'MONTHLY', label: 'Mensuel' },
  { code: 'ANNUAL', label: 'Annuel' },
] as const;

/** Options pour le modal de création manuelle d'une école. */
const CREATE_PLANS = [
  { code: 'SEED', label: 'Helm Seed', price: '19 900 FCFA / mois' },
  { code: 'GROW', label: 'Helm Grow', price: '24 900 FCFA / mois' },
  { code: 'LEAD', label: 'Helm Lead', price: '39 900 FCFA / mois' },
  { code: 'NETWORK', label: 'Helm Network', price: 'Sur devis' },
] as const;

const CREATE_BILLING_CYCLES = [
  { code: 'MONTHLY', label: 'Mensuel' },
  { code: 'ANNUAL', label: 'Annuel (−2 mois)' },
] as const;

const CREATE_PAYMENT_METHODS = [
  { code: 'CASH', label: 'Espèces' },
  { code: 'MOBILE_MONEY', label: 'Mobile Money' },
  { code: 'CARD', label: 'Carte bancaire' },
] as const;

const CREATE_SCHOOL_TYPES = [
  { code: 'MATERNELLE', label: 'Maternelle' },
  { code: 'PRIMAIRE', label: 'Primaire' },
  { code: 'SECONDAIRE', label: 'Secondaire' },
  { code: 'MIXTE', label: 'Mixte (Maternelle - Secondaire)' },
] as const;

const CREATE_COUNTRIES = [
  { code: 'Bénin', label: 'Bénin' },
  { code: 'Togo', label: 'Togo' },
  { code: 'Côte d\'Ivoire', label: 'Côte d\'Ivoire' },
  { code: 'Sénégal', label: 'Sénégal' },
] as const;

type CreateForm = {
  schoolName: string;
  schoolType: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  bilingual: boolean;
  preferredSubdomain: string;
  plan: string;
  billingCycle: string;
  paymentMethod: string;
  promoterFirstName: string;
  promoterLastName: string;
  promoterEmail: string;
  promoterPhone: string;
  promoterPassword: string;
};

/** Génère un sous-domaine propre à partir du nom de l'école. */
function slugifySchoolName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

type EditForm = {
  name: string;
  subdomain: string;
  type: string;
  /** Pays (Tenant.country) — affiché en lecture seule dans le formulaire d'édition. */
  country: string;
  /** Ville (School.city) — modifiable. */
  city: string;
  /** Adresse postale (School.address) — modifiable. */
  address: string;
  /** Téléphone principal (School.primaryPhone) — modifiable. */
  phone: string;
  /** Email principal (School.primaryEmail) — modifiable. */
  email: string;
  plan: string;
  planStatus: string;
  billingCycle: string;
  expiration: string;
  trialEnd: string;
  bilingualEnabled: boolean;
  studentEnrollmentBlocked: boolean;
};

/** Couleurs du badge planStatus (préfixe cohérent avec l'onglet Abonnements). */
function planStatusBadgeClass(planStatus?: string | null): string {
  switch (planStatus) {
    case 'ACTIVE':
      return 'bg-emerald-100 text-emerald-700';
    case 'TRIALING':
      return 'bg-sky-100 text-sky-700';
    case 'GRACE_PERIOD':
      return 'bg-amber-100 text-amber-700';
    case 'SUSPENDED':
    case 'BLOCKED':
      return 'bg-red-100 text-red-700';
    case 'CANCELED':
      return 'bg-slate-200 text-slate-600';
    default:
      return 'bg-slate-100 text-slate-500';
  }
}

function planStatusLabel(planStatus?: string | null): string {
  switch (planStatus) {
    case 'ACTIVE':
      return 'Actif';
    case 'TRIALING':
      return 'Essai';
    case 'GRACE_PERIOD':
      return 'Grâce';
    case 'SUSPENDED':
      return 'Suspendu';
    case 'BLOCKED':
      return 'Bloqué';
    case 'CANCELED':
      return 'Annulé';
    default:
      return planStatus || '—';
  }
}

/** Helper component for displaying a label-value pair in the details modal. */
function DetailField({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-slate-700 font-medium mt-0.5">{value != null && value !== '' && value !== '—' ? value : <span className="text-slate-300">—</span>}</dd>
    </div>
  );
}

/** Couleur pour la cellule "Jours restants" : vert > 7, ambre 3-7, rouge < 3. */
function daysRemainingClass(days: number | null | undefined): string {
  if (days === null || days === undefined) return 'text-slate-400';
  if (days < 3) return 'text-red-600 font-bold';
  if (days <= 7) return 'text-amber-600 font-bold';
  return 'text-emerald-700 font-semibold';
}

export default function TenantsWorkspace() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, loading, error, refetch } = usePlatformData<TenantsData>(
    `/tenants?search=${encodeURIComponent(searchTerm)}&status=${statusFilter}`,
  );

  // Edit modal state
  const [editTarget, setEditTarget] = useState<Tenant | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: '', subdomain: '', type: 'SCHOOL',
    country: '', city: '', address: '', phone: '', email: '',
    plan: 'SEED',
    planStatus: 'ACTIVE', billingCycle: 'MONTHLY',
    expiration: '', trialEnd: '', bilingualEnabled: false,
    studentEnrollmentBlocked: false,
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Details modal state
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [detailsData, setDetailsData] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const openDetails = async (tenantId: string) => {
    setDetailsId(tenantId);
    setDetailsData(null);
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      const res = await fetch(`/api/platform/tenants/${tenantId}/details`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || j?.message || `Erreur ${res.status}`);
      }
      const data = await res.json();
      setDetailsData(data);
    } catch (err: any) {
      setDetailsError(err.message || 'Erreur lors du chargement des détails');
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailsId(null);
    setDetailsData(null);
    setDetailsError(null);
    setDetailsLoading(false);
  };

  // Create modal state (manual school creation)
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    schoolName: '', schoolType: 'PRIMAIRE', city: '', country: 'Bénin',
    phone: '', email: '', bilingual: false, preferredSubdomain: '',
    plan: 'SEED', billingCycle: 'MONTHLY', paymentMethod: 'CASH',
    promoterFirstName: '', promoterLastName: '', promoterEmail: '',
    promoterPhone: '', promoterPassword: '',
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const openCreate = () => {
    setCreateForm({
      schoolName: '', schoolType: 'PRIMAIRE', city: '', country: 'Bénin',
      phone: '', email: '', bilingual: false, preferredSubdomain: '',
      plan: 'SEED', billingCycle: 'MONTHLY', paymentMethod: 'CASH',
      promoterFirstName: '', promoterLastName: '', promoterEmail: '',
      promoterPhone: '', promoterPassword: '',
    });
    setCreateError(null);
    setCreateSuccess(null);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (submitting) return;
    setCreateOpen(false);
    setCreateError(null);
    setCreateSuccess(null);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    if (!createForm.schoolName.trim()) {
      setCreateError("Le nom de l'établissement est requis.");
      return;
    }
    if (!createForm.city.trim()) {
      setCreateError('La ville est requise.');
      return;
    }
    if (!createForm.phone.trim()) {
      setCreateError("Le téléphone de l'établissement est requis.");
      return;
    }
    if (!createForm.email.trim()) {
      setCreateError("L'email de l'établissement est requis.");
      return;
    }
    if (!createForm.promoterFirstName.trim() || !createForm.promoterLastName.trim()) {
      setCreateError('Le prénom et le nom du promoteur sont requis.');
      return;
    }
    if (!createForm.promoterEmail.trim() || !createForm.promoterPhone.trim()) {
      setCreateError('Email et téléphone du promoteur sont requis.');
      return;
    }
    if (createForm.promoterPassword.length < 8) {
      setCreateError('Le mot de passe du promoteur doit contenir au moins 8 caractères.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/platform/tenants/create-manual', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: createForm.schoolName.trim(),
          schoolType: createForm.schoolType,
          city: createForm.city.trim(),
          country: createForm.country,
          phone: createForm.phone.trim(),
          email: createForm.email.trim(),
          bilingual: createForm.bilingual,
          preferredSubdomain: createForm.preferredSubdomain.trim() || slugifySchoolName(createForm.schoolName),
          plan: createForm.plan,
          billingCycle: createForm.billingCycle,
          paymentMethod: createForm.paymentMethod,
          promoterFirstName: createForm.promoterFirstName.trim(),
          promoterLastName: createForm.promoterLastName.trim(),
          promoterEmail: createForm.promoterEmail.trim(),
          promoterPhone: createForm.promoterPhone.trim(),
          promoterPassword: createForm.promoterPassword,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || j?.message || `Erreur ${res.status}`);
      }
      setCreateSuccess('École créée avec succès. Le promoteur va recevoir ses identifiants.');
      setTimeout(() => {
        setSubmitting(false);
        setCreateOpen(false);
        setCreateError(null);
        setCreateSuccess(null);
        refetch();
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la création';
      setCreateError(msg);
      setSubmitting(false);
    }
  };

  const handleToggleStatus = useCallback(async (tenantId: string, currentStatus: string) => {
    setActionLoading(tenantId);
    setActionError(null);
    try {
      const newStatus = currentStatus === 'SUSPENDED' ? 'active' : 'suspended';
      const res = await fetch(`/api/platform/tenants/${tenantId}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Erreur ${res.status}`);
      }
      refetch();
    } catch (err: any) {
      setActionError(err.message || 'Erreur lors de la modification du statut');
    } finally {
      setActionLoading(null);
    }
  }, [refetch]);

  const openEdit = (t: Tenant) => {
    setEditTarget(t);
    const upper = (t.plan || '').toUpperCase();
    const planCode = (PLANS as readonly { code: string; label: string }[]).find(p => p.code === upper) ? upper : 'SEED';
    setEditForm({
      name: t.name || '',
      subdomain: t.subdomain || '',
      type: 'SCHOOL',
      country: t.country && t.country !== '—' ? t.country : '',
      city: t.city && t.city !== '—' ? t.city : '',
      address: t.address || '',
      phone: t.phone || '',
      email: t.email || '',
      plan: planCode,
      planStatus: t.planStatus || 'ACTIVE',
      billingCycle: t.billingCycle || 'MONTHLY',
      expiration: t.expiration ? t.expiration.split('T')[0] : '',
      trialEnd: t.trialEnd ? t.trialEnd.split('T')[0] : '',
      bilingualEnabled: t.bilingualEnabled || false,
      studentEnrollmentBlocked: t.studentEnrollmentBlocked || false,
    });
    setEditError(null);
    setEditSuccess(null);
  };

  const closeEdit = () => {
    if (submitting) return;
    setEditTarget(null);
    setEditError(null);
    setEditSuccess(null);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditError(null);
    setEditSuccess(null);
    if (!editForm.name.trim()) {
      setEditError("Le nom de l'établissement est requis.");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: editForm.name.trim(),
        type: editForm.type,
        plan: editForm.plan,
        planStatus: editForm.planStatus,
        billingCycle: editForm.billingCycle,
        bilingualEnabled: editForm.bilingualEnabled,
        studentEnrollmentBlocked: editForm.studentEnrollmentBlocked,
        // Champs School (entité 1-1) — envoyés systématiquement pour permettre la mise à jour
        city: editForm.city.trim(),
        address: editForm.address.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
      };
      if (editForm.subdomain.trim()) body.subdomain = editForm.subdomain.trim();
      if (editForm.expiration) body.expiration = editForm.expiration;
      if (editForm.trialEnd) body.trialEnd = editForm.trialEnd;
      const res = await fetch(`/api/platform/tenants/${editTarget.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || j?.message || `Erreur ${res.status}`);
      }
      setEditSuccess('Établissement mis à jour.');
      setTimeout(() => {
        setSubmitting(false);
        setEditTarget(null);
        setEditError(null);
        setEditSuccess(null);
        refetch();
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la modification';
      setEditError(msg);
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/platform/tenants/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || j?.message || `Erreur ${res.status}`);
      }
      setDeleting(false);
      setDeleteTarget(null);
      setDeleteError(null);
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la suppression';
      setDeleteError(msg);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Écoles / Tenants</h1>
          <p className="text-slate-500">Gestion des établissements inscrits sur la plateforme</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            Créer une école
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher une école..."
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all w-full md:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="ALL">Tous statuts</option>
            <option value="ACTIVE">Actifs</option>
            <option value="TRIAL">Essai</option>
            <option value="SUSPENDED">Suspendus</option>
          </select>
        </div>
      </div>

      {actionError && !editTarget && !deleteTarget && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {loading ? <PlatformLoading label="Chargement des écoles…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data || data.tenants.length === 0 ? <PlatformEmpty title="Aucune école" description="Aucun établissement ne correspond à votre recherche." /> : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100 text-xs text-slate-500">
            {data.total} établissement(s) au total
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase min-w-[280px]">École</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Pays / Ville</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Plan</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Statut</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Jours restants</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Élèves</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Options</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Expiration</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.tenants.map((t) => {
                  const planStatus = t.planStatus || null;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4">
                        <button
                          onClick={() => openDetails(t.id)}
                          className="font-bold text-slate-900 text-left hover:text-blue-700 hover:underline cursor-pointer"
                          title={t.name}
                        >
                          {t.name}
                        </button>
                        <div
                          className="text-xs text-slate-500 font-mono"
                          title={t.slug}
                        >
                          {t.slug}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-slate-700">{t.country}</div>
                        <div className="text-xs text-slate-400">{t.city !== '—' ? t.city : '—'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs font-bold text-amber-700 uppercase">
                          {(() => {
                            const p = (PLANS as readonly { code: string; label: string }[]).find(p => p.code === (t.plan || '').toUpperCase());
                            return p ? p.label : t.plan;
                          })()}
                        </span>
                        {t.billingCycle && (
                          <div className="text-[10px] text-slate-400 uppercase mt-0.5">
                            {t.billingCycle === 'ANNUAL' ? 'Annuel' : t.billingCycle === 'MONTHLY' ? 'Mensuel' : t.billingCycle}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {/* Badge précis basé sur planStatus, fallback sur l'ancien statut */}
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${planStatusBadgeClass(
                            planStatus,
                          )}`}
                        >
                          {planStatusLabel(planStatus)}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-sm ${daysRemainingClass(t.daysRemaining)}`}>
                        {t.daysRemaining === null || t.daysRemaining === undefined ? (
                          <span className="text-slate-400 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> —
                          </span>
                        ) : t.daysRemaining > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {t.daysRemaining} j
                          </span>
                        ) : (
                          <span className="text-red-700 font-bold">Expiré</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{t.students}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {t.bilingualEnabled && (
                            <span
                              title="Mode bilingue activé"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700"
                            >
                              <Languages className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {t.studentEnrollmentBlocked && (
                            <span
                              title="Inscription d'élèves bloquée"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-100 text-red-700"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {!t.bilingualEnabled && !t.studentEnrollmentBlocked && (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {t.expiration ? new Date(t.expiration).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => handleToggleStatus(t.id, t.status)}
                            disabled={actionLoading === t.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                              t.status === 'SUSPENDED'
                                ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                            } disabled:opacity-50`}
                            title={t.status === 'SUSPENDED' ? 'Réactiver' : 'Suspendre'}
                          >
                            {actionLoading === t.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : t.status === 'SUSPENDED' ? (
                              <>
                                <Play className="w-3.5 h-3.5" /> Réactiver
                              </>
                            ) : (
                              <>
                                <Pause className="w-3.5 h-3.5" /> Suspendre
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => openEdit(t)}
                            title="Modifier"
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-900 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTarget(t);
                              setDeleteError(null);
                            }}
                            title="Supprimer"
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                  <School className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-blue-900">Modifier l'établissement</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ID : <span className="font-mono">{editTarget.id}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={closeEdit}
                disabled={submitting}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitEdit} className="p-6 space-y-5">
              {/* Section 1 — Informations de l'établissement (alignée sur l'onboarding) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <School className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Informations de l'établissement</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nom officiel de l'établissement *</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      placeholder="École Primaire Les Étoiles"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Sous-domaine</label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={editForm.subdomain}
                        onChange={(e) => setEditForm({ ...editForm, subdomain: e.target.value })}
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-l-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                        placeholder="mon-ecole"
                      />
                      <span className="px-3 py-2 bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-xs text-slate-500 font-mono">.academiahelm.com</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Laisser tel quel pour conserver l'actuel.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Type</label>
                    <select
                      value={editForm.type}
                      onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    >
                      {TENANT_TYPES.map((ty) => (
                        <option key={ty.code} value={ty.code}>{ty.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pays</label>
                    <input
                      type="text"
                      value={editForm.country}
                      disabled
                      readOnly
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed"
                      placeholder="—"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Le pays est défini à la création et n'est pas modifiable.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ville *</label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      placeholder="Cotonou"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Adresse</label>
                    <input
                      type="text"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      placeholder="Rue 123, Quartier"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Téléphone de l'établissement *</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      placeholder="+229 00 00 00 00"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email de l'établissement *</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      placeholder="contact@ecole.org"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2 — Abonnement */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Abonnement</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Plan</label>
                    <select
                      value={editForm.plan}
                      onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    >
                      {PLANS.map((p) => (
                        <option key={p.code} value={p.code}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Statut abonnement</label>
                    <select
                      value={editForm.planStatus}
                      onChange={(e) => setEditForm({ ...editForm, planStatus: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    >
                      {PLAN_STATUSES.map((s) => (
                        <option key={s.code} value={s.code}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Cycle de facturation</label>
                    <select
                      value={editForm.billingCycle}
                      onChange={(e) => setEditForm({ ...editForm, billingCycle: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    >
                      {BILLING_CYCLES.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date d'expiration</label>
                    <input
                      type="date"
                      value={editForm.expiration}
                      onChange={(e) => setEditForm({ ...editForm, expiration: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Fin de la période d'essai</label>
                  <input
                    type="date"
                    value={editForm.trialEnd}
                    onChange={(e) => setEditForm({ ...editForm, trialEnd: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Section 3 — Contrôles manuels */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Contrôles manuels</h3>
                </div>
                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer">
                  <div>
                    <span className="text-sm font-semibold text-slate-700">Option bilingue (FR + EN)</span>
                    <p className="text-xs text-slate-400 mt-0.5">Active les parcours académiques bilingues</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, bilingualEnabled: !editForm.bilingualEnabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.bilingualEnabled ? 'bg-amber-500' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.bilingualEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer">
                  <div>
                    <span className="text-sm font-semibold text-slate-700">Bloquer l'ajout d'élèves</span>
                    <p className="text-xs text-slate-400 mt-0.5">Empêche l'inscription de nouveaux élèves</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, studentEnrollmentBlocked: !editForm.studentEnrollmentBlocked })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.studentEnrollmentBlocked ? 'bg-red-500' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.studentEnrollmentBlocked ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>
              </div>

              {editError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}
              {editSuccess && (
                <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{editSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white shadow-md transition-all"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal — Création manuelle d'une école */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                  <School className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-blue-900">Créer une école</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Inscription manuelle d'un établissement + promoteur</p>
                </div>
              </div>
              <button
                onClick={closeCreate}
                disabled={submitting}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitCreate} className="p-6 space-y-5">
              {/* Section 1 — Informations de l'établissement (alignée sur l'onboarding) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <School className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Informations de l'établissement</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nom officiel de l'établissement *</label>
                    <input
                      type="text"
                      value={createForm.schoolName}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCreateForm({
                          ...createForm,
                          schoolName: v,
                          preferredSubdomain: slugifySchoolName(v),
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      placeholder="École Saint-Joseph"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Type d'établissement</label>
                    <select
                      value={createForm.schoolType}
                      onChange={(e) => setCreateForm({ ...createForm, schoolType: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    >
                      {CREATE_SCHOOL_TYPES.map((t) => (
                        <option key={t.code} value={t.code}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ville *</label>
                    <input
                      type="text"
                      value={createForm.city}
                      onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      placeholder="Cotonou"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pays</label>
                    <select
                      value={createForm.country}
                      onChange={(e) => setCreateForm({ ...createForm, country: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    >
                      {CREATE_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Téléphone de l'établissement *</label>
                    <input
                      type="tel"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      placeholder="+229 00 00 00 00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email de l'établissement *</label>
                    <input
                      type="email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      placeholder="contact@ecole.org"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Sous-domaine souhaité</label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={createForm.preferredSubdomain}
                        onChange={(e) => setCreateForm({ ...createForm, preferredSubdomain: e.target.value })}
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-l-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                        placeholder="saint-joseph"
                      />
                      <span className="px-3 py-2 bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-xs text-slate-500 font-mono">.academiahelm.com</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Généré automatiquement depuis le nom de l'école.</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer">
                      <div>
                        <span className="text-sm font-semibold text-slate-700">Option bilingue (FR + EN)</span>
                        <p className="text-xs text-slate-400 mt-0.5">Active les parcours académiques bilingues</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCreateForm({ ...createForm, bilingual: !createForm.bilingual })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${createForm.bilingual ? 'bg-amber-500' : 'bg-slate-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${createForm.bilingual ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </label>
                  </div>
                </div>
              </div>

              {/* Section 2 — Abonnement */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Abonnement</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Plan</label>
                    <select
                      value={createForm.plan}
                      onChange={(e) => setCreateForm({ ...createForm, plan: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    >
                      {CREATE_PLANS.map((p) => (
                        <option key={p.code} value={p.code}>{p.label} — {p.price}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Cycle de facturation</label>
                    <select
                      value={createForm.billingCycle}
                      onChange={(e) => setCreateForm({ ...createForm, billingCycle: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    >
                      {CREATE_BILLING_CYCLES.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Méthode de paiement</label>
                    <select
                      value={createForm.paymentMethod}
                      onChange={(e) => setCreateForm({ ...createForm, paymentMethod: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    >
                      {CREATE_PAYMENT_METHODS.map((m) => (
                        <option key={m.code} value={m.code}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3 — Promoteur */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Promoteur (compte administrateur)</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Prénom *</label>
                    <input
                      type="text"
                      value={createForm.promoterFirstName}
                      onChange={(e) => setCreateForm({ ...createForm, promoterFirstName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      placeholder="Jean"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nom *</label>
                    <input
                      type="text"
                      value={createForm.promoterLastName}
                      onChange={(e) => setCreateForm({ ...createForm, promoterLastName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      placeholder="Dupont"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email *</label>
                    <input
                      type="email"
                      value={createForm.promoterEmail}
                      onChange={(e) => setCreateForm({ ...createForm, promoterEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      placeholder="jean.dupont@ecole.org"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Téléphone *</label>
                    <input
                      type="text"
                      value={createForm.promoterPhone}
                      onChange={(e) => setCreateForm({ ...createForm, promoterPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      placeholder="+229 00 00 00 00"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mot de passe *</label>
                    <input
                      type="password"
                      value={createForm.promoterPassword}
                      onChange={(e) => setCreateForm({ ...createForm, promoterPassword: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      placeholder="Minimum 8 caractères"
                      required
                      minLength={8}
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Le promoteur utilisera cet identifiant pour se connecter à son back-office école.</p>
                  </div>
                </div>
              </div>

              {createError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}
              {createSuccess && (
                <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{createSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={closeCreate}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white shadow-md transition-all"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Créer l'école
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-blue-900">Supprimer l'établissement</h2>
              </div>
              <button
                onClick={() => { if (!deleting) { setDeleteTarget(null); setDeleteError(null); } }}
                disabled={deleting}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Confirmez-vous la suppression de l'établissement{' '}
                <span className="font-bold text-slate-900">{deleteTarget.name}</span>{' '}
                (<span className="font-mono text-xs">{deleteTarget.slug}</span>) ? Cette action est irréversible.
              </p>
              {deleteError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { if (!deleting) { setDeleteTarget(null); setDeleteError(null); } }}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white shadow-md transition-all"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal — Vue 360° */}
      {detailsId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-blue-900">Détails de l'établissement</h2>
              <button
                onClick={closeDetails}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailsLoading ? (
              <div className="p-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : detailsError ? (
              <div className="p-6">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{detailsError}</div>
              </div>
            ) : detailsData ? (
              <div className="p-5 space-y-6">
                {/* Stats rapides */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-blue-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-blue-900">{detailsData.stats?.studentCount || 0}</p>
                    <p className="text-xs text-slate-500">Élèves</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-amber-700">{detailsData.stats?.staffCount || 0}</p>
                    <p className="text-xs text-slate-500">Personnel</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-emerald-700">{detailsData.stats?.userCount || 0}</p>
                    <p className="text-xs text-slate-500">Utilisateurs</p>
                  </div>
                </div>

                {/* Informations établissement */}
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Établissement</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <DetailField label="Nom" value={detailsData.tenant?.name} />
                    <DetailField label="Sous-domaine" value={detailsData.tenant?.subdomain ? `${detailsData.tenant.subdomain}.academiahelm.com` : null} />
                    <DetailField label="Slug" value={detailsData.tenant?.slug} />
                    <DetailField label="Type" value={detailsData.tenant?.type} />
                    <DetailField label="Statut" value={detailsData.tenant?.status} />
                    <DetailField label="Statut abonnement" value={detailsData.tenant?.subscriptionStatus} />
                    <DetailField label="Créé le" value={detailsData.tenant?.createdAt ? new Date(detailsData.tenant.createdAt).toLocaleDateString('fr-FR') : null} />
                    <DetailField label="Inscription élèves bloquée" value={detailsData.tenant?.studentEnrollmentBlocked ? 'Oui' : 'Non'} />
                  </div>
                </div>

                {/* Pays */}
                {detailsData.country && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Pays</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <DetailField label="Pays" value={`${detailsData.country.flag || ''} ${detailsData.country.name}`} />
                      <DetailField label="Indicatif" value={detailsData.country.phonePrefix} />
                    </div>
                  </div>
                )}

                {/* School (infos détaillées) */}
                {detailsData.school && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Informations établissement (School)</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <DetailField label="Ville" value={detailsData.school.city} />
                      <DetailField label="Adresse" value={detailsData.school.address} />
                      <DetailField label="Téléphone" value={detailsData.school.primaryPhone} />
                      <DetailField label="Email" value={detailsData.school.primaryEmail} />
                      <DetailField label="Site web" value={detailsData.school.website} />
                      <DetailField label="WhatsApp" value={detailsData.school.whatsapp} />
                      <DetailField label="Logo" value={detailsData.school.logo ? 'Configuré' : 'Non'} />
                      <DetailField label="Abbreviation" value={detailsData.school.abbreviation} />
                      <DetailField label="Devise" value={detailsData.school.motto} />
                      <DetailField label="Slogan" value={detailsData.school.slogan} />
                      <DetailField label="Fondateur" value={detailsData.school.founderName} />
                      <DetailField label="Directeur" value={detailsData.school.directorPrimary} />
                      <DetailField label="Niveaux" value={detailsData.school.educationLevels?.join(', ')} />
                    </div>
                  </div>
                )}

                {/* Abonnement */}
                {detailsData.subscription && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Abonnement</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <DetailField label="Plan" value={detailsData.subscription.plan} />
                      <DetailField label="Cycle" value={detailsData.subscription.billingCycle === 'ANNUAL' ? 'Annuel' : 'Mensuel'} />
                      <DetailField label="Statut" value={detailsData.subscription.status} />
                      <DetailField label="Montant mensuel" value={`${(detailsData.subscription.monthlyAmount || 0).toLocaleString('fr-FR')} FCFA`} />
                      <DetailField label="Frais d'activation" value={`${(detailsData.subscription.setupFee || 0).toLocaleString('fr-FR')} FCFA`} />
                      <DetailField label="Bilingue" value={detailsData.subscription.bilingualEnabled ? 'Oui' : 'Non'} />
                      <DetailField label="Expiration" value={detailsData.subscription.currentPeriodEnd ? new Date(detailsData.subscription.currentPeriodEnd).toLocaleDateString('fr-FR') : null} />
                      <DetailField label="Jours restants" value={detailsData.subscription.daysRemaining != null ? `${detailsData.subscription.daysRemaining} jours` : null} />
                      <DetailField label="Dernier paiement" value={detailsData.subscription.lastPaymentDate ? new Date(detailsData.subscription.lastPaymentDate).toLocaleDateString('fr-FR') : null} />
                      <DetailField label="Montant dernier paiement" value={detailsData.subscription.lastPaymentAmount ? `${detailsData.subscription.lastPaymentAmount.toLocaleString('fr-FR')} FCFA` : null} />
                      {detailsData.subscription.expiredAt && <DetailField label="Expiré le" value={new Date(detailsData.subscription.expiredAt).toLocaleDateString('fr-FR')} />}
                      {detailsData.subscription.suspendedAt && <DetailField label="Suspendu le" value={new Date(detailsData.subscription.suspendedAt).toLocaleDateString('fr-FR')} />}
                      {detailsData.subscription.blockedAt && <DetailField label="Bloqué le" value={new Date(detailsData.subscription.blockedAt).toLocaleDateString('fr-FR')} />}
                    </div>
                  </div>
                )}

                {/* Promoteur */}
                {detailsData.promoter && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Promoteur</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <DetailField label="Prénom" value={detailsData.promoter.firstName} />
                      <DetailField label="Nom" value={detailsData.promoter.lastName} />
                      <DetailField label="Email" value={detailsData.promoter.email} />
                      <DetailField label="Téléphone" value={detailsData.promoter.phone} />
                      <DetailField label="Rôle" value={detailsData.promoter.role} />
                      <DetailField label="Statut" value={detailsData.promoter.status} />
                      <DetailField label="Dernière connexion" value={detailsData.promoter.lastLoginAt ? new Date(detailsData.promoter.lastLoginAt).toLocaleDateString('fr-FR') : 'Jamais'} />
                      <DetailField label="Créé le" value={detailsData.promoter.createdAt ? new Date(detailsData.promoter.createdAt).toLocaleDateString('fr-FR') : null} />
                    </div>
                  </div>
                )}

                {/* Onboarding (infos collectées lors du signup) */}
                {detailsData.onboarding && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Données d'onboarding (signup)</h3>
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <DetailField label="Nom école (onboarding)" value={detailsData.onboarding.schoolName} />
                        <DetailField label="Type (onboarding)" value={detailsData.onboarding.schoolType} />
                        <DetailField label="Ville (onboarding)" value={detailsData.onboarding.city} />
                        <DetailField label="Pays (onboarding)" value={detailsData.onboarding.country} />
                        <DetailField label="Téléphone (onboarding)" value={detailsData.onboarding.phone} />
                        <DetailField label="Email (onboarding)" value={detailsData.onboarding.email} />
                        <DetailField label="Bilingue (onboarding)" value={detailsData.onboarding.bilingual ? 'Oui' : 'Non'} />
                        <DetailField label="Sous-domaine préféré" value={detailsData.onboarding.preferredSubdomain} />
                        <DetailField label="Prénom promoteur" value={detailsData.onboarding.promoterFirstName} />
                        <DetailField label="Nom promoteur" value={detailsData.onboarding.promoterLastName} />
                        <DetailField label="Email promoteur" value={detailsData.onboarding.promoterEmail} />
                        <DetailField label="Téléphone promoteur" value={detailsData.onboarding.promoterPhone} />
                        <DetailField label="Statut onboarding" value={detailsData.onboarding.status} />
                        <DetailField label="Date onboarding" value={detailsData.onboarding.createdAt ? new Date(detailsData.onboarding.createdAt).toLocaleDateString('fr-FR') : null} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Niveaux scolaires */}
                {detailsData.schoolLevels?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Niveaux scolaires</h3>
                    <div className="flex flex-wrap gap-2">
                      {detailsData.schoolLevels.map((sl: any) => (
                        <span key={sl.id} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold">
                          {sl.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tracks académiques */}
                {detailsData.academicTracks?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Parcours académiques</h3>
                    <div className="flex flex-wrap gap-2">
                      {detailsData.academicTracks.map((at: any) => (
                        <span key={at.id} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${at.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {at.code} — {at.name} {at.isDefault && '(défaut)'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Factures */}
                {detailsData.invoices?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Factures ({detailsData.invoices.length})</h3>
                    <div className="space-y-2">
                      {detailsData.invoices.map((inv: any) => (
                        <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                          <div>
                            <span className="font-semibold text-slate-700">{inv.invoiceNumber || inv.id.substring(0, 8)}</span>
                            <span className="text-slate-400 ml-2">{inv.period}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-700">{inv.amount.toLocaleString('fr-FR')} FCFA</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {inv.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historique paiements */}
                {detailsData.billingEvents?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Historique paiements ({detailsData.billingEvents.length})</h3>
                    <div className="space-y-2">
                      {detailsData.billingEvents.map((e: any) => (
                        <div key={e.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                          <div>
                            <span className="font-semibold text-slate-700">{e.type}</span>
                            <span className="text-slate-400 ml-2">{e.channel}</span>
                            <span className="text-slate-400 ml-2">{new Date(e.createdAt).toLocaleDateString('fr-FR')}</span>
                          </div>
                          <span className="font-bold text-slate-700">{e.amount.toLocaleString('fr-FR')} FCFA</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
