import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service pour le sous-module 9.4 - Laboratoires
 */
@Injectable()
export class LabService {
  constructor(private readonly prisma: PrismaService) {}

  async createLab(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.lab.create({
      data: {
        tenantId,
        academicYearId,
        name: data.name,
        description: data.description,
        location: data.location,
        capacity: data.capacity,
        isActive: data.isActive !== false,
      },
    });
  }

  async addEquipment(labId: string, tenantId: string, data: any) {
    const lab = await this.prisma.lab.findFirst({ where: { id: labId, tenantId } });
    if (!lab) throw new NotFoundException(`Lab with ID ${labId} not found`);

    // Récupérer l'année scolaire active du lab
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    if (!academicYear) throw new NotFoundException('No active academic year found');

    return this.prisma.labEquipment.create({
      data: {
        labId,
        academicYearId: academicYear.id,
        name: data.name,
        equipmentType: data.equipmentType,
        manufacturer: data.manufacturer,
        model: data.model,
        serialNumber: data.serialNumber,
        quantity: data.quantity || 1,
        condition: data.condition || 'GOOD',
        lastMaintenance: data.lastMaintenance ? new Date(data.lastMaintenance) : null,
        nextMaintenance: data.nextMaintenance ? new Date(data.nextMaintenance) : null,
      },
    });
  }

  async reserveLab(labId: string, tenantId: string, data: any, reservedBy: string) {
    const lab = await this.prisma.lab.findFirst({ where: { id: labId, tenantId, isActive: true } });
    if (!lab) throw new NotFoundException(`Active lab with ID ${labId} not found`);

    // Vérifier les conflits de réservation
    const conflictingReservation = await this.prisma.labReservation.findFirst({
      where: {
        labId,
        reservationDate: new Date(data.reservationDate),
        status: { not: 'CANCELLED' },
        OR: [
          {
            startTime: { lte: data.startTime },
            endTime: { gte: data.startTime },
          },
          {
            startTime: { lte: data.endTime },
            endTime: { gte: data.endTime },
          },
        ],
      },
    });

    if (conflictingReservation) {
      throw new BadRequestException('Lab is already reserved for this time slot');
    }

    // Récupérer l'année scolaire active
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    if (!academicYear) throw new NotFoundException('No active academic year found');

    return this.prisma.labReservation.create({
      data: {
        labId,
        academicYearId: academicYear.id,
        reservedBy: reservedBy || undefined,
        reservationDate: new Date(data.reservationDate),
        startTime: data.startTime,
        endTime: data.endTime,
        purpose: data.purpose,
        status: data.status || 'CONFIRMED',
      },
    });
  }

  async reportIncident(equipmentId: string, tenantId: string, data: any, reportedBy: string) {
    const equipment = await this.prisma.labEquipment.findFirst({
      where: { id: equipmentId },
      include: { lab: true },
    });

    if (!equipment || equipment.lab.tenantId !== tenantId) {
      throw new NotFoundException(`Equipment with ID ${equipmentId} not found`);
    }

    return this.prisma.labIncident.create({
      data: {
        equipmentId,
        incidentDate: new Date(data.incidentDate),
        incidentType: data.incidentType,
        severity: data.severity || 'MEDIUM',
        description: data.description,
        resolved: false,
        reportedBy,
      },
    });
  }

  async findAllLabs(tenantId: string, academicYearId: string) {
    return this.prisma.lab.findMany({
      where: { tenantId, academicYearId, isActive: true },
      include: {
        equipment: true,
        reservations: {
          where: {
            reservationDate: { gte: new Date() },
            status: { not: 'CANCELLED' },
          },
          orderBy: { reservationDate: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findAllEquipment(labId: string, tenantId: string) {
    const lab = await this.prisma.lab.findFirst({ where: { id: labId, tenantId } });
    if (!lab) throw new NotFoundException(`Lab with ID ${labId} not found`);

    return this.prisma.labEquipment.findMany({
      where: { labId },
      include: {
        maintenance: { orderBy: { maintenanceDate: 'desc' }, take: 5 },
        incidents: { where: { resolved: false }, orderBy: { incidentDate: 'desc' } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async updateEquipment(id: string, labId: string, tenantId: string, data: any) {
    await this.findAllEquipment(labId, tenantId);
    const equipment = await this.prisma.labEquipment.findFirst({ where: { id, labId } });
    if (!equipment) throw new NotFoundException(`Equipment with ID ${id} not found`);

    return this.prisma.labEquipment.update({
      where: { id },
      data: {
        name: data.name,
        condition: data.condition,
        lastMaintenance: data.lastMaintenance ? new Date(data.lastMaintenance) : undefined,
        nextMaintenance: data.nextMaintenance ? new Date(data.nextMaintenance) : undefined,
      },
    });
  }

  // ============================================================================
  // ÉQUIPEMENTS (EXTENSION)
  // ============================================================================

  async deleteEquipment(id: string, tenantId: string) {
    const equipment = await this.prisma.labEquipment.findFirst({
      where: { id, lab: { tenantId } },
    });
    if (!equipment) throw new NotFoundException(`Equipment with ID ${id} not found`);

    return this.prisma.labEquipment.delete({ where: { id } });
  }

  // ============================================================================
  // CONSOMMABLES (CONSUMABLES)
  // ============================================================================

  async findAllConsumables(tenantId: string, labId?: string) {
    const where: any = { lab: { tenantId } };
    if (labId) where.labId = labId;

    return this.prisma.labConsumable.findMany({
      where,
      include: { lab: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createConsumable(labId: string, tenantId: string, data: any) {
    const lab = await this.prisma.lab.findFirst({ where: { id: labId, tenantId } });
    if (!lab) throw new NotFoundException(`Lab with ID ${labId} not found`);

    return this.prisma.labConsumable.create({
      data: {
        labId,
        tenantId,
        name: data.name,
        category: data.category,
        quantity: data.quantity || 0,
        unit: data.unit || 'unit',
        alertThreshold: data.alertThreshold || 10,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        location: data.location,
      },
    });
  }

  async recordStockMovement(consumableId: string, tenantId: string, data: any, performedBy: string) {
    const consumable = await this.prisma.labConsumable.findFirst({
      where: { id: consumableId, tenantId },
    });
    if (!consumable) throw new NotFoundException(`Consumable with ID ${consumableId} not found`);

    return this.prisma.$transaction(async (tx) => {
      // 1. Enregistrer le mouvement
      const movement = await tx.labStockMovement.create({
        data: {
          tenantId,
          consumableId,
          movementType: data.movementType, // IN | OUT | ADJUSTMENT
          quantity: data.quantity,
          reason: data.reason,
          performedBy,
          movementDate: new Date(),
        },
      });

      // 2. Mettre à jour le stock
      const newQuantity = data.movementType === 'IN' 
        ? consumable.quantity + data.quantity 
        : consumable.quantity - data.quantity;

      await tx.labConsumable.update({
        where: { id: consumableId },
        data: { 
          quantity: newQuantity,
          status: newQuantity <= consumable.alertThreshold ? 'LOW_STOCK' : 'IN_STOCK'
        },
      });

      return movement;
    });
  }

  // ============================================================================
  // SÉANCES PRATIQUES (SESSIONS)
  // ============================================================================

  async findAllSessions(tenantId: string, academicYearId: string) {
    return this.prisma.labSession.findMany({
      where: { tenantId, academicYearId },
      include: { 
        lab: { select: { name: true } },
        teacher: { select: { firstName: true, lastName: true } }
      },
      orderBy: { sessionDate: 'desc' },
    });
  }

  async createSession(tenantId: string, academicYearId: string, data: any, teacherId: string) {
    return this.prisma.labSession.create({
      data: {
        tenantId,
        academicYearId,
        labId: data.labId,
        teacherId,
        classId: data.classId,
        subjectId: data.subjectId,
        theme: data.theme,
        objectives: data.objectives,
        competencies: data.competencies,
        materialUsed: data.materialUsed || [],
        consumablesUsed: data.consumablesUsed || [],
        studentsPresent: data.studentsPresent,
        studentsAbsent: data.studentsAbsent,
        sessionDate: new Date(data.sessionDate),
        startTime: data.startTime,
        endTime: data.endTime,
        report: data.report,
        status: 'COMPLETED'
      }
    });
  }

  // ============================================================================
  // MAINTENANCE
  // ============================================================================

  async findAllMaintenance(tenantId: string, equipmentId?: string) {
    const where: any = { equipment: { lab: { tenantId } } };
    if (equipmentId) where.equipmentId = equipmentId;

    return this.prisma.labMaintenance.findMany({
      where,
      include: { equipment: { select: { name: true, lab: { select: { name: true } } } } },
      orderBy: { maintenanceDate: 'desc' },
    });
  }

  async scheduleMaintenance(equipmentId: string, tenantId: string, data: any) {
    const equipment = await this.prisma.labEquipment.findFirst({
      where: { id: equipmentId, lab: { tenantId } },
    });
    if (!equipment) throw new NotFoundException(`Equipment with ID ${equipmentId} not found`);

    return this.prisma.labMaintenance.create({
      data: {
        tenantId,
        equipmentId,
        maintenanceDate: new Date(data.maintenanceDate),
        maintenanceType: data.maintenanceType,
        description: data.description,
        cost: data.cost,
        performedBy: data.performedBy,
        status: 'PLANNED',
      },
    });
  }

  // ============================================================================
  // DEMANDES D'ACHAT (PURCHASE REQUESTS)
  // ============================================================================

  async findAllPurchaseRequests(tenantId: string) {
    return this.prisma.labPurchaseRequest.findMany({
      where: { tenantId },
      include: { requester: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPurchaseRequest(tenantId: string, data: any, requesterId: string) {
    return this.prisma.labPurchaseRequest.create({
      data: {
        tenantId,
        requesterId,
        itemName: data.itemName,
        itemType: data.itemType, // EQUIPMENT | CONSUMABLE
        quantity: data.quantity,
        estimatedCost: data.estimatedCost,
        reason: data.reason,
        status: 'PENDING',
      },
    });
  }

  async updatePurchaseRequestStatus(id: string, tenantId: string, status: string) {
    return this.prisma.labPurchaseRequest.updateMany({
      where: { id, tenantId },
      data: { status },
    });
  }

  // ============================================================================
  // SÉCURITÉ & PARAMÈTRES
  // ============================================================================

  async findAllSafetyRules(tenantId: string, labId?: string) {
    const where: any = { tenantId };
    if (labId) where.labId = labId;

    return this.prisma.labSafetyRule.findMany({
      where,
      include: { lab: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createSafetyRule(labId: string, tenantId: string, data: any) {
    return this.prisma.labSafetyRule.create({
      data: {
        labId,
        tenantId,
        title: data.title,
        description: data.description,
        severity: data.severity || 'MANDATORY',
      },
    });
  }

  async getLabStats(tenantId: string, academicYearId: string) {
    const labs = await this.prisma.lab.findMany({
      where: { tenantId, academicYearId, isActive: true },
      include: {
        equipment: true,
        reservations: {
          where: {
            reservationDate: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            },
            status: { not: 'CANCELLED' },
          },
        },
      },
    });

    const totalEquipment = labs.reduce((sum, lab) => sum + lab.equipment.length, 0);
    const equipmentInMaintenance = labs.reduce(
      (sum, lab) => sum + lab.equipment.filter((e) => e.condition === 'OUT_OF_ORDER').length,
      0,
    );

    return {
      totalLabs: labs.length,
      totalEquipment,
      equipmentInMaintenance,
      utilizationRate: labs.length > 0
        ? (labs.reduce((sum, lab) => sum + lab.reservations.length, 0) / labs.length) * 100
        : 0,
      lastUpdate: new Date()
    };
  }

  // ============================================================================
  // RAPPORTS (REPORTS)
  // ============================================================================

  async findAllReports(tenantId: string, labId?: string) {
    const where: any = { tenantId };
    if (labId) where.labId = labId;

    return this.prisma.labReport.findMany({
      where,
      include: { lab: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createReport(tenantId: string, data: any, userId: string) {
    return this.prisma.labReport.create({
      data: {
        tenantId,
        labId: data.labId,
        reportType: data.reportType,
        periodStart: data.periodStart ? new Date(data.periodStart) : null,
        periodEnd: data.periodEnd ? new Date(data.periodEnd) : null,
        content: data.content || {},
        generatedBy: userId,
      },
    });
  }
}

