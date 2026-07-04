'use client';

/**
 * ============================================================================
 * ImagePicker — Sélecteur d'image 100% visuel, zéro concept technique
 * ============================================================================
 *
 * L'utilisateur :
 *   1. Clique sur "Choisir une image" → ouvre le sélecteur de fichiers
 *   2. Voit un aperçu immédiat de l'image choisie
 *   3. Peut supprimer l'image (corbeille) ou la remplacer
 *
 * Aucune URL n'est visible, aucun champ texte, aucun "https://".
 * L'image est lue via FileReader → data URL → envoyée à /api/media/optimize
 * pour compression (Sharp) → stockée dans le champ config.
 *
 * Si une valeur existe déjà (URL distante ou data URL), elle est affichée
 * telle quelle — l'utilisateur peut la remplacer ou la supprimer.
 *
 * Props :
 *   - value: string | null | undefined   → URL ou data URL actuelle
 *   - onChange: (value: string | null) => void
 *   - label?: string                     → ex: "Photo du directeur"
 *   - aspect?: 'square' | 'wide' | 'banner'  → ratio de l'aperçu
 *   - hint?: string                      → texte d'aide non technique
 * ============================================================================
 */

import { useRef, useState } from 'react';
import { Upload, Trash2, Loader2, ImagePlus, Check } from 'lucide-react';

type Aspect = 'square' | 'wide' | 'banner';

const ASPECT_CLASS: Record<Aspect, string> = {
  square: 'aspect-square',
  wide: 'aspect-[4/3]',
  banner: 'aspect-[21/9]',
};

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 Mo
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface Props {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  label?: string;
  aspect?: Aspect;
  hint?: string;
}

export function ImagePicker({
  value,
  onChange,
  label,
  aspect = 'wide',
  hint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Format non supporté. Utilisez JPG, PNG, WEBP ou GIF.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("L'image est trop lourde (max 8 Mo).");
      return;
    }

    setLoading(true);
    try {
      // 1. Lire le fichier en data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
        reader.readAsDataURL(file);
      });

      // 2. Optimiser côté serveur (Sharp) — fallback gracieux si l'API échoue
      let optimized = dataUrl;
      try {
        const res = await fetch('/api/media/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ dataUrl }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.optimizedDataUrl) optimized = json.optimizedDataUrl;
        }
      } catch {
        // On garde le data URL non optimisé — la fonctionnalité reste utilisable
      }

      onChange(optimized);
    } catch (err: any) {
      setError(err?.message || "Impossible de charger l'image.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset pour permettre de re-choisir le même fichier
    e.target.value = '';
  };

  const handleRemove = () => {
    onChange(null);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // === RENDU ===

  if (value) {
    // Image présente → aperçu + boutons
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
              onClick={() => inputRef.current?.click()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/90 hover:bg-white rounded-lg text-xs font-semibold text-slate-800 transition"
            >
              <Upload className="w-3.5 h-3.5" />
              Remplacer
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/90 hover:bg-red-500 rounded-lg text-xs font-semibold text-white transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Retirer
            </button>
          </div>
          {loading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
            </div>
          )}
        </div>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>
    );
  }

  // Pas d'image → zone de dépôt
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-slate-700">{label}</label>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        disabled={loading}
        className={`w-full ${ASPECT_CLASS[aspect]} rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 transition flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-blue-700 cursor-pointer disabled:opacity-50`}
      >
        {loading ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-xs font-medium">Chargement…</span>
          </>
        ) : (
          <>
            <ImagePlus className="w-7 h-7" />
            <span className="text-sm font-semibold">Choisir une image</span>
            <span className="text-[11px] text-slate-400">ou glisser-déposer ici</span>
          </>
        )}
      </button>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
