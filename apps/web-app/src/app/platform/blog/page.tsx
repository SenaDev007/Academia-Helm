'use client';

/**
 * Blog & Articles — CRUD page (Site Public / Academia Helm).
 *
 * Lists blog articles, supports search + status filter, and provides an inline
 * modal for create/edit + a confirmation modal for delete. Uses the shared
 * `CmsShared` primitives + `usePlatformData` + `fetch('/api/platform/...')`.
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

interface BlogArticle {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  coverImageUrl?: string | null;
  category?: string | null;
  tags?: string[] | string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string | null;
}

interface BlogData {
  articles: BlogArticle[];
  total?: number;
  page?: number;
  limit?: number;
}

// === Constants ===

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tous statuts' },
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'PUBLISHED', label: 'Publié' },
  { value: 'ARCHIVED', label: 'Archivé' },
] as const;

const ARTICLE_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'PUBLISHED', label: 'Publié' },
  { value: 'ARCHIVED', label: 'Archivé' },
] as const;

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  ARCHIVED: 'bg-amber-100 text-amber-700',
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon', PUBLISHED: 'Publié', ARCHIVED: 'Archivé',
};

type FormState = {
  title: string; slug: string; excerpt: string; content: string;
  coverImageUrl: string; category: string; tags: string;
  seoTitle: string; seoDescription: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
};

const EMPTY_FORM: FormState = {
  title: '', slug: '', excerpt: '', content: '',
  coverImageUrl: '', category: '', tags: '',
  seoTitle: '', seoDescription: '', status: 'DRAFT',
};

// === Helpers ===

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

// === Component ===

export default function BlogPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const queryPath = useMemo(
    () => `/blog?search=${encodeURIComponent(searchTerm)}&status=${statusFilter}&page=1&limit=50`,
    [searchTerm, statusFilter],
  );
  const { data, loading, error, refetch } = usePlatformData<BlogData>(queryPath);

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<BlogArticle | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setForm(EMPTY_FORM); setSlugTouched(false);
    setFormError(null); setFormSuccess(null);
    setEditingId(null); setModalMode('create');
  };

  const openEdit = (a: BlogArticle) => {
    const tags = Array.isArray(a.tags) ? a.tags.join(', ') : a.tags ? String(a.tags) : '';
    setForm({
      title: a.title ?? '', slug: a.slug ?? '', excerpt: a.excerpt ?? '',
      content: a.content ?? '', coverImageUrl: a.coverImageUrl ?? '',
      category: a.category ?? '', tags,
      seoTitle: a.seoTitle ?? '', seoDescription: a.seoDescription ?? '',
      status: a.status ?? 'DRAFT',
    });
    setSlugTouched(true);
    setFormError(null); setFormSuccess(null);
    setEditingId(a.id); setModalMode('edit');
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null); setEditingId(null);
    setFormError(null); setFormSuccess(null);
  };

  const onTitleChange = (v: string) => {
    setForm((f) => ({ ...f, title: v, slug: slugTouched ? f.slug : slugify(v) }));
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null); setFormSuccess(null);
    if (!form.title.trim() || !form.slug.trim()) {
      setFormError('Titre et slug sont requis.');
      return;
    }
    setSubmitting(true);
    try {
      const isEdit = modalMode === 'edit' && editingId;
      const tagsList = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
      const body: Record<string, unknown> = {
        title: form.title.trim(), slug: form.slug.trim(),
        excerpt: form.excerpt.trim() || null, content: form.content,
        coverImageUrl: form.coverImageUrl.trim() || null,
        category: form.category.trim() || null, tags: tagsList,
        seoTitle: form.seoTitle.trim() || null,
        seoDescription: form.seoDescription.trim() || null,
        status: form.status,
      };
      const url = isEdit ? `/api/platform/blog/${editingId}` : '/api/platform/blog';
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
      setFormSuccess(isEdit ? 'Article mis à jour.' : 'Article créé.');
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
      const res = await fetch(`/api/platform/blog/${deleteTarget.id}`, {
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

  const articles = data?.articles ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Blog &amp; Articles</h1>
          <p className="text-slate-500">Gérez les articles du blog public Academia Helm</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 rounded-xl text-sm font-semibold text-white shadow-md transition-all">
          <Plus className="w-4 h-4" /> Créer un article
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par titre, slug, catégorie…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
        >
          {STATUS_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
      </div>

      {/* States / Table */}
      {loading ? <PlatformLoading label="Chargement des articles…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       articles.length === 0 ? <PlatformEmpty title="Aucun article" description="Créez votre premier article pour le blog." /> : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Titre</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Catégorie</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Publié le</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {articles.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{a.title}</p>
                          <p className="text-xs text-slate-500 font-mono truncate">/{a.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {a.category ? (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold uppercase">{a.category}</span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${STATUS_BADGE[a.status] ?? 'bg-slate-100 text-slate-700'}`}>
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(a)} title="Modifier" className={iconBtnEdit}><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => { setDeleteTarget(a); setDeleteError(null); }} title="Supprimer" className={iconBtnDelete}><Trash2 className="w-4 h-4" /></button>
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
          title={modalMode === 'create' ? 'Créer un article' : 'Modifier l’article'}
          subtitle={modalMode === 'create' ? 'Nouvel article de blog' : `ID: ${editingId}`}
          onClose={closeModal} disabled={submitting}
          footer={
            <>
              <button type="button" onClick={closeModal} disabled={submitting} className={btnGhost}>Annuler</button>
              <button type="submit" form="blog-form" disabled={submitting} className={btnPrimary}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {modalMode === 'create' ? 'Créer' : 'Enregistrer'}
              </button>
            </>
          }
        >
          <form id="blog-form" onSubmit={submitForm} className="space-y-4">
            <Field label="Titre" required>
              <input type="text" value={form.title} onChange={(e) => onTitleChange(e.target.value)} className={inputClass} placeholder="Titre de l’article" />
            </Field>
            <Field label="Slug" required>
              <input type="text" value={form.slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: slugify(e.target.value) }); }} className={monoInputClass} placeholder="mon-article" />
            </Field>
            <Field label="Extrait">
              <textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} className={inputClass} placeholder="Résumé court de l’article" />
            </Field>
            <Field label="Contenu">
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8} className={`${monoInputClass} resize-y`} placeholder="Corps de l’article (Markdown ou HTML)" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Catégorie">
                <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass} placeholder="Ex. Actualités" />
              </Field>
              <Field label="Tags (séparés par des virgules)">
                <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className={inputClass} placeholder="pédagogie, plateforme, helm" />
              </Field>
            </div>
            <Field label="URL image de couverture">
              <input type="url" value={form.coverImageUrl} onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })} className={inputClass} placeholder="https://…" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="SEO Title"><input type="text" value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} className={inputClass} /></Field>
              <Field label="SEO Description"><input type="text" value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} className={inputClass} /></Field>
            </div>
            <Field label="Statut">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormState['status'] })} className={inputClass}>
                {ARTICLE_STATUS_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </Field>
            <ErrorBanner msg={formError} />
            <SuccessBanner msg={formSuccess} />
          </form>
        </ModalShell>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <DeleteConfirmModal
          title="Supprimer l’article"
          description={<>Confirmez-vous la suppression de l’article <span className="font-bold text-slate-900">{deleteTarget.title}</span> (<span className="font-mono text-xs">/{deleteTarget.slug}</span>) ? Cette action est irréversible.</>}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleting) { setDeleteTarget(null); setDeleteError(null); } }}
          deleting={deleting}
          error={deleteError}
        />
      )}
    </div>
  );
}
