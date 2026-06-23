/**
 * ============================================================================
 * STAFF PRISMA SERVICE - MODULE 5 (SCHEMA-ALIGNED v3)
 * ============================================================================
 *
 * Service aligné sur le schéma Prisma réel :
 * - Dual matricule: globalMatricule (Academia Helm) + tenantMatricule (école)
 * - employeeNumber kept as legacy internal reference
 * - roleType (ex category: PEDAGOGICAL→TEACHER, ADMIN→ADMIN, SUPPORT→SUPPORT)
 * - StaffDocument : { documentType, category, fileName, filePath, mimeType, validationStatus, ... }
 * - StaffPhoto : { originalUrl, hdUrl, thumbnailUrl }
 *
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StaffMatriculeService } from './staff-matricule.service';
import { StorageService } from '../common/services/storage.service';
import { StaffCredentialService } from './services/staff-credential.service';
import { prismaCreateDefaults, prismaUpdateDefaults, prismaCreateNoUpdatedAt } from '../common/utils/prisma-helpers';
import { BatchAssignLevelDto } from './dto/index';

// Mapping catégorie UI → roleType Prisma
const CATEGORY_TO_ROLE: Record<string, string> = {
  PEDAGOGICAL: 'TEACHER',
  ADMIN:       'ADMIN',
  SUPPORT:     'SUPPORT',
  TEACHER:     'TEACHER',
};

// Document type → category mapping (structured organization)
const DOC_TYPE_TO_CATEGORY: Record<string, string> = {
  CV:                 'EXPERIENCE',
  CNI:                'IDENTITE',
  PASSPORT:           'IDENTITE',
  BIRTH_CERTIFICATE:  'IDENTITE',
  DIPLOMA:            'DIPLOMES',
  CERTIFICATE:        'DIPLOMES',
  TRANSCRIPT:         'DIPLOMES',
  CONTRACT:           'ADMINISTRATIF',
  CNSS_CERTIFICATE:   'ADMINISTRATIF',
  MEDICAL_CERTIFICATE:'MEDICAL',
  WORK_PERMIT:        'ADMINISTRATIF',
  OTHER:              'GENERAL',
};

// Document categories for display
export const DOC_CATEGORIES = {
  IDENTITE:      { label: 'Pièces d\'identité',     icon: 'shield',    order: 1 },
  DIPLOMES:      { label: 'Diplômes & Certificats', icon: 'graduation',order: 2 },
  EXPERIENCE:    { label: 'Expérience professionnelle', icon: 'briefcase', order: 3 },
  ADMINISTRATIF: { label: 'Documents administratifs', icon: 'file',     order: 4 },
  MEDICAL:       { label: 'Documents médicaux',      icon: 'heart',     order: 5 },
  GENERAL:       { label: 'Autres documents',        icon: 'folder',    order: 6 },
} as const;

function generateEmployeeNumber(): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `STF-${year}-${rand}`;
}

@Injectable()
export class StaffPrismaService {
  private readonly logger = new Logger(StaffPrismaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matriculeService: StaffMatriculeService,
    private readonly storageService: StorageService,
    private readonly credentialService: StaffCredentialService,
  ) {}

  /**
   * Crée un membre du personnel avec matricules dual.
   */
  async createStaff(data: {
    tenantId: string;
    academicYearId?: string;
    // Champs wizard
    firstName: string;
    lastName: string;
    gender?: string;
    birthDate?: string | Date;
    phone?: string;
    email?: string;
    address?: string;
    position?: string;
    category?: string;     // PEDAGOGICAL / ADMIN / SUPPORT → mappé en roleType
    roleType?: string;     // Accepté directement si fourni
    status?: string;
    // Champs optionnels avancés
    staffCode?: string;    // Utilisé comme préfixe employeeNumber si fourni
    employeeNumber?: string;
    hireDate?: string | Date;
    qualifications?: string;
    notes?: string;
    department?: string;
  }) {
    // Générer un numéro d'employé si non fourni
    const employeeNumber = data.employeeNumber
      || data.staffCode
      || generateEmployeeNumber();

    // Vérifier l'unicité du numéro d'employé
    const existing = await this.prisma.staff.findUnique({
      where: { employeeNumber },
    });
    if (existing) {
      const newNumber = `${employeeNumber}-${Date.now().toString().slice(-4)}`;
      return this.doCreateStaff(data, newNumber);
    }

    return this.doCreateStaff(data, employeeNumber);
  }

  private async doCreateStaff(data: any, employeeNumber: string) {
    const roleType = data.roleType
      || CATEGORY_TO_ROLE[data.category || '']
      || 'TEACHER';

    // Generate dual matricules
    let globalMatricule: string | null = null;
    let tenantMatricule: string | null = null;
    try {
      const matricules = await this.matriculeService.generate(data.tenantId);
      globalMatricule = matricules.globalMatricule;
      tenantMatricule = matricules.tenantMatricule;
    } catch (error) {
      // If matricule generation fails, continue without it (will be generated later)
      console.error('Matricule generation failed:', error.message);
    }

    // Use tenantMatricule as employeeNumber (school-code based, e.g. AHACAD-26-00001)
    // Falls back to the provided employeeNumber if tenantMatricule generation failed
    const finalEmployeeNumber = tenantMatricule || employeeNumber;

    const created = await this.prisma.staff.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId:       data.tenantId,
        academicYearId: data.academicYearId || null,
        schoolLevelId:  data.schoolLevelId || null,
        employeeNumber: finalEmployeeNumber,
        globalMatricule,
        tenantMatricule,
        firstName:      data.firstName,
        lastName:       data.lastName,
        gender:         data.gender || null,
        birthDate:      data.birthDate ? new Date(data.birthDate) : null,
        phone:          data.phone || null,
        email:          data.email || null,
        address:        data.address || null,
        position:       data.position || null,
        department:     data.department || null,
        roleType,
        hireDate:       data.hireDate ? new Date(data.hireDate) : new Date(),
        status:         data.status || 'PENDING_SIGNATURE',
        qualifications: data.qualifications || null,
        notes:          data.notes || null,
      },
    });

    // ─── Pont HR → Pédagogie ──
    // Si le staff créé est un enseignant (roleType=TEACHER) avec un schoolLevelId,
    // créer automatiquement un enregistrement Teacher dans le module Pédagogie
    // pour qu'il apparaisse dans les affectations de classes.
    if (roleType === 'TEACHER' && (data.schoolLevelId || created.schoolLevelId)) {
      try {
        const existingTeacher = await this.prisma.teacher.findFirst({
          where: {
            tenantId: data.tenantId,
            OR: [
              { email: data.email || '' },
              { matricule: finalEmployeeNumber },
            ],
          },
        });

        if (!existingTeacher) {
          await this.prisma.teacher.create({
            data: {
              tenantId: data.tenantId,
              schoolLevelId: data.schoolLevelId || created.schoolLevelId,
              matricule: finalEmployeeNumber,
              firstName: data.firstName,
              lastName: data.lastName,
              gender: data.gender || null,
              dateOfBirth: data.birthDate ? new Date(data.birthDate) : null,
              phone: data.phone || null,
              email: data.email || null,
              address: data.address || null,
              position: data.position || 'Enseignant',
              qualifications: data.qualifications || null,
              hireDate: data.hireDate ? new Date(data.hireDate) : new Date(),
              contractType: data.contractType || null,
              status: 'active',
              academicYearId: data.academicYearId || null,
            },
          });
          this.logger.log(`Teacher auto-created in pedagogy for staff ${created.id} (${data.firstName} ${data.lastName})`);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to auto-create Teacher in pedagogy: ${err.message}`);
      }
    }

    // Retourner avec staffCode alias pour compatibilité frontend
    return {
      ...created,
      staffCode: created.employeeNumber,
      category: data.category || 'PEDAGOGICAL',
    };
  }

  /**
   * Récupère tous les membres du personnel
   */
  async findAllStaff(tenantId: string, filters?: {
    academicYearId?: string;
    category?: string;
    status?: string;
    levelAssigned?: string;
    includePromoter?: boolean;
  }) {
    const where: any = { tenantId };
    // Exclure le PROMOTEUR par défaut du comptage et de la liste du personnel
    // (il est le responsable, pas un employé compté dans l'effectif).
    // Si includePromoter=true ET que le promoteur est ACTIVE (non ARCHIVED),
    // on l'inclut. S'il est ARCHIVED, il reste exclu même avec includePromoter=true.
    if (filters?.includePromoter) {
      // Inclure le promoteur seulement s'il n'est pas ARCHIVED
      where.OR = [
        { roleType: { not: 'PROMOTEUR' } },
        { roleType: 'PROMOTEUR', status: { not: 'ARCHIVED' } },
      ];
    } else {
      where.roleType = { not: 'PROMOTEUR' };
    }
    if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters?.status && filters.status !== 'ALL') where.status = filters.status;
    if (filters?.category) {
      // Mapper category UI → roleType
      const role = CATEGORY_TO_ROLE[filters.category];
      if (role) {
        // Si on inclut le promoteur, on filtre par catégorie spécifique
        // Sinon, on filtre par catégorie ET on exclut PROMOTEUR
        if (filters.includePromoter) {
          where.roleType = { in: [role] };
        } else {
          where.roleType = { in: [role], not: 'PROMOTEUR' };
        }
      }
    }
    if (filters?.levelAssigned) {
      where.schoolLevelId = filters.levelAssigned;
    }

    const staff = await this.prisma.staff.findMany({
      where,
      include: {
        contracts: {
          where: { status: { in: ['ACTIVE', 'PENDING'] } },
          orderBy: { startDate: 'desc' },
          take: 1,
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        photo: true,
        schoolLevel: { select: { id: true, name: true, code: true } },
      },
      orderBy: { lastName: 'asc' },
    });

    // Ajouter staffCode et category aliases pour compatibilité frontend
    // Resolve photo URLs for R2/S3 storage (thumbnailUrl is a storage key, not a full URL)
    return Promise.all(staff.map(async (s) => ({
      ...s,
      staffCode: s.employeeNumber,
      category: Object.entries(CATEGORY_TO_ROLE).find(([, v]) => v === s.roleType)?.[0] || s.roleType,
      photoUrl: s.photo?.thumbnailUrl
        ? await this.storageService.resolveFileUrl(s.photo.thumbnailUrl)
        : null,
    })));
  }

  /**
   * Récupère un membre du personnel par ID
   */
  async findStaffById(id: string, tenantId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id, tenantId },
      include: {
        contracts: { orderBy: { startDate: 'desc' } },
        documents: { orderBy: [{ category: 'asc' }, { createdAt: 'desc' }] },
        attendance: { take: 30, orderBy: { date: 'desc' } },
        evaluations: { take: 10, orderBy: { createdAt: 'desc' } },
        trainings: { orderBy: { createdAt: 'desc' } },
        photo: true,
        schoolLevel: { select: { id: true, name: true, code: true } },
      },
    });

    if (!staff) {
      throw new NotFoundException(`Staff with ID ${id} not found`);
    }

    // Resolve photo URLs for R2/S3 storage
    const resolvedPhotoUrl = staff.photo?.thumbnailUrl
      ? await this.storageService.resolveFileUrl(staff.photo.thumbnailUrl)
      : null;

    return {
      ...staff,
      staffCode: staff.employeeNumber,
      category: Object.entries(CATEGORY_TO_ROLE).find(([, v]) => v === staff.roleType)?.[0] || staff.roleType,
      photoUrl: resolvedPhotoUrl,
    };
  }

  /**
   * Met à jour un membre du personnel
   */
  async updateStaff(id: string, tenantId: string, data: any) {
    await this.findStaffById(id, tenantId);

    // Mapper les champs UI vers Prisma
    const updateData: any = {};

    // Only include fields that are explicitly provided
    const allowedFields = [
      'firstName', 'lastName', 'gender', 'dateOfBirth', 'birthDate',
      'phone', 'email', 'address', 'position', 'department',
      'hireDate', 'contractType', 'status', 'qualifications', 'notes',
      'academicYearId', 'schoolLevelId',
      'nationality', 'maritalStatus', 'numberOfChildren',
      'nationalId', 'cnssNumber', 'ifuNumber',
      'terminationType', 'noticePeriodDays',
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    // Special field mappings
    if (data.category) {
      updateData.roleType = CATEGORY_TO_ROLE[data.category] || data.category;
      delete updateData.category; // Not a Prisma field
    }
    if (data.roleType) {
      updateData.roleType = data.roleType;
    }

    // Handle date fields — convert empty strings to null, valid strings to Date
    const dateFields = ['birthDate', 'dateOfBirth', 'hireDate', 'terminatedAt', 'lastWorkingDate'];
    for (const df of dateFields) {
      if (df in updateData) {
        if (updateData[df] === '' || updateData[df] === null || updateData[df] === undefined) {
          updateData[df] = null;
        } else {
          updateData[df] = new Date(updateData[df]);
        }
      }
    }

    // Handle integer fields — convert empty strings to null
    if ('numberOfChildren' in updateData) {
      if (updateData.numberOfChildren === '' || updateData.numberOfChildren === null || updateData.numberOfChildren === undefined) {
        updateData.numberOfChildren = null;
      } else {
        updateData.numberOfChildren = parseInt(updateData.numberOfChildren, 10) || null;
      }
    }

    // Handle terminationDetails (JSON field)
    if (data.terminationDetails !== undefined) {
      if (typeof data.terminationDetails === 'string' && data.terminationDetails.trim() !== '') {
        try {
          updateData.terminationDetails = JSON.parse(data.terminationDetails);
        } catch {
          updateData.terminationDetails = { note: data.terminationDetails };
        }
      } else if (typeof data.terminationDetails === 'object') {
        updateData.terminationDetails = data.terminationDetails;
      } else {
        updateData.terminationDetails = null;
      }
    }

    if (data.salary !== undefined) {
      updateData.salary = data.salary;
    }
    if (data.bankDetails !== undefined) {
      updateData.bankDetails = data.bankDetails;
    }
    if (data.emergencyContact !== undefined) {
      // Accept both object and string formats
      if (typeof data.emergencyContact === 'string' && data.emergencyContact.trim() !== '') {
        try {
          updateData.emergencyContact = JSON.parse(data.emergencyContact);
        } catch {
          // Store as a structured object with the free-form string
          updateData.emergencyContact = { note: data.emergencyContact };
        }
      } else if (typeof data.emergencyContact === 'object') {
        updateData.emergencyContact = data.emergencyContact;
      } else {
        updateData.emergencyContact = null;
      }
    }

    // Resolve EducationLevel ID → SchoolLevel ID if schoolLevelId is provided (non-null)
    // The frontend may send an EducationLevel ID from /settings/education/structure
    if (updateData.schoolLevelId && typeof updateData.schoolLevelId === 'string') {
      updateData.schoolLevelId = await this.resolveSchoolLevelId(updateData.schoolLevelId);
    }

    // Do NOT allow changing employeeNumber, globalMatricule, or tenantMatricule via update
    delete updateData.employeeNumber;
    delete updateData.globalMatricule;
    delete updateData.tenantMatricule;
    delete updateData.tenantId;

    return this.prisma.staff.update({
      where: { id },
      data: { ...prismaUpdateDefaults(), ...updateData },
    });
  }

  /**
   * Archive un membre du personnel (soft delete)
   */
  async archiveStaff(id: string, tenantId: string) {
    await this.findStaffById(id, tenantId);
    return this.prisma.staff.update({
      where: { id },
      data: { ...prismaUpdateDefaults(), status: 'INACTIVE' },
    });
  }

  /**
   * Termine un membre du personnel (débauche)
   */
  async terminateStaff(id: string, tenantId: string, data: {
    terminationType: string;
    terminationDetails?: any;
    noticePeriodDays?: number;
    lastWorkingDate?: string;
  }) {
    const staff = await this.findStaffById(id, tenantId);

    // Update staff status and termination info
    const updated = await this.prisma.staff.update({
      where: { id },
      data: {
        status: 'INACTIVE',
        terminationType: data.terminationType,
        terminationDetails: data.terminationDetails || null,
        terminatedAt: new Date(),
        noticePeriodDays: data.noticePeriodDays || null,
        lastWorkingDate: data.lastWorkingDate ? new Date(data.lastWorkingDate) : null,
      },
    });

    // Terminate all active/pending contracts for this staff member (batch update — no N+1)
    try {
      await this.prisma.contract.updateMany({
        where: { staffId: id, tenantId, status: { in: ['ACTIVE', 'PENDING'] } },
        data: {
          status: 'TERMINATED',
          terminatedAt: new Date(),
          terminationReason: `Débauche: ${data.terminationType}`,
        },
      });
    } catch (err: any) {
      console.error(`Failed to terminate contracts for staff ${id}: ${err.message}`);
    }

    return {
      ...updated,
      staffCode: updated.employeeNumber,
      category: Object.entries(CATEGORY_TO_ROLE).find(([, v]) => v === updated.roleType)?.[0] || updated.roleType,
    };
  }

  /**
   * Met à jour uniquement le champ terminationDetails d'un staff.
   * Utilisé pour stocker les signatures et URLs de documents de débauche.
   */
  async updateStaffTerminationDetails(id: string, tenantId: string, terminationDetails: any) {
    return this.prisma.staff.update({
      where: { id },
      data: { terminationDetails },
    });
  }

  /**
   * Réactive un membre du personnel (réintégration)
   */
  async reactivateStaff(id: string, tenantId: string) {
    const staff = await this.findStaffById(id, tenantId);

    if (staff.status !== 'INACTIVE') {
      throw new BadRequestException('Seul un membre inactif peut être réactivé');
    }

    // Vérifier si le personnel a un contrat signé pour déterminer le statut
    const hasSignedContract = await this.prisma.contract.findFirst({
      where: { staffId: id, tenantId, status: 'ACTIVE', signedAt: { not: null } },
    });
    const newStatus = hasSignedContract ? 'ACTIVE' : 'PENDING_SIGNATURE';

    const updated = await this.prisma.staff.update({
      where: { id },
      data: {
        status: newStatus,
        terminationType: null,
        terminationDetails: null,
        terminatedAt: null,
        noticePeriodDays: null,
        lastWorkingDate: null,
      },
    });

    return {
      ...updated,
      staffCode: updated.employeeNumber,
      category: Object.entries(CATEGORY_TO_ROLE).find(([, v]) => v === updated.roleType)?.[0] || updated.roleType,
    };
  }

  /**
   * Supprime définitivement un membre du personnel et toutes ses données associées
   * (hard delete — photos, documents, contrats, évaluations, etc.)
   */
  async hardDeleteStaff(id: string, tenantId: string) {
    // Verify staff exists in this tenant
    await this.findStaffById(id, tenantId);

    // Delete related records in order (respecting FK constraints)
    // 1. Staff photo
    try {
      const photos = await this.prisma.staffPhoto.findMany({ where: { staffId: id, tenantId } });
      await this.prisma.staffPhoto.deleteMany({ where: { staffId: id, tenantId } });
      for (const photo of photos) {
        for (const url of [photo.originalUrl, photo.hdUrl, photo.thumbnailUrl]) {
          if (!url) continue;
          try { await this.storageService.deleteFile(url); } catch {}
        }
      }
    } catch {}

    // 2. Staff documents
    try {
      const docs = await this.prisma.staffDocument.findMany({ where: { staffId: id, tenantId } });
      await this.prisma.staffDocument.deleteMany({ where: { staffId: id, tenantId } });
      for (const doc of docs) {
        try { await this.storageService.deleteFile(doc.filePath); } catch {}
      }
    } catch {}

    // 3. Staff evaluations
    try { await this.prisma.staffEvaluation.deleteMany({ where: { staffId: id, tenantId } }); } catch {}

    // 4. Staff attendance
    try { await this.prisma.staffAttendance.deleteMany({ where: { staffId: id, tenantId } }); } catch {}

    // 5. Staff schedules
    try { await this.prisma.staffSchedule.deleteMany({ where: { staffId: id, tenantId } }); } catch {}

    // 6. Staff allowances
    try { await this.prisma.staffAllowance.deleteMany({ where: { staffId: id, tenantId } }); } catch {}

    // 7. Staff trainings
    try { await this.prisma.staffTraining.deleteMany({ where: { staffId: id, tenantId } }); } catch {}

    // 8. Staff assignments
    try { await this.prisma.staffAssignment.deleteMany({ where: { staffId: id, tenantId } }); } catch {}

    // 9. Contract amendments (via contracts)
    try {
      const contracts = await this.prisma.contract.findMany({ where: { staffId: id, tenantId }, select: { id: true } });
      for (const c of contracts) {
        try { await this.prisma.contractAmendment.deleteMany({ where: { contractId: c.id } }); } catch {}
      }
    } catch {}

    // 10. Contracts
    try { await this.prisma.contract.deleteMany({ where: { staffId: id, tenantId } }); } catch {}

    // 11. Unlink from HR applications
    try {
      await this.prisma.hrApplication.updateMany({
        where: { staffId: id, tenantId },
        data: { staffId: null },
      });
    } catch {}

    // 12. Finally, delete the staff record
    await this.prisma.staff.delete({ where: { id } });

    return { success: true, deletedId: id };
  }

  /**
   * Purge tous les staff d'un tenant (hard delete massif)
   */
  async purgeAllStaff(tenantId: string) {
    const staff = await this.prisma.staff.findMany({
      where: { tenantId },
      select: { id: true },
    });

    let deleted = 0;
    let errors = 0;
    for (const s of staff) {
      try {
        await this.hardDeleteStaff(s.id, tenantId);
        deleted++;
      } catch (err: any) {
        errors++;
        console.error(`Failed to hard-delete staff ${s.id}: ${err.message}`);
      }
    }

    // Reset the staff number sequence so next created staff starts from 1
    if (deleted > 0) {
      try {
        await this.prisma.staffNumberSequence.updateMany({
          where: { tenantId },
          data: { current: 0 },
        });
      } catch (seqErr: any) {
        console.error(`Failed to reset StaffNumberSequence for tenant ${tenantId}: ${seqErr.message}`);
      }
    }

    return { deleted, errors, total: staff.length };
  }

  // ─── STAFF PHOTO ────────────────────────────────────────────────────────

  /**
   * Upload photo depuis un data URL (base64) — pattern identique au logo école.
   *
   * Le frontend compresse l'image côté navigateur (compressImageFileToDataUrl)
   * et envoie le résultat comme JSON string. On stocke directement le data URL
   * dans la colonne originalUrl (pas de stockage S3/R2 requis).
   */
  async uploadStaffPhotoDataUrl(
    staffId: string,
    tenantId: string,
    photoDataUrl: string,
  ): Promise<any> {
    // Verify staff exists
    await this.findStaffById(staffId, tenantId);

    // Valider le format data URL
    const trimmed = (photoDataUrl ?? '').trim();
    const m = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
    if (!m) {
      throw new BadRequestException('Format attendu : data URL base64 (data:image/...;base64,...).');
    }
    const mimeType = m[1].trim().toLowerCase();
    if (!mimeType.startsWith('image/')) {
      throw new BadRequestException('Le fichier doit être une image.');
    }

    // Vérifier la taille (max 5 Mo décodés)
    let buffer: Buffer;
    try {
      buffer = Buffer.from(m[2], 'base64');
    } catch {
      throw new BadRequestException('Base64 invalide.');
    }
    if (buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException('Image trop volumineuse (max 5 Mo décodés).');
    }

    // Stocker le data URL directement (même pattern que logoUrl dans tenant_identity_profile)
    const originalUrl = trimmed;
    const hdUrl = trimmed;
    const thumbnailUrl = trimmed;

    // Upsert photo (one per staff) — StaffPhoto n'a pas de champ updatedAt
    const photo = await this.prisma.staffPhoto.upsert({
      where: { staffId },
      create: {
        ...prismaCreateNoUpdatedAt(),
        tenantId,
        staffId,
        originalUrl,
        hdUrl,
        thumbnailUrl,
      },
      update: {
        originalUrl,
        hdUrl,
        thumbnailUrl,
      },
    });

    return {
      ...photo,
      // Les data URLs sont directement utilisables dans <img src>
      originalUrl,
      hdUrl,
      thumbnailUrl,
    };
  }

  /**
   * Récupère la photo d'un membre du personnel
   */
  async getStaffPhoto(staffId: string, tenantId: string): Promise<any> {
    await this.findStaffById(staffId, tenantId);
    const photo = await this.prisma.staffPhoto.findUnique({
      where: { staffId },
    });
    if (!photo) return null;

    // Helper: les data URLs sont utilisables directement, ne pas passer par resolveFileUrl
    const resolveUrl = async (url: string | null): Promise<string | null> => {
      if (!url) return null;
      if (url.startsWith('data:')) return url;
      try { return await this.storageService.resolveFileUrl(url); } catch { return url; }
    };

    return {
      ...photo,
      originalUrl: await resolveUrl(photo.originalUrl),
      hdUrl: await resolveUrl(photo.hdUrl),
      thumbnailUrl: await resolveUrl(photo.thumbnailUrl),
    };
  }

  /**
   * Supprime la photo d'un membre du personnel
   */
  async deleteStaffPhoto(staffId: string, tenantId: string): Promise<any> {
    await this.findStaffById(staffId, tenantId);

    // Fetch photo records for R2 cleanup before deleting
    const photos = await this.prisma.staffPhoto.findMany({
      where: { staffId, tenantId },
    });

    await this.prisma.staffPhoto.deleteMany({
      where: { staffId, tenantId },
    });

    // Clean up photo files from storage (best-effort)
    for (const photo of photos) {
      for (const url of [photo.originalUrl, photo.hdUrl, photo.thumbnailUrl]) {
        if (!url) continue;
        // For R2/S3: filePath is the key, not a full URL
        // For Vercel Blob: filePath is a full URL
        try {
          await this.storageService.deleteFile(url);
        } catch (err: any) {
          console.warn(`Failed to delete staff photo file from storage: ${url} — ${err.message}`);
        }
      }
    }

    return { success: true };
  }

  // ─── STAFF DOCUMENTS ──────────────────────────────────────────────────────

  /**
   * Upload document depuis un data URL (base64) — pattern identique au logo école.
   *
   * Le frontend compresse/convertit le fichier côté navigateur et envoie le data URL
   * en JSON. Supporte les images ET les PDF (data:application/pdf;base64,...).
   * Stocke le data URL directement dans filePath (pas de stockage S3/R2 requis).
   */
  async uploadStaffDocumentDataUrl(
    staffId: string,
    tenantId: string,
    body: {
      documentType: string;
      fileName: string;
      fileDataUrl: string;
      mimeType: string;
      fileSize: number;
      description?: string;
      expiresAt?: string;
    },
  ): Promise<any> {
    // Verify staff exists
    await this.findStaffById(staffId, tenantId);

    // Valider le format data URL
    const trimmed = (body.fileDataUrl ?? '').trim();
    const m = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
    if (!m) {
      throw new BadRequestException('Format attendu : data URL base64 (data:...;base64,...).');
    }
    const mimeType = m[1].trim().toLowerCase();

    // Vérifier la taille (max 20 Mo décodés)
    let buffer: Buffer;
    try {
      buffer = Buffer.from(m[2], 'base64');
    } catch {
      throw new BadRequestException('Base64 invalide.');
    }
    if (buffer.length > 20 * 1024 * 1024) {
      throw new BadRequestException('Fichier trop volumineux (max 20 Mo décodés).');
    }

    // Determine category from document type
    const category = DOC_TYPE_TO_CATEGORY[body.documentType] || 'GENERAL';

    // Check if a document of this type already exists (for versioning)
    const existingDoc = await this.prisma.staffDocument.findFirst({
      where: { staffId, tenantId, documentType: body.documentType },
      orderBy: { version: 'desc' },
    });

    const version = existingDoc ? existingDoc.version + 1 : 1;

    // Stocker le data URL directement dans filePath (même pattern que logoUrl)
    const filePath = trimmed;

    return this.prisma.staffDocument.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        staffId,
        documentType: body.documentType,
        fileName: body.fileName,
        filePath,
        fileSize: body.fileSize || buffer.length,
        mimeType: body.mimeType || mimeType,
        category,
        description: body.description || null,
        validationStatus: 'PENDING',
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        version,
      },
    });
  }

  /**
   * Ajoute un document à un membre du personnel (legacy JSON method).
   * Champs alignés sur le schéma Prisma : documentType, fileName, filePath, mimeType
   */
  async addStaffDocument(data: {
    tenantId: string;
    staffId: string;
    documentType: string;
    fileName: string;
    filePath: string;
    fileSize?: number;
    mimeType?: string;
    uploadedBy?: string;
    description?: string;
    category?: string;
    expiresAt?: string;
  }) {
    // Verify staff exists
    await this.findStaffById(data.staffId, data.tenantId);

    const category = data.category || DOC_TYPE_TO_CATEGORY[data.documentType] || 'GENERAL';

    // Check for existing doc of same type for versioning
    const existingDoc = await this.prisma.staffDocument.findFirst({
      where: { staffId: data.staffId, tenantId: data.tenantId, documentType: data.documentType },
      orderBy: { version: 'desc' },
    });
    const version = existingDoc ? existingDoc.version + 1 : 1;

    return this.prisma.staffDocument.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId:     data.tenantId,
        staffId:      data.staffId,
        documentType: data.documentType,
        fileName:     data.fileName,
        filePath:     data.filePath,
        fileSize:     data.fileSize || null,
        mimeType:     data.mimeType || 'application/pdf',
        category,
        description:  data.description || null,
        validationStatus: 'PENDING',
        expiresAt:    data.expiresAt ? new Date(data.expiresAt) : null,
        uploadedBy:   data.uploadedBy || null,
        version,
      },
    });
  }

  /**
   * Récupère tous les documents d'un membre du personnel, organisés par catégorie
   */
  async findStaffDocuments(staffId: string, tenantId: string) {
    const documents = await this.prisma.staffDocument.findMany({
      where: { staffId, tenantId },
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    });

    // Group by category
    const grouped: Record<string, any[]> = {};
    for (const doc of documents) {
      const cat = doc.category || 'GENERAL';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(doc);
    }

    return { documents, grouped };
  }

  /**
   * Supprime un document d'un membre du personnel
   */
  async deleteStaffDocument(documentId: string, staffId: string, tenantId: string) {
    // Verify the document belongs to this staff and tenant
    const doc = await this.prisma.staffDocument.findFirst({
      where: { id: documentId, staffId, tenantId },
    });
    if (!doc) {
      throw new NotFoundException(`Document non trouvé`);
    }

    // 1. Delete DB record
    await this.prisma.staffDocument.delete({ where: { id: documentId } });

    // 2. Delete file from storage (best-effort)
    try {
      await this.storageService.deleteFile(doc.filePath);
    } catch (err: any) {
      // Log but don't fail — the DB record is already deleted
      console.warn(`Failed to delete staff document file from storage: ${doc.filePath} — ${err.message}`);
    }

    return { success: true, deletedFile: doc.fileName };
  }

  /**
   * Télécharge le fichier d'un document d'un membre du personnel
   */
  async downloadStaffDocument(documentId: string, staffId: string, tenantId: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const doc = await this.prisma.staffDocument.findFirst({
      where: { id: documentId, staffId, tenantId },
    });
    if (!doc) {
      throw new NotFoundException(`Document non trouvé`);
    }

    // Try to download from storage
    const filePath = doc.filePath;

    // ─── Data URL : décoder directement le base64 ─────────────────────────
    if (filePath && filePath.startsWith('data:')) {
      const m = /^data:([^;]+);base64,(.+)$/i.exec(filePath);
      if (m) {
        const buffer = Buffer.from(m[2], 'base64');
        return { buffer, fileName: doc.fileName, mimeType: doc.mimeType || m[1] };
      }
    }

    // Try cloud storage first
    try {
      const buffer = await this.storageService.downloadFile(filePath);
      return { buffer, fileName: doc.fileName, mimeType: doc.mimeType || 'application/octet-stream' };
    } catch {
      // Cloud download failed, try HTTPS URL
    }

    // Try fetching from URL (Vercel Blob or any HTTPS URL)
    if (filePath.startsWith('https://')) {
      try {
        const response = await fetch(filePath);
        if (response.ok) {
          const arrayBuf = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          return { buffer, fileName: doc.fileName, mimeType: doc.mimeType || 'application/octet-stream' };
        }
      } catch {
        // URL fetch failed
      }
    }

    // Try resolving via storageService.resolveFileUrl and fetching
    try {
      const resolvedUrl = await this.storageService.resolveFileUrl(filePath);
      if (resolvedUrl && resolvedUrl.startsWith('http')) {
        const response = await fetch(resolvedUrl);
        if (response.ok) {
          const arrayBuf = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          return { buffer, fileName: doc.fileName, mimeType: doc.mimeType || 'application/octet-stream' };
        }
      }
    } catch {
      // Resolved URL fetch failed
    }

    // Local filesystem fallback
    const fs = await import('fs');
    const path = await import('path');
    const absolutePath = path.join(process.cwd(), filePath);
    if (fs.existsSync(absolutePath)) {
      const buffer = fs.readFileSync(absolutePath);
      return { buffer, fileName: doc.fileName, mimeType: doc.mimeType || 'application/octet-stream' };
    }

    throw new NotFoundException(`Fichier du document introuvable: ${doc.fileName}`);
  }

  /**
   * Valide ou rejette un document
   */
  async validateStaffDocument(documentId: string, staffId: string, tenantId: string, status: 'VALIDATED' | 'REJECTED') {
    const doc = await this.prisma.staffDocument.findFirst({
      where: { id: documentId, staffId, tenantId },
    });
    if (!doc) {
      throw new NotFoundException(`Document non trouvé`);
    }

    return this.prisma.staffDocument.update({
      where: { id: documentId },
      data: { validationStatus: status },
    });
  }

  /**
   * Génère les matricules manquants pour un staff existant (migration helper)
   */
  async generateMissingMatricules(staffId: string, tenantId: string) {
    const staff = await this.findStaffById(staffId, tenantId);

    if (staff.globalMatricule && staff.tenantMatricule) {
      return staff; // Already has both matricules
    }

    const matricules = await this.matriculeService.generate(tenantId);

    return this.prisma.staff.update({
      where: { id: staffId },
      data: {
        globalMatricule: matricules.globalMatricule,
        tenantMatricule: matricules.tenantMatricule,
      },
    });
  }

  /**
   * Affecte un niveau scolaire à plusieurs membres du personnel en une seule opération
   *
   * Accepte soit un SchoolLevel.id, soit un EducationLevel.id.
   * Le frontend utilise EducationLevel (via /settings/education/structure),
   * mais Staff.schoolLevelId FK référence SchoolLevel.
   * On résout automatiquement EducationLevel → SchoolLevel si nécessaire.
   */
  async batchAssignLevel(dto: BatchAssignLevelDto) {
    const { staffIds, schoolLevelId, academicYearId } = dto;

    if (!staffIds || staffIds.length === 0) {
      throw new BadRequestException('Aucun personnel sélectionné.');
    }

    // Resolve the actual SchoolLevel — may receive an EducationLevel ID from the frontend
    const resolvedSchoolLevelId = await this.resolveSchoolLevelId(schoolLevelId);

    // ─── Résoudre le tenantId à partir du premier personnel sélectionné ──
    // On récupère le tenantId depuis un des staff sélectionnés, car le DTO
    // ne contient pas tenantId mais tous les staff appartiennent au même tenant.
    const firstStaff = await this.prisma.staff.findFirst({
      where: { id: staffIds[0] },
      select: { id: true, tenantId: true },
    });
    if (!firstStaff) {
      throw new BadRequestException('Personnel introuvable pour l\'affectation.');
    }
    const tenantId = firstStaff.tenantId;

    // ─── Résoudre l'année académique active (requise par StaffAssignment) ──
    // academicYearId est requis dans le schéma (non-nullable). Si non fourni,
    // on récupère l'année académique active du tenant.
    let resolvedAcademicYearId = academicYearId;
    if (!resolvedAcademicYearId) {
      const activeYear = await this.prisma.academicYear.findFirst({
        where: { isActive: true, tenantId },
        select: { id: true },
      });
      if (!activeYear) {
        throw new BadRequestException(
          'Aucune année académique active trouvée. Veuillez activer une année académique dans les paramètres avant d\'affecter des enseignants.',
        );
      }
      resolvedAcademicYearId = activeYear.id;
    }

    // Update all staff members
    const result = await this.prisma.staff.updateMany({
      where: { id: { in: staffIds }, tenantId },
      data: { schoolLevelId: resolvedSchoolLevelId },
    });

    // ─── Sync schoolLevelId to Pedagogy Teacher records ──
    // When a teacher is assigned to a school level in HR, update their
    // Teacher record in pedagogy so they appear in the correct level's assignments.
    try {
      const staffRecords = await this.prisma.staff.findMany({
        where: { id: { in: staffIds }, tenantId },
        select: { id: true, email: true, employeeNumber: true },
      });
      for (const s of staffRecords) {
        // Match by email or matricule (employeeNumber)
        const teacher = await this.prisma.teacher.findFirst({
          where: {
            tenantId,
            OR: [
              ...(s.email ? [{ email: s.email }] : []),
              { matricule: s.employeeNumber },
            ],
          },
          select: { id: true },
        });
        if (teacher) {
          await this.prisma.teacher.update({
            where: { id: teacher.id },
            data: { schoolLevelId: resolvedSchoolLevelId },
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to sync teacher schoolLevelId in pedagogy: ${err.message}`);
    }

    // Also create/update StaffAssignment records for each teacher
    const assignments = [];
    for (const staffId of staffIds) {
      // Check if an active assignment already exists
      const existing = await this.prisma.staffAssignment.findFirst({
        where: {
          staffId,
          academicYearId: resolvedAcademicYearId,
          status: 'ACTIVE',
        },
      });

      if (existing) {
        // Update existing assignment
        const updated = await this.prisma.staffAssignment.update({
          where: { id: existing.id },
          data: { schoolLevelId: resolvedSchoolLevelId, role: 'TEACHER' },
        });
        assignments.push(updated);
      } else {
        // Create new assignment
        const created = await this.prisma.staffAssignment.create({
          data: {
            staffId,
            schoolLevelId: resolvedSchoolLevelId,
            tenantId,
            academicYearId: resolvedAcademicYearId,
            role: 'TEACHER',
            startDate: new Date(),
            status: 'ACTIVE',
          },
        });
        assignments.push(created);
      }
    }

    const schoolLevel = await this.prisma.schoolLevel.findUnique({
      where: { id: resolvedSchoolLevelId },
    });

    // Re-fetch updated staff to confirm the assignment worked
    const updatedStaff = await this.prisma.staff.findMany({
      where: { id: { in: staffIds }, tenantId },
      select: { id: true, schoolLevelId: true },
    });
    const confirmedCount = updatedStaff.filter(s => s.schoolLevelId === resolvedSchoolLevelId).length;

    return {
      updated: result.count,
      confirmed: confirmedCount,
      assignments: assignments.length,
      message: `${confirmedCount} personnel(s) affecté(s) au niveau ${schoolLevel?.name || resolvedSchoolLevelId}`,
      schoolLevelId: resolvedSchoolLevelId,
      schoolLevelName: schoolLevel?.name,
    };
  }

  /**
   * Résout un ID de niveau scolaire vers un SchoolLevel.id valide.
   *
   * Le frontend peut envoyer soit :
   * - un SchoolLevel.id (table school_levels) — utilisé directement
   * - un EducationLevel.id (table education_levels) — résolu en SchoolLevel via (tenantId + code)
   *
   * EducationLevel.name (MATERNELLE, PRIMAIRE, SECONDAIRE) correspond à SchoolLevel.code.
   */
  /**
   * Synchronise les départements du personnel avec les départements des postes (HrJob).
   * Pour chaque staff, met à jour staff.department avec le département de son poste (HrJob).
   * Si le staff n'a pas de poste lié, garde son département actuel.
   */
  async syncDepartments(tenantId: string): Promise<{ updated: number; total: number; details: any[] }> {
    // 1. Récupérer tous les postes (HrJob) avec leurs départements
    // ⚠️ HrJob utilise le champ `dept` (pas `department`) dans le schéma Prisma
    const jobs = await this.prisma.hrJob.findMany({
      where: { tenantId },
      select: { id: true, title: true, dept: true },
    });

    // 2. Construire un mapping jobId → dept
    const jobDeptMap = new Map<string, string>();
    jobs.forEach(j => {
      if (j.dept) jobDeptMap.set(j.id, j.dept);
    });

    // 3. Récupérer tous les staff
    const staff = await this.prisma.staff.findMany({
      where: { tenantId, status: { not: 'ARCHIVED' } },
      select: { id: true, firstName: true, lastName: true, department: true, position: true },
    });

    // 4. Pour chaque staff, vérifier si son département correspond à un département de poste
    const validDepartments = new Set(jobDeptMap.values());
    let updated = 0;
    const details: any[] = [];

    for (const s of staff) {
      const currentDept = s.department || '';
      // Si le département actuel n'est pas dans la liste des départements valides
      // ET qu'il y a des départements disponibles, essayer de le mettre à jour
      if (currentDept && !validDepartments.has(currentDept) && validDepartments.size > 0) {
        // Chercher un poste correspondant au position du staff
        const matchingJob = jobs.find(j => j.title === s.position);
        const newDept = matchingJob?.dept || Array.from(validDepartments)[0] || currentDept;

        if (newDept !== currentDept) {
          await this.prisma.staff.update({
            where: { id: s.id },
            data: { department: newDept },
          });
          updated++;
          details.push({
            staffId: s.id,
            name: `${s.firstName} ${s.lastName}`,
            oldDepartment: currentDept,
            newDepartment: newDept,
          });
        }
      }
    }

    this.logger.log(`syncDepartments: ${updated}/${staff.length} staff updated. Valid departments: ${Array.from(validDepartments).join(', ')}`);

    return {
      updated,
      total: staff.length,
      details,
    };
  }

  /**
   * Active ou désactive le PROMOTEUR.
   * - active=true  → status='ACTIVE'  (visible dans toutes les listes RH via includePromoter=true)
   * - active=false → status='ARCHIVED' (invisible dans toutes les listes RH)
   *
   * Note: Le promoteur est toujours exclu par défaut (roleType=PROMOTEUR).
   * Quand il est ACTIVE, le frontend peut passer includePromoter=true pour l'afficher.
   * Quand il est ARCHIVED, il ne doit pas apparaître même avec includePromoter=true.
   */
  async togglePromoter(tenantId: string, active: boolean) {
    const promoter = await this.prisma.staff.findFirst({
      where: { tenantId, roleType: 'PROMOTEUR' },
    });

    if (!promoter) {
      throw new NotFoundException('Aucun promoteur trouvé pour ce tenant');
    }

    const newStatus = active ? 'ACTIVE' : 'ARCHIVED';
    await this.prisma.staff.update({
      where: { id: promoter.id },
      data: {
        ...prismaUpdateDefaults(),
        status: newStatus,
        ...(active ? {
          terminationType: null,
          terminationDetails: null,
          terminatedAt: null,
        } : {
          terminationType: 'OTHER',
          terminationDetails: { reason: 'Promoteur désactivé du module RH' },
          terminatedAt: new Date(),
        }),
      },
    });

    this.logger.log(`Promoteur ${active ? 'activé' : 'désactivé'} pour tenant ${tenantId}`);

    return {
      success: true,
      active,
      status: newStatus,
      message: active
        ? 'Le promoteur est maintenant visible dans les listes du module RH'
        : 'Le promoteur est maintenant masqué de toutes les listes du module RH',
    };
  }

  /**
   * Récupère l'état du PROMOTEUR (actif/inactif).
   */
  async getPromoterStatus(tenantId: string) {
    const promoter = await this.prisma.staff.findFirst({
      where: { tenantId, roleType: 'PROMOTEUR' },
      select: { id: true, firstName: true, lastName: true, status: true, position: true },
    });

    if (!promoter) {
      return { exists: false, active: false, promoter: null };
    }

    return {
      exists: true,
      active: promoter.status === 'ACTIVE',
      promoter: {
        id: promoter.id,
        firstName: promoter.firstName,
        lastName: promoter.lastName,
        position: promoter.position,
        status: promoter.status,
      },
    };
  }

  /**
   * Synchronise tous les enseignants RH existants avec le module Pédagogie.
   *
   * Pour chaque Staff avec roleType=TEACHER (non ARCHIVED) :
   * 1. Cherche un Teacher correspondant (par email ou matricule/employeeNumber)
   * 2. Si trouvé → met à jour schoolLevelId, position, qualifications
   * 3. Si non trouvé → crée un nouveau Teacher
   *
   * @returns { synced, created, updated, skipped, errors }
   */
  async syncTeachersToPedagogy(tenantId: string) {
    // Récupérer tous les enseignants actifs du tenant
    const teachers = await this.prisma.staff.findMany({
      where: {
        tenantId,
        roleType: 'TEACHER',
        status: { not: 'ARCHIVED' },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        gender: true,
        birthDate: true,
        address: true,
        position: true,
        department: true,
        employeeNumber: true,
        tenantMatricule: true,
        globalMatricule: true,
        schoolLevelId: true,
        hireDate: true,
        qualifications: true,
        contractType: true,
        academicYearId: true,
      },
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const t of teachers) {
      try {
        // Chercher un Teacher existant par email ou matricule
        const matricule = t.tenantMatricule || t.employeeNumber;
        const orConditions: any[] = [];
        if (t.email) orConditions.push({ email: t.email });
        if (matricule) orConditions.push({ matricule: matricule });

        const existingTeacher = orConditions.length > 0
          ? await this.prisma.teacher.findFirst({
              where: { tenantId, OR: orConditions },
            })
          : null;

        if (existingTeacher) {
          // Mettre à jour le Teacher existant
          await this.prisma.teacher.update({
            where: { id: existingTeacher.id },
            data: {
              ...(t.schoolLevelId ? { schoolLevelId: t.schoolLevelId } : {}),
              ...(t.position ? { position: t.position } : {}),
              ...(t.qualifications ? { qualifications: t.qualifications } : {}),
              ...(t.phone ? { phone: t.phone } : {}),
              ...(t.email ? { email: t.email } : {}),
              ...(t.contractType ? { contractType: t.contractType } : {}),
              ...(t.hireDate ? { hireDate: t.hireDate } : {}),
              status: 'active',
            },
          });
          updated++;
        } else {
          // Créer un nouveau Teacher
          // Resolve schoolLevelId — if staff doesn't have one, try to find a default
          let schoolLevelId = t.schoolLevelId;
          if (!schoolLevelId) {
            // Try to find any SchoolLevel for this tenant
            const anyLevel = await this.prisma.schoolLevel.findFirst({
              where: { tenantId },
              select: { id: true },
            });
            if (anyLevel) {
              schoolLevelId = anyLevel.id;
            } else {
              // Skip if no school level exists at all
              skipped++;
              errors.push(`${t.firstName} ${t.lastName}: aucun niveau scolaire trouvé`);
              continue;
            }
          }

          await this.prisma.teacher.create({
            data: {
              tenantId,
              schoolLevelId,
              matricule: matricule || `TMP-${Date.now()}`,
              firstName: t.firstName,
              lastName: t.lastName,
              gender: t.gender || null,
              dateOfBirth: t.birthDate || null,
              phone: t.phone || null,
              email: t.email || null,
              address: t.address || null,
              position: t.position || 'Enseignant',
              qualifications: t.qualifications || null,
              hireDate: t.hireDate || new Date(),
              contractType: t.contractType || null,
              status: 'active',
              academicYearId: t.academicYearId || null,
            },
          });
          created++;
        }
      } catch (err: any) {
        errors.push(`${t.firstName} ${t.lastName}: ${err.message}`);
        skipped++;
      }
    }

    this.logger.log(
      `syncTeachersToPedagogy: ${created} created, ${updated} updated, ${skipped} skipped, ${errors.length} errors out of ${teachers.length} teachers`,
    );

    return {
      total: teachers.length,
      created,
      updated,
      skipped,
      errors,
      message: `Synchronisation terminée : ${created} enseignant(s) créé(s), ${updated} mis à jour, ${skipped} ignoré(s)`,
    };
  }

  private async resolveSchoolLevelId(levelId: string): Promise<string> {
    // 1) Try direct SchoolLevel lookup
    const schoolLevel = await this.prisma.schoolLevel.findUnique({
      where: { id: levelId },
    });
    if (schoolLevel) {
      return schoolLevel.id;
    }

    // 2) Try EducationLevel lookup and map to SchoolLevel
    const educationLevel = await this.prisma.educationLevel.findUnique({
      where: { id: levelId },
    });
    if (educationLevel) {
      // EducationLevel.name (e.g. "MATERNELLE") matches SchoolLevel.code
      const mappedSchoolLevel = await this.prisma.schoolLevel.findFirst({
        where: {
          tenantId: educationLevel.tenantId,
          code: educationLevel.name,
        },
      });
      if (mappedSchoolLevel) {
        return mappedSchoolLevel.id;
      }

      // SchoolLevel not found for this tenant+code — create it on the fly
      const created = await this.prisma.schoolLevel.create({
        data: {
          tenantId: educationLevel.tenantId,
          code: educationLevel.name,
          name: educationLevel.name.charAt(0) + educationLevel.name.slice(1).toLowerCase(),
          label: educationLevel.name.charAt(0) + educationLevel.name.slice(1).toLowerCase(),
          order: educationLevel.order,
        },
      });
      return created.id;
    }

    throw new NotFoundException(`Niveau scolaire introuvable`);
  }

  /**
   * Récupère les enseignants filtrés par niveau scolaire
   */
  async findTeachersByLevel(schoolLevelId?: string, academicYearId?: string) {
    const where: any = {
      roleType: 'TEACHER',
    };

    if (schoolLevelId) {
      where.schoolLevelId = schoolLevelId;
    }

    const teachers = await this.prisma.staff.findMany({
      where,
      include: {
        schoolLevel: { select: { id: true, name: true, code: true } },
        photo: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return teachers.map(t => ({
      ...t,
      category: 'PEDAGOGICAL',
      staffCode: t.employeeNumber || t.globalMatricule,
    }));
  }

  /**
   * Génère (ou régénère) les identifiants de connexion pour un staff.
   *
   * Délégué à StaffCredentialService.generateOrRegenerateCredentials().
   * Appelé par l'admin via le bouton "Générer Identifiant" du module RH > Contrats.
   *
   * Étapes (côté StaffCredentialService) :
   *   1. Récupère le staff (email, matricule, firstName, lastName)
   *   2. Vérifie le statut actif (ACTIVE ou PENDING_SIGNATURE)
   *   3. Génère un mot de passe aléatoire sécurisé
   *   4. Hash le mot de passe avec bcrypt (10 rounds)
   *   5. Cherche un user existant avec cet email :
   *        - Si oui → met à jour son passwordHash
   *        - Si non → crée un nouvel user (email, passwordHash, firstName, lastName, role, tenantId, status)
   *   6. Envoie un email au staff avec ses identifiants (logo école, nom du tenant, identifiant + mot de passe)
   *   7. Le mot de passe en clair n'est JAMAIS retourné au frontend — seul l'email le contient
   *
   * @returns { success, message, email?, userId?, emailSent? }
   */
  async generateCredentials(
    tenantId: string,
    staffId: string,
    triggeredByUserId?: string,
  ): Promise<{
    success: boolean;
    message: string;
    email?: string;
    userId?: string;
    emailSent?: boolean;
  }> {
    return this.credentialService.generateOrRegenerateCredentials(staffId, tenantId, triggeredByUserId);
  }
}
