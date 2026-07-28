/**
 * ============================================================================
 * PARENT PORTAL — FedaPay Integration Helper
 * ============================================================================
 *
 * Helper pour intégrer le widget FedaPay Checkout dans le portail parent.
 *
 * Flux :
 *   1. Récupérer la clé publique FedaPay configurée par l'école
 *      → GET /api/finance/payments/fedapay/public-key
 *   2. Charger le script FedaPay Checkout (cdn.fedapay.com/checkout.js)
 *   3. Initialiser le widget avec amount + description + customer
 *   4. Sur onComplete (paiement réussi) :
 *      - Créer la FinanceTransaction côté backend
 *        → POST /api/finance/transactions
 *      - Le solde StudentAccount est mis à jour automatiquement
 *
 * Réutilise le même pattern que NewPaymentModal.tsx (admin) pour cohérence.
 * ============================================================================
 */

export interface FedaPayPaymentParams {
  amount: number;
  studentAccountId: string;
  academicYearId: string;
  studentFirstName?: string;
  studentLastName?: string;
  studentMatricule?: string;
}

export interface FedaPayPaymentResult {
  success: boolean;
  reference?: string;
  receiptNumber?: string;
  transactionId?: string;
  error?: string;
}

/**
 * Charge le script FedaPay Checkout depuis le CDN (une seule fois).
 */
async function loadFedaPayScript(): Promise<void> {
  if ((window as any).FedaPay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.fedapay.com/checkout.js?v=1.1.7';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Impossible de charger FedaPay'));
    document.head.appendChild(script);
  });
}

/**
 * Récupère la clé publique FedaPay configurée par l'école.
 * Si non configurée → lance une erreur explicite.
 */
async function getFedaPayPublicKey(): Promise<string> {
  const res = await fetch('/api/finance/payments/fedapay/public-key', {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Impossible de récupérer la configuration FedaPay');
  }
  const data = await res.json();
  if (!data.publicKey) {
    throw new Error(
      "L'école n'a pas configuré FedaPay. Contactez l'administration pour activer le paiement en ligne.",
    );
  }
  return data.publicKey;
}

/**
 * Crée la transaction côté backend après confirmation FedaPay.
 */
async function createTransaction(
  reference: string,
  params: FedaPayPaymentParams,
): Promise<{ id?: string; receiptNumber?: string }> {
  const res = await fetch('/api/finance/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      academicYearId: params.academicYearId,
      studentAccountId: params.studentAccountId,
      amount: params.amount,
      paymentMethod: 'FEDAPAY',
      reference,
      notes: `Paiement en ligne — Portail Parent (${params.studentMatricule || 'élève'})`,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Erreur lors de la création de la transaction');
  }
  return await res.json();
}

/**
 * Ouvre le widget FedaPay pour un paiement de scolarité parent.
 *
 * Retourne une promesse qui se résout quand le paiement est confirmé
 * (et la transaction créée côté backend) ou se rejette si le parent
 * annule ou si une erreur survient.
 *
 * @example
 * const result = await openFedaPayCheckout({
 *   amount: 50000,
 *   studentAccountId: '...',
 *   academicYearId: '...',
 *   studentFirstName: 'Koffi',
 *   studentLastName: 'Amoussou',
 * });
 * if (result.success) {
 *   toast.success(`Paiement confirmé — Reçu ${result.receiptNumber}`);
 * }
 */
export async function openFedaPayCheckout(
  params: FedaPayPaymentParams,
): Promise<FedaPayPaymentResult> {
  try {
    // 1. Charger le script + récupérer la clé publique en parallèle
    await loadFedaPayScript();
    const publicKey = await getFedaPayPublicKey();

    const FedaPay = (window as any).FedaPay;

    // 2. Ouvrir le widget
    return await new Promise<FedaPayPaymentResult>((resolve) => {
      const studentName = `${params.studentFirstName || ''} ${params.studentLastName || ''}`.trim() || 'Élève';

      const widget = FedaPay.init({
        public_key: publicKey,
        transaction: {
          amount: params.amount,
          description: `Scolarité ${studentName}`.substring(0, 100),
        },
        customer: {
          firstname: params.studentFirstName || '',
          lastname: params.studentLastName || '',
        },
        onComplete: async (response: any) => {
          // Annulation par l'utilisateur
          if (
            response?.reason === 'DIALOG DISMISSED' ||
            response?.reason === 'USERCANCELLED'
          ) {
            resolve({
              success: false,
              error: 'Paiement annulé par l\'utilisateur',
            });
            return;
          }

          // Paiement réussi — créer la transaction côté backend
          const fedapayReference =
            response?.reference || response?.id || `FEDAPAY-${Date.now()}`;

          try {
            const tx = await createTransaction(fedapayReference, params);
            resolve({
              success: true,
              reference: fedapayReference,
              receiptNumber: tx.receiptNumber || fedapayReference,
              transactionId: tx.id,
            });
          } catch (err: any) {
            // Le paiement FedaPay a réussi mais la transaction n'a pas pu être
            // créée côté backend — on signale l'erreur au parent tout en
            // conservant la référence FedaPay pour le support.
            resolve({
              success: false,
              reference: fedapayReference,
              error: `Paiement reçu (réf. ${fedapayReference}) mais transaction non enregistrée : ${err.message}. Contactez l'administration.`,
            });
          }
        },
      });

      widget.open();
    });
  } catch (e: any) {
    return {
      success: false,
      error: e.message || 'Erreur lors de l\'initialisation du paiement',
    };
  }
}
