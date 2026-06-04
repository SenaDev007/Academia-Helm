import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, data: any) {
    return this.prisma.messageTemplate.create({
      data: {
        tenantId,
        name: data.name,
        type: data.type,
        channelId: data.channelId || null,
        subject: data.subject || null,
        content: data.content,
        contentFr: data.contentFr || null,
        contentEn: data.contentEn || null,
        variables: data.variables || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      }
    });
  }

  async update(tenantId: string, id: string, data: any) {
    // Verify template belongs to tenant
    const template = await this.prisma.messageTemplate.findFirst({
      where: { id, tenantId }
    });
    if (!template) throw new NotFoundException('Template not found');

    return this.prisma.messageTemplate.update({
      where: { id },
      data: {
        name: data.name,
        subject: data.subject,
        content: data.content,
        contentFr: data.contentFr,
        contentEn: data.contentEn,
        variables: data.variables,
        isActive: data.isActive,
      }
    });
  }

  async findAll(tenantId: string, filters: any) {
    const { type, channel, isActive } = filters;
    const where: any = { tenantId };
    if (type) where.type = type;
    if (channel) where.channelId = channel;
    if (isActive !== undefined) where.isActive = isActive;

    return this.prisma.messageTemplate.findMany({
      where,
      include: {
        channel: true,
        _count: { select: { triggers: true } }
      },
      orderBy: { name: 'asc' }
    });
  }

  async findByCode(tenantId: string, code: string) {
    // messageTemplate doesn't have a code field; search by name instead
    const template = await this.prisma.messageTemplate.findFirst({
      where: { tenantId, name: code, isActive: true }
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async delete(tenantId: string, id: string) {
    // Verify template belongs to tenant
    const template = await this.prisma.messageTemplate.findFirst({
      where: { id, tenantId }
    });
    if (!template) throw new NotFoundException('Template not found');

    return this.prisma.messageTemplate.update({
      where: { id },
      data: { isActive: false }
    });
  }
}
