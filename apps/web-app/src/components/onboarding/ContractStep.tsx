'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { PenTool, Send, CheckCircle2, Loader2, User, Building2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { SignatureCanvas } from '@/app/app/hr/_components/onboarding/components/SignatureCanvas';
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
  { name: 'Helm Essentiel', range: '1 à 50', activation: '300 000', annual: '50 000', total: '350 000', code: 'SEED' },
  { name: 'Helm Croissance', range: '51 à 150', activation: '300 000', annual: '75 000', total: '375 000', code: 'GROW' },
  { name: 'Helm Performance', range: '151 à 400', activation: '300 000', annual: '100 000', total: '400 000', code: 'LEAD' },
  { name: 'Helm Institution', range: '401 et +', activation: '300 000', annual: '150 000', total: '450 000', code: 'NETWORK' },
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
  const { toast } = useToast();

  const totalYearOne = activationFee + annualFee + (bilingual ? 50000 : 0);
  const selectedPlan = PLAN_TABLE.find(p => p.code === planCode) || PLAN_TABLE[0];
  const contractRef = `CT-AH-2026-${subdomain.toUpperCase().substring(0, 12)}`;

  const handleSignNow = async () => {
    if (!promoterSignature) {
      toast({
        title: 'Signature manquante',
        description: 'Le promoteur doit apposer sa signature avant de finaliser.',
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);
    try {
      // ⭐ Endpoints publics — pas d'en-tête Authorization (le contrat est signé
      //    pendant le flux d'onboarding, l'utilisateur n'est pas encore authentifié).
      const genResponse = await fetch('/api/onboarding/contract/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      const signResponse = await fetch('/api/onboarding/contract/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId, promoterSignature, providerSignature: providerSignature || undefined,
          signLater: false,
        }),
      });

      if (!signResponse.ok) throw new Error(`HTTP ${signResponse.status}`);

      toast({
        title: 'Contrat signé',
        description: "Le contrat signé a été envoyé par email avec les identifiants de connexion de l'école.",
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
      const response = await fetch('/api/onboarding/contract/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, promoterSignature: null, signLater: true }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      toast({
        title: 'Lien envoyé',
        description: 'Le promoteur recevra un email pour signer le contrat à son rythme.',
      });
      onComplete({ signed: false });
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-[1280px] mx-auto"
    >
      {/* Titre */}
      <div className="text-center mb-3">
        <div className="inline-flex items-center justify-center w-11 h-11 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl mb-2 shadow-lg">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Contrat d'abonnement</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Contrat d'abonnement et de licence d'utilisation — Academia Helm
        </p>
      </div>

      {/* ─── Document contrat — pleine page, sans scroll ─── */}
      <div
        className="bg-white border border-gray-300 rounded-lg shadow-xl overflow-hidden"
        style={{
          // ⭐ On force une hauteur qui tient dans le viewport sans scroll.
          //    Le contenu est dimensionné en `text-[10px]` à `text-xs` pour
          //    rentrer intégralement dans la zone disponible.
          maxHeight: 'calc(100vh - 220px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ── En-tête avec logos ── */}
        <div className="bg-gradient-to-r from-[#0a1d3f] via-[#0b2f73] to-[#0a1d3f] px-5 py-3 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/images/logo-yehi-or-tech.webp"
              alt="YEHI OR Tech"
              width={50}
              height={50}
              className="rounded-md bg-white/95 p-1"
              unoptimized
            />
            <div className="leading-tight">
              <div className="text-xs font-bold">YEHI OR <span className="text-[#f5b335]">Tech</span></div>
              <div className="text-[9px] text-blue-200">Digital Agency · Parakou</div>
            </div>
          </div>

          <div className="text-center flex-1">
            <h3 className="text-[11px] font-bold uppercase tracking-wider">
              Contrat d'abonnement et de licence d'utilisation
            </h3>
            <p className="text-[9px] text-blue-200 mt-0.5">
              Plateforme SaaS Academia Helm · Réf. {contractRef}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="leading-tight text-right">
              <div className="text-xs font-bold">Academia <span className="text-[#f5b335]">Helm</span></div>
              <div className="text-[9px] text-blue-200">School Management</div>
            </div>
            <Image
              src="/images/logo-academia-helm-signature.webp"
              alt="Academia Helm"
              width={50}
              height={50}
              className="rounded-md bg-white/95 p-1"
              unoptimized
            />
          </div>
        </div>

        {/* ── Corps du contrat — flex-1, pas de scroll interne ── */}
        <div className="flex-1 overflow-hidden px-5 py-3 grid grid-cols-12 gap-3 text-[10px] text-gray-700">
          {/* Colonne gauche — Parties + Objet + Fiche */}
          <div className="col-span-5 space-y-2">
            <section>
              <h4 className="font-bold text-[#0a1d3f] border-b border-gray-300 pb-0.5 mb-1 text-[10px]">
                Entre les soussignés
              </h4>
              <p className="leading-snug">
                <strong>YEHI OR Tech</strong>, éditrice de la plateforme SaaS Academia Helm, sise à Parakou,
                République du Bénin, ci-après « <strong>le Prestataire</strong> ».
              </p>
              <p className="leading-snug mt-1">
                <strong>{schoolName}</strong>, représentée par son promoteur{' '}
                <strong>{promoterName}</strong>, ci-après « <strong>le Client</strong> ».
              </p>
            </section>

            <section>
              <h4 className="font-bold text-[#0a1d3f] border-b border-gray-300 pb-0.5 mb-1 text-[10px]">
                Article 1 — Fiche de souscription
              </h4>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                <div><span className="text-gray-500">École :</span> <strong>{schoolName}</strong></div>
                <div><span className="text-gray-500">Promoteur :</span> <strong>{promoterName}</strong></div>
                <div><span className="text-gray-500">Ville :</span> {schoolCity}</div>
                <div><span className="text-gray-500">Tél :</span> {schoolPhone}</div>
                <div><span className="text-gray-500">Email :</span> {schoolEmail}</div>
                <div><span className="text-gray-500">Élèves :</span> <strong>{studentCount}</strong></div>
                <div><span className="text-gray-500">Plan :</span> <strong>{planName}</strong></div>
                <div><span className="text-gray-500">Bilingue :</span> {bilingual ? 'Oui' : 'Non'}</div>
                <div className="col-span-2"><span className="text-gray-500">Sous-domaine :</span> {subdomain}.academiahelm.com</div>
                <div className="col-span-2"><span className="text-gray-500">Date d'effet :</span> {today}</div>
              </div>
            </section>

            <section>
              <h4 className="font-bold text-[#0a1d3f] border-b border-gray-300 pb-0.5 mb-1 text-[10px]">
                Article 2 — Objet
              </h4>
              <p className="leading-snug">
                Concession d'un droit d'usage non exclusif de la plateforme Academia Helm (Web, Desktop, Mobile),
                hébergement, maintenance, support et accès aux agents IA (ORION, SARA, ATLAS).
              </p>
            </section>

            <section>
              <h4 className="font-bold text-[#0a1d3f] border-b border-gray-300 pb-0.5 mb-1 text-[10px]">
                Article 5 — Durée et reconduction
              </h4>
              <p className="leading-snug">
                Durée initiale d'un (1) an, renouvelable par tacite reconduction sauf dénonciation 60 jours
                avant la <strong>date d'échéance annuelle</strong>.
              </p>
            </section>

            <section>
              <h4 className="font-bold text-[#0a1d3f] border-b border-gray-300 pb-0.5 mb-1 text-[10px]">
                Article 8 — Propriété intellectuelle
              </h4>
              <p className="leading-snug">
                La plateforme demeure propriété exclusive du Prestataire. Les données saisies par le Client
                demeurent sa propriété.
              </p>
            </section>

            <section>
              <h4 className="font-bold text-[#0a1d3f] border-b border-gray-300 pb-0.5 mb-1 text-[10px]">
                Article 13 — Droit applicable
              </h4>
              <p className="leading-snug">
                Droit de la République du Bénin. Compétence des juridictions de Parakou en cas de différend.
              </p>
            </section>
          </div>

          {/* Colonne droite — Tarifs + Signatures */}
          <div className="col-span-7 space-y-2 flex flex-col">
            <section>
              <h4 className="font-bold text-[#0a1d3f] border-b border-gray-300 pb-0.5 mb-1 text-[10px]">
                Article 3 — Plan souscrit et grille tarifaire
              </h4>
              <table className="w-full text-[9px] border border-gray-300 border-collapse">
                <thead className="bg-[#0a1d3f] text-white">
                  <tr>
                    <th className="px-1.5 py-0.5 text-left">Plan</th>
                    <th className="px-1.5 py-0.5 text-left">Élèves</th>
                    <th className="px-1.5 py-0.5 text-right">Activation</th>
                    <th className="px-1.5 py-0.5 text-right">Annuel</th>
                    <th className="px-1.5 py-0.5 text-right">Total An 1</th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_TABLE.map(p => (
                    <tr
                      key={p.code}
                      className={p.code === planCode ? 'bg-blue-50 font-bold' : ''}
                    >
                      <td className="px-1.5 py-0.5">
                        {p.name}{p.code === planCode && <span className="text-emerald-600 ml-1">☑</span>}
                      </td>
                      <td className="px-1.5 py-0.5">{p.range}</td>
                      <td className="px-1.5 py-0.5 text-right">{p.activation}</td>
                      <td className="px-1.5 py-0.5 text-right">{p.annual}</td>
                      <td className="px-1.5 py-0.5 text-right">{p.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bilingual && (
                <p className="text-[9px] mt-1 text-amber-700">
                  Option bilingue FR/EN : <strong>50 000 FCFA/an</strong> (en supplément)
                </p>
              )}
              <p className="text-[10px] mt-1 font-bold text-emerald-700">
                Coût total Année 1 : {formatCurrency(totalYearOne)} FCFA
              </p>
            </section>

            <section>
              <h4 className="font-bold text-[#0a1d3f] border-b border-gray-300 pb-0.5 mb-1 text-[10px]">
                Article 4 — Prix et modalités de paiement
              </h4>
              <p className="leading-snug">
                Frais d'activation de <strong>300 000 FCFA</strong> dus à la signature. Frais annuels de{' '}
                <strong>{formatCurrency(annualFee)} FCFA</strong> dus chaque année à la{' '}
                <strong>date d'échéance annuelle</strong>. Réglement par virement bancaire, Mobile Money
                (FedaPay) ou espèces contre reçu. WhatsApp inclus gratuitement et illimité. SMS, Email et
                Voice facturés au prix coûtant.
              </p>
            </section>

            <section>
              <h4 className="font-bold text-[#0a1d3f] border-b border-gray-300 pb-0.5 mb-1 text-[10px]">
                Articles 6 & 7 — Obligations des Parties
              </h4>
              <p className="leading-snug">
                <strong>Prestataire :</strong> disponibilité, maintenance, support, onboarding, formation,
                confidentialité des données. <strong>Client :</strong> paiement aux échéances, informations
                exactes, usage conforme, confidentialité des identifiants.
              </p>
            </section>

            {/* ── Section signatures — intégrée sans scroll ── */}
            <section className="bg-gray-50 border border-gray-200 rounded p-2 mt-auto">
              <h4 className="font-bold text-[#0a1d3f] mb-1.5 flex items-center gap-1.5 text-[10px]">
                <PenTool className="w-3 h-3" /> Signatures électroniques
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {/* Promoteur */}
                <div>
                  <div className="flex items-center gap-1 mb-1 text-[9px] font-semibold text-gray-600">
                    <User className="w-2.5 h-2.5" /> Pour le Client — {promoterName}
                  </div>
                  <SignatureCanvas
                    width={300}
                    height={80}
                    onSignatureChange={setPromoterSignature}
                    placeholder="Signature du promoteur"
                  />
                  <p className="text-[8px] text-gray-400 mt-0.5">Date : {today}</p>
                </div>
                {/* Prestataire */}
                <div>
                  <div className="flex items-center gap-1 mb-1 text-[9px] font-semibold text-gray-600">
                    <Building2 className="w-2.5 h-2.5" /> Pour le Prestataire — YEHI OR Tech
                  </div>
                  <SignatureCanvas
                    width={300}
                    height={80}
                    onSignatureChange={setProviderSignature}
                    placeholder="Signature du représentant YEHI OR Tech"
                  />
                  <p className="text-[8px] text-gray-400 mt-0.5">
                    Date : {providerSignature ? today : '____ / ____ / ________'}
                  </p>
                </div>
              </div>
              <p className="text-center text-[9px] text-gray-500 mt-1.5">
                Fait à Parakou, le {today}, en deux (2) exemplaires originaux.
              </p>
            </section>
          </div>
        </div>

        {/* ── Pied de page ── */}
        <div className="bg-[#0a1d3f] px-5 py-1.5 text-center border-t border-[#f5b335]/20">
          <p className="text-[9px] text-blue-200">
            YEHI OR Tech — Academia Helm · contact@academiahelm.com · www.academiahelm.com · Parakou, République du Bénin
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2 justify-center mt-2">
        <Button
          onClick={handleSignNow}
          disabled={loading || !promoterSignature}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-xs h-9"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
          Signer et créer l'école
        </Button>
        <Button
          onClick={handleSendForLater}
          disabled={loading}
          size="sm"
          variant="outline"
          className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs h-9"
        >
          <Send className="w-3.5 h-3.5 mr-1.5" /> Envoyer pour signature différée
        </Button>
        <Button onClick={onBack} size="sm" variant="ghost" className="text-xs h-9">
          ← Retour
        </Button>
      </div>
    </motion.div>
  );
}
