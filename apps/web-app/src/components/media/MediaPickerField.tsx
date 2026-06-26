'use client';

/**
 * ============================================================================
 * MediaPickerField — Champ de sélection d'image réutilisable
 * ============================================================================
 *
 * Composant hybride :
 *   - Bouton "Choisir une image" → ouvre MediaLibraryDialog (parcourir/upload)
 *   - Bouton "Téléverser" direct (sans passer par la bibliothèque)
 *   - Aperçu immédiat + bouton "Retirer"
 *   - Bouton "Modifier" → rouvre la bibliothèque
 *
 * À la différence de l'ancien ImagePicker (qui stockait les data URLs),
 * ce composant persiste TOUJOURS les fichiers dans la bibliothèque médias
 * (cloud storage) et stocke l'URL publique en DB.
 *
 * 100% non-technique : aucune URL visible, aucun slug, aucun hex code.
 *
 * Props :
 *   - value: string | null | undefined   → URL actuelle (peut être vide)
 *   - onChange: (url: string | null) => void
 *   - label?: string                     → ex: "Photo du directeur"
 *   - aspect?: 'square' | 'wide' | 'banner'
 *   - folder?: string                    → dossier de rangement (ex: 'hero', 'gallery')
 *   - hint?: string
 * ============================================================================
 */

import { useState, useRef } from 'react';
import { Upload, Trash2, Loader2, ImagePlus, FolderOpen, AlertCircle } from 'lucide-react';
import { MediaLibraryDialog } from './MediaLibraryDialog';
import { tenantMediaService } from '@/services/tenant-media.service';

type Aspect = 'square' | 'wide' | 'banner';

const ASPECT_CLASS: Record<Aspect, string> = {
  square: 'aspect-square',
  wide: 'aspect-[4/3]',
  banner: 'aspect-[21/9]',
};

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface Props {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  label?: string;
  aspect?: Aspect;
  folder?: string;
  hint?: string;
}

export function MediaPickerField({
  value,
  onChange,
  label,
  aspect = 'wide',
  folder = 'general',
  hint,
}: Props) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Format non supporté. Utilisez JPG, PNG, WEBP ou GIF.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("L'image est trop lourde (max 8 Mo).");
      return;
    }

    setUploading(true);
    try {
      // 1. Lire le fichier en data URL
      const fileDataUrl = await tenantMediaService.readFileAsDataUrl(file);

      // 2. Upload via la bibliothèque médias (génère 3 variantes + stocke en cloud)
      const media = await tenantMediaService.upload({
        fileDataUrl,
        fileName: file.name,
        mimeType: file.type,
        folder,
      });

      // 3. Utiliser l'URL HD comme valeur (compromis qualité/poids pour affichage web)
      onChange(media.hdUrl || media.originalUrl);
    } catch (err: any) {
      setError(err?.message || "Impossible de charger l'image.");
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleRemove = () => {
    onChange(null);
    setError(null);
  };

  const handleLibrarySelect = (media: any) => {
    onChange(media.hdUrl || media.originalUrl);
  };

  // === RENDU ===

  if (value) {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-slate-700">{label}</label>
        )}
        <div className={`relative w-full ${ASPECT_CLASS[aspect]} rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label || 'Aperçu'}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/90 hover:bg-white rounded-lg text-xs font-semibold text-slate-800 transition"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Changer
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/90 hover:bg-red-500 rounded-lg text-xs font-semibold text-white transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Retirer
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
            </div>
          )}
        </div>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <MediaLibraryDialog
          open={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          onSelect={handleLibrarySelect}
          folder={folder}
          accept="image"
          title={label ? `Choisir ${label.toLowerCase()}` : 'Choisir une image'}
        />
      </div>
    );
  }

  // Pas d'image → zone de dépôt + bouton bibliothèque
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-slate-700">{label}</label>
      )}
      <div className={`w-full ${ASPECT_CLASS[aspect]} rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 transition flex flex-col items-center justify-center gap-3`}>
        {uploading ? (
          <>
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
            <span className="text-sm font-semibold text-slate-700">Chargement…</span>
          </>
        ) : (
          <>
            <ImagePlus className="w-8 h-8 text-slate-400" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
              >
                <Upload className="w-3.5 h-3.5" />
                Téléverser
              </button>
              <button
                type="button"
                onClick={() => setLibraryOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Bibliothèque
              </button>
            </div>
            <span className="text-[11px] text-slate-400">ou glisser-déposer ici</span>
          </>
        )}
      </div>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleInputChange}
        className="hidden"
      />
      <MediaLibraryDialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={handleLibrarySelect}
        folder={folder}
        accept="image"
        title={label ? `Choisir ${label.toLowerCase()}` : 'Choisir une image'}
      />
    </div>
  );
}
