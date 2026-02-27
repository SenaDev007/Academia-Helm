import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';
import { RolesPermissionsBootstrapService } from './roles-permissions-bootstrap.service';

/**
 * Service pour la gestion des rôles et permissions.
 * Initialisation lazy (même pattern que Structure) : colonnes + rôles système assurés à la première lecture.
 */
@Injectable()
export class RolesPermissionsService {
  private readonly logger = new Logger(RolesPermissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
    private readonly rolesBootstrap: RolesPermissionsBootstrapService,
  ) {}

  /**
   * Assure que la table roles et les données par défaut sont prêtes (pattern Structure).
   * Appelé avant toute lecture pour éviter "column does not exist" si db push / bootstrap ont échoué.
   * En cas d'échec, propage l'erreur (message explicite côté bootstrap).
   */
  private async ensureRolesReady(): Promise<void> {
    await this.rolesBootstrap.ensureRolesTableColumns();
  }

  /**
   * Récupère tous les rôles : si tenantId fourni = rôles du tenant + rôles système ; si null = rôles système uniquement.
   * Initialise la table et les rôles système à la première lecture si besoin (comme getStructure pour la structure).
   */
  async getRoles(tenantId: string | null) {
    await this.ensureRolesReady();
    const where =
      tenantId == null
        ? { tenantId: null, isSystemRole: true }
        : {
            OR: [{ tenantId }, { tenantId: null, isSystemRole: true }],
          };
    return this.prisma.role.findMany({
      where,
      include: {
        _count: {
          select: { userRoles: true },
        },
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: [
        { isSystemRole: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Récupère un rôle par ID (tenantId null = uniquement rôles système).
   */
  async getRoleById(tenantId: string | null, id: string) {
    await this.ensureRolesReady();
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        OR: [
          ...(tenantId != null ? [{ tenantId }] : []),
          { tenantId: null, isSystemRole: true },
        ],
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { userRoles: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Rôle non trouvé.');
    }

    return role;
  }

  /**
   * Crée un nouveau rôle personnalisé
   */
  async createRole(
    tenantId: string,
    data: {
      name: string;
      description?: string;
      canAccessOrion?: boolean;
      canAccessAtlas?: boolean;
      allowedLevelIds?: string[];
      permissionIds?: string[];
    },
    userId: string,
  ) {
    // Vérifier qu'un rôle avec ce nom n'existe pas déjà
    const existing = await this.prisma.role.findFirst({
      where: { tenantId, name: data.name },
    });

    if (existing) {
      throw new BadRequestException(`Un rôle avec le nom "${data.name}" existe déjà.`);
    }

    const { permissionIds, ...roleData } = data;

    const role = await this.prisma.role.create({
      data: {
        tenantId,
        ...roleData,
        isSystemRole: false,
      },
    });

    // Ajouter les permissions
    if (permissionIds && permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
    }

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'roles',
      'security',
      { roleCreated: { old: null, new: role.name } },
      userId,
    );

    return this.getRoleById(tenantId, role.id);
  }

  /**
   * Met à jour un rôle
   */
  async updateRole(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      description?: string;
      canAccessOrion?: boolean;
      canAccessAtlas?: boolean;
      allowedLevelIds?: string[];
    },
    userId: string,
  ) {
    const existing = await this.getRoleById(tenantId, id);

    if (existing.isSystemRole) {
      throw new BadRequestException('Les rôles système ne peuvent pas être modifiés.');
    }

    const changes: Record<string, { old: any; new: any }> = {};
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && JSON.stringify(existing[key]) !== JSON.stringify(data[key])) {
        changes[key] = { old: existing[key], new: data[key] };
      }
    });

    if (Object.keys(changes).length === 0) {
      return existing;
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'roles',
      'security',
      changes,
      userId,
    );

    return this.getRoleById(tenantId, id);
  }

  /**
   * Supprime un rôle
   */
  async deleteRole(tenantId: string, id: string, userId: string) {
    const role = await this.getRoleById(tenantId, id);

    if (role.isSystemRole) {
      throw new BadRequestException('Les rôles système ne peuvent pas être supprimés.');
    }

    if (role._count.userRoles > 0) {
      throw new BadRequestException(
        `Ce rôle est attribué à ${role._count.userRoles} utilisateur(s). ` +
        'Réattribuez-les avant de supprimer.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.role.delete({ where: { id } }),
    ]);

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'roles',
      'security',
      { roleDeleted: { old: role.name, new: null } },
      userId,
    );

    return { success: true, message: `Rôle "${role.name}" supprimé.` };
  }

  /**
   * Récupère toutes les permissions disponibles
   */
  async getPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [
        { resource: 'asc' },
        { action: 'asc' },
      ],
    });
  }

  /**
   * Récupère les permissions groupées par ressource
   */
  async getPermissionsGrouped() {
    const permissions = await this.getPermissions();

    const grouped: Record<string, any[]> = {};
    permissions.forEach((perm) => {
      if (!grouped[perm.resource]) {
        grouped[perm.resource] = [];
      }
      grouped[perm.resource].push(perm);
    });

    return grouped;
  }

  /**
   * Met à jour les permissions d'un rôle
   */
  async updateRolePermissions(
    tenantId: string,
    roleId: string,
    permissionIds: string[],
    userId: string,
  ) {
    const role = await this.getRoleById(tenantId, roleId);

    if (role.isSystemRole) {
      throw new BadRequestException('Les permissions des rôles système ne peuvent pas être modifiées.');
    }

    const currentPermissions = role.rolePermissions.map((rp) => rp.permissionId);

    // Supprimer les anciennes permissions
    await this.prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    // Ajouter les nouvelles permissions
    if (permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
      });
    }

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'roles',
      'security',
      {
        permissionsUpdated: {
          old: currentPermissions,
          new: permissionIds,
          roleName: role.name,
        },
      },
      userId,
    );

    return this.getRoleById(tenantId, roleId);
  }

  /**
   * Vérifie si un utilisateur a une permission spécifique.
   * Si tenantId est fourni, ne considère que les rôles du tenant (userRole.tenantId ou role.tenantId) ou rôles globaux.
   */
  async userHasPermission(
    userId: string,
    resource: string,
    action: string,
    tenantId?: string | null,
  ): Promise<boolean> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    for (const userRole of userRoles) {
      const role = userRole.role;
      // Isolation tenant : si un tenant est demandé, l'assignment doit être pour ce tenant ou global (tenantId null)
      if (tenantId != null) {
        const assignmentTenant = userRole.tenantId ?? role.tenantId;
        if (assignmentTenant != null && assignmentTenant !== tenantId) continue;
      } else if (role.tenantId != null) {
        continue;
      }
      for (const rolePermission of role.rolePermissions) {
        const perm = rolePermission.permission;
        if (perm.resource === resource && perm.action === action) return true;
        if (perm.resource === '*' || perm.action === '*') return true;
      }
    }

    return false;
  }

  /**
   * Liste les utilisateurs du tenant avec leurs rôles (pour Paramètres → Utilisateurs & rôles).
   * Même pattern que l'onglet Structure : filtre par relation tenant.
   */
  async getUsersWithRoles(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        tenant: { id: tenantId },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        tenantId: true,
        userRoles: {
          where: {
            OR: [
              { tenantId },
              { tenantId: null, role: { tenantId } },
              { tenantId: null, role: { tenantId: null } },
            ],
          },
          include: {
            role: {
              select: {
                id: true,
                name: true,
                description: true,
                isSystemRole: true,
                canAccessOrion: true,
                canAccessAtlas: true,
              },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return users;
  }

  /**
   * Assigne un rôle à un utilisateur dans le contexte d'un tenant (audit + isolation)
   */
  async assignRoleToUser(
    tenantId: string,
    userId: string,
    roleId: string,
    assignedBy: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [{ tenantId }, { tenantId: null, isSystemRole: true }],
      },
    });
    if (!role) throw new NotFoundException('Rôle non trouvé.');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('Utilisateur non trouvé.');
    // Isolation tenant : on ne peut assigner un rôle qu'à un utilisateur du même tenant
    if (user.tenantId != null && user.tenantId !== tenantId) {
      throw new ForbiddenException('Impossible d\'assigner un rôle à un utilisateur d\'un autre tenant.');
    }

    const assignmentTenantId = role.tenantId ?? tenantId;
    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (existing) {
      const sameScope =
        existing.tenantId === assignmentTenantId ||
        (existing.tenantId === null && role.tenantId === null);
      if (sameScope)
        throw new BadRequestException('Ce rôle est déjà attribué à cet utilisateur.');
      await this.prisma.userRole.update({
        where: { userId_roleId: { userId, roleId } },
        data: { tenantId: assignmentTenantId },
      });
    } else {
      await this.prisma.userRole.create({
        data: {
          userId,
          roleId,
          tenantId: assignmentTenantId,
        },
      });
    }

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'roles',
      'security',
      { roleAssigned: { old: null, new: { userId, roleId, roleName: role.name } } },
      assignedBy,
    );

    return this.getUsersWithRoles(tenantId);
  }

  /**
   * Révoque un rôle d'un utilisateur (audit)
   */
  async revokeRoleFromUser(
    tenantId: string,
    userId: string,
    roleId: string,
    revokedBy: string,
  ) {
    const ur = await this.prisma.userRole.findFirst({
      where: { userId, roleId },
      include: { role: true },
    });
    if (!ur) throw new NotFoundException('Attribution rôle non trouvée.');

    const scopeTenant = ur.tenantId ?? ur.role.tenantId;
    if (scopeTenant && scopeTenant !== tenantId)
      throw new ForbiddenException('Ce rôle n\'est pas attribué dans ce tenant.');

    await this.prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'roles',
      'security',
      { roleRevoked: { old: { userId, roleId, roleName: ur.role.name }, new: null } },
      revokedBy,
    );

    return { success: true };
  }

  /**
   * Vérifie si un utilisateur a accès à un niveau scolaire
   */
  async userCanAccessLevel(userId: string, levelId: string): Promise<boolean> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });

    for (const userRole of userRoles) {
      const allowedLevels = userRole.role.allowedLevelIds;
      // Si vide, accès à tous les niveaux
      if (!allowedLevels || allowedLevels.length === 0) {
        return true;
      }
      if (allowedLevels.includes(levelId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Vérifie si un utilisateur a accès à ORION
   */
  async userCanAccessOrion(userId: string): Promise<boolean> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });

    return userRoles.some((ur) => ur.role.canAccessOrion);
  }

  /**
   * Vérifie si un utilisateur a accès à ATLAS
   */
  async userCanAccessAtlas(userId: string): Promise<boolean> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });

    return userRoles.some((ur) => ur.role.canAccessAtlas);
  }
}
