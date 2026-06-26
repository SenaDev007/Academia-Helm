import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AdminStructureService } from '../admin-structure/admin-structure.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * ============================================================================
 * StaffAdminAssignmentService — CRUD des affectations administratives
 * ============================================================================
 *
 * Gère les affectations de postes administratifs level-aware :
 *   - Directeur Maternelle / Primaire / Secondaire / MAT_PRI
 *   - Secrétaire Maternelle / Primaire / Secondaire / MAT_PRI
 *   - Secrétaire Comptable Maternelle / Primaire / Secondaire / MAT_PRI
 *   - Et tout autre adminRole (CENSEUR, ECONOME, etc.)
 *
 * Le schoolLevelCode doit être cohérent avec le mode d'administration du tenant :
 *   - Mode SEPARATE : MAT, PRI, SEC (pas de MAT_PRI)
 *   - Mode FUSED_MATERNELLE_PRIMAIRE : MAT_PRI, SEC (pas de MAT ou PRI seuls
 *     pour les nouveaux postes — mais on garde les existants)
 * ============================================================================
 */

const VALID_LEVEL_CODES = ['MAT', 'PRI', 'SEC', 'MAT_PRI', 'ALL'];
const VALID_ADMIN_ROLES = [
  'DIRECTEUR', 'SECRETAIRE', 'SECRETAIRE_COMPTABLE',
  'CENSEUR', 'ECONOME', 'DIRECTEUR_GENERAL', 'DIRECTEUR_ADJOINT',
  'RESP_SCOLARITE', 'SURVEILLANT_GENERAL',
];

export interface StaffAdminAssignment {
  id: string;
  tenantId: string;
  staffId: string;
  schoolLevelCode: string;
  adminRole: string;
  academicYearId: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations (optionnel selon includeStaff)
  staff?: any;
}

function rowToAssignment(r: any): StaffAdminAssignment {
  return {
    id: r.id,
    tenantId: r.tenantId || r.tenant_id,
    staffId: r.staffId || r.staff_id,
    schoolLevelCode: r.schoolLevelCode || r.school_level_code,
    adminRole: r.adminRole || r.admin_role,
    academicYearId: r.academicYearId || r.academic_year_id || null,
    startDate: r.startDate?.toISOString?.() || r.start_date?.toISOString?.() || r.startDate || r.start_date,
    endDate: r.endDate?.toISOString?.() || r.end_date?.toISOString?.() || r.endDate || r.end_date || null,
    isActive: r.isActive !== undefined ? r.isActive : (r.is_active !== undefined ? r.is_active : true),
    createdAt: r.createdAt?.toISOString?.() || r.created_at?.toISOString?.() || r.createdAt || r.created_at,
    updatedAt: r.updatedAt?.toISOString?.() || r.updated_at?.toISOString?.() || r.updatedAt || r.updated_at,
    staff: r.staff,
  };
}

@Injectable()
export class StaffAdminAssignmentService {
  private readonly logger = new Logger(StaffAdminAssignmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminStructureService: AdminStructureService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  //  LIST — Toutes les affectations d'un tenant (avec filtres optionnels)
  // ═══════════════════════════════════════════════════════════════════════

  async list(
    tenantId: string,
    filters?: { staffId?: string; schoolLevelCode?: string; adminRole?: string; isActive?: boolean },
  ): Promise<StaffAdminAssignment[]> {
    await this.ensureTableExists();

    const where: any = { tenantId };
    if (filters?.staffId) where.staffId = filters.staffId;
    if (filters?.schoolLevelCode) where.schoolLevelCode = filters.schoolLevelCode;
    if (filters?.adminRole) where.adminRole = filters.adminRole;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    const rows = await this.prisma.staffAdminAssignment.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            employeeNumber: true,
            photoUrl: true,
          },
        },
      },
    });

    return rows.map(rowToAssignment);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  GET BY ID
  // ═══════════════════════════════════════════════════════════════════════

  async getById(tenantId: string, id: string): Promise<StaffAdminAssignment> {
    await this.ensureTableExists();
    const row = await this.prisma.staffAdminAssignment.findFirst({
      where: { id, tenantId },
      include: { staff: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, employeeNumber: true } } },
    });
    if (!row) throw new NotFoundException('Affectation introuvable');
    return rowToAssignment(row);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  CREATE
  // ═══════════════════════════════════════════════════════════════════════

  async create(
    tenantId: string,
    data: {
      staffId: string;
      schoolLevelCode: string;
      adminRole: string;
      academicYearId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<StaffAdminAssignment> {
    await this.ensureTableExists();

    // Validation
    if (!VALID_LEVEL_CODES.includes(data.schoolLevelCode)) {
      throw new BadRequestException(`schoolLevelCode invalide : ${data.schoolLevelCode}. Valeurs acceptées : ${VALID_LEVEL_CODES.join(', ')}`);
    }
    if (!VALID_ADMIN_ROLES.includes(data.adminRole)) {
      throw new BadRequestException(`adminRole invalide : ${data.adminRole}. Valeurs acceptées : ${VALID_ADMIN_ROLES.join(', ')}`);
    }

    // Vérifier que le staff existe et appartient au tenant
    const staff = await this.prisma.staff.findFirst({
      where: { id: data.staffId, tenantId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!staff) throw new NotFoundException('Staff introuvable');

    // Vérifier la cohérence avec le mode d'administration
    const mode = await this.adminStructureService.getMode(tenantId);
    if (mode === 'SEPARATE' && data.schoolLevelCode === 'MAT_PRI') {
      throw new BadRequestException(
        "Le code MAT_PRI n'est pas valide en mode SEPARATE. " +
        "Utilisez MAT ou PRI séparément, ou changez le mode d'administration en FUSED_MATERNELLE_PRIMAIRE.",
      );
    }

    const row = await this.prisma.staffAdminAssignment.create({
      data: {
        id: uuidv4(),
        tenantId,
        staffId: data.staffId,
        schoolLevelCode: data.schoolLevelCode,
        adminRole: data.adminRole,
        academicYearId: data.academicYearId || null,
        startDate: data.startDate || new Date(),
        endDate: data.endDate || null,
        isActive: true,
      },
      include: { staff: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, employeeNumber: true } } },
    });

    this.logger.log(`Admin assignment created: staff=${staff.firstName} ${staff.lastName}, role=${data.adminRole}, level=${data.schoolLevelCode}`);
    return rowToAssignment(row);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  UPDATE
  // ═══════════════════════════════════════════════════════════════════════

  async update(
    tenantId: string,
    id: string,
    data: {
      schoolLevelCode?: string;
      adminRole?: string;
      academicYearId?: string | null;
      startDate?: Date;
      endDate?: Date | null;
      isActive?: boolean;
    },
  ): Promise<StaffAdminAssignment> {
    await this.ensureTableExists();

    const existing = await this.prisma.staffAdminAssignment.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Affectation introuvable');

    const updateData: any = {};
    if (data.schoolLevelCode !== undefined) {
      if (!VALID_LEVEL_CODES.includes(data.schoolLevelCode)) {
        throw new BadRequestException(`schoolLevelCode invalide : ${data.schoolLevelCode}`);
      }
      updateData.schoolLevelCode = data.schoolLevelCode;
    }
    if (data.adminRole !== undefined) {
      if (!VALID_ADMIN_ROLES.includes(data.adminRole)) {
        throw new BadRequestException(`adminRole invalide : ${data.adminRole}`);
      }
      updateData.adminRole = data.adminRole;
    }
    if (data.academicYearId !== undefined) updateData.academicYearId = data.academicYearId;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const row = await this.prisma.staffAdminAssignment.update({
      where: { id },
      data: updateData,
      include: { staff: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, employeeNumber: true } } },
    });

    return rowToAssignment(row);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  DELETE
  // ═══════════════════════════════════════════════════════════════════════

  async delete(tenantId: string, id: string): Promise<void> {
    await this.ensureTableExists();
    const existing = await this.prisma.staffAdminAssignment.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Affectation introuvable');
    await this.prisma.staffAdminAssignment.delete({ where: { id } });
    this.logger.log(`Admin assignment deleted: ${id}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  GET BY STAFF — Toutes les affectations d'un staff
  // ═══════════════════════════════════════════════════════════════════════

  async getByStaff(tenantId: string, staffId: string): Promise<StaffAdminAssignment[]> {
    return this.list(tenantId, { staffId, isActive: true });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  RESOLVE — Pour un utilisateur donné, quels niveaux peut-il administrer ?
  // ═══════════════════════════════════════════════════════════════════════

  async resolveAdminLevelsForStaff(tenantId: string, staffId: string): Promise<string[]> {
    const assignments = await this.list(tenantId, { staffId, isActive: true });
    const levelCodes = new Set<string>();

    for (const a of assignments) {
      if (a.schoolLevelCode === 'ALL') {
        return ['MATERNELLE', 'PRIMARY', 'SECONDAIRE'];
      }
      if (a.schoolLevelCode === 'MAT_PRI') {
        levelCodes.add('MATERNELLE');
        levelCodes.add('PRIMARY');
      } else if (a.schoolLevelCode === 'MAT') {
        levelCodes.add('MATERNELLE');
      } else if (a.schoolLevelCode === 'PRI') {
        levelCodes.add('PRIMARY');
      } else if (a.schoolLevelCode === 'SEC') {
        levelCodes.add('SECONDAIRE');
      }
    }

    return Array.from(levelCodes);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  private async ensureTableExists(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "staff_admin_assignments" (
          "id" TEXT PRIMARY KEY,
          "tenantId" TEXT NOT NULL,
          "staffId" TEXT NOT NULL,
          "schoolLevelCode" TEXT NOT NULL,
          "adminRole" TEXT NOT NULL,
          "academicYearId" TEXT,
          "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "endDate" TIMESTAMP(3),
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "staff_admin_assignments_staffId_fkey"
            FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE,
          CONSTRAINT "staff_admin_assignments_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
          CONSTRAINT "staff_admin_assignments_tenantId_staffId_adminRole_schoolLev_key"
            UNIQUE ("tenantId", "staffId", "adminRole", "schoolLevelCode", "academicYearId")
        );
        CREATE INDEX IF NOT EXISTS "idx_staff_admin_assignments_tenant_staff"
          ON "staff_admin_assignments" ("tenantId", "staffId");
        CREATE INDEX IF NOT EXISTS "idx_staff_admin_assignments_tenant_level"
          ON "staff_admin_assignments" ("tenantId", "schoolLevelCode");
        CREATE INDEX IF NOT EXISTS "idx_staff_admin_assignments_tenant_role_active"
          ON "staff_admin_assignments" ("tenantId", "adminRole", "isActive");
      `);
    } catch (e: any) {
      this.logger.warn(`ensureTableExists staff_admin_assignments: ${e.message}`);
    }
  }
}
