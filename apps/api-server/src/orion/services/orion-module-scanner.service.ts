/**
 * ============================================================================
 * ORION MODULE SCANNER — Scan multi-module pour l'IA ORION
 * ============================================================================
 *
 * Service dédié au scan exhaustif de TOUS les modules d'Academia Helm.
 * Pour chaque module, il lit les données (multi-tenant strict) et construit
 * un contexte riche : counts, anomalies, KPIs, alertes.
 *
 * Modules couverts :
 *   1. Pédagogie (EDT, matières, affectations, espace pédagogique, validation direction)
 *   2. Élèves & Scolarité (inscriptions, dossiers, transferts, export Educmaster)
 *   3. Finance (frais, encaissements, multi-caisses, recouvrements, arriérés, dépenses, clôtures)
 *   4. Examens & Notes (saisie, moyennes, bulletins, statistiques)
 *   5. Personnel & RH (contrats, congés, paie, CNSS, candidats)
 *   6. Communication (SMS, WhatsApp, email, push, campagnes)
 *   7. QHSE (incidents, contrôles, conformité)
 *   8. Paramètres (config école, rôles, modules)
 *   9. Cantine (menus, inscriptions, paiements, stocks)
 *  10. EduCast (chaînes, contenus, monétisation)
 *  11. Boutique (produits, commandes, stocks)
 *  12. Transport (itinéraires, tickets)
 *  13. Infirmerie (visites, ordonnances)
 *  14. Bibliothèque (catalogue, prêts)
 *
 * ⚠️ MULTI-TENANT STRICT : Toutes les requêtes Prisma sont filtrées par tenantId.
 * Aucune donnée d'autres établissements n'est jamais lue.
 *
 * ⚠️ LECTURE SEULE : Ce service ne fait QUE lire. Aucune écriture.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/** Structure du contexte retourné pour un module */
export interface ModuleContext {
  /** Nom du module */
  name: string;
  /** Résumé des données (counts, métriques) */
  summary: string;
  /** Anomalies détectées dans ce module */
  anomalies: Array<{ severity: 'INFO' | 'ATTENTION' | 'CRITIQUE'; message: string }>;
  /** KPIs calculés pour ce module */
  kpis: Array<{ name: string; value: string; interpretation?: string }>;
}

/** Structure complète du scan multi-module */
export interface FullModuleScan {
  pedagogy: ModuleContext;
  students: ModuleContext;
  finance: ModuleContext;
  exams: ModuleContext;
  hr: ModuleContext;
  communication: ModuleContext;
  qhse: ModuleContext;
  settings: ModuleContext;
  canteen: ModuleContext;
  educast: ModuleContext;
  shop: ModuleContext;
  transport: ModuleContext;
  infirmary: ModuleContext;
  library: ModuleContext;
}

@Injectable()
export class OrionModuleScanner {
  private readonly logger = new Logger(OrionModuleScanner.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Scan exhaustif de TOUS les modules pour un tenant donné.
   *
   * ⚠️ Multi-tenant strict : toutes les requêtes sont filtrées par tenantId.
   * ⚠️ Résilient : chaque requête est wrappée dans un try/catch pour ne pas
   *    faire échouer le scan entier si un module a une erreur.
   */
  async scanAllModules(
    tenantId: string,
    academicYearId?: string,
  ): Promise<FullModuleScan> {
    const yearFilter = academicYearId ? { academicYearId } : {};
    const tenantFilter = { tenantId };
    const tenantYearFilter = { ...tenantFilter, ...yearFilter };

    this.logger.log(`[ORION SCANNER] Scanning all modules for tenant ${tenantId}...`);

    const [
      pedagogy,
      students,
      finance,
      exams,
      hr,
      communication,
      qhse,
      settings,
      canteen,
      educast,
      shop,
      transport,
      infirmary,
      library,
    ] = await Promise.all([
      this.scanPedagogy(tenantFilter, tenantYearFilter),
      this.scanStudents(tenantFilter, tenantYearFilter),
      this.scanFinance(tenantFilter, tenantYearFilter),
      this.scanExams(tenantFilter, tenantYearFilter),
      this.scanHR(tenantFilter, tenantYearFilter),
      this.scanCommunication(tenantFilter, tenantYearFilter),
      this.scanQHSE(tenantFilter, tenantYearFilter),
      this.scanSettings(tenantFilter),
      this.scanCanteen(tenantFilter, tenantYearFilter),
      this.scanEduCast(tenantFilter),
      this.scanShop(tenantFilter),
      this.scanTransport(tenantFilter, tenantYearFilter),
      this.scanInfirmary(tenantFilter, tenantYearFilter),
      this.scanLibrary(tenantFilter, tenantYearFilter),
    ]);

    this.logger.log(`[ORION SCANNER] Scan completed for tenant ${tenantId}`);

    return {
      pedagogy,
      students,
      finance,
      exams,
      hr,
      communication,
      qhse,
      settings,
      canteen,
      educast,
      shop,
      transport,
      infirmary,
      library,
    };
  }

  /** Helper : count sécurisé (retourne 0 si erreur) */
  private async safeCount(model: any, where: any): Promise<number> {
    try {
      return await model.count({ where });
    } catch {
      return 0;
    }
  }

  /** Helper : aggregate sécurisé (retourne 0 si erreur) */
  private async safeAggregate(model: any, args: any): Promise<number> {
    try {
      const result = await model.aggregate(args);
      return result._sum?.amount || result._sum?.total || result._count?.id || 0;
    } catch {
      return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE 1 : PÉDAGOGIE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Scan du module Organisation Pédagogique.
   *
   * Couvre :
   *   - Emplois du temps (Timetable, TimetableEntry, TimetableVersion)
   *   - Matières et affectations (TeachingAssignment, ClassSubject)
   *   - Espace pédagogique (PedagogicalDocument, PedagogicalSheet, LessonJournal)
   *   - Validation direction (LessonJournalValidation, PedagogicalSheetValidation)
   *   - Bibliothèque pédagogique (PedagogicalMaterial)
   *   - Cahier de texte (ClassDiary, CahierJournal)
   */
  async scanPedagogy(
    tenantFilter: any,
    tenantYearFilter: any,
  ): Promise<ModuleContext> {
    const [
      timetables,
      timetableEntries,
      timetableVersions,
      teachingAssignments,
      classSubjects,
      pedagogicalDocuments,
      pedagogicalSheets,
      lessonJournals,
      lessonJournalValidations,
      pedagogicalSheetValidations,
      pedagogicalMaterials,
      classDiaries,
      cahierJournals,
      pendingValidations,
      missingAssignments,
    ] = await Promise.all([
      this.safeCount(this.prisma.timetable, tenantYearFilter),
      this.safeCount(this.prisma.timetableEntry, tenantYearFilter),
      this.safeCount(this.prisma.timetableVersion, tenantYearFilter),
      this.safeCount(this.prisma.teachingAssignment, tenantYearFilter),
      this.safeCount(this.prisma.classSubject, tenantYearFilter),
      this.safeCount(this.prisma.pedagogicalDocument, tenantFilter),
      this.safeCount(this.prisma.pedagogicalSheet, tenantFilter),
      this.safeCount(this.prisma.lessonJournal, tenantFilter),
      this.safeCount(this.prisma.lessonJournalValidation, tenantFilter),
      this.safeCount(this.prisma.pedagogicalSheetValidation, tenantFilter),
      this.safeCount(this.prisma.pedagogicalMaterial, tenantFilter),
      this.safeCount(this.prisma.classDiary, tenantYearFilter),
      this.safeCount(this.prisma.cahierJournal, tenantYearFilter),
      this.safeCount(this.prisma.lessonJournal, { ...tenantFilter, validationStatus: 'PENDING' }),
      this.safeCount(this.prisma.teachingAssignment, { ...tenantYearFilter, teacherId: null }),
    ]);

    const anomalies: ModuleContext['anomalies'] = [];

    if (timetables === 0) {
      anomalies.push({ severity: 'ATTENTION', message: 'Aucun emploi du temps généré pour la période' });
    }
    if (pendingValidations > 0) {
      anomalies.push({ severity: 'ATTENTION', message: `${pendingValidations} journal(s) de cours en attente de validation` });
    }
    if (missingAssignments > 0) {
      anomalies.push({ severity: 'CRITIQUE', message: `${missingAssignments} affectation(s) sans enseignant — cours non couverts` });
    }
    if (teachingAssignments > 0 && classSubjects > teachingAssignments * 2) {
      anomalies.push({ severity: 'INFO', message: 'Ratio matières/affectations élevé — vérifier la charge par enseignant' });
    }
    if (pedagogicalDocuments === 0 && pedagogicalSheets === 0) {
      anomalies.push({ severity: 'INFO', message: 'Espace pédagogique vide — aucune fiche ni document pédagogique' });
    }

    return {
      name: 'Organisation Pédagogique',
      summary: `EDT: ${timetables} (${timetableEntries} créneaux, ${timetableVersions} versions) | Affectations: ${teachingAssignments} | Matières: ${classSubjects} | Docs péda: ${pedagogicalDocuments} | Fiches: ${pedagogicalSheets} | Journaux: ${lessonJournals} | Validations: ${lessonJournalValidations} | Cahiers: ${classDiaries + cahierJournals}`,
      anomalies,
      kpis: [
        { name: 'Taux de couverture des cours', value: teachingAssignments > 0 ? `${Math.round(((teachingAssignments - missingAssignments) / teachingAssignments) * 100)}%` : 'N/A', interpretation: missingAssignments > 0 ? 'CRITIQUE' : 'OK' },
        { name: 'Validations en attente', value: `${pendingValidations}`, interpretation: pendingValidations > 5 ? 'ATTENTION' : 'OK' },
        { name: 'Documents pédagogiques', value: `${pedagogicalDocuments + pedagogicalSheets}`, interpretation: pedagogicalDocuments + pedagogicalSheets === 0 ? 'INFO' : 'OK' },
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE 2 : ÉLÈVES & SCOLARITÉ
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Scan du module Élèves & Scolarité.
   *
   * Couvre :
   *   - Inscriptions (Admission, StudentEnrollment)
   *   - Dossiers élèves (Student, StudentPhoto, StudentIdentifier)
   *   - Transferts (TransferRequest, ClassTransfer)
   *   - Cartes scolaires (StudentIdCard)
   *   - Export Educmaster (NationalExportLog)
   *   - Absences (Absence, AttendanceRecord)
   *   - Discipline (Discipline, DisciplinaryAction)
   */
  async scanStudents(
    tenantFilter: any,
    tenantYearFilter: any,
  ): Promise<ModuleContext> {
    const [
      studentsTotal,
      studentsActive,
      admissions,
      enrollments,
      transferRequests,
      classTransfers,
      idCards,
      nationalExports,
      absences,
      attendanceRecords,
      disciplines,
      disciplinaryActions,
      incompleteDossiers,
      admissionsPending,
    ] = await Promise.all([
      this.safeCount(this.prisma.student, tenantFilter),
      this.safeCount(this.prisma.student, { ...tenantFilter, status: 'ACTIVE', isActive: true }),
      this.safeCount(this.prisma.admission, tenantYearFilter),
      this.safeCount(this.prisma.studentEnrollment, tenantYearFilter),
      this.safeCount(this.prisma.transferRequest, tenantFilter),
      this.safeCount(this.prisma.classTransfer, tenantYearFilter),
      this.safeCount(this.prisma.studentIdCard, tenantYearFilter),
      this.safeCount(this.prisma.nationalExportLog, tenantFilter),
      this.safeCount(this.prisma.absence, tenantYearFilter),
      this.safeCount(this.prisma.attendanceRecord, tenantYearFilter),
      this.safeCount(this.prisma.discipline, tenantYearFilter),
      this.safeCount(this.prisma.disciplinaryAction, tenantYearFilter),
      this.safeCount(this.prisma.student, { ...tenantFilter, status: 'INCOMPLETE' }),
      this.safeCount(this.prisma.admission, { ...tenantYearFilter, status: 'PENDING' }),
    ]);

    const anomalies: ModuleContext['anomalies'] = [];

    if (studentsActive === 0) {
      anomalies.push({ severity: 'CRITIQUE', message: "Aucun élève actif dans l'établissement" });
    }
    if (admissionsPending > 0) {
      anomalies.push({ severity: 'ATTENTION', message: `${admissionsPending} admission(s) en attente de validation` });
    }
    if (incompleteDossiers > 0) {
      anomalies.push({ severity: 'ATTENTION', message: `${incompleteDossiers} dossier(s) élève incomplet(s)` });
    }
    if (studentsActive > 0 && idCards === 0) {
      anomalies.push({ severity: 'INFO', message: 'Aucune carte scolaire générée malgré des élèves actifs' });
    }
    const absenceRate = studentsActive > 0 ? (absences / studentsActive) * 100 : 0;
    if (absenceRate > 15) {
      anomalies.push({ severity: 'ATTENTION', message: `Taux d'absence élevé : ${absenceRate.toFixed(1)}%` });
    }
    if (disciplinaryActions > 0) {
      anomalies.push({ severity: 'INFO', message: `${disciplinaryActions} action(s) disciplinaire(s) enregistrée(s)` });
    }

    return {
      name: 'Élèves & Scolarité',
      summary: `Élèves: ${studentsTotal} (${studentsActive} actifs) | Admissions: ${admissions} | Inscriptions: ${enrollments} | Transferts: ${transferRequests + classTransfers} | Cartes: ${idCards} | Exports Educmaster: ${nationalExports} | Absences: ${absences} | Discipline: ${disciplines + disciplinaryActions} | Dossiers incomplets: ${incompleteDossiers}`,
      anomalies,
      kpis: [
        { name: "Taux d'absence", value: `${absenceRate.toFixed(1)}%`, interpretation: absenceRate > 15 ? 'ATTENTION' : 'OK' },
        { name: 'Taux de cartes émises', value: studentsActive > 0 ? `${Math.round((idCards / studentsActive) * 100)}%` : 'N/A' },
        { name: 'Admissions en attente', value: `${admissionsPending}`, interpretation: admissionsPending > 0 ? 'ATTENTION' : 'OK' },
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE 3 : FINANCE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Scan du module Finance & Économat.
   *
   * Couvre :
   *   - Frais & configuration (FeeConfiguration, FeeStructure, FeeDefinition)
   *   - Personnalisations (FeeOverride, FeeRegime)
   *   - Multi-caisses (CashRegister, CashClosure)
   *   - Encaissements (Payment, PaymentFlow, OnlinePayment)
   *   - Bilans d'encaissement (PaymentSummary, DailyClosure)
   *   - Recouvrements (CollectionAction, CollectionCase, CollectionReminder)
   *   - Arriérés (FeeArrear, ArrearTransfer)
   *   - Dépenses (Expense, FinanceExpense, FinanceTransaction)
   *   - Clôtures de trésorerie (FinanceDailyClosure, TreasuryMovement)
   *   - Anomalies financières (FinancialAnomaly)
   */
  async scanFinance(
    tenantFilter: any,
    tenantYearFilter: any,
  ): Promise<ModuleContext> {
    const [
      feeConfigs,
      feeStructures,
      feeDefinitions,
      feeOverrides,
      cashRegisters,
      cashClosures,
      payments,
      onlinePayments,
      paymentFlows,
      dailyClosures,
      collectionActions,
      collectionCases,
      collectionReminders,
      feeArrears,
      expenses,
      financeExpenses,
      financeTransactions,
      treasuryMovements,
      financeDailyClosures,
      financialAnomalies,
      paymentPlans,
      totalPaymentsAmount,
      totalExpensesAmount,
      totalArrearsAmount,
    ] = await Promise.all([
      this.safeCount(this.prisma.feeConfiguration, tenantFilter),
      this.safeCount(this.prisma.feeStructure, tenantFilter),
      this.safeCount(this.prisma.feeDefinition, tenantFilter),
      this.safeCount(this.prisma.feeOverride, tenantFilter),
      this.safeCount(this.prisma.cashRegister, tenantFilter),
      this.safeCount(this.prisma.cashClosure, tenantYearFilter),
      this.safeCount(this.prisma.payment, tenantYearFilter),
      this.safeCount(this.prisma.onlinePayment, tenantYearFilter),
      this.safeCount(this.prisma.paymentFlow, tenantYearFilter),
      this.safeCount(this.prisma.dailyClosure, tenantYearFilter),
      this.safeCount(this.prisma.collectionAction, tenantYearFilter),
      this.safeCount(this.prisma.collectionCase, tenantYearFilter),
      this.safeCount(this.prisma.collectionReminder, tenantYearFilter),
      this.safeCount(this.prisma.feeArrear, tenantYearFilter),
      this.safeCount(this.prisma.expense, tenantYearFilter),
      this.safeCount(this.prisma.financeExpense, tenantYearFilter),
      this.safeCount(this.prisma.financeTransaction, tenantYearFilter),
      this.safeCount(this.prisma.treasuryMovement, tenantYearFilter),
      this.safeCount(this.prisma.financeDailyClosure, tenantYearFilter),
      this.safeCount(this.prisma.financialAnomaly, tenantFilter),
      this.safeCount(this.prisma.paymentPlan, tenantFilter),
      this.safeAggregate(this.prisma.payment, { where: tenantYearFilter, _sum: { amount: true } }),
      this.safeAggregate(this.prisma.expense, { where: tenantYearFilter, _sum: { amount: true } }),
      this.safeAggregate(this.prisma.feeArrear, { where: tenantYearFilter, _sum: { amount: true } }),
    ]);

    const anomalies: ModuleContext['anomalies'] = [];

    if (feeConfigs === 0) {
      anomalies.push({ severity: 'CRITIQUE', message: 'Aucune configuration de frais — les paiements ne peuvent pas être encaissés' });
    }
    if (paymentPlans === 0) {
      anomalies.push({ severity: 'ATTENTION', message: "Aucun plan de paiement configuré alors qu'il y a des élèves actifs" });
    }
    if (feeArrears > 0) {
      anomalies.push({ severity: 'ATTENTION', message: `${feeArrears} arriéré(s) de paiement — ${totalArrearsAmount} FCFA en attente` });
    }
    if (financialAnomalies > 0) {
      anomalies.push({ severity: 'CRITIQUE', message: `${financialAnomalies} anomalie(s) financière(s) détectée(s)` });
    }
    if (totalExpensesAmount > totalPaymentsAmount && totalPaymentsAmount > 0) {
      anomalies.push({ severity: 'ATTENTION', message: `Dépenses (${totalExpensesAmount} FCFA) > Encaissements (${totalPaymentsAmount} FCFA) — déficit opérationnel` });
    }
    if (cashRegisters === 0 && payments > 0) {
      anomalies.push({ severity: 'INFO', message: 'Aucune caisse configurée malgré des paiements enregistrés' });
    }
    if (collectionCases > 0) {
      anomalies.push({ severity: 'INFO', message: `${collectionCases} dossier(s) de recouvrement en cours` });
    }

    const coverageRatio = totalPaymentsAmount > 0 ? (totalPaymentsAmount / (totalPaymentsAmount + totalArrearsAmount)) * 100 : 0;

    return {
      name: 'Finance & Économat',
      summary: `Frais config: ${feeConfigs} | Structures: ${feeStructures} | Caisses: ${cashRegisters} | Paiements: ${payments} (${totalPaymentsAmount} FCFA) | Online: ${onlinePayments} | Arriérés: ${feeArrears} (${totalArrearsAmount} FCFA) | Dépenses: ${expenses + financeExpenses} (${totalExpensesAmount} FCFA) | Recouvrements: ${collectionActions + collectionCases} | Clôtures: ${cashClosures + financeDailyClosures} | Anomalies: ${financialAnomalies}`,
      anomalies,
      kpis: [
        { name: 'Taux de recouvrement', value: `${coverageRatio.toFixed(1)}%`, interpretation: coverageRatio < 70 ? 'CRITIQUE' : coverageRatio < 90 ? 'ATTENTION' : 'OK' },
        { name: 'Solde opérationnel', value: `${totalPaymentsAmount - totalExpensesAmount} FCFA`, interpretation: totalPaymentsAmount < totalExpensesAmount ? 'CRITIQUE' : 'OK' },
        { name: 'Arriérés', value: `${feeArrears} (${totalArrearsAmount} FCFA)`, interpretation: feeArrears > 0 ? 'ATTENTION' : 'OK' },
        { name: 'Anomalies financières', value: `${financialAnomalies}`, interpretation: financialAnomalies > 0 ? 'CRITIQUE' : 'OK' },
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE 4 : EXAMENS & NOTES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Scan du module Examens, Notes & Bulletins.
   *
   * Couvre :
   *   - Examens (Exam, ExamSession, ExamComposition)
   *   - Notes (Grade, ExamScore, AcademicScore)
   *   - Bulletins (ReportCard, ReportCardItem)
   *   - Calculs (GradeCalculation, GradeValidationBatch)
   *   - Déliberations (ExamDeliberation, ExamDeliberationCase)
   *   - Corrections (GradeCorrectionRequest)
   *   - Verrous (GradeLock)
   *   - Honneurs (HonorRoll, Ranking)
   */
  async scanExams(
    tenantFilter: any,
    tenantYearFilter: any,
  ): Promise<ModuleContext> {
    const [
      exams,
      examSessions,
      grades,
      examScores,
      reportCards,
      reportCardItems,
      gradeCalculations,
      gradeValidationBatches,
      examDeliberations,
      gradeCorrections,
      gradeLocks,
      honorRolls,
      rankings,
      pendingGrades,
      publishedReportCards,
    ] = await Promise.all([
      this.safeCount(this.prisma.exam, tenantYearFilter),
      this.safeCount(this.prisma.examSession, tenantYearFilter),
      this.safeCount(this.prisma.grade, tenantYearFilter),
      this.safeCount(this.prisma.examScore, tenantYearFilter),
      this.safeCount(this.prisma.reportCard, tenantYearFilter),
      this.safeCount(this.prisma.reportCardItem, tenantYearFilter),
      this.safeCount(this.prisma.gradeCalculation, tenantYearFilter),
      this.safeCount(this.prisma.gradeValidationBatch, tenantYearFilter),
      this.safeCount(this.prisma.examDeliberation, tenantYearFilter),
      this.safeCount(this.prisma.gradeCorrectionRequest, tenantYearFilter),
      this.safeCount(this.prisma.gradeLock, tenantYearFilter),
      this.safeCount(this.prisma.honorRoll, tenantYearFilter),
      this.safeCount(this.prisma.ranking, tenantYearFilter),
      this.safeCount(this.prisma.grade, { ...tenantYearFilter, status: 'PENDING' }),
      this.safeCount(this.prisma.reportCard, { ...tenantYearFilter, status: 'PUBLISHED' }),
    ]);

    const anomalies: ModuleContext['anomalies'] = [];

    if (exams === 0) {
      anomalies.push({ severity: 'INFO', message: 'Aucun examen configuré pour la période' });
    }
    if (grades === 0 && exams > 0) {
      anomalies.push({ severity: 'ATTENTION', message: 'Examens configurés mais aucune note saisie' });
    }
    if (pendingGrades > 0) {
      anomalies.push({ severity: 'ATTENTION', message: `${pendingGrades} note(s) en attente de validation` });
    }
    if (gradeCorrections > 0) {
      anomalies.push({ severity: 'INFO', message: `${gradeCorrections} demande(s) de correction de note` });
    }
    if (exams > 0 && reportCards === 0) {
      anomalies.push({ severity: 'ATTENTION', message: 'Notes saisies mais aucun bulletin généré' });
    }
    if (examDeliberations > 0) {
      anomalies.push({ severity: 'INFO', message: `${examDeliberations} délibération(s) enregistrée(s)` });
    }

    return {
      name: 'Examens & Notes',
      summary: `Examens: ${exams} (${examSessions} sessions) | Notes: ${grades + examScores} | Bulletins: ${reportCards} (${publishedReportCards} publiés) | Calculs: ${gradeCalculations} | Validations: ${gradeValidationBatches} | Délibérations: ${examDeliberations} | Corrections: ${gradeCorrections} | Verrous: ${gradeLocks} | Honneurs: ${honorRolls} | Classements: ${rankings}`,
      anomalies,
      kpis: [
        { name: 'Taux de saisie des notes', value: exams > 0 ? `${Math.round((grades / (exams * 10)) * 100)}%` : 'N/A' },
        { name: 'Bulletins publiés', value: `${publishedReportCards}/${reportCards}`, interpretation: reportCards > 0 && publishedReportCards === 0 ? 'ATTENTION' : 'OK' },
        { name: 'Notes en attente', value: `${pendingGrades}`, interpretation: pendingGrades > 0 ? 'ATTENTION' : 'OK' },
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE 5 : PERSONNEL & RH
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Scan du module Personnel & RH.
   *
   * Couvre :
   *   - Contrats (Contract, ContractAmendment)
   *   - Congés (LeaveRequest)
   *   - Paie (Payroll, PayrollItem, SalarySlip, SalaryPayment)
   *   - CNSS (CNSSDeclaration, EmployeeCNSS)
   *   - Candidats (HrCandidate, HrApplication, HrInterview)
   *   - Offres (HrJob)
   *   - Heures supp (OvertimeRecord)
   *   - Politiques (SalaryPolicy, AllowanceType)
   */
  async scanHR(
    tenantFilter: any,
    tenantYearFilter: any,
  ): Promise<ModuleContext> {
    const [
      teachers,
      contracts,
      contractAmendments,
      leaveRequests,
      payrolls,
      salarySlips,
      salaryPayments,
      cnssDeclarations,
      employeeCNSS,
      hrCandidates,
      hrApplications,
      hrInterviews,
      hrJobs,
      overtimeRecords,
      pendingLeaves,
      contractsExpiringSoon,
    ] = await Promise.all([
      this.safeCount(this.prisma.teacher, tenantFilter),
      this.safeCount(this.prisma.contract, tenantFilter),
      this.safeCount(this.prisma.contractAmendment, tenantFilter),
      this.safeCount(this.prisma.leaveRequest, tenantYearFilter),
      this.safeCount(this.prisma.payroll, tenantYearFilter),
      this.safeCount(this.prisma.salarySlip, tenantYearFilter),
      this.safeCount(this.prisma.salaryPayment, tenantYearFilter),
      this.safeCount(this.prisma.cNSSDeclaration, tenantYearFilter),
      this.safeCount(this.prisma.employeeCNSS, tenantFilter),
      this.safeCount(this.prisma.hrCandidate, tenantFilter),
      this.safeCount(this.prisma.hrApplication, tenantFilter),
      this.safeCount(this.prisma.hrInterview, tenantFilter),
      this.safeCount(this.prisma.hrJob, tenantFilter),
      this.safeCount(this.prisma.overtimeRecord, tenantYearFilter),
      this.safeCount(this.prisma.leaveRequest, { ...tenantYearFilter, status: 'PENDING' }),
      this.safeCount(this.prisma.contract, { ...tenantFilter, endDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } }),
    ]);

    const anomalies: ModuleContext['anomalies'] = [];

    if (teachers > 0 && contracts === 0) {
      anomalies.push({ severity: 'ATTENTION', message: `${teachers} enseignant(s) sans contrat enregistré` });
    }
    if (pendingLeaves > 0) {
      anomalies.push({ severity: 'INFO', message: `${pendingLeaves} demande(s) de congé en attente` });
    }
    if (contractsExpiringSoon > 0) {
      anomalies.push({ severity: 'ATTENTION', message: `${contractsExpiringSoon} contrat(s) arrivant à échéance dans 30 jours` });
    }
    if (cnssDeclarations === 0 && teachers > 0) {
      anomalies.push({ severity: 'INFO', message: 'Aucune déclaration CNSS pour la période' });
    }
    if (salarySlips === 0 && teachers > 0) {
      anomalies.push({ severity: 'ATTENTION', message: 'Aucune fiche de paie générée pour la période' });
    }

    const contractRate = teachers > 0 ? Math.round((contracts / teachers) * 100) : 0;

    return {
      name: 'Personnel & RH',
      summary: `Enseignants: ${teachers} | Contrats: ${contracts} (${contractAmendments} avenants) | Congés: ${leaveRequests} | Paies: ${payrolls} | Fiches: ${salarySlips} | Paiements: ${salaryPayments} | CNSS: ${cnssDeclarations} (${employeeCNSS} employés) | Candidats: ${hrCandidates} | Candidatures: ${hrApplications} | Entretiens: ${hrInterviews} | Offres: ${hrJobs} | Heures supp: ${overtimeRecords}`,
      anomalies,
      kpis: [
        { name: 'Taux de contractualisation', value: `${contractRate}%`, interpretation: contractRate < 80 ? 'ATTENTION' : 'OK' },
        { name: 'Congés en attente', value: `${pendingLeaves}`, interpretation: pendingLeaves > 5 ? 'ATTENTION' : 'OK' },
        { name: 'Contrats à échéance <30j', value: `${contractsExpiringSoon}`, interpretation: contractsExpiringSoon > 0 ? 'ATTENTION' : 'OK' },
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE 6 : COMMUNICATION
  // ═══════════════════════════════════════════════════════════════════════

  async scanCommunication(
    tenantFilter: any,
    tenantYearFilter: any,
  ): Promise<ModuleContext> {
    const [
      messages,
      messageLogs,
      whatsappLogs,
      emailLogs,
      pushNotifications,
      scheduledMessages,
      messageTemplates,
      announcements,
      failedMessages,
      pendingScheduled,
    ] = await Promise.all([
      this.safeCount(this.prisma.message, tenantYearFilter),
      this.safeCount(this.prisma.messageLog, tenantYearFilter),
      this.safeCount(this.prisma.whatsappLog, tenantYearFilter),
      this.safeCount(this.prisma.emailLog, tenantYearFilter),
      this.safeCount(this.prisma.pushNotification, tenantYearFilter),
      this.safeCount(this.prisma.scheduledMessage, tenantYearFilter),
      this.safeCount(this.prisma.messageTemplate, tenantFilter),
      this.safeCount(this.prisma.announcement, tenantFilter),
      this.safeCount(this.prisma.messageLog, { ...tenantYearFilter, status: 'FAILED' }),
      this.safeCount(this.prisma.scheduledMessage, { ...tenantYearFilter, status: 'PENDING' }),
    ]);

    const anomalies: ModuleContext['anomalies'] = [];

    if (failedMessages > 0) {
      anomalies.push({ severity: 'ATTENTION', message: `${failedMessages} message(s) en échec d'envoi` });
    }
    if (pendingScheduled > 0) {
      anomalies.push({ severity: 'INFO', message: `${pendingScheduled} message(s) programmé(s) en attente d'envoi` });
    }
    if (messages === 0) {
      anomalies.push({ severity: 'INFO', message: 'Aucune communication envoyée pour la période' });
    }

    const failureRate = messages > 0 ? (failedMessages / messages) * 100 : 0;

    return {
      name: 'Communication',
      summary: `Messages: ${messages} | SMS: ${messageLogs} | WhatsApp: ${whatsappLogs} | Emails: ${emailLogs} | Push: ${pushNotifications} | Programmés: ${scheduledMessages} | Modèles: ${messageTemplates} | Annonces: ${announcements} | Échecs: ${failedMessages}`,
      anomalies,
      kpis: [
        { name: "Taux d'échec", value: `${failureRate.toFixed(1)}%`, interpretation: failureRate > 10 ? 'ATTENTION' : 'OK' },
        { name: 'Messages programmés', value: `${pendingScheduled}`, interpretation: pendingScheduled > 0 ? 'INFO' : 'OK' },
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE 7 : QHSE
  // ═══════════════════════════════════════════════════════════════════════

  async scanQHSE(
    tenantFilter: any,
    tenantYearFilter: any,
  ): Promise<ModuleContext> {
    const [
      incidents,
      qhsIncidents,
      audits,
      hygieneInspections,
      securityControls,
      healthVisits,
      risks,
      actionPlans,
      complianceRecords,
      periodicControls,
      openIncidents,
      criticalIncidents,
    ] = await Promise.all([
      this.safeCount(this.prisma.qHSEIncident, tenantYearFilter),
      this.safeCount(this.prisma.qhsIncident, tenantYearFilter),
      this.safeCount(this.prisma.qHSEAudit, tenantYearFilter),
      this.safeCount(this.prisma.qHSEHygieneInspection, tenantYearFilter),
      this.safeCount(this.prisma.qHSESecurityControl, tenantYearFilter),
      this.safeCount(this.prisma.qHSEHealthVisit, tenantYearFilter),
      this.safeCount(this.prisma.qHSERisk, tenantFilter),
      this.safeCount(this.prisma.qHSEActionPlan, tenantYearFilter),
      this.safeCount(this.prisma.qHSECompliance, tenantFilter),
      this.safeCount(this.prisma.qHSEPeriodicControl, tenantYearFilter),
      this.safeCount(this.prisma.qHSEIncident, { ...tenantYearFilter, status: 'OPEN' }),
      this.safeCount(this.prisma.qHSEIncident, { ...tenantYearFilter, severity: 'CRITICAL' }),
    ]);

    const anomalies: ModuleContext['anomalies'] = [];

    if (criticalIncidents > 0) {
      anomalies.push({ severity: 'CRITIQUE', message: `${criticalIncidents} incident(s) CRITIQUE(S) QHSE non résolu(s)` });
    }
    if (openIncidents > 5) {
      anomalies.push({ severity: 'ATTENTION', message: `${openIncidents} incidents QHSE ouverts` });
    }
    if (incidents === 0) {
      anomalies.push({ severity: 'INFO', message: 'Aucun incident QHSE enregistré — bonne conformité ou sous-déclaration ?' });
    }

    return {
      name: 'QHSE & Incidents',
      summary: `Incidents: ${incidents + qhsIncidents} (${openIncidents} ouverts, ${criticalIncidents} critiques) | Audits: ${audits} | Hygiène: ${hygieneInspections} | Sécurité: ${securityControls} | Visites médicales: ${healthVisits} | Risques: ${risks} | Plans d'action: ${actionPlans} | Conformité: ${complianceRecords} | Contrôles: ${periodicControls}`,
      anomalies,
      kpis: [
        { name: 'Incidents critiques', value: `${criticalIncidents}`, interpretation: criticalIncidents > 0 ? 'CRITIQUE' : 'OK' },
        { name: 'Incidents ouverts', value: `${openIncidents}`, interpretation: openIncidents > 5 ? 'ATTENTION' : 'OK' },
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE 8 : PARAMÈTRES
  // ═══════════════════════════════════════════════════════════════════════

  async scanSettings(tenantFilter: any): Promise<ModuleContext> {
    const [
      tenantSettings,
      tenantFeatures,
      schoolSettings,
      academicSettings,
      roles,
      permissions,
      auditLogs,
      recentAuditLogs,
      securitySettings,
      financialSettings,
    ] = await Promise.all([
      this.safeCount(this.prisma.tenantSetting, tenantFilter),
      this.safeCount(this.prisma.tenantFeature, tenantFilter),
      this.safeCount(this.prisma.schoolSettings, tenantFilter),
      this.safeCount(this.prisma.schoolAcademicSettings, tenantFilter),
      this.safeCount(this.prisma.role, tenantFilter),
      this.safeCount(this.prisma.permission, tenantFilter),
      this.safeCount(this.prisma.auditLog, tenantFilter),
      this.safeCount(this.prisma.auditLog, {
        ...tenantFilter,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
      this.safeCount(this.prisma.securitySettings, tenantFilter),
      this.safeCount(this.prisma.financialSettings, tenantFilter),
    ]);

    const anomalies: ModuleContext['anomalies'] = [];

    if (roles === 0) {
      anomalies.push({ severity: 'ATTENTION', message: 'Aucun rôle configuré — RBAC non fonctionnel' });
    }
    if (auditLogs < 30) {
      anomalies.push({ severity: 'INFO', message: `Faible activité d'audit (${auditLogs} actions au total) — traçabilité limitée` });
    }
    if (tenantSettings === 0) {
      anomalies.push({ severity: 'INFO', message: 'Paramètres du tenant non configurés' });
    }

    return {
      name: 'Paramètres',
      summary: `Settings: ${tenantSettings} | Features: ${tenantFeatures} | Roles: ${roles} | Permissions: ${permissions} | Audit logs: ${auditLogs} (${recentAuditLogs} cette semaine) | Sécurité: ${securitySettings} | Finance: ${financialSettings}`,
      anomalies,
      kpis: [
        { name: 'Activité audit (7j)', value: `${recentAuditLogs}`, interpretation: recentAuditLogs < 10 ? 'ATTENTION' : 'OK' },
        { name: 'Rôles configurés', value: `${roles}`, interpretation: roles === 0 ? 'ATTENTION' : 'OK' },
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE 9 : CANTINE
  // ═══════════════════════════════════════════════════════════════════════

  async scanCanteen(
    tenantFilter: any,
    tenantYearFilter: any,
  ): Promise<ModuleContext> {
    const [
      menus,
      enrollments,
      payments,
      mealServices,
      attendance,
      incidents,
      stockMovements,
      suppliers,
      purchaseOrders,
      reports,
      pendingPayments,
    ] = await Promise.all([
      this.safeCount(this.prisma.canteenMenu, tenantFilter),
      this.safeCount(this.prisma.canteenEnrollment, tenantYearFilter),
      this.safeCount(this.prisma.canteenPayment, tenantYearFilter),
      this.safeCount(this.prisma.canteenMealService, tenantYearFilter),
      this.safeCount(this.prisma.canteenAttendance, tenantYearFilter),
      this.safeCount(this.prisma.canteenIncident, tenantYearFilter),
      this.safeCount(this.prisma.canteenStockMovement, tenantYearFilter),
      this.safeCount(this.prisma.canteenSupplier, tenantFilter),
      this.safeCount(this.prisma.canteenPurchaseOrder, tenantYearFilter),
      this.safeCount(this.prisma.canteenReport, tenantYearFilter),
      this.safeCount(this.prisma.canteenPayment, { ...tenantYearFilter, status: 'PENDING' }),
    ]);

    const anomalies: ModuleContext['anomalies'] = [];

    if (menus === 0) {
      anomalies.push({ severity: 'INFO', message: 'Aucun menu de cantine configuré' });
    }
    if (pendingPayments > 0) {
      anomalies.push({ severity: 'ATTENTION', message: `${pendingPayments} paiement(s) cantine en attente` });
    }
    if (incidents > 0) {
      anomalies.push({ severity: 'INFO', message: `${incidents} incident(s) cantine (allergies, etc.)` });
    }

    return {
      name: 'Cantine',
      summary: `Menus: ${menus} | Inscriptions: ${enrollments} | Paiements: ${payments} | Services: ${mealServices} | Présences: ${attendance} | Incidents: ${incidents} | Stocks: ${stockMovements} | Fournisseurs: ${suppliers} | Commandes: ${purchaseOrders} | Rapports: ${reports}`,
      anomalies,
      kpis: [
        { name: 'Paiements en attente', value: `${pendingPayments}`, interpretation: pendingPayments > 0 ? 'ATTENTION' : 'OK' },
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE 10 : EDUCAST
  // ═══════════════════════════════════════════════════════════════════════

  async scanEduCast(tenantFilter: any): Promise<ModuleContext> {
    const [
      teacherChannels,
      subscribers,
      mediaItems,
      resources,
      webinars,
      purchases,
      payoutRequests,
      playlists,
      engagements,
      reports,
    ] = await Promise.all([
      this.safeCount(this.prisma.eduCastTeacherChannel, tenantFilter),
      this.safeCount(this.prisma.eduCastChannelSubscriber, tenantFilter),
      this.safeCount(this.prisma.eduCastMediaItem, tenantFilter),
      this.safeCount(this.prisma.eduCastResource, tenantFilter),
      this.safeCount(this.prisma.eduCastWebinar, tenantFilter),
      this.safeCount(this.prisma.eduCastPurchase, tenantFilter),
      this.safeCount(this.prisma.eduCastPayoutRequest, tenantFilter),
      this.safeCount(this.prisma.eduCastPlaylist, tenantFilter),
      this.safeCount(this.prisma.eduCastEngagement, tenantFilter),
      this.safeCount(this.prisma.eduCastReport, tenantFilter),
    ]);

    const anomalies: ModuleContext['anomalies'] = [];

    if (teacherChannels === 0) {
      anomalies.push({ severity: 'INFO', message: 'Aucune chaîne EduCast créée par les enseignants' });
    }
    if (payoutRequests > 0) {
      anomalies.push({ severity: 'INFO', message: `${payoutRequests} demande(s) de paiement EduCast en attente` });
    }

    return {
      name: 'EduCast',
      summary: `Chaînes: ${teacherChannels} | Abonnés: ${subscribers} | Médias: ${mediaItems} | Ressources: ${resources} | Webinaires: ${webinars} | Achats: ${purchases} | Paiements: ${payoutRequests} | Playlists: ${playlists} | Engagements: ${engagements} | Rapports: ${reports}`,
      anomalies,
      kpis: [
        { name: 'Chaînes actives', value: `${teacherChannels}`, interpretation: teacherChannels === 0 ? 'INFO' : 'OK' },
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE 11 : BOUTIQUE
  // ═══════════════════════════════════════════════════════════════════════

  async scanShop(tenantFilter: any): Promise<ModuleContext> {
    const [
      products,
      categories,
      orders,
      orderItems,
      discounts,
      loyaltyCards,
      deliveries,
      purchaseOrders,
      pendingOrders,
      lowStockProducts,
    ] = await Promise.all([
      this.safeCount(this.prisma.shopProduct, tenantFilter),
      this.safeCount(this.prisma.shopCategory, tenantFilter),
      this.safeCount(this.prisma.shopOrder, tenantFilter),
      this.safeCount(this.prisma.shopOrderItem, tenantFilter),
      this.safeCount(this.prisma.shopDiscount, tenantFilter),
      this.safeCount(this.prisma.shopLoyaltyCard, tenantFilter),
      this.safeCount(this.prisma.shopDelivery, tenantFilter),
      this.safeCount(this.prisma.shopPurchaseOrder, tenantFilter),
      this.safeCount(this.prisma.shopOrder, { ...tenantFilter, status: 'PENDING' }),
      this.safeCount(this.prisma.shopProduct, { ...tenantFilter, stock: { lte: 5 } }),
    ]);

    const anomalies: ModuleContext['anomalies'] = [];

    if (products === 0) {
      anomalies.push({ severity: 'INFO', message: 'Aucun produit en boutique' });
    }
    if (pendingOrders > 0) {
      anomalies.push({ severity: 'ATTENTION', message: `${pendingOrders} commande(s) boutique en attente` });
    }
    if (lowStockProducts > 0) {
      anomalies.push({ severity: 'ATTENTION', message: `${lowStockProducts} produit(s) en stock faible (≤5)` });
    }

    return {
      name: 'Boutique',
      summary: `Produits: ${products} | Catégories: ${categories} | Commandes: ${orders} | Articles: ${orderItems} | Remises: ${discounts} | Cartes fidélité: ${loyaltyCards} | Livraisons: ${deliveries} | Commandes fournisseur: ${purchaseOrders}`,
      anomalies,
      kpis: [
        { name: 'Commandes en attente', value: `${pendingOrders}`, interpretation: pendingOrders > 0 ? 'ATTENTION' : 'OK' },
        { name: 'Stocks faibles', value: `${lowStockProducts}`, interpretation: lowStockProducts > 0 ? 'ATTENTION' : 'OK' },
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE 12 : TRANSPORT
  // ═══════════════════════════════════════════════════════════════════════

  async scanTransport(
    tenantFilter: any,
    tenantYearFilter: any,
  ): Promise<ModuleContext> {
    const [
      trips,
      assignments,
      vehicles,
      drivers,
      attendants,
      zones,
      schedules,
      incidents,
      attendance,
    ] = await Promise.all([
      this.safeCount(this.prisma.transportTrip, tenantYearFilter),
      this.safeCount(this.prisma.transportAssignment, tenantYearFilter),
      this.safeCount(this.prisma.vehicle, tenantFilter),
      this.safeCount(this.prisma.transportDriver, tenantFilter),
      this.safeCount(this.prisma.transportAttendant, tenantFilter),
      this.safeCount(this.prisma.transportZone, tenantFilter),
      this.safeCount(this.prisma.transportSchedule, tenantFilter),
      this.safeCount(this.prisma.transportIncident, tenantYearFilter),
      this.safeCount(this.prisma.transportAttendance, tenantYearFilter),
    ]);

    const anomalies: ModuleContext['anomalies'] = [];

    if (trips === 0 && assignments > 0) {
      anomalies.push({ severity: 'INFO', message: 'Affectations transport sans trajets planifiés' });
    }
    if (incidents > 0) {
      anomalies.push({ severity: 'INFO', message: `${incidents} incident(s) transport` });
    }

    return {
      name: 'Transport',
      summary: `Trajets: ${trips} | Affectations: ${assignments} | Véhicules: ${vehicles} | Chauffeurs: ${drivers} | Accompagnateurs: ${attendants} | Zones: ${zones} | Horaires: ${schedules} | Incidents: ${incidents} | Présences: ${attendance}`,
      anomalies,
      kpis: [],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE 13 : INFIRMERIE
  // ═══════════════════════════════════════════════════════════════════════

  async scanInfirmary(
    tenantFilter: any,
    tenantYearFilter: any,
  ): Promise<ModuleContext> {
    const [
      visits,
      medicalRecords,
      emergencies,
      checkups,
      allergies,
      authorizations,
      medications,
      stockMovements,
      reports,
      accessLogs,
    ] = await Promise.all([
      this.safeCount(this.prisma.infirmaryVisit, tenantYearFilter),
      this.safeCount(this.prisma.infirmaryMedicalRecord, tenantFilter),
      this.safeCount(this.prisma.infirmaryEmergency, tenantYearFilter),
      this.safeCount(this.prisma.infirmaryCheckup, tenantYearFilter),
      this.safeCount(this.prisma.infirmaryAllergy, tenantFilter),
      this.safeCount(this.prisma.infirmaryAuthorization, tenantFilter),
      this.safeCount(this.prisma.medication, tenantFilter),
      this.safeCount(this.prisma.infirmaryMedicationMovement, tenantYearFilter),
      this.safeCount(this.prisma.infirmaryReport, tenantYearFilter),
      this.safeCount(this.prisma.infirmaryAccessLog, tenantYearFilter),
    ]);

    const anomalies: ModuleContext['anomalies'] = [];

    if (emergencies > 0) {
      anomalies.push({ severity: 'ATTENTION', message: `${emergencies} urgence(s) médicale(s) enregistrée(s)` });
    }
    if (visits === 0) {
      anomalies.push({ severity: 'INFO', message: 'Aucune visite à l\'infirmerie pour la période' });
    }

    return {
      name: 'Infirmerie',
      summary: `Visites: ${visits} | Dossiers médicaux: ${medicalRecords} | Urgences: ${emergencies} | Bilans: ${checkups} | Allergies: ${allergies} | Autorisations: ${authorizations} | Médicaments: ${medications} | Mouvements stock: ${stockMovements} | Rapports: ${reports}`,
      anomalies,
      kpis: [
        { name: 'Urgences', value: `${emergencies}`, interpretation: emergencies > 0 ? 'ATTENTION' : 'OK' },
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE 14 : BIBLIOTHÈQUE
  // ═══════════════════════════════════════════════════════════════════════

  async scanLibrary(
    tenantFilter: any,
    tenantYearFilter: any,
  ): Promise<ModuleContext> {
    const [
      books,
      copies,
      loans,
      penalties,
      reservations,
      categories,
      digitalResources,
      recommendations,
      reports,
      overdueLoans,
    ] = await Promise.all([
      this.safeCount(this.prisma.libraryBook, tenantFilter),
      this.safeCount(this.prisma.libraryCopy, tenantFilter),
      this.safeCount(this.prisma.libraryLoan, tenantYearFilter),
      this.safeCount(this.prisma.libraryPenalty, tenantYearFilter),
      this.safeCount(this.prisma.libraryReservation, tenantYearFilter),
      this.safeCount(this.prisma.libraryCategory, tenantFilter),
      this.safeCount(this.prisma.libraryDigitalResource, tenantFilter),
      this.safeCount(this.prisma.libraryRecommendation, tenantFilter),
      this.safeCount(this.prisma.libraryReport, tenantYearFilter),
      this.safeCount(this.prisma.libraryLoan, {
        ...tenantYearFilter,
        dueDate: { lt: new Date() },
        returnedAt: null,
      }),
    ]);

    const anomalies: ModuleContext['anomalies'] = [];

    if (overdueLoans > 0) {
      anomalies.push({ severity: 'ATTENTION', message: `${overdueLoans} prêt(s) en retard — relance nécessaire` });
    }
    if (penalties > 0) {
      anomalies.push({ severity: 'INFO', message: `${penalties} pénalité(s) de bibliothèque` });
    }
    if (books === 0) {
      anomalies.push({ severity: 'INFO', message: 'Bibliothèque vide — aucun livre catalogué' });
    }

    return {
      name: 'Bibliothèque',
      summary: `Livres: ${books} | Exemplaires: ${copies} | Prêts: ${loans} | Pénalités: ${penalties} | Réservations: ${reservations} | Catégories: ${categories} | Ressources numériques: ${digitalResources} | Recommandations: ${recommendations} | Rapports: ${reports}`,
      anomalies,
      kpis: [
        { name: 'Prêts en retard', value: `${overdueLoans}`, interpretation: overdueLoans > 0 ? 'ATTENTION' : 'OK' },
      ],
    };
  }

  /**
   * Génère un résumé textuel complet du scan multi-module pour injection
   * dans le prompt système d'ORION.
   */
  formatScanForPrompt(scan: FullModuleScan): string {
    const modules = [
      scan.pedagogy,
      scan.students,
      scan.finance,
      scan.exams,
      scan.hr,
      scan.communication,
      scan.qhse,
      scan.settings,
      scan.canteen,
      scan.educast,
      scan.shop,
      scan.transport,
      scan.infirmary,
      scan.library,
    ];

    let output = '';
    let totalAnomalies = 0;
    let criticalCount = 0;

    for (const mod of modules) {
      output += `\n【 ${mod.name.toUpperCase()} 】\n`;
      output += `${mod.summary}\n`;
      if (mod.anomalies.length > 0) {
        output += `Alertes:\n`;
        for (const a of mod.anomalies) {
          output += `  [${a.severity}] ${a.message}\n`;
          totalAnomalies++;
          if (a.severity === 'CRITIQUE') criticalCount++;
        }
      }
      if (mod.kpis.length > 0) {
        output += `KPIs:\n`;
        for (const k of mod.kpis) {
          output += `  ${k.name}: ${k.value}${k.interpretation ? ` (${k.interpretation})` : ''}\n`;
        }
      }
    }

    output += `\n【 RÉCAPITULATIF 】\n`;
    output += `Total anomalies: ${totalAnomalies} (dont ${criticalCount} CRITIQUES)\n`;

    return output;
  }
}
