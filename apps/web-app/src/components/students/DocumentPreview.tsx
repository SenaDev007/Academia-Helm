'use client';

/**
 * Composant de prévisualisation de document.
 *
 * Pattern exact du module RH (contracts/[id]/page.tsx) :
 *   1. fetch avec credentials: 'include' + Authorization header explicite
 *   2. response.blob()
 *   3. URL.createObjectURL(blob)
 *   4. <iframe src={blobUrl}>
 */

import { useState, useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';

interface DocumentPreviewProps {
  url: string;
  mimeType: string;
}

export default function DocumentPreview({ url, mimeType }: DocumentPreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    setStatus('loading');
    setBlobUrl(null);
    setErrorMsg('');

    let currentBlobUrl: string | null = null;

    async function loadDoc() {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { ...getClientAuthorizationHeader() },
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          let msg = `Erreur ${response.status}`;
          try {
            const parsed = JSON.parse(text);
            msg = parsed.error || parsed.message || msg;
          } catch {
            if (text) msg = text.slice(0, 200);
          }
          setErrorMsg(msg);
          setStatus('error');
          return;
        }

        const blob = await response.blob();
        if (blob.size === 0) {
          setErrorMsg('Le document est vide (0 octet)');
          setStatus('error');
          return;
        }

        currentBlobUrl = URL.createObjectURL(blob);
        setBlobUrl(currentBlobUrl);
        setStatus('ok');
      } catch (err: any) {
        setErrorMsg(err?.message || 'Échec de connexion');
        setStatus('error');
      }
    }

    loadDoc();

    return () => {
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    };
  }, [url]);

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="p-4 bg-rose-50 rounded-full mb-4">
          <AlertCircle className="w-12 h-12 text-rose-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-700 mb-2">Échec de chargement du document</h3>
        <p className="text-sm text-slate-500 max-w-md mb-2">{errorMsg}</p>
        <p className="text-xs text-slate-400 max-w-md">
          Si le problème persiste, essayez le bouton &quot;Télécharger&quot;.
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

  // status === 'ok' — afficher avec le blob URL
  if (mimeType.startsWith('image/')) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <img src={blobUrl} alt="Document" className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
      </div>
    );
  }

  // PDF → iframe avec blob URL (pattern RH)
  return (
    <iframe
      src={blobUrl}
      className="w-full h-full border-0"
      title="Document"
    />
  );
}
