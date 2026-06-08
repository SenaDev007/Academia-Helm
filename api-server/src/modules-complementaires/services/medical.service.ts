import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service pour le sous-module 9.5 - Infirmerie
 */
@Injectable()
export class MedicalService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrUpdateRecord(tenantId: string, academicYearId: string, studentId: string, data: any) {
    const existing = await this.prisma.medicalRecord.findFirst({
      where: { tenantId, academicYearId, studentId },
    });

    if (existing) {
      return this.prisma.medicalRecord.update({
        where: { id: existing.id },
        data: {
          bloodType: data.bloodType,
          allergies: data.allergies || [],
          chronicConditions: data.chronicConditions || [],
          medications: data.medications || [],
          emergencyContact: data.emergencyContact,
          emergencyPhone: data.emergencyPhone,
          notes: data.notes,
        },
      });
    }

    return this.prisma.medicalRecord.create({
      data: {
        tenantId,
        academicYearId,
        studentId,
        bloodType: data.bloodType,
        allergies: data.allergies || [],
        chronicConditions: data.chronicConditions || [],
        medications: data.medications || [],
        emergencyContact: data.emergencyContact,
        emergencyPhone: data.emergencyPhone,
        notes: data.notes,
      },
    });
  }

  async recordVisit(recordId: string, tenantId: string, data: any, performedBy: string) {
    const record = await this.prisma.medicalRecord.findFirst({
      where: { id: recordId, tenantId },
    });
    if (!record) throw new NotFoundException(`Medical record with ID ${recordId} not found`);

    // Récupérer l'année scolaire active
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { tenantId: record.tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    if (!academicYear) throw new NotFoundException('No active academic year found');

    return this.prisma.medicalVisit.create({
      data: {
        recordId,
        academicYearId: academicYear.id,
        visitDate: new Date(data.visitDate),
        visitTime: data.visitTime,
        reason: data.reason,
        diagnosis: data.diagnosis,
        treatment: data.treatment,
        medicationId: data.medicationId,
        temperature: data.temperature,
        bloodPressure: data.bloodPressure,
        notes: data.notes,
        performedBy: performedBy || undefined,
      },
    });
  }

  async createAlert(recordId: string, tenantId: string, data: any) {
    const record = await this.prisma.medicalRecord.findFirst({
      where: { id: recordId, tenantId },
    });
    if (!record) throw new NotFoundException(`Medical record with ID ${recordId} not found`);

    return this.prisma.medicalAlert.create({
      data: {
        recordId,
        alertType: data.alertType,
        severity: data.severity || 'MEDIUM',
        title: data.title,
        description: data.description,
        isActive: true,
        acknowledged: false,
      },
    });
  }

  async getCriticalAlerts(tenantId: string, academicYearId: string) {
    return this.prisma.medicalAlert.findMany({
      where: {
        record: {
          tenantId,
          academicYearId,
        },
        severity: { in: ['HIGH', 'CRITICAL'] },
        isActive: true,
        acknowledged: false,
      },
      include: {
        record: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllRecords(tenantId: string, academicYearId: string, filters?: any) {
    const where: any = { tenantId, academicYearId };
    if (filters?.studentId) where.studentId = filters.studentId;

    return this.prisma.medicalRecord.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        visits: { orderBy: { visitDate: 'desc' }, take: 10 },
        alerts: { where: { isActive: true }, orderBy: { severity: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findAllVisits(recordId: string, tenantId: string) {
    const record = await this.prisma.medicalRecord.findFirst({
      where: { id: recordId, tenantId },
    });
    if (!record) throw new NotFoundException(`Medical record with ID ${recordId} not found`);

    return this.prisma.medicalVisit.findMany({
      where: { recordId },
      include: {
        medication: true,
        performer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { visitDate: 'desc' },
    });
  }

  async getMedicalStats(tenantId: string, academicYearId: string) {
    const records = await this.prisma.medicalRecord.findMany({
      where: { tenantId, academicYearId },
      include: {
        visits: {
          where: {
            visitDate: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            },
          },
        },
        alerts: { where: { isActive: true } },
      },
    });

    const totalVisits = records.reduce((sum, r) => sum + r.visits.length, 0);
    const criticalAlerts = records.reduce(
      (sum, r) => sum + r.alerts.filter((a) => a.severity === 'CRITICAL').length,
      0,
    );

    return {
      totalRecords: records.length,
      totalVisits,
      criticalAlerts,
      studentsWithAllergies: records.filter((r) => r.allergies.length > 0).length,
    };
  }
}

