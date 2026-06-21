'use client';

/**
 * SEO Meta — CRUD page (Site Public / Academia Helm).
 *
 * Lists SEO meta entries (pagePath, title, noIndex badge, actions), supports
 * search, and provides an inline create/edit modal (pagePath, title,
 * description, ogTitle, ogDescription, ogImageUrl, keywords, canonicalUrl,
 * noIndex toggle) + a delete confirmation modal.
 */

import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Check, Loader2, Search, Globe } from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '@/components/platform/PlatformStates';
import {
  ModalShell, DeleteConfirmModal, Field, Toggle, ErrorBanner, SuccessBanner,
  inputClass, monoInputClass, btnPrimary, btnGhost, iconBtnEdit, iconBtnDelete,
} from '@/components/platform/cms/CmsShared';

// === Types ===

interface SeoMeta {
  id: string;
  pagePath: string;
  title?: string | null;
  description?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageUrl?: string | null;
  keywords?: string[] | string | null;
  canonicalUrl?: string | null;
  noIndex: boolean;
}

interface SeoData {
  metas: SeoMeta[];
}

type FormState = {
  pagePath: string; title: string; description: string;
  ogTitle: string; ogDescription: string; ogImageUrl: string;
  keywords: string; canonicalUrl: string; noIndex: boolean;
};

const EMPTY_FORM: FormState = {
  pagePath: '', title: '', description: '',
  ogTitle: '', ogDescription: '', ogImageUrl: '',
  keywords: '', canonicalUrl: '', noIndex: false,
};

// === Component ===

export default function SeoPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const queryPath = useMemo(() => `/seo?search=${encodeURIComponent(searchTerm)}`, [searchTerm]);
  const { data, loading, error, refetch } = usePlatformData<SeoData>(queryPath);

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<SeoMeta | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null); setFormSuccess(null);
    setEditingId(null); setModalMode('create');
  };

  const openEdit = (m: SeoMeta) => {
    const keywords = Array.isArray(m.keywords) ? m.keywords.join(', ') : m.keywords ? String(m.keywords) : '';
    setForm({
      pagePath: m.pagePath ?? '', title: m.title ?? '', description: m.description ?? '',
      ogTitle: m.ogTitle ?? '', ogDescription: m.ogDescription ?? '',
      ogImageUrl: m.ogImageUrl ?? '', keywords,
      canonicalUrl: m.canonicalUrl ?? '', noIndex: !!m.noIndex,
    });
    setFormError(null); setFormSuccess(null);
    setEditingId(m.id); setModalMode('edit');
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null); setEditingId(null);
    setFormError(null); setFormSuccess(null);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null); setFormSuccess(null);
    if (!form.pagePath.trim()) {
      setFormError('Le chemin (pagePath) est requis.');
      return;
    }
    setSubmitting(true);
    try {
      const isEdit = modalMode === 'edit' && editingId;
      const keywordsList = form.keywords.split(',').map((t) => t.trim()).filter(Boolean);
      const body: Record<string, unknown> = {
        pagePath: form.pagePath.trim(),
        title: form.title.trim() || null,
        description: form.description.trim() || null,
        ogTitle: form.ogTitle.trim() || null,
        ogDescription: form.ogDescription.trim() || null,
        ogImageUrl: form.ogImageUrl.trim() || null,
        keywords: keywordsList,
        canonicalUrl: form.canonicalUrl.trim() || null,
        noIndex: form.noIndex,
      };
      const url = isEdit ? `/api/platform/seo/${editingId}` : '/api/platform/seo';
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
      setFormSuccess(isEdit ? 'Meta SEO mise à jour.' : 'Meta SEO créée.');
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
      const res = await fetch(`/api/platform/seo/${deleteTarget.id}`, {
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

  const metas = data?.metas ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">SEO &amp; Meta</h1>
          <p className="text-slate-500">Gérez les balises meta SEO du site public</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 rounded-xl text-sm font-semibold text-white shadow-md transition-all">
          <Plus className="w-4 h-4" /> Créer une meta
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text" value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher par chemin (pagePath)…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
        />
      </div>

      {loading ? <PlatformLoading label="Chargement des metas SEO…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       metas.length === 0 ? <PlatformEmpty title="Aucune meta SEO" description="Créez votre première meta SEO." /> : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Chemin</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Titre</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Indexation</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {metas.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                          <Globe className="w-4 h-4" />
                        </div>
                        <span className="font-mono text-sm text-slate-900">{m.pagePath}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 max-w-md">
                      <span className="line-clamp-1">{m.title || <span className="text-slate-400">—</span>}</span>
                    </td>
                    <td className="px-6 py-4">
                      {m.noIndex ? (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">No-index</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Indexable</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(m)} title="Modifier" className={iconBtnEdit}><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => { setDeleteTarget(m); setDeleteError(null); }} title="Supprimer" className={iconBtnDelete}><Trash2 className="w-4 h-4" /></button>
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
          title={modalMode === 'create' ? 'Créer une meta SEO' : 'Modifier la meta SEO'}
          subtitle={modalMode === 'create' ? 'Nouvelle meta SEO' : `ID: ${editingId}`}
          onClose={closeModal} disabled={submitting}
          footer={
            <>
              <button type="button" onClick={closeModal} disabled={submitting} className={btnGhost}>Annuler</button>
              <button type="submit" form="seo-form" disabled={submitting} className={btnPrimary}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {modalMode === 'create' ? 'Créer' : 'Enregistrer'}
              </button>
            </>
          }
        >
          <form id="seo-form" onSubmit={submitForm} className="space-y-4">
            <Field label="Chemin (pagePath)" required hint="Chemin relatif de la page (ex. /, /about, /blog/mon-article).">
              <input type="text" value={form.pagePath} onChange={(e) => setForm({ ...form, pagePath: e.target.value })} className={monoInputClass} placeholder="/about" />
            </Field>
            <Field label="Title">
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="Academia Helm — …" />
            </Field>
            <Field label="Description">
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={inputClass} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="OG Title"><input type="text" value={form.ogTitle} onChange={(e) => setForm({ ...form, ogTitle: e.target.value })} className={inputClass} /></Field>
              <Field label="OG Description"><input type="text" value={form.ogDescription} onChange={(e) => setForm({ ...form, ogDescription: e.target.value })} className={inputClass} /></Field>
            </div>
            <Field label="OG Image URL">
              <input type="url" value={form.ogImageUrl} onChange={(e) => setForm({ ...form, ogImageUrl: e.target.value })} className={inputClass} placeholder="https://…" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Mots-clés (séparés par des virgules)">
                <input type="text" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} className={inputClass} placeholder="éducation, helm, saas" />
              </Field>
              <Field label="Canonical URL">
                <input type="url" value={form.canonicalUrl} onChange={(e) => setForm({ ...form, canonicalUrl: e.target.value })} className={inputClass} placeholder="https://…" />
              </Field>
            </div>
            <Toggle checked={form.noIndex} onChange={(v) => setForm({ ...form, noIndex: v })} label="No-index (empêcher l’indexation par les moteurs)" />
            <ErrorBanner msg={formError} />
            <SuccessBanner msg={formSuccess} />
          </form>
        </ModalShell>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <DeleteConfirmModal
          title="Supprimer la meta SEO"
          description={<>Confirmez-vous la suppression de la meta SEO pour le chemin <span className="font-mono font-bold text-slate-900">{deleteTarget.pagePath}</span> ? Cette action est irréversible.</>}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleting) { setDeleteTarget(null); setDeleteError(null); } }}
          deleting={deleting}
          error={deleteError}
        />
      )}
    </div>
  );
}
