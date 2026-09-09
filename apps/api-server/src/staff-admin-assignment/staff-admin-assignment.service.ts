import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AdminStructureService } from '../admin-structure/admin-structure.service';
import { AccessScopeService } from '../common/context/access-scope.service';
import { v4 as uuidv4 } from 'uuid';
import { ADMIN_ROLES, isValidAdminRole, ADMIN_ROLE_TO_USER_ROLE, resolveUserRoleWithLevel } from '../common/constants/admin-roles';

/**
 * ============================================================================
 * StaffAdminAssignmentService — CRUD des affectations administratives
 * ============================================================================
 *
 * Gère les affectations de postes administratifs level-aware :
 *   - Directeur Maternelle / Primaire / Secondaire / MAT_PRI
 *   - Secrétaire Maternelle / Primaire / Secondaire / MAT_PRI
 *   - Secrétaire Comptable Maternelle / Primaire / Secondaire / MAT_PRI
 *   - Censeur, Surveillant Général, Intendant, Proviseur, etc.
 *   - Et tout autre adminRole défini dans common/constants/admin-roles.ts
 *
 * Le schoolLevelCode doit être cohérent avec le mode d'administration du tenant :
 *   - Mode SEPARATE : MAT, PRI, SEC (pas de MAT_PRI)
 *   - Mode FUSED_MATERNELLE_PRIMAIRE : MAT_PRI, SEC (pas de MAT ou PRI seuls
 *     pour les nouveaux postes — mais on garde les existants)
 * ============================================================================
 */

const VALID_LEVEL_CODES = ['MAT', 'PRI', 'SEC', 'MAT_PRI', 'ALL'];
const VALID_TRACK_CODES = ['FR', 'EN'];

export interface StaffAdminAssignment {
  id: string;
  tenantId: string;
  staffId: string;
  schoolLevelCode: string;
  adminRole: string;
  /// ⭐ Piste linguistique administrée (Filtre Rôles × Pistes × Niveaux) :
  ///    UUID de l'AcademicTrack ('FR' ou 'EN') ou null = les deux pistes (D1)
  academicTrackId: string | null;
  academicYearId: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations (optionnel selon includeStaff)
  staff?: any;
  /// Piste incluse (list/my-context) : { id, code, name }
  academicTrack?: any;
}

function rowToAssignment(r: any): StaffAdminAssignment {
  return {
    id: r.id,
    tenantId: r.tenantId || r.tenant_id,
    staffId: r.staffId || r.staff_id,
    schoolLevelCode: r.schoolLevelCode || r.school_level_code,
    adminRole: r.adminRole || r.admin_role,
    academicTrackId: r.academicTrackId ?? null,
    academicYearId: r.academicYearId || r.academic_year_id || null,
    startDate: r.startDate?.toISOString?.() || r.start_date?.toISOString?.() || r.startDate || r.start_date,
    endDate: r.endDate?.toISOString?.() || r.end_date?.toISOString?.() || r.endDate || r.end_date || null,
    isActive: r.isActive !== undefined ? r.isActive : (r.is_active !== undefined ? r.is_active : true),
    createdAt: r.createdAt?.toISOString?.() || r.created_at?.toISOString?.() || r.createdAt || r.created_at,
    updatedAt: r.updatedAt?.toISOString?.() || r.updated_at?.toISOString?.() || r.updatedAt || r.updated_at,
    staff: r.staff,
    academicTrack: r.academicTrack,
  };
}

@Injectable()
export class StaffAdminAssignmentService {
  private readonly logger = new Logger(StaffAdminAssignmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminStructureService: AdminStructureService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  //  LIST — Toutes les affectations d'un tenant (avec filtres optionnels)
  // ═══════════════════════════════════════════════════════════════════════

  async list(
    tenantId: string,
    filters?: { staffId?: string; schoolLevelCode?: string; adminRole?: string; isActive?: boolean; academicTrackId?: string | null; academicYearId?: string },
  ): Promise<StaffAdminAssignment[]> {
    await this.ensureTableExists();

    const where: any = { tenantId };
    if (filters?.staffId) where.staffId = filters.staffId;
    if (filters?.schoolLevelCode) where.schoolLevelCode = filters.schoolLevelCode;
    if (filters?.adminRole) where.adminRole = filters.adminRole;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    // ⭐ Filtre piste : UUID AcademicTrack → affectations de cette piste ; null → bi-piste
    if (filters?.academicTrackId !== undefined) where.academicTrackId = filters.academicTrackId;
    // ⭐ FIX 2026-09-09 (« bascule d'année globale ») : filtre année demandé par
    //    le module RH (onglet Administration) — les affectations de l'année
    //    sélectionnée dans le header + les affectations SANS année (héritées,
    //    valables toutes années) sont retournées. Sans filtre → tout (comportement
    //    historique, utilisé par la résolution de périmètre côté access-scope).
    if (filters?.academicYearId) {
      where.OR = [
        { academicYearId: filters.academicYearId },
        { academicYearId: null },
      ];
    }

    const rows = await this.prisma.staffAdminAssignment.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: {
        academicTrack: { select: { id: true, code: true, name: true } },
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            employeeNumber: true,
            // ⭐ Le modèle Staff n'a pas de champ photoUrl direct — les photos
            //    sont dans une table séparée StaffPhoto. On ne l'inclut pas ici
            //    car le frontend n'en a pas besoin pour l'affichage des affectations.
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
      /// ⭐ Piste du poste : UUID AcademicTrack ('FR' ou 'EN') | null/omis = les deux pistes (D1)
      academicTrackId?: string | null;
      /// ⭐ Alternative pratique : code de piste 'FR' | 'EN' (résolu en UUID côté serveur).
      ///    Ignoré si academicTrackId est fourni. Null = les deux pistes.
      academicTrackCode?: string | null;
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
    if (!isValidAdminRole(data.adminRole)) {
      throw new BadRequestException(`adminRole invalide : ${data.adminRole}. Valeurs acceptées : ${ADMIN_ROLES.join(', ')}`);
    }
    // ⭐ Validation piste : UUID direct OU code ('FR'/'EN') résolu vers l'UUID du tenant
    let academicTrackId = data.academicTrackId ?? null;
    if (!academicTrackId && data.academicTrackCode) {
      if (!VALID_TRACK_CODES.includes(data.academicTrackCode)) {
        throw new BadRequestException(`academicTrackCode invalide : ${data.academicTrackCode}. Valeurs acceptées : FR, EN, ou null`);
      }
      const track = await this.prisma.academicTrack.findFirst({
        where: { tenantId, code: data.academicTrackCode },
        select: { id: true, code: true },
      });
      if (!track) {
        throw new BadRequestException(`Piste ${data.academicTrackCode} introuvable pour cet établissement`);
      }
      academicTrackId = track.id;
    }
    if (academicTrackId) {
      const track = await this.prisma.academicTrack.findFirst({
        where: { id: academicTrackId, tenantId },
        select: { id: true, code: true },
      });
      if (!track) {
        throw new BadRequestException('academicTrackId invalide : piste introuvable dans cet établissement');
      }
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

    // ⭐ Vérifier qu'il n'existe pas déjà une affectation active identique
    //    (même staffId + schoolLevelCode + adminRole + isActive=true). Si oui,
    //    on ne crée pas de doublon — on retourne l'affectation existante.
    const existing = await this.prisma.staffAdminAssignment.findFirst({
      where: {
        staffId: data.staffId,
        tenantId,
        schoolLevelCode: data.schoolLevelCode,
        adminRole: data.adminRole,
        isActive: true,
      },
    });
    if (existing) {
      this.logger.log(`Admin assignment already exists: staff=${staff.firstName} ${staff.lastName}, role=${data.adminRole}, level=${data.schoolLevelCode} — returning existing`);
      return rowToAssignment({
        ...existing,
        staff: { id: staff.id, firstName: staff.firstName, lastName: staff.lastName, email: null, phone: null, employeeNumber: null },
      });
    }

    const row = await this.prisma.staffAdminAssignment.create({
      data: {
        id: uuidv4(),
        tenantId,
        staffId: data.staffId,
        schoolLevelCode: data.schoolLevelCode,
        adminRole: data.adminRole,
        academicTrackId: academicTrackId ?? null,
        academicYearId: data.academicYearId || null,
        startDate: data.startDate || new Date(),
        endDate: data.endDate || null,
        isActive: true,
      },
      include: {
        academicTrack: { select: { id: true, code: true, name: true } },
        staff: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, employeeNumber: true } },
      },
    });

    this.logger.log(`Admin assignment created: staff=${staff.firstName} ${staff.lastName}, role=${data.adminRole}, level=${data.schoolLevelCode}, track=${(row as any).academicTrack?.code || 'BI-PISTE'}`);

    // ⭐ Filtre Rôles × Pistes × Niveaux : invalider le cache de scope du user
    //    lié (résolu par email) pour que la nouvelle affectation prenne effet
    //    immédiatement (sinon latence cache 2 min).
    await this.invalidateUserScopeForStaff(tenantId, row.staff?.email);

    // ⭐ Mettre à jour le rôle du User existant si le staff a déjà un compte.
    //    Quand on affecte un poste admin à un staff, son compte User doit
    //    refléter ce rôle pour que l'UI affichée soit correcte (secrétaire,
    //    comptable, secrétaire-comptable, directeur, etc.).
    //    ⭐⭐ On utilise resolveUserRoleWithLevel qui prend en compte le
    //        schoolLevelCode pour produire un UserRole niveau-spécifique
    //        (ex: SECRETAIRE_COMPTABLE_MAT_PRI au lieu de SECRETAIRE_COMPTABLE).
    //        Cela garantit que l'AccessScopeGuard (P2) impose le périmètre serveur par niveau.
    try {
      const staffWithEmail = await this.prisma.staff.findFirst({
        where: { id: data.staffId, tenantId },
        select: { email: true },
      });
      if (staffWithEmail?.email) {
        const existingUser = await this.prisma.user.findFirst({
          where: { email: staffWithEmail.email.trim().toLowerCase() },
        });
        if (existingUser) {
          // ⭐ FIX: Ne PAS écraser le rôle d'un PROMOTEUR ou SUPER_ADMIN.
          //    Le promoteur est le propriétaire de l'école — son rôle doit rester
          //    PROMOTEUR même s'il a aussi un poste administratif (directeur, etc.).
          //    Le PermissionGuard bypass pour PROMOTEUR repose sur users.role.
          const PROTECTED_ROLES = ['PROMOTEUR', 'PROMOTER', 'SUPER_ADMIN', 'PLATFORM_OWNER', 'PLATFORM_ADMIN'];
          if (PROTECTED_ROLES.includes(existingUser.role)) {
            this.logger.log(`[create] Skipping role update for protected user ${existingUser.email} (role=${existingUser.role})`);
          } else {
            const targetRole = resolveUserRoleWithLevel(data.adminRole, data.schoolLevelCode);
            if (targetRole && existingUser.role !== targetRole) {
              await this.prisma.user.update({
                where: { id: existingUser.id },
                data: { role: targetRole },
              });
              this.logger.log(`[create] User role updated: ${existingUser.email} ${existingUser.role} → ${targetRole} (from adminRole=${data.adminRole} @ ${data.schoolLevelCode})`);
            }
          }
        }
      }
    } catch (updateErr: any) {
      // Non bloquant — l'affectation est créée, la mise à jour du User est best-effort
      this.logger.warn(`[create] Failed to update User role (non-blocking): ${updateErr?.message}`);
    }

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
      /// ⭐ Piste : UUID AcademicTrack | null (= retour bi-piste, D1) | omis (= inchangé)
      academicTrackId?: string | null;
      /// ⭐ Alternative : code 'FR' | 'EN' résolu côté serveur (null = bi-piste)
      academicTrackCode?: string | null;
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
      if (!isValidAdminRole(data.adminRole)) {
        throw new BadRequestException(`adminRole invalide : ${data.adminRole}`);
      }
      updateData.adminRole = data.adminRole;
    }
    // ⭐ Piste : null explicite = retour au bi-piste (les deux pistes — D1).
    //    Accepte l'UUID direct OU le code 'FR'/'EN' (résolu serveur).
    if (data.academicTrackId !== undefined || data.academicTrackCode !== undefined) {
      let trackId = data.academicTrackId ?? null;
      if (!trackId && data.academicTrackCode) {
        if (!VALID_TRACK_CODES.includes(data.academicTrackCode)) {
          throw new BadRequestException(`academicTrackCode invalide : ${data.academicTrackCode}. Valeurs acceptées : FR, EN, ou null`);
        }
        const track = await this.prisma.academicTrack.findFirst({
          where: { tenantId, code: data.academicTrackCode },
          select: { id: true },
        });
        if (!track) {
          throw new BadRequestException(`Piste ${data.academicTrackCode} introuvable pour cet établissement`);
        }
        trackId = track.id;
      }
      if (trackId) {
        const track = await this.prisma.academicTrack.findFirst({
          where: { id: trackId, tenantId },
          select: { id: true },
        });
        if (!track) {
          throw new BadRequestException('academicTrackId invalide : piste introuvable dans cet établissement');
        }
      }
      updateData.academicTrackId = trackId;
    }
    if (data.academicYearId !== undefined) updateData.academicYearId = data.academicYearId;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const row = await this.prisma.staffAdminAssignment.update({
      where: { id },
      data: updateData,
      include: {
        academicTrack: { select: { id: true, code: true, name: true } },
        staff: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, employeeNumber: true } },
      },
    });

    // ⭐ Re-sync User.role si adminRole ou schoolLevelCode a changé
    //    (même logique que dans create(), mais ici on compare avec les valeurs
    //    AVANT update vs APRÈS update)
    // ⭐ + invalidation du cache de scope (périmètre niveaux/pistes)
    await this.invalidateUserScopeForStaff(tenantId, row.staff?.email);
    const newAdminRole = data.adminRole ?? existing.adminRole;
    const newSchoolLevelCode = data.schoolLevelCode ?? existing.schoolLevelCode;
    if ((data.adminRole !== undefined || data.schoolLevelCode !== undefined) && row.staff?.email) {
      try {
        const existingUser = await this.prisma.user.findFirst({
          where: { email: row.staff.email.trim().toLowerCase() },
        });
        if (existingUser) {
          // ⭐ FIX: Ne PAS écraser le rôle d'un PROMOTEUR ou SUPER_ADMIN (même logique que create).
          const PROTECTED_ROLES = ['PROMOTEUR', 'PROMOTER', 'SUPER_ADMIN', 'PLATFORM_OWNER', 'PLATFORM_ADMIN'];
          if (PROTECTED_ROLES.includes(existingUser.role)) {
            this.logger.log(`[update] Skipping role update for protected user ${existingUser.email} (role=${existingUser.role})`);
          } else {
            const targetRole = resolveUserRoleWithLevel(newAdminRole, newSchoolLevelCode);
            if (targetRole && existingUser.role !== targetRole) {
              await this.prisma.user.update({
                where: { id: existingUser.id },
                data: { role: targetRole },
              });
              this.logger.log(`[update] User role updated: ${existingUser.email} ${existingUser.role} → ${targetRole}`);
            }
          }
        }
      } catch (updateErr: any) {
        this.logger.warn(`[update] Failed to sync User role (non-blocking): ${updateErr?.message}`);
      }
    }

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
    // ⭐ Invalider le cache de scope AVANT suppression (l'email du staff est
    //    dans l'affectation existante)
    const staffBefore = await this.prisma.staff.findUnique({
      where: { id: existing.staffId },
      select: { email: true },
    }).catch(() => null);
    await this.prisma.staffAdminAssignment.delete({ where: { id } });
    await this.invalidateUserScopeForStaff(tenantId, staffBefore?.email);
    this.logger.log(`Admin assignment deleted: ${id}`);
  }

  /**
   * ⭐ Filtre Rôles × Pistes × Niveaux — invalide le cache de scope des users
   *    liés au staff (par email) après tout changement d'affectation.
   */
  private async invalidateUserScopeForStaff(tenantId: string, staffEmail?: string | null): Promise<void> {
    if (!staffEmail) return;
    try {
      const users = await this.prisma.user.findMany({
        where: { tenantId, email: { equals: staffEmail, mode: 'insensitive' } },
        select: { id: true },
      });
      for (const u of users) {
        await this.accessScopeService.invalidateScope(u.id, tenantId);
      }
    } catch (e: any) {
      this.logger.warn(`Scope invalidation failed for ${staffEmail}: ${e.message}`);
    }
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
        return ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE'];
      }
      if (a.schoolLevelCode === 'MAT_PRI') {
        levelCodes.add('MATERNELLE');
        levelCodes.add('PRIMAIRE');
      } else if (a.schoolLevelCode === 'MAT') {
        levelCodes.add('MATERNELLE');
      } else if (a.schoolLevelCode === 'PRI') {
        levelCodes.add('PRIMAIRE');
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
