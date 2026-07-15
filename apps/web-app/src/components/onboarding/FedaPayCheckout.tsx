/**
 * ============================================================================
 * FEDAPAY CHECKOUT COMPONENT - MODAL OVERLAY
 * ============================================================================
 *
 * ⭐ Le widget FedaPay s'ouvre en MODAL OVERLAY au-dessus de la page,
 * PAS en inline dans le formulaire.
 *
 * Selon la documentation FedaPay (https://docs-v1.fedapay.com/paiements/checkout),
 * si on NE spécifie PAS de `container`, le widget s'ouvre en modal overlay.
 * Si on spécifie `container`, le widget s'intègre inline (problème actuel).
 *
 * On supprime donc le `container` pour retrouver le comportement modal.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader, X, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    FedaPay: {
      init: (config: any) => any;
    };
  }
}

interface FedaPayCheckoutProps {
  publicKey: string;
  transaction: {
    amount: number;
    description: string;
  };
  customer: {
    email?: string;
    lastname?: string;
    firstname?: string;
    phone_number?: string;
  };
  onComplete?: (transaction: any) => void;
  onError?: (error: any) => void;
  onClose?: () => void;
}

export default function FedaPayCheckout({
  publicKey,
  transaction,
  customer,
  onComplete,
  onError,
  onClose,
}: FedaPayCheckoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const widgetRef = useRef<any>(null);

  // Charger le script checkout.js de FedaPay
  useEffect(() => {
    if (document.querySelector('script[src*="checkout.js"]')) {
      setScriptLoaded(true);
      setIsLoading(false);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.fedapay.com/checkout.js?v=1.1.7';
    script.async = true;
    script.onload = () => {
      setScriptLoaded(true);
      setIsLoading(false);
    };
    script.onerror = () => {
      setError('Impossible de charger le script FedaPay');
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      const existingScript = document.querySelector('script[src*="checkout.js"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  // Initialiser le checkout FedaPay en MODAL (sans container)
  useEffect(() => {
    if (!scriptLoaded || !publicKey) {
      return;
    }

    try {
      if (!window.FedaPay) {
        setError('FedaPay n\'est pas disponible');
        return;
      }

      // ⭐ NE PAS spécifier de `container` → le widget s'ouvre en MODAL OVERLAY
      // au-dessus de la page, comme en sandbox.
      // Documentation : https://docs-v1.fedapay.com/paiements/checkout
      const checkoutConfig: any = {
        public_key: publicKey,
        transaction: {
          amount: transaction.amount,
          description: transaction.description,
        },
        customer: {
          email: customer?.email ?? '',
          lastname: customer?.lastname ?? '',
          ...(customer?.firstname && { firstname: customer.firstname }),
          ...(customer?.phone_number && { phone_number: customer.phone_number }),
        },
        // ⭐ PAS de `container` → modal overlay
        onComplete: async (transactionData: any) => {
          console.log('📥 Callback FedaPay reçu:', transactionData);
          if (onComplete) {
            onComplete(transactionData);
          }
        },
        onError: (errorData: any) => {
          console.error('❌ Erreur de paiement:', errorData);
          setError(errorData.message || 'Erreur lors du paiement');
          if (onError) {
            onError(errorData);
          }
        },
        onClose: () => {
          console.log('🔒 FedaPay modal closed');
          if (onClose) {
            onClose();
          }
        },
      };

      widgetRef.current = window.FedaPay.init(checkoutConfig);
    } catch (err: any) {
      console.error('Erreur lors de l\'initialisation du checkout FedaPay:', err);
      setError(err.message || 'Erreur lors de l\'initialisation du paiement');
      if (onError) {
        onError(err);
      }
    }
  }, [scriptLoaded, publicKey, transaction, customer, onComplete, onError, onClose]);

  // ⭐ Le widget s'ouvre en modal overlay — on affiche juste un loader
  // en attendant que le modal FedaPay apparaisse.
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-cloud rounded-xl border border-gray-200 shadow-sm">
        <Loader className="w-8 h-8 animate-spin text-blue-600 mb-4" />
        <p className="text-sm text-graphite-700">Chargement du formulaire de paiement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border-2 border-red-300 rounded-xl flex items-start">
        <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-red-800 font-medium">{error}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
            >
              Retour
            </button>
          )}
        </div>
      </div>
    );
  }

  // ⭐ Le modal FedaPay est ouvert — on affiche un message d'attente
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-cloud rounded-xl border border-gray-200 shadow-sm">
      <Loader className="w-8 h-8 animate-spin text-blue-600 mb-4" />
      <p className="text-sm text-graphite-700 font-medium">
        Formulaire de paiement ouvert
      </p>
      <p className="text-xs text-graphite-500 mt-1">
        Le modal de paiement FedaPay devrait apparaître au-dessus de cette page.
      </p>
      {onClose && (
        <button
          onClick={onClose}
          className="mt-4 text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Annuler le paiement
        </button>
      )}
    </div>
  );
}
