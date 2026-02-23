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
  Clock,
  Upload,
  X as XIcon,
  AlertTriangle,
  Trash2,
  RotateCcw,
  MessageSquare,
  Phone,
  Briefcase,
  DollarSign,
  Sparkles,
  TrendingDown,
} from 'lucide-react';
import FedaPayCheckout from './FedaPayCheckout';

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
  /** Sous-domaine personnalisé (ex: mon-ecole → mon-ecole.academia-hub.pro) */
  preferredSubdomain?: string;

  // Phase 2: Promoteur
  firstName: string;
  lastName: string;
  promoterPhone: string;
  promoterEmail: string;
  password: string;
  confirmPassword: string;
  otp: string;

  // Phase 3: Plan
  planCode: string;
  billingPeriod: 'monthly' | 'yearly';

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
  const [otpMethod, setOtpMethod] = useState<'sms' | 'voice' | 'whatsapp'>('sms'); // Méthode d'envoi OTP
  const [otpExpiresAt, setOtpExpiresAt] = useState<Date | null>(null); // Expiration OTP
  const [resendCooldown, setResendCooldown] = useState(0); // Compteur pour renvoyer l'OTP (en secondes)
  const [showCheckout, setShowCheckout] = useState(false); // Afficher le checkout intégré
  const [checkoutData, setCheckoutData] = useState<{
    public_key: string;
    transaction: { amount: number; description: string }; // currency n'est PAS dans transaction pour le checkout intégré
    customer: { email: string; lastname: string; firstname?: string; phone_number?: string };
    transactionId?: string; // ID de la transaction FedaPay
    paymentId?: string; // ID du paiement dans notre base
  } | null>(null); // Données pour le checkout intégré (conformes à la doc FedaPay)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false); // État de l'upload du logo
  const [logoPreview, setLogoPreview] = useState<string | null>(null); // Aperçu du logo
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number; // 0-4
    label: string; // 'Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'
    color: string; // Couleur de l'indicateur
  }>({ score: 0, label: '', color: 'gray' });
  const [passwordFocused, setPasswordFocused] = useState(false); // Suivre si le champ password est focus
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [priceCalculation, setPriceCalculation] = useState<{
    monthly: {
    basePrice: number;
    bilingualPrice: number;
    total: number;
    } | null;
    yearly: {
      basePrice: number;
      bilingualPrice: number;
      total: number;
    } | null;
    isLoading: boolean;
    error: string | null;
  }>({
    monthly: null,
    yearly: null,
    isLoading: false,
    error: null,
  });
  const [initialPayment, setInitialPayment] = useState<number | null>(null);
  const [showDraftChoiceModal, setShowDraftChoiceModal] = useState(false);
  const [existingDraftInfo, setExistingDraftInfo] = useState<{
    id: string;
    status: string;
    data?: any;
  } | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showDraftRestoreBanner, setShowDraftRestoreBanner] = useState(false);
  const [pendingDraftInfo, setPendingDraftInfo] = useState<{
    id: string;
    data?: any;
  } | null>(null);

  const [subdomainSuggestions, setSubdomainSuggestions] = useState<{ subdomain: string; available: boolean }[]>([]);
  const [subdomainSuggestionsLoading, setSubdomainSuggestionsLoading] = useState(false);
  const [subdomainCheckStatus, setSubdomainCheckStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');

  // État initial vide - ne pas charger automatiquement les données
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
    planCode: 'BASIC_MONTHLY',
    billingPeriod: 'monthly',
    preferredSubdomain: '',
  });

  // Sauvegarder les données dans localStorage à chaque changement
  useEffect(() => {
    if (typeof window !== 'undefined' && data.draftId) {
      try {
        localStorage.setItem('onboarding-draft', JSON.stringify({
          data,
          timestamp: Date.now(),
        }));
      } catch (error) {
        console.error('Error saving onboarding data:', error);
      }
    }
  }, [data]);

  // Vérifier si un draft existe pour l'email quand l'utilisateur saisit l'email
  useEffect(() => {
    // Ne vérifier que si on est à l'étape 1 et que l'email est valide
    if (step !== 1 || !data.email || !data.email.includes('@')) {
      // Si l'email n'est plus valide, cacher la bannière
      if (!data.email || !data.email.includes('@')) {
        setShowDraftRestoreBanner(false);
        setPendingDraftInfo(null);
      }
      return;
    }

    // Ne pas vérifier si on a déjà un draftId (pour éviter les vérifications inutiles)
    if (data.draftId) {
      return;
    }

    // Debounce : attendre 1 seconde après la dernière modification
    const timeoutId = setTimeout(async () => {
      try {
        // Encoder l'email pour l'URL
        const encodedEmail = encodeURIComponent(data.email);
        const response = await fetch(`/api/onboarding/draft/check/${encodedEmail}`);
        
        if (response.ok) {
          const result = await response.json();
          
          if (result.exists && result.draft) {
            // Un draft existe pour cet email
            setPendingDraftInfo({
              id: result.draft.id,
              data: result.draft,
            });
            setShowDraftRestoreBanner(true);
          } else {
            // Aucun draft pour cet email
            setShowDraftRestoreBanner(false);
            setPendingDraftInfo(null);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du draft:', error);
        // En cas d'erreur, ne pas afficher la bannière
        setShowDraftRestoreBanner(false);
        setPendingDraftInfo(null);
      }
    }, 1000); // Debounce de 1 seconde

    // Nettoyer le timeout si l'email change avant la fin du délai
    return () => clearTimeout(timeoutId);
  }, [data.email, step, data.draftId]); // Vérifier quand l'email change

  // Générer le planCode dynamiquement basé sur schoolsCount et billingPeriod
  useEffect(() => {
    const generatePlanCode = () => {
      const period = data.billingPeriod === 'monthly' ? 'MONTHLY' : 'YEARLY';
      if (data.schoolsCount === 1) {
        return `BASIC_${period}`;
      } else if (data.schoolsCount === 2) {
        return `GROUP_2_${period}`;
      } else if (data.schoolsCount === 3) {
        return `GROUP_3_${period}`;
      } else {
        return `GROUP_4_${period}`;
      }
    };
    
    const newPlanCode = generatePlanCode();
    if (newPlanCode !== data.planCode) {
      setData({ ...data, planCode: newPlanCode });
    }
  }, [data.schoolsCount, data.billingPeriod]);

  // Charger le prix initial au montage (dynamiquement depuis le backend)
  useEffect(() => {
    const loadInitialPayment = async () => {
      try {
        const response = await fetch('/api/public/pricing/initial');
        if (response.ok) {
          const result = await response.json();
          if (result.amount) {
            setInitialPayment(result.amount);
          } else {
            console.warn('⚠️ Initial payment amount not found in API response');
          }
        } else {
          console.error('Failed to load initial payment:', response.status);
        }
      } catch (error) {
        console.error('Error loading initial payment:', error);
        // Ne pas définir de fallback hardcodé - le montant doit venir du backend
      }
    };
    loadInitialPayment();
  }, []);

  // Calculer les prix dynamiquement depuis l'API (mensuel ET annuel)
  useEffect(() => {
    if (step >= 3 && data.planCode) {
      calculatePrices();
    }
  }, [data.schoolsCount, data.bilingual, data.planCode, step]);

  // Mettre à jour le code téléphonique quand le pays change
  useEffect(() => {
    // Le placeholder des champs téléphone sera automatiquement mis à jour
  }, [data.country]);

  // Charger les propositions de sous-domaine quand le nom d'établissement change
  useEffect(() => {
    if (step !== 1 || !data.schoolName || data.schoolName.trim().length < 2) {
      setSubdomainSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      setSubdomainSuggestionsLoading(true);
      try {
        const res = await fetch(`/api/onboarding/subdomain/suggest?schoolName=${encodeURIComponent(data.schoolName.trim())}`);
        if (res.ok) {
          const json = await res.json();
          setSubdomainSuggestions(json.suggestions || []);
        } else {
          setSubdomainSuggestions([]);
        }
      } catch {
        setSubdomainSuggestions([]);
      } finally {
        setSubdomainSuggestionsLoading(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [data.schoolName, step]);

  // Vérifier la disponibilité du sous-domaine saisi (debounce)
  useEffect(() => {
    const raw = (data.preferredSubdomain || '').trim().toLowerCase();
    if (!raw) {
      setSubdomainCheckStatus('idle');
      return;
    }
    if (raw.length < 3) {
      setSubdomainCheckStatus('invalid');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(raw) || raw.startsWith('-') || raw.endsWith('-') || raw.includes('--')) {
      setSubdomainCheckStatus('invalid');
      return;
    }
    const t = setTimeout(async () => {
      setSubdomainCheckStatus('checking');
      try {
        const res = await fetch(`/api/onboarding/subdomain/check/${encodeURIComponent(raw)}`);
        const json = await res.json();
        if (json.available) setSubdomainCheckStatus('available');
        else if (json.error) setSubdomainCheckStatus('invalid');
        else setSubdomainCheckStatus('taken');
      } catch {
        setSubdomainCheckStatus('idle');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [data.preferredSubdomain]);

  // Gérer le compteur pour renvoyer l'OTP
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Vérifier les règles du mot de passe
  const checkPasswordRules = (password: string) => {
    if (!password) {
      return {
        minLength: false,
        hasLowercase: false,
        hasUppercase: false,
        hasNumbers: false,
        hasSpecialChars: false,
        hasThreeOfFour: false,
        noConsecutiveChars: false,
        isValid: false,
      };
    }

    const minLength = password.length >= 8;
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    // Vérifier qu'au moins 3 des 4 types sont présents
    const typeCount = [hasLowercase, hasUppercase, hasNumbers, hasSpecialChars].filter(Boolean).length;
    const hasThreeOfFour = typeCount >= 3;
    
    // Vérifier qu'il n'y a pas plus de 2 caractères identiques consécutifs
    const noConsecutiveChars = !/(.)\1{2,}/.test(password);
    
    const isValid = minLength && hasThreeOfFour && noConsecutiveChars;

    return {
      minLength,
      hasLowercase,
      hasUppercase,
      hasNumbers,
      hasSpecialChars,
      hasThreeOfFour,
      noConsecutiveChars,
      isValid,
    };
  };

  // Calculer la force du mot de passe
  const calculatePasswordStrength = (password: string) => {
    if (!password) {
      setPasswordStrength({ score: 0, label: '', color: 'gray' });
      return;
    }

    const rules = checkPasswordRules(password);
    
    // Calculer un score basé sur les règles
    let score = 0;
    if (rules.minLength) score++;
    if (rules.hasThreeOfFour) score++;
    if (rules.noConsecutiveChars) score++;
    if (rules.hasLowercase && rules.hasUppercase && rules.hasNumbers && rules.hasSpecialChars) score++;
    
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
      
      // Vérifier que le draft existe toujours (peut avoir expiré)
      if (data.draftId) {
        fetch(`/api/onboarding/draft?draftId=${data.draftId}`)
          .then(res => {
            if (!res.ok && res.status === 404) {
              setErrors({ 
                submit: 'Votre session d\'inscription a expiré (4 heures d\'inactivité). Veuillez recommencer depuis l\'étape 1.' 
              });
            }
          })
          .catch(() => {
            // Ignorer les erreurs de réseau silencieusement
          });
      }
    }
  }, [data.password, step, data.draftId]);

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

  const calculatePrices = async () => {
    if (!data.planCode) {
      return;
    }

    setPriceCalculation(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Calculer les prix pour les deux périodes en parallèle
      const [monthlyResponse, yearlyResponse] = await Promise.all([
        fetch('/api/public/pricing/calculate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            planCode: data.planCode,
            schoolsCount: data.schoolsCount,
            bilingual: data.bilingual,
            cycle: 'MONTHLY',
          }),
        }),
        fetch('/api/public/pricing/calculate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            planCode: data.planCode,
            schoolsCount: data.schoolsCount,
            bilingual: data.bilingual,
            cycle: 'YEARLY',
          }),
        }),
      ]);

      // Traiter la réponse mensuelle
      let monthlyData = null;
      if (monthlyResponse.ok) {
        const monthlyResult = await monthlyResponse.json();
        const monthlyBreakdown = monthlyResult.breakdown || {};
        monthlyData = {
          basePrice: monthlyBreakdown.basePrice || 0,
          bilingualPrice: monthlyBreakdown.bilingualPrice || 0,
          total: monthlyResult.amount || 0,
        };
      }

      // Traiter la réponse annuelle
      let yearlyData = null;
      if (yearlyResponse.ok) {
        const yearlyResult = await yearlyResponse.json();
        const yearlyBreakdown = yearlyResult.breakdown || {};
        yearlyData = {
          basePrice: yearlyBreakdown.basePrice || 0,
          bilingualPrice: yearlyBreakdown.bilingualPrice || 0,
          total: yearlyResult.amount || 0,
        };
      }

      // Vérifier les erreurs
      if (!monthlyResponse.ok || !yearlyResponse.ok) {
        const error = await (monthlyResponse.ok ? yearlyResponse : monthlyResponse).json();
        throw new Error(error.message || 'Erreur lors du calcul des prix');
      }

      setPriceCalculation({
        monthly: monthlyData,
        yearly: yearlyData,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Error calculating prices:', error);
      setPriceCalculation(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Erreur lors du calcul des prix',
      }));
    }
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
      if (data.schoolsCount < 1 || data.schoolsCount > 4) {
        newErrors.schoolsCount = 'Le nombre d\'écoles doit être entre 1 et 4';
      }
      const sub = (data.preferredSubdomain || '').trim();
      if (sub) {
        if (subdomainCheckStatus === 'checking') {
          newErrors.preferredSubdomain = 'Vérification du sous-domaine en cours...';
        } else if (subdomainCheckStatus === 'taken') {
          newErrors.preferredSubdomain = 'Ce sous-domaine est déjà utilisé. Choisissez-en un autre.';
        } else if (subdomainCheckStatus === 'invalid' || (sub.length > 0 && sub.length < 3)) {
          newErrors.preferredSubdomain = 'Sous-domaine invalide (min. 3 caractères, lettres minuscules, chiffres, tirets).';
        }
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
      if (!data.password) {
        newErrors.password = 'Le mot de passe est requis';
      } else {
        const passwordRules = checkPasswordRules(data.password);
        
        if (!passwordRules.minLength) {
        newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères';
        } else if (!passwordRules.hasThreeOfFour) {
          newErrors.password = 'Le mot de passe doit contenir au moins 3 des 4 types suivants : minuscules, majuscules, chiffres, caractères spéciaux';
        } else if (!passwordRules.noConsecutiveChars) {
          newErrors.password = 'Le mot de passe ne doit pas contenir plus de 2 caractères identiques consécutifs';
        }
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

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors({ logo: 'Le fichier est trop volumineux. Taille maximale : 5MB' });
      return;
    }

    // Vérifier le type
    if (!file.type.startsWith('image/')) {
      setErrors({ logo: 'Format invalide. Seules les images sont acceptées' });
      return;
    }

    setIsUploadingLogo(true);
    setErrors({ logo: '' });

    try {
      // Créer un aperçu du logo
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Si on a déjà un draftId, uploader immédiatement
      if (data.draftId) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('draftId', data.draftId);

        const response = await fetch('/api/onboarding/upload-logo', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Erreur lors de l\'upload du logo');
        }

        const result = await response.json();
        handleChange('logoUrl', result.logoUrl);
      }
      // Sinon, le logo sera uploadé après la création du draft dans handleNext
    } catch (error: any) {
      setErrors({ logo: error.message || 'Erreur lors de l\'upload du logo' });
      setLogoPreview(null);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    handleChange('logoUrl', undefined);
    // Réinitialiser l'input file
    const fileInput = document.getElementById('logo-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleNext = async () => {
    if (!validateStep(step)) {
      return;
    }

    if (step === 1) {
      // Si un draft existe déjà, passer directement à l'étape suivante
      if (data.draftId) {
        setStep(2);
        return;
      }

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
            preferredSubdomain: (data.preferredSubdomain || '').trim() || undefined,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('❌ [Onboarding Draft] Error response:', error);
          
          // Si un draft existe déjà, afficher une modal de choix
          const errorMsg = error.message || error.data?.message || '';
          if (errorMsg.includes('déjà en cours')) {
            // Vérifier si l'ID du draft existant est dans l'erreur
            const existingDraftId = error.existingDraftId || error.data?.existingDraftId;
            const existingDraftStatus = error.status || error.data?.status;
            
            if (existingDraftId) {
              console.log('📝 [Onboarding Draft] Draft existant trouvé, affichage de la modal de choix...', existingDraftId);
              try {
                // Charger les données du draft existant pour les afficher dans la modal
                const existingDraftResponse = await fetch(`/api/onboarding/draft?draftId=${existingDraftId}`);
                if (existingDraftResponse.ok) {
                  const existingDraft = await existingDraftResponse.json();
                  setExistingDraftInfo({
                    id: existingDraftId,
                    status: existingDraftStatus || existingDraft.status,
                    data: existingDraft,
                  });
                  setShowDraftChoiceModal(true);
                  setIsSubmitting(false);
                  return; // Ne pas lancer d'erreur, afficher la modal
                }
              } catch (loadError) {
                console.error('❌ [Onboarding Draft] Erreur lors du chargement du draft existant:', loadError);
              }
            }
          }
          
          // Afficher le message d'erreur du backend ou un message par défaut
          const errorMessage = error.message || error.error || 'Erreur lors de la création du draft';
          throw new Error(errorMessage);
        }

        const result = await response.json();
        const newDraftId = result.id;
        const updatedData = { ...data, draftId: newDraftId };
        setData(updatedData);
        
        // Si un logo a été sélectionné mais pas encore uploadé, l'uploader maintenant
        if (logoPreview && !data.logoUrl) {
          const fileInput = document.getElementById('logo-upload') as HTMLInputElement;
          const file = fileInput?.files?.[0];
          if (file) {
            try {
              const formData = new FormData();
              formData.append('file', file);
              formData.append('draftId', newDraftId);

              const logoResponse = await fetch('/api/onboarding/upload-logo', {
                method: 'POST',
                body: formData,
              });

              if (logoResponse.ok) {
                const logoResult = await logoResponse.json();
                const finalData = { ...updatedData, logoUrl: logoResult.logoUrl };
                setData(finalData);
                updatedData.logoUrl = logoResult.logoUrl;
              }
            } catch (logoError) {
              console.error('Erreur lors de l\'upload du logo:', logoError);
              // Ne pas bloquer le workflow si l'upload du logo échoue
            }
          }
        }
        
        // Sauvegarder dans localStorage
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('onboarding-draft', JSON.stringify({
              data: updatedData,
              timestamp: Date.now(),
            }));
          } catch (error) {
            console.error('Error saving draft to localStorage:', error);
          }
        }
        
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

    if (!data.draftId) {
      setErrors({ submit: 'Draft ID manquant. Veuillez compléter l\'étape précédente.' });
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    
    try {
      // Normaliser le numéro de téléphone
      const normalizedPhone = normalizePhoneNumber(data.promoterPhone, data.country);
      
      const response = await fetch('/api/onboarding/otp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: data.draftId,
          phone: normalizedPhone,
          method: otpMethod,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.message || 'Erreur lors de l\'envoi du code OTP';
        // Si le draft n'existe pas, suggérer de recommencer
        if (errorMessage.includes('introuvable') || errorMessage.includes('expiré') || response.status === 404) {
          throw new Error(`${errorMessage} Veuillez retourner à l'étape 1 pour créer un nouveau draft.`);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // En mode développement, afficher le code OTP
      if (result.code) {
        setOtpCode(result.code);
      }
      
      // Définir l'expiration depuis la réponse du backend
      if (result.expiresAt) {
        setOtpExpiresAt(new Date(result.expiresAt));
      } else {
        // Fallback : 3 minutes par défaut
        setOtpExpiresAt(new Date(Date.now() + 3 * 60 * 1000));
      }
      
      setOtpSent(true);
      setOtpVerified(false); // Réinitialiser la vérification
      setData({ ...data, otp: '' }); // Réinitialiser le champ OTP
      setResendCooldown(30); // Démarrer le compteur de 30 secondes
      setErrors({});
    } catch (error: any) {
      setErrors({ otp: error.message || 'Erreur lors de l\'envoi du code OTP' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!data.otp || data.otp.length !== 6) {
      setErrors({ otp: 'Le code OTP doit contenir 6 chiffres' });
      return;
    }

    if (!data.draftId) {
      setErrors({ submit: 'Draft ID manquant' });
      return;
    }

    // Vérifier si l'OTP n'a pas expiré
    if (otpExpiresAt && new Date() > otpExpiresAt) {
      setErrors({ otp: 'Le code OTP a expiré. Veuillez en demander un nouveau.' });
      setOtpSent(false);
      setOtpExpiresAt(null);
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    
    try {
      // Normaliser le numéro de téléphone
      const normalizedPhone = normalizePhoneNumber(data.promoterPhone, data.country);
      
      const response = await fetch('/api/onboarding/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: data.draftId,
          phone: normalizedPhone,
          code: data.otp,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Code OTP invalide');
      }

      const result = await response.json();
      
      if (result.valid) {
        setOtpVerified(true);
        setErrors({});
      } else {
        throw new Error(result.message || 'Code OTP invalide ou expiré');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Code OTP invalide';
      setErrors({ otp: errorMessage });
      setOtpVerified(false);
      
      // Si le code est invalide ou expiré, réinitialiser l'état pour permettre un nouvel envoi
      if (errorMessage.includes('invalide') || errorMessage.includes('expiré')) {
        setOtpSent(false);
        setOtpExpiresAt(null);
        setOtpCode(null);
        setData({ ...data, otp: '' }); // Réinitialiser le champ OTP
        setResendCooldown(0); // Réinitialiser le compteur
      }
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
    setErrors({});
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
      
      // ⚠️ Mettre à jour le montant affiché avec la valeur réelle du backend
      // Priorité : amount depuis result, puis checkout.transaction.amount, puis initialPayment existant
      if (result.amount) {
        setInitialPayment(result.amount);
      } else if (result.checkout?.transaction?.amount) {
        setInitialPayment(result.checkout.transaction.amount);
      }
      
      // Toujours ouvrir en pleine page pour éviter le checkout intégré tronqué (scroll)
      const paymentPageUrl = result.paymentUrl ?? result.payment_url;
      if (paymentPageUrl) {
        window.location.href = paymentPageUrl;
        return;
      }
      const hasCheckout = result.checkout && (result.checkout.public_key ?? result.checkout.publicKey);
      if (hasCheckout) {
        setCheckoutData({
          ...result.checkout,
          public_key: result.checkout.public_key ?? result.checkout.publicKey,
          transactionId: result.checkout.transactionId,
          paymentId: result.paymentId,
        });
        setShowCheckout(true);
        setIsSubmitting(false);
      } else {
        throw new Error('Données de paiement non reçues');
      }
    } catch (error: any) {
      setErrors({ submit: error.message });
      setIsSubmitting(false);
    }
  };

  const handlePaymentComplete = async (transactionData: any) => {
    console.log('📥 Callback FedaPay reçu:', transactionData);
    
    // ⚠️ CRITIQUE : Ne pas faire confiance au callback frontend
    // Vérifier le statut réel depuis le backend qui interroge FedaPay
    if (!data.draftId) {
      setErrors({ submit: 'Draft ID manquant' });
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // Récupérer le paymentId depuis les données du checkout
      const paymentId = checkoutData?.paymentId;

      if (!paymentId) {
        // Si pas de paymentId, récupérer depuis le draft
        const response = await fetch(`/api/onboarding/draft/${data.draftId}`);
        if (response.ok) {
          const draft = await response.json();
          const payments = draft.payments || [];
          const lastPayment = payments[payments.length - 1];
          if (lastPayment) {
            await verifyPaymentStatus(lastPayment.id);
            return;
          }
        }
        throw new Error('Payment ID introuvable');
      }

      await verifyPaymentStatus(paymentId);
    } catch (error: any) {
      console.error('❌ Erreur lors de la vérification du paiement:', error);
      setErrors({ submit: error.message || 'Erreur lors de la vérification du paiement' });
      setIsSubmitting(false);
    }
  };

  const verifyPaymentStatus = async (paymentId: string) => {
    try {
      // Appeler le backend pour vérifier le statut réel depuis FedaPay
      const response = await fetch(`/api/onboarding/payment/${paymentId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur lors de la vérification du paiement');
      }

      const result = await response.json();
      
      console.log('✅ Statut du paiement vérifié:', result);

      if (result.status === 'SUCCESS' || result.tenantActivated) {
        // Paiement confirmé par le backend, rediriger vers la page de succès
        const frontendUrl = typeof window !== 'undefined' ? window.location.origin : '';
        let callbackUrl = `${frontendUrl}/onboarding/callback?draftId=${data.draftId}&paymentId=${paymentId}&status=success`;
        if (result.firstTenantSubdomain) {
          callbackUrl += `&subdomain=${encodeURIComponent(result.firstTenantSubdomain)}`;
        }
        window.location.href = callbackUrl;
      } else if (result.status === 'PENDING' || result.status === 'PROCESSING') {
        // Le paiement est en cours, attendre un peu et réessayer
        setTimeout(() => {
          verifyPaymentStatus(paymentId);
        }, 3000); // Réessayer après 3 secondes
      } else {
        // Paiement échoué ou annulé
        setErrors({ submit: 'Le paiement n\'a pas été confirmé. Veuillez réessayer.' });
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error('❌ Erreur lors de la vérification du paiement:', error);
      setErrors({ submit: error.message || 'Erreur lors de la vérification du paiement' });
      setIsSubmitting(false);
    }
  };

  const handlePaymentError = (error: any) => {
    console.error('❌ Erreur de paiement:', error);
    setErrors({ submit: error.message || 'Erreur lors du paiement. Veuillez réessayer.' });
    setShowCheckout(false);
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setErrors({});
    }
  };

  // Fonction helper pour obtenir les infos de progression
  const getProgressInfo = (draft: any) => {
    if (draft.promoterEmail && draft.selectedPlanId) {
      return { step: 4, label: 'Prêt pour le paiement', progress: 100 };
    } else if (draft.promoterEmail) {
      return { step: 3, label: 'Plan à sélectionner', progress: 75 };
    } else if (draft.promoterFirstName) {
      return { step: 2, label: 'Informations promoteur incomplètes', progress: 50 };
    } else {
      return { step: 1, label: 'Informations établissement', progress: 25 };
    }
  };

  // Fonction helper pour vérifier si le draft expire bientôt
  const isExpiringSoon = (createdAt: string) => {
    if (!createdAt) return false;
    const hoursSinceCreation = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation > 20; // Avertir si moins de 4h restantes
  };

  // Restaurer le draft depuis la bannière
  const handleRestoreDraft = async () => {
    if (!pendingDraftInfo) return;
    
    try {
      // Recharger le draft depuis l'API pour avoir les données à jour
      const response = await fetch(`/api/onboarding/draft?draftId=${pendingDraftInfo.id}`);
      if (!response.ok) {
        throw new Error('Erreur lors du chargement du draft');
      }
      
      const existingDraft = await response.json();
      
      // Charger toutes les données du draft existant
      const updatedData = {
        ...data,
        draftId: existingDraft.id,
        // Phase 1: Établissement
        schoolName: existingDraft.schoolName || '',
        schoolType: existingDraft.schoolType || '',
        city: existingDraft.city || '',
        country: existingDraft.country || 'Bénin',
        phone: existingDraft.phone || '',
        email: existingDraft.email || '',
        bilingual: existingDraft.bilingual ?? false,
        schoolsCount: existingDraft.schoolsCount || 1,
        preferredSubdomain: existingDraft.preferredSubdomain || '',
        // Phase 2: Promoteur
        firstName: existingDraft.promoterFirstName || '',
        lastName: existingDraft.promoterLastName || '',
        promoterPhone: existingDraft.promoterPhone || '',
        promoterEmail: existingDraft.promoterEmail || '',
        // Phase 3: Plan (si disponible dans priceSnapshot)
        planCode: data.planCode,
        billingPeriod: data.billingPeriod,
      };
      
      // Si un plan a été sélectionné, extraire les infos du priceSnapshot
      if (existingDraft.selectedPlanId && existingDraft.priceSnapshot) {
        const priceSnapshot = existingDraft.priceSnapshot as any;
        if (priceSnapshot.periodType) {
          updatedData.billingPeriod = priceSnapshot.periodType === 'MONTHLY' ? 'monthly' : 'yearly';
        }
      }
      
      setData(updatedData);
      
      // Déterminer l'étape à afficher selon l'état du draft
      let targetStep = 1;
      if (existingDraft.promoterEmail && existingDraft.selectedPlanId) {
        targetStep = 4; // Promoteur + Plan sélectionné = Étape 4 (Paiement)
      } else if (existingDraft.promoterEmail) {
        targetStep = 3; // Promoteur renseigné = Étape 3 (Plan)
      } else if (existingDraft.promoterFirstName) {
        targetStep = 2; // Promoteur partiellement renseigné = Étape 2
      }
      
      setStep(targetStep);
      
      // Sauvegarder dans localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('onboarding-draft', JSON.stringify({
          data: updatedData,
          timestamp: Date.now(),
        }));
      }
      
      // Fermer la bannière
      setShowDraftRestoreBanner(false);
      setPendingDraftInfo(null);
      
      // Afficher un message informatif
      setErrors({
        info: `✅ Votre brouillon a été restauré. Vous êtes à l'étape ${targetStep} sur 4.`,
      });
    } catch (error) {
      console.error('Erreur lors de la restauration du draft:', error);
      setErrors({ submit: 'Erreur lors de la restauration du draft' });
    }
  };

  // Ignorer le draft et commencer une nouvelle inscription
  const handleStartNewDraft = () => {
    // Nettoyer localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('onboarding-draft');
    }
    
    // Réinitialiser le formulaire
    setData({
      schoolName: '',
      schoolType: '',
      city: '',
      country: 'Bénin',
      phone: '',
      email: '',
      bilingual: false,
      schoolsCount: 1,
      preferredSubdomain: '',
      firstName: '',
      lastName: '',
      promoterPhone: '',
      promoterEmail: '',
      password: '',
      confirmPassword: '',
      otp: '',
      planCode: 'BASIC_MONTHLY',
      billingPeriod: 'monthly',
    });

    setSubdomainSuggestions([]);
    setSubdomainCheckStatus('idle');
    setStep(1);
    setErrors({});
    setShowDraftRestoreBanner(false);
    setPendingDraftInfo(null);
  };

  // Gérer le choix de l'utilisateur pour le draft existant
  const handleContinueWithExistingDraft = async () => {
    if (!existingDraftInfo) return;
    
    try {
      // Recharger le draft depuis l'API pour avoir les données à jour
      const response = await fetch(`/api/onboarding/draft?draftId=${existingDraftInfo.id}`);
      if (!response.ok) {
        throw new Error('Erreur lors du chargement du draft');
      }
      
      const existingDraft = await response.json();
      
      // Charger toutes les données du draft existant
      const updatedData = {
        ...data,
        draftId: existingDraft.id,
        // Phase 1: Établissement
        schoolName: existingDraft.schoolName || data.schoolName,
        schoolType: existingDraft.schoolType || data.schoolType,
        city: existingDraft.city || data.city,
        country: existingDraft.country || data.country,
        phone: existingDraft.phone || data.phone,
        email: existingDraft.email || data.email,
        bilingual: existingDraft.bilingual ?? data.bilingual,
        schoolsCount: existingDraft.schoolsCount || data.schoolsCount,
        preferredSubdomain: existingDraft.preferredSubdomain || data.preferredSubdomain || '',
        // Phase 2: Promoteur
        firstName: existingDraft.promoterFirstName || data.firstName,
        lastName: existingDraft.promoterLastName || data.lastName,
        promoterPhone: existingDraft.promoterPhone || data.promoterPhone,
        promoterEmail: existingDraft.promoterEmail || data.promoterEmail,
        // Phase 3: Plan (si disponible dans priceSnapshot)
        planCode: data.planCode, // Garder le planCode actuel ou le calculer
        billingPeriod: data.billingPeriod, // Garder la période actuelle
      };
      
      // Si un plan a été sélectionné, extraire les infos du priceSnapshot
      if (existingDraft.selectedPlanId && existingDraft.priceSnapshot) {
        const priceSnapshot = existingDraft.priceSnapshot as any;
        if (priceSnapshot.cycle) {
          updatedData.billingPeriod = priceSnapshot.cycle === 'MONTHLY' ? 'monthly' : 'yearly';
        }
      }
      
      setData(updatedData);
      
      // Déterminer l'étape à afficher selon l'état du draft
      let targetStep = 1;
      if (existingDraft.promoterEmail && existingDraft.selectedPlanId) {
        targetStep = 4; // Promoteur + Plan sélectionné = Étape 4 (Paiement)
      } else if (existingDraft.promoterEmail) {
        targetStep = 3; // Promoteur renseigné = Étape 3 (Plan)
      } else if (existingDraft.promoterFirstName) {
        targetStep = 2; // Promoteur partiellement renseigné = Étape 2
      }
      
      setStep(targetStep);
      
      // Sauvegarder dans localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('onboarding-draft', JSON.stringify({
          data: updatedData,
          timestamp: Date.now(),
        }));
      }
      
      // Afficher un message informatif
      setErrors({
        info: `✅ Votre brouillon a été restauré. Vous êtes à l'étape ${targetStep} sur 4.`,
      });
      
      setShowDraftChoiceModal(false);
      setExistingDraftInfo(null);
    } catch (error) {
      console.error('Erreur lors du chargement du draft existant:', error);
      setErrors({ submit: 'Erreur lors du chargement du draft existant' });
    }
  };

  const handleCancelExistingDraft = () => {
    if (!existingDraftInfo) return;
    // Afficher la modal de confirmation au lieu de window.confirm()
    setShowDeleteConfirmModal(true);
  };

  const handleConfirmDeleteDraft = async () => {
    if (!existingDraftInfo) return;
    
    setShowDeleteConfirmModal(false);
    setIsSubmitting(true);
    try {
      // Supprimer le draft existant
      const deleteResponse = await fetch(`/api/onboarding/draft/${existingDraftInfo.id}`, {
        method: 'POST',
      });

      if (!deleteResponse.ok) {
        throw new Error('Erreur lors de la suppression du draft existant');
      }

      // Créer un nouveau draft avec les données actuelles
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
          preferredSubdomain: (data.preferredSubdomain || '').trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur lors de la création du draft');
      }

      const result = await response.json();
      const updatedData = { ...data, draftId: result.id };
      setData(updatedData);
      
      setShowDraftChoiceModal(false);
      setExistingDraftInfo(null);
    } catch (error: any) {
      console.error('Erreur lors de l\'annulation du draft:', error);
      setErrors({ submit: error.message || 'Erreur lors de l\'annulation du draft existant' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50" style={{ marginTop: 0, paddingTop: 0 }}>
      {/* Progress Bar */}
      <div className="bg-white border-b border-blue-100 shadow-sm" style={{ marginTop: 0, paddingTop: 0 }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-4" style={{ paddingTop: 0 }}>
          {/* Titre centré */}
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold text-blue-900">Création de votre école sur Academia Helm</h1>
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

                {/* Sous-domaine personnalisé */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Sous-domaine de votre espace <span className="text-gray-500 text-xs">(optionnel)</span>
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    Votre espace sera accessible à <strong>votre-sous-domaine.academia-hub.pro</strong>. Choisissez une proposition ou saisissez le vôtre (lettres minuscules, chiffres, tirets).
                  </p>
                  <input
                    type="text"
                    value={data.preferredSubdomain || ''}
                    onChange={(e) => {
                      const v = e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, '-')
                        .replace(/-+/g, '-')
                        .replace(/^-|-$/g, '');
                      handleChange('preferredSubdomain', v);
                    }}
                    placeholder="Ex: mon-ecole"
                    className={`w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-blue-600 focus:border-blue-600 ${
                      errors.preferredSubdomain ? 'border-red-500' : subdomainCheckStatus === 'taken' || subdomainCheckStatus === 'invalid' ? 'border-amber-500' : 'border-gray-300'
                    }`}
                  />
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {subdomainCheckStatus === 'checking' && (
                      <span className="text-sm text-slate-500 flex items-center gap-1">
                        <Loader className="w-4 h-4 animate-spin" /> Vérification...
                      </span>
                    )}
                    {subdomainCheckStatus === 'available' && (data.preferredSubdomain || '').trim().length >= 3 && (
                      <span className="text-sm text-green-600 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Disponible
                      </span>
                    )}
                    {subdomainCheckStatus === 'taken' && (
                      <span className="text-sm text-red-600 flex items-center gap-1">
                        <X className="w-4 h-4" /> Déjà utilisé
                      </span>
                    )}
                    {subdomainCheckStatus === 'invalid' && (data.preferredSubdomain || '').trim().length > 0 && (
                      <span className="text-sm text-amber-600">Min. 3 caractères, lettres minuscules, chiffres ou tirets</span>
                    )}
                  </div>
                  {subdomainSuggestions.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-700 mb-2">Propositions :</p>
                      <div className="flex flex-wrap gap-2">
                        {subdomainSuggestions.map((s) => (
                          <button
                            key={s.subdomain}
                            type="button"
                            onClick={() => handleChange('preferredSubdomain', s.subdomain)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors ${
                              data.preferredSubdomain === s.subdomain
                                ? 'bg-blue-100 border-blue-600 text-blue-900'
                                : s.available
                                  ? 'bg-green-50 border-green-300 text-green-800 hover:bg-green-100'
                                  : 'bg-slate-50 border-slate-300 text-slate-600'
                            }`}
                          >
                            {s.available ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-slate-400" />}
                            <span>{s.subdomain}</span>
                            {s.available ? <span className="text-xs">Choisir</span> : <span className="text-xs">Indisponible</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {subdomainSuggestionsLoading && subdomainSuggestions.length === 0 && data.schoolName.trim().length >= 2 && (
                    <p className="mt-2 text-sm text-slate-500 flex items-center gap-1">
                      <Loader className="w-4 h-4 animate-spin" /> Chargement des propositions...
                    </p>
                  )}
                  {errors.preferredSubdomain && (
                    <p className="mt-1 text-sm text-red-600">{errors.preferredSubdomain}</p>
                  )}
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

                {/* Upload Logo */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Logo de l'établissement <span className="text-gray-500 text-xs">(optionnel)</span>
                  </label>
                  <div className="space-y-3">
                    {logoPreview || data.logoUrl ? (
                      <div className="relative inline-block">
                        <img
                          src={logoPreview || data.logoUrl}
                          alt="Logo preview"
                          className="h-32 w-32 object-contain border-2 border-gray-300 rounded-lg p-2 bg-white"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                          aria-label="Supprimer le logo"
                        >
                          <XIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor="logo-upload"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 text-gray-400 mb-2" />
                          <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Cliquez pour uploader</span> ou glissez-déposez
                          </p>
                          <p className="text-xs text-gray-500">PNG, JPG, GIF jusqu'à 5MB</p>
                        </div>
                        <input
                          id="logo-upload"
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={isUploadingLogo}
                        />
                      </label>
                    )}
                    {isUploadingLogo && (
                      <div className="flex items-center gap-2 text-sm text-blue-600">
                        <Loader className="w-4 h-4 animate-spin" />
                        Upload en cours...
                      </div>
                    )}
                    {errors.logo && (
                      <p className="text-sm text-red-600">{errors.logo}</p>
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
                    <option value={3}>3 écoles</option>
                    <option value={4}>4 écoles</option>
                  </select>
                  {errors.schoolsCount && (
                    <p className="mt-1 text-sm text-red-600">{errors.schoolsCount}</p>
                  )}
                </div>
              </div>

              {errors.info && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">{errors.info}</p>
                </div>
              )}
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

              {/* Bannière de restauration du draft - Affichée en bas après le bouton Continuer */}
              {showDraftRestoreBanner && pendingDraftInfo && step === 1 && (
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
                  <div className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <RotateCcw className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-blue-900 mb-1">
                            Un brouillon d'inscription a été trouvé
                          </p>
                          <div className="text-xs text-blue-700 space-y-1">
                            {pendingDraftInfo.data?.schoolName && (
                              <p className="break-words">
                                <span className="font-medium">Établissement :</span>{' '}
                                <strong className="break-all">{pendingDraftInfo.data.schoolName}</strong>
                              </p>
                            )}
                            {pendingDraftInfo.data?.createdAt && (
                              <p>
                                <span className="font-medium">Créé le</span>{' '}
                                {new Date(pendingDraftInfo.data.createdAt).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={handleRestoreDraft}
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
                        >
                          Restaurer
                        </button>
                        <button
                          onClick={handleStartNewDraft}
                          className="px-4 py-2 bg-white text-blue-600 text-sm font-semibold rounded-md border border-blue-300 hover:bg-blue-50 transition-colors whitespace-nowrap"
                        >
                          Nouveau
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
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
                  
                  {/* Règles du mot de passe - Afficher tant que le champ est focus OU le mot de passe n'est pas valide */}
                  {data.password && (passwordFocused || !checkPasswordRules(data.password).isValid) && (
                    <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">
                        Votre mot de passe doit contenir :
                      </h4>
                      <ul className="space-y-2">
                        {/* Règle 1: Longueur minimale */}
                        <li className="flex items-start">
                          {checkPasswordRules(data.password).minLength ? (
                            <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XIcon className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                          )}
                          <span className={`text-sm ${checkPasswordRules(data.password).minLength ? 'text-gray-900' : 'text-red-600'}`}>
                            Au moins 8 caractères
                          </span>
                        </li>
                        
                        {/* Règle 2: Au moins 3 des 4 types */}
                        <li className="flex items-start">
                          {checkPasswordRules(data.password).hasThreeOfFour ? (
                            <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XIcon className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                          )}
                          <span className={`text-sm ${checkPasswordRules(data.password).hasThreeOfFour ? 'text-gray-900' : 'text-red-600'}`}>
                            Au moins 3 des éléments suivants :
                          </span>
                        </li>
                        
                        {/* Sous-liste des types */}
                        <li className="ml-7 space-y-1.5">
                          <div className="flex items-start">
                            {checkPasswordRules(data.password).hasLowercase ? (
                              <CheckCircle className="w-4 h-4 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XIcon className="w-4 h-4 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                            )}
                            <span className={`text-xs ${checkPasswordRules(data.password).hasLowercase ? 'text-gray-900' : 'text-red-600'}`}>
                              Lettres minuscules (a-z)
                            </span>
                        </div>
                          <div className="flex items-start">
                            {checkPasswordRules(data.password).hasUppercase ? (
                              <CheckCircle className="w-4 h-4 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XIcon className="w-4 h-4 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                            )}
                            <span className={`text-xs ${checkPasswordRules(data.password).hasUppercase ? 'text-gray-900' : 'text-red-600'}`}>
                              Lettres majuscules (A-Z)
                        </span>
                      </div>
                          <div className="flex items-start">
                            {checkPasswordRules(data.password).hasNumbers ? (
                              <CheckCircle className="w-4 h-4 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XIcon className="w-4 h-4 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                            )}
                            <span className={`text-xs ${checkPasswordRules(data.password).hasNumbers ? 'text-gray-900' : 'text-red-600'}`}>
                              Chiffres (0-9)
                            </span>
                    </div>
                          <div className="flex items-start">
                            {checkPasswordRules(data.password).hasSpecialChars ? (
                              <CheckCircle className="w-4 h-4 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XIcon className="w-4 h-4 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                            )}
                            <span className={`text-xs ${checkPasswordRules(data.password).hasSpecialChars ? 'text-gray-900' : 'text-red-600'}`}>
                              Caractères spéciaux (e.g. !@#$%^&*)
                            </span>
                          </div>
                        </li>
                        
                        {/* Règle 3: Pas plus de 2 caractères identiques consécutifs */}
                        <li className="flex items-start">
                          {checkPasswordRules(data.password).noConsecutiveChars ? (
                            <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XIcon className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                          )}
                          <span className={`text-sm ${checkPasswordRules(data.password).noConsecutiveChars ? 'text-gray-900' : 'text-red-600'}`}>
                            Pas plus de 2 caractères identiques consécutifs
                          </span>
                        </li>
                      </ul>
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
                  
                  {/* Sélecteur de méthode d'envoi */}
                  {!otpSent && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Méthode d'envoi
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {/* Option SMS */}
                        <button
                          type="button"
                          onClick={() => setOtpMethod('sms')}
                          className={`flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-all duration-200 ${
                            otpMethod === 'sms'
                              ? 'border-blue-600 bg-blue-50 shadow-md'
                              : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'
                          }`}
                          aria-label="Envoyer le code par SMS"
                        >
                          <MessageSquare
                            className={`w-6 h-6 mb-2 ${
                              otpMethod === 'sms' ? 'text-blue-600' : 'text-gray-600'
                            }`}
                          />
                          <span
                            className={`text-sm font-medium ${
                              otpMethod === 'sms' ? 'text-blue-900' : 'text-gray-700'
                            }`}
                          >
                            SMS
                          </span>
                        </button>

                        {/* Option Appel vocal */}
                        <button
                          type="button"
                          onClick={() => setOtpMethod('voice')}
                          className={`flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-all duration-200 ${
                            otpMethod === 'voice'
                              ? 'border-blue-600 bg-blue-50 shadow-md'
                              : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'
                          }`}
                          aria-label="Envoyer le code par appel vocal"
                        >
                          <Phone
                            className={`w-6 h-6 mb-2 ${
                              otpMethod === 'voice' ? 'text-blue-600' : 'text-gray-600'
                            }`}
                          />
                          <span
                            className={`text-sm font-medium ${
                              otpMethod === 'voice' ? 'text-blue-900' : 'text-gray-700'
                            }`}
                          >
                            Appel
                          </span>
                        </button>

                        {/* Option WhatsApp */}
                        <button
                          type="button"
                          onClick={() => setOtpMethod('whatsapp')}
                          className={`flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-all duration-200 ${
                            otpMethod === 'whatsapp'
                              ? 'border-blue-600 bg-blue-50 shadow-md'
                              : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'
                          }`}
                          aria-label="Envoyer le code par WhatsApp"
                        >
                          <svg
                            className="w-6 h-6 mb-2"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
                              fill={otpMethod === 'whatsapp' ? '#25D366' : '#6B7280'}
                            />
                          </svg>
                          <span
                            className={`text-sm font-medium ${
                              otpMethod === 'whatsapp' ? 'text-blue-900' : 'text-gray-700'
                            }`}
                          >
                            WhatsApp
                          </span>
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-gray-500 text-center">
                        {otpMethod === 'sms' && 'Le code sera envoyé par SMS'}
                        {otpMethod === 'voice' && 'Le code sera dicté lors d\'un appel vocal'}
                        {otpMethod === 'whatsapp' && 'Le code sera envoyé par WhatsApp'}
                      </p>
                    </div>
                  )}

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
                        {otpMethod === 'sms' && 'Code OTP envoyé par SMS. Vérifiez votre téléphone.'}
                        {otpMethod === 'voice' && 'Appel vocal en cours. Répondez à l\'appel pour entendre le code.'}
                        {otpMethod === 'whatsapp' && 'Code OTP envoyé par WhatsApp. Vérifiez votre téléphone.'}
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
                        <div className="text-sm text-slate-600">
                          Code valide jusqu'à {new Date(otpExpiresAt).toLocaleTimeString('fr-FR')}
                        </div>
                      )}
                      {/* Bouton pour renvoyer le code */}
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-600 mb-2">
                          Vous n'avez pas reçu le code ?
                        </p>
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={isSubmitting || resendCooldown > 0}
                          className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-blue-900 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <RotateCcw className={`w-4 h-4 mr-2 ${resendCooldown > 0 ? 'animate-spin' : ''}`} />
                          {resendCooldown > 0 ? (
                            <span>Renvoyer le code dans {resendCooldown}s</span>
                          ) : (
                            <span>Renvoyer le code</span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {errors.info && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">{errors.info}</p>
                </div>
              )}
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
            <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-8">
              {/* En-tête avec icône et titre */}
              <div className="flex items-center mb-2">
                <div className="p-3 bg-blue-900 rounded-lg mr-4">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div>
                <h2 className="text-3xl font-bold text-blue-900">Plan & Options</h2>
                  <p className="text-sm text-graphite-700 mt-1">Choisissez votre plan d'abonnement</p>
              </div>
              </div>
              
              <div className="mt-8 space-y-8">
                {/* Section 1: Période de facturation - Design premium avec cartes */}
                <div className="bg-gradient-to-br from-blue-50 to-mist rounded-xl p-6 border border-blue-200">
                  <div className="flex items-center mb-5">
                    <Calendar className="w-5 h-5 text-blue-700 mr-2" />
                    <label className="text-base font-semibold text-blue-900">
                    Période de facturation
                  </label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => handleChange('billingPeriod', 'monthly')}
                      className={`relative p-6 border-2 rounded-xl text-left transition-all duration-300 transform ${
                        data.billingPeriod === 'monthly'
                          ? 'border-blue-700 bg-white shadow-lg scale-105'
                          : 'border-gray-300 bg-white hover:border-blue-400 hover:shadow-md'
                      }`}
                    >
                      {data.billingPeriod === 'monthly' && (
                        <div className="absolute -top-2 -right-2 bg-blue-700 text-white text-xs font-semibold px-2 py-1 rounded-full">
                          Sélectionné
                      </div>
                      )}
                      <div className="flex items-center mb-3">
                        <div className={`p-2 rounded-lg mr-3 ${
                          data.billingPeriod === 'monthly' ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <Calendar className={`w-4 h-4 ${
                            data.billingPeriod === 'monthly' ? 'text-blue-700' : 'text-gray-600'
                          }`} />
                        </div>
                        <div className="font-semibold text-lg text-blue-900">Mensuel</div>
                      </div>
                      {priceCalculation.isLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader className="w-4 h-4 animate-spin text-blue-600" />
                          <span className="text-sm text-graphite-600">Calcul en cours...</span>
                        </div>
                      ) : priceCalculation.error ? (
                        <div className="text-sm text-red-600">{priceCalculation.error}</div>
                      ) : priceCalculation.monthly ? (
                        <>
                          <div className="text-3xl font-bold text-blue-900 mb-1">
                            {priceCalculation.monthly.basePrice.toLocaleString()} FCFA
                          </div>
                          <div className="text-sm text-graphite-600">/ mois</div>
                        </>
                      ) : (
                        <div className="text-sm text-graphite-600">Chargement...</div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleChange('billingPeriod', 'yearly')}
                      className={`relative p-6 border-2 rounded-xl text-left transition-all duration-300 transform ${
                        data.billingPeriod === 'yearly'
                          ? 'border-blue-700 bg-white shadow-lg scale-105'
                          : 'border-gray-300 bg-white hover:border-blue-400 hover:shadow-md'
                      }`}
                    >
                      {data.billingPeriod === 'yearly' && (
                        <div className="absolute -top-2 -right-2 bg-blue-700 text-white text-xs font-semibold px-2 py-1 rounded-full">
                          Sélectionné
                      </div>
                      )}
                      <div className="flex items-center mb-3">
                        <div className={`p-2 rounded-lg mr-3 ${
                          data.billingPeriod === 'yearly' ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <Calendar className={`w-4 h-4 ${
                            data.billingPeriod === 'yearly' ? 'text-blue-700' : 'text-gray-600'
                          }`} />
                        </div>
                        <div className="font-semibold text-lg text-blue-900">Annuel</div>
                      </div>
                      {priceCalculation.isLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader className="w-4 h-4 animate-spin text-blue-600" />
                          <span className="text-sm text-graphite-600">Calcul en cours...</span>
                        </div>
                      ) : priceCalculation.error ? (
                        <div className="text-sm text-red-600">{priceCalculation.error}</div>
                      ) : priceCalculation.yearly ? (
                        <>
                          <div className="text-3xl font-bold text-blue-900 mb-1">
                            {priceCalculation.yearly.basePrice.toLocaleString()} FCFA
                          </div>
                          <div className="text-sm text-graphite-600 mb-2">/ an</div>
                          {priceCalculation.monthly && (
                            <div className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-md">
                              <TrendingDown className="w-3 h-3" />
                              Économisez {((priceCalculation.monthly.basePrice * 12 - priceCalculation.yearly.basePrice) / (priceCalculation.monthly.basePrice * 12) * 100).toFixed(0)}%
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-graphite-600">Chargement...</div>
                      )}
                    </button>
                  </div>
                </div>

                {/* Section 2: Option bilingue - Design distinctif avec icône */}
                {data.bilingual && (
                  <div className="bg-gradient-to-r from-gold-50 to-yellow-50 rounded-xl p-6 border-2 border-gold-400 shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="p-3 bg-gold-500 rounded-lg mr-4">
                          <Languages className="w-5 h-5 text-white" />
                        </div>
                      <div>
                          <div className="font-semibold text-lg text-blue-900 flex items-center gap-2">
                            Option bilingue
                            <Sparkles className="w-4 h-4 text-gold-600" />
                      </div>
                          <div className="text-sm text-graphite-700 mt-1">Français + Anglais</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-900">
                          {priceCalculation.isLoading ? (
                            <Loader className="w-5 h-5 animate-spin text-blue-600" />
                          ) : data.billingPeriod === 'monthly' && priceCalculation.monthly ? (
                            <>+{priceCalculation.monthly.bilingualPrice.toLocaleString()} FCFA</>
                          ) : data.billingPeriod === 'yearly' && priceCalculation.yearly ? (
                            <>+{priceCalculation.yearly.bilingualPrice.toLocaleString()} FCFA</>
                          ) : (
                            <>+0 FCFA</>
                          )}
                        </div>
                        <div className="text-xs text-graphite-600 mt-1">
                          {data.billingPeriod === 'monthly' ? '/ mois' : '/ an'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 3: Paiement initial - Design premium avec accent bleu */}
                <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl p-6 border-2 border-blue-700 shadow-xl">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="p-3 bg-white/20 rounded-lg mr-4">
                        <DollarSign className="w-6 h-6 text-white" />
                  </div>
                      <div>
                        <div className="text-lg font-semibold text-white mb-1">Paiement initial</div>
                        <p className="text-sm text-blue-100 max-w-md">
                    Paiement unique pour activer votre compte et démarrer la période d'essai de 30 jours.
                  </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-white">
                        {initialPayment ? (
                          `${initialPayment.toLocaleString()} FCFA`
                        ) : (
                          <span className="text-lg">Chargement...</span>
                        )}
                      </div>
                      <div className="text-xs text-blue-200 mt-1">Paiement unique</div>
                    </div>
                  </div>
                </div>

                {/* Section 4: Total après essai - Design distinctif avec accent vert */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-300 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-3 bg-green-600 rounded-lg mr-4">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                    <div>
                        <div className="font-bold text-lg text-blue-900 mb-1">
                          Total {data.billingPeriod === 'monthly' ? 'mensuel' : 'annuel'} après essai
                        </div>
                        <div className="flex items-center gap-2 text-sm text-graphite-700 mt-2">
                          <School className="w-4 h-4" />
                          <span>
                        {data.schoolsCount} école{data.schoolsCount > 1 ? 's' : ''}
                        {data.bilingual && ' • Bilingue'}
                            {data.billingPeriod === 'yearly' && ' • Paiement annuel'}
                          </span>
                      </div>
                    </div>
                    </div>
                    <div className="text-right">
                      {priceCalculation.isLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader className="w-5 h-5 animate-spin text-green-600" />
                  </div>
                      ) : (
                        <>
                          <div className="text-3xl font-bold text-green-700">
                            {data.billingPeriod === 'monthly' && priceCalculation.monthly
                              ? priceCalculation.monthly.total.toLocaleString()
                              : data.billingPeriod === 'yearly' && priceCalculation.yearly
                              ? priceCalculation.yearly.total.toLocaleString()
                              : '0'}{' '}
                            FCFA
                          </div>
                          {data.billingPeriod === 'yearly' && priceCalculation.monthly && priceCalculation.yearly && (
                            <div className="text-xs text-green-600 mt-1 font-medium">
                              Équivalent {Math.round(priceCalculation.yearly.total / 12).toLocaleString()} FCFA/mois
                            </div>
                          )}
                          <div className="text-xs text-graphite-600 mt-1">
                            {data.billingPeriod === 'monthly' ? '/ mois' : '/ an'}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {errors.info && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">{errors.info}</p>
                </div>
              )}
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
            <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-8">
              {/* En-tête avec icône et titre */}
              <div className="flex items-center mb-2">
                <div className="p-3 bg-blue-900 rounded-lg mr-4">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div>
                <h2 className="text-3xl font-bold text-blue-900">Paiement initial</h2>
                  <p className="text-sm text-graphite-700 mt-1">Finalisez votre inscription en effectuant le paiement</p>
              </div>
              </div>
              
              <div className="mt-8 space-y-6">
                {/* Section 1: Montant du paiement - Design premium */}
                <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl p-8 border-2 border-blue-700 shadow-xl">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-4">
                      <div className="p-3 bg-white/20 rounded-lg mr-3">
                        <DollarSign className="w-8 h-8 text-white" />
                    </div>
                      <div>
                        <p className="text-sm text-blue-200 mb-1">Montant à payer</p>
                        <div className="text-5xl font-bold text-white">
                          {initialPayment ? (
                            `${initialPayment.toLocaleString()} FCFA`
                          ) : (
                            <span className="text-2xl">Chargement...</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-blue-100 mt-3">
                      Paiement unique pour activer votre compte et démarrer la période d'essai de 30 jours
                    </p>
                  </div>
                  </div>

                {/* Section 2: Détails de l'offre - Design distinctif */}
                <div className="bg-gradient-to-br from-mist to-cloud rounded-xl p-6 border border-blue-200 shadow-md">
                  <div className="flex items-center mb-5">
                    <CheckCircle className="w-5 h-5 text-blue-700 mr-2" />
                    <h3 className="text-base font-semibold text-blue-900">Ce qui est inclus</h3>
                    </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg mr-3">
                          <Calendar className="w-4 h-4 text-blue-700" />
                    </div>
                        <span className="text-sm font-medium text-graphite-900">Période d'essai</span>
                    </div>
                      <span className="text-sm font-semibold text-blue-900">30 jours</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg mr-3">
                          <School className="w-4 h-4 text-blue-700" />
                        </div>
                        <span className="text-sm font-medium text-graphite-900">Accès complet</span>
                      </div>
                      <span className="text-sm font-semibold text-blue-900">Tous les modules</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg mr-3">
                          <CheckCircle className="w-4 h-4 text-blue-700" />
                        </div>
                        <span className="text-sm font-medium text-graphite-900">Support technique</span>
                      </div>
                      <span className="text-sm font-semibold text-blue-900">Inclus</span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Checkout intégré ou bouton de paiement */}
                {errors.submit && (
                  <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl flex items-start shadow-md">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800 font-medium">{errors.submit}</p>
                  </div>
                )}

                {showCheckout && checkoutData ? (
                  <FedaPayCheckout
                    publicKey={checkoutData.public_key ?? checkoutData.publicKey}
                    transaction={checkoutData.transaction}
                    customer={checkoutData.customer ?? { email: '', lastname: '' }}
                    onComplete={handlePaymentComplete}
                    onError={handlePaymentError}
                  />
                ) : (
                  // Afficher le bouton pour initialiser le paiement
                  <div className="space-y-3 flex flex-col items-center">
                <button
                  onClick={handlePayment}
                  disabled={isSubmitting || !initialPayment}
                      className="px-6 py-4 bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-xl font-semibold hover:from-blue-800 hover:to-blue-700 transition-all duration-300 flex items-center justify-center disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                          Préparation du paiement...
                    </>
                  ) : !initialPayment ? (
                    <>
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Chargement du montant...
                    </>
                  ) : (
                    <>
                          <img 
                            src="/images/logoFedaPay.png" 
                            alt="FedaPay" 
                            className="w-16 h-16 mr-3 object-contain"
                          />
                          Payer {initialPayment.toLocaleString()} FCFA
                    </>
                  )}
                </button>

                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-start">
                        <div className="p-2 bg-blue-100 rounded-lg mr-3 flex-shrink-0">
                          <CheckCircle className="w-4 h-4 text-blue-700" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-blue-900 mb-1">Paiement sécurisé</p>
                          <p className="text-xs text-graphite-700">
                            Votre paiement est traité de manière sécurisée via FedaPay directement sur cette page.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-start mt-8">
                <button
                  onClick={handleBack}
                  className="flex items-center text-graphite-700 hover:text-blue-900 transition-colors font-medium"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" /> Retour
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Modal de choix pour le draft existant */}
      {showDraftChoiceModal && existingDraftInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-500 mr-3" />
              <h3 className="text-xl font-bold text-gray-900">Onboarding déjà en cours</h3>
            </div>
            
            <p className="text-gray-700 mb-4">
              Un onboarding est déjà en cours pour l'adresse email <strong>{data.email}</strong>.
            </p>

            {/* Avertissement expiration */}
            {existingDraftInfo.data?.createdAt && isExpiringSoon(existingDraftInfo.data.createdAt) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">Expiration proche</p>
                    <p className="text-xs text-amber-800 mt-1">
                      Ce brouillon expirera dans moins de 4 heures. Complétez votre inscription rapidement.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Indicateur de progression */}
            {existingDraftInfo.data && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Progression</span>
                  <span className="text-sm text-gray-600">{getProgressInfo(existingDraftInfo.data).progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${getProgressInfo(existingDraftInfo.data).progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">{getProgressInfo(existingDraftInfo.data).label}</p>
              </div>
            )}

            {/* Résumé complet du draft */}
            {existingDraftInfo.data && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-900 mb-3">Résumé du brouillon :</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600"><strong>Établissement :</strong></span>
                    <span className="text-gray-900">{existingDraftInfo.data.schoolName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600"><strong>Type :</strong></span>
                    <span className="text-gray-900">{existingDraftInfo.data.schoolType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600"><strong>Ville :</strong></span>
                    <span className="text-gray-900">{existingDraftInfo.data.city}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600"><strong>Email :</strong></span>
                    <span className="text-gray-900">{existingDraftInfo.data.email}</span>
                  </div>
                  {existingDraftInfo.data.promoterFirstName && (
                    <div className="flex justify-between">
                      <span className="text-gray-600"><strong>Promoteur :</strong></span>
                      <span className="text-gray-900">
                        {existingDraftInfo.data.promoterFirstName} {existingDraftInfo.data.promoterLastName || ''}
                      </span>
                    </div>
                  )}
                  {existingDraftInfo.data.selectedPlanId && (
                    <div className="flex justify-between">
                      <span className="text-gray-600"><strong>Plan sélectionné :</strong></span>
                      <span className="text-green-600 font-semibold">✓ Oui</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600"><strong>Statut :</strong></span>
                    <span className={existingDraftInfo.status === 'DRAFT' ? 'text-blue-600 font-semibold' : 'text-amber-600 font-semibold'}>
                      {existingDraftInfo.status === 'DRAFT' ? 'Brouillon' : 'En attente de paiement'}
                    </span>
                  </div>
                  {existingDraftInfo.data.createdAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-600"><strong>Créé le :</strong></span>
                      <span className="text-gray-900">
                        {new Date(existingDraftInfo.data.createdAt).toLocaleString('fr-FR', {
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
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleContinueWithExistingDraft}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-all duration-300 flex items-center justify-center"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Continuer avec le draft existant
              </button>
              
              <button
                onClick={handleCancelExistingDraft}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-red-600 text-white rounded-md font-semibold hover:bg-red-700 transition-all duration-300 flex items-center justify-center disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5 mr-2" />
                    Annuler et créer un nouveau
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">
              En continuant, vous reprendrez où vous vous êtes arrêté. En annulant, le draft existant sera supprimé et vous pourrez recommencer.
            </p>
          </div>
        </div>
      )}

      {/* Modal de confirmation de suppression moderne */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all animate-in fade-in zoom-in">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
                Confirmer la suppression
              </h3>
            </div>
            
            <div className="text-center mb-6">
              <p className="text-gray-700 mb-2 leading-relaxed">
                Attention : Annuler ce brouillon le supprimera <strong className="text-red-600">définitivement</strong>.
              </p>
              <p className="text-gray-600 text-sm">
                Vous devrez recommencer depuis le début.
              </p>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6 rounded-r-lg">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900 mb-1">
                    Cette action est irréversible
                  </p>
                  <p className="text-xs text-amber-800">
                    Toutes les données saisies dans ce brouillon seront perdues.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all duration-200 flex items-center justify-center"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDeleteDraft}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5 mr-2" />
                    Supprimer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
