/**
 * ============================================================================
 * TAX DECLARATION SERVICE — Déclarations fiscales (IST, AIB, CNSS)
 * ============================================================================
 *
 * Génère et gère les déclarations fiscales avec calculs automatiques
 * basés sur les taux configurables (TaxSettings).
 *
 * IST  — Impôt sur Salaires et Traitements (mensuel)
 * AIB  — Abattement à l'Impôt des Bénéfices (mensuel)
 * CNSS — Déclaration nominative trimestrielle
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TaxSettingsService } from './tax-settings.service';

@Injectable()
export class TaxDeclarationService {
  private readonly logger = new Logger(TaxDeclarationService.name);

  constructor(
    private prisma: PrismaService,
    private taxSettingsService: TaxSettingsService,
  ) {}

  /**
   * Génère ou récupère la déclaration IST pour une période.
   * L'IST = IRPP + VPS (Versement Patronal sur Salaires)
   */
  async getOrGenerateIST(tenantId: string, academicYearId: string, period: string) {
    // Vérifier si la déclaration existe déjà
    let declaration = await this.prisma.taxDeclaration.findFirst({
      where: { tenantId, academicYearId, type: 'IST', period },
    });

    if (declaration) return declaration;

    // Générer depuis les données de paie du personnel
    const settings = await this.taxSettingsService.getOrCreate(tenantId);

    // Récupérer les salaires bruts du mois (depuis PayrollPrismaService ou Staff)
    const payrollData = await this.getMonthlyPayrollData(tenantId, period);

    const totalGrossSalary = payrollData.totalGross;
    const staffCount = payrollData.staffCount;

    // Calculs
    const vps = totalGrossSalary * (settings.istVpsRate / 100);
    const irpp = totalGrossSalary * (settings.istIrppRate / 100); // Si 0, calcul auto selon barème (à implémenter)
    const totalIST = vps + irpp;

    const data = {
      staffCount,
      totalGrossSalary,
      vpsRate: settings.istVpsRate,
      irppRate: settings.istIrppRate,
      vps,
      irpp,
      totalIST,
      staffDetails: payrollData.details,
      // Section paiement (à compléter par l'utilisateur)
      payment: {
        mode: '', // ESPECES, CHEQUE, VIREMENT
        chequeNumber: '',
        bank: '',
        reference: '',
        amountInWords: '',
      },
      // Pénalités (à compléter par l'utilisateur)
      penalties: {
        irpp: 0,
        irppReason: '',
        vps: 0,
        vpsReason: '',
        total: 0,
      },
      // Cadre administration
      quittanceNumber: '',
      submissionDate: '',
    };

    declaration = await this.prisma.taxDeclaration.create({
      data: {
        tenantId,
        academicYearId,
        type: 'IST',
        period,
        status: 'DRAFT',
        data: data as any,
        totalAmount: totalIST,
      },
    });

    return declaration;
  }

  /**
   * Génère ou récupère la déclaration CNSS pour un trimestre.
   */
  async getOrGenerateCNSS(tenantId: string, academicYearId: string, period: string) {
    let declaration = await this.prisma.taxDeclaration.findFirst({
      where: { tenantId, academicYearId, type: 'CNSS', period },
    });

    if (declaration) return declaration;

    const settings = await this.taxSettingsService.getOrCreate(tenantId);
    const payrollData = await this.getQuarterlyPayrollData(tenantId, period);

    const totalSalary = payrollData.totalGross;

    // Calculs CNSS
    const cotisationsFamiliales = totalSalary * (settings.cnssFamilialesRate / 100);
    const risquesPro = totalSalary * (settings.cnssRisquesRate / 100);
    const assuranceVieillesse = totalSalary * (settings.cnssVieillesseRate / 100);
    const partPatronale = totalSalary * (settings.cnssPatronaleRate / 100);
    const partOuvriere = totalSalary * (settings.cnssOuvriereRate / 100);
    const totalCotisations = cotisationsFamiliales + risquesPro + assuranceVieillesse + partPatronale + partOuvriere;

    const data = {
      totalSalary,
      rates: {
        familiales: settings.cnssFamilialesRate,
        risques: settings.cnssRisquesRate,
        vieillesse: settings.cnssVieillesseRate,
        patronale: settings.cnssPatronaleRate,
        ouvriere: settings.cnssOuvriereRate,
      },
      cotisationsFamiliales,
      risquesPro,
      assuranceVieillesse,
      partPatronale,
      partOuvriere,
      totalCotisations,
      majorations: 0, // Calculé si retard
      totalAPayer: totalCotisations,
      // Détail par employé (jours ouvrables et rémunération par mois)
      staffDetails: payrollData.details,
      months: payrollData.months || [],
      // Section paiement (à compléter par l'utilisateur)
      payment: {
        mode: '', // VIREMENT, CHEQUE, ESPECES
        bank: '',
        chequeNumber: '',
        reference: '',
      },
    };

    declaration = await this.prisma.taxDeclaration.create({
      data: {
        tenantId,
        academicYearId,
        type: 'CNSS',
        period,
        status: 'DRAFT',
        data: data as any,
        totalAmount: totalCotisations,
      },
    });

    return declaration;
  }

  /**
   * Génère ou récupère la déclaration AIB pour une période.
   * AIB 1% sur achats + AIB 5% sur prestations.
   */
  async getOrGenerateAIB(tenantId: string, academicYearId: string, period: string, baseAchats = 0, basePrestations = 0) {
    let declaration = await this.prisma.taxDeclaration.findFirst({
      where: { tenantId, academicYearId, type: 'AIB', period },
    });

    if (declaration) return declaration;

    const settings = await this.taxSettingsService.getOrCreate(tenantId);

    const aibAchats = baseAchats * (settings.aibAchatsRate / 100);
    const aibPrestations = basePrestations * (settings.aibPrestationsRate / 100);
    const totalAIB = aibAchats + aibPrestations;

    const data = {
      baseAchats,
      basePrestations,
      rates: {
        achats: settings.aibAchatsRate,
        prestations: settings.aibPrestationsRate,
      },
      aibAchats,
      aibPrestations,
      totalAIB,
      // Section IV — Détail des prélèvements AIB (prestataires)
      prestataires: [] as Array<{
        name: string; address: string; ifu: string; base: number; prelevement: number;
      }>,
      // Section paiement
      payment: {
        mode: '', // ESPECES, CHEQUE, VIREMENT
        bank: '',
        chequeNumber: '',
        reference: '',
      },
      // Cadre administration
      quittanceNumber: '',
      emissionDate: '',
      penalty: 0,
    };

    declaration = await this.prisma.taxDeclaration.create({
      data: {
        tenantId,
        academicYearId,
        type: 'AIB',
        period,
        status: 'DRAFT',
        data: data as any,
        totalAmount: totalAIB,
      },
    });

    return declaration;
  }

  /**
   * Récupère toutes les déclarations d'un type pour une année.
   */
  async listByType(tenantId: string, academicYearId: string, type?: string) {
    return this.prisma.taxDeclaration.findMany({
      where: { tenantId, academicYearId, ...(type ? { type } : {}) },
      orderBy: { period: 'desc' },
    });
  }

  /**
   * Met à jour le statut d'une déclaration.
   */
  async updateStatus(id: string, status: string, notes?: string) {
    return this.prisma.taxDeclaration.update({
      where: { id },
      data: {
        status,
        notes,
        submittedAt: status === 'SUBMITTED' ? new Date() : undefined,
        paidAt: status === 'PAID' ? new Date() : undefined,
      },
    });
  }

  /**
   * Récupère une déclaration par ID.
   */
  async getById(id: string) {
    const decl = await this.prisma.taxDeclaration.findUnique({ where: { id } });
    if (!decl) throw new NotFoundException('Déclaration introuvable');
    return decl;
  }

  // ─── Helpers : données de paie ───────────────────────────────────────────

  /**
   * Récupère les salaires bruts du mois pour le calcul IST.
   */
  private async getMonthlyPayrollData(tenantId: string, period: string) {
    // period = "2026-01" (YYYY-MM)
    // Pour l'instant, on récupère les salaires de base du personnel
    // TODO: brancher sur PayrollPrismaService quand disponible
    const staff = await this.prisma.staff.findMany({
      where: { tenantId, status: { not: 'ARCHIVED' } },
      select: { id: true, firstName: true, lastName: true, salary: true, cnssNumber: true },
    });

    const details = staff.map(s => ({
      staffId: s.id,
      name: `${s.firstName} ${s.lastName}`,
      grossSalary: Number(s.salary || 0),
      cnssNumber: s.cnssNumber || '',
    }));

    return {
      totalGross: details.reduce((sum, d) => sum + d.grossSalary, 0),
      staffCount: details.length,
      details,
    };
  }

  /**
   * Récupère les salaires bruts du trimestre pour le calcul CNSS.
   * Inclut le détail par employé avec jours ouvrables et rémunération par mois (3 mois).
   */
  private async getQuarterlyPayrollData(tenantId: string, period: string) {
    // period = "2026-T1" → extraire l'année et les 3 mois
    const yearMatch = period.match(/^(\d{4})-T(\d)$/);
    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
    const quarter = yearMatch ? parseInt(yearMatch[2]) : 1;
    const startMonth = (quarter - 1) * 3 + 1; // T1=1, T2=4, T3=7, T4=10
    const months = [startMonth, startMonth + 1, startMonth + 2];

    const staff = await this.prisma.staff.findMany({
      where: { tenantId, status: { not: 'ARCHIVED' } },
      select: { id: true, firstName: true, lastName: true, salary: true, cnssNumber: true },
    });

    // Pour chaque employé: jours ouvrables et rémunération par mois
    const details = staff.map(s => {
      const monthlySalary = Number(s.salary || 0);
      // Jours ouvrables standards (approximation: 26 jours par mois au Bénin)
      const daysMonth1 = 26, daysMonth2 = 26, daysMonth3 = 26;
      const totalDays = daysMonth1 + daysMonth2 + daysMonth3;

      return {
        staffId: s.id,
        cnssNumber: s.cnssNumber || '',
        name: `${s.firstName} ${s.lastName}`,
        // Détail par mois (jours ouvrables)
        daysMonth1, daysMonth2, daysMonth3,
        totalDaysAssimilés: totalDays,
        // Rémunération par mois
        salaryMonth1: monthlySalary,
        salaryMonth2: monthlySalary,
        salaryMonth3: monthlySalary,
        grossSalary: monthlySalary * 3, // Salaire brut trimestriel
      };
    });

    return {
      totalGross: details.reduce((sum, d) => sum + d.grossSalary, 0),
      staffCount: details.length,
      details,
      months: months.map(m => `${year}-${String(m).padStart(2, '0')}`),
    };
  }
}
