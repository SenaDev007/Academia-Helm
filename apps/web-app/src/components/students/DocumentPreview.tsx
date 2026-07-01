'use client';

/**
 * Composant de prévisualisation de document.
 *
 * Fetch le document avec credentials (cookies httpOnly), crée un blob URL
 * temporaire, puis l'affiche dans une iframe (PDF) ou img (image).
 *
 * Cette approche contourne le problème des cookies SameSite qui empêchent
 * les iframes de s'authentifier automatiquement.
 */

import { useState, useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

interface DocumentPreviewProps {
  url: string;
  mimeType: string;
  onError?: () => void;
  hasError?: boolean;
}

export default function DocumentPreview({ url, mimeType, onError, hasError }: DocumentPreviewProps) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    setStatus('loading');
    setBlobUrl(null);

    let revokeUrl: string | null = null;

    // Fetch le document avec credentials (cookies httpOnly)
    fetch(url, { method: 'GET', credentials: 'include' })
      .then(async res => {
        if (!res.ok) {
          setStatus('error');
          onError?.();
          return;
        }
        // Récupérer le Content-Type depuis la réponse (plus fiable que le mimeType passé)
        const contentType = res.headers.get('content-type') || mimeType;
        const blob = await res.blob();
        // Créer un object URL temporaire (pas besoin de cookies)
        const objUrl = URL.createObjectURL(blob);
        revokeUrl = objUrl;
        setBlobUrl(objUrl);
        setStatus('ok');
      })
      .catch(() => {
        setStatus('error');
        onError?.();
      });

    // Cleanup : révoquer l'object URL quand le composant se démonte ou change d'URL
    return () => {
      if (revokeUrl) {
        URL.revokeObjectURL(revokeUrl);
      }
    };
  }, [url]);

  if (hasError || status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="p-4 bg-rose-50 rounded-full mb-4">
          <AlertCircle className="w-12 h-12 text-rose-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-700 mb-2">Document non disponible</h3>
        <p className="text-sm text-slate-500 max-w-md">
          Ce document a été enregistré sans fichier joint, ou le fichier n'a pas pu être chargé.
          Veuillez demander au parent de soumettre à nouveau ce document,
          ou téléversez-le manuellement via le bouton &quot;+ Ajouter&quot;.
        </p>
      </div>
    );
  }

  if (status === 'loading' || !blobUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  // status === 'ok' — afficher avec le blob URL (pas besoin de cookies)
  const effectiveMime = mimeType.startsWith('image/') ? mimeType : 'application/pdf';

  if (effectiveMime.startsWith('image/')) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <img
          src={blobUrl}
          alt="Document"
          className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
        />
      </div>
    );
  }

  // PDF ou autre → iframe avec blob URL (pas de problème de cookies)
  return (
    <iframe
      src={blobUrl}
      className="w-full h-full border-0"
      title="Document"
    />
  );
}
