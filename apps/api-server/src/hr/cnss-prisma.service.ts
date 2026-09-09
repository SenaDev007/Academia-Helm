/**
 * ============================================================================
 * CNSS PRISMA SERVICE - MODULE 5 (SCHEMA-ALIGNED v3)
 * ============================================================================
 *
 * Service de gestion CNSS, aligné sur le schéma Prisma réel.
 *
 * Modèles clés:
 *  - CNSSRate             : Taux CNSS par pays (countryCode, employeeRate, employerRate, salaryCeiling)
 *                          Pas de tenantId — global par pays
 *  - EmployeeCNSS         : Affiliation CNSS par agent (staffId unique, cnssNumber)
 *  - CNSSDeclaration      : Déclaration mensuelle (month, totalEmployeeShare, totalEmployerShare)
 *                          Statuts: DRAFT → SUBMITTED → PAID
 *  - CNSSDeclarationLine  : Ligne par agent affilié (employeeCNSSId, employeeShare, employerShare)
 *
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

@Injectable()
export class CNSSPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // EXPORT CNSS — salariés déclarés + règle de fréquence de versement
  // ============================================================================

  /**
   * ⭐ Vue d'export CNSS (RH Bénin) — filtre UNIQUEMENT les salariés déclarés et
   * applique la règle de fréquence de versement issue de la procédure CNSS :
   *   effectif déclaré ≥ seuil (payroll_fiscal_rates.cnssMensuelSeuil, 20 par défaut)
   *     → versement MENSUEL
   *   effectif déclaré < seuil → versement TRIMESTRIEL
   *
   * Salariés « déclarés » = statutContractuel = SALARIE_DECLARE, ou (héritage)
   * staff sans statut mais avec affiliation EmployeeCNSS active + n° CNSS.
   * Retourne la synthèse + un CSV prêt à télécharger.
   */
  async getExportSummary(tenantId: string) {
    // 1. Salariés déclarés
    const declared = await this.prisma.staff.findMany({
      where: {
        tenantId,
        status: { not: 'ARCHIVED' },
        OR: [
          { statutContractuel: 'SALARIE_DECLARE' },
          {
            statutContractuel: null,
            employeeCNSS: { isActive: true, cnssNumber: { not: null } },
          },
        ],
      },
      select: {
        id: true,
        employeeNumber: true,
        globalMatricule: true,
        tenantMatricule: true,
        firstName: true,
        lastName: true,
        position: true,
        roleType: true,
        hireDate: true,
        salary: true,
        cnssNumber: true,
        cnssDeclarationDate: true,
        employeeCNSS: { select: { cnssNumber: true, affiliationDate: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const rows = declared.map((s: any) => ({
      matricule: s.tenantMatricule || s.globalMatricule || s.employeeNumber,
      nom: s.lastName,
      prenoms: s.firstName,
      poste: s.position || '',
      cnssNumber: s.cnssNumber || s.employeeCNSS?.cnssNumber || '',
      affiliationDate: s.cnssDeclarationDate || s.employeeCNSS?.affiliationDate || null,
      hireDate: s.hireDate,
      salary: s.salary != null ? Number(s.salary) : null,
    }));

    // 2. Seuil + fréquence (payroll_fiscal_rates — jamais en dur)
    const rates = await this.prisma.payrollFiscalRate.findFirst({
      where: { countryCode: 'BJ', effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: 'desc' },
    }).catch(() => null);
    const seuil = rates ? Number((rates as any).cnssMensuelSeuil ?? 20) : 20;
    const effectif = rows.length;
    const frequency: 'MENSUEL' | 'TRIMESTRIEL' = effectif >= seuil ? 'MENSUEL' : 'TRIMESTRIEL';

    // 3. Prochaine échéance (rappel automatique) : fin du mois courant (mensuel)
    //    ou fin du trimestre courant (trimestriel)
    const now = new Date();
    let nextDueDate: Date;
    if (frequency === 'MENSUEL') {
      nextDueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else {
      const quarterEndMonth = Math.floor(now.getMonth() / 3) * 3 + 2; // dernier mois du trimestre
      nextDueDate = new Date(now.getFullYear(), quarterEndMonth + 1, 0);
    }

    // 4. CSV (séparateur « ; », format Excel FR)
    const esc = (v: any) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const header = ['Matricule', 'Nom', 'Prénoms', 'Poste', 'N° CNSS', 'Date affiliation', 'Date embauche', 'Salaire (FCFA)'];
    const csv = [
      header.join(';'),
      ...rows.map((r) => [
        esc(r.matricule), esc(r.nom), esc(r.prenoms), esc(r.poste), esc(r.cnssNumber),
        esc(r.affiliationDate ? new Date(r.affiliationDate).toLocaleDateString('fr-FR') : ''),
        esc(r.hireDate ? new Date(r.hireDate).toLocaleDateString('fr-FR') : ''),
        esc(r.salary != null ? r.salary.toLocaleString('fr-FR') : ''),
      ].join(';')),
    ].join('\n');

    return {
      effectifDeclare: effectif,
      seuilMensuel: seuil,
      frequency,
      frequencyLabel: frequency === 'MENSUEL'
        ? `Versement MENSUEL (effectif déclaré ${effectif} ≥ ${seuil})`
        : `Versement TRIMESTRIEL (effectif déclaré ${effectif} < ${seuil})`,
      nextDueDate,
      fiscalYear: (rates as any)?.fiscalYear ?? null,
      sourceNotes: (rates as any)?.sourceNotes ?? null,
      staff: rows,
      csv,
    };
  }

  // ============================================================================
  // TAUX CNSS (CNSSRate — global par pays, pas par tenant)
  // ============================================================================

  /**
   * Récupère le taux CNSS actif pour un pays à une date donnée
   */
  async findActiveCNSSRate(countryCode: string, effectiveDate?: Date) {
    const date = effectiveDate ?? new Date();
    return this.prisma.cNSSRate.findFirst({
      where: {
        countryCode,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * Crée ou met à jour un taux CNSS
   */
  async upsertCNSSRate(data: {
    countryCode: string;
    employeeRate: number;
    employerRate: number;
    salaryCeiling?: number;
    effectiveFrom: Date;
    effectiveTo?: Date;
  }) {
    const existing = await this.prisma.cNSSRate.findFirst({
      where: {
        countryCode: data.countryCode,
        effectiveFrom: data.effectiveFrom,
      },
    });

    if (existing) {
      return this.prisma.cNSSRate.update({
        where: { id: existing.id },
        data: {
          ...prismaUpdateDefaults(),
          employeeRate: data.employeeRate,
          employerRate: data.employerRate,
          salaryCeiling: data.salaryCeiling ?? null,
          effectiveTo: data.effectiveTo ?? null,
        },
      });
    }

    return this.prisma.cNSSRate.create({
      data: {
        ...prismaCreateDefaults(),
        countryCode: data.countryCode,
        employeeRate: data.employeeRate,
        employerRate: data.employerRate,
        salaryCeiling: data.salaryCeiling ?? null,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo ?? null,
      },
    });
  }

  // ============================================================================
  // EMPLOYEE CNSS (Affiliations)
  // ============================================================================

  /**
   * Récupère ou crée l'affiliation CNSS d'un agent
   */
  async findOrCreateEmployeeCNSS(
    staffId: string,
    tenantId: string,
    cnssNumber?: string,
  ) {
    const existing = await this.prisma.employeeCNSS.findUnique({
      where: { staffId },
    });

    if (existing) return existing;

    return this.prisma.employeeCNSS.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        staffId,
        cnssNumber: cnssNumber ?? null,
        affiliationDate: new Date(),
        isActive: true,
      },
    });
  }

  /**
   * Récupère toutes les affiliations CNSS d'un tenant
   */
  async findAllEmployeeCNSS(tenantId: string) {
    return this.prisma.employeeCNSS.findMany({
      where: { tenantId, isActive: true },
      include: {
        staff: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  // ============================================================================
  // DÉCLARATIONS CNSS
  // ============================================================================

  /**
   * Crée une déclaration CNSS pour un mois donné
   * à partir des PayrollItems VALIDÉS/PAID du lot de paie correspondant.
   * Génère les lignes en utilisant la relation EmployeeCNSS.
   */
  async createCNSSDeclaration(data: {
    tenantId: string;
    academicYearId: string;
    month: string;
    notes?: string;
  }) {
    // Vérifier qu'il n'y a pas déjà une déclaration pour ce mois (unique constraint)
    const existing = await this.prisma.cNSSDeclaration.findFirst({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        month: data.month,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Une déclaration CNSS existe déjà pour le mois ${data.month}.`,
      );
    }

    // Trouver le lot de paie correspondant au mois
    const payroll = await this.prisma.payroll.findFirst({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        month: data.month,
        status: { in: ['VALIDATED', 'PAID'] },
      },
    });

    if (!payroll) {
      throw new BadRequestException(
        "Aucune paie validée pour ce mois. Validez d'abord la paie.",
      );
    }

    // Récupérer les lignes de paie avec affiliation CNSS via la relation EmployeeCNSS
    const payrollItems = await this.prisma.payrollItem.findMany({
      where: {
        payrollId: payroll.id,
        tenantId: data.tenantId,
      },
      include: {
        staff: {
          include: {
            employeeCNSS: true,
          },
        },
      },
    });

    // Filtrer les agents avec affiliation CNSS active et numéro CNSS renseigné
    const itemsWithCNSS = payrollItems.filter(
      (item) =>
        item.staff.employeeCNSS?.isActive && item.staff.employeeCNSS?.cnssNumber,
    );

    if (itemsWithCNSS.length === 0) {
      throw new BadRequestException(
        'Aucun agent affilié CNSS dans ce lot de paie.',
      );
    }

    // Calculer les totaux
    let totalEmployeeShare = new Prisma.Decimal(0);
    let totalEmployerShare = new Prisma.Decimal(0);

    const linesToCreate: Array<{
      employeeCNSSId: string;
      grossSalary: Prisma.Decimal;
      employeeShare: Prisma.Decimal;
      employerShare: Prisma.Decimal;
    }> = [];

    for (const item of itemsWithCNSS) {
      const employeeShare = item.cnssEmployee;
      const employerShare = item.cnssEmployer;

      totalEmployeeShare = totalEmployeeShare.plus(employeeShare);
      totalEmployerShare = totalEmployerShare.plus(employerShare);

      linesToCreate.push({
        employeeCNSSId: item.staff.employeeCNSS!.id,
        grossSalary: item.grossSalary,
        employeeShare,
        employerShare,
      });
    }

    const totalAmount = totalEmployeeShare.plus(totalEmployerShare);

    // Créer la déclaration avec les lignes en transaction
    const declaration = await this.prisma.$transaction(async (tx) => {
      const decl = await tx.cNSSDeclaration.create({
        data: {
          ...prismaCreateDefaults(),
          tenantId: data.tenantId,
          academicYearId: data.academicYearId,
          month: data.month,
          totalEmployeeShare,
          totalEmployerShare,
          totalAmount,
          status: 'DRAFT',
          notes: data.notes ?? null,
        },
      });

      // Créer les lignes de déclaration
      for (const line of linesToCreate) {
        await tx.cNSSDeclarationLine.create({
          data: {
            ...prismaCreateDefaults(),
            cnssDeclarationId: decl.id,
            employeeCNSSId: line.employeeCNSSId,
            grossSalary: line.grossSalary,
            employeeShare: line.employeeShare,
            employerShare: line.employerShare,
          },
        });
      }

      return decl;
    });

    // Retourner la déclaration complète avec ses lignes
    return this.prisma.cNSSDeclaration.findUnique({
      where: { id: declaration.id },
      include: {
        lines: {
          include: {
            employeeCNSS: {
              include: {
                staff: {
                  select: {
                    id: true,
                    employeeNumber: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Récupère toutes les déclarations d'un tenant avec le nombre de lignes
   * ⭐ FIX 2026-09-09 (« bascule d'année globale ») : filtre année optionnel —
   *    academicYearId est OBLIGATOIRE sur CNSSDeclaration (pas de valeur
   *    null possible), filtre direct.
   */
  async findAllDeclarations(tenantId: string, academicYearId?: string) {
    return this.prisma.cNSSDeclaration.findMany({
      where: {
        tenantId,
        ...(academicYearId ? { academicYearId } : {}),
      },
      include: {
        _count: { select: { lines: true } },
      },
      orderBy: { month: 'desc' },
    });
  }

  /**
   * Récupère une déclaration avec ses lignes incluant employeeCNSS.staff
   */
  async findDeclarationById(id: string, tenantId: string) {
    const decl = await this.prisma.cNSSDeclaration.findFirst({
      where: { id, tenantId },
      include: {
        lines: {
          include: {
            employeeCNSS: {
              include: {
                staff: {
                  select: {
                    id: true,
                    employeeNumber: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!decl)
      throw new NotFoundException(`Déclaration CNSS ${id} introuvable.`);
    return decl;
  }

  /**
   * Finalise une déclaration (DRAFT → SUBMITTED → PAID)
   * Positionne declaredAt lors du passage à SUBMITTED
   * Positionne paidAt lors du passage à PAID
   */
  async finalizeDeclaration(
    id: string,
    tenantId: string,
    status: 'SUBMITTED' | 'PAID',
    paymentReference?: string,
    paymentProofPath?: string,
  ) {
    const declaration = await this.prisma.cNSSDeclaration.findFirst({
      where: { id, tenantId },
    });

    if (!declaration) {
      throw new NotFoundException(`Déclaration CNSS ${id} introuvable.`);
    }

    // Valider la transition de statut
    if (
      status === 'SUBMITTED' &&
      declaration.status !== 'DRAFT'
    ) {
      throw new BadRequestException(
        'Seule une déclaration en brouillon peut être soumise.',
      );
    }

    if (
      status === 'PAID' &&
      declaration.status !== 'SUBMITTED'
    ) {
      throw new BadRequestException(
        'Seule une déclaration soumise peut être marquée comme payée.',
      );
    }

    const data: Prisma.CNSSDeclarationUpdateInput = { status };

    if (status === 'SUBMITTED') {
      data.declaredAt = new Date();
    }

    if (status === 'PAID') {
      data.paidAt = new Date();
      data.paymentReference = paymentReference ?? null;
      data.paymentProofPath = paymentProofPath ?? null;
    }

    return this.prisma.cNSSDeclaration.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        ...data,
      },
    });
  }

  /**
   * Supprime une déclaration CNSS (seulement si DRAFT)
   */
  async deleteDeclaration(id: string, tenantId: string) {
    const declaration = await this.prisma.cNSSDeclaration.findFirst({
      where: { id, tenantId },
    });
    if (!declaration) {
      throw new NotFoundException(`Declaration ${id} not found`);
    }
    if (declaration.status !== 'DRAFT') {
      throw new BadRequestException('Seules les déclarations en brouillon peuvent être supprimées.');
    }
    // Delete lines first
    await this.prisma.cNSSDeclarationLine.deleteMany({ where: { declarationId: id } });
    return this.prisma.cNSSDeclaration.delete({ where: { id } });
  }
}
