'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, PenTool, Send, CheckCircle2, Loader2, Crown, Calendar, User, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { SignatureCanvas } from '@/app/app/hr/_components/onboarding/components/SignatureCanvas';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { formatCurrency } from '@/lib/utils';

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

const PLAN_TABLE = [
  { name: 'Helm Essentiel', range: '1 à 50 élèves', activation: '300 000 FCFA', annual: '50 000 FCFA/an', total: '350 000 FCFA', code: 'SEED' },
  { name: 'Helm Croissance', range: '51 à 150 élèves', activation: '300 000 FCFA', annual: '75 000 FCFA/an', total: '375 000 FCFA', code: 'GROW' },
  { name: 'Helm Performance', range: '151 à 400 élèves', activation: '300 000 FCFA', annual: '100 000 FCFA/an', total: '400 000 FCFA', code: 'LEAD' },
  { name: 'Helm Institution', range: '401 élèves et +', activation: '300 000 FCFA', annual: '150 000 FCFA/an', total: '450 000 FCFA', code: 'NETWORK' },
];

const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

export default function ContractStep({
  draftId, schoolName, promoterName, directorName, schoolAddress, schoolCity,
  schoolPhone, schoolEmail, studentCount, planCode, planName, bilingual,
  subdomain, activationFee, annualFee, onComplete, onBack,
}: ContractStepProps) {
  const [promoterSignature, setPromoterSignature] = useState<string | null>(null);
  const [providerSignature, setProviderSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [contractGenerated, setContractGenerated] = useState(false);
  const { toast } = useToast();

  const totalYearOne = activationFee + annualFee + (bilingual ? 50000 : 0);
  const selectedPlan = PLAN_TABLE.find(p => p.code === planCode) || PLAN_TABLE[0];

  const handleSignNow = async () => {
    if (!promoterSignature) {
      toast({ title: 'Signature manquante', description: 'Le promoteur doit signer le contrat.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const authHeaders = getClientAuthorizationHeader();
      // Generate the contract with both signatures
      const genResponse = await fetch('/api/onboarding/contract/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          schoolName, promoterName, directorName: directorName || promoterName,
          schoolAddress, schoolCity, schoolPhone, schoolEmail,
          studentCount, planCode, planName, bilingual, subdomain,
          effectiveDate: today, activationFee, annualFee, totalYearOne,
          promoterSignatureDataUrl: promoterSignature,
          providerSignatureDataUrl: providerSignature,
          promoterSignedAt: new Date().toISOString(),
          providerSignedAt: providerSignature ? new Date().toISOString() : undefined,
        }),
      });

      if (!genResponse.ok) throw new Error(`HTTP ${genResponse.status}`);
      const genData = await genResponse.json();

      // Sign the contract (triggers school creation)
      const signResponse = await fetch('/api/onboarding/contract/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          draftId, promoterSignature, providerSignature: providerSignature || undefined,
          signLater: false,
        }),
      });

      if (!signResponse.ok) throw new Error(`HTTP ${signResponse.status}`);

      toast({
        title: '✅ Contrat signé',
        description: 'Le contrat signé a été envoyé par email avec les identifiants de connexion.',
      });
      onComplete({ signed: true, contractUrl: genData.fileUrl });
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendForLater = async () => {
    setLoading(true);
    try {
      const authHeaders = getClientAuthorizationHeader();
      const response = await fetch('/api/onboarding/contract/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ draftId, promoterSignature: null, signLater: true }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      toast({ title: '✅ Lien envoyé', description: 'Le promoteur recevra un email pour signer.' });
      onComplete({ signed: false });
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl mb-3 shadow-lg">
          <FileText className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Contrat d'abonnement</h2>
        <p className="text-sm text-gray-500 mt-1">Contrat d'abonnement et de licence d'utilisation — Academia Helm</p>
      </div>

      {/* Contract body — styled like a real document */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
        {/* Logos header */}
        <div className="bg-gradient-to-r from-[#0a1d3f] to-[#0b2f73] px-8 py-6 text-white">
          <div className="flex justify-between items-center">
            <div className="text-lg font-bold">YEHI OR <span className="text-[#f5b335]">Tech</span></div>
            <div className="text-lg font-bold">Academia <span className="text-[#f5b335]">Helm</span></div>
          </div>
          <div className="text-center mt-3">
            <h3 className="text-base font-bold uppercase tracking-wide">Contrat d'abonnement et de licence d'utilisation</h3>
            <p className="text-xs text-blue-200 mt-1">Référence : CT-AH-2026-{subdomain.toUpperCase()}</p>
          </div>
        </div>

        {/* Contract content */}
        <div className="px-8 py-6 space-y-4 text-sm text-gray-700 max-h-[500px] overflow-y-auto">
          {/* Entre les soussignés */}
          <div>
            <h4 className="font-bold text-[#0a1d3f] border-b border-gray-200 pb-1 mb-2">Entre les soussignés</h4>
            <p className="text-xs leading-relaxed">
              <strong>YEHI OR Tech</strong>, agence de développement digital et éditrice de la plateforme SaaS Academia Helm,
              dont le siège social est à Parakou, République du Bénin, représentée par son Directeur Technique et Co-fondateur,
              ci-après dénommée « <strong>le Prestataire</strong> ».
            </p>
            <p className="text-xs leading-relaxed mt-2">
              <strong>{schoolName}</strong>, représentée par son promoteur <strong>{promoterName}</strong>,
              ci-après désigné « <strong>le Client</strong> » ou « l'École ».
            </p>
          </div>

          {/* Article 1 — Fiche de souscription */}
          <div>
            <h4 className="font-bold text-[#0a1d3f] border-b border-gray-200 pb-1 mb-2">Article 1 — Fiche de souscription</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div><span className="text-gray-500">École :</span> <strong>{schoolName}</strong></div>
              <div><span className="text-gray-500">Promoteur :</span> <strong>{promoterName}</strong></div>
              <div><span className="text-gray-500">Ville :</span> {schoolCity}</div>
              <div><span className="text-gray-500">Téléphone :</span> {schoolPhone}</div>
              <div><span className="text-gray-500">Email :</span> {schoolEmail}</div>
              <div><span className="text-gray-500">Élèves :</span> <strong>{studentCount}</strong></div>
              <div><span className="text-gray-500">Plan :</span> <strong>{planName}</strong></div>
              <div><span className="text-gray-500">Bilingue :</span> {bilingual ? 'Oui' : 'Non'}</div>
              <div><span className="text-gray-500">Sous-domaine :</span> {subdomain}.academiahelm.com</div>
              <div><span className="text-gray-500">Date d'effet :</span> {today}</div>
            </div>
          </div>

          {/* Article 3 — Plan et grille tarifaire */}
          <div>
            <h4 className="font-bold text-[#0a1d3f] border-b border-gray-200 pb-1 mb-2">Article 3 — Plan souscrit et grille tarifaire</h4>
            <table className="w-full text-xs border border-gray-300">
              <thead className="bg-[#0a1d3f] text-white">
                <tr>
                  <th className="px-2 py-1 text-left">Plan</th>
                  <th className="px-2 py-1 text-left">Tranche</th>
                  <th className="px-2 py-1 text-right">Activation</th>
                  <th className="px-2 py-1 text-right">Frais annuels</th>
                  <th className="px-2 py-1 text-right">Total An 1</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_TABLE.map(p => (
                  <tr key={p.code} className={p.code === planCode ? 'bg-blue-50 font-bold' : ''}>
                    <td className="px-2 py-1">{p.name}{p.code === planCode && ' ☑'}</td>
                    <td className="px-2 py-1">{p.range}</td>
                    <td className="px-2 py-1 text-right">{p.activation}</td>
                    <td className="px-2 py-1 text-right">{p.annual}</td>
                    <td className="px-2 py-1 text-right">{p.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bilingual && (
              <p className="text-xs mt-2 text-amber-700">Option bilingue FR/EN : <strong>50 000 FCFA/an</strong> (en supplément)</p>
            )}
            <p className="text-xs mt-2 font-semibold text-green-700">Coût total Année 1 : {formatCurrency(totalYearOne)} FCFA</p>
          </div>

          {/* Article 4 — Paiement */}
          <div>
            <h4 className="font-bold text-[#0a1d3f] border-b border-gray-200 pb-1 mb-2">Article 4 — Prix et modalités de paiement</h4>
            <p className="text-xs leading-relaxed">
              Les frais d'activation de <strong>300 000 FCFA</strong> sont dus à la signature. Les frais annuels de
              <strong> {formatCurrency(annualFee)} FCFA</strong> sont dus chaque année à la date anniversaire.
              Réglement par virement bancaire, Mobile Money (FedaPay/FeexPay) ou espèces contre reçu.
              WhatsApp gratuit et illimité. SMS, Email et Voice facturés au prix coûtant.
            </p>
          </div>

          {/* Article 5 — Durée */}
          <div>
            <h4 className="font-bold text-[#0a1d3f] border-b border-gray-200 pb-1 mb-2">Article 5 — Durée et reconduction</h4>
            <p className="text-xs leading-relaxed">
              Le Contrat prend effet à la signature pour une durée initiale d'un (1) an, renouvelable par tacite reconduction
              sauf dénonciation 60 jours avant la date anniversaire.
            </p>
          </div>

          {/* Article 8 — Propriété intellectuelle */}
          <div>
            <h4 className="font-bold text-[#0a1d3f] border-b border-gray-200 pb-1 mb-2">Article 8 — Propriété intellectuelle</h4>
            <p className="text-xs leading-relaxed">
              La plateforme Academia Helm demeure la propriété exclusive du Prestataire. Les données saisies par le Client
              demeurent sa propriété exclusive.
            </p>
          </div>

          {/* Article 13 — Droit applicable */}
          <div>
            <h4 className="font-bold text-[#0a1d3f] border-b border-gray-200 pb-1 mb-2">Article 13 — Droit applicable</h4>
            <p className="text-xs leading-relaxed">
              Le présent Contrat est soumis au droit de la République du Bénin. En cas de différend, les Parties recherchent
              une résolution amiable. À défaut, compétence des juridictions de Parakou.
            </p>
          </div>

          <p className="text-center text-xs text-gray-500 pt-2">Fait à Parakou, le {today}, en deux (2) exemplaires originaux.</p>
        </div>

        {/* Signature section */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-200">
          <h4 className="font-bold text-[#0a1d3f] mb-4 flex items-center gap-2">
            <PenTool className="w-4 h-4" /> Signatures électroniques
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Promoteur */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-600">
                <User className="w-3 h-3" /> Pour le Client — {promoterName} (Promoteur)
              </div>
              <SignatureCanvas
                width={350} height={140}
                onSignatureChange={setPromoterSignature}
                placeholder="Signature du promoteur"
              />
              <p className="text-[10px] text-gray-400 mt-1">Date : {today}</p>
            </div>
            {/* Prestataire */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-600">
                <Building2 className="w-3 h-3" /> Pour le Prestataire — YEHI OR Tech
              </div>
              <SignatureCanvas
                width={350} height={140}
                onSignatureChange={setProviderSignature}
                placeholder="Signature du représentant YEHI OR Tech"
              />
              <p className="text-[10px] text-gray-400 mt-1">Date : {providerSignature ? today : '____ / ____ / ________'}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-3 bg-[#0a1d3f] text-center">
          <p className="text-[10px] text-blue-200">YEHI OR Tech — Academia Helm · contact@academiahelm.com · www.academiahelm.com</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
        <Button onClick={handleSignNow} disabled={loading || !promoterSignature} size="lg" className="bg-emerald-600 hover:bg-emerald-700">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
          Signer et créer l'école
        </Button>
        <Button onClick={handleSendForLater} disabled={loading} size="lg" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
          <Send className="w-4 h-4 mr-2" /> Envoyer pour signature différée
        </Button>
      </div>
      <div className="mt-4 text-center">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">← Retour</button>
      </div>
    </motion.div>
  );
}
