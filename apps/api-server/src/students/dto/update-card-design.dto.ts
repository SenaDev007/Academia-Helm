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
}
