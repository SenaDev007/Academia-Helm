'use client';

/**
 * ============================================================================
 * LAYOUT DU MODULE EXAMEN — Sélection niveau + piste linguistique (UNE FOIS)
 * ============================================================================
 *
 * Ce layout wrappe TOUTES les pages du module examen.
 * Il gère la sélection du niveau scolaire + piste linguistique UNE SEULE FOIS.
 *
 * Flux :
 *   1. User clique "Examens" dans la sidebar → layout affiche le sélecteur de niveau
 *   2. User sélectionne un niveau → si bilingue, layout affiche le sélecteur de piste
 *   3. User sélectionne la piste → layout affiche {children} (toutes les pages/onglets)
 *   4. User navigue entre les onglets → la sélection reste (URL params préservés)
 *
 * ⭐ ROBUSTESSE — Persistance sessionStorage + auto-restoration :
 *   - La sélection niveau + piste est persistée en sessionStorage à chaque changement
 *   - Si l'URL perd temporairement ses query params (race condition Next.js 16,
 *     navigation streaming, hydration), on restaure automatiquement depuis la session
 *   - L'utilisateur n'est JAMAIS ramené à la page de sélection involontairement :
 *     seul un clic explicite sur "Changer de niveau" déclenche la réinitialisation
 * ============================================================================
 */

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Baby, GraduationCap, School, Loader2, ChevronRight,
} from 'lucide-react';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { useBilingual } from '@/contexts/BilingualContext';
import { FlagIcon } from '@/components/ui/flag-icon';

// ─── ExamScopeContext ─────────────────────────────────────────────────────────

import { createContext, useContext } from 'react';

interface ExamScope {
  levelCode: string;
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

// ─── Helper : génère les hrefs des sous-onglets avec les params ──────────────

export function useExamSubModules(baseModules: any[]) {
  const searchParams = useSearchParams();
  // ⭐ Fallback sur sessionStorage : si l'URL perd temporairement ses query params
  // (race condition Next.js 16 / hydration / navigation streaming), on récupère
  // la sélection depuis la session pour générer des hrefs corrects.
  // Cela évite que l'utilisateur clique sur un href sans params et perde sa sélection.
  const urlLevel = searchParams.get('level') || '';
  const urlLang = searchParams.get('lang') || '';
  const sessionLevel = typeof window !== 'undefined' ? (sessionStorage.getItem('exams_selected_level') || '') : '';
  const sessionLang = typeof window !== 'undefined' ? (sessionStorage.getItem('exams_selected_lang') || '') : '';
  const level = urlLevel || sessionLevel;
  const lang = urlLang || sessionLang;

  return baseModules.map((m: any) => ({
    ...m,
    href: level
      ? `${m.href}?level=${level}${lang ? `&lang=${lang}` : ''}`
      : m.href,
  }));
}

// ─── Sélecteur de niveau scolaire ────────────────────────────────────────────

const LEVEL_ICONS: Record<string, any> = {
  MATERNELLE: Baby,
  PRIMAIRE: School,
  SECONDAIRE: GraduationCap,
};

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  MATERNELLE: 'Évaluation qualitative (TS / S / PS)',
  PRIMAIRE: 'Évaluation quantitative /20 — coefficient 1',
  SECONDAIRE: 'Évaluation quantitative /20 — coefficient variable',
};

const LEVEL_COLORS: Record<string, string> = {
  MATERNELLE: 'from-pink-500 to-rose-500',
  PRIMAIRE: 'from-blue-500 to-cyan-500',
  SECONDAIRE: 'from-violet-500 to-purple-500',
};

function LevelSelector({ onSelect }: { onSelect: (level: string) => void }) {
  const { availableLevels } = useSchoolLevel();
  const { isEnabled: isBilingual } = useBilingual();

  const activeLevels = (availableLevels || [])
    .filter((l: any) => l.id !== 'ALL' && l.isActive)
    .map((l: any) => ({ ...l, code: (l.code || '').toUpperCase() }));

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Module Examens</h1>
        <p className="text-sm text-gray-500">Sélectionnez le niveau scolaire pour accéder au module</p>
      </div>

      {activeLevels.length === 0 ? (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Chargement des niveaux scolaires...</p>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-4 max-w-3xl w-full">
          {activeLevels.map((level: any) => {
            const Icon = LEVEL_ICONS[level.code] || School;
            const gradient = LEVEL_COLORS[level.code] || 'from-gray-500 to-gray-600';
            return (
              <button
                key={level.id}
                onClick={() => onSelect(level.code)}
                className="group relative overflow-hidden rounded-2xl border-2 border-gray-200 hover:border-blue-400 bg-white p-6 text-left transition-all hover:shadow-lg w-full sm:w-72"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} mb-4`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{level.label}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {LEVEL_DESCRIPTIONS[level.code] || "Système d'évaluation"}
                </p>
                <div className="flex items-center gap-1 mt-3 text-blue-600 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  Sélectionner <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {isBilingual && (
        <p className="text-xs text-gray-400 mt-6 text-center">
          ℹ️ Le mode bilingue est activé — vous devrez également sélectionner la piste linguistique (FR/EN)
        </p>
      )}
    </div>
  );
}

// ─── Sélecteur de piste linguistique ─────────────────────────────────────────

function LanguageSelector({ onSelect, onBack }: { onSelect: (lang: string) => void; onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Piste linguistique</h1>
        <p className="text-sm text-gray-500">Sélectionnez votre piste linguistique</p>
      </div>

      <div className="flex flex-wrap justify-center gap-4 max-w-2xl w-full">
        <button
          onClick={() => onSelect('FR')}
          className="group rounded-2xl border-2 border-gray-200 hover:border-blue-500 bg-white p-8 text-center transition-all hover:shadow-lg w-full sm:w-72"
        >
          <div className="mb-3 flex justify-center"><FlagIcon code="FR" size="xl" /></div>
          <h3 className="text-lg font-bold text-gray-900">Francophone</h3>
          <p className="text-xs text-gray-500 mt-1">Matières enseignées en français</p>
        </button>

        <button
          onClick={() => onSelect('EN')}
          className="group rounded-2xl border-2 border-gray-200 hover:border-blue-500 bg-white p-8 text-center transition-all hover:shadow-lg w-full sm:w-72"
        >
          <div className="mb-3 flex justify-center"><FlagIcon code="GB" size="xl" /></div>
          <h3 className="text-lg font-bold text-gray-900">Anglophone</h3>
          <p className="text-xs text-gray-500 mt-1">Matières enseignées en anglais</p>
        </button>
      </div>

      <button onClick={onBack} className="mt-6 text-sm text-gray-500 hover:text-gray-700">
        ← Retour à la sélection du niveau
      </button>
    </div>
  );
}

// ─── Barre de scope (affichée en haut de toutes les pages) ───────────────────

function ScopeBar({ levelLabel, language, onChangeLevel, onChangeLanguage }: {
  levelLabel: string;
  language: string;
  onChangeLevel: () => void;
  onChangeLanguage: () => void;
}) {
  const { isEnabled: isBilingual } = useBilingual();
  const langCode = language === 'FR' ? 'FR' : language === 'EN' ? 'GB' : '';

  return (
    <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 mb-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-blue-900 uppercase">Niveau actif :</span>
        <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold">
          {levelLabel}
        </span>
      </div>
      {isBilingual && langCode && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-blue-900 uppercase">Piste :</span>
          <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5">
            <FlagIcon code={langCode} size="sm" className="border-white/30" />
            {language}
          </span>
        </div>
      )}
      <div className="flex-1" />
      <button onClick={onChangeLevel} className="text-xs text-blue-600 hover:text-blue-800 font-semibold">
        Changer de niveau
      </button>
      {isBilingual && (
        <button onClick={onChangeLanguage} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
          Changer de piste
        </button>
      )}
    </div>
  );
}

// ─── Layout inner (client component with useSearchParams) ────────────────────

// ⭐ Clés sessionStorage pour persister la sélection niveau + piste linguistique.
// Ceci évite que l'utilisateur soit ramené à la page de sélection si l'URL
// perd temporairement ses query params (race condition Next.js 16 / hydration /
// navigation streaming). On restaure automatiquement les params depuis la session.
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

function readSessionLang(): string {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(SESSION_KEY_LANG) || '';
  } catch {
    return '';
  }
}

function writeSessionSelection(level: string, lang: string) {
  if (typeof window === 'undefined') return;
  try {
    if (level) sessionStorage.setItem(SESSION_KEY_LEVEL, level);
    else sessionStorage.removeItem(SESSION_KEY_LEVEL);
    if (lang) sessionStorage.setItem(SESSION_KEY_LANG, lang);
    else sessionStorage.removeItem(SESSION_KEY_LANG);
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
  const { isEnabled: isBilingual } = useBilingual();

  const levelCode = searchParams.get('level') || '';
  const language = searchParams.get('lang') || (isBilingual ? '' : 'FR');

  // ⭐ Référence pour savoir si c'est le premier render (pour éviter les boucles)
  const hasRestoredRef = useRef(false);

  // ⭐ Référence pour tracker la dernière "intention" utilisateur :
  // - 'initial' : pas encore d'intention (premier chargement)
  // - 'selecting' : utilisateur en train de sélectionner niveau/piste
  // - 'in_module' : utilisateur a validé sa sélection et est dans le module
  const userIntentRef = useRef<'initial' | 'selecting' | 'in_module'>('initial');

  const [step, setStep] = useState<'level' | 'language' | 'content'>(
    levelCode ? (isBilingual && !language ? 'language' : 'content') : 'level'
  );

  // ─── Auto-restoration depuis sessionStorage ────────────────────────────────
  // Si l'URL n'a pas de ?level=... mais qu'on a une sélection en sessionStorage,
  // c'est qu'on a perdu les params (race condition Next.js). On restaure.
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    if (levelCode) {
      // L'URL a déjà les params → synchroniser sessionStorage
      writeSessionSelection(levelCode, language);
      userIntentRef.current = 'in_module';
      return;
    }

    // L'URL n'a pas les params → vérifier sessionStorage
    const savedLevel = readSessionLevel();
    const savedLang = readSessionLang();
    if (savedLevel) {
      // ⭐ Restaurer les params dans l'URL sans recharger la page
      const params = new URLSearchParams();
      params.set('level', savedLevel);
      if (savedLang) params.set('lang', savedLang);
      const queryString = params.toString();
      const targetUrl = `${pathname}?${queryString}`;
      // Remplacer l'URL sans polluer l'historique
      router.replace(targetUrl);
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
    // Persister la sélection en sessionStorage à chaque changement d'URL
    if (levelCode) {
      writeSessionSelection(levelCode, language);
    }

    if (levelCode) {
      if (!isBilingual) {
        setStep('content');
        userIntentRef.current = 'in_module';
      } else if (language) {
        setStep('content');
        userIntentRef.current = 'in_module';
      } else {
        // Bilingue + niveau sélectionné mais pas de piste → étape piste
        setStep('language');
        userIntentRef.current = 'selecting';
      }
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
  }, [levelCode, language, isBilingual]);

  const handleLevelSelect = (level: string) => {
    userIntentRef.current = 'selecting';
    writeSessionSelection(level, ''); // mémoriser le niveau (piste pas encore choisie)
    if (!isBilingual) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('level', level);
      params.set('lang', 'FR');
      router.push(`${pathname}?${params.toString()}`);
      setStep('content');
      userIntentRef.current = 'in_module';
    } else {
      // Stocker temporairement le niveau et passer à la sélection de la langue
      const params = new URLSearchParams(searchParams.toString());
      params.set('level', level);
      router.push(`${pathname}?${params.toString()}`);
      setStep('language');
    }
  };

  const handleLanguageSelect = (lang: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('lang', lang);
    writeSessionSelection(levelCode || readSessionLevel(), lang);
    // ⭐ Toujours rediriger vers /app/exams (dashboard) après la sélection
    router.push(`/app/exams?${params.toString()}`);
    setStep('content');
    userIntentRef.current = 'in_module';
  };

  const handleChangeLevel = () => {
    // ⭐ L'utilisateur a EXPLICITEMENT demandé à changer de niveau
    userIntentRef.current = 'selecting';
    clearSessionSelection();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('level');
    params.delete('lang');
    router.push(`/app/exams?${params.toString()}`);
    setStep('level');
  };

  const handleChangeLanguage = () => {
    userIntentRef.current = 'selecting';
    setStep('language');
  };

  // === Étape 1 : Sélection du niveau ===
  if (step === 'level') {
    return <LevelSelector onSelect={handleLevelSelect} />;
  }

  // === Étape 2 : Sélection de la piste linguistique ===
  if (step === 'language') {
    return <LanguageSelector onSelect={handleLanguageSelect} onBack={() => setStep('level')} />;
  }

  // === Étape 3 : Contenu du module avec scope bar ===
  const levelLabel = (availableLevels || []).find((l: any) =>
    (l.code || '').toUpperCase() === levelCode
  )?.label || levelCode;

  return (
    <ExamScopeContext.Provider value={{ levelCode, language, levelLabel }}>
      <ScopeBar
        levelLabel={levelLabel}
        language={language}
        onChangeLevel={handleChangeLevel}
        onChangeLanguage={handleChangeLanguage}
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
