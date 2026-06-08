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

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StaffMatriculeService } from './staff-matricule.service';
import { StorageService } from '../common/services/storage.service';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly matriculeService: StaffMatriculeService,
    private readonly storageService: StorageService,
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

    const created = await this.prisma.staff.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId:       data.tenantId,
        academicYearId: data.academicYearId || null,
        employeeNumber,
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
        status:         data.status || 'ACTIVE',
        qualifications: data.qualifications || null,
        notes:          data.notes || null,
      },
    });

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
  }) {
    const where: any = { tenantId };
    if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters?.status && filters.status !== 'ALL') where.status = filters.status;
    if (filters?.category) {
      // Mapper category UI → roleType
      const role = CATEGORY_TO_ROLE[filters.category];
      if (role) where.roleType = role;
    }

    const staff = await this.prisma.staff.findMany({
      where,
      include: {
        contracts: {
          where: { status: 'ACTIVE' },
          orderBy: { startDate: 'desc' },
          take: 1,
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        photo: true,
      },
      orderBy: { lastName: 'asc' },
    });

    // Ajouter staffCode et category aliases pour compatibilité frontend
    return staff.map((s) => ({
      ...s,
      staffCode: s.employeeNumber,
      category: Object.entries(CATEGORY_TO_ROLE).find(([, v]) => v === s.roleType)?.[0] || s.roleType,
      photoUrl: s.photo?.thumbnailUrl || null,
    }));
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
      },
    });

    if (!staff) {
      throw new NotFoundException(`Staff with ID ${id} not found`);
    }

    return {
      ...staff,
      staffCode: staff.employeeNumber,
      category: Object.entries(CATEGORY_TO_ROLE).find(([, v]) => v === staff.roleType)?.[0] || staff.roleType,
      photoUrl: staff.photo?.thumbnailUrl || null,
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
      'contractType', 'status', 'qualifications', 'notes',
      'academicYearId', 'schoolLevelId',
      'nationality', 'maritalStatus', 'numberOfChildren',
      'nationalId', 'cnssNumber', 'ifuNumber',
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
    const dateFields = ['birthDate', 'dateOfBirth', 'hireDate'];
    for (const df of dateFields) {
      if (df in updateData) {
        if (updateData[df] === '' || updateData[df] === null || updateData[df] === undefined) {
          updateData[df] = null;
        } else {
          updateData[df] = new Date(updateData[df]);
        }
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
   * Archive un membre du personnel
   */
  async archiveStaff(id: string, tenantId: string) {
    await this.findStaffById(id, tenantId);
    return this.prisma.staff.update({
      where: { id },
      data: { ...prismaUpdateDefaults(), status: 'INACTIVE' },
    });
  }

  // ─── STAFF TERMINATION / DÉBAUCHE ────────────────────────────────────────

  /**
   * Types de départ avec leur label en français
   */
  private static readonly TERMINATION_TYPE_LABELS: Record<string, string> = {
    RESIGNATION: 'Démission',
    DISMISSAL: 'Licenciement',
    MUTUAL_AGREEMENT: 'Rupture conventionnelle',
    END_OF_CONTRACT: 'Fin de contrat',
    RETIREMENT: 'Retraite',
    DEATH: 'Décès',
    ABANDONMENT: 'Abandon de poste',
    OTHER: 'Autre',
  };

  /**
   * Débauche d'un employé — Processus professionnel de départ.
   *
   * Ce processus réalise les opérations suivantes dans une transaction :
   * 1. Vérifie que le staff existe et est actif
   * 2. Met à jour le statut du staff (INACTIVE) avec les détails de la débauche
   * 3. Résilie tous les contrats actifs du staff
   * 4. Enregistre les métadonnées de la débauche (type, motif, préavis, etc.)
   * 5. Retourne un récapitulatif complet de la débauche
   */
  async terminateStaff(
    id: string,
    tenantId: string,
    data: {
      terminationType: string;
      effectiveDate: string;
      lastWorkingDate?: string;
      noticePeriodDays?: number;
      reason?: string;
      detailedReason?: string;
      exitInterviewConducted?: boolean;
      exitInterviewNotes?: string;
      equipmentReturned?: boolean;
      exitDocumentsProvided?: boolean;
      finalSettlementPaid?: boolean;
      authorizedBy?: string;
      terminationLetterRef?: string;
    },
  ) {
    // Phase 1: Pre-flight checks (outside transaction)
    const staff = await this.prisma.staff.findFirst({
      where: { id, tenantId },
      include: {
        contracts: { where: { status: 'ACTIVE' } },
      },
    });

    if (!staff) {
      throw new NotFoundException(`Employé avec l'ID ${id} non trouvé`);
    }

    if (staff.status === 'INACTIVE' || staff.status === 'TERMINATED') {
      throw new BadRequestException(
        `Cet employé est déjà inactif (statut: ${staff.status}). Impossible de procéder à la débauche.`,
      );
    }

    const effectiveDate = new Date(data.effectiveDate);
    const lastWorkingDate = data.lastWorkingDate
      ? new Date(data.lastWorkingDate)
      : effectiveDate;

    const terminationLabel =
      StaffPrismaService.TERMINATION_TYPE_LABELS[data.terminationType] || data.terminationType;

    // Build structured termination details JSON
    const terminationDetails = {
      terminationType: data.terminationType,
      terminationLabel,
      effectiveDate: effectiveDate.toISOString(),
      lastWorkingDate: lastWorkingDate.toISOString(),
      noticePeriodDays: data.noticePeriodDays ?? null,
      reason: data.reason || null,
      detailedReason: data.detailedReason || null,
      exitInterviewConducted: data.exitInterviewConducted ?? false,
      exitInterviewNotes: data.exitInterviewNotes || null,
      equipmentReturned: data.equipmentReturned ?? false,
      exitDocumentsProvided: data.exitDocumentsProvided ?? false,
      finalSettlementPaid: data.finalSettlementPaid ?? false,
      authorizedBy: data.authorizedBy || null,
      terminationLetterRef: data.terminationLetterRef || null,
      terminatedByName: `${staff.firstName} ${staff.lastName}`,
      terminatedByEmployeeNumber: staff.employeeNumber,
      terminatedByGlobalMatricule: staff.globalMatricule,
      terminatedByTenantMatricule: staff.tenantMatricule,
      contractsTerminated: staff.contracts.map((c) => ({
        id: c.id,
        contractType: c.contractType,
        startDate: c.startDate,
        baseSalary: Number(c.baseSalary),
      })),
    };

    // Phase 2: All DB operations in a single transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Terminate all active contracts
      const terminatedContracts: any[] = [];
      for (const contract of staff.contracts) {
        const terminated = await tx.contract.update({
          where: { id: contract.id },
          data: {
            ...prismaUpdateDefaults(),
            status: 'TERMINATED',
            terminatedAt: effectiveDate,
            terminationReason: `${terminationLabel}${data.reason ? ': ' + data.reason : ''}`,
          },
        });
        terminatedContracts.push(terminated);
      }

      // 2. Update staff record with termination details
      const updatedStaff = await tx.staff.update({
        where: { id },
        data: {
          ...prismaUpdateDefaults(),
          status: 'INACTIVE',
          terminationType: data.terminationType,
          terminationDetails: terminationDetails as any,
          terminatedAt: effectiveDate,
          noticePeriodDays: data.noticePeriodDays ?? null,
          lastWorkingDate: lastWorkingDate,
        },
      });

      return { staff: updatedStaff, terminatedContracts };
    });

    // Return comprehensive termination summary
    return {
      success: true,
      message: `Débauche de ${staff.firstName} ${staff.lastName} enregistrée avec succès`,
      staff: {
        id: result.staff.id,
        firstName: result.staff.firstName,
        lastName: result.staff.lastName,
        employeeNumber: result.staff.employeeNumber,
        globalMatricule: result.staff.globalMatricule,
        tenantMatricule: result.staff.tenantMatricule,
        status: result.staff.status,
        terminationType: result.staff.terminationType,
        terminatedAt: result.staff.terminatedAt,
        lastWorkingDate: result.staff.lastWorkingDate,
      },
      terminationDetails,
      contractsTerminated: result.terminatedContracts.length,
    };
  }

  /**
   * Récupère la liste des employés ayant quitté l'entreprise (débauchés)
   */
  async findTerminatedStaff(tenantId: string, filters?: {
    terminationType?: string;
    from?: string;
    to?: string;
  }) {
    const where: any = { tenantId, terminationType: { not: null } };
    if (filters?.terminationType) where.terminationType = filters.terminationType;
    if (filters?.from || filters?.to) {
      where.terminatedAt = {};
      if (filters.from) where.terminatedAt.gte = new Date(filters.from);
      if (filters.to) where.terminatedAt.lte = new Date(filters.to);
    }

    const staff = await this.prisma.staff.findMany({
      where,
      include: {
        contracts: {
          where: { status: 'TERMINATED' },
          orderBy: { terminatedAt: 'desc' },
          take: 1,
        },
        photo: true,
      },
      orderBy: { terminatedAt: 'desc' },
    });

    return staff.map((s) => ({
      ...s,
      staffCode: s.employeeNumber,
      category: Object.entries(CATEGORY_TO_ROLE).find(([, v]) => v === s.roleType)?.[0] || s.roleType,
      photoUrl: s.photo?.thumbnailUrl || null,
    }));
  }

  /**
   * Réactive un employé précédemment débauché (réintégration)
   */
  async reactivateStaff(id: string, tenantId: string, data?: { reason?: string }) {
    const staff = await this.prisma.staff.findFirst({
      where: { id, tenantId },
    });

    if (!staff) {
      throw new NotFoundException(`Employé avec l'ID ${id} non trouvé`);
    }

    if (staff.status !== 'INACTIVE') {
      throw new BadRequestException(
        `Cet employé n'est pas inactif (statut: ${staff.status}). La réactivation n'est pas nécessaire.`,
      );
    }

    return this.prisma.staff.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        status: 'ACTIVE',
        terminationType: null,
        terminationDetails: null,
        terminatedAt: null,
        noticePeriodDays: null,
        lastWorkingDate: null,
        notes: data?.reason
          ? `${staff.notes || ''}\n[Réactivation ${new Date().toISOString().split('T')[0]}] ${data.reason}`.trim()
          : staff.notes,
      },
    });
  }

  // ─── STAFF PHOTO ────────────────────────────────────────────────────────

  /**
   * Upload et sauvegarde la photo d'un membre du personnel.
   * Crée ou remplace la photo existante (une seule photo par staff).
   */
  async uploadStaffPhoto(
    staffId: string,
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<any> {
    // Verify staff exists
    await this.findStaffById(staffId, tenantId);

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Type de fichier non autorisé. Formats acceptés: JPEG, PNG, WebP, GIF`);
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(`Fichier trop volumineux. Taille maximale: 5 Mo`);
    }

    // Upload file to storage
    const originalUrl = await this.storageService.uploadFile(file, `staff-photos/${tenantId}`);

    // For now, use the same URL for all sizes (could add Sharp processing later)
    const hdUrl = originalUrl;
    const thumbnailUrl = originalUrl;

    // Upsert photo (one per staff)
    const photo = await this.prisma.staffPhoto.upsert({
      where: { staffId },
      create: {
        ...prismaCreateDefaults(),
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

    return photo;
  }

  /**
   * Récupère la photo d'un membre du personnel
   */
  async getStaffPhoto(staffId: string, tenantId: string): Promise<any> {
    await this.findStaffById(staffId, tenantId);
    return this.prisma.staffPhoto.findUnique({
      where: { staffId },
    });
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
   * Upload et ajoute un document à un membre du personnel.
   * Le document est classé automatiquement par catégorie selon son type.
   */
  async uploadStaffDocument(
    staffId: string,
    tenantId: string,
    file: Express.Multer.File,
    documentType: string,
    description?: string,
    expiresAt?: string,
  ): Promise<any> {
    // Verify staff exists
    await this.findStaffById(staffId, tenantId);

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(`Fichier trop volumineux. Taille maximale: 20 Mo`);
    }

    // Determine category from document type
    const category = DOC_TYPE_TO_CATEGORY[documentType] || 'GENERAL';

    // Check if a document of this type already exists (for versioning)
    const existingDoc = await this.prisma.staffDocument.findFirst({
      where: { staffId, tenantId, documentType },
      orderBy: { version: 'desc' },
    });

    const version = existingDoc ? existingDoc.version + 1 : 1;

    // Upload file to storage, organized by staff member and document type
    const filePath = await this.storageService.uploadFile(
      file,
      `staff-docs/${tenantId}/${staffId}/${documentType.toLowerCase()}`,
    );

    // If replacing (version 1 exists), mark old document as superseded
    if (existingDoc && version > 1) {
      // Keep old document for history but mark it
    }

    return this.prisma.staffDocument.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        staffId,
        documentType,
        fileName: file.originalname,
        filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        category,
        description: description || null,
        validationStatus: 'PENDING',
        expiresAt: expiresAt ? new Date(expiresAt) : null,
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
}
