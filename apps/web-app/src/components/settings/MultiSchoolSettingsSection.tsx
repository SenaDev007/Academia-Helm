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
import { Building2, Plus, RefreshCw, Loader2, CheckCircle2, MapPin, Globe, ArrowLeft, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { HELM_PLANS, HELM_ACTIVATION_FEE, BILINGUAL_ADDON } from '@/lib/services/HelmPricingService';
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
  const [annexDraft, setAnnexDraft] = useState<{
    draftId: string;
    form: AnnexFormState;
    promoterName: string;
  } | null>(null);

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
  const pricing = useMemo(() => {
    const bilingualYearly = eligibility?.pricing?.bilingualYearly ?? BILINGUAL_ADDON.annual ?? 50000;
    const plans = (eligibility?.pricing?.plans?.length
      ? eligibility.pricing.plans
      : (['SEED', 'GROW', 'LEAD', 'NETWORK'] as const).map((code) => ({
          code,
          name: HELM_PLANS[code].name,
          activationFee: HELM_PLANS[code].setupFee ?? HELM_ACTIVATION_FEE,
          annualFee: HELM_PLANS[code].annualPrice,
          yearOnePerSchool: (HELM_PLANS[code].setupFee ?? HELM_ACTIVATION_FEE) + HELM_PLANS[code].annualPrice,
          studentMin: code === 'SEED' ? 1 : code === 'GROW' ? 51 : code === 'LEAD' ? 151 : 401,
          studentMax: code === 'SEED' ? 50 : code === 'GROW' ? 150 : code === 'LEAD' ? 400 : null,
        }))) as EligibilityPlan[];
    const plan = plans.find((p) => p.code === form.planCode) || plans[0];
    const bilingualFee = form.bilingual ? bilingualYearly : 0;
    return {
      plans,
      plan,
      bilingualFee,
      totalYearOne: (plan.activationFee + plan.annualFee + bilingualFee),
    };
  }, [eligibility, form.planCode, form.bilingual]);

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
        throw new Error(data?.message || data?.error || "Impossible de créer le draft de l'école annexe");
      }
      // Draft créé (mono-école — l'annexe) + plan sélectionné → CONTRAT
      // conforme au Word (même composant que l'onboarding) puis activation.
      setAnnexDraft({
        draftId: data.draftId,
        form: { ...form },
        promoterName:
          data.promoter?.firstName || data.promoter?.lastName
            ? `${data.promoter?.firstName || ''} ${data.promoter?.lastName || ''}`.trim()
            : `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
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

  const handleAnnexContractDone = (result: { signed: boolean; subdomain?: string }) => {
    setAnnexDraft(null);
    if (result.signed) {
      toast({
        title: 'École annexe créée 🎉',
        description:
          "L'établissement a rejoint votre groupe. Retrouvez-le dans « Vue Groupe » et dans le sélecteur d'écoles au prochain rechargement.",
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

  // ⭐ Contrat d'annexe affiché EN PLEIN ÉCRAN (même expérience que l'onboarding)
  if (annexDraft) {
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
        planName={pricing.plan?.name || HELM_PLANS[annexDraft.form.planCode as keyof typeof HELM_PLANS]?.name || annexDraft.form.planCode}
        bilingual={annexDraft.form.bilingual}
        subdomain={
          annexDraft.form.annexName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 20) || 'annexe'
        }
        activationFee={pricing.plan?.activationFee ?? HELM_ACTIVATION_FEE}
        annualFee={pricing.plan?.annualFee ?? 50000}
        schoolsCount={1}
        paymentPlan="full"
        subscriptionPaid={false}
        bilingualPaid={false}
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

      {/* ── Tarif multi-écoles (rappel clair : payant par école) ── */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
        <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
          <Info className="w-4 h-4" /> Le multi-écoles est payant, en fonction du nombre d&apos;écoles
        </p>
        <p className="text-xs text-amber-800 mt-1.5 leading-relaxed">
          Chaque école annexe souscrit sa propre offre : frais d&apos;activation uniques de{' '}
          <strong>{formatCurrency(HELM_ACTIVATION_FEE)} FCFA</strong> + frais annuels du plan choisi
          (50 000 à 150 000 FCFA selon l&apos;effectif), le cas échéant l&apos;option bilingue FR/EN
          (<strong>{formatCurrency(pricing.bilingualFee || BILINGUAL_ADDON.annual || 50000)} FCFA/an</strong>).
          Le contrat d&apos;abonnement — conforme au contrat type — détaillera la souscription de l&apos;annexe.
        </p>
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
            disabled={!eligibility?.eligible}
            className="bg-slate-900 hover:bg-slate-800 text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Ajouter une école annexe
          </Button>
          {!eligibility?.eligible && !loading && (
            <p className="text-xs text-slate-500">
              Aucune école active n&apos;est rattachée à votre compte.
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
                    {formatCurrency(p.annualFee)} FCFA/an
                  </p>
                  <p className="text-[10px] text-slate-400">
                    + activation {formatCurrency(p.activationFee)} FCFA
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
                Parcours académiques en français et en anglais — +{formatCurrency(pricing.bilingualFee || BILINGUAL_ADDON.annual || 50000)} FCFA/an
              </p>
            </div>
            <input
              type="checkbox"
              checked={form.bilingual}
              onChange={(e) => setForm({ ...form, bilingual: e.target.checked })}
              className="accent-slate-800 w-4 h-4"
            />
          </label>

          {/* Récapitulatif prix de l'annexe (PAR ÉCOLE) */}
          <div className="rounded-lg bg-slate-900 text-white p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-300 uppercase tracking-wide font-semibold">
                Souscription Année 1 — {pricing.plan?.name}
                {form.bilingual ? ' + bilingue' : ''}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Activation {formatCurrency(pricing.plan?.activationFee ?? HELM_ACTIVATION_FEE)} +
                frais annuels {formatCurrency(pricing.plan?.annualFee ?? 0)}
                {form.bilingual ? ` + bilingue ${formatCurrency(pricing.bilingualFee)}` : ''} — à régler
                en espèces selon les modalités du contrat (Article 4).
              </p>
            </div>
            <p className="text-2xl font-bold text-amber-400 whitespace-nowrap">
              {formatCurrency(pricing.totalYearOne)} <span className="text-xs text-slate-400 font-normal">FCFA</span>
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setError(null);
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
    </div>
  );
}
