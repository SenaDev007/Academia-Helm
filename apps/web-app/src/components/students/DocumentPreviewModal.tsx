'use client';

/**
 * ============================================================================
 * DOCUMENT PREVIEW MODAL — Visualisation de documents (data URL ou blob URL)
 * ============================================================================
 *
 * Affiche un document (PDF, image) dans un modal plein écran.
 *
 * ⚠️ Compatible mobile : convertit les data URLs base64 en Blob URLs avant
 * de les passer à l'<iframe> ou <img>. Les data URLs directes dans les
 * iframes ne fonctionnent pas sur la plupart des navigateurs mobiles
 * (Chrome Android, Safari iOS) à cause des restrictions de sécurité.
 * Les Blob URLs sont une alternative universellement supportée.
 *
 * Le composant gère aussi le nettoyage (URL.revokeObjectURL) à la fermeture
 * pour éviter les fuites mémoire.
 * ============================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import { FileText, ExternalLink, X, Download } from 'lucide-react';

interface DocumentPreviewModalProps {
  doc: {
    filePath: string; // data URL (base64), URL HTTPS, ou blob URL
    fileName: string;
    mimeType: string;
  };
  onClose: () => void;
}

/**
 * Convertit un data URL base64 en Blob URL.
 * Les Blob URLs sont mieux supportées par les navigateurs mobiles pour les iframes.
 * Si filePath est déjà une URL HTTPS ou blob URL, on la retourne telle quelle.
 */
function useBlobUrl(filePath: string): { url: string; revoke: () => void } {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) return;

    // Si c'est déjà une URL HTTPS, l'utiliser directement (pas de revoke)
    if (filePath.startsWith('http')) {
      setBlobUrl(filePath);
      return;
    }

    // Si c'est déjà une blob URL, l'utiliser directement MAIS il faudra revoke
    // (l'appelant a créé la blob URL, on la réutilise)
    if (filePath.startsWith('blob:')) {
      setBlobUrl(filePath);
      return;
    }

    // Si c'est un data URL, le convertir en Blob
    if (filePath.startsWith('data:')) {
      try {
        const match = filePath.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const base64Data = match[2];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          return () => URL.revokeObjectURL(url);
        }
      } catch (e) {
        console.warn('[DocumentPreview] Failed to convert data URL to blob:', e);
      }
    }

    // Fallback : utiliser le filePath tel quel
    setBlobUrl(filePath);
  }, [filePath]);

  const revoke = useMemo(() => {
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  return { url: blobUrl || filePath, revoke };
}

export default function DocumentPreviewModal({ doc, onClose }: DocumentPreviewModalProps) {
  const { url, revoke } = useBlobUrl(doc.filePath);

  // Nettoyer le blob URL à la fermeture
  useEffect(() => {
    return () => revoke();
  }, [revoke]);

  // Fermer avec Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const isImage = doc.mimeType.startsWith('image/');

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-blue-50 rounded-lg shrink-0">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800 truncate">{doc.fileName}</h3>
              <p className="text-[10px] text-slate-400">{doc.mimeType}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Télécharger : utiliser le blob URL si disponible (mobile-friendly) */}
            <a
              href={url}
              download={doc.fileName}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition"
              title="Télécharger"
            >
              <Download className="w-3.5 h-3.5" />
              Télécharger
            </a>
            {/* Ouvrir dans un nouvel onglet (blob URL — fonctionne sur mobile) */}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition"
              title="Ouvrir dans un nouvel onglet"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ouvrir
            </a>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-hidden bg-slate-100">
          {isImage ? (
            <div className="flex items-center justify-center h-full p-4">
              <img
                src={url}
                alt={doc.fileName}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              />
            </div>
          ) : (
            <iframe
              src={url}
              className="w-full h-full border-0"
              title={doc.fileName}
            />
          )}
        </div>
      </div>
    </div>
  );
}
