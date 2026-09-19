'use client';

/**
 * ============================================================================
 * PROMOTER STRATEGIC VIEW — Vue stratégique du groupe scolaire (client)
 * ============================================================================
 *
 * Le « poste de commandement » du promoteur multi-écoles :
 *   - Bannière identité (thème Pilotage : ardoise sombre + or)
 *   - Rangée de KPIs CONSOLIDÉS du groupe (sommes + moyenne pondérée)
 *   - Grille de cartes par ÉTABLISSEMENT : KPIs isolés par tenant +
 *     action « Entrer dans l'établissement »
 *
 * La bascule vers une école réutilise la chaîne existante :
 *   POST /api/auth/select-tenant (token enrichi + cookie session) → /app
 * → PilotageLayout, l'UI complète partagée (filet de sécurité du promoteur).
 *
 * Aucun appel direct au backend NestJS : tout passe par le BFF Next.js.
 * ============================================================================
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Building2,
  Coins,
  Gauge,
  GraduationCap,
  Loader2,
  LogOut,
  MapPin,
  RefreshCw,
  UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { persistClientSession, clearClientSessionSync } from '@/lib/auth/client-access-token';
import { getRoleDisplayLabel } from '@/lib/auth/role-portal-map';
import { getConsolidatedKpi } from '@/services/consolidated-kpi.service';
import type { ConsolidatedKpiResponse, GroupSchoolKpi } from '@/types';
// ⭐ « Mon profil » — photo de profil + changement de mot de passe (self-service)
import UserAvatar from '@/components/profile/UserAvatar';
import ProfileDialog from '@/components/profile/ProfileDialog';
import { useUserProfileStore } from '@/stores/user-profile-store';

// ─── Formatage (fr-FR, devise du système : F CFA) ───────────────────────────

const amountFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'XOF',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('fr-FR');

function formatAmount(value: number): string {
  return amountFormatter.format(value);
}

// ─── Composant ──────────────────────────────────────────────────────────────

export interface PromoterStrategicViewProps {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    tenantId: string;
  };
}

export default function PromoterStrategicView({ user }: PromoterStrategicViewProps) {
  const [data, setData] = useState<ConsolidatedKpiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enteringTenantId, setEnteringTenantId] = useState<string | null>(null);
  // ⭐ « Mon profil » — dialogue photo de profil + mot de passe
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  // ⭐ Photo PERSO > photo du dossier RH — même priorité que « Mon profil »
  //    (sinon la photo RH ne s'affichait que dans le modal, pas dans la topbar)
  const profileAvatarUrl = useUserProfileStore(
    (s) => s.profile?.avatarUrl ?? s.profile?.hrPhotoUrl ?? null,
  );
  const ensureProfileLoaded = useUserProfileStore((s) => s.ensureLoaded);
  useEffect(() => {
    void ensureProfileLoaded();
  }, [ensureProfileLoaded]);

  const userName = `${user.firstName} ${user.lastName}`.trim() || user.email;
  const roleLabel = getRoleDisplayLabel(user.role);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getConsolidatedKpi();
      setData(response);
    } catch (err: any) {
      console.error('Error loading consolidated KPIs:', err);
      setError(
        err?.message?.includes('403')
          ? 'Accès refusé : la vue stratégique est réservée aux promoteurs.'
          : 'Impossible de charger les indicateurs du groupe. Vérifiez votre connexion puis réessayez.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Entrer dans un établissement : bascule du contexte tenant via la chaîne
   * existante (select-tenant → token enrichi + cookie session) puis
   * rechargement complet vers /app (UI complète de l'école).
   */
  const enterSchool = async (school: GroupSchoolKpi) => {
    if (enteringTenantId) return;
    setEnteringTenantId(school.tenantId);
    setError(null);
    try {
      const token = localStorage.getItem('accessToken')?.trim() ?? '';
      const response = await fetch('/api/auth/select-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ tenant_id: school.tenantId }),
      });
      const selectData = await response.json();
      if (!response.ok || !selectData.success) {
        throw new Error(selectData.message || selectData.error || 'Bascule impossible');
      }

      persistClientSession({
        accessToken: selectData.accessToken,
        refreshToken: selectData.refreshToken,
        serverSessionId: selectData.serverSessionId,
        user: selectData.user,
        tenant: selectData.tenant,
        portalType: 'SCHOOL',
        expiresAt: selectData.expiresAt,
      });

      // Rechargement complet : le contexte (cookie + JWT enrichi) devient
      // celui de l'école choisie, l'UI complète démarre proprement.
      window.location.href = '/app';
    } catch (err: any) {
      console.error('Error entering school:', err);
      setError(err?.message || 'Impossible de basculer vers cet établissement.');
      setEnteringTenantId(null);
    }
  };

  const handleLogout = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      await fetch('/api/auth/logout', { method: 'POST', signal: controller.signal }).catch(
        () => {},
      );
      clearTimeout(timeoutId);
    } finally {
      clearClientSessionSync();
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* ── Bannière identité — thème Pilotage (ardoise + or) ── */}
        <div className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {/* ⭐ Avatar promoteur — ouvre « Mon profil » (photo + mot de passe) */}
              <button
                type="button"
                onClick={() => setProfileDialogOpen(true)}
                className="flex-shrink-0 rounded-full ring-2 ring-amber-400/40 hover:ring-amber-400 transition-all"
                title="Mon profil — photo de profil et mot de passe"
              >
                <UserAvatar
                  photoUrl={profileAvatarUrl}
                  firstName={user.firstName}
                  lastName={user.lastName}
                  email={user.email}
                  size={48}
                  initialsClassName="bg-amber-400/20 text-amber-400 border border-amber-400/40"
                  className="ring-0"
                />
              </button>
              <div className="min-w-0">
                <p className="text-amber-400/90 text-xs font-semibold uppercase tracking-wider">
                  Vue stratégique · Groupe scolaire
                </p>
                <h1 className="text-xl sm:text-2xl font-bold truncate">{userName}</h1>
                <p className="text-white/70 text-sm mt-0.5">{roleLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {user.tenantId && (
                <button
                  onClick={() => {
                    window.location.href = '/app';
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour à l&apos;application
                </button>
              )}
              {/* ⭐ « Mon profil » — photo de profil + changement de mot de passe */}
              <button
                onClick={() => setProfileDialogOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 transition-colors"
              >
                <UserCog className="h-4 w-4" />
                Mon profil
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          </div>

          {data && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-4 text-sm text-white/80">
              <span className="font-semibold text-amber-400">
                {numberFormatter.format(data.totalSchools)}{' '}
                {data.totalSchools > 1 ? 'établissements' : 'établissement'}
              </span>
              <span>Période : {data.periodLabel}</span>
            </div>
          )}
        </div>

        {/* ── Message d'erreur (bascule ou chargement) ── */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={load}
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-red-700 hover:text-red-900"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Réessayer
              </button>
            </div>
          </div>
        )}

        {/* ── KPIs consolidés du groupe ── */}
        {isLoading ? (
          <ConsolidatedSkeleton />
        ) : data && data.totalSchools > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard
                icon={<Building2 className="h-5 w-5" />}
                label="Établissements"
                value={numberFormatter.format(data.consolidated.totalSchools || data.totalSchools)}
                tone="slate"
              />
              <KpiCard
                icon={<GraduationCap className="h-5 w-5" />}
                label="Élèves"
                value={numberFormatter.format(data.consolidated.totalStudents)}
                tone="indigo"
              />
              <KpiCard
                icon={<Briefcase className="h-5 w-5" />}
                label="Enseignants"
                value={numberFormatter.format(data.consolidated.totalTeachers)}
                tone="sky"
              />
              <KpiCard
                icon={<Coins className="h-5 w-5" />}
                label="Recettes encaissées"
                value={formatAmount(data.consolidated.totalRevenue)}
                tone="emerald"
              />
              <KpiCard
                icon={<AlertTriangle className="h-5 w-5" />}
                label="Impayés"
                value={formatAmount(data.consolidated.unpaidAmount)}
                tone={data.consolidated.unpaidAmount > 0 ? 'red' : 'slate'}
              />
              <KpiCard
                icon={<Gauge className="h-5 w-5" />}
                label="Recouvrement moyen"
                value={`${data.consolidated.averageRecoveryRate} %`}
                tone={recoveryTone(data.consolidated.averageRecoveryRate)}
              />
            </div>

            {/* ── Cartes par établissement ── */}
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-3">
                Vos établissements
                <span className="ml-2 text-sm font-normal text-slate-500">
                  KPIs isolés par école — cliquez sur « Entrer » pour piloter
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {data.bySchool.map((school) => (
                  <SchoolCard
                    key={school.tenantId}
                    school={school}
                    isActive={school.tenantId === user.tenantId}
                    entering={enteringTenantId === school.tenantId}
                    onEnter={() => enterSchool(school)}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-600">
              Aucun établissement actif n&apos;est rattaché à votre compte pour le moment.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Les écoles fondées via l&apos;onboarding y sont rattachées automatiquement.
            </p>
          </div>
        )}
      </div>

      {/* ⭐ « Mon profil » — photo de profil + changement de mot de passe (self-service) */}
      <ProfileDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        fallbackUser={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: roleLabel,
        }}
      />
    </div>
  );
}

// ─── Carte KPI consolidée ───────────────────────────────────────────────────

const KPI_TONES: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-600',
  indigo: 'bg-indigo-100 text-indigo-600',
  sky: 'bg-sky-100 text-sky-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  red: 'bg-red-100 text-red-600',
  amber: 'bg-amber-100 text-amber-600',
};

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: keyof typeof KPI_TONES;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0',
            KPI_TONES[tone] || KPI_TONES.slate,
          )}
        >
          {icon}
        </div>
        <p className="text-xs font-medium text-slate-500 leading-tight">{label}</p>
      </div>
      <p className="text-lg font-bold text-slate-900 truncate" title={value}>
        {value}
      </p>
    </div>
  );
}

// ─── Carte d'un établissement ───────────────────────────────────────────────

function recoveryTone(rate: number): 'emerald' | 'amber' | 'red' {
  if (rate >= 80) return 'emerald';
  if (rate >= 50) return 'amber';
  return 'red';
}

const RECOVERY_CLASSES: Record<'emerald' | 'amber' | 'red', string> = {
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
};

function SchoolCard({
  school,
  isActive,
  entering,
  onEnter,
}: {
  school: GroupSchoolKpi;
  isActive: boolean;
  entering: boolean;
  onEnter: () => void;
}) {
  const location = [school.city, school.country].filter(Boolean).join(', ');

  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-5 flex flex-col',
        isActive ? 'border-amber-300 ring-1 ring-amber-300' : 'border-slate-200',
      )}
    >
      {/* En-tête : identité de l'école */}
      <div className="flex items-start gap-3">
        {school.logoUrl ? (
          <img
            src={school.logoUrl}
            alt={school.schoolName}
            className="h-11 w-11 rounded-lg object-cover border border-slate-200 flex-shrink-0"
          />
        ) : (
          <div className="h-11 w-11 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-slate-500" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-900 truncate">{school.schoolName}</p>
            {isActive && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">
                Établissement actif
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location}
              </span>
            )}
            <span className="inline-flex items-center gap-1">{school.periodLabel}</span>
          </p>
        </div>
      </div>

      {/* KPIs de l'école (données isolées par tenant) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        <MiniKpi label="Élèves" value={numberFormatter.format(school.kpi.totalStudents)} />
        <MiniKpi label="Enseignants" value={numberFormatter.format(school.kpi.totalTeachers)} />
        <MiniKpi
          label="Recettes"
          value={formatAmount(school.kpi.totalRevenue)}
          title={formatAmount(school.kpi.totalRevenue)}
        />
        <div>
          <p className="text-[11px] text-slate-400">Recouvrement</p>
          <p
            className={cn(
              'text-sm font-semibold',
              RECOVERY_CLASSES[recoveryTone(school.kpi.recoveryRate)],
            )}
          >
            {school.kpi.recoveryRate} %
          </p>
        </div>
      </div>

      {school.kpi.unpaidAmount > 0 && (
        <p className="mt-3 text-xs text-red-600 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          Impayés : {formatAmount(school.kpi.unpaidAmount)}
        </p>
      )}

      {/* Bascule vers l'école */}
      <button
        onClick={onEnter}
        disabled={entering}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {entering ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Bascule en cours…
          </>
        ) : (
          <>
            Entrer dans l&apos;établissement
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </>
        )}
      </button>
    </div>
  );
}

function MiniKpi({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-900 truncate" title={title || value}>
        {value}
      </p>
    </div>
  );
}

// ─── Squelette de chargement ────────────────────────────────────────────────

function ConsolidatedSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-24 rounded-xl border border-slate-200 bg-white animate-pulse"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-56 rounded-xl border border-slate-200 bg-white animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
