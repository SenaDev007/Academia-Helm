/**
 * ============================================================================
 * STAFF PRISMA SERVICE - MODULE 5 (SCHEMA-ALIGNED v2)
 * ============================================================================
 *
 * Service aligné sur le schéma Prisma réel :
 * - employeeNumber (unique, auto-généré si absent)
 * - roleType (ex category: PEDAGOGICAL→TEACHER, ADMIN→ADMIN, SUPPORT→SUPPORT)
 * - StaffDocument : { documentType, fileName, filePath, mimeType }
 *
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

// Mapping catégorie UI → roleType Prisma
const CATEGORY_TO_ROLE: Record<string, string> = {
  PEDAGOGICAL: 'TEACHER',
  ADMIN:       'ADMIN',
  SUPPORT:     'SUPPORT',
  TEACHER:     'TEACHER',
};

function generateEmployeeNumber(): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `STF-${year}-${rand}`;
}

@Injectable()
export class StaffPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un membre du personnel.
   * Accepte les champs envoyés par l'OnboardingWizard et les mappe
   * correctement au schéma Prisma (employeeNumber, roleType, etc.)
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
      // Générer un nouveau numéro unique en cas de collision
      const newNumber = `${employeeNumber}-${Date.now().toString().slice(-4)}`;
      return this.doCreateStaff(data, newNumber);
    }

    return this.doCreateStaff(data, employeeNumber);
  }

  private async doCreateStaff(data: any, employeeNumber: string) {
    const roleType = data.roleType
      || CATEGORY_TO_ROLE[data.category || '']
      || 'TEACHER';

    const created = await this.prisma.staff.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId:       data.tenantId,
        academicYearId: data.academicYearId || null,
        employeeNumber,
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
    return { ...created, staffCode: created.employeeNumber, category: data.category || 'PEDAGOGICAL' };
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
      },
      orderBy: { lastName: 'asc' },
    });

    // Ajouter staffCode et category aliases pour compatibilité frontend
    return staff.map((s) => ({
      ...s,
      staffCode: s.employeeNumber,
      category: Object.entries(CATEGORY_TO_ROLE).find(([, v]) => v === s.roleType)?.[0] || s.roleType,
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
        documents: { orderBy: { createdAt: 'desc' } },
        attendance: { take: 30, orderBy: { date: 'desc' } },
        evaluations: { take: 10, orderBy: { createdAt: 'desc' } },
        trainings: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!staff) {
      throw new NotFoundException(`Staff with ID ${id} not found`);
    }

    // Extract extra fields stored in notes JSON and expose at top level for frontend
    let notesExtra: Record<string, any> = {};
    try {
      notesExtra = typeof staff.notes === 'string'
        ? JSON.parse(staff.notes)
        : (staff.notes as any) || {};
    } catch { notesExtra = {}; }

    return {
      ...staff,
      staffCode: staff.employeeNumber,
      category: Object.entries(CATEGORY_TO_ROLE).find(([, v]) => v === staff.roleType)?.[0] || staff.roleType,
      // Expose extra fields from notes at top level for frontend compatibility
      nationality: notesExtra.nationality || null,
      maritalStatus: notesExtra.maritalStatus || null,
      numberOfChildren: notesExtra.numberOfChildren || null,
      ifuNumber: notesExtra.ifuNumber || null,
      nationalId: notesExtra.nationalId || null,
      cnssNumber: notesExtra.cnssNumber || null,
    };
  }

  /**
   * Met à jour un membre du personnel
   */
  async updateStaff(id: string, tenantId: string, data: any) {
    await this.findStaffById(id, tenantId);

    // Mapper les champs UI vers Prisma
    const updateData: any = {};
    if (data.category) {
      updateData.roleType = CATEGORY_TO_ROLE[data.category] || data.category;
    }
    if (data.staffCode) {
      // Non modifiable directement — skip
    }
    if (data.birthDate) {
      updateData.birthDate = new Date(data.birthDate);
    }
    if (data.dateOfBirth) {
      updateData.dateOfBirth = new Date(data.dateOfBirth);
      // Also set birthDate if not explicitly provided (they represent the same info)
      if (!data.birthDate) {
        updateData.birthDate = new Date(data.dateOfBirth);
      }
    }
    if (data.hireDate) {
      updateData.hireDate = new Date(data.hireDate);
    }
    if (data.salary !== undefined) {
      updateData.salary = data.salary;
    }

    // Direct scalar fields that exist in Prisma schema
    const scalarFields = [
      'firstName', 'lastName', 'gender', 'phone', 'email', 'address',
      'position', 'department', 'contractType', 'qualifications', 'status',
      'notes', 'emergencyContact', 'bankDetails',
    ];
    for (const field of scalarFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    // Fields NOT in Prisma Staff model — store them in the `notes` JSON field
    const extraFields = ['nationality', 'maritalStatus', 'numberOfChildren', 'ifuNumber', 'nationalId', 'cnssNumber'];
    const extraData: Record<string, any> = {};
    for (const field of extraFields) {
      if (data[field] !== undefined) {
        extraData[field] = data[field];
      }
    }

    // Merge extra fields into existing notes
    if (Object.keys(extraData).length > 0) {
      const existingStaff = await this.prisma.staff.findUnique({ where: { id } });
      let existingNotes: any = {};
      try {
        existingNotes = typeof existingStaff?.notes === 'string'
          ? JSON.parse(existingStaff.notes)
          : (existingStaff?.notes as any) || {};
      } catch { existingNotes = {}; }

      updateData.notes = JSON.stringify({
        ...existingNotes,
        ...extraData,
      });
    }

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

  // ─── STAFF DOCUMENTS ──────────────────────────────────────────────────────

  /**
   * Ajoute un document à un membre du personnel.
   * Champs alignés sur le schéma Prisma : documentType, fileName, filePath, mimeType
   */
  async addStaffDocument(data: {
    tenantId: string;
    staffId: string;
    documentType: string;  // CV / CNI / BIRTH_CERTIFICATE / DIPLOMA / OTHER
    fileName: string;
    filePath: string;
    fileSize?: number;
    mimeType?: string;
    uploadedBy?: string;
  }) {
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
        uploadedBy:   data.uploadedBy || null,
      },
    });
  }

  /**
   * Récupère tous les documents d'un membre du personnel
   */
  async findStaffDocuments(staffId: string, tenantId: string) {
    return this.prisma.staffDocument.findMany({
      where: { staffId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Supprime un document d'un membre du personnel
   */
  async deleteStaffDocument(docId: string, staffId: string, tenantId: string) {
    const doc = await this.prisma.staffDocument.findFirst({
      where: { id: docId, staffId, tenantId },
    });
    if (!doc) {
      throw new NotFoundException(`Document ${docId} introuvable`);
    }
    return this.prisma.staffDocument.delete({ where: { id: docId } });
  }
}
