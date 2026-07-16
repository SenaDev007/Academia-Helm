import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { 
  CanteenMenuStatus, 
  CanteenEnrollmentStatus, 
  CanteenSubscriptionType, 
  MealServiceStatus, 
  StockMovementType, 
  PurchaseOrderStatus, 
  CanteenIncidentType, 
  CanteenSeverity,
  CanteenPaymentStatus
} from '@prisma/client';

/**
 * Service pour le sous-module 9.1 - Cantine Scolaire (Academia Helm)
 * Gère l'intégralité des opérations de restauration scolaire avec intelligence analytique.
 */
@Injectable()
export class CanteenService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // DASHBOARD & ORION ANALYTICS
  // ============================================================================

  async getDashboardStats(tenantId: string, academicYearId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [enrolledCount, todayMeals, lowStockCount, recentIncidents, todayMenu] = await Promise.all([
      this.prisma.canteenEnrollment.count({ where: { tenantId, academicYearId, status: CanteenEnrollmentStatus.VALIDATED } }),
      this.prisma.canteenMealService.count({
        where: {
          menu: { tenantId, academicYearId },
          serviceDate: today,
          status: MealServiceStatus.MEAL_SERVED
        }
      }),
      this.prisma.canteenFoodStock.count({
        where: {
          tenantId,
          quantity: { lte: this.prisma.canteenFoodStock.fields.alertThreshold }
        }
      }),
      this.prisma.canteenIncident.findMany({
        where: { tenantId, academicYearId },
        take: 5,
        orderBy: { createdAt: 'desc' }
      }),
      // Menu du jour pour affichage dans le dashboard
      this.prisma.canteenMenu.findMany({
        where: { tenantId, academicYearId, date: today },
        select: { period: true, mainPlate: true, accompaniment: true, entry: true, dessert: true },
        take: 5,
      }),
    ]);

    // ORION Insight Logic (Simulated for now, would use actual consumption data)
    const insight = {
      forecastTomorrow: Math.round(enrolledCount * 0.95),
      wasteReduction: "12.4%",
      avgCostPerMeal: 850
    };

    // ⭐ Juillet 2026 : Format aplati (stats à plat + todayMenu + alerts + recentActivity)
    // pour aligner avec l'interface CanteenStats du frontend CanteenDashboard.tsx
    // qui attend { enrolledStudents, mealsToday, stockAlerts, hygieneScore, todayMenu, alerts, recentActivity }
    return {
      // KPIs principaux (à plat pour le frontend)
      enrolledStudents: enrolledCount,
      mealsToday: todayMeals,
      stockAlerts: lowStockCount,
      hygieneScore: 'A+',
      // Menu du jour formaté pour le dashboard
      todayMenu: todayMenu.map((m) => ({
        label: m.period || 'Repas',
        value: [m.mainPlate, m.accompaniment, m.entry, m.dessert].filter(Boolean).join(' · '),
      })),
      // Alertes (incidents récents non résolus)
      alerts: recentIncidents.filter((i: any) => i.status !== 'RESOLVED').slice(0, 3),
      // Activité récente (incidents)
      recentActivity: recentIncidents.map((i: any) => ({
        id: i.id,
        label: i.incidentType || i.description?.substring(0, 50) || 'Incident',
        time: i.createdAt,
      })),
      // Compatibilité : conserver aussi l'ancien format imbriqué pour les autres consumers
      stats: { enrolledCount, todayMeals, lowStockCount, hygieneScore: 'A+' },
      recentIncidents,
      orion: insight,
    };
  }

  // ============================================================================
  // MENUS
  // ============================================================================

  async createMenu(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.canteenMenu.create({
      data: {
        tenantId,
        academicYearId,
        date: new Date(data.date),
        period: data.period,
        schoolLevel: data.schoolLevel,
        mainPlate: data.mainPlate,
        accompaniment: data.accompaniment,
        entry: data.entry,
        dessert: data.dessert,
        beverage: data.beverage,
        nutritionValue: data.nutritionValue || {},
        allergens: data.allergens || [],
        estimatedCost: data.estimatedCost,
        status: data.status || CanteenMenuStatus.DRAFT,
        observation: data.observation,
        imageUrl: data.imageUrl,
      },
    });
  }

  async findAllMenus(tenantId: string, academicYearId: string, filters?: any) {
    const where: any = { tenantId, academicYearId };
    if (filters?.date) where.date = new Date(filters.date);
    if (filters?.schoolLevel) where.schoolLevel = filters.schoolLevel;
    if (filters?.status) where.status = filters.status;

    return this.prisma.canteenMenu.findMany({
      where,
      include: { mealServices: true },
      orderBy: { date: 'desc' },
    });
  }

  async findMenu(id: string, tenantId: string) {
    const menu = await this.prisma.canteenMenu.findFirst({
      where: { id, tenantId },
      include: { mealServices: true },
    });
    if (!menu) throw new NotFoundException(`Menu non trouvé`);
    return menu;
  }

  async updateMenu(id: string, tenantId: string, data: any) {
    return this.prisma.canteenMenu.update({
      where: { id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      },
    });
  }

  async deleteMenu(id: string, tenantId: string) {
    return this.prisma.canteenMenu.delete({ where: { id } });
  }

  // ============================================================================
  // INSCRIPTIONS & ABONNEMENTS
  // ============================================================================

  async createSubscription(tenantId: string, data: any) {
    return this.prisma.canteenSubscription.create({
      data: {
        tenantId,
        name: data.name,
        type: data.type as CanteenSubscriptionType,
        price: data.price,
        description: data.description,
      },
    });
  }

  async enrollStudent(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.canteenEnrollment.create({
      data: {
        tenantId,
        academicYearId,
        studentId: data.studentId,
        subscriptionId: data.subscriptionId,
        dietId: data.dietId,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        activeDays: data.activeDays || [1, 2, 3, 4, 5],
        status: CanteenEnrollmentStatus.PENDING,
        observations: data.observations,
      },
    });
  }

  async findAllEnrollments(tenantId: string, academicYearId: string, filters?: any) {
    const where: any = { tenantId, academicYearId };
    if (filters?.status) where.status = filters.status;
    
    return this.prisma.canteenEnrollment.findMany({
      where,
      include: {
        student: true,
        subscription: true,
        diet: true,
        schoolLevel: true,
        class: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async validateEnrollment(id: string, status: CanteenEnrollmentStatus) {
    return this.prisma.canteenEnrollment.update({
      where: { id },
      data: { status }
    });
  }

  // ============================================================================
  // PRÉSENCES & SERVICES DE REPAS
  // ============================================================================

  async recordMealService(tenantId: string, data: any) {
    return this.prisma.canteenMealService.upsert({
      where: {
        enrollmentId_menuId_serviceDate: {
          enrollmentId: data.enrollmentId,
          menuId: data.menuId,
          serviceDate: new Date(data.serviceDate),
        },
      },
      update: {
        status: data.status as MealServiceStatus,
        serviceHour: data.serviceHour ? new Date(data.serviceHour) : undefined,
        isSpecialMeal: data.isSpecialMeal,
        observation: data.observation,
      },
      create: {
        enrollmentId: data.enrollmentId,
        menuId: data.menuId,
        serviceDate: new Date(data.serviceDate),
        status: data.status as MealServiceStatus,
        isSpecialMeal: data.isSpecialMeal,
        recordedBy: data.recordedBy,
      },
    });
  }

  async getAttendance(tenantId: string, academicYearId: string, date: Date) {
    return this.prisma.canteenAttendance.findMany({
      where: { tenantId, academicYearId, attendanceDate: date },
      include: { enrollment: { include: { student: true } } }
    });
  }

  // ============================================================================
  // RÉGIMES & ALLERGIES
  // ============================================================================

  async findAllDiets(tenantId: string) {
    return this.prisma.canteenDiet.findMany({ where: { tenantId } });
  }

  async findAllAllergies(tenantId: string) {
    return this.prisma.canteenAllergy.findMany({
      where: { tenantId },
      include: { student: true }
    });
  }

  // ============================================================================
  // STOCKS ALIMENTAIRES
  // ============================================================================

  async updateStock(tenantId: string, data: any) {
    const stock = await this.prisma.canteenFoodStock.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: data.name,
        },
      },
      update: {
        quantity: { increment: data.type === 'IN' ? data.quantity : -data.quantity },
      },
      create: {
        tenantId,
        name: data.name,
        category: data.category,
        quantity: data.quantity,
        unit: data.unit,
        alertThreshold: data.alertThreshold || 10,
      },
    });

    await this.prisma.canteenStockMovement.create({
      data: {
        tenantId,
        stockId: stock.id,
        type: data.type as StockMovementType,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        supplierId: data.supplierId,
        reference: data.reference,
      },
    });

    return stock;
  }

  async findAllStocks(tenantId: string) {
    return this.prisma.canteenFoodStock.findMany({
      where: { tenantId },
      include: { movements: { take: 10, orderBy: { date: 'desc' } } },
    });
  }

  // ============================================================================
  // FOURNISSEURS
  // ============================================================================

  async findAllSuppliers(tenantId: string) {
    return this.prisma.canteenSupplier.findMany({
      where: { tenantId },
      include: { purchaseOrders: true }
    });
  }

  async createSupplier(tenantId: string, data: any) {
    return this.prisma.canteenSupplier.create({
      data: {
        tenantId,
        ...data
      }
    });
  }

  // ============================================================================
  // INCIDENTS & HYGIÈNE
  // ============================================================================

  async reportIncident(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.canteenIncident.create({
      data: {
        tenantId,
        academicYearId,
        enrollmentId: data.enrollmentId,
        type: data.type as CanteenIncidentType,
        severity: data.severity as CanteenSeverity,
        description: data.description,
        immediateAction: data.immediateAction,
        isParentInformed: data.isParentInformed || false,
      },
    });
  }

  async findAllIncidents(tenantId: string, academicYearId: string) {
    return this.prisma.canteenIncident.findMany({
      where: { tenantId, academicYearId },
      include: { enrollment: { include: { student: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  // ============================================================================
  // PAIEMENTS
  // ============================================================================

  async recordPayment(tenantId: string, data: any) {
    return this.prisma.canteenPayment.create({
      data: {
        tenantId,
        enrollmentId: data.enrollmentId,
        amount: data.amount,
        discount: data.discount || 0,
        penalty: data.penalty || 0,
        status: CanteenPaymentStatus.PAID,
        paymentMode: data.paymentMode,
        paymentDate: new Date(),
        period: data.period,
      },
    });
  }

  async findAllPayments(tenantId: string, filters?: any) {
    return this.prisma.canteenPayment.findMany({
      where: { tenantId, ...filters },
      include: { enrollment: { include: { student: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  // ============================================================================
  // PARAMÈTRES
  // ============================================================================

  async updateSettings(tenantId: string, data: any) {
    return this.prisma.canteenSettings.upsert({
      where: { tenantId },
      update: data,
      create: {
        tenantId,
        ...data,
      },
    });
  }

  async getSettings(tenantId: string) {
    return this.prisma.canteenSettings.findUnique({ where: { tenantId } });
  }

  // ============================================================================
  // ⭐ CRUD COMPLÉMENTAIRE (Task 8-b) — DELETE + UPDATE + CREATE manquants
  // ============================================================================
  // Patterns :
  //  - findFirst({ where: { id, tenantId } }) pour l'isolation tenant
  //  - NotFoundException si l'entité n'existe pas
  //  - Soft-delete (isActive = false) si enfants existent, hard delete sinon
  // ============================================================================

  /**
   * PUT /canteen/enrollments/:id — mise à jour générique d'une inscription
   * (différente de la validation qui ne change que le statut).
   */
  async updateEnrollment(id: string, tenantId: string, data: any) {
    const enrollment = await this.prisma.canteenEnrollment.findFirst({ where: { id, tenantId } });
    if (!enrollment) throw new NotFoundException(`Inscription cantine introuvable (id=${id}).`);

    const updateData: any = { ...data };
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    delete updateData.id;
    delete updateData.tenantId;

    return this.prisma.canteenEnrollment.update({ where: { id }, data: updateData });
  }

  /**
   * DELETE /canteen/enrollments/:id — hard delete (cascade attendances/mealServices/payments).
   * CanteenAttendance, CanteenMealService et CanteenPayment ont onDelete: Cascade sur
   * enrollmentId. Les CanteenIncident (enrollment optionnel) seront SetNull.
   */
  async deleteEnrollment(id: string, tenantId: string): Promise<{ success: boolean }> {
    const enrollment = await this.prisma.canteenEnrollment.findFirst({ where: { id, tenantId } });
    if (!enrollment) throw new NotFoundException(`Inscription cantine introuvable (id=${id}).`);

    await this.prisma.canteenEnrollment.delete({ where: { id } });
    return { success: true };
  }

  /**
   * POST /canteen/diets — création d'un régime alimentaire.
   */
  async createDiet(tenantId: string, data: any) {
    return this.prisma.canteenDiet.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        forbiddenFoods: data.forbiddenFoods || [],
        instructions: data.instructions,
        isActive: data.isActive !== false,
        academicYearId: data.academicYearId,
      },
    });
  }

  /**
   * PUT /canteen/diets/:id — mise à jour générique d'un régime.
   */
  async updateDiet(id: string, tenantId: string, data: any) {
    const diet = await this.prisma.canteenDiet.findFirst({ where: { id, tenantId } });
    if (!diet) throw new NotFoundException(`Régime introuvable (id=${id}).`);

    const updateData: any = { ...data };
    delete updateData.id;
    delete updateData.tenantId;

    return this.prisma.canteenDiet.update({ where: { id }, data: updateData });
  }

  /**
   * DELETE /canteen/diets/:id — soft-delete (isActive = false) si enrollments liés,
   * hard delete sinon.
   */
  async deleteDiet(id: string, tenantId: string): Promise<{ success: boolean }> {
    const diet = await this.prisma.canteenDiet.findFirst({ where: { id, tenantId } });
    if (!diet) throw new NotFoundException(`Régime introuvable (id=${id}).`);

    const enrollmentsCount = await this.prisma.canteenEnrollment.count({
      where: { dietId: id },
    });

    if (enrollmentsCount > 0) {
      // On conserve le régime pour préserver l'historique des inscriptions.
      await this.prisma.canteenDiet.update({ where: { id }, data: { isActive: false } });
      return { success: true };
    }

    await this.prisma.canteenDiet.delete({ where: { id } });
    return { success: true };
  }

  /**
   * POST /canteen/allergies — création d'une allergy.
   */
  async createAllergy(tenantId: string, data: any) {
    return this.prisma.canteenAllergy.create({
      data: {
        tenantId,
        studentId: data.studentId,
        allergen: data.allergen,
        severity: data.severity || 'MEDIUM',
        forbiddenFoods: data.forbiddenFoods || [],
        instructions: data.instructions,
        emergencyContact: data.emergencyContact,
        medicalDocUrl: data.medicalDocUrl,
        isActive: data.isActive !== false,
        academicYearId: data.academicYearId,
      },
    });
  }

  /**
   * PUT /canteen/allergies/:id — mise à jour générique d'une allergy.
   */
  async updateAllergy(id: string, tenantId: string, data: any) {
    const allergy = await this.prisma.canteenAllergy.findFirst({ where: { id, tenantId } });
    if (!allergy) throw new NotFoundException(`Allergie introuvable (id=${id}).`);

    const updateData: any = { ...data };
    delete updateData.id;
    delete updateData.tenantId;

    return this.prisma.canteenAllergy.update({ where: { id }, data: updateData });
  }

  /**
   * DELETE /canteen/allergies/:id — hard delete (pas d'enfants).
   */
  async deleteAllergy(id: string, tenantId: string): Promise<{ success: boolean }> {
    const allergy = await this.prisma.canteenAllergy.findFirst({ where: { id, tenantId } });
    if (!allergy) throw new NotFoundException(`Allergie introuvable (id=${id}).`);

    await this.prisma.canteenAllergy.delete({ where: { id } });
    return { success: true };
  }

  /**
   * PUT /canteen/suppliers/:id — mise à jour générique d'un fournisseur.
   */
  async updateSupplier(id: string, tenantId: string, data: any) {
    const supplier = await this.prisma.canteenSupplier.findFirst({ where: { id, tenantId } });
    if (!supplier) throw new NotFoundException(`Fournisseur introuvable (id=${id}).`);

    const updateData: any = { ...data };
    delete updateData.id;
    delete updateData.tenantId;

    return this.prisma.canteenSupplier.update({ where: { id }, data: updateData });
  }

  /**
   * DELETE /canteen/suppliers/:id — soft-delete (isActive = false) si purchaseOrders,
   * hard delete sinon.
   */
  async deleteSupplier(id: string, tenantId: string): Promise<{ success: boolean }> {
    const supplier = await this.prisma.canteenSupplier.findFirst({ where: { id, tenantId } });
    if (!supplier) throw new NotFoundException(`Fournisseur introuvable (id=${id}).`);

    const [purchaseOrdersCount, stockMovementsCount] = await Promise.all([
      this.prisma.canteenPurchaseOrder.count({ where: { supplierId: id } }),
      this.prisma.canteenStockMovement.count({ where: { supplierId: id } }),
    ]);

    if (purchaseOrdersCount + stockMovementsCount > 0) {
      // On conserve le fournisseur pour préserver l'historique des commandes.
      await this.prisma.canteenSupplier.update({ where: { id }, data: { isActive: false } });
      return { success: true };
    }

    await this.prisma.canteenSupplier.delete({ where: { id } });
    return { success: true };
  }

  /**
   * PUT /canteen/incidents/:id — mise à jour générique d'un incident cantine.
   */
  async updateIncident(id: string, tenantId: string, data: any) {
    const incident = await this.prisma.canteenIncident.findFirst({ where: { id, tenantId } });
    if (!incident) throw new NotFoundException(`Incident cantine introuvable (id=${id}).`);

    const updateData: any = { ...data };
    delete updateData.id;
    delete updateData.tenantId;

    return this.prisma.canteenIncident.update({ where: { id }, data: updateData });
  }

  /**
   * DELETE /canteen/incidents/:id — hard delete (pas d'enfants).
   */
  async deleteIncident(id: string, tenantId: string): Promise<{ success: boolean }> {
    const incident = await this.prisma.canteenIncident.findFirst({ where: { id, tenantId } });
    if (!incident) throw new NotFoundException(`Incident cantine introuvable (id=${id}).`);

    await this.prisma.canteenIncident.delete({ where: { id } });
    return { success: true };
  }

  /**
   * PUT /canteen/payments/:id — mise à jour générique d'un paiement.
   */
  async updatePayment(id: string, tenantId: string, data: any) {
    const payment = await this.prisma.canteenPayment.findFirst({ where: { id, tenantId } });
    if (!payment) throw new NotFoundException(`Paiement cantine introuvable (id=${id}).`);

    const updateData: any = { ...data };
    if (data.amount !== undefined && data.amount !== null) updateData.amount = parseFloat(data.amount);
    if (data.discount !== undefined && data.discount !== null) updateData.discount = parseFloat(data.discount);
    if (data.penalty !== undefined && data.penalty !== null) updateData.penalty = parseFloat(data.penalty);
    if (data.paymentDate) updateData.paymentDate = new Date(data.paymentDate);
    delete updateData.id;
    delete updateData.tenantId;

    return this.prisma.canteenPayment.update({ where: { id }, data: updateData });
  }

  /**
   * DELETE /canteen/payments/:id — hard delete (pas d'enfants).
   */
  async deletePayment(id: string, tenantId: string): Promise<{ success: boolean }> {
    const payment = await this.prisma.canteenPayment.findFirst({ where: { id, tenantId } });
    if (!payment) throw new NotFoundException(`Paiement cantine introuvable (id=${id}).`);

    await this.prisma.canteenPayment.delete({ where: { id } });
    return { success: true };
  }

  /**
   * DELETE /canteen/stocks/:id — soft-delete (isActive = false) si mouvements,
   * hard delete sinon (movements en cascade).
   */
  async deleteStock(id: string, tenantId: string): Promise<{ success: boolean }> {
    const stock = await this.prisma.canteenFoodStock.findFirst({ where: { id, tenantId } });
    if (!stock) throw new NotFoundException(`Stock introuvable (id=${id}).`);

    const movementsCount = await this.prisma.canteenStockMovement.count({
      where: { stockId: id },
    });

    if (movementsCount > 0) {
      // On conserve le stock pour préserver l'historique des mouvements.
      await this.prisma.canteenFoodStock.update({ where: { id }, data: { isActive: false } });
      return { success: true };
    }

    // Hard delete — pas de mouvements, on peut supprimer.
    await this.prisma.canteenFoodStock.delete({ where: { id } });
    return { success: true };
  }
}

