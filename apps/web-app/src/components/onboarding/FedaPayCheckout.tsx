/**
 * ============================================================================
 * FEDAPAY CHECKOUT COMPONENT - CHECKOUT INTÉGRÉ
 * ============================================================================
 * 
 * Composant pour afficher le checkout FedaPay intégré dans la page.
 * Même avec des infos client partielles (ex. pas de téléphone), le formulaire s'ouvre
 * et l'utilisateur peut compléter ou modifier (ex. utiliser un autre numéro Mobile Money).
 * Documentation : https://docs-v1.fedapay.com/payments/checkout
 * Exemple : https://github.com/fedapay-samples/sample-node
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader } from 'lucide-react';

declare global {
  interface Window {
    FedaPay: {
      init: (config: {
        public_key: string;
        transaction: {
          amount: number;
          description: string;
          // currency n'est PAS dans l'objet transaction pour le checkout intégré
          // Il est géré par l'API backend lors de la création de la transaction
        };
        customer: {
          email: string;
          lastname: string;
          firstname?: string;
          phone_number?: string;
        };
        container: string;
        onComplete?: (transaction: any) => void;
        onError?: (error: any) => void;
      }) => void;
    };
  }
}

interface FedaPayCheckoutProps {
  publicKey: string;
  transaction: {
    amount: number;
    description: string;
    // currency n'est PAS dans l'objet transaction pour le checkout intégré
    // Il est géré par l'API backend lors de la création de la transaction
  };
  /** Infos client (optionnelles). Si partielles, l'utilisateur peut compléter dans le formulaire FedaPay (ex. autre numéro). */
  customer: {
    email?: string;
    lastname?: string;
    firstname?: string;
    phone_number?: string;
  };
  onComplete?: (transaction: any) => void;
  onError?: (error: any) => void;
}

export default function FedaPayCheckout({
  publicKey,
  transaction,
  customer,
  onComplete,
  onError,
}: FedaPayCheckoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Charger le script checkout.js de FedaPay
  useEffect(() => {
    // Vérifier si le script est déjà chargé
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
      // Nettoyer le script si le composant est démonté
      const existingScript = document.querySelector('script[src*="checkout.js"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  // Initialiser le checkout FedaPay une fois le script chargé
  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !publicKey) {
      return;
    }

    try {
      if (!window.FedaPay) {
        setError('FedaPay n\'est pas disponible');
        return;
      }

      // Initialiser le checkout FedaPay selon la documentation officielle
      // Documentation : https://docs-v1.fedapay.com/payments/checkout
      // Structure conforme : { public_key, transaction: { amount, description }, customer: { email, lastname, ... }, container }
      // Note: currency est géré par l'API backend lors de la création de la transaction
      // Pour le checkout intégré, currency n'est PAS dans l'objet transaction selon la doc
      const checkoutConfig = {
        public_key: publicKey,
        transaction: {
          amount: transaction.amount,
          description: transaction.description,
          // currency n'est PAS inclus ici car géré par l'API backend
        },
        customer: {
          email: customer?.email ?? '',
          lastname: customer?.lastname ?? '',
          ...(customer?.firstname && { firstname: customer.firstname }),
          ...(customer?.phone_number && { phone_number: customer.phone_number }),
        },
        container: '#fedapay-checkout-container',
        onComplete: async (transactionData: any) => {
          console.log('📥 Callback FedaPay reçu:', transactionData);
          // ⚠️ IMPORTANT : Ne pas faire confiance au callback frontend
          // Le backend doit vérifier le statut réel via l'API FedaPay
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
      };
      
      window.FedaPay.init(checkoutConfig);

      // Forcer une hauteur très grande pour que tout le contenu FedaPay soit visible sans scroll
      const ensureFullHeight = () => {
        const container = document.getElementById('fedapay-checkout-container');
        if (!container) return;
        
        // Conteneur sans contrainte
        container.style.height = 'auto';
        container.style.minHeight = 'auto';
        container.style.maxHeight = 'none';
        container.style.overflow = 'visible';
        
        // Iframe avec hauteur très grande pour éviter le scroll interne (FedaPay définit sa propre hauteur dans l'iframe)
        const iframe = container.querySelector('iframe');
        if (iframe) {
          (iframe as HTMLIFrameElement).style.height = '2000px';
          (iframe as HTMLIFrameElement).style.minHeight = '2000px';
          (iframe as HTMLIFrameElement).style.maxHeight = 'none';
          (iframe as HTMLIFrameElement).style.overflow = 'visible';
        }
      };
      
      ensureFullHeight();
      const timer1 = setTimeout(ensureFullHeight, 300);
      const timer2 = setTimeout(ensureFullHeight, 1000);
      const timer3 = setTimeout(ensureFullHeight, 2500);
      const observer = new MutationObserver(() => ensureFullHeight());
      const el = document.getElementById('fedapay-checkout-container');
      if (el) observer.observe(el, { childList: true, subtree: true });
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        observer.disconnect();
      };
    } catch (err: any) {
      console.error('Erreur lors de l\'initialisation du checkout FedaPay:', err);
      setError(err.message || 'Erreur lors de l\'initialisation du paiement');
      if (onError) {
        onError(err);
      }
    }
  }, [scriptLoaded, publicKey, transaction, customer, onComplete, onError]);

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
      <div className="p-6 bg-red-50 border-2 border-red-300 rounded-xl">
        <p className="text-sm text-red-800 font-medium">{error}</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        #fedapay-checkout-container {
          height: auto !important;
          min-height: auto !important;
          max-height: none !important;
          overflow: visible !important;
        }
        #fedapay-checkout-container iframe {
          height: 2000px !important;
          min-height: 2000px !important;
          max-height: none !important;
          overflow: visible !important;
        }
      `}</style>
      <div id="fedapay-checkout-container" ref={containerRef} className="w-full" />
    </>
  );
}
