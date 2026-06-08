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

    const [enrolledCount, todayMeals, lowStockCount, recentIncidents] = await Promise.all([
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
      })
    ]);

    // ORION Insight Logic (Simulated for now, would use actual consumption data)
    const insight = {
      forecastTomorrow: Math.round(enrolledCount * 0.95),
      wasteReduction: "12.4%",
      avgCostPerMeal: 850
    };

    return {
      stats: { enrolledCount, todayMeals, lowStockCount, hygieneScore: "A+" },
      recentIncidents,
      orion: insight
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
}

