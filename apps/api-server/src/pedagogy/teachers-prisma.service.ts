/**
 * ============================================================================
 * TEACHERS PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour la gestion des enseignants
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

@Injectable()
export class TeachersPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère un matricule unique
   */
  private async generateMatricule(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `TCH-${year}`;
    
    const count = await this.prisma.teacher.count({
      where: {
        tenantId,
        matricule: { startsWith: prefix },
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `${prefix}-${sequence}`;
  }

  /**
   * Crée un enseignant
   */
  async createTeacher(data: {
    tenantId: string;
    schoolLevelId: string;
    firstName: string;
    lastName: string;
    matricule?: string;
    gender?: string;
    dateOfBirth?: string | Date;
    address?: string;
    phone?: string;
    email?: string;
    departmentId?: string;
    position?: string;
    specialization?: string;
    subjectId?: string;
    academicYearId?: string;
    hireDate?: string | Date;
    contractType?: string;
    status?: string;
    workingHours?: number;
    salary?: number;
    bankDetails?: string;
    emergencyContact?: string;
    qualifications?: string;
    notes?: string;
  }) {
    // Auto-generate matricule if not provided
    const matricule = data.matricule || await this.generateMatricule(data.tenantId);

    // Convert date strings to Date objects
    const dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : undefined;
    const hireDate = data.hireDate ? new Date(data.hireDate) : undefined;

    // Convert salary to proper Decimal format
    const salary = data.salary !== undefined ? data.salary : undefined;

    return this.prisma.teacher.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        schoolLevelId: data.schoolLevelId,
        firstName: data.firstName,
        lastName: data.lastName,
        matricule,
        gender: data.gender,
        dateOfBirth,
        address: data.address,
        phone: data.phone,
        email: data.email,
        departmentId: data.departmentId,
        position: data.position,
        specialization: data.specialization,
        subjectId: data.subjectId,
        academicYearId: data.academicYearId,
        hireDate,
        contractType: data.contractType,
        status: data.status || 'active',
        workingHours: data.workingHours,
        salary,
        bankDetails: data.bankDetails,
        emergencyContact: data.emergencyContact,
        qualifications: data.qualifications,
        notes: data.notes,
      },
      include: {
        schoolLevel: true,
        department: true,
      },
    });
  }

  /**
   * Récupère tous les enseignants
   */
  async findAllTeachers(
    tenantId: string,
    filters?: {
      schoolLevelId?: string;
      departmentId?: string;
      status?: string;
      search?: string;
    }
  ) {
    const where: any = {
      tenantId,
    };

    // ─── Exclure le promoteur de la liste des enseignants ──
    // Le promoteur est le propriétaire de l'école, pas un enseignant.
    // On l'exclut en filtrant par email : si un User avec role PROMOTER
    // a le même email que le Teacher, on l'exclut.
    try {
      const promoterUsers = await this.prisma.user.findMany({
        where: {
          tenantId,
          role: { in: ['PROMOTER', 'PROMOTEUR', 'SCHOOL_OWNER', 'SUPER_DIRECTOR'] },
          email: { not: null },
        },
        select: { email: true },
      });
      const promoterEmails = promoterUsers
        .map((u) => u.email)
        .filter((e): e is string => !!e);

      if (promoterEmails.length > 0) {
        where.email = { notIn: promoterEmails };
      }
    } catch {
      // Si la requête échoue (ex: table User pas encore migrée), on continue sans filtre
    }

    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    if (filters?.departmentId) {
      where.departmentId = filters.departmentId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { matricule: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const teachers = await this.prisma.teacher.findMany({
      where,
      include: {
        schoolLevel: true,
        department: true,
        teacherSubjects: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });

    // ─── Enrichir avec la photo de profil depuis Staff (par email) ──
    // Le modèle Teacher n'a pas de champ photo direct. On fait une jointure
    // manuelle avec Staff (par email) pour récupérer StaffPhoto.thumbnailUrl.
    // Si pas de photo, le frontend affichera les initiales (fallback).
    try {
      const teacherEmails = teachers
        .map((t) => t.email)
        .filter((e): e is string => !!e);

      if (teacherEmails.length > 0) {
        const staffWithPhotos = await this.prisma.staff.findMany({
          where: {
            tenantId,
            email: { in: teacherEmails },
          },
          select: {
            email: true,
            photo: {
              select: {
                thumbnailUrl: true,
                originalUrl: true,
                hdUrl: true,
              },
            },
          },
        });

        // Map email → photo URL pour lookup rapide
        const photoByEmail = new Map<string, { thumbnailUrl: string; originalUrl: string; hdUrl: string }>();
        for (const s of staffWithPhotos) {
          if (s.email && s.photo) {
            photoByEmail.set(s.email, s.photo);
          }
        }

        // Enrichir chaque teacher avec photoUrl
        return teachers.map((t) => ({
          ...t,
          photoUrl: t.email ? (photoByEmail.get(t.email)?.thumbnailUrl ?? null) : null,
          photoUrlHd: t.email ? (photoByEmail.get(t.email)?.hdUrl ?? null) : null,
          photoUrlOriginal: t.email ? (photoByEmail.get(t.email)?.originalUrl ?? null) : null,
        }));
      }
    } catch (err: any) {
      // Si l'enrichissement échoue (ex: table Staff pas encore migrée), on continue sans photo
      // Le frontend affichera les initiales (fallback)
    }

    return teachers;
  }

  /**
   * Récupère un enseignant par ID
   */
  async findTeacherById(id: string, tenantId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, tenantId },
      include: {
        schoolLevel: true,
        department: true,
        teacherSubjects: {
          include: {
            subject: true,
            academicYear: true,
          },
        },
        teacherClassAssignments: {
          include: {
            classSubject: {
              include: {
                class: true,
                subject: true,
              },
            },
          },
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${id} not found`);
    }

    return teacher;
  }

  /**
   * Met à jour un enseignant
   */
  async updateTeacher(
    id: string,
    tenantId: string,
    data: {
      firstName?: string;
      lastName?: string;
      gender?: string;
      dateOfBirth?: string | Date;
      address?: string;
      phone?: string;
      email?: string;
      departmentId?: string;
      position?: string;
      specialization?: string;
      subjectId?: string;
      academicYearId?: string;
      hireDate?: string | Date;
      contractType?: string;
      status?: string;
      workingHours?: number;
      salary?: number;
      bankDetails?: string;
      emergencyContact?: string;
      qualifications?: string;
      notes?: string;
      schoolLevelId?: string;
    }
  ) {
    await this.findTeacherById(id, tenantId);

    // Convert date strings to Date objects
    const updateData: any = { ...prismaUpdateDefaults() };
    
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(data.dateOfBirth);
    if (data.address !== undefined) updateData.address = data.address;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.specialization !== undefined) updateData.specialization = data.specialization;
    if (data.subjectId !== undefined) updateData.subjectId = data.subjectId;
    if (data.academicYearId !== undefined) updateData.academicYearId = data.academicYearId;
    if (data.hireDate !== undefined) updateData.hireDate = new Date(data.hireDate);
    if (data.contractType !== undefined) updateData.contractType = data.contractType;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.workingHours !== undefined) updateData.workingHours = data.workingHours;
    if (data.salary !== undefined) updateData.salary = data.salary;
    if (data.bankDetails !== undefined) updateData.bankDetails = data.bankDetails;
    if (data.emergencyContact !== undefined) updateData.emergencyContact = data.emergencyContact;
    if (data.qualifications !== undefined) updateData.qualifications = data.qualifications;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.schoolLevelId !== undefined) updateData.schoolLevelId = data.schoolLevelId;

    return this.prisma.teacher.update({
      where: { id },
      data: updateData,
      include: {
        schoolLevel: true,
        department: true,
      },
    });
  }

  /**
   * Archive un enseignant
   */
  async archiveTeacher(id: string, tenantId: string) {
    await this.findTeacherById(id, tenantId);

    return this.prisma.teacher.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        status: 'archived',
      },
    });
  }
}
