'use client';

/**
 * ============================================================================
 * MediaLibraryDialog — Bibliothèque médias visuelle (façon WordPress)
 * ============================================================================
 *
 * Modal complet qui permet :
 *   - de parcourir les médias existants (grille avec thumbnails)
 *   - de filtrer par dossier / type / recherche textuelle
 *   - d'uploader de nouveaux fichiers (drag-and-drop + clic)
 *   - de sélectionner un média pour l'insérer dans le contenu
 *   - de supprimer un média (avec confirmation)
 *   - d'éditer les métadonnées (alt, tags)
 *
 * 100% non-technique : aucun slug, URL, JSON, hex code visible.
 *
 * Props :
 *   - open: boolean
 *   - onClose: () => void
 *   - onSelect: (media: MediaAsset) => void     → appelé quand l'utilisateur choisit un média
 *   - folder?: string                           → dossier pré-sélectionné (ex: 'hero', 'gallery')
 *   - accept?: 'image' | 'video' | 'document' | 'all'  → filtre le type autorisé
 *   - title?: string                            → titre du modal (défaut: "Bibliothèque médias")
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Upload, Search, Trash2, Check, Loader2, Image as ImageIcon,
  FileText, Video, Folder as FolderIcon, AlertCircle, Plus, Pencil, Save,
} from 'lucide-react';
import {
  tenantMediaService,
  type MediaAsset,
  type FolderInfo,
} from '@/services/tenant-media.service';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (media: MediaAsset) => void;
  folder?: string;
  accept?: 'image' | 'video' | 'document' | 'all';
  title?: string;
}

const ACCEPTED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  document: ['application/pdf'],
  all: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4', 'video/webm'],
};

const TYPE_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Tous types', icon: ImageIcon },
  { value: 'image', label: 'Images', icon: ImageIcon },
  { value: 'video', label: 'Vidéos', icon: Video },
  { value: 'document', label: 'Documents', icon: FileText },
];

const FOLDER_LABELS: Record<string, string> = {
  general: 'Général',
  hero: 'Bannières',
  gallery: 'Galerie',
  logo: 'Logos',
  og: 'Partage réseaux sociaux',
  news: 'Actualités',
  events: 'Événements',
  testimonials: 'Témoignages',
};

function getFolderLabel(folder: string): string {
  return FOLDER_LABELS[folder] || folder.charAt(0).toUpperCase() + folder.slice(1);
}

function getTypeIcon(type: string) {
  if (type === 'image') return ImageIcon;
  if (type === 'video') return Video;
  return FileText;
}

export function MediaLibraryDialog({
  open,
  onClose,
  onSelect,
  folder: initialFolder,
  accept = 'image',
  title = 'Bibliothèque médias',
}: Props) {
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeFolder, setActiveFolder] = useState<string>(initialFolder || 'ALL');
  const [activeType, setActiveType] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const [editForm, setEditForm] = useState({ name: '', alt: '', tags: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, foldersRes] = await Promise.all([
        tenantMediaService.list({
          folder: activeFolder === 'ALL' ? undefined : activeFolder,
          type: activeType === 'ALL' ? undefined : activeType,
          search: search.trim() || undefined,
          limit: 100,
          offset: 0,
        }),
        tenantMediaService.listFolders(),
      ]);
      setItems(listRes.items);
      setTotal(listRes.total);
      setFolders(foldersRes);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors du chargement');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeFolder, activeType, search]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleUpload = async (files: FileList | File[]) => {
    const accepted = ACCEPTED_TYPES[accept] || ACCEPTED_TYPES.all;
    const fileArr = Array.from(files).filter((f) => accepted.includes(f.type));
    if (fileArr.length === 0) {
      setError('Format non supporté. Vérifiez le type de fichier.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      for (const file of fileArr) {
        const fileDataUrl = await tenantMediaService.readFileAsDataUrl(file);
        await tenantMediaService.upload({
          fileDataUrl,
          fileName: file.name,
          mimeType: file.type,
          folder: activeFolder === 'ALL' ? 'general' : activeFolder,
        });
      }
      await load();
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleSelect = () => {
    if (!selected) return;
    onSelect(selected);
    setSelected(null);
    onClose();
  };

  const handleDelete = async (media: MediaAsset) => {
    if (!confirm(`Supprimer "${media.name}" ? Cette action est irréversible.`)) return;
    setDeleting(media.id);
    try {
      await tenantMediaService.delete(media.id);
      if (selected?.id === media.id) setSelected(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  const startEdit = (media: MediaAsset) => {
    setEditing(media);
    setEditForm({
      name: media.name,
      alt: media.alt || '',
      tags: Array.isArray(media.tags) ? media.tags.join(', ') : '',
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await tenantMediaService.update(editing.id, {
        name: editForm.name.trim() || editing.name,
        alt: editForm.alt.trim() || null,
        tags: editForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setEditing(null);
      await load();
      if (selected?.id === editing.id) {
        const updated = await tenantMediaService.getById(editing.id);
        setSelected(updated);
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la sauvegarde');
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {total} média{total > 1 ? 's' : ''} · {items.length} affiché{items.length > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — sidebar + content */}
        <div className="flex-1 flex min-h-0">
          {/* Sidebar — dossiers */}
          <aside className="w-56 border-r border-slate-100 bg-slate-50/50 p-3 overflow-y-auto shrink-0">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 px-2">Dossiers</p>
            <button
              onClick={() => setActiveFolder('ALL')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                activeFolder === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FolderIcon className="w-4 h-4" />
              Tous les médias
            </button>
            {folders.map((f) => (
              <button
                key={f.folder}
                onClick={() => setActiveFolder(f.folder)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition ${
                  activeFolder === f.folder ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <FolderIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{getFolderLabel(f.folder)}</span>
                </span>
                <span className={`text-xs font-semibold ${activeFolder === f.folder ? 'text-blue-100' : 'text-slate-400'}`}>
                  {f.count}
                </span>
              </button>
            ))}

            {/* Type filter */}
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-4 mb-2 px-2">Types</p>
            {TYPE_FILTER_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => setActiveType(opt.value)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                    activeType === opt.value ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {opt.label}
                </button>
              );
            })}
          </aside>

          {/* Content — toolbar + grid */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
                  placeholder="Rechercher par nom ou description…"
                  className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {uploading ? 'Chargement…' : 'Ajouter des médias'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={(ACCEPTED_TYPES[accept] || ACCEPTED_TYPES.all).join(',')}
                multiple
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
                className="hidden"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Grid or empty state */}
            <div
              className="flex-1 overflow-y-auto p-4"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : items.length === 0 ? (
                <div className="py-16 text-center">
                  <div
                    className="border-2 border-dashed border-slate-300 rounded-xl p-10 hover:border-blue-500 hover:bg-blue-50/30 transition cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-700 mb-1">
                      {uploading ? 'Chargement des fichiers…' : 'Glissez vos fichiers ici ou cliquez pour parcourir'}
                    </p>
                    <p className="text-xs text-slate-500">
                      JPG, PNG, WEBP, GIF, PDF · max 15 Mo
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {items.map((media) => {
                    const isSelected = selected?.id === media.id;
                    const Icon = getTypeIcon(media.type);
                    return (
                      <div
                        key={media.id}
                        onClick={() => setSelected(media)}
                        className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition ${
                          isSelected ? 'border-blue-500 shadow-lg' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="aspect-square bg-slate-100 flex items-center justify-center">
                          {media.thumbnailUrl || media.type === 'image' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={media.thumbnailUrl || media.hdUrl || media.originalUrl}
                              alt={media.alt || media.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Icon className="w-10 h-10 text-slate-400" />
                          )}
                        </div>

                        {/* Selection badge */}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}

                        {/* Usages count badge */}
                        {media.usagesCount > 0 && (
                          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 text-white rounded text-[10px] font-semibold backdrop-blur-sm">
                            {media.usagesCount} usage{media.usagesCount > 1 ? 's' : ''}
                          </div>
                        )}

                        {/* Hover actions */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-white font-medium truncate">
                              {media.name}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); startEdit(media); }}
                                className="p-1 bg-white/90 hover:bg-white rounded text-slate-700"
                                title="Modifier les informations"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(media); }}
                                disabled={deleting === media.id}
                                className="p-1 bg-white/90 hover:bg-red-100 rounded text-red-600"
                                title="Supprimer"
                              >
                                {deleting === media.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer — actions */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {selected ? (
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Sélectionné : <span className="font-semibold text-slate-800">{selected.name}</span>
              </span>
            ) : (
              <span>Cliquez sur un média pour le sélectionner, ou ajoutez-en un nouveau.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Annuler
            </button>
            <button
              onClick={handleSelect}
              disabled={!selected}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition"
            >
              <Check className="w-4 h-4" />
              Choisir ce média
            </button>
          </div>
        </div>
      </div>

      {/* Edit modal (nested) */}
      {editing && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Modifier les informations</h3>
              <button onClick={() => setEditing(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {editing.type === 'image' && editing.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={editing.thumbnailUrl} alt={editing.alt || editing.name} className="w-full h-32 object-cover rounded-lg" />
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nom du fichier</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description (texte alternatif)
                <span className="text-xs text-slate-400 ml-1">— pour l'accessibilité et Google</span>
              </label>
              <textarea
                value={editForm.alt}
                onChange={(e) => setEditForm({ ...editForm, alt: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                placeholder="Décrivez cette image en une phrase"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Étiquettes
                <span className="text-xs text-slate-400 ml-1">— séparées par des virgules</span>
              </label>
              <input
                type="text"
                value={editForm.tags}
                onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                placeholder="campus, élèves, sport"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
                Annuler
              </button>
              <button
                onClick={saveEdit}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
              >
                <Save className="w-4 h-4" />
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
