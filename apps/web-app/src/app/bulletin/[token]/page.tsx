/**
 * Page publique de téléchargement d'un bulletin partagé par WhatsApp
 * ====================================================================
 *
 * URL: /bulletin/[token]
 *
 * Cette page est accessible SANS authentification. Elle télécharge
 * automatiquement le PDF du bulletin partagé par l'établissement via la
 * route BFF publique /api/exams/bulletins/public/[token] (même pattern que
 * la page /receipt/[token]/[id] du module finance — encaissement).
 *
 * Le token est un secret hex 48 caractères généré par le backend lors de la
 * préparation de l'envoi WhatsApp (table bulletin_pdf_shares, expiration
 * 30 jours) : le parent clique le lien reçu sur WhatsApp et le PDF démarre.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, FileText, Download, AlertCircle } from 'lucide-react';

export default function BulletinDownloadPage() {
  const params = useParams();
  const token = params.token as string;
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [fileName, setFileName] = useState<string>('bulletin.pdf');

  useEffect(() => {
    if (!token) return;

    async function downloadBulletin() {
      try {
        // Route BFF publique — le token EST l'authentification (secret).
        const res = await fetch(`/api/exams/bulletins/public/${token}`, {
          credentials: 'omit',
        });

        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          // Nom de fichier transmis par le backend (Content-Disposition) —
          // bulletin_[élève]_[typeEval]_[période].pdf
          const disposition = res.headers.get('content-disposition') || '';
          const match = /filename="([^"]+)"/.exec(disposition);
          const name = match?.[1] || `bulletin-${token.substring(0, 8)}.pdf`;
          a.download = name;
          setFileName(name);
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setStatus('success');
          return;
        }

        // Erreur métier du backend (lien expiré, inconnu…)
        let detail = '';
        try {
          const j = await res.json();
          detail = String(j?.detail || j?.message || '');
        } catch { /* corps non-JSON */ }
        setErrorMessage(
          detail ||
            `Bulletin indisponible (HTTP ${res.status}). Contactez l'établissement.`,
        );
        setStatus('error');
      } catch (e: any) {
        setErrorMessage(`Erreur : ${e?.message || e}`);
        setStatus('error');
      }
    }

    downloadBulletin();
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Téléchargement du bulletin en cours…</p>
          <p className="text-xs text-slate-400 mt-2">Veuillez patienter quelques instants</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Bulletin téléchargé</h1>
          <p className="text-sm text-slate-600 mb-1">
            Le bulletin PDF ({fileName}) a été téléchargé. Vérifiez votre dossier de téléchargements.
          </p>
          <p className="text-xs text-slate-400 mb-4">
            Ce lien reste valable 30 jours après l&apos;envoi par l&apos;établissement.
          </p>
          <button
            onClick={() => window.close()}
            className="text-sm text-blue-600 hover:underline"
          >
            Fermer cette fenêtre
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Bulletin non disponible</h1>
        <p className="text-sm text-slate-600">{errorMessage}</p>
        <p className="text-xs text-slate-400 mt-4">
          Si le problème persiste, contactez l&apos;établissement scolaire pour un nouvel envoi.
        </p>
      </div>
    </div>
  );
}
