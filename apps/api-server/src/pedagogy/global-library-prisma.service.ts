/**
 * ============================================================================
 * GLOBAL LIBRARY PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour la gestion de la bibliothèque pédagogique globale.
 * Permet la centralisation des ressources institutionnelles.
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class GlobalLibraryPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère toutes les ressources avec filtres
   */
  async findAllResources(filters?: {
    level?: string;
    classLevel?: string;
    series?: string;
    subject?: string;
    language?: string;
    resourceType?: string;
    search?: string;
    isPublished?: boolean;
  }) {
    const where: any = {};

    if (filters?.level) where.level = filters.level;
    if (filters?.classLevel) where.classLevel = filters.classLevel;
    if (filters?.series) where.series = filters.series;
    if (filters?.subject) where.subject = filters.subject;
    if (filters?.language) where.language = filters.language;
    if (filters?.resourceType) where.resourceType = filters.resourceType;
    if (filters?.isPublished !== undefined) where.isPublished = filters.isPublished;

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.globalPedagogicalResource.findMany({
      where,
      include: {
        _count: {
          select: { usages: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Récupère une ressource par ID
   */
  async findResourceById(id: string) {
    const resource = await this.prisma.globalPedagogicalResource.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' }
        },
        _count: {
          select: { usages: true }
        }
      },
    });

    if (!resource) {
      throw new NotFoundException(`Resource with ID ${id} not found`);
    }

    return resource;
  }

  /**
   * Crée une ressource (PLATFORM_ADMIN / OWNER)
   */
  async createResource(data: {
    title: string;
    description?: string;
    level?: string;
    classLevel?: string;
    series?: string;
    subject?: string;
    language?: string;
    resourceType: string;
    fileUrl?: string;
    externalUrl?: string;
    createdBy: string;
    isPublished?: boolean;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const resource = await tx.globalPedagogicalResource.create({
        data: {
          ...data,
          version: 1,
        },
      });

      if (data.fileUrl) {
        await tx.globalResourceVersion.create({
          data: {
            resourceId: resource.id,
            version: 1,
            fileUrl: data.fileUrl,
          },
        });
      }

      return resource;
    });
  }

  /**
   * Met à jour une ressource
   */
  async updateResource(id: string, data: {
    title?: string;
    description?: string;
    level?: string;
    classLevel?: string;
    series?: string;
    subject?: string;
    language?: string;
    resourceType?: string;
    fileUrl?: string;
    externalUrl?: string;
    isPublished?: boolean;
  }) {
    const resource = await this.findResourceById(id);

    if (resource.isPublished && data.fileUrl && data.fileUrl !== resource.fileUrl) {
      // Si la ressource est publiée et qu'on change le fichier, on crée une nouvelle version
      return this.prisma.$transaction(async (tx) => {
        const nextVersion = resource.version + 1;
        
        await tx.globalResourceVersion.create({
          data: {
            resourceId: id,
            version: nextVersion,
            fileUrl: data.fileUrl!,
          },
        });

        return tx.globalPedagogicalResource.update({
          where: { id },
          data: {
            ...data,
            version: nextVersion,
          },
        });
      });
    }

    return this.prisma.globalPedagogicalResource.update({
      where: { id },
      data,
    });
  }

  /**
   * Supprime une ressource
   */
  async deleteResource(id: string) {
    const resource = await this.findResourceById(id);

    // Vérifier si elle est utilisée (optionnel selon règles métier, mais ici on suit le prompt)
    const usageCount = await this.prisma.tenantResourceUsage.count({
      where: { resourceId: id }
    });

    if (usageCount > 0 && resource.isPublished) {
      throw new BadRequestException("Cannot delete a published resource that has been used.");
    }

    return this.prisma.globalPedagogicalResource.delete({
      where: { id }
    });
  }

  /**
   * Enregistre l'utilisation d'une ressource par un enseignant
   */
  async logUsage(data: {
    tenantId: string;
    resourceId: string;
    staffId: string;
  }) {
    return this.prisma.tenantResourceUsage.create({
      data: {
        tenantId: data.tenantId,
        resourceId: data.resourceId,
        staffId: data.staffId,
      }
    });
  }

  /**
   * Ajoute ou modifie une annotation personnelle
   */
  async upsertAnnotation(data: {
    tenantId: string;
    resourceId: string;
    staffId: string;
    note: string;
  }) {
    const existing = await this.prisma.tenantResourceAnnotation.findFirst({
      where: {
        tenantId: data.tenantId,
        resourceId: data.resourceId,
        staffId: data.staffId,
      }
    });

    if (existing) {
      return this.prisma.tenantResourceAnnotation.update({
        where: { id: existing.id },
        data: { note: data.note }
      });
    }

    return this.prisma.tenantResourceAnnotation.create({
      data: {
        tenantId: data.tenantId,
        resourceId: data.resourceId,
        staffId: data.staffId,
        note: data.note,
      }
    });
  }

  /**
   * Récupère l'annotation d'un enseignant pour une ressource
   */
  async getTeacherAnnotation(tenantId: string, staffId: string, resourceId: string) {
    return this.prisma.tenantResourceAnnotation.findFirst({
      where: {
        tenantId,
        staffId,
        resourceId,
      }
    });
  }

  /**
   * Statistiques ORION : Ressources les plus consultées
   */
  async getMostUsedResources(limit = 5) {
    return this.prisma.globalPedagogicalResource.findMany({
      include: {
        _count: {
          select: { usages: true }
        }
      },
      orderBy: {
        usages: {
          _count: 'desc'
        }
      },
      take: limit,
    });
  }
}
