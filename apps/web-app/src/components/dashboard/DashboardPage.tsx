/**
 * Dashboard Page
 * 
 * Dashboard principal post-activation
 * Design sobre, professionnel, institutionnel
 */

'use client';

import Link from 'next/link';
import type { User, Tenant, SubscriptionStatus } from '@/types';
import {
  Users,
  Calculator,
  BookOpen,
  UserCheck,
  Building,
  BarChart3,
  MessageSquare,
  Settings,
  Clock,
  CheckCircle,
  ArrowRight,
  Database,
  FileText,
  TrendingUp,
  Book,
  FlaskConical,
  Bus,
  UtensilsCrossed,
  HeartPulse,
  ShieldCheck,
  Radio,
  ShoppingBag,
  LayoutDashboard,
} from 'lucide-react';
import OrionPanel from '../orion/OrionPanel';

interface DashboardPageProps {
  user: User;
  tenant: Tenant;
  subdomain: string;
}

export default function DashboardPage({ user, tenant, subdomain }: DashboardPageProps) {
  // États d'abonnement
  const subscriptionStatus: SubscriptionStatus = tenant.subscriptionStatus;
  const isTrial = subscriptionStatus === 'ACTIVE_TRIAL';
  const isSubscribed = subscriptionStatus === 'ACTIVE_SUBSCRIBED';
  const isSuspended = subscriptionStatus === 'SUSPENDED';
  const isTerminated = subscriptionStatus === 'TERMINATED';

  // Calculer les jours restants de la période d'essai
  const getTrialDaysRemaining = (): number | null => {
    if (!isTrial) return null;

    if (tenant.trialEndsAt) {
      const trialEnd = new Date(tenant.trialEndsAt);
      const now = new Date();
      const diffDays = Math.ceil(
        (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      return Math.max(0, diffDays);
    }

    // Fallback : 30 jours après la création
    const createdAt = new Date(tenant.createdAt);
    const now = new Date();
    const daysSinceCreation = Math.floor(
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    return Math.max(0, 30 - daysSinceCreation);
  };

  const trialDaysRemaining = getTrialDaysRemaining();

  // Modules principaux (7 modules)
  const mainModules = [
    {
      path: '/app/students',
      name: 'Gestion des Élèves et Scolarité',
      icon: Users,
      description: 'Inscriptions, classes, absences, discipline, documents',
      color: 'bg-blue-50 border-blue-200',
      iconColor: 'text-blue-600',
    },
    {
      path: '/app/finance',
      name: 'Gestion Financière et Économat',
      icon: Calculator,
      description: 'Frais, paiements, dépenses, trésorerie, clôture',
      color: 'bg-yellow-50 border-yellow-200',
      iconColor: 'text-yellow-600',
    },
    {
      path: '/app/hr',
      name: 'Gestion du Personnel et RH',
      icon: UserCheck,
      description: 'Personnel, contrats, évaluations, paie, statistiques',
      color: 'bg-purple-50 border-purple-200',
      iconColor: 'text-purple-600',
    },
    {
      path: '/app/planning',
      name: 'Planification et Études',
      icon: Building,
      description: 'Salles, matières, enseignants, emplois du temps, cahiers',
      color: 'bg-indigo-50 border-indigo-200',
      iconColor: 'text-indigo-600',
    },
    {
      path: '/app/exams',
      name: 'Examens et Évaluation',
      icon: BookOpen,
      description: 'Saisie des notes, bulletins, conseils, tableaux d\'honneur',
      color: 'bg-green-50 border-green-200',
      iconColor: 'text-green-600',
    },
    {
      path: '/app/communication',
      name: 'Communication',
      icon: MessageSquare,
      description: 'SMS, emails, WhatsApp, notifications, analytics',
      color: 'bg-pink-50 border-pink-200',
      iconColor: 'text-pink-600',
    },
    {
      path: '/app/reports',
      name: 'Bilans & Indicateurs',
      icon: BarChart3,
      description: 'Tableaux de bord, KPIs, rapports, analyses',
      color: 'bg-gray-50 border-gray-200',
      iconColor: 'text-gray-600',
    },
  ];

  // Modules supplémentaires (8 modules)
  const supplementaryModules = [
    {
      path: '/app/library',
      name: 'Bibliothèque',
      icon: Book,
      description: 'Catalogue, prêts, retours, statistiques',
      color: 'bg-amber-50 border-amber-200',
      iconColor: 'text-amber-600',
    },
    {
      path: '/app/laboratory',
      name: 'Laboratoire',
      icon: FlaskConical,
      description: 'Équipements, réservations, inventaire, maintenance',
      color: 'bg-cyan-50 border-cyan-200',
      iconColor: 'text-cyan-600',
    },
    {
      path: '/app/transport',
      name: 'Transport',
      icon: Bus,
      description: 'Véhicules, itinéraires, conducteurs, suivi',
      color: 'bg-orange-50 border-orange-200',
      iconColor: 'text-orange-600',
    },
    {
      path: '/app/canteen',
      name: 'Cantine',
      icon: UtensilsCrossed,
      description: 'Repas, menus, inscriptions, paiements, rapports',
      color: 'bg-red-50 border-red-200',
      iconColor: 'text-red-600',
    },
    {
      path: '/app/infirmary',
      name: 'Infirmerie',
      icon: HeartPulse,
      description: 'Dossiers médicaux, visites, médicaments, urgences',
      color: 'bg-rose-50 border-rose-200',
      iconColor: 'text-rose-600',
    },
    {
      path: '/app/qhse',
      name: 'QHSE',
      icon: ShieldCheck,
      description: 'Inspections, incidents, formations, conformité',
      color: 'bg-teal-50 border-teal-200',
      iconColor: 'text-teal-600',
    },
    {
      path: '/app/educast',
      name: 'EduCast',
      icon: Radio,
      description: 'Diffusion de contenu, streaming, podcasts, analytics',
      color: 'bg-violet-50 border-violet-200',
      iconColor: 'text-violet-600',
    },
    {
      path: '/app/shop',
      name: 'Boutique',
      icon: ShoppingBag,
      description: 'Fournitures, stocks, commandes, comptabilité',
      color: 'bg-emerald-50 border-emerald-200',
      iconColor: 'text-emerald-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header de Contexte */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-navy-900 mb-2">{tenant.name}</h1>
            <div className="flex items-center space-x-4 text-sm text-slate-600">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4" />
                <span>Sous-domaine : <strong className="text-navy-900">{subdomain}.academiahub.com</strong></span>
              </div>
              <div className="flex items-center space-x-2">
                {isTerminated && (
                  <>
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-600 font-medium">
                      Compte clôturé — accès restreint
                    </span>
                  </>
                )}
                {!isTerminated && isSuspended && (
                  <>
                    <Clock className="w-4 h-4 text-red-600" />
                    <span className="text-red-600 font-medium">
                      Abonnement suspendu — accès en lecture seule
                    </span>
                  </>
                )}
                {!isTerminated && !isSuspended && isTrial && (
                  <>
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span className="text-yellow-600 font-medium">
                      Période d'essai :{' '}
                      {trialDaysRemaining !== null
                        ? `${trialDaysRemaining} jour${trialDaysRemaining > 1 ? 's' : ''} restant${trialDaysRemaining > 1 ? 's' : ''}`
                        : 'Active'}
                    </span>
                  </>
                )}
                {!isTerminated && !isSuspended && !isTrial && isSubscribed && (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-green-600 font-medium">
                      Abonnement actif
                      {tenant.nextPaymentDueAt && (
                        <span className="ml-2 text-xs text-slate-600">
                          (prochaine échéance :{' '}
                          {new Date(tenant.nextPaymentDueAt).toLocaleDateString()}
                          )
                        </span>
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-600">Connecté en tant que</p>
            <p className="text-base font-semibold text-navy-900">{user.firstName} {user.lastName}</p>
            <p className="text-xs text-slate-500">{user.role}</p>
          </div>
        </div>
      </div>

      {/* Indicateurs Clés */}
      <div>
        <h2 className="text-xl font-bold text-navy-900 mb-4">Indicateurs clés</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">Effectif élèves</p>
              <Users className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-navy-900">—</p>
            <p className="text-xs text-slate-500 mt-1">Non configuré</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">Classes actives</p>
              <Building className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-navy-900">—</p>
            <p className="text-xs text-slate-500 mt-1">Non configuré</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">Encaissements du mois</p>
              <Calculator className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-navy-900">—</p>
            <p className="text-xs text-slate-500 mt-1">Aucune donnée</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">Dernières opérations</p>
              <FileText className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-navy-900">—</p>
            <p className="text-xs text-slate-500 mt-1">Aucune activité</p>
          </div>
        </div>
      </div>

      {/* Accès Modules Principaux */}
      <div>
        <h2 className="text-xl font-bold text-navy-900 mb-4">Modules principaux</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {mainModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.path}
                href={module.path}
                aria-disabled={isSuspended || isTerminated}
                className={`bg-white rounded-lg border-2 ${module.color} p-6 hover:shadow-md transition-all duration-200 group ${
                  isSuspended || isTerminated ? 'opacity-60 pointer-events-none cursor-not-allowed' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg bg-white ${module.iconColor}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <ArrowRight className={`w-5 h-5 ${module.iconColor} opacity-0 group-hover:opacity-100 transition-opacity`} />
                </div>
                <h3 className="text-lg font-semibold text-navy-900 mb-2">{module.name}</h3>
                <p className="text-sm text-slate-600">{module.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Accès Modules Supplémentaires */}
      <div>
        <h2 className="text-xl font-bold text-navy-900 mb-4">Modules supplémentaires</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {supplementaryModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.path}
                href={module.path}
                aria-disabled={isSuspended || isTerminated}
                className={`bg-white rounded-lg border-2 ${module.color} p-6 hover:shadow-md transition-all duration-200 group ${
                  isSuspended || isTerminated ? 'opacity-60 pointer-events-none cursor-not-allowed' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg bg-white ${module.iconColor}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <ArrowRight className={`w-5 h-5 ${module.iconColor} opacity-0 group-hover:opacity-100 transition-opacity`} />
                </div>
                <h3 className="text-lg font-semibold text-navy-900 mb-2">{module.name}</h3>
                <p className="text-sm text-slate-600">{module.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ORION - Assistant de Direction (réservé aux rôles élevés) */}
      {(['DIRECTOR', 'SUPER_DIRECTOR', 'ADMIN'] as string[]).includes(user.role) && (
        <div className="mt-8">
          <OrionPanel userRole={user.role} />
        </div>
      )}

      {/* Message de Guidage */}
      <div className="bg-navy-900 rounded-lg p-8 text-white">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <CheckCircle className="w-8 h-8 text-soft-gold" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-3">
              Bienvenue sur Academia Helm
            </h3>
            <p className="text-gray-100 leading-relaxed mb-2">
              {isSuspended
                ? "Votre abonnement est suspendu. Vous pouvez consulter vos données, mais les modifications sont temporairement bloquées jusqu'à régularisation."
                : "Votre compte est activé et vous avez accès à tous les modules : 7 modules principaux et 8 modules supplémentaires. Aucune option cachée."}
            </p>
            {!isSuspended && (
              <p className="text-gray-200 text-sm mb-4">
                Pour commencer à utiliser la plateforme efficacement, nous vous recommandons de :
              </p>
            )}
            {!isSuspended && (
              <ol className="space-y-2 text-gray-100 mb-6">
              <li className="flex items-start">
                <span className="font-semibold mr-2">1.</span>
                <span>Configurer votre établissement (niveaux, classes, effectifs)</span>
              </li>
              <li className="flex items-start">
                <span className="font-semibold mr-2">2.</span>
                <span>Enregistrer vos premiers élèves dans le module Scolarité</span>
              </li>
              <li className="flex items-start">
                <span className="font-semibold mr-2">3.</span>
                <span>Configurer les frais de scolarité dans le module Finances</span>
              </li>
              <li className="flex items-start">
                <span className="font-semibold mr-2">4.</span>
                <span>Définir les rôles et permissions dans les Paramètres</span>
              </li>
              </ol>
            )}
            <div className="flex flex-wrap gap-4">
              {isSuspended ? (
                <Link
                  href="/app/settings/billing"
                  className="inline-flex items-center bg-crimson-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-crimson-500 transition-colors"
                >
                  Régulariser mon abonnement
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/app/settings"
                    className="inline-flex items-center bg-crimson-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-crimson-500 transition-colors"
                  >
                    Configurer l'établissement
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                  <Link
                    href="/app/students"
                    className="inline-flex items-center bg-white/10 text-white px-6 py-3 rounded-md font-semibold hover:bg-white/20 transition-colors border border-white/20"
                  >
                    Accéder à Scolarité
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Note sur la période d'essai */}
      {isTrial && trialDaysRemaining !== null && trialDaysRemaining <= 7 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <Clock className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-lg font-semibold text-yellow-900 mb-2">
                Période d'essai : {trialDaysRemaining} jour{trialDaysRemaining > 1 ? 's' : ''} restant{trialDaysRemaining > 1 ? 's' : ''}
              </h4>
              <p className="text-sm text-yellow-800 mb-4">
                Votre période d'essai se termine dans {trialDaysRemaining} jour{trialDaysRemaining > 1 ? 's' : ''}. 
                L'abonnement mensuel de 15.000 FCFA démarrera automatiquement après cette date.
              </p>
              <Link
                href="/app/settings/billing"
                className="text-sm text-yellow-900 font-semibold hover:text-yellow-700"
              >
                Gérer mon abonnement →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

