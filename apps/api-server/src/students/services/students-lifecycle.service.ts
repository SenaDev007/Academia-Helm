/**
 * Module 1 — Cycle de vie élève : pré-inscription, admission, réinscription, transfert, changement de classe.
 * Matricule : <CODE_TENANT>-<ANNEE>-<AUTO_INCREMENT>
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const ENROLLMENT_STATUS = {
  PRE_REGISTERED: 'PRE_REGISTERED',
  ADMITTED: 'ADMITTED',
  RE_ENROLLED: 'RE_ENROLLED',
  TRANSFERRED: 'TRANSFERRED',
  WITHDRAWN: 'WITHDRAWN',
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
  VALIDATED: 'VALIDATED',
} as const;

@Injectable()
export class StudentsLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  private async getTenantCode(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return (tenant.slug || 'AH').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'AH';
  }

  private async getYearFromAcademicYear(academicYearId: string): Promise<string> {
    const ay = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { name: true, startDate: true },
    });
    if (!ay) throw new NotFoundException('Academic year not found');
    const match = ay.name?.match(/\d{4}/);
    return match ? match[0] : String(new Date(ay.startDate).getFullYear());
  }

  /** Génère un matricule unique : CODE_TENANT-ANNEE-SEQ (ex. AH-2025-000124) */
  async generateMatricule(tenantId: string, academicYearId: string): Promise<string> {
    const code = await this.getTenantCode(tenantId);
    const year = await this.getYearFromAcademicYear(academicYearId);
    const prefix = `${code}-${year}-`;
    const last = await this.prisma.student.findFirst({
      where: {
        tenantId,
        studentCode: { startsWith: prefix },
      },
      orderBy: { studentCode: 'desc' },
      select: { studentCode: true },
    });
    const next = last
      ? parseInt(last.studentCode.slice(prefix.length), 10) + 1
      : 1;
    return `${prefix}${String(next).padStart(6, '0')}`;
  }

  /** Pré-inscription : dossier incomplet autorisé, statut PRE_REGISTERED */
  async preRegister(tenantId: string, data: {
    academicYearId: string;
    schoolLevelId: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: Date;
    gender?: string;
    nationality?: string;
    placeOfBirth?: string;
    legalDocumentType?: string;
    legalDocumentNumber?: string;
    regimeType?: string;
    classId?: string;
  }) {
    const enrollmentDate = new Date();
    const student = await this.prisma.student.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        currentAcademicYearId: data.academicYearId,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        nationality: data.nationality,
        placeOfBirth: data.placeOfBirth,
        legalDocumentType: data.legalDocumentType,
        legalDocumentNumber: data.legalDocumentNumber,
        regimeType: data.regimeType,
        status: 'ACTIVE',
        isActive: true,
      },
    });
    await this.prisma.studentEnrollment.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        studentId: student.id,
        classId: data.classId ?? null,
        enrollmentType: 'NEW',
        enrollmentDate,
        status: ENROLLMENT_STATUS.PRE_REGISTERED,
        previousArrears: 0,
      },
    });
    return this.prisma.student.findUnique({
      where: { id: student.id },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true } },
        schoolLevel: true,
      },
    });
  }

  /** Admission : documents validés, classe assignée, matricule généré */
  async admit(tenantId: string, data: {
    studentId: string;
    academicYearId: string;
    schoolLevelId: string;
    classId: string;
    validateDocuments?: boolean;
  }) {
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, tenantId },
      include: { studentEnrollments: true },
    });
    if (!student) throw new NotFoundException('Élève non trouvé');
    const enrollment = student.studentEnrollments.find(
      (e) => e.academicYearId === data.academicYearId && e.status === ENROLLMENT_STATUS.PRE_REGISTERED,
    );
    if (!enrollment) throw new BadRequestException('Aucune pré-inscription trouvée pour cette année');
    const matricule = await this.generateMatricule(tenantId, data.academicYearId);
    await this.prisma.student.update({
      where: { id: data.studentId },
      data: { studentCode: matricule, currentAcademicYearId: data.academicYearId },
    });
    await this.prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        classId: data.classId,
        status: ENROLLMENT_STATUS.ADMITTED,
      },
    });
    return this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true } },
        schoolLevel: true,
      },
    });
  }

  /** Réinscription : nouvel enrollment, historique conservé, vérification arriérés */
  async reEnroll(tenantId: string, data: {
    studentId: string;
    academicYearId: string;
    schoolLevelId: string;
    classId: string;
    previousArrears?: number;
  }) {
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, tenantId },
    });
    if (!student) throw new NotFoundException('Élève non trouvé');
    const arrears = data.previousArrears ?? 0;
    await this.prisma.studentEnrollment.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        studentId: data.studentId,
        classId: data.classId,
        enrollmentType: 'REPEAT',
        enrollmentDate: new Date(),
        status: ENROLLMENT_STATUS.RE_ENROLLED,
        previousArrears: arrears,
      },
    });
    await this.prisma.student.update({
      where: { id: data.studentId },
      data: { currentAcademicYearId: data.academicYearId },
    });
    return this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true }, orderBy: { enrollmentDate: 'desc' } },
        schoolLevel: true,
      },
    });
  }

  /** Changement de classe (même année) — vérifié par trigger si notes existent */
  async changeClass(tenantId: string, data: {
    studentId: string;
    academicYearId: string;
    newClassId: string;
  }) {
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        studentId: data.studentId,
        tenantId,
        academicYearId: data.academicYearId,
      },
      orderBy: { enrollmentDate: 'desc' },
    });
    if (!enrollment) throw new NotFoundException('Inscription non trouvée');
    await this.prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: { classId: data.newClassId },
    });
    return this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true }, orderBy: { enrollmentDate: 'desc' } },
        schoolLevel: true,
      },
    });
  }

  /** Transfert : statut TRANSFERRED, export PDF côté appelant */
  async transfer(tenantId: string, data: {
    studentId: string;
    academicYearId: string;
    exitReason?: string;
  }) {
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        studentId: data.studentId,
        tenantId,
        academicYearId: data.academicYearId,
      },
      orderBy: { enrollmentDate: 'desc' },
    });
    if (!enrollment) throw new NotFoundException('Inscription non trouvée');
    await this.prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: ENROLLMENT_STATUS.TRANSFERRED,
        exitDate: new Date(),
        exitReason: data.exitReason ?? 'Transfert',
      },
    });
    await this.prisma.student.update({
      where: { id: data.studentId },
      data: { status: 'TRANSFERRED' },
    });
    return this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true }, orderBy: { enrollmentDate: 'desc' } },
      },
    });
  }

  /** Liste des élèves d'une classe */
  async getStudentsByClass(tenantId: string, classId: string, academicYearId?: string) {
    const where: any = {
      tenantId,
      studentEnrollments: {
        some: {
          classId,
          ...(academicYearId && { academicYearId }),
        },
      },
    };
    return this.prisma.student.findMany({
      where,
      include: {
        schoolLevel: true,
        studentEnrollments: {
          where: { classId },
          include: { class: true, academicYear: true },
        },
        studentGuardians: { where: { isPrimary: true }, include: { guardian: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  /** Historique unifié : admissions, réinscriptions, transferts */
  async getStudentHistory(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
    });
    if (!student) throw new NotFoundException('Élève non trouvé');
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { studentId, tenantId },
      include: { class: true, academicYear: true, schoolLevel: true },
      orderBy: { enrollmentDate: 'desc' },
    });
    const transfers = await this.prisma.transferRequest.findMany({
      where: { studentId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
    const classIds = [...new Set(transfers.flatMap((t) => [t.fromClassId, t.toClassId]))];
    const classes = classIds.length
      ? await this.prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } })
      : [];
    const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]));
    return {
      student: { id: student.id, firstName: student.firstName, lastName: student.lastName, studentCode: student.studentCode },
      enrollments: enrollments.map((e) => ({
        id: e.id,
        academicYearId: e.academicYearId,
        academicYearName: (e as any).academicYear?.name,
        classId: e.classId,
        className: (e as any).class?.name,
        status: e.status,
        enrollmentType: e.enrollmentType,
        enrollmentDate: e.enrollmentDate,
        exitDate: e.exitDate,
        exitReason: e.exitReason,
        previousArrears: e.previousArrears,
      })),
      transfers: transfers.map((t) => ({
        id: t.id,
        status: t.status,
        fromClassId: t.fromClassId,
        toClassId: t.toClassId,
        fromClassName: classMap[t.fromClassId],
        toClassName: classMap[t.toClassId],
        createdAt: t.createdAt,
      })),
    };
  }

  /** Export EDUCMASTER — JSON conforme, log obligatoire */
  async exportEducmaster(tenantId: string, studentId: string): Promise<{ data: any; logId: string }> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true } },
        studentGuardians: { include: { guardian: true } },
        schoolLevel: true,
      },
    });
    if (!student) throw new NotFoundException('Élève non trouvé');
    const payload = {
      exportType: 'EDUCMASTER',
      exportedAt: new Date().toISOString(),
      tenantId,
      student: {
        id: student.id,
        studentCode: student.studentCode,
        firstName: student.firstName,
        lastName: student.lastName,
        dateOfBirth: student.dateOfBirth,
        gender: student.gender,
        nationality: student.nationality,
        placeOfBirth: student.placeOfBirth,
        legalDocumentType: student.legalDocumentType,
        legalDocumentNumber: student.legalDocumentNumber,
        regimeType: student.regimeType,
        status: student.status,
      },
      enrollments: (student.studentEnrollments || []).map((e) => ({
        academicYearId: e.academicYearId,
        classId: e.classId,
        className: (e as any).class?.name,
        status: e.status,
        enrollmentType: e.enrollmentType,
        previousArrears: e.previousArrears,
      })),
      guardians: (student.studentGuardians || []).map((sg) => ({
        relationship: sg.relationship,
        isPrimary: sg.isPrimary,
        ...(sg as any).guardian,
      })),
    };
    const log = await this.prisma.nationalExportLog.create({
      data: {
        tenantId,
        studentId,
        exportType: 'EDUCMASTER',
        status: 'SUCCESS',
        metadata: { exportedAt: payload.exportedAt },
      },
    });
    return { data: payload, logId: log.id };
  }
}
