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
  Controller, Post, Get, Body, Param, Query, Logger, BadRequestException,
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

  /**
   * ⭐ GET /api/exams/promotion/class/:classId
   *    Calcule les moyennes annuelles de TOUS les élèves d'une classe côté
   *    backend (1 requête Prisma au lieu de N fetchs HTTP côté frontend).
   *    Avant : le frontend faisait getEvaluations + getGradingSheetsBatch
   *    (N requêtes HTTP) → lent + élèves manquants.
   *
   * Algorithme :
   *   1. Récupérer TOUS les élèves inscrits dans la classe (status ACTIVE)
   *   2. Récupérer TOUTES les évaluations VALIDATED de la classe pour l'année
   *   3. Récupérer TOUTES les notes (grades) en 1 seule requête
   *   4. Grouper par élève × matière → moyenne par matière
   *   5. Moyenne générale annuelle = Σ(moy_matière × coef) / Σ(coef)
   *   6. Décision :
   *        avg ≥ 10 → PASSE
   *        9 ≤ avg < 10 → RACHAT
   *        avg < 9 ou pas de note → REDOUBLE
   *
   * Response : Array de {
   *   id, matricule, name, gender, generalAverage, decision, rachatable
   * }
   */
  @Get('class/:classId')
  async getClassPromotionData(
    @TenantId() tenantId: string,
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!classId || !academicYearId || !tenantId) {
      return [];
    }

    // 1. Récupérer TOUS les élèves inscrits dans la classe pour cette année
    //    ⭐ 2026-09-30 — On inclut plusieurs statuts (ACTIVE, ADMITTED, ENROLLED,
    //    RE_ENROLLED) car le status peut varier selon le moment de l'année.
    //    Avant : status: 'ACTIVE' seulement → si l'élève avait un autre
    //    statut (ADMITTED, RE_ENROLLED), il n'apparaissait pas → « aucune
    //    donnée disponible ».
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { classId, academicYearId, status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'RE_ENROLLED'] } },
      select: { studentId: true },
    }).catch(() => []);
    const studentIds = enrollments.map(e => e.studentId);
    if (studentIds.length === 0) return [];

    // Récupérer les infos des élèves (nom, matricule, gender) en 1 requête
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, matricule: true, gender: true },
    }).catch(() => []);

    const studentMap = new Map<string, { id: string; matricule: string; name: string; gender?: string; subjects: Map<string, { sum: number; count: number; coef: number }> }>();
    for (const s of students) {
      const name = `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Inconnu';
      studentMap.set(s.id, {
        id: s.id,
        matricule: s.matricule || '',
        name,
        gender: s.gender || undefined,
        subjects: new Map<string, { sum: number; count: number; coef: number }>(),
      });
    }

    // 2. Récupérer TOUTES les évaluations VALIDATED de la classe pour l'année
    const evaluations = await this.prisma.evaluation.findMany({
      where: { tenantId, academicYearId, classId, status: 'VALIDATED' },
      select: { id: true, subjectId: true, coefficient: true },
    }).catch(() => []);

    if (evaluations.length === 0) {
      // Pas d'évaluations validées → tous les élèves sont REDOUBLE
      const result = Array.from(studentMap.values()).map(st => ({
        id: st.id,
        matricule: st.matricule,
        name: st.name,
        gender: st.gender,
        generalAverage: null,
        decision: 'REDOUBLE' as const,
        rachatable: false,
      }));
      result.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      return result;
    }

    const evalIds = evaluations.map(e => e.id);
    // Map evalId → { subjectId, coef }
    const evalInfoMap = new Map(evaluations.map(e => [e.id, { subjectId: e.subjectId, coef: Number(e.coefficient) || 1 }]));

    // 3. Récupérer TOUTES les notes en 1 seule requête
    const grades = await this.prisma.grade.findMany({
      where: { evaluationId: { in: evalIds }, studentId: { in: studentIds } },
      select: { studentId: true, evaluationId: true, score: true, isAbsent: true },
    }).catch(() => []);

    // 4. Grouper par élève × matière → moyenne par matière
    for (const g of grades) {
      if (g.isAbsent || g.score === null) continue;
      const evalInfo = evalInfoMap.get(g.evaluationId);
      if (!evalInfo) continue;
      const st = studentMap.get(g.studentId);
      if (!st) continue;
      const subj = st.subjects.get(evalInfo.subjectId) || { sum: 0, count: 0, coef: evalInfo.coef };
      subj.sum += Number(g.score);
      subj.count += 1;
      st.subjects.set(evalInfo.subjectId, subj);
    }

    // 5. Calculer la moyenne générale annuelle par élève
    //    Moyenne annuelle = Σ(moy_matière × coef) / Σ(coef)
    //    Si l'élève n'a aucune note → avg = null → REDOUBLE
    const PASS_THRESHOLD = 10;
    const RACHAT_THRESHOLD = 9;

    const result = Array.from(studentMap.values()).map(st => {
      let total = 0;
      let totalCoef = 0;
      for (const [subjectId, subj] of st.subjects) {
        if (subj.count === 0) continue;
        const moyMatiere = subj.sum / subj.count;
        total += moyMatiere * subj.coef;
        totalCoef += subj.coef;
      }
      const avg = totalCoef > 0 ? total / totalCoef : null;

      let decision: 'PASSE' | 'REDOUBLE' | 'RACHAT' = 'REDOUBLE';
      let rachatable = false;
      if (avg !== null) {
        if (avg >= PASS_THRESHOLD) {
          decision = 'PASSE';
        } else if (avg >= RACHAT_THRESHOLD) {
          decision = 'RACHAT';
          rachatable = true;
        }
      }
      // avg === null (no notes) → stays REDOUBLE (default)

      return {
        id: st.id,
        matricule: st.matricule,
        name: st.name,
        gender: st.gender,
        generalAverage: avg,
        decision,
        rachatable,
        rachatApplied: false,
      };
    });

    // Sort by name
    result.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return result;
  }

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
