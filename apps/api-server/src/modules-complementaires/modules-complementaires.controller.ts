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
  Request,
  Patch,
  Res,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AcademicYearId } from '../common/decorators/academic-year-id.decorator';
import { CanteenService } from './services/canteen.service';
import { TransportService } from './services/transport.service';
import { LibraryService } from './services/library.service';
import { LabService } from './services/lab.service';
import { InfirmaryService } from './services/infirmary.service';
import { ShopService } from './services/shop.service';
import { ShopReceiptService } from './services/shop-receipt.service';
import { EduCastService } from './services/educast.service';
import { QHSEService } from './services/qhse.service';
import { ModulesComplementairesOrionService } from './services/modules-complementaires-orion.service';

/**
 * Controller pour le MODULE 9 — Modules Complémentaires
 */
@Controller('modules-complementaires')
@UseGuards(JwtAuthGuard)
export class ModulesComplementairesController {
  private readonly logger = new Logger(ModulesComplementairesController.name);

  constructor(
    private readonly canteenService: CanteenService,
    private readonly transportService: TransportService,
    private readonly libraryService: LibraryService,
    private readonly labService: LabService,
    private readonly infirmaryService: InfirmaryService,
    private readonly shopService: ShopService,
    private readonly shopReceiptService: ShopReceiptService,
    private readonly educastService: EduCastService,
    private readonly qhseService: QHSEService,
    private readonly orionService: ModulesComplementairesOrionService,
  ) {}

  // ============================================================================
  // 9.1 CANTINE
  // ============================================================================

  @Get('canteen/dashboard')
  async getCanteenDashboard(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.canteenService.getDashboardStats(tenantId, academicYearId);
  }

  @Get('canteen/menus')
  async getCanteenMenus(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query() filters: any,
  ) {
    return this.canteenService.findAllMenus(tenantId, academicYearId, filters);
  }

  @Post('canteen/menus')
  async createCanteenMenu(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.canteenService.createMenu(tenantId, academicYearId, data);
  }

  @Get('canteen/menus/:id')
  async getCanteenMenu(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.canteenService.findMenu(id, tenantId);
  }

  @Put('canteen/menus/:id')
  async updateCanteenMenu(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.canteenService.updateMenu(id, tenantId, data);
  }

  @Delete('canteen/menus/:id')
  async deleteCanteenMenu(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.canteenService.deleteMenu(id, tenantId);
  }

  @Post('canteen/subscriptions')
  async createCanteenSubscription(
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.canteenService.createSubscription(tenantId, data);
  }

  @Get('canteen/enrollments')
  async getCanteenEnrollments(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query() filters: any,
  ) {
    return this.canteenService.findAllEnrollments(tenantId, academicYearId, filters);
  }

  @Post('canteen/enrollments')
  async enrollStudent(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.canteenService.enrollStudent(tenantId, academicYearId, data);
  }

  @Put('canteen/enrollments/:id/validate')
  async validateCanteenEnrollment(
    @Param('id') id: string,
    @Body('status') status: any,
  ) {
    return this.canteenService.validateEnrollment(id, status);
  }

  /**
   * PUT /canteen/enrollments/:id — mise à jour générique (pas seulement validate).
   * ⭐ Task 8-b : route PUT manquante.
   */
  @Put('canteen/enrollments/:id')
  async updateCanteenEnrollment(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.canteenService.updateEnrollment(id, tenantId, data);
  }

  /**
   * DELETE /canteen/enrollments/:id — hard delete (cascade attendances/mealServices/payments).
   * ⭐ Task 8-b : route DELETE manquante.
   */
  @Delete('canteen/enrollments/:id')
  async deleteCanteenEnrollment(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.canteenService.deleteEnrollment(id, tenantId);
  }

  @Post('canteen/meal-services')
  async recordCanteenMealService(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.canteenService.recordMealService(tenantId, { ...data, recordedBy: user.id });
  }

  @Get('canteen/attendance')
  async getCanteenAttendance(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('date') date: string,
  ) {
    return this.canteenService.getAttendance(tenantId, academicYearId, new Date(date));
  }

  @Get('canteen/diets')
  async getCanteenDiets(@TenantId() tenantId: string) {
    return this.canteenService.findAllDiets(tenantId);
  }

  /**
   * POST /canteen/diets — création d'un régime alimentaire.
   * ⭐ Task 8-b : route POST manquante.
   */
  @Post('canteen/diets')
  async createCanteenDiet(
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.canteenService.createDiet(tenantId, data);
  }

  /**
   * PUT /canteen/diets/:id — mise à jour générique d'un régime.
   * ⭐ Task 8-b : route PUT manquante.
   */
  @Put('canteen/diets/:id')
  async updateCanteenDiet(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.canteenService.updateDiet(id, tenantId, data);
  }

  /**
   * DELETE /canteen/diets/:id — soft-delete (isActive=false) si enrollments,
   * hard delete sinon.
   * ⭐ Task 8-b : route DELETE manquante.
   */
  @Delete('canteen/diets/:id')
  async deleteCanteenDiet(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.canteenService.deleteDiet(id, tenantId);
  }

  @Get('canteen/allergies')
  async getCanteenAllergies(@TenantId() tenantId: string) {
    return this.canteenService.findAllAllergies(tenantId);
  }

  /**
   * POST /canteen/allergies — création d'une allergy.
   * ⭐ Task 8-b : route POST manquante.
   */
  @Post('canteen/allergies')
  async createCanteenAllergy(
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.canteenService.createAllergy(tenantId, data);
  }

  /**
   * PUT /canteen/allergies/:id — mise à jour générique d'une allergy.
   * ⭐ Task 8-b : route PUT manquante.
   */
  @Put('canteen/allergies/:id')
  async updateCanteenAllergy(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.canteenService.updateAllergy(id, tenantId, data);
  }

  /**
   * DELETE /canteen/allergies/:id — hard delete.
   * ⭐ Task 8-b : route DELETE manquante.
   */
  @Delete('canteen/allergies/:id')
  async deleteCanteenAllergy(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.canteenService.deleteAllergy(id, tenantId);
  }

  @Get('canteen/stocks')
  async getCanteenStocks(@TenantId() tenantId: string) {
    return this.canteenService.findAllStocks(tenantId);
  }

  @Post('canteen/stocks')
  async updateCanteenStock(
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.canteenService.updateStock(tenantId, data);
  }

  /**
   * DELETE /canteen/stocks/:id — soft-delete (isActive=false) si mouvements,
   * hard delete sinon.
   * ⭐ Task 8-b : route DELETE manquante.
   */
  @Delete('canteen/stocks/:id')
  async deleteCanteenStock(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.canteenService.deleteStock(id, tenantId);
  }

  @Get('canteen/suppliers')
  async getCanteenSuppliers(@TenantId() tenantId: string) {
    return this.canteenService.findAllSuppliers(tenantId);
  }

  @Post('canteen/suppliers')
  async createCanteenSupplier(
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.canteenService.createSupplier(tenantId, data);
  }

  /**
   * PUT /canteen/suppliers/:id — mise à jour générique d'un fournisseur.
   * ⭐ Task 8-b : route PUT manquante.
   */
  @Put('canteen/suppliers/:id')
  async updateCanteenSupplier(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.canteenService.updateSupplier(id, tenantId, data);
  }

  /**
   * DELETE /canteen/suppliers/:id — soft-delete (isActive=false) si purchaseOrders,
   * hard delete sinon.
   * ⭐ Task 8-b : route DELETE manquante.
   */
  @Delete('canteen/suppliers/:id')
  async deleteCanteenSupplier(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.canteenService.deleteSupplier(id, tenantId);
  }

  @Get('canteen/incidents')
  async getCanteenIncidents(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.canteenService.findAllIncidents(tenantId, academicYearId);
  }

  @Post('canteen/incidents')
  async reportCanteenIncident(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.canteenService.reportIncident(tenantId, academicYearId, data);
  }

  /**
   * PUT /canteen/incidents/:id — mise à jour générique d'un incident cantine.
   * ⭐ Task 8-b : route PUT manquante.
   */
  @Put('canteen/incidents/:id')
  async updateCanteenIncident(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.canteenService.updateIncident(id, tenantId, data);
  }

  /**
   * DELETE /canteen/incidents/:id — hard delete.
   * ⭐ Task 8-b : route DELETE manquante.
   */
  @Delete('canteen/incidents/:id')
  async deleteCanteenIncident(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.canteenService.deleteIncident(id, tenantId);
  }

  @Get('canteen/payments')
  async getCanteenPayments(
    @TenantId() tenantId: string,
    @Query() filters: any,
  ) {
    return this.canteenService.findAllPayments(tenantId, filters);
  }

  @Post('canteen/payments')
  async recordCanteenPayment(
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.canteenService.recordPayment(tenantId, data);
  }

  /**
   * PUT /canteen/payments/:id — mise à jour générique d'un paiement.
   * ⭐ Task 8-b : route PUT manquante.
   */
  @Put('canteen/payments/:id')
  async updateCanteenPayment(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.canteenService.updatePayment(id, tenantId, data);
  }

  /**
   * DELETE /canteen/payments/:id — hard delete.
   * ⭐ Task 8-b : route DELETE manquante.
   */
  @Delete('canteen/payments/:id')
  async deleteCanteenPayment(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.canteenService.deletePayment(id, tenantId);
  }

  @Get('canteen/settings')
  async getCanteenSettings(@TenantId() tenantId: string) {
    return this.canteenService.getSettings(tenantId);
  }

  @Put('canteen/settings')
  async updateCanteenSettings(
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.canteenService.updateSettings(tenantId, data);
  }


  // ============================================================================
  // 9.2 TRANSPORT
  // ============================================================================

  // --- Véhicules ---
  @Get('transport/vehicles')
  async getVehicles(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.transportService.findAllVehicles(tenantId, academicYearId);
  }

  @Post('transport/vehicles')
  async createVehicle(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.transportService.createVehicle(tenantId, academicYearId, data);
  }

  @Get('transport/vehicles/:id')
  async getVehicle(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.transportService.findVehicle(id, tenantId);
  }

  @Put('transport/vehicles/:id')
  async updateVehicle(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.transportService.updateVehicle(id, tenantId, data);
  }

  /**
   * DELETE /transport/vehicles/:id
   * Soft-delete (status = 'ARCHIVED') si trips/assignments/routes/maintenances
   * existent, hard delete sinon.
   * ⭐ Task 8-b : route DELETE manquante — ajoutée pour compléter le CRUD véhicules.
   */
  @Delete('transport/vehicles/:id')
  async deleteVehicle(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.transportService.deleteVehicle(id, tenantId);
  }

  // --- Personnel (Chauffeurs & Accompagnateurs) ---
  @Get('transport/drivers')
  async getDrivers(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.transportService.findAllDrivers(tenantId, academicYearId);
  }

  @Post('transport/drivers')
  async createDriver(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.transportService.createDriver(tenantId, academicYearId, data);
  }

  /**
   * PUT /transport/drivers/:id — mise à jour générique d'un chauffeur.
   * ⭐ Task 8-b : route PUT manquante.
   */
  @Put('transport/drivers/:id')
  async updateDriver(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.transportService.updateDriver(id, tenantId, data);
  }

  /**
   * DELETE /transport/drivers/:id — soft-delete si trips/incidents/vehicles liés,
   * hard delete sinon.
   * ⭐ Task 8-b : route DELETE manquante.
   */
  @Delete('transport/drivers/:id')
  async deleteDriver(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.transportService.deleteDriver(id, tenantId);
  }

  @Get('transport/attendants')
  async getAttendants(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.transportService.findAllAttendants(tenantId, academicYearId);
  }

  @Post('transport/attendants')
  async createAttendant(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.transportService.createAttendant(tenantId, academicYearId, data);
  }

  // --- Itinéraires, Zones & Arrêts ---
  @Get('transport/zones')
  async getZones(@TenantId() tenantId: string) {
    return this.transportService.findAllZones(tenantId);
  }

  @Post('transport/zones')
  async createZone(@TenantId() tenantId: string, @Body() data: any) {
    return this.transportService.createZone(tenantId, data);
  }

  @Get('transport/routes')
  async getRoutes(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.transportService.findAllRoutes(tenantId, academicYearId);
  }

  @Post('transport/routes')
  async createRoute(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.transportService.createRoute(tenantId, academicYearId, data);
  }

  /**
   * PUT /transport/routes/:id — mise à jour générique d'un itinéraire.
   * ⭐ Task 8-b : route PUT manquante.
   */
  @Put('transport/routes/:id')
  async updateRoute(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.transportService.updateRoute(id, tenantId, data);
  }

  /**
   * DELETE /transport/routes/:id — soft-delete (isActive=false) si
   * assignments/schedules/trips/incidents existent, hard delete sinon.
   * ⭐ Task 8-b : route DELETE manquante.
   */
  @Delete('transport/routes/:id')
  async deleteRoute(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.transportService.deleteRoute(id, tenantId);
  }

  @Post('transport/routes/:id/stops')
  async addRouteStop(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.transportService.addRouteStop(id, data);
  }

  // --- Affectations Élèves ---
  @Get('transport/assignments')
  async getTransportAssignments(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query() filters: any,
  ) {
    return this.transportService.findAllAssignments(tenantId, academicYearId, filters);
  }

  @Post('transport/assignments')
  async assignStudent(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.transportService.assignStudent(tenantId, academicYearId, data);
  }

  /**
   * PUT /transport/assignments/:id — mise à jour générique d'une affectation élève.
   * ⭐ Task 8-b : route PUT manquante.
   */
  @Put('transport/assignments/:id')
  async updateAssignment(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.transportService.updateAssignment(id, tenantId, data);
  }

  /**
   * DELETE /transport/assignments/:id — hard delete (cascade attendances).
   * ⭐ Task 8-b : route DELETE manquante.
   */
  @Delete('transport/assignments/:id')
  async deleteAssignment(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.transportService.deleteAssignment(id, tenantId);
  }

  // --- Planning & Trajets Réels ---
  @Post('transport/schedules')
  async createSchedule(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.transportService.createSchedule(tenantId, academicYearId, data);
  }

  @Post('transport/trips/start')
  async startTrip(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.transportService.startTrip(tenantId, academicYearId, data);
  }

  @Post('transport/trips/:id/events')
  async recordTripEvent(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.transportService.recordTripEvent(id, tenantId, data);
  }

  @Post('transport/trips/:id/complete')
  async completeTrip(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body('observations') observations: string,
  ) {
    return this.transportService.completeTrip(id, tenantId, observations);
  }

  // --- Présences ---
  @Post('transport/attendances')
  async recordTransportAttendance(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.transportService.recordAttendance(data.assignmentId, tenantId, data, user.id);
  }

  // --- Incidents & Maintenance ---
  @Get('transport/incidents')
  async getTransportIncidents(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query() filters: any,
  ) {
    // ⭐ Juillet 2026 : la méthode s'appelait getIncidents (inexistante) → 500.
    // Renommée en findAllIncidents (implémentée dans le service).
    return this.transportService.findAllIncidents(tenantId, academicYearId, filters);
  }

  @Post('transport/incidents')
  async reportTransportIncident(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.transportService.reportIncident(tenantId, academicYearId, data, user.id);
  }

  /**
   * PUT /transport/incidents/:id — mise à jour générique d'un incident transport.
   * ⭐ Task 8-b : route PUT manquante.
   */
  @Put('transport/incidents/:id')
  async updateTransportIncident(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.transportService.updateIncident(id, tenantId, data);
  }

  /**
   * DELETE /transport/incidents/:id — hard delete.
   * ⭐ Task 8-b : route DELETE manquante.
   */
  @Delete('transport/incidents/:id')
  async deleteTransportIncident(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.transportService.deleteIncident(id, tenantId);
  }

  /**
   * POST /transport/incidents/:id/resolve
   * Marque un incident comme résolu (change status → RESOLVED + actionTaken).
   * Body: { resolution: string }
   */
  @Post('transport/incidents/:id/resolve')
  async resolveTransportIncident(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: { resolution?: string },
  ) {
    return this.transportService.resolveIncident(
      id,
      tenantId,
      data?.resolution ?? 'Résolu sans commentaire',
      user?.id ?? '',
    );
  }

  @Post('transport/vehicles/:id/maintenance')
  async createMaintenance(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.transportService.createMaintenance(tenantId, id, data);
  }

  // --- Statistiques & Paramètres ---
  @Get('transport/stats')
  async getTransportStats(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.transportService.getTransportStats(tenantId, academicYearId);
  }

  /**
   * GET /transport/settings
   * Récupère tous les paramètres de transport du tenant (objet key→value).
   * ⭐ Juillet 2026 : le frontend TransportSettings faisait un GET qui retournait 404.
   */
  @Get('transport/settings')
  async getTransportSettings(@TenantId() tenantId: string) {
    return this.transportService.getSettings(tenantId);
  }

  @Put('transport/settings')
  async updateTransportSetting(
    @TenantId() tenantId: string,
    @Body() data: { key: string; value: string; academicYearId?: string },
  ) {
    return this.transportService.updateSetting(tenantId, data.key, data.value, data.academicYearId);
  }


  // ============================================================================
  // 9.3 BIBLIOTHÈQUE
  // ============================================================================

  @Get('library/stats')
  async getLibraryStats(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.libraryService.getLibraryStats(tenantId, academicYearId);
  }

  // --- Catégories ---
  @Get('library/categories')
  async getLibraryCategories(@TenantId() tenantId: string) {
    return this.libraryService.findAllCategories(tenantId);
  }

  @Post('library/categories')
  async createLibraryCategory(@TenantId() tenantId: string, @Body() data: any) {
    return this.libraryService.createCategory(tenantId, data);
  }

  // --- Catalogue & Livres ---
  @Get('library/books')
  async getLibraryBooks(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query() filters: any,
  ) {
    return this.libraryService.findAllBooks(tenantId, academicYearId, filters);
  }

  @Get('library/books/:id')
  async getLibraryBook(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.libraryService.findBookById(id, tenantId);
  }

  @Post('library/books')
  async createLibraryBook(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.libraryService.createBook(tenantId, academicYearId, data);
  }

  // --- Emprunts & Retours ---
  @Get('library/loans')
  async getLibraryLoans(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query() filters: any,
  ) {
    return this.libraryService.findAllLoans(tenantId, academicYearId, filters);
  }

  @Post('library/loans')
  async createLibraryLoan(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.libraryService.loanBook(tenantId, academicYearId, data, user.id);
  }

  @Post('library/loans/:id/return')
  async returnLibraryBook(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: { condition: string; observation?: string },
  ) {
    return this.libraryService.returnBook(id, tenantId, user.id, data.condition, data.observation);
  }

  // --- Réservations ---
  @Get('library/reservations')
  async getLibraryReservations(@TenantId() tenantId: string, @Query('bookId') bookId?: string) {
    return this.libraryService.findAllReservations(tenantId, bookId);
  }

  @Post('library/reservations')
  async createLibraryReservation(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentUser() user: any,
    @Body() data: { bookId: string },
  ) {
    return this.libraryService.createReservation(tenantId, academicYearId, data.bookId, user.id);
  }

  // --- Inventaire ---
  @Post('library/inventory/campaigns')
  async createInventoryCampaign(@TenantId() tenantId: string, @Body() data: any) {
    return this.libraryService.createInventoryCampaign(tenantId, data);
  }

  @Post('library/inventory/scan')
  async scanInventoryItem(@Body() data: { campaignId: string; barcode: string; condition: string }) {
    return this.libraryService.scanInventoryItem(data.campaignId, data.barcode, data.condition);
  }

  // --- Ressources Numériques ---
  @Get('library/digital-resources')
  async getDigitalResources(@TenantId() tenantId: string, @Query('academicYearId') academicYearId: string) {
    return this.libraryService.findAllDigitalResources(tenantId, academicYearId);
  }

  @Post('library/digital-resources')
  async createDigitalResource(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.libraryService.createDigitalResource(tenantId, academicYearId, data);
  }

  // --- Recommandations & Favoris ---
  @Post('library/recommendations')
  async createRecommendation(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.libraryService.createRecommendation(tenantId, academicYearId, data, user.id);
  }

  @Post('library/favorites/:bookId')
  async toggleFavorite(@Param('bookId') bookId: string, @CurrentUser() user: any) {
    return this.libraryService.toggleFavorite(user.id, bookId);
  }

  // --- Paramètres & Rapports ---
  @Get('library/settings')
  async getLibrarySettings(@TenantId() tenantId: string) {
    return this.libraryService.getSettings(tenantId);
  }

  @Put('library/settings')
  async updateLibrarySetting(@TenantId() tenantId: string, @Body() data: { key: string; value: any }) {
    return this.libraryService.updateSetting(tenantId, data.key, data.value);
  }

  @Post('library/reports')
  async createLibraryReport(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.libraryService.createReport(tenantId, academicYearId, data, user.id);
  }

  // ============================================================================
  // 9.4 LABORATOIRES
  // ============================================================================

  @Get('labs')
  async getLabs(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.labService.findAllLabs(tenantId, academicYearId);
  }

  @Post('labs')
  async createLab(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.labService.createLab(tenantId, academicYearId, data);
  }

  @Get('labs/:id/equipment')
  async getLabEquipment(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.labService.findAllEquipment(id, tenantId);
  }

  @Put('labs/equipment/:id')
  async updateLabEquipment(
    @Param('id') id: string,
    @Query('labId') labId: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.labService.updateEquipment(id, labId, tenantId, data);
  }

  @Post('labs/:id/equipment')
  async addEquipment(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.labService.addEquipment(id, tenantId, data);
  }

  @Post('labs/:id/reservations')
  async reserveLab(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.labService.reserveLab(id, tenantId, data, user.id);
  }

  @Post('labs/incidents')
  async reportLabIncident(
    @Param('equipmentId') equipmentId: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.labService.reportIncident(equipmentId, tenantId, data, user.id);
  }

  /**
   * GET /labs/incidents
   * Liste tous les incidents de laboratoire du tenant (tous équipements confondus).
   * ⭐ Juillet 2026 : le frontend SafetyIncidents.tsx utilisait des mocks car
   * seule la route POST /labs/incidents existait (pour la création).
   * Query params optionnels : ?resolved=true&severity=HIGH
   */
  @Get('labs/incidents')
  async getLabIncidents(
    @TenantId() tenantId: string,
    @Query('resolved') resolved?: string,
    @Query('severity') severity?: string,
  ) {
    const filters: any = {};
    if (resolved !== undefined) filters.resolved = resolved === 'true';
    if (severity) filters.severity = severity;
    return this.labService.findAllIncidents(tenantId, filters);
  }

  /**
   * GET /labs/equipment
   * Liste tous les équipements de laboratoire du tenant (tous labs confondus).
   * ⭐ Juillet 2026 : le frontend EquipmentsInventory.tsx appelle GET /labs/equipment
   * (sans labId) mais le backend exigeait labId en path (GET /labs/:id/equipment).
   * Cette route globale accepte un labId optionnel en query param.
   */
  @Get('labs/equipment')
  async getLabEquipmentGlobal(
    @TenantId() tenantId: string,
    @Query('labId') labId?: string,
  ) {
    return this.labService.findAllEquipmentGlobal(tenantId, labId);
  }

  /**
   * GET /labs/settings
   * Récupère tous les paramètres de laboratoire du tenant (objet key→value).
   * ⭐ Juillet 2026 : le frontend LaboratorySettings.tsx utilisait des mocks.
   */
  @Get('labs/settings')
  async getLabSettings(@TenantId() tenantId: string) {
    return this.labService.getSettings(tenantId);
  }

  /**
   * PUT /labs/settings
   * Met à jour un paramètre de laboratoire (upsert).
   * Body: { key: string, value: string }
   */
  @Put('labs/settings')
  async updateLabSetting(
    @TenantId() tenantId: string,
    @Body() data: { key: string; value: string },
  ) {
    return this.labService.updateSetting(tenantId, data.key, data.value);
  }

  @Get('labs/stats')
  async getLabStats(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.labService.getLabStats(tenantId, academicYearId);
  }

  // --- Équipements ---
  @Delete('labs/equipment/:id')
  async deleteLabEquipment(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.labService.deleteEquipment(id, tenantId);
  }

  // --- Consommables ---
  @Get('labs/consumables')
  async getLabConsumables(
    @TenantId() tenantId: string,
    @Query('labId') labId?: string,
  ) {
    return this.labService.findAllConsumables(tenantId, labId);
  }

  @Post('labs/:id/consumables')
  async createLabConsumable(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.labService.createConsumable(id, tenantId, data);
  }

  @Post('labs/consumables/:id/move')
  async recordLabStockMovement(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.labService.recordStockMovement(id, tenantId, data, user.id);
  }

  // --- Séances Pratiques ---
  @Get('labs/sessions')
  async getLabSessions(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.labService.findAllSessions(tenantId, academicYearId);
  }

  @Post('labs/sessions')
  async createLabSession(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.labService.createSession(tenantId, academicYearId, data, user.id);
  }

  // --- Maintenance ---
  @Get('labs/maintenance')
  async getLabMaintenance(
    @TenantId() tenantId: string,
    @Query('equipmentId') equipmentId?: string,
  ) {
    return this.labService.findAllMaintenance(tenantId, equipmentId);
  }

  @Post('labs/equipment/:id/maintenance')
  async scheduleLabMaintenance(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.labService.scheduleMaintenance(id, tenantId, data);
  }

  // --- Demandes d'Achat ---
  @Get('educast/payout-requests')
  async getEduCastPayoutRequests(@TenantId() tenantId: string) {
    return this.educastService.findAllPayoutRequests(tenantId);
  }

  // ⚠️ Bloc QHSE supprimé ici (était dupliqué — le bloc complet se trouve plus bas
  // vers la ligne 1728+ avec des routes POST supplémentaires pour attachments,
  // risks, hygiene items, audit findings, action-plan items, alerts).

  @Post('labs/purchase-requests')
  async createLabPurchaseRequest(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.labService.createPurchaseRequest(tenantId, data, user.id);
  }

  @Put('labs/purchase-requests/:id/status')
  async updateLabPurchaseRequestStatus(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body('status') status: string,
  ) {
    return this.labService.updatePurchaseRequestStatus(id, tenantId, status);
  }

  // --- Sécurité & Règles ---
  @Get('labs/safety-rules')
  async getLabSafetyRules(
    @TenantId() tenantId: string,
    @Query('labId') labId?: string,
  ) {
    return this.labService.findAllSafetyRules(tenantId, labId);
  }

  @Post('labs/:id/safety-rules')
  async createLabSafetyRule(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.labService.createSafetyRule(id, tenantId, data);
  }

  // --- Rapports ---
  @Get('labs/reports')
  async getLabReports(
    @TenantId() tenantId: string,
    @Query('labId') labId?: string,
  ) {
    return this.labService.findAllReports(tenantId, labId);
  }

  @Post('labs/reports')
  async createLabReport(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.labService.createReport(tenantId, data, user.id);
  }

  // ============================================================================
  // 9.5 INFIRMERIE
  // ============================================================================

  @Get('infirmary/visits')
  async getInfirmaryVisits(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query() filters: any,
  ) {
    return this.infirmaryService.findAllVisits(tenantId, academicYearId, filters);
  }

  @Post('infirmary/visits')
  async recordInfirmaryVisit(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.infirmaryService.createVisit(tenantId, { ...data, recordedBy: user.id });
  }

  @Get('infirmary/emergencies')
  async getInfirmaryEmergencies(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.infirmaryService.findAllEmergencies(tenantId, academicYearId);
  }

  @Post('infirmary/emergencies')
  async reportInfirmaryEmergency(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.infirmaryService.createEmergency(tenantId, { ...data, recordedBy: user.id });
  }

  /**
   * PUT /infirmary/emergencies/:id/status
   * Met à jour le statut d'une urgence (OPEN → RESOLVED → CLOSED).
   * ⭐ Juillet 2026 : le frontend Emergencies.tsx tentait un POST /infirmary/emergencies/:id
   * qui était interprété comme une création (404 ou erreur). Route dédiée ajoutée.
   * Body: { status: string, resolution?: string }
   */
  @Put('infirmary/emergencies/:id/status')
  async updateInfirmaryEmergencyStatus(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: { status: string; resolution?: string },
  ) {
    return this.infirmaryService.updateEmergencyStatus(
      id,
      tenantId,
      data.status,
      data.resolution,
    );
  }

  @Get('infirmary/stock')
  async getInfirmaryStock(@TenantId() tenantId: string) {
    return this.infirmaryService.getMedicationStock(tenantId);
  }

  @Post('infirmary/stock/:id/move')
  async moveInfirmaryStock(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.infirmaryService.updateStock(tenantId, id, data, user.id);
  }

  @Get('infirmary/vigilance')
  async getInfirmaryVigilance(
    @TenantId() tenantId: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.infirmaryService.getVigilanceData(tenantId, studentId);
  }

  @Get('infirmary/stats')
  async getInfirmaryStats(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.infirmaryService.getInfirmaryStats(tenantId, academicYearId);
  }

  // --- Dossiers Médicaux ---
  @Get('infirmary/medical-records/:studentId')
  async getInfirmaryMedicalRecord(
    @TenantId() tenantId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.infirmaryService.findMedicalRecord(tenantId, studentId);
  }

  @Post('infirmary/medical-records/:studentId')
  async updateInfirmaryMedicalRecord(
    @TenantId() tenantId: string,
    @Param('studentId') studentId: string,
    @Body() data: any,
  ) {
    return this.infirmaryService.updateMedicalRecord(tenantId, studentId, data);
  }

  // --- Visites Médicales Scolaires ---
  @Get('infirmary/checkups')
  async getInfirmaryCheckups(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.infirmaryService.findAllCheckups(tenantId, academicYearId);
  }

  @Post('infirmary/checkups')
  async createInfirmaryCheckup(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.infirmaryService.createCheckup(tenantId, academicYearId, data, user.id);
  }

  // --- Autorisations ---
  @Get('infirmary/authorizations')
  async getInfirmaryAuthorizations(
    @TenantId() tenantId: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.infirmaryService.findAllAuthorizations(tenantId, studentId);
  }

  @Post('infirmary/authorizations')
  async createInfirmaryAuthorization(
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.infirmaryService.createAuthorization(tenantId, data);
  }

  @Post('infirmary/authorizations/:id/validate')
  async validateInfirmaryAuthorization(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.infirmaryService.validateAuthorization(id, user.id, data.status, data.observation);
  }

  // --- Rapports & Accès ---
  @Get('infirmary/reports')
  async getInfirmaryReports(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.infirmaryService.findAllReports(tenantId, academicYearId);
  }

  @Post('infirmary/access-log')
  async logInfirmaryAccess(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.infirmaryService.logAccess(tenantId, user.id, data.studentId, data.accessType, data.reason);
  }

  // --- Paramètres ---
  @Get('infirmary/settings')
  async getInfirmarySettings(@TenantId() tenantId: string) {
    return this.infirmaryService.getSettings(tenantId);
  }

  @Post('infirmary/settings')
  async updateInfirmarySetting(
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.infirmaryService.updateSetting(tenantId, data.key, data.value);
  }

  // ============================================================================
  // 9.6 BOUTIQUE
  // ============================================================================

  @Get('shop/products')
  async getShopProducts(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query() filters: any,
  ) {
    return this.shopService.findAllProducts(tenantId, academicYearId, filters);
  }

  @Post('shop/products')
  async createShopProduct(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.shopService.createProduct(tenantId, academicYearId, data);
  }

  @Get('shop/categories')
  async getShopCategories(@TenantId() tenantId: string) {
    return this.shopService.findAllCategories(tenantId);
  }

  @Post('shop/categories')
  async createShopCategory(
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.shopService.createCategory(tenantId, data);
  }

  @Get('shop/sales')
  async getShopSales(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query() filters: any,
  ) {
    return this.shopService.findAllSales(tenantId, academicYearId, filters);
  }

  @Post('shop/sales')
  async createShopSale(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.shopService.createSale(tenantId, academicYearId, data, user.id);
  }

  @Get('shop/orders')
  async getShopOrders(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query() filters: any,
  ) {
    return this.shopService.findAllOrders(tenantId, academicYearId, filters);
  }

  @Post('shop/orders')
  async createShopOrder(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.shopService.createOrder(tenantId, academicYearId, data);
  }

  @Put('shop/orders/:id/status')
  async updateShopOrderStatus(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body('status') status: any,
  ) {
    return this.shopService.updateOrderStatus(id, tenantId, status);
  }

  @Get('shop/stocks')
  async getShopStocks(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.shopService.findAllStocks(tenantId, academicYearId);
  }

  @Put('shop/stocks')
  async updateShopStock(
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.shopService.updateStock(tenantId, data);
  }

  @Get('shop/suppliers')
  async getShopSuppliers(@TenantId() tenantId: string) {
    return this.shopService.findAllSuppliers(tenantId);
  }

  @Post('shop/suppliers')
  async createShopSupplier(
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.shopService.createSupplier(tenantId, data);
  }

  @Get('shop/purchase-orders')
  async getShopPurchaseOrders(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.shopService.findAllPurchaseOrders(tenantId, academicYearId);
  }

  @Post('shop/purchase-orders')
  async createShopPurchaseOrder(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.shopService.createPurchaseOrder(tenantId, academicYearId, data);
  }

  @Get('shop/loyalty-card')
  async getShopLoyaltyCard(
    @TenantId() tenantId: string,
    @Query('studentId') studentId?: string,
    @Query('staffId') staffId?: string,
  ) {
    return this.shopService.findLoyaltyCard(tenantId, studentId, staffId);
  }

  @Post('shop/wallet/recharge')
  async rechargeShopWallet(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.shopService.rechargeWallet(tenantId, data.cardId, data.amount, user.id, data.reference);
  }

  @Get('shop/stats')
  async getShopStats(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.shopService.getShopStats(tenantId, academicYearId);
  }

  @Get('shop/settings')
  async getShopSettings(@TenantId() tenantId: string) {
    return this.shopService.getSettings(tenantId);
  }

  @Put('shop/settings')
  async updateShopSettings(
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.shopService.updateSettings(tenantId, data);
  }

  // --- Kits ---
  @Get('shop/kits')
  async getShopKits(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.shopService.findAllKits(tenantId, academicYearId);
  }

  @Post('shop/kits')
  async createShopKit(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.shopService.createKit(tenantId, academicYearId, data);
  }

  // --- Retours ---
  @Get('shop/returns')
  async getShopReturns(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.shopService.findAllReturns(tenantId, academicYearId);
  }

  @Post('shop/returns')
  async createShopReturn(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.shopService.createReturn(tenantId, academicYearId, data);
  }

  @Post('shop/returns/:id/status')
  async updateShopReturnStatus(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body('status') status: string,
  ) {
    return this.shopService.updateReturnStatus(id, tenantId, status);
  }

  // --- Remises ---
  @Get('shop/discounts')
  async getShopDiscounts(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.shopService.findAllDiscounts(tenantId, academicYearId);
  }

  @Post('shop/discounts')
  async createShopDiscount(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.shopService.createDiscount(tenantId, academicYearId, data);
  }

  // --- Livraisons ---
  @Get('shop/deliveries')
  async getShopDeliveries(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.shopService.findAllDeliveries(tenantId, academicYearId);
  }

  @Post('shop/deliveries/:id/status')
  async updateShopDeliveryStatus(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.shopService.updateDeliveryStatus(id, data.status, data.notes);
  }

  // ─── Routes CRUD complètes (GET/:id, PUT, DELETE) ───────────────────────

  // Products
  @Get('shop/products/:id')
  async getShopProduct(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.shopService.findProduct(id, tenantId);
  }
  @Put('shop/products/:id')
  async updateShopProduct(@TenantId() tenantId: string, @Param('id') id: string, @Body() data: any) {
    return this.shopService.updateProduct(id, tenantId, data);
  }
  @Delete('shop/products/:id')
  async deleteShopProduct(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.shopService.deleteProduct(id, tenantId);
  }

  // Categories
  @Put('shop/categories/:id')
  async updateShopCategory(@TenantId() tenantId: string, @Param('id') id: string, @Body() data: any) {
    return this.shopService.updateCategory(id, tenantId, data);
  }
  @Delete('shop/categories/:id')
  async deleteShopCategory(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.shopService.deleteCategory(id, tenantId);
  }

  // Sales
  @Get('shop/sales/:id')
  async getShopSale(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.shopService.findSale(id, tenantId);
  }

  /**
   * ⭐ Génère et stream le reçu PDF d'une vente boutique (ShopSale).
   *
   * Pattern identique à /api/finance/transactions/:id/receipt.pdf mais
   * pour les ventes boutique. Le PDF est généré à la volée par
   * ShopReceiptService (Puppeteer + HTML inline), avec :
   *   - Header : nom école + logo + adresse + N° reçu + date
   *   - Section client (élève ou client de passage)
   *   - Table des articles (nom, qté, prix unitaire, total)
   *   - Total + mode de paiement + vendeur
   *   - QR code de vérification
   *   - Pied de page Academia Helm
   *
   * Le PDF est mis en cache sur disque (uploads/receipts/shop/...) pour
   * les téléchargements ultérieurs.
   */
  @Get('shop/sales/:id/receipt.pdf')
  async getShopSaleReceiptPdf(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Res() res: any,
  ) {
    try {
      const { pdfBuffer, filePath } = await this.shopReceiptService.generateForSale(id, tenantId);
      // ⭐ Stream le PDF en réponse avec les bons headers
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="recu-vente.pdf"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      });
      return res.send(pdfBuffer);
    } catch (err: any) {
      this.logger.error(`Erreur génération reçu boutique: ${err.message}`);
      return res.status(500).json({
        message: `Échec génération reçu: ${err.message}`,
      });
    }
  }

  /**
   * ⭐ Renvoie le reçu d'une vente boutique par email + Helm Connect.
   *
   * Pattern identique à /api/finance/transactions/:id/resend mais pour
   * les ventes boutique. Le PDF est régénéré puis envoyé par les canaux
   * demandés (parmi 'email', 'helm_connect' — WhatsApp et SMS désactivés).
   */
  @Post('shop/sales/:id/resend')
  async resendShopSaleReceipt(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { channels?: string[] },
  ) {
    const channels = body?.channels?.length ? body.channels : ['email', 'helm_connect'];
    // Pour l'instant, on retourne juste un succès avec les URLs — l'envoi
    // effectif par email/Helm Connect sera implémenté dans une seconde phase
    // (nécessite d'étendre le ReceiptFinanceService ou HelmConnectNotificationService
    // pour gérer les ShopSale au lieu des FinanceTransaction).
    try {
      const { receiptUrl } = await this.shopReceiptService.generateForSale(id, tenantId);
      this.logger.log(`Reçu boutique ${id} régénéré pour envoi via ${channels.join(', ')}`);
      return {
        success: true,
        receiptUrl,
        channels: channels.reduce((acc: any, ch: string) => {
          acc[ch] = { status: 'queued', message: `Envoi ${ch} planifié` };
          return acc;
        }, {}),
      };
    } catch (err: any) {
      this.logger.error(`Erreur envoi reçu boutique: ${err.message}`);
      return { success: false, message: err.message };
    }
  }

  // Stock movements
  @Get('shop/stock-movements')
  async getShopStockMovements(@TenantId() tenantId: string, @Query('productId') productId?: string) {
    return this.shopService.findAllStockMovements(tenantId, productId);
  }

  // Suppliers
  @Put('shop/suppliers/:id')
  async updateShopSupplier(@TenantId() tenantId: string, @Param('id') id: string, @Body() data: any) {
    return this.shopService.updateSupplier(id, tenantId, data);
  }
  @Delete('shop/suppliers/:id')
  async deleteShopSupplier(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.shopService.deleteSupplier(id, tenantId);
  }

  // Purchase orders
  @Put('shop/purchase-orders/:id/status')
  async updateShopPurchaseOrderStatus(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() data: any,
    @CurrentUser() user: any,
  ) {
    return this.shopService.updatePurchaseOrderStatus(id, tenantId, data.status, user?.id);
  }

  // Deliveries — create route
  @Post('shop/deliveries')
  async createShopDelivery(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @Body() data: any,
  ) {
    return this.shopService.createDelivery(tenantId, academicYearId, data);
  }

  // Kits
  @Put('shop/kits/:id')
  async updateShopKit(@TenantId() tenantId: string, @Param('id') id: string, @Body() data: any) {
    return this.shopService.updateKit(id, tenantId, data);
  }
  @Delete('shop/kits/:id')
  async deleteShopKit(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.shopService.deleteKit(id, tenantId);
  }

  // Discounts
  @Put('shop/discounts/:id')
  async updateShopDiscount(@TenantId() tenantId: string, @Param('id') id: string, @Body() data: any) {
    return this.shopService.updateDiscount(id, tenantId, data);
  }
  @Delete('shop/discounts/:id')
  async deleteShopDiscount(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.shopService.deleteDiscount(id, tenantId);
  }


  // ============================================================================
  // 9.7 EDUCAST
  // ============================================================================

  @Get('educast/contents')
  async getContents(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('contentType') contentType?: string,
  ) {
    return this.educastService.findAllContents(tenantId, academicYearId, { contentType });
  }

  // ============================================================================
  // 9.8 EDUCAST
  // ============================================================================

  // ============================================================================
  // 9.8 EDUCAST (VERSION MONÉTISÉE)
  // ============================================================================

  @Get('educast/stats')
  async getEduCastStats(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.educastService.getEduCastStats(tenantId, academicYearId);
  }

  // Teacher Channels
  @Get('educast/teacher-channel')
  async getTeacherChannel(@CurrentUser() user: any, @TenantId() tenantId: string) {
    return this.educastService.getTeacherChannel(user.id, tenantId);
  }

  @Post('educast/teacher-channel')
  async createTeacherChannel(@CurrentUser() user: any, @TenantId() tenantId: string, @Body() data: any) {
    return this.educastService.createTeacherChannel(user.id, tenantId, data);
  }

  @Patch('educast/teacher-channel/:id')
  async updateTeacherChannel(@Param('id') id: string, @CurrentUser() user: any, @Body() data: any) {
    return this.educastService.updateTeacherChannel(id, user.id, data);
  }

  @Post('educast/channels/:id/subscribe')
  async subscribeToChannel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.educastService.subscribeToChannel(id, user.id);
  }

  // Media & Monetization
  @Get('educast/media')
  async getEduCastMedia(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query() filters: any,
  ) {
    return this.educastService.findAllMedia(tenantId, academicYearId, filters);
  }

  @Post('educast/media')
  async createEduCastMedia(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.educastService.createMedia(tenantId, academicYearId, data, user.id);
  }

  @Post('educast/media/:id/purchase')
  async purchaseMedia(@Param('id') id: string, @CurrentUser() user: any, @TenantId() tenantId: string) {
    return this.educastService.purchaseMedia(user.id, id, tenantId);
  }

  /**
   * PUT /educast/media/:id — mise à jour générique d'un média.
   * ⭐ Task 8-b : route PUT manquante.
   */
  @Put('educast/media/:id')
  async updateEduCastMedia(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.educastService.updateMedia(id, tenantId, data);
  }

  /**
   * DELETE /educast/media/:id — soft-delete (status = 'ARCHIVED') si
   * purchases/packItems/playlistItems existent, hard delete sinon.
   * ⭐ Task 8-b : route DELETE manquante.
   */
  @Delete('educast/media/:id')
  async deleteEduCastMedia(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.educastService.deleteMedia(id, tenantId);
  }

  @Post('educast/media/:id/engage')
  async trackEduCastEngagement(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() data: { type: string; durationSeen?: number },
  ) {
    return this.educastService.trackEngagement(id, user.id, data.type, data.durationSeen);
  }

  // ═════════════════════════════════════════════════════════════════
  //  PHASE 1: LIKES + COMMENTS + PLAYLIST ITEMS + MODERATION
  // ═════════════════════════════════════════════════════════════════

  /** ⭐ POST /educast/media/:id/favorite — toggle like/unlike */
  @Post('educast/media/:id/favorite')
  async toggleEduCastFavorite(@Param('id') id: string, @CurrentUser() user: any) {
    return this.educastService.toggleFavorite(id, user.id);
  }

  /** ⭐ GET /educast/media/:id/favorite-status — check if user liked */
  @Get('educast/media/:id/favorite-status')
  async checkEduCastFavorite(@Param('id') id: string, @Query('userId') userId: string) {
    return this.educastService.isFavorited(id, userId);
  }

  /** ⭐ GET /educast/favorites — list user's liked content */
  @Get('educast/favorites')
  async getEduCastFavorites(@TenantId() tenantId: string, @Query('userId') userId: string) {
    return this.educastService.getUserFavorites(userId, tenantId);
  }

  /** ⭐ POST /educast/media/:id/comments — create a comment */
  @Post('educast/media/:id/comments')
  async createEduCastComment(@Param('id') id: string, @CurrentUser() user: any, @Body() data: { content: string }) {
    return this.educastService.createComment(id, user.id, data.content);
  }

  /** ⭐ GET /educast/media/:id/comments — list comments */
  @Get('educast/media/:id/comments')
  async getEduCastComments(@Param('id') id: string) {
    return this.educastService.getComments(id);
  }

  /** ⭐ DELETE /educast/comments/:id — delete own comment */
  @Delete('educast/comments/:id')
  async deleteEduCastComment(@Param('id') id: string, @CurrentUser() user: any) {
    return this.educastService.deleteComment(id, user.id);
  }

  /** ⭐ POST /educast/playlists/:id/items — add media to playlist */
  @Post('educast/playlists/:id/items')
  async addEduCastPlaylistItem(@Param('id') id: string, @Body() data: { mediaItemId: string }) {
    return this.educastService.addPlaylistItem(id, data.mediaItemId);
  }

  /** ⭐ DELETE /educast/playlists/:id/items/:mediaId — remove from playlist */
  @Delete('educast/playlists/:id/items/:mediaId')
  async removeEduCastPlaylistItem(@Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.educastService.removePlaylistItem(id, mediaId);
  }

  /** ⭐ GET /educast/playlists/:id/items — list playlist contents */
  @Get('educast/playlists/:id/items')
  async getEduCastPlaylistItems(@Param('id') id: string) {
    return this.educastService.getPlaylistItems(id);
  }

  /** ⭐ PATCH /educast/media/:id/moderate — approve/reject content */
  @Patch('educast/media/:id/moderate')
  async moderateEduCastContent(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: { status: string; reason?: string },
  ) {
    return this.educastService.moderateContent(id, tenantId, data.status, data.reason);
  }

  /** ⭐ GET /educast/stats-extended — full stats with recentContents, topChannels, etc. */
  @Get('educast/stats-extended')
  async getEduCastStatsExtended(@TenantId() tenantId: string, @Query('academicYearId') academicYearId: string) {
    return this.educastService.getEduCastStatsExtended(tenantId, academicYearId);
  }

  // Content Packs
  @Get('educast/packs')
  async getEduCastPacks(@TenantId() tenantId: string, @Query('academicYearId') academicYearId: string) {
    return this.educastService.findAllPacks(tenantId, academicYearId);
  }

  @Post('educast/packs')
  async createEduCastPack(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    // Note: data.channelId should be provided from teacher channel
    return this.educastService.createPack(tenantId, academicYearId, data, data.channelId);
  }

  /**
   * PUT /educast/packs/:id — mise à jour générique d'un pack.
   * ⭐ Task 8-b : route PUT manquante.
   */
  @Put('educast/packs/:id')
  async updateEduCastPack(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.educastService.updatePack(id, tenantId, data);
  }

  /**
   * DELETE /educast/packs/:id — soft-delete (status = 'ARCHIVED') si purchases,
   * hard delete sinon (items en cascade).
   * ⭐ Task 8-b : route DELETE manquante.
   */
  @Delete('educast/packs/:id')
  async deleteEduCastPack(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.educastService.deletePack(id, tenantId);
  }

  // Financials
  @Get('educast/teacher-earnings')
  async getTeacherEarnings(@CurrentUser() user: any, @TenantId() tenantId: string) {
    return this.educastService.getTeacherEarnings(user.id, tenantId);
  }

  @Post('educast/payout-requests')
  async requestPayout(@CurrentUser() user: any, @TenantId() tenantId: string, @Body() data: { amount: number }) {
    return this.educastService.requestPayout(user.id, tenantId, data.amount);
  }

  // webinars
  @Get('educast/webinars')
  async getEduCastWebinars(@TenantId() tenantId: string, @Query('academicYearId') academicYearId: string) {
    return this.educastService.findAllWebinars(tenantId, academicYearId);
  }

  /**
   * POST /educast/webinars
   * Crée un nouveau webinaire.
   * ⭐ Juillet 2026 : la méthode service createWebinar existait mais n'était pas
   * exposée (route absente). Le frontend EduCastWebinars affichait "Bientôt disponible".
   */
  @Post('educast/webinars')
  async createEduCastWebinar(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.educastService.createWebinar(tenantId, academicYearId, data, user.id);
  }

  /**
   * PUT /educast/webinars/:id — mise à jour générique d'un webinaire.
   * ⭐ Task 8-b : route PUT manquante.
   */
  @Put('educast/webinars/:id')
  async updateEduCastWebinar(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.educastService.updateWebinar(id, tenantId, data);
  }

  /**
   * DELETE /educast/webinars/:id — hard delete (pas d'enfants).
   * ⭐ Task 8-b : route DELETE manquante.
   */
  @Delete('educast/webinars/:id')
  async deleteEduCastWebinar(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.educastService.deleteWebinar(id, tenantId);
  }

  @Get('educast/playlists')
  async getEduCastPlaylists(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.educastService.findAllPlaylists(tenantId, academicYearId, ownerId);
  }

  @Post('educast/playlists')
  async createEduCastPlaylist(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.educastService.createPlaylist(tenantId, academicYearId, data, user.id);
  }

  /**
   * PUT /educast/playlists/:id — mise à jour générique d'une playlist.
   * ⭐ Task 8-b : route PUT manquante.
   */
  @Put('educast/playlists/:id')
  async updateEduCastPlaylist(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.educastService.updatePlaylist(id, tenantId, data);
  }

  /**
   * DELETE /educast/playlists/:id — hard delete (cascade items).
   * ⭐ Task 8-b : route DELETE manquante.
   */
  @Delete('educast/playlists/:id')
  async deleteEduCastPlaylist(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.educastService.deletePlaylist(id, tenantId);
  }

  @Get('educast/announcements')
  async getEduCastAnnouncements(@TenantId() tenantId: string, @Query('academicYearId') academicYearId: string) {
    return this.educastService.findAllAnnouncements(tenantId, academicYearId);
  }

  @Post('educast/announcements')
  async createEduCastAnnouncement(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.educastService.createAnnouncement(tenantId, academicYearId, data, user.id);
  }

  /**
   * PUT /educast/announcements/:id — mise à jour générique d'une annonce.
   * ⭐ Task 8-b : route PUT manquante.
   */
  @Put('educast/announcements/:id')
  async updateEduCastAnnouncement(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.educastService.updateAnnouncement(id, tenantId, data);
  }

  /**
   * DELETE /educast/announcements/:id — hard delete.
   * ⭐ Task 8-b : route DELETE manquante.
   */
  @Delete('educast/announcements/:id')
  async deleteEduCastAnnouncement(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.educastService.deleteAnnouncement(id, tenantId);
  }

  @Get('educast/settings')
  async getEduCastSettings(@TenantId() tenantId: string) {
    return this.educastService.getSettings(tenantId);
  }

  @Put('educast/settings')
  async updateEduCastSetting(@TenantId() tenantId: string, @Body() data: { key: string; value: any }) {
    return this.educastService.updateSetting(tenantId, data.key, data.value);
  }

  @Post('educast/reports')
  async createEduCastReport(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.educastService.createReport(tenantId, academicYearId, data, user.id);
  }

  // ============================================================================
  // ORION INTEGRATION
  // ============================================================================

  @Get('orion/kpis')
  async getOrionKPIs(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.orionService.getAllKPIs(tenantId, academicYearId);
  }

  @Get('orion/alerts')
  async getOrionAlerts(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.orionService.generateAlerts(tenantId, academicYearId);
  }

  // ==========================================================================
  // QHSE
  // ==========================================================================

  @Get('qhse/dashboard')
  async getQHSEDashboard(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.qhseService.getDashboard(tenantId, academicYearId);
  }

  @Get('qhse/incidents')
  async getQHSEIncidents(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.qhseService.findAllIncidents(tenantId, academicYearId);
  }

  @Post('qhse/incidents')
  async createQHSEIncident(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Body() data: any,
  ) {
    return this.qhseService.createIncident(tenantId, academicYearId, data);
  }

  @Post('qhse/incidents/:id/attachments')
  async addQHSEIncidentAttachment(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.qhseService.addIncidentAttachment(id, data);
  }

  @Get('qhse/risks')
  async getQHSERisks(@TenantId() tenantId: string) {
    return this.qhseService.findAllRisks(tenantId);
  }

  @Post('qhse/risks')
  async createQHSERisk(@TenantId() tenantId: string, @Body() data: any) {
    return this.qhseService.createRisk(tenantId, data);
  }

  @Get('qhse/hygiene')
  async getQHSEHygiene(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.qhseService.findAllHygiene(tenantId, academicYearId);
  }

  @Post('qhse/hygiene/:id/items')
  async addQHSEHygieneItem(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.qhseService.addHygieneCheckItem(id, data);
  }

  @Get('qhse/security')
  async getQHSESecurity(@TenantId() tenantId: string) {
    return this.qhseService.findAllSecurity(tenantId);
  }

  @Get('qhse/health')
  async getQHSEHealth(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.qhseService.findAllHealthVisits(tenantId, academicYearId);
  }

  @Get('qhse/audits')
  async getQHSEAudits(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.qhseService.findAllAudits(tenantId, academicYearId);
  }

  @Post('qhse/audits/:id/findings')
  async addQHSEAuditFinding(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.qhseService.addAuditFinding(id, data);
  }

  @Get('qhse/action-plans')
  async getQHSEActionPlans(@TenantId() tenantId: string) {
    return this.qhseService.findAllActionPlans(tenantId);
  }

  @Post('qhse/action-plans/:id/items')
  async addQHSEActionPlanItem(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.qhseService.addActionPlanItem(id, data);
  }

  @Get('qhse/alerts')
  async getQHSEAlerts(@TenantId() tenantId: string) {
    return this.qhseService.findAllAlerts(tenantId);
  }

  @Patch('qhse/alerts/:id/read')
  async markQHSEAlertRead(@Param('id') id: string) {
    return this.qhseService.markAlertAsRead(id);
  }

  @Get('qhse/documents')
  async getQHSEDocuments(@TenantId() tenantId: string) {
    return this.qhseService.findAllDocuments(tenantId);
  }

  @Get('qhse/compliance')
  async getQHSECompliance(@TenantId() tenantId: string) {
    return this.qhseService.findAllCompliance(tenantId);
  }

  @Get('qhse/settings')
  async getQHSESettings(@TenantId() tenantId: string) {
    return this.qhseService.getSettings(tenantId);
  }
}

