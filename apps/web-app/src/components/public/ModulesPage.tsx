/**
 * Modules Page Component — Academia Helm
 *
 * Page premium présentant l'ensemble des modules de la plateforme.
 * Design SaaS landing page, palette Navy/Blue/Gold, contenu ghostwriter.
 */

'use client';

import { Header } from '@/components/ui/header-1';
import { Footer2 } from '@/components/ui/footer-2';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  GraduationCap,
  Wallet,
  BookOpen,
  FileCheck,
  Users,
  Megaphone,
  Library,
  FlaskConical,
  Bus,
  UtensilsCrossed,
  HeartPulse,
  ShieldCheck,
  Radio,
  ShoppingCart,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Layers,
  Zap,
} from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ModuleData {
  name: string;
  icon: LucideIcon;
  description: string;
  features: string[];
  accent: string; // tailwind color name for the icon container
}

// ─── Data: Modules Principaux ────────────────────────────────────────────────

const mainModules: ModuleData[] = [
  {
    name: 'Tableau de Bord Central',
    icon: LayoutDashboard,
    accent: 'blue',
    description:
      "Le nerve centre de votre établissement. Visualisez en un clin d'œil les effectifs, les revenus, les taux de réussite et les alertes prioritaires grâce à des tableaux de bord interactifs actualisés en temps réel. Chaque widget est personnalisable selon votre rôle — directeur, comptable ou enseignant — afin que seules les métriques qui comptent réellement s'affichent sur votre écran.",
    features: [
      'Métriques en temps réel',
      'Graphiques de performance',
      'Notifications intelligentes',
      'Calendrier intégré',
      'Accès rapide multi-modules',
    ],
  },
  {
    name: 'Gestion des Élèves et Scolarité',
    icon: GraduationCap,
    accent: 'emerald',
    description:
      "Pilotez l'intégralité du cycle de vie scolaire de chaque élève, de la première inscription à la remise du diplôme. Gérez les admissions, les affectations de classe, les mouvements internes et les transferts avec une traçabilité complète. Chaque dossier élève centralise les informations académiques, disciplinaires et familiales, éliminant les fichiers épars et les saisies redondantes.",
    features: [
      'Inscription et admission',
      'Organisation des classes',
      'Suivi des absences',
      'Gestion disciplinaire',
      'Documents automatisés',
    ],
  },
  {
    name: 'Gestion Financière et Économat',
    icon: Wallet,
    accent: 'amber',
    description:
      "Maîtrisez chaque franc qui entre et sort de votre établissement. Configurez les frais de scolarité par niveau et par filière, suivez les paiements en espèces, virement ou Mobile Money, et bloquez automatiquement l'accès aux examens pour les comptes impayés. La clôture journalière, la trésorerie prévisionnelle et les rapports financiers sont générés en un clic, réduisant les risques d'erreur et de fraude.",
    features: [
      'Frais configurables par niveau',
      'Paiements multi-canaux',
      'Contrôle de scolarité',
      'Clôture quotidienne',
      'Trésorerie prévisionnelle',
    ],
  },
  {
    name: 'Planification et Études',
    icon: BookOpen,
    accent: 'violet',
    description:
      "Concevez l'architecture pédagogique de votre établissement avec une précision chirurgicale. Gérez les salles, les matières et les affectations d'enseignants, puis laissez l'algorithme de génération automatique construire des emplois du temps sans conflits. Le cahier journal, les fiches pédagogiques et le cahier de textes sont digitalisés, offrant une traçabilité complète de l'activité enseignante.",
    features: [
      'Gestion des salles',
      'Emplois du temps automatiques',
      'Cahier journal digital',
      'Fiches pédagogiques',
      'Cahier de textes',
    ],
  },
  {
    name: 'Examens et Évaluation',
    icon: FileCheck,
    accent: 'rose',
    description:
      "De la saisie des notes à l'édition des bulletins, automatisez tout le processus d'évaluation sans sacrifier la rigueur académique. Les moyennes, les rangs et les appréciations sont calculés automatiquement selon vos barèmes. Les conseils de classe sont assistés par des tableaux synthétiques, et les tableaux d'honneur sont générés instantanément, valorisant la méritocratie au sein de votre établissement.",
    features: [
      'Saisie des notes sécurisée',
      'Bulletins automatiques',
      'Conseils de classe assistés',
      'Tableaux d\'honneur',
      'Statistiques de performance',
    ],
  },
  {
    name: 'Gestion du Personnel et RH',
    icon: Users,
    accent: 'cyan',
    description:
      "Administrer le capital humain de votre établissement n'a jamais été aussi fluide. Des fiches de personnel complètes aux contrats CDI, CDD ou Vacation, chaque collaborateur est suivi de son recrutement à son départ. Le calcul automatique de la paie intègre les primes, les retenues et les cotisations CNSS, tandis que les évaluations et les formations garantissent le développement continu de vos équipes.",
    features: [
      'Fiches de personnel complètes',
      'Contrats multi-types',
      'Paie automatique',
      'Évaluations et formations',
      'Statistiques RH',
    ],
  },
  {
    name: 'Communication',
    icon: Megaphone,
    accent: 'orange',
    description:
      "Tissez un lien permanent entre l'établissement, les élèves et les familles. Envoyez des SMS et des notifications en masse, orchestrez des campagnes email ciblées et exploitez WhatsApp Business pour des conversations personnalisées. Le tableau de bord analytics vous permet de mesurer les taux de délivrance et de lecture de chaque campagne, ajustant votre stratégie de communication en temps réel.",
    features: [
      'SMS et notifications en masse',
      'Campagnes email ciblées',
      'WhatsApp Business intégré',
      'Notifications push',
      'Analytics de communication',
    ],
  },
];

// ─── Data: Modules Complémentaires ───────────────────────────────────────────

const complementaryModules: ModuleData[] = [
  {
    name: 'Bibliothèque',
    icon: Library,
    accent: 'teal',
    description:
      "Transformez votre bibliothèque en un centre de ressources moderne et parfaitement organisé. Le catalogue complet des ouvrages est searchable par titre, auteur, mot-clé ou cote, tandis que le système de prêts et retours gère automatiquement les échéances et les pénalités. Les rappels intégrés réduisent les retards, et les statistiques d'emprunt vous aident à optimiser vos acquisitions.",
    features: [
      'Catalogue searchable',
      'Prêts et retours automatisés',
      'Rappels de retard',
      'Fichier des lecteurs',
      'Statistiques d\'emprunt',
    ],
  },
  {
    name: 'Laboratoire',
    icon: FlaskConical,
    accent: 'sky',
    description:
      "Gérez vos laboratoires avec la rigueur qu'exigent les sciences. Planifiez les réservations de salles, suivez l'inventaire des équipements et des réactifs, et programmez les maintenances préventives pour éviter les pannes en plein cours. Le planning d'occupation vous offre une vue claire de la disponibilité de chaque espace, maximisant l'utilisation de vos ressources scientifiques.",
    features: [
      'Réservation de laboratoires',
      'Inventaire des équipements',
      'Maintenance programmée',
      'Planning d\'occupation',
      'Traçabilité des réactifs',
    ],
  },
  {
    name: 'Transport',
    icon: Bus,
    accent: 'lime',
    description:
      "Assurez la sécurité et la ponctualité de chaque trajet scolaire. Gérez les véhicules, les itinéraires et les conducteurs dans un tableau de bord unifié, et suivez les trajets en temps réel pour informer les familles. La maintenance préventive est planifiée automatiquement selon le kilométrage, réduisant les pannes imprévues et garantissant la conformité aux normes de sécurité.",
    features: [
      'Gestion des véhicules',
      'Itinéraires optimisés',
      'Suivi des trajets',
      'Maintenance préventive',
      'Planning des transports',
    ],
  },
  {
    name: 'Cantine',
    icon: UtensilsCrossed,
    accent: 'yellow',
    description:
      "Offrez une expérience de restauration scolaire maîtrisée et transparente. Les menus sont planifiés à l'avance et personnalisables selon les régimes alimentaires, les inscriptions des élèves sont gérées en ligne, et les paiements sont intégrés au module financier. Les rapports de fréquentation vous permettent d'ajuster les quantités et de réduire le gaspillage alimentaire.",
    features: [
      'Menus personnalisables',
      'Inscriptions en ligne',
      'Paiements intégrés',
      'Rapports de fréquentation',
      'Gestion des allergènes',
    ],
  },
  {
    name: 'Infirmerie',
    icon: HeartPulse,
    accent: 'pink',
    description:
      "La santé de vos élèves mérite un suivi aussi rigoureux que leur parcours académique. Constituez des dossiers médicaux complets pour chaque élève, enregistrez les visites à l'infirmerie et suivez les traitements administrés. Le système d'alertes vous informe en temps réel des urgences, et les rapports médicaux périodiques garantissent la conformité aux normes sanitaires en vigueur.",
    features: [
      'Dossiers médicaux complets',
      'Visites et traitements',
      'Alertes d\'urgence',
      'Suivi des médicaments',
      'Rapports médicaux',
    ],
  },
  {
    name: 'QHSE — Qualité, Hygiène, Sécurité',
    icon: ShieldCheck,
    accent: 'emerald',
    description:
      "Inscrivez votre établissement dans une démarche d'excellence opérationnelle continue. Planifiez et documentez les inspections régulières, enregistrez les incidents et suivez les plans d'action correctifs jusqu'à leur clôture. Les formations sécurité, les audits internes et le suivi de la conformité réglementaire sont centralisés, vous protégeant contre les risques juridiques et humains.",
    features: [
      'Inspections planifiées',
      'Gestion des incidents',
      'Formations sécurité',
      'Plans d\'action correctifs',
      'Conformité réglementaire',
    ],
  },
  {
    name: 'EduCast — Diffusion de Contenu',
    icon: Radio,
    accent: 'fuchsia',
    description:
      "Propulsez votre établissement dans l'ère du contenu éducatif numérique. Diffusez des cours en streaming live, publiez des podcasts et des webinaires à la demande, et constituez une médiathèque accessible partout, même en mode hors-ligne. Les analytics d'écoute vous révèlent les contenus les plus engageants, vous permettant d'affiner votre stratégie pédagogique digitale.",
    features: [
      'Streaming en direct',
      'Podcasts et webinaires',
      'Médiathèque archivée',
      'Mode hors-ligne',
      'Analytics d\'écoute',
    ],
  },
  {
    name: 'Boutique',
    icon: ShoppingCart,
    accent: 'indigo',
    description:
      "Monétisez la vente de fournitures et de tenues scolaires directement depuis votre plateforme. Gérez les stocks en temps réel, acceptez les commandes en ligne des familles, et synchronisez automatiquement la comptabilité avec le module financier. Les rapports de vente détaillés vous donnent une visibilité complète sur les revenus annexes de votre établissement.",
    features: [
      'Vente de fournitures',
      'Gestion des stocks',
      'Commandes en ligne',
      'Comptabilité intégrée',
      'Rapports de vente',
    ],
  },
];

// ─── Accent color map ────────────────────────────────────────────────────────

const accentMap: Record<string, { bg: string; iconBg: string; iconText: string; border: string; featureDot: string }> = {
  blue:     { bg: 'bg-blue-50',     iconBg: 'bg-[#1d4fa5]', iconText: 'text-white',       border: 'hover:border-[#1d4fa5]/40', featureDot: 'bg-[#1d4fa5]' },
  emerald:  { bg: 'bg-emerald-50',  iconBg: 'bg-emerald-600', iconText: 'text-white',     border: 'hover:border-emerald-400/40', featureDot: 'bg-emerald-600' },
  amber:    { bg: 'bg-amber-50',    iconBg: 'bg-[#f5b335]', iconText: 'text-[#0b2f73]',   border: 'hover:border-[#f5b335]/40', featureDot: 'bg-[#f5b335]' },
  violet:   { bg: 'bg-violet-50',   iconBg: 'bg-violet-600', iconText: 'text-white',      border: 'hover:border-violet-400/40', featureDot: 'bg-violet-600' },
  rose:     { bg: 'bg-rose-50',     iconBg: 'bg-rose-600',   iconText: 'text-white',      border: 'hover:border-rose-400/40', featureDot: 'bg-rose-600' },
  cyan:     { bg: 'bg-cyan-50',     iconBg: 'bg-cyan-600',   iconText: 'text-white',      border: 'hover:border-cyan-400/40', featureDot: 'bg-cyan-600' },
  orange:   { bg: 'bg-orange-50',   iconBg: 'bg-orange-600', iconText: 'text-white',      border: 'hover:border-orange-400/40', featureDot: 'bg-orange-600' },
  teal:     { bg: 'bg-teal-50',     iconBg: 'bg-teal-600',   iconText: 'text-white',      border: 'hover:border-teal-400/40', featureDot: 'bg-teal-600' },
  sky:      { bg: 'bg-sky-50',      iconBg: 'bg-sky-600',    iconText: 'text-white',      border: 'hover:border-sky-400/40', featureDot: 'bg-sky-600' },
  lime:     { bg: 'bg-lime-50',     iconBg: 'bg-lime-600',   iconText: 'text-white',      border: 'hover:border-lime-400/40', featureDot: 'bg-lime-600' },
  yellow:   { bg: 'bg-yellow-50',   iconBg: 'bg-yellow-500', iconText: 'text-[#0b2f73]',  border: 'hover:border-yellow-400/40', featureDot: 'bg-yellow-500' },
  pink:     { bg: 'bg-pink-50',     iconBg: 'bg-pink-600',   iconText: 'text-white',      border: 'hover:border-pink-400/40', featureDot: 'bg-pink-600' },
  fuchsia:  { bg: 'bg-fuchsia-50',  iconBg: 'bg-fuchsia-600', iconText: 'text-white',     border: 'hover:border-fuchsia-400/40', featureDot: 'bg-fuchsia-600' },
  indigo:   { bg: 'bg-indigo-50',   iconBg: 'bg-indigo-600', iconText: 'text-white',      border: 'hover:border-indigo-400/40', featureDot: 'bg-indigo-600' },
};

// ─── Stats data ──────────────────────────────────────────────────────────────

const stats = [
  { value: '15', label: 'Modules intégrés', icon: Layers },
  { value: '100+', label: 'Fonctionnalités', icon: BarChart3 },
  { value: '1', label: 'Seule plateforme', icon: Zap },
];

// ─── Module Card ─────────────────────────────────────────────────────────────

function ModuleCard({ module: m, index }: { module: ModuleData; index: number }) {
  const colors = accentMap[m.accent] ?? accentMap.blue;
  const Icon = m.icon;

  return (
    <div
      className={cn(
        'group relative bg-white rounded-2xl border border-gray-200/80',
        'p-5 sm:p-6',
        'shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]',
        'hover:shadow-[0_4px_16px_rgba(0,0,0,0.08),0_12px_40px_rgba(0,0,0,0.06)]',
        colors.border,
        'hover:-translate-y-1',
        'transition-all duration-300 ease-out',
        'cursor-pointer',
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center mb-3',
          'shadow-sm group-hover:shadow-md',
          'group-hover:scale-110',
          'transition-all duration-300',
          colors.iconBg,
          colors.iconText,
        )}
      >
        <Icon className="w-5 h-5" strokeWidth={2} />
      </div>

      {/* Title */}
      <h3 className="text-[#0b2f73] font-bold text-lg leading-snug mb-3 group-hover:text-[#1d4fa5] transition-colors duration-300">
        {m.name}
      </h3>

      {/* Description */}
      <p className="text-gray-500 text-sm leading-relaxed mb-5">
        {m.description}
      </p>

      {/* Features */}
      <ul className="space-y-2">
        {m.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-gray-600">
            <span className={cn('mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0', colors.featureDot)} />
            {feature}
          </li>
        ))}
      </ul>

      {/* Hover accent line at top */}
      <div
        className={cn(
          'absolute top-0 left-6 right-6 h-0.5 rounded-b-full',
          'opacity-0 group-hover:opacity-100',
          'transition-opacity duration-300',
          colors.featureDot,
        )}
      />
    </div>
  );
}

// ─── Section Heading ─────────────────────────────────────────────────────────

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center px-4 py-1.5 bg-[#0b2f73]/5 rounded-full mb-3">
        <span className="text-[#0b2f73] text-xs font-semibold uppercase tracking-widest">
          {subtitle}
        </span>
      </div>
      <h2 className="text-3xl md:text-4xl font-bold text-[#0b2f73] leading-tight">
        {title}
      </h2>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ModulesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      {/* ── Hero Section ───────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-12 sm:pt-24 sm:pb-16 overflow-hidden">
        {/* Navy gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b2f73] via-[#123f8a] to-[#1d4fa5]" />

        {/* Decorative shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-[#f5b335]/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-60 -left-40 w-[400px] h-[400px] bg-[#1d4fa5]/30 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-white/[0.02] rounded-full" />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Gold badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#f5b335]/15 border border-[#f5b335]/30 rounded-full mb-5 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-[#f5b335]" />
            <span className="text-[#f5b335] text-sm font-semibold tracking-wide">
              Plateforme tout-en-un
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-4">
            15 modules. Zéro compromis.
            <br />
            <span className="text-[#f5b335]">Tout ce dont votre établissement a besoin.</span>
          </h1>

          {/* Sub-headline */}
          <p className="text-lg sm:text-xl text-blue-100/80 max-w-3xl mx-auto mb-6 leading-relaxed">
            Academia Helm unifie l&apos;administration, la pédagogie, la finance et la communication
            au sein d&apos;une plateforme unique et cohérente. Chaque module est conçu pour
            fonctionner en synergie — pas en silot.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#f5b335] text-[#0b2f73] font-bold rounded-xl text-base shadow-lg shadow-[#f5b335]/25 hover:bg-[#f7c359] hover:shadow-xl hover:shadow-[#f5b335]/30 hover:-translate-y-0.5 transition-all duration-300"
            >
              Démarrer maintenant
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/tarification"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white font-semibold rounded-xl text-base border border-white/20 backdrop-blur-sm hover:bg-white/20 hover:-translate-y-0.5 transition-all duration-300"
            >
              Voir la tarification
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats Section ──────────────────────────────────────────────── */}
      <section className="relative -mt-8 z-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          {stats.map((stat) => {
            const StatIcon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center gap-4 justify-center sm:justify-start">
                <div className="w-12 h-12 rounded-xl bg-[#0b2f73]/5 flex items-center justify-center flex-shrink-0">
                  <StatIcon className="w-5 h-5 text-[#1d4fa5]" />
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#0b2f73] leading-none">
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">{stat.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Modules Principaux ─────────────────────────────────────────── */}
      <section className="py-12 sm:py-16 bg-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            subtitle="Cœur de la plateforme"
            title="Modules Principaux"
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {mainModules.map((m, i) => (
              <ModuleCard key={m.name} module={m} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Modules Complémentaires ────────────────────────────────────── */}
      <section className="py-12 sm:py-16 bg-gradient-to-b from-gray-50/80 to-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            subtitle="Et allez plus loin"
            title="Modules Complémentaires"
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {complementaryModules.map((m, i) => (
              <ModuleCard key={m.name} module={m} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ────────────────────────────────────────────────── */}
      <section className="relative py-14 sm:py-20 overflow-hidden">
        {/* Navy background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b2f73] via-[#0f3a8a] to-[#1d4fa5]" />

        {/* Decorative shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#f5b335]/[0.08] rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#1d4fa5]/30 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Gold icon badge */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#f5b335]/15 border border-[#f5b335]/25 rounded-2xl mb-5">
            <CheckCircle2 className="w-8 h-8 text-[#f5b335]" />
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Tous les modules sont inclus.
            <br />
            <span className="text-[#f5b335]">Aucune option cachée. Aucun bridage.</span>
          </h2>

          <p className="text-lg text-blue-100/70 max-w-2xl mx-auto mb-6 leading-relaxed">
            Lorsque vous activez Academia Helm, vous obtenez immédiatement accès aux 15 modules.
            Aucun supplément, aucune limitation. Accès complet dès le premier jour —
            parce que gérer un établissement demande déjà assez de compromis.
          </p>

          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-10 py-4 bg-[#f5b335] text-[#0b2f73] font-bold rounded-xl text-lg shadow-lg shadow-[#f5b335]/25 hover:bg-[#f7c359] hover:shadow-xl hover:shadow-[#f5b335]/30 hover:-translate-y-0.5 transition-all duration-300"
          >
            Activer Academia Helm maintenant
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="mt-auto bg-[#0b2f73] border-t border-[#144798]">
        <Footer2 />
      </div>
    </div>
  );
}
