/**
 * ============================================================================
 * PUBLIC RECEIPT VERIFICATION PAGE - VÉRIFICATION REÇU QR CODE
 * ============================================================================
 * 
 * Page publique pour vérifier un reçu via un token QR Code
 * Aucune authentification requise - Données de vérification uniquement
 * 
 * ============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, XCircle, FileText, Calendar, Building, AlertCircle } from 'lucide-react';

interface ReceiptData {
  receiptNumber: string;
  date: string;
  student: {
    name: string;
    matricule: string;
  };
  amount: number;
  academicYear: string;
}

export default function PublicReceiptVerificationPage() {
  const params = useParams();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Token manquant');
      return;
    }

    verifyReceipt();
  }, [token]);

  const verifyReceipt = async () => {
    try {
      setLoading(true);
      const { getApiBaseUrl } = await import('@/lib/utils/urls');
      const apiUrl = getApiBaseUrl();
      const response = await fetch(
        `${apiUrl}/receipts/public/verify/${token}`
      );

      if (!response.ok) {
        throw new Error('Erreur de vérification');
      }

      const data = await response.json();

      if (!data.isValid) {
        setValid(false);
        setError(data.message || 'Token invalide');
      } else {
        setValid(true);
        setReceipt(data.receipt);
      }
    } catch (err) {
      console.error('Error verifying receipt:', err);
      setError('Erreur lors de la vérification');
      setValid(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Vérification en cours...</p>
        </div>
      </div>
    );
  }

  if (!valid || !receipt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Vérification échouée
          </h1>
          <p className="text-gray-600 mb-4">
            {error || 'Ce token de vérification est invalide.'}
          </p>
          <p className="text-sm text-gray-500">
            Veuillez vérifier le QR Code ou contacter l'établissement.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="bg-green-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-8 h-8 text-white" />
                <div>
                  <h1 className="text-xl font-bold text-white">
                    Reçu Vérifié
                  </h1>
                  <p className="text-green-100 text-sm">
                    Reçu de paiement officiel
                  </p>
                </div>
              </div>
              <div className="bg-white px-3 py-1 rounded-full">
                <span className="text-green-600 text-sm font-semibold">VALIDÉ</span>
              </div>
            </div>
          </div>

          {/* Receipt Information */}
          <div className="p-6">
            <div className="space-y-6">
              {/* Receipt Number */}
              <div className="text-center border-b border-gray-200 pb-4">
                <p className="text-sm text-gray-600 mb-1">Numéro de reçu</p>
                <p className="text-2xl font-bold text-gray-900 font-mono">
                  {receipt.receiptNumber}
                </p>
              </div>

              {/* Student Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Informations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Élève</p>
                    <p className="font-medium text-gray-900">{receipt.student.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Matricule</p>
                    <p className="font-medium text-gray-900 font-mono">{receipt.student.matricule}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Montant</p>
                    <p className="font-bold text-green-600 text-lg">
                      {receipt.amount.toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Année scolaire</p>
                    <p className="font-medium text-gray-900">{receipt.academicYear}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Date d'émission</p>
                    <p className="font-medium text-gray-900">
                      {new Date(receipt.date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Notice */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Informations protégées</p>
              <p>
                Cette page affiche uniquement les informations de vérification du reçu.
                Pour consulter le détail complet, veuillez vous connecter à votre espace parent.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

