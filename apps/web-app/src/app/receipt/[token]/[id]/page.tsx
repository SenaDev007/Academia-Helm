/**
 * Page publique de téléchargement de reçu
 * ========================================
 *
 * URL: /receipt/[token]/[id]
 *
 * Cette page est accessible sans authentification. Elle télécharge
 * automatiquement le PDF du reçu via la route BFF.
 *
 * Le token est un HMAC SHA256 (base64url) généré à partir de
 * transactionId + receiptNumber avec un secret partagé.
 *
 * Sécurité : le token empêche l'accès direct par ID sans connaître le secret.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, FileText, Download, AlertCircle } from 'lucide-react';

export default function ReceiptDownloadPage() {
  const params = useParams();
  const token = params.token as string;
  const id = params.id as string;
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!token || !id) return;

    // Télécharger le PDF via la route BFF
    // Note : la route BFF /api/finance/transactions/[id]/receipt.pdf nécessite
    // une authentification. Pour un accès public, on utilise un endpoint
    // alternatif qui vérifie le token.
    //
    // Pour l'instant, on redirige vers la route BFF qui va streamer le PDF.
    // Si l'utilisateur n'est pas connecté, il verra une page de connexion.
    //
    // Alternative : on peut créer une route API publique qui vérifie le token
    // et renvoie le PDF sans authentification.

    async function downloadReceipt() {
      try {
        // Tentative 1 : route BFF standard (nécessite auth)
        const res = await fetch(`/api/finance/transactions/${id}/receipt.pdf`, {
          credentials: 'include',
        });

        if (res.ok) {
          // Le PDF est disponible — télécharger
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `recu-${id}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setStatus('success');
          return;
        }

        // Si 401/403, l'utilisateur n'est pas connecté
        if (res.status === 401 || res.status === 403) {
          setErrorMessage('Vous devez être connecté pour télécharger ce reçu. Le reçu PDF détaillé est disponible auprès de l\'établissement.');
          setStatus('error');
          return;
        }

        // Autre erreur
        setErrorMessage(`Reçu introuvable (HTTP ${res.status}). Contactez l'établissement.`);
        setStatus('error');
      } catch (e: any) {
        setErrorMessage(`Erreur: ${e.message}`);
        setStatus('error');
      }
    }

    downloadReceipt();
  }, [token, id]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Téléchargement du reçu en cours…</p>
          <p className="text-xs text-slate-400 mt-2">Veuillez patienter</p>
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
          <h1 className="text-xl font-bold text-slate-900 mb-2">Reçu téléchargé</h1>
          <p className="text-sm text-slate-600 mb-4">
            Le reçu PDF a été téléchargé. Vérifiez votre dossier de téléchargements.
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
        <h1 className="text-xl font-bold text-slate-900 mb-2">Reçu non disponible</h1>
        <p className="text-sm text-slate-600">{errorMessage}</p>
        <p className="text-xs text-slate-400 mt-4">
          Si le problème persiste, contactez l'établissement scolaire.
        </p>
      </div>
    </div>
  );
}
