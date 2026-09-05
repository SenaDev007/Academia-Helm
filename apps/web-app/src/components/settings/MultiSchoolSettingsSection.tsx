'use client';

/**
 * ============================================================================
 * MULTI-SCHOOL SETTINGS SECTION — Activation multi-écoles (paramètres promoteur)
 * ============================================================================
 *
 * ⭐ « Depuis les paramètres, le promoteur peut activer le multi-écoles pour
 *    gérer une école annexe. C'est payant en fonction du nombre d'écoles. »
 *
 * Flux :
 *   1. Éligibilité (GET /api/onboarding/annex/eligibility) : écoles déjà
 *      gérées (UserTenant ∪ direct) + prix par école.
 *   2. Formulaire d'annexe : nom, ville, type, contact, plan, effectif,
 *      option bilingue — avec le récapitulatif de prix (PAR ÉCOLE :
 *      activation + frais annuels + option bilingue).
 *   3. Création (POST /api/onboarding/annex) : draft mono-école pré-rempli
 *      avec le compte du promoteur (source de confiance) + plan sélectionné.
 *   4. Contrat conforme au document Word (même composant que l'onboarding) :
 *      signature → activation → l'école annexe rejoint le groupe
 *      (UserTenant + vue stratégique + available-tenants).
 *
 * Réservé aux rôles promoteur (miroir backend : isStrategicRole).
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2, Plus, RefreshCw, Loader2, CheckCircle2, MapPin, Globe, ArrowLeft, Info,
  DollarSign, Calendar, AlertTriangle, RotateCcw, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { HELM_PLANS, HELM_ACTIVATION_FEE, BILINGUAL_ADDON, getAnnexActivationPricing } from '@/lib/services/HelmPricingService';
import ContractStep from '@/components/onboarding/ContractStep';
import { useToast } from '@/components/ui/use-toast';

/** Rôles autorisés à activer le multi-écoles (miroir backend isStrategicRole). */
const PROMOTER_ROLES = ['PROMOTER', 'PROMOTEUR', 'SCHOOL_OWNER', 'SUPER_DIRECTOR'];

interface EligibilitySchool {
  tenantId: string;
  name: string;
  subdomain: string | null;
  city: string | null;
}

interface EligibilityPlan {
  code: string;
  name: string;
  activationFee: number;
  annualFee: number;
  yearOnePerSchool: number;
  studentMin: number;
  studentMax: number | null;
}

interface EligibilityData {
  eligible: boolean;
  currentSchools: EligibilitySchool[];
  nextAnnexIndex: number;
  // ⭐ Barème progressif du coût d'activation de la prochaine annexe :
  //    rang (2e école → −15 %, 3e → −20 %, 4e → −25 %), negotiated = true
  //    dès la 5e école (tarification négociée — aucun tarif automatique).
  annexActivation?: {
    rank: number;
    negotiated: boolean;
    baseFee: number;
    fee: number | null;
    discountPercent: number;
  };
  pricing: {
    currency: string;
    bilingualYearly: number;
    plans: EligibilityPlan[];
  };
}

interface AnnexFormState {
  annexName: string;
  annexCity: string;
  schoolType: string;
  phone: string;
  email: string;
  planCode: string;
  estimatedStudentCount: number;
  bilingual: boolean;
}

/** Modalités de paiement en espèces (contrat Article 4) — intégral ou échéancier. */
interface PaymentMarkedState {
  paymentPlan: 'full' | 'installments';
  installments: { label: string; amount: number | ''; dueDate: string }[];
  downPaymentReceived: boolean;
  subscriptionPaid: boolean;
  bilingualPaid: boolean;
  receivedBy: string;
}

const MAX_INSTALLMENTS = 5;

const defaultPaymentMarked = (): PaymentMarkedState => ({
  paymentPlan: 'full',
  installments: [
    { label: 'Acompte à la signature', amount: '', dueDate: '' },
    { label: 'Tranche 2', amount: '', dueDate: '' },
  ],
  downPaymentReceived: false,
  subscriptionPaid: false,
  bilingualPaid: false,
  receivedBy: '',
});

interface MultiSchoolSettingsSectionProps {
  user: {
    role?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    tenantId?: string;
  };
  onSchoolCreated?: () => void;
}

const SCHOOL_TYPES = [
  { value: 'MATERNELLE', label: 'Maternelle' },
  { value: 'PRIMAIRE', label: 'Primaire' },
  { value: 'SECONDAIRE', label: 'Secondaire' },
  { value: 'MIXTE', label: 'Mixte (tous cycles)' },
];

export function MultiSchoolSettingsSection({ user, onSchoolCreated }: MultiSchoolSettingsSectionProps) {
  const { toast } = useToast();
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Draft d'annexe créé → affichage du contrat (même composant que l'onboarding)
  // ⭐ `payment` : modalités de paiement saisies depuis les paramètres
  //    (intégral ou échéancier de tranches) — transmises au contrat.
  // ⭐ `resumed` + fees/planName/subdomain : reprise d'un draft EXISTANT
  //    (« un onboarding est déjà en cours pour cet email ») — le contrat
  //    s'appuie alors sur le snapshot serveur, comme à l'inscription.
  const [annexDraft, setAnnexDraft] = useState<{
    draftId: string;
    form: AnnexFormState;
    promoterName: string;
    resumed?: boolean;
    planName?: string;
    subdomain?: string;
    activationFee?: number;
    annualFee?: number;
    bilingualFee?: number;
    // ⭐ Barème progressif (snapshot serveur — source de vérité du contrat)
    annexRank?: number;
    activationBaseFee?: number;
    activationDiscountPercent?: number;
    payment?: {
      paymentPlan: 'full' | 'installments';
      installments?: { label: string; amount: number; dueDate?: string }[];
      subscriptionPaid: boolean;
      bilingualPaid: boolean;
      downPaymentReceived?: boolean;
      receivedBy?: string;
    };
  } | null>(null);

  // ⭐ Draft existant détecté à la création → modal « continuer ou
  //    recommencer » (même expérience que l'onboarding du sign-up).
  const [existingDraftChoice, setExistingDraftChoice] = useState<{
    draftId: string;
    status?: string;
    data?: any;
  } | null>(null);

  // Modalités de paiement (Article 4) — intégral ou échéancier de tranches
  const [paymentMarked, setPaymentMarked] = useState<PaymentMarkedState>(defaultPaymentMarked());
  // Annulation + relance du draft existant (modal « onboarding déjà en cours »)
  const [discardingDraft, setDiscardingDraft] = useState(false);

  const isPromoter = PROMOTER_ROLES.includes(user?.role || '');

  const [form, setForm] = useState<AnnexFormState>({
    annexName: '',
    annexCity: '',
    schoolType: 'MIXTE',
    phone: '',
    email: user?.email || '',
    planCode: 'SEED',
    estimatedStudentCount: 0,
    bilingual: false,
  });

  const loadEligibility = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('accessToken')?.trim() ?? '';
      const response = await fetch('/api/onboarding/annex/eligibility', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Impossible de charger l'éligibilité multi-écoles");
      }
      setEligibility(data as EligibilityData);
    } catch (err: any) {
      setError(err?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isPromoter) {
      loadEligibility();
    }
  }, [isPromoter, loadEligibility]);

  // ⭐ Prix de l'annexe : PAR ÉCOLE (activation + frais annuels + bilingue)
  //    — source : eligibility.pricing (pricing_plans), fallback HELM_PLANS.
  //    ⭐ Barème progressif du coût d'activation : le tarif de l'annexe dépend
  //    de son rang dans le groupe (2e −15 % → 425 000, 3e −20 % → 400 000,
  //    4e −25 % → 375 000 ; dès la 5e école : tarification négociée).
  const pricing = useMemo(() => {
    const bilingualYearly = eligibility?.pricing?.bilingualYearly ?? BILINGUAL_ADDON.annual ?? 100000;
    // Rang de la prochaine annexe → tarif d'activation remisé (ou négocié)
    const rank = eligibility?.annexActivation?.rank
      ?? eligibility?.nextAnnexIndex
      ?? (eligibility?.currentSchools?.length || 0) + 1;
    const annexTier = eligibility?.annexActivation
      ?? getAnnexActivationPricing(rank, HELM_ACTIVATION_FEE);
    const tierFee = annexTier.negotiated
      ? HELM_ACTIVATION_FEE // négocié : tarif de base (l'UI bloque la création)
      : (annexTier.fee ?? HELM_ACTIVATION_FEE);
    const plans = (eligibility?.pricing?.plans?.length
      ? eligibility.pricing.plans
      : (['SEED', 'GROW', 'LEAD', 'NETWORK'] as const).map((code) => ({
          code,
          name: HELM_PLANS[code].name,
          // ⭐ Fallback local : activation AU BARÈME (remise du rang)
          activationFee: tierFee,
          annualFee: HELM_PLANS[code].annualPrice,
          yearOnePerSchool: tierFee + HELM_PLANS[code].annualPrice,
          studentMin: code === 'SEED' ? 1 : code === 'GROW' ? 51 : code === 'LEAD' ? 151 : 401,
          studentMax: code === 'SEED' ? 50 : code === 'GROW' ? 150 : code === 'LEAD' ? 400 : null,
        }))) as EligibilityPlan[];
    const plan = plans.find((p) => p.code === form.planCode) || plans[0];
    const bilingualFee = form.bilingual ? bilingualYearly : 0;
    return {
      plans,
      plan,
      bilingualFee,
      annexTier,
      totalYearOne: (plan.activationFee + plan.annualFee + bilingualFee),
    };
  }, [eligibility, form.planCode, form.bilingual]);

  // ⭐ Tarification négociée (dès la 5e école) : la création en libre-service
  //    est bloquée — le promoteur est orienté vers la négociation (support).
  const annexNegotiated = pricing.annexTier.negotiated === true;

  const handleCreateAnnexDraft = async () => {
    // Validation minimale du formulaire
    if (!form.annexName.trim() || form.annexName.trim().length < 2) {
      setError("Le nom de l'école annexe est requis (2 caractères minimum).");
      return;
    }
    if (!form.annexCity.trim()) {
      setError('La ville / quartier de l\'annexe est requise.');
      return;
    }
    if (!form.phone.trim()) {
      setError('Le téléphone de contact de l\'annexe est requis.');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      setError("L'adresse e-mail de contact de l'annexe est requise.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const token = localStorage.getItem('accessToken')?.trim() ?? '';
      const response = await fetch('/api/onboarding/annex', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          annexName: form.annexName.trim(),
          annexCity: form.annexCity.trim(),
          schoolType: form.schoolType,
          phone: form.phone.trim(),
          email: form.email.trim(),
          planCode: form.planCode,
          estimatedStudentCount: form.estimatedStudentCount,
          bilingual: form.bilingual,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        // ⭐ Un draft existe déjà pour cet email (retour sans achever la
        //    contractualisation) → modal « continuer ou recommencer »,
        //    exactement comme l'onboarding du sign-up, au lieu d'une erreur
        //    brute « un onboarding est déjà en cours pour cet email ».
        const existingDraftId = data?.existingDraftId || data?.data?.existingDraftId;
        const existingStatus = data?.status || data?.data?.status;
        if (existingDraftId) {
          try {
            const draftResp = await fetch(
              `/api/onboarding/draft?draftId=${encodeURIComponent(existingDraftId)}`,
              { cache: 'no-store' },
            );
            if (draftResp.ok) {
              const draftData = await draftResp.json();
              setExistingDraftChoice({
                draftId: existingDraftId,
                status: existingStatus || draftData?.status,
                data: draftData,
              });
              return;
            }
          } catch {
            // chargement impossible → on retombe sur l'erreur ci-dessous
          }
        }
        throw new Error(data?.message || data?.error || "Impossible de créer le draft de l'école annexe");
      }
      // Draft créé (mono-école — l'annexe) + plan sélectionné → CONTRAT
      // conforme au Word (même composant que l'onboarding) puis activation.
      // ⭐ Modalités de paiement saisies dans le formulaire transmises au
      //    contrat (Article 4 : intégral ou échéancier de tranches).
      setAnnexDraft({
        draftId: data.draftId,
        form: { ...form },
        promoterName:
          data.promoter?.firstName || data.promoter?.lastName
            ? `${data.promoter?.firstName || ''} ${data.promoter?.lastName || ''}`.trim()
            : `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
        // ⭐ Barème progressif : tarif d'activation remisé + métadonnées du
        //    rang depuis le snapshot serveur (source de vérité du contrat,
        //    du paiement cash et de la signature différée).
        activationFee: Number(data.pricing?.initialFee ?? data.pricing?.initialPayment) > 0
          ? Number(data.pricing?.initialFee ?? data.pricing?.initialPayment)
          : undefined,
        activationBaseFee: data.pricing?.activationBaseFee != null
          ? Number(data.pricing.activationBaseFee)
          : undefined,
        activationDiscountPercent: data.pricing?.activationDiscountPercent != null
          ? Number(data.pricing.activationDiscountPercent)
          : undefined,
        annexRank: data.pricing?.annexRank != null ? Number(data.pricing.annexRank) : undefined,
        payment: {
          paymentPlan: paymentMarked.paymentPlan,
          installments:
            paymentMarked.paymentPlan === 'installments'
              ? paymentMarked.installments
                  .filter((t) => Number(t.amount) > 0)
                  .map((t) => ({
                    label: t.label,
                    amount: Number(t.amount) || 0,
                    dueDate: t.dueDate || undefined,
                  }))
              : undefined,
          subscriptionPaid:
            paymentMarked.paymentPlan === 'installments'
              ? paymentMarked.downPaymentReceived
              : paymentMarked.subscriptionPaid,
          bilingualPaid:
            paymentMarked.paymentPlan === 'installments'
              ? form.bilingual
              : paymentMarked.bilingualPaid,
          downPaymentReceived: paymentMarked.downPaymentReceived,
          receivedBy: paymentMarked.receivedBy.trim() || undefined,
        },
      });
      setShowForm(false);
      toast({
        title: 'Annexe prête à contractualiser',
        description: "Le contrat d'abonnement de l'école annexe a été généré — signez-le pour créer l'établissement.",
      });
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleAnnexContractDone = (result: {
    signed: boolean;
    subdomain?: string;
    domainStatus?: string;
  }) => {
    setAnnexDraft(null);
    setPaymentMarked(defaultPaymentMarked());
    if (result.signed) {
      // ⭐ État réel du sous-domaine (created / partial / failed / not_configured)
      const domainOk = result.domainStatus === 'created';
      toast({
        title: domainOk ? 'École annexe créée 🎉' : 'École annexe créée — sous-domaine en attente',
        description: domainOk
          ? "L'établissement a rejoint votre groupe. Retrouvez-le dans « Vue Groupe » et dans le sélecteur d'écoles au prochain rechargement."
          : `L'établissement a rejoint votre groupe, mais ${result.subdomain ? `${result.subdomain}.academiahelm.com` : 'son sous-domaine'} n'a pas pu être activé automatiquement (configuration des domaines à vérifier côté serveur API). L'école reste accessible via le domaine principal.`,
        ...(!domainOk ? { variant: 'destructive' as const } : {}),
      });
      // Rafraîchir la liste des écoles + notifier le parent (ex. recharger la session)
      loadEligibility();
      onSchoolCreated?.();
    } else {
      toast({
        title: 'Signature différée',
        description: "Le promoteur recevra le contrat par email — l'école sera créée dès signature.",
      });
      loadEligibility();
    }
  };

  // ── Reprise d'un draft EXISTANT (« onboarding déjà en cours pour cet email »)
  //    Poursuit la contractualisation là où elle s'était arrêtée : le contrat
  //    s'appuie sur le snapshot de prix serveur + les modalités de paiement
  //    déjà marquées (mêmes données que la page de signature différée).
  const handleContinueExistingDraft = () => {
    if (!existingDraftChoice) return;
    const d = existingDraftChoice.data || {};
    const snapshot = (d.priceSnapshot as any) || {};
    const marked = (snapshot.paymentMarked as any) || {};
    const restoredPlanCode = ['SEED', 'GROW', 'LEAD', 'NETWORK'].includes(snapshot.planCode)
      ? snapshot.planCode
      : (d.selectedPlanId || 'SEED');

    setAnnexDraft({
      draftId: existingDraftChoice.draftId,
      form: {
        annexName: d.schoolName || form.annexName,
        annexCity: d.city || form.annexCity,
        schoolType: d.schoolType || form.schoolType,
        phone: d.phone || form.phone,
        email: d.email || form.email,
        planCode: restoredPlanCode,
        estimatedStudentCount: Number(d.estimatedStudentCount ?? 0) || 0,
        bilingual: d.bilingual ?? false,
      },
      promoterName: `${d.promoterFirstName || user?.firstName || ''} ${d.promoterLastName || user?.lastName || ''}`.trim(),
      resumed: true,
      planName: snapshot.planName || HELM_PLANS[restoredPlanCode as keyof typeof HELM_PLANS]?.name,
      subdomain: d.preferredSubdomain || undefined,
      activationFee: Number(snapshot.initialFee ?? snapshot.initialPayment ?? 0) || undefined,
      annualFee: Number(snapshot.yearlyPrice ?? 0) || undefined,
      bilingualFee: d.bilingual ? Number(snapshot.bilingualFee ?? 0) || undefined : 0,
      // ⭐ Barème progressif (persisté dans le snapshot à la création)
      activationBaseFee: snapshot.activationBaseFee != null
        ? Number(snapshot.activationBaseFee)
        : undefined,
      activationDiscountPercent: snapshot.activationDiscountPercent != null
        ? Number(snapshot.activationDiscountPercent)
        : undefined,
      annexRank: snapshot.annexRank != null ? Number(snapshot.annexRank) : undefined,
      payment: {
        paymentPlan: marked.paymentPlan === 'installments' ? 'installments' : 'full',
        installments: Array.isArray(marked.installments) ? marked.installments : undefined,
        subscriptionPaid: marked.subscriptionPaid === true,
        bilingualPaid: marked.bilingualPaid === true,
        downPaymentReceived: marked.downPaymentReceived === true,
        receivedBy: marked.receivedBy || undefined,
      },
    });
    setExistingDraftChoice(null);
    setShowForm(false);
  };

  // Annule le brouillon existant puis relance immédiatement la création de
  // l'annexe avec les valeurs courantes du formulaire (POST cancel → POST annex).
  const handleDiscardExistingDraft = async () => {
    if (!existingDraftChoice) return;
    setDiscardingDraft(true);
    try {
      await fetch(
        `/api/onboarding/draft/${encodeURIComponent(existingDraftChoice.draftId)}/cancel`,
        { method: 'POST' },
      );
      setExistingDraftChoice(null);
      // Relancer la création avec le formulaire courant
      await handleCreateAnnexDraft();
    } catch (err: any) {
      setError(err?.message || 'Impossible de relancer la création du draft');
    } finally {
      setDiscardingDraft(false);
    }
  };

  // ⭐ Contrat d'annexe affiché EN PLEIN ÉCRAN (même expérience que l'onboarding)
  if (annexDraft) {
    const pay = annexDraft.payment;
    return (
      <ContractStep
        draftId={annexDraft.draftId}
        schoolName={annexDraft.form.annexName}
        promoterName={annexDraft.promoterName || user?.email || 'Promoteur'}
        schoolAddress={annexDraft.form.annexCity}
        schoolCity={annexDraft.form.annexCity}
        schoolPhone={annexDraft.form.phone}
        schoolEmail={annexDraft.form.email}
        studentCount={annexDraft.form.estimatedStudentCount}
        planCode={annexDraft.form.planCode}
        planName={annexDraft.planName || pricing.plan?.name || HELM_PLANS[annexDraft.form.planCode as keyof typeof HELM_PLANS]?.name || annexDraft.form.planCode}
        bilingual={annexDraft.form.bilingual}
        subdomain={
          annexDraft.subdomain
          || annexDraft.form.annexName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 20) || 'annexe'
        }
        activationFee={annexDraft.activationFee ?? pricing.plan?.activationFee ?? HELM_ACTIVATION_FEE}
        annualFee={annexDraft.annualFee ?? pricing.plan?.annualFee ?? 50000}
        // ⭐ Barème progressif : rang/remise du tarif d'activation de l'annexe
        //    (snapshot du draft repris, sinon éligibilité courante)
        annexRank={annexDraft.annexRank ?? (annexNegotiated ? undefined : pricing.annexTier.rank)}
        activationBaseFee={annexDraft.activationBaseFee ?? (annexNegotiated ? undefined : pricing.annexTier.baseFee)}
        activationDiscountPercent={
          annexDraft.activationDiscountPercent ?? (annexNegotiated ? undefined : pricing.annexTier.discountPercent)
        }
        schoolsCount={1}
        paymentPlan={pay?.paymentPlan ?? 'full'}
        installments={pay?.installments}
        downPaymentReceived={pay?.downPaymentReceived}
        subscriptionPaid={pay?.subscriptionPaid ?? false}
        bilingualPaid={pay?.bilingualPaid ?? false}
        receivedBy={pay?.receivedBy}
        overlayTop={58}
        onComplete={handleAnnexContractDone}
        onBack={() => setAnnexDraft(null)}
      />
    );
  }

  if (!isPromoter) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
        L&apos;activation multi-écoles est réservée aux promoteurs.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── En-tête ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 shadow-sm">
            <Building2 className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Écoles & Multi-écoles</h3>
            <p className="text-sm text-slate-500 mt-0.5 max-w-xl">
              Gérez vos établissements : chaque école dispose de son espace isolé (élèves, personnels, frais de
              scolarité propres) et d&apos;une vue d&apos;ensemble consolidée de votre groupe.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadEligibility}
          disabled={loading}
          className="border-slate-300 text-slate-600"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* ── Écoles déjà gérées ── */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement de vos établissements…
        </div>
      ) : (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-700">
            Vos établissements ({eligibility?.currentSchools?.length ?? 0})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(eligibility?.currentSchools || []).map((school, idx) => (
              <div
                key={school.tenantId}
                className={`rounded-lg border p-4 ${
                  idx === 0 ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {idx === 0 ? 'Établissement principal' : `École ${idx + 1}`}
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="font-semibold text-slate-800 text-sm mt-1.5 leading-snug">{school.name}</p>
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  {school.city && (
                    <p className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {school.city}
                    </p>
                  )}
                  {school.subdomain && (
                    <p className="flex items-center gap-1 truncate">
                      <Globe className="w-3 h-3" /> {school.subdomain}.academiahelm.com
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tarif multi-écoles (barème progressif du coût d'activation) ── */}
      <div className={`rounded-lg border p-4 ${annexNegotiated ? 'border-blue-200 bg-blue-50/70' : 'border-amber-200 bg-amber-50/70'}`}>
        <p className={`text-sm font-semibold flex items-center gap-2 ${annexNegotiated ? 'text-blue-900' : 'text-amber-900'}`}>
          <Info className="w-4 h-4" /> Le multi-écoles est payant, en fonction du nombre d&apos;écoles
        </p>
        {annexNegotiated ? (
          <p className="text-xs text-blue-800 mt-1.5 leading-relaxed">
            Votre groupe compte déjà <strong>{eligibility?.currentSchools?.length ?? 0} écoles</strong> : à partir de la
            5<sup>e</sup> école, le coût d&apos;activation relève d&apos;une <strong>tarification négociée</strong>
            (barème automatique : 1<sup>re</sup> école {formatCurrency(HELM_ACTIVATION_FEE)}, 2<sup>e</sup> −15 %,
            3<sup>e</sup> −20 %, 4<sup>e</sup> −25 %). Contactez{' '}
            <strong>support@academiahelm.com</strong> pour convenir d&apos;un tarif de groupe — la création en
            libre-service est réservée aux 4 premières écoles.
          </p>
        ) : (
          <p className="text-xs text-amber-800 mt-1.5 leading-relaxed">
            Chaque école annexe souscrit sa propre offre : coût d&apos;activation de{' '}
            <strong>{formatCurrency(pricing.plan?.activationFee ?? HELM_ACTIVATION_FEE)}</strong>
            {pricing.annexTier.discountPercent > 0 ? (
              <> — <strong>remise de {pricing.annexTier.discountPercent} %</strong> (tarif de la{' '}
              {pricing.annexTier.rank}<sup>e</sup> école du groupe, barème progressif : 2<sup>e</sup> −15 %,
              3<sup>e</sup> −20 %, 4<sup>e</sup> −25 %, dès la 5<sup>e</sup> tarification négociée)</>
            ) : (
              <> (tarif plein)</>
            )} + frais annuels du plan choisi (50 000 à 150 000 F CFA selon l&apos;effectif), le cas échéant
            l&apos;option bilingue FR/EN (<strong>{formatCurrency(pricing.bilingualFee || BILINGUAL_ADDON.annual || 100000)}</strong>).
            Le contrat d&apos;abonnement — conforme au contrat type — détaillera la souscription de l&apos;annexe au barème.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── Bouton / Formulaire d'ajout d'annexe ── */}
      {!showForm ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Button
            onClick={() => {
              setError(null);
              setShowForm(true);
            }}
            disabled={!eligibility?.eligible || annexNegotiated}
            className="bg-slate-900 hover:bg-slate-800 text-white"
            title={annexNegotiated ? 'Tarification négociée dès la 5e école — contactez support@academiahelm.com' : undefined}
          >
            <Plus className="w-4 h-4 mr-1" />
            Ajouter une école annexe
          </Button>
          {!eligibility?.eligible && !loading && (
            <p className="text-xs text-slate-500">
              Aucune école active n&apos;est rattachée à votre compte.
            </p>
          )}
          {annexNegotiated && !loading && (
            <p className="text-xs text-blue-700">
              À partir de la 5<sup>e</sup> école, la tarification est négociée — contactez{' '}
              <strong>support@academiahelm.com</strong>.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-700" />
              Nouvelle école annexe
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
              className="text-slate-500"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Annuler
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom de l&apos;établissement <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={form.annexName}
                onChange={(e) => setForm({ ...form, annexName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-700 focus:border-slate-700"
                placeholder="Ex : École Les Étoiles — Annexe N'Dali"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ville / quartier <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={form.annexCity}
                onChange={(e) => setForm({ ...form, annexCity: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-700 focus:border-slate-700"
                placeholder="Peut différer de l'école principale"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Type d&apos;établissement <span className="text-red-600">*</span>
              </label>
              <select
                value={form.schoolType}
                onChange={(e) => setForm({ ...form, schoolType: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-700"
              >
                {SCHOOL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Téléphone de contact <span className="text-red-600">*</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-700 focus:border-slate-700"
                placeholder="+229 90 00 00 00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Adresse e-mail de contact <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-700 focus:border-slate-700"
                placeholder="contact@annexe.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Effectif estimé (élèves)
              </label>
              <input
                type="number"
                min={0}
                value={form.estimatedStudentCount}
                onChange={(e) => setForm({ ...form, estimatedStudentCount: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-700 focus:border-slate-700"
              />
            </div>
          </div>

          {/* Choix du plan (les 4 plans du contrat) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Plan de l&apos;annexe</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {pricing.plans.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => setForm({ ...form, planCode: p.code })}
                  className={`text-left p-3 rounded-lg border-2 transition-all ${
                    form.planCode === p.code
                      ? 'border-slate-900 bg-slate-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-400'
                  }`}
                >
                  <p className="text-sm font-bold text-slate-800">{p.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {p.studentMax ? `${p.studentMin} à ${p.studentMax} élèves` : `${p.studentMin} élèves et +`}
                  </p>
                  <p className="text-xs font-semibold text-slate-700 mt-1.5">
                    {formatCurrency(p.annualFee)}/an
                  </p>
                  <p className="text-[10px] text-slate-400">
                    + activation {formatCurrency(p.activationFee)}
                    {!annexNegotiated && pricing.annexTier.discountPercent > 0
                      ? ` (−${pricing.annexTier.discountPercent} % — ${pricing.annexTier.rank}e école)`
                      : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Option bilingue */}
          <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
            <div>
              <p className="text-sm font-medium text-slate-800">Option bilingue FR/EN</p>
              <p className="text-xs text-slate-500">
                Parcours académiques en français et en anglais — +{formatCurrency(pricing.bilingualFee || BILINGUAL_ADDON.annual || 100000)}/an
              </p>
            </div>
            <input
              type="checkbox"
              checked={form.bilingual}
              onChange={(e) => setForm({ ...form, bilingual: e.target.checked })}
              className="accent-slate-800 w-4 h-4"
            />
          </label>

          {/* ⭐ Modalités de paiement (contrat Article 4) — intégral ou
              échéancier de tranches, notables depuis les paramètres.
              Miroir de l'étape 4 du wizard d'inscription : mêmes données,
              reprises dans le contrat (sections 4.2/4.3/4.4). */}
          {(() => {
            const cashTotal =
              (pricing.plan?.activationFee ?? HELM_ACTIVATION_FEE) +
              (pricing.plan?.annualFee ?? 0) +
              (form.bilingual ? pricing.bilingualFee : 0);
            const allocated = paymentMarked.installments.reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const remaining = cashTotal - allocated;
            const inputCls =
              'w-full px-2 py-1.5 text-sm border border-amber-200 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white';

            const setTrancheCount = (n: number) => {
              setPaymentMarked((prev) => {
                const list = [...prev.installments];
                while (list.length < n && list.length < MAX_INSTALLMENTS) {
                  list.push({ label: `Tranche ${list.length + 1}`, amount: '', dueDate: '' });
                }
                while (list.length > n) list.pop();
                return { ...prev, installments: list };
              });
            };

            const splitEvenly = () => {
              const n = paymentMarked.installments.length;
              if (n === 0 || cashTotal <= 0) return;
              const base = Math.floor(cashTotal / n);
              const rest = cashTotal - base * n;
              setPaymentMarked((prev) => ({
                ...prev,
                installments: prev.installments.map((t, i) => ({
                  ...t,
                  amount: base + (i < rest ? 1 : 0),
                })),
              }));
            };

            const updateInstallment = (index: number, patch: Partial<PaymentMarkedState['installments'][number]>) => {
              setPaymentMarked((prev) => ({
                ...prev,
                installments: prev.installments.map((t, i) => (i === index ? { ...t, ...patch } : t)),
              }));
            };

            return (
              <div className="rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500 rounded-lg">
                    <DollarSign className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Modalités de paiement (espèces)</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Intégral ou par tranches — noté ici, repris dans le contrat (Article 4)
                    </p>
                  </div>
                </div>

                {/* Choix de la modalité : intégral vs tranches */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 bg-amber-100/70 rounded-lg border border-amber-200">
                  <button
                    type="button"
                    onClick={() => setPaymentMarked((prev) => ({ ...prev, paymentPlan: 'full' }))}
                    className={`px-3 py-2 rounded-md text-sm font-semibold transition-all ${
                      paymentMarked.paymentPlan === 'full'
                        ? 'bg-amber-500 text-white shadow'
                        : 'text-slate-700 hover:bg-amber-100'
                    }`}
                  >
                    Paiement intégral
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMarked((prev) => ({ ...prev, paymentPlan: 'installments' }))}
                    className={`px-3 py-2 rounded-md text-sm font-semibold transition-all ${
                      paymentMarked.paymentPlan === 'installments'
                        ? 'bg-amber-500 text-white shadow'
                        : 'text-slate-700 hover:bg-amber-100'
                    }`}
                  >
                    Paiement par tranches
                  </button>
                </div>

                {paymentMarked.paymentPlan === 'full' ? (
                  <div className="space-y-2.5">
                    {/* Case 1 : souscription payée (espèces) */}
                    <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-amber-200 cursor-pointer hover:border-amber-400 transition-colors">
                      <input
                        type="checkbox"
                        checked={paymentMarked.subscriptionPaid}
                        onChange={(e) => setPaymentMarked((prev) => ({ ...prev, subscriptionPaid: e.target.checked }))}
                        className="mt-1 w-4 h-4 accent-amber-600"
                      />
                      <span className="text-sm text-slate-800">
                        <strong>La souscription a été payée</strong> — frais d&apos;activation{' '}
                        {formatCurrency(pricing.plan?.activationFee ?? HELM_ACTIVATION_FEE)}
                        {!annexNegotiated && pricing.annexTier.discountPercent > 0
                          ? ` (−${pricing.annexTier.discountPercent} % — barème annexe)`
                          : ''}{' '}
                        + frais annuels du plan{' '}
                        {pricing.plan?.name || ''} ({formatCurrency(pricing.plan?.annualFee ?? 0)}), en espèces
                      </span>
                    </label>

                    {/* Case 2 : frais bilingue payés (annuels) */}
                    {form.bilingual && (
                      <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-amber-200 cursor-pointer hover:border-amber-400 transition-colors">
                        <input
                          type="checkbox"
                          checked={paymentMarked.bilingualPaid}
                          onChange={(e) => setPaymentMarked((prev) => ({ ...prev, bilingualPaid: e.target.checked }))}
                          className="mt-1 w-4 h-4 accent-amber-600"
                        />
                        <span className="text-sm text-slate-800">
                          <strong>Les frais de l&apos;option bilingue ont été payés</strong> — facturation annuelle (
                          {formatCurrency(pricing.bilingualFee || BILINGUAL_ADDON.annual || 0)} / an), en espèces
                        </span>
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* Nombre de tranches + répartition automatique */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-slate-700">Nombre de tranches :</span>
                        {[2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setTrancheCount(n)}
                            className={`w-7 h-7 rounded-md text-xs font-bold transition-all ${
                              paymentMarked.installments.length === n
                                ? 'bg-amber-500 text-white'
                                : 'bg-white border border-amber-200 text-slate-700 hover:border-amber-400'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={splitEvenly}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-900 bg-white border border-amber-300 rounded-md hover:bg-amber-50 transition-colors"
                        title="Répartir le total équitablement entre les tranches"
                      >
                        Répartir équitablement ({formatCurrency(cashTotal)})
                      </button>
                    </div>

                    {/* Lignes de l'échéancier */}
                    {paymentMarked.installments.map((t, i) => (
                      <div key={i} className="p-3 bg-white rounded-lg border border-amber-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-blue-900">
                            Tranche {i + 1}{i === 0 ? ' — acompte' : ''}
                          </span>
                          {i === 0 && (
                            <label className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={paymentMarked.downPaymentReceived}
                                onChange={(e) =>
                                  setPaymentMarked((prev) => ({ ...prev, downPaymentReceived: e.target.checked }))
                                }
                                className="w-3.5 h-3.5 accent-amber-600"
                              />
                              Encaissé à la signature
                            </label>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={t.label}
                            onChange={(e) => updateInstallment(i, { label: e.target.value })}
                            placeholder={i === 0 ? 'Acompte à la signature' : `Tranche ${i + 1}`}
                            className={inputCls}
                          />
                          <input
                            type="number"
                            value={t.amount}
                            onChange={(e) =>
                              updateInstallment(i, { amount: e.target.value === '' ? '' : Number(e.target.value) })
                            }
                            placeholder="Montant (FCFA)"
                            min={0}
                            className={inputCls}
                          />
                        </div>
                        {i === 0 ? (
                          <p className="mt-1.5 text-[10px] text-slate-500">
                            Échéance : à la signature du contrat (date du jour)
                          </p>
                        ) : (
                          <div className="mt-2 flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                            <input
                              type="date"
                              value={t.dueDate}
                              onChange={(e) => updateInstallment(i, { dueDate: e.target.value })}
                              className={inputCls}
                            />
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Totaux de contrôle */}
                    <div className="flex items-center justify-between gap-2 p-3 bg-white rounded-lg border border-amber-200 text-sm">
                      <span className="text-slate-700">
                        Réparti : <strong>{formatCurrency(allocated)}</strong>
                        {form.bilingual && (
                          <span className="text-[10px] text-slate-500 block">
                            (option bilingue {formatCurrency(pricing.bilingualFee || BILINGUAL_ADDON.annual || 0)} incluse)
                          </span>
                        )}
                      </span>
                      <span className={`font-semibold ${remaining === 0 ? 'text-green-700' : 'text-amber-700'}`}>
                        {remaining === 0
                          ? '✓ Total couvert'
                          : remaining > 0
                            ? `Reste à répartir : ${formatCurrency(remaining)}`
                            : `Excédent : ${formatCurrency(-remaining)}`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Encaissé par (certification d'encaissement — Article 4.3) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Encaissé par (nom et prénom de l'agent YEHI OR Tech)
                  </label>
                  <input
                    type="text"
                    value={paymentMarked.receivedBy}
                    onChange={(e) => setPaymentMarked((prev) => ({ ...prev, receivedBy: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-amber-200 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                    placeholder="Agent ayant encaissé le règlement (si déjà payé)"
                  />
                </div>

                <p className="text-[11px] text-slate-500">
                  {paymentMarked.paymentPlan === 'installments'
                    ? "Aucun paiement en ligne : l'échéancier est repris dans le contrat (Article 4) — chaque encaissement donne lieu à un reçu manuscrit."
                    : "Aucun paiement en ligne : le contrat signé tient lieu de reçu (souscription + option bilingue le cas échéant)."}
                </p>
              </div>
            );
          })()}

          {/* Récapitulatif prix de l'annexe (PAR ÉCOLE) */}
          <div className="rounded-lg bg-slate-900 text-white p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-300 uppercase tracking-wide font-semibold">
                Souscription Année 1 — {pricing.plan?.name}
                {form.bilingual ? ' + bilingue' : ''}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Activation {formatCurrency(pricing.plan?.activationFee ?? HELM_ACTIVATION_FEE)}
                {!annexNegotiated && pricing.annexTier.discountPercent > 0
                  ? ` (−${pricing.annexTier.discountPercent} % — ${pricing.annexTier.rank}e école du groupe, barème progressif)`
                  : ''} +
                frais annuels {formatCurrency(pricing.plan?.annualFee ?? 0)}
                {form.bilingual ? ` + bilingue ${formatCurrency(pricing.bilingualFee)}` : ''} — à régler
                en espèces selon les modalités choisies ci-dessus, reprises dans le contrat (Article 4).
              </p>
            </div>
            <p className="text-2xl font-bold text-amber-400 whitespace-nowrap">
              {formatCurrency(pricing.totalYearOne)}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setError(null);
                setPaymentMarked(defaultPaymentMarked());
              }}
              className="border-slate-300 text-slate-600"
            >
              Annuler
            </Button>
            <Button onClick={handleCreateAnnexDraft} disabled={creating} className="bg-slate-900 hover:bg-slate-800 text-white">
              {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Générer le contrat d&apos;abonnement
            </Button>
          </div>
        </div>
      )}

      {/* ⭐ Modal « onboarding déjà en cours pour cet email » — continuer avec
          le brouillon existant (retour sans achever la création de l'annexe)
          ou l'annuler pour recommencer, comme à l'inscription (sign-up). */}
      {existingDraftChoice && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-500 mr-3" />
              <h3 className="text-lg font-bold text-slate-900">Onboarding déjà en cours</h3>
            </div>

            <p className="text-sm text-slate-700 mb-4">
              Un onboarding est déjà en cours pour l&apos;adresse e-mail{' '}
              <strong>{existingDraftChoice.data?.email || form.email}</strong> — il a été enregistré en brouillon.
              Vous pouvez le poursuivre (contrat + création de l&apos;école annexe) ou l&apos;annuler pour recommencer.
            </p>

            {/* Résumé du brouillon */}
            {existingDraftChoice.data && (
              <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600"><strong>Établissement :</strong></span>
                  <span className="text-slate-900 text-right">{existingDraftChoice.data.schoolName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600"><strong>Ville :</strong></span>
                  <span className="text-slate-900 text-right">{existingDraftChoice.data.city}</span>
                </div>
                {existingDraftChoice.data.promoterFirstName && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-600"><strong>Promoteur :</strong></span>
                    <span className="text-slate-900 text-right">
                      {existingDraftChoice.data.promoterFirstName} {existingDraftChoice.data.promoterLastName || ''}
                    </span>
                  </div>
                )}
                {(() => {
                  const snap = (existingDraftChoice.data?.priceSnapshot as any) || {};
                  return snap.planName ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-600"><strong>Plan :</strong></span>
                      <span className="text-slate-900 text-right">{snap.planName}</span>
                    </div>
                  ) : null;
                })()}
                {existingDraftChoice.data.createdAt && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-600"><strong>Créé le :</strong></span>
                    <span className="text-slate-900 text-right">
                      {new Date(existingDraftChoice.data.createdAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleContinueExistingDraft}
                className="w-full px-4 py-3 bg-slate-900 text-white rounded-md font-semibold hover:bg-slate-800 transition-all flex items-center justify-center"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Continuer avec ce brouillon
              </button>
              <button
                type="button"
                onClick={handleDiscardExistingDraft}
                disabled={discardingDraft}
                className="w-full px-4 py-3 bg-slate-200 text-slate-900 rounded-md font-semibold hover:bg-slate-300 transition-all flex items-center justify-center disabled:opacity-60"
              >
                {discardingDraft ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Annuler le brouillon et recommencer
              </button>
              <button
                type="button"
                onClick={() => setExistingDraftChoice(null)}
                className="w-full px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
