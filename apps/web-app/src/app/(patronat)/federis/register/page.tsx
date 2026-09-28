/**
 * Page d'inscription Academia Federis
 *
 * Création de compte Patronat en 3 étapes (cahier des charges §6.3 + wireframe §10.1) :
 *   1. Informations institutionnelles (pays, niveau territorial configurable,
 *      nom, département — sélectionné dans la liste du pays — patronat national
 *      de rattachement)
 *   2. Responsable et accès (nom, email institutionnel, téléphone)
 *   3. Mot de passe et confirmation → POST /federis/public/register → /checkout
 *
 * Le patronat existe avant les écoles : aucune école n'est demandée ici.
 *
 * Département : dès qu'un pays est sélectionné, le sélecteur liste ses unités
 * territoriales de référence (CountryTerritory — ex: les 12 départements du
 * Bénin). Un pays sans liste configurée conserve un champ texte libre.
 *
 * ⭐ Patronat national de rattachement (règle 2026-09-28) : un pays = UN SEUL
 * patronat national (index unique en base). Il est RÉCUPÉRÉ AUTOMATIQUEMENT
 * depuis la base et pré-rempli — plus de liste de choix, plus de patronats
 * fictifs : tous les patronats départementaux se rattachent au patronat
 * national unique de leur pays.
 *
 * Type d'organisation : Federis est dédié aux patronats — le champ n'est plus
 * affiché ; PATRONAT est transmis par défaut à l'API.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import FederisHeader from '@/components/federis/FederisHeader';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import {
  persistClientSession,
  markFreshLogin,
} from '@/lib/auth/client-access-token';
import { saveEmailForTenant } from '@/lib/auth/saved-email';

interface TerritorialLevel {
  id: string;
  code: string;
  label: string;
  order: number;
}

interface CountryOption {
  id: string;
  code: string;
  name: string;
  phonePrefix?: string;
  territorialLevels: TerritorialLevel[];
  /** Unités territoriales de référence (départements…) — sélecteur */
  territories?: TerritoryOption[];
}

interface TerritoryOption {
  id: string;
  name: string;
  code?: string;
  order: number;
}

interface NationalPatronat {
  id: string;
  name: string;
  abbreviation?: string;
  subscriptionStatus?: string;
}

export default function FederisRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [nationalPatronats, setNationalPatronats] = useState<NationalPatronat[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingNationals, setLoadingNationals] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    // Étape 1 — Informations institutionnelles
    countryId: '',
    territorialLevelCode: '',
    name: '',
    territoryName: '',
    parentPatronatId: '',
    // Étape 2 — Responsable et accès
    responsibleName: '',
    email: '',
    phone: '',
    // Étape 3 — Sécurité
    password: '',
    confirmPassword: '',
  });

  // Chargement des pays + niveaux territoriaux configurés
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get('/federis/public/countries', { timeout: 15000 });
        if (!cancelled) setCountries(res.data ?? []);
      } catch (err) {
        console.error('[FederisRegister] Erreur chargement pays :', err);
        if (!cancelled) {
          setErrors((e) => ({
            ...e,
            form: 'Impossible de charger la configuration des pays. Vérifiez votre connexion puis rechargez la page.',
          }));
        }
      } finally {
        if (!cancelled) setLoadingCountries(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCountry = countries.find((c) => c.id === formData.countryId);
  const selectedLevel = selectedCountry?.territorialLevels.find(
    (l) => l.code === formData.territorialLevelCode,
  );
  const isNational = !!selectedLevel && (selectedLevel.code === 'NATIONAL' || selectedLevel.order === 1);
  const territoryLabel = isNational
    ? 'Périmètre national'
    : selectedLevel
      ? selectedLevel.label
      : 'Unité territoriale';
  // Départements du pays sélectionné — le sélecteur remplace la saisie libre
  // dès qu'une liste de référence existe (ex: 12 départements du Bénin).
  const countryTerritories = selectedCountry?.territories ?? [];

  // ⭐ Patronat national de rattachement — RÉCUPÉRATION AUTOMATIQUE.
  // Règle (2026-09-28) : un pays = UN SEUL patronat national (index unique
  // partiel en base). Le formulaire ne propose donc PLUS une liste de
  // choix : il récupère le patronat national du pays depuis la base et
  // pré-remplit le rattachement automatiquement. Tous les patronats
  // départementaux s'y rattachent.
  // Le fetch démarre dès la sélection du PAYS (avant même le choix du
  // niveau) : l'option « National » peut ainsi être désactivée si le
  // patronat national du pays existe déjà.
  const loadNationalPatronat = useCallback(async (countryId: string) => {
    setLoadingNationals(true);
    try {
      const res = await apiClient.get('/federis/public/national-patronats', {
        params: { countryId },
        timeout: 15000,
      });
      setNationalPatronats(res.data ?? []);
    } catch (err) {
      console.error('[FederisRegister] Erreur patronat national :', err);
      setNationalPatronats([]);
    } finally {
      setLoadingNationals(false);
    }
  }, []);

  useEffect(() => {
    if (formData.countryId) {
      void loadNationalPatronat(formData.countryId);
    } else {
      setNationalPatronats([]);
    }
  }, [formData.countryId]);

  // Pré-remplissage automatique : dès que le patronat national UNIQUE du
  // pays est connu et que le niveau choisi est territorial, le
  // rattachement est rempli automatiquement — aucune sélection manuelle.
  useEffect(() => {
    if (!isNational && nationalPatronats.length === 1) {
      setFormData((prev) =>
        prev.parentPatronatId === nationalPatronats[0].id
          ? prev
          : { ...prev, parentPatronatId: nationalPatronats[0].id },
      );
    }
  }, [isNational, nationalPatronats]);

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNumber === 1) {
      if (!formData.countryId) newErrors.countryId = 'Le pays est requis';
      if (!formData.territorialLevelCode)
        newErrors.territorialLevelCode = "Le niveau de l'organisation est requis";
      if (!formData.name.trim()) newErrors.name = 'Le nom du patronat est requis';
      if (!isNational) {
        if (!formData.territoryName.trim())
          newErrors.territoryName = `Le ${territoryLabel.toLowerCase()} est requis`;
        if (loadingNationals) {
          newErrors.parentPatronatId =
            'Récupération du patronat national en cours — patientez un instant…';
        } else {
          if (!formData.parentPatronatId)
            newErrors.parentPatronatId =
              'Le patronat national de rattachement est requis pour un patronat territorial';
          if (
            nationalPatronats.length > 0 &&
            !nationalPatronats.some((p) => p.id === formData.parentPatronatId)
          ) {
            newErrors.parentPatronatId = 'Patronat national invalide pour ce pays';
          }
        }
        if (
          countryTerritories.length > 0 &&
          !countryTerritories.some(
            (t) => t.name.toLowerCase() === formData.territoryName.trim().toLowerCase(),
          )
        ) {
          newErrors.territoryName = `Sélectionnez un ${territoryLabel.toLowerCase()} dans la liste`;
        }
      } else if (
        !loadingNationals &&
        nationalPatronats.length > 0
      ) {
        // ⭐ Règle d'unicité côté formulaire : le pays a déjà son patronat
        // national unique — la création d'un second est impossible.
        newErrors.territorialLevelCode = `Le patronat national de ce pays existe déjà : « ${nationalPatronats[0].name} ». Choisissez le niveau « Département » pour créer un patronat départemental rattaché au national.`;
      }
    } else if (stepNumber === 2) {
      if (!formData.responsibleName.trim())
        newErrors.responsibleName = 'Le nom du responsable est requis';
      if (!formData.email.trim()) newErrors.email = "L'adresse électronique est requise";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()))
        newErrors.email = 'Adresse électronique invalide';
      if (!formData.phone.trim()) newErrors.phone = 'Le téléphone est requis';
    } else if (stepNumber === 3) {
      if (!formData.password) newErrors.password = 'Le mot de passe est requis';
      if (formData.password.length < 8)
        newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères';
      if (formData.password !== formData.confirmPassword)
        newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;

    setSubmitting(true);
    setErrors({});
    try {
      const payload = {
        countryId: formData.countryId,
        territorialLevelCode: formData.territorialLevelCode,
        name: formData.name.trim(),
        territoryName: isNational ? 'National' : formData.territoryName.trim(),
        parentPatronatId: isNational ? undefined : formData.parentPatronatId,
        // Federis est dédié aux patronats : valeur par défaut appliquée côté
        // serveur également (le champ n'est plus affiché dans le formulaire).
        organismType: 'PATRONAT' as const,
        responsibleName: formData.responsibleName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        password: formData.password,
      };

      const res = await apiClient.post('/federis/public/register', payload, { timeout: 30000 });
      const patronatName = res.data?.patronat?.name ?? formData.name.trim();

      // ── Connexion immédiate après inscription (pattern Helm) ──
      // Le parcours d'activation (/checkout → Fedapay) requiert la session JWT
      // du responsable. Même pattern que LoginPage : vérification de la
      // réponse + persistClientSession (localStorage + miroir Cache API) +
      // markFreshLogin, pour que /checkout et le dashboard fonctionnent sans
      // re-saisie des identifiants.
      try {
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email.trim().toLowerCase(),
            password: formData.password,
            portal_type: 'PATRONAT',
          }),
        });

        const loginData = await loginRes.json().catch(() => ({}));

        if (loginRes.ok && loginData.success && loginData.accessToken) {
          persistClientSession({
            accessToken: loginData.accessToken,
            refreshToken: loginData.refreshToken,
            serverSessionId: loginData.serverSessionId,
            user: loginData.user,
            tenant: loginData.tenant,
            portalType: 'PATRONAT',
            expiresAt: loginData.expiresAt,
          });
          saveEmailForTenant(
            formData.email.trim().toLowerCase(),
            loginData.tenant?.id || 'federis',
          );
          markFreshLogin();
        } else {
          // Auto-login échoué (identifiants, réseau…) : le compte EST créé.
          // Le responsable se connectera depuis /federis/login → /checkout.
          console.warn(
            '[FederisRegister] Auto-login non abouti :',
            loginData?.message || loginRes.status,
          );
        }
      } catch (loginErr) {
        console.warn('[FederisRegister] Auto-login différé :', loginErr);
      }

      // Parcours §12 : compte créé → activation via paiement (/checkout)
      router.push(
        `${getFederisBasePath()}/checkout?name=${encodeURIComponent(patronatName)}&status=new`,
      );
    } catch (err: any) {
      console.error('[FederisRegister] Erreur inscription :', err);
      const msg =
        err?.response?.data?.message ??
        'Une erreur est survenue lors de la création du compte. Veuillez réessayer.';
      setErrors({ submit: Array.isArray(msg) ? msg.join(' ') : String(msg) });
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = ['Informations institutionnelles', 'Responsable et accès', 'Sécurité'];

  return (
    <div className="min-h-screen bg-[#071528] relative overflow-hidden">
      {/* Halo lumineux (ADN WinAgro) */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] rounded-full bg-blue-600/10 blur-[130px] pointer-events-none" />
      <FederisHeader />
      <div className="pt-24 pb-12 relative z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Logo & Titre */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <Image
                src="/images/logo-Academia Hub.webp"
                alt="Academia Federis — par Academia Helm"
                width={64}
                height={64}
                className="h-16 w-auto"
                priority
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
              Créer un compte Patronat
            </h1>
            <p className="text-blue-100/60 text-sm">
              Inscrivez votre organisation pour coordonner vos écoles membres et organiser vos
              examens nationaux.
            </p>
          </div>

          {/* Progression */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {[1, 2, 3].map((stepNumber) => (
                <div key={stepNumber} className="flex items-center flex-1">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 border',
                      step >= stepNumber
                        ? 'bg-gradient-to-br from-[#fbbf24] to-[#f59e0b] text-[#0b1d3a] border-amber-300/40 shadow-lg shadow-amber-500/30'
                        : 'bg-white/10 text-blue-100/60 border-white/10',
                    )}
                  >
                    {stepNumber}
                  </div>
                  {stepNumber < 3 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-2',
                        step > stepNumber ? 'bg-[#f59e0b]' : 'bg-white/10',
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              {stepLabels.map((label, i) => (
                <span
                  key={i}
                  className={cn(
                    'text-[10px] sm:text-xs font-medium text-center flex-1',
                    step === i + 1 ? 'text-amber-300 font-semibold' : 'text-blue-100/40',
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Formulaire */}
          <form
            onSubmit={handleSubmit}
            className="fed-glass-dark rounded-3xl shadow-2xl p-6 sm:p-8"
          >
            {/* Étape 1 — Informations institutionnelles */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-black text-amber-400/90 uppercase tracking-wider mb-2">
                    Pays <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.countryId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        countryId: e.target.value,
                        territorialLevelCode: '',
                        territoryName: '',
                        parentPatronatId: '',
                      })
                    }
                    disabled={loadingCountries}
                    className={cn(
                      'fed-input px-4 py-2',
                      errors.countryId ? '!border-red-500/60' : '',
                    )}
                  >
                    <option value="">
                      {loadingCountries ? 'Chargement des pays…' : 'Sélectionner un pays…'}
                    </option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {errors.countryId && (
                    <p className="mt-1 text-sm text-red-400">{errors.countryId}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black text-amber-400/90 uppercase tracking-wider mb-2">
                    Niveau de l&rsquo;organisation <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.territorialLevelCode}
                    onChange={(e) =>
                      setFormData({ ...formData, territorialLevelCode: e.target.value })
                    }
                    disabled={!formData.countryId}
                    className={cn(
                      'fed-input px-4 py-2',
                      errors.territorialLevelCode ? '!border-red-500/60' : '',
                    )}
                  >
                    <option value="">Sélectionner le niveau…</option>
                    {selectedCountry?.territorialLevels.map((l) => {
                      // ⭐ Un pays = un seul patronat national : si le national
                      // du pays existe déjà, l'option National est désactivée.
                      const nationalTaken =
                        (l.code === 'NATIONAL' || l.order === 1) &&
                        !loadingNationals &&
                        nationalPatronats.length > 0;
                      return (
                        <option key={l.id} value={l.code} disabled={nationalTaken}>
                          {l.label}
                          {nationalTaken ? ' — déjà créé' : ''}
                        </option>
                      );
                    })}
                  </select>
                  {errors.territorialLevelCode && (
                    <p className="mt-1 text-sm text-red-400">{errors.territorialLevelCode}</p>
                  )}
                  <p className="mt-1.5 text-xs text-blue-100/50">
                    Les niveaux disponibles sont configurés selon l&rsquo;organisation réelle de
                    chaque pays.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-black text-amber-400/90 uppercase tracking-wider mb-2">
                    Nom du patronat <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={cn(
                      'fed-input px-4 py-2',
                      errors.name ? '!border-red-500/60' : '',
                    )}
                    placeholder="Ex : Patronat des Écoles Privées du Bénin"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name}</p>}
                </div>

                {!isNational && (
                  <>
                    <div>
                      <label className="block text-xs font-black text-amber-400/90 uppercase tracking-wider mb-2">
                        {territoryLabel} <span className="text-red-500">*</span>
                      </label>
                      {countryTerritories.length > 0 ? (
                        /* Liste de référence du pays (ex: 12 départements du Bénin) */
                        <>
                          <select
                            value={formData.territoryName}
                            onChange={(e) =>
                              setFormData({ ...formData, territoryName: e.target.value })
                            }
                            className={cn(
                              'fed-input px-4 py-2',
                              errors.territoryName ? '!border-red-500/60' : '',
                            )}
                          >
                            <option value="">Sélectionner le {territoryLabel.toLowerCase()}…</option>
                            {countryTerritories.map((t) => (
                              <option key={t.id} value={t.name}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1.5 text-xs text-blue-100/50">
                            Liste officielle des {territoryLabel.toLowerCase()}s de{' '}
                            {selectedCountry?.name}.
                          </p>
                        </>
                      ) : (
                        /* Pays sans liste configurée : saisie libre (compatibilité multi-pays) */
                        <input
                          type="text"
                          value={formData.territoryName}
                          onChange={(e) =>
                            setFormData({ ...formData, territoryName: e.target.value })
                          }
                          className={cn(
                            'fed-input px-4 py-2',
                            errors.territoryName ? '!border-red-500/60' : '',
                          )}
                          placeholder="Ex : Région du…"
                        />
                      )}
                      {errors.territoryName && (
                        <p className="mt-1 text-sm text-red-400">{errors.territoryName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-black text-amber-400/90 uppercase tracking-wider mb-2">
                        Patronat national de rattachement{' '}
                        <span className="text-red-500">*</span>
                      </label>

                      {loadingNationals ? (
                        /* Récupération automatique en cours */
                        <div className="fed-input px-4 py-2 flex items-center gap-2.5 text-blue-100/70">
                          <svg
                            className="animate-spin h-4 w-4 flex-shrink-0 text-amber-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          <span className="text-sm">
                            Récupération du patronat national de {selectedCountry?.name}…
                          </span>
                        </div>
                      ) : nationalPatronats.length === 1 ? (
                        /* ⭐ Cas nominal : un pays = UN SEUL patronat national,
                           récupéré automatiquement depuis la base et pré-rempli. */
                        <>
                          <div className="fed-input px-4 py-2.5 flex items-center gap-2.5 !border-emerald-400/30 bg-emerald-500/10">
                            <svg
                              className="h-5 w-5 flex-shrink-0 text-emerald-400"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="text-sm font-semibold text-white">
                              {nationalPatronats[0].name}
                            </span>
                            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-emerald-300/90 border border-emerald-400/30 rounded-full px-2 py-0.5 flex-shrink-0">
                              Automatique
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs text-emerald-300/80">
                            Rattachement automatique au patronat national unique de{' '}
                            {selectedCountry?.name} — tous les patronats départementaux du pays
                            sont rattachés à ce patronat national.
                          </p>
                        </>
                      ) : nationalPatronats.length > 1 ? (
                        /* Cas transitoire (données antérieures à la règle
                           d'unicité) : sélecteur parmi les nationaux existants. */
                        <>
                          <select
                            value={formData.parentPatronatId}
                            onChange={(e) =>
                              setFormData({ ...formData, parentPatronatId: e.target.value })
                            }
                            className={cn(
                              'fed-input px-4 py-2',
                              errors.parentPatronatId ? '!border-red-500/60' : '',
                            )}
                          >
                            <option value="">Sélectionner le patronat national…</option>
                            {nationalPatronats.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1.5 text-xs text-blue-100/50">
                            Plusieurs patronats nationaux historiques existent pour ce pays —
                            sélectionnez celui officiel.
                          </p>
                        </>
                      ) : (
                        /* Aucun patronat national pour ce pays */
                        <div className="fed-input px-4 py-2 text-sm text-amber-300/90">
                          Aucun patronat national actif pour {selectedCountry?.name}
                        </div>
                      )}

                      {errors.parentPatronatId && (
                        <p className="mt-1 text-sm text-red-400">{errors.parentPatronatId}</p>
                      )}
                      {nationalPatronats.length === 0 && !loadingNationals && (
                        <p className="mt-1.5 text-xs text-amber-400/90">
                          Aucun patronat national n&rsquo;est encore enregistré pour ce pays.
                          Le patronat national doit être créé en premier : contactez
                          l&rsquo;équipe Academia Federis pour valider le modèle local avant
                          activation.
                        </p>
                      )}
                    </div>
                  </>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="fed-btn-gold fed-btn-shimmer px-6 py-2.5 text-sm"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}

            {/* Étape 2 — Responsable et accès */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-black text-amber-400/90 uppercase tracking-wider mb-2">
                    Nom du responsable <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.responsibleName}
                    onChange={(e) =>
                      setFormData({ ...formData, responsibleName: e.target.value })
                    }
                    className={cn(
                      'fed-input px-4 py-2',
                      errors.responsibleName ? '!border-red-500/60' : '',
                    )}
                    placeholder="Prénom et nom"
                  />
                  {errors.responsibleName && (
                    <p className="mt-1 text-sm text-red-400">{errors.responsibleName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black text-amber-400/90 uppercase tracking-wider mb-2">
                    Adresse électronique institutionnelle{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={cn(
                      'fed-input px-4 py-2',
                      errors.email ? '!border-red-500/60' : '',
                    )}
                    placeholder="contact@patronat.org"
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-xs font-black text-amber-400/90 uppercase tracking-wider mb-2">
                    Téléphone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={cn(
                      'fed-input px-4 py-2',
                      errors.phone ? '!border-red-500/60' : '',
                    )}
                    placeholder={selectedCountry?.phonePrefix ?? '+229'}
                  />
                  {errors.phone && <p className="mt-1 text-sm text-red-400">{errors.phone}</p>}
                </div>

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="fed-btn-ghost px-6 py-2.5 text-sm"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="fed-btn-gold fed-btn-shimmer px-6 py-2.5 text-sm"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}

            {/* Étape 3 — Sécurité */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-blue-100">
                  <p className="font-semibold mb-1 text-white">Récapitulatif</p>
                  <p>
                    {formData.name} — {isNational ? 'Organisation nationale' : territoryLabel} de{' '}
                    {isNational
                      ? selectedCountry?.name
                      : formData.territoryName}{' '}
                    ({selectedCountry?.name})
                  </p>
                  <p className="text-blue-100/60 mt-1">
                    Responsable : {formData.responsibleName} — {formData.email}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-black text-amber-400/90 uppercase tracking-wider mb-2">
                    Mot de passe <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={cn(
                      'fed-input px-4 py-2',
                      errors.password ? '!border-red-500/60' : '',
                    )}
                    placeholder="Minimum 8 caractères"
                    autoComplete="new-password"
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-400">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black text-amber-400/90 uppercase tracking-wider mb-2">
                    Confirmation du mot de passe <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, confirmPassword: e.target.value })
                    }
                    className={cn(
                      'fed-input px-4 py-2',
                      errors.confirmPassword ? '!border-red-500/60' : '',
                    )}
                    placeholder="Répétez le mot de passe"
                    autoComplete="new-password"
                  />
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-400">{errors.confirmPassword}</p>
                  )}
                </div>

                {(errors.submit || errors.form) && (
                  <div className="p-4 bg-red-950/40 border border-red-800/40 rounded-2xl">
                    <p className="text-sm text-red-300">{errors.submit || errors.form}</p>
                  </div>
                )}

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="fed-btn-ghost px-6 py-2.5 text-sm"
                  >
                    Précédent
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="fed-btn-gold fed-btn-shimmer px-6 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Création du compte…' : 'Créer le compte'}
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Lien connexion */}
          <div className="mt-6 text-center">
            <p className="text-sm text-blue-100/60">
              Vous avez déjà un compte ?{' '}
              <Link
                href={`${getFederisBasePath()}/login`}
                className="text-amber-400 font-semibold hover:text-amber-300"
              >
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
