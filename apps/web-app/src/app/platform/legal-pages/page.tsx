'use client';

/**
 * Legal Pages — CRUD page (Site Public / Academia Helm).
 *
 * Lists legal pages (code badge, title, version, isActive, effectiveDate),
 * supports an inline create/edit modal (code select, title, content textarea,
 * isActive) and a delete confirmation modal.
 */

import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, Loader2, Shield } from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '@/components/platform/PlatformStates';
import {
  ModalShell, DeleteConfirmModal, Field, Toggle, ErrorBanner, SuccessBanner,
  inputClass, monoInputClass, btnPrimary, btnGhost, iconBtnEdit, iconBtnDelete,
} from '@/components/platform/cms/CmsShared';

// === Types ===

interface LegalPage {
  id: string;
  code: string;
  title: string;
  content?: string | null;
  version?: number;
  isActive: boolean;
  effectiveDate?: string | null;
}

interface LegalPagesData {
  pages: LegalPage[];
}

// === Constants ===

const LEGAL_CODES = [
  { value: 'CGU', label: 'CGU' },
  { value: 'CGV', label: 'CGV' },
  { value: 'MENTIONS', label: 'MENTIONS' },
  { value: 'PRIVACY', label: 'PRIVACY' },
] as const;

const CODE_BADGE: Record<string, string> = {
  CGU: 'bg-blue-100 text-blue-700',
  CGV: 'bg-amber-100 text-amber-700',
  MENTIONS: 'bg-emerald-100 text-emerald-700',
  PRIVACY: 'bg-purple-100 text-purple-700',
};

type FormState = { code: string; title: string; content: string; isActive: boolean };
const EMPTY_FORM: FormState = { code: 'CGU', title: '', content: '', isActive: true };

// === Component ===

export default function LegalPagesPage() {
  const { data, loading, error, refetch } = usePlatformData<LegalPagesData>('/legal-pages');

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<LegalPage | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null); setFormSuccess(null);
    setEditingId(null); setModalMode('create');
  };

  const openEdit = (p: LegalPage) => {
    setForm({
      code: p.code ?? 'CGU',
      title: p.title ?? '',
      content: p.content ?? '',
      isActive: !!p.isActive,
    });
    setFormError(null); setFormSuccess(null);
    setEditingId(p.id); setModalMode('edit');
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null); setEditingId(null);
    setFormError(null); setFormSuccess(null);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null); setFormSuccess(null);
    if (!form.code.trim() || !form.title.trim()) {
      setFormError('Code et titre sont requis.');
      return;
    }
    setSubmitting(true);
    try {
      const isEdit = modalMode === 'edit' && editingId;
      const body: Record<string, unknown> = {
        code: form.code,
        title: form.title.trim(),
        content: form.content,
        isActive: form.isActive,
      };
      const url = isEdit ? `/api/platform/legal-pages/${editingId}` : '/api/platform/legal-pages';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || j?.message || `Erreur ${res.status}`);
      }
      setFormSuccess(isEdit ? 'Page légale mise à jour.' : 'Page légale créée.');
      setTimeout(() => {
        setSubmitting(false); setModalMode(null); setEditingId(null);
        setFormError(null); setFormSuccess(null); refetch();
      }, 1500);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de la mutation');
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null); setDeleting(true);
    try {
      const res = await fetch(`/api/platform/legal-pages/${deleteTarget.id}`, {
        method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || j?.message || `Erreur ${res.status}`);
      }
      setDeleting(false); setDeleteTarget(null); setDeleteError(null); refetch();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
      setDeleting(false);
    }
  };

  const pages = data?.pages ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Pages légales</h1>
          <p className="text-slate-500">Gérez les documents légaux du site public</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 rounded-xl text-sm font-semibold text-white shadow-md transition-all">
          <Plus className="w-4 h-4" /> Créer une page
        </button>
      </div>

      {loading ? <PlatformLoading label="Chargement des pages légales…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       pages.length === 0 ? <PlatformEmpty title="Aucune page légale" description="Créez votre première page légale." /> : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Code</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Titre</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Version</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Effective</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pages.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${CODE_BADGE[p.code] ?? 'bg-slate-100 text-slate-700'}`}>
                        {p.code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                          <Shield className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-slate-900">{p.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">v{p.version ?? 1}</td>
                    <td className="px-6 py-4">
                      {p.isActive ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Active</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold uppercase">Inactive</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {p.effectiveDate ? new Date(p.effectiveDate).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(p)} title="Modifier" className={iconBtnEdit}><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => { setDeleteTarget(p); setDeleteError(null); }} title="Supprimer" className={iconBtnDelete}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalMode && (
        <ModalShell
          title={modalMode === 'create' ? 'Créer une page légale' : 'Modifier la page légale'}
          subtitle={modalMode === 'create' ? 'Nouveau document légal' : `ID: ${editingId}`}
          onClose={closeModal} disabled={submitting}
          footer={
            <>
              <button type="button" onClick={closeModal} disabled={submitting} className={btnGhost}>Annuler</button>
              <button type="submit" form="legal-form" disabled={submitting} className={btnPrimary}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {modalMode === 'create' ? 'Créer' : 'Enregistrer'}
              </button>
            </>
          }
        >
          <form id="legal-form" onSubmit={submitForm} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Code" required hint="Le code ne peut pas être modifié après création.">
                <select
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  disabled={modalMode === 'edit'}
                  className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-500`}
                >
                  {LEGAL_CODES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                </select>
              </Field>
              <Field label="Titre" required>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="Conditions Générales d’Utilisation" />
              </Field>
            </div>
            <Field label="Contenu" hint="La modification du contenu incrémente automatiquement la version et re-stampe la date d’effet.">
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={12} className={`${monoInputClass} resize-y`} placeholder="Corps du document légal (Markdown ou HTML)" />
            </Field>
            <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Page active" />
            <ErrorBanner msg={formError} />
            <SuccessBanner msg={formSuccess} />
          </form>
        </ModalShell>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <DeleteConfirmModal
          title="Supprimer la page légale"
          description={<>Confirmez-vous la suppression de la page <span className="font-bold text-slate-900">{deleteTarget.title}</span> (<span className="font-mono text-xs">{deleteTarget.code}</span>) ? Cette action est irréversible.</>}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleting) { setDeleteTarget(null); setDeleteError(null); } }}
          deleting={deleting}
          error={deleteError}
        />
      )}
    </div>
  );
}
