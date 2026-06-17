/**
 * ============================================================================
 * TESTS UNITAIRES — AcademicYearRolloverService
 * ============================================================================
 *
 * Couvre les cas principaux du cron d'auto-rollover :
 *  - Cas "année pas terminée → rien"
 *  - Cas "année terminée → close + promote"
 *  - Cas "année suivante inexistante → create + activate"
 *  - Cas "année clôturée → rien"
 *  - Cas "multi-tenant"
 *
 * NOTE : Ces tests sont des squelettes — à adapter selon le framework de test
 * utilisé (Jest par défaut avec NestJS). Les mocks sont à compléter selon
 * la structure exacte de PrismaService et AcademicYearsPrismaService.
 * ============================================================================
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AcademicYearRolloverService } from './academic-year-rollover.service';
import { PrismaService } from '../database/prisma.service';
import { AcademicYearsPrismaService } from './academic-years-prisma.service';
import { AcademicYearCalculatorService } from './academic-year-calculator.service';
import { EmailService } from '../communication/services/email.service';

describe('AcademicYearRolloverService', () => {
  let service: AcademicYearRolloverService;
  let prisma: jest.Mocked<Pick<PrismaService, 'tenant' | 'academicYear'>>;
  let academicYearsPrisma: jest.Mocked<Pick<AcademicYearsPrismaService, 'closeAndPromoteYear' | 'generateNextAcademicYear' | 'generateCurrentAcademicYear' | 'checkAndGenerateNextYear'>>;
  let emailService: jest.Mocked<Pick<EmailService, 'sendEmail'>>;

  beforeEach(async () => {
    const mockPrisma = {
      tenant: {
        findMany: jest.fn(),
      },
      academicYear: {
        findFirst: jest.fn(),
      },
    };
    const mockAcademicYearsPrisma = {
      closeAndPromoteYear: jest.fn(),
      generateNextAcademicYear: jest.fn(),
      generateCurrentAcademicYear: jest.fn(),
      checkAndGenerateNextYear: jest.fn(),
    };
    const mockEmailService = {
      sendEmail: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicYearRolloverService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AcademicYearsPrismaService, useValue: mockAcademicYearsPrisma },
        { provide: AcademicYearCalculatorService, useValue: {} },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AcademicYearRolloverService>(AcademicYearRolloverService);
    prisma = mockPrisma as any;
    academicYearsPrisma = mockAcademicYearsPrisma as any;
    emailService = mockEmailService as any;
  });

  describe('processTenant', () => {
    it('ne fait rien si l\'année active n\'est pas terminée', async () => {
      // Arrange : année active avec endDate dans le futur
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60); // +60 jours
      (prisma.academicYear.findFirst as jest.Mock).mockResolvedValue({
        id: 'year-1',
        label: '2025-2026',
        endDate: futureDate,
        isActive: true,
      });

      // Act
      const result = await service.processTenant('tenant-1', 'Test School');

      // Assert
      expect(result.rolledOver).toBe(false);
      expect(result.preGenerated).toBe(false);
      expect(result.autoCreated).toBe(false);
      expect(academicYearsPrisma.closeAndPromoteYear).not.toHaveBeenCalled();
    });

    it('clôture et promeut si l\'année active est terminée', async () => {
      // Arrange : année active avec endDate dans le passé
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10); // -10 jours
      (prisma.academicYear.findFirst as jest.Mock).mockResolvedValue({
        id: 'year-1',
        label: '2024-2025',
        endDate: pastDate,
        isActive: true,
      });
      (academicYearsPrisma.closeAndPromoteYear as jest.Mock).mockResolvedValue({
        previousYearId: 'year-1',
        previousYearLabel: '2024-2025',
        nextYearId: 'year-2',
        nextYearLabel: '2025-2026',
        closedAt: new Date(),
      });

      // Act
      const result = await service.processTenant('tenant-1', 'Test School');

      // Assert
      expect(result.rolledOver).toBe(true);
      expect(academicYearsPrisma.closeAndPromoteYear).toHaveBeenCalledWith(
        'year-1',
        'tenant-1',
        'SYSTEM_CRON',
      );
      expect(emailService.sendEmail).toHaveBeenCalled();
    });

    it('crée l\'année courante si aucune année active n\'existe', async () => {
      // Arrange : aucune année active
      (prisma.academicYear.findFirst as jest.Mock).mockResolvedValue(null);
      (academicYearsPrisma.generateCurrentAcademicYear as jest.Mock).mockResolvedValue({
        id: 'new-year',
        label: '2025-2026',
        isActive: true,
      });

      // Act
      const result = await service.processTenant('tenant-1', 'Test School');

      // Assert
      expect(result.autoCreated).toBe(true);
      expect(academicYearsPrisma.generateCurrentAcademicYear).toHaveBeenCalledWith('tenant-1');
    });

    it('pré-génère la suivante si l\'année se termine dans ≤ 30 jours', async () => {
      // Arrange : année active se terminant dans 15 jours
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 15); // +15 jours
      (prisma.academicYear.findFirst as jest.Mock).mockResolvedValue({
        id: 'year-1',
        label: '2024-2025',
        endDate: soonDate,
        isActive: true,
      });
      (academicYearsPrisma.generateNextAcademicYear as jest.Mock).mockResolvedValue({
        id: 'year-2',
        label: '2025-2026',
      });

      // Act
      const result = await service.processTenant('tenant-1', 'Test School');

      // Assert
      expect(result.preGenerated).toBe(true);
      expect(academicYearsPrisma.generateNextAcademicYear).toHaveBeenCalledWith('tenant-1');
      expect(academicYearsPrisma.closeAndPromoteYear).not.toHaveBeenCalled();
    });

    it('ne notifie pas par email si le rollover échoue', async () => {
      // Arrange : année terminée mais closeAndPromoteYear lève une exception
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      (prisma.academicYear.findFirst as jest.Mock).mockResolvedValue({
        id: 'year-1',
        label: '2024-2025',
        endDate: pastDate,
        isActive: true,
      });
      (academicYearsPrisma.closeAndPromoteYear as jest.Mock).mockRejectedValue(
        new Error('Transaction failed'),
      );

      // Act
      const result = await service.processTenant('tenant-1', 'Test School');

      // Assert
      expect(result.rolledOver).toBe(false);
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('runDailyRollover (cron)', () => {
    it('traite tous les tenants actifs', async () => {
      // Arrange : 3 tenants
      (prisma.tenant.findMany as jest.Mock).mockResolvedValue([
        { id: 't1', name: 'School 1' },
        { id: 't2', name: 'School 2' },
        { id: 't3', name: 'School 3' },
      ]);
      (prisma.academicYear.findFirst as jest.Mock).mockResolvedValue(null);
      (academicYearsPrisma.generateCurrentAcademicYear as jest.Mock).mockResolvedValue({});

      // Act
      await service.runDailyRollover();

      // Assert : 3 tenants traités
      expect(academicYearsPrisma.generateCurrentAcademicYear).toHaveBeenCalledTimes(3);
    });

    it('continue le traitement des autres tenants si un échoue', async () => {
      // Arrange : 2 tenants, le premier lève une exception
      (prisma.tenant.findMany as jest.Mock).mockResolvedValue([
        { id: 't1', name: 'School 1' },
        { id: 't2', name: 'School 2' },
      ]);
      (prisma.academicYear.findFirst as jest.Mock)
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(null);
      (academicYearsPrisma.generateCurrentAcademicYear as jest.Mock).mockResolvedValue({});

      // Act — ne doit pas lever d'exception
      await service.runDailyRollover();

      // Assert : le 2e tenant a quand même été traité
      expect(academicYearsPrisma.generateCurrentAcademicYear).toHaveBeenCalledTimes(1);
    });
  });
});
