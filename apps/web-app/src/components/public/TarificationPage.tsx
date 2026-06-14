'use client';

/**
 * Tarification Page — Academia Helm
 *
 * Page de tarification premium avec contenu ghostwriter-level.
 * Palette : Navy #0b2f73, Blue #1d4fa5, Gold #f5b335, White
 * Conserve la logique de données HELM_PLANS / billing cycle intacte.
 */

import { Header } from '@/components/ui/header-1';
import Link from 'next/link';
import { CheckCircle, Users, ArrowRight, Building2 } from 'lucide-react';
import { useState } from 'react';
import { HELM_PLANS, type HelmPlanKey } from '@/lib/services/HelmPricingService';
import { formatCurrency } from '@/lib/utils';
import { Footer2 } from '@/components/ui/footer-2';
import {
  Shield,
  Headphones,
  Zap,
  Lock,
  Globe,
  Award,
  ChevronDown,
  Sparkles,
  BookOpen,
  BarChart3,
  GraduationCap,
  CreditCard,
  UserCog,
  MessageSquare,
  ClipboardCheck,
  Brain,
  Puzzle,
  Star,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  HELPERS                                                           */
/* ------------------------------------------------------------------ */

function formatAmount(amount: number | null) {
  if (amount == null) return 'Sur devis';
  return formatCurrency(amount);
}

/* ------------------------------------------------------------------ */
/*  PLAN META — Descriptions premium & features détaillées            */
/* ------------------------------------------------------------------ */

interface PlanMeta {
  code: HelmPlanKey;
  studentsRange: string;
  subtitle: string;
  description: string;
  features: string[];
}

const PLAN_META: PlanMeta[] = [
  {
    code: 'SEED',
    studentsRange: '1 – 150 élèves',
    subtitle: 'L\'essentiel pour bien démarrer',
    description:
      'Votre école mérite une gestion professionnelle dès le premier jour. HELM SEED vous offre les 9 modules complets pour structurer votre établissement avec rigueur et sérénité.',
    features: [
      '9 modules complets intégrés',
      'Gestion des élèves & inscriptions',
      'Notes, bulletins & examens',
      'Finance & économat',
      'RH & paie conformes CNSS',
      'Communication SMS & WhatsApp',
      'IA ORION — Alertes intelligentes',
      'Support par email et chat',
      'Mises à jour incluses',
    ],
  },
  {
    code: 'GROW',
    studentsRange: '151 – 400 élèves',
    subtitle: 'Pilotez votre croissance',
    description:
      'Quand l\'effectif augmente, la complexité aussi. HELM GROW vous équipe des outils analytiques et du support prioritaire pour transformer vos données en décisions stratégiques.',
    features: [
      'Tout le plan SEED, plus :',
      'Tableaux de bord analytiques avancés',
      'Rapports financiers détaillés',
      'Suivi du recouvrement en temps réel',
      'ORION — Recommandations IA',
      'Support prioritaire 7j/7',
      'Export Educmaster intégré',
      'Formations personnalisées en ligne',
      'Historique illimité des données',
    ],
  },
  {
    code: 'LEAD',
    studentsRange: '401 – 800 élèves',
    subtitle: 'Dominez votre marché',
    description:
      'Les grands établissements exigent une maîtrise totale. HELM LEAD vous confère un avantage concurrentiel avec un accompagnement sur-mesure et des outils de pilotage d\'excellence.',
    features: [
      'Tout le plan GROW, plus :',
      'Gestion multi-sites (2 campus)',
      'Rapports personnalisés à la demande',
      'Conseiller dédié assigné',
      'ORION — Analyses prédictives',
      'Intégration API personnalisée',
      'Formation sur site (1 session/an)',
      'SLA garanti — Temps de réponse < 4h',
      'Accès anticipé aux nouvelles fonctions',
    ],
  },
  {
    code: 'NETWORK',
    studentsRange: 'Multi-campus',
    subtitle: 'Gérez votre réseau, sans limites',
    description:
      'Pour les groupes scolaires et réseaux éducatifs, HELM NETWORK offre une architecture scalable, une gouvernance centralisée et un accompagnement stratégique dédié à votre expansion.',
    features: [
      'Tout le plan LEAD, plus :',
      'Campus illimités & gouvernance centralisée',
      'Tableau de bord groupe consolidé',
      'Branding & domaine personnalisés',
      'Intégration SI existant (SGBD, ERP)',
      'ORION — IA stratégique multi-sites',
      'Account manager senior dédié',
      'Formation continue & onboarding illimité',
      'SLA Premium — Temps de réponse < 2h',
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  ALL-PLANS COMPARISON — Ce qui est inclus dans TOUS les plans      */
/* ------------------------------------------------------------------ */

const ALL_PLANS_FEATURES = [
  {
    icon: GraduationCap,
    label: 'Élèves & Inscriptions',
    detail: 'Dossiers complets, admissions, réinscriptions, export Educmaster',
  },
  {
    icon: BookOpen,
    label: 'Organisation Pédagogique',
    detail: 'Emplois du temps, matières, affectations, espace enseignant',
  },
  {
    icon: BarChart3,
    label: 'Examens, Notes & Bulletins',
    detail: 'Saisie des notes, calcul des moyennes, bulletins PDF professionnels',
  },
  {
    icon: CreditCard,
    label: 'Finance & Économat',
    detail: 'Gestion des frais, recouvrement, dépenses, caisse et trésorerie',
  },
  {
    icon: UserCog,
    label: 'RH & Paie',
    detail: 'Contrats, congés, salaires et déclarations CNSS conformes',
  },
  {
    icon: MessageSquare,
    label: 'Communication',
    detail: 'SMS, WhatsApp, email et notifications parents en temps réel',
  },
  {
    icon: ClipboardCheck,
    label: 'QHSE & Incidents',
    detail: 'Hygiène, sécurité, traçabilité des incidents et conformité',
  },
  {
    icon: Brain,
    label: 'ORION — IA Analytique',
    detail: 'Alertes intelligentes, KPIs automatisés, recommandations data-driven',
  },
  {
    icon: Puzzle,
    label: 'Modules Complémentaires',
    detail: 'Cantine, transport, infirmerie, bibliothèque — tout intégré',
  },
];

/* ------------------------------------------------------------------ */
/*  FAQ DATA                                                          */
/* ------------------------------------------------------------------ */

const FAQ_ITEMS = [
  {
    question: 'Y a-t-il des frais cachés en plus de l\'abonnement ?',
    answer:
      'Jamais. Chez Academia Helm, la transparence est un principe fondateur. Le prix affiché inclut l\'accès complet aux 9 modules, les mises à jour, le support et l\'hébergement sécurisé. Seul le frais de souscription initiale est facturé une seule fois à l\'ouverture de votre compte.',
  },
  {
    question: 'Puis-je changer de plan en cours d\'année ?',
    answer:
      'Absolument. Vous pouvez upgrader votre plan à tout moment — l\'ajustement est immédiat et au prorata. Si votre établissement croît et dépasse la tranche d\'effectif, nous vous accompagnons pour une transition fluide sans interruption de service.',
  },
  {
    question: 'Comment fonctionne la facturation annuelle ?',
    answer:
      'En optant pour la facturation annuelle, vous bénéficiez de 2 mois offerts sur l\'année — soit l\'équivalent de 10 mois facturés au lieu de 12. C\'est l\'option la plus avantageuse pour les établissements engagés sur le long terme.',
  },
  {
    question: 'Mes données sont-elles sécurisées et conformes au RGPD ?',
    answer:
      'Vos données sont chiffrées de bout en bout, hébergées sur des serveurs certifiés et entièrement conformes au RGPD et à la loi Informatique et Libertés. Vous gardez le contrôle total : export, modification, suppression — à tout moment.',
  },
  {
    question: 'Quel est le délai de mise en route après souscription ?',
    answer:
      'Votre environnement est activé sous 48 heures ouvrées. Un chef de projet vous accompagne pour l\'onboarding : import de vos données existantes, configuration des paramètres scolaires et formation de votre équipe. Vous êtes opérationnel en une semaine.',
  },
  {
    question: 'Que se passe-t-il si mon effectif dépasse la limite du plan ?',
    answer:
      'Nous vous alertons automatiquement via ORION dès que vous approchez la limite. Vous disposez d\'une période de grâce pour upgrader sans interruption. Notre objectif est votre croissance, pas la pénalité.',
  },
];

/* ------------------------------------------------------------------ */
/*  TRUST BADGES                                                      */
/* ------------------------------------------------------------------ */

const TRUST_BADGES = [
  { icon: Shield, label: 'Conforme RGPD', detail: 'Données chiffrées & souveraines' },
  { icon: Headphones, label: 'Support 7j/7', detail: 'Équipe réactive dédiée' },
  { icon: Zap, label: 'Activation 48h', detail: 'Opérationnel rapidement' },
  { icon: Lock, label: 'Chiffrement AES-256', detail: 'Sécurité bancaliste' },
  { icon: Globe, label: '100% Cloud', detail: 'Accessible partout' },
  { icon: Award, label: 'Normes internationales', detail: 'ISO 27001 en cours' },
];

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                    */
/* ------------------------------------------------------------------ */

export default function TarificationPage() {
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <div className="h-14" />

      {/* ============================================================ */}
      {/*  HERO SECTION                                                */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(165deg, #0b2f73 0%, #1d4fa5 45%, #0b2f73 100%)',
          }}
        />
        {/* Decorative circles */}
        <div className="absolute top-10 right-10 w-72 h-72 rounded-full opacity-[0.06]" style={{ background: '#f5b335' }} />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full opacity-[0.04]" style={{ background: '#f5b335' }} />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 border border-white/20 bg-white/10 backdrop-blur-sm">
            <Sparkles className="w-4 h-4" style={{ color: '#f5b335' }} />
            <span className="text-sm font-medium text-white/90">
              Tarification transparente — Zéro frais caché
            </span>
          </div>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-4"
            style={{ fontFamily: 'Montserrat, system-ui, sans-serif' }}
          >
            Un prix. Neuf modules.{' '}
            <span style={{ color: '#f5b335' }}>Zéro surprise.</span>
          </h1>

          <p className="text-lg md:text-xl text-blue-100/80 max-w-3xl mx-auto leading-relaxed mb-2">
            Avec Academia Helm, vous ne choisissez pas entre les fonctionnalités — elles sont
            toutes incluses, du premier jour. Seule la taille de votre établissement détermine
            votre plan.
          </p>
          <p className="text-sm text-blue-200/60 max-w-2xl mx-auto">
            Élèves, finances, examens, RH, QHSE, communication, IA ORION et modules
            complémentaires — tout est intégré dans chaque plan.
          </p>
        </div>

        {/* Wave separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path
              d="M0 80V30C240 0 480 60 720 40C960 20 1200 60 1440 30V80H0Z"
              fill="white"
            />
          </svg>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  BILLING TOGGLE + PLAN CARDS                                 */}
      {/* ============================================================ */}
      <section className="py-10 md:py-12 bg-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <Users className="w-5 h-5" style={{ color: '#0b2f73' }} />
              <span
                className="text-xs font-bold uppercase tracking-[0.15em]"
                style={{ color: '#0b2f73' }}
              >
                Plans adaptés à votre effectif
              </span>
            </div>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ color: '#0b2f73', fontFamily: 'Montserrat, system-ui, sans-serif' }}
            >
              Choisissez le plan qui épouse votre réalité
            </h2>
            <p className="text-base text-gray-500 max-w-2xl mx-auto">
              Chaque plan débloque l&apos;intégralité des 9 modules. La seule variable, c&apos;est
              la taille de votre établissement.
            </p>
          </div>

          {/* Billing toggle */}
          <div className="flex justify-center mb-6">
            <div
              className="inline-flex items-center gap-2 p-1.5 rounded-full border-2"
              style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}
            >
              <button
                type="button"
                onClick={() => setBillingCycle('MONTHLY')}
                className="px-5 py-2 text-sm font-semibold rounded-full transition-all duration-300"
                style={{
                  background: billingCycle === 'MONTHLY' ? '#0b2f73' : 'transparent',
                  color: billingCycle === 'MONTHLY' ? '#ffffff' : '#64748b',
                }}
              >
                Mensuel
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('ANNUAL')}
                className="px-5 py-2 text-sm font-semibold rounded-full transition-all duration-300"
                style={{
                  background: billingCycle === 'ANNUAL' ? '#f5b335' : 'transparent',
                  color: billingCycle === 'ANNUAL' ? '#0b2f73' : '#64748b',
                }}
              >
                Annuel
              </button>
              {billingCycle === 'ANNUAL' && (
                <span
                  className="px-3 py-1 text-xs font-bold rounded-full animate-pulse"
                  style={{ background: '#f5b335', color: '#0b2f73' }}
                >
                  2 mois offerts
                </span>
              )}
            </div>
          </div>

          {/* Plan cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
            {PLAN_META.map((meta) => {
              const plan = HELM_PLANS[meta.code];
              const isHighlighted = plan.highlighted;
              const isNetwork = meta.code === 'NETWORK';
              const price =
                billingCycle === 'MONTHLY' ? plan.monthlyPrice : plan.annualPrice;

              return (
                <div
                  key={meta.code}
                  className={`relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300 ${
                    isHighlighted
                      ? 'shadow-[0_0_40px_rgba(245,179,53,0.25)] ring-2 scale-[1.02]'
                      : 'shadow-lg hover:shadow-xl'
                  }`}
                  style={{
                    border: isHighlighted
                      ? '2px solid #f5b335'
                      : '2px solid #e2e8f0',
                    background: isNetwork
                      ? 'linear-gradient(180deg, #0b2f73 0%, #1d4fa5 100%)'
                      : '#ffffff',
                  }}
                >
                  {/* Recommended badge */}
                  {isHighlighted && (
                    <div className="absolute -top-0 right-6">
                      <div
                        className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-bold text-white rounded-b-lg"
                        style={{ background: '#f5b335', color: '#0b2f73' }}
                      >
                        <Star className="w-3 h-3" fill="currentColor" />
                        Le plus choisi
                      </div>
                    </div>
                  )}

                  {/* Card header */}
                  <div className="p-5 pb-3">
                    {/* Student range pill */}
                    <span
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide mb-3"
                      style={{
                        background: isNetwork ? 'rgba(245,179,53,0.2)' : '#f0f4ff',
                        color: isNetwork ? '#f5b335' : '#1d4fa5',
                      }}
                    >
                      {meta.studentsRange}
                    </span>

                    <h3
                      className="text-xl font-bold mb-1"
                      style={{
                        color: isNetwork ? '#ffffff' : '#0b2f73',
                        fontFamily: 'Montserrat, system-ui, sans-serif',
                      }}
                    >
                      {plan.name}
                    </h3>

                    <p
                      className="text-sm font-semibold mb-2"
                      style={{ color: isHighlighted ? '#f5b335' : isNetwork ? '#93c5fd' : '#1d4fa5' }}
                    >
                      {meta.subtitle}
                    </p>

                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: isNetwork ? 'rgba(255,255,255,0.65)' : '#64748b' }}
                    >
                      {meta.description}
                    </p>
                  </div>

                  {/* Pricing */}
                  <div className="px-5 pb-3">
                    <div
                      className="p-4 rounded-xl"
                      style={{
                        background: isNetwork
                          ? 'rgba(255,255,255,0.08)'
                          : isHighlighted
                          ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
                          : '#f8fafc',
                      }}
                    >
                      <div
                        className="text-xs font-medium mb-1"
                        style={{ color: isNetwork ? 'rgba(255,255,255,0.5)' : '#94a3b8' }}
                      >
                        {billingCycle === 'MONTHLY' ? 'Abonnement mensuel' : 'Abonnement annuel'}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-3xl font-extrabold"
                          style={{
                            color: isNetwork ? '#ffffff' : '#0b2f73',
                            fontFamily: 'Montserrat, system-ui, sans-serif',
                          }}
                        >
                          {formatAmount(price)}
                        </span>
                        {price != null && (
                          <span
                            className="text-sm"
                            style={{ color: isNetwork ? 'rgba(255,255,255,0.6)' : '#64748b' }}
                          >
                            {billingCycle === 'MONTHLY' ? '/ mois' : '/ an'}
                          </span>
                        )}
                      </div>
                      {billingCycle === 'ANNUAL' && price != null && plan.monthlyPrice != null && (
                        <p
                          className="mt-1 text-xs font-semibold"
                          style={{ color: '#f5b335' }}
                        >
                          Équivalent {formatCurrency(Math.round(price / 12))}/mois
                        </p>
                      )}
                    </div>

                    {/* Setup fee */}
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span style={{ color: isNetwork ? 'rgba(255,255,255,0.4)' : '#94a3b8' }}>
                        Souscription initiale
                      </span>
                      <span
                        className="font-bold"
                        style={{ color: isNetwork ? '#f5b335' : '#0b2f73' }}
                      >
                        {formatAmount(plan.setupFee)}
                      </span>
                    </div>
                  </div>

                  {/* Features list */}
                  <div className="flex-1 px-5 pb-3">
                    <div
                      className="pt-4 border-t"
                      style={{ borderColor: isNetwork ? 'rgba(255,255,255,0.1)' : '#f1f5f9' }}
                    >
                      <ul className="space-y-2.5">
                        {meta.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <CheckCircle
                              className="w-4 h-4 mt-0.5 flex-shrink-0"
                              style={{ color: isNetwork ? '#f5b335' : isHighlighted ? '#f5b335' : '#1d4fa5' }}
                            />
                            <span
                              className="text-sm leading-snug"
                              style={{
                                color: isNetwork ? 'rgba(255,255,255,0.8)' : '#334155',
                                fontWeight: i === 0 ? '600' : '400',
                              }}
                            >
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="p-5 pt-2">
                    <Link
                      href={
                        isNetwork
                          ? '/contact-enterprise'
                          : `/signup?plan=${meta.code.toLowerCase()}`
                      }
                      className={`group inline-flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-sm font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]`}
                      style={{
                        background: isNetwork
                          ? '#f5b335'
                          : isHighlighted
                          ? '#f5b335'
                          : '#0b2f73',
                        color: isNetwork || isHighlighted ? '#0b2f73' : '#ffffff',
                      }}
                    >
                      {isNetwork ? 'Demander un devis personnalisé' : `Choisir ${plan.name}`}
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  ALL-PLANS COMPARISON SECTION                                */}
      {/* ============================================================ */}
      <section
        className="py-10 md:py-12 px-4 sm:px-6 lg:px-8"
        style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)' }}
      >
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <Building2 className="w-5 h-5" style={{ color: '#f5b335' }} />
              <span
                className="text-xs font-bold uppercase tracking-[0.15em]"
                style={{ color: '#0b2f73' }}
              >
                Inclus dans chaque plan
              </span>
            </div>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ color: '#0b2f73', fontFamily: 'Montserrat, system-ui, sans-serif' }}
            >
              Les 9 modules. Dans chaque plan.{' '}
              <span style={{ color: '#f5b335' }}>Sans exception.</span>
            </h2>
            <p className="text-base text-gray-500 max-w-3xl mx-auto">
              Là où d&apos;autres vendent chaque brique séparément, Academia Helm vous donne
              tout. Du pilotage des élèves à l&apos;intelligence artificielle ORION, chaque
              fonctionnalité est à vous — dès le premier jour, sans surcoût.
            </p>
          </div>

          {/* Module grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ALL_PLANS_FEATURES.map((mod, idx) => {
              const IconComponent = mod.icon;
              return (
                <div
                  key={idx}
                  className="group p-5 rounded-xl border-2 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
                  style={{
                    borderColor: '#e2e8f0',
                    background: '#ffffff',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#1d4fa5';
                    e.currentTarget.style.background = '#f0f4ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = '#ffffff';
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: '#f0f4ff' }}
                    >
                      <IconComponent
                        className="w-5 h-5"
                        style={{ color: '#1d4fa5' }}
                      />
                    </div>
                    <div>
                      <h4
                        className="text-sm font-bold mb-1"
                        style={{ color: '#0b2f73' }}
                      >
                        {mod.label}
                      </h4>
                      <p className="text-xs leading-relaxed text-gray-500">
                        {mod.detail}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom highlight bar */}
          <div
            className="mt-10 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-4"
            style={{ background: '#0b2f73' }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#f5b335' }}
            >
              <Sparkles className="w-6 h-6" style={{ color: '#0b2f73' }} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg font-bold text-white mb-1">
                Pas de module « premium » verrouillé. Tout est standard.
              </h3>
              <p className="text-sm text-blue-200/70">
                Notre conviction : un établissement de 100 élèves mérite les mêmes outils
                qu&apos;un réseau de 5 000. La puissance d&apos;Academia Helm est accessible à tous.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  TRUST BADGES SECTION                                        */}
      {/* ============================================================ */}
      <section className="py-10 md:py-12 bg-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <h2
              className="text-2xl md:text-3xl font-bold mb-3"
              style={{ color: '#0b2f73', fontFamily: 'Montserrat, system-ui, sans-serif' }}
            >
              Pourquoi les établissements nous font confiance
            </h2>
            <p className="text-sm text-gray-500">
              Des garanties concrètes, pas des promesses en l&apos;air.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
            {TRUST_BADGES.map((badge, idx) => {
              const IconComponent = badge.icon;
              return (
                <div
                  key={idx}
                  className="flex flex-col items-center text-center p-5 rounded-xl transition-all duration-300 hover:shadow-md"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
                    style={{ background: '#f0f4ff' }}
                  >
                    <IconComponent className="w-5 h-5" style={{ color: '#1d4fa5' }} />
                  </div>
                  <span
                    className="text-sm font-bold mb-1"
                    style={{ color: '#0b2f73' }}
                  >
                    {badge.label}
                  </span>
                  <span className="text-xs text-gray-400">{badge.detail}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FAQ SECTION                                                 */}
      {/* ============================================================ */}
      <section
        id="faq"
        className="py-10 md:py-12 px-4 sm:px-6 lg:px-8"
        style={{ background: '#f8fafc' }}
      >
        <div className="max-w-3xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5" style={{ color: '#1d4fa5' }} />
              <span
                className="text-xs font-bold uppercase tracking-[0.15em]"
                style={{ color: '#0b2f73' }}
              >
                Questions fréquentes
              </span>
            </div>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ color: '#0b2f73', fontFamily: 'Montserrat, system-ui, sans-serif' }}
            >
              Tout ce que vous devez savoir
            </h2>
            <p className="text-base text-gray-500">
              Des réponses claires à vos interrogations les plus courantes.
            </p>
          </div>

          {/* FAQ items */}
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border-2 overflow-hidden transition-all duration-300"
                style={{
                  borderColor: openFaq === idx ? '#1d4fa5' : '#e2e8f0',
                  background: '#ffffff',
                }}
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-5 text-left"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  aria-expanded={openFaq === idx}
                >
                  <span
                    className="text-sm font-bold pr-4"
                    style={{ color: '#0b2f73' }}
                  >
                    {item.question}
                  </span>
                  <ChevronDown
                    className="w-5 h-5 flex-shrink-0 transition-transform duration-300"
                    style={{
                      color: '#1d4fa5',
                      transform: openFaq === idx ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                </button>
                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{
                    maxHeight: openFaq === idx ? '500px' : '0',
                    opacity: openFaq === idx ? 1 : 0,
                  }}
                >
                  <div className="px-5 pb-5">
                    <div
                      className="pt-4 border-t"
                      style={{ borderColor: '#f1f5f9' }}
                    >
                      <p className="text-sm leading-relaxed text-gray-500">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  CTA BAND                                                    */}
      {/* ============================================================ */}
      <section className="py-10 md:py-12 bg-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div
            className="p-8 md:p-10 rounded-2xl relative overflow-hidden"
            style={{
              background: 'linear-gradient(165deg, #0b2f73 0%, #1d4fa5 100%)',
            }}
          >
            {/* Decorative element */}
            <div
              className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-[0.08]"
              style={{ background: '#f5b335', transform: 'translate(30%, -30%)' }}
            />

            <div className="relative z-10">
              <h2
                className="text-3xl md:text-4xl font-bold text-white mb-4"
                style={{ fontFamily: 'Montserrat, system-ui, sans-serif' }}
              >
                Prêt à transformer la gestion de votre école ?
              </h2>
              <p className="text-base text-blue-100/70 max-w-2xl mx-auto mb-5">
                Rejoignez les établissements qui ont choisi l&apos;excellence opérationnelle.
                Démarrez votre essai — aucun engagement, aucune carte bancaire requise.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/signup?plan=grow"
                  className="group inline-flex items-center justify-center px-8 py-4 rounded-xl text-sm font-bold transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
                  style={{ background: '#f5b335', color: '#0b2f73' }}
                >
                  Démarrer avec HELM GROW
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center px-8 py-4 rounded-xl text-sm font-semibold border-2 transition-all duration-300 hover:bg-white/10"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#ffffff' }}
                >
                  Parler à un conseiller
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FOOTER                                                      */}
      {/* ============================================================ */}
      <div className="mt-auto">
        <Footer2 />
      </div>
    </div>
  );
}
