import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export enum SchoolLevelType {
  MATERNELLE = 'MATERNELLE',
  PRIMAIRE = 'PRIMAIRE',
  SECONDAIRE = 'SECONDAIRE',
}

@Injectable()
export class SchoolLevelsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: any): Promise<any> {
    return this.prisma.schoolLevel.create({ data });
  }

  async findAll(tenantId: string): Promise<any[]> {
    return this.prisma.schoolLevel.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.schoolLevel.findFirst({
      where: { id, tenantId },
    });
  }

  async findByType(
    tenantId: string,
    type: SchoolLevelType,
  ): Promise<any | null> {
    return this.prisma.schoolLevel.findFirst({
      where: { tenantId, type },
    });
  }

  async update(
    id: string,
    tenantId: string,
    data: any,
  ): Promise<any> {
    await this.prisma.schoolLevel.update({
      where: { id },
      data,
    });
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.schoolLevel.delete({
      where: { id },
    });
  }

  /**
   * Initialiser les niveaux scolaires par défaut pour un tenant
   */
  async initializeDefaultLevels(tenantId: string): Promise<any[]> {
    const defaultLevels = [
      {
        tenantId,
        type: SchoolLevelType.MATERNELLE,
        name: 'Maternelle',
        abbreviation: 'MAT',
        order: 0,
        description: 'Niveau maternelle (3-6 ans)',
      },
      {
        tenantId,
        type: SchoolLevelType.PRIMAIRE,
        name: 'Primaire',
        abbreviation: 'PRI',
        order: 1,
        description: 'Niveau primaire (6-12 ans)',
      },
      {
        tenantId,
        type: SchoolLevelType.SECONDAIRE,
        name: 'Secondaire',
        abbreviation: 'SEC',
        order: 2,
        description: 'Niveau secondaire (12-18 ans)',
      },
    ];

    const created = [];
    for (const levelData of defaultLevels) {
      const existing = await this.findByType(tenantId, levelData.type);
      if (!existing) {
        const level = await this.create(levelData);
        created.push(level);
      } else {
        created.push(existing);
      }
    }

    return created;
  }
}
