'use client';

/**
 * ============================================================================
 * HELM ENSEIGNANT — TABLEAU DE BORD
 * ============================================================================
 *
 * Cockpit léger de l'espace autonome : identité, niveaux activés, année
 * scolaire, comptes (classes / matières / élèves) et accès rapides vers
 * l'espace pédagogique.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Calculator,
  ClipboardList,
  Users,
  CalendarDays,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  ArrowRight,
  GraduationCap,
  Settings,
} from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';

interface ProfProfile {
  user: { id: string; email: string; firstName: string; lastName: string };
  teacher: { id: string; matricule: string; phone: string | null } | null;
  tenant: { id: string; name: string; slug: string };
  levels: Array<{ code: string; name: string; label: string; isActive: boolean }>;
  academicYear: { id: string; name: string; label: string } | null;
  identity: {
    schoolName: string | null;
    logoUrl: string | null;
    address: string | null;
    phonePrimary: string | null;
    email: string | null;
    slogan: string | null;
  } | null;
  subscription: {
    plan: string;
    status: string;
    billingCycle: string;
    monthlyAmount?: number;
    currentPeriodStart?: string | null;
    currentPeriodEnd: string | null;
    gracePeriodEnd?: string | null;
    lastPaymentDate?: string | null;
    trialEnd: string | null;
    daysRemaining?: number | null;
  } | null;
  stats: { classes: number; subjects: number; students: number };
}

const QUICK_LINKS = [
  {
    href: '/prof/pedagogie',
    label: 'Espace pédagogique',
    description: 'Cahier journal, fiches, cahier de textes',
    icon: BookOpen,
  },
  {
    href: '/prof/examens',
    label: 'Évaluations & bulletins',
    description: 'Notes, moyennes, génération des bulletins',
    icon: Calculator,
  },
  {
    href: '/prof/travaux',
    label: 'Travaux & suivi',
    description: 'Devoirs, leçons, recherches',
    icon: ClipboardList,
  },
  {
    href: '/prof/eleves',
    label: 'Mes élèves',
    description: 'Constituez vos classes pour les notes et bulletins',
    icon: Users,
  },
];

export default function ProfDashboardPage() {
  const { user, tenant } = useAppSession();
  const { academicYear } = useModuleContext();
  const [profile, setProfile] = useState<ProfProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await apiClient.get('/teacher-portal/profile', { timeout: 15000 });
        if (!cancelled) setProfile(response.data);
      } catch (e: any) {
        if (!cancelled) {
          setError(
            e?.response?.status === 401
              ? 'Session expirée — reconnectez-vous.'
              : 'Impossible de charger votre profil d’espace.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || '';
  const activeLevels = profile?.levels.filter((l) => l.isActive) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── En-tête de bienvenue ── */}
      <div className="rounded-2xl bg-gradient-to-r from-teal-600 to-teal-700 p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-teal-100">Bonjour {displayName.split(' ')[0]} 👋</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Votre espace enseignant</h1>
            <p className="mt-2 text-sm text-teal-100">
              {academicYear?.label || profile?.academicYear?.label || 'Année scolaire'} ·{' '}
              {activeLevels.length > 0
                ? activeLevels.map((l) => l.label).join(' · ')
                : 'Aucun niveau activé'}
            </p>
          </div>
          <Link
            href="/prof/parametres"
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
          >
            <Settings className="h-4 w-4" />
            Paramètres
          </Link>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Chargement de votre espace…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Bandeau abonnement (compteur) ── */}
      {profile && (
        <SubscriptionBannerCard subscription={profile.subscription} />
      )}

      {profile && (
        <>
          {/* ── Comptes ── */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Classes disponibles', value: profile.stats.classes, icon: GraduationCap },
              { label: 'Matières installées', value: profile.stats.subjects, icon: BookOpen },
              { label: 'Élèves enregistrés', value: profile.stats.students, icon: Users },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Niveaux ── */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Niveaux de votre espace</h2>
              <Link
                href="/prof/parametres"
                className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-800"
              >
                Modifier
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {profile.levels.map((level) => (
                <div
                  key={level.code}
                  className={`flex items-center gap-3 rounded-xl border p-4 ${
                    level.isActive
                      ? 'border-teal-200 bg-teal-50/60'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  {level.isActive ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-600" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-slate-300" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{level.label}</p>
                    <p className="text-xs text-slate-500">
                      {level.isActive ? 'Activé' : 'Désactivé'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Accès rapides ── */}
          <div>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Accès rapides</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors group-hover:bg-teal-100 group-hover:text-teal-700">
                    <link.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{link.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{link.description}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-600" />
                </Link>
              ))}
            </div>
          </div>

          {/* ── Bandeau invitation promoteur ── */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-200 bg-teal-50 p-5">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Votre école n’est pas encore sur Academia Helm ?
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Invitez votre promoteur — toute l’école pourrait gagner en efficacité.
                </p>
              </div>
            </div>
            <Link
              href="/prof/parametres?tab=promoteur"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Inviter mon promoteur
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * ⭐ Bandeau abonnement du tableau de bord — compteur activé / décompte /
 * grâce / inactivation, avec CTA vers la page de paiement (2 000 FCFA/mois).
 * Compact et 100 % responsive (empilement mobile, pas de texte tronqué).
 */
function SubscriptionBannerCard({ subscription }: { subscription: ProfProfile['subscription'] }) {
  const status = String(subscription?.status ?? '').toUpperCase();
  const days = Number(subscription?.daysRemaining ?? 0);
  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  // Pas d'abonnement → carte d'activation (onboarding non finalisé)
  if (!subscription || status === 'TRIAL') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Activez votre abonnement — 2 000 FCFA / mois
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Compteur de 30 jours dès le paiement · rappels par email avant expiration · 7 jours
              de grâce.
            </p>
          </div>
        </div>
        <Link
          href="/prof/checkout"
          className="shrink-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Activer maintenant
        </Link>
      </div>
    );
  }

  const isSuspended = status === 'SUSPENDED' || status === 'BLOCKED';
  const isGrace = status === 'GRACE_PERIOD';
  const expiringSoon = days <= 7;

  const styles = isSuspended
    ? 'border-red-200 bg-red-50'
    : isGrace || expiringSoon
      ? 'border-amber-200 bg-amber-50'
      : 'border-teal-200 bg-white';
  const icon = isSuspended ? (
    <AlertCircle className="h-5 w-5 text-red-600" />
  ) : isGrace || expiringSoon ? (
    <CalendarDays className="h-5 w-5 text-amber-600" />
  ) : (
    <CheckCircle2 className="h-5 w-5 text-teal-600" />
  );
  const title = isSuspended
    ? 'Compte inactif — réactivation requise'
    : isGrace
      ? 'Période de grâce — renouvelez avant inactivation'
      : expiringSoon
        ? `Votre abonnement expire dans ${days} jour${days > 1 ? 's' : ''}`
        : 'Compteur activé';
  const detail = isSuspended
    ? 'Vos données sont conservées. Un paiement réactive votre espace pour 30 nouveaux jours.'
    : `Valide jusqu’au ${periodEnd ?? '—'}${days > 0 ? ` · ${days} jour${days > 1 ? 's' : ''} restants` : ''}`;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 ${styles}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-0.5 text-xs text-slate-600">{detail}</p>
        </div>
      </div>
      <Link
        href={`/prof/checkout?${isSuspended ? 'reactivate=1' : 'renew=1'}`}
        className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white ${
          isSuspended || isGrace || expiringSoon
            ? 'bg-amber-600 hover:bg-amber-700'
            : 'bg-teal-600 hover:bg-teal-700'
        }`}
      >
        {isSuspended ? 'Réactiver — 2 000 FCFA' : 'Renouveler — 2 000 FCFA'}
      </Link>
    </div>
  );
}
