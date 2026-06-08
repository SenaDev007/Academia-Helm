import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TenantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantData: any): Promise<any> {
    return this.prisma.tenant.create({ data: tenantData });
  }

  async findOne(id: string): Promise<any | null> {
    return this.prisma.tenant.findFirst({ where: { id } });
  }

  async findBySlug(slug: string): Promise<any | null> {
    return this.prisma.tenant.findFirst({ where: { slug } });
  }

  async findBySubdomainOrSlug(subdomain: string): Promise<any | null> {
    return this.prisma.tenant.findFirst({
      where: {
        status: { not: 'WITHDRAWN' },
        OR: [{ subdomain: subdomain }, { slug: subdomain }],
      },
    });
  }

  async findAll(): Promise<any[]> {
    // Exclude WITHDRAWN tenants from the default list
    return this.prisma.tenant.findMany({
      where: { status: { not: 'WITHDRAWN' } },
    });
  }

  async findAllIncludingWithdrawn(): Promise<any[]> {
    return this.prisma.tenant.findMany();
  }

  async update(id: string, tenantData: any): Promise<any> {
    await this.prisma.tenant.update({ where: { id }, data: tenantData });
    return this.findOne(id);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.tenant.delete({ where: { id } });
  }
}
