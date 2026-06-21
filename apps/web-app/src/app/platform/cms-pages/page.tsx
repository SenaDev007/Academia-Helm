'use client';

/**
 * CMS Pages — CRUD page (Site Public / Academia Helm).
 *
 * Lists marketing CMS pages, supports search, and provides an inline modal
 * for create/edit (slug, title, content as JSON textarea, seo fields,
 * isActive toggle) + a confirmation modal for delete.
 */

import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Check, Loader2, Search, FileText } from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '@/components/platform/PlatformStates';
import {
  ModalShell, DeleteConfirmModal, Field, Toggle, ErrorBanner, SuccessBanner,
  inputClass, monoInputClass, btnPrimary, btnGhost, iconBtnEdit, iconBtnDelete,
} from '@/components/platform/cms/CmsShared';

// === Types ===

interface CmsPage {
  id: string;
  slug: string;
  title: string;
  content?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  isActive: boolean;
}

interface CmsPagesData {
  pages: CmsPage[];
}

type FormState = {
  slug: string; title: string; content: string;
  seoTitle: string; seoDescription: string; isActive: boolean;
};

const EMPTY_FORM: FormState = {
  slug: '', title: '', content: '',
  seoTitle: '', seoDescription: '', isActive: true,
};

// === Component ===

export default function CmsPagesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const queryPath = useMemo(() => `/cms-pages?search=${encodeURIComponent(searchTerm)}`, [searchTerm]);
  const { data, loading, error, refetch } = usePlatformData<CmsPagesData>(queryPath);

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CmsPage | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null); setFormSuccess(null);
    setEditingId(null); setModalMode('create');
  };

  const openEdit = (p: CmsPage) => {
    let contentStr = '';
    if (p.content) {
      if (typeof p.content === 'string') contentStr = p.content;
      else { try { contentStr = JSON.stringify(p.content, null, 2); } catch { contentStr = String(p.content); } }
    }
    setForm({
      slug: p.slug ?? '', title: p.title ?? '', content: contentStr,
      seoTitle: p.seoTitle ?? '', seoDescription: p.seoDescription ?? '',
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
    if (!form.slug.trim() || !form.title.trim()) {
      setFormError('Slug et titre sont requis.');
      return;
    }
    let contentPayload: unknown = form.content;
    if (form.content.trim()) {
      try { contentPayload = JSON.parse(form.content); } catch { contentPayload = form.content; }
    } else {
      contentPayload = null;
    }
    setSubmitting(true);
    try {
      const isEdit = modalMode === 'edit' && editingId;
      const body: Record<string, unknown> = {
        slug: form.slug.trim(), title: form.title.trim(),
        content: contentPayload,
        seoTitle: form.seoTitle.trim() || null,
        seoDescription: form.seoDescription.trim() || null,
        isActive: form.isActive,
      };
      const url = isEdit ? `/api/platform/cms-pages/${editingId}` : '/api/platform/cms-pages';
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
      setFormSuccess(isEdit ? 'Page mise à jour.' : 'Page créée.');
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
      const res = await fetch(`/api/platform/cms-pages/${deleteTarget.id}`, {
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
          <h1 className="text-2xl font-bold text-blue-900">Pages marketing</h1>
          <p className="text-slate-500">Gérez les pages CMS du site public Academia Helm</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 rounded-xl text-sm font-semibold text-white shadow-md transition-all">
          <Plus className="w-4 h-4" /> Créer une page
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text" value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher par titre ou slug…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
        />
      </div>

      {loading ? <PlatformLoading label="Chargement des pages…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       pages.length === 0 ? <PlatformEmpty title="Aucune page" description="Créez votre première page marketing." /> : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Titre</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Slug</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pages.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-slate-900">{p.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-mono">/{p.slug}</td>
                    <td className="px-6 py-4">
                      {p.isActive ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Active</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold uppercase">Inactive</span>
                      )}
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
          title={modalMode === 'create' ? 'Créer une page' : 'Modifier la page'}
          subtitle={modalMode === 'create' ? 'Nouvelle page marketing' : `ID: ${editingId}`}
          onClose={closeModal} disabled={submitting}
          footer={
            <>
              <button type="button" onClick={closeModal} disabled={submitting} className={btnGhost}>Annuler</button>
              <button type="submit" form="cms-form" disabled={submitting} className={btnPrimary}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {modalMode === 'create' ? 'Créer' : 'Enregistrer'}
              </button>
            </>
          }
        >
          <form id="cms-form" onSubmit={submitForm} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Slug" required>
                <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={monoInputClass} placeholder="a-propos" />
              </Field>
              <Field label="Titre" required>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="À propos" />
              </Field>
            </div>
            <Field label="Contenu (JSON)" hint="Format JSON attendu. Texte brut également accepté.">
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={10} className={`${monoInputClass} resize-y`} placeholder={'{\n  "sections": []\n}'} />
            </Field>
            <Field label="SEO Title">
              <input type="text" value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} className={inputClass} />
            </Field>
            <Field label="SEO Description">
              <textarea value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} rows={2} className={inputClass} />
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
          title="Supprimer la page"
          description={<>Confirmez-vous la suppression de la page <span className="font-bold text-slate-900">{deleteTarget.title}</span> (<span className="font-mono text-xs">/{deleteTarget.slug}</span>) ? Cette action est irréversible.</>}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleting) { setDeleteTarget(null); setDeleteError(null); } }}
          deleting={deleting}
          error={deleteError}
        />
      )}
    </div>
  );
}
