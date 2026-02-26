/**
 * Bootstrap RBAC : crée automatiquement les permissions et rôles système en BDD
 * au démarrage de l'API si absents (production-ready, idempotent).
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const RESOURCES = [
  'ELEVES', 'INSCRIPTIONS', 'DOCUMENTS_SCOLAIRES', 'ORGANISATION_PEDAGOGIQUE', 'MATERIEL_PEDAGOGIQUE',
  'EXAMENS', 'BULLETINS', 'FINANCES', 'RECOUVREMENT', 'DEPENSES', 'RH', 'PAIE', 'COMMUNICATION',
  'PARAMETRES', 'ANNEES_SCOLAIRES', 'ORION', 'ATLAS', 'QHSE', 'BIBLIOTHEQUE', 'TRANSPORT', 'CANTINE',
  'INFIRMERIE', 'EDUCAST', 'BOUTIQUE',
];
const ACTIONS = ['read', 'write', 'delete', 'validate'];
const EXPECTED_PERMISSIONS_COUNT = RESOURCES.length * ACTIONS.length;

type RoleDef = {
  name: string;
  description: string;
  canAccessOrion: boolean;
  canAccessAtlas: boolean;
  permissionNames: string[];
};

const SYSTEM_ROLES: RoleDef[] = [
  { name: 'PLATFORM_OWNER', description: 'Propriétaire plateforme (vision globale)', canAccessOrion: true, canAccessAtlas: true, permissionNames: [] },
  { name: 'PLATFORM_ADMIN', description: 'Administrateur plateforme', canAccessOrion: true, canAccessAtlas: true, permissionNames: [] },
  { name: 'PROMOTEUR', description: 'Promoteur / Gestionnaire d\'établissement', canAccessOrion: true, canAccessAtlas: true, permissionNames: [] },
  {
    name: 'DIRECTEUR',
    description: 'Direction (vision globale établissement)',
    canAccessOrion: true,
    canAccessAtlas: true,
    permissionNames: [
      'ELEVES_read', 'ELEVES_write', 'ELEVES_validate', 'INSCRIPTIONS_read', 'INSCRIPTIONS_write', 'DOCUMENTS_SCOLAIRES_read', 'DOCUMENTS_SCOLAIRES_write', 'DOCUMENTS_SCOLAIRES_validate',
      'ORGANISATION_PEDAGOGIQUE_read', 'ORGANISATION_PEDAGOGIQUE_write', 'MATERIEL_PEDAGOGIQUE_read',
      'EXAMENS_read', 'EXAMENS_validate', 'BULLETINS_read', 'BULLETINS_validate',
      'FINANCES_read', 'RECOUVREMENT_read', 'DEPENSES_read', 'RH_read', 'PAIE_read',
      'COMMUNICATION_read', 'COMMUNICATION_write', 'PARAMETRES_read', 'PARAMETRES_write', 'ANNEES_SCOLAIRES_read', 'ANNEES_SCOLAIRES_write',
      'ORION_read', 'ATLAS_read', 'QHSE_read', 'BIBLIOTHEQUE_read', 'TRANSPORT_read', 'CANTINE_read', 'INFIRMERIE_read', 'EDUCAST_read', 'BOUTIQUE_read',
    ],
  },
  {
    name: 'SECRETAIRE',
    description: 'Secrétariat (élèves, inscriptions, documents)',
    canAccessOrion: false,
    canAccessAtlas: false,
    permissionNames: [
      'ELEVES_read', 'ELEVES_write', 'INSCRIPTIONS_read', 'INSCRIPTIONS_write', 'DOCUMENTS_SCOLAIRES_read', 'DOCUMENTS_SCOLAIRES_write',
      'EXAMENS_read', 'BULLETINS_read', 'FINANCES_read', 'RECOUVREMENT_read', 'RECOUVREMENT_write',
      'PARAMETRES_read', 'ANNEES_SCOLAIRES_read', 'BIBLIOTHEQUE_read', 'TRANSPORT_read', 'CANTINE_read', 'INFIRMERIE_read',
    ],
  },
  {
    name: 'COMPTABLE',
    description: 'Finances et économat (lecture/écriture)',
    canAccessOrion: false,
    canAccessAtlas: false,
    permissionNames: [
      'FINANCES_read', 'FINANCES_write', 'RECOUVREMENT_read', 'RECOUVREMENT_write', 'DEPENSES_read', 'DEPENSES_write',
      'EXAMENS_read', 'BULLETINS_read', 'ELEVES_read', 'RH_read', 'PARAMETRES_read', 'ANNEES_SCOLAIRES_read',
    ],
  },
  {
    name: 'SECRETAIRE_COMPTABLE',
    description: 'Secrétariat + Comptabilité',
    canAccessOrion: false,
    canAccessAtlas: false,
    permissionNames: [
      'ELEVES_read', 'ELEVES_write', 'INSCRIPTIONS_read', 'INSCRIPTIONS_write', 'DOCUMENTS_SCOLAIRES_read', 'DOCUMENTS_SCOLAIRES_write',
      'EXAMENS_read', 'BULLETINS_read', 'FINANCES_read', 'FINANCES_write', 'RECOUVREMENT_read', 'RECOUVREMENT_write', 'DEPENSES_read', 'DEPENSES_write',
      'PARAMETRES_read', 'ANNEES_SCOLAIRES_read', 'BIBLIOTHEQUE_read', 'TRANSPORT_read', 'CANTINE_read', 'INFIRMERIE_read',
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
      'ELEVES_read', 'INSCRIPTIONS_read', 'DOCUMENTS_SCOLAIRES_read', 'EXAMENS_read', 'BULLETINS_read',
      'PARAMETRES_read', 'BIBLIOTHEQUE_read', 'TRANSPORT_read', 'CANTINE_read', 'INFIRMERIE_read',
    ],
  },
  {
    name: 'ENSEIGNANT',
    description: 'Enseignant (ses classes — scope côté app)',
    canAccessOrion: false,
    canAccessAtlas: false,
    permissionNames: [
      'ELEVES_read', 'INSCRIPTIONS_read', 'DOCUMENTS_SCOLAIRES_read', 'ORGANISATION_PEDAGOGIQUE_read', 'MATERIEL_PEDAGOGIQUE_read',
      'EXAMENS_read', 'EXAMENS_write', 'BULLETINS_read', 'COMMUNICATION_read', 'PARAMETRES_read', 'ANNEES_SCOLAIRES_read',
      'BIBLIOTHEQUE_read', 'TRANSPORT_read', 'CANTINE_read', 'INFIRMERIE_read',
    ],
  },
  { name: 'PARENT', description: 'Parent (enfants uniquement)', canAccessOrion: false, canAccessAtlas: false, permissionNames: ['ELEVES_read', 'BULLETINS_read', 'COMMUNICATION_read'] },
  { name: 'ELEVE', description: 'Élève (accès personnel)', canAccessOrion: false, canAccessAtlas: false, permissionNames: ['ELEVES_read', 'BULLETINS_read', 'COMMUNICATION_read'] },
];

@Injectable()
export class RolesPermissionsBootstrapService {
  private readonly logger = new Logger(RolesPermissionsBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée en BDD les permissions exhaustives et les rôles système si absents.
   * Appelé au démarrage de l'API (main.ts après listen) pour la production.
   */
  async ensurePermissionsAndRoles(): Promise<void> {
    const permCount = await this.prisma.permission.count();
    const needPermissions = permCount < EXPECTED_PERMISSIONS_COUNT;
    if (needPermissions) {
      this.logger.log(`Création des permissions RBAC (exhaustif)... (actuellement: ${permCount})`);
      for (const resource of RESOURCES) {
        for (const action of ACTIONS) {
          const name = `${resource}_${action}`;
          await this.prisma.permission.upsert({
            where: { name },
            update: { resource, action, description: `${resource} - ${action}` },
            create: { name, resource, action, description: `${resource} - ${action}` },
          });
        }
      }
      this.logger.log(`Permissions RBAC: ${EXPECTED_PERMISSIONS_COUNT} créées/mises à jour`);
    }

    const allPermissions = await this.prisma.permission.findMany({ select: { id: true, name: true } });
    const permissionIdByName = new Map(allPermissions.map((p) => [p.name, p.id]));

    for (const sr of SYSTEM_ROLES) {
      let role = await this.prisma.role.findFirst({
        where: { tenantId: null, name: sr.name, isSystemRole: true },
      });
      if (!role) {
        role = await this.prisma.role.create({
          data: {
            tenantId: null,
            name: sr.name,
            description: sr.description,
            isSystemRole: true,
            canAccessOrion: sr.canAccessOrion,
            canAccessAtlas: sr.canAccessAtlas,
            allowedLevelIds: [],
          },
        });
        this.logger.log(`Rôle système créé: ${sr.name}`);
      }

      const permissionNames = sr.permissionNames.length > 0 ? sr.permissionNames : allPermissions.map((p) => p.name);
      const permissionIds = permissionNames
        .map((name) => permissionIdByName.get(name))
        .filter((id): id is string => id != null);

      await this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      if (permissionIds.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: role!.id, permissionId })),
          skipDuplicates: true,
        });
      }
    }
    this.logger.log('Bootstrap RBAC: rôles et permissions prêts');
  }
}
