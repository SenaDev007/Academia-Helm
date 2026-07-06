'use client';

/**
 * ============================================================================
 * RECEIPT IMAGE COPY — Bouton "Copier le reçu en image" pour WhatsApp
 * ============================================================================
 *
 * Workflow utilisateur :
 *   1. Le comptable clique sur "WhatsApp (image)" dans la liste des reçus
 *   2. Le composant télécharge le PDF du reçu depuis le backend
 *   3. Convertit la page 1 du PDF en PNG haute résolution (pdfjs-dist via CDN)
 *   4. Copie le PNG dans le presse-papier (si supporté par le navigateur)
 *      OU télécharge le PNG automatiquement (fallback Firefox)
 *   5. Ouvre wa.me/<phone>?text=... dans un nouvel onglet
 *   6. Le comptable fait Ctrl+V dans WhatsApp Web → l'image du reçu est collée
 *
 * Compatibilité :
 *   - Chrome, Edge, Safari : copie dans le presse-papier ✅
 *   - Firefox : auto-download du PNG (l'utilisateur l'attache manuellement)
 *
 * Endpoints backend :
 *   GET /api/finance/transactions/:id/receipt.pdf → PDF du reçu
 *   GET /api/finance/transactions/:id/whatsapp-link → { phone, message }
 * ============================================================================
 */

import { useState } from 'react';
import { Image as ImageIcon, Loader2, ClipboardPaste, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  pdfToPng,
  copyPngToClipboard,
  downloadBlob,
  isClipboardImageSupported,
  receiptFilename,
} from '@/lib/pdf/pdf-to-png';

interface ReceiptImageCopyProps {
  /** ID de la transaction (pour télécharger le PDF) */
  transactionId: string;
  /** Numéro de reçu pour le nom de fichier et le message WhatsApp */
  receiptNumber: string;
  /** Montant payé (inclus dans le message WhatsApp) */
  amount?: number;
  /** Nom de l'élève (inclus dans le message WhatsApp) */
  studentName?: string;
  /** Style compact (icône seule) ou avec label */
  compact?: boolean;
  /** Callback optionnel après ouverture de WhatsApp */
  onOpened?: () => void;
}

type Status = 'idle' | 'fetching' | 'converting' | 'copying' | 'done' | 'error';

export default function ReceiptImageCopy({
  transactionId,
  receiptNumber,
  amount,
  studentName,
  compact = false,
  onOpened,
}: ReceiptImageCopyProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const clipboardSupported = typeof window !== 'undefined' && isClipboardImageSupported();

  const handleClick = async () => {
    if (status === 'fetching' || status === 'converting' || status === 'copying') return;

    setStatus('fetching');
    setErrorMessage(null);

    try {
      // 1. Télécharger le PDF du reçu
      const pdfRes = await fetch(`/api/finance/transactions/${transactionId}/receipt.pdf`, {
        credentials: 'include',
      });
      if (!pdfRes.ok) {
        throw new Error(`Reçu introuvable (HTTP ${pdfRes.status})`);
      }
      const pdfBuffer = await pdfRes.arrayBuffer();

      setStatus('converting');

      // 2. Convertir PDF → PNG
      const { blob: pngBlob, width, height } = await pdfToPng(pdfBuffer, {
        scale: 2,
        maxWidth: 1240,
      });

      setStatus('copying');

      // 3. Copier dans le presse-papier (ou télécharger en fallback)
      let copied = false;
      if (clipboardSupported) {
        copied = await copyPngToClipboard(pngBlob);
      }

      if (!copied) {
        // Fallback : télécharger le PNG
        downloadBlob(pngBlob, receiptFilename(receiptNumber, 'png'));
      }

      // 4. Récupérer le téléphone parent et le message WhatsApp pré-rempli
      let waUrl = '';
      try {
        const linkRes = await fetch(
          `/api/finance/transactions/${transactionId}/whatsapp-link`,
          { credentials: 'include' },
        );
        const linkData = await linkRes.json();
        const phone = (linkData?.phone || '').replace(/\D/g, '');
        const message =
          linkData?.message ||
          `Bonjour, voici le reçu ${receiptNumber}${
            amount ? ` d'un montant de ${amount.toLocaleString('fr-FR')} FCFA` : ''
          }${studentName ? ` pour ${studentName}` : ''}. Merci.`;
        waUrl = phone
          ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
          : `https://wa.me/?text=${encodeURIComponent(message)}`;
      } catch {
        // Si l'endpoint échoue, on ouvre WhatsApp sans pre-fill
        waUrl = 'https://wa.me/';
      }

      // 5. Ouvrir WhatsApp Web dans un nouvel onglet
      window.open(waUrl, '_blank', 'noopener,noreferrer');

      setStatus('done');
      onOpened?.();

      // Toast informatif
      if (copied) {
        toast({
          title: '✅ Reçu copié dans le presse-papier',
          description: `Image ${width}×${height}px prête à coller. Faites Ctrl+V (ou Cmd+V sur Mac) dans WhatsApp Web.`,
        });
      } else {
        toast({
          title: '📥 Reçu téléchargé en PNG',
          description:
            "Votre navigateur ne supporte pas la copie d'image. Le PNG a été téléchargé — joignez-le manuellement dans WhatsApp.",
        });
      }

      // Reset status after 3s
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: any) {
      console.error('ReceiptImageCopy error:', err);
      setErrorMessage(err.message || 'Erreur inconnue');
      setStatus('error');
      toast({
        title: 'Erreur',
        description: err.message || 'Impossible de générer l image du reçu.',
        variant: 'destructive',
      });
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  const isLoading = status === 'fetching' || status === 'converting' || status === 'copying';

  const getLabel = () => {
    switch (status) {
      case 'fetching': return 'Téléchargement…';
      case 'converting': return 'Conversion…';
      case 'copying': return 'Copie…';
      case 'done': return 'Copié !';
      case 'error': return 'Erreur';
      default: return compact ? '' : 'WhatsApp (image)';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'fetching':
      case 'converting':
      case 'copying':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'done':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return clipboardSupported ? <ImageIcon className="w-4 h-4" /> : <Download className="w-4 h-4" />;
    }
  };

  const buttonClass = compact
    ? 'p-2 rounded-lg hover:bg-emerald-50 transition-colors text-emerald-700 border border-transparent hover:border-emerald-200'
    : 'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={buttonClass}
      title={
        clipboardSupported
          ? "Télécharge le PDF du reçu, le convertit en PNG et le copie dans le presse-papier pour coller dans WhatsApp Web"
          : "Télécharge le PNG du reçu (votre navigateur ne supporte pas la copie d'image dans le presse-papier)"
      }
    >
      {getIcon()}
      {!compact && <span>{getLabel()}</span>}
    </button>
  );
}
