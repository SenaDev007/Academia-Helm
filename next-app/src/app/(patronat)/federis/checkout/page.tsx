/**
 * Page Checkout Federis
 * 
 * Activation du compte Federis via paiement Fedapay
 * Abonnement mensuel
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FederisHeader from '@/components/federis/FederisHeader';
import AppIcon from '@/components/ui/AppIcon';
import Image from 'next/image';

export default function FederisCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [federisName, setFederisName] = useState('');

  useEffect(() => {
    // Récupérer le nom du federis depuis les paramètres ou le localStorage
    const name = searchParams.get('name') || localStorage.getItem('federis_name') || '';
    setFederisName(name);
  }, [searchParams]);

  const handlePayment = async () => {
    setLoading(true);
    try {
      // TODO: Intégration Fedapay
      // 1. Créer la session de paiement
      // 2. Rediriger vers Fedapay
      // 3. Gérer le callback de retour
      
      // Pour l'instant, simulation
      const response = await fetch('/api/federis/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          federisName,
          amount: 50000, // 50 000 FCFA / mois
          plan: 'PATRONAT_MONTHLY',
        }),
      });

      if (response.ok) {
        const { paymentUrl } = await response.json();
        // Redirection vers Fedapay
        window.location.href = paymentUrl;
      } else {
        throw new Error('Erreur lors de la création de la session de paiement');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <FederisHeader />
      <div className="pt-20 pb-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Activation du compte Federis
            </h1>
            <p className="text-gray-600">
              Finalisez votre inscription en activant votre abonnement
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            {/* Carte Offre */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Offre Federis Examens Nationaux
              </h2>
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Abonnement Mensuel
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Accès complet à la plateforme de gestion des examens
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-blue-700">50 000</div>
                    <div className="text-sm text-gray-600">FCFA / mois</div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">
                    Ce que comprend l'abonnement :
                  </h4>
                  <ul className="space-y-2">
                    {[
                      'Gestion complète des examens nationaux',
                      'Rattachement illimité d\'écoles',
                      'Inscription et suivi des candidats',
                      'Génération automatique des listes de surveillance',
                      'Banque d\'épreuves partagée',
                      'Relevés de notes sécurisés',
                      'ORION - Analyse et alertes',
                      'Support technique inclus',
                    ].map((feature, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <AppIcon name="success" size="submenu" className="text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Informations Paiement */}
            <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <AppIcon name="info" size="menu" className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Informations importantes :</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800">
                    <li>Paiement sécurisé via Fedapay</li>
                    <li>Aucun prélèvement automatique</li>
                    <li>Rappels avant échéance (J-7, J-3, J-1)</li>
                    <li>Données conservées en cas de suspension</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Logo Fedapay */}
            <div className="mb-6 text-center">
              <Image
                src="/images/logoFedaPay.png"
                alt="Fedapay - Paiement sécurisé"
                width={120}
                height={48}
                className="h-10 w-auto mx-auto"
              />
            </div>

            {/* Bouton Paiement */}
            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full px-6 py-4 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Traitement...
                </>
              ) : (
                <>
                  Payer avec Fedapay
                  <AppIcon name="arrowRight" size="action" className="text-white" />
                </>
              )}
            </button>

            {/* Lien retour */}
            <div className="mt-6 text-center">
              <button
                onClick={() => router.back()}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Retour
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

