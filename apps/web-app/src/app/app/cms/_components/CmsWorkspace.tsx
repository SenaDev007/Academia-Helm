'use client';

/**
 * ============================================================================
 * CMS WORKSPACE — Site institutionnel (19 sous-onglets)
 * ============================================================================
 *
 * Gestion complète du contenu du site public de l'école.
 * Toutes les données sont stockées via le TenantWebsite API.
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Settings, Image as ImageIcon, LayoutTemplate, BarChart3, MessageSquare,
  FileText, Presentation, School, UserPlus, BookOpen, Calendar, Images,
  Star, HelpCircle, Mail, Share2, Search, PanelBottom, Loader2,
  Save, Plus, Trash2, Edit2, X, Check, AlertCircle, ExternalLink,
  Palette,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { tenantWebsiteService } from '@/services/tenant-website.service';
import { tenantThemeService } from '@/services/tenant-theme.service';
import { ThemeGalleryDialog } from '@/components/cms/ThemeGalleryDialog';
import { BlockGalleryDialog } from '@/components/cms/blocks/BlockGalleryDialog';
import { LayoutTemplate } from 'lucide-react';

type SubTab =
  | 'general' | 'identity' | 'colors' | 'themes' | 'components' | 'hero' | 'figures' | 'promoter' | 'director'
  | 'presentation' | 'levels' | 'admissions' | 'teachers' | 'schoolLife'
  | 'news' | 'agenda' | 'gallery' | 'testimonials' | 'faq'
  | 'contact' | 'social' | 'seo' | 'footer' | 'settings';

const TABS: { id: SubTab; label: string; icon: any }[] = [
  { id: 'general', label: 'Informations générales', icon: Settings },
  { id: 'colors', label: 'Identité visuelle', icon: Palette },
  { id: 'themes', label: 'Thèmes', icon: Palette },
  { id: 'components', label: 'Composants', icon: LayoutTemplate },
  { id: 'hero', label: 'Hero Banner', icon: LayoutTemplate },
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
  { id: 'contact', label: 'Contact', icon: Mail },
  { id: 'social', label: 'Réseaux sociaux', icon: Share2 },
  { id: 'seo', label: 'SEO', icon: Search },
  { id: 'footer', label: 'Footer', icon: PanelBottom },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

export function CmsWorkspace() {
  const [activeTab, setActiveTab] = useState<SubTab>('general');
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
      toast({ variant: 'success', title: 'Configuration enregistrée' });
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
        <span className="ml-2 text-slate-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
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
//  SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

const inputClass = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none';
const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
const sectionClass = 'bg-white rounded-xl border border-slate-200 p-6 shadow-sm';
const btnPrimary = 'inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition';
const btnOutline = 'inline-flex items-center gap-2 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 transition';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function SaveButton({ onSave, saving, label = 'Enregistrer' }: { onSave: () => void; saving: boolean; label?: string }) {
  return (
    <button onClick={onSave} disabled={saving} className={btnPrimary}>
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      {label}
    </button>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB COMPONENTS
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
    <div className="space-y-4">
      <div className={sectionClass}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Informations générales</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Email de contact"><input className={inputClass} value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} placeholder="contact@ecole.com" /></Field>
          <Field label="Téléphone"><input className={inputClass} value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} placeholder="+229 ..." /></Field>
          <Field label="Adresse"><input className={inputClass} value={form.contactAddress} onChange={e => setForm({ ...form, contactAddress: e.target.value })} placeholder="Cotonou, Bénin" /></Field>
          <Field label="Lien Google Maps"><input className={inputClass} value={form.contactMapUrl} onChange={e => setForm({ ...form, contactMapUrl: e.target.value })} placeholder="https://maps.google.com/..." /></Field>
        </div>
        <div className="mt-4"><Toggle checked={form.isActive} onChange={v => setForm({ ...form, isActive: v })} label="Site institutionnel actif" /></div>
      </div>
      <SaveButton onSave={() => onSave(form)} saving={saving} />
    </div>
  );
}

function HeroTab({ config, onSave, saving }: any) {
  const [form, setForm] = useState({
    heroTitle: config?.heroTitle || '',
    heroSubtitle: config?.heroSubtitle || '',
    heroImageUrl: config?.heroImageUrl || '',
    heroCtaText: config?.heroCtaText || 'Pré-inscription',
    heroCtaUrl: config?.heroCtaUrl || '/public/pre-enrollment',
    heroIsActive: config?.heroIsActive ?? true,
  });

  return (
    <div className="space-y-4">
      <div className={sectionClass}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Hero Banner</h3>
        <div className="space-y-4">
          <Field label="Titre principal"><input className={inputClass} value={form.heroTitle} onChange={e => setForm({ ...form, heroTitle: e.target.value })} placeholder="Nom de l'école" /></Field>
          <Field label="Sous-titre / Slogan"><textarea className={inputClass} rows={2} value={form.heroSubtitle} onChange={e => setForm({ ...form, heroSubtitle: e.target.value })} placeholder="Excellence éducative..." /></Field>
          <Field label="URL de l'image de fond"><input className={inputClass} value={form.heroImageUrl} onChange={e => setForm({ ...form, heroImageUrl: e.target.value })} placeholder="https://..." /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Texte du bouton CTA"><input className={inputClass} value={form.heroCtaText} onChange={e => setForm({ ...form, heroCtaText: e.target.value })} /></Field>
            <Field label="Lien du bouton CTA"><input className={inputClass} value={form.heroCtaUrl} onChange={e => setForm({ ...form, heroCtaUrl: e.target.value })} /></Field>
          </div>
          <Toggle checked={form.heroIsActive} onChange={v => setForm({ ...form, heroIsActive: v })} label="Afficher le Hero Banner" />
        </div>
      </div>
      <SaveButton onSave={() => onSave(form)} saving={saving} />
    </div>
  );
}

function FiguresTab({ config, onSave, saving }: any) {
  const [figures, setFigures] = useState<any[]>(
    Array.isArray(config?.keyFigures) ? config.keyFigures : []
  );

  const addFigure = () => setFigures([...figures, { label: '', value: '' }]);
  const removeFigure = (i: number) => setFigures(figures.filter((_, idx) => idx !== i));
  const updateFigure = (i: number, field: string, value: string) =>
    setFigures(figures.map((f, idx) => idx === i ? { ...f, [field]: value } : f));

  return (
    <div className="space-y-4">
      <div className={sectionClass}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Chiffres clés</h3>
          <button onClick={addFigure} className={btnOutline}><Plus className="w-3.5 h-3.5" /> Ajouter</button>
        </div>
        {figures.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Aucun chiffre clé. Cliquez sur "Ajouter" pour en créer.</p>
        ) : (
          <div className="space-y-3">
            {figures.map((fig, i) => (
              <div key={i} className="flex gap-3 items-center">
                <input className={inputClass} placeholder="Valeur (ex: 500)" value={fig.value} onChange={e => updateFigure(i, 'value', e.target.value)} />
                <input className={inputClass} placeholder="Libellé (ex: Élèves)" value={fig.label} onChange={e => updateFigure(i, 'label', e.target.value)} />
                <button onClick={() => removeFigure(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
      <SaveButton onSave={() => onSave({ keyFigures: figures })} saving={saving} />
    </div>
  );
}

function PromoterTab({ config, onSave, saving }: any) {
  const [form, setForm] = useState({
    promoterWord: config?.promoterWord || '',
    promoterName: config?.promoterName || '',
    promoterPhotoUrl: config?.promoterPhotoUrl || '',
    promoterIsActive: config?.promoterIsActive ?? true,
  });

  return (
    <div className="space-y-4">
      <div className={sectionClass}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Mot du Promoteur</h3>
        <div className="space-y-4">
          <Field label="Nom du promoteur"><input className={inputClass} value={form.promoterName} onChange={e => setForm({ ...form, promoterName: e.target.value })} /></Field>
          <Field label="Photo URL"><input className={inputClass} value={form.promoterPhotoUrl} onChange={e => setForm({ ...form, promoterPhotoUrl: e.target.value })} placeholder="https://..." /></Field>
          <Field label="Mot du promoteur"><textarea className={inputClass} rows={6} value={form.promoterWord} onChange={e => setForm({ ...form, promoterWord: e.target.value })} /></Field>
          <Toggle checked={form.promoterIsActive} onChange={v => setForm({ ...form, promoterIsActive: v })} label="Afficher le mot du promoteur" />
        </div>
      </div>
      <SaveButton onSave={() => onSave(form)} saving={saving} />
    </div>
  );
}

function DirectorTab({ config, onSave, saving }: any) {
  const [form, setForm] = useState({
    directorWord: config?.directorWord || '',
    directorName: config?.directorName || '',
    directorPhotoUrl: config?.directorPhotoUrl || '',
    directorIsActive: config?.directorIsActive ?? true,
  });

  return (
    <div className="space-y-4">
      <div className={sectionClass}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Mot du Directeur</h3>
        <div className="space-y-4">
          <Field label="Nom du directeur"><input className={inputClass} value={form.directorName} onChange={e => setForm({ ...form, directorName: e.target.value })} /></Field>
          <Field label="Photo URL"><input className={inputClass} value={form.directorPhotoUrl} onChange={e => setForm({ ...form, directorPhotoUrl: e.target.value })} placeholder="https://..." /></Field>
          <Field label="Mot du directeur"><textarea className={inputClass} rows={6} value={form.directorWord} onChange={e => setForm({ ...form, directorWord: e.target.value })} /></Field>
          <Toggle checked={form.directorIsActive} onChange={v => setForm({ ...form, directorIsActive: v })} label="Afficher le mot du directeur" />
        </div>
      </div>
      <SaveButton onSave={() => onSave(form)} saving={saving} />
    </div>
  );
}

function PresentationTab({ config, onSave, saving }: any) {
  const [form, setForm] = useState({
    presentationTitle: config?.presentationTitle || '',
    presentationContent: config?.presentationContent || '',
    presentationImageUrl: config?.presentationImageUrl || '',
    presentationIsActive: config?.presentationIsActive ?? true,
  });

  return (
    <div className="space-y-4">
      <div className={sectionClass}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Présentation</h3>
        <div className="space-y-4">
          <Field label="Titre"><input className={inputClass} value={form.presentationTitle} onChange={e => setForm({ ...form, presentationTitle: e.target.value })} placeholder="Présentation de l'établissement" /></Field>
          <Field label="Image URL"><input className={inputClass} value={form.presentationImageUrl} onChange={e => setForm({ ...form, presentationImageUrl: e.target.value })} placeholder="https://..." /></Field>
          <Field label="Contenu"><textarea className={inputClass} rows={10} value={form.presentationContent} onChange={e => setForm({ ...form, presentationContent: e.target.value })} /></Field>
          <Toggle checked={form.presentationIsActive} onChange={v => setForm({ ...form, presentationIsActive: v })} label="Afficher la section présentation" />
        </div>
      </div>
      <SaveButton onSave={() => onSave(form)} saving={saving} />
    </div>
  );
}

function AdmissionsTab({ config, onSave, saving }: any) {
  const [form, setForm] = useState({
    admissionsTitle: config?.admissionsTitle || '',
    admissionsContent: config?.admissionsContent || '',
    admissionsIsActive: config?.admissionsIsActive ?? true,
  });

  return (
    <div className="space-y-4">
      <div className={sectionClass}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Admissions</h3>
        <Field label="Titre"><input className={inputClass} value={form.admissionsTitle} onChange={e => setForm({ ...form, admissionsTitle: e.target.value })} placeholder="Processus d'admission" /></Field>
        <Field label="Contenu"><textarea className={inputClass} rows={10} value={form.admissionsContent} onChange={e => setForm({ ...form, admissionsContent: e.target.value })} /></Field>
        <div className="mt-4"><Toggle checked={form.admissionsIsActive} onChange={v => setForm({ ...form, admissionsIsActive: v })} label="Afficher la section admissions" /></div>
      </div>
      <SaveButton onSave={() => onSave(form)} saving={saving} />
    </div>
  );
}

function SchoolLifeTab({ config, onSave, saving }: any) {
  const [form, setForm] = useState({
    schoolLifeTitle: config?.schoolLifeTitle || '',
    schoolLifeContent: config?.schoolLifeContent || '',
    schoolLifeIsActive: config?.schoolLifeIsActive ?? true,
  });

  return (
    <div className="space-y-4">
      <div className={sectionClass}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Vie scolaire</h3>
        <Field label="Titre"><input className={inputClass} value={form.schoolLifeTitle} onChange={e => setForm({ ...form, schoolLifeTitle: e.target.value })} placeholder="Vie scolaire" /></Field>
        <Field label="Contenu"><textarea className={inputClass} rows={10} value={form.schoolLifeContent} onChange={e => setForm({ ...form, schoolLifeContent: e.target.value })} /></Field>
        <div className="mt-4"><Toggle checked={form.schoolLifeIsActive} onChange={v => setForm({ ...form, schoolLifeIsActive: v })} label="Afficher la section vie scolaire" /></div>
      </div>
      <SaveButton onSave={() => onSave(form)} saving={saving} />
    </div>
  );
}

// ═══ CRUD TABS (News, Events, Gallery, Testimonials, FAQ, Contact) ═══

// Mapping explicite entity → nom des méthodes du service tenantWebsiteService.
// Évite la construction dynamique `service['get'+entity]` qui cassait pour
// Event/GalleryItem/Testimonial/FaqItem (singulier vs pluriel).
const ENTITY_METHOD_MAP: Record<string, { get: string; create: string; update: string; delete: string }> = {
  News:        { get: 'getNews',         create: 'createNews',         update: 'updateNews',         delete: 'deleteNews' },
  Event:       { get: 'getEvents',       create: 'createEvent',        update: 'updateEvent',        delete: 'deleteEvent' },
  GalleryItem: { get: 'getGallery',      create: 'createGalleryItem',  update: 'updateGalleryItem',  delete: 'deleteGalleryItem' },
  Testimonial: { get: 'getTestimonials', create: 'createTestimonial',  update: 'updateTestimonial',  delete: 'deleteTestimonial' },
  FaqItem:     { get: 'getFaq',          create: 'createFaqItem',      update: 'updateFaqItem',      delete: 'deleteFaqItem' },
};

function CrudTab({ entity, fields, service }: { entity: string; fields: any[]; service: any }) {
  const methods = ENTITY_METHOD_MAP[entity];
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    if (!methods) {
      console.error(`CrudTab: no method mapping for entity "${entity}"`);
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await service[methods.get]();
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error(`CrudTab load error (${entity}):`, err?.message);
      setItems([]);
    } finally { setLoading(false); }
  }, [service, entity, methods]);

  useEffect(() => { load(); }, [load]);

  const startCreate = () => {
    const empty: any = {};
    fields.forEach(f => empty[f.key] = f.type === 'boolean' ? true : f.type === 'number' ? 0 : '');
    setForm(empty); setEditing('new');
  };

  const startEdit = (item: any) => { setForm({ ...item }); setEditing(item.id); };

  const handleSave = async () => {
    if (!methods) return;
    try {
      if (editing === 'new') {
        await service[methods.create](form);
      } else {
        await service[methods.update](editing, form);
      }
      toast({ variant: 'success', title: 'Enregistré' });
      setEditing(null); setForm({});
      load();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err?.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!methods) return;
    if (!confirm('Supprimer cet élément ?')) return;
    try {
      await service[methods.delete](id);
      toast({ variant: 'success', title: 'Supprimé' });
      load();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err?.message });
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">{entity}s ({items.length})</h3>
        <button onClick={startCreate} className={btnPrimary}><Plus className="w-4 h-4" /> Ajouter</button>
      </div>

      {editing && (
        <div className={`${sectionClass} border-blue-200`}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-slate-900">{editing === 'new' ? 'Nouveau' : 'Modifier'}</h4>
            <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {fields.map(f => (
              <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
                <Field label={f.label}>
                  {f.type === 'textarea' ? (
                    <textarea className={inputClass} rows={4} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                  ) : f.type === 'boolean' ? (
                    <Toggle checked={!!form[f.key]} onChange={v => setForm({ ...form, [f.key]: v })} label={f.label} />
                  ) : (
                    <input type={f.type === 'number' ? 'number' : 'text'} className={inputClass} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })} />
                  )}
                </Field>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} className={btnPrimary}><Save className="w-4 h-4" /> Enregistrer</button>
            <button onClick={() => setEditing(null)} className={btnOutline}>Annuler</button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className={`${sectionClass} text-center py-12`}>
          <p className="text-sm text-slate-400">Aucun élément pour le moment.</p>
        </div>
      ) : (
        <div className={`${sectionClass} p-0 overflow-hidden`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-bold text-slate-500 uppercase">
                {fields.slice(0, 4).map(f => <th key={f.key} className="px-4 py-3">{f.label}</th>)}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  {fields.slice(0, 4).map(f => (
                    <td key={f.key} className="px-4 py-3 text-slate-700">
                      {f.type === 'boolean' ? (item[f.key] ? '✓' : '—') : (item[f.key] || '—')}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => startEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded ml-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewsTab() {
  return <CrudTab entity="News" service={tenantWebsiteService} fields={[
    { key: 'title', label: 'Titre', type: 'text' },
    { key: 'slug', label: 'Slug', type: 'text' },
    { key: 'excerpt', label: 'Extrait', type: 'text' },
    { key: 'content', label: 'Contenu', type: 'textarea' },
    { key: 'coverImageUrl', label: 'Image URL', type: 'text' },
    { key: 'category', label: 'Catégorie', type: 'text' },
    { key: 'status', label: 'Statut (DRAFT/PUBLISHED)', type: 'text' },
    { key: 'isFeatured', label: 'À la une', type: 'boolean' },
  ]} />;
}

function AgendaTab() {
  return <CrudTab entity="Event" service={tenantWebsiteService} fields={[
    { key: 'title', label: 'Titre', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'startDate', label: 'Date début', type: 'text' },
    { key: 'endDate', label: 'Date fin', type: 'text' },
    { key: 'location', label: 'Lieu', type: 'text' },
    { key: 'category', label: 'Catégorie', type: 'text' },
    { key: 'isFeatured', label: 'À la une', type: 'boolean' },
  ]} />;
}

function GalleryTab() {
  return <CrudTab entity="GalleryItem" service={tenantWebsiteService} fields={[
    { key: 'imageUrl', label: 'Image URL', type: 'text' },
    { key: 'caption', label: 'Légende', type: 'text' },
    { key: 'category', label: 'Catégorie', type: 'text' },
    { key: 'displayOrder', label: 'Ordre', type: 'number' },
    { key: 'isActive', label: 'Actif', type: 'boolean' },
  ]} />;
}

function TestimonialsTab() {
  return <CrudTab entity="Testimonial" service={tenantWebsiteService} fields={[
    { key: 'authorName', label: 'Nom', type: 'text' },
    { key: 'authorRole', label: 'Rôle', type: 'text' },
    { key: 'content', label: 'Témoignage', type: 'textarea' },
    { key: 'rating', label: 'Note (1-5)', type: 'number' },
    { key: 'isFeatured', label: 'À la une', type: 'boolean' },
    { key: 'isActive', label: 'Actif', type: 'boolean' },
  ]} />;
}

function FaqTab() {
  return <CrudTab entity="FaqItem" service={tenantWebsiteService} fields={[
    { key: 'question', label: 'Question', type: 'text' },
    { key: 'answer', label: 'Réponse', type: 'textarea' },
    { key: 'category', label: 'Catégorie', type: 'text' },
    { key: 'displayOrder', label: 'Ordre', type: 'number' },
    { key: 'isActive', label: 'Actif', type: 'boolean' },
  ]} />;
}

function ContactTab() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await tenantWebsiteService.getContactMessages();
      setMessages(Array.isArray(data) ? data : []);
    } catch { setMessages([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatus = async (id: string, status: string) => {
    try { await tenantWebsiteService.updateContactStatus(id, status); load(); } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce message ?')) return;
    try { await tenantWebsiteService.deleteContactMessage(id); load(); } catch {}
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900">Messages de contact ({messages.length})</h3>
      {messages.length === 0 ? (
        <div className={`${sectionClass} text-center py-12`}><p className="text-sm text-slate-400">Aucun message pour le moment.</p></div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`${sectionClass}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-bold text-slate-900">{msg.name} <span className="text-xs text-slate-400 font-normal">— {msg.email}</span></p>
                  {msg.subject && <p className="text-sm text-slate-600 mt-0.5">{msg.subject}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <select value={msg.status} onChange={e => handleStatus(msg.id, e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1">
                    <option value="NEW">Nouveau</option>
                    <option value="READ">Lu</option>
                    <option value="REPLIED">Répondu</option>
                    <option value="ARCHIVED">Archivé</option>
                  </select>
                  <button onClick={() => handleDelete(msg.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <p className="text-sm text-slate-700 mt-2">{msg.message}</p>
              <p className="text-xs text-slate-400 mt-2">{new Date(msg.createdAt).toLocaleString('fr-FR')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SocialTab({ config, onSave, saving }: any) {
  const [social, setSocial] = useState<any>(config?.socialLinks || {});

  const platforms = ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'whatsapp', 'telegram'];

  return (
    <div className="space-y-4">
      <div className={sectionClass}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Réseaux sociaux</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {platforms.map(p => (
            <Field key={p} label={p.charAt(0).toUpperCase() + p.slice(1)}>
              <input className={inputClass} value={social[p] || ''} onChange={e => setSocial({ ...social, [p]: e.target.value })} placeholder={`https://${p}.com/...`} />
            </Field>
          ))}
        </div>
      </div>
      <SaveButton onSave={() => onSave({ socialLinks: social })} saving={saving} />
    </div>
  );
}

function SeoTab({ config, onSave, saving }: any) {
  const [form, setForm] = useState({
    seoMetaTitle: config?.seoMetaTitle || '',
    seoMetaDescription: config?.seoMetaDescription || '',
    seoKeywords: config?.seoKeywords || '',
    seoOgImageUrl: config?.seoOgImageUrl || '',
  });

  return (
    <div className="space-y-4">
      <div className={sectionClass}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">SEO</h3>
        <div className="space-y-4">
          <Field label="Titre SEO"><input className={inputClass} value={form.seoMetaTitle} onChange={e => setForm({ ...form, seoMetaTitle: e.target.value })} /></Field>
          <Field label="Description SEO"><textarea className={inputClass} rows={3} value={form.seoMetaDescription} onChange={e => setForm({ ...form, seoMetaDescription: e.target.value })} /></Field>
          <Field label="Mots-clés"><input className={inputClass} value={form.seoKeywords} onChange={e => setForm({ ...form, seoKeywords: e.target.value })} placeholder="école, bénin, primaire..." /></Field>
          <Field label="Open Graph Image URL"><input className={inputClass} value={form.seoOgImageUrl} onChange={e => setForm({ ...form, seoOgImageUrl: e.target.value })} /></Field>
        </div>
      </div>
      <SaveButton onSave={() => onSave(form)} saving={saving} />
    </div>
  );
}

function FooterTab({ config, onSave, saving }: any) {
  const [form, setForm] = useState({
    footerAboutText: config?.footerAboutText || '',
    footerCopyrightText: config?.footerCopyrightText || '',
    footerIsActive: config?.footerIsActive ?? true,
  });

  return (
    <div className="space-y-4">
      <div className={sectionClass}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Footer</h3>
        <Field label="Texte 'À propos' (footer)"><textarea className={inputClass} rows={3} value={form.footerAboutText} onChange={e => setForm({ ...form, footerAboutText: e.target.value })} /></Field>
        <Field label="Texte copyright"><input className={inputClass} value={form.footerCopyrightText} onChange={e => setForm({ ...form, footerCopyrightText: e.target.value })} placeholder="© 2026 Mon École. Tous droits réservés." /></Field>
        <div className="mt-4"><Toggle checked={form.footerIsActive} onChange={v => setForm({ ...form, footerIsActive: v })} label="Afficher le footer" /></div>
      </div>
      <SaveButton onSave={() => onSave(form)} saving={saving} />
    </div>
  );
}

function SettingsTab({ config, onSave, saving }: any) {
  const [form, setForm] = useState({
    aiEnabled: config?.aiEnabled ?? false,
    aiWelcomeMessage: config?.aiWelcomeMessage || '',
    isActive: config?.isActive ?? true,
  });

  return (
    <div className="space-y-4">
      <div className={sectionClass}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Paramètres</h3>
        <div className="space-y-4">
          <Toggle checked={form.isActive} onChange={v => setForm({ ...form, isActive: v })} label="Site institutionnel actif" />
          <Toggle checked={form.aiEnabled} onChange={v => setForm({ ...form, aiEnabled: v })} label="Activer l'assistant IA sur le site public" />
          {form.aiEnabled && (
            <Field label="Message de bienvenue de l'IA"><textarea className={inputClass} rows={3} value={form.aiWelcomeMessage} onChange={e => setForm({ ...form, aiWelcomeMessage: e.target.value })} placeholder="Bonjour ! Comment puis-je vous aider ?" /></Field>
          )}
        </div>
      </div>
      <SaveButton onSave={() => onSave(form)} saving={saving} />
    </div>
  );
}

function ColorsTab({ config, onSave, saving }: any) {
  const [colors, setColors] = useState<any[]>(
    Array.isArray(config?.customColors) ? config.customColors : []
  );

  const addColor = () => {
    if (colors.length >= 4) return;
    setColors([...colors, { name: `Couleur ${colors.length + 1}`, value: '#0b2f73' }]);
  };

  const removeColor = (i: number) => setColors(colors.filter((_, idx) => idx !== i));

  const updateColor = (i: number, field: 'name' | 'value', value: string) =>
    setColors(colors.map((c, idx) => idx === i ? { ...c, [field]: value } : c));

  return (
    <div className="space-y-4">
      <div className={sectionClass}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Identité visuelle</h3>
            <p className="text-sm text-slate-500 mt-1">
              Personnalisez la palette de couleurs de votre site institutionnel. Configurez 2 à 4 couleurs.
              Si aucune couleur n'est configurée, la palette Academia Helm est utilisée par défaut.
            </p>
          </div>
          <button onClick={addColor} disabled={colors.length >= 4} className={btnOutline}>
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>

        {/* Aperçu de la palette */}
        {colors.length > 0 && (
          <div className="flex gap-3 mb-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
            {colors.map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-xl shadow-sm border-2 border-white" style={{ background: c.value }} />
                <span className="text-[10px] text-slate-500 font-medium">{c.name}</span>
              </div>
            ))}
          </div>
        )}

        {colors.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Palette className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Aucune couleur personnalisée. La palette Academia Helm est utilisée.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {colors.map((color, i) => (
              <div key={i} className="flex gap-3 items-center p-3 rounded-xl border border-slate-100">
                <input type="color" value={color.value} onChange={(e) => updateColor(i, 'value', e.target.value)} className="w-12 h-12 rounded-lg cursor-pointer border border-slate-200" />
                <input className={inputClass} placeholder="Nom (ex: Primaire)" value={color.name} onChange={(e) => updateColor(i, 'name', e.target.value)} />
                <input className={`${inputClass} font-mono max-w-[120px]`} placeholder="#000000" value={color.value} onChange={(e) => updateColor(i, 'value', e.target.value)} />
                <button onClick={() => removeColor(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>Rôles :</strong> Couleur 1 = principale (header/hero) · Couleur 2 = accent (boutons) · Couleur 3 = secondaire (gradients) · Couleur 4 = sombre (footer)
          </p>
        </div>
      </div>
      <SaveButton onSave={() => onSave({ customColors: colors })} saving={saving} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: THEMES — Galerie de 40 thèmes 21st.dev + mode dark/light/auto
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
      } catch (err: any) {
        setError(err?.message || 'Erreur lors du chargement du thème');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSelect = async (selection: { themeId: string; mode: 'light' | 'dark' | 'auto' }) => {
    try {
      await tenantThemeService.setSettings(selection);
      setCurrentThemeId(selection.themeId);
      setCurrentMode(selection.mode);
      toast({ variant: 'success', title: 'Thème appliqué', description: 'Votre site institutionnel a été mis à jour.' });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err?.message });
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
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Thème du site institutionnel</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Choisissez un thème parmi 40 designs professionnels. Votre site s'adapte automatiquement.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-sm font-semibold text-slate-700">
            Thème actuel :{' '}
            <span className="text-blue-700">
              {currentThemeId ? currentThemeId : 'Academia Helm (par défaut)'}
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Mode : {currentMode === 'light' ? 'Clair' : currentMode === 'dark' ? 'Sombre' : 'Auto'}
          </p>
        </div>

        <button
          onClick={() => setGalleryOpen(true)}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md transition"
        >
          <Palette className="w-4 h-4" />
          Choisir un thème
        </button>
      </div>

      <ThemeGalleryDialog
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={handleSelect}
        currentThemeId={currentThemeId}
        currentMode={currentMode}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: COMPONENTS — Galerie de composants (navbar, hero, footer, etc.)
// ═══════════════════════════════════════════════════════════════════════

function ComponentsTab() {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [currentThemeId, setCurrentThemeId] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<'light' | 'dark' | 'auto'>('auto');

  useEffect(() => {
    (async () => {
      try {
        const settings = await tenantThemeService.getSettings();
        setCurrentThemeId(settings.themeId);
        setCurrentMode(settings.mode as 'light' | 'dark' | 'auto');
      } catch {
        // Silencieux
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <LayoutTemplate className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Composants du site</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Personnalisez les éléments de votre site (navbar, hero, footer, bordures, témoignages, etc.).
              Tous les composants s'adaptent automatiquement au thème choisi.
            </p>
          </div>
        </div>

        {!currentThemeId && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              Veuillez d'abord choisir un thème dans l'onglet « Thèmes » avant de personnaliser les composants.
            </p>
          </div>
        )}

        <button
          onClick={() => setGalleryOpen(true)}
          disabled={!currentThemeId}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold shadow-md transition"
        >
          <LayoutTemplate className="w-4 h-4" />
          Parcourir les composants
        </button>
      </div>

      <BlockGalleryDialog
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        currentThemeId={currentThemeId}
        currentMode={currentMode}
        onSelect={() => {
          toast({ variant: 'success', title: 'Composant appliqué' });
        }}
      />
    </div>
  );
}
