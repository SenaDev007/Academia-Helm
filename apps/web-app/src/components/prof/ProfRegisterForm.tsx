'use client';

/**
 * ============================================================================
 * HELM ENSEIGNANT — WIZARD D'INSCRIPTION « PAIEMENT D'ABORD » (3 étapes)
 * ============================================================================
 *
 * ⭐ 2026-10-16 — Le compte n'est créé qu'APRÈS le paiement (même règle que
 *    l'onboarding du sign up Academia Helm / Academia Federis patronat) :
 *
 * Étape 1 — Identité : prénom, nom, email, téléphone, mot de passe
 * Étape 2 — Niveaux : Maternelle / Primaire (SECONDAIRE masqué)
 * Étape 3 — PAIEMENT : 2 000 FCFA (widget FedaPay du patronat)
 *           → POST BFF /api/teacher-portal/signup/initiate
 *             (crée un DRAFT côté serveur : identité + hash + niveaux)
 *           → redirection vers la page de paiement FedaPay
 *           → retour sur /prof/register/success : vérification serveur,
 *             création du compte + email d'identifiants
 *
 * Retour d'annulation FedaPay : /prof/register?canceled=1&email=…
 * → bannière + email pré-rempli, l'enseignant reprend depuis l'étape 1.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  GraduationCap,
  Loader2,
  Mail,
  Lock,
  User as UserIcon,
  Phone,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Baby,
  BookOpen,
  Sparkles,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';

type LevelCode = 'MATERNELLE' | 'PRIMAIRE';

// ⭐ SECONDAIRE masqué (2026-10-16) : seuls Maternelle et Primaire sont
//    proposés aux nouvelles inscriptions Helm Enseignant.
const LEVEL_CARDS: Array<{
  code: LevelCode;
  label: string;
  icon: typeof Baby;
  classes: string;
  subjects: string;
}> = [
  {
    code: 'MATERNELLE',
    label: 'Maternelle',
    icon: Baby,
    classes: 'Maternelle 1, Maternelle 2',
    subjects: '17 matières : langage, pré-lecture, pré-écriture, pré-mathématique, rythmique…',
  },
  {
    code: 'PRIMAIRE',
    label: 'Primaire',
    icon: BookOpen,
    classes: 'CI, CP, CE1, CE2, CM1, CM2',
    subjects: '9 matières : lecture, expression écrite, dictée, mathématiques, EST…',
  },
];

interface RegisterErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  levels?: string;
  submit?: string;
}

const TOTAL_STEPS = 3;

export function ProfRegisterForm() {
  const searchParams = useSearchParams();
  const canceled = searchParams.get('canceled') === '1';
  const canceledEmail = searchParams.get('email') || '';

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: canceledEmail,
    phone: '',
    password: '',
  });
  const [levels, setLevels] = useState<LevelCode[]>([]);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Email pré-rempli au retour d'annulation → nettoyer l'URL une fois lu.
  useEffect(() => {
    if (canceled && canceledEmail) {
      window.history.replaceState({}, '', '/prof/register');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const toggleLevel = (code: LevelCode) => {
    setLevels((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code],
    );
    setErrors((prev) => ({ ...prev, levels: undefined }));
  };

  const validateStep1 = (): boolean => {
    const next: RegisterErrors = {};
    if (!formData.firstName.trim() || formData.firstName.trim().length < 2)
      next.firstName = 'Prénom requis (2 caractères minimum)';
    if (!formData.lastName.trim() || formData.lastName.trim().length < 2)
      next.lastName = 'Nom requis (2 caractères minimum)';
    if (!formData.email.trim()) next.email = 'Email requis';
    else if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) next.email = 'Adresse email invalide';
    if (!formData.password || formData.password.length < 8)
      next.password = 'Mot de passe de 8 caractères minimum';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep2 = (): boolean => {
    if (levels.length === 0) {
      setErrors({ levels: 'Activez au moins un niveau — vous pourrez le modifier plus tard.' });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  /**
   * ⭐ Étape 3 = PAIEMENT AVANT CRÉATION DU COMPTE.
   * Le BFF crée le draft (identité + hash du mot de passe + niveaux) et
   * initialise la transaction FedaPay — puis on redirige vers la page de
   * paiement. Le compte sera créé au retour (/prof/register/success) après
   * vérification serveur du paiement.
   */
  const handlePayAndRegister = async () => {
    if (isSubmitting) return;
    if (!validateStep1() || !validateStep2()) {
      setStep(1);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await fetch('/api/teacher-portal/signup/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || undefined,
          password: formData.password,
          levels,
          returnBaseUrl: window.location.origin,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success || !data?.paymentUrl) {
        throw new Error(
          data?.message ||
            'L’initialisation du paiement a échoué. Votre inscription est enregistrée — réessayez.',
        );
      }

      // Redirection vers la page de paiement FedaPay (widget du patronat).
      // Au retour : /prof/register/success?id={txId}&status=approved
      window.location.href = data.paymentUrl;
    } catch (error: any) {
      setErrors({
        submit: error?.message || 'Paiement impossible. Vérifiez votre connexion et réessayez.',
      });
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500';

  return (
    <div className="w-full max-w-xl">
      {/* En-tête + progression */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-white">
          <GraduationCap className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Créer votre espace enseignant</h1>
        <p className="mt-2 text-sm text-slate-500">
          Trois minutes suffisent — aucune école nécessaire.
        </p>
        <div className="mx-auto mt-6 flex max-w-xs items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-teal-600' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs font-medium text-slate-400">
          Étape {step} sur {TOTAL_STEPS} —{' '}
          {step === 1
            ? 'Votre identité'
            : step === 2
              ? 'Vos niveaux'
              : 'Paiement (2 000 FCFA)'}
        </p>
      </div>

      {/* Retour d'annulation FedaPay */}
      {canceled && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Paiement annulé — votre inscription est enregistrée, vous pouvez la reprendre
          ci-dessous et relancer le paiement quand vous voulez.
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* ── Étape 1 : Identité ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Prénom</label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className={inputClass}
                    placeholder="Jean"
                    value={formData.firstName}
                    onChange={(e) => setField('firstName', e.target.value)}
                    autoComplete="given-name"
                  />
                </div>
                {errors.firstName && <p className="mt-1.5 text-xs text-red-600">{errors.firstName}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Nom</label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className={inputClass}
                    placeholder="KOUASSI"
                    value={formData.lastName}
                    onChange={(e) => setField('lastName', e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
                {errors.lastName && <p className="mt-1.5 text-xs text-red-600">{errors.lastName}</p>}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Adresse email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  className={inputClass}
                  placeholder="vous@example.com"
                  value={formData.email}
                  onChange={(e) => setField('email', e.target.value)}
                  autoComplete="email"
                />
              </div>
              {errors.email && <p className="mt-1.5 text-xs text-red-600">{errors.email}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Téléphone <span className="font-normal text-slate-400">(optionnel)</span>
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className={inputClass}
                  placeholder="+229 97 00 00 00"
                  value={formData.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  autoComplete="tel"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Mot de passe</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  className={inputClass}
                  placeholder="8 caractères minimum"
                  value={formData.password}
                  onChange={(e) => setField('password', e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-red-600">{errors.password}</p>}
            </div>
          </div>
        )}

        {/* ── Étape 2 : Niveaux (Maternelle / Primaire — SECONDAIRE masqué) ── */}
        {step === 2 && (
          <div>
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              Activez le(s) niveau(x) que vous enseignez : le système installe automatiquement
              toutes les classes et toutes les matières du niveau. Vous pourrez activer ou
              désactiver des niveaux à tout moment dans vos paramètres.
            </div>
            <div className="space-y-3">
              {LEVEL_CARDS.map((card) => {
                const selected = levels.includes(card.code);
                return (
                  <button
                    key={card.code}
                    type="button"
                    onClick={() => toggleLevel(card.code)}
                    className={`w-full rounded-xl border-2 p-5 text-left transition-all ${
                      selected
                        ? 'border-teal-500 bg-teal-50/60 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                            selected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <card.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-base font-semibold text-slate-900">
                            Niveau {card.label}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Classes : <span className="font-medium">{card.classes}</span>
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">
                            {card.subjects}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                          selected
                            ? 'border-teal-600 bg-teal-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {selected && <CheckCircle2 className="h-4 w-4" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.levels && (
              <p className="mt-3 flex items-center gap-2 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5" />
                {errors.levels}
              </p>
            )}
          </div>
        )}

        {/* ── Étape 3 : PAIEMENT AVANT CRÉATION DU COMPTE ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Votre identité
              </p>
              <p className="mt-2 text-base font-semibold text-slate-900">
                {formData.firstName} {formData.lastName}
              </p>
              <p className="text-sm text-slate-600">{formData.email}</p>
              {formData.phone && <p className="text-sm text-slate-600">{formData.phone}</p>}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Niveaux activés
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {levels.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-800"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {LEVEL_CARDS.find((c) => c.code === code)?.label}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Dès la confirmation de votre paiement, votre espace est créé et tout est prêt :
                cahier journal, fiches pédagogiques, cahier de textes, évaluations, notes et
                bulletins.
              </p>
            </div>

            {/* ⭐ Récapitulatif tarifaire — LE PAIEMENT PRÉCÈDE LA CRÉATION */}
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Paiement initial — inscription + 1er mois
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
                <span className="text-3xl font-extrabold text-slate-900">2 000</span>
                <span className="text-sm font-medium text-slate-600">FCFA</span>
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-teal-900">
                <li className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong>Votre compte est créé dès la confirmation du paiement</strong> —
                    les identifiants de connexion vous sont envoyés par email.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong>30 jours d’accès complet</strong> — le décompte démarre à la
                    création de votre espace.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  Rappels automatiques par email 7 jours puis 24 heures avant l’expiration,
                    période de grâce de 7 jours.
                </li>
              </ul>
            </div>

            {errors.submit && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {errors.submit}
              </div>
            )}
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </button>
          ) : (
            <Link
              href="/prof/login"
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              J’ai déjà un compte
            </Link>
          )}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
            >
              Continuer
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePayAndRegister}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {isSubmitting ? 'Initialisation du paiement…' : 'Payer 2 000 FCFA et créer mon espace'}
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Paiement sécurisé FedaPay — votre compte enseignant est créé dès la confirmation, avec
        vos identifiants envoyés par email.
      </p>
    </div>
  );
}
