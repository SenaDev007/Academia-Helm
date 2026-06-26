'use client';

/**
 * ============================================================================
 * ThemeGalleryDialog — Galerie de thèmes façon 21st.dev
 * ============================================================================
 *
 * Modal complet qui permet :
 *   - de parcourir les 40 thèmes (grille de vignettes)
 *   - de basculer entre Light / Dark / Auto en haut
 *   - de cliquer une vignette → preview plein écran
 *   - de confirmer → enregistre le thème + mode
 *
 * Workflow :
 *   1. Galerie (grille 40 vignettes avec ThemePreviewCard size='sm')
 *   2. Clic vignette → grand modal de preview avec ThemePreviewCard size='lg'
 *      + toggle Light/Dark/Auto en haut du modal
 *   3. Bouton "Appliquer ce thème" → appelle onSelect({themeId, mode})
 *
 * 100% non-technique : aucun nom de variable CSS visible.
 * ============================================================================
 */

import { useState, useMemo } from 'react';
import {
  X, Sun, Moon, Monitor, Search, Check, ArrowLeft, Sparkles,
} from 'lucide-react';
import { ALL_THEMES, THEMES, DEFAULT_ACADEMIA_HELM_THEME, type Theme, type ThemeMode } from '@/lib/themes/themes.config';
import { ThemeScope } from '@/lib/themes/theme-applier';
import { ThemePreviewCard } from './ThemePreviewCard';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: { themeId: string; mode: ThemeMode }) => void;
  currentThemeId?: string | null;
  currentMode?: ThemeMode;
  schoolName?: string;
}

const MODE_OPTIONS: { value: ThemeMode; label: string; icon: any }[] = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark',  label: 'Sombre', icon: Moon },
  { value: 'auto',  label: 'Auto', icon: Monitor },
];

export function ThemeGalleryDialog({
  open,
  onClose,
  onSelect,
  currentThemeId,
  currentMode = 'auto',
  schoolName = 'Mon École',
}: Props) {
  const [mode, setMode] = useState<ThemeMode>(currentMode);
  const [search, setSearch] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);

  // Liste filtrée par recherche
  const filteredThemes = useMemo(() => {
    if (!search.trim()) return ALL_THEMES;
    const q = search.toLowerCase();
    return ALL_THEMES.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [search]);

  if (!open) return null;

  // === Mode "preview plein écran" (un thème sélectionné) ===
  if (selectedTheme) {
    const isDefault = selectedTheme.id === DEFAULT_ACADEMIA_HELM_THEME.id;
    const isCurrent = selectedTheme.id === currentThemeId;

    return (
      <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header du modal de preview */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedTheme(null)}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition"
                title="Retour à la galerie"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  {selectedTheme.name}
                  {isDefault && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">
                      <Sparkles className="w-3 h-3" />
                      Défaut
                    </span>
                  )}
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">
                      <Check className="w-3 h-3" />
                      Actuel
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{selectedTheme.description}</p>
              </div>
            </div>

            {/* Mode toggle */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {MODE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isActive = mode === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setMode(opt.value)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                      isActive
                        ? 'bg-white shadow-sm text-slate-900'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Preview plein écran */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
            <div className="max-w-3xl mx-auto">
              <ThemeScope theme={selectedTheme} mode={mode}>
                <ThemePreviewCard size="lg" schoolName={schoolName} />
              </ThemeScope>

              {/* Palette de couleurs visible */}
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Principale',  key: 'primary' },
                  { label: 'Accent',       key: 'accent' },
                  { label: 'Arrière-plan', key: 'background' },
                  { label: 'Texte',        key: 'foreground' },
                ].map(({ label, key }) => {
                  const variant = mode === 'dark' ? selectedTheme.dark : selectedTheme.light;
                  const color = (variant.colors as any)[key];
                  return (
                    <div key={key} className="bg-white rounded-xl border border-slate-200 p-3">
                      <div
                        className="w-full h-10 rounded-lg mb-2 border border-slate-100"
                        style={{ background: `hsl(${color})` }}
                      />
                      <p className="text-xs font-semibold text-slate-700">{label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer — action */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Le site institutionnel adoptera ce thème et ce mode immédiatement après confirmation.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedTheme(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Retour
              </button>
              <button
                onClick={() => {
                  onSelect({ themeId: selectedTheme.id, mode });
                  setSelectedTheme(null);
                  onClose();
                }}
                disabled={isCurrent && mode === currentMode}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold shadow-md transition"
              >
                <Check className="w-4 h-4" />
                {isCurrent && mode === currentMode ? 'Thème actuel' : 'Appliquer ce thème'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === Mode "galerie" (grille de vignettes) ===
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Choisir un thème</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {filteredThemes.length} thème{filteredThemes.length > 1 ? 's' : ''} disponible{filteredThemes.length > 1 ? 's' : ''}
              {currentThemeId && (
                <> · Thème actuel : <span className="font-semibold">{ALL_THEMES.find(t => t.id === currentThemeId)?.name || 'Inconnu'}</span></>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Mode toggle (prévisualisation) */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {MODE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isActive = mode === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setMode(opt.value)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                      isActive ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title={`Prévisualiser en mode ${opt.label.toLowerCase()}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar — recherche */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un thème par nom ou description…"
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Grille des thèmes */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
          {filteredThemes.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-500">Aucun thème ne correspond à votre recherche.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredThemes.map((theme) => {
                const isCurrent = theme.id === currentThemeId;
                return (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedTheme(theme)}
                    className="group relative text-left transition-all hover:scale-[1.02]"
                  >
                    {/* Vignette preview */}
                    <div className="aspect-[3/4] rounded-xl overflow-hidden shadow-sm border-2 border-transparent group-hover:border-blue-500 group-hover:shadow-md transition-all">
                      <ThemeScope theme={theme} mode={mode}>
                        <ThemePreviewCard size="sm" schoolName={schoolName} />
                      </ThemeScope>
                    </div>

                    {/* Nom + statut */}
                    <div className="mt-2 px-1">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-semibold text-slate-900 truncate flex-1">
                          {theme.name}
                        </p>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-bold uppercase">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{theme.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Astuce : cliquez sur un thème pour voir un aperçu plein écran, puis confirmez pour l'appliquer.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
