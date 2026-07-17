/**
 * ============================================================================
 * UpdateCardDesignDto
 * ============================================================================
 * DTO pour la mise à jour des paramètres de design des cartes scolaires.
 *
 * Ces champs sont persistés sur le modèle `TenantIdentityProfile` (table
 * `tenant_identity_profiles`, colonnes `cardPrimaryColor`, `cardSecondaryColor`,
 * `cardShowBarcode`, etc. — voir migrations 011/012).
 *
 * Le DTO est également utilisé pour surcharger le design au moment de la
 * génération (snapshot JSON stocké sur `StudentIdCard.designSnapshot`).
 *
 * Toutes les valeurs sont optionnelles : on effectue une mise à jour partielle
 * (PATCH sémantique).
 * ============================================================================
 */

import {
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
  Matches,
  IsHexColor,
} from 'class-validator';

export class UpdateCardDesignDto {
  /** Couleur primaire (header / footer / accents principaux). Format hex. */
  @IsOptional()
  @IsString()
  @IsHexColor()
  cardPrimaryColor?: string;

  /** Couleur secondaire (bordures, dégradés, matricule). Format hex. */
  @IsOptional()
  @IsString()
  @IsHexColor()
  cardSecondaryColor?: string;

  /** Afficher le QR code au verso. */
  @IsOptional()
  @IsBoolean()
  cardShowQRCode?: boolean;

  /** Afficher le code-barres au verso. */
  @IsOptional()
  @IsBoolean()
  cardShowBarcode?: boolean;

  /** Afficher la photo de l'élève au recto. */
  @IsOptional()
  @IsBoolean()
  cardShowPhoto?: boolean;

  /** Afficher les coordonnées du tuteur (recto). */
  @IsOptional()
  @IsBoolean()
  cardShowGuardian?: boolean;

  /** Afficher le bouton "appel d'urgence" (verso contact). */
  @IsOptional()
  @IsBoolean()
  cardShowEmergencyCall?: boolean;

  /** Afficher l'adresse de l'établissement (footer recto). */
  @IsOptional()
  @IsBoolean()
  cardShowSchoolAddress?: boolean;

  /** Texte affiché en pied de carte (verso). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cardFooterText?: string;

  /** Conditions d'utilisation affichées au verso. */
  @IsOptional()
  @IsString()
  @MaxLength(600)
  cardConditionsText?: string;

  /** Référence optionnelle à un template (CardDesignTemplate.key). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  templateKey?: string;

  // ⭐ Options design configurables (Phase 5 — Task 22-b)

  /** Famille de police. Valeurs: Helvetica, Arial, Times New Roman, Georgia, Verdana, Trebuchet MS, Courier New. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cardFontFamily?: string;

  /** Échelle de taille des textes. Valeurs: small, medium, large. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cardFontSizeScale?: string;

  /** Style du nom élève. Valeurs: normal, uppercase, bold. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cardStudentNameStyle?: string;

  /** Position de la photo dans le body recto. Valeurs: left, right. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cardPhotoPosition?: string;

  /** Taille de la photo. Valeurs: small, medium, large. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cardPhotoSize?: string;

  /** Forme de la photo. Valeurs: rectangle, rounded, circle. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cardPhotoShape?: string;

  /** Style du bandeau en-tête. Valeurs: solid, gradient, striped. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cardHeaderStyle?: string;

  /** Position du logo dans le header. Valeurs: left, center, right. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cardLogoPosition?: string;

  /** Taille du logo. Valeurs: small, medium, large. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cardLogoSize?: string;

  /** Afficher le matricule de l'élève. */
  @IsOptional()
  @IsBoolean()
  cardShowMatricule?: boolean;

  /** Afficher la date et lieu de naissance. */
  @IsOptional()
  @IsBoolean()
  cardShowBirthInfo?: boolean;

  /** Afficher le sexe de l'élève. */
  @IsOptional()
  @IsBoolean()
  cardShowGender?: boolean;

  /** Afficher le niveau scolaire. */
  @IsOptional()
  @IsBoolean()
  cardShowLevel?: boolean;

  /** Position du QR code au verso. Valeurs: bottom-right, bottom-left, top-right, top-left. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cardQrPosition?: string;

  /** Taille du QR code. Valeurs: small, medium, large. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cardQrSize?: string;

  /** Logo école intégré au centre du QR code. */
  @IsOptional()
  @IsBoolean()
  cardQrWithLogo?: boolean;
}
