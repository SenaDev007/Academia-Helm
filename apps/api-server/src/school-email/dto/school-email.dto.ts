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
  Matches,
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

/**
 * ⭐ 2026-11-26 (retour promoteur) — DOUBLE IDENTITÉ E-MAIL PAR NIVEAU :
 * les écoles combinées (maternelle/primaire + secondaire) configurent UNE
 * connexion Google par identité — les messages du côté maternelle/primaire
 * partent de l'adresse de ce niveau, ceux du secondaire de l'adresse du
 * secondaire. Le routage est automatique (classe de l'élève / niveau du
 * personnel) et sans configuration secondaire, tout part de la connexion
 * principale (repli transparent).
 */
export type EmailLevelCategory181 = 'MATERNAL_PRIMARY' | 'SECONDARY';

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
  /**
   * TÂCHE 185 — bouton « Envoyer un e-mail test » UNIQUEMENT : tente l'envoi
   * même si la connexion est Erreur/Expirée. Un succès rétablit Actif
   * (markVerified au dispatcher) — le test devient ainsi l'outil de diagnostic
   * ET d'auto-réparation ; un échec remonte la vraie cause (lastError de la
   * file) au lieu du message générique. Jamais utilisé par les envois métier.
   */
  allowUnhealthyConnection?: boolean;
  /**
   * ⭐ 2026-11-26 — identité d'envoi PAR NIVEAU (double identité) : connexion
   * Google du secondaire si SECONDARY, sinon connexion principale. Défaut :
   * connexion principale (maternelle/primaire).
   */
  levelCategory?: EmailLevelCategory181;
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
const LEVEL_CATEGORIES = ['MATERNAL_PRIMARY', 'SECONDARY'] as const;

export class SaveSchoolEmailConfigDto {
  @IsIn(MODES)
  mode!: 'smtp';

  /** ⭐ 2026-11-26 — ligne de réglages visée (défaut : maternelle/primaire). */
  @IsOptional()
  @IsIn(LEVEL_CATEGORIES)
  levelCategory?: EmailLevelCategory181;

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

  /** ⭐ 2026-11-26 — connexion testée : principale ou secondaire. */
  @IsOptional()
  @IsIn(LEVEL_CATEGORIES)
  levelCategory?: EmailLevelCategory181;
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

  /**
   * ⭐ 2026-11-26 (double identité) — connexion Google du NIVEAU visé :
   * MATERNAL_PRIMARY (défaut) ou SECONDARY (écoles combinées). Le state OAuth
   * le transporte jusqu'au callback pour persister dans la bonne ligne.
   */
  @IsOptional()
  @IsIn(LEVEL_CATEGORIES)
  levelCategory?: EmailLevelCategory181;

  /**
   * ⭐ 2026-11-27 — Origine EXACTE du front d'où le directeur a lancé la
   * connexion (ex: https://ecole.academiahelm.com). Les sessions étant
   * HOST-ONLY par sous-domaine, le callback DOIT ramener l'utilisateur sur
   * CETTE origine — sinon il atterrit sur le domaine principal sans session
   * et est éjecté vers /login (bug remonté par le promoteur).
   * Posée par la route BFF web-app (nextUrl.origin), jamais saisie à la main.
   */
  @IsOptional()
  @Matches(/^https?:\/\/[a-zA-Z0-9.\-:]+$/, { message: 'frontendOrigin doit être une URL http(s) valide' })
  @MaxLength(200)
  frontendOrigin?: string;
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
  /** ⭐ 2026-11-26 — connexion Google par NIVEAU (double identité). */
  levelCategory?: EmailLevelCategory181;
}
