/**
 * ============================================================================
 * ACADEMIC SETTINGS CONTROLLER
 * ============================================================================
 *
 * REST controller for SchoolAcademicSettings management.
 * Base path: /exams/settings
 *
 * All endpoints are protected by JwtAuthGuard. tenantId is extracted via the
 * @TenantId() decorator; userId via the @CurrentUser() decorator.
 *
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AcademicSettingsService } from './academic-settings.service';
import { ScoreEntrySchemaService } from './score-entry-schema.service';
import {
  CreateAcademicSettingsDto,
  UpdateAcademicSettingsDto,
  DuplicateSettingsDto,
} from './academic-settings.dto';

@Controller('academic-settings')
@UseGuards(JwtAuthGuard)
export class AcademicSettingsController {
  constructor(
    private readonly academicSettingsService: AcademicSettingsService,
    private readonly scoreEntrySchemaService: ScoreEntrySchemaService,
  ) {}

  // -------------------------------------------------------------------------
  // GET /exams/settings
  // -------------------------------------------------------------------------

  /**
   * Returns all settings records for the authenticated tenant.
   * Optionally filters by schoolYearId.
   */
  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('schoolYearId') schoolYearId?: string,
  ) {
    return this.academicSettingsService.findAll(tenantId, schoolYearId);
  }

  // -------------------------------------------------------------------------
  // GET /exams/settings/active
  // -------------------------------------------------------------------------

  /**
   * Returns the single ACTIVE settings record for the tenant + school year.
   * `schoolYearId` query param is required.
   */
  @Get('active')
  async findActive(
    @TenantId() tenantId: string,
    @Query('schoolYearId') schoolYearId: string,
  ) {
    return this.academicSettingsService.findActive(tenantId, schoolYearId);
  }

  // -------------------------------------------------------------------------
  // GET /exams/settings/score-entry-schema
  // -------------------------------------------------------------------------

  /**
   * Returns the dynamic score-entry column schema derived from the active
   * settings config for the given scope.
   *
   * NOTE: This route MUST be declared before GET /:id so NestJS does not
   * treat 'score-entry-schema' as a path parameter.
   */
  @Get('score-entry-schema')
  async getSchema(
    @TenantId() tenantId: string,
    @Query('schoolYearId') schoolYearId: string,
    @Query('cycleCode') cycleCode?: string,
    @Query('levelCode') levelCode?: string,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('periodId') periodId?: string,
  ) {
    return this.scoreEntrySchemaService.getSchema(tenantId, {
      schoolYearId,
      cycleCode,
      levelCode,
      classId,
      subjectId,
      periodId,
    });
  }

  // -------------------------------------------------------------------------
  // POST /exams/settings/validate
  // -------------------------------------------------------------------------

  /**
   * Validates a config object against the required academic settings schema.
   * Returns { valid: boolean, errors: string[] } without persisting anything.
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validate(@Body('config') config: any) {
    return this.academicSettingsService.validate(config);
  }

  // -------------------------------------------------------------------------
  // POST /exams/settings/simulate
  // -------------------------------------------------------------------------

  /**
   * Simulates grade calculations for 3 mock students using the provided config.
   * Returns { students: [...], generalAverage: number }.
   */
  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  async simulate(@Body('config') config: any) {
    return this.academicSettingsService.simulate(config);
  }

  // -------------------------------------------------------------------------
  // POST /exams/settings
  // -------------------------------------------------------------------------

  /**
   * Creates a new settings record in DRAFT status.
   */
  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateAcademicSettingsDto,
  ) {
    return this.academicSettingsService.create(tenantId, user.id, dto);
  }

  // -------------------------------------------------------------------------
  // GET /exams/settings/:id
  // -------------------------------------------------------------------------

  /**
   * Returns a single settings record by ID (tenant-scoped).
   */
  @Get(':id')
  async findById(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.academicSettingsService.findById(id, tenantId);
  }

  // -------------------------------------------------------------------------
  // PATCH /exams/settings/:id
  // -------------------------------------------------------------------------

  /**
   * Updates a DRAFT or ACTIVE settings record.
   * LOCKED and ARCHIVED records are rejected.
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() dto: UpdateAcademicSettingsDto,
  ) {
    return this.academicSettingsService.update(id, tenantId, dto);
  }

  // -------------------------------------------------------------------------
  // POST /exams/settings/:id/activate
  // -------------------------------------------------------------------------

  /**
   * Activates the specified settings record, deactivating all others for the
   * same tenant + school year.
   */
  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.academicSettingsService.activate(id, tenantId, user.id);
  }

  // -------------------------------------------------------------------------
  // POST /exams/settings/:id/lock
  // -------------------------------------------------------------------------

  /**
   * Locks the specified ACTIVE settings record to prevent further edits.
   */
  @Post(':id/lock')
  @HttpCode(HttpStatus.OK)
  async lock(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.academicSettingsService.lock(id, tenantId, user.id);
  }

  // -------------------------------------------------------------------------
  // POST /exams/settings/:id/archive
  // -------------------------------------------------------------------------

  /**
   * Archives the specified settings record (any status).
   */
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archive(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.academicSettingsService.archive(id, tenantId);
  }

  // -------------------------------------------------------------------------
  // POST /exams/settings/:id/duplicate
  // -------------------------------------------------------------------------

  /**
   * Duplicates an existing settings record as a new DRAFT with version + 1.
   */
  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  async duplicate(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: DuplicateSettingsDto,
  ) {
    return this.academicSettingsService.duplicate(id, tenantId, user.id, dto.name);
  }
}
