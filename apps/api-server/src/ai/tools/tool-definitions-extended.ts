/**
 * ============================================================================
 * EXTENDED TOOL DEFINITIONS — Outils lecture seule pour tous les modules
 * ============================================================================
 *
 * Ce fichier contient les outils additionnels couvrant tous les modules
 * de la plateforme : Examens, Pédagogie, RH avancé, QHSE, Communication,
 * Réunions, Présences, Dashboard, Paramètres.
 *
 * TOUS les outils sont en LECTURE SEULE — aucun ne modifie les données.
 * L'agent ATLAS dispose d'outils d'exécution séparés (generate_document,
 * send_notification, trigger_atlas_workflow) qui nécessitent confirmation.
 */

import { PrismaService } from '../../database/prisma.service';
import {
  ToolDefinition,
  MCPContext,
  ToolResult,
} from '../types/ai.types';

// ─── SHARED HELPER ───────────────────────────────────────────────────────

function createToolResult(data: unknown, source: string, startTime: number, rowCount?: number): ToolResult {
  return {
    success: true,
    data,
    metadata: {
      queryTime: Date.now() - startTime,
      rowCount,
      source,
    },
  };
}

// ─── EXAM & GRADES TOOLS ─────────────────────────────────────────────────

export function createExamTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_exams',
      description: 'Récupère la liste des examens avec filtres optionnels par classe, matière, période ou type.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'EXAM',
      inputSchema: {
        type: 'object',
        properties: {
          classId: { type: 'string', description: 'ID de la classe (optionnel)' },
          subjectId: { type: 'string', description: 'ID de la matière (optionnel)' },
          period: { type: 'string', description: 'Période (optionnel, ex: "Trimestre 1")' },
          type: { type: 'string', enum: ['CONTINUOUS', 'COMPOSITION', 'EXAM_BLANC', 'CONCOURS'], description: 'Type d\'examen' },
          limit: { type: 'number', description: 'Nombre max de résultats (défaut: 20)' },
        },
      },
      requiredPermissions: ['grades.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const exams = await prisma.exam.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.classId ? { classId: params.classId as string } : {}),
            ...(params.subjectId ? { subjectId: params.subjectId as string } : {}),
            ...(params.type ? { type: params.type as string } : {}),
          },
          include: {
            subject: { select: { name: true } },
            class: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
          take: (params.limit as number) || 20,
        });
        return createToolResult(exams, 'get_exams', start, exams.length);
      },
    },
    {
      name: 'get_exam_statistics',
      description: 'Récupère les statistiques d\'un examen (moyenne, min, max, distribution des notes, taux de réussite).',
      version: '1.0.0',
      agent: 'ORION',
      category: 'EXAM',
      inputSchema: {
        type: 'object',
        properties: {
          examId: { type: 'string', description: 'ID de l\'examen (requis)' },
        },
        required: ['examId'],
      },
      requiredPermissions: ['grades.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const grades = await prisma.grade.findMany({
          where: {
            tenantId: context.schoolId,
            examId: params.examId as string,
          },
          select: { score: true, student: { select: { firstName: true, lastName: true } } },
        });

        if (grades.length === 0) {
          return createToolResult({ examId: params.examId, message: 'Aucune note trouvée' }, 'get_exam_statistics', start);
        }

        const scores = grades.map(g => g.score).filter((s): s is number => s !== null);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        const passRate = scores.filter(s => s >= 10).length / scores.length * 100;

        return createToolResult({
          examId: params.examId,
          totalStudents: grades.length,
          average: Math.round(avg * 100) / 100,
          min,
          max,
          passRate: Math.round(passRate * 10) / 10,
          distribution: {
            '0-5': scores.filter(s => s < 5).length,
            '5-10': scores.filter(s => s >= 5 && s < 10).length,
            '10-15': scores.filter(s => s >= 10 && s < 15).length,
            '15-20': scores.filter(s => s >= 15).length,
          },
        }, 'get_exam_statistics', start);
      },
    },
    {
      name: 'get_report_cards',
      description: 'Récupère les bulletins de notes d\'un élève ou d\'une classe.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'EXAM',
      inputSchema: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'ID de l\'élève (optionnel)' },
          classId: { type: 'string', description: 'ID de la classe (optionnel)' },
          period: { type: 'string', description: 'Période (optionnel)' },
        },
      },
      requiredPermissions: ['grades.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const reportCards = await prisma.reportCard.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.studentId ? { studentId: params.studentId as string } : {}),
            ...(params.classId ? { student: { classId: params.classId as string } } : {}),
            ...(params.period ? { period: params.period as string } : {}),
          },
          include: {
            student: { select: { firstName: true, lastName: true, matricule: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
        return createToolResult(reportCards, 'get_report_cards', start, reportCards.length);
      },
    },
    {
      name: 'get_honor_roll',
      description: 'Récupère le tableau d\'honneur pour une classe ou une période donnée.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'EXAM',
      inputSchema: {
        type: 'object',
        properties: {
          classId: { type: 'string', description: 'ID de la classe (optionnel)' },
          period: { type: 'string', description: 'Période (optionnel)' },
          limit: { type: 'number', description: 'Nombre max de résultats (défaut: 10)' },
        },
      },
      requiredPermissions: ['grades.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const honorRoll = await prisma.honorRoll.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.classId ? { classId: params.classId as string } : {}),
            ...(params.period ? { period: params.period as string } : {}),
          },
          include: {
            student: { select: { firstName: true, lastName: true, matricule: true, class: { select: { name: true } } } },
          },
          orderBy: { rank: 'asc' },
          take: (params.limit as number) || 10,
        });
        return createToolResult(honorRoll, 'get_honor_roll', start, honorRoll.length);
      },
    },
  ];
}

// ─── PEDAGOGY EXTENDED TOOLS ─────────────────────────────────────────────

export function createPedagogyExtendedTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_teaching_assignments',
      description: 'Récupère les affectations d\'enseignement (quel prof enseigne quelle matière dans quelle classe).',
      version: '1.0.0',
      agent: 'ORION',
      category: 'PEDAGOGY',
      inputSchema: {
        type: 'object',
        properties: {
          teacherId: { type: 'string', description: 'ID de l\'enseignant (optionnel)' },
          classId: { type: 'string', description: 'ID de la classe (optionnel)' },
          subjectId: { type: 'string', description: 'ID de la matière (optionnel)' },
        },
      },
      requiredPermissions: ['pedagogy.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const assignments = await prisma.teachingAssignment.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.teacherId ? { teacherId: params.teacherId as string } : {}),
            ...(params.classId ? { classId: params.classId as string } : {}),
            ...(params.subjectId ? { subjectId: params.subjectId as string } : {}),
          },
          include: {
            teacher: { select: { firstName: true, lastName: true } },
            class: { select: { name: true } },
            subject: { select: { name: true } },
          },
          take: 50,
        });
        return createToolResult(assignments, 'get_teaching_assignments', start, assignments.length);
      },
    },
    {
      name: 'get_timetable',
      description: 'Récupère l\'emploi du temps d\'une classe ou d\'un enseignant.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'PEDAGOGY',
      inputSchema: {
        type: 'object',
        properties: {
          classId: { type: 'string', description: 'ID de la classe (optionnel)' },
          teacherId: { type: 'string', description: 'ID de l\'enseignant (optionnel)' },
        },
      },
      requiredPermissions: ['pedagogy.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const timetables = await prisma.timetable.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.classId ? { classId: params.classId as string } : {}),
          },
          include: {
            class: { select: { name: true } },
            entries: {
              include: {
                subject: { select: { name: true } },
                teacher: { select: { firstName: true, lastName: true } },
                room: { select: { name: true } },
              },
              orderBy: { dayOfWeek: 'asc' },
            },
          },
          take: 5,
        });
        return createToolResult(timetables, 'get_timetable', start, timetables.length);
      },
    },
    {
      name: 'get_class_logs',
      description: 'Récupère les cahiers de texte / journaux de classe.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'PEDAGOGY',
      inputSchema: {
        type: 'object',
        properties: {
          classId: { type: 'string', description: 'ID de la classe (optionnel)' },
          teacherId: { type: 'string', description: 'ID de l\'enseignant (optionnel)' },
          limit: { type: 'number', description: 'Nombre max de résultats (défaut: 20)' },
        },
      },
      requiredPermissions: ['pedagogy.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const logs = await prisma.classLog.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.classId ? { classId: params.classId as string } : {}),
            ...(params.teacherId ? { teacherId: params.teacherId as string } : {}),
          },
          orderBy: { date: 'desc' },
          take: (params.limit as number) || 20,
        });
        return createToolResult(logs, 'get_class_logs', start, logs.length);
      },
    },
    {
      name: 'get_lesson_plans',
      description: 'Récupère les fiches de préparation / leçons planifiées.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'PEDAGOGY',
      inputSchema: {
        type: 'object',
        properties: {
          teacherId: { type: 'string', description: 'ID de l\'enseignant (optionnel)' },
          subjectId: { type: 'string', description: 'ID de la matière (optionnel)' },
          limit: { type: 'number', description: 'Nombre max (défaut: 20)' },
        },
      },
      requiredPermissions: ['pedagogy.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const plans = await prisma.lessonPlan.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.teacherId ? { teacherId: params.teacherId as string } : {}),
            ...(params.subjectId ? { subjectId: params.subjectId as string } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: (params.limit as number) || 20,
        });
        return createToolResult(plans, 'get_lesson_plans', start, plans.length);
      },
    },
  ];
}

// ─── HR EXTENDED TOOLS ───────────────────────────────────────────────────

export function createHRExtendedTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_staff_list',
      description: 'Récupère la liste du personnel avec filtres par département, statut ou recherche.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'HR',
      inputSchema: {
        type: 'object',
        properties: {
          department: { type: 'string', description: 'Département (optionnel)' },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'], description: 'Statut du personnel' },
          search: { type: 'string', description: 'Recherche par nom' },
          limit: { type: 'number', description: 'Nombre max de résultats (défaut: 20)' },
        },
      },
      requiredPermissions: ['hr.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const staff = await prisma.staff.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.status ? { status: params.status as string } : { status: 'ACTIVE' }),
            ...(params.department ? { department: params.department as string } : {}),
            ...(params.search ? {
              OR: [
                { firstName: { contains: params.search as string, mode: 'insensitive' } },
                { lastName: { contains: params.search as string, mode: 'insensitive' } },
              ],
            } : {}),
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            department: true,
            position: true,
          },
          take: (params.limit as number) || 20,
        });
        return createToolResult(staff, 'get_staff_list', start, staff.length);
      },
    },
    {
      name: 'get_staff_contracts',
      description: 'Récupère les contrats du personnel.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'HR',
      inputSchema: {
        type: 'object',
        properties: {
          staffId: { type: 'string', description: 'ID du personnel (optionnel)' },
          status: { type: 'string', enum: ['ACTIVE', 'EXPIRED', 'PENDING'], description: 'Statut du contrat' },
        },
      },
      requiredPermissions: ['hr.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const contracts = await prisma.contract.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.staffId ? { staffId: params.staffId as string } : {}),
            ...(params.status ? { status: params.status as string } : {}),
          },
          include: {
            staff: { select: { firstName: true, lastName: true, position: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
        return createToolResult(contracts, 'get_staff_contracts', start, contracts.length);
      },
    },
    {
      name: 'get_staff_attendance',
      description: 'Récupère les présences/absences du personnel.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'HR',
      inputSchema: {
        type: 'object',
        properties: {
          staffId: { type: 'string', description: 'ID du personnel (optionnel)' },
          startDate: { type: 'string', description: 'Date de début (optionnel)' },
          endDate: { type: 'string', description: 'Date de fin (optionnel)' },
        },
      },
      requiredPermissions: ['hr.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const attendance = await prisma.staffAttendance.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.staffId ? { staffId: params.staffId as string } : {}),
            ...(params.startDate ? { date: { gte: new Date(params.startDate as string) } } : {}),
            ...(params.endDate ? { date: { lte: new Date(params.endDate as string) } } : {}),
          },
          include: {
            staff: { select: { firstName: true, lastName: true } },
          },
          orderBy: { date: 'desc' },
          take: 50,
        });
        return createToolResult(attendance, 'get_staff_attendance', start, attendance.length);
      },
    },
    {
      name: 'get_payroll_summary',
      description: 'Récupère le résumé de la paie pour une période donnée.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'HR',
      inputSchema: {
        type: 'object',
        properties: {
          period: { type: 'string', description: 'Période de paie (ex: "2025-01")' },
        },
      },
      requiredPermissions: ['hr.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const payrollPeriod = (params.period as string) || new Date().toISOString().slice(0, 7);

        const payrolls = await prisma.payroll.findMany({
          where: {
            tenantId: context.schoolId,
            period: payrollPeriod,
          },
          include: {
            staff: { select: { firstName: true, lastName: true, position: true } },
          },
          take: 50,
        });

        const totalGross = payrolls.reduce((sum, p) => sum + (p.grossSalary || 0), 0);
        const totalNet = payrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);
        const totalDeductions = payrolls.reduce((sum, p) => sum + (p.totalDeductions || 0), 0);

        return createToolResult({
          period: payrollPeriod,
          employeeCount: payrolls.length,
          totalGross,
          totalNet,
          totalDeductions,
          payrolls: payrolls.slice(0, 20),
        }, 'get_payroll_summary', start);
      },
    },
    {
      name: 'get_leave_requests',
      description: 'Récupère les demandes de congé.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'HR',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'], description: 'Statut de la demande' },
          staffId: { type: 'string', description: 'ID du personnel (optionnel)' },
        },
      },
      requiredPermissions: ['hr.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const leaves = await prisma.leaveRequest.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.status ? { status: params.status as string } : {}),
            ...(params.staffId ? { staffId: params.staffId as string } : {}),
          },
          include: {
            staff: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
        return createToolResult(leaves, 'get_leave_requests', start, leaves.length);
      },
    },
  ];
}

// ─── FINANCE EXTENDED TOOLS ──────────────────────────────────────────────

export function createFinanceExtendedTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_payments',
      description: 'Récupère la liste des paiements avec filtres.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'FINANCE',
      inputSchema: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'ID de l\'élève (optionnel)' },
          status: { type: 'string', enum: ['COMPLETED', 'PENDING', 'FAILED', 'REFUNDED'], description: 'Statut du paiement' },
          startDate: { type: 'string', description: 'Date de début (optionnel)' },
          endDate: { type: 'string', description: 'Date de fin (optionnel)' },
          limit: { type: 'number', description: 'Nombre max (défaut: 20)' },
        },
      },
      requiredPermissions: ['finance.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const payments = await prisma.payment.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.studentId ? { studentId: params.studentId as string } : {}),
            ...(params.status ? { status: params.status as string } : {}),
            ...(params.startDate ? { createdAt: { gte: new Date(params.startDate as string) } } : {}),
            ...(params.endDate ? { createdAt: { lte: new Date(params.endDate as string) } } : {}),
          },
          include: {
            student: { select: { firstName: true, lastName: true, matricule: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: (params.limit as number) || 20,
        });
        return createToolResult(payments, 'get_payments', start, payments.length);
      },
    },
    {
      name: 'get_expenses',
      description: 'Récupère la liste des dépenses avec filtres.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'FINANCE',
      inputSchema: {
        type: 'object',
        properties: {
          categoryId: { type: 'string', description: 'ID de la catégorie (optionnel)' },
          startDate: { type: 'string', description: 'Date de début (optionnel)' },
          endDate: { type: 'string', description: 'Date de fin (optionnel)' },
          limit: { type: 'number', description: 'Nombre max (défaut: 20)' },
        },
      },
      requiredPermissions: ['finance.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const expenses = await prisma.expense.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.categoryId ? { categoryId: params.categoryId as string } : {}),
            ...(params.startDate ? { date: { gte: new Date(params.startDate as string) } } : {}),
            ...(params.endDate ? { date: { lte: new Date(params.endDate as string) } } : {}),
          },
          include: {
            category: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
          take: (params.limit as number) || 20,
        });
        return createToolResult(expenses, 'get_expenses', start, expenses.length);
      },
    },
    {
      name: 'get_fee_configurations',
      description: 'Récupère la structure des frais de scolarité (montants, échéances par classe/niveau).',
      version: '1.0.0',
      agent: 'ORION',
      category: 'FINANCE',
      inputSchema: {
        type: 'object',
        properties: {
          classId: { type: 'string', description: 'ID de la classe (optionnel)' },
          academicYearId: { type: 'string', description: 'ID de l\'année académique (optionnel)' },
        },
      },
      requiredPermissions: ['finance.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const fees = await prisma.feeConfiguration.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.classId ? { classId: params.classId as string } : {}),
            ...(params.academicYearId ? { academicYearId: params.academicYearId as string } : {}),
          },
          include: {
            class: { select: { name: true } },
          },
          take: 50,
        });
        return createToolResult(fees, 'get_fee_configurations', start, fees.length);
      },
    },
    {
      name: 'get_student_account',
      description: 'Récupère le compte financier d\'un élève (solde, historique paiements, impayés).',
      version: '1.0.0',
      agent: 'ORION',
      category: 'FINANCE',
      inputSchema: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'ID de l\'élève (requis)' },
        },
        required: ['studentId'],
      },
      requiredPermissions: ['finance.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const studentId = params.studentId as string;

        const [student, payments, feeProfile] = await Promise.all([
          prisma.student.findUnique({
            where: { id: studentId },
            select: { id: true, firstName: true, lastName: true, matricule: true, class: { select: { name: true } } },
          }),
          prisma.payment.findMany({
            where: { tenantId: context.schoolId, studentId, status: 'COMPLETED' },
            orderBy: { createdAt: 'desc' },
            take: 10,
          }),
          prisma.studentFeeProfile.findFirst({
            where: { tenantId: context.schoolId, studentId },
          }),
        ]);

        return createToolResult({ student, payments, feeProfile }, 'get_student_account', start);
      },
    },
  ];
}

// ─── COMMUNICATION TOOLS ─────────────────────────────────────────────────

export function createCommunicationTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_announcements',
      description: 'Récupère les annonces publiées.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'COMMUNICATION',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Nombre max (défaut: 10)' },
        },
      },
      requiredPermissions: ['communication.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const announcements = await prisma.announcement.findMany({
          where: { tenantId: context.schoolId },
          orderBy: { createdAt: 'desc' },
          take: (params.limit as number) || 10,
        });
        return createToolResult(announcements, 'get_announcements', start, announcements.length);
      },
    },
    {
      name: 'get_messages',
      description: 'Récupère les messages/notifications envoyés.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'COMMUNICATION',
      inputSchema: {
        type: 'object',
        properties: {
          recipientId: { type: 'string', description: 'ID du destinataire (optionnel)' },
          channel: { type: 'string', enum: ['email', 'sms', 'whatsapp', 'push'], description: 'Canal (optionnel)' },
          limit: { type: 'number', description: 'Nombre max (défaut: 20)' },
        },
      },
      requiredPermissions: ['communication.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const messages = await prisma.message.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.recipientId ? { recipientId: params.recipientId as string } : {}),
            ...(params.channel ? { channel: params.channel as string } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: (params.limit as number) || 20,
        });
        return createToolResult(messages, 'get_messages', start, messages.length);
      },
    },
  ];
}

// ─── ATTENDANCE TOOLS ────────────────────────────────────────────────────

export function createAttendanceTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_attendance_summary',
      description: 'Récupère le résumé des absences pour une classe ou l\'ensemble de l\'école.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'ATTENDANCE',
      inputSchema: {
        type: 'object',
        properties: {
          classId: { type: 'string', description: 'ID de la classe (optionnel)' },
          startDate: { type: 'string', description: 'Date de début (optionnel)' },
          endDate: { type: 'string', description: 'Date de fin (optionnel)' },
        },
      },
      requiredPermissions: ['attendance.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const where: any = {
          tenantId: context.schoolId,
          ...(params.classId ? { student: { classId: params.classId as string } } : {}),
          ...(params.startDate ? { date: { gte: new Date(params.startDate as string) } } : {}),
          ...(params.endDate ? { date: { lte: new Date(params.endDate as string) } } : {}),
        };

        const [totalAbsences, justifiedAbsences, unjustifiedAbsences] = await Promise.all([
          prisma.absence.count({ where }),
          prisma.absence.count({ where: { ...where, justified: true } }),
          prisma.absence.count({ where: { ...where, justified: false } }),
        ]);

        // Top absent students
        const topAbsent = await prisma.absence.groupBy({
          by: ['studentId'],
          where,
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        });

        // Enrich with student names
        const studentIds = topAbsent.map(a => a.studentId);
        const students = await prisma.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, firstName: true, lastName: true, matricule: true, class: { select: { name: true } } },
        });

        const topAbsentEnriched = topAbsent.map(a => ({
          student: students.find(s => s.id === a.studentId),
          absenceCount: a._count.id,
        }));

        return createToolResult({
          totalAbsences,
          justifiedAbsences,
          unjustifiedAbsences,
          justificationRate: totalAbsences > 0 ? Math.round(justifiedAbsences / totalAbsences * 100) : 0,
          topAbsentStudents: topAbsentEnriched,
        }, 'get_attendance_summary', start);
      },
    },
  ];
}

// ─── QHSE TOOLS ──────────────────────────────────────────────────────────

export function createQHSETools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_qhse_incidents',
      description: 'Récupère les incidents QHSE (qualité, hygiène, sécurité, environnement).',
      version: '1.0.0',
      agent: 'ORION',
      category: 'QHSE',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], description: 'Statut de l\'incident' },
          severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], description: 'Sévérité' },
          limit: { type: 'number', description: 'Nombre max (défaut: 20)' },
        },
      },
      requiredPermissions: ['qhse.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const incidents = await prisma.qHSEIncident.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.status ? { status: params.status as string } : {}),
            ...(params.severity ? { severity: params.severity as string } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: (params.limit as number) || 20,
        });
        return createToolResult(incidents, 'get_qhse_incidents', start, incidents.length);
      },
    },
    {
      name: 'get_qhse_inspections',
      description: 'Récupère les inspections d\'hygiène et contrôles de sécurité.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'QHSE',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['HYGIENE', 'SECURITY', 'HEALTH'], description: 'Type d\'inspection' },
          limit: { type: 'number', description: 'Nombre max (défaut: 20)' },
        },
      },
      requiredPermissions: ['qhse.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        // Use the appropriate model based on type
        const type = (params.type as string) || 'HYGIENE';
        let inspections;

        if (type === 'HYGIENE') {
          inspections = await prisma.qHSEHygieneInspection.findMany({
            where: { tenantId: context.schoolId },
            orderBy: { createdAt: 'desc' },
            take: (params.limit as number) || 20,
          });
        } else if (type === 'SECURITY') {
          inspections = await prisma.qHSESecurityControl.findMany({
            where: { tenantId: context.schoolId },
            orderBy: { createdAt: 'desc' },
            take: (params.limit as number) || 20,
          });
        } else {
          inspections = await prisma.qHSEHealthVisit.findMany({
            where: { tenantId: context.schoolId },
            orderBy: { createdAt: 'desc' },
            take: (params.limit as number) || 20,
          });
        }
        return createToolResult(inspections, 'get_qhse_inspections', start, inspections.length);
      },
    },
  ];
}

// ─── MEETING TOOLS ───────────────────────────────────────────────────────

export function createMeetingTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_meetings',
      description: 'Récupère les réunions programmées ou passées.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'MEETING',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], description: 'Statut' },
          limit: { type: 'number', description: 'Nombre max (défaut: 10)' },
        },
      },
      requiredPermissions: ['meetings.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const meetings = await prisma.meeting.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.status ? { status: params.status as string } : {}),
          },
          include: {
            participants: { take: 10 },
            agenda: true,
          },
          orderBy: { scheduledAt: 'desc' },
          take: (params.limit as number) || 10,
        });
        return createToolResult(meetings, 'get_meetings', start, meetings.length);
      },
    },
  ];
}

// ─── DASHBOARD & STATS TOOLS ─────────────────────────────────────────────

export function createDashboardTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_school_overview',
      description: 'Récupère un aperçu global de l\'école : nombre d\'élèves, classes, enseignants, finances, absences.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'DASHBOARD',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      requiredPermissions: ['students.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();

        const [
          studentCount,
          activeStudentCount,
          classCount,
          teacherCount,
          staffCount,
          paymentThisMonth,
          expenseThisMonth,
          absenceThisMonth,
          pendingAlerts,
        ] = await Promise.all([
          prisma.student.count({ where: { tenantId: context.schoolId } }),
          prisma.student.count({ where: { tenantId: context.schoolId, status: 'ACTIVE' } }),
          prisma.class.count({ where: { tenantId: context.schoolId } }),
          prisma.teacher.count({ where: { tenantId: context.schoolId, status: 'ACTIVE' } }),
          prisma.staff.count({ where: { tenantId: context.schoolId, status: 'ACTIVE' } }),
          prisma.payment.aggregate({
            where: {
              tenantId: context.schoolId,
              status: 'COMPLETED',
              createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
            },
            _sum: { amount: true },
          }),
          prisma.expense.aggregate({
            where: {
              tenantId: context.schoolId,
              date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
            },
            _sum: { amount: true },
          }),
          prisma.absence.count({
            where: {
              tenantId: context.schoolId,
              date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
            },
          }),
          prisma.orionAlert.count({
            where: { tenantId: context.schoolId, acknowledged: false },
          }),
        ]);

        return createToolResult({
          students: { total: studentCount, active: activeStudentCount },
          classes: classCount,
          teachers: teacherCount,
          staff: staffCount,
          financeThisMonth: {
            collected: paymentThisMonth._sum.amount || 0,
            expenses: expenseThisMonth._sum.amount || 0,
            balance: (paymentThisMonth._sum.amount || 0) - (expenseThisMonth._sum.amount || 0),
          },
          absencesThisMonth: absenceThisMonth,
          pendingAlerts,
        }, 'get_school_overview', start);
      },
    },
    {
      name: 'get_class_list',
      description: 'Récupère la liste des classes avec le nombre d\'élèves par classe.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'DASHBOARD',
      inputSchema: {
        type: 'object',
        properties: {
          level: { type: 'string', description: 'Niveau scolaire (optionnel)' },
        },
      },
      requiredPermissions: ['students.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const classes = await prisma.class.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.level ? { level: params.level as string } : {}),
          },
          include: {
            _count: { select: { students: true } },
            level: { select: { name: true } },
          },
          orderBy: { name: 'asc' },
          take: 50,
        });
        return createToolResult(classes, 'get_class_list', start, classes.length);
      },
    },
    {
      name: 'get_subjects',
      description: 'Récupère la liste des matières enseignées.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'DASHBOARD',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      requiredPermissions: ['pedagogy.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const subjects = await prisma.subject.findMany({
          where: { tenantId: context.schoolId },
          orderBy: { name: 'asc' },
          take: 50,
        });
        return createToolResult(subjects, 'get_subjects', start, subjects.length);
      },
    },
  ];
}

// ─── DOCUMENT TOOLS (read-only) ──────────────────────────────────────────

export function createDocumentTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_student_documents',
      description: 'Récupère les documents d\'un élève (certificats, attestations, etc.).',
      version: '1.0.0',
      agent: 'ORION',
      category: 'DOCUMENT',
      inputSchema: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'ID de l\'élève (requis)' },
          type: { type: 'string', description: 'Type de document (optionnel)' },
        },
        required: ['studentId'],
      },
      requiredPermissions: ['students.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const documents = await prisma.studentDocument.findMany({
          where: {
            tenantId: context.schoolId,
            studentId: params.studentId as string,
            ...(params.type ? { type: params.type as string } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
        return createToolResult(documents, 'get_student_documents', start, documents.length);
      },
    },
    {
      name: 'get_document_templates',
      description: 'Récupère les modèles de documents disponibles.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'DOCUMENT',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Type de template (optionnel)' },
        },
      },
      requiredPermissions: ['documents.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const templates = await prisma.documentTemplate.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.type ? { type: params.type as string } : {}),
          },
          take: 20,
        });
        return createToolResult(templates, 'get_document_templates', start, templates.length);
      },
    },
  ];
}

// ─── SETTING / CONFIG TOOLS (read-only) ──────────────────────────────────

export function createSettingTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_tenant_settings',
      description: 'Récupère les paramètres de l\'établissement (identité, fonctionnalités activées, limites du plan).',
      version: '1.0.0',
      agent: 'ORION',
      category: 'SETTING',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      requiredPermissions: ['settings.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const [tenant, settings, subscription] = await Promise.all([
          prisma.tenant.findUnique({
            where: { id: context.schoolId },
            select: { id: true, name: true, slug: true, status: true, createdAt: true },
          }),
          prisma.tenantSetting.findFirst({
            where: { tenantId: context.schoolId },
          }),
          prisma.subscription.findFirst({
            where: { tenantId: context.schoolId, status: 'ACTIVE' },
            select: { plan: true, status: true, currentPeriodEnd: true },
          }),
        ]);

        return createToolResult({ tenant, settings, subscription }, 'get_tenant_settings', start);
      },
    },
    {
      name: 'get_academic_years',
      description: 'Récupère les années académiques configurées.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'SETTING',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      requiredPermissions: ['settings.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const academicYears = await prisma.academicYear.findMany({
          where: { tenantId: context.schoolId },
          orderBy: { startDate: 'desc' },
          take: 5,
        });
        return createToolResult(academicYears, 'get_academic_years', start, academicYears.length);
      },
    },
  ];
}
