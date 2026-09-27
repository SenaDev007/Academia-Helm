/**
 * FederisExamsService — Workflow examens nationaux (Academia Federis)
 *
 * Chaîne opérationnelle complète (cahier des charges §9) :
 *   1. Examens nationaux        — création, cycle DRAFT → REGISTRATION → …
 *   2. Centres d'examen         — établissements d'accueil par examen
 *   3. Salles                   — capacité par centre (ExamRoom)
 *   4. Candidats                — ajout manuel + IMPORT EXCEL par lot
 *      (le fichier est analysé côté client avec SheetJS/xlsx — dépendance
 *      déjà présente dans web-app — puis les lignes sont envoyées en JSON)
 *   5. Numéros de table         — affectation automatique : répartition des
 *      candidats dans les salles selon leur capacité + numérotation
 *      séquentielle par centre (001, 002, …)
 *
 * Règles transverses :
 *   - NO ACADEMIC YEAR = NO DATA : toute écriture exige l'année active
 *   - Jamais de suppression physique : archivage via status
 *   - Permissions : coordonnateur + organisateur (organisation), secrétaire
 *     (candidats/registres) — vérifiées via federis-roles
 *   - AuditLog sur chaque mutation
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FederisPatronatService, FEDERIS_PLANS, type FederisPlanCode } from './federis-patronat.service';
import {
  ALL_PATRONAT_FUNCTIONS,
  WRITE_CANDIDATES,
  WRITE_EXAM_ORG,
  normalizePatronatFunction,
  patronatFunctionLabel,
  type PatronatFunction,
} from './federis-roles';

// ── DTO ─────────────────────────────────────────────────────────────────────

export class CreateExamDto {
  code!: string;
  name!: string;
  examType!: string;
  /** CM2 | 3EME | TERMINALE (classes prioritaires §2) */
  level!: string;
  startDate!: string;
  endDate!: string;
  registrationStartDate?: string;
  registrationEndDate?: string;
  description?: string;
}

export class UpdateExamDto {
  name?: string;
  status?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export class CreateCenterDto {
  code!: string;
  name!: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export class UpdateCenterDto {
  name?: string;
  address?: string;
  status?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export class CreateRoomDto {
  code!: string;
  name?: string;
  capacity!: number;
  floor?: number;
  building?: string;
}

export class UpdateRoomDto {
  name?: string;
  capacity?: number;
  status?: string;
  floor?: number;
  building?: string;
}

export class ImportCandidatesDto {
  /** Lignes déjà normalisées (analyse Excel côté client). */
  rows!: ImportCandidateRow[];
}

export class ImportCandidateRow {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  placeOfBirth?: string;
  schoolName?: string;
  matricule?: string;
  registrationNumber?: string;
  phone?: string;
  email?: string;
}

export class AddCandidateDto {
  firstName!: string;
  lastName!: string;
  dateOfBirth?: string;
  gender?: string;
  schoolName?: string;
  matricule?: string;
  phone?: string;
  email?: string;
}

export class AssignTablesDto {
  /** Ordre de répartition : NAME (alphabétique) ou SCHOOL (par école puis nom). */
  orderBy?: 'NAME' | 'SCHOOL';
  /** Portée de la numérotation : par CENTRE (défaut) ou globale à l'examen. */
  numberingScope?: 'CENTER' | 'EXAM';
  /** Premier numéro (défaut 1). */
  startNumber?: number;
}

const EXAM_BLOCKED_STATUSES = ['COMPLETED', 'CANCELLED', 'ARCHIVED'];

@Injectable()
export class FederisExamsService {
  private readonly logger = new Logger(FederisExamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patronatService: FederisPatronatService,
  ) {}

  // ── Contexte & permissions ───────────────────────────────────────────────

  private async resolveContext(tenantId: string, userId: string) {
    const patronat = await this.patronatService.resolvePatronat(tenantId, userId);
    const link = await this.prisma.patronatUser.findFirst({
      where: { tenantId: patronat.tenantId, userId, isActive: true },
      select: { role: true },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    // PatronatUser.role (fonction courte) prime ; sinon User.role (PATRONAT_*)
    const fn = this.normalize(link?.role ?? user?.role);
    return { patronat, fn, fnLabel: patronatFunctionLabel(fn) };
  }

  private normalize(role?: string | null): PatronatFunction {
    return normalizePatronatFunction(role);
  }

  private assertRead(fn: PatronatFunction): void {
    if (!ALL_PATRONAT_FUNCTIONS.includes(fn)) {
      throw new ForbiddenException('Accès réservé aux membres du patronat.');
    }
  }

  private assertWriteOrg(fn: PatronatFunction): void {
    if (!WRITE_EXAM_ORG.includes(fn)) {
      throw new ForbiddenException(
        "L'organisation des examens (centres, salles, affectations) est réservée au coordonnateur et à l'organisateur.",
      );
    }
  }

  private assertWriteCandidates(fn: PatronatFunction): void {
    if (!WRITE_CANDIDATES.includes(fn)) {
      throw new ForbiddenException(
        "La gestion des candidats est réservée au coordonnateur, à l'organisateur et au secrétaire.",
      );
    }
  }

  private async getActiveYear(tenantId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    if (!year) {
      throw new BadRequestException(
        "Aucune année scolaire active — la création de données est bloquée (NO ACADEMIC YEAR = NO DATA).",
      );
    }
    return year;
  }

  /** Examen appartenant au patronat (scope tenant). */
  private async getOwnedExam(patronatTenantId: string, examId: string) {
    const exam = await this.prisma.nationalExam.findFirst({
      where: { id: examId, tenantId: patronatTenantId },
    });
    if (!exam) throw new NotFoundException('Examen introuvable dans votre périmètre.');
    return exam;
  }

  // ── 1. Examens nationaux ─────────────────────────────────────────────────

  async listExams(tenantId: string, userId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const year = await this.prisma.academicYear.findFirst({
      where: { tenantId: patronat.tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });

    const exams = year
      ? await this.prisma.nationalExam.findMany({
          where: { patronatId: patronat.id, academicYearId: year.id },
          include: { _count: { select: { centers: true, candidates: true } } },
          orderBy: { startDate: 'desc' },
        })
      : [];

    return {
      academicYear: year ? { id: year.id, label: year.label } : null,
      exams: exams.map((e) => ({
        id: e.id,
        code: e.code,
        name: e.name,
        examType: e.examType,
        level: e.level,
        status: e.status,
        startDate: e.startDate,
        endDate: e.endDate,
        registrationStartDate: e.registrationStartDate,
        registrationEndDate: e.registrationEndDate,
        centersCount: e._count.centers,
        candidatesCount: e._count.candidates,
        totalCandidates: e.totalCandidates,
        totalCenters: e.totalCenters,
      })),
    };
  }

  async createExam(tenantId: string, userId: string, dto: CreateExamDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteOrg(fn);
    const year = await this.getActiveYear(patronat.tenantId);

    if (!dto.code?.trim() || !dto.name?.trim()) {
      throw new BadRequestException('Le code et le nom de l\'examen sont requis.');
    }
    if (!dto.startDate || !dto.endDate || new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('Dates invalides : la fin doit suivre le début.');
    }

    const duplicate = await this.prisma.nationalExam.findFirst({
      where: {
        tenantId: patronat.tenantId,
        academicYearId: year.id,
        code: dto.code.trim().toUpperCase(),
      },
    });
    if (duplicate) {
      throw new BadRequestException(
        `Un examen portant le code ${dto.code.trim().toUpperCase()} existe déjà pour cette année scolaire.`,
      );
    }

    // Quota de campagnes actives du plan
    const plan =
      FEDERIS_PLANS[(patronat.subscriptionPlan as FederisPlanCode)] ?? FEDERIS_PLANS.ESSENTIEL;
    const activeCampaigns = await this.prisma.nationalExam.count({
      where: {
        patronatId: patronat.id,
        academicYearId: year.id,
        status: { notIn: ['COMPLETED', 'CANCELLED', 'ARCHIVED'] },
      },
    });
    if (activeCampaigns >= plan.maxActiveCampaigns) {
      throw new BadRequestException(
        `Quota de campagnes actives atteint pour l'offre ${plan.name} (${plan.maxActiveCampaigns}).`,
      );
    }

    const exam = await this.prisma.$transaction(async (tx) => {
      const created = await tx.nationalExam.create({
        data: {
          tenantId: patronat.tenantId,
          patronatId: patronat.id,
          academicYearId: year.id,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          examType: dto.examType?.trim() || 'NATIONAL',
          level: dto.level?.trim() || 'CM2',
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          registrationStartDate: dto.registrationStartDate
            ? new Date(dto.registrationStartDate)
            : new Date(),
          registrationEndDate: dto.registrationEndDate
            ? new Date(dto.registrationEndDate)
            : new Date(dto.startDate),
          status: 'DRAFT',
          createdBy: userId,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_EXAM_CREATED',
          resource: 'NationalExam',
          resourceId: created.id,
          tableName: 'national_exams',
          recordId: created.id,
          newData: { code: created.code, name: created.name, level: created.level },
        },
      });
      return created;
    });

    this.logger.log(`Examen créé : ${exam.code} — ${exam.name} (${patronat.name})`);
    return { success: true, exam };
  }

  async updateExam(tenantId: string, userId: string, examId: string, dto: UpdateExamDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteOrg(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);

    const data: any = { updatedAt: new Date() };
    if (dto.name?.trim()) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.status) {
      const allowed = [
        'DRAFT',
        'REGISTRATION_OPEN',
        'REGISTRATION_CLOSED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'ARCHIVED',
      ];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(`Statut invalide. Statuts acceptés : ${allowed.join(', ')}.`);
      }
      data.status = dto.status;
    }
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);

    const updated = await this.prisma.nationalExam.update({ where: { id: exam.id }, data });
    return { success: true, exam: updated };
  }

  // ── 2. Centres d'examen ──────────────────────────────────────────────────

  async listCenters(tenantId: string, userId: string, examId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);

    const centers = await this.prisma.examCenter.findMany({
      where: { examId: exam.id, status: { not: 'ARCHIVED' } },
      include: {
        _count: { select: { candidates: true } },
        examRooms: { orderBy: { code: 'asc' } },
      },
      orderBy: { code: 'asc' },
    });

    return {
      exam: { id: exam.id, code: exam.code, name: exam.name, level: exam.level },
      centers: centers.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        address: c.address,
        capacity: c.capacity,
        status: c.status,
        contactName: c.contactName,
        contactPhone: c.contactPhone,
        contactEmail: c.contactEmail,
        rooms: c.examRooms.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          capacity: r.capacity,
          currentOccupancy: r.currentOccupancy,
          floor: r.floor,
          building: r.building,
          status: r.status,
        })),
        roomsCount: c.examRooms.length,
        roomsCapacity: c.examRooms.reduce((sum, r) => sum + r.capacity, 0),
        assignedCandidates: c._count.candidates,
      })),
    };
  }

  async createCenter(tenantId: string, userId: string, examId: string, dto: CreateCenterDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteOrg(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    if (EXAM_BLOCKED_STATUSES.includes(exam.status)) {
      throw new BadRequestException("Examen terminé ou annulé — plus de modification possible.");
    }
    const year = await this.getActiveYear(patronat.tenantId);

    if (!dto.code?.trim() || !dto.name?.trim()) {
      throw new BadRequestException('Le code et le nom du centre sont requis.');
    }

    const duplicate = await this.prisma.examCenter.findFirst({
      where: {
        tenantId: patronat.tenantId,
        academicYearId: year.id,
        examId: exam.id,
        code: dto.code.trim().toUpperCase(),
      },
    });
    if (duplicate) {
      throw new BadRequestException(`Le centre ${dto.code.trim().toUpperCase()} existe déjà pour cet examen.`);
    }

    const center = await this.prisma.$transaction(async (tx) => {
      const created = await tx.examCenter.create({
        data: {
          tenantId: patronat.tenantId,
          academicYearId: year.id,
          examId: exam.id,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          address: dto.address?.trim() || null,
          contactName: dto.contactName?.trim() || null,
          contactPhone: dto.contactPhone?.trim() || null,
          contactEmail: dto.contactEmail?.trim().toLowerCase() || null,
          createdBy: userId,
        },
      });
      await tx.nationalExam.update({
        where: { id: exam.id },
        data: { totalCenters: { increment: 1 } },
      });
      await tx.auditLog.create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_EXAM_CENTER_CREATED',
          resource: 'ExamCenter',
          resourceId: created.id,
          tableName: 'exam_centers',
          recordId: created.id,
          newData: { code: created.code, name: created.name, exam: exam.code },
        },
      });
      return created;
    });

    return { success: true, center };
  }

  async updateCenter(tenantId: string, userId: string, centerId: string, dto: UpdateCenterDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteOrg(fn);
    const center = await this.prisma.examCenter.findFirst({
      where: { id: centerId, tenantId: patronat.tenantId },
    });
    if (!center) throw new NotFoundException('Centre introuvable dans votre périmètre.');

    const data: any = { updatedAt: new Date() };
    if (dto.name?.trim()) data.name = dto.name.trim();
    if (dto.address !== undefined) data.address = dto.address?.trim() || null;
    if (dto.contactName !== undefined) data.contactName = dto.contactName?.trim() || null;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone?.trim() || null;
    if (dto.contactEmail !== undefined) data.contactEmail = dto.contactEmail?.trim().toLowerCase() || null;
    if (dto.status) {
      if (!['ACTIVE', 'ARCHIVED', 'MAINTENANCE'].includes(dto.status)) {
        throw new BadRequestException('Statut de centre invalide (ACTIVE, ARCHIVED, MAINTENANCE).');
      }
      data.status = dto.status;
    }

    const updated = await this.prisma.examCenter.update({ where: { id: center.id }, data });
    return { success: true, center: updated };
  }

  // ── 3. Salles ────────────────────────────────────────────────────────────

  async createRoom(tenantId: string, userId: string, centerId: string, dto: CreateRoomDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteOrg(fn);
    const center = await this.prisma.examCenter.findFirst({
      where: { id: centerId, tenantId: patronat.tenantId },
    });
    if (!center) throw new NotFoundException('Centre introuvable dans votre périmètre.');
    if (!dto.code?.trim()) throw new BadRequestException('Le code de la salle est requis.');
    if (!dto.capacity || dto.capacity < 1) {
      throw new BadRequestException('La capacité doit être supérieure à 0.');
    }

    const duplicate = await this.prisma.examRoom.findFirst({
      where: { centerId: center.id, code: dto.code.trim().toUpperCase() },
    });
    if (duplicate) throw new BadRequestException(`La salle ${dto.code.trim().toUpperCase()} existe déjà dans ce centre.`);

    const room = await this.prisma.$transaction(async (tx) => {
      const created = await tx.examRoom.create({
        data: {
          tenantId: patronat.tenantId,
          academicYearId: center.academicYearId,
          examId: center.examId,
          centerId: center.id,
          code: dto.code.trim().toUpperCase(),
          name: dto.name?.trim() || `Salle ${dto.code.trim().toUpperCase()}`,
          capacity: Math.floor(dto.capacity),
          floor: dto.floor ?? null,
          building: dto.building?.trim() || null,
          createdBy: userId,
        },
      });
      await tx.examCenter.update({
        where: { id: center.id },
        data: { totalRooms: { increment: 1 }, capacity: { increment: Math.floor(dto.capacity) } },
      });
      await tx.auditLog.create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_EXAM_ROOM_CREATED',
          resource: 'ExamRoom',
          resourceId: created.id,
          tableName: 'exam_rooms',
          recordId: created.id,
          newData: { code: created.code, capacity: created.capacity, center: center.code },
        },
      });
      return created;
    });

    return { success: true, room };
  }

  async updateRoom(tenantId: string, userId: string, roomId: string, dto: UpdateRoomDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteOrg(fn);
    const room = await this.prisma.examRoom.findFirst({
      where: { id: roomId, tenantId: patronat.tenantId },
    });
    if (!room) throw new NotFoundException('Salle introuvable dans votre périmètre.');

    const data: any = { updatedAt: new Date() };
    if (dto.name?.trim()) data.name = dto.name.trim();
    if (dto.building !== undefined) data.building = dto.building?.trim() || null;
    if (dto.floor !== undefined) data.floor = dto.floor;
    if (dto.status) {
      if (!['AVAILABLE', 'FULL', 'MAINTENANCE'].includes(dto.status)) {
        throw new BadRequestException('Statut de salle invalide (AVAILABLE, FULL, MAINTENANCE).');
      }
      data.status = dto.status;
    }
    if (dto.capacity !== undefined) {
      if (dto.capacity < room.currentOccupancy) {
        throw new BadRequestException(
          `Capacité inférieure à l'occupation actuelle (${room.currentOccupancy} candidats déjà affectés).`,
        );
      }
      data.capacity = Math.floor(dto.capacity);
    }

    const updated = await this.prisma.examRoom.update({ where: { id: room.id }, data });
    return { success: true, room: updated };
  }

  // ── 4. Candidats (liste, ajout manuel, import Excel) ─────────────────────

  async listCandidates(tenantId: string, userId: string, examId: string, search?: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);

    const where: any = { examId: exam.id };
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { matricule: { contains: q, mode: 'insensitive' } },
        { registrationNumber: { contains: q, mode: 'insensitive' } },
        { tableNumber: { contains: q } },
      ];
    }

    const [candidates, total] = await Promise.all([
      this.prisma.examCandidate.findMany({
        where,
        include: {
          center: { select: { id: true, code: true, name: true } },
          room: { select: { id: true, code: true, name: true } },
          schoolTenant: { select: { id: true, name: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        take: 500,
      }),
      this.prisma.examCandidate.count({ where: { examId: exam.id } }),
    ]);

    return {
      exam: { id: exam.id, code: exam.code, name: exam.name, status: exam.status },
      total,
      withoutCenter: candidates.filter((c) => !c.centerId).length,
      withoutTable: candidates.filter((c) => !c.tableNumber).length,
      candidates: candidates.map((c) => ({
        id: c.id,
        registrationNumber: c.registrationNumber,
        matricule: c.matricule,
        tableNumber: c.tableNumber,
        firstName: c.firstName,
        lastName: c.lastName,
        gender: c.gender,
        dateOfBirth: c.dateOfBirth,
        status: c.status,
        school: c.schoolTenant?.name ?? (c.metadata as any)?.schoolName ?? '—',
        center: c.center ? { code: c.center.code, name: c.center.name } : null,
        room: c.room ? { code: c.room.code, name: c.room.name } : null,
      })),
    };
  }

  /** Génère un matricule séquentiel unique : <CODE EXAM>-<année>-<séquence>. */
  private async nextMatricule(examCode: string, tenantId: string): Promise<string> {
    const count = await this.prisma.examCandidate.count({ where: { tenantId } });
    const year = new Date().getFullYear();
    let seq = count + 1;
    // Garde-fou collision (peu probable) : incrémente jusqu'à disponibilité
    for (let i = 0; i < 50; i++) {
      const candidate = `${examCode}-${year}-${String(seq).padStart(5, '0')}`;
      const exists = await this.prisma.examCandidate.findUnique({
        where: { matricule: candidate },
      });
      if (!exists) return candidate;
      seq++;
    }
    return `${examCode}-${year}-${Date.now()}`;
  }

  async addCandidate(tenantId: string, userId: string, examId: string, dto: AddCandidateDto) {
    const rows = await this.importCandidates(tenantId, userId, examId, {
      rows: [
        {
          firstName: dto.firstName,
          lastName: dto.lastName,
          dateOfBirth: dto.dateOfBirth,
          gender: dto.gender,
          schoolName: dto.schoolName,
          matricule: dto.matricule,
          phone: dto.phone,
          email: dto.email,
        },
      ],
    });
    return {
      success: rows.created > 0,
      candidate: rows.createdRows?.[0] ?? null,
      warnings: rows.report.errors,
    };
  }

  /**
   * Import de candidats par lot (lignes déjà extraites du fichier Excel côté
   * client). Validation ligne à ligne : champs requis, unicité matricule /
   * numéro d'inscription, doublons (prénom + nom + date de naissance).
   */
  async importCandidates(
    tenantId: string,
    userId: string,
    examId: string,
    dto: ImportCandidatesDto,
  ) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteCandidates(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    if (EXAM_BLOCKED_STATUSES.includes(exam.status)) {
      throw new BadRequestException("Examen terminé ou annulé — import impossible.");
    }
    const year = await this.getActiveYear(patronat.tenantId);

    const rows = dto.rows ?? [];
    if (rows.length === 0) throw new BadRequestException('Aucune ligne à importer.');
    if (rows.length > 5000) throw new BadRequestException('Import limité à 5 000 lignes par lot.');

    // Quota de candidats du plan
    const plan =
      FEDERIS_PLANS[(patronat.subscriptionPlan as FederisPlanCode)] ?? FEDERIS_PLANS.ESSENTIEL;
    const currentCount = await this.prisma.examCandidate.count({
      where: { tenantId: patronat.tenantId, academicYearId: year.id },
    });
    if (currentCount + rows.length > plan.maxCandidates) {
      throw new BadRequestException(
        `Quota de candidats de l'offre ${plan.name} dépassé (${plan.maxCandidates} max, ${currentCount} enregistrés). Passez à l'offre Institution.`,
      );
    }

    // Résolution écoles : rattachées (Helm) par nom, sinon stockage metadata
    // (annotation any[] — le typage Prisma complet arrive à la génération client)
    const linkedSchools: any[] = await this.prisma.patronatSchool.findMany({
      where: { patronatId: patronat.id, status: 'JOINED' },
      include: { schoolTenant: { select: { id: true, name: true } } },
    });
    const schoolsByName = new Map(
      linkedSchools
        .filter((s) => s.schoolTenant)
        .map((s) => [(s.schoolTenant!.name ?? '').toLowerCase(), s]),
    );

    const report = { created: 0, skipped: 0, errors: [] as string[] };
    const createdRows: any[] = [];
    const seenMatricules = new Set<string>();
    const seenIdentities = new Set<string>();

    // Doublons existants en base (une seule passe)
    const matricules = rows.map((r) => r.matricule?.trim()).filter(Boolean) as string[];
    const existingMatricules = new Set(
      matricules.length
        ? (
            await this.prisma.examCandidate.findMany({
              where: { matricule: { in: matricules } },
              select: { matricule: true },
            })
          ).map((m) => m.matricule)
        : [],
    );

    const toCreate: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const line = i + 2; // ligne Excel (1 = en-tête)
      const firstName = row.firstName?.trim() ?? '';
      const lastName = row.lastName?.trim() ?? '';

      if (!firstName || !lastName) {
        report.errors.push(`Ligne ${line} : prénom et nom obligatoires — ligne ignorée.`);
        report.skipped++;
        continue;
      }

      let matricule = row.matricule?.trim() ?? '';
      if (matricule) {
        if (existingMatricules.has(matricule) || seenMatricules.has(matricule)) {
          report.errors.push(`Ligne ${line} : le matricule ${matricule} existe déjà — ligne ignorée.`);
          report.skipped++;
          continue;
        }
        seenMatricules.add(matricule);
      }

      const dob = row.dateOfBirth ? new Date(row.dateOfBirth) : null;
      const identityKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${dob?.toISOString().slice(0, 10) ?? ''}`;
      if (seenIdentities.has(identityKey)) {
        report.errors.push(`Ligne ${line} : doublon dans le fichier (${firstName} ${lastName}) — ligne ignorée.`);
        report.skipped++;
        continue;
      }
      seenIdentities.add(identityKey);

      const schoolEntry = row.schoolName
        ? schoolsByName.get(row.schoolName.trim().toLowerCase())
        : undefined;

      toCreate.push({
        firstName,
        lastName,
        dateOfBirth: dob && !isNaN(dob.getTime()) ? dob : null,
        gender: row.gender?.trim()?.toUpperCase()?.slice(0, 10) || null,
        placeOfBirth: row.placeOfBirth?.trim() || null,
        matricule, // généré plus bas si vide
        registrationNumber: row.registrationNumber?.trim() || null,
        phone: row.phone?.trim() || null,
        email: row.email?.trim()?.toLowerCase() || null,
        schoolTenantId: schoolEntry?.schoolTenantId ?? null,
        metadata: {
          schoolName: row.schoolName?.trim() || null,
          importedAt: new Date().toISOString(),
        },
      });
    }

    if (toCreate.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const c of toCreate) {
          if (!c.matricule) c.matricule = await this.nextMatricule(exam.code, patronat.tenantId);
          if (!c.registrationNumber) c.registrationNumber = c.matricule;
          const created = await tx.examCandidate.create({
            data: {
              tenantId: patronat.tenantId,
              academicYearId: year.id,
              examId: exam.id,
              schoolTenantId: c.schoolTenantId,
              firstName: c.firstName,
              lastName: c.lastName,
              dateOfBirth: c.dateOfBirth,
              gender: c.gender,
              placeOfBirth: c.placeOfBirth,
              matricule: c.matricule,
              registrationNumber: c.registrationNumber,
              phone: c.phone,
              email: c.email,
              metadata: c.metadata,
              status: 'REGISTERED',
              createdBy: userId,
            },
          });
          report.created++;
          createdRows.push({
            id: created.id,
            matricule: created.matricule,
            firstName: created.firstName,
            lastName: created.lastName,
          });
        }
        await tx.nationalExam.update({
          where: { id: exam.id },
          data: { totalCandidates: { increment: toCreate.length } },
        });
        await tx.auditLog.create({
          data: {
            tenantId: patronat.tenantId,
            userId,
            action: 'FEDERIS_CANDIDATES_IMPORTED',
            resource: 'ExamCandidate',
            resourceId: exam.id,
            tableName: 'exam_candidates',
            recordId: exam.id,
            newData: { created: toCreate.length, skipped: report.skipped, exam: exam.code },
          },
        });
      });
    }

    this.logger.log(
      `Import candidats ${exam.code} : ${report.created} créés, ${report.skipped} ignorés (${patronat.name})`,
    );

    return {
      success: true,
      created: report.created,
      skipped: report.skipped,
      errors: report.errors.slice(0, 50),
      totalAfter: currentCount + report.created,
      quota: { used: currentCount + report.created, max: plan.maxCandidates },
      createdRows,
      report,
    };
  }

  // ── 5. Affectation des numéros de table ──────────────────────────────────

  /**
   * Affectation automatique des candidats aux salles + numéros de table.
   *
   * Algorithme :
   *   1. Candidats actifs (statut ≠ CANCELLED) triés — par école puis nom
   *      (SCHOOL, défaut : mélange les écoles pour limiter la copie entre
   *      voisins) ou alphabétique pur (NAME)
   *   2. Parallélisation logistique : on remplit chaque salle du centre
   *      jusqu'à sa capacité, centre par centre (ordre code)
   *   3. Numérotation séquentielle par CENTRE (défaut, ex. CTR-001 → 001)
   *      ou globale à l'EXAM
   *   4. Mise à jour transactionnelle : candidates.centerId/roomId/tableNumber
   *      + salles currentOccupancy/status + audit
   */
  async assignTableNumbers(tenantId: string, userId: string, examId: string, dto: AssignTablesDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteOrg(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    if (EXAM_BLOCKED_STATUSES.includes(exam.status)) {
      throw new BadRequestException("Examen terminé ou annulé — affectation impossible.");
    }

    const [candidates, centers] = await Promise.all([
      this.prisma.examCandidate.findMany({
        where: { examId: exam.id, status: { not: 'CANCELLED' } },
        include: { schoolTenant: { select: { name: true } } },
      }),
      this.prisma.examCenter.findMany({
        where: { examId: exam.id, status: 'ACTIVE' },
        include: { examRooms: { where: { status: 'AVAILABLE' }, orderBy: { code: 'asc' } } },
        orderBy: { code: 'asc' },
      }),
    ]);

    const rooms = centers.flatMap((c) =>
      c.examRooms.map((r) => ({ room: r, center: c, capacity: r.capacity })),
    );
    const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);
    if (rooms.length === 0) {
      throw new BadRequestException(
        "Aucune salle disponible. Créez d'abord des centres et des salles pour cet examen.",
      );
    }

    // Tri des candidats
    const orderBy = dto.orderBy ?? 'SCHOOL';
    const sorted = [...candidates].sort((a, b) => {
      if (orderBy === 'SCHOOL') {
        const schoolA = a.schoolTenant?.name ?? (a.metadata as any)?.schoolName ?? 'zzz';
        const schoolB = b.schoolTenant?.name ?? (b.metadata as any)?.schoolName ?? 'zzz';
        const cmp = String(schoolA).localeCompare(String(schoolB), 'fr');
        if (cmp !== 0) return cmp;
      }
      const nameCmp = a.lastName.localeCompare(b.lastName, 'fr');
      if (nameCmp !== 0) return nameCmp;
      return a.firstName.localeCompare(b.firstName, 'fr');
    });

    const scope = dto.numberingScope ?? 'CENTER';
    const start = Math.max(1, dto.startNumber ?? 1);
    let globalCounter = start - 1;

    // Attribution
    const assignments: Array<{
      candidateId: string;
      centerId: string;
      roomId: string;
      tableNumber: string;
    }> = [];
    const roomOccupancy = new Map<string, number>();
    let roomIndex = 0;

    for (const candidate of sorted) {
      // Cherche la prochaine salle avec de la place
      while (roomIndex < rooms.length && rooms[roomIndex].capacity <= (roomOccupancy.get(rooms[roomIndex].room.id) ?? 0)) {
        roomIndex++;
      }
      if (roomIndex >= rooms.length) break; // capacité épuisée

      const target = rooms[roomIndex];
      const occupied = (roomOccupancy.get(target.room.id) ?? 0) + 1;
      roomOccupancy.set(target.room.id, occupied);

      if (scope === 'EXAM') {
        globalCounter++;
      } else {
        // Compteur par centre : nombre déjà affecté dans CE centre + start
        const perCenter = assignments.filter((a) => a.centerId === target.center.id).length;
        globalCounter = start + perCenter;
      }

      assignments.push({
        candidateId: candidate.id,
        centerId: target.center.id,
        roomId: target.room.id,
        tableNumber: String(globalCounter).padStart(3, '0'),
      });
    }

    const unassigned = sorted.length - assignments.length;

    await this.prisma.$transaction(async (tx) => {
      for (const a of assignments) {
        await tx.examCandidate.update({
          where: { id: a.candidateId },
          data: {
            centerId: a.centerId,
            roomId: a.roomId,
            tableNumber: a.tableNumber,
          },
        });
      }
      for (const [roomId, occupancy] of roomOccupancy.entries()) {
        const room = rooms.find((r) => r.room.id === roomId)!;
        await tx.examRoom.update({
          where: { id: roomId },
          data: {
            currentOccupancy: occupancy,
            status: occupancy >= room.capacity ? 'FULL' : 'AVAILABLE',
          },
        });
      }
      await tx.auditLog.create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_TABLE_NUMBERS_ASSIGNED',
          resource: 'ExamCandidate',
          resourceId: exam.id,
          tableName: 'exam_candidates',
          recordId: exam.id,
          newData: {
            exam: exam.code,
            assigned: assignments.length,
            unassigned,
            orderBy,
            numberingScope: scope,
          },
        },
      });
    });

    // Résumé par centre (pour l'UI)
    const perCenter = centers.map((c) => {
      const centerAssignments = assignments.filter((a) => a.centerId === c.id);
      return {
        centerCode: c.code,
        centerName: c.name,
        candidates: centerAssignments.length,
        rooms: c.examRooms.map((r) => ({
          code: r.code,
          capacity: r.capacity,
          occupancy: roomOccupancy.get(r.id) ?? 0,
        })),
      };
    });

    this.logger.log(
      `Numéros affectés ${exam.code} : ${assignments.length} candidats, ${unassigned} non affectés (${patronat.name})`,
    );

    return {
      success: true,
      assigned: assignments.length,
      unassigned,
      totalCapacity,
      orderBy,
      numberingScope: scope,
      perCenter,
      message:
        unassigned > 0
          ? `${assignments.length} candidats affectés. Capacité insuffisante pour ${unassigned} candidat(s) — ajoutez des salles.`
          : `${assignments.length} candidats affectés avec numéro de table.`,
    };
  }
}
