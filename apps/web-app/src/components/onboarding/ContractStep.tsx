'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { PenTool, Send, CheckCircle2, Loader2, User, Building2, FileText, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { SignatureCanvas } from '@/app/app/hr/_components/onboarding/components/SignatureCanvas';
import { formatCurrency } from '@/lib/utils';
import { HELM_PLANS, BILINGUAL_ADDON } from '@/lib/services/HelmPricingService';

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
  // ⭐ Paiement en espèces (mode YEHI OR Tech) — aligne le contrat sur ce
  //    qui a été marqué payé à l'étape 3
  subscriptionPaid?: boolean;
  bilingualPaid?: boolean;
  receivedBy?: string;
  onComplete: (result: {
    signed: boolean;
    contractUrl?: string;
    subdomain?: string;
    hostname?: string;
    portalUrl?: string;
  }) => void;
  onBack: () => void;
}

// ⭐ Grille tarifaire dérivée de HELM_PLANS (source unique — fin de la
//    duplication PLAN_TABLE qui pouvait diverger du reste de l'app).
const BILINGUAL_FEE = BILINGUAL_ADDON.annual ?? 50000;
const PLAN_TABLE = (['SEED', 'GROW', 'LEAD', 'NETWORK'] as const).map((code) => {
  const plan = HELM_PLANS[code];
  const annual = plan.annualPrice;
  const activation = plan.setupFee ?? 300000;
  return {
    code,
    name: plan.name,
    range: code === 'SEED' ? '1 à 50' : code === 'GROW' ? '51 à 150' : code === 'LEAD' ? '151 à 400' : '401 et +',
    activation: activation.toLocaleString('fr-FR'),
    annual: annual.toLocaleString('fr-FR'),
    total: (activation + annual).toLocaleString('fr-FR'),
  };
});

const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
const SUPPORT_EMAIL = 'support@academiahelm.com';

export default function ContractStep({
  draftId, schoolName, promoterName, directorName, schoolAddress, schoolCity,
  schoolPhone, schoolEmail, studentCount, planCode, planName, bilingual,
  subdomain, activationFee, annualFee, subscriptionPaid = true, bilingualPaid = false,
  receivedBy, onComplete, onBack,
}: ContractStepProps) {
  const [promoterSignature, setPromoterSignature] = useState<string | null>(null);
  const [providerSignature, setProviderSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const totalYearOne = activationFee + annualFee + (bilingual ? BILINGUAL_FEE : 0);
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
      // ⭐ Le paiement est marqué « payé en espèces » à l'étape 3 — on aligne
      //    le contrat ET la création de l'école sur ces infos.
      const paymentMarked = {
        subscriptionPaid,
        bilingualPaid: bilingual ? bilingualPaid : false,
        receivedBy,
      };

      const genResponse = await fetch('/api/onboarding/contract/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName, promoterName, directorName: directorName || promoterName,
          schoolAddress, schoolCity, schoolPhone, schoolEmail,
          studentCount, planCode, planName, bilingual, subdomain,
          effectiveDate: today, activationFee, annualFee, bilingualFee: bilingual ? BILINGUAL_FEE : 0,
          totalYearOne,
          paymentMethod: 'cash' as const,
          ...paymentMarked,
          promoterSignatureDataUrl: promoterSignature,
          providerSignatureDataUrl: providerSignature,
          promoterSignedAt: new Date().toISOString(),
          providerSignedAt: providerSignature ? new Date().toISOString() : undefined,
        }),
      });

      if (!genResponse.ok) throw new Error(`HTTP ${genResponse.status}`);
      const genData = await genResponse.json();

      // ⭐ sign : enregistre les signatures, crée le paiement CASH, active
      //    l'école via le même flux que le mode self-service, envoie l'email
      //    (contrat + identifiants). La réponse contient subdomain/portalUrl.
      const signResponse = await fetch('/api/onboarding/contract/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId, promoterSignature, providerSignature: providerSignature || undefined,
          signLater: false,
          paymentMarked,
          contractData: {
            schoolName, promoterName, directorName: directorName || promoterName,
            schoolAddress, schoolCity, schoolPhone, schoolEmail,
            studentCount, planCode, planName, bilingual, subdomain,
            effectiveDate: today, activationFee, annualFee, bilingualFee: bilingual ? BILINGUAL_FEE : 0,
            totalYearOne,
            paymentMethod: 'cash' as const,
            ...paymentMarked,
          },
        }),
      });

      if (!signResponse.ok) throw new Error(`HTTP ${signResponse.status}`);
      const signData = await signResponse.json();

      if (!signData.success) {
        throw new Error(signData.message || 'Erreur lors de la signature du contrat');
      }

      toast({
        title: 'Contrat signé — école créée',
        description: "Le contrat signé et les identifiants de connexion ont été envoyés par email au promoteur.",
      });
      onComplete({
        signed: true,
        contractUrl: genData.fileUrl,
        subdomain: signData.subdomain,
        hostname: signData.hostname,
        portalUrl: signData.portalUrl,
      });
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendForLater = async () => {
    setLoading(true);
    try {
      // ⭐ Conserver le marquage de paiement pour la signature différée :
      //    le backend le persiste dans le draft pour que la page
      //    /signup/contract-sign génère un contrat identique.
      const response = await fetch('/api/onboarding/contract/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          promoterSignature: null,
          signLater: true,
          paymentMarked: {
            subscriptionPaid,
            bilingualPaid: bilingual ? bilingualPaid : false,
            receivedBy,
          },
        }),
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

  // Classes communes — très compactes pour faire tenir tout le contrat sans scroll
  const articleTitle = 'font-bold text-[#0a1d3f] border-b border-gray-300 pb-px mb-px text-[9px]';
  const articleText = 'leading-tight text-[9px] text-gray-700';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // ⭐ Le contrat prend TOUT l'écran sous la navbar (h-[calc(100vh-64px)])
      //    La navbar Academia Helm fait ~64px. On utilise overflow-hidden pour
      //    empêcher tout scroll et forcer le contenu à tenir dans la zone visible.
      className="fixed inset-0 top-[64px] z-30 bg-white overflow-hidden flex flex-col"
    >
      {/* ── Bandeau titre minimal ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 leading-tight">Contrat d'abonnement</h2>
            <p className="text-[10px] text-gray-500 leading-tight">Licence d'utilisation — Academia Helm</p>
          </div>
        </div>
        <p className="text-[10px] text-gray-400">Réf. {contractRef}</p>
      </div>

      {/* ── Document contrat — flex-1, occupe tout l'espace restant ── */}
      <div className="flex-1 overflow-hidden px-3 py-2">
        <div className="bg-white border border-gray-300 rounded-lg shadow-xl overflow-hidden h-full flex flex-col">

          {/* ── En-tête avec logos ── */}
          <div className="flex-shrink-0 bg-gradient-to-r from-[#0a1d3f] via-[#0b2f73] to-[#0a1d3f] px-4 py-2 text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Image
                src="/images/logo-yehi-or-tech.webp"
                alt="YEHI OR Tech"
                width={36}
                height={36}
                className="rounded bg-white/95 p-0.5"
                unoptimized
              />
              <div className="leading-tight">
                <div className="text-[10px] font-bold">YEHI OR <span className="text-[#f5b335]">Tech</span></div>
                <div className="text-[8px] text-blue-200">Digital Agency · Parakou</div>
              </div>
            </div>

            <div className="text-center flex-1">
              <h3 className="text-[10px] font-bold uppercase tracking-wider">
                Contrat d'abonnement et de licence d'utilisation
              </h3>
              <p className="text-[8px] text-blue-200 mt-px">
                Plateforme SaaS Academia Helm
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="leading-tight text-right">
                <div className="text-[10px] font-bold">Academia <span className="text-[#f5b335]">Helm</span></div>
                <div className="text-[8px] text-blue-200">School Management</div>
              </div>
              <Image
                src="/images/logo-Academia Hub.webp"
                alt="Academia Helm"
                width={36}
                height={36}
                className="rounded bg-white/95 p-0.5"
                unoptimized
              />
            </div>
          </div>

          {/* ── Corps du contrat — 2 colonnes, articles en ORDRE SÉQUENTIEL ──
              flex-1 = prend toute la hauteur restante, overflow-hidden = pas de scroll */}
          <div className="flex-1 overflow-hidden px-3 py-2 grid grid-cols-2 gap-3 text-[9px] text-gray-700 min-h-0">

            {/* ═══════════════ COLONNE GAUCHE — Articles 1 à 7 ═══════════════ */}
            <div className="space-y-1.5 overflow-hidden min-h-0">

              <section>
                <h4 className={articleTitle}>Entre les soussignés</h4>
                <p className={articleText}>
                  <strong>YEHI OR Tech</strong>, éditrice de la plateforme SaaS Academia Helm, sise à Parakou,
                  République du Bénin, ci-après « <strong>le Prestataire</strong> ».
                </p>
                <p className={articleText}>
                  <strong>{schoolName}</strong>, représentée par son promoteur{' '}
                  <strong>{promoterName}</strong>, ci-après « <strong>le Client</strong> ».
                </p>
              </section>

              <section>
                <h4 className={articleTitle}>Article 1 — Fiche de souscription</h4>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0 text-[9px]">
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
                <h4 className={articleTitle}>Article 2 — Objet du contrat</h4>
                <p className={articleText}>
                  Concession d'un droit d'usage non exclusif de la plateforme Academia Helm (Web, Desktop, Mobile),
                  hébergement, maintenance, support et accès aux agents IA (ORION, SARA, ATLAS).
                </p>
              </section>

              <section>
                <h4 className={articleTitle}>Article 3 — Plan souscrit et grille tarifaire</h4>
                <table className="w-full text-[8px] border border-gray-300 border-collapse">
                  <thead className="bg-[#0a1d3f] text-white">
                    <tr>
                      <th className="px-1 py-px text-left">Plan</th>
                      <th className="px-1 py-px text-left">Élèves</th>
                      <th className="px-1 py-px text-right">Act.</th>
                      <th className="px-1 py-px text-right">Annuel</th>
                      <th className="px-1 py-px text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PLAN_TABLE.map(p => (
                      <tr
                        key={p.code}
                        className={p.code === planCode ? 'bg-blue-50 font-bold' : ''}
                      >
                        <td className="px-1 py-px">
                          {p.name}{p.code === planCode && <span className="text-emerald-600 ml-0.5">☑</span>}
                        </td>
                        <td className="px-1 py-px">{p.range}</td>
                        <td className="px-1 py-px text-right">{p.activation}</td>
                        <td className="px-1 py-px text-right">{p.annual}</td>
                        <td className="px-1 py-px text-right">{p.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {bilingual && (
                  <p className="text-[8px] mt-px text-amber-700">
                    Option bilingue FR/EN : <strong>{formatCurrency(BILINGUAL_FEE)} FCFA/an</strong> (supplément, facturation annuelle)
                  </p>
                )}
                <p className="text-[9px] mt-px font-bold text-emerald-700">
                  Coût total Année 1 : {formatCurrency(totalYearOne)} FCFA
                </p>
              </section>

              <section>
                <h4 className={articleTitle}>Article 4 — Prix et modalités de paiement</h4>
                <p className={articleText}>
                  Frais d'activation de <strong>300 000 FCFA</strong> dus à la signature. Frais annuels de{' '}
                  <strong>{formatCurrency(annualFee)} FCFA</strong> dus chaque année à la{' '}
                  <strong>date d'échéance annuelle</strong>. Réglement par virement bancaire, Mobile Money
                  (FedaPay) ou espèces contre reçu. WhatsApp inclus gratuitement et illimité.
                </p>
                {/* ⭐ Modalité réellement retenue : paiement en espèces (mode YEHI OR Tech) */}
                <div className="mt-1 bg-green-50 border border-green-300 rounded p-1 text-[8px] leading-tight">
                  <div className="flex items-center gap-1 font-bold text-green-800">
                    <Banknote className="w-2.5 h-2.5" /> Modalité retenue : paiement en espèces
                  </div>
                  <p className="text-green-900 mt-px">
                    Souscription (activation + annuel {planName}) :{' '}
                    <strong>{subscriptionPaid ? 'réglée en espèces à la signature' : 'à régler'}</strong>
                    {receivedBy ? `, encaissée par ${receivedBy} pour YEHI OR Tech` : ''}.
                    {bilingual && (
                      <> Option bilingue FR/EN : <strong>{formatCurrency(BILINGUAL_FEE)} FCFA/an</strong>,
                      facturation <strong>annuelle</strong> —{' '}
                      {bilingualPaid ? 'frais de la première année réglés en espèces' : 'à régler'}.</>
                    )}
                  </p>
                </div>
              </section>

              <section>
                <h4 className={articleTitle}>Article 5 — Durée et reconduction</h4>
                <p className={articleText}>
                  Durée initiale d'un (1) an, renouvelable par tacite reconduction sauf dénonciation 60 jours
                  avant la <strong>date d'échéance annuelle</strong>.
                </p>
              </section>

              <section>
                <h4 className={articleTitle}>Article 6 — Obligations du Prestataire</h4>
                <p className={articleText}>
                  Disponibilité et maintenance de la plateforme, support technique, onboarding et formation
                  initiale, confidentialité et sécurité des données.
                </p>
              </section>

              <section>
                <h4 className={articleTitle}>Article 7 — Obligations du Client</h4>
                <p className={articleText}>
                  Paiement aux échéances, informations exactes, usage conforme, confidentialité des
                  identifiants, respect de la législation béninoise sur les données personnelles.
                </p>
              </section>
            </div>

            {/* ═══════════════ COLONNE DROITE — Articles 8 à 14 + Signatures ═══════════════ */}
            <div className="space-y-1.5 flex flex-col overflow-hidden min-h-0">

              <section>
                <h4 className={articleTitle}>Article 8 — Propriété intellectuelle</h4>
                <p className={articleText}>
                  La plateforme Academia Helm demeure propriété exclusive du Prestataire. Le Client dispose
                  d'un droit d'usage personnel, non exclusif et non transférable. Les données saisies par le
                  Client demeurent sa propriété.
                </p>
              </section>

              <section>
                <h4 className={articleTitle}>Article 9 — Protection des données et confidentialité</h4>
                <p className={articleText}>
                  Mesures techniques et organisationnelles raisonnables pour assurer la sécurité des données.
                  Confidentialité réciproque pendant 2 ans post-contractuelles.
                </p>
              </section>

              <section>
                <h4 className={articleTitle}>Article 10 — Résiliation</h4>
                <p className={articleText}>
                  Résiliation pour manquement grave après mise en demeure infructueuse (30 jours). Non-paiement
                  persistant au-delà de 45 jours → résiliation de plein droit. Export des données sous 30 jours.
                </p>
              </section>

              <section>
                <h4 className={articleTitle}>Article 11 — Responsabilité et garanties</h4>
                <p className={articleText}>
                  Responsabilité du Prestataire limitée aux sommes perçues sur les 12 derniers mois.
                  Architecture offline-first visant à limiter les pertes de données.
                </p>
              </section>

              <section>
                <h4 className={articleTitle}>Article 12 — Force majeure</h4>
                <p className={articleText}>
                  Aucune des Parties n'est responsable d'une non-exécution due à un cas de force majeure
                  tel que défini par la jurisprudence béninoise.
                </p>
              </section>

              <section>
                <h4 className={articleTitle}>Article 13 — Droit applicable et juridiction</h4>
                <p className={articleText}>
                  Droit de la République du Bénin. Résolution amiable préalable (30 jours). À défaut,
                  compétence des juridictions de Parakou.
                </p>
              </section>

              <section>
                <h4 className={articleTitle}>Article 14 — Dispositions diverses</h4>
                <p className={articleText}>
                  Le présent Contrat constitue l'intégralité de l'accord entre les Parties. Toute modification
                  doit faire l'objet d'un avenant écrit signé des deux Parties.
                </p>
              </section>

              {/* ── Section signatures — intégrée en bas ── */}
              <section className="bg-gray-50 border border-gray-200 rounded p-1.5 mt-auto">
                <h4 className="font-bold text-[#0a1d3f] mb-1 flex items-center gap-1 text-[9px]">
                  <PenTool className="w-2.5 h-2.5" /> Signatures électroniques
                </h4>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <div className="flex items-center gap-1 mb-px text-[8px] font-semibold text-gray-600">
                      <User className="w-2 h-2" /> Pour le Client — {promoterName}
                    </div>
                    <SignatureCanvas
                      width={250}
                      height={55}
                      onSignatureChange={setPromoterSignature}
                      placeholder="Signature du promoteur"
                    />
                    <p className="text-[7px] text-gray-400">Date : {today}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-px text-[8px] font-semibold text-gray-600">
                      <Building2 className="w-2 h-2" /> Pour le Prestataire — YEHI OR Tech
                    </div>
                    <SignatureCanvas
                      width={250}
                      height={55}
                      onSignatureChange={setProviderSignature}
                      placeholder="Signature YEHI OR Tech"
                    />
                    <p className="text-[7px] text-gray-400">
                      Date : {providerSignature ? today : '____ / ____ / ________'}
                    </p>
                  </div>
                </div>
                <p className="text-center text-[8px] text-gray-500 mt-1">
                  Fait à Parakou, le {today}, en deux (2) exemplaires originaux.
                </p>
              </section>
            </div>
          </div>

          {/* ── Pied de page ── */}
          <div className="flex-shrink-0 bg-[#0a1d3f] px-4 py-1 text-center border-t border-[#f5b335]/20">
            <p className="text-[8px] text-blue-200">
              YEHI OR Tech — Academia Helm · {SUPPORT_EMAIL} · www.academiahelm.com · Parakou, République du Bénin
            </p>
          </div>
        </div>
      </div>

      {/* ── Barre d'actions fixe en bas ── */}
      <div className="flex-shrink-0 flex gap-2 justify-center px-4 py-1.5 bg-white border-t border-slate-200">
        <Button
          onClick={handleSignNow}
          disabled={loading || !promoterSignature}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8"
        >
          {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
          Signer et créer l'école
        </Button>
        <Button
          onClick={handleSendForLater}
          disabled={loading}
          size="sm"
          variant="outline"
          className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs h-8"
        >
          <Send className="w-3 h-3 mr-1" /> Signature différée
        </Button>
        <Button onClick={onBack} size="sm" variant="ghost" className="text-xs h-8">
          ← Retour
        </Button>
      </div>
    </motion.div>
  );
}
