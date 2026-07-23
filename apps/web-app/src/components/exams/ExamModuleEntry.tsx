"use client";

/**
 * ============================================================================
 * EXAM MODULE ENTRY — Sélection niveau scolaire + piste linguistique
 * ============================================================================
 *
 * Quand l'utilisateur ouvre /app/exams, ce composant s'affiche EN PREMIER.
 * Il demande :
 *   1. Le niveau scolaire (Maternelle / Primaire / Secondaire)
 *      — seuls les niveaux activés par l'école sont proposés
 *   2. La piste linguistique (FR / EN) — UNIQUEMENT si bilingue activé
 *      — si non bilingue → FR par défaut, étape skipée
 *
 * Une fois sélectionné, l'utilisateur accède aux sous-onglets du module
 * (dashboard, évaluations, saisie, etc.) avec le scope figé dans l'URL.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Baby, GraduationCap, School, Loader2, ChevronRight,
  Globe, CheckCircle2,
} from 'lucide-react';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { useBilingual } from '@/contexts/BilingualContext';
import { Card } from '@/components/ui/card';
import { FlagIcon } from '@/components/ui/flag-icon';

const LEVEL_ICONS: Record<string, any> = {
  MATERNELLE: Baby,
  PRIMAIRE: School,
  SECONDAIRE: GraduationCap,
};

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  MATERNELLE: 'Évaluation qualitative (TS / S / PS)',
  PRIMAIRE: 'Évaluation quantitative /20 — CM (18) + CP (2), coefficient 1',
  SECONDAIRE: 'Évaluation quantitative /20 — coefficient variable',
};

const LEVEL_COLORS: Record<string, string> = {
  MATERNELLE: 'from-pink-500 to-rose-500',
  PRIMAIRE: 'from-blue-500 to-cyan-500',
  SECONDAIRE: 'from-violet-500 to-purple-500',
};

export function ExamModuleEntry({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { availableLevels } = useSchoolLevel();
  const { isEnabled: isBilingual } = useBilingual();

  // Lire le niveau + langue depuis l'URL
  const urlLevel = searchParams.get('level') || '';
  const urlLang = searchParams.get('lang') || '';

  const [selectedLevel, setSelectedLevel] = useState<string>(urlLevel);
  const [selectedLang, setSelectedLang] = useState<string>(urlLang || (isBilingual ? '' : 'FR'));
  const [step, setStep] = useState<'level' | 'language' | 'content'>(
    urlLevel ? (isBilingual && !urlLang ? 'language' : 'content') : 'level'
  );

  // Niveaux actifs (récupérés depuis le backend — PAS codés en dur)
  const activeLevels = (availableLevels || [])
    .filter((l: any) => l.id !== 'ALL' && l.isActive)
    .map((l: any) => ({
      ...l,
      code: (l.code || '').toUpperCase(),
    }));

  // Mettre à jour l'état quand l'URL change
  useEffect(() => {
    if (urlLevel) {
      setSelectedLevel(urlLevel);
      if (!isBilingual) {
        setSelectedLang('FR');
        setStep('content');
      } else if (urlLang) {
        setSelectedLang(urlLang);
        setStep('content');
      } else {
        setStep('language');
      }
    } else {
      setStep('level');
    }
  }, [urlLevel, urlLang, isBilingual]);

  const handleLevelSelect = (levelCode: string) => {
    setSelectedLevel(levelCode);
    if (!isBilingual) {
      // Pas bilingue → FR par défaut, aller directement au contenu
      const params = new URLSearchParams(searchParams.toString());
      params.set('level', levelCode);
      params.set('lang', 'FR');
      router.push(`/app/exams?${params.toString()}`);
      setStep('content');
    } else {
      // Bilingue → demander la piste linguistique
      setStep('language');
    }
  };

  const handleLanguageSelect = (lang: string) => {
    setSelectedLang(lang);
    const params = new URLSearchParams(searchParams.toString());
    params.set('level', selectedLevel);
    params.set('lang', lang);
    router.push(`/app/exams?${params.toString()}`);
    setStep('content');
  };

  const handleChangeLevel = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('level');
    params.delete('lang');
    router.push(`/app/exams?${params.toString()}`);
    setSelectedLevel('');
    setSelectedLang('');
    setStep('level');
  };

  const handleChangeLanguage = () => {
    setStep('language');
  };

  // === Étape 1 : Sélection du niveau scolaire ===
  if (step === 'level') {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Module Examens
          </h1>
          <p className="text-sm text-gray-500">
            Sélectionnez le niveau scolaire pour accéder au module
          </p>
        </div>

        {activeLevels.length === 0 ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Chargement des niveaux scolaires...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full">
            {activeLevels.map((level: any) => {
              const Icon = LEVEL_ICONS[level.code] || School;
              const gradient = LEVEL_COLORS[level.code] || 'from-gray-500 to-gray-600';
              return (
                <button
                  key={level.id}
                  onClick={() => handleLevelSelect(level.code)}
                  className="group relative overflow-hidden rounded-2xl border-2 border-gray-200 hover:border-blue-400 bg-white p-6 text-left transition-all hover:shadow-lg"
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} mb-4`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{level.label}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {LEVEL_DESCRIPTIONS[level.code] || 'Système d\'évaluation'}
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

  // === Étape 2 : Sélection de la piste linguistique ===
  if (step === 'language') {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Piste linguistique
          </h1>
          <p className="text-sm text-gray-500">
            Niveau : <strong>{selectedLevel}</strong> — Sélectionnez votre piste linguistique
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-xl w-full">
          <button
            onClick={() => handleLanguageSelect('FR')}
            className="group rounded-2xl border-2 border-gray-200 hover:border-blue-500 bg-white p-8 text-center transition-all hover:shadow-lg"
          >
            <div className="mb-3 flex justify-center"><FlagIcon code="FR" size="xl" /></div>
            <h3 className="text-lg font-bold text-gray-900">Francophone</h3>
            <p className="text-xs text-gray-500 mt-1">Matières enseignées en français</p>
          </button>

          <button
            onClick={() => handleLanguageSelect('EN')}
            className="group rounded-2xl border-2 border-gray-200 hover:border-blue-500 bg-white p-8 text-center transition-all hover:shadow-lg"
          >
            <div className="mb-3 flex justify-center"><FlagIcon code="GB" size="xl" /></div>
            <h3 className="text-lg font-bold text-gray-900">Anglophone</h3>
            <p className="text-xs text-gray-500 mt-1">Matières enseignées en anglais</p>
          </button>
        </div>

        <button
          onClick={() => setStep('level')}
          className="mt-6 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Retour à la sélection du niveau
        </button>
      </div>
    );
  }

  // === Étape 3 : Contenu du module (avec scope niveau + langue) ===
  const levelLabel = activeLevels.find((l: any) => l.code === selectedLevel)?.label || selectedLevel;
  const langCode = selectedLang === 'FR' ? 'FR' : selectedLang === 'EN' ? 'GB' : '';

  return (
    <div>
      {/* Barre de scope — affiche le niveau + langue sélectionnés */}
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
              {selectedLang}
            </span>
          </div>
        )}
        <div className="flex-1" />
        <button
          onClick={handleChangeLevel}
          className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
        >
          Changer de niveau
        </button>
        {isBilingual && (
          <button
            onClick={handleChangeLanguage}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            Changer de piste
          </button>
        )}
      </div>

      {/* Contenu du module (dashboard, évaluations, etc.) */}
      {children}
    </div>
  );
}
