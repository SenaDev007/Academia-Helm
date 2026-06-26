'use client';

/**
 * ============================================================================
 * TenantThemePage — Page de gestion du thème du site institutionnel
 * ============================================================================
 *
 * Page autonome (accessible depuis /platform/tenant-theme) qui permet au
 * directeur de l'école de :
 *   - Voir le thème actuellement appliqué (avec preview)
 *   - Ouvrir la galerie de 40 thèmes (ThemeGalleryDialog)
 *   - Changer de thème + mode (light/dark/auto)
 *
 * Cette page remplace l'ancien onglet "Couleurs du site" (ColorPalette)
 * qui demandait de saisir manuellement des codes hexadécimaux.
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Palette, Sun, Moon, Monitor, Check, Loader2, AlertCircle,
  Sparkles, ArrowRight, Eye, LayoutTemplate,
} from 'lucide-react';
import { tenantThemeService, type TenantThemeSettings } from '@/services/tenant-theme.service';
import {
  ALL_THEMES, DEFAULT_ACADEMIA_HELM_THEME, getThemeById,
  type Theme, type ThemeMode,
} from '@/lib/themes/themes.config';
import { ThemeScope } from '@/lib/themes/theme-applier';
import { ThemePreviewCard } from '@/components/cms/ThemePreviewCard';
import { ThemeGalleryDialog } from '@/components/cms/ThemeGalleryDialog';
import { BlockGalleryDialog } from '@/components/cms/blocks/BlockGalleryDialog';

const MODE_LABELS: Record<ThemeMode, { label: string; icon: any; description: string }> = {
  light: { label: 'Clair', icon: Sun, description: 'Thème clair (fond blanc)' },
  dark:  { label: 'Sombre', icon: Moon, description: 'Thème sombre (fond foncé)' },
  auto:  { label: 'Auto', icon: Monitor, description: 'Suit automatiquement le réglage de l\'ordinateur du visiteur' },
};

export default function TenantThemePage() {
  const [settings, setSettings] = useState<TenantThemeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [blockGalleryOpen, setBlockGalleryOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await tenantThemeService.getSettings();
      setSettings(s);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleModeChange = async (mode: ThemeMode) => {
    if (!settings || settings.mode === mode) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await tenantThemeService.setSettings({ mode });
      setSettings(updated);
      setSuccess('Mode mis à jour avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleThemeSelect = async (selection: { themeId: string; mode: ThemeMode }) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await tenantThemeService.setSettings(selection);
      setSettings(updated);
      setSuccess('Thème appliqué avec succès — votre site institutionnel a été mis à jour');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement…</span>
      </div>
    );
  }

  const currentTheme: Theme = getThemeById(settings?.themeId || '') || DEFAULT_ACADEMIA_HELM_THEME;
  const currentMode: ThemeMode = settings?.mode || 'auto';
  const isDefault = currentTheme.id === DEFAULT_ACADEMIA_HELM_THEME.id;
  // Pour la preview "Auto", on montre la variante light par défaut
  const previewMode: 'light' | 'dark' = currentMode === 'dark' ? 'dark' : 'light';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
            <Palette className="w-6 h-6" />
            Thème du site institutionnel
          </h1>
          <p className="text-slate-500 mt-1">
            Choisissez un thème parmi 40 designs professionnels. Votre site s&apos;adapte automatiquement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBlockGalleryOpen(true)}
            disabled={!settings?.themeId}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 rounded-xl text-sm font-semibold transition"
            title={settings?.themeId ? 'Personnaliser navbar, hero, footer, etc.' : 'Choisissez d\'abord un thème'}
          >
            <LayoutTemplate className="w-4 h-4" />
            Composants
          </button>
          <button
            onClick={() => setGalleryOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md transition"
          >
            <Palette className="w-4 h-4" />
            Choisir un thème
          </button>
        </div>
      </div>

      {/* Bannières erreur / succès */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            ×
          </button>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2">
          <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-sm text-emerald-700 flex-1">{success}</p>
          <button onClick={() => setSuccess(null)} className="text-emerald-500 hover:text-emerald-700">
            ×
          </button>
        </div>
      )}

      {/* Carte thème actuel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Thème actuel
                {isDefault && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">
                    Par défaut
                  </span>
                )}
                {saving && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {currentTheme.name} — {currentTheme.description}
              </p>
            </div>
            <button
              onClick={() => setGalleryOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 transition"
            >
              <Eye className="w-3.5 h-3.5" />
              Changer
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Preview du thème actuel */}
          <div className="p-5 bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Aperçu ({MODE_LABELS[currentMode].label})
            </p>
            <div className="aspect-[3/4] max-w-sm">
              <ThemeScope theme={currentTheme} mode={previewMode}>
                <ThemePreviewCard size="sm" />
              </ThemeScope>
            </div>
          </div>

          {/* Mode toggle + infos */}
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Mode d&apos;affichage
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(MODE_LABELS) as ThemeMode[]).map((m) => {
                  const { label, icon: Icon, description } = MODE_LABELS[m];
                  const isActive = currentMode === m;
                  return (
                    <button
                      key={m}
                      onClick={() => handleModeChange(m)}
                      disabled={saving}
                      title={description}
                      className={`p-3 rounded-xl border-2 transition flex flex-col items-center gap-1.5 ${
                        isActive
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      } disabled:opacity-50`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-semibold">{label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {MODE_LABELS[currentMode].description}
              </p>
            </div>

            {/* Palette preview */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Palette de couleurs
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Primaire',  key: 'primary' },
                  { label: 'Accent',     key: 'accent' },
                  { label: 'Fond',       key: 'background' },
                  { label: 'Texte',      key: 'foreground' },
                ].map(({ label, key }) => {
                  const variant = previewMode === 'dark' ? currentTheme.dark : currentTheme.light;
                  const color = (variant.colors as any)[key];
                  return (
                    <div key={key} className="text-center">
                      <div
                        className="w-full aspect-square rounded-lg border border-slate-200 shadow-sm mb-1"
                        style={{ background: `hsl(${color})` }}
                      />
                      <span className="text-[10px] text-slate-500 font-medium">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CTA vers galerie */}
            <button
              onClick={() => setGalleryOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition"
            >
              Parcourir les 40 thèmes
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Aperçu des 8 thèmes populaires (raccourci) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Thèmes populaires</h3>
            <p className="text-xs text-slate-500">Cliquez pour voir un aperçu plein écran</p>
          </div>
          <button
            onClick={() => setGalleryOpen(true)}
            className="text-xs font-semibold text-blue-700 hover:text-blue-800"
          >
            Voir les 40 thèmes →
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {ALL_THEMES.slice(0, 8).map((theme) => (
            <button
              key={theme.id}
              onClick={() => setGalleryOpen(true)}
              className="group text-left transition hover:scale-[1.03]"
              title={theme.name}
            >
              <div className="aspect-[3/4] rounded-lg overflow-hidden border-2 border-transparent group-hover:border-blue-500 shadow-sm">
                <ThemeScope theme={theme} mode="dark">
                  <ThemePreviewCard size="sm" />
                </ThemeScope>
              </div>
              <p className="text-[11px] font-semibold text-slate-700 mt-1.5 truncate">
                {theme.name}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Galerie dialog */}
      <ThemeGalleryDialog
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={handleThemeSelect}
        currentThemeId={settings?.themeId}
        currentMode={currentMode}
      />

      {/* Block gallery dialog (navbar, hero, footer, etc.) */}
      <BlockGalleryDialog
        open={blockGalleryOpen}
        onClose={() => setBlockGalleryOpen(false)}
        currentThemeId={settings?.themeId}
        currentMode={currentMode}
        onSelect={(selection) => {
          setSuccess(`Composant "${selection.variantId}" appliqué${selection.colorOverrides ? ' avec couleurs personnalisées' : ''}`);
          setTimeout(() => setSuccess(null), 5000);
          // TODO: persister la sélection en base (future itération)
        }}
      />
    </div>
  );
}
