import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ModuleType, ModuleStatus } from './entities/module.entity';

@Injectable()
export class ModulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: any): Promise<any> {
    return this.prisma.module.create({ data });
  }

  async findAll(tenantId: string, schoolLevelId?: string): Promise<any[]> {
    const where: any = { tenantId };
    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }
    return this.prisma.module.findMany({
      where,
      include: { schoolLevel: true },
      orderBy: { order: 'asc' },
    });
  }

  async findActive(tenantId: string, schoolLevelId?: string): Promise<any[]> {
    const where: any = {
      tenantId,
      isEnabled: true,
      status: ModuleStatus.ACTIVE,
    };
    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }
    return this.prisma.module.findMany({
      where,
      include: { schoolLevel: true },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.module.findFirst({
      where: { id, tenantId },
      include: { schoolLevel: true },
    });
  }

  async findByType(
    tenantId: string,
    type: ModuleType,
    schoolLevelId?: string,
  ): Promise<any[]> {
    const where: any = { tenantId, type };
    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }
    return this.prisma.module.findMany({
      where,
      include: { schoolLevel: true },
    });
  }

  async update(
    id: string,
    tenantId: string,
    data: any,
  ): Promise<any> {
    await this.prisma.module.update({
      where: { id },
      data,
    });
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.module.delete({ where: { id } });
  }

  /**
   * Vérifier si un module est activé pour un niveau donné
   */
  async isModuleEnabled(
    tenantId: string,
    moduleType: ModuleType,
    schoolLevelId: string,
  ): Promise<boolean> {
    const whereClause: any = {
      tenantId,
      type: moduleType,
      isEnabled: true,
      status: ModuleStatus.ACTIVE,
    };
    if (schoolLevelId !== 'ALL') {
      whereClause.schoolLevelId = schoolLevelId;
    }
    const module = await this.prisma.module.findFirst({
      where: whereClause,
    });
    return !!module;
  }

  /**
   * Initialiser les modules par défaut pour un tenant et un niveau
   */
  async initializeDefaultModules(
    tenantId: string,
    schoolLevelId: string,
  ): Promise<any[]> {
    const defaultModules = [
      {
        tenantId,
        schoolLevelId,
        type: ModuleType.SCOLARITE,
        name: 'Scolarité & Élèves',
        code: 'scolarite',
        description: 'Gestion des élèves et inscriptions',
        status: ModuleStatus.ACTIVE,
        isEnabled: true,
        permissions: ['students.read', 'students.manage'],
        dependencies: [],
        order: 1,
        route: '/dashboard/students',
        icon: 'Users',
      },
      {
        tenantId,
        schoolLevelId,
        type: ModuleType.FINANCES,
        name: 'Économat & Finance',
        code: 'finances',
        description: 'Gestion financière et comptabilité',
        status: ModuleStatus.ACTIVE,
        isEnabled: true,
        permissions: ['finance.read', 'finance.manage'],
        dependencies: [],
        order: 2,
        route: '/dashboard/finance',
        icon: 'Calculator',
      },
      {
        tenantId,
        schoolLevelId,
        type: ModuleType.PEDAGOGIE,
        name: 'Études & Planification',
        code: 'pedagogie',
        description: 'Emplois du temps et planning',
        status: ModuleStatus.ACTIVE,
        isEnabled: true,
        permissions: ['planning.read', 'planning.manage'],
        dependencies: ['SCOLARITE'],
        order: 3,
        route: '/dashboard/planning',
        icon: 'Building',
      },
      {
        tenantId,
        schoolLevelId,
        type: ModuleType.EXAMENS,
        name: 'Examens & Évaluation',
        code: 'examens',
        description: 'Examens, notes et bulletins',
        status: ModuleStatus.ACTIVE,
        isEnabled: true,
        permissions: ['exams.read', 'exams.manage'],
        dependencies: ['SCOLARITE', 'PEDAGOGIE'],
        order: 4,
        route: '/dashboard/examinations',
        icon: 'BookOpen',
      },
      {
        tenantId,
        schoolLevelId,
        type: ModuleType.RH,
        name: 'Personnel & RH',
        code: 'rh',
        description: 'Gestion du personnel et RH',
        status: ModuleStatus.ACTIVE,
        isEnabled: true,
        permissions: ['hr.read', 'hr.manage'],
        dependencies: [],
        order: 5,
        route: '/dashboard/hr',
        icon: 'UserCheck',
      },
      {
        tenantId,
        schoolLevelId,
        type: ModuleType.COMMUNICATION,
        name: 'Communication',
        code: 'communication',
        description: 'SMS, emails et notifications',
        status: ModuleStatus.ACTIVE,
        isEnabled: true,
        permissions: ['communication.read', 'communication.manage'],
        dependencies: [],
        order: 6,
        route: '/dashboard/communication',
        icon: 'MessageSquare',
      },
      // Modules supplémentaires
      {
        tenantId,
        schoolLevelId,
        type: ModuleType.BIBLIOTHEQUE,
        name: 'Bibliothèque',
        code: 'bibliotheque',
        description: 'Gestion du catalogue et prêts de livres',
        status: ModuleStatus.ACTIVE,
        isEnabled: true,
        permissions: ['library.read', 'library.manage'],
        dependencies: ['SCOLARITE'],
        order: 7,
        route: '/dashboard/library',
        icon: 'Book',
      },
      {
        tenantId,
        schoolLevelId,
        type: ModuleType.LABORATOIRE,
        name: 'Laboratoire',
        code: 'laboratoire',
        description: 'Gestion des équipements et réservations',
        status: ModuleStatus.ACTIVE,
        isEnabled: true,
        permissions: ['laboratory.read', 'laboratory.manage'],
        dependencies: ['PEDAGOGIE'],
        order: 8,
        route: '/dashboard/laboratory',
        icon: 'FlaskConical',
      },
      {
        tenantId,
        schoolLevelId,
        type: ModuleType.TRANSPORT,
        name: 'Transport',
        code: 'transport',
        description: 'Gestion des véhicules et itinéraires',
        status: ModuleStatus.ACTIVE,
        isEnabled: true,
        permissions: ['transport.read', 'transport.manage'],
        dependencies: ['SCOLARITE'],
        order: 9,
        route: '/dashboard/transport',
        icon: 'Bus',
      },
      {
        tenantId,
        schoolLevelId,
        type: ModuleType.CANTINE,
        name: 'Cantine',
        code: 'cantine',
        description: 'Gestion des repas et menus',
        status: ModuleStatus.ACTIVE,
        isEnabled: true,
        permissions: ['cafeteria.read', 'cafeteria.manage'],
        dependencies: ['SCOLARITE', 'FINANCES'],
        order: 10,
        route: '/dashboard/cafeteria',
        icon: 'UtensilsCrossed',
      },
      {
        tenantId,
        schoolLevelId,
        type: ModuleType.INFIRMERIE,
        name: 'Infirmerie',
        code: 'infirmerie',
        description: 'Dossiers médicaux et visites',
        status: ModuleStatus.ACTIVE,
        isEnabled: true,
        permissions: ['health.read', 'health.manage'],
        dependencies: ['SCOLARITE'],
        order: 11,
        route: '/dashboard/health',
        icon: 'Heart',
      },
      {
        tenantId,
        schoolLevelId,
        type: ModuleType.QHSE,
        name: 'QHSE',
        code: 'qhse',
        description: 'Qualité, Hygiène, Sécurité et Environnement',
        status: ModuleStatus.ACTIVE,
        isEnabled: true,
        permissions: ['qhse.read', 'qhse.manage'],
        dependencies: [],
        order: 12,
        route: '/dashboard/qhse',
        icon: 'ShieldCheck',
      },
      {
        tenantId,
        schoolLevelId,
        type: ModuleType.EDUCAST,
        name: 'EduCast',
        code: 'educast',
        description: 'Diffusion de contenu éducatif',
        status: ModuleStatus.ACTIVE,
        isEnabled: true,
        permissions: ['educast.read', 'educast.manage'],
        dependencies: ['PEDAGOGIE'],
        order: 13,
        route: '/dashboard/educast',
        icon: 'Radio',
      },
      {
        tenantId,
        schoolLevelId,
        type: ModuleType.BOUTIQUE,
        name: 'Boutique',
        code: 'boutique',
        description: 'Vente de fournitures scolaires',
        status: ModuleStatus.ACTIVE,
        isEnabled: true,
        permissions: ['boutique.read', 'boutique.manage'],
        dependencies: ['SCOLARITE', 'FINANCES'],
        order: 14,
        route: '/dashboard/boutique',
        icon: 'ShoppingCart',
      },
    ];

    const created = [];
    for (const moduleData of defaultModules) {
      const existing = await this.prisma.module.findFirst({
        where: {
          tenantId,
          type: moduleData.type,
          schoolLevelId,
        },
      });

      if (!existing) {
        const module = await this.create(moduleData);
        created.push(module);
      } else {
        created.push(existing);
      }
    }

    return created;
  }
}
