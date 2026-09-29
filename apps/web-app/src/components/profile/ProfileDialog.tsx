'use client';

/**
 * ============================================================================
 * PROFILE DIALOG — « Mon profil » (tous les UI, tous les utilisateurs)
 * ============================================================================
 *
 * Boîte de dialogue partagée, ouverte depuis le menu profil de CHAQUE
 * portail (Pilotage/École, admin métiers, Enseignant, Parent, Promoteur,
 * Federis). Deux onglets :
 *
 *   1. PHOTO DE PROFIL
 *      Choix d'une image → compression navigateur → POST /api/users/me/avatar
 *      → sharp 512×512 webp côté backend → users.avatarUrl (data URL).
 *      ⭐ Si l'utilisateur n'a PAS de photo perso mais une photo dans son
 *        dossier du personnel (module RH — staff_photos), celle-ci s'affiche
 *        (profile.hrPhotoUrl) et l'utilisateur peut la remplacer par la
 *        sienne (users.avatarUrl reste prioritaire).
 *
 *   2. SÉCURITÉ — DEUX options self-service :
 *      a) Changer mon mot de passe
 *         ⭐ EXACTEMENT le même processus que « mot de passe oublié » (login) :
 *            Étape 1 : POST /api/auth/request-password-change → code OTP 6
 *                      chiffres envoyé à l'email du compte (email connecté)
 *            Étape 2 : POST /api/auth/verify-reset-otp { email, code }
 *            Étape 3 : POST /api/auth/reset-password { email, code, newPassword }
 *                      → bcrypt + invalidation de TOUTES les sessions
 *            Étape 4 : succès → reconnexion obligatoire
 *      b) Changer mon adresse email
 *         Même mécanique OTP sécurisée :
 *            Étape 1 : POST /api/auth/request-email-change { newEmail } → code
 *                      OTP envoyé à la NOUVELLE adresse (seul son propriétaire
 *                      peut confirmer — pas d'usurpation, pas de faute de
 *                      frappe qui verrouille le compte)
 *            Étape 2 : POST /api/auth/confirm-email-change { code, newEmail }
 *                      → users.email mis à jour + invalidation de TOUTES les
 *                      sessions + notification envoyée à l'ancienne adresse
 *            Étape 3 : succès → reconnexion obligatoire avec la nouvelle adresse
 *      Mêmes règles de validation que ForgotPasswordPage : ≥ 8 caractères,
 *      force ≥ « Moyen », checklist (majuscule, chiffre, caractère spécial).
 * ============================================================================
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Camera,
  Loader,
  CheckCircle2,
  AlertCircle,
  Shield,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  LogOut,
  Mail,
  AtSign,
  ArrowLeft,
} from 'lucide-react';
import UserAvatar from './UserAvatar';
import { useUserProfileStore, authedProfileFetch } from '@/stores/user-profile-store';
import { compressImageFileToDataUrl } from '@/lib/media/client-image';
import { clearClientSessionSync } from '@/lib/auth/client-access-token';
import { useL } from '@/lib/i18n/bilingual';
import { getRoleDisplayLabel } from '@/lib/auth/role-portal-map';

/** Palette Academia Helm (alignée ForgotPasswordPage). */
const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';

/** Taille max côté client avant envoi (le backend re-recadre en 512 webp). */
const CLIENT_MAX_EDGE = 1024;
const CLIENT_MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 Mo fichier brut

type SecurityStep = 'start' | 'otp' | 'reset' | 'success';
type SecurityAction = 'password' | 'email' | null;
type EmailStep = 'start' | 'otp' | 'success';

/** Évalue la force d'un mot de passe — identique à ForgotPasswordPage. */
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '—', color: '#94a3b8' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 1, label: 'Faible', color: '#ef4444' };
  if (score <= 3) return { score: 2, label: 'Moyen', color: GOLD };
  if (score <= 4) return { score: 3, label: 'Bon', color: BLUE };
  return { score: 4, label: 'Fort', color: '#16a34a' };
}

/** Masque un email : je***@domaine.com */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${'•'.repeat(Math.max(1, Math.min(5, local.length - 2)))}@${domain}`;
}

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
  /** Fallback d'affichage si le profil API n'est pas encore chargé. */
  fallbackUser?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
}

export default function ProfileDialog({ open, onClose, fallbackUser }: ProfileDialogProps) {
  const L = useL();
  const profile = useUserProfileStore((s) => s.profile);
  const profileError = useUserProfileStore((s) => s.error);
  const loadingProfile = useUserProfileStore((s) => s.loading);
  const ensureLoaded = useUserProfileStore((s) => s.ensureLoaded);
  const setAvatar = useUserProfileStore((s) => s.setAvatar);
  // ⭐ Comptes sans session API (ex : admin plateforme env) — profil indisponible
  const profileUnavailable = profileError === 'unauthenticated';

  // Identité affichée (profil frais > fallback session)
  const display = {
    firstName: profile?.firstName ?? fallbackUser?.firstName ?? '',
    lastName: profile?.lastName ?? fallbackUser?.lastName ?? '',
    email: profile?.email ?? fallbackUser?.email ?? '',
    role: profile?.role ?? fallbackUser?.role ?? '',
  };
  const email = (display.email || '').trim().toLowerCase();
  const displayName = `${display.firstName} ${display.lastName}`.trim() || display.email || L('Utilisateur', 'User');
  // ⭐ Libellé français du rôle via le catalogue canonique (role-portal-map)
  //    — JAMAIS l'ID technique brut (ex : SECRETAIRE_COMPTABLE_MAT_PRI →
  //    « Secrétaire Comptable Maternelle + Primaire », pas « secretaire
  //    comptable mat pri »). Les libellés déjà formatés (fallback des
  //    portails) passent tels quels (getRoleDisplayLabel est idempotent).
  const roleLabel = (() => {
    if (!display.role) return '';
    const label = getRoleDisplayLabel(display.role);
    if (!label || label === display.role) {
      return display.role.replaceAll('_', ' ');
    }
    return label;
  })();

  // ── Onglets ──
  const [activeTab, setActiveTab] = useState<'photo' | 'security'>('photo');

  // ── Photo de profil ──
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null); // data URL locale en attente
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoSaved, setPhotoSaved] = useState(false);

  // ── Sécurité (changement de mot de passe) ──
  const [step, setStep] = useState<SecurityStep>('start');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Sécurité — choix de l'action (mot de passe | adresse email) ──
  const [securityAction, setSecurityAction] = useState<SecurityAction>(null);

  // ── Sécurité (changement d'adresse email) ──
  const [emailStep, setEmailStep] = useState<EmailStep>('start');
  const [newEmail, setNewEmail] = useState('');
  const [emailOtpCode, setEmailOtpCode] = useState(['', '', '', '', '', '']);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [emailDoneAddress, setEmailDoneAddress] = useState('');
  const emailOtpInputs = useRef<(HTMLInputElement | null)[]>([]);

  const passwordStrength = getPasswordStrength(newPassword);
  const passwordsMatch = Boolean(newPassword && confirmPassword && newPassword === confirmPassword);
  const passwordValid = newPassword.length >= 8 && passwordStrength.score >= 2;
  const canSubmitReset = passwordValid && passwordsMatch;

  // Charger le profil à l'ouverture
  useEffect(() => {
    if (open) {
      void ensureLoaded();
      // Reset des états à chaque ouverture
      setActiveTab('photo');
      setSelectedPhoto(null);
      setPhotoError(null);
      setPhotoSaved(false);
      setStep('start');
      setOtpCode(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmPassword('');
      setSecurityError(null);
      setResendCooldown(0);
      setSecurityAction(null);
      setEmailStep('start');
      setNewEmail('');
      setEmailOtpCode(['', '', '', '', '', '']);
      setEmailError(null);
      setEmailCooldown(0);
      setEmailDoneAddress('');
    }
  }, [open, ensureLoaded]);

  // Cooldown de renvoi du code (mot de passe)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Cooldown de renvoi du code (changement d'email)
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setTimeout(() => setEmailCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [emailCooldown]);

  // Focus sur le premier champ OTP (mot de passe)
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpInputs.current[0]?.focus(), 100);
    }
  }, [step]);

  // Focus sur le premier champ OTP (changement d'email)
  useEffect(() => {
    if (emailStep === 'otp') {
      setTimeout(() => emailOtpInputs.current[0]?.focus(), 100);
    }
  }, [emailStep]);

  // ─────────────────────────────────────────────────────────────────────────
  // PHOTO DE PROFIL
  // ─────────────────────────────────────────────────────────────────────────

  const handleFileSelect = async (file: File | null) => {
    setPhotoError(null);
    setPhotoSaved(false);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError(L("Le fichier sélectionné n'est pas une image.", 'The selected file is not an image.'));
      return;
    }
    if (file.size > CLIENT_MAX_FILE_BYTES) {
      setPhotoError(L('Image trop volumineuse (max 8 Mo).', 'Image too large (max 8 MB).'));
      return;
    }
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxEdge: CLIENT_MAX_EDGE,
        quality: 0.9,
      });
      setSelectedPhoto(dataUrl);
    } catch {
      setPhotoError(L("Impossible de lire cette image. Essayez un autre format (JPEG, PNG, WebP).", 'Unable to read this image. Try another format (JPEG, PNG, WebP).'));
    }
  };

  const handleSavePhoto = async () => {
    if (!selectedPhoto) return;
    setPhotoSaving(true);
    setPhotoError(null);
    try {
      const response = await authedProfileFetch('/api/users/me/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoDataUrl: selectedPhoto }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || data?.error || L("Échec de l'enregistrement de la photo.", 'Failed to save the photo.'));
      }
      setAvatar(data.avatarUrl || null);
      setSelectedPhoto(null);
      setPhotoSaved(true);
      setTimeout(() => setPhotoSaved(false), 3500);
    } catch (err: any) {
      setPhotoError(err?.message || L("Échec de l'enregistrement de la photo.", 'Failed to save the photo.'));
    } finally {
      setPhotoSaving(false);
    }
  };

  const handleDeletePhoto = async () => {
    setPhotoSaving(true);
    setPhotoError(null);
    try {
      const response = await authedProfileFetch('/api/users/me/avatar', {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || data?.error || L('Échec de la suppression.', 'Failed to remove the photo.'));
      }
      setAvatar(null);
      setSelectedPhoto(null);
    } catch (err: any) {
      setPhotoError(err?.message || L('Échec de la suppression.', 'Failed to remove the photo.'));
    } finally {
      setPhotoSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SÉCURITÉ — Changement de mot de passe (même flux que « mot de passe oublié »)
  // ─────────────────────────────────────────────────────────────────────────

  /** Étape 1 — Envoi du code OTP à l'email du compte connecté. */
  const handleRequestCode = useCallback(async () => {
    setSecurityBusy(true);
    setSecurityError(null);
    try {
      const response = await authedProfileFetch('/api/auth/request-password-change', {
        method: 'POST',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data?.message || L("Impossible d'envoyer le code de vérification.", 'Unable to send the verification code.'));
      }
      setStep('otp');
      setResendCooldown(60);
      setOtpCode(['', '', '', '', '', '']);
    } catch (err: any) {
      setSecurityError(err?.message || L('Une erreur inattendue est survenue.', 'An unexpected error occurred.'));
    } finally {
      setSecurityBusy(false);
    }
  }, [L]);

  /** Étape 2 — Vérification du code OTP. */
  const handleVerifyOtp = useCallback(
    async (codeArg?: string) => {
      const code = codeArg ?? otpCode.join('');
      if (code.length !== 6) {
        setSecurityError(L('Veuillez saisir les 6 chiffres du code.', 'Please enter all 6 digits of the code.'));
        return;
      }
      setSecurityBusy(true);
      setSecurityError(null);
      try {
        const response = await fetch('/api/auth/verify-reset-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, code }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data?.message || L('Code invalide ou expiré.', 'Invalid or expired code.'));
        }
        setStep('reset');
      } catch (err: any) {
        setSecurityError(err?.message || L('Code invalide. Veuillez réessayer.', 'Invalid code. Please try again.'));
        setOtpCode(['', '', '', '', '', '']);
        setTimeout(() => otpInputs.current[0]?.focus(), 100);
      } finally {
        setSecurityBusy(false);
      }
    },
    [otpCode, email, L]
  );

  /** Étape 3 — Définition du nouveau mot de passe. */
  const handleResetPassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmitReset) return;
    setSecurityBusy(true);
    setSecurityError(null);
    try {
      const code = otpCode.join('');
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data?.message || L('Erreur lors du changement de mot de passe.', 'Error while changing the password.'));
      }
      setStep('success');
    } catch (err: any) {
      setSecurityError(err?.message || L('Erreur lors du changement de mot de passe.', 'Error while changing the password.'));
    } finally {
      setSecurityBusy(false);
    }
  };

  /** Gestion des inputs OTP (un chiffre par champ, auto-focus, auto-submit). */
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1);
    setOtpCode(newOtp);
    setSecurityError(null);
    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
    if (newOtp.every((d) => d !== '') && newOtp.join('').length === 6) {
      setTimeout(() => handleVerifyOtp(newOtp.join('')), 150);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      void handleVerifyOtp();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newOtp = [...otpCode];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pasted[i] || '';
      }
      setOtpCode(newOtp);
      const nextEmpty = newOtp.findIndex((d) => d === '');
      if (nextEmpty >= 0) {
        otpInputs.current[nextEmpty]?.focus();
      } else {
        setTimeout(() => handleVerifyOtp(newOtp.join('')), 150);
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SÉCURITÉ — Changement d'adresse email (même mécanique OTP sécurisée)
  // ─────────────────────────────────────────────────────────────────────────

  /** Nouvelle adresse saisie valide et différente de l'actuelle. */
  const normalizedNewEmail = newEmail.trim().toLowerCase();
  const newEmailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedNewEmail);
  const newEmailIsDifferent = normalizedNewEmail !== email;
  const canRequestEmailCode = newEmailIsValid && newEmailIsDifferent && !emailBusy;

  /** Étape 1 — Envoi du code OTP à la NOUVELLE adresse. */
  const handleRequestEmailCode = useCallback(async () => {
    if (!newEmailIsValid) {
      setEmailError(L('Veuillez saisir une adresse email valide.', 'Please enter a valid email address.'));
      return;
    }
    if (!newEmailIsDifferent) {
      setEmailError(L('La nouvelle adresse est identique à votre adresse actuelle.', 'The new address is the same as your current address.'));
      return;
    }
    setEmailBusy(true);
    setEmailError(null);
    try {
      const response = await authedProfileFetch('/api/auth/request-email-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: normalizedNewEmail }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data?.message || L("Impossible d'envoyer le code de vérification.", 'Unable to send the verification code.'));
      }
      setEmailStep('otp');
      setEmailCooldown(60);
      setEmailOtpCode(['', '', '', '', '', '']);
    } catch (err: any) {
      setEmailError(err?.message || L('Une erreur inattendue est survenue.', 'An unexpected error occurred.'));
    } finally {
      setEmailBusy(false);
    }
  }, [newEmailIsValid, newEmailIsDifferent, normalizedNewEmail, L]);

  /** Étape 2 — Vérification du code + application du changement (one-shot). */
  const handleConfirmEmailOtp = useCallback(
    async (codeArg?: string) => {
      const code = codeArg ?? emailOtpCode.join('');
      if (code.length !== 6) {
        setEmailError(L('Veuillez saisir les 6 chiffres du code.', 'Please enter all 6 digits of the code.'));
        return;
      }
      setEmailBusy(true);
      setEmailError(null);
      try {
        const response = await authedProfileFetch('/api/auth/confirm-email-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, newEmail: normalizedNewEmail }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data?.message || L('Code invalide ou expiré.', 'Invalid or expired code.'));
        }
        setEmailDoneAddress(data.email || normalizedNewEmail);
        setEmailStep('success');
      } catch (err: any) {
        setEmailError(err?.message || L('Code invalide. Veuillez réessayer.', 'Invalid code. Please try again.'));
        setEmailOtpCode(['', '', '', '', '', '']);
        setTimeout(() => emailOtpInputs.current[0]?.focus(), 100);
      } finally {
        setEmailBusy(false);
      }
    },
    [emailOtpCode, normalizedNewEmail, L]
  );

  /** Gestion des inputs OTP email (un chiffre par champ, auto-focus, auto-submit). */
  const handleEmailOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...emailOtpCode];
    newOtp[index] = value.slice(-1);
    setEmailOtpCode(newOtp);
    setEmailError(null);
    if (value && index < 5) {
      emailOtpInputs.current[index + 1]?.focus();
    }
    if (newOtp.every((d) => d !== '') && newOtp.join('').length === 6) {
      setTimeout(() => handleConfirmEmailOtp(newOtp.join('')), 150);
    }
  };

  const handleEmailOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !emailOtpCode[index] && index > 0) {
      emailOtpInputs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      void handleConfirmEmailOtp();
    }
  };

  const handleEmailOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newOtp = [...emailOtpCode];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pasted[i] || '';
      }
      setEmailOtpCode(newOtp);
      const nextEmpty = newOtp.findIndex((d) => d === '');
      if (nextEmpty >= 0) {
        emailOtpInputs.current[nextEmpty]?.focus();
      } else {
        setTimeout(() => handleConfirmEmailOtp(newOtp.join('')), 150);
      }
    }
  };

  /** Succès — déconnexion propre puis retour au login (sessions serveur invalidées). */
  const handleReLogin = async () => {
    try {
      // Logout best-effort (3 s max) — les sessions serveur sont déjà invalidées
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      await fetch('/api/auth/logout', { method: 'POST', signal: controller.signal }).catch(() => {});
      clearTimeout(timeoutId);
    } finally {
      clearClientSessionSync();
      window.location.href = '/login';
    }
  };

  // Avatar effectif : photo perso > photo du dossier RH (module RH) > initiales
  const avatarUrl = selectedPhoto ?? profile?.avatarUrl ?? profile?.hrPhotoUrl ?? null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-white rounded-2xl sm:rounded-2xl gap-0">
        {/* ── En-tête : avatar + identité ── */}
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-br from-[#0b2f73] to-[#1d4fa5] text-left">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <UserAvatar
                photoUrl={selectedPhoto ?? profile?.avatarUrl ?? profile?.hrPhotoUrl}
                firstName={display.firstName}
                lastName={display.lastName}
                email={display.email}
                size={64}
                className="ring-4 ring-white/20"
              />
              {/* Badge caméra indicatif */}
              <div
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white"
                style={{ backgroundColor: GOLD }}
              >
                <Camera className="w-3 h-3 text-[#0b2f73]" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-bold text-white truncate">
                {L('Mon profil', 'My Profile')}
              </DialogTitle>
              <p className="text-sm text-white/90 font-medium truncate">{displayName}</p>
              {roleLabel && (
                <p className="text-[11px] text-gold-400 font-medium tracking-wide mt-0.5">
                  {roleLabel}
                </p>
              )}
            </div>
          </div>
          <DialogDescription className="sr-only">
            {L("Gérer ma photo de profil, mon mot de passe et mon adresse email", 'Manage my profile photo, password and email address')}
          </DialogDescription>
        </DialogHeader>

        {/* ── Onglets ── */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => setActiveTab('photo')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'photo' ? 'text-[#0b2f73] border-b-2 border-[#0b2f73] bg-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Camera className="w-4 h-4" />
            {L('Photo de profil', 'Profile Photo')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'security' ? 'text-[#0b2f73] border-b-2 border-[#0b2f73] bg-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Shield className="w-4 h-4" />
            {L('Sécurité', 'Security')}
          </button>
        </div>

        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {/* ⭐ Compte sans session API valide (ex : admin plateforme géré par
              la configuration) — la gestion self-service ne s'applique pas. */}
          {profileUnavailable && (
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {L(
                  'Ce compte est géré au niveau de la configuration de la plateforme. La photo de profil et le mot de passe self-service sont réservés aux comptes utilisateurs (écoles, enseignants, parents).',
                  'This account is managed at the platform configuration level. Self-service profile photo and password are reserved for user accounts (schools, teachers, parents).'
                )}
              </p>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              ONGLET PHOTO DE PROFIL
              ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'photo' && !profileUnavailable && (
            <div className="space-y-4">
              {/* Aperçu */}
              <div className="flex flex-col items-center py-2">
                <UserAvatar
                  photoUrl={avatarUrl}
                  firstName={display.firstName}
                  lastName={display.lastName}
                  email={display.email}
                  size={112}
                  className={selectedPhoto ? 'ring-4 ring-emerald-400/60' : 'ring-2 ring-slate-200'}
                />
                <p className="mt-3 text-xs text-slate-500 text-center max-w-[280px]">
                  {selectedPhoto
                    ? L("Aperçu de votre nouvelle photo. Enregistrez pour l'appliquer.", 'Preview of your new photo. Save to apply.')
                    : L(
                        'Votre photo apparaît dans votre menu profil et dans Helm Connect.',
                        'Your photo appears in your profile menu and Helm Connect.'
                      )}
                </p>
              </div>

              {/* Notifications */}
              {photoSaved && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  {L('Photo de profil mise à jour avec succès.', 'Profile photo updated successfully.')}
                </div>
              )}
              {photoError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{photoError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    void handleFileSelect(e.target.files?.[0] ?? null);
                    // Permet de re-choisir le même fichier après annulation
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoSaving}
                  className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white min-h-[44px] disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                >
                  <Camera className="w-4 h-4" />
                  {selectedPhoto
                    ? L('Choisir une autre image', 'Choose another image')
                    : (profile?.avatarUrl || profile?.hrPhotoUrl)
                      ? L('Changer ma photo', 'Change my photo')
                      : L('Ajouter une photo', 'Add a photo')}
                </button>

                {selectedPhoto && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSavePhoto}
                      disabled={photoSaving}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 min-h-[44px] disabled:opacity-50"
                    >
                      {photoSaving ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {photoSaving ? L('Enregistrement…', 'Saving…') : L('Enregistrer la photo', 'Save photo')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPhoto(null);
                        setPhotoError(null);
                      }}
                      disabled={photoSaving}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 min-h-[44px]"
                    >
                      {L('Annuler', 'Cancel')}
                    </button>
                  </div>
                )}

                {!selectedPhoto && profile?.avatarUrl && (
                  <button
                    type="button"
                    onClick={handleDeletePhoto}
                    disabled={photoSaving}
                    className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 min-h-[44px] disabled:opacity-50"
                  >
                    {photoSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {L('Supprimer ma photo', 'Remove my photo')}
                  </button>
                )}
              </div>

              {/* ⭐ Photo issue du dossier du personnel (module RH) : affichée
                  en attendant qu'une photo personnelle soit importée — la
                  photo du dossier RH reste inchangée (lecture seule). */}
              {!selectedPhoto && !profile?.avatarUrl && profile?.hrPhotoUrl && (
                <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-slate-600">
                  <AtSign className="w-4 h-4 text-[#1d4fa5] flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    {L(
                      'Photo affichée depuis votre dossier du personnel (module RH). Importez une photo personnelle pour la remplacer ici — la photo de votre dossier RH reste inchangée.',
                      'Photo shown from your staff record (HR module). Upload a personal photo to replace it here — your HR record photo stays unchanged.'
                    )}
                  </p>
                </div>
              )}

              <p className="text-[11px] text-slate-400 text-center">
                {L('Formats : JPEG, PNG, WebP, GIF · max 8 Mo · recadrage carré automatique', 'Formats: JPEG, PNG, WebP, GIF · max 8 MB · automatic square crop')}
              </p>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              ONGLET SÉCURITÉ — Mot de passe & adresse email
              ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'security' && !profileUnavailable && (
            <div className="space-y-4">
              {/* ── Choix de l'action : mot de passe | adresse email ── */}
              {securityAction === null && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSecurityAction('password');
                      setStep('start');
                      setSecurityError(null);
                    }}
                    className="w-full flex items-start gap-3 rounded-xl border border-slate-200 hover:border-[#1d4fa5] hover:bg-blue-50/40 px-4 py-4 text-left transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#eef4ff' }}>
                      <KeyRound className="w-5 h-5 text-[#1d4fa5]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {L('Changer mon mot de passe', 'Change my password')}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                        {L(
                          'Par code de vérification envoyé à votre adresse email actuelle.',
                          'By verification code sent to your current email address.'
                        )}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSecurityAction('email');
                      setEmailStep('start');
                      setEmailError(null);
                    }}
                    className="w-full flex items-start gap-3 rounded-xl border border-slate-200 hover:border-[#1d4fa5] hover:bg-blue-50/40 px-4 py-4 text-left transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#eef4ff' }}>
                      <AtSign className="w-5 h-5 text-[#1d4fa5]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {L("Changer mon adresse email", 'Change my email address')}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                        {L(
                          'Saisissez une nouvelle adresse — un code de vérification lui est envoyé pour la confirmer.',
                          'Enter a new address — a verification code is sent to it for confirmation.'
                        )}
                      </p>
                    </div>
                  </button>
                </div>
              )}

              {securityAction === 'password' && (
                <>
              {/* Bandeau process — miroir de « mot de passe oublié » */}
              <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                <KeyRound className="w-4 h-4 text-[#1d4fa5] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  {L(
                    'Sécurisé par code de vérification — le même processus que « mot de passe oublié » : un code à 6 chiffres est envoyé à votre adresse email.',
                    'Secured by verification code — the same process as “forgot password”: a 6-digit code is sent to your email address.'
                  )}
                </p>
              </div>

              {/* Retour au choix de l'action */}
              {step !== 'success' && (
                <button
                  type="button"
                  onClick={() => setSecurityAction(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {L('Autres options de sécurité', 'Other security options')}
                </button>
              )}

              {securityError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{securityError}</span>
                </div>
              )}

              {/* ── Étape 1 : envoi du code ── */}
              {step === 'start' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                    <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0 text-sm">
                      <span className="text-slate-500">{L('Code envoyé à :', 'Code sent to:')} </span>
                      <span className="font-semibold text-slate-800 truncate">
                        {email ? (loadingProfile && !profile ? '…' : maskEmail(email)) : '—'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRequestCode}
                    disabled={securityBusy || !email}
                    className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white min-h-[44px] disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                  >
                    {securityBusy ? <Loader className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    {securityBusy
                      ? L('Envoi du code…', 'Sending code…')
                      : L('Recevoir le code de vérification', 'Get verification code')}
                  </button>
                  {!email && (
                    <p className="text-xs text-slate-400 text-center">
                      {L('Adresse email indisponible — rechargez la page.', 'Email address unavailable — reload the page.')}
                    </p>
                  )}
                </div>
              )}

              {/* ── Étape 2 : saisie du code OTP ── */}
              {step === 'otp' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 text-center">
                    {L(
                      `Saisissez le code à 6 chiffres envoyé à ${email ? maskEmail(email) : 'votre email'}.`,
                      `Enter the 6-digit code sent to ${email ? maskEmail(email) : 'your email'}.`
                    )}
                  </p>
                  <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                    {otpCode.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          otpInputs.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        disabled={securityBusy}
                        aria-label={`Chiffre ${i + 1}`}
                        className="w-11 h-12 text-center text-lg font-bold rounded-xl border-2 border-slate-200 focus:border-[#1d4fa5] focus:ring-2 focus:ring-[#1d4fa5]/20 outline-none transition-all text-slate-900 disabled:opacity-50"
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
                    <button
                      type="button"
                      onClick={() => setStep('start')}
                      className="font-medium text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
                    >
                      {L('Modifier l\'email', 'Change email')}
                    </button>
                    <span className="text-slate-300">·</span>
                    {resendCooldown > 0 ? (
                      <span className="text-slate-400">
                        {L(`Renvoyer le code (${resendCooldown}s)`, `Resend code (${resendCooldown}s)`)}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestCode}
                        disabled={securityBusy}
                        className="font-semibold text-[#1d4fa5] hover:underline disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        {L('Renvoyer le code', 'Resend code')}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleVerifyOtp()}
                    disabled={securityBusy || otpCode.join('').length !== 6}
                    className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white min-h-[44px] disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                  >
                    {securityBusy ? <Loader className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    {L('Vérifier le code', 'Verify code')}
                  </button>
                </div>
              )}

              {/* ── Étape 3 : nouveau mot de passe ── */}
              {step === 'reset' && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label htmlFor="profile-new-password" className="mb-1.5 block text-sm font-semibold text-slate-900">
                      {L('Nouveau mot de passe', 'New password')}
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Lock className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        id="profile-new-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setSecurityError(null);
                        }}
                        className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-11 min-h-[44px] outline-none focus:border-[#1d4fa5] focus:ring-2 focus:ring-[#1d4fa5]/20 transition-all text-sm"
                        placeholder={L('Choisissez un mot de passe fort', 'Choose a strong password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center justify-center w-11 min-h-[44px] pr-1 text-slate-400 hover:text-slate-700"
                        aria-label={showPassword ? L('Masquer', 'Hide') : L('Afficher', 'Show')}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Jauge de force */}
                    {newPassword && (
                      <div className="mt-2.5">
                        <div className="flex gap-1.5">
                          {[1, 2, 3, 4].map((level) => (
                            <div
                              key={level}
                              className="h-1.5 flex-1 rounded-full transition-all duration-300"
                              style={{
                                backgroundColor: passwordStrength.score >= level ? passwordStrength.color : '#e2e8f0',
                              }}
                            />
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {L('Force :', 'Strength:')}{' '}
                          <span style={{ color: passwordStrength.color }}>{passwordStrength.label}</span>
                        </p>
                      </div>
                    )}

                    {/* Checklist — identique à « mot de passe oublié » */}
                    <div className="mt-2 space-y-1">
                      {[
                        { label: L('Au moins 8 caractères', 'At least 8 characters'), met: newPassword.length >= 8 },
                        { label: L('Une lettre majuscule', 'An uppercase letter'), met: /[A-Z]/.test(newPassword) },
                        { label: L('Un chiffre', 'A digit'), met: /\d/.test(newPassword) },
                        { label: L('Un caractère spécial', 'A special character'), met: /[^A-Za-z0-9]/.test(newPassword) },
                      ].map((req) => (
                        <div key={req.label} className="flex items-center gap-2">
                          <CheckCircle2
                            className={`h-3.5 w-3.5 transition-colors ${req.met ? 'text-emerald-500' : 'text-slate-300'}`}
                          />
                          <span className={`text-xs transition-colors ${req.met ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {req.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="profile-confirm-password" className="mb-1.5 block text-sm font-semibold text-slate-900">
                      {L('Confirmer le mot de passe', 'Confirm password')}
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Lock className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        id="profile-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setSecurityError(null);
                        }}
                        className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-11 min-h-[44px] outline-none focus:border-[#1d4fa5] focus:ring-2 focus:ring-[#1d4fa5]/20 transition-all text-sm"
                        style={{ borderColor: confirmPassword && !passwordsMatch ? '#ef4444' : undefined }}
                        placeholder={L('Retapez le mot de passe', 'Retype the password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 flex items-center justify-center w-11 min-h-[44px] pr-1 text-slate-400 hover:text-slate-700"
                        aria-label={showConfirmPassword ? L('Masquer', 'Hide') : L('Afficher', 'Show')}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && !passwordsMatch && (
                      <p className="mt-1 text-xs text-red-500">
                        {L('Les mots de passe ne correspondent pas', 'Passwords do not match')}
                      </p>
                    )}
                    {confirmPassword && passwordsMatch && (
                      <p className="mt-1 text-xs text-emerald-600">
                        {L('Les mots de passe correspondent', 'Passwords match')}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={securityBusy || !canSubmitReset}
                    className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white min-h-[44px] disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                  >
                    {securityBusy ? <Loader className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    {securityBusy ? L('Changement…', 'Changing…') : L('Changer mon mot de passe', 'Change my password')}
                  </button>
                </form>
              )}

              {/* ── Étape 4 : succès ── */}
              {step === 'success' && (
                <div className="space-y-4 text-center py-2">
                  <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-900">
                      {L('Mot de passe modifié avec succès', 'Password changed successfully')}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                      {L(
                        'Pour votre sécurité, toutes vos sessions ont été fermées. Veuillez vous reconnecter avec votre nouveau mot de passe.',
                        'For your security, all your sessions have been closed. Please sign in again with your new password.'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleReLogin}
                    className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white min-h-[44px]"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                  >
                    <LogOut className="w-4 h-4" />
                    {L('Me reconnecter', 'Sign in again')}
                  </button>
                </div>
              )}
                </>
              )}

              {/* ════════════════════════════════════════════════════════════
                  CHANGEMENT D'ADRESSE EMAIL (même mécanique OTP sécurisée)
                  ════════════════════════════════════════════════════════════ */}
              {securityAction === 'email' && (
                <>
              {/* Bandeau process */}
              <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                <AtSign className="w-4 h-4 text-[#1d4fa5] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  {L(
                    'Le code de vérification est envoyé à votre NOUVELLE adresse : seul son propriétaire peut confirmer le changement. Votre ancienne adresse reçoit une notification de sécurité.',
                    'The verification code is sent to your NEW address: only its owner can confirm the change. Your old address receives a security notification.'
                  )}
                </p>
              </div>

              {/* Retour au choix de l'action */}
              {emailStep !== 'success' && (
                <button
                  type="button"
                  onClick={() => setSecurityAction(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {L('Autres options de sécurité', 'Other security options')}
                </button>
              )}

              {emailError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{emailError}</span>
                </div>
              )}

              {/* ── Étape 1 : nouvelle adresse ── */}
              {emailStep === 'start' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                    <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0 text-sm">
                      <span className="text-slate-500">{L('Adresse actuelle :', 'Current address:')} </span>
                      <span className="font-semibold text-slate-800 truncate">
                        {email ? (loadingProfile && !profile ? '…' : maskEmail(email)) : '—'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="profile-new-email" className="mb-1.5 block text-sm font-semibold text-slate-900">
                      {L('Nouvelle adresse email', 'New email address')}
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <AtSign className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        id="profile-new-email"
                        type="email"
                        autoComplete="email"
                        value={newEmail}
                        onChange={(e) => {
                          setNewEmail(e.target.value);
                          setEmailError(null);
                        }}
                        className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-4 min-h-[44px] outline-none focus:border-[#1d4fa5] focus:ring-2 focus:ring-[#1d4fa5]/20 transition-all text-sm"
                        style={{ borderColor: newEmail && !newEmailIsValid ? '#ef4444' : undefined }}
                        placeholder={L('ex : prenom.nom@exemple.com', 'e.g. firstname.lastname@example.com')}
                      />
                    </div>
                    {newEmail && !newEmailIsValid && (
                      <p className="mt-1 text-xs text-red-500">
                        {L('Adresse email invalide.', 'Invalid email address.')}
                      </p>
                    )}
                    {newEmail && newEmailIsValid && !newEmailIsDifferent && (
                      <p className="mt-1 text-xs text-amber-600">
                        {L('Cette adresse est identique à votre adresse actuelle.', 'This address is the same as your current address.')}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleRequestEmailCode}
                    disabled={!canRequestEmailCode}
                    className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white min-h-[44px] disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                  >
                    {emailBusy ? <Loader className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    {emailBusy
                      ? L('Envoi du code…', 'Sending code…')
                      : L('Envoyer le code de vérification', 'Send verification code')}
                  </button>
                </div>
              )}

              {/* ── Étape 2 : saisie du code OTP ── */}
              {emailStep === 'otp' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 text-center">
                    {L(
                      `Saisissez le code à 6 chiffres envoyé à ${normalizedNewEmail ? maskEmail(normalizedNewEmail) : 'votre nouvelle adresse'}.`,
                      `Enter the 6-digit code sent to ${normalizedNewEmail ? maskEmail(normalizedNewEmail) : 'your new address'}.`
                    )}
                  </p>
                  <div className="flex justify-center gap-2" onPaste={handleEmailOtpPaste}>
                    {emailOtpCode.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          emailOtpInputs.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleEmailOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleEmailOtpKeyDown(i, e)}
                        disabled={emailBusy}
                        aria-label={`Chiffre ${i + 1}`}
                        className="w-11 h-12 text-center text-lg font-bold rounded-xl border-2 border-slate-200 focus:border-[#1d4fa5] focus:ring-2 focus:ring-[#1d4fa5]/20 outline-none transition-all text-slate-900 disabled:opacity-50"
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
                    <button
                      type="button"
                      onClick={() => setEmailStep('start')}
                      className="font-medium text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
                    >
                      {L("Modifier l'adresse", 'Change address')}
                    </button>
                    <span className="text-slate-300">·</span>
                    {emailCooldown > 0 ? (
                      <span className="text-slate-400">
                        {L(`Renvoyer le code (${emailCooldown}s)`, `Resend code (${emailCooldown}s)`)}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestEmailCode}
                        disabled={emailBusy}
                        className="font-semibold text-[#1d4fa5] hover:underline disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        {L('Renvoyer le code', 'Resend code')}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleConfirmEmailOtp()}
                    disabled={emailBusy || emailOtpCode.join('').length !== 6}
                    className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white min-h-[44px] disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                  >
                    {emailBusy ? <Loader className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    {L('Confirmer ma nouvelle adresse', 'Confirm my new address')}
                  </button>
                </div>
              )}

              {/* ── Étape 3 : succès ── */}
              {emailStep === 'success' && (
                <div className="space-y-4 text-center py-2">
                  <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-900">
                      {L('Adresse email modifiée avec succès', 'Email address changed successfully')}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                      {L(
                        `Votre adresse est désormais ${emailDoneAddress || normalizedNewEmail}. Pour votre sécurité, toutes vos sessions ont été fermées — reconnectez-vous avec votre nouvelle adresse.`,
                        `Your address is now ${emailDoneAddress || normalizedNewEmail}. For your security, all your sessions have been closed — sign in again with your new address.`
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleReLogin}
                    className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white min-h-[44px]"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                  >
                    <LogOut className="w-4 h-4" />
                    {L('Me reconnecter', 'Sign in again')}
                  </button>
                </div>
              )}
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
