/**
 * ============================================================================
 * CARD DESIGN — Types partagés (CMS Carte Scolaire)
 * ============================================================================
 *
 * Définit les types utilisés par les composants CardDesignTab,
 * CardDesignControls et CardDesignPreview. Ces types reflètent le modèle
 * `TenantIdentityProfile` côté backend (champs `cardPrimaryColor`,
 * `cardShowQRCode`, `cardConditionsText`, etc.) ainsi que le modèle
 * `CardDesignTemplate` (introduit en Phase 2, Task 19-a).
 *
 * ⚠️ Ces champs sont lus par le service `student-id-card.service.ts`
 *    (`generateCardHtml`) pour produire le HTML rendu des cartes scolaires.
 * ============================================================================
 */

/** Tokens de design communs (issus du layout d'un template OU de l'identityProfile). */
export interface CardDesignSettings {
  // Couleurs
  cardPrimaryColor: string;
  cardSecondaryColor: string;
  // Éléments affichés (recto/verso)
  cardShowPhoto: boolean;
  cardShowQRCode: boolean;
  cardShowBarcode: boolean;
  cardShowGuardian: boolean;
  cardShowEmergencyCall: boolean;
  cardShowSchoolAddress: boolean;
  // Textes personnalisables
  cardFooterText: string;
  cardConditionsText: string;
  // Heures de sortie maternelle
  maternelleSingleExit: boolean;
  maternellePickupMorning: string;
  maternellePickupAfternoon: string;
  maternelleSingleExitTime: string;
  // Référence au template appliqué (clé ou id)
  templateKey?: string;
}

/** Template de design (système ou personnalisé). */
export interface CardDesignTemplate {
  id: string;
  name: string;
  key: string;
  layout: CardDesignSettings & {
    orientation?: 'landscape' | 'portrait';
    photoPosition?: 'left' | 'right' | 'top';
    signatureLabel?: string;
    bilingual?: boolean;
  };
  isSystem: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Couleurs par défaut (cohérentes avec CLASSIQUE côté backend). */
export const DEFAULT_CARD_COLORS = {
  primary: '#0D1F6E',
  secondary: '#1A237E',
} as const;

/** Valeurs par défaut des settings (pour réinitialisation). */
export const DEFAULT_CARD_SETTINGS: CardDesignSettings = {
  cardPrimaryColor: DEFAULT_CARD_COLORS.primary,
  cardSecondaryColor: DEFAULT_CARD_COLORS.secondary,
  cardShowPhoto: true,
  cardShowQRCode: true,
  cardShowBarcode: true,
  cardShowGuardian: true,
  cardShowEmergencyCall: true,
  cardShowSchoolAddress: true,
  cardFooterText: 'Academia Helm · Document officiel',
  cardConditionsText:
    "Cette carte est strictement personnelle et incessible. À présenter à toute demande du personnel autorisé. Signaler toute perte ou vol à l'administration.",
  maternelleSingleExit: false,
  maternellePickupMorning: '12:00',
  maternellePickupAfternoon: '16:30',
  maternelleSingleExitTime: '15:30',
  templateKey: 'CLASSIQUE',
};

/** Présentation visuelle des 4 presets système (mini-aperçous couleur). */
export const SYSTEM_PRESETS_META: Array<{
  key: string;
  name: string;
  description: string;
  primary: string;
  secondary: string;
}> = [
  {
    key: 'CLASSIQUE',
    name: 'Classique',
    description: 'Bleu marine institutionnel',
    primary: '#0D1F6E',
    secondary: '#1A237E',
  },
  {
    key: 'MODERNE',
    name: 'Moderne',
    description: 'Vert émeraude contemporain',
    primary: '#0F766E',
    secondary: '#14B8A6',
  },
  {
    key: 'MINIMALISTE',
    name: 'Minimaliste',
    description: 'Gris anthracite épuré',
    primary: '#1F2937',
    secondary: '#374151',
  },
  {
    key: 'BILINGUE',
    name: 'Bilingue',
    description: 'Bordeaux francophone',
    primary: '#7C2D12',
    secondary: '#B91C1C',
  },
];
