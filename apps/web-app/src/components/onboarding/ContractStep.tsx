'use client';

/**
 * ============================================================================
 * CONTRACT STEP — Contrat d'abonnement conforme au document Word de référence
 * ============================================================================
 *
 * ⭐ STRUCTURE EXACTE du Contrat_Abonnement_Academia_Helm.docx :
 *    - Document A4 portrait, UNE colonne, défilement vertical
 *    - En-tête : titre 2 lignes + plateforme + référence CT-AH-AAAA-SOUSDOMAINE
 *    - « Entre les soussignés » (texte intégral)
 *    - Article 1 : fiche de souscription (tableau 2 colonnes)
 *    - Article 2 : objet du contrat (texte intégral)
 *    - Article 3 : grille tarifaire (6 colonnes) + option bilingue + total
 *      en chiffres ET en toutes lettres
 *    - Article 4 : 4.1 conditions générales / 4.2 modalité retenue (cases) /
 *      4.3 certification d'encaissement / 4.4 échéancier de tranches (7 colonnes)
 *    - Articles 5 à 14 (textes intégraux)
 *    - Signatures : tableau 2 colonnes LE CLIENT / LE PRESTATAIRE
 *
 * ⭐ MULTI-ÉCOLES : le contrat s'adapte — fiche (écoles annexes + nombre),
 *    Article 3 (détail par établissement), Article 4 (montants × nombre
 *    d'écoles : « c'est payant en fonction du nombre d'écoles »).
 * ============================================================================
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle2, Loader2, User, Building2, FileText, Stamp, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { SignatureCanvas } from '@/app/app/hr/_components/onboarding/components/SignatureCanvas';
import { formatCurrency } from '@/lib/utils';
import { HELM_PLANS, BILINGUAL_ADDON, HELM_ACTIVATION_FEE } from '@/lib/services/HelmPricingService';

// ⭐ Tranche de l'échéancier de paiement (espèces — mode YEHI OR Tech)
interface ContractInstallmentItem {
  label: string;
  amount: number; // FCFA
  dueDate?: string; // ISO — tranche 1 = acompte à la signature si absent
}

/** École annexe déclarée (multi-écoles dès l'onboarding). */
export interface ContractStepAnnex {
  name: string;
  city?: string;
}

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
  // ⭐ MULTI-ÉCOLES : nombre d'établissements souscrits + annexes déclarées
  schoolsCount?: number;
  annexes?: ContractStepAnnex[];
  // ⭐ Paiement en espèces (mode YEHI OR Tech) — aligne le contrat sur ce
  //    qui a été marqué payé à l'étape 3
  subscriptionPaid?: boolean;
  bilingualPaid?: boolean;
  receivedBy?: string;
  // ⭐ Paiement échelonné par tranches — échéancier saisi à l'étape 3
  paymentPlan?: 'full' | 'installments';
  installments?: ContractInstallmentItem[];
  downPaymentReceived?: boolean;
  onComplete: (result: {
    signed: boolean;
    contractUrl?: string;
    subdomain?: string;
    hostname?: string;
    portalUrl?: string;
  }) => void;
  onBack: () => void;
}

// ── Grille tarifaire (contrat Article 3 — source unique HELM_PLANS) ─────────
const BILINGUAL_FEE = BILINGUAL_ADDON.annual ?? 50000;
const PLAN_TABLE = (['SEED', 'GROW', 'LEAD', 'NETWORK'] as const).map((code) => {
  const plan = HELM_PLANS[code];
  const annual = plan.annualPrice;
  const activation = plan.setupFee ?? HELM_ACTIVATION_FEE;
  return {
    code,
    name: plan.name,
    range: code === 'SEED' ? '1 à 50' : code === 'GROW' ? '51 à 150' : code === 'LEAD' ? '151 à 400' : '401 et plus',
    activation,
    annual,
    total: activation + annual,
  };
});

// ── Montant en toutes lettres (Article 3 : « (montant en toutes lettres) ») ─
const UNITS_FR = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
];
const TENS_FR: Record<number, string> = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };

function below100Fr(n: number): string {
  if (n < 20) return UNITS_FR[n];
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return TENS_FR[t];
    if (u === 1) return `${TENS_FR[t]}-et-un`;
    return `${TENS_FR[t]}-${UNITS_FR[u]}`;
  }
  if (n < 80) {
    if (n === 71) return 'soixante-et-onze';
    return `soixante-${UNITS_FR[n - 60]}`;
  }
  if (n === 80) return 'quatre-vingts';
  return `quatre-vingt-${UNITS_FR[n - 80]}`;
}

function below1000Fr(n: number): string {
  if (n < 100) return below100Fr(n);
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (c === 1) return r === 0 ? 'cent' : `cent ${below100Fr(r)}`;
  return r === 0 ? `${UNITS_FR[c]} cents` : `${UNITS_FR[c]} cent ${below100Fr(r)}`;
}

/** Convertit un montant entier (FCFA) en toutes lettres françaises. */
export function amountToFrenchWords(n: number): string {
  const v = Math.max(0, Math.round(n));
  if (v === 0) return 'zéro';
  const parts: string[] = [];
  const millions = Math.floor(v / 1000000);
  const rest = v % 1000000;
  if (millions > 0) parts.push(millions === 1 ? 'un million' : `${below1000Fr(millions)} millions`);
  const thousands = Math.floor(rest / 1000);
  const rem = rest % 1000;
  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('mille');
    } else {
      // « cent » est invariable devant « mille » : six cent mille (pas de « s »)
      const t = thousands % 100 === 0 && thousands >= 200
        ? `${UNITS_FR[thousands / 100]} cent`
        : below1000Fr(thousands);
      parts.push(`${t} mille`);
    }
  }
  if (rem > 0) parts.push(below1000Fr(rem));
  return parts.join(' ');
}

const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
const SUPPORT_EMAIL = 'support@academiahelm.com';

export default function ContractStep({
  draftId, schoolName, promoterName, directorName, schoolAddress, schoolCity,
  schoolPhone, schoolEmail, studentCount, planCode, planName, bilingual,
  subdomain, activationFee, annualFee, schoolsCount = 1, annexes = [],
  subscriptionPaid = true, bilingualPaid = false,
  receivedBy, paymentPlan = 'full', installments, downPaymentReceived,
  onComplete, onBack,
}: ContractStepProps) {
  const [promoterSignature, setPromoterSignature] = useState<string | null>(null);
  const [providerSignature, setProviderSignature] = useState<string | null>(null);
  // ⭐ Contrat déjà signé manuellement (version papier) : aucune signature
  //    numérique n'est recueillie. Le contrat PDF part quand même par email
  //    avec la mention « déjà signé manuellement », l'école est créée et le
  //    promoteur reçoit ses identifiants.
  const [signedManually, setSignedManually] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // ⭐ MULTI-ÉCOLES — totaux cohérents : PAR ÉCOLE × nombre d'écoles
  const effSchoolsCount = Math.max(1, schoolsCount);
  const effAnnexes = (annexes || []).filter((a) => a?.name && String(a.name).trim().length >= 2);
  const bilingualFee = bilingual ? BILINGUAL_FEE : 0;
  const perSchoolTotal = activationFee + annualFee + bilingualFee;
  const totalYearOne = effSchoolsCount > 1 ? perSchoolTotal * effSchoolsCount : perSchoolTotal;
  const contractRef = `CT-AH-${new Date().getFullYear()}-${subdomain.toUpperCase().substring(0, 12)}`;

  // ⭐ Échéancier de tranches (mode paiement par tranches) : montants nettoyés
  //    + total/solde pour l'Article 4 et les payloads de signature.
  const isInstallments = paymentPlan === 'installments' && !!installments && installments.length > 0;
  const schedule = (installments || []).map((inst, i) => ({
    label: inst.label || (i === 0 ? 'Acompte à la signature' : `Tranche ${i + 1}`),
    amount: Math.max(0, Math.round(Number(inst.amount) || 0)),
    dueDate: inst.dueDate || undefined,
  }));
  const scheduleTotal = schedule.reduce((s, t) => s + t.amount, 0);
  const downPayment = schedule[0]?.amount || 0;
  const remainingBalance = Math.max(0, scheduleTotal - (downPaymentReceived ? downPayment : 0));
  const fmtDue = (iso?: string) => {
    if (!iso) return 'à la signature';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleSignNow = async () => {
    // ⭐ Signature numérique exigée — SAUF si le contrat a déjà été signé
    //    manuellement sur papier (case à cocher).
    if (!promoterSignature && !signedManually) {
      toast({
        title: 'Signature manquante',
        description: 'Le promoteur doit apposer sa signature avant de finaliser.',
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);
    try {
      // ⭐ Le paiement est marqué « payé en espèces » à l'étape 3 (intégral ou
      //    par tranches) — on aligne le contrat ET la création de l'école sur
      //    ces infos, échéancier compris.
      const paymentMarked = {
        subscriptionPaid: isInstallments ? downPaymentReceived !== false : subscriptionPaid,
        bilingualPaid: isInstallments ? bilingual : (bilingual ? bilingualPaid : false),
        receivedBy,
        // ⭐ Trace « signé manuellement » dans le draft (traçabilité + contrat)
        ...(signedManually ? { signedManually: true as const } : {}),
        ...(isInstallments
          ? {
              paymentPlan: 'installments' as const,
              installments: schedule,
              downPaymentReceived: downPaymentReceived !== false,
            }
          : {}),
      };

      const genResponse = await fetch('/api/onboarding/contract/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName, promoterName, directorName: directorName || promoterName,
          schoolAddress, schoolCity, schoolPhone, schoolEmail,
          studentCount, planCode, planName, bilingual, subdomain,
          // ⭐ Multi-écoles — le contrat s'adapte (fiche + Article 3 + Article 4)
          schoolsCount: effSchoolsCount,
          ...(effAnnexes.length > 0 ? { annexes: effAnnexes } : {}),
          effectiveDate: today, activationFee, annualFee, bilingualFee,
          totalYearOne,
          paymentMethod: 'cash' as const,
          ...paymentMarked,
          ...(signedManually
            ? {
                // ⭐ Contrat signé manuellement : PAS de signature numérique,
                //    mention « déjà signé manuellement » dans le PDF
                signedManually: true,
                promoterSignedAt: new Date().toISOString(),
                providerSignedAt: new Date().toISOString(),
              }
            : {
                promoterSignatureDataUrl: promoterSignature,
                providerSignatureDataUrl: providerSignature,
                promoterSignedAt: new Date().toISOString(),
                providerSignedAt: providerSignature ? new Date().toISOString() : undefined,
              }),
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
          draftId,
          promoterSignature: signedManually ? undefined : promoterSignature,
          providerSignature: !signedManually && providerSignature ? providerSignature : undefined,
          // ⭐ Contrat déjà signé manuellement — pas de signature numérique
          signedManually,
          signLater: false,
          paymentMarked,
          contractData: {
            schoolName, promoterName, directorName: directorName || promoterName,
            schoolAddress, schoolCity, schoolPhone, schoolEmail,
            studentCount, planCode, planName, bilingual, subdomain,
            schoolsCount: effSchoolsCount,
            ...(effAnnexes.length > 0 ? { annexes: effAnnexes } : {}),
            effectiveDate: today, activationFee, annualFee, bilingualFee,
            totalYearOne,
            paymentMethod: 'cash' as const,
            ...paymentMarked,
            ...(signedManually ? { signedManually: true } : {}),
          },
        }),
      });

      if (!signResponse.ok) throw new Error(`HTTP ${signResponse.status}`);
      const signData = await signResponse.json();

      if (!signData.success) {
        throw new Error(signData.message || 'Erreur lors de la signature du contrat');
      }

      toast({
        title: signedManually ? 'Contrat enregistré — école créée' : 'Contrat signé — école créée',
        description: signedManually
          ? "Le contrat PDF (mention « déjà signé manuellement ») et les identifiants de connexion ont été envoyés par email au promoteur."
          : "Le contrat signé et les identifiants de connexion ont été envoyés par email au promoteur.",
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
      //    /signup/contract-sign génère un contrat identique (échéancier
      //    de tranches compris).
      const response = await fetch('/api/onboarding/contract/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          promoterSignature: null,
          signLater: true,
          paymentMarked: {
            subscriptionPaid: isInstallments ? downPaymentReceived !== false : subscriptionPaid,
            bilingualPaid: isInstallments ? bilingual : (bilingual ? bilingualPaid : false),
            receivedBy,
            ...(isInstallments
              ? {
                  paymentPlan: 'installments' as const,
                  installments: schedule,
                  downPaymentReceived: downPaymentReceived !== false,
                }
              : {}),
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

  // ── Styles du document (sobre, légal, lisible — miroir du Word) ────────────
  const articleTitle = 'font-bold text-[#0a1d3f] border-b border-slate-400 pb-1 mb-2 mt-5 text-[13px] leading-snug';
  const articleText = 'text-[11.5px] leading-[1.6] text-slate-800 text-justify mb-2';
  const subTitle = 'font-bold text-[#0a1d3f] mt-3 mb-1.5 text-[12px]';
  const tblTh = 'border border-slate-400 px-2 py-1.5 bg-[#0a1d3f] text-white text-[10.5px] font-semibold';
  const tblTd = 'border border-slate-400 px-2 py-1.5 text-[10.5px] align-top';
  const checkOn = <span className="text-emerald-700 font-bold">☑</span>;
  const checkOff = <span className="text-slate-500">☐</span>;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // ⭐ Le contrat prend TOUT l'écran sous la navbar ; le DOCUMENT défile
      //    verticalement (une colonne, comme le Word de référence) et la barre
      //    d'actions reste fixe en bas.
      className="fixed inset-0 top-[64px] z-30 bg-slate-100 overflow-hidden flex flex-col"
    >
      {/* ── Bandeau titre minimal ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 leading-tight">Contrat d'abonnement et de licence d&apos;utilisation</h2>
            <p className="text-[10px] text-gray-500 leading-tight">
              Academia Helm — {effSchoolsCount > 1 ? `${effSchoolsCount} établissements` : '1 établissement'} · conforme au contrat type
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[10px] text-gray-400 hidden sm:block">Réf. {contractRef}</p>
          <Button
            onClick={() => window.print()}
            size="sm"
            variant="outline"
            className="h-7 text-xs border-slate-300 text-slate-600"
            title="Imprimer le contrat"
          >
            <Printer className="w-3 h-3 mr-1" /> Imprimer
          </Button>
        </div>
      </div>

      {/* ── Document A4 — une colonne, défilement vertical ── */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto max-w-[820px] bg-white shadow-xl border border-slate-300 px-10 py-10 sm:px-14 sm:py-12 text-slate-800">

          {/* ── Titre du document (Word : 2 lignes + plateforme + référence) ── */}
          <div className="text-center mb-6">
            <h1 className="text-[19px] font-bold uppercase tracking-wide text-[#0a1d3f] leading-snug">
              Contrat d&apos;abonnement<br />et de licence d&apos;utilisation
            </h1>
            <p className="text-[12px] text-slate-600 mt-2">
              Plateforme SaaS Academia Helm — Applications Web, Desktop et Mobile
            </p>
            <p className="text-[11px] text-slate-700 mt-3">
              Référence : <strong className="text-[#0a1d3f]">{contractRef}</strong>
            </p>
            <p className="text-[9px] italic text-slate-500 mt-1 max-w-xl mx-auto">
              (Référence au format de la plateforme : CT-AH-année de signature-sous-domaine de l&apos;établissement (Article 1),
              en majuscules, douze caractères au plus — exemple : CT-AH-2026-ESPERANCE)
            </p>
          </div>

          {/* ── Entre les soussignés (texte intégral du Word) ── */}
          <h2 className="font-bold text-[13px] text-[#0a1d3f] uppercase tracking-wide border-b-2 border-[#0a1d3f] pb-1 mb-3 mt-6">
            Entre les soussignés
          </h2>
          <p className={articleText}>
            YEHI OR Tech, agence de services numériques (Digital Agency), dont le siège est situé à Parakou,
            République du Bénin, représentée par M. <strong>AKPOVI TOHOU</strong> Sènakpon Dawes, en sa qualité de
            Directeur Technique et fondateur, dûment habilité(e) aux fins des présentes,
          </p>
          <p className={articleText}>
            ci-après dénommée <strong>« le Prestataire »</strong>, d&apos;une part,
          </p>
          <p className={articleText}>
            <strong>{schoolName}</strong>, sise {schoolCity}, représentée par M./Mme <strong>{promoterName}</strong>,
            en sa qualité de Promoteur, dûment habilité(e) aux fins des présentes,
          </p>
          <p className={articleText}>
            ci-après dénommée <strong>« le Client »</strong>, d&apos;autre part,
          </p>
          <p className={articleText}>
            Ci-après désignées ensemble <strong>« les Parties »</strong> et individuellement <strong>« la Partie »</strong>.
            Il a été convenu ce qui suit :
          </p>

          {/* ── Article 1 — Fiche de souscription (tableau 2 colonnes) ── */}
          <h3 className={articleTitle}>Article 1 — Fiche de souscription</h3>
          <p className={articleText}>
            La fiche ci-dessous récapitule les informations déclarées par le Client et acceptées par le Prestataire.
            Le Client reconnaît l&apos;exactitude des renseignements portés dans la présente fiche, dont dépendent
            notamment la détermination du plan applicable et la création de l&apos;espace de l&apos;établissement
            sur la plateforme.
          </p>
          <table className="w-full border-collapse mb-3">
            <thead>
              <tr>
                <th className={`${tblTh} w-[34%]`}>Renseignement</th>
                <th className={tblTh}>Information déclarée (à compléter par le Client)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className={`${tblTd} font-semibold`}>Établissement</td><td className={tblTd}>{schoolName}</td></tr>
              {effAnnexes.length > 0 && (
                <tr>
                  <td className={`${tblTd} font-semibold`}>Écoles annexes ({effAnnexes.length})</td>
                  <td className={tblTd}>
                    {effAnnexes.map((a, i) => (
                      <span key={i}>{a.name}{a.city ? ` — ${a.city}` : ''}{i < effAnnexes.length - 1 ? ' ; ' : ''}</span>
                    ))}
                  </td>
                </tr>
              )}
              <tr>
                <td className={`${tblTd} font-semibold`}>Nombre d&apos;établissements souscrits</td>
                <td className={`${tblTd} ${effSchoolsCount > 1 ? 'font-bold text-[#0a1d3f]' : ''}`}>{effSchoolsCount}</td>
              </tr>
              <tr><td className={`${tblTd} font-semibold`}>Promoteur (nom et prénom)</td><td className={tblTd}>{promoterName}</td></tr>
              <tr><td className={`${tblTd} font-semibold`}>Directeur / Directrice</td><td className={tblTd}>{directorName || promoterName}</td></tr>
              <tr><td className={`${tblTd} font-semibold`}>Adresse complète</td><td className={tblTd}>{schoolAddress || schoolCity}</td></tr>
              <tr><td className={`${tblTd} font-semibold`}>Ville</td><td className={tblTd}>{schoolCity}</td></tr>
              <tr><td className={`${tblTd} font-semibold`}>Téléphone</td><td className={tblTd}>{schoolPhone}</td></tr>
              <tr><td className={`${tblTd} font-semibold`}>Adresse électronique (e-mail)</td><td className={tblTd}>{schoolEmail}</td></tr>
              <tr><td className={`${tblTd} font-semibold`}>Effectif estimé (nombre d&apos;élèves)</td><td className={tblTd}>{studentCount}</td></tr>
              <tr>
                <td className={`${tblTd} font-semibold`}>Plan choisi (cocher une seule case)</td>
                <td className={tblTd}>
                  {PLAN_TABLE.map((p) => (
                    <span key={p.code} className="mr-2">
                      {p.code === planCode ? checkOn : checkOff} {p.name}
                    </span>
                  ))}
                </td>
              </tr>
              <tr>
                <td className={`${tblTd} font-semibold`}>Option bilingue FR/EN (cocher)</td>
                <td className={tblTd}>
                  {bilingual ? <span className="text-emerald-700 font-bold">☑</span> : <span className="text-slate-500">☐</span>} Oui{' '}
                  {bilingual ? <span className="text-slate-500">☐</span> : <span className="text-emerald-700 font-bold">☑</span>} Non
                </td>
              </tr>
              <tr><td className={`${tblTd} font-semibold`}>Sous-domaine souhaité</td><td className={tblTd}>{subdomain}.academiahelm.com</td></tr>
              <tr><td className={`${tblTd} font-semibold`}>Date d&apos;effet souhaitée</td><td className={tblTd}>{today}</td></tr>
            </tbody>
          </table>

          {/* ── Article 2 — Objet du contrat (texte intégral) ── */}
          <h3 className={articleTitle}>Article 2 — Objet du contrat</h3>
          <p className={articleText}>
            Le Prestataire concède au Client, dans les conditions du présent contrat, un droit d&apos;usage non exclusif,
            non cessible et à titre onéreux de la plateforme Academia Helm (applications Web, Desktop et Mobile).
            Le présent contrat couvre notamment : l&apos;hébergement de la plateforme, la maintenance corrective et
            évolutive, le support technique, l&apos;accompagnement à la prise en main (onboarding), la formation initiale
            des utilisateurs, ainsi que l&apos;accès aux agents d&apos;intelligence artificielle (ORION, SARA, ATLAS) dans
            le cadre d&apos;un usage raisonnable et professionnel (ces agents IA ne sont pas encore déployés). Les
            fonctionnalités accessibles au Client varient selon le plan souscrit, tel que défini à l&apos;Article 3.
          </p>

          {/* ── Article 3 — Plan souscrit et grille tarifaire ── */}
          <h3 className={articleTitle}>Article 3 — Plan souscrit et grille tarifaire</h3>
          <p className={articleText}>
            Le Client souscrit l&apos;un des plans ci-dessous en cochant, dans la colonne « Votre choix », le plan qui
            correspond à l&apos;effectif déclaré à l&apos;Article 1. Les montants s&apos;entendent en francs CFA (FCFA),
            toutes taxes comprises.
          </p>
          <table className="w-full border-collapse mb-3">
            <thead>
              <tr>
                <th className={tblTh}>Plan</th>
                <th className={`${tblTh} text-center`}>Capacité (élèves)</th>
                <th className={`${tblTh} text-right`}>Activation (FCFA)</th>
                <th className={`${tblTh} text-right`}>Frais annuels (FCFA)</th>
                <th className={`${tblTh} text-right`}>Total Année 1 (FCFA)</th>
                <th className={`${tblTh} text-center`}>Votre choix</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_TABLE.map((p) => (
                <tr key={p.code} className={p.code === planCode ? 'bg-blue-50 font-semibold' : ''}>
                  <td className={tblTd}>
                    {p.name}{p.code === planCode && <span className="text-emerald-700 ml-1 font-bold">☑</span>}
                  </td>
                  <td className={`${tblTd} text-center`}>{p.range}</td>
                  <td className={`${tblTd} text-right`}>{p.activation.toLocaleString('fr-FR')}</td>
                  <td className={`${tblTd} text-right`}>{p.annual.toLocaleString('fr-FR')}</td>
                  <td className={`${tblTd} text-right`}>{p.total.toLocaleString('fr-FR')}</td>
                  <td className={`${tblTd} text-center`}>{p.code === planCode ? <span className="text-emerald-700 font-bold">☑</span> : checkOff}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={articleText}>
            {bilingual ? checkOn : checkOff} Option bilingue FR/EN souscrite — supplément de{' '}
            <strong>{formatCurrency(bilingualFee)} ({amountToFrenchWords(bilingualFee)}) FCFA par an</strong>, à
            facturation annuelle{effSchoolsCount > 1 ? `, par établissement (${effSchoolsCount} établissements → ${formatCurrency(bilingualFee * effSchoolsCount)} FCFA/an)` : ''}.
          </p>
          <p className={articleText}>
            {bilingual ? checkOff : checkOn} Option bilingue non souscrite.
          </p>

          {/* ⭐ Détail multi-écoles (une ligne par établissement souscrit) */}
          {effSchoolsCount > 1 && (
            <>
              <p className={articleText}>
                <strong>Détail de la souscription multi-écoles</strong> — la présente souscription couvre{' '}
                <strong>{effSchoolsCount} établissements</strong>, chacun disposant de son espace isolé sur la
                plateforme (données, personnels, élèves, frais de scolarité propres) et facturé comme suit :
              </p>
              <table className="w-full border-collapse mb-3">
                <thead>
                  <tr>
                    <th className={tblTh}>N°</th>
                    <th className={tblTh}>Établissement</th>
                    <th className={tblTh}>Ville</th>
                    <th className={`${tblTh} text-right`}>Activation (FCFA)</th>
                    <th className={`${tblTh} text-right`}>Frais annuels (FCFA)</th>
                    <th className={`${tblTh} text-right`}>Année 1 (FCFA)</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: effSchoolsCount }).map((_, i) => {
                    const name = i === 0 ? schoolName : (effAnnexes[i - 1]?.name || `${schoolName} - Annexe ${i}`);
                    const city = i === 0 ? schoolCity : (effAnnexes[i - 1]?.city || schoolCity);
                    return (
                      <tr key={i}>
                        <td className={`${tblTd} text-center`}>{i + 1}</td>
                        <td className={tblTd}>{name}</td>
                        <td className={tblTd}>{city}</td>
                        <td className={`${tblTd} text-right`}>{activationFee.toLocaleString('fr-FR')}</td>
                        <td className={`${tblTd} text-right`}>{annualFee.toLocaleString('fr-FR')}</td>
                        <td className={`${tblTd} text-right`}>{(activationFee + annualFee).toLocaleString('fr-FR')}</td>
                      </tr>
                    );
                  })}
                  {bilingualFee > 0 && (
                    <tr>
                      <td className={`${tblTd} text-center italic`} colSpan={5}>Option bilingue FR/EN par établissement</td>
                      <td className={`${tblTd} text-right`}>{bilingualFee.toLocaleString('fr-FR')}</td>
                    </tr>
                  )}
                  <tr className="bg-amber-50 font-bold">
                    <td className={tblTd} colSpan={5}>TOTAL ANNÉE 1 — GROUPE ({effSchoolsCount} établissements)</td>
                    <td className={`${tblTd} text-right`}>{totalYearOne.toLocaleString('fr-FR')}</td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
          <p className={articleText}>
            <strong>Coût total Année 1, option bilingue incluse le cas échéant :</strong>{' '}
            <strong className="text-emerald-800">{formatCurrency(totalYearOne)} ({amountToFrenchWords(totalYearOne)}) FCFA</strong>
            {effSchoolsCount > 1 ? ` — soit ${formatCurrency(perSchoolTotal)} FCFA par établissement × ${effSchoolsCount} établissements` : ''}.
          </p>

          {/* ── Article 4 — Prix et modalités de paiement ── */}
          <h3 className={articleTitle}>Article 4 — Prix et modalités de paiement</h3>

          <h4 className={subTitle}>4.1 — Conditions générales de prix</h4>
          <p className={articleText}>
            Le Client verse au Prestataire : d&apos;une part, des frais d&apos;activation uniques de 500 000 (cinq cent
            mille) FCFA{effSchoolsCount > 1 ? ' par établissement souscrit' : ''}, dus intégralement à la signature du
            présent contrat ; d&apos;autre part, des frais annuels d&apos;abonnement conformes au plan souscrit à
            l&apos;Article 3, payables d&apos;avance à chaque date d&apos;échéance annuelle. Le règlement s&apos;effectue
            en espèces contre reçu établi par le Prestataire, modalité de référence du présent contrat, ou, le cas
            échéant, par virement bancaire ou Mobile Money. Le service de messagerie Helm Connect est inclus
            gratuitement et sans limitation. Ce service de messagerie est à l&apos;instar de WhatsApp, mais sans
            dépendance à WhatsApp. Le service e-mail est également gratuit.
          </p>

          <h4 className={subTitle}>4.2 — Modalité de règlement retenue (cocher une seule case)</h4>
          <p className={articleText}>
            {!isInstallments ? checkOn : checkOff} Paiement intégral en espèces : la totalité de la souscription (frais
            d&apos;activation, frais annuels et, le cas échéant, frais de l&apos;option bilingue de la première année)
            est réglée à la signature du présent contrat — la section 4.3 est complétée.
          </p>
          <p className={articleText}>
            {isInstallments ? checkOn : checkOff} Paiement échelonné par tranches : la souscription est réglée selon
            l&apos;échéancier accepté par le Prestataire — la section 4.4 est complétée, datée et émargée.
          </p>

          <h4 className={subTitle}>4.3 — Paiement intégral en espèces (certification d&apos;encaissement)</h4>
          <div className="border border-emerald-600 bg-emerald-50/60 rounded-md p-3 mb-3">
            <p className="text-[10.5px] leading-[1.55] text-slate-800 mb-1.5">
              La présente section certifie l&apos;encaissement des sommes réglées en espèces par le Client ; elle est
              complétée et signée par le Prestataire :
            </p>
            <p className="text-[10.5px] leading-[1.55] text-slate-800">
              {!isInstallments && subscriptionPaid ? checkOn : checkOff} La souscription — frais d&apos;activation de
              500 000 FCFA{effSchoolsCount > 1 ? ` × ${effSchoolsCount} établissements` : ''} et frais annuels du plan
              souscrit — a été intégralement réglée en espèces.
            </p>
            <p className="text-[10.5px] leading-[1.55] text-slate-800">
              {bilingual && !isInstallments && bilingualPaid ? checkOn : checkOff} Option bilingue FR/EN souscrite :
              les frais de la première année, à facturation annuelle, ont été réglés en espèces.
            </p>
            <p className="text-[10.5px] leading-[1.55] text-slate-800 mt-1.5">
              Encaissé par (nom et prénom de l&apos;agent YEHI OR Tech) :{' '}
              <strong>{receivedBy || '_________________________________'}</strong>
            </p>
            <p className="text-[10.5px] leading-[1.55] text-slate-800">
              N° du ou des reçus : ____________________ — Date(s) de règlement :{' '}
              {!isInstallments && subscriptionPaid ? today : '____ / ____ / ________'}
            </p>
          </div>

          <h4 className={subTitle}>4.4 — Paiement échelonné par tranches</h4>
          <p className={articleText}>
            En cas d&apos;accord exprès du Prestataire, le Client peut régler la souscription par tranches, selon
            l&apos;échéancier ci-dessous. Un acompte est versé à la signature du présent contrat et le solde est
            intégralement réglé au plus tard le ____ / ____ / ________ (date limite convenue entre les Parties).
            Chaque règlement donne lieu à l&apos;établissement d&apos;un reçu, dont le numéro est reporté dans
            l&apos;échéancier, et à l&apos;émargement (paraphe) du représentant du Prestataire.
          </p>
          <table className="w-full border-collapse mb-2">
            <thead>
              <tr>
                <th className={tblTh}>Tranche</th>
                <th className={tblTh}>Libellé</th>
                <th className={`${tblTh} text-right`}>Montant (FCFA)</th>
                <th className={tblTh}>Échéance</th>
                <th className={tblTh}>Réglé le</th>
                <th className={tblTh}>N° de reçu</th>
                <th className={tblTh}>Paraphe</th>
              </tr>
            </thead>
            <tbody>
              {isInstallments ? (
                <>
                  {schedule.map((t, i) => (
                    <tr key={i} className={i === 0 && downPaymentReceived ? 'bg-blue-50 font-semibold' : ''}>
                      <td className={`${tblTd} text-center`}>{i + 1}</td>
                      <td className={tblTd}>{t.label}</td>
                      <td className={`${tblTd} text-right`}>{formatCurrency(t.amount)}</td>
                      <td className={tblTd}>{i === 0 && !t.dueDate ? 'à la signature' : fmtDue(t.dueDate)}</td>
                      <td className={tblTd}>{i === 0 && downPaymentReceived ? today : ''}</td>
                      <td className={tblTd}></td>
                      <td className={tblTd}></td>
                    </tr>
                  ))}
                  <tr className="bg-amber-50 font-bold">
                    <td className={tblTd} colSpan={2}>TOTAL À RÉGLER (en chiffres)</td>
                    <td className={`${tblTd} text-right`}>{formatCurrency(scheduleTotal)}</td>
                    <td className={tblTd} colSpan={4}></td>
                  </tr>
                </>
              ) : (
                <>
                  {['Acompte à la signature', 'Tranche 2', 'Tranche 3', 'Solde'].map((label, i) => (
                    <tr key={i}>
                      <td className={`${tblTd} text-center`}>{i + 1}</td>
                      <td className={tblTd}>{label}</td>
                      <td className={tblTd}></td>
                      <td className={tblTd}></td>
                      <td className={tblTd}></td>
                      <td className={tblTd}></td>
                      <td className={tblTd}></td>
                    </tr>
                  ))}
                  <tr className="bg-amber-50 font-bold">
                    <td className={tblTd} colSpan={2}>TOTAL À RÉGLER (en chiffres)</td>
                    <td className={tblTd}></td>
                    <td className={tblTd} colSpan={4}></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          <p className="text-[9.5px] italic text-slate-600 mb-2">
            Émargement : paraphe apposé par le représentant du Prestataire lors de chaque encaissement.
            L&apos;échéancier complété fait partie intégrante du présent contrat au sens de l&apos;Article 14.
          </p>
          <p className={articleText}>
            À défaut de règlement intégral du solde à la date limite convenue, et après mise en demeure demeurée sans
            effet pendant trente (30) jours, le Prestataire peut suspendre l&apos;accès à la plateforme, puis engager
            la résiliation dans les conditions de l&apos;Article 10, sans préjudice du recouvrement des sommes restant
            dues. Les tranches déjà réglées demeurent acquises au Prestataire au titre de la couverture des coûts
            d&apos;activation et d&apos;exploitation du service.
          </p>

          {/* ── Articles 5 à 14 (textes intégraux du Word) ── */}
          <h3 className={articleTitle}>Article 5 — Durée et reconduction</h3>
          <p className={articleText}>
            Le présent contrat est conclu pour une durée initiale d&apos;un (1) an à compter de la date d&apos;effet
            mentionnée à l&apos;Article 1. Il se renouvelle par tacite reconduction pour des périodes successives
            d&apos;un (1) an, sauf dénonciation par l&apos;une des Parties, notifiée par écrit au moins soixante (60)
            jours avant la date d&apos;échéance annuelle. Le Prestataire se réserve le droit de réviser la grille
            tarifaire pour les périodes de reconduction futures, sous réserve d&apos;en informer le Client au moins
            soixante (60) jours avant l&apos;échéance concernée ; le maintien de l&apos;abonnement au-delà de cette
            échéance vaut acceptation de la nouvelle grille.
          </p>

          <h3 className={articleTitle}>Article 6 — Obligations du Prestataire</h3>
          <p className={articleText}>
            Le Prestataire s&apos;engage à : (i) assurer la disponibilité, l&apos;hébergement et la maintenance
            corrective et évolutive de la plateforme ; (ii) fournir un support technique dans des délais raisonnables ;
            (iii) assurer l&apos;accompagnement à la prise en main (onboarding) et la formation initiale des
            utilisateurs du Client ; (iv) mettre en œuvre des mesures techniques et organisationnelles raisonnables
            afin de garantir la sécurité et la confidentialité des données du Client ; (v) informer le Client en cas
            d&apos;évolution substantielle de la plateforme ; et (vi) encadrer l&apos;usage des agents d&apos;intelligence
            artificielle (ORION, SARA, ATLAS) dans la limite d&apos;un usage raisonnable et professionnel.
          </p>

          <h3 className={articleTitle}>Article 7 — Obligations du Client</h3>
          <p className={articleText}>
            Le Client s&apos;engage à : (i) régler les sommes dues aux échéances convenues, conformément à
            l&apos;Article 4 ; (ii) fournir des informations exactes, complètes et à jour, notamment celles figurant à
            l&apos;Article 1 ; (iii) faire un usage de la plateforme conforme à sa destination ; (iv) préserver la
            confidentialité des identifiants de connexion mis à sa disposition et en garantir la maîtrise ; et (v)
            respecter la législation béninoise applicable, notamment en matière de protection des données à caractère
            personnel.
          </p>

          <h3 className={articleTitle}>Article 8 — Propriété intellectuelle</h3>
          <p className={articleText}>
            La plateforme Academia Helm, y compris ses logiciels, bases de données, structures, modèles et
            documentations associées, demeure la propriété exclusive du Prestataire. Le présent contrat confère au
            Client un droit d&apos;usage personnel, non exclusif et non transférable, limité à la durée du contrat.
            Les données saisies par le Client demeurent sa propriété exclusive ; le Prestataire s&apos;engage à en
            permettre l&apos;export à tout moment et, au plus tard, dans les conditions fixées à l&apos;Article 10.
          </p>

          <h3 className={articleTitle}>Article 9 — Protection des données et confidentialité</h3>
          <p className={articleText}>
            Chaque Partie s&apos;engage à mettre en œuvre des mesures techniques et organisationnelles raisonnables
            pour assurer la sécurité et la confidentialité des données traitées dans le cadre du présent contrat.
            Les Parties s&apos;obligent réciproquement à un devoir de confidentialité sur les informations non
            publiques échangées, pendant toute la durée du contrat et pendant deux (2) ans après son expiration
            ou sa résiliation.
          </p>

          <h3 className={articleTitle}>Article 10 — Résiliation</h3>
          <p className={articleText}>
            En cas de manquement grave de l&apos;une des Parties à ses obligations, l&apos;autre Partie peut résilier
            le contrat de plein droit après mise en demeure par écrit demeurée sans effet pendant trente (30) jours.
            Le non-paiement persistant des sommes dues au-delà de quarante-cinq (45) jours à compter de leur échéance
            entraîne la résiliation de plein droit du contrat, sans autre formalité. En cas de résiliation, quelle
            qu&apos;en soit la cause, le Client dispose d&apos;un délai de trente (30) jours pour procéder à
            l&apos;export de ses données ; le Prestataire apporte son assistance technique à cette fin.
          </p>

          <h3 className={articleTitle}>Article 11 — Responsabilité et garanties</h3>
          <p className={articleText}>
            La responsabilité du Prestataire, toutes causes confondues, est limitée au montant total des sommes
            effectivement perçues au titre du contrat au cours des douze (12) derniers mois précédant la survenance
            du fait générateur. L&apos;architecture offline-first de la plateforme vise à limiter les pertes de
            données en cas d&apos;indisponibilité de la connexion ; cette architecture ne constitue toutefois pas
            une garantie absolue contre toute perte de données. Le Client demeure seul responsable de la saisie,
            de l&apos;exactitude et de la sauvegarde de ses données.
          </p>

          <h3 className={articleTitle}>Article 12 — Force majeure</h3>
          <p className={articleText}>
            Aucune des Parties n&apos;est tenue responsable d&apos;une inexécution ou d&apos;un retard d&apos;exécution
            de ses obligations dû à un cas de force majeure tel que défini par la législation et la jurisprudence
            béninoises. La Partie affectée en informe l&apos;autre par écrit dans un délai raisonnable ; les Parties
            conviennent alors des modalités de continuation du contrat. À défaut d&apos;accord, le contrat peut être
            résilié sans indemnité.
          </p>

          <h3 className={articleTitle}>Article 13 — Droit applicable et juridiction</h3>
          <p className={articleText}>
            Le présent contrat est régi par le droit de la République du Bénin. En cas de différend relatif à sa
            formation, son interprétation, son exécution ou sa résiliation, les Parties s&apos;efforcent de le
            résoudre à l&apos;amiable dans un délai de trente (30) jours à compter de la notification écrite du
            différend. À défaut d&apos;accord amiable, compétence est expressément attribuée aux juridictions de
            Parakou, nonobstant pluralité de défendeurs ou appel en garantie.
          </p>

          <h3 className={articleTitle}>Article 14 — Dispositions diverses</h3>
          <p className={articleText}>
            Le présent contrat et ses éventuels avenants expriment l&apos;intégralité de l&apos;accord des Parties sur
            son objet et se substituent à toute correspondance, proposition ou document antérieur. Toute modification
            doit faire l&apos;objet d&apos;un avenant écrit, daté et signé des deux Parties. Si l&apos;une quelconque
            des stipulations du présent contrat était déclarée nulle ou inapplicable, les autres stipulations
            conserveraient toute leur force et leur portée. L&apos;échéancier de paiement par tranches éventuellement
            complété en application de l&apos;Article 4 fait partie intégrante du présent contrat.
          </p>

          {/* ── Signatures (tableau 2 colonnes — Word) ── */}
          <h2 className="font-bold text-[13px] text-[#0a1d3f] uppercase tracking-wide border-b-2 border-[#0a1d3f] pb-1 mb-3 mt-6">
            Signatures
          </h2>
          <p className={articleText}>
            Fait à _________________, le ____ / ____ / ________, en deux (2) exemplaires originaux, dont un pour
            chaque Partie.
          </p>

          {/* ⭐ Case à cocher : contrat déjà signé manuellement (papier) */}
          <label
            className={`flex items-start gap-2 cursor-pointer select-none text-[10.5px] leading-snug rounded-md px-3 py-2 mb-3 border ${
              signedManually
                ? 'bg-amber-100 border-amber-400 text-amber-900'
                : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <input
              type="checkbox"
              checked={signedManually}
              onChange={(e) => setSignedManually(e.target.checked)}
              disabled={loading}
              className="accent-amber-600 w-3.5 h-3.5 mt-0.5 shrink-0"
            />
            <Stamp className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Contrat déjà signé manuellement</strong> (version papier) — aucune signature numérique ne sera
              demandée. Le contrat PDF sera envoyé par email avec la mention « déjà signé manuellement »,
              l&apos;école sera créée et le promoteur recevra ses identifiants.
            </span>
          </label>

          <div className="grid grid-cols-2 gap-0 border border-[#0a1d3f]">
            {/* LE CLIENT */}
            <div className="p-4 border-r border-[#0a1d3f]">
              <div className="text-center font-bold text-[11px] text-[#0a1d3f] uppercase tracking-wide mb-3">
                Le Client
              </div>
              <p className="text-[10.5px] mb-1"><strong>Établissement :</strong> {schoolName}</p>
              <p className="text-[10.5px] mb-1"><strong>Représenté par :</strong> M./Mme {promoterName}</p>
              <p className="text-[10.5px] mb-1"><strong>Qualité :</strong> Promoteur</p>
              <p className="text-[10.5px] mb-2">
                Signature, précédée de la mention manuscrite <strong>« Lu et approuvé »</strong> :
              </p>
              {signedManually ? (
                <div className="border border-dashed border-amber-400 bg-amber-50 rounded-md py-4 text-center">
                  <div className="text-[11px] font-bold text-amber-800 leading-tight">
                    ✒️ Déjà signé manuellement
                    <span className="block text-[8.5px] font-normal text-amber-700 mt-0.5">(voir exemplaire papier)</span>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-2">Date : {today}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1 mb-1 text-[10px] font-semibold text-slate-500">
                    <User className="w-3 h-3" /> Pour le Client — {promoterName}
                  </div>
                  <SignatureCanvas
                    width={320}
                    height={70}
                    onSignatureChange={setPromoterSignature}
                    placeholder="Signature du promoteur"
                  />
                  <p className="text-[9px] text-slate-400 mt-1">Date : {today}</p>
                </>
              )}
              <p className="text-[10.5px] mt-3"><strong>Cachet de l&apos;établissement :</strong></p>
            </div>

            {/* LE PRESTATAIRE */}
            <div className="p-4">
              <div className="text-center font-bold text-[11px] text-[#0a1d3f] uppercase tracking-wide mb-3">
                Le Prestataire
              </div>
              <p className="text-[10.5px] mb-1"><strong>Dénomination :</strong> YEHI OR Tech</p>
              <p className="text-[10.5px] mb-1"><strong>Siège :</strong> Parakou, République du Bénin</p>
              <p className="text-[10.5px] mb-1"><strong>Représenté par :</strong> M./Mme AKPOVI TOHOU S. D.</p>
              <p className="text-[10.5px] mb-1"><strong>Qualité :</strong> Directeur Technique et fondateur</p>
              <p className="text-[10.5px] mb-2"><strong>Signature et cachet de la société :</strong></p>
              {signedManually ? (
                <div className="border border-dashed border-amber-400 bg-amber-50 rounded-md py-4 text-center">
                  <div className="text-[11px] font-bold text-amber-800 leading-tight">
                    ✒️ Déjà signé manuellement
                    <span className="block text-[8.5px] font-normal text-amber-700 mt-0.5">(voir exemplaire papier)</span>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-2">Date : {today}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1 mb-1 text-[10px] font-semibold text-slate-500">
                    <Building2 className="w-3 h-3" /> Pour le Prestataire — YEHI OR Tech
                  </div>
                  <SignatureCanvas
                    width={320}
                    height={70}
                    onSignatureChange={setProviderSignature}
                    placeholder="Signature YEHI OR Tech"
                  />
                  <p className="text-[9px] text-slate-400 mt-1">
                    Date : {providerSignature ? today : '____ / ____ / ________'}
                  </p>
                </>
              )}
            </div>
          </div>

          <p className="text-center text-[9px] text-slate-500 mt-6 border-t border-slate-200 pt-3">
            YEHI OR Tech — Academia Helm · {SUPPORT_EMAIL} · www.academiahelm.com · Parakou, République du Bénin
          </p>
        </div>
      </div>

      {/* ── Barre d'actions fixe en bas ── */}
      <div className="flex-shrink-0 flex gap-2 justify-center px-4 py-2 bg-white border-t border-slate-200">
        <Button
          onClick={handleSignNow}
          disabled={loading || (!promoterSignature && !signedManually)}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8"
        >
          {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
          {signedManually
            ? `Créer ${effSchoolsCount > 1 ? `${effSchoolsCount} écoles` : 'l\'école'} (contrat signé)`
            : `Signer et créer ${effSchoolsCount > 1 ? `${effSchoolsCount} écoles` : 'l\'école'}`}
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
