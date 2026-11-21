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
// ⭐ 2026-11-21 — Notifications in-app (cloche) : heures supp. déclarées → RH,
// décision de validation → personnel. NotificationModule est @Global.
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class AttendancePrismaService {
  private readonly logger = new Logger(AttendancePrismaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationService: RecruitmentNotificationService,
    private readonly geolocationService: GeolocationService,
    // ⭐ In-app notifications (cloche) — RH self-service
    private readonly inAppNotifications: NotificationService,
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
   *
   * ⭐ 2026-09-15 — INTÉGRATION CAHIER DE SEMAINE ↔ RH :
   *    Réécrit en SQL brut pour inclure les colonnes d'audit (markedByRole,
   *    checkIn, checkOut, geoVerified) qui existent en base mais PAS dans le
   *    modèle Prisma StaffAttendance. Le module RH (onglet Présences) peut
   *    ainsi afficher la PROVENANCE de chaque pointage :
   *      SELF      = auto-pointage enseignant (GPS)
   *      SEMINARIER= marqué depuis le cahier de semaine (semainier)
   *      ADMIN     = enregistré par la direction/RH
   */
  async findStaffAttendances(staffId: string, tenantId: string, filters?: {
    academicYearId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
  }) {
    const where: string[] = ['sa."staffId" = $1', 'sa."tenantId" = $2'];
    const params: any[] = [staffId, tenantId];
    let idx = 3;

    if (filters?.academicYearId) {
      where.push(`sa."academicYearId" = $${idx++}`);
      params.push(filters.academicYearId);
    }
    if (filters?.startDate) {
      where.push(`sa.date >= $${idx++}::date`);
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      where.push(`sa.date <= $${idx++}::date`);
      params.push(filters.endDate);
    }
    if (filters?.status) {
      where.push(`sa.status = $${idx++}`);
      params.push(filters.status);
    }

    return this.prisma.$queryRawUnsafe(
      `SELECT sa."id", sa."tenantId", sa."academicYearId", sa."schoolLevelId",
              sa."staffId", sa.date, sa."checkIn", sa."checkOut", sa.status,
              sa."hoursWorked", sa.notes, sa."markedBy", sa."markedByRole",
              sa."geoVerified", sa."geoDistance", sa."checkOutMethod",
              sa."createdAt", sa."updatedAt"
       FROM "staff_attendances" sa
       WHERE ${where.join(' AND ')}
       ORDER BY sa.date DESC`,
      ...params,
    );
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
            roleType: true,
          },
        },
      },
    });

    // ─── Envoi de l'email de notification au personnel ──
    this.sendOvertimeDecisionEmail(updated, tenantId, action).catch((err) => {
      this.logger.error(`Failed to send overtime decision email: ${err.message}`);
    });

    // ─── ⭐ 2026-11-21 — Notification IN-APP (cloche) au personnel —
    //    validation/rejet de SES heures supplémentaires (en plus de l'email).
    this.notifyStaffOvertimeDecisionInApp(updated, tenantId, action).catch((err) => {
      this.logger.error(`notifyStaffOvertimeDecisionInApp failed (non-blocking): ${err.message}`);
    });

    return updated;
  }

  /**
   * ⭐ 2026-11-21 — Notification in-app (cloche) au personnel concerné quand
   * le RH valide ou refuse ses heures supplémentaires. Fire-and-forget.
   */
  private async notifyStaffOvertimeDecisionInApp(
    overtime: any,
    tenantId: string,
    action: 'VALIDATE' | 'REJECT',
  ): Promise<void> {
    const staff = overtime?.staff;
    if (!staff?.email) {
      this.logger.warn(`notifyStaffOvertimeDecisionInApp: pas d'email staff — ignoré`);
      return;
    }
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          tenantId,
          status: 'active',
          email: { equals: staff.email, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (!user) {
        this.logger.warn(
          `notifyStaffOvertimeDecisionInApp: aucun User actif pour ${staff.email} — ignoré`,
        );
        return;
      }

      // ⭐ URL self-service du personnel (enseignant → /app/teacher/presence,
      // autre personnel → /app/my-presence)
      const url = staff.roleType === 'TEACHER' ? '/app/teacher/presence' : '/app/my-presence';

      const hours = Number(overtime.hours);
      const fmt = new Date(overtime.date).toLocaleDateString('fr-FR');
      await this.inAppNotifications.create({
        tenantId,
        recipientId: user.id,
        type: action === 'VALIDATE' ? 'OVERTIME_VALIDATED' : 'OVERTIME_REJECTED',
        title: action === 'VALIDATE' ? 'Heures supplémentaires validées' : 'Heures supplémentaires refusées',
        body:
          action === 'VALIDATE'
            ? `Vos ${hours} h du ${fmt} ont été validées par la direction — elles seront prises en compte dans la paie.`
            : `Vos ${hours} h du ${fmt} ont été refusées par la direction.`,
        priority: 'LOW',
        data: { url },
        relatedEntityType: 'OvertimeRecord',
        relatedEntityId: overtime.id,
      });
    } catch (err: any) {
      this.logger.error(`notifyStaffOvertimeDecisionInApp failed: ${err.message}`, err.stack);
    }
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
   *
   * ⭐ 2026-09-15 — INTÉGRATION CAHIER DE SEMAINE ↔ RH :
   *    On réintègre le LEFT JOIN avec "staff_attendances" (via le staff
   *    rapproché par email) afin de renvoyer le STATUT RÉEL de présence :
   *    - Les enseignants auto-pointés (markedByRole='SELF') apparaissent avec
   *      leur statut + badge AUTO-POINTÉ + cadenas côté SemainierAttendancePanel ;
   *    - Les enseignants marqués par le semainier (sync du cahier de semaine
   *      vers staff_attendances) apparaissent avec leur statut SEMINARIER ;
   *    - Les enseignants non marqués gardent status=null / markedByRole='NONE'.
   */
  async getDailyStaffAttendances(tenantId: string, date: Date) {
    // ⭐ Récupérer TOUS les enseignants actifs depuis la table `teachers`
    //    (pas depuis `staff` qui n'a que 3 enregistrements TEACHER).
    //    La table `teachers` est la source de vérité pour les enseignants.
    //    On inclut les enseignants FR + EN (maternelle + primaire).
    //    On ne JOIN pas avec staff_attendances car il n'y a pas de lien direct
    //    entre teachers et staff (pas de colonne linkedStaffId).
    //    Le statut de présence sera géré par le JSON du rapport quotidien du semainier.
    //
    // ⭐ VÉRIFICATION STAFF ↔ TEACHERS (demande utilisateur) :
    //    À chaque fois, on vérifie la table `staff` pour identifier les staff
    //    avec un roleType != 'TEACHER' (DIRECTEUR, CENSEUR, etc.).
    //    Pour ces staff non-enseignant, on vérifie dans la table `teachers`
    //    s'ils ont été "attribués au rôle d'enseignant" (i.e., s'ils ont un
    //    enregistrement dans `teachers`). Si oui, ils sont inclus dans la liste
    //    des enseignants pour le pointage du semainier (par exemple, un directeur
    //    qui enseigne aussi une classe).
    //
    //    La stratégie :
    //      1. Sélectionner TOUS les teachers actifs (MATERNELLE+PRIMAIRE)
    //         → c'est la source canonique, ils sont tous enseignants.
    //      2. LEFT JOIN staff (par email) pour récupérer le `roleType` du staff
    //         → permet d'identifier les enseignants qui ont aussi un rôle
    //           administratif (DIRECTEUR, CENSEUR, etc.).
    //      3. Le résultat inclut :
    //         - Tous les teachers "purs" (roleType='TEACHER' ou pas de staff lié)
    //         - Les teachers qui ont aussi un rôle non-enseignant (DIRECTEUR qui enseigne)
    //    La logique de filtrage par roleType est gérée par le frontend si besoin.
    const records = await this.prisma.$queryRawUnsafe(
      `SELECT t.id AS "teacherId", t."firstName", t."lastName",
              t."matricule" AS "teacherMatricule",
              t."assignedLanguages",
              sl.code AS "schoolLevelCode", sl.name AS "schoolLevelName",
              s."roleType" AS "staffRoleType",
              s."employeeNumber" AS "staffEmployeeNumber",
              sa.id AS "attendanceId", sa.status AS "attendanceStatus",
              sa."checkIn", sa."checkOut", sa."markedByRole",
              sa."hoursWorked", sa.notes AS "attendanceNotes",
              sa."geoVerified", sa."geoDistance"
       FROM "teachers" t
       LEFT JOIN "school_levels" sl ON sl.id = t."schoolLevelId"
       LEFT JOIN "staff" s ON s."email" = t."email" AND s."tenantId" = t."tenantId"
       LEFT JOIN "staff_attendances" sa
              ON sa."staffId" = s."id" AND sa."tenantId" = t."tenantId" AND sa.date = $2::date
       WHERE t."tenantId" = $1
         AND t.status = 'active'
         AND sl.code IN ('MATERNELLE', 'PRIMAIRE')
       ORDER BY t."lastName" ASC, t."firstName" ASC`,
      tenantId, date,
    ) as any[];

    // ⭐ LOG de vérification : identifier les staff non-enseignant qui sont
    //    aussi dans la table teachers (par exemple, un directeur qui enseigne)
    const nonTeacherStaffInTeachers = records.filter(
      (r: any) => r.staffRoleType && r.staffRoleType !== 'TEACHER'
    );
    if (nonTeacherStaffInTeachers.length > 0) {
      this.logger.log(
        `📋 getDailyStaffAttendances — ${nonTeacherStaffInTeachers.length} staff non-TEACHER ` +
        `trouvé(s) dans la table teachers (rôle administratif + enseignant) : ` +
        nonTeacherStaffInTeachers.slice(0, 5).map((r: any) =>
          `${r.firstName} ${r.lastName} (${r.staffRoleType})`
        ).join(', ') + (nonTeacherStaffInTeachers.length > 5 ? '...' : ''),
      );
    }

    return records.map((r: any) => ({
      id: r.attendanceId || null,
      staffId: r.teacherId,
      teacherId: r.teacherId,
      linkedStaffId: r.attendanceId ? null : null, // staff résolu par email (JOIN SQL)
      staffName: `${r.firstName} ${r.lastName}`,
      matricule: r.teacherMatricule,
      // ⭐ roleType : 'TEACHER' par défaut, mais si le staff a un rôle différent
      //    (DIRECTEUR, CENSEUR), on l'indique pour info — le semainier peut
      //    ainsi savoir qu'il s'agit d'un staff avec un double rôle.
      roleType: r.staffRoleType || 'TEACHER',
      staffRoleType: r.staffRoleType || null,  // rôle admin (DIRECTEUR, CENSEUR) si applicable
      schoolLevelCode: r.schoolLevelCode,
      schoolLevelName: r.schoolLevelName,
      assignedLanguages: r.assignedLanguages,
      date: date.toISOString().split('T')[0],
      // ⭐ Statut RÉEL depuis staff_attendances (RH) — null si non marqué
      checkIn: r.checkIn || null,
      checkOut: r.checkOut || null,
      status: r.attendanceStatus || null,
      hoursWorked: r.hoursWorked ?? null,
      markedByRole: r.markedByRole || 'NONE',
      geoVerified: r.geoVerified || false,
      geoDistance: r.geoDistance ?? null,
      notes: r.attendanceNotes || null,
    }));
  }

  // ============================================================================
  // ⭐ 2026-09-15 — MODULE PRÉSENCE ENSEIGNANT (self-service)
  //
  // Endpoints dédiés au portail enseignant (/app/teacher/presence) :
  //   - GET  my-history : historique de SES présences (30-60 derniers jours)
  //   - GET  my-overtime : SES heures supplémentaires (validées + en attente)
  //   - POST my-overtime : déclarer SES heures supplémentaires (validation RH)
  //
  // Le Staff est résolu par l'email de l'utilisateur connecté — jamais par un
  // staffId fourni par le client (anti-usurpation d'identité).
  // ============================================================================

  /**
   * ⭐ Historique des présences de l'utilisateur connecté (résolu par email).
   * Utilisé par le module présence enseignant — jamais pour un autre staff.
   */
  async getMyAttendanceHistory(
    tenantId: string,
    userEmail: string,
    filters?: { academicYearId?: string; startDate?: Date; endDate?: Date; limit?: number },
  ) {
    const staff = await this.resolveStaffByUserEmail(userEmail, tenantId);
    if (!staff) {
      return { staff: null, attendances: [], message: 'Aucune fiche personnel active trouvée pour votre compte — contactez la direction pour être rattaché(e) au module RH.' };
    }

    const where: string[] = ['sa."staffId" = $1', 'sa."tenantId" = $2'];
    const params: any[] = [staff.id, tenantId];
    let idx = 3;
    if (filters?.academicYearId) {
      where.push(`sa."academicYearId" = $${idx++}`);
      params.push(filters.academicYearId);
    }
    if (filters?.startDate) {
      where.push(`sa.date >= $${idx++}::date`);
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      where.push(`sa.date <= $${idx++}::date`);
      params.push(filters.endDate);
    }
    // LIMIT borné côté serveur (1..180) — entier sanitisé, pas d'injection possible
    const limit = filters?.limit && filters.limit > 0 && filters.limit <= 180 ? Math.floor(filters.limit) : 60;

    const attendances = await this.prisma.$queryRawUnsafe(
      `SELECT sa."id", sa.date, sa."checkIn", sa."checkOut", sa.status,
              sa."hoursWorked", sa.notes, sa."markedByRole", sa."geoVerified", sa."geoDistance"
       FROM "staff_attendances" sa
       WHERE ${where.join(' AND ')}
       ORDER BY sa.date DESC
       LIMIT ${limit}`,
      ...params,
    );

    return {
      staff: { id: staff.id, staffName: `${staff.firstName} ${staff.lastName}`, roleType: staff.roleType },
      attendances,
    };
  }

  /**
   * ⭐ Heures supplémentaires de l'utilisateur connecté (résolu par email).
   */
  async getMyOvertime(
    tenantId: string,
    userEmail: string,
    filters?: { academicYearId?: string; validated?: boolean },
  ) {
    const staff = await this.resolveStaffByUserEmail(userEmail, tenantId);
    if (!staff) {
      return { staff: null, overtimes: [], message: 'Aucune fiche personnel active trouvée pour votre compte.' };
    }
    const overtimes = await this.findStaffOvertime(staff.id, tenantId, {
      academicYearId: filters?.academicYearId,
      validated: filters?.validated,
    });
    return {
      staff: { id: staff.id, staffName: `${staff.firstName} ${staff.lastName}` },
      overtimes,
    };
  }

  /**
   * ⭐ L'utilisateur connecté déclare SES heures supplémentaires.
   * Le staffId est résolu côté serveur (par email) — impossible de déclarer
   * pour quelqu'un d'autre. La validation reste du côté direction/RH
   * (PUT /hr/attendance/overtime/:id/process dans l'onglet Présences du RH).
   */
  async declareMyOvertime(
    tenantId: string,
    userEmail: string,
    data: { date: string | Date; hours: number; reason?: string; academicYearId?: string },
  ) {
    const staff = await this.resolveStaffByUserEmail(userEmail, tenantId);
    if (!staff) {
      throw new BadRequestException(
        `Aucune fiche personnel active trouvée pour l'email ${userEmail}. ` +
        `Contactez la direction pour être rattaché(e) au module RH.`
      );
    }
    if (!data.hours || data.hours <= 0) {
      throw new BadRequestException('Le nombre d\'heures doit être supérieur à 0.');
    }
    const created = await this.recordOvertime({
      tenantId,
      academicYearId: data.academicYearId,
      schoolLevelId: staff.schoolLevelId || undefined,
      staffId: staff.id,
      date: data.date,
      hours: data.hours,
      reason: data.reason,
    });

    // ─── ⭐ 2026-11-21 — Notification in-app aux gestionnaires RH —
    //    le personnel a déclaré des heures supp. depuis SON interface ;
    //    le RH est alerté (cloche) qu'une validation est en attente.
    this.inAppNotifications
      .notifyHrOvertimeSubmitted({
        tenantId,
        overtimeId: created.id,
        staff: { firstName: staff.firstName, lastName: staff.lastName },
        date: created.date,
        hours: Number(created.hours),
        reason: created.notes ?? data.reason ?? null,
      })
      .catch((err) =>
        this.logger.error(`notifyHrOvertimeSubmitted failed (non-blocking): ${err.message}`),
      );

    return created;
  }
}

