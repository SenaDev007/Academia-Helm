import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class GradingPoliciesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(policyData: any): Promise<any> {
    return this.prisma.gradingPolicy.create({ data: policyData });
  }

  async findOne(id: string, countryId?: string): Promise<any | null> {
    const where: any = { id };
    if (countryId) {
      where.countryId = countryId;
    }
    return this.prisma.gradingPolicy.findFirst({
      where,
      include: { country: true },
    });
  }

  async findByCountry(countryId: string, educationLevel?: string): Promise<any[]> {
    const where: any = { countryId };
    if (educationLevel) {
      where.educationLevel = educationLevel;
    }
    return this.prisma.gradingPolicy.findMany({
      where,
      include: { country: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findDefaultByCountry(countryId: string, educationLevel?: string): Promise<any | null> {
    const where: any = { countryId, isDefault: true, isActive: true };
    if (educationLevel) {
      where.educationLevel = educationLevel;
    }
    return this.prisma.gradingPolicy.findFirst({
      where,
      include: { country: true },
    });
  }

  async findAll(): Promise<any[]> {
    return this.prisma.gradingPolicy.findMany({
      include: { country: true },
      orderBy: [{ countryId: 'asc' }, { educationLevel: 'asc' }, { isDefault: 'desc' }],
    });
  }

  async update(id: string, countryId: string, policyData: any): Promise<any> {
    await this.prisma.gradingPolicy.update({
      where: { id },
      data: policyData,
    });
    return this.findOne(id, countryId);
  }

  async delete(id: string, countryId: string): Promise<void> {
    await this.prisma.gradingPolicy.delete({ where: { id } });
  }

  async setAsDefault(id: string, countryId: string): Promise<any> {
    // Désactiver les autres policies par défaut pour ce pays
    await this.prisma.gradingPolicy.updateMany({
      where: { countryId, isDefault: true },
      data: { isDefault: false },
    });
    // Activer cette policy comme défaut
    await this.prisma.gradingPolicy.update({
      where: { id },
      data: { isDefault: true },
    });
    return this.findOne(id, countryId);
  }
}
