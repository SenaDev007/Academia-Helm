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
  WifiOff,
  XCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TurnstileWidget from '@/components/auth/TurnstileWidget';
import LogoCircle from '@/components/ui/LogoCircle';
import { BRAND } from '@/lib/brand';
import { getSavedEmailForTenant, saveEmailForTenant } from '@/lib/auth/saved-email';
import { persistClientSession, markFreshLogin, hasLocalSessionHints, isRecentlyLoggedOut, clearRecentlyLoggedOutFlag, clearClientSessionSync } from '@/lib/auth/client-access-token';
// ⭐ NATIVE SESSION RESUME — mémoriser l'hôte tenant quand une session valide
//    est détectée sur /login (transition douce pour les sessions pré-existantes).
import { isMobileDevice } from '@/lib/pwa/mobile-experience';
import { writeNativeResumeHint } from '@/lib/auth/native-session-resume';
// ⭐ v3.4.0 — enveloppe d'auth hors ligne : re-login offline après un logout
//    (même école + même identifiant + même mot de passe → session restaurée)
import { saveOfflineAuthEnvelope, tryOfflineLogin } from '@/lib/auth/offline-auth-envelope';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import { getMotionDuration } from '@/lib/motion/presets';
import { getTenantRedirectUrl } from '@/lib/utils/tenant-redirect';
import { getAppBaseUrl } from '@/lib/utils/urls';
import { isReservedSubdomain, extractTenantSlug } from '@/lib/tenant/constants';
import { detectAccessContext, getAvailablePortals, getPortalForRole, canRoleUsePortal } from '@/lib/auth/role-portal-map';
import { useFetchWithTimeout } from '@/lib/hooks/use-fetch-with-timeout';
import { useSchoolBranding } from '@/hooks/useSchoolBranding';
import AcademicParticles from './AcademicParticles';
// ⭐ Tenant de test Academia Helm — panneau d'identifiants de test (École/Enseignant/Parent)
import TestCredentialsModal from '@/components/auth/TestCredentialsModal';
import {
  consumeTestCredentialPrefill,
  isTestCredentialsTenant,
  type TestAccount,
} from '@/lib/auth/test-credentials';

type PortalType = 'platform' | 'school' | 'teacher' | 'parent' | 'public' | null;

/** Contexte d'accès détecté (domaine principal vs sous-domaine école) */
type AccessContext = 'main-domain' | 'school-subdomain';

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
  /** "PHONE" (par défaut) ou "EMAIL". */
  identifierType?: 'PHONE' | 'EMAIL';
  /** Numéro de téléphone (mode PHONE) ou email (mode EMAIL — peut utiliser phone comme champ unique côté UI). */
  phone: string;
  /** Code OTP (mode OTP, étape 2). */
  otp?: string;
  /** Mot de passe (mode EMAIL + password, 1 étape). */
  password?: string;
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

/** Évalue la force d'un mot de passe — { score, label } ; la couleur est
 *  résolue à l'usage (palette de l'école) car GOLD/BLUE vivent désormais
 *  DANS le composant (palette dynamique par école — 2026-11-27). */
function getPasswordStrength(password: string): { score: number; label: string } {
  if (!password) return { score: 0, label: '—' };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 1, label: 'Faible' };
  if (score <= 4) return { score: 2, label: 'Moyen' };
  if (score <= 5) return { score: 3, label: 'Bon' };
  return { score: 4, label: 'Fort' };
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
  /** ⭐ 2026-11-27 — palette du logo de l'école (voir useSchoolBranding). */
  brandColors?: import('@/lib/tenant/tenant-colors-core').TenantColors | null;
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

  // ── Palette de la page — conforme à la charte de L'ÉCOLE ──
  // ⭐ 2026-11-27 — Demande promoteur : venue depuis le site institutionnel,
  // la page portail (login) doit suivre la palette du logo de l'école tenante.
  // Résolution : server component → sessionStorage (posé par le site
  // institutionnel) → BFF (?tenant= / sous-domaine). Fallback = charte
  // Academia Helm (les écoles sans palette restent inchangées).
  const brandPalette = clientBranding?.brandColors || schoolBranding?.brandColors || null;
  const NAVY = brandPalette?.primary || '#0b2f73';
  const BLUE = brandPalette?.secondary || '#1d4fa5';
  const GOLD = brandPalette?.accent || '#f5b335';

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
  // ⛔ AUTO-REDIRECT VERS /app DÉSACTIVÉ — causait une boucle infinie après logout
  // =================================================================
  // AVANT : si hasLocalSessionHints() retournait true, on redirigeait vers /app
  //         sans validation réseau. Problème : après logout, des données stale
  //         persistent en localStorage (Cache API non nettoyée, service worker,
  //         cache navigateur servant vieux bundle JS) → hasLocalSessionHints() = true
  //         → redirect vers /app → AppGate détecte session invalide → redirect vers
  //         /login → useEffect re-fire → hasLocalSessionHints() encore true → BOUCLE
  //         INFINIE. Le user devait nettoyer le cache navigateur pour s'en sortir.
  //
  // APRÈS : on ne redirige PLUS automatiquement vers /app. Le user qui a une session
  //         valide peut cliquer sur "Continuer vers le tableau de bord" (bouton
  //         affiché si une session valide est détectée via /api/auth/session).
  //         Si la session est invalide (cas post-logout), on reste sur /login et on
  //         affiche le formulaire normalement.
  //
  // Pour les utilisateurs qui avaient l'habitude de l'auto-redirect (offline-first) :
  //   - Le formulaire de login reste accessible
  //   - Un bouton "Continuer" apparaît si une session valide est détectée
  //   - Le user n'est jamais bloqué dans une boucle
  //
  // Anti-blink preserved : si logout a eu lieu récemment (60s grace period), on ne
  // tente même pas de valider la session — le formulaire est affiché immédiatement.
  useEffect(() => {
    // ⭐ Si logout a eu lieu dans les 60 dernières secondes, NE PAS tenter de valider
    if (isRecentlyLoggedOut(60000)) {
      console.log('[LoginPage] Skip session validation — logout was recent (within 60s grace period)');
      return;
    }
    // ⭐ Si on n'a pas de session hints en localStorage, ne rien faire — afficher le form
    if (!hasLocalSessionHints()) {
      return;
    }
    // ⭐ On a des session hints mais on ne sait pas s'ils sont valides.
    //    Au lieu de rediriger aveuglément vers /app (qui causait la boucle),
    //    on valide SILENCIEUSEMENT via /api/auth/me. Si invalide, on nettoie
    //    localStorage pour éviter les futurs faux positifs.
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          // Session valide — sur MOBILE (nov. 2026 — retour promoteur « aller
          // dans l'application sans être déconnecté ») : redirection
          // AUTOMATIQUE vers l'app. La boucle historique login↔app provenait
          // d'une redirection SANS validation réseau ; ici la session vient
          // d'être VALIDÉE par le serveur (200) — aucun risque de boucle (au
          // pire, après logout la grâce 60 s + le nettoyage localStorage
          // neutralisent tout cycle résiduel).
          // Desktop : comportement inchangé — bouton « Continuer vers le
          // tableau de bord » (jamais de flash de redirection non sollicité).
          console.log('[LoginPage] Valid session detected');
          // ⭐ MOBILE SESSION RESUME : session valide détectée sur l'hôte tenant
          //    → mémoriser l'hôte pour les prochains démarrages mobiles (retour
          //    direct à la page institutionnelle de l'école, sans /portal).
          if (isMobileDevice()) {
            writeNativeResumeHint();
            // ⭐ Auto-redirect mobile : l'utilisateur vient de la page
            //    institutionnelle de son école (ou rouvre /login) avec une
            //    session valide — il entre DIRECTEMENT dans l'application.
            //    redirectPath vaut '/app' sauf ?redirect= explicite.
            window.location.href = redirectPath || '/app';
          }
        } else {
          // Session invalide — nettoyer localStorage pour éviter les faux positifs futurs
          console.log('[LoginPage] Session invalid — clearing stale localStorage data');
          clearClientSessionSync();
          // ⭐ Marquer qu'on vient de nettoyer pour empêcher toute redirection
          //    ultérieure dans les 60 prochaines secondes
          try {
            sessionStorage.setItem('academia_just_logged_out', Date.now().toString());
          } catch {}
        }
      } catch (e) {
        // Erreur réseau — ne rien faire, afficher le formulaire
        console.warn('[LoginPage] Session validation failed (network error):', e);
      }
    })();
  }, []); // Au montage uniquement

  // ⭐ COLD-START WARM-UP (2026-10-19) — chaque route API Next.js sur Vercel
  //    est une lambda SÉPARÉE qui s'endort après une période d'inactivité.
  //    Au premier login de l'app (matin, lambda froide), le POST /api/auth/login
  //    peut démarrer par 3-10 s de boot lambda + latence réseau mobile → la
  //    réponse dépasse le timeout client → « La connexion a expiré. Le serveur
  //    est peut-être en cours de démarrage » ALORS QUE le login a AboutI côté
  //    serveur (session créée en base — constaté en production sur le login
  //    Academia Helm depuis l'app Android). Un HEAD sur la MÊME route déboule
  //    la lambda pendant que l'utilisateur saisit ses identifiants → sa
  //    soumission touche une lambda chaude. Best-effort, fire-and-forget.
  useEffect(() => {
    try {
      fetch('/api/auth/login', { method: 'HEAD', cache: 'no-store' }).catch(() => {});
    } catch { /* best effort — jamais bloquant */ }
  }, []);

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

  // ⭐ Statut d'ouverture des admissions publiques.
  // Si les admissions sont fermées (date dépassée ou désactivées manuellement),
  // le formulaire de pré-inscription est masqué et seul le bouton "Demander des infos"
  // reste disponible. Évite que le parent remplisse tout avant de découvrir le refus.
  // ⚠️ DOIT être déclaré AVANT le useEffect et admissionsAreClosed qui le référencent
  // (sinon TDZ error : "Cannot access 'admissionStatus' before initialization").
  const [admissionStatus, setAdmissionStatus] = useState<{
    isOpen: boolean;
    reason: string;
    admissionEnabled: boolean;
    admissionOpenDate: string | null;
    admissionCloseDate: string | null;
    academicYearName: string | null;
  } | null>(null);
  const [admissionStatusLoading, setAdmissionStatusLoading] = useState(false);

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

  // ⭐ Récupérer le statut d'ouverture des admissions publiques.
  // Si fermées, le formulaire de pré-inscription est masqué et seul le bouton
  // "Demander des infos" reste disponible.
  // ⚠️ Ce useEffect DOIT être après la déclaration de portalType (TDZ).
  useEffect(() => {
    if (!tenantIdForApi || portalType !== 'public') return;
    let cancelled = false;
    setAdmissionStatusLoading(true);
    fetch(`/api/public/school-info/${encodeURIComponent(tenantIdForApi)}/admission-status`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => {
        if (cancelled) return;
        setAdmissionStatus(data);
      })
      .catch((e) => {
        // Non bloquant : si l'endpoint échoue, on laisse admissionStatus = null
        // → le formulaire reste visible (comportement par défaut, rétro-compat).
        console.warn('[public-admission] Failed to fetch admission-status:', e?.message);
      })
      .finally(() => { if (!cancelled) setAdmissionStatusLoading(false); });
    return () => { cancelled = true; };
  }, [tenantIdForApi, portalType]);

  // ⭐ Les admissions sont-elles fermées ? (true si on a le statut ET isOpen=false)
  const admissionsAreClosed = !!admissionStatus && !admissionStatus.isOpen;

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

  // ⭐ Tenant de test Academia Helm : détection (slug / UUID / nom d'école)
  const testTenantDetected = isTestCredentialsTenant(
    tenantIdForApi || tenantSlug || schoolNameFromUrl,
  );

  // ⭐ Modal « Comptes de test » — state contrôlé
  //    Le modal s'ouvre automatiquement quand l'utilisateur focus un champ
  //    de saisie (email, password, identifier, téléphone) sur le tenant de
  //    test Academia Helm. Voir openTestModal() attachée en onFocus à chaque
  //    input ci-dessous.
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const openTestModal = useCallback(() => {
    if (testTenantDetected) setIsTestModalOpen(true);
  }, [testTenantDetected]);

  // ⭐ Tenant de test Academia Helm — remplissage du formulaire depuis le
  //    modal « Comptes de test » (clic « Utiliser ») ou depuis le compte
  //    mémorisé par le sélecteur de portail (sessionStorage → pré-remplissage).
  const handleUseTestAccount = useCallback((account: TestAccount) => {
    if (account.portal === 'school') {
      setSchoolCredentials((prev) => ({ ...prev, email: account.identifier, password: account.password }));
    } else if (account.portal === 'teacher') {
      setTeacherCredentials((prev) => ({ ...prev, teacherIdentifier: account.identifier, password: account.password }));
    } else if (account.portal === 'parent') {
      // ⭐ nov. 2026 — Portail parent : téléphone/email + MOT DE PASSE
      //    (obligatoire). Le mot de passe réel est généré à l'envoi des
      //    identifiants (Familles → Création de compte → Renvoyer) — on ne
      //    préremplit que l'identifiant, le parent saisit son mot de passe.
      setParentCredentials((prev) => ({ ...prev, phone: account.identifier, otp: '' }));
    }
  }, []);

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
  const [offlineContinueAvailable, setOfflineContinueAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════
  //  ⭐ V5 — 2FA TOTP : modale « code à 6 chiffres » après login
  //    (le backend renvoie requires2fa + un jeton temporaire 5 min)
  // ═══════════════════════════════════════════════════════════
  const [twoFactorPrompt, setTwoFactorPrompt] = useState<{ tempToken: string; email?: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [twoFactorVerifying, setTwoFactorVerifying] = useState(false);
  const twoFactorResolveRef = useRef<((data: any | null) => void) | null>(null);

  /** Ouvre la modale 2FA et attend la promesse du code (ou annulation). */
  const promptFor2FA = (tempToken: string, email?: string): Promise<any | null> => {
    setTwoFactorCode('');
    setTwoFactorError(null);
    setTwoFactorPrompt({ tempToken, email });
    return new Promise((resolve) => {
      twoFactorResolveRef.current = resolve;
    });
  };

  /** Soumet le code TOTP → POST /api/auth/2fa/verify-login. */
  const submitTwoFactorCode = async () => {
    if (!twoFactorPrompt || twoFactorVerifying) return;
    const code = twoFactorCode.replace(/\D/g, '');
    if (code.length !== 6) {
      setTwoFactorError('Saisissez les 6 chiffres de votre application d\'authentification.');
      return;
    }
    setTwoFactorVerifying(true);
    setTwoFactorError(null);
    try {
      const res = await fetch('/api/auth/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twoFactorTempToken: twoFactorPrompt.tempToken,
          code,
          tenantSubdomain: tenantSlug || undefined,
          tenant_id: tenantIdFromUrl || tenantIdForApi || undefined,
          portal_type: (portalType?.toUpperCase() || 'SCHOOL') as string,
        }),
        // ⭐ COLD-START RESILIENCE — timeout explicite (lambda froide possible,
        //    même cause que le login : sans lui, spinner sans fin).
        signal: AbortSignal.timeout(30_000),
      });
      const data = await res.json();
      if (res.ok && data.success && data.accessToken) {
        setTwoFactorPrompt(null);
        twoFactorResolveRef.current?.(data);
        twoFactorResolveRef.current = null;
      } else {
        setTwoFactorError(data.message || 'Code de vérification invalide.');
      }
    } catch {
      setTwoFactorError('Impossible de vérifier le code — vérifiez votre connexion.');
    } finally {
      setTwoFactorVerifying(false);
    }
  };

  /** Annule la modale 2FA (résout la promesse avec null). */
  const cancelTwoFactor = () => {
    setTwoFactorPrompt(null);
    twoFactorResolveRef.current?.(null);
    twoFactorResolveRef.current = null;
  };

  // ── Callbacks stables pour Turnstile (évitent les re-rendus du widget) ──
  const handleTurnstileError = useCallback(() => setTurnstileToken(null), []);
  const handleTurnstileExpire = useCallback(() => setTurnstileToken(null), []);

  // ── Client-side validation state ─────────────────────────────────────
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // ⭐ Validation côté client — accepte EMAIL ou MATRICULE.
  //    Si l'identifiant contient '@' → validation email ; sinon pas de
  //    validation (le matricule peut être n'importe quel format).
  const emailError = emailTouched && schoolCredentials.email && schoolCredentials.email.includes('@') && !isValidEmail(schoolCredentials.email)
    ? 'Format d\'email invalide'
    : null;

  // Validation côté client — tolérante pour supporter téléphone ET email.
  // Si l'identifiant contient '@', on valide un format email ; sinon un format téléphone Bénin.
  const isEmailIdentifier = (parentCredentials.phone || '').includes('@');
  const phoneError = phoneTouched && parentCredentials.phone && (
    isEmailIdentifier
      ? (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentCredentials.phone) ? 'Format d\'email invalide' : null)
      : (!isValidBeninPhone(parentCredentials.phone) ? 'Numéro de téléphone invalide (format Bénin attendu)' : null)
  );

  const passwordStrength = getPasswordStrength(
    portalType === 'teacher' ? teacherCredentials.password : schoolCredentials.password,
  );
  // Couleur de force du mot de passe — sémantique (rouge/orange/bleu/vert)
  // alignée sur la palette de l'école pour les niveaux intermédiaires.
  const passwordStrengthColor = !passwordStrength.score
    ? '#94a3b8'
    : passwordStrength.score === 1
      ? '#ef4444'
      : passwordStrength.score === 2
        ? GOLD
        : passwordStrength.score === 3
          ? BLUE
          : '#16a34a';

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

  // ── Back to portal selection URL ──
  // ⭐ Sur un sous-domaine école (ex: cspeb.academiahelm.com), le bouton
  //    « Retour » doit renvoyer vers la PAGE DE SÉLECTION DES PORTAILS du
  //    tenant (/school-portal/portal), et NON vers /school-portal qui est la
  //    landing page institutionnelle (ancien comportement qui déroutait
  //    l'utilisateur en lui montrant la landing page au lieu du sélecteur).
  //    Sur le domaine principal (academiahelm.com), on renvoie vers /portal.
  const backToPortalHref = useMemo(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.host;
      const slug = extractTenantSlug(host);
      if (slug) {
        return '/school-portal/portal';
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

  // ⭐ Tenant de test Academia Helm — pré-remplissage depuis le sélecteur de
  //    portail : le compte choisi (sessionStorage) remplit directement le
  //    formulaire. Déclaré APRÈS « Pre-fill saved email » pour primer sur lui.
  useEffect(() => {
    if (!testTenantDetected || !portalType) return;
    const account = consumeTestCredentialPrefill();
    if (!account || account.portal !== portalType) return;
    handleUseTestAccount(account);
  }, [testTenantDetected, portalType, handleUseTestAccount]);

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

      // ⭐ Détecter si l'erreur est due à une perte de connexion (offline)
      //    ⭐ v3.3.1 — 'timeout' N'EST PLUS classé offline : un timeout arrive
      //    AUSSI quand on est en ligne (serveur lent : cold start Vercel/Neon,
      //    2G/3G saturée) — dire « Vous êtes hors ligne » à un utilisateur
      //    connecté l'a fait croire à un bug de détection réseau. Aligné sur
      //    client.ts (« Un timeout ne signifie PAS que l'utilisateur est hors
      //    ligne ») : un timeout tombe désormais dans la branche « serveur en
      //    cours de démarrage » ci-dessous.
      const isOfflineError = rawMessage.includes('Failed to fetch') ||
        rawMessage.includes('NetworkError') ||
        rawMessage.includes('Connexion indisponible') ||
        rawMessage.includes('ERR_NETWORK') ||
        (typeof navigator !== 'undefined' && !navigator.onLine);

      if (isOfflineError) {
        // ⭐ v3.4.0 — RE-CONNEXION HORS LIGNE : si un login a déjà réussi sur
        //    cet appareil (enveloppe locale) et que l'école / l'identifiant /
        //    le mot de passe saisis correspondent, restaurer la session et
        //    entrer dans l'app (pages servies par le SW, données par le cache
        //    API identitaire — le token restauré est le même).
        const offlineIdentifier =
          portalType === 'teacher'
            ? teacherCredentials.teacherIdentifier.trim()
            : portalType === 'parent'
              ? parentCredentials.phone.trim()
              : schoolCredentials.email.trim();
        const offlinePassword =
          portalType === 'teacher'
            ? teacherCredentials.password
            : portalType === 'parent'
              ? ((parentCredentials as { password?: string }).password || '')
              : schoolCredentials.password;
        if (offlineIdentifier && offlinePassword) {
          const restored = await tryOfflineLogin({
            identifier: offlineIdentifier,
            password: offlinePassword,
            portalType: portalType || undefined,
            tenantSlug: tenantSlug || undefined,
            tenantId: tenantIdFromUrl || undefined,
          });
          if (restored) {
            const restoredPortal = (restored.portalType || '').toUpperCase();
            const dest =
              restoredPortal === 'TEACHER'
                ? '/app/teacher'
                : restoredPortal === 'PARENT'
                  ? '/app/parent'
                  : redirectPath || '/app';
            const slug =
              restored.tenant?.slug || restored.tenant?.subdomain || tenantSlug || '';
            const url = new URL(dest, window.location.origin);
            if (slug) url.searchParams.set('tenant', slug);
            if (restored.tenant?.id) {
              url.searchParams.set('tenant_id', String(restored.tenant.id));
            }
            markFreshLogin();
            window.location.href = url.toString();
            return;
          }
        }

        // ⭐ Vérifier si l'utilisateur a déjà une session valide en cache
        let hasValidSession = false;
        try {
          const session = localStorage.getItem('session');
          if (session) {
            const parsed = JSON.parse(session);
            if (parsed.accessToken || parsed.accessTokenExpiry) {
              const expiry = parsed.accessTokenExpiry || 0;
              if (expiry > Date.now()) {
                hasValidSession = true;
              }
            }
          }
        } catch {}

        if (hasValidSession) {
          // ⭐ L'utilisateur a une session valide — permettre "Continuer hors ligne"
          setError('');
          setOfflineContinueAvailable(true);
          return;
        }

        userMessage = 'Vous êtes hors ligne. Vérifiez votre connexion Internet et réessayez.';
      } else if (rawMessage.includes('timeout') || rawMessage.includes('ne répond pas') || rawMessage.includes('30 secondes')) {
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
      // ⭐ COLD-START RESILIENCE — fetch nu → 30 s + relance sur abort (la
      //    version sans timeout restait pendante indéfiniment sur lambda froide).
      return loginFetchResilient('/api/auth/login', {
        method: 'POST',
        // ⭐ MOBILE SESSION — marqueur explicite pour l'API : session téléphone
        //    (app Android OU navigateur mobile) → refresh token 90 jours
        //    (session toujours ouverte sur mobile, jamais de déconnexion auto).
        headers: {
          'Content-Type': 'application/json',
          ...(isMobileDevice() ? { 'X-AH-Native-App': '1' } : {}),
        },
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
      const selectResp = await loginFetchResilient('/api/auth/select-tenant', {
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

  /**
   * ⭐ COLD-START RESILIENCE (2026-10-19) — login avec timeout élargi (30 s)
   *    et UNE relance automatique sur abort. Cas réel constaté en production
   *    (login Academia Helm depuis l'app Android) : lambda Vercel froide
   *    (3-10 s de boot) + latence réseau mobile → réponse au-delà de l'ancien
   *    timeout de 10 s → le client AbortE et affiche « La connexion a expiré »
   *    alors que le login a AboutI côté serveur (session créée en base —
   *    vérifié : sessions TECNO WebView créées à chaque tentative « échouée »).
   *    Au premier dépassement, la lambda est déjà bootée → la relance revient
   *    en ~1 s. Les autres erreurs (réseau, 4xx/5xx reçus) ne sont PAS rejouées.
   */
  const loginFetchResilient = useCallback(async (url: string, init: RequestInit): Promise<Response> => {
    const attempt = () => fetchWithTimeout(url, init, 30_000);
    try {
      return await attempt();
    } catch (firstErr: any) {
      const raw = `${firstErr?.name || ''} ${firstErr?.message || ''}`.toLowerCase();
      if (!raw.includes('abort')) throw firstErr; // pas un timeout → ne pas rejouer
      try {
        return await attempt(); // lambda désormais chaude
      } catch {
        throw firstErr;
      }
    }
  }, [fetchWithTimeout]);

  const handleStandardLogin = async () => {
    const response = await loginFetchResilient('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // ⭐ MOBILE SESSION — refresh 90 j sur téléphone (session toujours ouverte)
        ...(isMobileDevice() ? { 'X-AH-Native-App': '1' } : {}),
      },
      body: JSON.stringify({
        email: schoolCredentials.email,
        password: schoolCredentials.password,
        tenantSubdomain: tenantSlug,
        tenant_id: tenantIdFromUrl || undefined,
        portal_type: portalType?.toUpperCase() || undefined,
        turnstileToken: turnstileToken || undefined,
      }),
    });

    // ⭐ Parse tolérant : une page d'erreur non-JSON (Cloudflare 52x via www)
    //    ne doit pas devenir une SyntaxError « Unexpected token » opaque.
    let data = await response.json().catch(() => ({}) as any);

    if (!response.ok) {
      throw new Error(data.message || 'Erreur lors de la connexion');
    }

    // ⭐ V5 — 2FA TOTP : le backend exige un code → modale → payload complet.
    if (data.requires2fa && data.twoFactorTempToken) {
      const completed = await promptFor2FA(data.twoFactorTempToken, data.email);
      if (!completed) return; // annulé par l'utilisateur
      data = completed;
    }

    // ⭐ v3.4.0 — snapshot partagé persistClientSession + enveloppe offline
    const sessionSnapshot = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      serverSessionId: data.serverSessionId,
      user: data.user,
      tenant: data.tenant,
      portalType: portalType?.toUpperCase() || null,
      expiresAt: data.expiresAt,
    };
    persistClientSession(sessionSnapshot);
    // ⭐ v3.4.0 — enveloppe d'auth hors ligne (re-login offline après logout)
    saveOfflineAuthEnvelope({
      identifier: schoolCredentials.email.trim(),
      password: schoolCredentials.password,
      portalType: portalType?.toUpperCase() || 'SCHOOL',
      tenantSlug: data.tenant?.slug || data.tenant?.subdomain || tenantSlug || null,
      tenantId: data.tenant?.id || tenantIdFromUrl || null,
      snapshot: sessionSnapshot,
    }).catch(() => {});

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
    //    ⭐ v3.3.1 — fetchWithTimeout (10 s + abort-on-unmount) au lieu d'un
    //    fetch nu : sur 2G/3G instable, un fetch sans timeout peut rester
    //    pendant des minutes en échec silencieux (l'utilisateur voit un
    //    spinner sans fin et croit être hors ligne alors qu'il est connecté).
    const attemptLogin = async (portalTypeAttempt: 'SCHOOL' | 'PLATFORM') => {
      return loginFetchResilient('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // ⭐ MOBILE SESSION — refresh 90 j sur téléphone (session toujours ouverte)
          ...(isMobileDevice() ? { 'X-AH-Native-App': '1' } : {}),
        },
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
    // ⭐ Réponse non-JSON possible (page d'erreur Cloudflare 52x via le domaine
    //    www) → parse tolérant au lieu d'une SyntaxError « Unexpected token »
    //    transformée en faux message « hors ligne ».
    let data = await response.json().catch(() => ({}) as any);

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
      const selectResp = await loginFetchResilient('/api/auth/select-tenant', {
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

    // ⭐ V5 — 2FA TOTP : le backend exige un code → modale → payload complet.
    //    (placé APRÈS le retry PLATFORM_OWNER : les deux chemins déclenchant
    //    la porte serveur, la modale s'ouvre ici une seule fois.)
    if (data.requires2fa && data.twoFactorTempToken) {
      const completed = await promptFor2FA(data.twoFactorTempToken, data.email);
      if (!completed) return; // annulé par l'utilisateur
      data = completed;
    }

    // ⭐ v3.4.0 — snapshot partagé persistClientSession + enveloppe offline
    const sessionSnapshot = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      serverSessionId: data.serverSessionId,
      user: data.user,
      tenant: data.tenant,
      portalType: 'SCHOOL',
      expiresAt: data.expiresAt,
    };
    persistClientSession(sessionSnapshot);
    // ⭐ v3.4.0 — enveloppe d'auth hors ligne (re-login offline après logout)
    saveOfflineAuthEnvelope({
      identifier: schoolCredentials.email.trim(),
      password: schoolCredentials.password,
      portalType: 'SCHOOL',
      tenantSlug: data.tenant?.slug || data.tenant?.subdomain || tenantSlug || null,
      tenantId: data.tenant?.id || tenantIdForApi || null,
      snapshot: sessionSnapshot,
    }).catch(() => {});

    const tenantKey = data.tenant?.id || tenantIdForApi || 'platform';
    saveEmailForTenant(schoolCredentials.email.trim(), tenantKey);

    const resolvedSlug = tenantSlug || data.tenant?.slug || data.tenant?.subdomain || data.tenant?.id;
    const resolvedTenantId = tenantIdForApi || data.tenant?.id;

    // ⭐ PROMOTEUR MULTI-ÉCOLES : si le promoteur gère plusieurs établissements
    // (relations UserTenant), sa home est la VUE STRATÉGIQUE du groupe — il y
    // choisit l'école dans laquelle entrer (« Entrer dans l'établissement » ;
    // l'UI complète de chaque école reste le filet de sécurité). Uniquement
    // quand aucune destination explicite n'était demandée (deep-link
    // ?redirect=… respecté) et pour les rôles promoteur.
    const PROMOTER_HOME_ROLES = ['PROMOTER', 'PROMOTEUR', 'SCHOOL_OWNER', 'SUPER_DIRECTOR'];
    const userRole = data.user?.role || '';
    if (redirectPath === '/app' && PROMOTER_HOME_ROLES.includes(userRole) && data.accessToken) {
      try {
        const tenantsResp = await fetch('/api/auth/available-tenants', {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        });
        if (tenantsResp.ok) {
          const availableTenants = await tenantsResp.json();
          if (Array.isArray(availableTenants) && availableTenants.length > 1) {
            markFreshLogin();
            window.location.href = '/promoteur';
            return;
          }
        }
      } catch {
        // Silencieux : en cas d'échec on poursuit vers l'école sélectionnée.
      }
    }

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

    // ⭐ v3.4.0 — snapshot partagé persistClientSession + enveloppe offline
    const sessionSnapshot = {
      accessToken: data.accessToken,
      portalSessionId: data.portalSessionId,
      user: data.user,
      tenant: data.tenant,
      portalType: 'TEACHER',
      expiresAt: data.expiresAt,
      // ⭐ P4 : périmètre serveur (niveaux/pistes) — pilote la langue UI et
      //    les sélecteurs verrouillés de l'espace enseignant
      scope: data.scope ?? undefined,
    };
    persistClientSession(sessionSnapshot);
    // ⭐ v3.4.0 — enveloppe d'auth hors ligne (re-login offline après logout)
    saveOfflineAuthEnvelope({
      identifier: teacherCredentials.teacherIdentifier.trim(),
      password: teacherCredentials.password,
      portalType: 'TEACHER',
      tenantSlug: data.tenant?.slug || data.tenant?.subdomain || tenantSlug || null,
      tenantId: data.tenant?.id || tenantIdForApi || null,
      snapshot: sessionSnapshot,
    }).catch(() => {});

    // ⭐ FIX : utiliser le slug du tenant retourné par l'API (data.tenant.slug)
    //    plutôt que tenantSlug de l'URL qui peut être un UUID ou un slug
    //    incomplet. Si data.tenant.slug existe, c'est le slug canonique
    //    (ex: "cspeb-eveildafriqueeducation"). Sinon, fallback sur l'UUID.
    const effectiveSlug = data.tenant?.slug || data.tenant?.subdomain || tenantSlug || data.tenant?.id || tenantIdForApi;
    const redirectUrl = getTenantRedirectUrl({
      tenantSlug: effectiveSlug,
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

    // ── Détection du mode (téléphone vs email) ──
    // Si l'utilisateur a tapé un '@' dans le champ, on bascule en mode EMAIL.
    const rawIdentifier = parentCredentials.phone.trim();
    const isEmailMode = rawIdentifier.includes('@');
    const identifierType: 'PHONE' | 'EMAIL' = isEmailMode ? 'EMAIL' : 'PHONE';

    // ── Étape 2 : vérification OTP (uniquement si l'API a demandé un OTP) ──
    // Cette branche ne s'exécute que si PARENT_OTP_ENABLED=true côté backend.
    // Par défaut (false), on reste en connexion directe 1 étape.
    if (parentOtpSent && parentCredentials.otp) {
      const verifyPayload: Record<string, unknown> = {
        tenantId: tenantIdForApi,
        identifierType,
        otp: parentCredentials.otp,
        portal_type: 'PARENT',
        turnstileToken: turnstileToken || undefined,
      };
      if (isEmailMode) {
        verifyPayload.email = rawIdentifier;
      } else {
        verifyPayload.phone = rawIdentifier;
      }

      const verifyResponse = await fetchWithTimeout('/api/portal/auth/parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyPayload),
      });
      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok || !verifyData.success) {
        throw new Error(verifyData.message || verifyData.error || 'Code OTP invalide');
      }
      persistClientSession({
        accessToken: verifyData.accessToken,
        portalSessionId: verifyData.portalSessionId,
        user: verifyData.user,
        tenant: verifyData.tenant,
        portalType: 'PARENT',
        expiresAt: verifyData.expiresAt,
      });
      const redirectUrl = getTenantRedirectUrl({
        tenantSlug: tenantSlug || verifyData.tenant?.slug || verifyData.tenant?.id,
        tenantId: tenantIdForApi,
        path: redirectPath,
        portalType: 'PARENT',
      });
      markFreshLogin();
      window.location.href = redirectUrl;
      return;
    }

    // ── Étape 1 : connexion directe (sans OTP par défaut) ──
    // ⭐ nov. 2026 — MOT DE PASSE OBLIGATOIRE (téléphone OU email + mot de
    //    passe) : le mot de passe simple (petit mot + 2-3 chiffres) est envoyé
    //    au parent par SMS/email lors de la création de son compte.
    //    Le backend répond soit avec un token (connexion réussie), soit avec
    //    requiresOtp=true (si PARENT_OTP_ENABLED=true côté backend).
    if (!parentCredentials.password?.trim()) {
      throw new Error(
        'Mot de passe requis — utilisez celui reçu par SMS ou email lors de la création de votre compte.',
      );
    }
    const loginPayload: Record<string, unknown> = {
      tenantId: tenantIdForApi,
      identifierType,
      portal_type: 'PARENT',
      turnstileToken: turnstileToken || undefined,
      password: parentCredentials.password,
    };
    if (isEmailMode) {
      loginPayload.email = rawIdentifier;
    } else {
      loginPayload.phone = rawIdentifier;
    }

    const response = await fetchWithTimeout('/api/portal/auth/parent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginPayload),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Identifiants invalides');
    }

    // Si le backend demande un OTP (PARENT_OTP_ENABLED=true côté backend),
    // on passe en étape 2.
    if (data.requiresOtp) {
      if (data.otp) {
        setParentOtpCode(data.otp);
      }
      setParentOtpSent(true);
      return;
    }

    // Connexion réussie — persister la session et rediriger
    // ⭐ v3.4.0 — snapshot partagé persistClientSession + enveloppe offline
    //    (parent : uniquement si un mot de passe a été saisi — vérifiable offline)
    const sessionSnapshot = {
      accessToken: data.accessToken,
      portalSessionId: data.portalSessionId,
      user: data.user,
      tenant: data.tenant,
      portalType: 'PARENT',
      expiresAt: data.expiresAt,
    };
    persistClientSession(sessionSnapshot);
    const parentPassword = (parentCredentials as { password?: string }).password;
    if (parentPassword) {
      saveOfflineAuthEnvelope({
        identifier: parentCredentials.phone.trim(),
        password: parentPassword,
        portalType: 'PARENT',
        tenantSlug: data.tenant?.slug || data.tenant?.subdomain || tenantSlug || null,
        tenantId: data.tenant?.id || tenantIdForApi || null,
        snapshot: sessionSnapshot,
      }).catch(() => {});
    }

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
      wantsBilingual: false, // Supprimé du formulaire — l'école est déjà bilingue ou non
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
      // Étape 1 : type candidat obligatoire, champs parent OPTIONNELS
      // (un parent peut envoyer quelqu'un d'autre faire l'inscription,
      //  ou faire l'inscription depuis mobile sans toutes les infos)
      if (!preEnrollment.candidateType) return 'Veuillez sélectionner le niveau d\'inscription (Maternelle, Primaire, Secondaire).';
      // Les champs parent (prénom, nom, téléphone, email) ne sont PAS obligatoires
      // à cette étape — ils pourront être complétés ultérieurement.
    }
    if (step === 2) {
      // Étape 2 : champs enfant (uniquement si pas PROSPECT_PARENT)
      // SEULS les champs de l'enfant sont obligatoires
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
              {/* ── Décor bleu : halos lumineux subtils (animate-float Win Agro) ── */}
              <div className="pointer-events-none absolute -top-16 -left-10 h-48 w-48 rounded-full opacity-25 blur-3xl animate-float" style={{ background: '#ffffff' }} aria-hidden />
              <div className="pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full opacity-15 blur-3xl animate-float" style={{ background: `${GOLD}`, animationDelay: '2s' }} aria-hidden />

              {/* SVG Noise Grain Filter (texture premium Win Agro) */}
              <svg
                viewBox="0 0 200 200"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none mix-blend-overlay"
              >
                <filter id="noiseFilter-login-hero">
                  <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                </filter>
                <rect width="100%" height="100%" filter="url(#noiseFilter-login-hero)" />
              </svg>
              <div className="absolute inset-0 bg-grain opacity-[0.08] mix-blend-overlay pointer-events-none" />

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
              src="/images/logo-Academia Hub.webp"
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
                        Email ou Matricule
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Mail className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          id={`email-${tenantStorageKey}`}
                          name={`email_${tenantStorageKey}`}
                          autoComplete="username"
                          required
                          value={schoolCredentials.email}
                          onChange={(e) =>
                            setSchoolCredentials({
                              ...schoolCredentials,
                              email: e.target.value,
                            })
                          }
                          onFocus={openTestModal}
                          className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-4 min-h-[44px] transition-all placeholder:text-slate-400 focus:ring-2"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder={
                            portalType === 'platform'
                              ? 'admin@academiahelm.com'
                              : 'email ou matricule'
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
                          onFocus={openTestModal}
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
                                    ? passwordStrengthColor
                                    : '#e2e8f0',
                                }}
                              />
                            ))}
                          </div>
                          <p className="mt-1 text-[10px] text-slate-500">
                            Force : <span style={{ color: passwordStrengthColor }}>{passwordStrength.label}</span>
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
                          onFocus={openTestModal}
                          className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-4 min-h-[44px] transition-all placeholder:text-slate-400 focus:ring-2"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder="ECOLE-26-00001"
                          autoCapitalize="characters"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Votre matricule vous a été communiqué par l&apos;établissement (format : CODE-YY-XXXXX, ex : ECOLE-26-00001).
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
                          onFocus={openTestModal}
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
                                    ? passwordStrengthColor
                                    : '#e2e8f0',
                                }}
                              />
                            ))}
                          </div>
                          <p className="mt-1 text-[10px] text-slate-500">
                            Force : <span style={{ color: passwordStrengthColor }}>{passwordStrength.label}</span>
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

                {/* ── PARENT : Téléphone OU Email + OTP/Password ── */}
                {portalType === 'parent' && (
                  <>
                    <div>
                      <label
                        htmlFor="phone"
                        className="mb-1.5 block text-sm font-semibold text-slate-900"
                      >
                        {isEmailIdentifier ? 'Adresse email' : 'Numéro de téléphone'}
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          {isEmailIdentifier ? (
                            <Mail className="h-5 w-5 text-slate-400" />
                          ) : (
                            <Phone className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <input
                          type={isEmailIdentifier ? 'email' : 'tel'}
                          id="phone"
                          required
                          disabled={parentOtpSent}
                          value={parentCredentials.phone}
                          onChange={(e) =>
                            setParentCredentials({
                              ...parentCredentials,
                              phone: e.target.value,
                              // Reset OTP state when changing identifier
                              otp: parentOtpSent ? '' : parentCredentials.otp,
                            })
                          }
                          onFocus={openTestModal}
                          className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-4 min-h-[44px] transition-all placeholder:text-slate-400 focus:ring-2 disabled:bg-slate-100"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder={isEmailIdentifier ? 'parent@exemple.com' : '+229 90 00 00 00'}
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
                        {isEmailIdentifier
                          ? 'Email utilisé lors de l\'inscription de votre enfant.'
                          : 'Numéro ou email utilisé lors de l\'inscription de votre enfant — avec votre mot de passe.'}
                      </p>
                    </div>

                    {/* ── Mot de passe — ⭐ nov. 2026 OBLIGATOIRE (téléphone
                        OU email + mot de passe). Affiché dans les DEUX modes,
                        AVANT le champ OTP éventuel. Le mot de passe simple
                        (petit mot + 2-3 chiffres, ex : soleil42) est envoyé au
                        parent par SMS/email lors de la création de son compte
                        (Élèves → Familles → Création de compte). */}
                    <AnimatePresence>
                      {!parentOtpSent && (
                        <motion.div
                          key="parent-password-required"
                          initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={shouldReduceMotion ? undefined : { opacity: 0, height: 0 }}
                          transition={{ duration: dur, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <label
                            htmlFor="parentPassword"
                            className="mb-1.5 block text-sm font-semibold text-slate-900"
                          >
                            Mot de passe <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                              <Lock className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              id="parentPassword"
                              required
                              value={parentCredentials.password || ''}
                              onChange={(e) =>
                                setParentCredentials({
                                  ...parentCredentials,
                                  password: e.target.value,
                                })
                              }
                              className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-10 min-h-[44px] transition-all placeholder:text-slate-400 focus:ring-2"
                              style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                              placeholder="Mot de passe reçu par SMS/email (ex : soleil42)"
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
                          <p className="mt-1 text-xs text-slate-500">
                            Mot de passe simple (petit mot + quelques chiffres) reçu par SMS ou
                            email lors de la création de votre compte. En cas d'oubli,
                            contactez l'administration de l'école.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

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
                            Un code OTP a été envoyé {isEmailIdentifier ? 'à votre adresse email' : 'à votre numéro de téléphone'}.
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
                {portalType === 'public' && !preEnrollmentSubmitted && admissionsAreClosed && (
                  <div className="public-pre-enrollment space-y-4">
                    {/* ── Bannière : admissions fermées ── */}
                    <div className="rounded-xl border-2 p-5 text-center" style={{ borderColor: '#fca5a5', background: '#fef2f2' }}>
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: '#fee2e2' }}>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                      </div>
                      <h3 className="text-base font-bold mb-1.5" style={{ color: '#991b1b' }}>
                        Les admissions sont actuellement fermées
                      </h3>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {admissionStatus?.reason || 'La période de soumission des demandes d\'admission est terminée pour cette année scolaire.'}
                      </p>
                      {admissionStatus?.academicYearName && (
                        <p className="text-xs text-slate-500 mt-2">
                          Année scolaire concernée : {admissionStatus.academicYearName}
                        </p>
                      )}
                    </div>

                    {/* ── Option : Demander des infos ── */}
                    <div className="rounded-xl border-2 p-5 text-center" style={{ borderColor: `${NAVY}20`, background: '#f8fafc' }}>
                      <h4 className="text-sm font-bold mb-1.5" style={{ color: NAVY }}>
                        Vous souhaitez obtenir des informations ?
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed mb-3">
                        Notre équipe répondra à toutes vos questions sur l'établissement,
                        les frais de scolarité, les programmes, etc.
                      </p>
                      <a
                        href={`mailto:?subject=Demande d'informations - ${typeof window !== 'undefined' ? window.location.hostname : ''}`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 min-h-[44px]"
                        style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                        Demander des informations
                      </a>
                    </div>
                  </div>
                )}

                {/* ── PUBLIC : Pré-inscription (formulaire complet, admissions ouvertes) ── */}
                {portalType === 'public' && !preEnrollmentSubmitted && !admissionsAreClosed && (
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
                          Prénom (parent) <span class="text-slate-400 font-normal">(optionnel)</span>
                        </label>
                        <input
                          type="text"
                          value={preEnrollment.parentFirstName}
                          onChange={(e) => setPreEnrollment((prev) => ({ ...prev, parentFirstName: e.target.value }))}
                          className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder="Prénom"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-900">
                          Nom (parent) <span class="text-slate-400 font-normal">(optionnel)</span>
                        </label>
                        <input
                          type="text"
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
                          Téléphone <span class="text-slate-400 font-normal">(optionnel)</span>
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Phone className="h-4 w-4 text-slate-400" />
                          </div>
                          <input
                            type="tel"
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
                          Email <span class="text-slate-400 font-normal">(optionnel)</span>
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

            {/* ── ⭐ Tenant de test Academia Helm : modal « Comptes de test » ── */}
            {/* Uniquement pour les portails authentifiés (pas PUBLIC) et si
                l'école courante est le tenant de test Academia Helm.
                ⚠️ Le modal est rendu une seule fois, en dehors du flux du
                formulaire, pour ne pas allonger la page. Il s'ouvre
                automatiquement quand l'utilisateur focus un champ de saisie
                (email, password, identifier, téléphone) — voir onFocus
                attaché à chaque input. */}

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
            {/* Pour le portail public : n'afficher qu'à l'étape 3 (sinon le bouton "Suivant" gère la navigation).
                ⭐ Masqué si les admissions sont fermées (pas de soumission possible). */}
            {!(portalType === 'public' && preEnrollmentSubmitted) && !(portalType === 'public' && preEnrollmentStep < 3) && !(portalType === 'public' && admissionsAreClosed) && (
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

            {/* ⭐ Bouton "Continuer hors ligne" — affiché si offline + session valide en cache */}
            {offlineContinueAvailable && (
              <motion.button
                type="button"
                onClick={() => {
                  // Rediriger vers l'app en utilisant la session en cache
                  const redirectUrl = portalType === 'teacher'
                    ? '/app/teacher'
                    : portalType === 'parent'
                      ? '/app/parent'
                      : '/app';
                  // Construire l'URL avec le tenant si disponible
                  const url = tenantSlug
                    ? `${redirectUrl}?tenant=${tenantSlug}`
                    : redirectUrl;
                  window.location.href = url;
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-semibold text-white shadow-lg min-h-[44px] mt-3"
                style={{
                  background: `linear-gradient(135deg, #059669, #10b981)`,
                }}
              >
                <WifiOff className="h-5 w-5" />
                Continuer hors ligne
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

      {/* ══════════════════════════════════════════════════════════════
          ⭐ V5 — MODALE 2FA TOTP : code à 6 chiffres après un login
          exigeant la double authentification (requires2fa du backend).
          ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {twoFactorPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) cancelTwoFactor(); }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                >
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Double authentification</h3>
                  <p className="text-xs text-slate-500">
                    {twoFactorPrompt.email ? `${twoFactorPrompt.email} — ` : ''}code à 6 chiffres
                  </p>
                </div>
              </div>

              <p className="mb-4 text-xs leading-relaxed text-slate-600">
                Ouvrez votre application d'authentification (Google Authenticator, Aegis, Authy…)
                et saisissez le code en cours pour <strong>{twoFactorPrompt.email || 'votre compte'}</strong>.
                En cas de perte d'appareil, un code de secours peut être utilisé.
              </p>

              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => { if (e.key === 'Enter') submitTwoFactorCode(); }}
                placeholder="••••••"
                className="w-full rounded-xl border-2 border-slate-200 py-3 text-center text-2xl font-bold tracking-[0.4em] text-slate-900 outline-none focus:ring-2"
                style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                disabled={twoFactorVerifying}
              />

              {twoFactorError && (
                <p className="mt-2 text-xs font-medium text-red-600">{twoFactorError}</p>
              )}

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={cancelTwoFactor}
                  disabled={twoFactorVerifying}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={submitTwoFactorCode}
                  disabled={twoFactorVerifying || twoFactorCode.replace(/\D/g, '').length !== 6}
                  className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                >
                  {twoFactorVerifying ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Vérification…
                    </>
                  ) : 'Vérifier et continuer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════
          ⭐ MODAL « COMPTES DE TEST » — Tenant Academia Helm uniquement
          S'ouvre automatiquement au focus sur un champ de saisie (email,
          password, identifier, téléphone). Rendu en fin de composant pour
          ne pas allonger la page login — c'est un overlay, pas un bloc.
          ══════════════════════════════════════════════════════════════ */}
      {testTenantDetected && (isStandardLogin || portalType === 'school' || portalType === 'platform' || portalType === 'teacher' || portalType === 'parent') && (
        <TestCredentialsModal
          isOpen={isTestModalOpen}
          onClose={() => setIsTestModalOpen(false)}
          portal={portalType === 'teacher' || portalType === 'parent' ? portalType : 'school'}
          tenantKey={tenantIdForApi || tenantSlug || schoolNameFromUrl}
          onUseAccount={handleUseTestAccount}
        />
      )}
    </div>
  );
}
