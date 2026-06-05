import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CountriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(countryData: any): Promise<any> {
    return this.prisma.country.create({ data: countryData });
  }

  async findOne(id: string): Promise<any | null> {
    return this.prisma.country.findFirst({ where: { id } });
  }

  async findByCode(code: string): Promise<any | null> {
    return this.prisma.country.findFirst({ where: { code } });
  }

  async findDefault(): Promise<any | null> {
    return this.prisma.country.findFirst({ where: { isDefault: true, isActive: true } });
  }

  async findAll(activeOnly: boolean = false): Promise<any[]> {
    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }
    return this.prisma.country.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async update(id: string, countryData: any): Promise<any> {
    await this.prisma.country.update({ where: { id }, data: countryData });
    return this.findOne(id);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.country.delete({ where: { id } });
  }

  /**
   * Définit un pays comme pays par défaut
   * Désactive le précédent pays par défaut si nécessaire
   */
  async setAsDefault(id: string): Promise<any> {
    // Désactiver tous les autres pays par défaut
    await this.prisma.country.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
    // Activer ce pays comme défaut
    await this.prisma.country.update({
      where: { id },
      data: { isDefault: true },
    });
    return this.findOne(id);
  }
}
