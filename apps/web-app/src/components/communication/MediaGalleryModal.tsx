"use client";

/**
 * ============================================================================
 * MEDIA GALLERY MODAL — Galerie médias + lightbox (V4 Phase 2)
 * ============================================================================
 *
 * ⭐ Porté de « Yeshua Connect » (galerie 3 colonnes + lightbox plein écran
 * + téléchargements). Palette Academia Helm conservée.
 *
 * Données : GET /chat/v2/files?type=media — fichiers de TOUTES les
 * conversations dont l'utilisateur est membre (backend FilesCenterService).
 * ============================================================================
 */

import React, { useEffect, useState, useCallback } from 'react';
import { X, Download, Image as ImageIcon, Film, Music, FileText, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MediaFile {
  id: string;
  conversationId: string;
  convName: string | null;
  type: string;         // IMAGE | VIDEO | AUDIO | DOCUMENT
  url: string;
  name: string | null;
  size: number | null;
  mime: string | null;
  createdAt: string;
  senderName: string;
}

/** URL absolue d'une pièce jointe (même logique que le chat). */
export function absoluteAttachmentUrl(url: string): string {
  if (url.startsWith('http')) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || 'https://api.academiahelm.com';
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function MediaGalleryModal({ onClose, onOpenConversation }: {
  onClose: () => void;
  onOpenConversation?: (conversationId: string) => void;
}) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/chat/v2/files?type=media&limit=120', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setFiles(Array.isArray(data.files) ? data.files : []);
      }
    } catch { /* silencieux */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Navigation lightbox au clavier
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft' && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
      if (e.key === 'ArrowRight' && lightboxIndex < files.length - 1) setLightboxIndex(lightboxIndex + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, files.length]);

  const mediaFiles = files;
  const lightboxFile = lightboxIndex !== null ? mediaFiles[lightboxIndex] : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0A2A5E] to-[#1C6FE8] flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-[#FFE08A]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Galerie de médias</h3>
              <p className="text-[10px] text-slate-500">{mediaFiles.length} éléments partagés</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grille 3 colonnes (porté de Yeshua) */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : mediaFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ImageIcon className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-700">Aucun média partagé</p>
              <p className="text-xs text-slate-500 mt-1">Les images et vidéos des conversations apparaîtront ici.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {mediaFiles.map((f, i) => {
                const abs = absoluteAttachmentUrl(f.url);
                return (
                  <button
                    key={f.id}
                    onClick={() => setLightboxIndex(i)}
                    className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group border border-slate-200"
                  >
                    {f.type === 'IMAGE' ? (
                      <img src={abs} alt={f.name || 'Image'} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                    ) : f.type === 'VIDEO' ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-slate-800">
                        <Film className="w-6 h-6 text-[#FFE08A]" />
                        <span className="text-[9px] text-white/70 truncate max-w-[80%]">{f.name || 'Vidéo'}</span>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-slate-50">
                        {f.type === 'AUDIO' ? <Music className="w-6 h-6 text-[#CFA63A]" /> : <FileText className="w-6 h-6 text-slate-400" />}
                        <span className="text-[9px] text-slate-600 truncate max-w-[80%]">{f.name || 'Fichier'}</span>
                      </div>
                    )}
                    {/* Légende conversation au survol */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[9px] text-white truncate">{f.convName || 'Conversation'}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ⭐ Lightbox plein écran (porté de Yeshua — z-70) */}
      {lightboxFile && (
        <div className="fixed inset-0 bg-black/90 z-[75] flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
          {/* Navigation */}
          {lightboxIndex !== null && lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex! - 1); }}
              className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {lightboxIndex !== null && lightboxIndex < mediaFiles.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex! + 1); }}
              className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
          <div className="max-w-[90vw] max-h-[85vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {lightboxFile.type === 'IMAGE' ? (
              <img src={absoluteAttachmentUrl(lightboxFile.url)} alt={lightboxFile.name || 'Image'} className="max-w-[90vw] max-h-[75vh] object-contain rounded-lg" />
            ) : lightboxFile.type === 'VIDEO' ? (
              <video src={absoluteAttachmentUrl(lightboxFile.url)} controls autoPlay className="max-w-[90vw] max-h-[75vh] rounded-lg" />
            ) : lightboxFile.type === 'AUDIO' ? (
              <audio src={absoluteAttachmentUrl(lightboxFile.url)} controls autoPlay className="w-[80vw]" />
            ) : null}
            {/* Barre info + actions */}
            <div className="flex items-center gap-3 text-white/90 bg-white/10 rounded-full px-4 py-2">
              <div className="text-xs max-w-[300px] truncate">
                <span className="font-semibold">{lightboxFile.name || 'Média'}</span>
                {lightboxFile.size ? <span className="opacity-60"> · {formatSize(lightboxFile.size)}</span> : null}
                {lightboxFile.convName ? <span className="opacity-60"> · {lightboxFile.convName}</span> : null}
              </div>
              <a
                href={absoluteAttachmentUrl(lightboxFile.url)}
                download={lightboxFile.name || undefined}
                className="p-1.5 rounded-full bg-[#FFE08A] text-[#0A2A5E] hover:bg-[#CFA63A]"
                title="Télécharger"
              >
                <Download className="w-4 h-4" />
              </a>
              {lightboxFile.conversationId && onOpenConversation && (
                <button
                  onClick={() => { onOpenConversation(lightboxFile.conversationId); setLightboxIndex(null); onClose(); }}
                  className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/20 hover:bg-white/30"
                  title="Ouvrir la conversation"
                >
                  Ouvrir la conversation
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaGalleryModal;
