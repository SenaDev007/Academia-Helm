/**
 * ============================================================================
 * ONBOARDING WIZARD - WIZARD 4 PHASES
 * ============================================================================
 * 
 * Composant React pour l'onboarding complet en 4 phases :
 * 1. Établissement (nom, type, pays, ville, téléphone, email, bilingue, nb écoles, logo)
 * 2. Promoteur (nom, prénom, téléphone, email, password, OTP)
 * 3. Plan & Options (pricing dynamique, mensuel/annuel, total)
 * 4. Paiement Initial (FedaPay)
 * 
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building,
  User,
  CreditCard,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader,
  AlertCircle,
  Check,
  X,
  Eye,
  EyeOff,
  Globe,
  Languages,
  School,
  Calendar,
} from 'lucide-react';

interface OnboardingData {
  // Phase 1: Établissement
  schoolName: string;
  schoolType: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  bilingual: boolean;
  schoolsCount: number;
  logoUrl?: string;

  // Phase 2: Promoteur
  firstName: string;
  lastName: string;
  promoterPhone: string;
  promoterEmail: string;
  password: string;
  otp: string;

  // Phase 3: Plan
  planCode: string;
  billingPeriod: 'monthly' | 'yearly';
  bilingualEnabled: boolean;

  // Draft ID
  draftId?: string;
}

interface FormErrors {
  [key: string]: string;
}

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCode, setOtpCode] = useState<string | null>(null); // Code OTP affiché en dev
  const [otpExpiresAt, setOtpExpiresAt] = useState<Date | null>(null); // Expiration OTP
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number; // 0-4
    label: string; // 'Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'
    color: string; // Couleur de l'indicateur
  }>({ score: 0, label: '', color: 'gray' });
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [priceCalculation, setPriceCalculation] = useState<{
    basePrice: number;
    bilingualPrice: number;
    total: number;
  } | null>(null);

  const [data, setData] = useState<OnboardingData>({
    schoolName: '',
    schoolType: '',
    city: '',
    country: 'Bénin',
    phone: '',
    email: '',
    bilingual: false,
    schoolsCount: 1,
    firstName: '',
    lastName: '',
    promoterPhone: '',
    promoterEmail: '',
    password: '',
    confirmPassword: '',
    otp: '',
    planCode: 'MONTHLY_1_SCHOOL',
    billingPeriod: 'monthly',
    bilingualEnabled: false,
  });

  // Calculer le prix dynamiquement
  useEffect(() => {
    if (step >= 3) {
      calculatePrice();
    }
  }, [data.schoolsCount, data.bilingual, data.billingPeriod, step]);

  // Calculer la force du mot de passe
  const calculatePasswordStrength = (password: string) => {
    if (!password) {
      setPasswordStrength({ score: 0, label: '', color: 'gray' });
      return;
    }

    let score = 0;
    
    // Longueur minimale (8 caractères)
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    
    // Contient des minuscules
    if (/[a-z]/.test(password)) score++;
    
    // Contient des majuscules
    if (/[A-Z]/.test(password)) score++;
    
    // Contient des chiffres
    if (/[0-9]/.test(password)) score++;
    
    // Contient des caractères spéciaux
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    
    // Limiter le score à 4 (0-4)
    score = Math.min(score, 4);
    
    // Déterminer le label et la couleur
    let label = '';
    let color = 'gray';
    
    if (score === 0) {
      label = '';
      color = 'gray';
    } else if (score === 1) {
      label = 'Très faible';
      color = 'red';
    } else if (score === 2) {
      label = 'Faible';
      color = 'orange';
    } else if (score === 3) {
      label = 'Moyen';
      color = 'yellow';
    } else if (score === 4) {
      label = 'Fort';
      color = 'green';
    }
    
    setPasswordStrength({ score, label, color });
  };

  // Mettre à jour la force du mot de passe quand il change
  useEffect(() => {
    if (step === 2) {
      calculatePasswordStrength(data.password);
    }
  }, [data.password, step]);

  // Fonction pour obtenir le code téléphonique selon le pays
  const getCountryPhoneCode = (country: string): string => {
    const countryCodes: { [key: string]: string } = {
      'Bénin': '+229',
      'Togo': '+228',
      'Côte d\'Ivoire': '+225',
      'Sénégal': '+221',
    };
    return countryCodes[country] || '+229'; // Par défaut Bénin
  };

  // Fonction pour normaliser le numéro de téléphone
  const normalizePhoneNumber = (phone: string, country: string): string => {
    if (!phone) return phone;
    
    // Nettoyer le numéro (supprimer espaces, tirets, etc.)
    const cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
    
    // Si le numéro commence déjà par un code pays, le retourner tel quel
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    
    // Obtenir le code du pays
    const countryCode = getCountryPhoneCode(country);
    
    // Si le numéro commence par le code sans le +, l'ajouter
    const codeWithoutPlus = countryCode.substring(1);
    if (cleaned.startsWith(codeWithoutPlus)) {
      return '+' + cleaned;
    }
    
    // Sinon, ajouter le code du pays
    return countryCode + cleaned;
  };

  const calculatePrice = async () => {
    // Pricing basé sur le nombre d'écoles
    const basePrices: { [key: number]: { monthly: number; yearly: number } } = {
      1: { monthly: 15000, yearly: 150000 },
      2: { monthly: 25000, yearly: 250000 },
      3: { monthly: 35000, yearly: 350000 },
      4: { monthly: 45000, yearly: 450000 },
    };

    const schoolsCount = Math.min(data.schoolsCount, 4);
    const prices = basePrices[schoolsCount] || basePrices[1];
    const basePrice = data.billingPeriod === 'monthly' ? prices.monthly : prices.yearly;
    const bilingualPrice = data.bilingual && data.billingPeriod === 'monthly' ? 5000 : 0;
    const total = basePrice + bilingualPrice;

    setPriceCalculation({ basePrice, bilingualPrice, total });
  };

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: FormErrors = {};

    if (stepNumber === 1) {
      if (!data.schoolName.trim()) newErrors.schoolName = 'Le nom de l\'établissement est requis';
      if (!data.schoolType) newErrors.schoolType = 'Le type d\'établissement est requis';
      if (!data.country) newErrors.country = 'Le pays est requis';
      if (!data.city) newErrors.city = 'La ville est requise';
      if (!data.phone.trim()) {
        newErrors.phone = 'Le téléphone est requis';
      } else {
        // Normaliser le numéro avec le code du pays
        const normalizedPhone = normalizePhoneNumber(data.phone, data.country);
        const countryCode = getCountryPhoneCode(data.country);
        const codeWithoutPlus = countryCode.substring(1);
        
        // Vérifier que le numéro normalisé correspond au format attendu
        // Format : +CODE suivi de 10 chiffres pour le Bénin
        const phoneRegex = new RegExp(`^\\${countryCode}\\d{10}$`);
        const cleanedPhone = normalizedPhone.replace(/[\s\-\(\)]/g, '');
        
        if (!phoneRegex.test(cleanedPhone)) {
          // Vérifier si c'est juste les 10 chiffres sans le code
          const digitsOnly = cleanedPhone.replace(/\D/g, '');
          if (digitsOnly.length === 10) {
            // C'est valide, on normalisera lors de la soumission
          } else if (cleanedPhone.startsWith(countryCode) && digitsOnly.length === 13) {
            // Format correct avec code pays
          } else {
            newErrors.phone = `Le numéro doit contenir 10 chiffres (format: ${countryCode}XXXXXXXXXX ou juste XXXXXXXXXX)`;
          }
        }
      }
      if (!data.email.trim()) newErrors.email = 'L\'email est requis';
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        newErrors.email = 'Format d\'email invalide';
      }
      if (data.schoolsCount < 1 || data.schoolsCount > 2) {
        newErrors.schoolsCount = 'Le nombre d\'écoles doit être 1 ou 2';
      }
    }

    if (stepNumber === 2) {
      if (!data.firstName.trim()) newErrors.firstName = 'Le prénom est requis';
      if (!data.lastName.trim()) newErrors.lastName = 'Le nom est requis';
      if (!data.promoterEmail.trim()) newErrors.promoterEmail = 'L\'email est requis';
      if (data.promoterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.promoterEmail)) {
        newErrors.promoterEmail = 'Format d\'email invalide';
      }
      if (!data.promoterPhone.trim()) {
        newErrors.promoterPhone = 'Le téléphone est requis';
      } else {
        // Vérifier que le numéro contient 10 chiffres (avec ou sans code pays)
        const digitsOnly = data.promoterPhone.replace(/\D/g, '');
        const countryCode = getCountryPhoneCode(data.country);
        const codeDigits = countryCode.substring(1); // Code sans le +
        
        // Si le numéro commence par le code pays, vérifier qu'il y a 10 chiffres après
        if (digitsOnly.startsWith(codeDigits) && digitsOnly.length === codeDigits.length + 10) {
          // Format correct avec code pays
        } else if (digitsOnly.length === 10) {
          // Format correct sans code pays (sera ajouté automatiquement)
        } else {
          newErrors.promoterPhone = `Le numéro doit contenir 10 chiffres (format: ${countryCode}XXXXXXXXXX ou juste XXXXXXXXXX)`;
        }
      }
      if (!data.password) newErrors.password = 'Le mot de passe est requis';
      if (data.password && data.password.length < 8) {
        newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères';
      }
      if (!data.confirmPassword) newErrors.confirmPassword = 'La confirmation du mot de passe est requise';
      if (data.password && data.confirmPassword && data.password !== data.confirmPassword) {
        newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
      }
      if (!otpVerified) newErrors.otp = 'Veuillez vérifier votre code OTP';
    }

    if (stepNumber === 3) {
      if (!data.planCode) newErrors.planCode = 'Veuillez sélectionner un plan';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof OnboardingData, value: any) => {
    setData({ ...data, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handleNext = async () => {
    if (!validateStep(step)) {
      return;
    }

    if (step === 1) {
      // Créer le draft
      setIsSubmitting(true);
      try {
        // Normaliser le numéro de téléphone avant l'envoi
        const normalizedPhone = normalizePhoneNumber(data.phone, data.country);
        
        const response = await fetch('/api/onboarding/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolName: data.schoolName,
            schoolType: data.schoolType,
            city: data.city,
            country: data.country,
            phone: normalizedPhone,
            email: data.email,
            bilingual: data.bilingual,
            schoolsCount: data.schoolsCount,
            logoUrl: data.logoUrl,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Erreur lors de la création du draft');
        }

        const result = await response.json();
        setData({ ...data, draftId: result.id });
        setStep(2);
      } catch (error: any) {
        setErrors({ submit: error.message });
      } finally {
        setIsSubmitting(false);
      }
    } else if (step === 2) {
      // Ajouter les infos promoteur
      if (!data.draftId) {
        setErrors({ submit: 'Draft ID manquant' });
        return;
      }

      setIsSubmitting(true);
      try {
        // Normaliser le numéro de téléphone du promoteur avant l'envoi
        const normalizedPromoterPhone = normalizePhoneNumber(data.promoterPhone, data.country);
        
        const response = await fetch('/api/onboarding/promoter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftId: data.draftId,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.promoterEmail,
            phone: normalizedPromoterPhone,
            password: data.password,
            otp: data.otp,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Erreur lors de l\'ajout des informations promoteur');
        }

        setStep(3);
      } catch (error: any) {
        setErrors({ submit: error.message });
      } finally {
        setIsSubmitting(false);
      }
    } else if (step === 3) {
      // Sélectionner le plan
      if (!data.draftId) {
        setErrors({ submit: 'Draft ID manquant' });
        return;
      }

      setIsSubmitting(true);
      try {
        const response = await fetch('/api/onboarding/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftId: data.draftId,
            planCode: data.planCode,
            billingPeriod: data.billingPeriod, // Ajouté pour conversion planCode -> planId
            schoolsCount: data.schoolsCount, // Ajouté pour conversion planCode -> planId
            bilingualEnabled: data.bilingualEnabled, // Non utilisé côté backend (déjà dans draft.bilingual)
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Erreur lors de la sélection du plan');
        }

        setStep(4);
      } catch (error: any) {
        setErrors({ submit: error.message });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSendOtp = async () => {
    if (!data.promoterPhone) {
      setErrors({ promoterPhone: 'Veuillez entrer votre numéro de téléphone' });
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Appeler l'API OTP
      // Pour l'instant, simuler l'envoi
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setOtpSent(true);
      setErrors({});
    } catch (error: any) {
      setErrors({ otp: 'Erreur lors de l\'envoi du code OTP' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!data.otp || data.otp.length !== 6) {
      setErrors({ otp: 'Le code OTP doit contenir 6 chiffres' });
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Vérifier l'OTP via l'API
      // Pour l'instant, simuler la vérification
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setOtpVerified(true);
      setErrors({});
    } catch (error: any) {
      setErrors({ otp: 'Code OTP invalide' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayment = async () => {
    if (!data.draftId) {
      setErrors({ submit: 'Draft ID manquant' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/onboarding/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: data.draftId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur lors de la création de la session de paiement');
      }

      const result = await response.json();
      
      if (result.paymentUrl) {
        // Rediriger vers la page de paiement FedaPay
        window.location.href = result.paymentUrl;
      } else {
        throw new Error('URL de paiement non reçue');
      }
    } catch (error: any) {
      setErrors({ submit: error.message });
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setErrors({});
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50" style={{ marginTop: 0, paddingTop: 0 }}>
      {/* Progress Bar */}
      <div className="bg-white border-b border-blue-100 shadow-sm" style={{ marginTop: 0, paddingTop: 0 }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-4" style={{ paddingTop: 0 }}>
          {/* Titre centré */}
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold text-blue-900">Création de votre école sur Academia Hub</h1>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all font-semibold ${
                    step >= s 
                      ? 'bg-blue-900 border-blue-900 text-white shadow-md' 
                      : 'bg-white border-blue-300 text-blue-700'
                  }`}>
                    {step > s ? <CheckCircle className="w-6 h-6" /> : <span className="text-base font-bold">{s}</span>}
                  </div>
                  <span className={`mt-2 text-xs font-medium text-center ${
                    step >= s ? 'text-blue-900' : 'text-gray-500'
                  }`}>
                    {s === 1 && 'Établissement'}
                    {s === 2 && 'Promoteur'}
                    {s === 3 && 'Plan & Options'}
                    {s === 4 && 'Paiement'}
                  </span>
                </div>
                {s < 4 && (
                  <div className={`flex-1 h-1 mx-2 transition-all ${
                    step > s ? 'bg-blue-900' : 'bg-blue-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Bouton Retour */}
          <div className="mb-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour à l'accueil
            </Link>
          </div>
          
          {/* PHASE 1: Établissement */}
          {step === 1 && (
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex items-center mb-6">
                <Building className="w-8 h-8 text-blue-900 mr-3" />
                <h2 className="text-3xl font-bold text-blue-900">Informations de l'établissement</h2>
              </div>
              <p className="text-slate-600 mb-8">Renseignez les informations de votre établissement scolaire</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Nom officiel de l'établissement <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={data.schoolName}
                    onChange={(e) => handleChange('schoolName', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-blue-600 focus:border-blue-600 ${
                      errors.schoolName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Ex: École Primaire Les Étoiles"
                  />
                  {errors.schoolName && (
                    <p className="mt-1 text-sm text-red-600">{errors.schoolName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Type d'établissement <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={data.schoolType}
                    onChange={(e) => handleChange('schoolType', e.target.value)}
                    aria-label="Type d'établissement"
                    title="Type d'établissement"
                    className={`w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-blue-600 ${
                      errors.schoolType ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Sélectionner un type</option>
                    <option value="maternelle">Maternelle</option>
                    <option value="primaire">Primaire</option>
                    <option value="secondaire">Secondaire</option>
                    <option value="mixte">Mixte (Maternelle - Secondaire)</option>
                  </select>
                  {errors.schoolType && (
                    <p className="mt-1 text-sm text-red-600">{errors.schoolType}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    Le type sélectionné détermine quels niveaux scolaires seront actifs dans votre école après la création.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Pays <span className="text-red-600">*</span></label>
                    <select
                      value={data.country}
                      onChange={(e) => handleChange('country', e.target.value)}
                      aria-label="Pays"
                      title="Pays"
                      className={`w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-blue-600 ${
                        errors.country ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="Bénin">Bénin</option>
                      <option value="Togo">Togo</option>
                      <option value="Côte d'Ivoire">Côte d'Ivoire</option>
                      <option value="Sénégal">Sénégal</option>
                    </select>
                    {errors.country && (
                      <p className="mt-1 text-sm text-red-600">{errors.country}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Ville <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      value={data.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-blue-600 ${
                        errors.city ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Ex: Cotonou"
                    />
                    {errors.city && (
                      <p className="mt-1 text-sm text-red-600">{errors.city}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Téléphone de l'établissement <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="tel"
                      value={data.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-blue-600 ${
                        errors.phone ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder={getCountryPhoneCode(data.country) + "XXXXXXXXXX ou XXXXXXXXXX"}
                    />
                    {errors.phone && (
                      <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Email de l'établissement <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="email"
                      value={data.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-blue-600 ${
                        errors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="contact@ecole.com"
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                    )}
                  </div>
                </div>

                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="flex items-center text-sm font-medium text-gray-900">
                      <Languages className="w-5 h-5 mr-2" />
                      Option bilingue (Français + Anglais)
                    </label>
                    <button
                      type="button"
                      onClick={() => handleChange('bilingual', !data.bilingual)}
                      aria-label={data.bilingual ? "Désactiver l'option bilingue" : "Activer l'option bilingue"}
                      title={data.bilingual ? "Désactiver l'option bilingue" : "Activer l'option bilingue"}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        data.bilingual ? 'bg-blue-900' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          data.bilingual ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  {data.bilingual && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-semibold text-blue-600">
                        +5 000 FCFA / mois pour l'option bilingue
                      </p>
                      <p className="text-xs text-slate-500">
                        Le mode bilingue activera les parcours académiques en Français et en Anglais pour votre école.
                        Les modules concernés (matières, classes, évaluations) pourront être configurés dans les deux langues.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="flex items-center text-sm font-medium text-gray-900 mb-2">
                    <School className="w-5 h-5 mr-2" />
                    Nombre d'écoles gérées <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={data.schoolsCount}
                    onChange={(e) => handleChange('schoolsCount', parseInt(e.target.value))}
                    aria-label="Nombre d'écoles"
                    title="Nombre d'écoles"
                    className={`w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-blue-600 ${
                      errors.schoolsCount ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value={1}>1 école</option>
                    <option value={2}>2 écoles</option>
                  </select>
                  {errors.schoolsCount && (
                    <p className="mt-1 text-sm text-red-600">{errors.schoolsCount}</p>
                  )}
                </div>
              </div>

              {errors.submit && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{errors.submit}</p>
                </div>
              )}

              <div className="flex justify-end mt-8">
                <button
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-all duration-300 flex items-center disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      Continuer <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* PHASE 2: Promoteur */}
          {step === 2 && (
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex items-center mb-6">
                <User className="w-8 h-8 text-blue-900 mr-3" />
                <h2 className="text-3xl font-bold text-blue-900">Informations du promoteur</h2>
              </div>
              <p className="text-slate-600 mb-8">Créez le compte administrateur principal</p>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Prénom <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={data.firstName}
                      onChange={(e) => handleChange('firstName', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-blue-600 ${
                        errors.firstName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Koffi"
                    />
                    {errors.firstName && (
                      <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Nom <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={data.lastName}
                      onChange={(e) => handleChange('lastName', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-blue-600 ${
                        errors.lastName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="ADÉKAMBI"
                    />
                    {errors.lastName && (
                      <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Email <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="email"
                      value={data.promoterEmail}
                      onChange={(e) => handleChange('promoterEmail', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-blue-600 ${
                        errors.promoterEmail ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="koffi.adekambi@ecole.bj"
                    />
                    {errors.promoterEmail && (
                      <p className="mt-1 text-sm text-red-600">{errors.promoterEmail}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Téléphone <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="tel"
                      value={data.promoterPhone}
                      onChange={(e) => handleChange('promoterPhone', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-blue-600 ${
                        errors.promoterPhone ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder={getCountryPhoneCode(data.country) + "XXXXXXXXXX ou XXXXXXXXXX"}
                    />
                    {errors.promoterPhone && (
                      <p className="mt-1 text-sm text-red-600">{errors.promoterPhone}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Mot de passe <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={data.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-blue-600 pr-10 ${
                        errors.password ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Minimum 8 caractères"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                  {/* Indicateur de force du mot de passe */}
                  {data.password && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              passwordStrength.color === 'red' ? 'bg-red-500' :
                              passwordStrength.color === 'orange' ? 'bg-orange-500' :
                              passwordStrength.color === 'yellow' ? 'bg-yellow-500' :
                              passwordStrength.color === 'green' ? 'bg-green-500' :
                              'bg-emerald-500'
                            }`}
                            style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${
                          passwordStrength.color === 'red' ? 'text-red-600' :
                          passwordStrength.color === 'orange' ? 'text-orange-600' :
                          passwordStrength.color === 'yellow' ? 'text-yellow-600' :
                          passwordStrength.color === 'green' ? 'text-green-600' :
                          'text-emerald-600'
                        }`}>
                          {passwordStrength.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {passwordStrength.score < 2 && 'Utilisez des majuscules, chiffres et caractères spéciaux pour renforcer votre mot de passe'}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Confirmer le mot de passe <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={data.confirmPassword}
                      onChange={(e) => handleChange('confirmPassword', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-blue-600 pr-10 ${
                        errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Répétez le mot de passe"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Masquer la confirmation" : "Afficher la confirmation"}
                      title={showConfirmPassword ? "Masquer la confirmation" : "Afficher la confirmation"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                  )}
                  {data.confirmPassword && data.password === data.confirmPassword && (
                    <p className="mt-1 text-sm text-green-600 flex items-center">
                      <Check className="w-4 h-4 mr-1" /> Les mots de passe correspondent
                    </p>
                  )}
                </div>

                <div className="border-t pt-6">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Code OTP <span className="text-red-600">*</span>
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={data.otp}
                      onChange={(e) => handleChange('otp', e.target.value)}
                      maxLength={6}
                      className={`flex-1 px-4 py-3 border rounded-md focus:ring-2 focus:ring-blue-600 ${
                        errors.otp ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="000000"
                    />
                    {!otpSent ? (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={isSubmitting || !data.promoterPhone}
                        className="px-6 py-3 bg-blue-900 text-white rounded-md hover:bg-blue-800 disabled:opacity-50"
                      >
                        Envoyer OTP
                      </button>
                    ) : !otpVerified ? (
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={isSubmitting || !data.otp}
                        className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                      >
                        Vérifier
                      </button>
                    ) : (
                      <div className="flex items-center px-6 py-3 bg-green-50 text-green-700 rounded-md">
                        <Check className="w-5 h-5 mr-2" />
                        Vérifié
                      </div>
                    )}
                  </div>
                  {errors.otp && (
                    <p className="mt-1 text-sm text-red-600">{errors.otp}</p>
                  )}
                  {otpSent && !otpVerified && (
                    <div className="mt-2 space-y-2">
                      <p className="text-sm text-slate-600">
                        Code OTP envoyé par SMS/WhatsApp. Vérifiez votre téléphone.
                      </p>
                      {/* Afficher le code OTP en développement */}
                      {otpCode && process.env.NODE_ENV === 'development' && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                          <p className="text-xs font-semibold text-yellow-800 mb-1">
                            🔓 MODE DÉVELOPPEMENT - Code OTP :
                          </p>
                          <p className="text-lg font-mono font-bold text-yellow-900 text-center">
                            {otpCode}
                          </p>
                          <p className="text-xs text-yellow-700 mt-1 text-center">
                            (Copiez ce code pour tester)
                          </p>
                        </div>
                      )}
                      {/* Timer d'expiration */}
                      {otpExpiresAt && (
                        <p className="text-xs text-slate-500">
                          Le code expire dans{' '}
                          {Math.max(0, Math.floor((otpExpiresAt.getTime() - new Date().getTime()) / 1000 / 60))} minutes
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {errors.submit && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{errors.submit}</p>
                </div>
              )}

              <div className="flex justify-between mt-8">
                <button
                  onClick={handleBack}
                  className="flex items-center text-slate-600 hover:text-blue-900"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" /> Retour
                </button>
                <button
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-all duration-300 flex items-center disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      Continuer <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* PHASE 3: Plan & Options */}
          {step === 3 && (
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex items-center mb-6">
                <CreditCard className="w-8 h-8 text-blue-900 mr-3" />
                <h2 className="text-3xl font-bold text-blue-900">Plan & Options</h2>
              </div>
              <p className="text-slate-600 mb-8">Choisissez votre plan d'abonnement</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-4">
                    Période de facturation
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => handleChange('billingPeriod', 'monthly')}
                      className={`p-6 border-2 rounded-lg text-left transition-all ${
                        data.billingPeriod === 'monthly'
                          ? 'border-blue-900 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-semibold text-lg mb-2">Mensuel</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {priceCalculation?.basePrice.toLocaleString()} FCFA
                      </div>
                      <div className="text-sm text-slate-600 mt-2">/ mois</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleChange('billingPeriod', 'yearly')}
                      className={`p-6 border-2 rounded-lg text-left transition-all ${
                        data.billingPeriod === 'yearly'
                          ? 'border-blue-900 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-semibold text-lg mb-2">Annuel</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {priceCalculation?.basePrice.toLocaleString()} FCFA
                      </div>
                      <div className="text-sm text-slate-600 mt-2">/ an (-17%)</div>
                    </button>
                  </div>
                </div>

                {data.bilingual && (
                  <div className="border-t pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">Option bilingue</div>
                        <div className="text-sm text-slate-600">Français + Anglais</div>
                      </div>
                      <div className="text-lg font-semibold text-blue-900">
                        +{priceCalculation?.bilingualPrice.toLocaleString()} FCFA
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 rounded-lg p-6 border-2 border-blue-900">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-lg font-semibold text-gray-900">Paiement initial</div>
                    <div className="text-2xl font-bold text-blue-900">100 000 FCFA</div>
                  </div>
                  <p className="text-sm text-slate-600">
                    Paiement unique pour activer votre compte et démarrer la période d'essai de 30 jours.
                  </p>
                </div>

                <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">Total mensuel après essai</div>
                      <div className="text-sm text-slate-600 mt-1">
                        {data.schoolsCount} école{data.schoolsCount > 1 ? 's' : ''}
                        {data.bilingual && ' • Bilingue'}
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-green-700">
                      {priceCalculation?.total.toLocaleString()} FCFA
                    </div>
                  </div>
                </div>
              </div>

              {errors.submit && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{errors.submit}</p>
                </div>
              )}

              <div className="flex justify-between mt-8">
                <button
                  onClick={handleBack}
                  className="flex items-center text-slate-600 hover:text-blue-900"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" /> Retour
                </button>
                <button
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-all duration-300 flex items-center disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      Continuer <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* PHASE 4: Paiement */}
          {step === 4 && (
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex items-center mb-6">
                <CreditCard className="w-8 h-8 text-blue-900 mr-3" />
                <h2 className="text-3xl font-bold text-blue-900">Paiement initial</h2>
              </div>
              <p className="text-slate-600 mb-8">Finalisez votre inscription en effectuant le paiement</p>
              
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="text-center mb-6">
                    <div className="text-4xl font-bold text-blue-900 mb-2">
                      100 000 FCFA
                    </div>
                    <p className="text-slate-600">Paiement unique pour activation</p>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Période d'essai</span>
                      <span className="font-semibold">30 jours</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Accès complet</span>
                      <span className="font-semibold">Tous les modules</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Support</span>
                      <span className="font-semibold">Inclus</span>
                    </div>
                  </div>
                </div>

                {errors.submit && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{errors.submit}</p>
                  </div>
                )}

                <button
                  onClick={handlePayment}
                  disabled={isSubmitting}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-all duration-300 flex items-center justify-center disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Redirection vers FedaPay...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5 mr-2" />
                      Payer 100 000 FCFA via FedaPay
                    </>
                  )}
                </button>

                <p className="text-xs text-slate-500 text-center">
                  Paiement sécurisé via FedaPay. Vous serez redirigé vers la page de paiement.
                </p>
              </div>

              <div className="flex justify-start mt-8">
                <button
                  onClick={handleBack}
                  className="flex items-center text-slate-600 hover:text-blue-900"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" /> Retour
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
