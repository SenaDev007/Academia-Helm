import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * ============================================================================
 * MultigradeService — Gestion des affectations multigrade
 * ============================================================================
 *
 * Un enseignant multigrade enseigne à 2 classes du même niveau en alternance
 * (horaires décalés, pas simultanés). Cas typique au Bénin : un prof primaire
 * fait CE1 + CE2 (CE1 à 8h, CE2 à 10h).
 *
 * Règles :
 * - Exactement 2 classes par groupe (pas plus, pas moins)
 * - Les 2 classes doivent être du même schoolLevelId (pas de multigrade inter-niveau)
 * - Maximum 1 groupe multigrade par teacher+academicYear (unicité)
 * ============================================================================
 */

@Injectable()
export class MultigradeService {
  private readonly logger = new Logger(MultigradeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère tous les groupes multigrade d'un tenant (+ filtres optionnels).
   */
  async findAll(tenantId: string, filters?: {
    academicYearId?: string;
    teacherId?: string;
    schoolLevelId?: string;
    isActive?: boolean;
  }) {
    const where: any = { tenantId };
    if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters?.teacherId) where.teacherId = filters.teacherId;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    const assignments = await this.prisma.multigradeAssignment.findMany({
      where,
      include: {
        teacher: {
          select: {
            id: true, firstName: true, lastName: true, matricule: true, email: true,
            schoolLevelId: true, assignedLanguages: true,
            photoUrl: true, // Si la photo a été ajoutée via le fix précédent
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrichir avec les détails des classes (classIds est un JSON array d'IDs)
    const allClassIds = new Set<string>();
    for (const a of assignments) {
      const ids = Array.isArray(a.classIds) ? a.classIds : [];
      ids.forEach((id: string) => allClassIds.add(id));
    }

    let classDetails: any[] = [];
    if (allClassIds.size > 0) {
      classDetails = await this.prisma.class.findMany({
        where: { id: { in: Array.from(allClassIds) } },
        select: { id: true, name: true, code: true, schoolLevelId: true, capacity: true },
      });
    }

    const classMap = new Map(classDetails.map((c) => [c.id, c]));

    // Filtrer par schoolLevelId si fourni (vérifie que les 2 classes sont du niveau)
    let result = assignments.map((a) => {
      const ids = Array.isArray(a.classIds) ? a.classIds : [];
      const classes = ids.map((id: string) => classMap.get(id)).filter(Boolean);
      return {
        ...a,
        classes,
        classIds: ids,
      };
    });

    if (filters?.schoolLevelId) {
      result = result.filter((r) =>
        r.classes.length === 2 && r.classes.every((c: any) => c.schoolLevelId === filters.schoolLevelId),
      );
    }

    return result;
  }

  /**
   * Crée un nouveau groupe multigrade.
   * Validation :
   * - Exactement 2 classIds
   * - Les 2 classes doivent être du même schoolLevelId
   * - Le teacher ne doit pas déjà avoir un groupe multigrade pour cette année
   */
  async create(tenantId: string, data: {
    academicYearId: string;
    teacherId: string;
    classIds: string[];
    language?: string | null;
    notes?: string;
  }) {
    // Validation : exactement 2 classes
    if (!data.classIds || data.classIds.length !== 2) {
      throw new BadRequestException('Un groupe multigrade doit contenir exactement 2 classes.');
    }

    // Vérifier que les 2 classes existent et sont du même schoolLevelId
    const classes = await this.prisma.class.findMany({
      where: { id: { in: data.classIds }, tenantId },
      select: { id: true, name: true, schoolLevelId: true },
    });

    if (classes.length !== 2) {
      throw new BadRequestException('Une ou plusieurs classes introuvables.');
    }

    const schoolLevelIds = new Set(classes.map((c) => c.schoolLevelId));
    if (schoolLevelIds.size !== 1) {
      throw new BadRequestException(
        'Les 2 classes doivent être du même niveau scolaire (pas de multigrade inter-niveau).',
      );
    }

    // Vérifier que le teacher existe
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: data.teacherId, tenantId },
      select: { id: true, firstName: true, lastName: true, assignedLanguages: true },
    });
    if (!teacher) {
      throw new BadRequestException('Enseignant introuvable.');
    }

    // Vérifier l'unicité : pas de groupe multigrade existant pour ce teacher+année
    const existing = await this.prisma.multigradeAssignment.findFirst({
      where: {
        tenantId,
        academicYearId: data.academicYearId,
        teacherId: data.teacherId,
        isActive: true,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Cet enseignant a déjà un groupe multigrade actif pour cette année. ' +
        'Supprimez le groupe existant avant d\'en créer un nouveau.',
      );
    }

    // Validation langue (bilingue) : si language fourni, le teacher doit parler cette langue
    if (data.language) {
      const teacherLangs = Array.isArray(teacher.assignedLanguages)
        ? teacher.assignedLanguages
        : ['FR', 'EN']; // défaut
      if (!teacherLangs.includes(data.language)) {
        throw new BadRequestException(
          `L'enseignant ne parle pas la langue ${data.language} (langues assignées : ${teacherLangs.join(', ')}).`,
        );
      }
    }

    const id = uuidv4();
    const created = await this.prisma.multigradeAssignment.create({
      data: {
        id,
        tenantId,
        academicYearId: data.academicYearId,
        teacherId: data.teacherId,
        classIds: data.classIds,
        language: data.language ?? null,
        notes: data.notes ?? null,
        isActive: true,
      },
      include: {
        teacher: {
          select: { id: true, firstName: true, lastName: true, matricule: true },
        },
      },
    });

    this.logger.log(`Multigrade created: ${id} (teacher=${data.teacherId}, classes=${data.classIds.join(',')})`);
    return created;
  }

  /**
   * Met à jour un groupe multigrade (notes, isActive, language).
   * Les classIds et teacherId ne sont pas modifiables (supprimer + recréer).
   */
  async update(tenantId: string, id: string, data: {
    language?: string | null;
    notes?: string | null;
    isActive?: boolean;
  }) {
    const existing = await this.prisma.multigradeAssignment.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Groupe multigrade introuvable.');

    return this.prisma.multigradeAssignment.update({
      where: { id },
      data: {
        ...(data.language !== undefined ? { language: data.language } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, matricule: true } },
      },
    });
  }

  /**
   * Supprime un groupe multigrade.
   */
  async delete(tenantId: string, id: string) {
    const existing = await this.prisma.multigradeAssignment.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Groupe multigrade introuvable.');

    await this.prisma.multigradeAssignment.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Récupère les groupes multigrade actifs pour un teacher donné.
   * Utilisé par le STE pendant la génération.
   */
  async findByTeacher(tenantId: string, teacherId: string, academicYearId?: string) {
    const where: any = { tenantId, teacherId, isActive: true };
    if (academicYearId) where.academicYearId = academicYearId;
    return this.prisma.multigradeAssignment.findMany({ where });
  }
}
