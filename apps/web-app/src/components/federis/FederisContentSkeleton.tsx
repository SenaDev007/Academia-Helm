/**
 * FederisContentSkeleton — Squelette de chargement de la ZONE DE CONTENU
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ OPTIMISATION NAVIGATION (2026-10-01) — layout partagé (connected) :
 *
 * Le chrome de l'application (header + sidebar) est désormais monté UNE SEULE
 * fois par le layout du groupe de routes (connected) et PERSISTE entre les
 * modules. Les loading.tsx des modules n'ont donc PLUS BESOIN de reproduire
 * header + sidebar — au contraire : le clone complet de la sidebar provoquait
 * un « jeu de défilement » (la sidebar factice remplaçait la vraie, le scroll
 * se réinitialisait, puis la vraie sidebar revenait) à chaque changement de
 * module.
 *
 * Ce squelette ne remplace QUE la zone de contenu, À L'INTÉRIEUR du chrome
 * persistant : transition visuellement continue, sidebar immobile.
 */

'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/** Libellé lisible du module en cours de chargement (d'après l'URL). */
const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/patronats': 'Patronats territoriaux',
  '/bureau': 'Bureau & Membres',
  '/team': 'Équipe & Comptes',
  '/schools': 'Écoles rattachées',
  '/subjects': 'Matières',
  '/exams': 'Examens nationaux',
  '/centers': 'Centres et salles',
  '/candidates': 'Candidats',
  '/grades': 'Notes et moyennes',
  '/saisie': 'Saisie des notes',
  '/deliberations': 'Délibérations',
  '/documents': 'Épreuves et documents',
  '/question-bank': 'Banque d’épreuves',
  '/reports': 'Rapports et statistiques',
  '/settings': 'Paramètres',
  '/archives': 'Archives',
  '/checkout': 'Abonnement',
};

/** Bloc de squelette animé (pulse) — mêmes teintes que fed-card. */
function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl bg-slate-200/70 animate-pulse',
        className,
      )}
    />
  );
}

export default function FederisContentSkeleton() {
  const pathname = usePathname() ?? '';

  // Libellé du module (dernier segment connu de l'URL fédérée)
  const label =
    PAGE_LABELS[pathname] ??
    PAGE_LABELS[`/${pathname.split('/').filter(Boolean).pop() ?? ''}`] ??
    'Chargement du module';

  return (
    <div>
      {/* Indicateur du module en cours de chargement */}
      <div className="flex items-center justify-center gap-3 py-8">
        <div className="relative">
          <div className="academia-loader-ring-sm" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Image
              src="/images/logo-Academia Hub.webp"
              alt="Academia Federis"
              width={24}
              height={24}
              className="relative z-10 rounded-full"
              priority
            />
          </div>
        </div>
        <span className="text-sm text-slate-500 font-medium">
          Chargement de « {label} »…
        </span>
      </div>

      {/* Squelette de page : en-tête + cartes + tableau (pattern fed-card) */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-3">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-8 w-72 max-w-full" />
            <SkeletonBlock className="h-4 w-52 max-w-full" />
          </div>
          <SkeletonBlock className="h-11 w-44" />
        </div>

        <div className="fed-card p-6 space-y-4">
          <SkeletonBlock className="h-5 w-48" />
          <div className="space-y-3">
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-11/12" />
            <SkeletonBlock className="h-4 w-8/12" />
          </div>
        </div>

        <div className="fed-card overflow-hidden">
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonBlock key={i} className="h-20 w-full" />
              ))}
            </div>
            <div className="space-y-3 pt-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <SkeletonBlock key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
