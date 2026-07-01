/**
 * ============================================================================
 * LOGIN PAGE — MULTI-PORTAL CONFORME AU DOCUMENT ACADEMIA-HELM-PORTAILS.MD
 * ============================================================================
 *
 * Conforme au modèle RBAC 7 dimensions :
 *   portal → role → function → accreditations → levelScopes → classScopes → permissions
 *
 * Portails et méthodes d'authentification :
 *   - PLATFORM : email + mot de passe (7 rôles, tenant obligatoire)
 *   - SCHOOL   : email + mot de passe (45 rôles, accreditations par niveau)
 *   - TEACHER  : matricule + mot de passe (11 rôles, levelScopes)
 *   - PARENT   : téléphone + OTP (9 rôles, childScope)
 *   - PUBLIC   : PRÉ-INSCRIPTION uniquement (5 rôles, aucune auth requise)
 *
 * Palette Academia Helm exclusive :
 *   Navy  #0b2f73  |  Blue  #1d4fa5  |  Gold  #f5b335
 *   Aucune autre couleur par portail — palette unifiée professionnelle.
 *
 * ============================================================================
 */

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Loader,
  AlertCircle,
  Mail,
  Lock,
  User,
  Phone,
  KeyRound,
  Building2,
  MapPin,
  GraduationCap,
  Users,
  ArrowLeft,
  ArrowRight,
  Home,
  Shield,
  Globe,
  BookOpen,
  Baby,
  GraduationCap as GradCap,
  FileText,
  Eye,
  EyeOff,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TurnstileWidget from '@/components/auth/TurnstileWidget';
import LogoCircle from '@/components/ui/LogoCircle';
import { BRAND } from '@/lib/brand';
import { getSavedEmailForTenant, saveEmailForTenant } from '@/lib/auth/saved-email';
import { persistClientSession, markFreshLogin } from '@/lib/auth/client-access-token';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import { getMotionDuration } from '@/lib/motion/presets';
import { getTenantRedirectUrl } from '@/lib/utils/tenant-redirect';
import { getAppBaseUrl } from '@/lib/utils/urls';
import { isReservedSubdomain, extractTenantSlug } from '@/lib/tenant/constants';
import { detectAccessContext, getAvailablePortals, getPortalForRole, canRoleUsePortal } from '@/lib/auth/role-portal-map';
import { useFetchWithTimeout } from '@/lib/hooks/use-fetch-with-timeout';
import { useSchoolBranding } from '@/hooks/useSchoolBranding';
import AcademicParticles from './AcademicParticles';

type PortalType = 'platform' | 'school' | 'teacher' | 'parent' | 'public' | null;

/** Contexte d'accès détecté (domaine principal vs sous-domaine école) */
type AccessContext = 'main-domain' | 'school-subdomain';

/** ── Palette Academia Helm — Conforme charte ── */
const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';

/** Types de candidats pour le portail Public — conforme au document */
// Type de candidat = ID du schoolLevel (depuis backend) OU 'PROSPECT_PARENT' (cas spécial)
// On ne hardcode plus MATERNELLE/PRIMARY/SECONDARY — les niveaux sont fetchés depuis
// /api/public/school-info/:tenantIdentifier et deviennent dynamiquement des PublicCandidateType.
type PublicCandidateType = string | 'PROSPECT_PARENT';

/** Niveau scolaire exposé par le backend (school_levels) */
interface SchoolLevelInfo {
  id: string;
  name: string;
  code?: string | null;
}

/** Classe exposée par le backend (classes) */
interface ClassInfo {
  id: string;
  name: string;
  code?: string | null;
  schoolLevelId: string;
}

interface SchoolCredentials {
  email: string;
  password: string;
}

interface TeacherCredentials {
  teacherIdentifier: string;
  password: string;
}

interface ParentCredentials {
  phone: string;
  otp?: string;
}

interface PreEnrollmentData {
  candidateType: PublicCandidateType;
  parentFirstName: string;
  parentLastName: string;
  parentPhone: string;
  parentEmail: string;
  childFirstName: string;
  childLastName: string;
  // targetClass = UUID de la classe choisie par le parent (depuis select dynamique)
  // Anciennement appelé targetLevel, mais c'était sémantiquement faux : c'est une CLASSE
  // (CP, 6ème, M1…), pas un niveau (Maternelle/Primaire/Secondaire).
  targetClass: string;
  message?: string;

  // ── Champs étendus (admission complète) ──
  // Identité enfant
  childDateOfBirth?: string;
  childGender?: string;
  childBirthPlace?: string;
  childNationality?: string;
  childAddress?: string;

  // Vœux académiques
  previousSchool?: string;
  previousLevel?: string;
  changeReason?: string;
  wantsBilingual?: boolean;

  // Responsable légal (champs supplémentaires)
  parentRelationship?: string;
  parentAddress?: string;
  parentProfession?: string;

  // ── Documents uploadés (data URLs) — optionnels ──
  // Chaque doc est { fileName, fileDataUrl, mimeType, fileSize } | null
  birthCertificate?: any | null;
  idPhoto?: any | null;
  lastReportCard?: any | null;
  schoolCertificate?: any | null;
  parentalAuth?: any | null;
  npi?: any | null;
}

/** Info école stockée dans sessionStorage pour affichage sur la page login */
interface SchoolInfo {
  name: string;
  logoUrl: string | null;
  city: string | null;
  schoolType: string | null;
}

function normalizePortal(raw: string | null | undefined): PortalType {
  const x = raw?.toLowerCase();
  if (x === 'platform' || x === 'school' || x === 'teacher' || x === 'parent' || x === 'public') return x as PortalType;
  return null;
}

/** Valide le format d'un email */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Valide un numéro de téléphone béninois (format +229 ou 9 chiffres locaux) */
function isValidBeninPhone(phone: string): boolean {
  const digits = phone.replace(/[\s\-().]/g, '');
  return /^(\+229|00229)?\d{8}$/.test(digits);
}

/** Évalue la force d'un mot de passe — retourne { score, label, color } */
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '—', color: '#94a3b8' };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 1, label: 'Faible', color: '#ef4444' };
  if (score <= 4) return { score: 2, label: 'Moyen', color: GOLD };
  if (score <= 5) return { score: 3, label: 'Bon', color: BLUE };
  return { score: 4, label: 'Fort', color: '#16a34a' };
}

/**
 * Définition des portails pour la page login — conforme au document
 */
const PORTAL_LOGIN_DEFS: Record<string, {
  title: string;
  subtitle: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  platform: {
    title: 'Portail Plateforme',
    subtitle: 'Administration SaaS globale',
    Icon: Shield,
  },
  school: {
    title: 'Portail École',
    subtitle: 'Gestion de l\'établissement',
    Icon: Building2,
  },
  teacher: {
    title: 'Portail Enseignant',
    subtitle: 'Pédagogie & suivi',
    Icon: GraduationCap,
  },
  parent: {
    title: 'Portail Parent / Élève',
    subtitle: 'Suivi & communication',
    Icon: Users,
  },
  public: {
    title: 'Portail Public',
    subtitle: 'Pré-inscription en ligne',
    Icon: Globe,
  },
};

interface SchoolBranding {
  name: string;
  slug: string;
  logoUrl: string | null;
  city: string | null;
  phone: string | null;
  address: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  slogan: string | null;
  motto: string | null;
}

/**
 * Convertit un File en data URL base64 — pattern aligné sur CareersContent.tsx
 * (module RH). Les images sont compressées (maxEdge=1600, JPEG 0.85), les PDF/DOC
 * sont lus tels quels.
 *
 * Retourne { fileName, fileDataUrl, mimeType, fileSize } prêt à être envoyé
 * au backend /api/public/admission/submit.
 */
async function fileToDataUrl(file: File): Promise<{
  fileName: string;
  fileDataUrl: string;
  mimeType: string;
  fileSize: number;
}> {
  const isImage = file.type.startsWith('image/');
  let fileDataUrl: string;

  if (isImage) {
    // Compression : maxEdge=1600, qualité 0.85, format JPEG
    fileDataUrl = await compressImageFileToDataUrl(file, { maxEdge: 1600, quality: 0.85, mimeType: 'image/jpeg' });
  } else {
    // PDF/DOC : lecture brute en base64
    fileDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
      reader.readAsDataURL(file);
    });
  }

  return {
    fileName: file.name,
    fileDataUrl,
    mimeType: file.type || (isImage ? 'image/jpeg' : 'application/octet-stream'),
    fileSize: file.size,
  };
}

/**
 * Compression d'image côté navigateur — replica léger de lib/media.compressImageFileToDataUrl.
 * Évite d'importer le helper qui n'est pas forcément disponible côté page publique.
 */
async function compressImageFileToDataUrl(
  file: File,
  opts: { maxEdge: number; quality: number; mimeType: string },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > opts.maxEdge) {
          height = Math.round((height * opts.maxEdge) / width);
          width = opts.maxEdge;
        } else if (height > opts.maxEdge) {
          width = Math.round((width * opts.maxEdge) / height);
          height = opts.maxEdge;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas non supporté'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const dataUrl = canvas.toDataURL(opts.mimeType, opts.quality);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Image invalide'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });
}

interface LoginPageProps {
  schoolBranding?: SchoolBranding | null;
}

export default function LoginPage({ schoolBranding }: LoginPageProps = {}) {
  const searchParams = useSearchParams();
  const { shouldReduceMotion } = useMotionBudget();
  const { fetchWithTimeout } = useFetchWithTimeout();

  // ── Client-side school branding fallback ──
  // Si le server component n'a pas pu résoudre le branding (API indisponible),
  // on tente de le récupérer côté client via useSchoolBranding.
  const clientBranding = useSchoolBranding(schoolBranding);

  const portalParam = searchParams?.get('portal');
  let tenantSlug = searchParams?.get('tenant');
  let tenantIdFromUrl = searchParams?.get('tenant_id');
  const schoolSlugFromUrl = searchParams?.get('school');
  const schoolNameFromUrl = searchParams?.get('school_name');

  // Détection professionnelle du tenant via le sous-domaine
  if (typeof window !== 'undefined' && !tenantSlug) {
    const host = window.location.host;
    const slug = extractTenantSlug(host);
    if (slug) {
      tenantSlug = slug;
    }
  }

  const tenantIdForApi = tenantIdFromUrl || tenantSlug;
  const redirectPath = searchParams?.get('redirect') || '/app';

  // ── Fetch dynamique des niveaux + classes du tenant ──────────────────
  // Permet au formulaire public de s'adapter à ce que l'établissement a configuré
  // dans le module Paramètres. Aucun hardcoding : si le tenant n'a que Maternelle
  // et Primaire, seules ces deux cartes s'affichent (+ la carte "Juste info").
  useEffect(() => {
    if (!tenantIdForApi) return;
    let cancelled = false;
    setSchoolInfoLoading(true);
    fetch(`/api/public/school-info/${encodeURIComponent(tenantIdForApi)}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => {
        if (cancelled) return;
        if (Array.isArray(data?.schoolLevels)) setSchoolLevels(data.schoolLevels);
        if (Array.isArray(data?.classes)) setSchoolClasses(data.classes);
      })
      .catch((e) => {
        // Non bloquant : le formulaire affichera juste "Aucun niveau configuré"
        console.warn('[public-admission] Failed to fetch school-info:', e?.message);
      })
      .finally(() => { if (!cancelled) setSchoolInfoLoading(false); });
    return () => { cancelled = true; };
  }, [tenantIdForApi]);

  // ── Mode "admin subdomain" : l'utilisateur vient d'être redirigé depuis ──
  // admin.academiahelm.com (cf. middleware). Après une connexion réussie en tant
  // que PLATFORM_OWNER, on le renvoie vers admin.academiahelm.com${redirectPath}
  // au lieu de rester sur le domaine principal.
  const adminRedirectRequested = searchParams?.get('admin') === '1';
  const maybeRedirectToAdminSubdomain = (): boolean => {
    if (!adminRedirectRequested) return false;
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname || '';
    // Construire l'URL admin.<parent-domain>
    const parts = host.split('.');
    if (parts.length < 2) return false;
    const parentDomain = parts.slice(-2).join('.');
    const protocol = window.location.protocol;
    const adminUrl = `${protocol}//admin.${parentDomain}${redirectPath}`;
    markFreshLogin();
    window.location.href = adminUrl;
    return true;
  };

  // ── Access context detection (subdomain vs main domain) ──
  const [accessContext, setAccessContext] = useState<AccessContext>('main-domain');

  useEffect(() => {
    const ctx = detectAccessContext();
    setAccessContext(ctx);
  }, []);

  const availablePortals = useMemo(() => {
    return getAvailablePortals(accessContext);
  }, [accessContext]);

  const [portalType, setPortalType] = useState<PortalType>(() => {
    const normalized = normalizePortal(portalParam);
    // Sur sous-domaine école, si le portail demandé est PLATFORM, l'ignorer
    if (normalized === 'platform' && detectAccessContext() === 'school-subdomain') {
      return null;
    }
    return normalized;
  });

  useEffect(() => {
    const normalized = normalizePortal(portalParam);
    // Sur sous-domaine école, ne pas permettre PLATFORM
    if (normalized === 'platform' && accessContext === 'school-subdomain') {
      setPortalType(null);
    } else {
      setPortalType(normalized);
    }
  }, [portalParam, accessContext]);

  // ── School info from sessionStorage ──────────────────────────────────
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('academia_portal_school');
      if (raw) {
        const info = JSON.parse(raw) as SchoolInfo;
        setSchoolInfo(info);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Credentials state ────────────────────────────────────────────────
  const [schoolCredentials, setSchoolCredentials] = useState<SchoolCredentials>({
    email: '',
    password: '',
  });

  const [teacherCredentials, setTeacherCredentials] = useState<TeacherCredentials>({
    teacherIdentifier: '',
    password: '',
  });

  const [parentCredentials, setParentCredentials] = useState<ParentCredentials>({
    phone: '',
    otp: '',
  });

  const [parentOtpSent, setParentOtpSent] = useState(false);
  const [parentOtpCode, setParentOtpCode] = useState<string>('');

  // ── School Google OAuth + 2FA OTP state ──
  // Uniquement pour le portail SCHOOL (pas TEACHER, pas PARENT, pas PLATFORM)
  const [schoolGooglePending, setSchoolGooglePending] = useState(false);
  const [schoolGooglePendingToken, setSchoolGooglePendingToken] = useState<string | null>(null);
  const [schoolGoogleEmail, setSchoolGoogleEmail] = useState<string>('');
  const [schoolOtp, setSchoolOtp] = useState(['', '', '', '', '', '']);
  const schoolOtpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Public portal: pre-enrollment state ──
  const [preEnrollment, setPreEnrollment] = useState<PreEnrollmentData>({
    candidateType: 'PROSPECT_PARENT',
    parentFirstName: '',
    parentLastName: '',
    parentPhone: '',
    parentEmail: '',
    childFirstName: '',
    childLastName: '',
    targetClass: '',
    message: '',
  });
  // ── School levels + classes fetchés dynamiquement depuis le backend ──
  // Remplace le hardcoding des cartes MATERNELLE/PRIMARY/SECONDARY et du select
  // getLevelsForCandidateType(). Désormais, le formulaire s'adapte à ce que
  // l'établissement a réellement configuré dans le module Paramètres.
  const [schoolLevels, setSchoolLevels] = useState<SchoolLevelInfo[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<ClassInfo[]>([]);
  const [schoolInfoLoading, setSchoolInfoLoading] = useState(false);
  const [preEnrollmentSubmitted, setPreEnrollmentSubmitted] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  // ── Wizard multi-étapes pour la pré-inscription publique ──
  // Étape 1 : Type de candidat + Identité élève + Classe souhaitée
  // Étape 2 : Responsable légal (contact + champs étendus)
  // Étape 3 : Pièces justificatives + Message + Submit
  // Objectif : fixer la hauteur du formulaire, éviter le scroll vertical.
  const [preEnrollmentStep, setPreEnrollmentStep] = useState<1 | 2 | 3>(1);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // ── Callbacks stables pour Turnstile (évitent les re-rendus du widget) ──
  const handleTurnstileError = useCallback(() => setTurnstileToken(null), []);
  const handleTurnstileExpire = useCallback(() => setTurnstileToken(null), []);

  // ── Client-side validation state ─────────────────────────────────────
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailError = emailTouched && schoolCredentials.email && !isValidEmail(schoolCredentials.email)
    ? 'Format d\'email invalide'
    : null;

  const phoneError = phoneTouched && parentCredentials.phone && !isValidBeninPhone(parentCredentials.phone)
    ? 'Numéro de téléphone invalide (format Bénin attendu)'
    : null;

  const passwordStrength = getPasswordStrength(
    portalType === 'teacher' ? teacherCredentials.password : schoolCredentials.password,
  );

  // ── Session expiry message ───────────────────────────────────────────
  const reasonParam = searchParams?.get('reason');
  const idleLogoutMessage = reasonParam === 'session_expired'
    ? 'Votre session a expiré après une période d\'inactivité prolongée. Veuillez vous reconnecter.'
    : reasonParam === 'session_locked'
      ? 'Vous avez été déconnecté(e) depuis l\'écran de verrouillage.'
      : reasonParam === 'idle_timeout'
        ? 'Vous avez été déconnecté(e) automatiquement après une période d\'inactivité.'
        : null;

  const tenantStorageKey = tenantIdFromUrl || tenantSlug || 'platform';

  // ── Forgot password URL with portal/tenant context ──
  const forgotPasswordHref = useMemo(() => {
    const params = new URLSearchParams();
    if (portalType) params.set('portal', portalType);
    if (tenantSlug) params.set('tenant', tenantSlug);
    else if (tenantIdFromUrl) params.set('tenant', tenantIdFromUrl);
    const qs = params.toString();
    return qs ? `/forgot-password?${qs}` : '/forgot-password';
  }, [portalType, tenantSlug, tenantIdFromUrl]);

  // ── Back to portal selection URL (school-portal on subdomain, portal on main) ──
  const backToPortalHref = useMemo(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.host;
      const slug = extractTenantSlug(host);
      if (slug) {
        return '/school-portal';
      }
    }
    return '/portal';
  }, []);

  const dur = useMemo(
    () => getMotionDuration(shouldReduceMotion, 'normal'),
    [shouldReduceMotion],
  );

  const heroVariants = useMemo(
    () => ({
      hidden: { opacity: shouldReduceMotion ? 1 : 0 },
      show: {
        opacity: 1,
        transition: {
          staggerChildren: shouldReduceMotion ? 0 : 0.09,
          delayChildren: shouldReduceMotion ? 0 : 0.04,
        },
      },
    }),
    [shouldReduceMotion],
  );

  const heroItem = useMemo(
    () => ({
      hidden: {
        opacity: shouldReduceMotion ? 1 : 0,
        y: shouldReduceMotion ? 0 : 14,
        filter: shouldReduceMotion ? 'blur(0px)' : 'blur(5px)',
      },
      show: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: { duration: dur, ease: 'easeOut' as const },
      },
    }),
    [shouldReduceMotion, dur],
  );

  const springSoft = useMemo(
    () => ({
      type: 'spring' as const,
      stiffness: shouldReduceMotion ? 500 : 260,
      damping: shouldReduceMotion ? 50 : 24,
    }),
    [shouldReduceMotion],
  );

  // ── Pre-fill saved email ─────────────────────────────────────────────
  useEffect(() => {
    const lastEmail = getSavedEmailForTenant(tenantStorageKey);
    if (lastEmail && !schoolCredentials.email) {
      setSchoolCredentials((prev) => ({ ...prev, email: lastEmail }));
    }
  }, [tenantStorageKey]);

  const isStandardLogin = !portalType;

  // ── Portal definition for current portal ──
  const portalDef = portalType ? PORTAL_LOGIN_DEFS[portalType] : null;

  // ── Form submit handlers ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // ── Turnstile : désactivé pour le portail public (pré-inscription) ──
    // Le flux public doit rester simple. La validation Turnstile est gardée
    // pour les portails authentifiés (school, teacher, parent, platform).
    // Pour réactiver sur le portail public, décommenter le bloc ci-dessous.
    // if (portalType !== 'public' && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
    //   setError('Veuillez compléter la vérification de sécurité avant de continuer.');
    //   return;
    // }

    setIsLoading(true);

    try {
      if (isStandardLogin) {
        await handleStandardLogin();
      } else if (portalType === 'platform') {
        await handlePlatformLogin();
      } else if (portalType === 'school') {
        await handleSchoolLogin();
      } else if (portalType === 'teacher') {
        await handleTeacherLogin();
      } else if (portalType === 'parent') {
        await handleParentLogin();
      } else if (portalType === 'public') {
        await handlePreEnrollmentSubmit();
      }
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : 'Erreur lors de la connexion';
      // Amélioration des messages d'erreur (même logique que le flux DEV)
      let userMessage = rawMessage;
      if (rawMessage.includes('timeout') || rawMessage.includes('ne répond pas') || rawMessage.includes('30 secondes')) {
        userMessage = 'Le serveur est en cours de démarrage. Veuillez réessayer dans quelques secondes.';
      } else if (rawMessage.toLowerCase().includes('aborted') || rawMessage.toLowerCase().includes('signal is aborted')) {
        // AbortController déclenché (timeout ou navigation) — surtout pour l'upload de documents
        userMessage = portalType === 'public'
          ? 'La soumission a expiré (le serveur met trop de temps à répondre). Veuillez réduire la taille des documents ou réessayer dans quelques instants.'
          : 'La connexion a expiré. Le serveur est peut-être en cours de démarrage, veuillez réessayer.';
      } else if (rawMessage.includes('Internal server error') || rawMessage.includes('500')) {
        userMessage = 'Erreur serveur temporaire. Veuillez réessayer dans quelques instants.';
      } else if (rawMessage.includes('Unauthorized') || rawMessage.includes('401')) {
        userMessage = 'Email ou mot de passe incorrect. Vérifiez vos identifiants.';
      } else if (rawMessage.includes('PORTAL_MISMATCH')) {
        // Erreur de portail inadéquat — extraire le message du backend
        const match = rawMessage.match(/PORTAL_MISMATCH:\s*(.*)/);
        userMessage = match?.[1] || 'Ce compte n\'est pas autorisé sur ce portail. Veuillez utiliser le portail correspondant à votre profil.';
      } else if (rawMessage.includes('PORTAL_ACCESS_REQUESTED')) {
        // PLATFORM_OWNER : demande d'accès envoyée au directeur
        const match = rawMessage.match(/PORTAL_ACCESS_REQUESTED:\s*(.*)/);
        userMessage = match?.[1] || 'Votre demande d\'accès a été envoyée au directeur de l\'établissement. Vous recevrez une notification par email dès qu\'elle sera approuvée.';
      } else if (rawMessage.includes('PORTAL_ACCESS_PENDING')) {
        // PLATFORM_OWNER : demande déjà en attente
        const match = rawMessage.match(/PORTAL_ACCESS_PENDING:\s*(.*)/);
        userMessage = match?.[1] || 'Votre demande d\'accès est en attente d\'approbation du directeur.';
      } else if (rawMessage.includes('403') || rawMessage.includes('Forbidden')) {
        // Autres erreurs 403 — vérifier si c'est une erreur de portail
        if (rawMessage.includes('PLATFORM_OWNER') || rawMessage.includes('PLATFORM portal')) {
          userMessage = 'Ce compte plateforme doit utiliser le portail Plateforme pour se connecter.';
        } else if (rawMessage.includes('Only PLATFORM_OWNER')) {
          userMessage = 'Seul un compte plateforme peut utiliser le portail Plateforme.';
        } else {
          userMessage = 'Accès refusé. Vérifiez vos identifiants et le portail sélectionné.';
        }
      }
      setError(userMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlatformLogin = async () => {
    if (!tenantSlug && !tenantIdFromUrl) {
      const mainDomain = getAppBaseUrl();
      window.location.href = `${mainDomain}/portal`;
      return;
    }

    // ── Même pattern que le bouton DEV : /api/auth/login avec portal_type ──
    const attemptLogin = async (portalTypeAttempt: 'PLATFORM' | 'SCHOOL') => {
      return fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: schoolCredentials.email.trim(),
          password: schoolCredentials.password,
          tenant_id: tenantIdFromUrl || undefined,
          tenantSubdomain: tenantSlug || undefined,
          portal_type: portalTypeAttempt,
          turnstileToken: turnstileToken || undefined,
        }),
      });
    };

    let response = await attemptLogin('PLATFORM');
    let data = await response.json();

    // ── Si PLATFORM_OWNER détecté avec tenant_id → sélectionner le tenant ──
    const isPlatformOwner =
      data.user?.role === 'PLATFORM_OWNER' ||
      (data.user as { isPlatformOwner?: boolean })?.isPlatformOwner;
    const hasNoTenant = !data.tenant?.id;

    if (isPlatformOwner && hasNoTenant && (tenantIdFromUrl || tenantSlug)) {
      // Le PLATFORM_OWNER a sélectionné une école → sélectionner le tenant
      const selectResp = await fetchWithTimeout('/api/auth/select-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.accessToken}`,
        },
        body: JSON.stringify({ tenant_id: tenantIdFromUrl || tenantSlug }),
      });
      const selectData = await selectResp.json();
      if (!selectResp.ok || !selectData.success) {
        throw new Error(selectData.message || selectData.error || 'Sélection tenant impossible');
      }
      persistClientSession({
        accessToken: selectData.accessToken,
        refreshToken: selectData.refreshToken,
        serverSessionId: selectData.serverSessionId,
        user: selectData.user,
        tenant: selectData.tenant,
        portalType: 'PLATFORM',
        expiresAt: selectData.expiresAt,
      });
      saveEmailForTenant(schoolCredentials.email.trim(), selectData.tenant?.id || tenantIdFromUrl || 'platform');
      const redirectUrl = getTenantRedirectUrl({
        tenantSlug: tenantSlug || selectData.tenant?.slug || selectData.tenant?.id,
        tenantId: tenantIdFromUrl || selectData.tenant?.id,
        path: redirectPath,
        portalType: 'PLATFORM',
      });
      markFreshLogin();
      if (maybeRedirectToAdminSubdomain()) return;
      window.location.href = redirectUrl;
      return;
    }

    // ── Si PLATFORM_OWNER sans tenant et sans sélection → retour au portail ──
    if (isPlatformOwner && hasNoTenant) {
      const mainDomain = getAppBaseUrl();
      window.location.href = `${mainDomain}/portal`;
      return;
    }

    if (!response.ok) {
      throw new Error(data.message || 'Erreur lors de la connexion');
    }

    persistClientSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      serverSessionId: data.serverSessionId,
      user: data.user,
      tenant: data.tenant,
      portalType: 'PLATFORM',
      expiresAt: data.expiresAt,
    });

    const tenantKey = data.tenant?.id || tenantIdFromUrl || tenantSlug || 'platform';
    saveEmailForTenant(schoolCredentials.email.trim(), tenantKey);

    const resolvedSlug = tenantSlug || data.tenant?.slug || data.tenant?.subdomain;
    const resolvedTenantId = tenantIdFromUrl || data.tenant?.id;

    if (!resolvedSlug && !resolvedTenantId) {
      const mainDomain = getAppBaseUrl();
      markFreshLogin();
      if (maybeRedirectToAdminSubdomain()) return;
      window.location.href = `${mainDomain}${redirectPath}`;
      return;
    }

    const redirectUrl = getTenantRedirectUrl({
      tenantSlug: resolvedSlug || resolvedTenantId || 'unknown',
      tenantId: resolvedTenantId,
      path: redirectPath,
      portalType: 'PLATFORM',
    });
    markFreshLogin();
    if (maybeRedirectToAdminSubdomain()) return;
    window.location.href = redirectUrl;
  };

  const handleStandardLogin = async () => {
    const response = await fetchWithTimeout('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: schoolCredentials.email,
        password: schoolCredentials.password,
        tenantSubdomain: tenantSlug,
        tenant_id: tenantIdFromUrl || undefined,
        portal_type: portalType?.toUpperCase() || undefined,
        turnstileToken: turnstileToken || undefined,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Erreur lors de la connexion');
    }

    persistClientSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      serverSessionId: data.serverSessionId,
      user: data.user,
      tenant: data.tenant,
      portalType: portalType?.toUpperCase() || null,
      expiresAt: data.expiresAt,
    });

    const tenantKey = data.tenant?.id || tenantIdFromUrl || tenantSlug || 'platform';
    saveEmailForTenant(schoolCredentials.email, tenantKey);

    const isPlatformOwner =
      data.user?.role === 'PLATFORM_OWNER' ||
      (data.user as { isPlatformOwner?: boolean })?.isPlatformOwner;
    const hasNoTenant = !data.tenant?.id;

    if (isPlatformOwner && hasNoTenant) {
      const mainDomain = getAppBaseUrl();
      window.location.href = `${mainDomain}/portal`;
      return;
    }

    if (portalType === 'platform' && hasNoTenant) {
      const mainDomain = getAppBaseUrl();
      window.location.href = `${mainDomain}/portal`;
      return;
    }

    const resolvedSlug = tenantSlug || data.tenant?.slug || data.tenant?.subdomain;
    const resolvedTenantId = tenantIdFromUrl || data.tenant?.id;

    if (!resolvedSlug && !resolvedTenantId) {
      const mainDomain = getAppBaseUrl();
      markFreshLogin();
      window.location.href = `${mainDomain}${redirectPath}`;
      return;
    }

    try {
      const redirectUrl = getTenantRedirectUrl({
        tenantSlug: resolvedSlug || resolvedTenantId || 'unknown',
        tenantId: resolvedTenantId,
        path: redirectPath,
        portalType: (portalType?.toUpperCase() as 'PLATFORM' | 'SCHOOL' | 'TEACHER' | 'PARENT' | 'PUBLIC') || undefined,
      });
      markFreshLogin();
      window.location.href = redirectUrl;
    } catch {
      const baseUrl = window.location.origin;
      const url = new URL(redirectPath, baseUrl);
      if (resolvedSlug) url.searchParams.set('tenant', resolvedSlug);
      if (resolvedTenantId) url.searchParams.set('tenant_id', resolvedTenantId);
      if (portalType) url.searchParams.set('portal', portalType);
      markFreshLogin();
      if (maybeRedirectToAdminSubdomain()) return;
      window.location.href = url.toString();
    }
  };

  const handleSchoolLogin = async () => {
    if (!tenantIdForApi) {
      throw new Error("Identifiant de l'établissement manquant");
    }

    // ── Même pattern que le bouton DEV : /api/auth/login avec portal_type ──
    const attemptLogin = async (portalTypeAttempt: 'SCHOOL' | 'PLATFORM') => {
      return fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: schoolCredentials.email.trim(),
          password: schoolCredentials.password,
          tenant_id: tenantIdForApi,
          tenantSubdomain: tenantSlug || undefined,
          portal_type: portalTypeAttempt,
          turnstileToken: turnstileToken || undefined,
        }),
      });
    };

    let response = await attemptLogin('SCHOOL');
    let data = await response.json();

    // ── Retry automatique si PLATFORM_OWNER détecté (même logique que DEV) ──
    const message = typeof data?.message === 'string' ? data.message : '';
    if (
      response.status === 403 &&
      message.toLowerCase().includes('platform_owner') &&
      message.toLowerCase().includes('platform')
    ) {
      response = await attemptLogin('PLATFORM');
      data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Connexion impossible');
      }
      // PLATFORM_OWNER : sélectionner le tenant demandé
      const selectResp = await fetchWithTimeout('/api/auth/select-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.accessToken}`,
        },
        body: JSON.stringify({ tenant_id: tenantIdForApi }),
      });
      const selectData = await selectResp.json();
      if (!selectResp.ok || !selectData.success) {
        throw new Error(selectData.message || selectData.error || 'Sélection tenant impossible');
      }
      persistClientSession({
        accessToken: selectData.accessToken,
        refreshToken: selectData.refreshToken,
        serverSessionId: selectData.serverSessionId,
        user: selectData.user,
        tenant: selectData.tenant,
        portalType: 'PLATFORM',
        expiresAt: selectData.expiresAt,
      });
      saveEmailForTenant(schoolCredentials.email.trim(), tenantIdForApi);
      const redirectUrl = getTenantRedirectUrl({
        tenantSlug: tenantSlug || selectData.tenant?.slug || tenantIdForApi,
        tenantId: tenantIdForApi,
        path: redirectPath,
        portalType: 'PLATFORM',
      });
      markFreshLogin();
      if (maybeRedirectToAdminSubdomain()) return;
      window.location.href = redirectUrl;
      return;
    }

    if (!response.ok) {
      throw new Error(data.message || 'Erreur lors de la connexion');
    }

    persistClientSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      serverSessionId: data.serverSessionId,
      user: data.user,
      tenant: data.tenant,
      portalType: 'SCHOOL',
      expiresAt: data.expiresAt,
    });

    const tenantKey = data.tenant?.id || tenantIdForApi || 'platform';
    saveEmailForTenant(schoolCredentials.email.trim(), tenantKey);

    const resolvedSlug = tenantSlug || data.tenant?.slug || data.tenant?.subdomain || data.tenant?.id;
    const resolvedTenantId = tenantIdForApi || data.tenant?.id;

    const redirectUrl = getTenantRedirectUrl({
      tenantSlug: resolvedSlug,
      tenantId: resolvedTenantId,
      path: redirectPath,
      portalType: 'SCHOOL',
    });
    markFreshLogin();
    window.location.href = redirectUrl;
  };

  const handleTeacherLogin = async () => {
    if (!tenantIdForApi) {
      throw new Error("Identifiant de l'établissement manquant");
    }

    const response = await fetchWithTimeout('/api/portal/auth/teacher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: tenantIdForApi,
        teacherIdentifier: teacherCredentials.teacherIdentifier,
        password: teacherCredentials.password,
        portal_type: 'TEACHER',
        turnstileToken: turnstileToken || undefined,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Erreur lors de la connexion');
    }

    persistClientSession({
      accessToken: data.accessToken,
      portalSessionId: data.portalSessionId,
      user: data.user,
      tenant: data.tenant,
      portalType: 'TEACHER',
      expiresAt: data.expiresAt,
    });

    const redirectUrl = getTenantRedirectUrl({
      tenantSlug: tenantSlug || data.tenant?.slug || data.tenant?.id,
      tenantId: tenantIdForApi,
      path: redirectPath,
      portalType: 'TEACHER',
    });
    markFreshLogin();
    window.location.href = redirectUrl;
  };

  const handleParentLogin = async () => {
    if (!tenantIdForApi) {
      throw new Error("Identifiant de l'établissement manquant");
    }

    if (!parentOtpSent) {
      const response = await fetchWithTimeout('/api/portal/auth/parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenantIdForApi,
          phone: parentCredentials.phone,
          portal_type: 'PARENT',
          turnstileToken: turnstileToken || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Erreur lors de l'envoi du code OTP");
      }

      if (data.otp) {
        setParentOtpCode(data.otp);
      }

      setParentOtpSent(true);
      return;
    }

    const response = await fetchWithTimeout('/api/portal/auth/parent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: tenantIdForApi,
        phone: parentCredentials.phone,
        otp: parentCredentials.otp,
        portal_type: 'PARENT',
        turnstileToken: turnstileToken || undefined,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Code OTP invalide');
    }

    persistClientSession({
      accessToken: data.accessToken,
      portalSessionId: data.portalSessionId,
      user: data.user,
      tenant: data.tenant,
      portalType: 'PARENT',
      expiresAt: data.expiresAt,
    });

    const redirectUrl = getTenantRedirectUrl({
      tenantSlug: tenantSlug || data.tenant?.slug || data.tenant?.id,
      tenantId: tenantIdForApi,
      path: redirectPath,
      portalType: 'PARENT',
    });
    markFreshLogin();
    window.location.href = redirectUrl;
  };

  // ── Public portal: pre-enrollment (aucune authentification requise) ──
  // Envoie les données au backend /students/admissions-public/upload-apply
  // qui crée l'Admission + AdmissionDocument(s) et envoie un email au parent.
  const handlePreEnrollmentSubmit = async () => {
    const schoolId = tenantIdForApi || schoolSlugFromUrl;
    if (!schoolId) {
      throw new Error('Veuillez sélectionner un établissement pour la pré-inscription');
    }

    // Mapper les champs du formulaire (parent*/child*) vers le schéma Admission
    // (firstName/lastName/mainGuardian*).

    // ⚠️ schoolLevelId : désormais c'est directement le schoolLevel.id (UUID)
    // sélectionné par le parent via les cartes dynamiques. Plus de mapping
    // hardcodé MATERNELLE/PRIMARY/SECONDARY → le frontend ne connaît pas
    // les UUIDs, il les reçoit du backend.
    // Le backend applyAdmission() résout schoolLevelId (qui peut être un UUID
    // de school_levels OU de education_levels) correctement.
    const selectedSchoolLevelId = preEnrollment.candidateType !== 'PROSPECT_PARENT'
      ? preEnrollment.candidateType  // = schoolLevel.id (UUID)
      : undefined;

    // Récupérer le nom lisible de la classe pour le message
    const targetClassName = schoolClasses.find(c => c.id === preEnrollment.targetClass)?.name;

    const payload: any = {
      tenantId: tenantIdForApi,
      candidateType: preEnrollment.candidateType,

      // Élève
      firstName: preEnrollment.childFirstName,
      lastName: preEnrollment.childLastName,
      dateOfBirth: preEnrollment.childDateOfBirth || undefined,
      gender: preEnrollment.childGender || undefined,
      birthPlace: preEnrollment.childBirthPlace || undefined,
      nationality: preEnrollment.childNationality || 'Béninoise',
      address: preEnrollment.childAddress || undefined,

      // schoolLevelId = UUID du schoolLevel sélectionné (cartes dynamiques)
      schoolLevelId: selectedSchoolLevelId,
      // targetClass = UUID de la classe choisie par le parent (depuis le select
      // dynamique alimenté par /api/public/school-info). Le backend l'utilise
      // directement comme requestedClassId — pas de matching à faire.
      targetClass: preEnrollment.targetClass || undefined,
      wantsBilingual: preEnrollment.wantsBilingual || false,
      previousSchool: preEnrollment.previousSchool || undefined,
      previousLevel: preEnrollment.previousLevel || undefined,
      changeReason: preEnrollment.changeReason || undefined,

      // Responsable légal
      mainGuardianName: `${preEnrollment.parentFirstName} ${preEnrollment.parentLastName}`.trim(),
      mainGuardianPhone: preEnrollment.parentPhone || undefined,
      mainGuardianEmail: preEnrollment.parentEmail || undefined,
      mainGuardianRelationship: preEnrollment.parentRelationship || undefined,
      mainGuardianAddress: preEnrollment.parentAddress || undefined,
      mainGuardianProfession: preEnrollment.parentProfession || undefined,

      // Message + nom de la classe choisie → notes (pour référence humaine)
      message: [
        targetClassName ? `Classe souhaitée : ${targetClassName}` : null,
        preEnrollment.message,
      ].filter(Boolean).join('\n\n') || undefined,
    };

    // Ajouter les documents uploadés (data URLs)
    const docFields = [
      'birthCertificate', 'idPhoto', 'lastReportCard',
      'schoolCertificate', 'npi',
    ] as const;
    for (const key of docFields) {
      const doc = preEnrollment[key];
      if (doc && doc.fileDataUrl) {
        payload[key] = doc;
      }
    }

    // Token Turnstile (validation serveur anti-spam si configuré)
    if (turnstileToken) {
      payload.turnstileToken = turnstileToken;
    }

    // Timeout étendu (60s) car l'upload de 6 documents en base64 peut être lent,
    // surtout si le backend est en cold start sur Fly.io.
    const response = await fetchWithTimeout(
      '/api/public/admission/submit',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      60_000, // 60 secondes
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || `Erreur lors de la soumission (${response.status})`);
    }

    setPreEnrollmentSubmitted(true);
  };

  // ── Validation par étape du wizard pré-inscription ──
  // Retourne un message d'erreur si l'étape est invalide, null sinon.
  // IMPORTANT : l'ordre des étapes est :
  //   Étape 1 = Type candidat + Responsable légal (parent)
  //   Étape 2 = Identité de l'enfant + Classe souhaitée (sauf PROSPECT_PARENT qui saute cette étape)
  //   Étape 3 = Pièces justificatives + Message
  const validatePreEnrollmentStep = (step: 1 | 2 | 3): string | null => {
    if (step === 1) {
      // Étape 1 : type candidat + champs parent
      if (!preEnrollment.candidateType) return 'Veuillez sélectionner le niveau d\'inscription (Maternelle, Primaire, Secondaire).';
      if (!preEnrollment.parentFirstName?.trim()) return 'Veuillez saisir votre prénom (parent).';
      if (!preEnrollment.parentLastName?.trim()) return 'Veuillez saisir votre nom (parent).';
      if (!preEnrollment.parentPhone?.trim()) return 'Veuillez saisir votre numéro de téléphone.';
      if (!preEnrollment.parentEmail?.trim()) return 'Veuillez saisir votre adresse email.';
    }
    if (step === 2) {
      // Étape 2 : champs enfant (uniquement si pas PROSPECT_PARENT)
      if (preEnrollment.candidateType !== 'PROSPECT_PARENT') {
        if (!preEnrollment.childFirstName?.trim()) return 'Veuillez saisir le prénom de l\'enfant.';
        if (!preEnrollment.childLastName?.trim()) return 'Veuillez saisir le nom de l\'enfant.';
        if (!preEnrollment.targetClass && preEnrollment.candidateType !== 'PROSPECT_PARENT') return 'Veuillez sélectionner la classe souhaitée.';
      }
    }
    // Étape 3 : aucun champ obligatoire (documents et message sont optionnels)
    return null;
  };

  const handlePreEnrollmentNext = () => {
    const err = validatePreEnrollmentStep(preEnrollmentStep);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (preEnrollmentStep === 1) {
      // Si PROSPECT_PARENT, sauter l'étape 2 (pas d'info enfant à remplir) → aller directement à l'étape 3
      if (preEnrollment.candidateType === 'PROSPECT_PARENT') {
        setPreEnrollmentStep(3);
      } else {
        setPreEnrollmentStep(2);
      }
    } else if (preEnrollmentStep === 2) {
      setPreEnrollmentStep(3);
    }
  };

  const handlePreEnrollmentBack = () => {
    setError(null);
    if (preEnrollmentStep === 3) {
      // Si PROSPECT_PARENT, revenir directement à l'étape 1 (étape 2 était skippée)
      setPreEnrollmentStep(preEnrollment.candidateType === 'PROSPECT_PARENT' ? 1 : 2);
    } else if (preEnrollmentStep === 2) {
      setPreEnrollmentStep(1);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  SCHOOL GOOGLE OAUTH + 2FA OTP — Uniquement pour le portail ÉCOLE
  // ═══════════════════════════════════════════════════════════════════════

  /** Initie le flow Google OAuth pour le portail SCHOOL. */
  const handleSchoolGoogleLogin = async () => {
    if (!tenantIdForApi) {
      setError("Identifiant de l'établissement manquant");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      // Récupérer le nom de l'école depuis sessionStorage (mis par /portal)
      // ou depuis les infos de branding
      let schoolName = '';
      try {
        const raw = sessionStorage.getItem('academia_portal_school');
        if (raw) {
          const info = JSON.parse(raw) as { name?: string };
          schoolName = info.name || '';
        }
      } catch { /* ignore */ }
      // Fallback : utiliser le branding client si disponible
      if (!schoolName && clientBranding?.name) {
        schoolName = clientBranding.name;
      }

      const res = await fetch('/api/school-auth/google/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenantIdFromUrl,
          tenantSlug: tenantSlug || undefined,
          schoolName: schoolName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur init Google OAuth');
      // Redirige vers Google
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur Google OAuth');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Hook : détection du retour du callback Google SCHOOL (server-side).
   *
   * Nouveau flow (server-side callback) :
   *   Google → /api/school-auth/google/callback (GET) →
   *     échange le code, vérifie l'utilisateur, génère OTP, envoie email,
   *     pose le cookie `academia_school_google_pending`, puis redirige (302)
   *     vers `/login?otp_pending=1&email=...&token=...&tenant=...&portal=school`.
   *
   * Ici on se contente de lire les query params et d'afficher le modal OTP
   * directement — AUCUN fetch côté client, AUCUN useEffect qui détecte
   * `code`/`state`. Le `pendingToken` est passé dans l'URL (`?token=...`)
   * et stocké en state pour la vérification OTP ultérieure.
   *
   * Si l'URL contient `?google_error=...` (erreur gérée côté serveur pendant
   * le callback GET), on l'affiche comme erreur.
   */
  useEffect(() => {
    if (!searchParams) return;
    // Si l'OTP modal est déjà affiché, ne pas re-traiter
    if (schoolGooglePending) return;

    const otpPending = searchParams.get('otp_pending') === '1';
    if (otpPending) {
      const token = searchParams.get('token');
      const email = searchParams.get('email');
      if (token && email) {
        setSchoolGooglePending(true);
        setSchoolGooglePendingToken(token);
        setSchoolGoogleEmail(email);
        setError(null);
        // Focus premier input OTP
        setTimeout(() => schoolOtpRefs.current[0]?.focus(), 100);
      }
      return;
    }

    // Erreur gérée côté serveur pendant le callback GET
    const googleError = searchParams.get('google_error');
    if (googleError) {
      setError(googleError);
    }
  }, [searchParams, schoolGooglePending]);

  /** Change un chiffre OTP SCHOOL. */
  const handleSchoolOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...schoolOtp];
    newOtp[index] = digit;
    setSchoolOtp(newOtp);
    if (digit && index < 5) {
      schoolOtpRefs.current[index + 1]?.focus();
    }
  };

  /** Navigation backspace dans les inputs OTP SCHOOL. */
  const handleSchoolOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !schoolOtp[index] && index > 0) {
      schoolOtpRefs.current[index - 1]?.focus();
    }
  };

  /** Paste OTP SCHOOL. */
  const handleSchoolOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    // Nettoyer : ne garder que les chiffres (espaces, retours ligne, etc. retirés)
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length) {
      const newOtp = ['', '', '', '', '', ''];
      for (let i = 0; i < pasted.length; i++) newOtp[i] = pasted[i];
      setSchoolOtp(newOtp);
      schoolOtpRefs.current[Math.min(pasted.length, 5)]?.focus();
      // ── Validation AUTOMATIQUE si 6 chiffres collés ──
      if (pasted.length === 6) {
        setTimeout(() => handleSchoolVerifyOtp(pasted), 0);
      }
    }
  };

  /** Vérifie l'OTP SCHOOL et finalise la connexion.
   *  Accepte un code optionnel (utilisé par le paste automatique). */
  const handleSchoolVerifyOtp = async (codeOverride?: string) => {
    const otpCode = codeOverride || schoolOtp.join('');
    if (otpCode.length !== 6) {
      setError('Veuillez saisir les 6 chiffres du code');
      return;
    }
    if (!schoolGooglePendingToken) {
      setError('Session invalide. Veuillez recommencer.');
      setSchoolGooglePending(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/school-auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pendingToken: schoolGooglePendingToken,
          otp: otpCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Code OTP invalide');
      // Persiste la session (compatible avec le système existant)
      persistClientSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        serverSessionId: data.serverSessionId,
        user: data.user,
        tenant: data.tenant,
        portalType: 'SCHOOL',
        expiresAt: data.expiresAt,
      });
      markFreshLogin();
      // Redirige vers /app
      const redirectUrl = getTenantRedirectUrl({
        tenantSlug: tenantSlug || data.tenant?.slug || data.tenant?.id,
        tenantId: tenantIdFromUrl || data.tenant?.id,
        path: redirectPath,
        portalType: 'SCHOOL',
      });
      window.location.href = redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur vérification OTP');
      setSchoolOtp(['', '', '', '', '', '']);
      schoolOtpRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  /** Annule le flow Google SCHOOL et revient au formulaire classique. */
  const handleSchoolGoogleCancel = () => {
    setSchoolGooglePending(false);
    setSchoolGooglePendingToken(null);
    setSchoolGoogleEmail('');
    setSchoolOtp(['', '', '', '', '', '']);
    setError(null);
    // Nettoyer l'URL pour empêcher l'useEffect de re-ouvrir le modal
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('otp_pending');
      url.searchParams.delete('token');
      url.searchParams.delete('email');
      url.searchParams.delete('portal');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const formBlockKey = portalType || 'standard';

  // ── Niveaux disponibles selon le type de candidat (conforme au document) ──
  // Renvoie les classes disponibles pour un type de candidat (= schoolLevelId).
  // Plus de hardcoding : les classes sont fetchées depuis le backend au mount
  // du composant et filtrées par schoolLevelId ici.
  const getClassesForCandidateType = (type: PublicCandidateType): ClassInfo[] => {
    if (type === 'PROSPECT_PARENT') return [];
    return schoolClasses.filter(c => c.schoolLevelId === type);
  };

  return (
    <div className={portalType === 'public'
        ? 'relative min-h-screen w-full overflow-hidden'
        : 'relative flex min-h-screen w-full items-center justify-center overflow-hidden px-2 py-6 sm:px-4 sm:py-10 lg:px-6'}
      style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #e8edf7 50%, #f5f0ff 100%)' }}>

      {/* ── Particules académiques animées (mixed = visibles sur fond blanc ET navy) ── */}
      <AcademicParticles variant="mixed" />

      {/* ── Background blobs — palette Helm ── */}
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
        {!shouldReduceMotion ? (
          <>
            <motion.div
              className="absolute -left-20 top-24 h-72 w-72 rounded-full blur-3xl"
              style={{ backgroundColor: `${NAVY}25` }}
              animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute -right-16 bottom-24 h-80 w-80 rounded-full blur-3xl"
              style={{ backgroundColor: `${GOLD}20` }}
              animate={{ x: [0, -16, 0], y: [0, 14, 0] }}
              transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl"
              style={{ background: `${BLUE}18` }}
              animate={{ scale: [1, 1.06, 1], opacity: [0.25, 0.38, 0.25] }}
              transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        ) : null}
      </div>

      {/* ── Navigation ── */}
      <motion.nav
        initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: dur }}
        className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-3 py-3 sm:px-8 sm:py-4"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-2 min-h-[44px] text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:text-slate-900"
          style={{ borderColor: `${NAVY}18` }}
        >
          <Home className="h-4 w-4" style={{ color: NAVY }} />
          Accueil
        </Link>
        <Link
          href={backToPortalHref}
          className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-2 min-h-[44px] text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:text-slate-900"
          style={{ borderColor: `${NAVY}18` }}
        >
          <ArrowLeft className="h-4 w-4" />
          Portails
        </Link>
      </motion.nav>

      {/* ── Main login card — layout paysage (ou plein écran pour le portail public) ── */}
      <div className={portalType === 'public'
          ? 'relative z-10 w-full h-full min-h-screen'
          : 'relative z-10 w-full max-w-4xl px-0 sm:px-0'}>
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 20, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: dur, ease: 'easeOut' }}
          className={portalType === 'public'
            ? 'bg-white/95 overflow-hidden h-full min-h-screen'
            : 'rounded-2xl border bg-white/95 shadow-2xl backdrop-blur-md overflow-hidden'}
          style={portalType === 'public' ? undefined : {
            borderColor: `${NAVY}18`,
            boxShadow: `0 24px 48px -12px ${NAVY}14, 0 0 0 1px ${GOLD}12`,
          }}
        >
          <div
            className={portalType === 'public'
              ? 'flex flex-col md:flex-row min-h-screen'
              : `flex flex-col md:flex-row ${portalType === 'public' ? 'public-portal-container' : ''}`}
            style={portalType === 'public' ? undefined : {
              minHeight: portalType === 'public' ? '600px' : '480px',
            }}
          >
            {/* ── Colonne gauche : infos école (fond bleu palette Helm) ── */}
            {/* Structure harmonisée pour TOUS les portails :
                1. HEADER (top)    : badge portail (icône + libellé)
                2. CENTRE (middle) : logo + nom école + slogan + infos clés (centré verticalement)
                3. FOOTER (bottom) : "Propulsé par Academia Helm" + logo AH */}
            <div className={portalType === 'public'
              ? 'md:w-1/4 p-6 sm:p-8 flex flex-col relative overflow-hidden'
              : 'flex-1 p-6 sm:p-8 flex flex-col relative overflow-hidden'}
              style={{ background: `linear-gradient(155deg, ${NAVY} 0%, ${BLUE} 100%)` }}>
              {/* ── Décor bleu : halos lumineux subtils ── */}
              <div className="pointer-events-none absolute -top-16 -left-10 h-48 w-48 rounded-full opacity-25 blur-3xl" style={{ background: '#ffffff' }} aria-hidden />
              <div className="pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full opacity-15 blur-3xl" style={{ background: `${GOLD}` }} aria-hidden />

          {/* ════════════════════════════════════════════════════════════════════
              1. HEADER (top) : Badge portail (icône + libellé)
              Affiché pour TOUS les portails (sauf portalType === null = sélection)
              ════════════════════════════════════════════════════════════════════ */}
          {portalType && portalDef && (
            <motion.div
              className="flex justify-center pt-2 pb-4"
              variants={heroVariants}
              initial="hidden"
              animate="show"
            >
              <motion.span
                variants={heroItem}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold"
                style={{
                  color: '#fff',
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <portalDef.Icon className="h-3 w-3" />
                {portalDef.title}
              </motion.span>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              2. CENTRE (middle) : Logo + Nom école + Slogan + Infos clés
              Centré verticalement (flex-1 + justify-center)
              ════════════════════════════════════════════════════════════════════ */}
          <motion.div
            className="flex-1 flex flex-col items-center justify-center text-center"
            variants={heroVariants}
            initial="hidden"
            animate="show"
          >
            {/* Logo — cercle parfait + jeu lumineux */}
            <motion.div variants={heroItem} className="mb-3 flex justify-center">
              <LogoCircle
                logoUrl={clientBranding?.logoUrl}
                alt={clientBranding?.name || BRAND.name}
                size={96}
              />
            </motion.div>

            {/* Nom de l'école (ou nom par défaut) */}
            <motion.div variants={heroItem} className="mb-1.5">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                {clientBranding?.name || schoolNameFromUrl || portalDef?.title || BRAND.name}
              </h1>
            </motion.div>

            {/* Sous-titre : pour le portail public on n'affiche PAS portalDef.subtitle
                (redondant avec le badge "Portail Public" en haut). On affiche seulement
                le slogan de l'école si disponible, sinon rien. */}
            <motion.p variants={heroItem} className="text-sm text-blue-100 max-w-xs">
              {portalType === 'public'
                ? (clientBranding?.slogan || clientBranding?.motto || '')
                : (portalDef?.subtitle || clientBranding?.slogan || BRAND.subtitle)}
            </motion.p>

            {/* Slogan école (si différent du sous-titre et mode non-public) */}
            {portalType !== 'public' && clientBranding?.slogan && portalDef?.subtitle && clientBranding.slogan !== portalDef.subtitle && (
              <motion.p variants={heroItem} className="mt-2 text-xs italic text-blue-200/80 max-w-xs">
                « {clientBranding.slogan} »
              </motion.p>
            )}

            {/* ── Infos clés école (si branding résolu) ──
                Adresse / Téléphone / Website alignés à gauche (plus lisible pour des coordonnées)
                Le reste reste centré. */}
            {clientBranding && (clientBranding.address || clientBranding.phone || clientBranding.website) && (
              <motion.div variants={heroItem} className="mt-4 text-left text-[11px] text-blue-100/90 space-y-1.5">
                {clientBranding.address && (
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-blue-200/70" />
                    <span>{clientBranding.address}{clientBranding.city ? `, ${clientBranding.city}` : ''}</span>
                  </div>
                )}
                {clientBranding.phone && (
                  <div className="flex items-start gap-1.5">
                    <Phone className="h-3 w-3 mt-0.5 shrink-0 text-blue-200/70" />
                    <span>{clientBranding.phone}</span>
                  </div>
                )}
                {clientBranding.website && (
                  <div className="flex items-start gap-1.5">
                    <Globe className="h-3 w-3 mt-0.5 shrink-0 text-blue-200/70" />
                    <span className="break-all">{clientBranding.website}</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Portal selection buttons (school subdomain context, portalType === null) ── */}
            {portalType === null && accessContext === 'school-subdomain' && (
              <motion.div variants={heroItem} className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-xs">
                {([
                  { type: 'school' as const, label: 'École', Icon: Building2, desc: 'Direction, admin' },
                  { type: 'teacher' as const, label: 'Enseignant', Icon: GraduationCap, desc: 'Pédagogie' },
                  { type: 'parent' as const, label: 'Parent / Élève', Icon: Users, desc: 'Suivi' },
                  { type: 'public' as const, label: 'Public', Icon: Globe, desc: 'Pré-inscription' },
                ]).map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setPortalType(opt.type)}
                    className="flex flex-col items-center gap-1 rounded-xl border-2 p-3 min-h-[56px] text-center transition-all hover:shadow-md text-white"
                    style={{
                      borderColor: 'rgba(255,255,255,0.25)',
                      background: 'rgba(255,255,255,0.08)',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    <opt.Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: '#ffffff' }} />
                    <span className="text-[11px] sm:text-xs font-bold text-white">{opt.label}</span>
                    <span className="text-[9px] sm:text-[10px] text-blue-200">{opt.desc}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </motion.div>

          {/* ════════════════════════════════════════════════════════════════════
              3. FOOTER (bottom) : "Propulsé par Academia Helm" + logo AH
              Toujours affiché (même sans branding école, car c'est le footer plateforme)
              ════════════════════════════════════════════════════════════════════ */}
          <motion.div
            className="pt-4 flex items-center justify-center gap-2 text-[10px] text-blue-200"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <span>Propulsé par</span>
            <Image
              src="https://www.academiahelm.com/images/logo-Academia%20Hub.png"
              alt={BRAND.name}
              width={56}
              height={20}
              className="object-contain opacity-90"
              style={{ filter: 'brightness(1.1)' }}
            />
            <span className="font-semibold" style={{ color: GOLD }}>{BRAND.name}</span>
          </motion.div>

          {/* ── Error display ── */}
          <AnimatePresence>
            {error ? (
              <motion.div
                key="login-error"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: dur * 0.85 }}
                className="mb-3"
              >
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/95 p-3 shadow-sm">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  <div>
                    <p className="text-sm text-red-800">{error}</p>
                    {error.toLowerCase().includes('identifiant') && (
                      <p className="mt-1 text-xs text-red-600">
                        Vérifiez vos identifiants et assurez-vous d&apos;être sur le bon portail.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* ── Idle logout message ── */}
          <AnimatePresence>
            {idleLogoutMessage && !error ? (
              <motion.div
                key="idle-logout-info"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: dur * 0.85 }}
                className="mb-3"
              >
                <div className="flex items-start gap-2 rounded-xl border bg-amber-50/95 p-3 shadow-sm" style={{ borderColor: `${GOLD}50` }}>
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: GOLD }} />
                  <p className="text-sm" style={{ color: NAVY }}>{idleLogoutMessage}</p>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* ── Dev OTP display ── */}
          <AnimatePresence>
            {parentOtpSent && parentOtpCode && process.env.NODE_ENV === 'development' ? (
              <motion.div
                key="dev-otp"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-3 rounded-xl border bg-amber-50/95 p-3"
                style={{ borderColor: `${GOLD}50` }}
              >
                <p className="mb-1 text-sm font-semibold" style={{ color: NAVY }}>
                  Code OTP (DEV)
                </p>
                <p className="text-center text-2xl font-bold tracking-widest" style={{ color: NAVY }}>
                  {parentOtpCode}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* ── Pre-enrollment success message (PUBLIC portal) ──
              Maintenant affiché comme un MODAL overlay (voir plus bas dans le JSX),
              pas inline dans la colonne navy. */}

            </div>{/* ── Fin colonne gauche ── */}

            {/* ── Séparateur vertical (fondu bleu → blanc) ── */}
            <div className="hidden md:flex items-center">
              <div className="w-px h-4/5" style={{ background: `linear-gradient(to bottom, transparent, ${GOLD}55, transparent)` }} />
            </div>
            <div className="md:hidden h-px" style={{ background: `linear-gradient(to right, transparent, ${GOLD}55, transparent)` }} />

            {/* ── Colonne droite : formulaire de connexion ── */}
            {/* Pour le portail public : contenu centré avec max-width, padding généreux, aération */}
            <div
              className={portalType === 'public'
                ? 'md:flex-[3] p-6 sm:p-8 lg:p-12 flex flex-col items-center justify-start overflow-y-auto'
                : 'flex-1 p-6 sm:p-8 flex flex-col justify-center'
              }
            >
            {/* Conteneur centré pour le portail public — évite les champs trop larges */}
            {/* On utilise un wrapper div avec className conditionnelle au lieu d'un conditionnel && */}
            {/* car le contenu (form + footer) doit être à l'intérieur du wrapper */}
            <div className={portalType === 'public' ? 'w-full max-w-xl mx-auto py-4' : 'contents'}>

          {/* ════════════════════════════════════════════════════════════════
              FORMULAIRES D'AUTHENTIFICATION PAR PORTAIL
              Conformes au document academia-helm-portails.md
              ════════════════════════════════════════════════════════════════ */}

          <form
            onSubmit={handleSubmit}
            className={portalType === 'public' ? 'space-y-5' : 'space-y-3 sm:space-y-4'}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={formBlockKey}
                initial={shouldReduceMotion ? false : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, x: -12 }}
                transition={{ duration: dur, ease: 'easeOut' }}
                className={portalType === 'public' ? 'space-y-5' : 'space-y-3 sm:space-y-4'}
              >
                {/* ── PLATFORM + SCHOOL : Email + Mot de passe ── */}
                {(isStandardLogin || portalType === 'school' || portalType === 'platform') && (
                  <>
                    {/* Email field */}
                    <div>
                      <label
                        htmlFor={`email-${tenantStorageKey}`}
                        className="mb-1.5 block text-sm font-semibold text-slate-900"
                      >
                        Adresse email
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Mail className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="email"
                          id={`email-${tenantStorageKey}`}
                          name={`email_${tenantStorageKey}`}
                          autoComplete="email"
                          required
                          value={schoolCredentials.email}
                          onChange={(e) =>
                            setSchoolCredentials({
                              ...schoolCredentials,
                              email: e.target.value,
                            })
                          }
                          className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-4 min-h-[44px] transition-all placeholder:text-slate-400 focus:ring-2"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder={
                            portalType === 'platform'
                              ? 'admin@academiahelm.com'
                              : 'votre.email@etablissement.com'
                          }
                        />
                        {emailTouched && schoolCredentials.email && (
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            {emailError ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            )}
                          </div>
                        )}
                      </div>
                      {getSavedEmailForTenant(tenantStorageKey) && (
                        <p className="mt-1 text-xs text-slate-500">
                          Dernière connexion pour cet établissement (ce poste uniquement).
                        </p>
                      )}
                    </div>

                    {/* Password field */}
                    <div>
                      <label
                        htmlFor={`password-${tenantStorageKey}`}
                        className="mb-1.5 block text-sm font-semibold text-slate-900"
                      >
                        Mot de passe
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Lock className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id={`password-${tenantStorageKey}`}
                          name={`password_${tenantStorageKey}`}
                          autoComplete="current-password"
                          required
                          value={schoolCredentials.password}
                          onChange={(e) => {
                            setSchoolCredentials({
                              ...schoolCredentials,
                              password: e.target.value,
                            })
                          }}
                          className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-4 min-h-[44px] transition-all placeholder:text-slate-400 focus:ring-2"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 flex items-center justify-center w-11 min-h-[44px] pr-1 text-slate-400 hover:text-slate-700 transition-colors"
                          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {/* Password strength indicator */}
                      {passwordTouched && schoolCredentials.password && (
                        <div className="mt-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((level) => (
                              <div
                                key={level}
                                className="h-1 flex-1 rounded-full transition-all duration-300"
                                style={{
                                  backgroundColor: passwordStrength.score >= level
                                    ? passwordStrength.color
                                    : '#e2e8f0',
                                }}
                              />
                            ))}
                          </div>
                          <p className="mt-1 text-[10px] text-slate-500">
                            Force : <span style={{ color: passwordStrength.color }}>{passwordStrength.label}</span>
                          </p>
                        </div>
                      )}
                      {/* Mot de passe oublié — en dessous à droite */}
                      <div className="mt-1.5 flex justify-end">
                        <Link
                          href={forgotPasswordHref}
                          className="text-xs font-medium transition-colors hover:underline min-h-[44px] inline-flex items-center"
                          style={{ color: BLUE }}
                        >
                          Mot de passe oublié ?
                        </Link>
                      </div>
                    </div>
                  </>
                )}

                {/* ── TEACHER : Matricule + Mot de passe ── */}
                {portalType === 'teacher' && (
                  <>
                    <div>
                      <label
                        htmlFor="teacherIdentifier"
                        className="mb-1.5 block text-sm font-semibold text-slate-900"
                      >
                        Matricule / Identifiant
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <User className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          id="teacherIdentifier"
                          required
                          value={teacherCredentials.teacherIdentifier}
                          onChange={(e) =>
                            setTeacherCredentials({
                              ...teacherCredentials,
                              teacherIdentifier: e.target.value,
                            })
                          }
                          className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-4 min-h-[44px] transition-all placeholder:text-slate-400 focus:ring-2"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder="EMP001"
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Votre matricule vous a été communiqué par l&apos;établissement.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="teacherPassword"
                        className="mb-1.5 block text-sm font-semibold text-slate-900"
                      >
                        Mot de passe
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Lock className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="teacherPassword"
                          required
                          value={teacherCredentials.password}
                          onChange={(e) => {
                            setTeacherCredentials({
                              ...teacherCredentials,
                              password: e.target.value,
                            })
                          }}
                          className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-4 min-h-[44px] transition-all placeholder:text-slate-400 focus:ring-2"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 flex items-center justify-center w-11 min-h-[44px] pr-1 text-slate-400 hover:text-slate-700 transition-colors"
                          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {/* Password strength */}
                      {passwordTouched && teacherCredentials.password && (
                        <div className="mt-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((level) => (
                              <div
                                key={level}
                                className="h-1 flex-1 rounded-full transition-all duration-300"
                                style={{
                                  backgroundColor: passwordStrength.score >= level
                                    ? passwordStrength.color
                                    : '#e2e8f0',
                                }}
                              />
                            ))}
                          </div>
                          <p className="mt-1 text-[10px] text-slate-500">
                            Force : <span style={{ color: passwordStrength.color }}>{passwordStrength.label}</span>
                          </p>
                        </div>
                      )}
                      {/* Mot de passe oublié — en dessous à droite */}
                      <div className="mt-1.5 flex justify-end">
                        <Link
                          href={forgotPasswordHref}
                          className="text-xs font-medium transition-colors hover:underline min-h-[44px] inline-flex items-center"
                          style={{ color: BLUE }}
                        >
                          Mot de passe oublié ?
                        </Link>
                      </div>
                    </div>
                  </>
                )}

                {/* ── PARENT : Téléphone + OTP ── */}
                {portalType === 'parent' && (
                  <>
                    <div>
                      <label
                        htmlFor="phone"
                        className="mb-1.5 block text-sm font-semibold text-slate-900"
                      >
                        Numéro de téléphone
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Phone className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="tel"
                          id="phone"
                          required
                          disabled={parentOtpSent}
                          value={parentCredentials.phone}
                          onChange={(e) =>
                            setParentCredentials({
                              ...parentCredentials,
                              phone: e.target.value,
                            })
                          }
                          className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-4 min-h-[44px] transition-all placeholder:text-slate-400 focus:ring-2 disabled:bg-slate-100"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder="+229 90 00 00 00"
                        />
                        {phoneTouched && parentCredentials.phone && !parentOtpSent && (
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            {phoneError ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            )}
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Numéro utilisé lors de l&apos;inscription de votre enfant.
                      </p>
                    </div>

                    <AnimatePresence>
                      {parentOtpSent ? (
                        <motion.div
                          key="otp-field"
                          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={shouldReduceMotion ? undefined : { opacity: 0, y: 6 }}
                          transition={{ duration: dur, ease: 'easeOut' }}
                        >
                          <label
                            htmlFor="otp"
                            className="mb-1.5 block text-sm font-semibold text-slate-900"
                          >
                            Code OTP
                          </label>
                          <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                              <KeyRound className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                              type="text"
                              id="otp"
                              required
                              value={parentCredentials.otp || ''}
                              onChange={(e) =>
                                setParentCredentials({
                                  ...parentCredentials,
                                  otp: e.target.value,
                                })
                              }
                              className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-4 min-h-[44px] transition-all placeholder:text-slate-400 focus:ring-2"
                              style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                              placeholder="123456"
                              maxLength={6}
                              inputMode="numeric"
                              autoComplete="one-time-code"
                            />
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            Un code OTP a été envoyé à votre numéro de téléphone.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setParentOtpSent(false);
                              setParentOtpCode('');
                              setParentCredentials((prev) => ({ ...prev, otp: '' }));
                            }}
                            className="mt-1 text-xs font-medium transition-colors hover:underline min-h-[44px] inline-flex items-center"
                            style={{ color: BLUE }}
                          >
                            Renvoyer le code
                          </button>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </>
                )}

                {/* ── PUBLIC : Pré-inscription (aucune authentification requise) ── */}
                {portalType === 'public' && !preEnrollmentSubmitted && (
                  <div className="public-pre-enrollment"> {/* wrapper pour styles compacts (voir globals.css) */}
                    {/* ── En-tête wizard : indicateur d'étapes (3 pastilles) ── */}
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center gap-1.5">
                          <div
                            className="flex items-center justify-center rounded-full text-[10px] font-bold transition-all"
                            style={{
                              width: 22, height: 22,
                              background: preEnrollmentStep >= s ? NAVY : '#e2e8f0',
                              color: preEnrollmentStep >= s ? '#fff' : '#94a3b8',
                            }}
                          >
                            {preEnrollmentStep > s ? '✓' : s}
                          </div>
                          {s < 3 && (
                            <div
                              className="h-0.5 w-6 transition-all"
                              style={{ background: preEnrollmentStep > s ? NAVY : '#e2e8f0' }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="text-center mb-3">
                      <p className="text-xs font-bold" style={{ color: NAVY }}>
                        {preEnrollmentStep === 1 ? 'Étape 1 sur 3 — Responsable légal' :
                         preEnrollmentStep === 2 ? 'Étape 2 sur 3 — Identité de l\'élève' :
                         'Étape 3 sur 3 — Documents & message'}
                      </p>
                    </div>

                    {/* ── ÉTAPE 1 : Type de candidat + Responsable légal (parent) ── */}
                    {preEnrollmentStep === 1 && (
                    <>
                    {/* Type de candidat */}
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-900">
                        Vous souhaitez inscrire un enfant en
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {schoolInfoLoading ? (
                          <div className="col-span-2 text-center py-3 text-xs text-slate-400">
                            Chargement des niveaux...
                          </div>
                        ) : schoolLevels.length === 0 ? (
                          <div className="col-span-2 text-center py-3 text-xs text-amber-600 bg-amber-50 rounded-lg">
                            Aucun niveau scolaire configuré pour cet établissement.
                            Contactez l'administration.
                          </div>
                        ) : (
                          <>
                            {schoolLevels.map((level) => {
                              // Icône selon le nom du niveau (best-effort)
                              const levelName = (level.name || '').toUpperCase();
                              const Icon = levelName.includes('MATERNELLE') ? Baby
                                : levelName.includes('PRIMAIRE') ? BookOpen
                                : levelName.includes('SECONDAIRE') ? GradCap
                                : BookOpen;
                              // Description : nombre de classes disponibles pour ce niveau
                              const classCount = schoolClasses.filter(c => c.schoolLevelId === level.id).length;
                              const desc = classCount > 0
                                ? `${classCount} classe${classCount > 1 ? 's' : ''}`
                                : 'Aucune classe';
                              return (
                                <button
                                  key={level.id}
                                  type="button"
                                  onClick={() => {
                                    setPreEnrollment((prev) => ({ ...prev, candidateType: level.id, targetClass: '' }));
                                    setPreEnrollmentStep(1);
                                    setError(null);
                                  }}
                                  className="flex flex-col items-center gap-1 rounded-xl border-2 p-3 min-h-[44px] text-center transition-all"
                                  style={{
                                    borderColor: preEnrollment.candidateType === level.id ? GOLD : `${NAVY}18`,
                                    background: preEnrollment.candidateType === level.id ? `${GOLD}12` : `${NAVY}04`,
                                  }}
                                >
                                  <Icon className="h-5 w-5" style={{ color: NAVY }} />
                                  <span className="text-xs font-bold" style={{ color: NAVY }}>{level.name}</span>
                                  <span className="text-[10px] text-slate-500">{desc}</span>
                                </button>
                              );
                            })}
                            {/* Carte "Juste info" — toujours présente (parent prospect) */}
                            <button
                              type="button"
                              onClick={() => {
                                setPreEnrollment((prev) => ({ ...prev, candidateType: 'PROSPECT_PARENT', targetClass: '' }));
                                setPreEnrollmentStep(1);
                                setError(null);
                              }}
                              className="flex flex-col items-center gap-1 rounded-xl border-2 p-3 min-h-[44px] text-center transition-all"
                              style={{
                                borderColor: preEnrollment.candidateType === 'PROSPECT_PARENT' ? GOLD : `${NAVY}18`,
                                background: preEnrollment.candidateType === 'PROSPECT_PARENT' ? `${GOLD}12` : `${NAVY}04`,
                              }}
                            >
                              <Users className="h-5 w-5" style={{ color: NAVY }} />
                              <span className="text-xs font-bold" style={{ color: NAVY }}>Juste info</span>
                              <span className="text-[10px] text-slate-500">Parent prospect</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Parent info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-900">
                          Prénom (parent)
                        </label>
                        <input
                          type="text"
                          required
                          value={preEnrollment.parentFirstName}
                          onChange={(e) => setPreEnrollment((prev) => ({ ...prev, parentFirstName: e.target.value }))}
                          className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder="Prénom"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-900">
                          Nom (parent)
                        </label>
                        <input
                          type="text"
                          required
                          value={preEnrollment.parentLastName}
                          onChange={(e) => setPreEnrollment((prev) => ({ ...prev, parentLastName: e.target.value }))}
                          className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder="Nom"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-900">
                          Téléphone
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Phone className="h-4 w-4 text-slate-400" />
                          </div>
                          <input
                            type="tel"
                            required
                            value={preEnrollment.parentPhone}
                            onChange={(e) => setPreEnrollment((prev) => ({ ...prev, parentPhone: e.target.value }))}
                            className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-9 pr-3 min-h-[44px] text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                            style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                            placeholder="+229 90 00 00 00"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-900">
                          Email
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Mail className="h-4 w-4 text-slate-400" />
                          </div>
                          <input
                            type="email"
                            value={preEnrollment.parentEmail}
                            onChange={(e) => setPreEnrollment((prev) => ({ ...prev, parentEmail: e.target.value }))}
                            className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-9 pr-3 min-h-[44px] text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                            style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                            placeholder="email@exemple.com"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Responsable légal — champs étendus (lien, adresse, profession) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-900">
                          Lien de parenté <span className="text-slate-400 font-normal">(optionnel)</span>
                        </label>
                        <select
                          value={preEnrollment.parentRelationship || ''}
                          onChange={(e) => setPreEnrollment((prev) => ({ ...prev, parentRelationship: e.target.value }))}
                          className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all focus:ring-2"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                        >
                          <option value="">— Sélectionner —</option>
                          <option value="PERE">Père</option>
                          <option value="MERE">Mère</option>
                          <option value="TUTEUR">Tuteur / Tutrice</option>
                          <option value="ONCLE">Oncle</option>
                          <option value="TANTE">Tante</option>
                          <option value="GRAND_PARENT">Grand-parent</option>
                          <option value="FRERE">Frère</option>
                          <option value="SOEUR">Sœur</option>
                          <option value="AUTRE">Autre</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-900">
                          Profession <span className="text-slate-400 font-normal">(optionnel)</span>
                        </label>
                        <input
                          type="text"
                          value={preEnrollment.parentProfession || ''}
                          onChange={(e) => setPreEnrollment((prev) => ({ ...prev, parentProfession: e.target.value }))}
                          className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder="ex : Commerçant"
                        />
                      </div>
                    </div>

                    {/* Adresse du responsable (optionnel) */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-900">
                        Adresse du responsable <span className="text-slate-400 font-normal">(optionnel)</span>
                      </label>
                      <input
                        type="text"
                        value={preEnrollment.parentAddress || ''}
                        onChange={(e) => setPreEnrollment((prev) => ({ ...prev, parentAddress: e.target.value }))}
                        className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                        style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                        placeholder="Quartier, ville"
                      />
                    </div>
                    </>
                    )}

                    {/* ── ÉTAPE 2 : Identité de l'enfant + Classe souhaitée + Vœux académiques ── */}
                    {/* Child info (not for PROSPECT_PARENT) */}
                    {preEnrollment.candidateType !== 'PROSPECT_PARENT' && preEnrollmentStep === 2 && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-900">
                              Prénom de l&apos;enfant
                            </label>
                            <input
                              type="text"
                              required
                              value={preEnrollment.childFirstName}
                              onChange={(e) => setPreEnrollment((prev) => ({ ...prev, childFirstName: e.target.value }))}
                              className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                              style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                              placeholder="Prénom"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-900">
                              Nom de l&apos;enfant
                            </label>
                            <input
                              type="text"
                              required
                              value={preEnrollment.childLastName}
                              onChange={(e) => setPreEnrollment((prev) => ({ ...prev, childLastName: e.target.value }))}
                              className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                              style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                              placeholder="Nom"
                            />
                          </div>
                        </div>

                        {/* Date de naissance + Sexe */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-900">
                              Date de naissance
                            </label>
                            <input
                              type="date"
                              value={preEnrollment.childDateOfBirth || ''}
                              onChange={(e) => setPreEnrollment((prev) => ({ ...prev, childDateOfBirth: e.target.value }))}
                              className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all focus:ring-2"
                              style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-900">
                              Sexe
                            </label>
                            <select
                              value={preEnrollment.childGender || ''}
                              onChange={(e) => setPreEnrollment((prev) => ({ ...prev, childGender: e.target.value }))}
                              className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all focus:ring-2"
                              style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                            >
                              <option value="">— Sélectionner —</option>
                              <option value="M">Masculin</option>
                              <option value="F">Féminin</option>
                            </select>
                          </div>
                        </div>

                        {/* Lieu de naissance + Nationalité */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-900">
                              Lieu de naissance
                            </label>
                            <input
                              type="text"
                              value={preEnrollment.childBirthPlace || ''}
                              onChange={(e) => setPreEnrollment((prev) => ({ ...prev, childBirthPlace: e.target.value }))}
                              className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                              style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                              placeholder="Cotonou"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-900">
                              Nationalité
                            </label>
                            <input
                              type="text"
                              value={preEnrollment.childNationality || 'Béninoise'}
                              onChange={(e) => setPreEnrollment((prev) => ({ ...prev, childNationality: e.target.value }))}
                              className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                              style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                              placeholder="Béninoise"
                            />
                          </div>
                        </div>

                        {/* Classe souhaitée — select dynamique alimenté par les classes
                            configurées dans le module Paramètres pour le niveau sélectionné. */}
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-900">
                            Classe souhaitée
                          </label>
                          <select
                            required
                            value={preEnrollment.targetClass}
                            onChange={(e) => setPreEnrollment((prev) => ({ ...prev, targetClass: e.target.value }))}
                            disabled={preEnrollment.candidateType === 'PROSPECT_PARENT'}
                            className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all focus:ring-2 disabled:bg-slate-100 disabled:text-slate-400"
                            style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          >
                            <option value="">— Sélectionner —</option>
                            {getClassesForCandidateType(preEnrollment.candidateType).map((cls) => (
                              <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                          </select>
                          {preEnrollment.candidateType !== 'PROSPECT_PARENT'
                            && getClassesForCandidateType(preEnrollment.candidateType).length === 0 && (
                            <p className="mt-1 text-[10px] text-amber-600">
                              Aucune classe configurée pour ce niveau. Contactez l'administration.
                            </p>
                          )}
                        </div>

                        {/* Établissement précédent + Dernier niveau fréquenté */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-900">
                              Établissement précédent <span className="text-slate-400 font-normal">(optionnel)</span>
                            </label>
                            <input
                              type="text"
                              value={preEnrollment.previousSchool || ''}
                              onChange={(e) => setPreEnrollment((prev) => ({ ...prev, previousSchool: e.target.value }))}
                              className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                              style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                              placeholder="Nom de l'école précédente"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-900">
                              Dernière classe fréquentée <span className="text-slate-400 font-normal">(optionnel)</span>
                            </label>
                            <input
                              type="text"
                              value={preEnrollment.previousLevel || ''}
                              onChange={(e) => setPreEnrollment((prev) => ({ ...prev, previousLevel: e.target.value }))}
                              className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                              style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                              placeholder="ex : CE1"
                            />
                          </div>
                        </div>

                        {/* Motif de changement (optionnel) */}
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-900">
                            Motif de changement <span className="text-slate-400 font-normal">(optionnel)</span>
                          </label>
                          <input
                            type="text"
                            value={preEnrollment.changeReason || ''}
                            onChange={(e) => setPreEnrollment((prev) => ({ ...prev, changeReason: e.target.value }))}
                            className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                            style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                            placeholder="Déménagement, recherche de meilleure qualité, etc."
                          />
                        </div>
                      </>
                    )}

                    {/* ── ÉTAPE 3 : Pièces justificatives + Message final ── */}
                    {/* Pièces justificatives (upload optionnel) */}
                    {preEnrollment.candidateType !== 'PROSPECT_PARENT' && preEnrollmentStep === 3 && (
                      <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2">
                          <label className="block text-xs font-bold text-slate-900">
                            Pièces justificatives <span className="text-slate-400 font-normal">(optionnel)</span>
                          </label>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Joignez les documents disponibles. Formats : PDF, JPG, PNG, WebP (max 20 Mo / fichier).
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { key: 'birthCertificate', label: 'Acte de naissance sécurisé', required: false },
                            { key: 'idPhoto', label: 'Photo d\'identité', required: false },
                            { key: 'npi', label: 'NPI (élève)', required: false },
                            { key: 'lastReportCard', label: 'Bulletin précédent', required: false },
                            { key: 'schoolCertificate', label: 'Certificat de scolarité', required: false },
                          ].map((docField) => {
                            const docValue = (preEnrollment as any)[docField.key];
                            return (
                              <div key={docField.key} className="bg-white rounded-lg border border-slate-200 p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-semibold text-slate-700 truncate flex-1">
                                    {docField.label}
                                  </span>
                                  {docValue && (
                                    <button
                                      type="button"
                                      onClick={() => setPreEnrollment((prev) => ({ ...prev, [docField.key]: null }))}
                                      className="text-[10px] text-rose-500 hover:bg-rose-50 px-1.5 py-0.5 rounded transition shrink-0"
                                      title="Retirer"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                                {docValue ? (
                                  <div className="mt-1 text-[10px] text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5 truncate">
                                    ✓ {docValue.fileName} ({Math.round(docValue.fileSize / 1024)} Ko)
                                  </div>
                                ) : (
                                  <label
                                    className="mt-1 flex items-center justify-center cursor-pointer border border-dashed border-slate-300 rounded px-2 py-1.5 text-[10px] text-slate-500 hover:bg-slate-50 transition"
                                  >
                                    {isUploadingDoc ? 'Chargement...' : '+ Joindre'}
                                    <input
                                      type="file"
                                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const f = e.target.files?.[0];
                                        if (!f) return;
                                        // Limite 20 Mo
                                        if (f.size > 20 * 1024 * 1024) {
                                          setError('Fichier trop volumineux (max 20 Mo)');
                                          return;
                                        }
                                        setIsUploadingDoc(true);
                                        try {
                                          const dataUrl = await fileToDataUrl(f);
                                          setPreEnrollment((prev) => ({ ...prev, [docField.key]: dataUrl }));
                                        } catch (err: any) {
                                          setError(`Échec lecture fichier : ${err.message}`);
                                        } finally {
                                          setIsUploadingDoc(false);
                                        }
                                      }}
                                    />
                                  </label>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Message — étape 3 */}
                    {preEnrollmentStep === 3 && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-900">
                        Message (optionnel)
                      </label>
                      <textarea
                        value={preEnrollment.message}
                        onChange={(e) => setPreEnrollment((prev) => ({ ...prev, message: e.target.value }))}
                        rows={2}
                        className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all placeholder:text-slate-400 focus:ring-2 resize-none"
                        style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                        placeholder="Précisez votre demande..."
                      />
                    </div>
                    )}

                    {/* ── Navigation wizard : Précédent / Suivant / Soumettre ── */}
                    {portalType === 'public' && !preEnrollmentSubmitted && (
                      <div className="flex items-center justify-between gap-2 pt-2">
                        {preEnrollmentStep > 1 ? (
                          <button
                            type="button"
                            onClick={handlePreEnrollmentBack}
                            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold border-2 transition-all"
                            style={{ borderColor: `${NAVY}30`, color: NAVY, background: '#fff' }}
                          >
                            <ArrowLeft className="h-4 w-4" />
                            Précédent
                          </button>
                        ) : (
                          <div /> /* spacer pour garder le bouton suivant à droite */
                        )}

                        {preEnrollmentStep < 3 ? (
                          <button
                            type="button"
                            onClick={handlePreEnrollmentNext}
                            className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all"
                            style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                          >
                            Suivant
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        ) : null /* étape 3 : le bouton Submit principal prend le relais ci-dessous */}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* ── Cloudflare Turnstile — vérification d'humanité ── */}
            {/* Désactivé pour le portail public (pré-inscription) pour simplifier le flux.
                Actif pour les portails authentifiés si NEXT_PUBLIC_TURNSTILE_SITE_KEY est configuré. */}
            {portalType !== 'public' && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
              <div className="flex justify-center mt-2">
                <TurnstileWidget
                  onToken={setTurnstileToken}
                  onError={handleTurnstileError}
                  onExpire={handleTurnstileExpire}
                />
              </div>
            )}

            {/* ── Submit button — palette Helm unifiée ── */}
            {/* Pour le portail public : n'afficher qu'à l'étape 3 (sinon le bouton "Suivant" gère la navigation) */}
            {!(portalType === 'public' && preEnrollmentSubmitted) && !(portalType === 'public' && preEnrollmentStep < 3) && (
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : { scale: 1.01, boxShadow: `0 14px 32px ${NAVY}22` }
                }
                whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                transition={springSoft}
                className="flex w-full items-center justify-center rounded-xl px-4 sm:px-6 py-3.5 font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
                style={{
                  background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
                }}
              >
                {isLoading ? (
                  <>
                    <Loader className="mr-2 h-5 w-5 animate-spin" />
                    {parentOtpSent && portalType === 'parent'
                      ? 'Vérification...'
                      : portalType === 'public'
                      ? 'Envoi en cours...'
                      : 'Connexion en cours...'}
                  </>
                ) : parentOtpSent && portalType === 'parent' ? (
                  'Vérifier le code OTP'
                ) : portalType === 'public' ? (
                  'Soumettre la pré-inscription'
                ) : (
                  'Se connecter'
                )}
              </motion.button>
            )}

            {/* ── Bouton Google Sign-In — UNIQUEMENT pour le portail ÉCOLE ── */}
            {portalType === 'school' && (
              <>
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-slate-500 uppercase tracking-wider">
                      ou
                    </span>
                  </div>
                </div>
                <motion.button
                  type="button"
                  onClick={handleSchoolGoogleLogin}
                  disabled={isLoading}
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
                >
                  {isLoading ? (
                    <Loader className="h-5 w-5 animate-spin" />
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  Continuer avec Google
                </motion.button>
              </>
            )}

            {/* ── Écran OTP SCHOOL — SUPPRIMÉ du formulaire, déplacé en modal overlay ── */}
          </form>

          {/* ── Footer links ── */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.12, duration: dur }}
            className="mt-3 space-y-2 text-center"
          >
            {!isStandardLogin && portalType !== 'public' ? (
              <Link
                href={backToPortalHref}
                className="inline-flex items-center justify-center text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 min-h-[44px]"
              >
                ← Retour à la sélection du portail
              </Link>
            ) : null}
            {isStandardLogin ? (
              <>
                <p className="text-sm text-slate-600">
                  Pas encore de compte ?{' '}
                  <Link
                    href="/signup"
                    className="font-semibold transition-colors hover:underline inline-flex items-center min-h-[44px]"
                    style={{ color: NAVY }}
                  >
                    Créer mon école
                  </Link>
                </p>
              </>
            ) : null}
            {portalType === 'public' && (
              <p className="text-xs text-slate-500">
                Conforme au document : aucune authentification requise pour le portail public.
                Vos données sont traitées conformément à notre politique de confidentialité.
              </p>
            )}
          </motion.div>
            {/* Fin du conteneur centré pour le portail public */}
            </div>
            </div>{/* ── Fin colonne droite ── */}
          </div>{/* ── Fin flex-row ── */}
        </motion.div>
      </div>

      {/* ── Modal OTP SCHOOL (overlay séparé) — UNIQUEMENT portail ÉCOLE ── */}
      <AnimatePresence>
        {portalType === 'school' && schoolGooglePending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={handleSchoolGoogleCancel}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Bouton fermer */}
              <button
                type="button"
                onClick={handleSchoolGoogleCancel}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Fermer"
              >
                <XCircle className="h-5 w-5" />
              </button>

              <div className="text-center mb-6">
                <div
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: `${GOLD}22` }}
                >
                  <KeyRound className="h-8 w-8" style={{ color: NAVY }} />
                </div>
                <h3 className="text-xl font-bold" style={{ color: NAVY }}>
                  Vérification 2 facteurs
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Code à 6 chiffres envoyé par email à
                  <br />
                  <span className="font-semibold" style={{ color: NAVY }}>
                    {schoolGoogleEmail}
                  </span>
                </p>
              </div>

              {/* 6 inputs OTP */}
              <div className="flex justify-center gap-2 mb-6" onPaste={handleSchoolOtpPaste}>
                {schoolOtp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { schoolOtpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleSchoolOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleSchoolOtpKeyDown(i, e)}
                    className="h-14 w-12 rounded-xl border-2 border-slate-200 text-center text-2xl font-bold transition-all focus:ring-2 focus:border-blue-400 min-h-[44px]"
                    style={{
                      '--tw-ring-color': `${GOLD}40`,
                      color: NAVY,
                    } as React.CSSProperties}
                    aria-label={`Chiffre ${i + 1}`}
                  />
                ))}
              </div>

              {/* Affichage de l'erreur DANS le modal */}
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 text-center">
                  {error}
                </div>
              )}

              <motion.button
                type="button"
                onClick={handleSchoolVerifyOtp}
                disabled={isLoading || schoolOtp.join('').length !== 6}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] mb-3"
                style={{
                  background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
                }}
              >
                {isLoading ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    Vérification...
                  </>
                ) : (
                  <>
                    Vérifier le code
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </motion.button>

              <button
                type="button"
                onClick={handleSchoolGoogleCancel}
                className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors min-h-[44px] mb-2"
              >
                ← Annuler et revenir au formulaire
              </button>

              <p className="text-center text-xs text-slate-400">
                Le code est valide 10 minutes. Vérifiez vos spams si vous ne le recevez pas.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════
          MODAL DE SUCCÈS — Pré-inscription publique (overlay plein écran)
          Affiché après soumission réussie avec animation de confirmation.
          ════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {preEnrollmentSubmitted && portalType === 'public' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Décor : halo vert en haut */}
              <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none" style={{ background: 'linear-gradient(180deg, #dcfce7 0%, transparent 100%)' }} />

              {/* Icône de succès animée */}
              <div className="relative flex justify-center pt-8 pb-4">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, duration: 0.6, type: 'spring', stiffness: 200 }}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500 shadow-lg"
                  style={{ boxShadow: '0 10px 30px -5px rgba(34, 197, 94, 0.5)' }}
                >
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <motion.path
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 0.5, duration: 0.5 }}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </motion.div>
              </div>

              {/* Contenu textuel */}
              <div className="relative px-8 pb-8 text-center">
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-xl font-bold text-slate-900 mb-2"
                >
                  Demande envoyée avec succès !
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-slate-600 leading-relaxed mb-4"
                >
                  Votre demande d'admission a été enregistrée. Un email de confirmation vient
                  {preEnrollment.parentEmail ? (
                    <> de vous être envoyé à <strong className="text-slate-800">{preEnrollment.parentEmail}</strong>.</>
                  ) : (
                    <> de vous être envoyé.</>
                  )}
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="text-xs text-slate-500 leading-relaxed mb-6"
                >
                  Notre équipe pédagogique examinera votre dossier et reviendra vers vous
                  pour les prochaines étapes (entretien, test ou confirmation).
                </motion.p>

                {/* Boutons d'action */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="flex flex-col gap-2"
                >
                  <Link
                    href={backToPortalHref}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Retour aux portails
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setPreEnrollmentSubmitted(false);
                      setPreEnrollmentStep(1);
                      setPreEnrollment({
                        ...preEnrollment,
                        candidateType: 'PROSPECT_PARENT',
                        parentFirstName: '',
                        parentLastName: '',
                        parentPhone: '',
                        parentEmail: '',
                        childFirstName: '',
                        childLastName: '',
                        targetClass: '',
                        message: '',
                      });
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Soumettre une nouvelle demande
                  </button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
