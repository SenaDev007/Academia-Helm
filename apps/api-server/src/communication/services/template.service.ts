import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, data: any) {
    return this.prisma.communicationTemplate.create({
      data: {
        ...data,
        tenantId,
      }
    });
  }

  async update(tenantId: string, id: string, data: any) {
    return this.prisma.communicationTemplate.update({
      where: { id },
      data
    });
  }

  async findAll(tenantId: string, filters: any) {
    const { category, channel, isActive } = filters;
    const where: any = { tenantId };
    if (category) where.category = category;
    if (channel) where.channel = channel;
    if (isActive !== undefined) where.isActive = isActive;

    return this.prisma.communicationTemplate.findMany({
      where,
      orderBy: { name: 'asc' }
    });
  }

  async findByCode(tenantId: string, code: string) {
    const template = await this.prisma.communicationTemplate.findUnique({
      where: { tenantId_code: { tenantId, code } }
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async delete(tenantId: string, id: string) {
    return this.prisma.communicationTemplate.update({
      where: { id },
      data: { isActive: false }
    });
  }
}
