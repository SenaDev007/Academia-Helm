/**
 * Page d'inscription Academia Federis
 *
 * Création de compte Patronat / Organisme d'examen en 3 étapes
 * (cahier des charges §6.3 + wireframe §10.1) :
 *   1. Informations institutionnelles (pays, niveau territorial configurable,
 *      nom, unité territoriale, patronat national de rattachement, type d'organisme)
 *   2. Responsable et accès (nom, email institutionnel, téléphone)
 *   3. Mot de passe et confirmation → POST /federis/public/register → /checkout
 *
 * Le patronat existe avant les écoles : aucune école n'est demandée ici.
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
}

interface NationalPatronat {
  id: string;
  name: string;
  abbreviation?: string;
}

type OrganismType = 'PATRONAT' | 'ASSOCIATION' | 'ORGANISME';

const ORGANISM_OPTIONS: Array<{ value: OrganismType; label: string }> = [
  { value: 'PATRONAT', label: 'Patronat' },
  { value: 'ASSOCIATION', label: 'Association' },
  { value: 'ORGANISME', label: 'Organisme' },
];

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
    organismType: '' as OrganismType | '',
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

  // Patronats nationaux du pays sélectionné (rattachement des territoriaux)
  const loadNationalPatronats = useCallback(async (countryId: string) => {
    setLoadingNationals(true);
    try {
      const res = await apiClient.get('/federis/public/national-patronats', {
        params: { countryId },
        timeout: 15000,
      });
      setNationalPatronats(res.data ?? []);
    } catch (err) {
      console.error('[FederisRegister] Erreur patronats nationaux :', err);
      setNationalPatronats([]);
    } finally {
      setLoadingNationals(false);
    }
  }, []);

  useEffect(() => {
    if (formData.countryId && !isNational) {
      void loadNationalPatronats(formData.countryId);
    } else {
      setNationalPatronats([]);
    }
     
  }, [formData.countryId, formData.territorialLevelCode]);

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
      if (!formData.organismType) newErrors.organismType = "Le type d'organisme est requis";
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
        organismType: formData.organismType,
        responsibleName: formData.responsibleName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        password: formData.password,
      };

      const res = await apiClient.post('/federis/public/register', payload, { timeout: 30000 });
      const patronatName = res.data?.patronat?.name ?? formData.name.trim();

      // Connexion immédiate après inscription : le parcours d'activation
      // (/checkout → Fedapay) requiert la session JWT du responsable.
      try {
        await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email.trim().toLowerCase(),
            password: formData.password,
            portal_type: 'PATRONAT',
          }),
        });
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
    <div className="min-h-screen bg-gray-50">
      <FederisHeader />
      <div className="pt-24 pb-12">
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Créer un compte Patronat / Organisme d&rsquo;examen
            </h1>
            <p className="text-gray-600 text-sm">
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
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0',
                      step >= stepNumber ? 'bg-blue-800 text-white' : 'bg-gray-200 text-gray-600',
                    )}
                  >
                    {stepNumber}
                  </div>
                  {stepNumber < 3 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-2',
                        step > stepNumber ? 'bg-blue-800' : 'bg-gray-200',
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
                    step === i + 1 ? 'text-blue-900 font-semibold' : 'text-gray-400',
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
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8"
          >
            {/* Étape 1 — Informations institutionnelles */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pays <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.countryId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        countryId: e.target.value,
                        territorialLevelCode: '',
                        parentPatronatId: '',
                      })
                    }
                    disabled={loadingCountries}
                    className={cn(
                      'w-full px-4 py-2 border rounded-md bg-white',
                      errors.countryId ? 'border-red-300' : 'border-gray-300',
                      'focus:ring-2 focus:ring-blue-800 focus:border-blue-800',
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
                    <p className="mt-1 text-sm text-red-600">{errors.countryId}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Niveau de l&rsquo;organisation <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.territorialLevelCode}
                    onChange={(e) =>
                      setFormData({ ...formData, territorialLevelCode: e.target.value })
                    }
                    disabled={!formData.countryId}
                    className={cn(
                      'w-full px-4 py-2 border rounded-md bg-white',
                      errors.territorialLevelCode ? 'border-red-300' : 'border-gray-300',
                      'focus:ring-2 focus:ring-blue-800 focus:border-blue-800',
                    )}
                  >
                    <option value="">Sélectionner le niveau…</option>
                    {selectedCountry?.territorialLevels.map((l) => (
                      <option key={l.id} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  {errors.territorialLevelCode && (
                    <p className="mt-1 text-sm text-red-600">{errors.territorialLevelCode}</p>
                  )}
                  <p className="mt-1.5 text-xs text-gray-400">
                    Les niveaux disponibles sont configurés selon l&rsquo;organisation réelle de
                    chaque pays.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom du patronat ou de l&rsquo;association{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={cn(
                      'w-full px-4 py-2 border rounded-md',
                      errors.name ? 'border-red-300' : 'border-gray-300',
                      'focus:ring-2 focus:ring-blue-800 focus:border-blue-800',
                    )}
                    placeholder="Ex : Patronat des Écoles Privées du Bénin"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                </div>

                {!isNational && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {territoryLabel} (département, région ou autre unité territoriale){' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.territoryName}
                        onChange={(e) =>
                          setFormData({ ...formData, territoryName: e.target.value })
                        }
                        className={cn(
                          'w-full px-4 py-2 border rounded-md',
                          errors.territoryName ? 'border-red-300' : 'border-gray-300',
                          'focus:ring-2 focus:ring-blue-800 focus:border-blue-800',
                        )}
                        placeholder={
                          selectedCountry?.code === 'BJ' ? 'Ex : Atlantique' : 'Ex : Région du…'
                        }
                      />
                      {errors.territoryName && (
                        <p className="mt-1 text-sm text-red-600">{errors.territoryName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Patronat national de rattachement{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.parentPatronatId}
                        onChange={(e) =>
                          setFormData({ ...formData, parentPatronatId: e.target.value })
                        }
                        disabled={loadingNationals}
                        className={cn(
                          'w-full px-4 py-2 border rounded-md bg-white',
                          errors.parentPatronatId ? 'border-red-300' : 'border-gray-300',
                          'focus:ring-2 focus:ring-blue-800 focus:border-blue-800',
                        )}
                      >
                        <option value="">
                          {loadingNationals
                            ? 'Chargement…'
                            : nationalPatronats.length === 0
                              ? 'Aucun patronat national actif dans ce pays'
                              : 'Sélectionner le patronat national…'}
                        </option>
                        {nationalPatronats.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      {errors.parentPatronatId && (
                        <p className="mt-1 text-sm text-red-600">{errors.parentPatronatId}</p>
                      )}
                      {nationalPatronats.length === 0 && !loadingNationals && (
                        <p className="mt-1.5 text-xs text-amber-600">
                          Aucun patronat national n&rsquo;est encore enregistré pour ce pays.
                          Contactez l&rsquo;équipe pour valider le modèle local avant activation.
                        </p>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type d&rsquo;organisme <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.organismType}
                    onChange={(e) =>
                      setFormData({ ...formData, organismType: e.target.value as OrganismType })
                    }
                    className={cn(
                      'w-full px-4 py-2 border rounded-md bg-white',
                      errors.organismType ? 'border-red-300' : 'border-gray-300',
                      'focus:ring-2 focus:ring-blue-800 focus:border-blue-800',
                    )}
                  >
                    <option value="">Sélectionner…</option>
                    {ORGANISM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {errors.organismType && (
                    <p className="mt-1 text-sm text-red-600">{errors.organismType}</p>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-6 py-2.5 bg-blue-800 text-white rounded-md font-semibold hover:bg-blue-900 transition-colors"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom du responsable <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.responsibleName}
                    onChange={(e) =>
                      setFormData({ ...formData, responsibleName: e.target.value })
                    }
                    className={cn(
                      'w-full px-4 py-2 border rounded-md',
                      errors.responsibleName ? 'border-red-300' : 'border-gray-300',
                      'focus:ring-2 focus:ring-blue-800 focus:border-blue-800',
                    )}
                    placeholder="Prénom et nom"
                  />
                  {errors.responsibleName && (
                    <p className="mt-1 text-sm text-red-600">{errors.responsibleName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adresse électronique institutionnelle{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={cn(
                      'w-full px-4 py-2 border rounded-md',
                      errors.email ? 'border-red-300' : 'border-gray-300',
                      'focus:ring-2 focus:ring-blue-800 focus:border-blue-800',
                    )}
                    placeholder="contact@patronat.org"
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Téléphone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={cn(
                      'w-full px-4 py-2 border rounded-md',
                      errors.phone ? 'border-red-300' : 'border-gray-300',
                      'focus:ring-2 focus:ring-blue-800 focus:border-blue-800',
                    )}
                    placeholder={selectedCountry?.phonePrefix ?? '+229'}
                  />
                  {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
                </div>

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-md font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-6 py-2.5 bg-blue-800 text-white rounded-md font-semibold hover:bg-blue-900 transition-colors"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}

            {/* Étape 3 — Sécurité */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="bg-blue-50 border border-blue-100 rounded-md p-4 text-sm text-blue-900">
                  <p className="font-semibold mb-1">Récapitulatif</p>
                  <p>
                    {formData.name} — {isNational ? 'Organisation nationale' : territoryLabel} de{' '}
                    {isNational
                      ? selectedCountry?.name
                      : formData.territoryName}{' '}
                    ({selectedCountry?.name})
                  </p>
                  <p className="text-gray-500 mt-1">
                    Responsable : {formData.responsibleName} — {formData.email}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mot de passe <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={cn(
                      'w-full px-4 py-2 border rounded-md',
                      errors.password ? 'border-red-300' : 'border-gray-300',
                      'focus:ring-2 focus:ring-blue-800 focus:border-blue-800',
                    )}
                    placeholder="Minimum 8 caractères"
                    autoComplete="new-password"
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmation du mot de passe <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, confirmPassword: e.target.value })
                    }
                    className={cn(
                      'w-full px-4 py-2 border rounded-md',
                      errors.confirmPassword ? 'border-red-300' : 'border-gray-300',
                      'focus:ring-2 focus:ring-blue-800 focus:border-blue-800',
                    )}
                    placeholder="Répétez le mot de passe"
                    autoComplete="new-password"
                  />
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                  )}
                </div>

                {(errors.submit || errors.form) && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{errors.submit || errors.form}</p>
                  </div>
                )}

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-md font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Précédent
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-blue-800 text-white rounded-md font-semibold hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Création du compte…' : 'Créer le compte'}
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Lien connexion */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Vous avez déjà un compte ?{' '}
              <Link
                href={`${getFederisBasePath()}/login`}
                className="text-blue-800 font-semibold hover:text-blue-900"
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
