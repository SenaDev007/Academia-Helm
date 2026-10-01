/**
 * FederisArchiveService — Module Archives (Academia Federis)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ ARCHIVAGE DE FIN D'ANNÉE (2026-10-01 — demande promoteur) :
 *
 * « À la fin de l'année, tous ces modules doivent être archivés dans un grand
 *  module Archive, un dossier par année. Lorsqu'on rentre dans le dossier de
 *  l'année précédente (ex. 2025-2026), on voit module par module toutes les
 *  informations : écoles rattachées, matières, examens nationaux, centres et
 *  salles, candidats, épreuves et documents, notes et moyennes, délibération
 *  et relevés, rapports statistiques. Et l'année courante ne présente que les
 *  données de l'année courante, pas de mélange. »
 *
 * Les données Fédéris étant toutes reliées à une année scolaire
 * (academicYearId), l'archive est une vue LECTURE SEULE organisée par année :
 *   - GET /federis/archives          → dossiers d'années (compteurs par module)
 *   - GET /federis/archives/:yearId  → détail module par module de l'année
 *
 * ⭐ AGRÉGATION NATIONALE : le patronat national consulte l'archive de TOUT
 *    son réseau (lui-même + tous les départements) — même périmètre que les
 *    modules actifs. Un patronat départemental ne voit que son année.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FederisScopeService, type FederisScope } from './federis-scope.service';

/** Résumé des compteurs d'une année (affiché sur le dossier). */
interface YearCounts {
  exams: number;
  candidates: number;
  centers: number;
  subjects: number;
  papers: number;
  schools: number;
}

@Injectable()
export class FederisArchiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: FederisScopeService,
  ) {}

  /** Années du périmètre portant ce LIBELLÉ (une ligne par tenant). */
  private async yearIdsByLabel(scope: FederisScope, label: string): Promise<string[]> {
    const rows = await this.prisma.academicYear.findMany({
      where: { tenantId: { in: scope.scopeTenantIds }, label },
      select: { id: true },
    });
    return rows.map((r: any) => r.id);
  }

  /** Compteurs agrégés du périmètre pour un ensemble d'années. */
  private async countsFor(scope: FederisScope, yearIds: string[]): Promise<YearCounts> {
    if (yearIds.length === 0) {
      return { exams: 0, candidates: 0, centers: 0, subjects: 0, papers: 0, schools: 0 };
    }
    const [exams, candidates, centers, subjects, papers, schools] = await Promise.all([
      this.prisma.nationalExam.count({
        where: { patronatId: { in: scope.scopePatronatIds }, academicYearId: { in: yearIds } },
      }),
      this.prisma.examCandidate.count({
        where: { tenantId: { in: scope.scopeTenantIds }, academicYearId: { in: yearIds } },
      }),
      this.prisma.examCenter.count({
        where: { tenantId: { in: scope.scopeTenantIds }, academicYearId: { in: yearIds } },
      }),
      this.prisma.federisSubject.count({
        where: { tenantId: { in: scope.scopeTenantIds }, academicYearId: { in: yearIds } },
      }),
      this.prisma.federisExamPaper.count({
        where: { patronatId: { in: scope.scopePatronatIds }, academicYearId: { in: yearIds } },
      }),
      this.prisma.patronatSchool.count({
        where: { patronatId: { in: scope.scopePatronatIds }, academicYearId: { in: yearIds } },
      }),
    ]);
    return { exams, candidates, centers, subjects, papers, schools };
  }

  /**
   * Dossiers d'années : toutes les années scolaires du périmètre qui portent
   * des données Fédéris (au moins un examen, candidat ou épreuve), de la plus
   * récente à la plus ancienne. L'année ACTIVE est signalée « Année courante »
   * — les modules actifs n'affichent, eux, QUE cette année (aucun mélange).
   */
  async listYears(tenantId: string, userId?: string) {
    const scope = await this.scopeService.resolveScope(tenantId, userId);

    const referenceYears = await this.prisma.academicYear.findMany({
      where: { tenantId: scope.patronat.tenantId },
      orderBy: { startDate: 'desc' },
      select: { id: true, label: true, name: true, startDate: true, endDate: true, isActive: true },
    });

    const activeYear = referenceYears.find((y: any) => y.isActive) ?? null;

    const years = [];
    for (const year of referenceYears) {
      const yearIds = await this.yearIdsByLabel(scope, year.label);
      const counts = await this.countsFor(scope, yearIds);
      const hasData =
        counts.exams > 0 || counts.candidates > 0 || counts.papers > 0 || counts.subjects > 0;
      if (!hasData) continue;
      years.push({
        id: year.id,
        label: year.label,
        name: year.name,
        startDate: year.startDate,
        endDate: year.endDate,
        isCurrent: !!activeYear && year.id === activeYear.id,
        counts,
      });
    }

    return {
      currentYear: activeYear ? { id: activeYear.id, label: activeYear.label } : null,
      isNational: scope.isNational,
      years,
    };
  }

  /**
   * Détail d'une année : vue MODULE PAR MODULE (lecture seule) — écoles
   * rattachées, matières, examens nationaux (avec centres/candidats/
   * délibération), épreuves et documents, notes et moyennes, surveillance.
   * Les téléchargements réutilisent les exports existants (Excel candidats /
   * centres / surveillants, PV et statistiques PDF) par examen.
   */
  async getYearDetail(tenantId: string, userId: string, yearId: string) {
    const scope = await this.scopeService.resolveScope(tenantId, userId);

    const reference = await this.prisma.academicYear.findFirst({
      where: { id: yearId, tenantId: { in: scope.scopeTenantIds } },
    });
    if (!reference) {
      throw new NotFoundException('Année scolaire introuvable dans votre périmètre.');
    }

    const yearIds = await this.yearIdsByLabel(scope, reference.label);
    const counts = await this.countsFor(scope, yearIds);
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { tenantId: scope.patronat.tenantId, isActive: true },
    });

    // ── Examens nationaux (avec département propriétaire + délibération) ──
    const exams = await this.prisma.nationalExam.findMany({
      where: { patronatId: { in: scope.scopePatronatIds }, academicYearId: { in: yearIds } },
      include: {
        patronat: { select: { id: true, name: true, territoryName: true } },
        _count: { select: { centers: true, candidates: true, subjects: true, results: true } },
      },
      orderBy: { startDate: 'asc' },
    });
    const examIds = exams.map((e: any) => e.id);

    const [deliberations, supervisors, subjects, papers, schools, resultsCount] =
      await Promise.all([
        examIds.length
          ? this.prisma.examDeliberation.findMany({
              where: { examId: { in: examIds } },
              orderBy: { deliberatedAt: 'desc' },
            })
          : Promise.resolve([]),
        examIds.length
          ? this.prisma.examSupervisor.count({ where: { examId: { in: examIds } } })
          : Promise.resolve(0),
        this.prisma.federisSubject.findMany({
          where: { tenantId: { in: scope.scopeTenantIds }, academicYearId: { in: yearIds } },
          select: { id: true, name: true, code: true, examType: true, series: true, coefficient: true },
          orderBy: [{ examType: 'asc' }, { series: 'asc' }, { name: 'asc' }],
        }),
        this.prisma.federisExamPaper.findMany({
          where: { patronatId: { in: scope.scopePatronatIds }, academicYearId: { in: yearIds } },
          select: {
            id: true,
            title: true,
            subject: true,
            examCategory: true,
            status: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        }),
        this.prisma.patronatSchool.findMany({
          where: { patronatId: { in: scope.scopePatronatIds }, academicYearId: { in: yearIds } },
          include: {
            schoolTenant: { select: { id: true, name: true } },
            patronat: { select: { name: true, territoryName: true } },
            _count: { select: { candidates: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        examIds.length
          ? this.prisma.examResult.count({ where: { examId: { in: examIds } } })
          : Promise.resolve(0),
      ]);

    // Délibération la plus récente par examen
    const deliberationByExam = new Map<string, any>();
    for (const d of deliberations as any[]) {
      if (!deliberationByExam.has(d.examId)) deliberationByExam.set(d.examId, d);
    }

    return {
      year: {
        id: reference.id,
        label: reference.label,
        name: reference.name,
        startDate: reference.startDate,
        endDate: reference.endDate,
        isCurrent: !!activeYear && activeYear.id === reference.id,
      },
      isNational: scope.isNational,
      counts: { ...counts, supervisors, results: resultsCount },
      exams: exams.map((e: any) => {
        const d = deliberationByExam.get(e.id);
        return {
          id: e.id,
          code: e.code,
          name: e.name,
          examType: e.examType,
          status: e.status,
          startDate: e.startDate,
          endDate: e.endDate,
          department: e.patronat
            ? { name: e.patronat.name, territoryName: e.patronat.territoryName }
            : null,
          centersCount: e._count.centers,
          candidatesCount: e._count.candidates,
          subjectsCount: e._count.subjects,
          resultsCount: e._count.results,
          deliberation: d
            ? {
                status: d.status,
                deliberatedAt: d.deliberatedAt,
                passedCount: d.passedCount,
                failedCount: d.failedCount,
                successRate: d.successRate,
              }
            : null,
        };
      }),
      subjects: subjects.map((s: any) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        examType: s.examType,
        series: s.series,
        coefficient: s.coefficient,
      })),
      papers: papers.map((p: any) => ({
        id: p.id,
        title: p.title,
        subject: p.subject,
        examCategory: p.examCategory,
        status: p.status,
        updatedAt: p.updatedAt,
      })),
      schools: schools.map((s: any) => ({
        id: s.id,
        name: s.schoolTenant?.name ?? 'École',
        status: s.status,
        department: s.patronat
          ? { name: s.patronat.name, territoryName: s.patronat.territoryName }
          : null,
        candidatesCount: s._count.candidates,
      })),
    };
  }
}
