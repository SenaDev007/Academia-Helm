'use client';

/**
 * Media — CRUD page (Site Public / Academia Helm).
 *
 * Lists media assets in a responsive grid (thumbnail for images, icon for
 * other types, name, type badge, actions), supports search + type filter,
 * and provides an inline create/edit modal (name, url, type select, alt,
 * tags) + a delete confirmation modal.
 */

import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Check, Loader2, Search, FileText, Video, File } from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '@/components/platform/PlatformStates';
import {
  ModalShell, DeleteConfirmModal, Field, ErrorBanner, SuccessBanner,
  inputClass, monoInputClass, btnPrimary, btnGhost,
} from '@/components/platform/cms/CmsShared';

// === Types ===

interface MediaAsset {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'document' | string;
  size?: number | null;
  alt?: string | null;
  tags?: string[] | string | null;
}

interface MediaData {
  assets: MediaAsset[];
}

// === Constants ===

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'Tous types' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Vidéos' },
  { value: 'document', label: 'Documents' },
] as const;

const TYPE_SELECT = [
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Vidéo' },
  { value: 'document', label: 'Document' },
] as const;

const TYPE_BADGE: Record<string, string> = {
  image: 'bg-emerald-100 text-emerald-700',
  video: 'bg-purple-100 text-purple-700',
  document: 'bg-blue-100 text-blue-700',
};

const formatSize = (bytes?: number | null) => {
  if (!bytes) return '—';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let v = bytes; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const isImage = (m: { url: string; name: string; type: string }) =>
  m.type === 'image' || /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(m.url || m.name);

type FormState = {
  name: string; url: string; type: 'image' | 'video' | 'document';
  size: string; alt: string; tags: string;
};

const EMPTY_FORM: FormState = {
  name: '', url: '', type: 'image', size: '', alt: '', tags: '',
};

// === Component ===

export default function MediaPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const queryPath = useMemo(
    () => `/media?type=${typeFilter}&search=${encodeURIComponent(searchTerm)}`,
    [searchTerm, typeFilter],
  );
  const { data, loading, error, refetch } = usePlatformData<MediaData>(queryPath);

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null); setFormSuccess(null);
    setEditingId(null); setModalMode('create');
  };

  const openEdit = (m: MediaAsset) => {
    const tags = Array.isArray(m.tags) ? m.tags.join(', ') : m.tags ? String(m.tags) : '';
    setForm({
      name: m.name ?? '', url: m.url ?? '',
      type: (m.type === 'video' || m.type === 'document' ? m.type : 'image') as FormState['type'],
      size: m.size != null ? String(m.size) : '',
      alt: m.alt ?? '', tags,
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
    if (!form.name.trim() || !form.url.trim()) {
      setFormError('Nom et URL sont requis.');
      return;
    }
    setSubmitting(true);
    try {
      const isEdit = modalMode === 'edit' && editingId;
      const tagsList = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
      const body: Record<string, unknown> = {
        name: form.name.trim(), url: form.url.trim(),
        type: form.type, alt: form.alt.trim() || null, tags: tagsList,
      };
      if (form.size.trim()) {
        const n = Number(form.size.trim());
        if (!Number.isNaN(n)) body.size = n;
      }
      const url = isEdit ? `/api/platform/media/${editingId}` : '/api/platform/media';
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
      setFormSuccess(isEdit ? 'Média mis à jour.' : 'Média créé.');
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
      const res = await fetch(`/api/platform/media/${deleteTarget.id}`, {
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

  const assets = data?.assets ?? [];
  const previewIsImage = isImage({ url: form.url, name: form.name, type: form.type });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Médias &amp; Images</h1>
          <p className="text-slate-500">Gérez la bibliothèque de médias du site public</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 rounded-xl text-sm font-semibold text-white shadow-md transition-all">
          <Plus className="w-4 h-4" /> Ajouter un média
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom ou URL…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
        >
          {TYPE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
      </div>

      {loading ? <PlatformLoading label="Chargement des médias…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       assets.length === 0 ? <PlatformEmpty title="Aucun média" description="Ajoutez votre premier média à la bibliothèque." /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {assets.map((m) => (
            <div key={m.id} className="group bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-square bg-slate-50 relative flex items-center justify-center overflow-hidden">
                {isImage(m) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.url} alt={m.alt || m.name}
                    className="w-full h-full object-cover" loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="text-slate-400">
                    {m.type === 'video' ? <Video className="w-12 h-12" /> :
                     m.type === 'document' ? <FileText className="w-12 h-12" /> :
                     <File className="w-12 h-12" />}
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${TYPE_BADGE[m.type] ?? 'bg-slate-100 text-slate-700'}`}>
                    {m.type}
                  </span>
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button onClick={() => openEdit(m)} title="Modifier" className="p-2 bg-white/95 rounded-lg text-slate-700 hover:text-blue-900 shadow-md transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setDeleteTarget(m); setDeleteError(null); }} title="Supprimer" className="p-2 bg-white/95 rounded-lg text-slate-700 hover:text-red-600 shadow-md transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-3 space-y-1">
                <p className="text-sm font-bold text-slate-900 truncate" title={m.name}>{m.name}</p>
                <p className="text-[11px] text-slate-500 truncate font-mono" title={m.url}>{m.url}</p>
                <p className="text-[11px] text-slate-400">{formatSize(m.size)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalMode && (
        <ModalShell
          title={modalMode === 'create' ? 'Ajouter un média' : 'Modifier le média'}
          subtitle={modalMode === 'create' ? 'Nouvel élément de la bibliothèque' : `ID: ${editingId}`}
          onClose={closeModal} disabled={submitting} maxWidth="max-w-lg"
          footer={
            <>
              <button type="button" onClick={closeModal} disabled={submitting} className={btnGhost}>Annuler</button>
              <button type="submit" form="media-form" disabled={submitting} className={btnPrimary}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {modalMode === 'create' ? 'Créer' : 'Enregistrer'}
              </button>
            </>
          }
        >
          <form id="media-form" onSubmit={submitForm} className="space-y-4">
            <Field label="Nom" required>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Logo Academia Helm" />
            </Field>
            <Field label="URL" required>
              <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className={monoInputClass} placeholder="https://…" />
            </Field>
            {previewIsImage && form.url.trim() && (
              <div className="rounded-lg overflow-hidden border border-slate-200 max-h-40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.url} alt="aperçu" className="w-full h-32 object-cover" />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Type" required>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as FormState['type'] })} className={inputClass}>
                  {TYPE_SELECT.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </Field>
              <Field label="Taille (octets)">
                <input type="number" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className={inputClass} placeholder="102400" />
              </Field>
            </div>
            <Field label="Texte alternatif">
              <input type="text" value={form.alt} onChange={(e) => setForm({ ...form, alt: e.target.value })} className={inputClass} placeholder="Description courte pour l’accessibilité" />
            </Field>
            <Field label="Tags (séparés par des virgules)">
              <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className={inputClass} placeholder="logo, branding, helm" />
            </Field>
            <ErrorBanner msg={formError} />
            <SuccessBanner msg={formSuccess} />
          </form>
        </ModalShell>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <DeleteConfirmModal
          title="Supprimer le média"
          description={<>Confirmez-vous la suppression du média <span className="font-bold text-slate-900">{deleteTarget.name}</span> ? Cette action est irréversible.</>}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleting) { setDeleteTarget(null); setDeleteError(null); } }}
          deleting={deleting}
          error={deleteError}
        />
      )}
    </div>
  );
}
