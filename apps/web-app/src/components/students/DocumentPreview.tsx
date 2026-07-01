'use client';

/**
 * Composant de prévisualisation de document.
 * Vérifie d'abord si l'URL est accessible (HEAD request), puis affiche
 * soit une iframe (PDF), soit une img (image), soit un message d'erreur.
 */

import { useState, useEffect } from 'react';
import { FileText, AlertCircle, Loader2 } from 'lucide-react';

interface DocumentPreviewProps {
  url: string;
  mimeType: string;
  onError?: () => void;
  hasError?: boolean;
}

export default function DocumentPreview({ url, mimeType, onError, hasError }: DocumentPreviewProps) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    setStatus('loading');
    // Vérifier si l'URL est accessible
    fetch(url, { method: 'GET', credentials: 'include' })
      .then(res => {
        if (res.ok) {
          setStatus('ok');
        } else {
          setStatus('error');
          onError?.();
        }
      })
      .catch(() => {
        setStatus('error');
        onError?.();
      });
  }, [url]);

  if (hasError || status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="p-4 bg-rose-50 rounded-full mb-4">
          <AlertCircle className="w-12 h-12 text-rose-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-700 mb-2">Document non disponible</h3>
        <p className="text-sm text-slate-500 max-w-md">
          Ce document a été enregistré sans fichier joint. Le fichier n'a pas pu être téléchargé
          lors de la soumission. Veuillez demander au parent de soumettre à nouveau ce document,
          ou téléversez-le manuellement via le bouton "+ Ajouter".
        </p>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  // status === 'ok'
  if (mimeType.startsWith('image/')) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <img
          src={url}
          alt="Document"
          className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
        />
      </div>
    );
  }

  // PDF ou autre → iframe
  return (
    <iframe
      src={url}
      className="w-full h-full border-0"
      title="Document"
    />
  );
}
