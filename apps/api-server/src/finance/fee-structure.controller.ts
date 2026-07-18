/**
 * SOUS-MODULE 1 — Configuration des frais (FeeStructure) — API
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FeeStructureService } from './fee-structure.service';
import { FeeOverrideImportService } from './fee-override-import.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateFeeStructureDto, UpdateFeeStructureDto } from './dto';

@Controller('finance/fee-structures')
@UseGuards(JwtAuthGuard)
export class FeeStructureController {
  private readonly logger = new Logger(FeeStructureController.name);
  constructor(
    private readonly service: FeeStructureService,
    private readonly overrideImportService: FeeOverrideImportService,
  ) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: CreateFeeStructureDto,
  ) {
    this.logger.log(`Create fee structure: academicYearId=${body.academicYearId}, levelId=${body.levelId}, classId=${body.classId}, academicClassId=${body.academicClassId}, feeType=${body.feeType}, isInstallment=${body.isInstallment}`);
    const installments = body.installments?.map((i: any) => {
      const dueDateType = i.dueDateType ?? 'FIXED';
      return {
        label: i.label,
        amount: Number(i.amount),
        // dueDate n'est requis que pour le mode FIXED
        dueDate: dueDateType === 'FIXED' && i.dueDate ? new Date(i.dueDate) : undefined,
        dueDateType,
        daysOffset: i.daysOffset != null ? Number(i.daysOffset) : undefined,
        orderIndex: Number(i.orderIndex),
      };
    });
    return this.service.create(tenantId, {
      academicYearId: body.academicYearId,
      levelId: body.levelId,
      classId: body.classId,
      /// ⭐ Classe officielle (AcademicClass) — transmise depuis le frontend.
      academicClassId: body.academicClassId,
      name: body.name,
      feeType: body.feeType,
      customFeeTypeLabel: body.customFeeTypeLabel,
      totalAmount: Number(body.totalAmount),
      isInstallment: body.isInstallment ?? false,
      isMandatory: body.isMandatory ?? true,
      installments,
      createdById: user?.id,
    }, user?.id);
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('levelId') levelId?: string,
    @Query('classId') classId?: string,
    @Query('academicClassId') academicClassId?: string,
    @Query('feeType') feeType?: string,
    @Query('isActive') isActive?: string,
  ) {
    if (!academicYearId) {
      return [];
    }
    return this.service.findAll(tenantId, {
      academicYearId,
      levelId,
      classId,
      academicClassId,
      feeType,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Post('copy-to-year')
  async copyToNewYear(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { fromAcademicYearId: string; toAcademicYearId: string },
  ) {
    return this.service.copyToNewYear(tenantId, {
      fromAcademicYearId: body.fromAcademicYearId,
      toAcademicYearId: body.toAcademicYearId,
      createdById: user?.id,
    }, user?.id);
  }

  /**
   * POST /finance/fee-structures/recalculate-accounts
   * Recalcule dynamiquement TOUS les comptes élèves du tenant en appliquant
   * les FeeOverrides existants. Utile pour rattraper les comptes créés avant
   * un override, ou après une correction de bug.
   *
   * Body optionnel : { academicYearId? } — si fourni, ne recalcule que les
   * comptes de cette année. Sinon, recalcule tous les comptes du tenant.
   */
  @Post('recalculate-accounts')
  async recalculateAllAccounts(
    @TenantId() tenantId: string,
    @Body() body: { academicYearId?: string },
  ) {
    return this.service.recalculateAllAccounts(tenantId, body?.academicYearId);
  }

  @Post('override')
  async createOverride(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { feeStructureId: string; studentId: string; customAmount: number; reason: string },
  ) {
    return this.service.createOverride(tenantId, {
      ...body,
      customAmount: Number(body.customAmount),
      createdById: user?.id,
    }, user?.id);
  }

  @Get('overrides')
  async getOverrides(
    @TenantId() tenantId: string,
    @Query('studentId') studentId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('feeStructureId') feeStructureId?: string,
    @Query('classId') classId?: string,
    @Query('feeType') feeType?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // Si studentId est fourni → on utilise l'ancienne méthode (rétro-compat)
    if (studentId) {
      return this.service.getOverridesForStudent(tenantId, studentId, academicYearId);
    }
    // Sinon → on liste tous les overrides du tenant (onglet Personnalisations)
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.service.getAllOverrides(tenantId, {
      academicYearId,
      feeStructureId,
      classId,
      feeType,
      schoolLevelId,
      search,
      page: pageNum && !isNaN(pageNum) ? pageNum : undefined,
      limit: limitNum && !isNaN(limitNum) ? limitNum : undefined,
    });
  }

  @Delete('overrides/:id')
  async deleteOverride(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.service.deleteOverride(id, tenantId);
  }

  /**
   * ⭐ Bulk delete : supprime plusieurs overrides en une seule opération.
   * POST /finance/fee-structures/overrides/bulk-delete
   * Body: { ids: string[] }
   * Retourne { deleted: string[], blocked: { id, reason }[], message }
   */
  @Post('overrides/bulk-delete')
  async bulkDeleteOverrides(
    @TenantId() tenantId: string,
    @Body() body: { ids: string[] },
  ) {
    this.logger.log(`Bulk delete fee overrides: ${body.ids?.length || 0} IDs`);
    return this.service.deleteManyOverrides(body.ids || [], tenantId);
  }

  // ─── Import en masse de personnalisations (FeeOverride) ─────────────────────
  // Workflow : download template → upload → preview → run
  // Détails : apps/api-server/src/finance/fee-override-import.service.ts

  /**
   * GET /finance/fee-structures/overrides/import/template
   * Télécharge le template Excel pour l'import de personnalisations.
   * Une feuille "Personnalisations" avec en-tête + 2 lignes d'exemple.
   */
  @Get('overrides/import/template')
  async downloadOverrideTemplate(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Res() res: Response,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis (query param)');
    }
    this.logger.log(`Download override import template: tenant=${tenantId}, year=${academicYearId}`);
    await this.overrideImportService.downloadTemplate(tenantId, academicYearId, res);
  }

  /**
   * POST /finance/fee-structures/overrides/import/preview
   * Valide le fichier Excel sans créer d'overrides.
   * Body : { academicYearId, fileDataUrl }
   * Retourne : { totalRows, validRows, invalidRows, rows[], summary }
   */
  @Post('overrides/import/preview')
  async previewOverrideImport(
    @TenantId() tenantId: string,
    @Body() body: { academicYearId: string; fileDataUrl: string },
  ) {
    if (!body.fileDataUrl) {
      throw new BadRequestException('fileDataUrl est requis (base64 data URL du fichier Excel)');
    }
    if (!body.academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    return this.overrideImportService.previewImport(tenantId, body.academicYearId, body.fileDataUrl);
  }

  /**
   * POST /finance/fee-structures/overrides/import/run
   * Importe réellement les overrides (crée ou met à jour).
   * Body : { academicYearId, fileDataUrl }
   * Retourne : { total, created, updated, errors, results[] }
   */
  @Post('overrides/import/run')
  async runOverrideImport(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { academicYearId: string; fileDataUrl: string },
  ) {
    if (!body.fileDataUrl) {
      throw new BadRequestException('fileDataUrl est requis (base64 data URL du fichier Excel)');
    }
    if (!body.academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    this.logger.log(`Run override import: tenant=${tenantId}, user=${user?.id}, rows=...`);
    return this.overrideImportService.runImport(tenantId, body.academicYearId, body.fileDataUrl, user?.id);
  }

  @Patch('overrides/:id')
  async updateOverride(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { customAmount?: number; reason?: string },
  ) {
    return this.service.updateOverride(id, tenantId, body);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.findOne(id, tenantId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: UpdateFeeStructureDto,
  ) {
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.feeType !== undefined) data.feeType = body.feeType;
    if (body.customFeeTypeLabel !== undefined) data.customFeeTypeLabel = body.customFeeTypeLabel || null;
    if (body.totalAmount !== undefined) data.totalAmount = Number(body.totalAmount);
    if (body.isInstallment !== undefined) data.isInstallment = body.isInstallment;
    if (body.isMandatory !== undefined) data.isMandatory = body.isMandatory;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.levelId !== undefined) data.levelId = body.levelId || null;
    if (body.classId !== undefined) data.classId = body.classId || null;
    // Mise à jour des installments (remplacement complet de la collection)
    if (body.installments !== undefined) {
      data.installments = (body.installments as any[]).map((i: any) => {
        const dueDateType = i.dueDateType ?? 'FIXED';
        return {
          label: i.label,
          amount: Number(i.amount),
          dueDate: dueDateType === 'FIXED' && i.dueDate ? new Date(i.dueDate) : undefined,
          dueDateType,
          daysOffset: i.daysOffset != null ? Number(i.daysOffset) : undefined,
          orderIndex: Number(i.orderIndex),
        };
      });
    }
    return this.service.update(id, tenantId, data, user?.id);
  }

  @Post(':id/installments')
  async addInstallment(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { label: string; amount: number; dueDate: string; orderIndex: number },
  ) {
    return this.service.addInstallment(id, tenantId, {
      ...body,
      amount: Number(body.amount),
      dueDate: new Date(body.dueDate),
      orderIndex: Number(body.orderIndex),
    });
  }

  /**
   * ⭐ Task 24 : Suppression multiple (bulk delete).
   * POST /finance/fee-structures/bulk-delete
   * Body: { ids: string[] }
   * Retourne { deleted: string[], blocked: { id, name, reason }[], message }
   */
  @Post('bulk-delete')
  async bulkDelete(
    @TenantId() tenantId: string,
    @Body() body: { ids: string[] },
  ) {
    this.logger.log(`Bulk delete fee structures: ${body.ids?.length || 0} IDs`);
    return this.service.deleteMany(body.ids || [], tenantId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.service.delete(id, tenantId);
  }
}
