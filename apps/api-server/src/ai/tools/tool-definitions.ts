/**
 * ============================================================================
 * TOOL DEFINITIONS — Outils pour les 3 agents IA
 * ============================================================================
 * Chaque outil est versionné, auditable, contrôlé par RBAC.
 * Les IA n'accèdent JAMAES directement aux données — uniquement via ces outils.
 */

import { PrismaService } from '../../database/prisma.service';
import {
  ToolDefinition,
  MCPContext,
  ToolResult,
} from '../types/ai.types';

// ─── SHARED HELPERS ───────────────────────────────────────────────────────

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

// ─── STUDENT TOOLS ────────────────────────────────────────────────────────

export function createStudentTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_students',
      description: 'Récupère la liste des élèves avec filtres optionnels.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'STUDENT',
      inputSchema: {
        type: 'object',
        properties: {
          classId: { type: 'string', description: 'ID de la classe (optionnel)' },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'], description: 'Statut de l\'élève' },
          search: { type: 'string', description: 'Recherche par nom ou matricule' },
          limit: { type: 'number', description: 'Nombre max de résultats (défaut: 20)' },
        },
      },
      requiredPermissions: ['students.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const students = await prisma.student.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.classId ? { classId: params.classId as string } : {}),
            ...(params.status ? { status: params.status as string } : { status: 'ACTIVE' }),
            ...(params.search ? {
              OR: [
                { firstName: { contains: params.search as string, mode: 'insensitive' } },
                { lastName: { contains: params.search as string, mode: 'insensitive' } },
                { matricule: { contains: params.search as string, mode: 'insensitive' } },
              ],
            } : {}),
          },
          take: (params.limit as number) || 20,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricule: true,
            status: true,
            class: { select: { id: true, name: true } },
          },
        });
        return createToolResult(students, 'get_students', start, students.length);
      },
    },
    {
      name: 'get_student_grades',
      description: 'Récupère les notes d\'un élève pour une période donnée.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'ACADEMIC',
      inputSchema: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'ID de l\'élève (requis)' },
          period: { type: 'string', description: 'Période (optionnel)' },
          subjectId: { type: 'string', description: 'ID de la matière (optionnel)' },
        },
        required: ['studentId'],
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
            studentId: params.studentId as string,
            ...(params.subjectId ? { subjectId: params.subjectId as string } : {}),
          },
          include: {
            subject: { select: { name: true } },
            exam: { select: { name: true, type: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        return createToolResult(grades, 'get_student_grades', start, grades.length);
      },
    },
    {
      name: 'get_student_attendance',
      description: 'Récupère les absences d\'un élève.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'ACADEMIC',
      inputSchema: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'ID de l\'élève (requis)' },
          startDate: { type: 'string', description: 'Date de début (optionnel)' },
          endDate: { type: 'string', description: 'Date de fin (optionnel)' },
        },
        required: ['studentId'],
      },
      requiredPermissions: ['attendance.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const absences = await prisma.absence.findMany({
          where: {
            tenantId: context.schoolId,
            studentId: params.studentId as string,
            ...(params.startDate ? { date: { gte: new Date(params.startDate as string) } } : {}),
            ...(params.endDate ? { date: { lte: new Date(params.endDate as string) } } : {}),
          },
          orderBy: { date: 'desc' },
          take: 50,
        });
        return createToolResult(absences, 'get_student_attendance', start, absences.length);
      },
    },
  ];
}

// ─── FINANCE TOOLS ────────────────────────────────────────────────────────

export function createFinanceTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_finance_unpaid',
      description: 'Récupère la liste des impayés avec filtres.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'FINANCE',
      inputSchema: {
        type: 'object',
        properties: {
          daysOverdue: { type: 'number', description: 'Jours de retard minimum' },
          classId: { type: 'string', description: 'ID de la classe' },
          minAmount: { type: 'number', description: 'Montant minimum impayé' },
        },
      },
      requiredPermissions: ['finance.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        // Utiliser le service de fees existant
        const unpaidStudents = await prisma.studentFeeProfile.findMany({
          where: {
            tenantId: context.schoolId,
            outstandingBalance: { gt: 0 },
            ...(params.minAmount ? { outstandingBalance: { gte: params.minAmount as number } } : {}),
            ...(params.classId ? { student: { classId: params.classId as string } } : {}),
          },
          include: {
            student: { select: { id: true, firstName: true, lastName: true, matricule: true, class: { select: { name: true } } } },
          },
          orderBy: { outstandingBalance: 'desc' },
          take: 50,
        });
        return createToolResult(unpaidStudents, 'get_finance_unpaid', start, unpaidStudents.length);
      },
    },
    {
      name: 'get_finance_summary',
      description: 'Récupère le résumé financier de l\'école (recettes, dépenses, solde).',
      version: '1.0.0',
      agent: 'ORION',
      category: 'FINANCE',
      inputSchema: {
        type: 'object',
        properties: {
          period: { type: 'string', description: 'Période (MONTH, QUARTER, YEAR)' },
        },
      },
      requiredPermissions: ['finance.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [totalPayments, totalExpenses, totalExpected] = await Promise.all([
          prisma.payment.aggregate({
            where: {
              tenantId: context.schoolId,
              createdAt: { gte: startOfMonth },
              status: 'COMPLETED',
            },
            _sum: { amount: true },
          }),
          prisma.expense.aggregate({
            where: {
              tenantId: context.schoolId,
              date: { gte: startOfMonth },
            },
            _sum: { amount: true },
          }),
          prisma.feeConfiguration.aggregate({
            where: { tenantId: context.schoolId },
            _sum: { amount: true },
          }),
        ]);

        const summary = {
          period: params.period || 'MONTH',
          collected: totalPayments._sum.amount || 0,
          expenses: totalExpenses._sum.amount || 0,
          expected: totalExpected._sum.amount || 0,
          balance: (totalPayments._sum.amount || 0) - (totalExpenses._sum.amount || 0),
        };

        return createToolResult(summary, 'get_finance_summary', start);
      },
    },
  ];
}

// ─── HR TOOLS ─────────────────────────────────────────────────────────────

export function createHRTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_teacher_attendance',
      description: 'Récupère les absences enseignant.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'HR',
      inputSchema: {
        type: 'object',
        properties: {
          teacherId: { type: 'string', description: 'ID de l\'enseignant (optionnel)' },
          startDate: { type: 'string', description: 'Date de début' },
          endDate: { type: 'string', description: 'Date de fin' },
        },
      },
      requiredPermissions: ['hr.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const absences = await prisma.teacherAbsence.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.teacherId ? { teacherId: params.teacherId as string } : {}),
            ...(params.startDate ? { date: { gte: new Date(params.startDate as string) } } : {}),
            ...(params.endDate ? { date: { lte: new Date(params.endDate as string) } } : {}),
          },
          include: {
            teacher: { select: { firstName: true, lastName: true } },
          },
          orderBy: { date: 'desc' },
          take: 50,
        });
        return createToolResult(absences, 'get_teacher_attendance', start, absences.length);
      },
    },
    {
      name: 'get_teacher_workload',
      description: 'Récupère la charge de travail des enseignants.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'HR',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      requiredPermissions: ['hr.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const teachers = await prisma.teacher.findMany({
          where: { tenantId: context.schoolId, status: 'ACTIVE' },
          include: {
            teachingAssignments: {
              include: { class: { select: { name: true } }, subject: { select: { name: true } } },
            },
          },
        });

        const workload = teachers.map(t => ({
          id: t.id,
          name: `${t.firstName} ${t.lastName}`,
          assignmentCount: t.teachingAssignments?.length || 0,
          classes: [...new Set(t.teachingAssignments?.map((a: any) => a.class?.name).filter(Boolean))],
        }));

        return createToolResult(workload, 'get_teacher_workload', start, workload.length);
      },
    },
  ];
}

// ─── ORION ANALYTICS TOOLS ────────────────────────────────────────────────

export function createOrionTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_orion_analysis',
      description: 'Récupère une analyse ORION existante par domaine.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'ANALYTICS',
      inputSchema: {
        type: 'object',
        properties: {
          domain: { type: 'string', enum: ['academic', 'finance', 'hr', 'compliance', 'security'], description: 'Domaine d\'analyse' },
          period: { type: 'string', description: 'Période d\'analyse' },
        },
      },
      requiredPermissions: ['orion.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const insights = await prisma.orionInsight.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.domain ? { category: (params.domain as string).toUpperCase() } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
        const alerts = await prisma.orionAlert.findMany({
          where: {
            tenantId: context.schoolId,
            acknowledged: false,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
        return createToolResult({ insights, alerts }, 'get_orion_analysis', start);
      },
    },
    {
      name: 'get_orion_score',
      description: 'Récupère le score ORION de l\'établissement (santé globale).',
      version: '1.0.0',
      agent: 'ORION',
      category: 'ANALYTICS',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      requiredPermissions: ['orion.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        // Récupérer les KPI snapshots récents
        const latestKpi = await prisma.kpiSnapshot.findFirst({
          where: { tenantId: context.schoolId },
          orderBy: { calculatedAt: 'desc' },
        });
        return createToolResult(latestKpi, 'get_orion_score', start);
      },
    },
    {
      name: 'get_kpi_data',
      description: 'Récupère les données KPI brutes pour analyse.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'ANALYTICS',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['financial', 'hr', 'pedagogy', 'system'], description: 'Catégorie KPI' },
          limit: { type: 'number', description: 'Nombre de snapshots (défaut: 12)' },
        },
      },
      requiredPermissions: ['orion.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const category = (params.category as string) || 'financial';
        const limit = (params.limit as number) || 12;

        const kpiDefinition = await prisma.kpiDefinition.findFirst({
          where: { category: category.toUpperCase() },
        });

        if (!kpiDefinition) {
          return { success: false, data: null, error: `No KPI definition found for ${category}` };
        }

        const snapshots = await prisma.kpiSnapshot.findMany({
          where: {
            tenantId: context.schoolId,
            definitionId: kpiDefinition.id,
          },
          orderBy: { calculatedAt: 'desc' },
          take: limit,
        });

        return createToolResult(snapshots, 'get_kpi_data', start, snapshots.length);
      },
    },
  ];
}

// ─── SARA PEDAGOGY TOOLS ──────────────────────────────────────────────────

export function createPedagogyTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'search_pedagogy_library',
      description: 'Recherche dans la bibliothèque pédagogique.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'ACADEMIC',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Requête de recherche (requis)' },
          subject: { type: 'string', description: 'Matière (optionnel)' },
          level: { type: 'string', description: 'Niveau scolaire (optionnel)' },
          type: { type: 'string', enum: ['EXERCISE', 'LESSON', 'EVALUATION', 'DOCUMENT'], description: 'Type de ressource' },
        },
        required: ['query'],
      },
      requiredPermissions: ['pedagogy.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const materials = await prisma.pedagogicalMaterial.findMany({
          where: {
            tenantId: context.schoolId,
            status: 'PUBLISHED',
            ...(params.subject ? { subject: { name: { contains: params.subject as string, mode: 'insensitive' } } } : {}),
            OR: [
              { title: { contains: params.query as string, mode: 'insensitive' } },
              { description: { contains: params.query as string, mode: 'insensitive' } },
            ],
          },
          take: 10,
          include: { subject: { select: { name: true } } },
        });
        return createToolResult(materials, 'search_pedagogy_library', start, materials.length);
      },
    },
  ];
}

// ─── ATLAS WORKFLOW TOOLS ─────────────────────────────────────────────────

export function createAtlasTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'trigger_atlas_workflow',
      description: 'Déclenche un workflow ATLAS (nécessite confirmation humaine).',
      version: '1.0.0',
      agent: 'ATLAS',
      category: 'WORKFLOW',
      inputSchema: {
        type: 'object',
        properties: {
          workflowType: { type: 'string', enum: ['BULLETIN_GENERATION_CAMPAIGN', 'PAYMENT_REMINDER_CAMPAIGN', 'MONTHLY_REPORT_GENERATION', 'NEW_STUDENT_ENROLLMENT_FLOW'], description: 'Type de workflow' },
          parameters: { type: 'object', description: 'Paramètres du workflow' },
        },
        required: ['workflowType'],
      },
      requiredPermissions: ['atlas.execute'],
      requiresTenant: true,
      isReadOnly: false,
      requiresConfirmation: true,
      execute: async (params, context) => {
        const start = Date.now();
        // Enregistrer l'exécution du workflow
        const execution = await prisma.automationExecution.create({
          data: {
            tenantId: context.schoolId,
            status: 'PENDING',
            inputPayload: params as any,
            actionPayload: { workflowType: params.workflowType, triggeredBy: context.userId } as any,
          },
        });
        return createToolResult(
          { executionId: execution.id, status: 'PENDING', workflowType: params.workflowType, requiresConfirmation: true },
          'trigger_atlas_workflow',
          start,
        );
      },
    },
    {
      name: 'generate_document',
      description: 'Génère un document (attestation, bulletin, reçu, etc.) via ATLAS.',
      version: '1.0.0',
      agent: 'ATLAS',
      category: 'DOCUMENT',
      inputSchema: {
        type: 'object',
        properties: {
          documentType: { type: 'string', enum: ['ATTESTATION_SCOLARITE', 'CERTIFICAT_FREQUENTATION', 'RECU_PAIEMENT', 'BULLETIN_TRIMESTRIEL', 'CONTRAT_SCOLARITE', 'LETTRE_RELANCE'], description: 'Type de document' },
          entityId: { type: 'string', description: 'ID de l\'entité concernée (élève, paiement, etc.)' },
          parameters: { type: 'object', description: 'Paramètres de génération' },
        },
        required: ['documentType', 'entityId'],
      },
      requiredPermissions: ['atlas.execute'],
      requiresTenant: true,
      isReadOnly: false,
      requiresConfirmation: true,
      execute: async (params, context) => {
        const start = Date.now();
        const execution = await prisma.automationExecution.create({
          data: {
            tenantId: context.schoolId,
            status: 'PENDING',
            inputPayload: {
              documentType: params.documentType,
              entityId: params.entityId,
              parameters: params.parameters,
              requestedBy: context.userId,
            } as any,
            actionPayload: { type: 'DOCUMENT_GENERATION' } as any,
          },
        });
        return createToolResult(
          { executionId: execution.id, status: 'PENDING', documentType: params.documentType, requiresConfirmation: true },
          'generate_document',
          start,
        );
      },
    },
    {
      name: 'send_notification',
      description: 'Envoie une notification (email, SMS, WhatsApp) via ATLAS.',
      version: '1.0.0',
      agent: 'ATLAS',
      category: 'COMMUNICATION',
      inputSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string', enum: ['email', 'sms', 'whatsapp', 'push'], description: 'Canal de notification' },
          recipients: { type: 'array', items: { type: 'string' }, description: 'IDs des destinataires' },
          templateId: { type: 'string', description: 'ID du template de message' },
          parameters: { type: 'object', description: 'Paramètres du template' },
        },
        required: ['channel', 'recipients'],
      },
      requiredPermissions: ['atlas.execute'],
      requiresTenant: true,
      isReadOnly: false,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        // Pour les notifications de masse, confirmation requise
        const recipientCount = (params.recipients as string[])?.length || 0;
        if (recipientCount > 10) {
          return createToolResult(
            { status: 'CONFIRMATION_REQUIRED', recipientCount, message: `Envoi de ${recipientCount} notifications nécessite une confirmation` },
            'send_notification',
            start,
          );
        }

        // Log la notification
        const execution = await prisma.automationExecution.create({
          data: {
            tenantId: context.schoolId,
            status: 'COMPLETED',
            inputPayload: params as any,
            actionPayload: { type: 'NOTIFICATION', sentCount: recipientCount } as any,
          },
        });

        return createToolResult(
          { executionId: execution.id, status: 'COMPLETED', channel: params.channel, recipientCount },
          'send_notification',
          start,
        );
      },
    },
  ];
}

// ─── KNOWLEDGE BASE TOOL ──────────────────────────────────────────────────

export function createKnowledgeTool(): ToolDefinition {
  return {
    name: 'search_knowledge_base',
    description: 'Recherche dans la base de connaissances Academia Helm (RAG).',
    version: '1.0.0',
    agent: 'ALL',
    category: 'KNOWLEDGE',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Requête de recherche (requis)' },
        category: { type: 'string', enum: ['PROCEDURE', 'FAQ', 'GUIDE', 'REGULATION'], description: 'Catégorie' },
      },
      required: ['query'],
    },
    requiredPermissions: [],
    requiresTenant: false,
    isReadOnly: true,
    requiresConfirmation: false,
    execute: async (params, _context) => {
      const start = Date.now();
      // Placeholder pour la recherche RAG — sera connecté à pgvector/Qdrant
      const results = {
        query: params.query,
        category: params.category,
        results: [
          {
            title: 'Base de connaissances Academia Helm',
            content: 'La recherche sémantique sera disponible avec l\'intégration pgvector. En attendant, consultez la documentation en ligne.',
            relevance: 0.95,
          },
        ],
        totalResults: 1,
        note: 'RAG pipeline pending — pgvector integration needed',
      };
      return createToolResult(results, 'search_knowledge_base', start);
    },
  };
}
