'use client';

/**
 * ============================================================================
 * BlockGalleryDialog — Galerie de variantes de composants CMS
 * ============================================================================
 *
 * Workflow :
 *   1. L'utilisateur choisit D'ABORD un thème sur /platform/tenant-theme
 *   2. Puis ouvre cette galerie — toutes les variantes sont prévisualisées
 *      avec la palette du thème choisi (via ThemeScope)
 *   3. S'il n'a pas encore choisi de thème, un message lui demande d'en
 *      choisir un d'abord
 *   4. Il peut override les couleurs (primary, accent, background, foreground)
 *      par-dessus le thème — le système applique ses couleurs custom
 *
 * Props :
 *   - open: boolean
 *   - onClose: () => void
 *   - currentThemeId: string | null    → thème choisi (REQUIRED pour preview)
 *   - currentMode: ThemeMode
 *   - onSelect: (selection: { variantId: string, colorOverrides?: ColorOverride }) => void
 * ============================================================================
 */

import { useState, useMemo } from 'react';
import {
  X, Sun, Moon, Monitor, Search, Check, AlertCircle,
  Palette, Sliders, ArrowLeft,
} from 'lucide-react';
import {
  BLOCK_VARIANTS, BLOCK_CATEGORIES, getVariantsByCategory,
  type BlockCategory, type ColorOverride,
} from '@/lib/themes/blocks.config';
import { getThemeById, DEFAULT_ACADEMIA_HELM_THEME, type Theme, type ThemeMode } from '@/lib/themes/themes.config';
import { ThemeScope } from '@/lib/themes/theme-applier';
import { BlockRenderer } from './BlockRenderer';

interface Props {
  open: boolean;
  onClose: () => void;
  currentThemeId?: string | null;
  currentMode?: ThemeMode;
  onSelect: (selection: { variantId: string; colorOverrides?: ColorOverride }) => void;
  initialCategory?: BlockCategory;
}

const MODE_OPTIONS: { value: ThemeMode; label: string; icon: any }[] = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark',  label: 'Sombre', icon: Moon },
  { value: 'auto',  label: 'Auto', icon: Monitor },
];

export function BlockGalleryDialog({
  open,
  onClose,
  currentThemeId,
  currentMode = 'auto',
  onSelect,
  initialCategory = 'navbar',
}: Props) {
  const [activeCategory, setActiveCategory] = useState<BlockCategory>(initialCategory);
  const [mode, setMode] = useState<ThemeMode>(currentMode);
  const [search, setSearch] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [showColorOverrides, setShowColorOverrides] = useState(false);
  const [overrides, setOverrides] = useState<ColorOverride>({});

  const theme: Theme = getThemeById(currentThemeId || '') || DEFAULT_ACADEMIA_HELM_THEME;
  const hasTheme = !!currentThemeId;

  const filteredVariants = useMemo(() => {
    const all = getVariantsByCategory(activeCategory);
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((v) => v.name.toLowerCase().includes(q) || v.description.toLowerCase().includes(q));
  }, [activeCategory, search]);

  if (!open) return null;

  const handleConfirm = () => {
    if (!selectedVariantId) return;
    onSelect({
      variantId: selectedVariantId,
      colorOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    });
    setSelectedVariantId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Personnaliser un composant</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Thème actuel : <span className="font-semibold">{theme.name}</span>
              {!hasTheme && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-700">
                  <AlertCircle className="w-3 h-3" />
                  Veuillez d'abord choisir un thème
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Mode toggle */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {MODE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isActive = mode === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setMode(opt.value)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                      isActive ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowColorOverrides(!showColorOverrides)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                showColorOverrides ? 'bg-blue-100 text-blue-700' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="Personnaliser les couleurs par-dessus le thème"
            >
              <Sliders className="w-3.5 h-3.5" />
              Couleurs custom
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Panel color overrides (collapsible) */}
        {showColorOverrides && (
          <div className="p-4 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-blue-700" />
              <p className="text-xs font-semibold text-slate-700">
                Ajustez les couleurs — ces valeurs remplacent celles du thème sélectionné
              </p>
              <button
                onClick={() => setOverrides({})}
                className="ml-auto text-xs text-slate-500 hover:text-slate-700"
              >
                Réinitialiser
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'primary',    label: 'Couleur principale' },
                { key: 'accent',     label: 'Couleur accent' },
                { key: 'background', label: 'Arrière-plan' },
                { key: 'foreground', label: 'Texte' },
              ].map(({ key, label }) => (
                <div key={key} className="bg-white rounded-lg border border-slate-200 p-2">
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">{label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={hslToHex(overrides[key as keyof ColorOverride] || getThemeColor(theme, mode, key))}
                      onChange={(e) => {
                        const hsl = hexToHsl(e.target.value);
                        setOverrides({ ...overrides, [key]: hsl });
                      }}
                      className="w-8 h-8 rounded cursor-pointer border border-slate-200"
                    />
                    <span className="text-[10px] text-slate-500 font-mono">
                      {overrides[key as keyof ColorOverride] ? 'Custom' : 'Thème'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Body — categories sidebar + variants grid */}
        <div className="flex-1 flex min-h-0">
          {/* Categories sidebar */}
          <aside className="w-52 border-r border-slate-100 bg-slate-50/50 p-3 overflow-y-auto shrink-0">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 px-2">Catégories</p>
            {BLOCK_CATEGORIES.map((cat) => {
              const count = getVariantsByCategory(cat.id).length;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setSelectedVariantId(null); }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition mb-1 ${
                    isActive ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{cat.label}</div>
                    <div className={`text-[10px] truncate ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                      {cat.description}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </aside>

          {/* Variants grid */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Search */}
            <div className="p-3 border-b border-slate-100">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher une variante…"
                  className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              {filteredVariants.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm text-slate-500">Aucune variante ne correspond.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredVariants.map((variant) => {
                    const isSelected = selectedVariantId === variant.id;
                    return (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariantId(variant.id)}
                        className={`group text-left rounded-xl overflow-hidden border-2 transition ${
                          isSelected ? 'border-blue-500 shadow-lg' : 'border-transparent hover:border-slate-300 shadow-sm'
                        }`}
                      >
                        {/* Preview */}
                        <div className="bg-white">
                          <ThemeScope theme={theme} mode={mode === 'auto' ? 'light' : mode}>
                            <BlockRenderer
                              variant={variant}
                              colorOverrides={Object.keys(overrides).length > 0 ? overrides : undefined}
                              size="sm"
                            />
                          </ThemeScope>
                        </div>
                        {/* Footer */}
                        <div className="p-2 bg-white border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            <p className="text-xs font-semibold text-slate-900 truncate flex-1">{variant.name}</p>
                            {isSelected && (
                              <span className="inline-flex items-center justify-center w-4 h-4 bg-blue-500 rounded-full">
                                <Check className="w-2.5 h-2.5 text-white" />
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">{variant.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {selectedVariantId
              ? <>Variante sélectionnée : <span className="font-semibold">{BLOCK_VARIANTS.find(v => v.id === selectedVariantId)?.name}</span></>
              : 'Cliquez sur une variante pour la sélectionner.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedVariantId || !hasTheme}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold shadow-md transition"
            >
              <Check className="w-4 h-4" />
              Appliquer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Helpers (color conversion) ===

function hslToHex(hsl: string): string {
  if (!hsl) return '#000000';
  const parts = hsl.trim().split(/\s+/);
  if (parts.length < 3) return '#000000';
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return '0 0% 0%';
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function getThemeColor(theme: Theme, mode: ThemeMode, key: string): string {
  const variant = mode === 'dark' ? theme.dark : theme.light;
  const colors = variant.colors as any;
  // Map our 4 override keys to theme color keys
  const mapping: Record<string, string> = {
    primary: 'primary',
    accent: 'accent',
    background: 'background',
    foreground: 'foreground',
  };
  return colors[mapping[key] || key] || '0 0% 0%';
}
