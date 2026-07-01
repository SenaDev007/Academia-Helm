'use client';

/**
 * Composant de prévisualisation de document.
 *
 * Fetch le document avec credentials (cookies httpOnly), crée un blob URL
 * temporaire, puis l'affiche dans une iframe (PDF) ou img (image).
 */

import { useState, useEffect } from 'react';
import { AlertCircle, Loader2, FileText } from 'lucide-react';

interface DocumentPreviewProps {
  url: string;
  mimeType: string;
  onError?: () => void;
  hasError?: boolean;
}

export default function DocumentPreview({ url, mimeType, onError, hasError }: DocumentPreviewProps) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    setStatus('loading');
    setBlobUrl(null);
    setErrorMsg('');

    let revokeUrl: string | null = null;

    fetch(url, { credentials: 'include' })
      .then(async res => {
        if (!res.ok) {
          // Essayer de lire le message d'erreur
          const text = await res.text().catch(() => '');
          let msg = `Erreur ${res.status}`;
          try {
            const parsed = JSON.parse(text);
            msg = parsed.error || parsed.message || msg;
          } catch {
            if (text) msg = text.slice(0, 200);
          }
          setErrorMsg(msg);
          setStatus('error');
          onError?.();
          return;
        }

        const blob = await res.blob();

        // Vérifier que le blob n'est pas vide
        if (blob.size === 0) {
          setErrorMsg('Le document est vide (0 octet)');
          setStatus('error');
          onError?.();
          return;
        }

        // Créer un object URL avec le bon type MIME
        const correctMime = blob.type || mimeType || 'application/pdf';
        const typedBlob = new Blob([blob], { type: correctMime });
        const objUrl = URL.createObjectURL(typedBlob);
        revokeUrl = objUrl;
        setBlobUrl(objUrl);
        setStatus('ok');
      })
      .catch(err => {
        setErrorMsg(err?.message || 'Échec de connexion');
        setStatus('error');
        onError?.();
      });

    return () => {
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [url]);

  if (hasError || status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="p-4 bg-rose-50 rounded-full mb-4">
          <AlertCircle className="w-12 h-12 text-rose-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-700 mb-2">Échec de chargement du document</h3>
        <p className="text-sm text-slate-500 max-w-md mb-2">
          {errorMsg || 'Ce document a été enregistré sans fichier joint.'}
        </p>
        <p className="text-xs text-slate-400 max-w-md">
          Si le problème persiste, essayez d'ouvrir le document dans un nouvel onglet
          via le bouton &quot;Télécharger&quot;.
        </p>
      </div>
    );
  }

  if (status === 'loading' || !blobUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
        <p className="text-sm text-slate-500">Chargement du document...</p>
      </div>
    );
  }

  // status === 'ok'
  const effectiveMime = mimeType.startsWith('image/') ? mimeType : 'application/pdf';

  if (effectiveMime.startsWith('image/')) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <img src={blobUrl} alt="Document" className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
      </div>
    );
  }

  return (
    <iframe src={blobUrl} className="w-full h-full border-0" title="Document" />
  );
}
