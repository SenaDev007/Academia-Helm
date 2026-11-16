/**
 * ============================================================================
 * STUDENT DOSSIER SERVICE - DOSSIER SCOLAIRE NUMÉRIQUE ÉLÈVE
 * ============================================================================
 * 
 * Service pour gérer le dossier scolaire numérique complet de l'élève
 * Centralise toute la vie scolaire : parcours, résultats, discipline, documents
 * 
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';
import { StorageService } from '../../common/services/storage.service';
// ⭐ 1.0.18 — en-tête officiel par cycle (module Examen) : overlay d'identité
//    du secondaire quand l'élève est au secondaire (nom/contacts/logo différents).
import {
  resolveLevelIdentityOverlay,
  applyLevelIdentityOverlay,
} from '../../common/context/resolve-level-identity';
// ⭐ 1.0.18 — téléchargement EN BLOC : dossier PDF + documents joints dans une
//    seule archive (même utilitaire zéro-dépendance que le module Fédérés).
import { createZipArchive, type ZipEntryInput } from '../../federis/zip-writer';

/** Libellés FR des types de documents élèves (partagés PDF + bundle ZIP). */
const DOC_TYPE_LABELS: Record<string, string> = {
  BIRTH_CERTIFICATE: 'Acte de naissance', NPI_CARD: 'Carte NPI',
  SCHOOL_CERTIFICATE: 'Certificat de scolarité', PHOTO: "Photo d'identité",
  PREVIOUS_REPORT_CARD: 'Bulletin précédent', MEDICAL_RECORD: 'Fiche médicale',
  PARENTAL_AUTHORIZATION: 'Autorisation parentale',
  TRANSFER_CERTIFICATE: 'Certificat de transfert', OTHER: 'Autre document',
};

/** Ministères par cycle — mêmes libellés que le module Examen (Bulletins). */
const MINISTERE_MATERNELLE_PRIMAIRE = 'Ministère des Enseignements Maternel et Primaire';
const MINISTERE_SECONDAIRE =
  "Ministère de l'Enseignement Secondaire, de la Formation Technique et Professionnelle, de la Reconversion et de l'Insertion des Jeunes";

@Injectable()
export class StudentDossierService {
  private readonly logger = new Logger(StudentDossierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Récupère le dossier scolaire complet d'un élève
   */
  async getStudentDossier(
    tenantId: string,
    studentId: string,
    academicYearId?: string,
  ): Promise<any> {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId,
      },
      include: {
        identifier: true,
        // ⭐ 1.0.18 — niveau actuel de l'élève : détermine le CYCLE du dossier
        //    (en-tête officiel différent maternelle/primaire vs secondaire,
        //    comme le module Examen Bulletins).
        schoolLevel: { select: { id: true, code: true, name: true, label: true } },
        idCards: {
          where: academicYearId ? { academicYearId } : undefined,
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
        tenant: {
          include: {
            schools: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Élève non trouvé');
    }

    // Récupérer les enregistrements académiques
    const academicRecords = await this.prisma.studentAcademicRecord.findMany({
      where: {
        studentId,
        ...(academicYearId && { academicYearId }),
      },
      include: {
        academicYear: true,
        class: true,
        schoolLevel: true,
      },
      orderBy: {
        academicYear: {
          startDate: 'desc',
        },
      },
    });

    // Récupérer les résumés disciplinaires
    const disciplinarySummaries = await this.prisma.studentDisciplinarySummary.findMany({
      where: {
        studentId,
        ...(academicYearId && { academicYearId }),
      },
      include: {
        academicYear: true,
      },
      orderBy: {
        academicYear: {
          startDate: 'desc',
        },
      },
    });

    // Récupérer les documents
    const documents = await this.prisma.studentDocument.findMany({
      where: {
        studentId,
        ...(academicYearId && { academicYearId }),
      },
      include: {
        academicYear: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Récupérer les bulletins
    // ⭐ 1.0.10 FIX CRITIQUE : la relation `quarter` n'existe PLUS sur ReportCard
    //    (quarterId = ID générique academic_period/quarter, SANS FK) — l'ancien
    //    include `quarter: true` faisait échouer TOUTE la route
    //    GET /students/:id/dossier (et le PDF) avec un 400
    //    PrismaClientValidationError. Désormais : notes par matière incluses
    //    (items + subject) et nom de période résolu applicativement.
    const reportCards = await this.prisma.reportCard.findMany({
      where: {
        studentId,
        ...(academicYearId && { academicYearId }),
      },
      include: {
        academicYear: true,
        // ⭐ 1.0.16 — niveau (cycle) du bulletin : MATERNELLE qualitatif /
        // PRIMAIRE / SECONDAIRE quantitatif — la présentation de la section
        // « Résultats & bulletins » du dossier s'aligne sur le module Examen.
        schoolLevel: { select: { id: true, code: true, name: true, label: true } },
        items: {
          include: { subject: true },
          orderBy: { subject: { name: 'asc' } },
        },
      },
      orderBy: {
        academicYear: {
          startDate: 'desc',
        },
      },
    });

    // ⭐ 1.0.10 — résolution du NOM de période (AcademicPeriod ou Quarter)
    //    pour chaque bulletin (quarterId est un ID générique sans relation).
    const [academicPeriods, quarterNames] = await Promise.all([
      this.prisma.academicPeriod.findMany({
        where: { tenantId },
        select: { id: true, name: true, periodOrder: true },
      }),
      this.prisma.quarter.findMany({
        where: { tenantId },
        select: { id: true, name: true, number: true },
      }),
    ]);
    const periodByld = new Map<string, { name: string; order: number }>();
    for (const p of academicPeriods as any[])
      periodByld.set(p.id, { name: p.name, order: p.periodOrder ?? 0 });
    for (const q of quarterNames as any[])
      periodByld.set(q.id, { name: q.name, order: q.number ?? 0 });
    for (const rc of reportCards as any[]) {
      const p = rc.quarterId ? periodByld.get(rc.quarterId) : undefined;
      rc.periodName = p?.name || null;
      rc.periodOrder = p?.order ?? 0;
    }

    // ⭐ 1.0.16 (retour promoteur « Résultats & bulletins dynamiques par cycle ») :
    //    RÉSULTATS PAR CYCLE, alignés sur le module Examen —
    //    · maternelle (FR)  = évaluation QUALITATIVE (codes TS/S/PS/NS, pas de
    //      moyenne numérique ni de rang) ;
    //    · primaire         = évaluation quantitative /20, coefficient 1 ;
    //    · secondaire       = évaluation quantitative /20 AVEC coefficients
    //      (moyennes pondérées) — présentation différente du primaire.
    //    Les codes qualitatifs / appréciations par matière proviennent de
    //    StudentSubjectAverage (flux trimestres, periodId = Quarter) avec
    //    repli sur les notes élève (Grade.qualitativeCode / moyenne des
    //    scores, periodId direct OU evaluation.periodId = AcademicPeriod).
    const QUALI_ORDER = ['TS', 'S', 'PS', 'NS'] as const;
    const [subjectAverages, studentGrades] = await Promise.all([
      this.prisma.studentSubjectAverage.findMany({
        where: { studentId, tenantId },
        select: {
          periodId: true, subjectId: true,
          average: true, coefficient: true, appreciation: true,
        },
      }),
      this.prisma.grade.findMany({
        where: { studentId, tenantId },
        select: {
          subjectId: true, periodId: true, score: true,
          qualitativeCode: true, status: true, isAbsent: true,
          evaluation: { select: { periodId: true } },
        },
      }),
    ]);
    const ssaBy = new Map<string, any>();
    for (const ssa of subjectAverages as any[])
      ssaBy.set(`${ssa.periodId}|${ssa.subjectId}`, ssa);
    // Notes groupées par (période, matière) — période = Grade.periodId (Quarter)
    // OU evaluation.periodId (AcademicPeriod) : les deux espaces d'IDs coexistent.
    const gradesByPeriodSubject = new Map<string, any[]>();
    for (const g of studentGrades as any[]) {
      const periods = [g.periodId, g.evaluation?.periodId].filter(Boolean);
      for (const pid of periods) {
        const key = `${pid}|${g.subjectId}`;
        if (!gradesByPeriodSubject.has(key)) gradesByPeriodSubject.set(key, []);
        gradesByPeriodSubject.get(key)!.push(g);
      }
    }
    const majorityQualiCode = (codes: string[]): string | null => {
      const counts: Record<string, number> = {};
      for (const c of codes) counts[c] = (counts[c] || 0) + 1;
      const present = QUALI_ORDER.filter(c => counts[c] > 0);
      if (present.length === 0) return null;
      return present.sort(
        (a, b) => counts[b] - counts[a] || QUALI_ORDER.indexOf(a) - QUALI_ORDER.indexOf(b),
      )[0];
    };
    for (const rc of reportCards as any[]) {
      const levelCode = (rc.schoolLevel?.code || '').toUpperCase();
      const isEn = (rc.language || '').toUpperCase() === 'EN';
      // Nursery (anglophone) est quantitatif /100 — seule la maternelle FR est qualitative.
      rc.isQualitative = levelCode === 'MATERNELLE' && !isEn;
      const counts: Record<string, number> = { TS: 0, S: 0, PS: 0, NS: 0 };
      for (const it of rc.items || []) {
        const ssa = rc.quarterId
          ? ssaBy.get(`${rc.quarterId}|${it.subjectId}`)
          : undefined;
        const grades = rc.quarterId
          ? gradesByPeriodSubject.get(`${rc.quarterId}|${it.subjectId}`) || []
          : [];
        it.appreciation = ssa?.appreciation || null;
        if (rc.isQualitative) {
          // Code qualitatif : SSA.appreciation (flux trimestres) sinon code
          // majoritaire des notes (flux évaluations — comme bulletins.service).
          let code: string | null =
            ssa?.appreciation && (QUALI_ORDER as readonly string[]).includes(ssa.appreciation.toUpperCase())
              ? ssa.appreciation.toUpperCase()
              : null;
          if (!code) {
            code = majorityQualiCode(
              grades.map((g: any) => (g.qualitativeCode || '').toUpperCase()).filter(Boolean),
            );
          }
          it.qualitativeCode = code;
          if (code && counts[code] !== undefined) counts[code] += 1;
        }
      }
      if (rc.isQualitative) {
        rc.qualitativeCounts = counts;
        rc.qualitativeOverall = majorityQualiCode(
          QUALI_ORDER.filter(c => counts[c] > 0) as unknown as string[],
        );
      }
    }

    // Récupérer les absences
    // Absence n'a pas de relation academicYear directe ni academicYearId
    const absences = await this.prisma.absence.findMany({
      where: {
        studentId,
      },
      include: {
      },
      orderBy: {
        date: 'desc',
      },
      take: 50, // Limiter à 50 dernières
    });

    // Récupérer les incidents disciplinaires
    const disciplinaryActions = await this.prisma.disciplinaryAction.findMany({
      where: {
        studentId,
        ...(academicYearId && { academicYearId }),
      },
      include: {
        academicYear: true,
      },
      orderBy: {
        actionDate: 'desc', // actionDate au lieu de date
      },
      take: 50, // Limiter à 50 derniers
    });

    // Module 1 — Parents / tuteurs (identité & relations)
    const guardians = await this.prisma.studentGuardian.findMany({
      where: { studentId },
      include: {
        guardian: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            // ⭐ 1.0.10 — adresse du responsable (dossier complet + PDF)
            address: true,
          },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    // Récupérer le profil tarifaire pour l'année scolaire
    let feeProfile = null;
    if (academicYearId) {
      feeProfile = await this.prisma.studentFeeProfile.findUnique({
        where: {
          studentId_academicYearId: {
            studentId,
            academicYearId,
          },
        },
        include: {
          feeRegime: {
            include: {
              rules: true,
            },
          },
          validator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    }

    // ⭐ 1.0.10 (refonte « dossier numérique de l'élève » — demande promoteur) :
    // PARCOURS RÉEL année par année — toutes les inscriptions de l'élève dans
    // l'établissement (année, niveau, classe officielle + section physique,
    // statut, dates, matricule local, type nouveau/ancien).
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { studentId },
      include: {
        academicYear: true,
        schoolLevel: true,
        class: true,
        academicClass: true,
      },
      orderBy: { academicYear: { startDate: 'desc' } },
    });

    // ⭐ 1.0.10 — ÉCOLE D'ORIGINE : l'admission convertie en dossier élève
    // porte previousSchool / previousLevel / changeReason (cursus hors
    // établissement) —
    //    remontée ici pour tracer le parcours complet.
    const originatingAdmission = await this.prisma.admission.findFirst({
      where: { convertedStudentId: studentId, tenantId },
      select: {
        admissionNumber: true,
        applicationDate: true,
        previousSchool: true,
        previousLevel: true,
        changeReason: true,
        isNewStudent: true,
      },
    });

    // ⭐ 1.0.14 (retour promoteur « vraies données frais non récupérées ») :
    //    FRAIS & PAIEMENTS année par année — la source de vérité est le compte
    //    financier (student_accounts : totalDue/totalPaid/balance/arrears)
    //    avec le détail des lignes (account_breakdowns : initial vs ajusté =
    //    réduction réelle appliquée, payé, restant) et les transactions
    //    réelles (finance_transactions). AVANT, le front appelait
    //    GET /finance/student-accounts?studentId=… dont le service IGNORAIT le
    //    filtre studentId → il affichait le compte d'un AUTRE élève (le
    //    premier alphabétique du tenant) — d'où le « total dû 55 750 » sur un
    //    élève qui ne devait que ses frais d'inscription après réduction.
    const accounts = await this.prisma.studentAccount.findMany({
      where: { studentId, tenantId },
      include: {
        academicYear: true,
        breakdowns: {
          include: {
            feeStructure: {
              select: { id: true, name: true, feeType: true, totalAmount: true },
            },
          },
          orderBy: { feeStructure: { name: 'asc' } },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true, type: true, amount: true, paymentMethod: true,
            reference: true, createdAt: true,
          },
        },
      },
      orderBy: { academicYear: { startDate: 'desc' } },
    });

    // Profils tarifaires par année (régime appliqué — réduction/exonération)
    const feeProfiles = await this.prisma.studentFeeProfile.findMany({
      where: { studentId },
      include: {
        academicYear: { select: { id: true, name: true } },
        feeRegime: { select: { id: true, label: true, code: true } },
      },
    });
    const profileByYear = new Map(feeProfiles.map((p: any) => [p.academicYearId, p]));

    const n = (v: any): number => Number(v ?? 0);
    const financeByYear = accounts.map((a: any) => {
      const breakdowns = (a.breakdowns || []).map((b: any) => {
        const standard = n(b.feeStructure?.totalAmount);
        const applied = n(b.adjustedAmount ?? b.initialAmount);
        return {
          id: b.id,
          name: b.feeStructure?.name || 'Frais',
          feeType: b.feeStructure?.feeType || null,
          standardAmount: standard,
          appliedAmount: applied,
          // Réduction réelle = montant standard − montant appliqué (si > 0)
          reduction: Math.max(0, standard - applied),
          paidAmount: n(b.paidAmount),
          remainingAmount: n(b.remainingAmount),
        };
      });
      const reductionTotal = breakdowns.reduce(
        (s: number, b: any) => s + b.reduction, 0,
      );
      // ⭐ 1.0.16 (retour promoteur « traçabilité des frais ») — AVANT les
      //    totaux (dû/payé/arriérés/solde), tracer le barème : montants
      //    NORMALEMENT dus (standard), ventilation par nature (inscription /
      //    réinscription / scolarité / autres), réduction effective et son
      //    POURCENTAGE, net dû après réduction.
      const sumOf = (list: any[], f: (b: any) => number) => list.reduce((s: number, b: any) => s + f(b), 0);
      const ofTypes = (types: string[]) =>
        breakdowns.filter(b => types.includes((b.feeType || '').toUpperCase()));
      const standardTotal = sumOf(breakdowns, b => b.standardAmount);
      const netDue = sumOf(breakdowns, b => b.appliedAmount);
      const feeTotals = {
        inscription: {
          standard: sumOf(ofTypes(['INSCRIPTION']), b => b.standardAmount),
          applied: sumOf(ofTypes(['INSCRIPTION']), b => b.appliedAmount),
        },
        reinscription: {
          standard: sumOf(ofTypes(['REINSCRIPTION']), b => b.standardAmount),
          applied: sumOf(ofTypes(['REINSCRIPTION']), b => b.appliedAmount),
        },
        tuition: {
          standard: sumOf(ofTypes(['TUITION']), b => b.standardAmount),
          applied: sumOf(ofTypes(['TUITION']), b => b.appliedAmount),
        },
        other: {
          standard: sumOf(
            breakdowns.filter(b => !['INSCRIPTION', 'REINSCRIPTION', 'TUITION'].includes((b.feeType || '').toUpperCase())),
            b => b.standardAmount,
          ),
          applied: sumOf(
            breakdowns.filter(b => !['INSCRIPTION', 'REINSCRIPTION', 'TUITION'].includes((b.feeType || '').toUpperCase())),
            b => b.appliedAmount,
          ),
        },
      };
      const reductionPercent =
        standardTotal > 0
          ? Math.round((reductionTotal / standardTotal) * 1000) / 10
          : 0;
      const profile = profileByYear.get(a.academicYearId);
      return {
        academicYearId: a.academicYearId,
        academicYear: a.academicYear
          ? { id: a.academicYear.id, name: a.academicYear.name, label: a.academicYear.label }
          : null,
        account: {
          id: a.id,
          totalDue: n(a.totalDue),
          totalPaid: n(a.totalPaid),
          balance: n(a.balance),
          arrearsAmount: n(a.arrearsAmount),
          carriedArrears: n(a.carriedArrears),
          status: a.status,
        },
        reductionTotal,
        // ⭐ 1.0.16 — traçabilité du barème (montants normalement dus,
        // ventilation par nature, réduction effective en %, net dû)
        standardTotal,
        netDue,
        reductionPercent,
        hasReduction: reductionTotal > 0,
        feeTotals,
        regime: profile?.feeRegime
          ? { id: profile.feeRegime.id, label: profile.feeRegime.label, code: profile.feeRegime.code }
          : null,
        breakdowns,
        transactions: (a.transactions || []).map((t: any) => ({
          id: t.id, type: t.type, amount: n(t.amount),
          paymentMethod: t.paymentMethod, reference: t.reference, createdAt: t.createdAt,
        })),
      };
    });

    // ⭐ 1.0.14 — RÉCAPITULATIF GLOBAL sur TOUTES les années passées dans
    //    l'établissement : total dû, arriérés, total payé, solde restant.
    // ⭐ 1.0.16 — traçabilité globale du barème en tête du récapitulatif
    //    (barème normal cumulé, réductions cumulées et pourcentage global,
    //    net cumulé après réduction) AVANT les totaux dû/payé/arriérés/solde.
    const gStandardTotal = financeByYear.reduce((s: number, y: any) => s + y.standardTotal, 0);
    const gNetDue = financeByYear.reduce((s: number, y: any) => s + y.netDue, 0);
    const gReductionTotal = financeByYear.reduce((s: number, y: any) => s + y.reductionTotal, 0);
    const financeGlobal = {
      yearsCount: financeByYear.length,
      standardTotal: gStandardTotal,
      netDue: gNetDue,
      reductionTotal: gReductionTotal,
      reductionPercent:
        gStandardTotal > 0
          ? Math.round((gReductionTotal / gStandardTotal) * 1000) / 10
          : 0,
      hasReduction: gReductionTotal > 0,
      totalDue: financeByYear.reduce((s: number, y: any) => s + y.account.totalDue, 0),
      totalPaid: financeByYear.reduce((s: number, y: any) => s + y.account.totalPaid, 0),
      balance: financeByYear.reduce((s: number, y: any) => s + y.account.balance, 0),
      arrears: financeByYear.reduce((s: number, y: any) => s + y.account.arrearsAmount, 0),
    };

    // Module 1 — Identité légale complète (lieu de naissance, pièce, régime)
    // ⭐ 1.0.18 — IDENTITÉ D'ÉCOLE + MINISTÈRE PAR CYCLE (module Examen) :
    //    profil d'identité actif du tenant → repli fiche School ; overlay
    //    secondaire (tenant_level_identity_profiles) appliqué quand l'élève
    //    est au secondaire → en-tête officiel différent, comme les bulletins.
    const schoolBranding = await this.resolveSchoolBrandingForDossier(tenantId, student);
    return {
      identity: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        dateOfBirth: student.dateOfBirth,
        gender: student.gender,
        nationality: student.nationality,
        placeOfBirth: student.placeOfBirth ?? null,
        npi: student.npi ?? null,
        regimeType: student.regimeType ?? null,
        studentCode: student.studentCode ?? null,
        matricule: student.identifier?.globalMatricule || student.studentCode || null,
        status: student.status,
        address: student.address ?? null,
        photoUrl: student.photoUrl ?? null,
        institution: student.tenant.schools?.name || student.tenant.name,
      },
      academicRecords,
      disciplinarySummaries,
      documents,
      reportCards,
      recentAbsences: absences,
      recentDisciplinaryActions: disciplinaryActions,
      currentIdCard: student.idCards?.[0] || null,
      feeProfile,
      guardians,
      // ⭐ 1.0.10 — parcours réel + école d'origine (dossier numérique complet)
      studentEnrollments: enrollments,
      originatingAdmission,
      // ⭐ 1.0.14 — frais & paiements réels, année par année + récap global
      financeByYear,
      financeGlobal,
      // ⭐ 1.0.18 — identité d'école par cycle (en-tête officiel du PDF)
      schoolBranding,
    };
  }

  /**
   * ⭐ 1.0.18 — Résout l'identité d'école EFFECTIVE du dossier selon le cycle
   *    de l'élève (même logique que le module Examen Bulletins) :
   *    · TenantIdentityProfile actif → repli School (tenant.schools) → tenant.name ;
   *    · élève au SECONDAIRE + identité secondaire configurée → overlay
   *      (nom/logo/contacts différents pour le secondaire) ;
   *    · ministère « Maternel et Primaire » vs « Secondaire » selon le cycle.
   */
  private async resolveSchoolBrandingForDossier(tenantId: string, student: any) {
    let identityProfile: any = null;
    try {
      identityProfile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
      });
    } catch (err) {
      this.logger.warn(`resolveSchoolBrandingForDossier: ${
        (err as Error).message
      } — repli fiche School`);
    }
    const school = (student as any)?.tenant?.schools || null;
    let branding: Record<string, any> = {
      schoolName:
        identityProfile?.schoolName || school?.name || (student as any)?.tenant?.name || 'Établissement',
      slogan: identityProfile?.slogan || school?.slogan || school?.motto || null,
      address: identityProfile?.address || school?.address || null,
      city: identityProfile?.city || school?.city || null,
      department: identityProfile?.department || school?.department || null,
      phonePrimary: identityProfile?.phonePrimary || school?.primaryPhone || null,
      email: identityProfile?.email || school?.primaryEmail || null,
      logoUrl: identityProfile?.logoUrl || school?.logo || null,
    };
    const levelCode = ((student as any)?.schoolLevel?.code || '').toUpperCase().trim();
    const isSecondary = ['SECONDAIRE', 'SECONDARY', 'SEC'].includes(levelCode);
    if (isSecondary) {
      try {
        const overlay = await resolveLevelIdentityOverlay(this.prisma, tenantId, {
          isSecondary: true,
        });
        branding = applyLevelIdentityOverlay(branding, overlay) || branding;
      } catch (err) {
        this.logger.warn(
          `resolveLevelIdentityOverlay (secondaire) a échoué : ${
            (err as Error).message
          } — identité globale conservée`,
        );
      }
    }
    return {
      ...branding,
      isSecondary,
      levelCode: levelCode || null,
      ministry: isSecondary ? MINISTERE_SECONDAIRE : MINISTERE_MATERNELLE_PRIMAIRE,
    };
  }

  /**
   * ⭐ 1.0.10 (refonte « dossier numérique de l'élève » — demande promoteur) :
   * génère le DOSSIER SCOLAIRE COMPLET en PDF (imprimable / transférable),
   * structuré à la manière des dossiers scolaires européens :
   *   I.   Identité & situation administrative
   *   II.  Responsables légaux
   *   III. Parcours dans l'établissement (année par année) + école d'origine
   *   IV.  Résultats & bulletins (par année / période)
   *   V.   Frais & paiements — année par année + récapitulatif global (⭐ 1.0.14)
   *   VI.  Assiduité & discipline
   *   VII. Documents du dossier
   *   VIII. Carte scolaire
   */
  async generateAcademicDossierPdf(
    tenantId: string,
    studentId: string,
    academicYearId?: string,
  ): Promise<Buffer> {
    const d = await this.getStudentDossier(tenantId, studentId, academicYearId);
    const idn = d.identity;

    // ── Helpers d'affichage ──
    const esc = (v: unknown): string =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const dfmt = (v?: Date | string | null): string =>
      v ? new Date(v).toLocaleDateString('fr-FR') : '—';
    const regLabel = (r?: string | null): string =>
      r === 'TEACHER_CHILD'
        ? 'Enfant enseignant'
        : r === 'SCHOLARSHIP'
          ? 'Boursier'
          : r === 'SPECIAL'
            ? 'Spécial'
            : 'Normal';
    const statusLabel: Record<string, string> = {
      ACTIVE: 'Actif', PRE_REGISTERED: 'Pré-inscrit', ADMITTED: 'Admis',
      ARCHIVED: 'Archivé', WITHDRAWN: 'Retiré', EXCLUDED: 'Exclu',
      INACTIVE: 'Inactif', PENDING: 'En attente',
    };
    const enrTypeLabel: Record<string, string> = {
      NEW: 'Nouvel élève', REPEAT: 'Ancien élève (réinscription)',
    };
    const rcStatusLabel: Record<string, string> = {
      DRAFT: 'Projet', PUBLISHED: 'Publié', VALIDATED: 'Validé',
      DIRECTOR_SIGNED: 'Signé (direction)', TEACHER_DISTRIBUTED: 'Distribué',
      TEACHER_SIGNED: 'Signé (enseignant)', PARENT_SENT: 'Envoyé aux parents',
    };
    // ⭐ 1.0.16 — mentions quantitatives (primaire / secondaire) alignées
    //    sur le module Examen, et libellés de l'échelle qualitative maternelle.
    const mentionFromAverage = (avg: number | null | undefined): string =>
      avg == null ? '—' : avg >= 16 ? 'Très Bien' : avg >= 14 ? 'Bien'
        : avg >= 12 ? 'Assez Bien' : avg >= 10 ? 'Passable' : 'Insuffisant';
    const QUALI_LABELS: Record<string, string> = {
      TS: 'Très Satisfaisant', S: 'Satisfaisant', PS: 'Peu Satisfaisant', NS: 'Non Satisfaisant',
    };

    const guardiansRows =
      (d.guardians || [])
        .map(
          (sg: any) => `
        <tr>
          <td>${esc(sg.guardian?.lastName)} ${esc(sg.guardian?.firstName)}${sg.isPrimary ? ' <b>(principal)</b>' : ''}</td>
          <td>${esc(sg.relationship)}</td>
          <td>${esc(sg.guardian?.phone) || '—'}</td>
          <td>${esc(sg.guardian?.email) || '—'}</td>
          <td>${esc(sg.guardian?.address) || '—'}</td>
        </tr>`,
        )
        .join('') ||
      `<tr><td colspan="5" class="empty">Aucun responsable légal enregistré</td></tr>`;

    const enrollmentsRows =
      (d.studentEnrollments || [])
        .map(
          (e: any) => `
        <tr>
          <td>${esc(e.academicYear?.name || e.academicYear?.label)}</td>
          <td>${esc(e.schoolLevel?.name || e.schoolLevel?.label)}</td>
          <td>${esc(e.academicClass?.name || e.class?.name || 'Non affectée')}</td>
          <td>${esc(enrTypeLabel[e.enrollmentType] || e.enrollmentType)}</td>
          <td>${esc(statusLabel[e.status] || e.status)}</td>
          <td>${dfmt(e.enrollmentDate)}</td>
        </tr>`,
        )
        .join('') ||
      `<tr><td colspan="6" class="empty">Aucune inscription enregistrée</td></tr>`;

    const reportCardsRows =
      (d.reportCards || [])
        .map(
          (rc: any) => `
        <tr>
          <td>${esc(rc.academicYear?.name || rc.academicYear?.label)}</td>
          <td>${esc(rc.periodName || rc.type)}</td>
          <td class="num">${rc.isQualitative ? 'Évaluation qualitative (TS/S/PS)' : rc.overallAverage != null ? Number(rc.overallAverage).toFixed(2) + '/20' : '—'}</td>
          <td class="num">${rc.isQualitative ? '—' : rc.rank != null ? esc(rc.rank) : '—'}</td>
          <td>${esc(rcStatusLabel[rc.status] || rc.status)}</td>
        </tr>`,
        )
        .join('') ||
      `<tr><td colspan="5" class="empty">Aucun bulletin enregistré</td></tr>`;

    // ⭐ 1.0.16 — détail des notes par matière pour chaque bulletin (items),
    //    PRÉSENTATION PAR CYCLE alignée sur le module Examen :
    //    · maternelle  = tableau qualitatif (codes TS/S/PS + appréciation)
    //    · primaire    = moyenne /20 + appréciation (coefficient 1 implicite)
    //    · secondaire  = moyenne /20 + coefficient + note coefficient + rang
    const reportCardsSubjectsBlocks = (d.reportCards || [])
      .filter((rc: any) => (rc.items || []).length > 0)
      .map(
        (rc: any) => {
          const cycleLabel = rc.isQualitative
            ? 'Maternelle — évaluation qualitative'
            : (rc.schoolLevel?.code || '').toUpperCase() === 'SECONDAIRE'
              ? 'Secondaire — moyennes pondérées'
              : 'Primaire — évaluation /20';
          let head: string;
          let rows: string;
          if (rc.isQualitative) {
            head = '<tr><th>Domaine / Matière</th><th class="num">Acquisition</th><th>Appréciation</th></tr>';
            rows = (rc.items || [])
              .map(
                (it: any) => `
            <tr>
              <td>${esc(it.subject?.name || it.subject?.code || '—')}</td>
              <td class="num"><b>${esc(it.qualitativeCode) || '—'}</b></td>
              <td>${esc(it.qualitativeCode ? QUALI_LABELS[it.qualitativeCode] : '') || esc(it.appreciation) || '—'}</td>
            </tr>`,
              )
              .join('');
          } else if ((rc.schoolLevel?.code || '').toUpperCase() === 'SECONDAIRE') {
            head = '<tr><th>Discipline</th><th class="num">Moyenne /20</th><th class="num">Coef.</th><th class="num">Moy. × Coef.</th><th class="num">Rang</th><th>Appréciation</th></tr>';
            const totalCoef = (rc.items || []).reduce((s: number, it: any) => s + Number(it.coefficient || 1), 0);
            const totalWeighted = (rc.items || []).reduce(
              (s: number, it: any) => s + Number(it.average || 0) * Number(it.coefficient || 1), 0,
            );
            rows =
              (rc.items || [])
                .map(
                  (it: any) => `
            <tr>
              <td>${esc(it.subject?.name || it.subject?.code || '—')}</td>
              <td class="num"><b>${it.average != null ? Number(it.average).toFixed(2) : '—'}</b></td>
              <td class="num">${esc(it.coefficient ?? 1)}</td>
              <td class="num">${it.average != null ? (Number(it.average) * Number(it.coefficient || 1)).toFixed(2) : '—'}</td>
              <td class="num">${it.rank != null ? esc(it.rank) : '—'}</td>
              <td>${esc(it.appreciation) || '—'}</td>
            </tr>`,
                )
                .join('') +
              `
            <tr>
              <td><b>Total</b></td>
              <td class="num" colspan="2"><b>Σ coef. ${totalCoef}</b></td>
              <td class="num"><b>${totalWeighted.toFixed(2)}</b></td>
              <td class="num" colspan="2"><b>Moy. pond. ${totalCoef > 0 ? (totalWeighted / totalCoef).toFixed(2) : '—'}</b></td>
            </tr>
            <tr>
              <td colspan="6"><b>Moyenne générale : ${rc.overallAverage != null ? Number(rc.overallAverage).toFixed(2) + '/20' : '—'} · Mention : ${esc(mentionFromAverage(rc.overallAverage))}${rc.rank != null ? ' · Rang : ' + esc(rc.rank) : ''}</b></td>
            </tr>`;
          } else {
            head = '<tr><th>Matière</th><th class="num">Moyenne /20</th><th>Appréciation</th></tr>';
            rows =
              (rc.items || [])
                .map(
                  (it: any) => `
            <tr>
              <td>${esc(it.subject?.name || it.subject?.code || '—')}</td>
              <td class="num"><b>${it.average != null ? Number(it.average).toFixed(2) : '—'}</b></td>
              <td>${esc(it.appreciation) || '—'}</td>
            </tr>`,
                )
                .join('') +
              `
            <tr><td colspan="3"><b>Moyenne générale : ${rc.overallAverage != null ? Number(rc.overallAverage).toFixed(2) + '/20' : '—'} · Mention : ${esc(mentionFromAverage(rc.overallAverage))}${rc.rank != null ? ' · Rang : ' + esc(rc.rank) : ''}</b></td></tr>`;
          }
          const qualiNote = rc.isQualitative
            ? `<p style="font-size:9px;color:#475569;margin:2px 0 4px;">Échelle : TS = Très Satisfaisant · S = Satisfaisant · PS = Peu Satisfaisant${rc.qualitativeOverall ? ' · Appréciation globale : <b>' + esc(rc.qualitativeOverall) + ' (' + esc(QUALI_LABELS[rc.qualitativeOverall] || '') + ')</b>' : ''}</p>`
            : '';
          return `
    <div class="subsection">
      <h3>${esc(cycleLabel)} — ${esc(rc.academicYear?.name || rc.academicYear?.label)} · ${esc(rc.periodName || rc.type)}</h3>
      ${qualiNote}
      <div class="tblwrap"><table>
        <thead>${head}</thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
        },
      )
      .join('');

    const academicRecordsRows =
      (d.academicRecords || [])
        .map(
          (r: any) => `
        <tr>
          <td>${esc(r.academicYear?.name || r.academicYear?.label)}</td>
          <td>${esc(r.class?.name || r.schoolLevel?.name || '')}</td>
          <td class="num">${r.averageScore != null ? Number(r.averageScore).toFixed(2) : '—'}</td>
          <td class="num">${r.rank != null ? esc(r.rank) : '—'}</td>
          <td class="num">${esc(r.totalAbsences ?? 0)}</td>
          <td class="num">${esc(r.totalIncidents ?? 0)}</td>
        </tr>`,
        )
        .join('');

    const academicRecordsBlock = academicRecordsRows
      ? `
    <div class="subsection">
      <h3>IV.2. Synthèse annuelle enregistrée</h3>
      <div class="tblwrap"><table>
        <thead>
          <tr><th>Année</th><th>Classe</th><th>Moyenne</th><th>Rang</th><th>Absences</th><th>Incidents</th></tr>
        </thead>
        <tbody>${academicRecordsRows}</tbody>
      </table></div>
    </div>`
      : '';

    const disciplinaryRows =
      (d.disciplinarySummaries || [])
        .map(
          (s: any) => `
        <tr>
          <td>${esc(s.academicYear?.name || s.academicYear?.label)}</td>
          <td class="num">${esc(s.absencesCount ?? 0)}</td>
          <td class="num">${esc(s.unjustifiedAbsences ?? 0)}</td>
          <td class="num">${esc(s.incidentsCount ?? 0)}</td>
          <td class="num">${esc(s.sanctionsCount ?? 0)}</td>
          <td class="num">${esc(s.suspensionsCount ?? 0)}</td>
        </tr>`,
        )
        .join('');

    const disciplinaryBlock = disciplinaryRows
      ? `
    <div class="subsection">
      <h3>VI.1. Synthèse par année scolaire</h3>
      <div class="tblwrap"><table>
        <thead>
          <tr><th>Année</th><th>Absences</th><th>Absences non justifiées</th><th>Incidents</th><th>Sanctions</th><th>Suspensions</th></tr>
        </thead>
        <tbody>${disciplinaryRows}</tbody>
      </table></div>
    </div>`
      : '';

    const lastAbsencesRows =
      (d.recentAbsences || [])
        .slice(0, 15)
        .map(
          (a: any) => `
        <tr>
          <td>${dfmt(a.date)}</td>
          <td>${esc(a.absenceType || a.type || 'Absence')}</td>
          <td>${a.isJustified ? 'Justifiée' : 'Non justifiée'}</td>
          <td>${esc(a.reason) || '—'}</td>
        </tr>`,
        )
        .join('');

    const lastAbsencesBlock = lastAbsencesRows
      ? `
    <div class="subsection">
      <h3>VI.2. Dernières absences (15 max)</h3>
      <div class="tblwrap"><table>
        <thead><tr><th>Date</th><th>Type</th><th>Justification</th><th>Motif</th></tr></thead>
        <tbody>${lastAbsencesRows}</tbody>
      </table></div>
    </div>`
      : '';

    const documentsRows =
      (d.documents || [])
        .map(
          (doc: any) => `
        <tr>
          <td>${esc(DOC_TYPE_LABELS[doc.documentType] || doc.documentType)}</td>
          <td>${esc(doc.fileName)}</td>
          <td>${dfmt(doc.createdAt)}</td>
        </tr>`,
        )
        .join('') ||
      `<tr><td colspan="3" class="empty">Aucun document dans le dossier</td></tr>`;

    const oa = d.originatingAdmission;
    const previousSchoolBlock = oa
      ? `
    <div class="subsection">
      <h3>III.2. École d'origine (avant l'entrée dans l'établissement)</h3>
      <div class="tblwrap"><table>
        <tbody>
          <tr><th>École d'origine</th><td>${esc(oa.previousSchool) || 'Non renseignée'}</td></tr>
          <tr><th>Niveau précédent</th><td>${esc(oa.previousLevel) || '—'}</td></tr>
          <tr><th>Motif du changement</th><td>${esc(oa.changeReason) || '—'}</td></tr>
          <tr><th>Candidature d'origine</th><td>${esc(oa.admissionNumber) || '—'} (${dfmt(oa.applicationDate)})</td></tr>
        </tbody>
      </table></div>
    </div>`
      : '';

    const card = d.currentIdCard;
    const cardBlock = `
    <div class="section">
      <h2>VIII. Carte scolaire</h2>
      <div class="tblwrap"><table>
        <tbody>
          <tr><th>Numéro de carte</th><td>${card ? esc(card.cardNumber) : 'Non générée'}</td></tr>
          <tr><th>Émise le</th><td>${card ? dfmt(card.generatedAt) : '—'}</td></tr>
          <tr><th>Valide jusqu'au</th><td>${card ? dfmt(card.validUntil) : '—'}</td></tr>
        </tbody>
      </table></div>
    </div>`;

    // ⭐ 1.0.14 — FRAIS & PAIEMENTS année par année (vraies données du compte
    //    financier : réduction réelle, arriérés, payé, reste à solder) +
    //    récapitulatif global sur toutes les années passées.
    // ⭐ 1.0.16 — TRAÇABILITÉ DU BARÈME en tête de chaque année AVANT les
    //    totaux : montants normalement dus (barème standard), ventilation
    //    inscription / réinscription / scolarité / autres, réduction effective
    //    et son pourcentage, net dû après réduction.
    const fmtMoney = (v: any): string =>
      `${Number(v ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F`;

    const feesSections = ((d.financeByYear || []) as any[])
      .map(
        (y: any) => {
          const ft = y.feeTotals || {};
          const traceabilityBlock = `
      <h3>Traçabilité du barème — ${esc(y.academicYear?.name || y.academicYear?.label || '—')}</h3>
      <div class="tblwrap"><table>
        <thead><tr><th>Montants normalement dus (barème standard)</th><th class="num">Frais d'inscription</th><th class="num">Frais de réinscription</th><th class="num">Frais de scolarité</th><th class="num">Autres frais</th></tr></thead>
        <tbody>
          <tr>
            <td><b>${fmtMoney(y.standardTotal)}</b></td>
            <td class="num">${ft.inscription && ft.inscription.standard > 0 ? fmtMoney(ft.inscription.standard) : '—'}</td>
            <td class="num">${ft.reinscription && ft.reinscription.standard > 0 ? fmtMoney(ft.reinscription.standard) : '—'}</td>
            <td class="num">${ft.tuition && ft.tuition.standard > 0 ? fmtMoney(ft.tuition.standard) : '—'}</td>
            <td class="num">${ft.other && ft.other.standard > 0 ? fmtMoney(ft.other.standard) : '—'}</td>
          </tr>
        </tbody>
      </table></div>
      <div class="tblwrap" style="margin-top:4px;"><table>
        <tbody>
          <tr>
            <th>Réduction appliquée</th>
            <td>${y.hasReduction ? `<b>Oui</b> — ${fmtMoney(y.reductionTotal)} (${y.reductionPercent} %)${y.regime ? ` — régime : ${esc(y.regime.label)}` : ''}` : 'Aucune'}</td>
            <th>Net dû après réduction</th>
            <td><b>${fmtMoney(y.netDue)}</b></td>
          </tr>
        </tbody>
      </table></div>`;
          return `
    <div class="subsection">
      <h3>Frais de l'année ${esc(y.academicYear?.name || y.academicYear?.label || '—')}${y.regime ? ` — régime : ${esc(y.regime.label)}` : ''}</h3>
      ${traceabilityBlock}
      <div class="tblwrap"><table>
        <thead>
          <tr><th>Ligne de frais</th><th class="num">Montant standard</th><th class="num">Réduction</th><th class="num">Montant dû</th><th class="num">Payé</th><th class="num">Reste à solder</th></tr>
        </thead>
        <tbody>
          ${(y.breakdowns || [])
            .map(
              (b: any) => `
            <tr>
              <td>${esc(b.name)}</td>
              <td class="num">${fmtMoney(b.standardAmount)}</td>
              <td class="num">${b.reduction > 0 ? `<b>${fmtMoney(b.reduction)}</b>` : '—'}</td>
              <td class="num"><b>${fmtMoney(b.appliedAmount)}</b></td>
              <td class="num">${fmtMoney(b.paidAmount)}</td>
              <td class="num">${fmtMoney(b.remainingAmount)}</td>
            </tr>`,
            )
            .join('')}
          <tr>
            <td><b>Total ${esc(y.academicYear?.name || '')}</b></td>
            <td class="num">${y.standardTotal > 0 ? fmtMoney(y.standardTotal) : '—'}</td>
            <td class="num">${y.reductionTotal > 0 ? `<b>${fmtMoney(y.reductionTotal)}</b>` : '—'}</td>
            <td class="num"><b>${fmtMoney(y.account.totalDue)}</b></td>
            <td class="num"><b>${fmtMoney(y.account.totalPaid)}</b></td>
            <td class="num"><b>${fmtMoney(y.account.balance)}</b></td>
          </tr>
          ${
            y.account.arrearsAmount > 0
              ? `<tr><td colspan="6" class="num">dont arriérés reportés : <b>${fmtMoney(y.account.arrearsAmount)}</b></td></tr>`
              : ''
          }
        </tbody>
      </table></div>
      ${
        (y.transactions || []).length > 0
          ? `
      <h3>Dernières transactions — ${esc(y.academicYear?.name || '')}</h3>
      <div class="tblwrap"><table>
        <thead><tr><th>Date</th><th>Type</th><th class="num">Montant</th><th>Moyen</th><th>Référence</th></tr></thead>
        <tbody>
          ${y.transactions
            .map(
              (t: any) => `
            <tr>
              <td>${dfmt(t.createdAt)}</td>
              <td>${esc(t.type)}</td>
              <td class="num"><b>${fmtMoney(t.amount)}</b></td>
              <td>${esc(t.paymentMethod) || '—'}</td>
              <td>${esc(t.reference) || '—'}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table></div>`
          : ''
      }
    </div>`;
        },
      )
      .join('');

    const fg = d.financeGlobal;
    const feesBlock = `
    <div class="section">
      <h2>V. Frais &amp; paiements — année par année</h2>
      ${
        feesSections
          ? feesSections +
            `
      <div class="subsection">
        <h3>Récapitulatif global — toutes années (${esc(fg?.yearsCount ?? 0)} an(s) dans l'établissement)</h3>
        <div class="tblwrap"><table>
          <tbody>
            <tr>
              <th>Barème normal cumulé (avant réduction)</th>
              <td><b>${fmtMoney(fg?.standardTotal)}</b></td>
              <th>Réductions cumulées</th>
              <td>${(fg?.reductionTotal ?? 0) > 0 ? `<b>${fmtMoney(fg?.reductionTotal)}</b> (${fg?.reductionPercent ?? 0} %)` : '—'}</td>
              <th>Net cumulé après réduction</th>
              <td><b>${fmtMoney(fg?.netDue)}</b></td>
            </tr>
          </tbody>
        </table></div>
        <div class="tblwrap" style="margin-top:4px;"><table>
          <thead><tr><th>Total dû (toutes années)</th><th class="num">Réductions cumulées</th><th class="num">Arriérés</th><th class="num">Total payé</th><th class="num">Solde restant</th></tr></thead>
          <tbody>
            <tr>
              <td><b>${fmtMoney(fg?.totalDue)}</b></td>
              <td class="num">${(fg?.reductionTotal ?? 0) > 0 ? fmtMoney(fg?.reductionTotal) : '—'}</td>
              <td class="num">${(fg?.arrears ?? 0) > 0 ? `<b>${fmtMoney(fg?.arrears)}</b>` : '—'}</td>
              <td class="num"><b>${fmtMoney(fg?.totalPaid)}</b></td>
              <td class="num"><b>${fmtMoney(fg?.balance)}</b></td>
            </tr>
          </tbody>
        </table></div>
      </div>`
          : '<p class="empty" style="color:#94a3b8;font-style:italic;text-align:center;">Aucun compte financier enregistré pour cet élève.</p>'
      }
    </div>`;

    const yearName =
      (d.studentEnrollments || [])[0]?.academicYear?.name ||
      (d.studentEnrollments || [])[0]?.academicYear?.label ||
      '';
    const currentClassName =
      (d.studentEnrollments || [])[0]?.academicClass?.name ||
      (d.studentEnrollments || [])[0]?.class?.name ||
      'Non affectée';

    // ⭐ 1.0.18 — EN-TÊTE OFFICIEL PAR CYCLE, reproduit du module Examen
    //    (Examen > Bulletins) : drapeau du Bénin à gauche, République /
    //    ministère / nom d'école + coordonnées au centre, logo à droite ;
    //    maternelle/primaire ≠ secondaire (ministère + identité secondaire).
    const sb = d.schoolBranding || ({} as any);
    const beninFlagSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" viewBox="0 0 75 50"><rect width="30" height="50" fill="#008751"/><rect x="30" width="45" height="25" fill="#FCD116"/><rect x="30" y="25" width="45" height="25" fill="#E8112D"/></svg>`;
    const beninFlag = `data:image/svg+xml;base64,${Buffer.from(beninFlagSvg).toString('base64')}`;
    const schoolAddressLine = [sb.address, sb.city, sb.department].filter(Boolean).join(', ');
    const editionDate = new Date().toLocaleDateString('fr-FR');

    const html = `
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Dossier scolaire — ${esc(idn.lastName)} ${esc(idn.firstName)}</title>
    <style>
      /* ⭐ 1.0.18 — marges pilotées par page.pdf() (footer officiel sur chaque
         page via displayHeaderFooter) : @page ne fixe plus les marges. */
      @page { size: A4; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5px; color: #1e293b; }

      /* ── En-tête officiel (module Examen Bulletins) ── */
      .header { margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #0d1f6e; }
      .header-table { width: 100%; border-collapse: collapse; }
      .header-table td { vertical-align: middle; padding: 2px 4px; }
      .header-left { text-align: center; width: 12%; }
      .header-center { text-align: center; width: 68%; }
      .header-right { text-align: center; width: 20%; }
      .republique { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
      .divider { margin: 2px auto; width: 50%; }
      .divider-line { height: 1px; background: #0d1f6e; }
      .ministere { font-size: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; line-height: 1.3; }
      .school-name { font-size: 11px; font-weight: bold; text-transform: uppercase; margin-top: 3px; color: #0d1f6e; }
      .school-info { font-size: 7px; color: #555; margin-top: 2px; font-style: italic; }

      /* ── Barre de titre encadrée navy arrondie (standard bulletin Examen) ── */
      .doc-title { text-align: center; border: 2px solid #0d1f6e; border-radius: 8px; padding: 4px 8px; margin-bottom: 6px; font-size: 11px; font-weight: bold; text-transform: uppercase; color: #0d1f6e; background: #f1f5f9; }

      /* ── Bandeau élève (module Examen .info-wrap : photo + identifiants) ── */
      .info-wrap { border: 1px solid #000; border-radius: 6px; overflow: hidden; margin-bottom: 10px; break-inside: avoid; page-break-inside: avoid; }
      .info-table { width: 100%; border-collapse: collapse; }
      .info-table td { border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 5px; font-size: 9px; background: #f1f5f9; }
      .info-table td:last-child { border-right: none; }
      .info-table tr:last-child td { border-bottom: none; }

      h2 { font-size: 12px; color: #0d1f6e; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: 0.4px; }
      h3 { font-size: 10.5px; color: #334155; margin: 10px 0 4px; }

      /* ⭐ 1.0.18 — TABLEAUX À COINS ARRONDIS (module Examen) : le cadre externe
         est porté par le wrapper .tblwrap (Chromium peint mal border-radius
         directement sur une <table>) ; grille interne en collapse → filets
         continus ; en-tête navy/blanc comme les bulletins. */
      .tblwrap { border: 2px solid #0d1f6e; border-radius: 8px; overflow: hidden; margin-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-right: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; padding: 3.5px 6px; text-align: left; vertical-align: top; }
      th:last-child, td:last-child { border-right: none; }
      tbody tr:last-child td, tbody tr:last-child th { border-bottom: none; }
      thead { display: table-header-group; }
      thead th { background: #0d1f6e; color: #fff; font-weight: 700; font-size: 9px; text-transform: uppercase; }
      table tr { break-inside: avoid; page-break-inside: avoid; }
      tbody th { background: #f1f5f9; font-weight: 600; width: 34%; color: #334155; border-right: 1px solid #cbd5e1; }
      td.num { text-align: center; }
      td.empty, tr.empty td { text-align: center; color: #94a3b8; font-style: italic; }
      .kv { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
      .kv .tblwrap { margin-bottom: 0; }
      .section { page-break-inside: avoid; }
      .subsection { page-break-inside: avoid; margin-top: 8px; }
    </style>
  </head>
  <body>
    <!-- ═══ EN-TÊTE OFFICIEL (module Examen Bulletins — par cycle) ═══ -->
    <div class="header">
      <table class="header-table">
        <tr>
          <td class="header-left"><img src="${beninFlag}" alt="Drapeau du Bénin" style="width:30px;height:20px;" /></td>
          <td class="header-center">
            <div class="republique">République du Bénin</div>
            <div class="divider"><div class="divider-line"></div></div>
            <div class="ministere">${esc(sb.ministry || MINISTERE_MATERNELLE_PRIMAIRE)}</div>
            <div class="divider"><div class="divider-line"></div></div>
            <div class="school-name">${esc(sb.schoolName || idn.institution)}</div>
            <div class="school-info">${sb.slogan ? `« ${esc(sb.slogan)} » · ` : ''}${esc(schoolAddressLine)}${sb.phonePrimary ? ` · Tél: ${esc(sb.phonePrimary)}` : ''}${sb.email ? ` · ${esc(sb.email)}` : ''}</div>
          </td>
          <td class="header-right">${sb.logoUrl ? `<img src="${esc(sb.logoUrl)}" style="max-width:35px;max-height:35px;object-fit:contain;" alt="" />` : ''}</td>
        </tr>
      </table>
    </div>

    <!-- ═══ TITRE DU DOCUMENT (barre encadrée navy arrondie) ═══ -->
    <div class="doc-title">Dossier scolaire de l'élève — document officiel</div>

    <!-- ═══ BANDEAU ÉLÈVE (module Examen : photo + identifiants clés) ═══ -->
    <div class="info-wrap">
      <table class="info-table">
        <tr>
          <td rowspan="2" style="width:55px;text-align:center;vertical-align:middle;border-bottom:none;">
            ${idn.photoUrl
              ? `<img src="${esc(idn.photoUrl)}" style="width:45px;height:50px;object-fit:cover;border:1px solid #000;border-radius:2px;" alt="Photo" />`
              : `<div style="width:45px;height:50px;border:1px solid #000;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:7px;color:#94a3b8;background:#f1f5f9;">Photo</div>`}
          </td>
          <td>Année scolaire : <strong>${esc(yearName) || '—'}</strong></td>
          <td>Nom et prénoms : <strong style="text-transform:uppercase;">${esc(idn.lastName)} ${esc(idn.firstName)}</strong></td>
          <td>Classe : <strong>${esc(currentClassName)}</strong></td>
        </tr>
        <tr>
          <td>Matricule : <strong>${esc(idn.matricule) || '—'}</strong></td>
          <td>Date de naissance : <strong>${dfmt(idn.dateOfBirth)}</strong></td>
          <td>Statut : <strong>${esc(statusLabel[idn.status] || idn.status)}</strong></td>
        </tr>
      </table>
    </div>

    <div class="section">
      <h2>I. Identité &amp; situation administrative</h2>
      <div class="kv">
        <div class="tblwrap"><table>
          <tbody>
            <tr><th>Nom / Prénom</th><td><b>${esc(idn.lastName)} ${esc(idn.firstName)}</b></td></tr>
            <tr><th>Matricule</th><td>${esc(idn.matricule) || '—'}</td></tr>
            <tr><th>Date de naissance</th><td>${dfmt(idn.dateOfBirth)}</td></tr>
            <tr><th>Lieu de naissance</th><td>${esc(idn.placeOfBirth) || '—'}</td></tr>
            <tr><th>Sexe</th><td>${idn.gender === 'M' ? 'Masculin' : idn.gender === 'F' ? 'Féminin' : '—'}</td></tr>
            <tr><th>Nationalité</th><td>${esc(idn.nationality) || '—'}</td></tr>
          </tbody>
        </table></div>
        <div class="tblwrap"><table>
          <tbody>
            <tr><th>NPI</th><td>${esc(idn.npi) || 'Non renseigné'}</td></tr>
            <tr><th>Statut</th><td>${esc(statusLabel[idn.status] || idn.status)}</td></tr>
            <tr><th>Régime scolaire</th><td>${esc(regLabel(idn.regimeType))}</td></tr>
            <tr><th>Adresse</th><td>${esc(idn.address) || '—'}</td></tr>
            <tr><th>N° de dossier</th><td>${esc(idn.studentCode) || esc(idn.matricule) || '—'}</td></tr>
          </tbody>
        </table></div>
      </div>
    </div>

    <div class="section">
      <h2>II. Responsables légaux</h2>
      <div class="tblwrap"><table>
        <thead>
          <tr><th>Nom</th><th>Lien de parenté</th><th>Téléphone</th><th>Email</th><th>Adresse</th></tr>
        </thead>
        <tbody>${guardiansRows}</tbody>
      </table></div>
    </div>

    <div class="section">
      <h2>III. Parcours dans l'établissement</h2>
      <div class="subsection">
        <h3>III.1. Inscriptions année par année</h3>
        <div class="tblwrap"><table>
          <thead>
            <tr><th>Année scolaire</th><th>Niveau</th><th>Classe</th><th>Type</th><th>Statut</th><th>Date d'inscription</th></tr>
          </thead>
          <tbody>${enrollmentsRows}</tbody>
        </table></div>
      </div>
      ${previousSchoolBlock}
    </div>

    <div class="section">
      <h2>IV. Résultats &amp; bulletins</h2>
      <div class="subsection">
        <h3>IV.1. Bulletins par année et période</h3>
        <div class="tblwrap"><table>
          <thead>
            <tr><th>Année</th><th>Période</th><th>Moyenne générale</th><th>Rang</th><th>Statut</th></tr>
          </thead>
          <tbody>${reportCardsRows}</tbody>
        </table></div>
      </div>
      ${reportCardsSubjectsBlocks}
      ${academicRecordsBlock}
    </div>

    ${feesBlock}

    <div class="section">
      <h2>VI. Assiduité &amp; discipline</h2>
      ${disciplinaryBlock}
      ${lastAbsencesBlock}
      ${
        !disciplinaryRows && !lastAbsencesRows
          ? '<p class="empty" style="color:#94a3b8;font-style:italic;text-align:center;">Aucun événement d\'assiduité ou de discipline enregistré.</p>'
          : ''
      }
    </div>

    <div class="section">
      <h2>VII. Documents du dossier</h2>
      <div class="tblwrap"><table>
        <thead><tr><th>Type de document</th><th>Fichier</th><th>Déposé le</th></tr></thead>
        <tbody>${documentsRows}</tbody>
      </table></div>
    </div>

    ${cardBlock}
  </body>
</html>
    `;

    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      // ⭐ 1.0.18 — PIED DE PAGE OFFICIEL SUR CHAQUE PAGE (module Examen) :
      //    displayHeaderFooter + footerTemplate (école · élève · matricule ·
      //    Academia Helm · page X/Y). ⚠️ Les templates Puppeteer vivent dans un
      //    contexte isolé : styles INLINE uniquement, classes pageNumber /
      //    totalPages remplacées par Chromium ; marges portées par page.pdf()
      //    (l'ancien @page margin CSS est retiré, sinon il doublonnait).
      const footerHtml = `<div style="font-size:7px;font-family:Arial,Helvetica,sans-serif;color:#64748b;width:100%;text-align:center;">${esc(sb.schoolName || idn.institution)} — Élève : ${esc(idn.lastName)} ${esc(idn.firstName)} · ${esc(idn.matricule) || 'sans matricule'} · Édité le ${editionDate} — Document généré par Academia Helm · Tél : +229 0141360803 · Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>`;
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: footerHtml,
        margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
      });
      // ⭐ 1.0.14 — Puppeteer v13+ page.pdf() retourne un Uint8Array (pas un
      //    Buffer) : res.send() l'ENVERRAIT en JSON {"0":37,"1":80,…} avec
      //    content-type application/pdf → PDF corrompu au téléchargement
      //    (constaté E2E : le fichier téléchargé commence par « {"0":… »).
      //    Même correction que bulletin-pdf / meeting-minutes / distinctions :
      //    envelopper explicitement en Buffer.
      return Buffer.from(pdfBuffer);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /**
   * ⭐ 1.0.18 — TÉLÉCHARGEMENT EN BLOC (demande promoteur) : génère le dossier
   *    complet PDF ET récupère les DOCUMENTS JOINTS de l'élève pour tout mettre
   *    dans UN SEUL dossier (archive ZIP) :
   *
   *      Dossier_scolaire_<NOM>_<Prenom>_<Matricule>/
   *        ├─ Dossier_scolaire_<NOM>_<Prenom>_<Matricule>.pdf
   *        └─ Documents joints/
   *             ├─ Acte_de_naissance_acte.pdf
   *             ├─ Photo_identite_photo.jpg
   *             └─ …
   *
   *    Comportement : si AUCUN document n'est récupérable (aucun document
   *    enregistré, ou fichiers introuvables), la réponse reste le PDF seul —
   *    l'archive n'apporterait rien. Les documents irrécupérables sont
   *    journalisés (warn) et IGNORÉS : le téléchargement ne doit jamais échouer
   *    à cause d'un fichier manquant.
   */
  async generateAcademicDossierBundle(
    tenantId: string,
    studentId: string,
    academicYearId?: string,
  ): Promise<{
    buffer: Buffer;
    fileName: string;
    mimeType: 'application/pdf' | 'application/zip';
    documentsIncluded: number;
    documentsTotal: number;
  }> {
    const d = await this.getStudentDossier(tenantId, studentId, academicYearId);
    const idn = d.identity;
    const pdfBuffer = await this.generateAcademicDossierPdf(
      tenantId,
      studentId,
      academicYearId,
    );

    // Nom de fichier sûr (accents/espaces/caractères filesystem-dangereux)
    const safe = (s: string | null | undefined): string =>
      (s ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[''`]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60);
    const lastName = safe(idn.lastName) || 'Eleve';
    const firstName = safe(idn.firstName);
    const matricule = safe(idn.matricule);
    const stem = `Dossier_scolaire_${lastName}${firstName ? '_' + firstName : ''}${matricule ? '_' + matricule : ''}`;
    const zipFileName = `${stem}.zip`;
    const pdfEntryName = `${stem}.pdf`;

    // ── Récupération des documents joints (même chaîne que le module
    //    Admissions : data URL → https → storage R2/S3/local → filesystem) ──
    const documents = (d.documents || []) as any[];
    const entries: ZipEntryInput[] = [];
    const usedNames = new Set<string>();
    let docIdx = 0;
    for (const doc of documents) {
      docIdx += 1;
      let buffer: Buffer | null = null;
      try {
        buffer = await this.retrieveStudentDocumentFile(doc);
      } catch (err) {
        this.logger.warn(
          `Document ${doc.documentType} (${doc.fileName}) non récupérable : ${
            (err as Error).message
          } — ignoré dans l'archive`,
        );
      }
      if (!buffer || buffer.length === 0) continue;

      // Nom d'entrée : <type>_<fichier> — unicité garantie dans l'archive
      let base = safe(
        `${DOC_TYPE_LABELS[doc.documentType] || doc.documentType}_${doc.fileName || `document_${docIdx}`}`,
      );
      if (!base) base = `document_${docIdx}`;
      if (!/\.[a-zA-Z0-9]{2,5}$/.test(base)) base += '.bin';
      let entryName = base;
      let n = 2;
      while (usedNames.has(entryName)) {
        const m = /^(.*?)(\.[^.]+)?$/.exec(base);
        entryName = `${m?.[1] || base}-${n}${m?.[2] || ''}`;
        n += 1;
      }
      usedNames.add(entryName);
      entries.push({
        name: `${stem}/Documents joints/${entryName}`,
        data: buffer,
        mtime: doc.createdAt ? new Date(doc.createdAt) : undefined,
      });
    }

    // ── Aucun document récupérable → PDF seul (comportement inchangé) ──
    if (entries.length === 0) {
      return {
        buffer: pdfBuffer,
        fileName: pdfEntryName,
        mimeType: 'application/pdf',
        documentsIncluded: 0,
        documentsTotal: documents.length,
      };
    }

    // ── Archive : tout dans UN SEUL dossier racine (PDF + Documents joints) ──
    const zip = createZipArchive([
      { name: `${stem}/${pdfEntryName}`, data: pdfBuffer },
      ...entries,
    ]);
    this.logger.log(
      `Bundle dossier ZIP généré : ${entries.length}/${documents.length} document(s) joint(s) + PDF`,
    );
    return {
      buffer: zip,
      fileName: zipFileName,
      mimeType: 'application/zip',
      documentsIncluded: entries.length,
      documentsTotal: documents.length,
    };
  }

  /**
   * ⭐ 1.0.18 — Récupère le FICHIER d'un document joint élève (StudentDocument)
   *    — même chaîne de repli que le module Admissions :
   *    1. data URL (base64 en DB) ;
   *    2. URL http(s) (R2/S3 public, CDN) ;
   *    3. StorageService (R2/S3/local) ;
   *    4. filesystem local (chemin relatif au cwd).
   *    Retourne null si introuvable — l'appelant décide d'ignorer.
   */
  private async retrieveStudentDocumentFile(doc: any): Promise<Buffer | null> {
    const filePath = (doc?.filePath || '').trim();
    if (!filePath) return null;

    // 1. Data URL : décoder directement le base64
    if (filePath.startsWith('data:')) {
      const m = /^data:([^;]+);base64,(.+)$/is.exec(filePath);
      if (m) return Buffer.from(m[2], 'base64');
      return null;
    }

    // 2. URL HTTPS (R2/S3 public ou autre) : fetch direct
    if (/^https?:\/\//i.test(filePath)) {
      try {
        const response = await fetch(filePath);
        if (response.ok) {
          return Buffer.from(await response.arrayBuffer());
        }
      } catch {
        // fetch échoué — essaie le storage service ci-dessous
      }
    }

    // 3. Storage service (R2/S3/local)
    try {
      return await this.storageService.downloadFile(filePath);
    } catch {
      // storage échoué — essaie le filesystem local
    }

    // 4. Fallback filesystem local
    try {
      const fs = await import('fs');
      const path = await import('path');
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath.replace(/^\.\//, ''));
      if (fs.existsSync(absolutePath)) {
        return fs.readFileSync(absolutePath);
      }
    } catch {
      // filesystem local échoué
    }
    return null;
  }

  /**
   * Crée ou met à jour un enregistrement académique
   */
  async upsertAcademicRecord(
    tenantId: string,
    studentId: string,
    academicYearId: string,
    data: {
      classId?: string;
      schoolLevelId: string;
      level?: string;
      enrollmentStatus?: string;
      averageScore?: number;
      rank?: number;
      totalAbsences?: number;
      totalIncidents?: number;
      totalSanctions?: number;
      notes?: any;
    },
  ) {
    // Vérifier que l'élève existe
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId,
      },
    });

    if (!student) {
      throw new NotFoundException('Élève non trouvé');
    }

    return this.prisma.studentAcademicRecord.upsert({
      where: {
        studentId_academicYearId: {
          studentId,
          academicYearId,
        },
      },
      update: {
        ...data,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        studentId,
        academicYearId,
        schoolLevelId: data.schoolLevelId,
        classId: data.classId,
        level: data.level,
        enrollmentStatus: data.enrollmentStatus || 'ACTIVE',
        averageScore: data.averageScore ? data.averageScore : null,
        rank: data.rank || null,
        totalAbsences: data.totalAbsences || 0,
        totalIncidents: data.totalIncidents || 0,
        totalSanctions: data.totalSanctions || 0,
        notes: data.notes || null,
      },
    });
  }

  /**
   * Crée ou met à jour un résumé disciplinaire
   */
  async upsertDisciplinarySummary(
    tenantId: string,
    studentId: string,
    academicYearId: string,
    data: {
      absencesCount?: number;
      justifiedAbsences?: number;
      unjustifiedAbsences?: number;
      incidentsCount?: number;
      minorIncidents?: number;
      majorIncidents?: number;
      sanctionsCount?: number;
      warningsCount?: number;
      suspensionsCount?: number;
      expulsionsCount?: number;
      lastIncidentDate?: Date;
      lastSanctionDate?: Date;
      notes?: any;
    },
  ) {
    // Vérifier que l'élève existe
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId,
      },
    });

    if (!student) {
      throw new NotFoundException('Élève non trouvé');
    }

    return this.prisma.studentDisciplinarySummary.upsert({
      where: {
        studentId_academicYearId: {
          studentId,
          academicYearId,
        },
      },
      update: {
        ...data,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        studentId,
        academicYearId,
        absencesCount: data.absencesCount || 0,
        justifiedAbsences: data.justifiedAbsences || 0,
        unjustifiedAbsences: data.unjustifiedAbsences || 0,
        incidentsCount: data.incidentsCount || 0,
        minorIncidents: data.minorIncidents || 0,
        majorIncidents: data.majorIncidents || 0,
        sanctionsCount: data.sanctionsCount || 0,
        warningsCount: data.warningsCount || 0,
        suspensionsCount: data.suspensionsCount || 0,
        expulsionsCount: data.expulsionsCount || 0,
        lastIncidentDate: data.lastIncidentDate || null,
        lastSanctionDate: data.lastSanctionDate || null,
        notes: data.notes || null,
      },
    });
  }

  /**
   * Synchronise automatiquement les résumés disciplinaires à partir des données réelles
   */
  async syncDisciplinarySummary(
    tenantId: string,
    studentId: string,
    academicYearId: string,
  ) {
    // Compter les absences
    // Absence n'a pas academicYearId directement, filtrer via student -> enrollment
    const absences = await this.prisma.absence.findMany({
      where: {
        studentId,
        // Filtrer par année scolaire via les enrollments si nécessaire
      },
    });

    const absencesCount = absences.length;
    const justifiedAbsences = absences.filter(a => a.isJustified).length;
    const unjustifiedAbsences = absencesCount - justifiedAbsences;

    // Compter les incidents et sanctions
    const disciplinaryActions = await this.prisma.disciplinaryAction.findMany({
      where: {
        studentId,
        academicYearId,
      },
    });

    const incidentsCount = disciplinaryActions.length;
    // DisciplinaryAction n'a pas severity, utiliser actionType pour catégoriser
    const minorIncidents = disciplinaryActions.filter(a => a.actionType === 'WARNING').length;
    const majorIncidents = disciplinaryActions.filter(a => ['SUSPENSION', 'EXPULSION'].includes(a.actionType)).length;

    const sanctionsCount = disciplinaryActions.filter(a => a.actionType !== 'WARNING').length;
    const warningsCount = disciplinaryActions.filter(a => a.actionType === 'WARNING').length;
    const suspensionsCount = disciplinaryActions.filter(a => a.actionType === 'SUSPENSION').length;
    const expulsionsCount = disciplinaryActions.filter(a => a.actionType === 'EXPULSION').length;

    const lastIncident = disciplinaryActions.length > 0
      ? disciplinaryActions.sort((a, b) => new Date(b.actionDate).getTime() - new Date(a.actionDate).getTime())[0]
      : null;

    return this.upsertDisciplinarySummary(tenantId, studentId, academicYearId, {
      absencesCount,
      justifiedAbsences,
      unjustifiedAbsences,
      incidentsCount,
      minorIncidents,
      majorIncidents,
      sanctionsCount,
      warningsCount,
      suspensionsCount,
      expulsionsCount,
      lastIncidentDate: lastIncident?.actionDate || null,
      lastSanctionDate: lastIncident?.actionDate || null,
    });
  }
}

