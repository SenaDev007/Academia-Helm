/**
 * Données exhaustives pour le bootstrap RBAC (permissions + rôles système).
 * Utilisé au démarrage de l'API et par le seed. Production-ready.
 */

export const RBAC_RESOURCES = [
  'ELEVES',
  'INSCRIPTIONS',
  'DOCUMENTS_SCOLAIRES',
  'ORGANISATION_PEDAGOGIQUE',
  'MATERIEL_PEDAGOGIQUE',
  'EXAMENS',
  'BULLETINS',
  'FINANCES',
  'RECOUVREMENT',
  'DEPENSES',
  'RH',
  'PAIE',
  'COMMUNICATION',
  'PARAMETRES',
  'ANNEES_SCOLAIRES',
  'ORION',
  'ATLAS',
  'QHSE',
  'BIBLIOTHEQUE',
  'TRANSPORT',
  'CANTINE',
  'INFIRMERIE',
  'EDUCAST',
  'BOUTIQUE',
] as const;

export const RBAC_ACTIONS = ['read', 'write', 'delete', 'validate'] as const;

export type SystemRoleDef = {
  name: string;
  description: string;
  canAccessOrion: boolean;
  canAccessAtlas: boolean;
  permissionNames: string[];
};

/** Rôles système avec permissions par défaut (exhaustif). */
export function getSystemRolesDefinitions(allPermissionNames: string[]): SystemRoleDef[] {
  return [
    {
      name: 'PLATFORM_OWNER',
      description: 'Propriétaire plateforme (vision globale, toutes les écoles)',
      canAccessOrion: true,
      canAccessAtlas: true,
      permissionNames: [...allPermissionNames],
    },
    {
      name: 'PLATFORM_ADMIN',
      description: 'Administrateur plateforme',
      canAccessOrion: true,
      canAccessAtlas: true,
      permissionNames: [...allPermissionNames],
    },
    {
      name: 'PROMOTEUR',
      description: "Promoteur / Gestionnaire d'établissement (vision globale tenant)",
      canAccessOrion: true,
      canAccessAtlas: true,
      permissionNames: [...allPermissionNames],
    },
    {
      name: 'DIRECTEUR',
      description: 'Direction (vision globale établissement)',
      canAccessOrion: true,
      canAccessAtlas: true,
      permissionNames: [
        'ELEVES_read', 'ELEVES_write', 'ELEVES_validate', 'INSCRIPTIONS_read', 'INSCRIPTIONS_write',
        'DOCUMENTS_SCOLAIRES_read', 'DOCUMENTS_SCOLAIRES_write', 'DOCUMENTS_SCOLAIRES_validate',
        'ORGANISATION_PEDAGOGIQUE_read', 'ORGANISATION_PEDAGOGIQUE_write', 'MATERIEL_PEDAGOGIQUE_read',
        'EXAMENS_read', 'EXAMENS_validate', 'BULLETINS_read', 'BULLETINS_validate',
        'FINANCES_read', 'RECOUVREMENT_read', 'DEPENSES_read',
        'RH_read', 'PAIE_read',
        'COMMUNICATION_read', 'COMMUNICATION_write',
        'PARAMETRES_read', 'PARAMETRES_write', 'ANNEES_SCOLAIRES_read', 'ANNEES_SCOLAIRES_write',
        'ORION_read', 'ATLAS_read',
        'QHSE_read', 'BIBLIOTHEQUE_read', 'TRANSPORT_read', 'CANTINE_read', 'INFIRMERIE_read', 'EDUCAST_read', 'BOUTIQUE_read',
      ],
    },
    {
      name: 'SECRETAIRE',
      description: 'Secrétariat (élèves, inscriptions, documents)',
      canAccessOrion: false,
      canAccessAtlas: false,
      permissionNames: [
        'ELEVES_read', 'ELEVES_write', 'INSCRIPTIONS_read', 'INSCRIPTIONS_write',
        'DOCUMENTS_SCOLAIRES_read', 'DOCUMENTS_SCOLAIRES_write',
        'EXAMENS_read', 'BULLETINS_read',
        'FINANCES_read', 'RECOUVREMENT_read', 'RECOUVREMENT_write',
        'PARAMETRES_read', 'ANNEES_SCOLAIRES_read',
        'BIBLIOTHEQUE_read', 'TRANSPORT_read', 'CANTINE_read', 'INFIRMERIE_read',
      ],
    },
    {
      name: 'COMPTABLE',
      description: 'Finances et économat (lecture/écriture, pas les notes)',
      canAccessOrion: false,
      canAccessAtlas: false,
      permissionNames: [
        'FINANCES_read', 'FINANCES_write', 'RECOUVREMENT_read', 'RECOUVREMENT_write', 'DEPENSES_read', 'DEPENSES_write',
        'EXAMENS_read', 'BULLETINS_read',
        'ELEVES_read', 'RH_read', 'PARAMETRES_read', 'ANNEES_SCOLAIRES_read',
      ],
    },
    {
      name: 'SECRETAIRE_COMPTABLE',
      description: 'Secrétariat + Comptabilité',
      canAccessOrion: false,
      canAccessAtlas: false,
      permissionNames: [
        'ELEVES_read', 'ELEVES_write', 'INSCRIPTIONS_read', 'INSCRIPTIONS_write', 'DOCUMENTS_SCOLAIRES_read', 'DOCUMENTS_SCOLAIRES_write',
        'EXAMENS_read', 'BULLETINS_read',
        'FINANCES_read', 'FINANCES_write', 'RECOUVREMENT_read', 'RECOUVREMENT_write', 'DEPENSES_read', 'DEPENSES_write',
        'PARAMETRES_read', 'ANNEES_SCOLAIRES_read',
        'BIBLIOTHEQUE_read', 'TRANSPORT_read', 'CANTINE_read', 'INFIRMERIE_read',
      ],
    },
    {
      name: 'CENSEUR',
      description: 'Censeur (discipline, pédagogie, examens)',
      canAccessOrion: true,
      canAccessAtlas: false,
      permissionNames: [
        'ELEVES_read', 'ELEVES_write', 'INSCRIPTIONS_read', 'DOCUMENTS_SCOLAIRES_read',
        'ORGANISATION_PEDAGOGIQUE_read', 'MATERIEL_PEDAGOGIQUE_read',
        'EXAMENS_read', 'EXAMENS_write', 'EXAMENS_validate', 'BULLETINS_read', 'BULLETINS_validate',
        'RH_read', 'COMMUNICATION_read', 'PARAMETRES_read', 'ANNEES_SCOLAIRES_read', 'ORION_read',
        'QHSE_read', 'BIBLIOTHEQUE_read', 'TRANSPORT_read', 'CANTINE_read', 'INFIRMERIE_read',
      ],
    },
    {
      name: 'SURVEILLANT',
      description: 'Surveillance (assiduité, discipline)',
      canAccessOrion: false,
      canAccessAtlas: false,
      permissionNames: [
        'ELEVES_read', 'INSCRIPTIONS_read', 'DOCUMENTS_SCOLAIRES_read',
        'EXAMENS_read', 'BULLETINS_read',
        'PARAMETRES_read', 'BIBLIOTHEQUE_read', 'TRANSPORT_read', 'CANTINE_read', 'INFIRMERIE_read',
      ],
    },
    {
      name: 'ENSEIGNANT',
      description: 'Enseignant (ses classes uniquement — scope par niveau/classe côté app)',
      canAccessOrion: false,
      canAccessAtlas: false,
      permissionNames: [
        'ELEVES_read', 'INSCRIPTIONS_read', 'DOCUMENTS_SCOLAIRES_read',
        'ORGANISATION_PEDAGOGIQUE_read', 'MATERIEL_PEDAGOGIQUE_read',
        'EXAMENS_read', 'EXAMENS_write', 'BULLETINS_read',
        'COMMUNICATION_read', 'PARAMETRES_read', 'ANNEES_SCOLAIRES_read',
        'BIBLIOTHEQUE_read', 'TRANSPORT_read', 'CANTINE_read', 'INFIRMERIE_read',
      ],
    },
    {
      name: 'PARENT',
      description: 'Parent (accès aux enfants uniquement — scope côté app)',
      canAccessOrion: false,
      canAccessAtlas: false,
      permissionNames: ['ELEVES_read', 'BULLETINS_read', 'COMMUNICATION_read'],
    },
    {
      name: 'ELEVE',
      description: 'Élève (accès personnel — scope côté app)',
      canAccessOrion: false,
      canAccessAtlas: false,
      permissionNames: ['ELEVES_read', 'BULLETINS_read', 'COMMUNICATION_read'],
    },
  ];
}
