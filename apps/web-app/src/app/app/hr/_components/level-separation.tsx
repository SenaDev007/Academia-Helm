'use client';

/**
 * ============================================================================
 * SÉPARATION PAR NIVEAU SCOLAIRE — Module RH (retour promoteur 2026-11-26)
 * ============================================================================
 *
 * Si le niveau SECONDAIRE est activé dans les paramètres de l'école (en plus
 * des niveaux maternelle/primaire), tous les espaces RH séparent le personnel :
 *   - « Maternelle & Primaire » regroupés d'un côté ;
 *   - « Secondaire » regroupé de l'autre.
 * Fin des listes mélangées — Collaborateurs (Personnel, Liste du personnel,
 * Contrats), Congés & Absences, Présence, Indemnité, Paie.
 *
 * La catégorie d'un membre du personnel est déterminée par (dans l'ordre) :
 *   1. Staff.schoolLevel (FK posée à l'embauche / sur la fiche personnel) ;
 *   2. le département RH (« Département Secondaire »…) ;
 *   3. le poste (« Enseignant du secondaire », « Professeur … secondaire »…).
 * Un personnel sans niveau détecté reste du côté Maternelle & Primaire
 * (personnel administratif transverse, écoles historiques maternel/primaire).
 *
 * La séparation ne s'affiche que pour une école MIXTE (maternel/primaire ET
 * secondaire activés dans Paramètres > Structure) : une école 100 %
 * maternel/primaire ou 100 % secondaire n'a rien à séparer.
 */

import { useEffect, useState } from 'react';
import { Baby, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StaffLevelCategory = 'MATERNEL_PRIMAIRE' | 'SECONDAIRE';

/** Récupère les codes des niveaux ACTIVÉS (MATERNELLE/PRIMAIRE/SECONDAIRE…). */
async function fetchEnabledLevelCodes(): Promise<string[]> {
  try {
    const res = await fetch('/api/school-levels', { credentials: 'include' });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((l: any) => String(l?.code || l?.name || '')).filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Le niveau secondaire est-il activé ET l'école est-elle mixte
 * (maternel/primaire + secondaire) ? Conditions de la séparation RH.
 */
export function useSecondaryLevelEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchEnabledLevelCodes().then((codes) => {
      if (cancelled) return;
      const hasSecondary = codes.some((c) => /SECOND|COLLEGE|LYCEE/i.test(c));
      const hasMatPri = codes.some((c) => /MATERN|PRIMA/i.test(c));
      setEnabled(hasSecondary && hasMatPri);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
}

/**
 * Catégorie de niveau d'un membre du personnel.
 * Accepte une fiche Staff complète ou un objet embarqué `{ staff }` (ligne
 * de paie, demande de congé…) — miroir → département → poste.
 */
export function staffLevelCategory(item: any): StaffLevelCategory {
  const s = item?.staff ?? item;
  const raw = [
    s?.schoolLevel?.name,
    s?.schoolLevel?.code,
    s?.schoolLevelName,
    s?.department,
    s?.position,
  ]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();
  if (raw.includes('SECOND') || raw.includes('COLLÈGE') || raw.includes('LYCÉE')) {
    return 'SECONDAIRE';
  }
  return 'MATERNEL_PRIMAIRE';
}

export interface LevelGroups<T> {
  maternelPrimaire: T[];
  secondaire: T[];
}

/** Sépare une liste en deux groupes de niveau (ordre conservé dans chacun). */
export function splitByLevel<T>(
  items: T[],
  getCategory: (item: T) => StaffLevelCategory = staffLevelCategory as (item: T) => StaffLevelCategory,
): LevelGroups<T> {
  const maternelPrimaire: T[] = [];
  const secondaire: T[] = [];
  for (const item of items) {
    if (getCategory(item) === 'SECONDAIRE') secondaire.push(item);
    else maternelPrimaire.push(item);
  }
  return { maternelPrimaire, secondaire };
}

/**
 * Bandeau de section « Maternelle & Primaire » / « Secondaire ».
 * Même palette que le corps enseignant (Pédagogie) : émeraude pour
 * maternel-primaire, bleu Academia pour le secondaire.
 */
export function LevelSectionHeader({
  category,
  count,
  className,
}: {
  category: StaffLevelCategory;
  count: number;
  className?: string;
}) {
  const isSecondary = category === 'SECONDAIRE';
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex-1 h-px bg-slate-200" />
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold',
          isSecondary
            ? 'bg-blue-50 text-[#1A2BA6] border-blue-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200',
        )}
      >
        {isSecondary ? <GraduationCap className="h-4 w-4" /> : <Baby className="h-4 w-4" />}
        {isSecondary ? 'Personnel du Secondaire' : 'Personnel Maternelle & Primaire'}
        <span className="text-[11px] font-semibold opacity-70">({count})</span>
      </div>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}
