/**
 * ============================================================================
 * STUDENTS PRISMA CONTROLLER - MODULE 1
 * ============================================================================
 * 
 * Controller pour la gestion des élèves
 * Module 1 : Gestion des Élèves & Scolarité
 * 
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { StudentsPrismaService } from './students-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { SkipAcademicYear } from '../common/decorators/skip-academic-year.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IMAGE_ONLY_DATA_URL_PIPE } from '../common/pipes/data-url-validation.pipe';
import {
  CreateStudentPrismaDto,
  UpdateStudentPrismaDto,
  EnrollStudentDto,
  ArchiveStudentDto,
  BulkStatusUpdateDto,
  BulkArchiveDto,
  BulkReenrollDto,
} from './dto';

@Controller('students')
@UseGuards(JwtAuthGuard, TenantGuard)
@SkipAcademicYear() // ⭐ Les routes CRUD de StudentsPrismaController gèrent
//    elles-mêmes les champs (dateOfBirth, gender, etc.) sans avoir besoin
//    de l'AcademicYearEnforcementInterceptor qui injecte academicYearId
//    dans le body. Cet intercepteur casse le PUT /students/:id en
//    injectant academicYearId qui peut changer l'année de l'élève.
export class StudentsPrismaController {
  constructor(private readonly studentsService: StudentsPrismaService) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() createDto: CreateStudentPrismaDto,
  ) {
    return this.studentsService.createStudent({
      ...createDto,
      tenantId,
    });
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('status') status?: string,
    @Query('classId') classId?: string,
    @Query('search') search?: string,
    @Query('regimeType') regimeType?: string,
    @Query('hasArrears') hasArrears?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.studentsService.findAllStudents(tenantId, {
      academicYearId,
      schoolLevelId,
      status,
      classId,
      search,
      regimeType: regimeType || undefined,
      hasArrears: hasArrears === 'true' ? true : hasArrears === 'false' ? false : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    }, user?.scope ?? null);
  }

  @Get('statistics')
  async getStatistics(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.studentsService.getStudentStatistics(
      tenantId,
      academicYearId,
      schoolLevelId,
      user?.scope ?? null,
    );
  }

  /**
   * GET /students/abandons?academicYearId=...&schoolLevelId=...
   * Liste les élèves abandonnés (status = WITHDRAWN) avec détails pour le
   * tableau de pilotage (effectifs + abandons + scolarités).
   * Chaque abandon inclut : student, class, paidAmount, dueAmount, exitDate.
   */
  @Get('abandons')
  async getAbandons(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.studentsService.getAbandonedStudents(
      tenantId,
      academicYearId,
      schoolLevelId,
      user?.scope ?? null,
    );
  }

  // ============================================================================
  // ⭐ BULK ACTIONS — Actions multiples sur un groupe d'élèves
  // ============================================================================
  // ⚠️ Ces routes DOIVENT être déclarées AVANT @Get(':id') sinon NestJS
  //    interprète "bulk-status" comme un UUID et échoue (ParseUUIDPipe).

  /**
   * POST /students/bulk-status
   * Change le statut de plusieurs élèves en une seule requête.
   */
  @Post('bulk-status')
  async bulkUpdateStatus(
    @TenantId() tenantId: string,
    @Body() dto: BulkStatusUpdateDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.id || req?.user?.sub || null;
    return this.studentsService.bulkUpdateStatus(tenantId, dto, userId);
  }

  /**
   * POST /students/bulk-archive
   * Archive plusieurs élèves (pas de suppression physique — audit log par élève).
   */
  @Post('bulk-archive')
  async bulkArchive(
    @TenantId() tenantId: string,
    @Body() dto: BulkArchiveDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.id || req?.user?.sub || null;
    return this.studentsService.bulkArchive(tenantId, dto, userId);
  }

  /**
   * POST /students/bulk-reenroll
   * Réinscrit plusieurs élèves pour une nouvelle année académique.
   * Optionnellement les affecte à une classe cible.
   */
  @Post('bulk-reenroll')
  async bulkReenroll(
    @TenantId() tenantId: string,
    @Body() dto: BulkReenrollDto,
  ) {
    return this.studentsService.bulkReenroll(tenantId, dto);
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.studentsService.findStudentById(id, tenantId, user?.scope ?? null);
  }

  @Put(':id')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateStudentPrismaDto,
  ) {
    return this.studentsService.updateStudent(id, tenantId, updateDto);
  }

  @Post(':id/archive')
  async archive(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @TenantId() tenantId: string,
    @Body() body: ArchiveStudentDto,
  ) {
    return this.studentsService.archiveStudent(id, tenantId, body.reason);
  }

  @Post(':id/enroll')
  async enroll(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @TenantId() tenantId: string,
    @Body() enrollDto: EnrollStudentDto,
  ) {
    return this.studentsService.enrollStudent({
      ...enrollDto,
      tenantId,
      studentId: id,
    });
  }

  /**
   * POST /students/:id/upload-photo
   * Upload photo d'élève via data URL (base64) — pattern identique au RH (staff).
   * Body: { photoDataUrl: string }
   * Le pipe IMAGE_ONLY_DATA_URL_PIPE valide le format (image/*, max 5 Mo).
   */
  @Post(':id/upload-photo')
  async uploadPhoto(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @TenantId() tenantId: string,
    @Body('photoDataUrl', IMAGE_ONLY_DATA_URL_PIPE) photoDataUrl: string,
  ) {
    return this.studentsService.uploadStudentPhotoDataUrl(id, tenantId, photoDataUrl);
  }
}
