/**
 * ============================================================================
 * ATTENDANCE PRISMA SERVICE - MODULE 5
 * ============================================================================
 * 
 * Service pour la gestion des présences et heures supplémentaires
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';
import { EmailService } from '../communication/services/email.service';
import { RecruitmentNotificationService } from './recruitment-notification.service';
import { renderOvertimeDecisionEmail } from './hr-email-templates';
import { GeolocationService } from './geolocation.service';

@Injectable()
export class AttendancePrismaService {
  private readonly logger = new Logger(AttendancePrismaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationService: RecruitmentNotificationService,
    private readonly geolocationService: GeolocationService,
  ) {}

  // ============================================================================
  // STAFF ATTENDANCE
  // ============================================================================

  /**
   * Enregistre une présence
   */
  async recordAttendance(data: {
    tenantId: string;
    academicYearId?: string;
    schoolLevelId?: string;
    staffId: string;
    date: string | Date;
    checkIn?: string | Date;
    checkOut?: string | Date;
    status: string;
    hoursWorked?: number;
    notes?: string;
  }) {
    // Convert date strings to Date objects (DTO sends strings via @IsDateString)
    const date = data.date instanceof Date ? data.date : new Date(data.date);
    const checkIn = data.checkIn ? (data.checkIn instanceof Date ? data.checkIn : new Date(data.checkIn)) : null;
    const checkOut = data.checkOut ? (data.checkOut instanceof Date ? data.checkOut : new Date(data.checkOut)) : null;

    // Vérifier qu'il n'y a pas déjà une présence pour cette date
    const existing = await this.prisma.staffAttendance.findUnique({
      where: {
        staffId_date: {
          staffId: data.staffId,
          date,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(`Attendance already recorded for this date`);
    }

    // ─── Résoudre l'année académique active si non fournie ──
    const academicYearId = await this.resolveAcademicYear(data.tenantId, data.academicYearId);

    return this.prisma.staffAttendance.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId,
        schoolLevelId: data.schoolLevelId ?? null,
        staffId: data.staffId,
        date,
        checkIn,
        checkOut,
        status: data.status || 'PRESENT',
        hoursWorked: data.hoursWorked ?? null,
        notes: data.notes ?? null,
      },
    });
  }

  /**
   * Met à jour une présence
   */
  async updateAttendance(id: string, tenantId: string, data: any) {
    const attendance = await this.prisma.staffAttendance.findFirst({
      where: { id, tenantId },
    });

    if (!attendance) {
      throw new NotFoundException(`Attendance with ID ${id} not found`);
    }

    return this.prisma.staffAttendance.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        ...data,
      },
    });
  }

  /**
   * Récupère les présences d'un membre du personnel
   */
  async findStaffAttendances(staffId: string, tenantId: string, filters?: {
    academicYearId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
  }) {
    const where: any = {
      staffId,
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }
    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.date.lte = filters.endDate;
      }
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.staffAttendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Récupère les statistiques de présence
   */
  async getAttendanceStatistics(tenantId: string, academicYearId?: string, filters?: {
    staffId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {
      tenantId,
    };

    // Résoudre l'année académique si non fournie
    const resolvedAcademicYearId = academicYearId || await this.resolveAcademicYear(tenantId).catch(() => null);
    if (resolvedAcademicYearId) {
      where.academicYearId = resolvedAcademicYearId;
    }

    if (filters?.staffId) {
      where.staffId = filters.staffId;
    }
    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.date.lte = filters.endDate;
      }
    }

    // Use Prisma groupBy instead of loading all records into memory
    const grouped = await this.prisma.staffAttendance.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    let total = 0;
    let present = 0;
    let absent = 0;
    for (const g of grouped) {
      total += g._count;
      if (g.status === 'PRESENT') present = g._count;
      if (g.status === 'ABSENT') absent = g._count;
    }

    return {
      total,
      present,
      absent,
      attendanceRate: total > 0 ? (present / total) * 100 : 0,
    };
  }

  // ============================================================================
  // OVERTIME RECORDS
  // ============================================================================

  /**
   * Enregistre des heures supplémentaires
   * OvertimeRecord n'a pas de champ status — utilise validated (boolean, default false)
   */
  async recordOvertime(data: {
    tenantId: string;
    academicYearId?: string;
    schoolLevelId?: string;
    staffId: string;
    date: string | Date;
    hours: number;
    reason?: string;
    notes?: string;
  }) {
    // Convert date string to Date object (DTO sends strings via @IsDateString)
    const date = data.date instanceof Date ? data.date : new Date(data.date);

    // ─── Résoudre l'année académique active si non fournie ──
    const academicYearId = await this.resolveAcademicYear(data.tenantId, data.academicYearId);

    return this.prisma.overtimeRecord.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId,
        schoolLevelId: data.schoolLevelId ?? null,
        staffId: data.staffId,
        date,
        hours: new Prisma.Decimal(data.hours),
        validated: false,
        notes: data.reason ?? data.notes ?? null,
      },
    });
  }

  /**
   * Résout l'année académique active si non fournie.
   * Fallback: dernière année créée pour ce tenant.
   */
  private async resolveAcademicYear(tenantId: string, academicYearId?: string): Promise<string> {
    if (academicYearId) return academicYearId;

    const activeYear = await this.prisma.academicYear.findFirst({
      where: { isActive: true, tenantId },
      select: { id: true },
    });
    if (activeYear) return activeYear.id;

    const lastYear = await this.prisma.academicYear.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!lastYear) {
      throw new BadRequestException(
        'Aucune année académique trouvée. Veuillez créer une année académique dans les paramètres.',
      );
    }
    return lastYear.id;
  }

  /**
   * Valide ou rejette des heures supplémentaires
   * Utilise validated (boolean), validatedBy, validatedAt — PAS de champ status/approvedBy/approvedAt
   */
  async processOvertime(id: string, tenantId: string, action: 'VALIDATE' | 'REJECT', validatedBy?: string) {
    const overtime = await this.prisma.overtimeRecord.findFirst({
      where: { id, tenantId },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!overtime) {
      throw new NotFoundException(`Overtime record with ID ${id} not found`);
    }

    const updated = await this.prisma.overtimeRecord.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        validated: action === 'VALIDATE',
        validatedBy: validatedBy ?? null,
        validatedAt: new Date(),
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // ─── Envoi de l'email de notification au personnel ──
    this.sendOvertimeDecisionEmail(updated, tenantId, action).catch((err) => {
      this.logger.error(`Failed to send overtime decision email: ${err.message}`);
    });

    return updated;
  }

  /**
   * Envoie un email de notification au personnel pour la validation ou le rejet
   * de ses heures supplémentaires. Utilise le template Helm standardisé.
   */
  private async sendOvertimeDecisionEmail(
    overtime: any,
    tenantId: string,
    action: 'VALIDATE' | 'REJECT',
  ) {
    try {
      const staff = overtime.staff;
      if (!staff?.email) {
        this.logger.warn(`No email for staff ${staff?.id} — skipping overtime decision notification`);
        return;
      }

      const branding = await this.notificationService.getTenantBranding(tenantId);

      const decision = action === 'VALIDATE' ? 'VALIDATED' : 'REJECTED';

      const { subject, html } = renderOvertimeDecisionEmail({
        branding,
        staffName: `${staff.firstName} ${staff.lastName}`,
        date: overtime.date,
        hours: Number(overtime.hours),
        reason: overtime.notes,
        decision,
        validatorName: undefined, // could be enriched if we fetch the validator user
      });

      await this.emailService.sendEmail({
        to: staff.email,
        subject,
        html,
        fromName: branding.schoolName || 'Academia Helm',
      });

      this.logger.log(`Overtime decision email sent to ${staff.email} (${decision})`);
    } catch (err) {
      this.logger.error(`sendOvertimeDecisionEmail failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Récupère les heures supplémentaires d'un membre du personnel
   * Filtre par validated (boolean) — PAS par status
   */
  async findStaffOvertime(staffId: string, tenantId: string, filters?: {
    academicYearId?: string;
    startDate?: Date;
    endDate?: Date;
    validated?: boolean;
  }) {
    const where: any = {
      staffId,
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }
    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.date.lte = filters.endDate;
      }
    }
    if (filters?.validated !== undefined) {
      where.validated = filters.validated;
    }

    return this.prisma.overtimeRecord.findMany({
      where,
      include: {
        validator: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Calcule le total d'heures supplémentaires validées
   * Filtre par validated: true — PAS par status: 'APPROVED'
   */
  async calculateTotalOvertime(staffId: string, tenantId: string, startDate: Date, endDate: Date) {
    const overtimeRecords = await this.prisma.overtimeRecord.findMany({
      where: {
        staffId,
        tenantId,
        validated: true,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return overtimeRecords.reduce((total, record) => {
      return total + Number(record.hours);
    }, 0);
  }

  /**
   * Supprime un enregistrement de présence
   */
  async deleteAttendance(id: string, tenantId: string) {
    const existing = await this.prisma.staffAttendance.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Attendance record ${id} not found`);
    }
    return this.prisma.staffAttendance.delete({ where: { id } });
  }

  /**
   * Supprime un enregistrement d'heures supplémentaires
   */
  async deleteOvertime(id: string, tenantId: string) {
    const existing = await this.prisma.overtimeRecord.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Overtime record ${id} not found`);
    }
    return this.prisma.overtimeRecord.delete({ where: { id } });
  }

  // ============================================================================
  // ⭐ SELF-CHECK-IN & SEMAINIER CHECK-IN (Géolocalisé)
  // ============================================================================
  //
  // Deux modes de pointage pour la présence des enseignants :
  //
  // 1. SELF-CHECK-IN : l'enseignant marque SA présence depuis son téléphone/PC.
  //    Le backend vérifie OBLIGATOIREMENT la position GPS contre les coords école
  //    (rayon configurable, par défaut 100m). Si coords école non configurées →
  //    refus avec message explicite.
  //
  // 2. SEMAINIER-CHECK-IN : le semainier marque la présence d'un enseignant.
  //    Pas de vérif géo (le semainier est déjà validé dans l'école).
  //
  // ⭐ MUTUAL EXCLUSION :
  //   - Si une présence existe déjà avec markedByRole='SELF' → le semainier ne
  //     PEUT PAS la modifier.
  //   - Si une présence existe avec markedByRole='SEMINARIER' → l'enseignant ne
  //     PEUT PAS se marquer lui-même (le semainier a déjà tout géré).
  //   - Si marquée par ADMIN (cas legacy) → l'enseignant ou le semainier peut
  //     override (passage au nouveau système).

  /**
   * Résout un Staff à partir de l'email utilisateur connecté.
   * Le Staff est identifié par son email (pas de FK directe User ↔ Staff).
   */
  async resolveStaffByUserEmail(email: string, tenantId: string) {
    const staff: any = await this.prisma.$queryRawUnsafe(
      `SELECT id, "firstName", "lastName", email, "roleType", "schoolLevelId"
       FROM "staff"
       WHERE email = $1 AND "tenantId" = $2 AND status = 'ACTIVE'
       LIMIT 1`,
      email, tenantId,
    );
    if (!staff || staff.length === 0) return null;
    return staff[0];
  }

  /**
   * ⭐ Self-check-in : l'enseignant marque SA présence depuis son téléphone/PC.
   * Vérifie la géolocalisation côté serveur (anti-fraude).
   */
  async selfCheckIn(
    tenantId: string,
    userEmail: string,
    userId: string,
    data: {
      date: string | Date;
      status?: string;
      latitude: number;
      longitude: number;
      accuracy?: number;
      deviceInfo?: string;
      ipAddress?: string;
    },
  ) {
    // 1. Résoudre le Staff connecté
    const staff = await this.resolveStaffByUserEmail(userEmail, tenantId);
    if (!staff) {
      throw new BadRequestException(
        `Aucun staff actif trouvé pour l'email ${userEmail}. ` +
        `Contactez l'administrateur RH pour vérifier votre rattachement.`
      );
    }

    const date = data.date instanceof Date ? data.date : new Date(data.date);

    // 2. Vérifier qu'il n'y a pas déjà une présence pour cette date
    const existing = await this.prisma.$queryRawUnsafe(
      `SELECT id, "markedByRole", "markedBy", status, "checkIn"
       FROM "staff_attendances"
       WHERE "staffId" = $1 AND date = $2 AND "tenantId" = $3
       LIMIT 1`,
      staff.id, date, tenantId,
    ) as any[];

    if (existing && existing.length > 0) {
      const ex = existing[0];
      // ⭐ Mutual exclusion : si déjà marqué SELF ou SEMINARIER → refus
      if (ex.markedByRole === 'SELF') {
        throw new BadRequestException(
          `Vous avez déjà pointé votre présence aujourd'hui à ` +
          `${ex.checkIn ? new Date(ex.checkIn).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'heure inconnue'} ` +
          `(statut: ${ex.status}). Vous ne pouvez pas pointer deux fois.`
        );
      }
      if (ex.markedByRole === 'SEMINARIER') {
        throw new BadRequestException(
          `Votre présence a déjà été marquée par le semainier (statut: ${ex.status}). ` +
          `Vous ne pouvez pas la modifier vous-même.`
        );
      }
      // Si marquée ADMIN (legacy) → on override avec SELF
    }

    // 3. ⭐ Vérification géo CÔTÉ SERVEUR (anti-fraude)
    const geoResult = await this.geolocationService.verifyPosition(tenantId, {
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
    });

    if (!geoResult.verified) {
      const reason = geoResult.reason === 'COORDS_ECOLE_NON_CONFIGUREES'
        ? 'Les coordonnées GPS de l\'école ne sont pas encore configurées. ' +
          'Demandez au directeur de paramétrer la localisation dans Paramètres → Établissement.'
        : `Vous êtes à ${geoResult.distance.toFixed(0)}m de l'école (rayon autorisé: ${geoResult.allowedRadius}m). ` +
          `Rapprochez-vous de l'établissement pour pointer votre présence.`;

      this.logger.warn(
        `🚫 Self-check-in refusé pour ${staff.firstName} ${staff.lastName} — ` +
        `reason=${geoResult.reason} distance=${geoResult.distance}m`
      );
      throw new BadRequestException({
        message: 'Pointage refusé — position GPS invalide',
        reason: geoResult.reason,
        distance: geoResult.distance,
        allowedRadius: geoResult.allowedRadius,
        details: reason,
      });
    }

    // 4. Supprimer l'ancien enregistrement si marqué ADMIN (override)
    if (existing && existing.length > 0 && existing[0].markedByRole === 'ADMIN') {
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM "staff_attendances" WHERE id = $1`,
        existing[0].id,
      );
    }

    // 5. Résoudre l'année académique
    const academicYearId = await this.resolveAcademicYear(tenantId);

    // 6. Créer l'enregistrement avec coords + audit
    const id = crypto.randomUUID();
    const checkIn = new Date(); // maintenant
    const status = data.status || 'PRESENT';

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "staff_attendances"
         ("id", "tenantId", "academicYearId", "schoolLevelId", "staffId", "date",
          "checkIn", "status", "latitude", "longitude", "geoAccuracy",
          "geoVerified", "geoDistance", "markedBy", "markedByRole",
          "deviceInfo", "ipAddress", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'SELF', $15, $16, NOW(), NOW())`,
      id, tenantId, academicYearId, staff.schoolLevelId, staff.id, date,
      checkIn, status, data.latitude, data.longitude, data.accuracy || null,
      true, geoResult.distance, userId, data.deviceInfo || null, data.ipAddress || null,
    );

    this.logger.log(
      `✅ Self-check-in — ${staff.firstName} ${staff.lastName} (staffId=${staff.id}) ` +
      `distance=${geoResult.distance.toFixed(0)}m statut=${status}`
    );

    return {
      id,
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      date,
      checkIn,
      status,
      markedByRole: 'SELF',
      geoVerified: true,
      geoDistance: geoResult.distance,
      allowedRadius: geoResult.allowedRadius,
    };
  }

  /**
   * ⭐ Semainier check-in : le semainier marque la présence d'un enseignant.
   * Pas de vérif géo (le semainier est déjà dans l'école).
   */
  async semainierCheckIn(
    tenantId: string,
    semainierUserId: string,
    data: {
      staffId: string;
      date: string | Date;
      status: string;
      checkIn?: string | Date;
      checkOut?: string | Date;
      hoursWorked?: number;
      notes?: string;
    },
  ) {
    const date = data.date instanceof Date ? data.date : new Date(data.date);

    // 1. Vérifier qu'il n'y a pas déjà une présence marquée SELF pour cette date
    const existing = await this.prisma.$queryRawUnsafe(
      `SELECT id, "markedByRole", "markedBy", status, "checkIn"
       FROM "staff_attendances"
       WHERE "staffId" = $1 AND date = $2 AND "tenantId" = $3
       LIMIT 1`,
      data.staffId, date, tenantId,
    ) as any[];

    if (existing && existing.length > 0) {
      const ex = existing[0];
      // ⭐ Mutual exclusion : si déjà marqué SELF → le semainier ne peut PAS modifier
      if (ex.markedByRole === 'SELF') {
        throw new BadRequestException(
          `L'enseignant a déjà auto-pointé sa présence aujourd'hui ` +
          `à ${ex.checkIn ? new Date(ex.checkIn).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'heure inconnue'} ` +
          `(statut: ${ex.status}). Vous ne pouvez pas modifier un auto-pointage.`
        );
      }
      // Si marqué SEMINARIER ou ADMIN → update
    }

    // 2. Résoudre l'année académique
    const academicYearId = await this.resolveAcademicYear(tenantId);

    // 3. Récupérer le schoolLevelId du staff
    const staffInfo: any = await this.prisma.$queryRawUnsafe(
      `SELECT "schoolLevelId", "firstName", "lastName" FROM "staff" WHERE id = $1`,
      data.staffId,
    );
    const staffName = staffInfo?.[0]
      ? `${staffInfo[0].firstName} ${staffInfo[0].lastName}`
      : '—';
    const schoolLevelId = staffInfo?.[0]?.schoolLevelId || null;

    // 4. Si existant SEMINARIER ou ADMIN → update ; sinon → create
    if (existing && existing.length > 0) {
      const ex = existing[0];
      await this.prisma.$executeRawUnsafe(
        `UPDATE "staff_attendances"
         SET status = $1,
             "checkIn" = COALESCE($2, "checkIn"),
             "checkOut" = COALESCE($3, "checkOut"),
             "hoursWorked" = COALESCE($4, "hoursWorked"),
             notes = COALESCE($5, notes),
             "markedBy" = $6,
             "markedByRole" = 'SEMINARIER',
             "updatedAt" = NOW()
         WHERE id = $7`,
        data.status,
        data.checkIn ? new Date(data.checkIn) : null,
        data.checkOut ? new Date(data.checkOut) : null,
        data.hoursWorked || null,
        data.notes || null,
        semainierUserId,
        ex.id,
      );
      return {
        id: ex.id,
        staffId: data.staffId,
        staffName,
        date,
        status: data.status,
        markedByRole: 'SEMINARIER',
        updated: true,
      };
    }

    // 5. Create new
    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "staff_attendances"
         ("id", "tenantId", "academicYearId", "schoolLevelId", "staffId", "date",
          "checkIn", "checkOut", "status", "hoursWorked", notes,
          "markedBy", "markedByRole", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'SEMINARIER', NOW(), NOW())`,
      id, tenantId, academicYearId, schoolLevelId, data.staffId, date,
      data.checkIn ? new Date(data.checkIn) : new Date(),
      data.checkOut ? new Date(data.checkOut) : null,
      data.status, data.hoursWorked || null, data.notes || null,
      semainierUserId,
    );

    this.logger.log(
      `✅ Semainier check-in — ${staffName} (staffId=${data.staffId}) statut=${data.status} par userId=${semainierUserId}`
    );

    return {
      id,
      staffId: data.staffId,
      staffName,
      date,
      checkIn: data.checkIn ? new Date(data.checkIn) : new Date(),
      status: data.status,
      markedByRole: 'SEMINARIER',
    };
  }

  /**
   * ⭐ Self check-out : l'enseignant clique "Fin de journée" en partant.
   * Calcule hoursWorked = checkOut - checkIn.
   * Si pas de checkIn → refus.
   */
  async selfCheckOut(
    tenantId: string,
    userEmail: string,
    userId: string,
    data: { date: string | Date },
  ) {
    const staff = await this.resolveStaffByUserEmail(userEmail, tenantId);
    if (!staff) {
      throw new BadRequestException(`Aucun staff trouvé pour ${userEmail}`);
    }

    const date = data.date instanceof Date ? data.date : new Date(data.date);

    const existing = await this.prisma.$queryRawUnsafe(
      `SELECT id, "checkIn", "markedByRole", status
       FROM "staff_attendances"
       WHERE "staffId" = $1 AND date = $2 AND "tenantId" = $3
       LIMIT 1`,
      staff.id, date, tenantId,
    ) as any[];

    if (!existing || existing.length === 0) {
      throw new BadRequestException(
        `Vous n'avez pas pointé votre présence aujourd'hui. ` +
        `Faites d'abord un check-in avant de partir.`
      );
    }

    const ex = existing[0];
    if (!ex.checkIn) {
      throw new BadRequestException(
        `Aucun check-in trouvé pour aujourd'hui. Impossible de calculer les heures travaillées.`
      );
    }

    const checkOut = new Date();
    const checkIn = new Date(ex.checkIn);
    const hoursWorked = Number(((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)).toFixed(2));

    await this.prisma.$executeRawUnsafe(
      `UPDATE "staff_attendances"
       SET "checkOut" = $1,
           "hoursWorked" = $2,
           "checkOutMethod" = 'MANUAL',
           "updatedAt" = NOW()
       WHERE id = $3`,
      checkOut, hoursWorked, ex.id,
    );

    this.logger.log(
      `✅ Self check-out — ${staff.firstName} ${staff.lastName} ` +
      `heures travaillées=${hoursWorked}h`
    );

    return {
      id: ex.id,
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      date,
      checkIn,
      checkOut,
      hoursWorked,
      checkOutMethod: 'MANUAL',
      status: ex.status,
    };
  }

  /**
   * ⭐ Récupère la présence du jour pour l'utilisateur connecté.
   * Utilisé par le dashboard enseignant pour afficher "Vous êtes pointé à HH:MM".
   */
  async getMyAttendanceToday(tenantId: string, userEmail: string, date?: Date) {
    const staff = await this.resolveStaffByUserEmail(userEmail, tenantId);
    if (!staff) return null;

    const targetDate = date || new Date();
    const records = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "staff_attendances"
       WHERE "staffId" = $1 AND date = $2 AND "tenantId" = $3
       LIMIT 1`,
      staff.id, targetDate, tenantId,
    ) as any[];

    if (!records || records.length === 0) return null;
    return {
      ...records[0],
      staffName: `${staff.firstName} ${staff.lastName}`,
    };
  }

  /**
   * ⭐ Récupère la liste des présences staff pour une date donnée.
   * Utilisé par le semainier pour voir/marquer tous les enseignants du jour.
   */
  async getDailyStaffAttendances(tenantId: string, date: Date) {
    const records = await this.prisma.$queryRawUnsafe(
      `SELECT sa.*, s."firstName", s."lastName",
              COALESCE(s."tenantMatricule", s."globalMatricule", s."employeeNumber") AS matricule,
              s."roleType", sl.code AS "schoolLevelCode"
       FROM "staff_attendances" sa
       RIGHT JOIN "staff" s ON s.id = sa."staffId" AND sa.date = $2 AND sa."tenantId" = $1
       LEFT JOIN "school_levels" sl ON sl.id = s."schoolLevelId"
       WHERE s."tenantId" = $1 AND s.status = 'ACTIVE'
         AND (s."roleType" = 'TEACHER' OR s."roleType" LIKE '%TEACHER%')
       ORDER BY s."lastName" ASC, s."firstName" ASC`,
      tenantId, date,
    ) as any[];

    return records.map(r => ({
      id: r.id,
      staffId: r.staffId,
      staffName: `${r.firstName} ${r.lastName}`,
      matricule: r.matricule,
      roleType: r.roleType,
      schoolLevelCode: r.schoolLevelCode,
      date: r.date,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      status: r.status,
      hoursWorked: r.hoursWorked,
      markedByRole: r.markedByRole || 'NONE',
      geoVerified: r.geoVerified || false,
      geoDistance: r.geoDistance,
      notes: r.notes,
    }));
  }
}

