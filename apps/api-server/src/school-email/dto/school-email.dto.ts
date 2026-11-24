/**
 * ============================================================================
 * 📧 TÂCHE 181 — E-MAIL ÉCOLE : types et DTOs partagés
 * ============================================================================
 *
 * Cahier des charges « Academia Helm : envoi d'e-mails via le Gmail de chaque
 * école ». Phase 1 : SMTP Gmail avec mot de passe d'application (chiffré
 * AES-256-GCM). Phase 2 (à venir) : Google OAuth2.
 *
 * ⚠️ PRÉCISION PROMOTEUR (2026-11-24) — routage des transporteurs :
 *   - E-mails SYSTÈME Academia Helm (catégorie `system` : réinitialisation
 *     de mot de passe, invitations, vérification d'adresse) → Resend
 *     plateforme, hors plafond école.
 *   - E-mails des ÉCOLES TENANTES (tous les autres modules) → UNIQUEMENT le
 *     SMTP de l'école (OAuth2 en phase 2). AUCUN repli Resend : sans
 *     configuration, l'envoi échoue avec un message explicite.
 * ============================================================================
 */

import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
} from 'class-validator';

/** Modules appelants (section 9 du cahier des charges). */
export type EmailModule181 =
  | 'pedagogie'
  | 'eleves'
  | 'finance'
  | 'examens'
  | 'rh'
  | 'communication'
  | 'settings';

/** Catégories. `system` = e-mails plateforme Academia Helm (Resend). */
export type EmailCategory181 =
  | 'system'
  | 'pedagogie'
  | 'eleves'
  | 'finance'
  | 'examens'
  | 'rh'
  | 'communication'
  | 'test';

/** Transporteur réellement utilisé pour un envoi. */
export type EmailProvider181 = 'google_oauth' | 'smtp' | 'resend';

/** Statuts du journal email_send_log (une ligne par destinataire). */
export type EmailSendStatus181 = 'pending' | 'envoye' | 'reporte' | 'echec';

/** Statuts de la file email_queue. */
export type EmailQueueStatus181 = 'en_attente' | 'envoye' | 'reporte' | 'echec';

/** Statuts de la connexion e-mail de l'école (school_email_settings.status). */
export type SchoolEmailStatus181 = 'non_configure' | 'actif' | 'expire' | 'erreur';

/** Modes de connexion (phase 1 : SMTP uniquement). */
export type SchoolEmailMode181 = 'smtp' | 'google_oauth' | 'aucun';

/** Pièce jointe sérialisable (le contenu Buffer est encodé en base64 dans la file). */
export interface EmailAttachment181 {
  filename: string;
  content?: string; // texte brut OU base64 (voir contentBase64)
  contentBase64?: boolean;
  path?: string;
  contentType?: string;
}

/**
 * Signature centrale EXIGÉE par le cahier des charges (section 3) :
 * EmailService.send(schoolId, module, category, to, subject, html, text,
 * replyTo?, attachments?) — implémentée par CentralEmailService.send().
 */
export interface CentralEmailSendInput {
  /** École émettrice (= tenantId dans le modèle multi-tenant). */
  schoolId: string;
  module: EmailModule181;
  category: EmailCategory181;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment181[];
  /** Utilisateur à l'origine de l'envoi (audit). */
  triggeredByUserId?: string;
  /**
   * true = attendre l'envoi réel (utilisé par le bouton « Envoyer un e-mail
   * test »). false (défaut) = mettre en file et rendre la main immédiatement.
   */
  wait?: boolean;
}

export interface CentralEmailSendResult {
  /** Statut final de la demande (pas forcément de l'envoi physique). */
  status: 'envoye' | 'en_file' | 'reporte' | 'echec';
  /** IDs des lignes email_send_log (une par destinataire). */
  sendLogIds?: string[];
  /** ID de l'élément de file si passage par la file. */
  queueItemId?: string;
  /** Nombre de destinataires comptés dans le plafond. */
  recipientCount: number;
  /** Message d'erreur éventuel (jamais un secret). */
  error?: string;
  /** Code d'erreur machine (ex. EMAIL_SCHOOL_NOT_CONFIGURED). */
  errorCode?: string;
}

/** Vue SÛRE des réglages e-mail d'une école — JAMAIS de secret dedans. */
export interface SchoolEmailSettingsView {
  configured: boolean;
  mode: SchoolEmailMode181;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  /** true si un secret est présent (affiché « •••• » côté UI). */
  secretSet: boolean;
  status: SchoolEmailStatus181;
  lastError: string | null;
  lastVerifiedAt: string | null;
  dailyCap: number;
}

/** Compteur du jour pour le bandeau de l'onglet E-mail. */
export interface SchoolEmailUsageView {
  /** Destinataires comptés dans la fenêtre glissante 24 h (pending + envoyés). */
  sent24h: number;
  /** Plafond de l'école (défaut 490). */
  dailyCap: number;
  /** Date de prochaine remise à zéro (entrée la plus ancienne + 24 h). */
  windowResetsAt: string | null;
  /** Éléments actuellement reportés (plafond atteint). */
  deferredCount: number;
  /** Essais du bouton de test dans la dernière heure (max 5). */
  testCountLastHour: number;
}

/** Ligne du journal des 50 derniers envois. */
export interface EmailSendLogEntry {
  id: string;
  module: string;
  category: string;
  recipient: string;
  subject: string;
  provider: string;
  status: string;
  errorCode: string | null;
  createdAt: string;
}

// ─── DTOs du controller (validation class-validator) ─────────────────────

const MODES = ['smtp'] as const; // Phase 1 : SMTP uniquement

export class SaveSchoolEmailConfigDto {
  @IsIn(MODES)
  mode!: 'smtp';

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fromName!: string;

  @IsEmail()
  fromEmail!: string;

  @IsOptional()
  @IsEmail()
  replyTo?: string;

  @IsOptional()
  @IsString()
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @IsOptional()
  @IsString()
  smtpUser?: string;

  /**
   * Mot de passe d'application Gmail. Champ masqué côté UI ; chiffré
   * AES-256-GCM côté serveur ; JAMAIS renvoyé au navigateur ensuite.
   * Absent = conserver le secret existant (édition sans retaper).
   */
  @IsOptional()
  @IsString()
  smtpPassword?: string;
}

export class SendTestEmailDto {
  /** Destinataire optionnel — PAR DÉFAUT l'adresse de l'utilisateur connecté. */
  @IsOptional()
  @IsEmail()
  to?: string;
}

/**
 * TÂCHE 183 (Phase 2) — Démarrage du flux Google OAuth2 (bouton
 * « Connecter Google »). Les champs communs accompagnent le state pour
 * pré-remplir la configuration au retour du consentement (migration 1 clic :
 * tous optionnels — les valeurs existantes sont conservées sinon).
 */
export class StartGoogleOauthDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fromName?: string;

  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  @IsOptional()
  @IsEmail()
  replyTo?: string;
}

export class UpdateDailyCapDto {
  @IsInt()
  @Min(1)
  @Max(2000)
  dailyCap!: number;
}

// ─── Payload stocké dans email_queue.payload (JSON) ─────────────────────────

export interface EmailQueuePayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment181[];
  /** Lien vers l'EmailLog du module Communication (bridge sendCategorized). */
  emailLogId?: string;
  /** Utilisateur à l'origine (audit). */
  triggeredByUserId?: string;
}
