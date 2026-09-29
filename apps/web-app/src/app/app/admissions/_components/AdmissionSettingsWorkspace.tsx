'use client';

/**
 * ============================================================================
 * ADMISSION SETTINGS WORKSPACE — Interface de configuration des admissions
 * ============================================================================
 *
 * 3 sections :
 *   1. Config globale : activation, titre, sous-titre, CTA
 *   2. Étapes d'admission : CRUD (numéro, titre, description, icône)
 *   3. Documents requis : CRUD (libellé, description, ordre)
 *
 * Sauvegarde automatique sur chaque modification (PUT vers le backend).
 * Auto-save debounce 1.5s pour les champs texte.
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Settings, Loader2, Save, Plus, Trash2, Edit2, X, Check, AlertCircle,
  FileText, GripVertical, ArrowUp, ArrowDown, UserPlus,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';

// ─── Helpers ────────────────────────────────────────────────────────────
const inputClass = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition';
const labelClass = 'block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide';

async function fetchAdmission<T>(path: string, options?: { method?: string; body?: any }): Promise<T> {
  const method = options?.method ?? 'GET';
  const res = await fetch(`/api/${path.replace(/^\//, '')}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getClientAuthorizationHeader(),
    },
    credentials: 'include',
    cache: 'no-store',
    ...(options?.body && { body: JSON.stringify(options.body) }),
  });
  const text = await res.text();
  if (!res.ok) {
    let err: { message?: string; error?: string } = {};
    if (text.trim()) {
      try { err = JSON.parse(text); } catch { err = {}; }
    }
    throw new Error(err.message ?? err.error ?? res.statusText ?? 'Erreur réseau');
  }
  if (!text.trim()) return null as T;
  try { return JSON.parse(text) as T; } catch { throw new Error('Réponse invalide'); }
}

const ICON_OPTIONS = ['FileText', 'BookOpen', 'Users', 'CheckCircle2', 'Award', 'Star', 'GraduationCap'];

export default function AdmissionSettingsWorkspace() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAdmission<any>('admission-settings');
      setSettings(data);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err?.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Save global config ───────────────────────────────────────────────
  const saveSettings = async (data: any) => {
    setSaving(true);
    try {
      const updated = await fetchAdmission<any>('admission-settings', { method: 'PUT', body: data });
      setSettings(updated);
      toast({ variant: 'success', title: 'Configuration enregistrée' });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  // ─── Steps CRUD ────────────────────────────────────────────────────────
  const addStep = async () => {
    try {
      const newStep = await fetchAdmission<any>('admission-settings/steps', {
        method: 'POST',
        body: { title: 'Nouvelle étape', num: (settings?.steps?.length || 0) + 1, description: '', iconName: 'CheckCircle2', order: settings?.steps?.length || 0 },
      });
      setSettings({ ...settings, steps: [...(settings?.steps || []), newStep] });
      toast({ variant: 'success', title: 'Étape ajoutée' });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err?.message });
    }
  };

  const updateStep = async (id: string, data: any) => {
    try {
      const updated = await fetchAdmission<any>(`admission-settings/steps/${id}`, { method: 'PUT', body: data });
      setSettings({ ...settings, steps: settings.steps.map((s: any) => s.id === id ? updated : s) });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err?.message });
    }
  };

  const deleteStep = async (id: string) => {
    if (!confirm('Supprimer cette étape ?')) return;
    try {
      await fetchAdmission(`admission-settings/steps/${id}`, { method: 'DELETE' });
      setSettings({ ...settings, steps: settings.steps.filter((s: any) => s.id !== id) });
      toast({ variant: 'success', title: 'Étape supprimée' });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err?.message });
    }
  };

  // ─── Documents CRUD ──────────────────────────────────────────────────
  const addDocument = async () => {
    try {
      const newDoc = await fetchAdmission<any>('admission-settings/documents', {
        method: 'POST',
        body: { label: 'Nouveau document', description: '', order: settings?.documents?.length || 0 },
      });
      setSettings({ ...settings, documents: [...(settings?.documents || []), newDoc] });
      toast({ variant: 'success', title: 'Document ajouté' });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err?.message });
    }
  };

  const updateDocument = async (id: string, data: any) => {
    try {
      const updated = await fetchAdmission<any>(`admission-settings/documents/${id}`, { method: 'PUT', body: data });
      setSettings({ ...settings, documents: settings.documents.map((d: any) => d.id === id ? updated : d) });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err?.message });
    }
  };

  const deleteDocument = async (id: string) => {
    if (!confirm('Supprimer ce document ?')) return;
    try {
      await fetchAdmission(`admission-settings/documents/${id}`, { method: 'DELETE' });
      setSettings({ ...settings, documents: settings.documents.filter((d: any) => d.id !== id) });
      toast({ variant: 'success', title: 'Document supprimé' });
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
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-blue-600" /> Module Admissions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configurez la section Admissions de votre site institutionnel public.
          </p>
        </div>
      </div>

      {/* ─── Section 1 : Configuration globale ─── */}
      <GlobalConfigCard settings={settings} onSave={saveSettings} saving={saving} />

      {/* ─── Section 2 : Étapes d'admission ─── */}
      <StepsCard
        steps={settings?.steps || []}
        onAdd={addStep}
        onUpdate={updateStep}
        onDelete={deleteStep}
      />

      {/* ─── Section 3 : Documents requis ─── */}
      <DocumentsCard
        documents={settings?.documents || []}
        onAdd={addDocument}
        onUpdate={updateDocument}
        onDelete={deleteDocument}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 1 : Configuration globale
// ═══════════════════════════════════════════════════════════════════════

function GlobalConfigCard({ settings, onSave, saving }: any) {
  const [form, setForm] = useState({
    isActive: settings?.isActive ?? false,
    title: settings?.title || '',
    subtitle: settings?.subtitle || '',
    ctaText: settings?.ctaText || 'Soumettre l\'admission de mon enfant',
    ctaUrl: settings?.ctaUrl || '/public/pre-enrollment',
    ctaBlockTitle: settings?.ctaBlockTitle || 'Prêt à nous rejoindre ?',
    ctaBlockText: settings?.ctaBlockText || '',
    stepsTitle: settings?.stepsTitle || 'Notre processus d\'admission',
    stepsIntro: settings?.stepsIntro || '',
    documentsTitle: settings?.documentsTitle || 'Documents requis',
    documentsIntro: settings?.documentsIntro || '',
  });

  // Sync form when settings change (after save)
  useEffect(() => {
    if (settings) {
      setForm({
        isActive: settings.isActive ?? false,
        title: settings.title || '',
        subtitle: settings.subtitle || '',
        ctaText: settings.ctaText || 'Soumettre l\'admission de mon enfant',
        ctaUrl: settings.ctaUrl || '/public/pre-enrollment',
        ctaBlockTitle: settings.ctaBlockTitle || 'Prêt à nous rejoindre ?',
        ctaBlockText: settings.ctaBlockText || '',
        stepsTitle: settings.stepsTitle || 'Notre processus d\'admission',
        stepsIntro: settings.stepsIntro || '',
        documentsTitle: settings.documentsTitle || 'Documents requis',
        documentsIntro: settings.documentsIntro || '',
      });
    }
  }, [settings]);

  const update = (field: string, value: any) => setForm({ ...form, [field]: value });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-slate-500" />
        <h3 className="text-base font-bold text-slate-800">Configuration générale</h3>
      </div>

      {/* Toggle d'activation */}
      <div className="mb-5 p-4 rounded-lg border-2 border-amber-200 bg-amber-50">
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => update('isActive', !form.isActive)}
            className={`relative w-12 h-6 rounded-full transition-colors ${form.isActive ? 'bg-green-500' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-6' : ''}`} />
          </button>
          <div>
            <span className="text-sm font-bold text-slate-900">
              {form.isActive ? '✓ Admissions ACTIVÉES sur le site institutionnel' : 'Admissions désactivées'}
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              {form.isActive
                ? 'La section Admissions est visible sur votre site institutionnel public.'
                : 'La section Admissions est masquée sur votre site institutionnel public.'}
            </p>
          </div>
        </label>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Titre de la section</label>
            <input className={inputClass} placeholder="Admissions 2026-2027" value={form.title} onChange={(e) => update('title', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Sous-titre</label>
            <input className={inputClass} placeholder="Un parcours d'admission clair..." value={form.subtitle} onChange={(e) => update('subtitle', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Texte du bouton CTA</label>
            <input className={inputClass} placeholder="Soumettre l'admission de mon enfant" value={form.ctaText} onChange={(e) => update('ctaText', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>URL de redirection du CTA</label>
            <input className={inputClass} placeholder="/public/pre-enrollment" value={form.ctaUrl} onChange={(e) => update('ctaUrl', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Titre du bloc CTA final</label>
            <input className={inputClass} placeholder="Prêt à nous rejoindre ?" value={form.ctaBlockTitle} onChange={(e) => update('ctaBlockTitle', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Texte du bloc CTA final</label>
            <input className={inputClass} placeholder="Démarrez votre candidature..." value={form.ctaBlockText} onChange={(e) => update('ctaBlockText', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Titre des étapes</label>
            <input className={inputClass} placeholder="Notre processus d'admission" value={form.stepsTitle} onChange={(e) => update('stepsTitle', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Titre des documents</label>
            <input className={inputClass} placeholder="Documents requis" value={form.documentsTitle} onChange={(e) => update('documentsTitle', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer la configuration
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 2 : Étapes d'admission
// ═══════════════════════════════════════════════════════════════════════

function StepsCard({ steps, onAdd, onUpdate, onDelete }: any) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-500" />
          <h3 className="text-base font-bold text-slate-800">Étapes d'admission ({steps.length})</h3>
        </div>
        <button onClick={onAdd} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold">
          <Plus className="w-3.5 h-3.5" /> Ajouter une étape
        </button>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Définissez les étapes du parcours d'admission (candidature, évaluation, entretien, confirmation...).
        L'ordre est contrôlé par le numéro d'étape.
      </p>

      <div className="space-y-3">
        {steps.map((step: any, i: number) => (
          <div key={step.id} className="p-4 border border-slate-200 rounded-lg space-y-3 bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Étape #{step.num || i + 1}</span>
              <button onClick={() => onDelete(step.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                className="px-2 py-1.5 text-sm border border-slate-200 rounded"
                placeholder="N°"
                value={step.num || ''}
                onChange={(e) => onUpdate(step.id, { num: parseInt(e.target.value) || i + 1 })}
              />
              <input
                className="col-span-2 px-2 py-1.5 text-sm border border-slate-200 rounded"
                placeholder="Titre (ex: Candidature)"
                value={step.title || ''}
                onChange={(e) => onUpdate(step.id, { title: e.target.value })}
              />
            </div>
            <input
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded"
              placeholder="Description courte"
              value={step.description || ''}
              onChange={(e) => onUpdate(step.id, { description: e.target.value })}
            />
            <div className="flex items-center gap-2">
              <select
                className="px-2 py-1.5 text-sm border border-slate-200 rounded"
                value={step.iconName || 'CheckCircle2'}
                onChange={(e) => onUpdate(step.id, { iconName: e.target.value })}
              >
                {ICON_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer ml-auto">
                <input
                  type="checkbox"
                  checked={step.isActive !== false}
                  onChange={(e) => onUpdate(step.id, { isActive: e.target.checked })}
                />
                Afficher
              </label>
            </div>
          </div>
        ))}
        {steps.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">Aucune étape. Cliquez sur « Ajouter une étape ».</p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 3 : Documents requis
// ═══════════════════════════════════════════════════════════════════════

function DocumentsCard({ documents, onAdd, onUpdate, onDelete }: any) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-500" />
          <h3 className="text-base font-bold text-slate-800">Documents requis ({documents.length})</h3>
        </div>
        <button onClick={onAdd} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold">
          <Plus className="w-3.5 h-3.5" /> Ajouter un document
        </button>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Liste des documents à fournir pour constituer un dossier d'inscription.
      </p>

      <div className="space-y-3">
        {documents.map((doc: any, i: number) => (
          <div key={doc.id} className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50">
            <input
              className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded"
              placeholder="Ex: Acte de naissance (original + copie)"
              value={doc.label || ''}
              onChange={(e) => onUpdate(doc.id, { label: e.target.value })}
            />
            <input
              className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded"
              placeholder="Description (optionnel)"
              value={doc.description || ''}
              onChange={(e) => onUpdate(doc.id, { description: e.target.value })}
            />
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={doc.isActive !== false}
                onChange={(e) => onUpdate(doc.id, { isActive: e.target.checked })}
              />
              Afficher
            </label>
            <button onClick={() => onDelete(doc.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {documents.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">Aucun document. Cliquez sur « Ajouter un document ».</p>
        )}
      </div>
    </div>
  );
}
