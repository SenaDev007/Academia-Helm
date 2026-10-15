import Link from 'next/link';
import {
  GraduationCap,
  BookOpen,
  ClipboardList,
  FileText,
  CalendarDays,
  Calculator,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Users,
} from 'lucide-react';

/**
 * ============================================================================
 * HELM ENSEIGNANT — LANDING MARKETING (publique)
 * ============================================================================
 *
 * Mini-SaaS intégré à Academia Helm pour les enseignants individuels :
 * préparer ses classes (cahier journal, fiches pédagogiques, cahier de
 * textes), programmer des évaluations, saisir les notes et générer les
 * bulletins — SANS attendre que son école souscrive.
 */

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Cahier journal',
    description:
      'La grille hebdomadaire 5 jours × matières, prête à remplir, avec impression PDF au format officiel.',
  },
  {
    icon: FileText,
    title: 'Fiches pédagogiques',
    description:
      'Les 6 types de fiches (leçon, exercices, évaluation…) avec pré-remplissage depuis le cahier journal.',
  },
  {
    icon: ClipboardList,
    title: 'Cahier de textes',
    description:
      'Le suivi quotidien des séances réellement exécutées, classe par classe et matière par matière.',
  },
  {
    icon: CalendarDays,
    title: 'Planification mensuelle & annuelle',
    description:
      'Répartissez le programme officiel sur l’année, avec proposition automatique et export PDF.',
  },
  {
    icon: Calculator,
    title: 'Évaluations, notes & bulletins',
    description:
      'Créez vos évaluations, saisissez les notes, les moyennes se calculent automatiquement et le bulletin se génère.',
  },
  {
    icon: Sparkles,
    title: 'Tous les niveaux offerts',
    description:
      'Activez Maternelle, Primaire ou Secondaire : toutes les classes (CI → CM2, 6ème → Terminale) et toutes les matières du niveau sont livrées automatiquement.',
  },
];

const STEPS = [
  {
    number: '1',
    title: 'Créez votre compte',
    description:
      'Votre email et un mot de passe. Aucune école nécessaire — votre espace vous appartient.',
  },
  {
    number: '2',
    title: 'Activez vos niveaux',
    description:
      'Maternelle, Primaire, Secondaire : le système installe pour vous toutes les classes et matières des niveaux choisis.',
  },
  {
    number: '3',
    title: 'Préparez vos classes',
    description:
      'Cahier journal, fiches, évaluations, bulletins : tout l’outillage pédagogique d’Academia Helm, à votre nom.',
  },
];

export default function HelmEnseignantLandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-base font-bold text-slate-900">Helm Enseignant</p>
              <p className="text-xs text-slate-500">par Academia Helm</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#fonctionnalites" className="hover:text-teal-700">Fonctionnalités</a>
            <a href="#processus" className="hover:text-teal-700">Comment ça marche</a>
            <a href="#tarification" className="hover:text-teal-700">Tarification</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/prof/login"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Se connecter
            </Link>
            <Link
              href="/prof/register"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
            >
              Créer mon espace
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-teal-50 via-white to-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-1.5 text-sm font-medium text-teal-800">
              <GraduationCap className="h-4 w-4" />
              Pour les enseignants, financé par les enseignants
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Préparez vos classes comme un professionnel,
              <span className="text-teal-600"> sans attendre votre école</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-600">
              Votre école n’est pas encore sur Academia Helm ? Peu importe. Créez votre espace
              personnel : cahier journal, fiches pédagogiques, cahier de textes, évaluations,
              notes et bulletins — tout l’outillage pédagogique de la plateforme, à vous seul,
              à partir de <strong>2 000 FCFA / mois</strong>.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/prof/register"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 sm:w-auto"
              >
                Créer mon espace enseignant
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/prof/login"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-8 py-4 text-base font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
              >
                J’ai déjà un compte
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              Tous les niveaux inclus : Maternelle, Primaire, Secondaire — vous activez ce que
              vous enseignez.
            </p>
          </div>
        </div>
      </section>

      {/* ── Fonctionnalités ── */}
      <section id="fonctionnalites" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-slate-900">Tout pour préparer votre année</h2>
            <p className="mt-4 text-slate-600">
              Le module pédagogique complet d’Academia Helm, éprouvé dans les écoles, mis à
              disposition de l’enseignant individuel.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Processus ── */}
      <section id="processus" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-slate-900">Trois minutes pour démarrer</h2>
            <p className="mt-4 text-slate-600">
              Le système installe pour vous le référentiel officiel : classes, matières,
              programme — vous n’avez rien à configurer.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.number} className="relative rounded-2xl border border-slate-200 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-lg font-bold text-white">
                  {step.number}
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tarification ── */}
      <section id="tarification" className="bg-slate-900 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white">Un abonnement d’enseignant</h2>
            <p className="mt-4 text-slate-300">
              Financé par vos propres fonds, résiliable à tout moment. Bien moins cher qu’une
              journée de photocopie.
            </p>
          </div>
          <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-teal-500/40 bg-slate-800 p-8">
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-5xl font-extrabold text-white">2 000</span>
              <span className="text-lg text-slate-300">– 5 000 FCFA / mois</span>
            </div>
            <ul className="mt-8 space-y-3 text-sm text-slate-200">
              {[
                'Espace pédagogique complet (cahiers, fiches, textes, planification)',
                'Tous les niveaux : Maternelle, Primaire, Secondaire',
                'Évaluations, saisie de notes et génération de bulletins',
                'Impression PDF professionnelle avec VOS en-têtes et pieds de page',
                'Vos données restent vôtres — exportables à tout moment',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/prof/register"
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-6 py-4 text-base font-semibold text-white hover:bg-teal-400"
            >
              Commencer maintenant
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA promoteur ── */}
      <section className="bg-teal-50 py-16">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 text-center sm:px-6">
          <Users className="h-10 w-10 text-teal-700" />
          <h2 className="text-2xl font-bold text-slate-900">
            Votre école pourrait gérer bien plus que la pédagogie
          </h2>
          <p className="max-w-2xl text-slate-600">
            Vous préparez déjà vos classes avec Helm Enseignant ? Invitez votre promoteur à
            découvrir Academia Helm : inscriptions, frais de scolarité, notes, bulletins,
            communication parents — toute l’école sur une seule plateforme.
          </p>
          <Link
            href="/prof/register"
            className="rounded-xl bg-teal-700 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Créer mon espace puis inviter mon promoteur
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-teal-600" />
            <span>Helm Enseignant — un produit Academia Helm</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/prof/login" className="hover:text-slate-700">Connexion</Link>
            <Link href="/prof/register" className="hover:text-slate-700">Inscription</Link>
            <Link href="/" className="hover:text-slate-700">Academia Helm</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
