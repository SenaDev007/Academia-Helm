/**
 * ============================================================================
 * ATTENDANCE PRISMA CONTROLLER - MODULE 5 (SCHEMA-ALIGNED v2)
 * ============================================================================
 *
 * Controller aligné sur le service AttendancePrismaService.
 * Les méthodes overtime utilisent `validated` (boolean) au lieu de `status` (string).
 *
 * ============================================================================
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, BadRequestException, Req } from '@nestjs/common';
import { AttendancePrismaService } from './attendance-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RecordAttendanceDto, RecordOvertimeDto, UpdateAttendanceDto,
         SelfCheckInDto, SemainierCheckInDto, SelfCheckOutDto, SelfOvertimeDto } from './dto/index';
import { Request } from 'express';

@Controller('hr/attendance')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AttendancePrismaController {
  constructor(private readonly attendanceService: AttendancePrismaService) {}

  // ─── Staff Attendance ────────────────────────────────────────────────────────

  @Post()
  async recordAttendance(
    @GetTenant() tenant: any,
    @Body() data: RecordAttendanceDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.attendanceService.recordAttendance({
      ...data,
      tenantId: tid,
    });
  }

  @Put(':id')
  async updateAttendance(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() data: UpdateAttendanceDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.attendanceService.updateAttendance(id, tid, data);
  }

  @Get('staff/:staffId')
  async findStaffAttendances(
    @GetTenant() tenant: any,
    @Param('staffId') staffId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.attendanceService.findStaffAttendances(staffId, tid, {
      academicYearId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status,
    });
  }

  @Get('statistics')
  async getAttendanceStatistics(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('staffId') staffId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.attendanceService.getAttendanceStatistics(tid, academicYearId, {
      staffId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  // ─── Overtime Records ────────────────────────────────────────────────────────

  @Post('overtime')
  async recordOvertime(
    @GetTenant() tenant: any,
    @Body() data: RecordOvertimeDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.attendanceService.recordOvertime({
      ...data,
      tenantId: tid,
    });
  }

  @Put('overtime/:id/process')
  async processOvertime(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { action: 'VALIDATE' | 'REJECT', validatedBy?: string },
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.attendanceService.processOvertime(
      id, tid, body.action, body.validatedBy,
    );
  }

  @Delete(':id')
  async deleteAttendance(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.attendanceService.deleteAttendance(id, tid);
  }

  @Delete('overtime/:id')
  async deleteOvertime(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.attendanceService.deleteOvertime(id, tid);
  }

  @Get('overtime/staff/:staffId')
  async findStaffOvertime(
    @GetTenant() tenant: any,
    @Param('staffId') staffId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('validated') validated?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.attendanceService.findStaffOvertime(staffId, tid, {
      academicYearId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      validated: validated !== undefined ? validated === 'true' : undefined,
    });
  }

  // ============================================================================
  // ⭐ GÉOLOCALISATION — Self-check-in / Semainier check-in / Self check-out
  // ============================================================================

  /**
   * ⭐ Self-check-in : l'enseignant connecté marque SA présence.
   * Le backend vérifie OBLIGATOIREMENT la position GPS contre les coords école.
   */
  @Post('self-check-in')
  async selfCheckIn(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Req() req: Request,
    @Body() data: SelfCheckInDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback ?? user?.tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!user?.email) throw new BadRequestException('Utilisateur non authentifié');

    return this.attendanceService.selfCheckIn(tid, user.email, user.id, {
      date: data.date,
      status: data.status,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
      deviceInfo: data.deviceInfo,
      ipAddress: req.ip || req.socket?.remoteAddress,
    });
  }

  /**
   * ⭐ Semainier check-in : le semainier connecté marque la présence d'un staff.
   * Pas de vérif géo (le semainier est déjà dans l'école).
   */
  @Post('semainier-check-in')
  async semainierCheckIn(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Body() data: SemainierCheckInDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback ?? user?.tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!user?.id) throw new BadRequestException('Utilisateur non authentifié');

    return this.attendanceService.semainierCheckIn(tid, user.id, {
      staffId: data.staffId,
      date: data.date,
      status: data.status,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      hoursWorked: data.hoursWorked,
      notes: data.notes,
    });
  }

  /**
   * ⭐ Self check-out : l'enseignant connecté clique "Fin de journée".
   * Calcule hoursWorked = checkOut - checkIn.
   */
  @Post('self-check-out')
  async selfCheckOut(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Body() data: SelfCheckOutDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback ?? user?.tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!user?.email) throw new BadRequestException('Utilisateur non authentifié');

    return this.attendanceService.selfCheckOut(tid, user.email, user.id, {
      date: data.date,
    });
  }

  /**
   * ⭐ Récupère la présence DU JOUR pour l'utilisateur connecté.
   * Utilisé par le dashboard enseignant (carte "Ma présence du jour").
   */
  @Get('my-today')
  async getMyAttendanceToday(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Query('date') dateParam?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback ?? user?.tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!user?.email) throw new BadRequestException('Utilisateur non authentifié');

    const date = dateParam ? new Date(dateParam) : new Date();
    return this.attendanceService.getMyAttendanceToday(tid, user.email, date);
  }

  /**
   * ⭐ Liste de TOUS les enseignants + leur présence pour une date donnée.
   * Utilisé par le semainier pour voir/marquer tous les enseignants du jour.
   */
  @Get('daily-staff')
  async getDailyStaffAttendances(
    @GetTenant() tenant: any,
    @Query('date') dateParam?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    const date = dateParam ? new Date(dateParam) : new Date();
    return this.attendanceService.getDailyStaffAttendances(tid, date);
  }

  // ===========================================================================
  // ⭐ 2026-09-15 — MODULE PRÉSENCE ENSEIGNANT (self-service, portail teacher)
  //
  // Le Staff est TOUJOURS résolu par l'email de l'utilisateur connecté :
  // un enseignant ne peut consulter/ déclarer que pour LUI-MÊME.
  // Utilisé par /app/teacher/presence (Ma présence / Heures supplémentaires).
  // ===========================================================================

  /**
   * ⭐ Historique des présences de l'utilisateur connecté.
   * Filtres optionnels : startDate, endDate, academicYearId, limit (défaut 60).
   */
  @Get('my-history')
  async getMyAttendanceHistory(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('limit') limitParam?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback ?? user?.tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!user?.email) throw new BadRequestException('Utilisateur non authentifié');

    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    return this.attendanceService.getMyAttendanceHistory(tid, user.email, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      academicYearId,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  /**
   * ⭐ Heures supplémentaires de l'utilisateur connecté (validées + en attente).
   */
  @Get('my-overtime')
  async getMyOvertime(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('validated') validated?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback ?? user?.tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!user?.email) throw new BadRequestException('Utilisateur non authentifié');

    return this.attendanceService.getMyOvertime(tid, user.email, {
      academicYearId,
      validated: validated !== undefined ? validated === 'true' : undefined,
    });
  }

  /**
   * ⭐ L'utilisateur connecté déclare SES heures supplémentaires.
   * La validation/rejet reste du ressort de la direction (module RH → Présences).
   */
  @Post('my-overtime')
  async declareMyOvertime(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Body() data: SelfOvertimeDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback ?? user?.tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!user?.email) throw new BadRequestException('Utilisateur non authentifié');

    return this.attendanceService.declareMyOvertime(tid, user.email, {
      date: data.date,
      hours: data.hours,
      reason: data.reason,
      academicYearId: data.academicYearId,
    });
  }
}
