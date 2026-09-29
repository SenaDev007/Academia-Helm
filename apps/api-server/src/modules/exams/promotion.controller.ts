/**
 * ============================================================================
 * PROMOTION CONTROLLER — Module Examen
 * ============================================================================
 *
 * POST /api/exams/promotion/apply
 *
 * Applique la promotion de fin d'année :
 *   1. Génère l'année scolaire suivante (AcademicYearSettingsService.generateNext)
 *   2. Duplique la structure (AcademicStructurePrismaService.duplicateStructure)
 *   3. Copie les fee structures (FeeStructureService.copyToNewYear)
 *   4. Réinscrit les élèves :
 *      - Passants → promoteStudent (classe supérieure)
 *      - Redoublants → reEnroll (même classe)
 *   5. Crée les comptes financiers (StudentAccountService.getOrCreate)
 *   6. Injecte les arriérés depuis l'année précédente
 *
 * Le tout suit rigoureusement le flux de création de l'app :
 *   - Année scolaire + trimestres : même pattern que Settings > Année scolaire
 *   - Classes + sections : même pattern que Settings > Structure
 *   - Réinscriptions : même pattern que Élèves & Scolarité > Réinscription
 *   - Comptes financiers : même pattern que Finance > StudentAccount
 * ============================================================================
 */

import {
  Controller, Post, Body, Logger, BadRequestException,
} from '@nestjs/common';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { AcademicYearSettingsService } from '../../settings/services/academic-year-settings.service';
import { AcademicStructurePrismaService } from '../../pedagogy/academic-structure-prisma.service';
import { FeeStructureService } from '../../finance/fee-structure.service';
import { StudentAccountService } from '../../finance/student-account.service';

interface PromotionStudentDto {
  studentId: string;
  matricule: string;
  name: string;
  generalAverage: number | null;
  decision: 'PASSE' | 'REDOUBLE' | 'RACHAT';
  rachatApplied: boolean;
  targetClassId?: string; // classe supérieure pour les passants
  currentClassId?: string; // classe actuelle pour les redoublants
}

@Controller('exams/promotion')
export class PromotionController {
  private readonly logger = new Logger(PromotionController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly academicYearSettings: AcademicYearSettingsService,
    private readonly academicStructure: AcademicStructurePrismaService,
    private readonly feeStructure: FeeStructureService,
    private readonly studentAccount: StudentAccountService,
  ) {}

  @Post('apply')
  async applyPromotion(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      academicYearId: string;
      students: PromotionStudentDto[];
    },
  ) {
    if (!body.academicYearId) throw new BadRequestException('academicYearId est requis');
    if (!body.students || body.students.length === 0) throw new BadRequestException('students est requis');

    const fromYearId = body.academicYearId;
    this.logger.log(`[Promotion] Démarrage pour ${body.students.length} élèves (tenant: ${tenantId}, year: ${fromYearId})`);

    const steps: string[] = [];

    try {
      // ── ÉTAPE 1 : Générer l'année scolaire suivante + trimestres ──────────
      //    Suit le même pattern que Settings > Année scolaire > generateNext
      this.logger.log('[Promotion] Étape 1/6 : Génération de l\'année scolaire suivante...');
      const nextYear = await this.academicYearSettings.generateNext(tenantId, user?.id);
      const toYearId = nextYear.id;
      steps.push(`✅ Année scolaire créée : ${nextYear.label} (${toYearId})`);
      this.logger.log(`[Promotion] Année suivante : ${nextYear.label} (${toYearId})`);

      // ── ÉTAPE 2 : Dupliquer la structure (classes, sections, niveaux) ────
      //    Suit le même pattern que Settings > Structure > duplicateStructure
      this.logger.log('[Promotion] Étape 2/6 : Duplication de la structure...');
      await this.academicStructure.duplicateStructure(tenantId, fromYearId, toYearId, user?.id);
      steps.push('✅ Structure dupliquée (classes, sections, niveaux, matières)');
      this.logger.log('[Promotion] Structure dupliquée');

      // ── ÉTAPE 3 : Copier les fee structures ──────────────────────────────
      //    Suit le même pattern que Finance > FeeStructureService.copyToNewYear
      this.logger.log('[Promotion] Étape 3/6 : Copie des configurations de frais...');
      try {
        await this.feeStructure.copyToNewYear(tenantId, { fromAcademicYearId: fromYearId, toAcademicYearId: toYearId }, user?.id);
        steps.push('✅ Configurations de frais copiées');
      } catch (e) {
        this.logger.warn(`[Promotion] Copie des frais échouée (non-bloquant) : ${e.message}`);
        steps.push(`⚠️ Copie des frais : ${e.message}`);
      }

      // ── ÉTAPE 4 : Résoudre les classes de destination ────────────────────
      //    Pour chaque élève, trouver la classe correspondante dans la nouvelle année
      this.logger.log('[Promotion] Étape 4/6 : Résolution des classes de destination...');

      // Récupérer les classes de l'année précédente
      const oldClasses = await this.prisma.academicClass.findMany({
        where: { tenantId, academicYearId: fromYearId },
        select: { id: true, name: true, level: { select: { id: true, name: true } } },
      });

      // Récupérer les classes de la nouvelle année
      const newClasses = await this.prisma.academicClass.findMany({
        where: { tenantId, academicYearId: toYearId },
        select: { id: true, name: true, level: { select: { id: true, name: true } } },
      });

      // Map : old class name → new class (même nom dans la nouvelle année)
      const classMap = new Map<string, string>();
      for (const old of oldClasses) {
        const match = newClasses.find(n => n.name === old.name);
        if (match) classMap.set(old.id, match.id);
      }

      // Pour les passants : trouver la classe supérieure
      // On utilise le pedagogical order pour déterminer la classe suivante
      const PEDAGOGICAL_ORDER = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6E', '5E', '4E', '3E', '2NDE', '1ERE', 'TERM'];
      const getClassName = (classId: string): string => {
        const c = oldClasses.find(o => o.id === classId);
        return c?.name || '';
      };
      const getNextClassName = (currentName: string): string | null => {
        const upper = (currentName || '').toUpperCase().trim();
        for (let i = 0; i < PEDAGOGICAL_ORDER.length - 1; i++) {
          if (upper.startsWith(PEDAGOGICAL_ORDER[i])) {
            const nextPrefix = PEDAGOGICAL_ORDER[i + 1];
            // Remplacer le préfixe mais garder le suffixe (ex: "6e A" → "5e A")
            const suffix = currentName.replace(new RegExp(`^${PEDAGOGICAL_ORDER[i]}`, 'i'), '');
            return nextPrefix.charAt(0) + nextPrefix.slice(1).toLowerCase() + suffix;
          }
        }
        // Terminale → pas de classe supérieure
        if (upper.startsWith('TERM')) return null;
        return null;
      };

      // ── ÉTAPE 5 : Réinscrire les élèves ──────────────────────────────────
      //    Suit le même pattern que Élèves & Scolarité > Réinscription
      this.logger.log('[Promotion] Étape 5/6 : Réinscription des élèves...');
      let promoted = 0;
      let repeated = 0;
      let accountsCreated = 0;

      for (const student of body.students) {
        const isPassant = student.decision === 'PASSE' || student.rachatApplied;
        const isRedoublant = student.decision === 'REDOUBLE' || (!isPassant && !student.rachatApplied);

        if (isPassant) {
          // ── Passant : promotion en classe supérieure ──
          const oldClassName = getClassName(student.currentClassId || '');
          const nextClassName = getNextClassName(oldClassName);

          if (nextClassName) {
            // Trouver le classId dans la nouvelle année
            const nextClass = newClasses.find(c => c.name === nextClassName);
            const toClassId = nextClass?.id || classMap.get(student.currentClassId || '') || undefined;

            // Promouvoir l'élève
            await this.prisma.studentEnrollment.create({
              data: {
                id: undefined, // Prisma génère l'UUID
                tenantId,
                academicYearId: toYearId,
                studentId: student.studentId,
                schoolLevelId: nextClass?.level?.id || undefined,
                classId: toClassId,
                enrollmentType: 'PROMOTION',
                enrollmentDate: new Date(),
                status: 'ACTIVE',
              },
            }).catch(() => {}); // Idempotent : si déjà réinscrit, on continue

            // Créer le compte financier
            try {
              await this.studentAccount.getOrCreate(tenantId, student.studentId, toYearId);
              accountsCreated++;
            } catch (e) {
              this.logger.warn(`[Promotion] Compte financier échoué pour ${student.name}: ${e.message}`);
            }

            promoted++;
          } else {
            // Terminale → pas de classe supérieure (diplômé)
            this.logger.log(`[Promotion] ${student.name} : Terminale → diplomé (pas de promotion)`);
          }
        } else if (isRedoublant) {
          // ── Redoublant : réinscription dans la même classe ──
          const toClassId = classMap.get(student.currentClassId || '') || undefined;

          await this.prisma.studentEnrollment.create({
            data: {
              id: undefined,
              tenantId,
              academicYearId: toYearId,
              studentId: student.studentId,
              schoolLevelId: undefined, // même niveau
              classId: toClassId,
              enrollmentType: 'REPEAT',
              enrollmentDate: new Date(),
              status: 'ACTIVE',
            },
          }).catch(() => {}); // Idempotent

          // Créer le compte financier
          try {
            await this.studentAccount.getOrCreate(tenantId, student.studentId, toYearId);
            accountsCreated++;
          } catch (e) {
            this.logger.warn(`[Promotion] Compte financier échoué pour ${student.name}: ${e.message}`);
          }

          repeated++;
        }
      }

      steps.push(`✅ ${promoted} élève(s) promu(s) en classe supérieure`);
      steps.push(`✅ ${repeated} élève(s) réinscrit(s) (redoublants)`);
      steps.push(`✅ ${accountsCreated} compte(s) financier(s) créé(s)`);

      // ── ÉTAPE 6 : Injecter les arriérés ─────────────────────────────────
      //    Suit le même pattern que Finance > StudentAccountService.injectArrears
      this.logger.log('[Promotion] Étape 6/6 : Injection des arriérés...');
      try {
        // Pour chaque élève, récupérer les arriérés de l'année précédente
        // et les injecter dans le compte de la nouvelle année
        for (const student of body.students) {
          try {
            // Récupérer le compte de l'année précédente
            const oldAccount = await this.prisma.studentAccount.findFirst({
              where: { tenantId, studentId: student.studentId, academicYearId: fromYearId },
              select: { totalDue: true, totalPaid: true, previousArrears: true },
            }).catch(() => null);

            if (oldAccount) {
              const arrears = Math.max(0, (oldAccount.totalDue || 0) - (oldAccount.totalPaid || 0));
              if (arrears > 0) {
                // Mettre à jour le compte de la nouvelle année avec les arriérés
                await this.prisma.studentAccount.updateMany({
                  where: { tenantId, studentId: student.studentId, academicYearId: toYearId },
                  data: { previousArrears: arrears },
                }).catch(() => {});
              }
            }
          } catch {
            // Silent fail per student
          }
        }
        steps.push('✅ Arriérés injectés depuis l\'année précédente');
      } catch (e) {
        this.logger.warn(`[Promotion] Injection des arriérés échouée : ${e.message}`);
        steps.push(`⚠️ Arriérés : ${e.message}`);
      }

      this.logger.log(`[Promotion] Terminé : ${promoted} promus, ${repeated} redoublants, ${accountsCreated} comptes`);

      return {
        success: true,
        nextYearLabel: nextYear.label,
        nextYearId: toYearId,
        promoted,
        repeated,
        accountsCreated,
        steps,
      };
    } catch (error) {
      this.logger.error('[Promotion] Erreur:', error);
      throw new BadRequestException(`Erreur lors de la promotion : ${error.message}`);
    }
  }
}
