/**
 * ============================================================================
 * DISTINCTIONS CONTROLLER — Tableau d'honneur (Academia Helm)
 * ============================================================================
 *
 * Endpoints :
 *   POST /api/institutional-exams/distinctions/generate-board
 *     Génère le tableau collectif pour une classe.
 *     Body: { classId, periodId, academicYearId, level }
 *     Response: PDF binaire
 *
 *   POST /api/institutional-exams/distinctions/generate-certificate
 *     Génère un certificat individuel pour un élève.
 *     Body: { studentId, studentName, classId, className, periodId, academicYearId, level, code }
 *     Response: PDF binaire
 * ============================================================================
 */

import {
  Controller, Post, Get, Body, Param, Query, UseGuards, Res, Headers, Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { Permissions } from '../../../auth/decorators/permissions.decorator';
import { Public } from '../../../auth/decorators/public.decorator';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { PuppeteerPoolService } from '../../../common/services/puppeteer-pool.service';
// ⭐ 2026-11-13 — Identité secondaire : helper partagé (écoles combinées).
import { resolveLevelIdentityOverlay, applyLevelIdentityOverlay } from '../../../common/context/resolve-level-identity';
import { buildBoardHtml, buildCertificateHtml } from './html-builder';
import { resolveDistinction, makeVerificationCode, verificationUrl, THEMES, themeFor } from './html-builder';
import type { BoardInput, BoardRow, DistinctionCode, DistinctionInput, Level, Lang } from './html-builder';
import { DistinctionsNotificationService } from './distinctions-notification.service';

/** ⭐ 2026-10-05 — Bilingue FR/EN pour le générateur de distinctions. */
type Lang = 'FR' | 'EN';

/**
 * ⭐ Controller public pour la vérification des QR codes (sans JWT — accessible à tout parent
 * qui scanne le QR code d'un certificat). Déclaré séparément pour ne PAS appliquer
 * JwtAuthGuard + PermissionsGuard qui sont appliqués au DistinctionsController principal.
 *
 * @Public() désactive le JwtAuthGuard GLOBAL (APP_GUARD) pour cette route afin que
 * n'importe qui (sans token JWT) puisse vérifier un QR code.
 */
@Controller('public/distinctions')
export class PublicDistinctionsController {
  private readonly logger = new Logger(PublicDistinctionsController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/public/distinctions/verify/:code
   *    Vérifie publiquement un code QR de distinction et retourne les infos
   *    de l'émission (élève, distinction, période, école, statut).
   *    Pas d'authentification — c'est un endpoint public de vérification.
   */
  @Public()
  @Get('verify/:code')
  async verifyDistinction(@Param('code') code: string, @Res() res: Response) {
    if (!code || code.length < 10) {
      return res.status(400).json({ valid: false, error: 'Code invalide' });
    }

    try {
      const record = await this.prisma.distinctionRecord.findUnique({
        where: { verificationCode: code },
        include: {
          student: { select: { firstName: true, lastName: true, matricule: true } },
          academicYear: { select: { label: true } },
          class: { select: { name: true } },
          tenant: { select: { name: true } },
        },
      }).catch(() => null);

      if (!record) {
        return res.json({
          valid: false,
          error: 'Code de vérification introuvable',
          code,
        });
      }

      if (record.status === 'REVOKED') {
        return res.json({
          valid: false,
          error: 'Ce certificat a été révoqué',
          code,
          revokedAt: record.updatedAt,
        });
      }

      const studentName = `${record.student.firstName || ''} ${record.student.lastName || ''}`.trim();
      const theme = THEMES[record.code as DistinctionCode];

      return res.json({
        valid: true,
        code: record.verificationCode,
        nonce: record.nonce,
        status: record.status,
        issuedOn: record.issuedOn,
        student: {
          name: studentName,
          matricule: record.student.matricule || null,
          className: record.class?.name || null,
        },
        distinction: {
          code: record.code,
          label: record.label,
          title: theme?.title || record.label,
          subtitle: theme?.subtitle || null,
          category: record.category,
        },
        period: {
          academicYear: record.academicYear?.label || null,
        },
        results: record.average != null ? {
          average: record.average,
          base: record.base,
          rank: record.rank,
          classSize: record.classSize,
        } : null,
        school: {
          name: record.tenant?.name || 'Établissement',
        },
        documentType: record.documentType,
        issuedAt: record.createdAt,
        verifiedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.error('Erreur verifyDistinction:', err);
      return res.status(500).json({ valid: false, error: 'Erreur serveur' });
    }
  }
}

@Controller('institutional-exams/distinctions')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class DistinctionsController {
  private readonly logger = new Logger(DistinctionsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly notificationService: DistinctionsNotificationService,
  ) {}

  private mapLevel(scopeLevel: string): Level {
    const l = (scopeLevel || '').toUpperCase().trim();
    if (l === 'MATERNELLE' || l === 'MAT' || l === 'NURSERY') return 'maternel';
    if (l === 'SECONDAIRE' || l === 'SEC') return 'secondaire';
    return 'primaire';
  }

  private async getTenantBranding(tenantId: string) {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: { schoolName: true, logoUrl: true, address: true },
      });
      if (profile?.schoolName) {
        const apiBaseUrl = 'https://api.academiahelm.com';
        return {
          name: profile.schoolName,
          logoUrl: profile.logoUrl ? `${apiBaseUrl}/api/tenants/${tenantId}/logo` : undefined,
          city: profile.address || undefined,
        };
      }
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
      return { name: tenant?.name || 'Établissement' };
    } catch {
      return { name: 'Établissement' };
    }
  }

  // ─── Helper : identité du niveau SECONDAIRE (écoles combinées) ────────────
  //    ⭐ 2026-11-13 — Identité secondaire : le secondaire d'une école combinée
  //    peut porter un nom/logo/contacts DIFFÉRENTS
  //    (tenant_level_identity_profiles). Overlay via le helper commun
  //    (cache 60 s) mappé vers les champs lus par le html-builder
  //    (name/logoUrl/city) ; maternelle/primaire ou sans identité
  //    secondaire configurée ⇒ branding global inchangé.
  private async applySecondaryIdentity(tenantId: string, branding: any, isSecondary: boolean) {
    if (!isSecondary) return branding;
    const overlay = await resolveLevelIdentityOverlay(this.prisma, tenantId, { isSecondary: true });
    if (!overlay) return branding;
    const merged: any = applyLevelIdentityOverlay(branding, overlay);
    return {
      ...merged,
      name: overlay.schoolName || branding.name,
      logoUrl: overlay.logoUrl || branding.logoUrl,
      city: overlay.address || overlay.city || branding.city,
    };
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 150));
      const pdfBuffer = await page.pdf({
        preferCSSPageSize: true,
        printBackground: true,
        timeout: 60000,
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /**
   * Récupère les moyennes d'une classe pour une période
   * ⭐ 2026-10-05 — Pour la piste anglophone (lang='EN'), la moyenne est déjà
   *    stockée sur /100 dans la base (1st CA /20 + 2nd CA /20 + Exam /60 = /100).
   *    Pour la piste francophone (lang='FR'), la moyenne est sur /20.
   *    On retourne la moyenne BRUTE (pas de normalisation), et le caller décide
   *    de la base à utiliser selon lang.
   * ⭐ 2026-10-06 — OPTIMISATION 504 : paralléliser les requêtes Prisma
   *    indépendantes pour réduire le temps de réponse. Avant : 4 requêtes
   *    séquentielles → ~4-8s sur Neon cold start → 504 sur Railway (gateway
   *    timeout 30s) quand combiné avec le rendu PDF Puppeteer. Désormais :
   *    2 vagues parallèles (enrollments+classStudents, puis students+evaluations).
   */
  private async getClassAverages(
    tenantId: string,
    classId: string,
    periodId: string,
    academicYearId: string,
    lang: Lang = 'FR',
  ) {
    // ⭐ 2026-10-05 — Pour la piste anglophone, on récupère les moyennes /100
    //    directement depuis le bulletin anglophone (Report Card) plutôt que
    //    depuis les grades /20. On utilise le même calcul que pour les
    //    bulletins : 1st CA + 2nd CA + Exam = /100 par matière, puis moyenne
    //    arithmétique des matières.
    if (lang === 'EN') {
      // ⭐ Vague 1 (parallèle) : récupérer les élèves de la classe via les 2
      //    relations possibles (StudentEnrollment pour FR, ClassStudent pour EN).
      //    On utilise l'UNION des 2 listes de studentIds pour couvrir tous les
      //    cas (élèves liés via enrollment OU class_students).
      const [enrollments, classStudents] = await Promise.all([
        this.prisma.studentEnrollment.findMany({
          where: { classId, academicYearId, status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'RE_ENROLLED', 'PROMOTED', 'PRE_REGISTERED'] } },
          select: { studentId: true },
        }).catch(() => []),
        this.prisma.classStudent.findMany({
          where: { classId, academicYearId, tenantId, status: 'ACTIVE' },
          select: { studentId: true },
        }).catch(() => []),
      ]);

      // Union des studentIds (sans doublons)
      const studentIdSet = new Set<string>();
      for (const e of enrollments) studentIdSet.add(e.studentId);
      for (const cs of classStudents) studentIdSet.add(cs.studentId);
      const studentIds = Array.from(studentIdSet);
      if (studentIds.length === 0) return [];

      // ⭐ Vague 2 (parallèle) : students + evaluations (les 2 ne dépendent
      //    que de studentIds / classId, pas l'une de l'autre).
      const [students, evaluations] = await Promise.all([
        this.prisma.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, firstName: true, lastName: true, matricule: true },
        }).catch(() => []),
        this.prisma.evaluation.findMany({
          where: { tenantId, academicYearId, classId, status: 'VALIDATED', periodId },
          select: {
            id: true, subjectId: true, coefficient: true,
            evaluationType: { select: { code: true } },
          },
        }).catch(() => []),
      ]);

      // ⭐ Mapper evalId → { subjectId, component: 'FCA'|'SCA'|'EXAM' } via le
      //    code du type d'évaluation (FCA/FIRST_CA, SCA/SECOND_CA, EXAM/EXAMINATION).
      const enComponentForCode = (code: string): 'FCA' | 'SCA' | 'EXAM' | null => {
        const c = (code || '').toUpperCase();
        if (c === 'FCA' || c === 'FIRST_CA') return 'FCA';
        if (c === 'SCA' || c === 'SECOND_CA') return 'SCA';
        if (c === 'EXAM' || c === 'EXAMINATION') return 'EXAM';
        return null;
      };

      const evalInfoMap = new Map<string, { subjectId: string; component: 'FCA' | 'SCA' | 'EXAM' }>();
      for (const ev of evaluations) {
        const comp = enComponentForCode(ev.evaluationType?.code || '');
        if (comp) {
          evalInfoMap.set(ev.id, { subjectId: ev.subjectId, component: comp });
        }
      }

      const evalIds = Array.from(evalInfoMap.keys());
      if (evalIds.length === 0) return [];

      // ⭐ Vague 3 : grades (dépend de evalIds + studentIds).
      const grades = await this.prisma.grade.findMany({
        where: { evaluationId: { in: evalIds }, studentId: { in: studentIds } },
        select: { studentId: true, evaluationId: true, score: true, isAbsent: true },
      }).catch(() => []);

      // ⭐ Pour chaque élève, on construit une map par matière :
      //    subjectId → { fca: number|null, sca: number|null, exam: number|null }
      //    puis total/100 = fca + sca + exam (sur /100) par matière.
      //    La moyenne de l'élève sur /100 = moyenne des totaux/100 de chaque matière.
      type SubjectScore = { fca: number | null; sca: number | null; exam: number | null };
      const studentMap = new Map<string, { id: string; name: string; subjects: Map<string, SubjectScore> }>();
      for (const s of students) {
        studentMap.set(s.id, {
          id: s.id,
          name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Inconnu',
          subjects: new Map<string, SubjectScore>(),
        });
      }

      for (const g of grades) {
        if (g.isAbsent) continue;
        const scoreNum = g.score !== null ? Number(g.score) : null;
        if (scoreNum === null) continue;
        const evalInfo = evalInfoMap.get(g.evaluationId);
        if (!evalInfo) continue;
        const st = studentMap.get(g.studentId);
        if (!st) continue;
        const subj = st.subjects.get(evalInfo.subjectId) || { fca: null, sca: null, exam: null };
        // ⭐ On prend la première note trouvée pour chaque composante (FCA, SCA, EXAM).
        //    Si plusieurs évaluations ont le même code pour la même matière, on garde la première.
        if (subj[evalInfo.component] === null) {
          subj[evalInfo.component] = scoreNum;
        }
        st.subjects.set(evalInfo.subjectId, subj);
      }

      // ⭐ Calculer la moyenne /100 par élève : moyenne des totaux/100 de chaque matière.
      const result = Array.from(studentMap.values()).map(st => {
        let sumTotals = 0;
        let countSubjects = 0;
        for (const [, subj] of st.subjects) {
          // ⭐ Ne compter que les matières qui ont AU MOINS UNE composante.
          //    Si l'élève n'a que FCA + SCA (pas d'EXAM), on calcule quand même
          //    le total /100 = FCA + SCA + 0 (EXAM manquant = 0).
          //    Si l'élève n'a aucune composante, on saute la matière.
          const fca = subj.fca ?? 0;
          const sca = subj.sca ?? 0;
          const exam = subj.exam ?? 0;
          // ⭐ Si l'élève n'a AUCUNE note pour cette matière (les 3 à null), on saute.
          if (subj.fca === null && subj.sca === null && subj.exam === null) continue;
          // ⭐ Total /100 = FCA (/20) + SCA (/20) + EXAM (/60) = /100
          const total100 = fca + sca + exam;
          sumTotals += total100;
          countSubjects++;
        }
        const avg = countSubjects > 0 ? sumTotals / countSubjects : null;
        return { ...st, average: avg };
      }).filter(st => st.average !== null)
        .sort((a, b) => (b.average as number) - (a.average as number));

      return result;
    }

    // ─── Piste francophone (comportement d'origine) ─────────────────────────
    // ⭐ 2026-10-06 — Vague 1 parallèle : enrollments + classStudents (au cas
    //    où des élèves FR seraient aussi liés via class_students).
    const [enrollments, classStudents] = await Promise.all([
      this.prisma.studentEnrollment.findMany({
        where: { classId, academicYearId, status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'RE_ENROLLED', 'PROMOTED', 'PRE_REGISTERED'] } },
        select: { studentId: true },
      }).catch(() => []),
      this.prisma.classStudent.findMany({
        where: { classId, academicYearId, tenantId, status: 'ACTIVE' },
        select: { studentId: true },
      }).catch(() => []),
    ]);

    const studentIdSet = new Set<string>();
    for (const e of enrollments) studentIdSet.add(e.studentId);
    for (const cs of classStudents) studentIdSet.add(cs.studentId);
    const studentIds = Array.from(studentIdSet);
    if (studentIds.length === 0) return [];

    // ⭐ Vague 2 parallèle : students + evaluations
    const [students, evaluations] = await Promise.all([
      this.prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, firstName: true, lastName: true, matricule: true },
      }).catch(() => []),
      this.prisma.evaluation.findMany({
        where: { tenantId, academicYearId, classId, status: 'VALIDATED', periodId },
        select: { id: true, subjectId: true, coefficient: true },
      }).catch(() => []),
    ]);

    const evalIds = evaluations.map(e => e.id);
    const evalInfoMap = new Map(evaluations.map(e => [e.id, { subjectId: e.subjectId, coef: Number(e.coefficient) || 1 }]));

    // ⭐ Vague 3 : grades
    const grades = await this.prisma.grade.findMany({
      where: { evaluationId: { in: evalIds }, studentId: { in: studentIds } },
      select: { studentId: true, evaluationId: true, score: true, isAbsent: true, qualitativeCode: true },
    }).catch(() => []);

    const studentMap = new Map<string, { id: string; name: string; subjects: Map<string, { sum: number; count: number; coef: number }> }>();
    for (const s of students) {
      studentMap.set(s.id, {
        id: s.id,
        name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Inconnu',
        subjects: new Map<string, { sum: number; count: number; coef: number }>(),
      });
    }

    for (const g of grades) {
      if (g.isAbsent) continue;
      let scoreNum: number | null = null;
      if (g.score !== null) scoreNum = Number(g.score);
      else if (g.qualitativeCode) {
        const code = String(g.qualitativeCode).toUpperCase();
        if (code === 'TS') scoreNum = 3;
        else if (code === 'S') scoreNum = 2;
        else if (code === 'PS') scoreNum = 1;
      }
      if (scoreNum === null) continue;
      const evalInfo = evalInfoMap.get(g.evaluationId);
      if (!evalInfo) continue;
      const st = studentMap.get(g.studentId);
      if (!st) continue;
      const subj = st.subjects.get(evalInfo.subjectId) || { sum: 0, count: 0, coef: evalInfo.coef };
      subj.sum += scoreNum;
      subj.count += 1;
      st.subjects.set(evalInfo.subjectId, subj);
    }

    const result = Array.from(studentMap.values()).map(st => {
      let total = 0, totalCoef = 0;
      for (const [, subj] of st.subjects) {
        if (subj.count === 0) continue;
        const moyMatiere = subj.sum / subj.count;
        total += moyMatiere * subj.coef;
        totalCoef += subj.coef;
      }
      const avg = totalCoef > 0 ? total / totalCoef : null;
      return { ...st, average: avg };
    }).filter(st => st.average !== null)
      .sort((a, b) => (b.average as number) - (a.average as number));

    return result;
  }

  /**
   * POST /api/institutional-exams/distinctions/generate-board
   * Génère le tableau collectif en PDF
   * ⭐ 2026-10-05 — Accepte un champ `language: 'EN' | 'FR'` (défaut: 'FR')
   *    pour générer le PDF en anglais (piste anglophone). La base de notation
   *    devient /100 pour EN (au lieu de /20 pour FR), et tous les libellés du
   *    PDF (Tableau d'honneur → Honor Roll, Rang → Rank, Élève → Pupil,
   *    Moyenne → Average, Mention → Distinction) sont traduits.
   */
  @Post('generate-board')
  @Permissions('exams.read')
  async generateBoard(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || user?.tenant_id || headers?.['x-tenant-id'] || headers?.['X-Tenant-Id'];
    const { classId, periodId, academicYearId, level: bodyLevel, language } = body;
    if (!classId || !periodId || !academicYearId) {
      return res.status(400).json({ error: 'classId, periodId et academicYearId sont requis' });
    }
    const lang: Lang = language === 'EN' ? 'EN' : 'FR';

    const level = this.mapLevel(bodyLevel || 'PRIMAIRE');
    // ⭐ 2026-11-13 — Identité secondaire : overlay du secondaire (écoles
    //    combinées) appliqué au branding avant le html-builder.
    const branding = await this.applySecondaryIdentity(
      resolvedTenantId,
      await this.getTenantBranding(resolvedTenantId),
      level === 'secondaire',
    );

    try {
      const ranked = await this.getClassAverages(resolvedTenantId, classId, periodId, academicYearId, lang);
      if (ranked.length === 0) {
        return res.status(404).json({ error: lang === 'EN' ? 'No pupil with grades found' : 'Aucun élève avec des notes trouvé' });
      }

      // ⭐ Base : 3 pour maternelle, 100 pour piste anglophone, 20 sinon.
      const base = level === 'maternel' ? 3 : (lang === 'EN' ? 100 : 20);
      const boardRows: BoardRow[] = [];

      for (let i = 0; i < ranked.length; i++) {
        const st = ranked[i];
        const rank = i + 1;
        const avg = st.average as number;
        const code = resolveDistinction(level, avg, base);
        if (code) {
          boardRows.push({ rank, fullName: st.name, average: avg, code });
        }
      }

      if (boardRows.length === 0) {
        return res.status(404).json({ error: lang === 'EN' ? 'No distinction to display (averages below the first threshold)' : 'Aucune distinction à afficher (moyennes sous le premier palier)' });
      }

      // ⭐ 2026-10-06 — Paralléliser les 3 requêtes indépendantes (class,
      //    period, academicYear) pour réduire le temps de réponse.
      const [classRow, period, academicYear] = await Promise.all([
        this.prisma.class.findUnique({ where: { id: classId }, select: { name: true } }).catch(() => null),
        this.prisma.academicPeriod.findUnique({ where: { id: periodId }, select: { name: true } }).catch(() => null),
        this.prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { label: true } }).catch(() => null),
      ]);
      const className = classRow?.name || (lang === 'EN' ? 'Class' : 'Classe');

      // ⭐ Traduire le nom de la période pour la piste anglophone.
      const translateTermName = (raw: string): string => {
        if (!raw) return lang === 'EN' ? 'Term' : 'Trimestre';
        if (lang !== 'EN') return raw;
        const n = String(raw).toLowerCase().trim();
        if (n.includes('trimestre 1') || n.includes('1er trimestre') || n.includes('premier') || n === 't1' || n.includes('first')) return 'First Term';
        if (n.includes('trimestre 2') || n.includes('2ème trimestre') || n.includes('deuxième') || n === 't2' || n.includes('second')) return 'Second Term';
        if (n.includes('trimestre 3') || n.includes('3ème trimestre') || n.includes('troisième') || n === 't3' || n.includes('third')) return 'Third Term';
        return raw;
      };

      const boardInput: BoardInput = {
        level,
        lang,
        school: { name: branding.name, logoUrl: branding.logoUrl, city: branding.city },
        className,
        period: {
          label: translateTermName(period?.name || ''),
          schoolYear: academicYear?.label || '2025-2026',
          issuedOn: new Date().toISOString().slice(0, 10),
        },
        base,
        rows: boardRows,
      };

      const html = await buildBoardHtml(boardInput);
      const pdf = await this.htmlToPdf(html);

      const safeClass = className.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      const filename = lang === 'EN' ? `honor_roll_${safeClass}.pdf` : `tableau_honneur_${safeClass}.pdf`;
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdf.length,
      });
      res.end(pdf);
    } catch (err: any) {
      this.logger.error('Erreur génération tableau:', err);
      res.status(500).json({ error: err.message || 'Erreur lors de la génération' });
    }
  }

  /**
   * POST /api/institutional-exams/distinctions/generate-certificate
   * Génère un certificat individuel pour un élève
   * ⭐ 2026-10-05 — Accepte un champ `language: 'EN' | 'FR'` et `base: number`
   *    envoyés par le frontend. Pour la piste anglophone, le frontend calcule
   *    déjà la moyenne /100 (à partir des grades /20 renvoyés par
   *    /exams/promotion/class) et envoie base=100. On utilise directement
   *    cette moyenne/base au lieu de recalculer côté backend.
   */
  @Post('generate-certificate')
  @Permissions('exams.read')
  async generateCertificate(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || user?.tenant_id || headers?.['x-tenant-id'] || headers?.['X-Tenant-Id'];
    const { studentId, studentName, classId, className, periodId, academicYearId, level: bodyLevel, code: bodyCode, average, base: bodyBase, rank, classSize, language } = body;
    if (!studentId || !classId || !periodId || !academicYearId) {
      return res.status(400).json({ error: 'studentId, classId, periodId et academicYearId sont requis' });
    }
    const lang: Lang = language === 'EN' ? 'EN' : 'FR';

    const level = this.mapLevel(bodyLevel || 'PRIMAIRE');
    // ⭐ 2026-11-13 — Identité secondaire : overlay du secondaire (écoles
    //    combinées) appliqué au branding avant le html-builder.
    const branding = await this.applySecondaryIdentity(
      resolvedTenantId,
      await this.getTenantBranding(resolvedTenantId),
      level === 'secondaire',
    );

    try {
      // ⭐ Base de notation : priorité à celle envoyée par le frontend
      //    (100 pour EN, 20 pour FR), sinon fallback sur le niveau.
      const base = typeof bodyBase === 'number' && bodyBase > 0
        ? bodyBase
        : (level === 'maternel' ? 3 : (lang === 'EN' ? 100 : 20));
      const avg = typeof average === 'number' ? average : null;
      const code = bodyCode || (avg !== null ? resolveDistinction(level, avg, base) : null);

      if (!code) {
        return res.status(400).json({ error: lang === 'EN' ? 'No distinction for this pupil' : 'Aucune distinction pour cet élève' });
      }

      const secret = process.env.DISTINCTION_SECRET || 'academia-helm-dev-secret';
      const verifyBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://academia-helm.academiahelm.com';

      // ⭐ 2026-10-06 — Paralléliser period + academicYear.
      const [period, academicYear] = await Promise.all([
        this.prisma.academicPeriod.findUnique({ where: { id: periodId }, select: { name: true } }).catch(() => null),
        this.prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { label: true } }).catch(() => null),
      ]);

      // ⭐ Traduire le nom de la période pour la piste anglophone.
      const translateTermName = (raw: string): string => {
        if (!raw) return lang === 'EN' ? 'Term' : 'Trimestre';
        if (lang !== 'EN') return raw;
        const n = String(raw).toLowerCase().trim();
        if (n.includes('trimestre 1') || n.includes('1er trimestre') || n.includes('premier') || n === 't1' || n.includes('first')) return 'First Term';
        if (n.includes('trimestre 2') || n.includes('2ème trimestre') || n.includes('deuxième') || n === 't2' || n.includes('second')) return 'Second Term';
        if (n.includes('trimestre 3') || n.includes('3ème trimestre') || n.includes('troisième') || n === 't3' || n.includes('third')) return 'Third Term';
        return raw;
      };

      const vcode = makeVerificationCode(secret, {
        schoolId: resolvedTenantId || 'school',
        studentId,
        periodId,
        code,
        schoolYear: academicYear?.label || '2025-2026',
      });

      const input: DistinctionInput = {
        code,
        lang,
        school: { name: branding.name, logoUrl: branding.logoUrl, city: branding.city },
        student: { fullName: studentName || (lang === 'EN' ? 'Pupil' : 'Élève'), className: className || (lang === 'EN' ? 'Class' : 'Classe') },
        period: {
          label: translateTermName(period?.name || ''),
          schoolYear: academicYear?.label || '2025-2026',
          issuedOn: new Date().toISOString().slice(0, 10),
        },
        results: avg !== null ? { average: avg, base, rank: rank || undefined, classSize: classSize || undefined } : undefined,
        verification: { code: vcode, url: verificationUrl(verifyBaseUrl, vcode) },
      };

      const html = await buildCertificateHtml(input);
      const pdf = await this.htmlToPdf(html);

      const safeName = (studentName || (lang === 'EN' ? 'pupil' : 'eleve')).replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      const filename = lang === 'EN' ? `certificate_${safeName}.pdf` : `certificat_${safeName}.pdf`;
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdf.length,
      });
      res.end(pdf);
    } catch (err: any) {
      this.logger.error('Erreur génération certificat:', err);
      res.status(500).json({ error: err.message || 'Erreur lors de la génération' });
    }
  }

  /**
   * POST /api/institutional-exams/distinctions/send-certificate
   * Génère le certificat PDF + envoie par email + Helm Connect + bell icon au parent
   * Body: { studentId, studentName, classId, className, periodId, academicYearId, level, code, average, base, rank, classSize, distinctionLabel, language }
   * Response: { success, results: { email, helmConnect, bellIcon } }
   * ⭐ 2026-10-05 — Accepte `language` et `base` (comme generate-certificate).
   */
  @Post('send-certificate')
  @Permissions('exams.read')
  async sendCertificate(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || user?.tenant_id || headers?.['x-tenant-id'] || headers?.['X-Tenant-Id'];
    const { studentId, studentName, classId, className, periodId, academicYearId, level: bodyLevel, code: bodyCode, average, base: bodyBase, rank, classSize, distinctionLabel, language } = body;
    if (!studentId || !classId || !periodId || !academicYearId) {
      return res.status(400).json({ error: 'studentId, classId, periodId et academicYearId sont requis' });
    }
    const lang: Lang = language === 'EN' ? 'EN' : 'FR';

    const level = this.mapLevel(bodyLevel || 'PRIMAIRE');
    // ⭐ 2026-11-13 — Identité secondaire : overlay du secondaire (écoles
    //    combinées) appliqué au branding avant le html-builder.
    const branding = await this.applySecondaryIdentity(
      resolvedTenantId,
      await this.getTenantBranding(resolvedTenantId),
      level === 'secondaire',
    );

    try {
      const base = typeof bodyBase === 'number' && bodyBase > 0
        ? bodyBase
        : (level === 'maternel' ? 3 : (lang === 'EN' ? 100 : 20));
      const avg = typeof average === 'number' ? average : null;
      const code = bodyCode || (avg !== null ? resolveDistinction(level, avg, base) : null);

      if (!code) {
        return res.status(400).json({ error: lang === 'EN' ? 'No distinction for this pupil' : 'Aucune distinction pour cet élève' });
      }

      const theme = themeFor(code, lang);
      const label = distinctionLabel || theme?.shortLabel || (lang === 'EN' ? 'Distinction' : 'Distinction');

      const secret = process.env.DISTINCTION_SECRET || 'academia-helm-dev-secret';
      const verifyBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://academia-helm.academiahelm.com';

      // ⭐ 2026-10-06 — Paralléliser period + academicYear.
      const [period, academicYear] = await Promise.all([
        this.prisma.academicPeriod.findUnique({ where: { id: periodId }, select: { name: true } }).catch(() => null),
        this.prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { label: true } }).catch(() => null),
      ]);

      // ⭐ Traduire le nom de la période pour la piste anglophone.
      const translateTermName = (raw: string): string => {
        if (!raw) return lang === 'EN' ? 'Term' : 'Trimestre';
        if (lang !== 'EN') return raw;
        const n = String(raw).toLowerCase().trim();
        if (n.includes('trimestre 1') || n.includes('1er trimestre') || n.includes('premier') || n === 't1' || n.includes('first')) return 'First Term';
        if (n.includes('trimestre 2') || n.includes('2ème trimestre') || n.includes('deuxième') || n === 't2' || n.includes('second')) return 'Second Term';
        if (n.includes('trimestre 3') || n.includes('3ème trimestre') || n.includes('troisième') || n === 't3' || n.includes('third')) return 'Third Term';
        return raw;
      };

      const vcode = makeVerificationCode(secret, {
        schoolId: resolvedTenantId || 'school',
        studentId,
        periodId,
        code,
        schoolYear: academicYear?.label || '2025-2026',
      });

      const input: DistinctionInput = {
        code,
        lang,
        school: { name: branding.name, logoUrl: branding.logoUrl, city: branding.city },
        student: { fullName: studentName || (lang === 'EN' ? 'Pupil' : 'Élève'), className: className || (lang === 'EN' ? 'Class' : 'Classe') },
        period: {
          label: translateTermName(period?.name || ''),
          schoolYear: academicYear?.label || '2025-2026',
          issuedOn: new Date().toISOString().slice(0, 10),
        },
        results: avg !== null ? { average: avg, base, rank: rank || undefined, classSize: classSize || undefined } : undefined,
        verification: { code: vcode, url: verificationUrl(verifyBaseUrl, vcode) },
      };

      // Générer le PDF
      const html = await buildCertificateHtml(input);
      const pdfBuffer = await this.htmlToPdf(html);

      // Envoyer les notifications (email + Helm Connect + bell icon)
      const results = await this.notificationService.sendDistinctionNotification(
        resolvedTenantId,
        studentId,
        studentName || (lang === 'EN' ? 'Pupil' : 'Élève'),
        label,
        code,
        pdfBuffer,
        translateTermName(period?.name || ''),
        className || (lang === 'EN' ? 'Class' : 'Classe'),
        user?.id || 'system',
      );

      res.json({ success: true, results });
    } catch (err: any) {
      this.logger.error('Erreur envoi certificat:', err);
      res.status(500).json({ error: err.message || 'Erreur lors de l\'envoi' });
    }
  }
}
