'use client';

/**
 * ============================================================================
 * CMS WORKSPACE — Site institutionnel (refonte façon Webflow)
 * ============================================================================
 *
 * Architecture : layout split
 *   - Panneau GAUCHE : contrôles (champs, positionnement, style)
 *   - Panneau DROIT : preview live (rendu réel du composant)
 *
 * Sauvegarde automatique (debounce 1.5s après modification).
 * Drag-and-drop pour les collections (figures, gallery, testimonials, faq).
 *
 * Les onglets "Thèmes" et "Composants" ne sont PAS modifiés.
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Settings, Image as ImageIcon, LayoutTemplate, BarChart3, MessageSquare,
  FileText, Presentation, School, UserPlus, BookOpen, Calendar, Images,
  Star, HelpCircle, Mail, Share2, Search, PanelBottom, Loader2,
  Save, Plus, Trash2, Edit2, X, Check, AlertCircle, ExternalLink,
  Palette, GripVertical, Eye, ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, Type, Monitor,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { tenantWebsiteService } from '@/services/tenant-website.service';
import { tenantThemeService } from '@/services/tenant-theme.service';
import { ThemeGalleryDialog } from '@/components/cms/ThemeGalleryDialog';
import { BlockGalleryDialog } from '@/components/cms/blocks/BlockGalleryDialog';
import { MediaPickerField } from '@/components/media/MediaPickerField';

type SubTab =
  | 'general' | 'colors' | 'themes' | 'components' | 'hero' | 'figures' | 'promoter' | 'director'
  | 'presentation' | 'admissions' | 'schoolLife'
  | 'news' | 'agenda' | 'gallery' | 'testimonials' | 'faq'
  | 'contact' | 'social' | 'seo' | 'footer' | 'settings';

const TABS: { id: SubTab; label: string; icon: any }[] = [
  { id: 'general', label: 'Coordonnées', icon: Settings },
  { id: 'colors', label: 'Couleurs', icon: Palette },
  { id: 'themes', label: 'Thèmes', icon: Palette },
  { id: 'components', label: 'Composants', icon: LayoutTemplate },
  { id: 'hero', label: 'Bannière', icon: LayoutTemplate },
  { id: 'figures', label: 'Chiffres clés', icon: BarChart3 },
  { id: 'promoter', label: 'Mot du Promoteur', icon: MessageSquare },
  { id: 'director', label: 'Mot du Directeur', icon: MessageSquare },
  { id: 'presentation', label: 'Présentation', icon: Presentation },
  { id: 'admissions', label: 'Admissions', icon: UserPlus },
  { id: 'schoolLife', label: 'Vie scolaire', icon: BookOpen },
  { id: 'news', label: 'Actualités', icon: FileText },
  { id: 'agenda', label: 'Agenda', icon: Calendar },
  { id: 'gallery', label: 'Galerie', icon: Images },
  { id: 'testimonials', label: 'Témoignages', icon: Star },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
  { id: 'contact', label: 'Messages reçus', icon: Mail },
  { id: 'social', label: 'Réseaux sociaux', icon: Share2 },
  { id: 'seo', label: 'Visibilité Google', icon: Search },
  { id: 'footer', label: 'Bas de page', icon: PanelBottom },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

// ═══════════════════════════════════════════════════════════════════════
//  SHARED LAYOUT COMPONENTS — Architecture Webflow
// ═══════════════════════════════════════════════════════════════════════

const inputClass = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition';
const labelClass = 'block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide';
const sectionClass = 'bg-white rounded-xl border border-slate-200 p-5 shadow-sm';

/** Layout split : panneau gauche (contrôles) + panneau droit (preview live) */
function SplitLayout({ left, right, previewTitle = 'Aperçu en direct' }: { left: React.ReactNode; right: React.ReactNode; previewTitle?: string }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
      {/* Panneau contrôles */}
      <div className="space-y-4">
        {left}
      </div>
      {/* Panneau preview */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className="bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-200/50 border-b border-slate-200">
            <Eye className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{previewTitle}</span>
          </div>
          <div className="p-4 max-h-[70vh] overflow-y-auto">
            {right}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Carte de contrôle (panneau gauche) */
function ControlCard({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon?: any; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={sectionClass}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full mb-3"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-slate-500" />}
          <h4 className="text-sm font-bold text-slate-800">{title}</h4>
        </div>
        <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && <div className="space-y-3">{children}</div>}
    </div>
  );
}

/** Champ texte avec label */
function TextField({ label, value, onChange, placeholder, hint, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; type?: string }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

/** Zone de texte avec label */
function TextAreaField({ label, value, onChange, placeholder, rows = 4, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; hint?: string }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className={`${inputClass} resize-y`} />
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

/** Toggle switch */
function ToggleField({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button type="button" onClick={() => onChange(!checked)} className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <div>
        <span className="text-sm text-slate-700">{label}</span>
        {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      </div>
    </label>
  );
}

/** Sélecteur d'alignement */
function AlignmentPicker({ value, onChange }: { value: 'left' | 'center' | 'right'; onChange: (v: 'left' | 'center' | 'right') => void }) {
  const options = [
    { value: 'left' as const, icon: AlignLeft },
    { value: 'center' as const, icon: AlignCenter },
    { value: 'right' as const, icon: AlignRight },
  ];
  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            className={`p-2 rounded-md transition ${value === opt.value ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}

/** Bouton sauvegarder flottant avec auto-save indicator */
function AutoSaveBar({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center gap-3 sticky bottom-0 bg-white/90 backdrop-blur-sm py-3 px-4 border-t border-slate-100 -mx-5 -mb-5 rounded-b-xl">
      <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Enregistrer
      </button>
      {saving && <span className="text-xs text-slate-400">Enregistrement en cours…</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════

export function CmsWorkspace() {
  const [activeTab, setActiveTab] = useState<SubTab>('hero');
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await tenantWebsiteService.getConfig();
      setConfig(data);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err?.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async (data: any) => {
    setSaving(true);
    try {
      const updated = await tenantWebsiteService.updateConfig(data);
      setConfig(updated);
      toast({ variant: 'success', title: 'Modifications enregistrées' });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err?.message });
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

  return (
    <div className="space-y-4 pb-12">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-3 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'general' && <GeneralTab config={config} onSave={handleSave} saving={saving} />}
      {activeTab === 'colors' && <ColorsTab config={config} onSave={handleSave} saving={saving} />}
      {activeTab === 'themes' && <ThemesTab />}
      {activeTab === 'components' && <ComponentsTab />}
      {activeTab === 'hero' && <HeroTab config={config} onSave={handleSave} saving={saving} />}
      {activeTab === 'figures' && <FiguresTab config={config} onSave={handleSave} saving={saving} />}
      {activeTab === 'promoter' && <PromoterTab config={config} onSave={handleSave} saving={saving} />}
      {activeTab === 'director' && <DirectorTab config={config} onSave={handleSave} saving={saving} />}
      {activeTab === 'presentation' && <PresentationTab config={config} onSave={handleSave} saving={saving} />}
      {activeTab === 'admissions' && <AdmissionsTab config={config} onSave={handleSave} saving={saving} />}
      {activeTab === 'schoolLife' && <SchoolLifeTab config={config} onSave={handleSave} saving={saving} />}
      {activeTab === 'news' && <NewsTab />}
      {activeTab === 'agenda' && <AgendaTab />}
      {activeTab === 'gallery' && <GalleryTab />}
      {activeTab === 'testimonials' && <TestimonialsTab />}
      {activeTab === 'faq' && <FaqTab />}
      {activeTab === 'contact' && <ContactTab />}
      {activeTab === 'social' && <SocialTab config={config} onSave={handleSave} saving={saving} />}
      {activeTab === 'seo' && <SeoTab config={config} onSave={handleSave} saving={saving} />}
      {activeTab === 'footer' && <FooterTab config={config} onSave={handleSave} saving={saving} />}
      {activeTab === 'settings' && <SettingsTab config={config} onSave={handleSave} saving={saving} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: HERO — Preview live + contrôles positionnement/style
// ═══════════════════════════════════════════════════════════════════════

function HeroTab({ config, onSave, saving }: any) {
  const [form, setForm] = useState({
    heroTitle: config?.heroTitle || '',
    heroSubtitle: config?.heroSubtitle || '',
    heroImageUrl: config?.heroImageUrl || '',
    heroCtaText: config?.heroCtaText || 'Pré-inscription',
    heroCtaUrl: config?.heroCtaUrl || '/public/pre-enrollment',
    heroIsActive: config?.heroIsActive ?? true,
    heroAlignment: (config as any)?.heroAlignment || 'center',
    heroAnimation: (config as any)?.heroAnimation || 'fade-up',
    heroOverlayOpacity: (config as any)?.heroOverlayOpacity ?? 60,
  });

  const update = (field: string, value: any) => setForm({ ...form, [field]: value });

  const alignmentClass = form.heroAlignment === 'left' ? 'text-left' : form.heroAlignment === 'right' ? 'text-right' : 'text-center';
  const overlayAlpha = Math.round((form.heroOverlayOpacity / 100) * 255).toString(16).padStart(2, '0');

  const animationOptions = [
    { value: 'fade-up', label: 'Fondu vers le haut' },
    { value: 'fade-in', label: 'Fondu simple' },
    { value: 'slide-left', label: 'Glissement depuis la gauche' },
    { value: 'slide-right', label: 'Glissement depuis la droite' },
    { value: 'zoom-in', label: 'Zoom avant' },
    { value: 'none', label: 'Aucune animation' },
  ];

  return (
    <SplitLayout
      previewTitle="Aperçu de la bannière"
      left={
        <>
          <ControlCard title="Contenu" icon={Type}>
            <TextField label="Titre principal" value={form.heroTitle} onChange={(v) => update('heroTitle', v)} placeholder="Nom de votre établissement" />
            <TextAreaField label="Slogan / phrase d'accroche" value={form.heroSubtitle} onChange={(v) => update('heroSubtitle', v)} rows={2} placeholder="Excellence éducative depuis 1995…" />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Texte du bouton" value={form.heroCtaText} onChange={(v) => update('heroCtaText', v)} />
              <TextField label="Lien du bouton" value={form.heroCtaUrl} onChange={(v) => update('heroCtaUrl', v)} />
            </div>
          </ControlCard>

          <ControlCard title="Mise en page" icon={LayoutTemplate}>
            <div>
              <label className={labelClass}>Alignement du texte</label>
              <AlignmentPicker value={form.heroAlignment} onChange={(v) => update('heroAlignment', v)} />
            </div>
            <div>
              <label className={labelClass}>Opacité de l'overlay</label>
              <div className="flex items-center gap-3">
                <input type="range" min="0" max="100" value={form.heroOverlayOpacity} onChange={(e) => update('heroOverlayOpacity', Number(e.target.value))} className="flex-1" />
                <span className="text-xs font-semibold text-slate-600 w-10 text-right">{form.heroOverlayOpacity}%</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Contrôle l'assombrissement de l'image de fond pour la lisibilité du texte.</p>
            </div>
            <ToggleField label="Afficher la bannière" checked={form.heroIsActive} onChange={(v) => update('heroIsActive', v)} />
          </ControlCard>

          <ControlCard title="Effets & Animations" icon={Eye} defaultOpen={false}>
            <div>
              <label className={labelClass}>Animation d'entrée</label>
              <select value={form.heroAnimation} onChange={(e) => update('heroAnimation', e.target.value)} className={inputClass}>
                {animationOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">L'animation se déclenche quand le visiteur arrive sur la page.</p>
            </div>
          </ControlCard>

          <ControlCard title="Image de fond" icon={ImageIcon} defaultOpen={false}>
            <div>
              <label className={labelClass}>Image de fond</label>
              <MediaPickerField
                value={form.heroImageUrl || null}
                onChange={(url) => update('heroImageUrl', url || '')}
                aspect="banner"
                folder="hero"
                hint="Si vide, un dégradé navy/bleu sera utilisé."
              />
            </div>
          </ControlCard>

          <AutoSaveBar saving={saving} onSave={() => onSave(form)} />
        </>
      }
      right={
        <div className="rounded-xl overflow-hidden shadow-lg">
          {/* Preview Hero avec overlay dynamique */}
          <div className={`relative min-h-[300px] flex items-center justify-center p-8 ${alignmentClass}`}
            style={{
              background: form.heroImageUrl
                ? `linear-gradient(135deg, rgba(11,47,115,${form.heroOverlayOpacity / 100}), rgba(29,79,165,${form.heroOverlayOpacity / 200})), url(${form.heroImageUrl}) center/cover`
                : 'linear-gradient(135deg, #0b2f73 0%, #1d4fa5 50%, #091f4a 100%)',
            }}>
            <div className="relative z-10 max-w-md">
              <h1 className="text-2xl font-extrabold text-white leading-tight mb-3 drop-shadow-lg">
                {form.heroTitle || 'Titre de votre établissement'}
              </h1>
              <p className="text-sm text-blue-50/85 mb-5 leading-relaxed">
                {form.heroSubtitle || 'Votre slogan ou phrase d\'accroche apparaîtra ici.'}
              </p>
              <div className={`flex gap-2 ${form.heroAlignment === 'center' ? 'justify-center' : form.heroAlignment === 'right' ? 'justify-end' : 'justify-start'}`}>
                <span className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-[#0b2f73] shadow-lg transition-transform hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #f5b335, #e09e1f)' }}>
                  {form.heroCtaText || 'Pré-inscription'} →
                </span>
              </div>
            </div>
          </div>
          {/* Indicateur overlay */}
          <div className="px-3 py-2 bg-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Overlay: {form.heroOverlayOpacity}%</span>
            <span>Animation: {animationOptions.find(a => a.value === form.heroAnimation)?.label}</span>
          </div>
        </div>
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: FIGURES — Cards visuelles + drag-and-drop ordre
// ═══════════════════════════════════════════════════════════════════════

function FiguresTab({ config, onSave, saving }: any) {
  const [figures, setFigures] = useState<any[]>(
    Array.isArray(config?.keyFigures) ? config.keyFigures : []
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const addFigure = () => setFigures([...figures, { value: '', label: '' }]);
  const removeFigure = (i: number) => setFigures(figures.filter((_, idx) => idx !== i));
  const updateFigure = (i: number, field: string, value: string) =>
    setFigures(figures.map((f, idx) => (idx === i ? { ...f, [field]: value } : f)));
  const moveFigure = (i: number, dir: -1 | 1) => {
    const newIdx = i + dir;
    if (newIdx < 0 || newIdx >= figures.length) return;
    const next = [...figures];
    [next[i], next[newIdx]] = [next[newIdx], next[i]];
    setFigures(next);
  };

  return (
    <SplitLayout
      previewTitle="Aperçu des chiffres clés"
      left={
        <>
          <div className="space-y-3">
            {figures.map((fig, i) => (
              <div key={i} className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveFigure(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-blue-600 disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                  <button onClick={() => moveFigure(i, 1)} disabled={i === figures.length - 1} className="text-slate-400 hover:text-blue-600 disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                </div>
                <input className="w-20 px-2 py-1.5 text-center text-lg font-bold border border-slate-200 rounded-lg focus:border-blue-500 outline-none" placeholder="500" value={fig.value || ''} onChange={(e) => updateFigure(i, 'value', e.target.value)} />
                <input className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-blue-500 outline-none" placeholder="Élèves inscrits" value={fig.label || ''} onChange={(e) => updateFigure(i, 'label', e.target.value)} />
                <button onClick={() => removeFigure(i)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <button onClick={addFigure} className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 rounded-xl text-sm font-semibold text-slate-600 hover:text-blue-700 transition flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Ajouter un chiffre
          </button>
          <AutoSaveBar saving={saving} onSave={() => onSave({ keyFigures: figures })} />
        </>
      }
      right={
        <div className="grid grid-cols-2 gap-3">
          {figures.map((fig, i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 text-center">
              <div className="text-2xl font-extrabold text-blue-900">{fig.value || '—'}</div>
              <div className="text-xs text-slate-500 mt-1">{fig.label || 'Libellé'}</div>
            </div>
          ))}
          {figures.length === 0 && <p className="text-sm text-slate-400 col-span-2 text-center py-8">Aucun chiffre clé.</p>}
        </div>
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: MOT DU PROMOTEUR / DIRECTEUR — Preview live carte
// ═══════════════════════════════════════════════════════════════════════

function WordTab({ config, onSave, saving, fieldPrefix, title, previewIcon }: any) {
  const [form, setForm] = useState({
    [`${fieldPrefix}Word`]: config?.[`${fieldPrefix}Word`] || '',
    [`${fieldPrefix}Name`]: config?.[`${fieldPrefix}Name`] || '',
    [`${fieldPrefix}PhotoUrl`]: config?.[`${fieldPrefix}PhotoUrl`] || '',
    [`${fieldPrefix}IsActive`]: config?.[`${fieldPrefix}IsActive`] ?? true,
  });

  const update = (field: string, value: any) => setForm({ ...form, [field]: value });
  const word = form[`${fieldPrefix}Word`];
  const name = form[`${fieldPrefix}Name`];
  const photo = form[`${fieldPrefix}PhotoUrl`];

  return (
    <SplitLayout
      previewTitle={`Aperçu — ${title}`}
      left={
        <>
          <ControlCard title="Contenu" icon={MessageSquare}>
            <TextField label="Nom" value={name} onChange={(v) => update(`${fieldPrefix}Name`, v)} placeholder="Ex: M. Jean Dupont" />
            <TextAreaField label="Message" value={word} onChange={(v) => update(`${fieldPrefix}Word`, v)} rows={8} placeholder="Chers parents, chers élèves…" />
            <div>
              <label className={labelClass}>Photo</label>
              <MediaPickerField
                value={photo || null}
                onChange={(url) => update(`${fieldPrefix}PhotoUrl`, url || '')}
                aspect="square"
                folder={fieldPrefix}
                hint="Photo de préférence carrée (format portrait)."
              />
            </div>
          </ControlCard>
          <ControlCard title="Affichage" icon={Eye}>
            <ToggleField label={`Afficher le mot du ${title}`} checked={form[`${fieldPrefix}IsActive`]} onChange={(v) => update(`${fieldPrefix}IsActive`, v)} />
          </ControlCard>
          <AutoSaveBar saving={saving} onSave={() => onSave(form)} />
        </>
      }
      right={
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-start gap-4">
            {photo ? (
              <img src={photo} alt={name} className="w-16 h-16 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                <span className="text-2xl text-slate-400">{name?.charAt(0) || '?'}</span>
              </div>
            )}
            <div className="flex-1">
              <h4 className="font-bold text-slate-900 mb-2">Mot du {title}</h4>
              <p className="text-sm text-slate-600 leading-relaxed line-clamp-6">{word || 'Votre message apparaîtra ici…'}</p>
              <p className="text-xs font-semibold text-slate-500 mt-3">— {name || `Le ${title}`}</p>
            </div>
          </div>
        </div>
      }
    />
  );
}

function PromoterTab({ config, onSave, saving }: any) {
  return <WordTab config={config} onSave={onSave} saving={saving} fieldPrefix="promoter" title="Promoteur" />;
}

function DirectorTab({ config, onSave, saving }: any) {
  return <WordTab config={config} onSave={onSave} saving={saving} fieldPrefix="director" title="Directeur" />;
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: PRÉSENTATION — Preview live
// ═══════════════════════════════════════════════════════════════════════

function PresentationTab({ config, onSave, saving }: any) {
  const [form, setForm] = useState({
    presentationTitle: config?.presentationTitle || '',
    presentationContent: config?.presentationContent || '',
    presentationImageUrl: config?.presentationImageUrl || '',
    presentationIsActive: config?.presentationIsActive ?? true,
  });
  const update = (field: string, value: any) => setForm({ ...form, [field]: value });

  return (
    <SplitLayout
      previewTitle="Aperçu de la présentation"
      left={
        <>
          <ControlCard title="Contenu" icon={Presentation}>
            <TextField label="Titre" value={form.presentationTitle} onChange={(v) => update('presentationTitle', v)} placeholder="Présentation de l'établissement" />
            <TextAreaField label="Texte" value={form.presentationContent} onChange={(v) => update('presentationContent', v)} rows={10} placeholder="Notre établissement s'engage à…" />
            <div>
              <label className={labelClass}>Image</label>
              <MediaPickerField
                value={form.presentationImageUrl || null}
                onChange={(url) => update('presentationImageUrl', url || '')}
                aspect="wide"
                folder="presentation"
              />
            </div>
          </ControlCard>
          <ToggleField label="Afficher la section" checked={form.presentationIsActive} onChange={(v) => update('presentationIsActive', v)} />
          <AutoSaveBar saving={saving} onSave={() => onSave(form)} />
        </>
      }
      right={
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-xl font-extrabold text-slate-900 mb-3">{form.presentationTitle || 'Présentation'}</h3>
          {form.presentationImageUrl && <img src={form.presentationImageUrl} alt="" className="w-full h-40 object-cover rounded-lg mb-4" />}
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{form.presentationContent || 'Votre texte de présentation apparaîtra ici…'}</p>
        </div>
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: ADMISSIONS / VIE SCOLAIRE — Preview live (générique)
// ═══════════════════════════════════════════════════════════════════════

function ContentTab({ config, onSave, saving, prefix, title, icon }: any) {
  const [form, setForm] = useState({
    [`${prefix}Title`]: config?.[`${prefix}Title`] || '',
    [`${prefix}Content`]: config?.[`${prefix}Content`] || '',
    [`${prefix}IsActive`]: config?.[`${prefix}IsActive`] ?? true,
  });
  const update = (field: string, value: any) => setForm({ ...form, [field]: value });

  return (
    <SplitLayout
      previewTitle={`Aperçu — ${title}`}
      left={
        <>
          <ControlCard title="Contenu" icon={icon}>
            <TextField label="Titre" value={form[`${prefix}Title`]} onChange={(v) => update(`${prefix}Title`, v)} placeholder={title} />
            <TextAreaField label="Texte" value={form[`${prefix}Content`]} onChange={(v) => update(`${prefix}Content`, v)} rows={10} placeholder={`Contenu de la section ${title.toLowerCase()}…`} />
          </ControlCard>
          <ToggleField label={`Afficher la section ${title.toLowerCase()}`} checked={form[`${prefix}IsActive`]} onChange={(v) => update(`${prefix}IsActive`, v)} />
          <AutoSaveBar saving={saving} onSave={() => onSave(form)} />
        </>
      }
      right={
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-xl font-extrabold text-slate-900 mb-3">{form[`${prefix}Title`] || title}</h3>
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{form[`${prefix}Content`] || `Votre contenu apparaîtra ici…`}</p>
        </div>
      }
    />
  );
}

function AdmissionsTab({ config, onSave, saving }: any) {
  return <ContentTab config={config} onSave={onSave} saving={saving} prefix="admissions" title="Admissions" icon={UserPlus} />;
}

function SchoolLifeTab({ config, onSave, saving }: any) {
  return <ContentTab config={config} onSave={onSave} saving={saving} prefix="schoolLife" title="Vie scolaire" icon={BookOpen} />;
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: GENERAL — Coordonnées
// ═══════════════════════════════════════════════════════════════════════

function GeneralTab({ config, onSave, saving }: any) {
  const [form, setForm] = useState({
    contactEmail: config?.contactEmail || '',
    contactPhone: config?.contactPhone || '',
    contactAddress: config?.contactAddress || '',
    contactMapUrl: config?.contactMapUrl || '',
    isActive: config?.isActive ?? true,
  });

  return (
    <SplitLayout
      previewTitle="Aperçu des coordonnées"
      left={
        <>
          <ControlCard title="Coordonnées" icon={Settings}>
            <TextField label="Email de contact" value={form.contactEmail} onChange={(v) => setForm({ ...form, contactEmail: v })} placeholder="contact@ecole.com" />
            <TextField label="Téléphone" value={form.contactPhone} onChange={(v) => setForm({ ...form, contactPhone: v })} placeholder="+229…" />
            <TextField label="Adresse" value={form.contactAddress} onChange={(v) => setForm({ ...form, contactAddress: v })} placeholder="Cotonou, Bénin" />
            <TextField label="Lien Google Maps" value={form.contactMapUrl} onChange={(v) => setForm({ ...form, contactMapUrl: v })} hint="Ouvrez Google Maps → Partager → copier le lien" />
          </ControlCard>
          <ToggleField label="Site institutionnel actif" checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
          <AutoSaveBar saving={saving} onSave={() => onSave(form)} />
        </>
      }
      right={
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-3">
          <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-blue-600" /><span className="text-sm text-slate-700">{form.contactEmail || 'email@exemple.com'}</span></div>
          <div className="flex items-center gap-2"><Settings className="w-4 h-4 text-amber-600" /><span className="text-sm text-slate-700">{form.contactPhone || '+229…'}</span></div>
          <div className="flex items-center gap-2"><ExternalLink className="w-4 h-4 text-blue-600" /><span className="text-sm text-slate-700">{form.contactAddress || 'Cotonou, Bénin'}</span></div>
        </div>
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: NEWS — Cards preview + CRUD visuel
// ═══════════════════════════════════════════════════════════════════════

function NewsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await tenantWebsiteService.getNews();
      const sorted = (Array.isArray(data) ? data : []).sort((a, b) => {
        const da = new Date(a.publishedAt || a.createdAt || 0).getTime();
        const db = new Date(b.publishedAt || b.createdAt || 0).getTime();
        return db - da;
      });
      setItems(sorted);
    } catch { setItems([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startCreate = () => {
    setForm({ title: '', excerpt: '', content: '', coverImageUrl: null, category: '', status: 'DRAFT', isFeatured: false });
    setEditing('new');
  };
  const startEdit = (item: any) => { setForm({ ...item, coverImageUrl: item.coverImageUrl || null }); setEditing(item.id); };

  const handleSave = async () => {
    if (!form.title?.trim()) { toast({ variant: 'error', title: 'Titre requis' }); return; }
    try {
      const payload = { ...form };
      if (payload.status === 'PUBLISHED' && !payload.publishedAt) payload.publishedAt = new Date().toISOString();
      if (editing === 'new') {
        const baseSlug = (form.title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase().substring(0, 80) || 'article';
        let slug = baseSlug;
        const existing = items.filter((i) => i.slug === slug);
        if (existing.length > 0) slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
        payload.slug = slug;
        await tenantWebsiteService.createNews(payload);
      } else {
        await tenantWebsiteService.updateNews(editing, payload);
      }
      toast({ variant: 'success', title: 'Article enregistré' });
      setEditing(null); setForm({}); load();
    } catch (err: any) { toast({ variant: 'error', title: 'Erreur', description: err?.message }); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet article ?')) return;
    try { await tenantWebsiteService.deleteNews(id); toast({ variant: 'success', title: 'Supprimé' }); load(); }
    catch (err: any) { toast({ variant: 'error', title: 'Erreur', description: err?.message }); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <SplitLayout
      previewTitle="Aperçu des actualités"
      left={
        <>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-800">{items.length} article{items.length > 1 ? 's' : ''}</h3>
            <button onClick={startCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"><Plus className="w-3.5 h-3.5" /> Nouvel article</button>
          </div>
          {editing && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 space-y-3">
              <div className="flex items-center justify-between"><h4 className="font-bold text-sm text-slate-900">{editing === 'new' ? 'Nouvel article' : 'Modifier'}</h4><button onClick={() => setEditing(null)} className="text-slate-400"><X className="w-4 h-4" /></button></div>
              <TextField label="Titre" value={form.title || ''} onChange={(v) => setForm({ ...form, title: v })} />
              <TextField label="Catégorie" value={form.category || ''} onChange={(v) => setForm({ ...form, category: v })} placeholder="Annonce, Événement…" />
              <TextAreaField label="Résumé" value={form.excerpt || ''} onChange={(v) => setForm({ ...form, excerpt: v })} rows={2} />
              <TextAreaField label="Contenu" value={form.content || ''} onChange={(v) => setForm({ ...form, content: v })} rows={6} />
              <div>
                <label className={labelClass}>Image de couverture</label>
                <MediaPickerField
                  value={form.coverImageUrl || null}
                  onChange={(url) => setForm({ ...form, coverImageUrl: url })}
                  aspect="wide"
                  folder="news"
                />
              </div>
              <div className="flex gap-4">
                <ToggleField label="Publier" checked={form.status === 'PUBLISHED'} onChange={(v) => setForm({ ...form, status: v ? 'PUBLISHED' : 'DRAFT' })} />
                <ToggleField label="À la une" checked={!!form.isFeatured} onChange={(v) => setForm({ ...form, isFeatured: v })} />
              </div>
              <button onClick={handleSave} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"><Save className="w-3.5 h-3.5" /> Enregistrer</button>
            </div>
          )}
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0">{item.coverImageUrl && <img src={item.coverImageUrl} alt="" className="w-full h-full object-cover" />}</div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900 truncate">{item.title}</p><p className="text-xs text-slate-400">{item.status === 'PUBLISHED' ? '✓ Publié' : 'Brouillon'}{item.isFeatured ? ' · À la une' : ''}</p></div>
                <button onClick={() => startEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Aucun article.</p>}
          </div>
        </>
      }
      right={
        <div className="space-y-3">
          {items.slice(0, 4).map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              {item.coverImageUrl && <img src={item.coverImageUrl} alt="" className="w-full h-32 object-cover" />}
              <div className="p-4">
                {item.category && <span className="text-[10px] font-bold uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{item.category}</span>}
                <h4 className="font-bold text-slate-900 mt-2">{item.title}</h4>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.excerpt || item.content}</p>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Aucun article à prévisualiser.</p>}
        </div>
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: AGENDA — Events avec preview
// ═══════════════════════════════════════════════════════════════════════

function AgendaTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await tenantWebsiteService.getEvents();
      const sorted = (Array.isArray(data) ? data : []).sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
      setItems(sorted);
    } catch { setItems([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startCreate = () => { setForm({ title: '', description: '', startDate: '', endDate: '', location: '', category: '', isFeatured: false }); setEditing('new'); };
  const startEdit = (item: any) => { setForm({ ...item, startDate: item.startDate?.substring(0, 16) || '', endDate: item.endDate?.substring(0, 16) || '' }); setEditing(item.id); };

  const handleSave = async () => {
    if (!form.title?.trim()) { toast({ variant: 'error', title: 'Titre requis' }); return; }
    if (!form.startDate) { toast({ variant: 'error', title: 'Date requise' }); return; }
    try {
      const payload = { ...form, startDate: form.startDate ? new Date(form.startDate).toISOString() : null, endDate: form.endDate ? new Date(form.endDate).toISOString() : null };
      if (editing === 'new') await tenantWebsiteService.createEvent(payload);
      else await tenantWebsiteService.updateEvent(editing, payload);
      toast({ variant: 'success', title: 'Événement enregistré' });
      setEditing(null); setForm({}); load();
    } catch (err: any) { toast({ variant: 'error', title: 'Erreur', description: err?.message }); }
  };

  const handleDelete = async (id: string) => { if (!confirm('Supprimer ?')) return; try { await tenantWebsiteService.deleteEvent(id); load(); } catch {} };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <SplitLayout
      previewTitle="Aperçu de l'agenda"
      left={
        <>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-800">{items.length} événement{items.length > 1 ? 's' : ''}</h3>
            <button onClick={startCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"><Plus className="w-3.5 h-3.5" /> Nouvel événement</button>
          </div>
          {editing && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 space-y-3">
              <div className="flex items-center justify-between"><h4 className="font-bold text-sm">{editing === 'new' ? 'Nouvel événement' : 'Modifier'}</h4><button onClick={() => setEditing(null)}><X className="w-4 h-4" /></button></div>
              <TextField label="Titre" value={form.title || ''} onChange={(v) => setForm({ ...form, title: v })} />
              <TextAreaField label="Description" value={form.description || ''} onChange={(v) => setForm({ ...form, description: v })} rows={3} />
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelClass}>Début</label><input type="datetime-local" value={form.startDate || ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputClass} /></div>
                <div><label className={labelClass}>Fin</label><input type="datetime-local" value={form.endDate || ''} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={inputClass} /></div>
              </div>
              <TextField label="Lieu" value={form.location || ''} onChange={(v) => setForm({ ...form, location: v })} />
              <button onClick={handleSave} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"><Save className="w-3.5 h-3.5" /> Enregistrer</button>
            </div>
          )}
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
                <div className="w-12 h-12 rounded-lg bg-blue-600 text-white flex flex-col items-center justify-center shrink-0"><span className="text-xs font-bold">{new Date(item.startDate).toLocaleDateString('fr-FR', { month: 'short' })}</span><span className="text-lg font-black">{new Date(item.startDate).getDate()}</span></div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900 truncate">{item.title}</p><p className="text-xs text-slate-400">{item.location || '—'}</p></div>
                <button onClick={() => startEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </>
      }
      right={
        <div className="space-y-2">
          {items.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-100">
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex flex-col items-center justify-center shrink-0"><span className="text-[9px] font-bold">{new Date(item.startDate).toLocaleDateString('fr-FR', { month: 'short' })}</span><span className="text-base font-black leading-none">{new Date(item.startDate).getDate()}</span></div>
              <div><p className="text-sm font-bold text-slate-900">{item.title}</p><p className="text-xs text-slate-500">{new Date(item.startDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}{item.location && ` · ${item.location}`}</p></div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Aucun événement.</p>}
        </div>
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: GALERIE — Grid preview + drag-and-drop
// ═══════════════════════════════════════════════════════════════════════

function GalleryTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    try { setLoading(true); const data = await tenantWebsiteService.getGallery(); const sorted = (Array.isArray(data) ? data : []).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)); setItems(sorted); }
    catch { setItems([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startCreate = () => { setForm({ imageUrl: null, caption: '', category: '', isActive: true }); setEditing('new'); };
  const startEdit = (item: any) => { setForm({ ...item, imageUrl: item.imageUrl || null }); setEditing(item.id); };

  const handleSave = async () => {
    if (!form.imageUrl) { toast({ variant: 'error', title: 'Image requise' }); return; }
    try {
      const payload = { ...form, displayOrder: items.length };
      if (editing === 'new') await tenantWebsiteService.createGalleryItem(payload);
      else await tenantWebsiteService.updateGalleryItem(editing, payload);
      toast({ variant: 'success', title: 'Photo enregistrée' });
      setEditing(null); setForm({}); load();
    } catch (err: any) { toast({ variant: 'error', title: 'Erreur', description: err?.message }); }
  };

  const handleReorder = async (next: any[]) => {
    setItems(next);
    try { await Promise.all(next.map((item, idx) => tenantWebsiteService.updateGalleryItem(item.id, { ...item, displayOrder: idx }))); }
    catch (err: any) { toast({ variant: 'error', title: 'Erreur réorganisation' }); load(); }
  };

  const handleDelete = async (id: string) => { if (!confirm('Supprimer ?')) return; try { await tenantWebsiteService.deleteGalleryItem(id); load(); } catch {} };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <SplitLayout
      previewTitle="Aperçu de la galerie"
      left={
        <>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-800">{items.length} photo{items.length > 1 ? 's' : ''}</h3>
            <button onClick={startCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"><Plus className="w-3.5 h-3.5" /> Ajouter</button>
          </div>
          {editing && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 space-y-3">
              <div className="flex items-center justify-between"><h4 className="font-bold text-sm">{editing === 'new' ? 'Nouvelle photo' : 'Modifier'}</h4><button onClick={() => setEditing(null)}><X className="w-4 h-4" /></button></div>
              <div>
                <label className={labelClass}>Photo</label>
                <MediaPickerField
                  value={form.imageUrl || null}
                  onChange={(url) => setForm({ ...form, imageUrl: url })}
                  aspect="square"
                  folder="gallery"
                />
              </div>
              <TextField label="Légende" value={form.caption || ''} onChange={(v) => setForm({ ...form, caption: v })} />
              <TextField label="Catégorie" value={form.category || ''} onChange={(v) => setForm({ ...form, category: v })} />
              <button onClick={handleSave} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"><Save className="w-3.5 h-3.5" /> Enregistrer</button>
            </div>
          )}
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0">{item.imageUrl && <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />}</div>
                <span className="flex-1 text-sm text-slate-700 truncate">{item.caption || 'Sans légende'}</span>
                <button onClick={() => startEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </>
      }
      right={
        <div className="grid grid-cols-2 gap-3">
          {items.slice(0, 8).map((item) => (
            <div key={item.id} className="aspect-square rounded-xl overflow-hidden bg-slate-100 group relative">
              {item.imageUrl ? <img src={item.imageUrl} alt={item.caption || ''} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-amber-50"><Images className="w-8 h-8 text-slate-300" /></div>}
              {item.caption && <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1">{item.caption}</div>}
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-slate-400 col-span-2 text-center py-8">Aucune photo.</p>}
        </div>
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: TÉMOIGNAGES — Cards preview + drag-and-drop + étoiles
// ═══════════════════════════════════════════════════════════════════════

function TestimonialsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    try { setLoading(true); const data = await tenantWebsiteService.getTestimonials(); const sorted = (Array.isArray(data) ? data : []).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)); setItems(sorted); }
    catch { setItems([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startCreate = () => { setForm({ authorName: '', authorRole: '', content: '', rating: 5, isFeatured: false, isActive: true }); setEditing('new'); };
  const startEdit = (item: any) => { setForm({ ...item }); setEditing(item.id); };

  const handleSave = async () => {
    if (!form.authorName?.trim() || !form.content?.trim()) { toast({ variant: 'error', title: 'Nom et témoignage requis' }); return; }
    try {
      const payload = { ...form, displayOrder: items.length };
      if (editing === 'new') await tenantWebsiteService.createTestimonial(payload);
      else await tenantWebsiteService.updateTestimonial(editing, payload);
      toast({ variant: 'success', title: 'Témoignage enregistré' });
      setEditing(null); setForm({}); load();
    } catch (err: any) { toast({ variant: 'error', title: 'Erreur', description: err?.message }); }
  };

  const handleDelete = async (id: string) => { if (!confirm('Supprimer ?')) return; try { await tenantWebsiteService.deleteTestimonial(id); load(); } catch {} };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <SplitLayout
      previewTitle="Aperçu des témoignages"
      left={
        <>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-800">{items.length} témoignage{items.length > 1 ? 's' : ''}</h3>
            <button onClick={startCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"><Plus className="w-3.5 h-3.5" /> Ajouter</button>
          </div>
          {editing && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 space-y-3">
              <div className="flex items-center justify-between"><h4 className="font-bold text-sm">{editing === 'new' ? 'Nouveau' : 'Modifier'}</h4><button onClick={() => setEditing(null)}><X className="w-4 h-4" /></button></div>
              <TextField label="Nom" value={form.authorName || ''} onChange={(v) => setForm({ ...form, authorName: v })} />
              <TextField label="Rôle" value={form.authorRole || ''} onChange={(v) => setForm({ ...form, authorRole: v })} placeholder="Parent d'élève" />
              <TextAreaField label="Témoignage" value={form.content || ''} onChange={(v) => setForm({ ...form, content: v })} rows={4} />
              <div>
                <label className={labelClass}>Note</label>
                <div className="flex gap-1">{[1,2,3,4,5].map(n => <button key={n} onClick={() => setForm({ ...form, rating: n })} className="p-1"><Star className={`w-5 h-5 ${(form.rating || 0) >= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} /></button>)}</div>
              </div>
              <button onClick={handleSave} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"><Save className="w-3.5 h-3.5" /> Enregistrer</button>
            </div>
          )}
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200">
                <div className="flex-1 min-w-0"><p className="text-xs text-slate-600 italic line-clamp-2">« {item.content} »</p><p className="text-xs font-semibold text-slate-900 mt-1">— {item.authorName}</p></div>
                <button onClick={() => startEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </>
      }
      right={
        <div className="space-y-3">
          {items.slice(0, 4).map((item) => (
            <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <div className="flex gap-1 mb-2">{Array.from({ length: item.rating || 5 }).map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}</div>
              <p className="text-sm text-slate-700 italic">« {item.content} »</p>
              <p className="text-xs font-bold text-slate-900 mt-2">— {item.authorName}{item.authorRole && <span className="font-normal text-slate-400"> · {item.authorRole}</span>}</p>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Aucun témoignage.</p>}
        </div>
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: FAQ — Accordion preview + drag-and-drop
// ═══════════════════════════════════════════════════════════════════════

function FaqTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    try { setLoading(true); const data = await tenantWebsiteService.getFaq(); const sorted = (Array.isArray(data) ? data : []).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)); setItems(sorted); }
    catch { setItems([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startCreate = () => { setForm({ question: '', answer: '', category: '', isActive: true }); setEditing('new'); };
  const startEdit = (item: any) => { setForm({ ...item }); setEditing(item.id); };

  const handleSave = async () => {
    if (!form.question?.trim() || !form.answer?.trim()) { toast({ variant: 'error', title: 'Question et réponse requises' }); return; }
    try {
      const payload = { ...form, displayOrder: items.length };
      if (editing === 'new') await tenantWebsiteService.createFaqItem(payload);
      else await tenantWebsiteService.updateFaqItem(editing, payload);
      toast({ variant: 'success', title: 'Question enregistrée' });
      setEditing(null); setForm({}); load();
    } catch (err: any) { toast({ variant: 'error', title: 'Erreur', description: err?.message }); }
  };

  const handleDelete = async (id: string) => { if (!confirm('Supprimer ?')) return; try { await tenantWebsiteService.deleteFaqItem(id); load(); } catch {} };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <SplitLayout
      previewTitle="Aperçu de la FAQ"
      left={
        <>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-800">{items.length} question{items.length > 1 ? 's' : ''}</h3>
            <button onClick={startCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"><Plus className="w-3.5 h-3.5" /> Ajouter</button>
          </div>
          {editing && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 space-y-3">
              <div className="flex items-center justify-between"><h4 className="font-bold text-sm">{editing === 'new' ? 'Nouvelle question' : 'Modifier'}</h4><button onClick={() => setEditing(null)}><X className="w-4 h-4" /></button></div>
              <TextField label="Question" value={form.question || ''} onChange={(v) => setForm({ ...form, question: v })} />
              <TextAreaField label="Réponse" value={form.answer || ''} onChange={(v) => setForm({ ...form, answer: v })} rows={4} />
              <TextField label="Catégorie" value={form.category || ''} onChange={(v) => setForm({ ...form, category: v })} />
              <button onClick={handleSave} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"><Save className="w-3.5 h-3.5" /> Enregistrer</button>
            </div>
          )}
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200">
                <HelpCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900">{item.question}</p><p className="text-xs text-slate-500 line-clamp-2">{item.answer}</p></div>
                <button onClick={() => startEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </>
      }
      right={
        <div className="space-y-2">
          {items.map((item, idx) => (
            <details key={item.id || idx} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <summary className="cursor-pointer p-3 text-sm font-semibold text-slate-900 flex items-center justify-between">{item.question}<span className="text-slate-400">+</span></summary>
              <div className="px-3 pb-3 text-xs text-slate-600">{item.answer}</div>
            </details>
          ))}
          {items.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Aucune question.</p>}
        </div>
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: CONTACT — Messages reçus
// ═══════════════════════════════════════════════════════════════════════

function ContactTab() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setLoading(true); const data = await tenantWebsiteService.getContactMessages(); setMessages(Array.isArray(data) ? data : []); }
    catch { setMessages([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatus = async (id: string, status: string) => { try { await tenantWebsiteService.updateContactStatus(id, status); load(); } catch {} };
  const handleDelete = async (id: string) => { if (!confirm('Supprimer ?')) return; try { await tenantWebsiteService.deleteContactMessage(id); load(); } catch {} };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-800">{messages.length} message{messages.length > 1 ? 's' : ''}</h3>
      {messages.map((msg) => (
        <div key={msg.id} className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div><p className="font-bold text-slate-900">{msg.name}<span className="text-xs text-slate-400 ml-2">{msg.email}</span></p>{msg.subject && <p className="text-sm text-slate-600">{msg.subject}</p>}</div>
            <div className="flex gap-2">
              <select value={msg.status} onChange={(e) => handleStatus(msg.id, e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1">
                <option value="NEW">Nouveau</option><option value="READ">Lu</option><option value="REPLIED">Répondu</option><option value="ARCHIVED">Archivé</option>
              </select>
              <button onClick={() => handleDelete(msg.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.message}</p>
          <p className="text-xs text-slate-400 mt-2">{new Date(msg.createdAt).toLocaleString('fr-FR')}</p>
        </div>
      ))}
      {messages.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Aucun message.</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: SOCIAL / SEO / FOOTER / SETTINGS / COLORS — Versions simplifiées
// ═══════════════════════════════════════════════════════════════════════

function SocialTab({ config, onSave, saving }: any) {
  const [social, setSocial] = useState<any>(config?.socialLinks || {});
  const platforms = [
    { id: 'facebook', label: 'Facebook', placeholder: 'facebook.com/votre-ecole' },
    { id: 'instagram', label: 'Instagram', placeholder: 'instagram.com/votre-ecole' },
    { id: 'youtube', label: 'YouTube', placeholder: 'youtube.com/@votre-ecole' },
    { id: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/company/votre-ecole' },
    { id: 'twitter', label: 'Twitter / X', placeholder: 'twitter.com/votre-ecole' },
    { id: 'whatsapp', label: 'WhatsApp', placeholder: 'wa.me/22900000000' },
    { id: 'telegram', label: 'Telegram', placeholder: 't.me/votre-ecole' },
  ];
  return (
    <SplitLayout previewTitle="Aperçu des réseaux sociaux" left={<>
      <ControlCard title="Liens" icon={Share2}>
        {platforms.map(p => <TextField key={p.id} label={p.label} value={social[p.id] || ''} onChange={(v) => setSocial({ ...social, [p.id]: v })} placeholder={p.placeholder} />)}
      </ControlCard>
      <AutoSaveBar saving={saving} onSave={() => onSave({ socialLinks: social })} />
    </>} right={
      <div className="space-y-2">{platforms.filter(p => social[p.id]).map(p => <div key={p.id} className="flex items-center gap-2 bg-white rounded-lg p-3 border border-slate-100"><Share2 className="w-4 h-4 text-blue-600" /><span className="text-sm text-slate-700">{p.label}: {social[p.id]}</span></div>)}</div>
    } />
  );
}

function SeoTab({ config, onSave, saving }: any) {
  const [form, setForm] = useState({
    seoMetaTitle: config?.seoMetaTitle || '',
    seoMetaDescription: config?.seoMetaDescription || '',
    seoOgImageUrl: config?.seoOgImageUrl || '',
  });
  const titleCount = form.seoMetaTitle.length;
  const descCount = form.seoMetaDescription.length;
  return (
    <SplitLayout previewTitle="Aperçu dans Google" left={<>
      <ControlCard title="Référencement Google" icon={Search}>
        <TextField label="Titre affiché dans Google" value={form.seoMetaTitle} onChange={(v) => setForm({ ...form, seoMetaTitle: v })} hint={`${titleCount}/60 caractères`} />
        <TextAreaField label="Description affichée dans Google" value={form.seoMetaDescription} onChange={(v) => setForm({ ...form, seoMetaDescription: v })} rows={3} hint={`${descCount}/160 caractères`} />
        <div>
          <label className={labelClass}>Image de partage (Facebook/WhatsApp)</label>
          <MediaPickerField
            value={form.seoOgImageUrl || null}
            onChange={(url) => setForm({ ...form, seoOgImageUrl: url || '' })}
            aspect="wide"
            folder="og"
          />
        </div>
      </ControlCard>
      <AutoSaveBar saving={saving} onSave={() => onSave(form)} />
    </>} right={
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <p className="text-xs text-emerald-700">https://votre-ecole.academiahelm.com</p>
        <p className="text-base text-blue-700 font-medium truncate mt-0.5">{form.seoMetaTitle || 'Titre de votre page'}</p>
        <p className="text-sm text-slate-600 line-clamp-2">{form.seoMetaDescription || 'Description dans Google'}</p>
      </div>
    } />
  );
}

function FooterTab({ config, onSave, saving }: any) {
  const [form, setForm] = useState({
    footerAboutText: config?.footerAboutText || '',
    footerCopyrightText: config?.footerCopyrightText || '',
    footerIsActive: config?.footerIsActive ?? true,
  });
  return (
    <SplitLayout previewTitle="Aperçu du bas de page" left={<>
      <ControlCard title="Bas de page" icon={PanelBottom}>
        <TextAreaField label="Texte 'À propos'" value={form.footerAboutText} onChange={(v) => setForm({ ...form, footerAboutText: v })} rows={3} />
        <TextField label="Copyright" value={form.footerCopyrightText} onChange={(v) => setForm({ ...form, footerCopyrightText: v })} />
        <ToggleField label="Afficher le bas de page" checked={form.footerIsActive} onChange={(v) => setForm({ ...form, footerIsActive: v })} />
      </ControlCard>
      <AutoSaveBar saving={saving} onSave={() => onSave(form)} />
    </>} right={
      <div className="bg-slate-800 text-white rounded-xl p-6">
        <p className="text-sm text-slate-300">{form.footerAboutText || 'Texte à propos…'}</p>
        <p className="text-xs text-slate-400 mt-3">{form.footerCopyrightText || '© 2026'}</p>
      </div>
    } />
  );
}

function SettingsTab({ config, onSave, saving }: any) {
  const [form, setForm] = useState({
    isActive: config?.isActive ?? true,
    aiEnabled: config?.aiEnabled ?? false,
    aiWelcomeMessage: config?.aiWelcomeMessage || '',
  });
  return (
    <div className="space-y-4">
      <ControlCard title="Paramètres du site" icon={Settings}>
        <ToggleField label="Site institutionnel actif" checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} hint="Si désactivé, le site n'est plus visible publiquement." />
      </ControlCard>
      <ControlCard title="Assistant IA" icon={Monitor}>
        <ToggleField label="Activer l'assistant intelligent" checked={form.aiEnabled} onChange={(v) => setForm({ ...form, aiEnabled: v })} hint="Active un assistant IA sur le site public." />
        {form.aiEnabled && <TextAreaField label="Message de bienvenue" value={form.aiWelcomeMessage} onChange={(v) => setForm({ ...form, aiWelcomeMessage: v })} rows={3} />}
      </ControlCard>
      <AutoSaveBar saving={saving} onSave={() => onSave(form)} />
    </div>
  );
}

function ColorsTab({ config, onSave, saving }: any) {
  const [colors, setColors] = useState<any[]>(Array.isArray(config?.customColors) ? config.customColors : []);
  const addColor = () => { if (colors.length >= 4) return; setColors([...colors, { name: `Couleur ${colors.length + 1}`, value: '#1d4fa5' }]); };
  const removeColor = (i: number) => setColors(colors.filter((_, idx) => idx !== i));
  const updateColor = (i: number, field: 'name' | 'value', value: string) => setColors(colors.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  return (
    <SplitLayout previewTitle="Aperçu de la palette" left={<>
      <ControlCard title="Couleurs personnalisées" icon={Palette}>
        <p className="text-xs text-slate-500">Configurez 2 à 4 couleurs. Si vide, la palette Helm par défaut est utilisée.</p>
        {colors.map((color, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
            <input type="color" value={color.value} onChange={(e) => updateColor(i, 'value', e.target.value)} className="w-12 h-12 rounded-lg cursor-pointer border border-slate-200" />
            <input className={inputClass} value={color.name} onChange={(e) => updateColor(i, 'name', e.target.value)} />
            <button onClick={() => removeColor(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {colors.length < 4 && <button onClick={addColor} className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl text-sm font-semibold text-slate-600 hover:text-blue-700 transition flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Ajouter ({colors.length}/4)</button>}
      </ControlCard>
      <AutoSaveBar saving={saving} onSave={() => onSave({ customColors: colors })} />
    </>} right={
      <div className="flex gap-3 flex-wrap">
        {colors.map((c, i) => (<div key={i} className="flex flex-col items-center gap-1"><div className="w-16 h-16 rounded-2xl shadow-sm border-2 border-white" style={{ background: c.value }} /><span className="text-xs text-slate-600">{c.name}</span></div>))}
        {colors.length === 0 && <p className="text-sm text-slate-400">Palette Helm par défaut.</p>}
      </div>
    } />
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: THEMES & COMPONENTS (non modifiés)
// ═══════════════════════════════════════════════════════════════════════

function ThemesTab() {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [currentThemeId, setCurrentThemeId] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<'light' | 'dark' | 'auto'>('auto');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const settings = await tenantThemeService.getSettings();
        setCurrentThemeId(settings.themeId);
        setCurrentMode(settings.mode as 'light' | 'dark' | 'auto');
      } catch (err: any) { setError(err?.message); } finally { setLoading(false); }
    })();
  }, []);

  const handleSelect = async (selection: { themeId: string; mode: 'light' | 'dark' | 'auto' }) => {
    try {
      await tenantThemeService.setSettings(selection);
      setCurrentThemeId(selection.themeId);
      setCurrentMode(selection.mode);
      toast({ variant: 'success', title: 'Thème appliqué' });
    } catch (err: any) { toast({ variant: 'error', title: 'Erreur', description: err?.message }); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0"><Palette className="w-5 h-5" /></div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Thème du site institutionnel</h3>
            <p className="text-sm text-slate-500 mt-0.5">Choisissez un thème parmi 40 designs professionnels.</p>
          </div>
        </div>
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4"><p className="text-sm text-red-700">{error}</p></div>}
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 mb-4">
          <p className="text-sm font-semibold text-slate-700">Thème actuel : <span className="text-blue-700">{currentThemeId || 'Academia Helm (par défaut)'}</span></p>
          <p className="text-xs text-slate-500 mt-1">Mode : {currentMode === 'light' ? 'Clair' : currentMode === 'dark' ? 'Sombre' : 'Auto'}</p>
        </div>
        <button onClick={() => setGalleryOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md transition">
          <Palette className="w-4 h-4" /> Choisir un thème
        </button>
      </div>
      <ThemeGalleryDialog open={galleryOpen} onClose={() => setGalleryOpen(false)} onSelect={handleSelect} currentThemeId={currentThemeId} currentMode={currentMode} />
    </div>
  );
}

function ComponentsTab() {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [currentThemeId, setCurrentThemeId] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<'light' | 'dark' | 'auto'>('auto');

  useEffect(() => {
    (async () => {
      try { const settings = await tenantThemeService.getSettings(); setCurrentThemeId(settings.themeId); setCurrentMode(settings.mode as any); } catch {}
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0"><LayoutTemplate className="w-5 h-5" /></div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Composants du site</h3>
            <p className="text-sm text-slate-500 mt-0.5">Personnalisez navbar, hero, footer, etc. Tous s'adaptent au thème choisi.</p>
          </div>
        </div>
        {!currentThemeId && <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4"><p className="text-sm text-amber-800">Veuillez d'abord choisir un thème dans l'onglet « Thèmes ».</p></div>}
        <button onClick={() => setGalleryOpen(true)} disabled={!currentThemeId} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold shadow-md transition">
          <LayoutTemplate className="w-4 h-4" /> Parcourir les composants
        </button>
      </div>
      <BlockGalleryDialog open={galleryOpen} onClose={() => setGalleryOpen(false)} currentThemeId={currentThemeId} currentMode={currentMode} onSelect={() => { toast({ variant: 'success', title: 'Composant appliqué' }); }} />
    </div>
  );
}
