'use client';

/**
 * ============================================================================
 * CMS — Contenu du site (landing page)
 * ============================================================================
 *
 * Page back-office permettant de gérer le contenu des sections de la landing
 * page publique (Hero, Modules, Tarification, Témoignages, CTA).
 *
 * État actuel : lecture seule. L'édition complète sera disponible après la
 * création de la table `landing_sections` côté backend (NestJS / Prisma).
 * Chaque section est affichée sous forme de carte avec un bouton "Modifier"
 * désactivé (tooltip "Bientôt disponible").
 *
 * Palette AH : blue-900 (titres), amber-500 (accents), red-600 (erreurs).
 * ============================================================================
 */

import {
  Megaphone,
  LayoutGrid,
  CreditCard,
  Star,
  Rocket,
  Pencil,
  FileText,
  Info,
  Lock,
} from 'lucide-react';

interface LandingSection {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  accent: 'amber' | 'blue' | 'emerald' | 'violet' | 'rose';
}

const SECTIONS: LandingSection[] = [
  {
    id: 'hero',
    name: 'Hero Section',
    description: "Titre principal, sous-titre, bouton d'appel à l'action (CTA).",
    icon: <Megaphone className="w-5 h-5" />,
    accent: 'amber',
  },
  {
    id: 'modules',
    name: 'Section Modules',
    description: 'Présentation des modules de la plateforme (Recrutement, Pédagogie, Finance, etc.).',
    icon: <LayoutGrid className="w-5 h-5" />,
    accent: 'blue',
  },
  {
    id: 'pricing',
    name: 'Section Tarification',
    description: 'Affichage des plans (SEED, GROW, LEAD, NETWORK) et de leurs prix.',
    icon: <CreditCard className="w-5 h-5" />,
    accent: 'emerald',
  },
  {
    id: 'testimonials',
    name: 'Section Témoignages',
    description: "Avis clients et témoignages des établissements partenaires.",
    icon: <Star className="w-5 h-5" />,
    accent: 'violet',
  },
  {
    id: 'cta',
    name: 'Section CTA',
    description: "Appel à l'action final — incitation à la prise de rendez-vous ou à l'inscription.",
    icon: <Rocket className="w-5 h-5" />,
    accent: 'rose',
  },
];

const ACCENT_MAP: Record<LandingSection['accent'], { bg: string; text: string; ring: string }> = {
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-900', ring: 'ring-blue-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-100' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-100' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-100' },
};

export default function CmsPage() {
  return (
    <div className="space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Contenu du site</h1>
          <p className="text-slate-500">
            Gérez le contenu des sections de la landing page publique
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-700">
          <Lock className="w-3.5 h-3.5" />
          Mode lecture seule
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <div className="w-8 h-8 shrink-0 rounded-lg bg-white flex items-center justify-center text-blue-900">
          <Info className="w-4 h-4" />
        </div>
        <div className="text-sm text-blue-900">
          <p className="font-semibold">L&apos;édition complète du contenu sera disponible après la création de la table <code className="font-mono bg-white/60 px-1 py-0.5 rounded">landing_sections</code>.</p>
          <p className="text-blue-700/80 text-xs mt-1">
            Pour l&apos;instant, les sections sont affichées en lecture seule. Une fois le backend prêt, chaque carte ouvrira un éditeur de contenu (textarea / éditeur riche).
          </p>
        </div>
      </div>

      {/* Sections grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTIONS.map((section) => {
          const accent = ACCENT_MAP[section.accent];
          return (
            <div
              key={section.id}
              className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              {/* Icon + name */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl ${accent.bg} ${accent.text} flex items-center justify-center ring-1 ${accent.ring}`}
                >
                  {section.icon}
                </div>
                <h2 className="text-base font-bold text-slate-900">{section.name}</h2>
              </div>

              {/* Description */}
              <p className="mt-3 text-sm text-slate-500 flex-1 leading-relaxed">
                {section.description}
              </p>

              {/* Footer with disabled edit button */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                  <FileText className="w-3 h-3" />
                  Lecture seule
                </span>
                <button
                  type="button"
                  disabled
                  title="Bientôt disponible"
                  aria-label="Modifier (bientôt disponible)"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 bg-slate-100 cursor-not-allowed"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Modifier
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
