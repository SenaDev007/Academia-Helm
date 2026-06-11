import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SalaryPoliciesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(policyData: any): Promise<any> {
    return this.prisma.salaryPolicy.create({ data: policyData });
  }

  async findOne(id: string, countryId?: string): Promise<any | null> {
    const where: any = { id };
    if (countryId) {
      where.countryId = countryId;
    }
    return this.prisma.salaryPolicy.findFirst({
      where,
      include: { country: true },
    });
  }

  async findByCountry(countryId: string): Promise<any[]> {
    return this.prisma.salaryPolicy.findMany({
      where: { countryId },
      include: { country: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findDefaultByCountry(countryId: string): Promise<any | null> {
    return this.prisma.salaryPolicy.findFirst({
      where: { countryId, isDefault: true, isActive: true },
      include: { country: true },
    });
  }

  async findAll(): Promise<any[]> {
    return this.prisma.salaryPolicy.findMany({
      include: { country: true },
      orderBy: [{ countryId: 'asc' }, { isDefault: 'desc' }],
    });
  }

  async update(id: string, countryId: string, policyData: any): Promise<any> {
    await this.prisma.salaryPolicy.update({
      where: { id },
      data: policyData,
    });
    return this.findOne(id, countryId);
  }

  async delete(id: string, countryId: string): Promise<void> {
    await this.prisma.salaryPolicy.delete({ where: { id } });
  }

  async setAsDefault(id: string, countryId: string): Promise<any> {
    // Désactiver les autres policies par défaut pour ce pays
    await this.prisma.salaryPolicy.updateMany({
      where: { countryId, isDefault: true },
      data: { isDefault: false },
    });
    // Activer cette policy comme défaut
    await this.prisma.salaryPolicy.update({
      where: { id },
      data: { isDefault: true },
    });
    return this.findOne(id, countryId);
  }
}
