import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';

/**
 * Service pour la gestion des rôles et permissions
 */
@Injectable()
export class RolesPermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
  ) {}

  /**
   * Récupère tous les rôles d'un tenant
   */
  async getRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: {
        OR: [
          { tenantId },
          { tenantId: null, isSystemRole: true },
        ],
      },
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
   * Récupère un rôle par ID
   */
  async getRoleById(tenantId: string, id: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        OR: [
          { tenantId },
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
   * Vérifie si un utilisateur a une permission spécifique
   */
  async userHasPermission(
    userId: string,
    resource: string,
    action: string,
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
      for (const rolePermission of userRole.role.rolePermissions) {
        const perm = rolePermission.permission;
        if (perm.resource === resource && perm.action === action) {
          return true;
        }
        // Wildcard permissions
        if (perm.resource === '*' || perm.action === '*') {
          return true;
        }
      }
    }

    return false;
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
