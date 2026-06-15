/**
 * ============================================================================
 * TOOL DEFINITIONS — Outils pour les 3 agents IA
 * ============================================================================
 * Chaque outil est versionné, auditable, contrôlé par RBAC.
 * Les IA n'accèdent JAMAIS directement aux données — uniquement via ces outils.
 *
 * Modèle : z-ai/glm-5.1 via OpenRouter
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
      agent: 'ALL',
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
      agent: 'ALL',
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
          select: {
            id: true,
            score: true,
            maxScore: true,
            subject: { select: { id: true, name: true } },
            exam: { select: { id: true, title: true, date: true } },
          },
          take: 30,
        });
        return createToolResult(grades, 'get_student_grades', start, grades.length);
      },
    },
    {
      name: 'get_student_count',
      description: 'Retourne le nombre total d\'élèves actifs.',
      version: '1.0.0',
      agent: 'ALL',
      category: 'STUDENT',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'], description: 'Statut (défaut: ACTIVE)' },
        },
      },
      requiredPermissions: ['students.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const count = await prisma.student.count({
          where: {
            tenantId: context.schoolId,
            status: (params.status as string) || 'ACTIVE',
          },
        });
        return createToolResult({ count, status: params.status || 'ACTIVE' }, 'get_student_count', start);
      },
    },
  ];
}

// ─── FINANCE TOOLS ────────────────────────────────────────────────────────

export function createFinanceTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_unpaid_fees',
      description: 'Récupère la liste des impayés avec le montant total.',
      version: '1.0.0',
      agent: 'ALL',
      category: 'FINANCE',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Nombre max de résultats (défaut: 20)' },
          minAmount: { type: 'number', description: 'Montant minimum des impayés' },
        },
      },
      requiredPermissions: ['finance.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const unpaid = await prisma.feeArrear.findMany({
          where: {
            tenantId: context.schoolId,
            balanceDue: { gt: (params.minAmount as number) || 0 },
          },
          take: (params.limit as number) || 20,
          select: {
            id: true,
            balanceDue: true,
            student: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { balanceDue: 'desc' },
        });
        const totalUnpaid = unpaid.reduce((sum: number, u: any) => sum + Number(u.balanceDue || 0), 0);
        return createToolResult({ unpaid, totalUnpaid, count: unpaid.length }, 'get_unpaid_fees', start, unpaid.length);
      },
    },
    {
      name: 'get_payment_summary',
      description: 'Retourne un résumé des paiements (total encaissé, nombre de paiements, par période).',
      version: '1.0.0',
      agent: 'ALL',
      category: 'FINANCE',
      inputSchema: {
        type: 'object',
        properties: {
          period: { type: 'string', description: 'Période : month, quarter, year (défaut: month)' },
        },
      },
      requiredPermissions: ['finance.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const now = new Date();
        let startDate: Date;

        switch (params.period as string) {
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          case 'quarter':
            const qMonth = Math.floor(now.getMonth() / 3) * 3;
            startDate = new Date(now.getFullYear(), qMonth, 1);
            break;
          default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const result = await prisma.payment.aggregate({
          where: {
            tenantId: context.schoolId,
            createdAt: { gte: startDate },
            status: 'COMPLETED',
          },
          _sum: { amount: true },
          _count: true,
        });

        return createToolResult({
          totalCollected: Number(result._sum.amount || 0),
          paymentCount: result._count,
          period: params.period || 'month',
          startDate,
        }, 'get_payment_summary', start);
      },
    },
  ];
}

// ─── HR TOOLS ─────────────────────────────────────────────────────────────

export function createHRTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_teacher_absences',
      description: 'Récupère les absences récentes des enseignants.',
      version: '1.0.0',
      agent: 'ALL',
      category: 'HR',
      inputSchema: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Nombre de jours en arrière (défaut: 30)' },
        },
      },
      requiredPermissions: ['hr.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const days = (params.days as number) || 30;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const absences = await prisma.staffAttendance.findMany({
          where: {
            tenantId: context.schoolId,
            status: 'ABSENT',
            date: { gte: since },
          },
          select: {
            id: true,
            date: true,
            status: true,
            staff: { select: { id: true, firstName: true, lastName: true } },
          },
          take: 50,
        });

        return createToolResult(absences, 'get_teacher_absences', start, absences.length);
      },
    },
    {
      name: 'get_staff_count',
      description: 'Retourne le nombre d\'enseignants actifs.',
      version: '1.0.0',
      agent: 'ALL',
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
        const count = await prisma.teacher.count({
          where: { tenantId: context.schoolId, status: 'ACTIVE' },
        });
        return createToolResult({ count }, 'get_staff_count', start);
      },
    },
  ];
}

// ─── ORION ANALYTICS TOOLS ───────────────────────────────────────────────

export function createOrionTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_orion_alerts',
      description: 'Récupère les alertes ORION actives pour l\'établissement.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'ANALYTICS',
      inputSchema: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], description: 'Sévérité min' },
          limit: { type: 'number', description: 'Nombre max (défaut: 10)' },
        },
      },
      requiredPermissions: ['orion.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const alerts = await prisma.orionAlert.findMany({
          where: {
            tenantId: context.schoolId,
            acknowledged: false,
            ...(params.severity ? { severity: { gte: params.severity as string } } : {}),
          },
          orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
          take: (params.limit as number) || 10,
        });
        return createToolResult(alerts, 'get_orion_alerts', start, alerts.length);
      },
    },
    {
      name: 'get_kpi_snapshot',
      description: 'Récupère les derniers KPIs calculés par catégorie.',
      version: '1.0.0',
      agent: 'ORION',
      category: 'ANALYTICS',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['PEDAGOGY', 'FINANCIAL', 'HR', 'COMPLIANCE', 'SECURITY'], description: 'Catégorie KPI' },
        },
      },
      requiredPermissions: ['orion.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const kpi = await prisma.kpiSnapshot.findFirst({
          where: {
            tenantId: context.schoolId,
            ...(params.category ? { definition: { category: params.category as string } } : {}),
          },
          orderBy: { calculatedAt: 'desc' },
        });
        return createToolResult(kpi, 'get_kpi_snapshot', start);
      },
    },
  ];
}

// ─── PEDAGOGY TOOLS ───────────────────────────────────────────────────────

export function createPedagogyTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'get_class_list',
      description: 'Récupère la liste des classes de l\'établissement.',
      version: '1.0.0',
      agent: 'ALL',
      category: 'ACADEMIC',
      inputSchema: {
        type: 'object',
        properties: {
          schoolLevelId: { type: 'string', description: 'ID du niveau scolaire (optionnel)' },
        },
      },
      requiredPermissions: ['classes.read'],
      requiresTenant: true,
      isReadOnly: true,
      requiresConfirmation: false,
      execute: async (params, context) => {
        const start = Date.now();
        const classes = await prisma.class.findMany({
          where: {
            tenantId: context.schoolId,
            ...(params.schoolLevelId ? { schoolLevelId: params.schoolLevelId as string } : {}),
          },
          select: { id: true, name: true, capacity: true, schoolLevel: { select: { code: true, label: true } } },
          take: 30,
        });
        return createToolResult(classes, 'get_class_list', start, classes.length);
      },
    },
  ];
}

// ─── ATLAS DOCUMENT & WORKFLOW TOOLS ──────────────────────────────────────

export function createAtlasTools(prisma: PrismaService): ToolDefinition[] {
  return [
    {
      name: 'generate_document',
      description: 'Génère un document (attestation, certificat, bulletin, etc.). Nécessite confirmation utilisateur.',
      version: '1.0.0',
      agent: 'ATLAS',
      category: 'DOCUMENT',
      inputSchema: {
        type: 'object',
        properties: {
          documentType: { type: 'string', enum: ['ATTESTATION_SCOLARITE', 'CERTIFICAT_FREQUENTATION', 'RECU_PAIEMENT', 'ATTESTATION_TRAVAIL', 'LETTRE_RELANCE'], description: 'Type de document' },
          studentId: { type: 'string', description: 'ID de l\'élève (pour documents élèves)' },
          teacherId: { type: 'string', description: 'ID de l\'enseignant (pour documents RH)' },
        },
        required: ['documentType'],
      },
      requiredPermissions: ['documents.generate'],
      requiresTenant: true,
      isReadOnly: false,
      requiresConfirmation: true,
      execute: async (params, context) => {
        const start = Date.now();
        // Pour l'instant, retourne la confirmation que le document peut être généré
        // L'exécution réelle se fait dans le service Atlas avec confirmation utilisateur
        return createToolResult({
          canGenerate: true,
          documentType: params.documentType,
          studentId: params.studentId,
          teacherId: params.teacherId,
          requiresConfirmation: true,
        }, 'generate_document', start);
      },
    },
    {
      name: 'trigger_workflow',
      description: 'Déclenche un workflow automatisé (génération bulletins, relance impayés, etc.). Nécessite confirmation.',
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
      requiredPermissions: ['workflows.trigger'],
      requiresTenant: true,
      isReadOnly: false,
      requiresConfirmation: true,
      execute: async (params, context) => {
        const start = Date.now();
        return createToolResult({
          canTrigger: true,
          workflowType: params.workflowType,
          parameters: params.parameters,
          requiresConfirmation: true,
        }, 'trigger_workflow', start);
      },
    },
  ];
}

// ─── KNOWLEDGE BASE TOOL ──────────────────────────────────────────────────

export function createKnowledgeTool(): ToolDefinition {
  return {
    name: 'query_knowledge_base',
    description: 'Recherche dans la base de connaissances Academia Helm (fonctionnalités, tarifs, modules, FAQ).',
    version: '1.0.0',
    agent: 'SARA',
    category: 'KNOWLEDGE',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Question ou sujet de recherche' },
      },
      required: ['query'],
    },
    requiredPermissions: [],
    requiresTenant: false,
    isReadOnly: true,
    requiresConfirmation: false,
    execute: async (params, context) => {
      const start = Date.now();
      // Base de connaissances intégrée sur Academia Helm
      const knowledgeBase: Record<string, string> = {
        'tarifs': 'Grille tarifaire Academia Helm :\n- HELM SEED (1-150 élèves) : 75 000 FCFA souscription + 14 900 FCFA/mois ou 149 000 FCFA/an\n- HELM GROW (151-400 élèves) [RECOMMANDÉ] : 100 000 FCFA souscription + 24 900 FCFA/mois ou 249 000 FCFA/an\n- HELM LEAD (401-800 élèves) : 150 000 FCFA souscription + 39 900 FCFA/mois ou 399 000 FCFA/an\n- HELM NETWORK (Multi-campus) : 200 000 FCFA souscription + Sur devis\nTous les plans incluent les 9 modules et les 3 agents IA.',
        'modules': 'Les 9 modules inclus :\n1. Élèves & Inscriptions\n2. Pédagogie\n3. Examens & Bulletins\n4. Finance & Économat\n5. RH & Paie\n6. Communication\n7. QHSE\n8. ORION (IA)\n9. Modules Complémentaires (Federis, EducMaster, etc.)',
        'ia': 'Les 3 agents IA :\n- ORION : L\'Analyste — observe, analyse, prédit, recommande (lecture seule)\n- ATLAS : L\'Exécutant — génère documents, automatise workflows\n- SARA : L\'Assistante — closer commerciale + guide utilisateur',
        'architecture': 'Architecture : Cloud (Next.js + NestJS + PostgreSQL/Neon + Supabase) + Mobile (Flutter) + IA (3 agents via OpenRouter GLM 5.1). Offline-first, multi-tenant, mobile-first.',
        'paiement': 'Paiements via Fedapay : Wave, MTN MoMo, Moov Money. Virement bancaire disponible pour les plans annuels.',
        'support': 'Support dédié inclus dans tous les plans. Formation initiale incluse. Assistance réactive par email, WhatsApp et téléphone.',
        'securite': 'Sécurité bancaire : chiffrement AES-256, RBAC granulaire, audit logs complets, isolation multi-tenant, conformité RGPD.',
        'demo': 'Essai gratuit 7 jours disponible. Démonstration personnalisée sur demande. Déploiement opérationnel en 48h.',
        'educmaster': 'Export Educmaster natif intégré. Conformité ministérielle Bénin. Transfert automatique des données élèves.',
        'offline': 'Mode offline-first : l\'application fonctionne sans Internet. Synchronisation automatique quand la connexion revient. Conflits gérés intelligemment.',
      };

      const query = (params.query as string).toLowerCase();
      let bestMatch = '';
      let bestScore = 0;

      for (const [key, value] of Object.entries(knowledgeBase)) {
        const keywords = key.split(' ');
        const score = keywords.filter(kw => query.includes(kw)).length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = value;
        }
      }

      // Si aucun match, retourner un résumé général
      if (bestScore === 0) {
        bestMatch = 'Academia Helm est un ERP éducatif SaaS multi-tenant, offline-first, mobile-first pour les écoles privées en Afrique de l\'Ouest. Il inclut 9 modules, 3 agents IA (ORION, ATLAS, SARA), et est édité par YEHI OR Tech. Pour plus de détails, demandez-moi un sujet spécifique (tarifs, modules, IA, architecture, etc.).';
      }

      return createToolResult({ query, answer: bestMatch }, 'query_knowledge_base', start);
    },
  };
}
