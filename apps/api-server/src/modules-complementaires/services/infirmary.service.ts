import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service pour le module Infirmerie - ACADEMIA HELM
 * Gère les visites, urgences, stocks de médicaments et dossiers de santé.
 */
@Injectable()
export class InfirmaryService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // VISITES ET PASSAGES
  // ============================================================================

  async findAllVisits(tenantId: string, academicYearId: string, filters: any = {}) {
    return this.prisma.infirmaryVisit.findMany({
      where: {
        tenantId,
        academicYearId,
        ...filters,
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, matricule: true }
        },
        recorder: {
          select: { id: true, firstName: true, lastName: true }
        },
        class: {
          select: { id: true, name: true, code: true }
        }
      },
      orderBy: { visitDate: 'desc' }
    });
  }

  async createVisit(tenantId: string, data: any) {
    return this.prisma.infirmaryVisit.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        studentId: data.studentId,
        classId: data.classId,
        recordedBy: data.recordedBy,
        visitDate: new Date(data.visitDate || new Date()),
        reason: data.reason,
        symptoms: data.symptoms,
        diagnosis: data.diagnosis,
        treatment: data.treatment,
        temperature: data.temperature,
        bloodPressure: data.bloodPressure,
        heartRate: data.heartRate,
        weight: data.weight,
        status: data.status || 'COMPLETED',
        notes: data.notes,
      }
    });
  }

  // ============================================================================
  // URGENCES ET INCIDENTS
  // ============================================================================

  async findAllEmergencies(tenantId: string, academicYearId: string) {
    return this.prisma.infirmaryEmergency.findMany({
      where: { tenantId, academicYearId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        recorder: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createEmergency(tenantId: string, data: any) {
    return this.prisma.infirmaryEmergency.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        studentId: data.studentId,
        recordedBy: data.recordedBy,
        emergencyType: data.emergencyType,
        description: data.description,
        location: data.location,
        severity: data.severity || 'HIGH',
        actionTaken: data.actionTaken,
        status: data.status || 'ACTIVE',
        isHospitalized: data.isHospitalized || false,
        hospitalName: data.hospitalName,
        parentsNotified: data.parentsNotified || false,
      }
    });
  }

  // ============================================================================
  // PHARMACIE ET STOCKS
  // ============================================================================

  async getMedicationStock(tenantId: string) {
    return this.prisma.infirmaryMedicationStock.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' }
    });
  }

  async updateStock(tenantId: string, medicationId: string, data: any, recordedBy: string) {
    const stock = await this.prisma.infirmaryMedicationStock.findUnique({
      where: { id: medicationId }
    });

    if (!stock) throw new NotFoundException('Médicament non trouvé');

    const newQuantity = data.type === 'IN' 
      ? stock.currentQuantity + data.quantity 
      : stock.currentQuantity - data.quantity;

    return this.prisma.$transaction([
      this.prisma.infirmaryMedicationStock.update({
        where: { id: medicationId },
        data: { currentQuantity: newQuantity }
      }),
      this.prisma.infirmaryMedicationMovement.create({
        data: {
          tenantId,
          medicationId,
          recordedBy,
          type: data.type, // IN | OUT
          quantity: data.quantity,
          previousQuantity: stock.currentQuantity,
          newQuantity,
          reason: data.reason,
        }
      })
    ]);
  }

  // ============================================================================
  // VIGILANCE (ALLERGIES & CONTRE-INDICATIONS)
  // ============================================================================

  async getVigilanceData(tenantId: string, studentId?: string) {
    const where: any = { tenantId };
    if (studentId) where.studentId = studentId;

    const [allergies, contraindications] = await Promise.all([
      this.prisma.infirmaryAllergy.findMany({
        where,
        include: { student: { select: { firstName: true, lastName: true } } }
      }),
      this.prisma.infirmaryContraindication.findMany({
        where,
        include: { student: { select: { firstName: true, lastName: true } } }
      })
    ]);

    return { allergies, contraindications };
  }

  // ============================================================================
  // DOSSIERS MÉDICAUX (MEDICAL RECORDS)
  // ============================================================================

  async findMedicalRecord(tenantId: string, studentId: string) {
    return this.prisma.infirmaryMedicalRecord.findFirst({
      where: { tenantId, studentId },
      include: { 
        student: { select: { firstName: true, lastName: true, matricule: true } }
      }
    });
  }

  async updateMedicalRecord(tenantId: string, studentId: string, data: any) {
    return this.prisma.infirmaryMedicalRecord.upsert({
      where: { studentId },
      update: {
        ...data,
        lastUpdatedAt: new Date(),
      },
      create: {
        tenantId,
        studentId,
        ...data,
        status: data.status || 'INCOMPLETE'
      }
    });
  }

  // ============================================================================
  // VISITES MÉDICALES SCOLAIRES (SCREENINGS)
  // ============================================================================

  async findAllCheckups(tenantId: string, academicYearId: string) {
    return this.prisma.infirmaryCheckup.findMany({
      where: { tenantId, academicYearId },
      include: { creator: { select: { firstName: true, lastName: true } } },
      orderBy: { checkupDate: 'desc' }
    });
  }

  async createCheckup(tenantId: string, academicYearId: string, data: any, createdBy: string) {
    return this.prisma.infirmaryCheckup.create({
      data: {
        tenantId,
        academicYearId,
        createdBy,
        checkupDate: new Date(data.checkupDate),
        checkupType: data.checkupType,
        targetClassIds: data.targetClassIds || [],
        targetStudentIds: data.targetStudentIds || [],
        healthProvider: data.healthProvider,
        location: data.location,
        purpose: data.purpose,
        status: 'PLANNED'
      }
    });
  }

  // ============================================================================
  // AUTORISATIONS PARENTALES
  // ============================================================================

  async findAllAuthorizations(tenantId: string, studentId?: string) {
    const where: any = { tenantId };
    if (studentId) where.studentId = studentId;

    return this.prisma.infirmaryAuthorization.findMany({
      where,
      include: {
        student: { select: { firstName: true, lastName: true } },
        parent: { select: { firstName: true, lastName: true } },
        validator: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createAuthorization(tenantId: string, data: any) {
    return this.prisma.infirmaryAuthorization.create({
      data: {
        tenantId,
        studentId: data.studentId,
        parentId: data.parentId,
        authorizationType: data.authorizationType,
        validFrom: new Date(data.validFrom),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        status: 'PENDING'
      }
    });
  }

  async validateAuthorization(id: string, validatedBy: string, status: string, observation?: string) {
    return this.prisma.infirmaryAuthorization.update({
      where: { id },
      data: {
        status,
        validatedBy,
        validatedAt: new Date(),
        observation
      }
    });
  }

  // ============================================================================
  // RAPPORTS ET ACCÈS
  // ============================================================================

  async findAllReports(tenantId: string, academicYearId: string) {
    return this.prisma.infirmaryReport.findMany({
      where: { tenantId, academicYearId },
      include: { generator: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async logAccess(tenantId: string, userId: string, studentId: string, accessType: string, reason?: string) {
    return this.prisma.infirmaryAccessLog.create({
      data: {
        tenantId,
        userId,
        studentId,
        accessType,
        reason
      }
    });
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  async getSettings(tenantId: string) {
    return this.prisma.infirmarySetting.findMany({
      where: { tenantId }
    });
  }

  async updateSetting(tenantId: string, key: string, value: any) {
    return this.prisma.infirmarySetting.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: { value },
      create: { tenantId, key, value }
    });
  }

  // ============================================================================
  // STATISTIQUES (ORION ENGINE COMPLIANT)
  // ============================================================================

  async getInfirmaryStats(tenantId: string, academicYearId: string) {
    const [visitsCount, emergenciesCount, lowStockCount] = await Promise.all([
      this.prisma.infirmaryVisit.count({ where: { tenantId, academicYearId } }),
      this.prisma.infirmaryEmergency.count({ where: { tenantId, academicYearId, status: 'OPEN' } }),
      this.prisma.infirmaryMedicationStock.count({ 
        where: { 
          tenantId, 
          quantity: { lte: 5 } // Default threshold
        } 
      })
    ]);

    return {
      totalVisits: visitsCount,
      activeEmergencies: emergenciesCount,
      lowStockArticles: lowStockCount,
      lastUpdate: new Date()
    };
  }
}
