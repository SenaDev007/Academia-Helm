import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export enum AcademicTrackCode {
  FR = 'FR',
}

@Injectable()
export class AcademicTracksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: any): Promise<any> {
    return this.prisma.academicTrack.create({ data });
  }

  async findAll(tenantId: string): Promise<any[]> {
    return this.prisma.academicTrack.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.academicTrack.findFirst({
      where: { id, tenantId },
    });
  }

  async findByCode(code: AcademicTrackCode, tenantId: string): Promise<any | null> {
    return this.prisma.academicTrack.findFirst({
      where: { code, tenantId },
    });
  }

  async findDefault(tenantId: string): Promise<any | null> {
    return this.prisma.academicTrack.findFirst({
      where: { tenantId, isDefault: true },
    });
  }

  async update(id: string, tenantId: string, data: any): Promise<any> {
    await this.prisma.academicTrack.update({
      where: { id },
      data,
    });
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.academicTrack.delete({ where: { id } });
  }

  /**
   * Initialise le track FR par défaut pour un tenant
   * Appelé lors de la création d'un tenant ou de l'activation du module bilingue
   */
  async initializeDefaultTrack(tenantId: string): Promise<any> {
    const existing = await this.findByCode(AcademicTrackCode.FR, tenantId);
    if (existing) {
      return existing;
    }

    return this.create({
      code: AcademicTrackCode.FR,
      name: 'Francophone',
      description: 'Piste académique francophone (par défaut)',
      order: 0,
      isActive: true,
      isDefault: true,
      tenantId,
    });
  }
}
