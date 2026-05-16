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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CanteenService } from './services/canteen.service';
import { TransportService } from './services/transport.service';
import { LibraryService } from './services/library.service';
import { LabService } from './services/lab.service';
import { InfirmaryService } from './services/infirmary.service';
import { ShopService } from './services/shop.service';
import { EducastService } from './services/educast.service';
import { QHSEService } from './services/qhse.service';
import { ModulesComplementairesOrionService } from './services/modules-complementaires-orion.service';

/**
 * Controller pour le MODULE 9 — Modules Complémentaires
 */
@Controller('modules-complementaires')
@UseGuards(JwtAuthGuard)
export class ModulesComplementairesController {
  constructor(
    private readonly canteenService: CanteenService,
    private readonly transportService: TransportService,
    private readonly libraryService: LibraryService,
    private readonly labService: LabService,
    private readonly infirmaryService: InfirmaryService,
    private readonly shopService: ShopService,
    private readonly educastService: EducastService,
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

  @Get('canteen/allergies')
  async getCanteenAllergies(@TenantId() tenantId: string) {
    return this.canteenService.findAllAllergies(tenantId);
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
    return this.transportService.getIncidents(tenantId, academicYearId, filters);
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

  @Get('qhse/risks')
  async getQHSERisks(@TenantId() tenantId: string) {
    return this.qhseService.findAllRisks(tenantId);
  }

  @Get('qhse/hygiene')
  async getQHSEHygiene(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.qhseService.findAllHygiene(tenantId, academicYearId);
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

  @Get('qhse/action-plans')
  async getQHSEActionPlans(@TenantId() tenantId: string) {
    return this.qhseService.findAllActionPlans(tenantId);
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

  @Post('educast/media/:id/engage')
  async trackEduCastEngagement(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() data: { type: string; durationSeen?: number },
  ) {
    return this.educastService.trackEngagement(id, user.id, data.type, data.durationSeen);
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

