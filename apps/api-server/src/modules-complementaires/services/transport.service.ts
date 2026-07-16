import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service pour le sous-module 9.2 - Transport Scolaire
 * Implémentation complète selon les spécifications Academia Helm.
 */
@Injectable()
export class TransportService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // VEHICLES (FLOTTE)
  // ============================================================================

  async createVehicle(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.vehicle.create({
      data: {
        tenantId,
        academicYearId,
        name: data.name,
        vehicleType: data.vehicleType,
        plateNumber: data.plateNumber,
        brand: data.brand,
        model: data.model,
        year: data.year ? parseInt(data.year) : undefined,
        capacity: parseInt(data.capacity),
        driverId: data.driverId,
        attendantId: data.attendantId,
        status: data.status || 'ACTIVE',
        insuranceInfo: data.insuranceInfo,
        technicalVisit: data.technicalVisit ? new Date(data.technicalVisit) : null,
        registrationCard: data.registrationCard,
        acquisitionDate: data.acquisitionDate ? new Date(data.acquisitionDate) : null,
        cost: data.cost ? parseFloat(data.cost) : null,
      },
    });
  }

  async findAllVehicles(tenantId: string, academicYearId: string) {
    return this.prisma.vehicle.findMany({
      where: { tenantId, academicYearId },
      include: { 
        routes: true,
        driver: true,
        attendant: true,
        maintenances: { take: 5, orderBy: { maintenanceDate: 'desc' } }
      },
      orderBy: { plateNumber: 'asc' },
    });
  }

  async findVehicle(id: string, tenantId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, tenantId },
      include: { 
        routes: { include: { stops: true } },
        driver: true,
        attendant: true,
        maintenances: true,
        documents: true
      },
    });
    if (!vehicle) throw new NotFoundException(`Vehicle with ID ${id} not found`);
    return vehicle;
  }

  async updateVehicle(id: string, tenantId: string, data: any) {
    return this.prisma.vehicle.update({
      where: { id, tenantId },
      data: {
        name: data.name,
        vehicleType: data.vehicleType,
        plateNumber: data.plateNumber,
        brand: data.brand,
        model: data.model,
        year: data.year ? parseInt(data.year) : undefined,
        capacity: data.capacity ? parseInt(data.capacity) : undefined,
        driverId: data.driverId,
        attendantId: data.attendantId,
        status: data.status,
        insuranceInfo: data.insuranceInfo,
        technicalVisit: data.technicalVisit ? new Date(data.technicalVisit) : undefined,
        registrationCard: data.registrationCard,
        mileage: data.mileage ? parseFloat(data.mileage) : undefined,
        consumption: data.consumption ? parseFloat(data.consumption) : undefined,
      },
    });
  }

  // ============================================================================
  // DRIVERS & ATTENDANTS (PERSONNEL)
  // ============================================================================

  async createDriver(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.transportDriver.create({
      data: {
        tenantId,
        academicYearId,
        staffId: data.staffId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        licenseNumber: data.licenseNumber,
        licenseCategory: data.licenseCategory,
        licenseExpiry: new Date(data.licenseExpiry),
        status: data.status || 'ACTIVE',
        observations: data.observations,
      },
    });
  }

  async findAllDrivers(tenantId: string, academicYearId: string) {
    return this.prisma.transportDriver.findMany({
      where: { tenantId, academicYearId },
      include: { vehicles: true },
      orderBy: { lastName: 'asc' },
    });
  }

  async createAttendant(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.transportAttendant.create({
      data: {
        tenantId,
        academicYearId,
        staffId: data.staffId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role,
        status: data.status || 'ACTIVE',
        observations: data.observations,
      },
    });
  }

  async findAllAttendants(tenantId: string, academicYearId: string) {
    return this.prisma.transportAttendant.findMany({
      where: { tenantId, academicYearId },
      include: { vehicles: true },
      orderBy: { lastName: 'asc' },
    });
  }

  // ============================================================================
  // ROUTES & ZONES
  // ============================================================================

  async createZone(tenantId: string, data: any) {
    return this.prisma.transportZone.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        type: data.type || 'QUARTIER',
        academicYearId: data.academicYearId,
      },
    });
  }

  async findAllZones(tenantId: string) {
    return this.prisma.transportZone.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async createRoute(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.route.create({
      data: {
        tenantId,
        academicYearId,
        vehicleId: data.vehicleId,
        zoneId: data.zoneId,
        name: data.name,
        code: data.code,
        description: data.description,
        startTime: data.startTime,
        endTime: data.endTime,
        distance: data.distance ? parseFloat(data.distance) : null,
        duration: data.duration ? parseInt(data.duration) : null,
        type: data.type || 'ROUND_TRIP',
        isActive: data.isActive !== false,
      },
    });
  }

  async findAllRoutes(tenantId: string, academicYearId: string) {
    return this.prisma.route.findMany({
      where: { tenantId, academicYearId },
      include: {
        vehicle: true,
        zone: true,
        stops: { orderBy: { stopOrder: 'asc' } },
        assignments: { where: { status: 'ACTIVE' } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async addRouteStop(routeId: string, data: any) {
    return this.prisma.routeStop.create({
      data: {
        routeId,
        zoneId: data.zoneId,
        stopOrder: data.stopOrder,
        name: data.name,
        address: data.address,
        landmark: data.landmark,
        latitude: data.latitude,
        longitude: data.longitude,
        arrivalTime: data.arrivalTime,
      },
    });
  }

  // ============================================================================
  // ASSIGNMENTS (ÉLÈVES)
  // ============================================================================

  async assignStudent(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.transportAssignment.create({
      data: {
        tenantId,
        academicYearId,
        studentId: data.studentId,
        routeId: data.routeId,
        vehicleId: data.vehicleId,
        pickupStopId: data.pickupStopId,
        dropoffStopId: data.dropoffStopId,
        subscriptionType: data.subscriptionType || 'FULL',
        period: data.period || 'MONTHLY',
        amount: data.amount ? parseFloat(data.amount) : null,
        paymentStatus: data.paymentStatus || 'PENDING',
        status: 'ACTIVE',
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });
  }

  async findAllAssignments(tenantId: string, academicYearId: string, filters?: any) {
    const where: any = { tenantId, academicYearId };
    if (filters?.studentId) where.studentId = filters.studentId;
    if (filters?.routeId) where.routeId = filters.routeId;
    if (filters?.status) where.status = filters.status;

    return this.prisma.transportAssignment.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, class: { select: { name: true } } } },
        route: true,
        pickupStop: true,
        dropoffStop: true,
        vehicle: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================================================
  // SCHEDULES & TRIPS (SUIVI RÉEL)
  // ============================================================================

  async createSchedule(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.transportSchedule.create({
      data: {
        tenantId,
        academicYearId,
        routeId: data.routeId,
        vehicleId: data.vehicleId,
        driverId: data.driverId,
        attendantId: data.attendantId,
        dayOfWeek: data.dayOfWeek,
        specificDate: data.specificDate ? new Date(data.specificDate) : null,
        startTime: data.startTime,
        endTime: data.endTime,
        type: data.type || 'RECURRING',
        status: 'PLANNED',
      },
    });
  }

  async startTrip(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.transportTrip.create({
      data: {
        tenantId,
        academicYearId,
        scheduleId: data.scheduleId,
        routeId: data.routeId,
        vehicleId: data.vehicleId,
        driverId: data.driverId,
        attendantId: data.attendantId,
        tripDate: new Date(),
        plannedStartTime: data.plannedStartTime,
        actualStartTime: new Date(),
        status: 'IN_PROGRESS',
      },
    });
  }

  async recordTripEvent(tripId: string, tenantId: string, data: any) {
    return this.prisma.transportTripEvent.create({
      data: {
        tripId,
        tenantId,
        eventType: data.eventType,
        eventTime: new Date(),
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        description: data.description,
        academicYearId: data.academicYearId,
      },
    });
  }

  async completeTrip(tripId: string, tenantId: string, observations?: string) {
    return this.prisma.transportTrip.update({
      where: { id: tripId, tenantId },
      data: {
        actualEndTime: new Date(),
        status: 'COMPLETED',
        observations,
      },
    });
  }

  // ============================================================================
  // ATTENDANCE (PRÉSENCES)
  // ============================================================================

  async recordAttendance(assignmentId: string, tenantId: string, data: any, recordedBy: string) {
    return this.prisma.transportAttendance.upsert({
      where: {
        assignmentId_attendanceDate_direction: {
          assignmentId,
          attendanceDate: new Date(data.attendanceDate),
          direction: data.direction,
        },
      },
      create: {
        assignmentId,
        tripId: data.tripId,
        attendanceDate: new Date(data.attendanceDate),
        direction: data.direction,
        status: data.status || 'PRESENT',
        notes: data.notes,
        recordedBy,
      },
      update: {
        status: data.status,
        notes: data.notes,
        tripId: data.tripId,
      },
    });
  }

  // ============================================================================
  // INCIDENTS & MAINTENANCE
  // ============================================================================

  async reportIncident(tenantId: string, academicYearId: string, data: any, reportedBy: string) {
    return this.prisma.transportIncident.create({
      data: {
        tenantId,
        academicYearId,
        tripId: data.tripId,
        vehicleId: data.vehicleId,
        routeId: data.routeId,
        driverId: data.driverId,
        studentId: data.studentId,
        incidentDate: new Date(data.incidentDate),
        incidentType: data.incidentType,
        severity: data.severity || 'MEDIUM',
        description: data.description,
        actionTaken: data.actionTaken,
        parentNotified: data.parentNotified || false,
        status: 'OPEN',
        reportedBy,
      },
    });
  }

  async createMaintenance(tenantId: string, vehicleId: string, data: any) {
    return this.prisma.vehicleMaintenance.create({
      data: {
        tenantId,
        vehicleId,
        maintenanceType: data.maintenanceType,
        maintenanceDate: new Date(data.maintenanceDate),
        mileageAtMaintenance: data.mileageAtMaintenance ? parseFloat(data.mileageAtMaintenance) : null,
        cost: data.cost ? parseFloat(data.cost) : null,
        description: data.description,
        nextMaintenanceDate: data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate) : null,
        status: data.status || 'COMPLETED',
        academicYearId: data.academicYearId,
      },
    });
  }

  // ============================================================================
  // SETTINGS & STATS
  // ============================================================================

  async updateSetting(tenantId: string, key: string, value: string, academicYearId?: string) {
    return this.prisma.transportSetting.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, value, academicYearId },
      update: { value, academicYearId },
    });
  }

  /**
   * Récupère tous les paramètres de transport d'un tenant (pour le frontend
   * TransportSettings qui charge l'objet settings complet au démarrage).
   * Retourne un objet key→value pour faciliter la consommation côté frontend.
   */
  async getSettings(tenantId: string): Promise<Record<string, string>> {
    const settings = await this.prisma.transportSetting.findMany({
      where: { tenantId },
      select: { key: true, value: true },
    });
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }

  /**
   * Liste tous les incidents de transport (filtres optionnels : statut, véhicule, période).
   * ⭐ Implémentation ajoutée juillet 2026 — le controller exposait déjà la route
   * GET /transport/incidents mais la méthode service était absente (runtime 500).
   */
  async findAllIncidents(
    tenantId: string,
    academicYearId: string,
    filters?: { status?: string; vehicleId?: string; startDate?: Date; endDate?: Date },
  ) {
    const where: any = { tenantId, academicYearId };
    if (filters?.status) where.status = filters.status;
    if (filters?.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters?.startDate || filters?.endDate) {
      where.incidentDate = {};
      if (filters?.startDate) where.incidentDate.gte = filters.startDate;
      if (filters?.endDate) where.incidentDate.lte = filters.endDate;
    }

    return this.prisma.transportIncident.findMany({
      where,
      include: {
        vehicle: { select: { id: true, plateNumber: true, model: true } },
        route: { select: { id: true, name: true } },
        reporter: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { incidentDate: 'desc' },
      take: 200,
    });
  }

  /**
   * Marque un incident comme résolu (change le statut + ajoute une résolution).
   * ⭐ Implémentation ajoutée juillet 2026 — le frontend TransportIncidents
   * appelle POST /transport/incidents/:id/resolve mais la méthode n'existait pas.
   */
  async resolveIncident(
    id: string,
    tenantId: string,
    resolution: string,
    resolvedBy: string,
  ) {
    const incident = await this.prisma.transportIncident.findFirst({
      where: { id, tenantId },
    });
    if (!incident) {
      throw new NotFoundException(`Incident transport introuvable (id=${id}).`);
    }

    return this.prisma.transportIncident.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        actionTaken: resolution,
        resolvedAt: new Date(),
        // reportedBy existe mais pas resolvedBy — on conserve le resolvedBy dans actionTaken
        // car le schéma n'a pas de champ dedicated resolvedBy.
      },
    });
  }

  async getTransportStats(tenantId: string, academicYearId: string) {
    const [vehicles, routes, drivers, assignments, incidents] = await Promise.all([
      this.prisma.vehicle.count({ where: { tenantId, academicYearId } }),
      this.prisma.route.count({ where: { tenantId, academicYearId, isActive: true } }),
      this.prisma.transportDriver.count({ where: { tenantId, academicYearId, status: 'ACTIVE' } }),
      this.prisma.transportAssignment.count({ where: { tenantId, academicYearId, status: 'ACTIVE' } }),
      this.prisma.transportIncident.count({ where: { tenantId, academicYearId, status: 'OPEN' } }),
    ]);

    // Attendance rate last 7 days
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    
    const attendances = await this.prisma.transportAttendance.findMany({
      where: {
        assignment: { tenantId, academicYearId },
        attendanceDate: { gte: last7Days },
      },
    });

    const presentCount = attendances.filter(a => a.status === 'PRESENT' || a.status === 'BOARDED' || a.status === 'DISEMBARKED').length;
    const attendanceRate = attendances.length > 0 ? (presentCount / attendances.length) * 100 : 0;

    return {
      totalVehicles: vehicles,
      activeRoutes: routes,
      activeDrivers: drivers,
      activeAssignments: assignments,
      openIncidents: incidents,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
    };
  }

  // ============================================================================
  // ⭐ CRUD COMPLÉMENTAIRE (Task 8-b) — DELETE + UPDATE manquants
  // ============================================================================
  // Patterns :
  //  - findFirst({ where: { id, tenantId } }) pour l'isolation tenant
  //  - NotFoundException si l'entité n'existe pas
  //  - Soft-delete (status = 'ARCHIVED' | 'INACTIVE' | isActive=false) si enfants
  //    existent, hard delete sinon
  // ============================================================================

  /**
   * DELETE /transport/vehicles/:id
   * Soft-delete (status = 'ARCHIVED') si trips/assignments/routes/maintenances
   * existent, hard delete sinon. Le modèle Vehicle n'a pas d'isActive, mais a un
   * champ `status` (default "ACTIVE") — on l'utilise pour le soft-delete.
   */
  async deleteVehicle(id: string, tenantId: string): Promise<{ success: boolean }> {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id, tenantId } });
    if (!vehicle) throw new NotFoundException(`Véhicule introuvable (id=${id}).`);

    const [tripsCount, assignmentsCount, routesCount, maintenancesCount, incidentsCount] = await Promise.all([
      this.prisma.transportTrip.count({ where: { vehicleId: id } }),
      this.prisma.transportAssignment.count({ where: { vehicleId: id } }),
      this.prisma.route.count({ where: { vehicleId: id } }),
      this.prisma.vehicleMaintenance.count({ where: { vehicleId: id } }),
      this.prisma.transportIncident.count({ where: { vehicleId: id } }),
    ]);

    if (tripsCount + assignmentsCount + routesCount + maintenancesCount + incidentsCount > 0) {
      // Soft-delete — on archive pour préserver l'historique
      await this.prisma.vehicle.update({ where: { id }, data: { status: 'ARCHIVED' } });
      return { success: true };
    }

    await this.prisma.vehicle.delete({ where: { id } });
    return { success: true };
  }

  /**
   * DELETE /transport/drivers/:id
   * Soft-delete (status = 'INACTIVE') si trips/incidents/vehicles liés,
   * hard delete sinon.
   */
  async deleteDriver(id: string, tenantId: string): Promise<{ success: boolean }> {
    const driver = await this.prisma.transportDriver.findFirst({ where: { id, tenantId } });
    if (!driver) throw new NotFoundException(`Chauffeur introuvable (id=${id}).`);

    const [tripsCount, incidentsCount, vehiclesCount] = await Promise.all([
      this.prisma.transportTrip.count({ where: { driverId: id } }),
      this.prisma.transportIncident.count({ where: { driverId: id } }),
      this.prisma.vehicle.count({ where: { driverId: id } }),
    ]);

    if (tripsCount + incidentsCount + vehiclesCount > 0) {
      await this.prisma.transportDriver.update({ where: { id }, data: { status: 'INACTIVE' } });
      return { success: true };
    }

    await this.prisma.transportDriver.delete({ where: { id } });
    return { success: true };
  }

  /**
   * DELETE /transport/routes/:id
   * Vérifier assignments/schedules/trips/incidents avant delete.
   * Si enfants → soft-delete (isActive = false). Sinon hard delete.
   */
  async deleteRoute(id: string, tenantId: string): Promise<{ success: boolean }> {
    const route = await this.prisma.route.findFirst({ where: { id, tenantId } });
    if (!route) throw new NotFoundException(`Itinéraire introuvable (id=${id}).`);

    const [assignmentsCount, schedulesCount, tripsCount, incidentsCount] = await Promise.all([
      this.prisma.transportAssignment.count({ where: { routeId: id } }),
      this.prisma.transportSchedule.count({ where: { routeId: id } }),
      this.prisma.transportTrip.count({ where: { routeId: id } }),
      this.prisma.transportIncident.count({ where: { routeId: id } }),
    ]);

    if (assignmentsCount + schedulesCount + tripsCount + incidentsCount > 0) {
      // Soft-delete — désactiver l'itinéraire pour préserver l'historique
      await this.prisma.route.update({ where: { id }, data: { isActive: false } });
      return { success: true };
    }

    // Hard delete — les stops sont supprimés en cascade (onDelete: Cascade)
    await this.prisma.route.delete({ where: { id } });
    return { success: true };
  }

  /**
   * DELETE /transport/assignments/:id
   * Hard delete — les attendances sont supprimées en cascade
   * (TransportAttendance.assignment → onDelete: Cascade).
   */
  async deleteAssignment(id: string, tenantId: string): Promise<{ success: boolean }> {
    const assignment = await this.prisma.transportAssignment.findFirst({ where: { id, tenantId } });
    if (!assignment) throw new NotFoundException(`Affectation introuvable (id=${id}).`);

    await this.prisma.transportAssignment.delete({ where: { id } });
    return { success: true };
  }

  /**
   * DELETE /transport/incidents/:id
   * Hard delete — pas d'enfants sur TransportIncident.
   */
  async deleteIncident(id: string, tenantId: string): Promise<{ success: boolean }> {
    const incident = await this.prisma.transportIncident.findFirst({ where: { id, tenantId } });
    if (!incident) throw new NotFoundException(`Incident transport introuvable (id=${id}).`);

    await this.prisma.transportIncident.delete({ where: { id } });
    return { success: true };
  }

  /**
   * PUT /transport/drivers/:id
   * Mise à jour générique d'un chauffeur.
   */
  async updateDriver(id: string, tenantId: string, data: any) {
    const driver = await this.prisma.transportDriver.findFirst({ where: { id, tenantId } });
    if (!driver) throw new NotFoundException(`Chauffeur introuvable (id=${id}).`);

    const updateData: any = { ...data };
    if (data.licenseExpiry) updateData.licenseExpiry = new Date(data.licenseExpiry);
    // Éviter de modifier les clés primaires/relations
    delete updateData.id;
    delete updateData.tenantId;

    return this.prisma.transportDriver.update({ where: { id }, data: updateData });
  }

  /**
   * PUT /transport/routes/:id
   * Mise à jour générique d'un itinéraire.
   */
  async updateRoute(id: string, tenantId: string, data: any) {
    const route = await this.prisma.route.findFirst({ where: { id, tenantId } });
    if (!route) throw new NotFoundException(`Itinéraire introuvable (id=${id}).`);

    const updateData: any = { ...data };
    if (data.distance !== undefined) updateData.distance = data.distance !== null ? parseFloat(data.distance) : null;
    if (data.duration !== undefined) updateData.duration = data.duration !== null ? parseInt(data.duration) : null;
    delete updateData.id;
    delete updateData.tenantId;

    return this.prisma.route.update({ where: { id }, data: updateData });
  }

  /**
   * PUT /transport/assignments/:id
   * Mise à jour générique d'une affectation élève.
   */
  async updateAssignment(id: string, tenantId: string, data: any) {
    const assignment = await this.prisma.transportAssignment.findFirst({ where: { id, tenantId } });
    if (!assignment) throw new NotFoundException(`Affectation introuvable (id=${id}).`);

    const updateData: any = { ...data };
    if (data.amount !== undefined && data.amount !== null) updateData.amount = parseFloat(data.amount);
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    delete updateData.id;
    delete updateData.tenantId;

    return this.prisma.transportAssignment.update({ where: { id }, data: updateData });
  }

  /**
   * PUT /transport/incidents/:id
   * Mise à jour générique d'un incident transport.
   */
  async updateIncident(id: string, tenantId: string, data: any) {
    const incident = await this.prisma.transportIncident.findFirst({ where: { id, tenantId } });
    if (!incident) throw new NotFoundException(`Incident transport introuvable (id=${id}).`);

    const updateData: any = { ...data };
    if (data.incidentDate) updateData.incidentDate = new Date(data.incidentDate);
    if (data.resolvedAt) updateData.resolvedAt = new Date(data.resolvedAt);
    delete updateData.id;
    delete updateData.tenantId;

    return this.prisma.transportIncident.update({ where: { id }, data: updateData });
  }
}
