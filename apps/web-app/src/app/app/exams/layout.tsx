'use client';

/**
 * ============================================================================
 * LAYOUT DU MODULE EXAMEN — Sélection du niveau scolaire (UNE SEULE FOIS)
 * ============================================================================
 *
 * ⭐ V10 — NOUVEAU STANDARD BILINGUE (miroirs anglophones) :
 *   Le mode bilingue ne demande PLUS de sélectionner une piste linguistique.
 *   Chaque niveau francophone possède désormais son miroir anglophone créé
 *   dans Paramètres > Bilingue (structure EN) :
 *     Maternelle (FR)  ↔  Nursery (EN)
 *     Primaire  (FR)   ↔  Primary  (EN)
 *
 *   La piste linguistique est donc DÉDUITE du niveau sélectionné :
 *     - NURSERY / PRIMARY           → piste EN (interface anglophone)
 *     - MATERNELLE / PRIMAIRE / …   → piste FR (interface francophone)
 *
 * Flux :
 *   1. User clique "Examens" dans la sidebar → layout affiche le sélecteur de niveau
 *      (les niveaux FR et leurs miroirs EN sont listés, chacun badgé francophone/anglophone)
 *   2. User sélectionne un niveau → la langue est déduite automatiquement
 *      → layout affiche {children} (toutes les pages/onglets) dans la langue du niveau
 *   3. User navigue entre les onglets → la sélection reste (URL params préservés)
 *
 * ⭐ ROBUSTESSE — Persistance sessionStorage + auto-restoration :
 *   - La sélection du niveau est persistée en sessionStorage à chaque changement
 *   - Si l'URL perd temporairement ses query params (race condition Next.js 16,
 *     navigation streaming, hydration), on restaure automatiquement depuis la session
 *   - L'utilisateur n'est JAMAIS ramené à la page de sélection involontairement :
 *     seul un clic explicite sur "Changer de niveau" déclenche la réinitialisation
 *
 * ⭐ COMPATIBILITÉ ASCENDANTE :
 *   - Les anciennes URLs ?level=PRIMAIRE (sans lang) sont automatiquement complétées
 *     avec la langue dérivée (lang=FR)
 *   - Les URLs ?level=NURSERY&lang=FR (incohérentes) sont corrigées (lang=EN)
 *   - Le paramètre ?lang= reste présent dans l'URL : toutes les pages du module
 *     (évaluations, bulletins, paramètres…) le lisent déjà via useExamScope()
 * ============================================================================
 */

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Baby, GraduationCap, School, Loader2, ChevronRight,
} from 'lucide-react';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { FlagIcon } from '@/components/ui/flag-icon';

// ─── ExamScopeContext ─────────────────────────────────────────────────────────

import { createContext, useContext } from 'react';

interface ExamScope {
  levelCode: string;
  /** Piste linguistique DÉDUITE du niveau (NURSERY/PRIMARY → EN, sinon FR) */
  language: string;
  levelLabel: string;
}

const ExamScopeContext = createContext<ExamScope>({
  levelCode: '',
  language: 'FR',
  levelLabel: '',
});

export function useExamScope() {
  return useContext(ExamScopeContext);
}

// ─── Helper : déduire la piste linguistique du niveau scolaire ────────────────
//   Le niveau est le miroir : NURSERY/PRIMARY = système anglophone,
//   tous les autres niveaux (MATERNELLE, PRIMAIRE, SECONDAIRE…) = francophone.

export const ENGLISH_LEVEL_CODES = ['NURSERY', 'PRIMARY'];

export function languageForLevel(levelCode: string | null | undefined): 'FR' | 'EN' {
  if (!levelCode) return 'FR';
  return ENGLISH_LEVEL_CODES.includes(levelCode.toUpperCase()) ? 'EN' : 'FR';
}

// ─── Helper : génère les hrefs des sous-onglets avec les params ──────────────

/** Libellés EN des sous-onglets du module examen (miroir de sub-modules.ts). */
const SUB_MODULE_LABELS_EN: Record<string, string> = {
  dashboard: 'Dashboard',
  evaluations: 'Assessments',
  grades: 'Grading',
  validation: 'Validation',
  'unlock-requests': 'Unlock Requests',
  registre: 'Grades Register',
  bulletins: 'Report Cards',
  councils: 'Class Councils',
  analytics: 'Statistics',
  audit: 'Audit',
  settings: 'Settings',
};

export function useExamSubModules(baseModules: any[]) {
  const searchParams = useSearchParams();
  // ⭐ Fallback sur sessionStorage : si l'URL perd temporairement ses query params
  // (race condition Next.js 16 / hydration / navigation streaming), on récupère
  // la sélection depuis la session pour générer des hrefs corrects.
  // Cela évite que l'utilisateur clique sur un href sans params et perde sa sélection.
  const urlLevel = searchParams.get('level') || '';
  const sessionLevel = typeof window !== 'undefined' ? (sessionStorage.getItem('exams_selected_level') || '') : '';
  const level = urlLevel || sessionLevel;
  // ⭐ La langue est DÉDUITE du niveau — plus jamais sélectionnée manuellement.
  const lang = languageForLevel(level);
  const isEN = lang === 'EN';

  return baseModules.map((m: any) => ({
    ...m,
    // ⭐ V10 — libellés des onglets dans la langue du niveau :
    // Nursery/Primary → anglais, sinon français.
    label: (isEN && m.id && SUB_MODULE_LABELS_EN[m.id]) || m.label,
    href: level
      ? `${m.href}?level=${level}&lang=${lang}`
      : m.href,
  }));
}

// ─── Sélecteur de niveau scolaire (niveaux FR + miroirs EN) ──────────────────

const LEVEL_ICONS: Record<string, any> = {
  MATERNELLE: Baby,
  PRIMAIRE: School,
  SECONDAIRE: GraduationCap,
  NURSERY: Baby,
  PRIMARY: School,
};

// Libellés + descriptions dans la langue DU NIVEAU :
// les niveaux FR se décrivent en français, les miroirs EN en anglais.
// ⭐ V10b — Nursery est QUANTITATIF exactement comme Primary
//    (First CA /40 + Second CA /40 + Exam /60 = /100) ;
//    seule la Maternelle FR reste qualitative (TS / S / PS).
const LEVEL_DESCRIPTIONS: Record<string, string> = {
  MATERNELLE: 'Évaluation qualitative (TS / S / PS)',
  PRIMAIRE: 'Évaluation quantitative /20 — coefficient 1',
  SECONDAIRE: 'Évaluation quantitative /20 — coefficient variable',
  NURSERY: 'Quantitative assessment /100 — First CA, Second CA, Examination',
  PRIMARY: 'Quantitative assessment /100 — First CA, Second CA, Examination',
};

const LEVEL_COLORS: Record<string, string> = {
  MATERNELLE: 'from-pink-500 to-rose-500',
  NURSERY: 'from-pink-400 to-rose-400',
  PRIMAIRE: 'from-blue-500 to-cyan-500',
  PRIMARY: 'from-blue-400 to-cyan-400',
  SECONDAIRE: 'from-violet-500 to-purple-500',
};

/** Ordre pédagogique d'affichage : miroirs EN juste après leur niveau FR. */
const LEVEL_DISPLAY_ORDER = ['MATERNELLE', 'NURSERY', 'PRIMAIRE', 'PRIMARY', 'SECONDAIRE'];

function levelSortIndex(code: string): number {
  const idx = LEVEL_DISPLAY_ORDER.indexOf(code);
  return idx === -1 ? LEVEL_DISPLAY_ORDER.length : idx;
}

function LevelSelector({ onSelect }: { onSelect: (level: string) => void }) {
  const { availableLevels } = useSchoolLevel();

  const activeLevels = (availableLevels || [])
    .filter((l: any) => l.id !== 'ALL' && l.isActive)
    .map((l: any) => ({ ...l, code: (l.code || '').toUpperCase() }))
    .sort((a: any, b: any) =>
      levelSortIndex(a.code) - levelSortIndex(b.code) || (a.label || '').localeCompare(b.label || '', 'fr')
    );

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Module Examens</h1>
        <p className="text-sm text-gray-500">Sélectionnez le niveau scolaire pour accéder au module</p>
        <p className="text-xs text-gray-400 mt-1">
          Chaque niveau s&apos;ouvre directement dans son système linguistique — francophone (FR) ou anglophone (EN)
        </p>
      </div>

      {activeLevels.length === 0 ? (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Chargement des niveaux scolaires...</p>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-4 max-w-4xl w-full">
          {activeLevels.map((level: any) => {
            const Icon = LEVEL_ICONS[level.code] || School;
            const gradient = LEVEL_COLORS[level.code] || 'from-gray-500 to-gray-600';
            const lang = languageForLevel(level.code);
            const isEN = lang === 'EN';
            return (
              <button
                key={level.id}
                onClick={() => onSelect(level.code)}
                className="group relative overflow-hidden rounded-2xl border-2 border-gray-200 hover:border-blue-400 bg-white p-6 text-left transition-all hover:shadow-lg w-full sm:w-72"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />
                <div className="flex items-start justify-between mb-4">
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient}`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  {/* Badge du système linguistique — FR ou EN selon le niveau */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      isEN
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    <FlagIcon code={isEN ? 'GB' : 'FR'} size="sm" />
                    {isEN ? 'Anglophone' : 'Francophone'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{level.label}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {LEVEL_DESCRIPTIONS[level.code] || (isEN ? 'Assessment system' : "Système d'évaluation")}
                </p>
                <div className="flex items-center gap-1 mt-3 text-blue-600 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  {isEN ? 'Select' : 'Sélectionner'} <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Barre de scope (affichée en haut de toutes les pages) ───────────────────
//   La langue affichée est celle DÉDUITE du niveau actif. Les libellés de la
//   barre suivent la langue du niveau : français pour un niveau francophone,
//   anglais pour un niveau anglophone (Nursery / Primary).

function ScopeBar({ levelLabel, language, onChangeLevel }: {
  levelLabel: string;
  language: string;
  onChangeLevel: () => void;
}) {
  const isEN = language === 'EN';
  const langCode = isEN ? 'GB' : 'FR';

  return (
    <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 mb-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-blue-900 uppercase">
          {isEN ? 'Active level:' : 'Niveau actif :'}
        </span>
        <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold">
          {levelLabel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-blue-900 uppercase">
          {isEN ? 'System:' : 'Système :'}
        </span>
        <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5">
          <FlagIcon code={langCode} size="sm" className="border-white/30" />
          {isEN ? 'Anglophone' : 'Francophone'}
        </span>
      </div>
      <div className="flex-1" />
      <button onClick={onChangeLevel} className="text-xs text-blue-600 hover:text-blue-800 font-semibold">
        {isEN ? 'Change level' : 'Changer de niveau'}
      </button>
    </div>
  );
}

// ─── Layout inner (client component with useSearchParams) ────────────────────

// ⭐ Clés sessionStorage pour persister la sélection du niveau.
// Ceci évite que l'utilisateur soit ramené à la page de sélection si l'URL
// perd temporairement ses query params (race condition Next.js 16 / hydration /
// navigation streaming). On restaure automatiquement les params depuis la session.
// (La clé 'exams_selected_lang' reste lue pour nettoyer les anciennes sessions V9.)
const SESSION_KEY_LEVEL = 'exams_selected_level';
const SESSION_KEY_LANG = 'exams_selected_lang';

function readSessionLevel(): string {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(SESSION_KEY_LEVEL) || '';
  } catch {
    return '';
  }
}

function writeSessionLevel(level: string) {
  if (typeof window === 'undefined') return;
  try {
    if (level) sessionStorage.setItem(SESSION_KEY_LEVEL, level);
    else sessionStorage.removeItem(SESSION_KEY_LEVEL);
    // ⭐ V10 : la langue est dérivée, plus jamais stockée indépendamment.
    sessionStorage.removeItem(SESSION_KEY_LANG);
  } catch {
    /* ignore quota errors */
  }
}

function clearSessionSelection() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_KEY_LEVEL);
    sessionStorage.removeItem(SESSION_KEY_LANG);
  } catch {
    /* ignore */
  }
}

function ExamLayoutInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { availableLevels } = useSchoolLevel();

  const levelCode = searchParams.get('level') || '';
  // ⭐ La langue est DÉDUITE du niveau — l'utilisateur ne la choisit plus.
  //    Si l'URL contient encore un ?lang= incohérent avec le niveau (ancien
  //    standard), la valeur dérivée du niveau gagne (correction automatique).
  const derivedLang = languageForLevel(levelCode);

  // ⭐ Référence pour savoir si c'est le premier render (pour éviter les boucles)
  const hasRestoredRef = useRef(false);

  // ⭐ Référence pour tracker la dernière "intention" utilisateur :
  // - 'initial' : pas encore d'intention (premier chargement)
  // - 'selecting' : utilisateur en train de sélectionner le niveau
  // - 'in_module' : utilisateur a validé sa sélection et est dans le module
  const userIntentRef = useRef<'initial' | 'selecting' | 'in_module'>('initial');

  const [step, setStep] = useState<'level' | 'content'>(levelCode ? 'content' : 'level');

  // ─── Auto-restoration depuis sessionStorage ────────────────────────────────
  // Si l'URL n'a pas de ?level=... mais qu'on a une sélection en sessionStorage,
  // c'est qu'on a perdu les params (race condition Next.js). On restaure.
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    if (levelCode) {
      // L'URL a déjà les params → synchroniser sessionStorage
      writeSessionLevel(levelCode);
      userIntentRef.current = 'in_module';
      return;
    }

    // L'URL n'a pas les params → vérifier sessionStorage
    const savedLevel = readSessionLevel();
    if (savedLevel) {
      // ⭐ Restaurer les params dans l'URL sans recharger la page
      const params = new URLSearchParams();
      params.set('level', savedLevel);
      params.set('lang', languageForLevel(savedLevel));
      // Remplacer l'URL sans polluer l'historique
      router.replace(`${pathname}?${params.toString()}`);
      // Ne pas setStep ici — le useEffect suivant le fera quand levelCode sera mis à jour
      userIntentRef.current = 'in_module';
    } else {
      // Pas de sélection sauvegardée → l'utilisateur doit vraiment choisir
      userIntentRef.current = 'selecting';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mettre à jour l'état quand l'URL change.
  // ⭐ IMPORTANT : On ne reset JAMAIS step à 'level' si l'utilisateur était
  // déjà dans le module (userIntentRef === 'in_module'). Cela évite les
  // retours involontaires à la page de sélection pendant les navigations.
  useEffect(() => {
    // Persister le niveau en sessionStorage à chaque changement d'URL
    if (levelCode) {
      writeSessionLevel(levelCode);
      setStep('content');
      userIntentRef.current = 'in_module';
    } else {
      // L'URL n'a pas ?level=...
      if (userIntentRef.current === 'in_module') {
        // ⭐ L'utilisateur ÉTAIT dans le module — ne pas le ramener à la sélection.
        // C'est probablement une race condition Next.js (perte temporaire des params).
        // On garde step='content' et on attend que l'auto-restoration recharge les params.
        // Ne rien faire (garder l'ancien step).
      } else {
        // L'utilisateur n'a pas encore sélectionné de niveau → afficher la sélection
        setStep('level');
      }
    }
  }, [levelCode]);

  // ─── Normalisation du paramètre ?lang= ─────────────────────────────────────
  // ⭐ V10 : la langue doit TOUJOURS être cohérente avec le niveau sélectionné.
  //    Les URLs héritées de l'ancien standard peuvent contenir un ?lang=
  //    incohérent (ex: ?level=NURSERY&lang=FR) ou absent (?level=PRIMAIRE).
  //    On corrige silencieusement (router.replace, sans polluer l'historique)
  //    pour que TOUTES les pages du module (settings lit ?lang= directement)
  //    voient la même piste linguistique dérivée que le contexte.
  useEffect(() => {
    if (!levelCode) return;
    const urlLang = searchParams.get('lang') || '';
    if (urlLang !== derivedLang) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('level', levelCode);
      params.set('lang', derivedLang);
      router.replace(`${pathname}?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelCode, derivedLang, pathname]);

  const handleLevelSelect = (level: string) => {
    userIntentRef.current = 'in_module';
    // ⭐ La langue est déduite du niveau (NURSERY/PRIMARY → EN, sinon FR)
    const lang = languageForLevel(level);
    writeSessionLevel(level);
    const params = new URLSearchParams();
    params.set('level', level);
    params.set('lang', lang);
    // ⭐ Toujours rediriger vers /app/exams (dashboard) après la sélection
    router.push(`/app/exams?${params.toString()}`);
    setStep('content');
  };

  const handleChangeLevel = () => {
    // ⭐ L'utilisateur a EXPLICITEMENT demandé à changer de niveau
    userIntentRef.current = 'selecting';
    clearSessionSelection();
    router.push('/app/exams');
    setStep('level');
  };

  // === Étape 1 : Sélection du niveau (langue déduite) ===
  if (step === 'level') {
    return <LevelSelector onSelect={handleLevelSelect} />;
  }

  // === Contenu du module avec scope bar (langue dérivée du niveau) ===
  const levelLabel = (availableLevels || []).find((l: any) =>
    (l.code || '').toUpperCase() === levelCode
  )?.label || levelCode;

  return (
    <ExamScopeContext.Provider value={{ levelCode, language: derivedLang, levelLabel }}>
      <ScopeBar
        levelLabel={levelLabel}
        language={derivedLang}
        onChangeLevel={handleChangeLevel}
      />
      {children}
    </ExamScopeContext.Provider>
  );
}

// ─── Layout export (avec Suspense pour useSearchParams) ──────────────────────

export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>}>
      <ExamLayoutInner>{children}</ExamLayoutInner>
    </Suspense>
  );
}
