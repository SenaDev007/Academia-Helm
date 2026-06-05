import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FeatureCode, FeatureStatus } from './entities/tenant-feature.entity';
import { CreateTenantFeatureDto } from './dto/create-tenant-feature.dto';
import { UpdateTenantFeatureDto } from './dto/update-tenant-feature.dto';

@Injectable()
export class TenantFeaturesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTenantFeatureDto & { tenantId: string; enabledBy?: string }): Promise<any> {
    return this.prisma.tenantFeature.create({
      data: {
        ...data,
        status: data.status || FeatureStatus.DISABLED,
        enabledAt: data.status === FeatureStatus.ENABLED ? new Date() : null,
        enabledBy: data.status === FeatureStatus.ENABLED ? data.enabledBy : null,
      },
    });
  }

  async findAll(tenantId: string): Promise<any[]> {
    return this.prisma.tenantFeature.findMany({
      where: { tenantId },
      include: { enabledByUser: true, disabledByUser: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Récupère une feature par code (pas d'id unique, clé composite tenantId + featureCode). */
  async findOne(tenantId: string, featureCode: FeatureCode): Promise<any | null> {
    return this.prisma.tenantFeature.findFirst({
      where: { tenantId, featureCode },
      include: { enabledByUser: true, disabledByUser: true },
    });
  }

  async findByCode(featureCode: FeatureCode, tenantId: string): Promise<any | null> {
    return this.findOne(tenantId, featureCode);
  }

  async isEnabled(featureCode: FeatureCode, tenantId: string): Promise<boolean> {
    const feature = await this.findByCode(featureCode, tenantId);
    return feature?.status === FeatureStatus.ENABLED;
  }

  async update(tenantId: string, featureCode: FeatureCode, data: UpdateTenantFeatureDto & { updatedBy?: string }): Promise<any> {
    const feature = await this.findOne(tenantId, featureCode);
    if (!feature) {
      throw new Error(`Feature ${featureCode} not found`);
    }

    const updateData: any = { ...data };

    // Gérer les transitions de statut
    if (data.status === FeatureStatus.ENABLED && feature.status !== FeatureStatus.ENABLED) {
      updateData.enabledAt = new Date();
      updateData.enabledBy = data.updatedBy || feature.enabledBy;
      updateData.disabledAt = null;
      updateData.disabledBy = null;
    } else if (data.status === FeatureStatus.DISABLED && feature.status === FeatureStatus.ENABLED) {
      updateData.disabledAt = new Date();
      updateData.disabledBy = data.updatedBy || feature.disabledBy;
    }

    await this.prisma.tenantFeature.updateMany({
      where: { tenantId, featureCode },
      data: updateData,
    });
    return this.findOne(tenantId, featureCode);
  }

  async delete(tenantId: string, featureCode: FeatureCode): Promise<void> {
    await this.prisma.tenantFeature.deleteMany({
      where: { tenantId, featureCode },
    });
  }
}
