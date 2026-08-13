'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { FileText, PenTool, Send, CheckCircle2, Loader2, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { SignatureCanvas } from '@/app/app/hr/_components/onboarding/components/SignatureCanvas';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';

interface ContractStepProps {
  draftId: string;
  schoolName: string;
  promoterName: string;
  directorName?: string;
  schoolAddress: string;
  schoolCity: string;
  schoolPhone: string;
  schoolEmail: string;
  studentCount: number;
  planCode: string;
  planName: string;
  bilingual: boolean;
  subdomain: string;
  activationFee: number;
  annualFee: number;
  onComplete: (result: { signed: boolean; contractUrl?: string }) => void;
  onBack: () => void;
}

/**
 * Étape Contrat du flow d'onboarding.
 *
 * Affiche le contrat d'abonnement avec :
 * - Aperçu du contrat (HTML généré par le backend)
 * - Canvas de signature pour le promoteur (Client)
 * - Canvas de signature pour le prestataire (YEHI OR Tech — admin)
 * - Deux options : "Signer maintenant" ou "Envoyer par email pour signature différée"
 *
 * Quand les deux parties signent → le contrat PDF est généré avec les signatures
 * intégrées, et le promoteur reçoit un email avec le contrat + ses credentials.
 */
export default function ContractStep({
  draftId,
  schoolName,
  promoterName,
  directorName,
  schoolAddress,
  schoolCity,
  schoolPhone,
  schoolEmail,
  studentCount,
  planCode,
  planName,
  bilingual,
  subdomain,
  activationFee,
  annualFee,
  onComplete,
  onBack,
}: ContractStepProps) {
  const [promoterSignature, setPromoterSignature] = useState<string | null>(null);
  const [providerSignature, setProviderSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [contractUrl, setContractUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const totalYearOne = activationFee + annualFee;
  const effectiveDate = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // Générer l'aperçu du contrat
  const generatePreview = async () => {
    setLoading(true);
    try {
      const authHeaders = getClientAuthorizationHeader();
      const response = await fetch('/api/onboarding/contract/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          schoolName,
          promoterName,
          directorName,
          schoolAddress,
          schoolCity,
          schoolPhone,
          schoolEmail,
          studentCount,
          planCode,
          planName,
          bilingual,
          subdomain,
          effectiveDate,
          activationFee,
          annualFee,
          totalYearOne,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setPreviewUrl(data.fileUrl);
      toast({ title: '✅ Aperçu généré', description: 'Le contrat est prêt à être signé.' });
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err.message || 'Échec de la génération du contrat',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Signer le contrat (les deux parties)
  const handleSignNow = async () => {
    if (!promoterSignature) {
      toast({
        title: 'Signature manquante',
        description: 'Le promoteur doit signer le contrat.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const authHeaders = getClientAuthorizationHeader();
      const response = await fetch('/api/onboarding/contract/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          draftId,
          promoterSignature,
          providerSignature: providerSignature || undefined,
          signLater: false,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      toast({
        title: '✅ Contrat signé',
        description: 'Le contrat signé a été envoyé par email au promoteur avec les identifiants de connexion.',
      });

      onComplete({ signed: true, contractUrl: data.contractUrl });
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err.message || 'Échec de la signature',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Envoyer pour signature différée
  const handleSendForLater = async () => {
    setLoading(true);
    try {
      const authHeaders = getClientAuthorizationHeader();
      const response = await fetch('/api/onboarding/contract/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          draftId,
          promoterSignature: null,
          signLater: true,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      toast({
        title: '✅ Lien envoyé',
        description: 'Le promoteur recevra un email avec le lien pour signer le contrat.',
      });

      onComplete({ signed: false });
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err.message || 'Échec de l\'envoi',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl mb-4 shadow-lg">
          <FileText className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Contrat d'abonnement</h2>
        <p className="text-sm text-gray-600 mt-2">
          Contrat d'abonnement et de licence d'utilisation de la plateforme SaaS Academia Helm
        </p>
      </div>

      {/* Récapitulatif */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">École :</span> <strong>{schoolName}</strong></div>
          <div><span className="text-gray-500">Promoteur :</span> <strong>{promoterName}</strong></div>
          <div><span className="text-gray-500">Plan :</span> <strong>{planName}</strong></div>
          <div><span className="text-gray-500">Élèves :</span> <strong>{studentCount}</strong></div>
          <div><span className="text-gray-500">Activation :</span> <strong>{activationFee.toLocaleString('fr-FR')} FCFA</strong></div>
          <div><span className="text-gray-500">Abonnement annuel :</span> <strong>{annualFee.toLocaleString('fr-FR')} FCFA/an</strong></div>
          <div className="col-span-2"><span className="text-gray-500">Coût total Année 1 :</span> <strong className="text-blue-700">{totalYearOne.toLocaleString('fr-FR')} FCFA</strong></div>
        </div>
      </div>

      {/* Bouton aperçu */}
      {!previewUrl && (
        <div className="text-center mb-6">
          <Button
            onClick={generatePreview}
            disabled={loading}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
            Générer l'aperçu du contrat
          </Button>
        </div>
      )}

      {/* Aperçu du contrat */}
      {previewUrl && (
        <div className="mb-6">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Aperçu du contrat</span>
              <a
                href={previewUrl}
                target="_blank"
                className="text-xs text-blue-600 hover:underline"
              >
                Ouvrir en plein écran
              </a>
            </div>
            <iframe
              src={previewUrl}
              className="w-full"
              style={{ height: '500px', border: 'none' }}
              title="Aperçu du contrat"
            />
          </div>
        </div>
      )}

      {/* Signatures */}
      {previewUrl && (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
              <PenTool className="w-4 h-4" />
              Signatures électroniques
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Signature promoteur */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Signature du Promoteur ({promoterName})
                </label>
                <SignatureCanvas
                  width={350}
                  height={140}
                  onSignatureChange={setPromoterSignature}
                  placeholder="Signez ici avec votre souris ou doigt"
                />
              </div>

              {/* Signature prestataire (admin) */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Signature du Prestataire (YEHI OR Tech)
                </label>
                <SignatureCanvas
                  width={350}
                  height={140}
                  onSignatureChange={setProviderSignature}
                  placeholder="Signature du représentant YEHI OR Tech"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={handleSignNow}
              disabled={loading || !promoterSignature}
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Signer maintenant
            </Button>
            <Button
              onClick={handleSendForLater}
              disabled={loading}
              size="lg"
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <Send className="w-4 h-4 mr-2" />
              Envoyer pour signature différée
            </Button>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={onBack}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Retour
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
