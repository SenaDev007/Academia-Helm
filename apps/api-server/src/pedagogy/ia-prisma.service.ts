/**
 * ============================================================================
 * IA PRISMA SERVICE - Sara Compose Engine (SCE) for Pedagogy
 * ============================================================================
 *
 * Service pour les fonctionnalités IA du module Pédagogie :
 *   - Génération d'épreuves, devoirs, exercices (Sara Compose)
 *   - Analyse de documents pédagogiques
 *   - Insights & recommandations pédagogiques
 *   - Détection d'anomalies pédagogiques
 *   - Copilote pédagogique conversationnel (Sara)
 *   - Import depuis le cahier journal
 *
 * Architecture :
 *   - Si la clé API Claude (ANTHROPIC_API_KEY) est configurée, les appels
 *     passent par l'API Claude pour une génération/analyse réelle.
 *   - Sinon, le service retourne des données structurées de template
 *     avec le flag `isPlaceholder: true` pour que le frontend puisse
 *     afficher un avertissement approprié.
 *
 * Prisma Models utilisés :
 *   - Teacher (table: teachers)
 *   - Subject (table: subjects)
 *   - AcademicClass (table: pedagogy_academic_classes)
 *   - AcademicLevel (table: pedagogy_academic_levels)
 *   - TeachingAssignment (table: pedagogy_teaching_assignments)
 *   - TeacherAcademicProfile (table: pedagogy_teacher_academic_profiles)
 *   - LessonPlan (table: lesson_plans)
 *   - DailyLog (table: daily_logs)
 *   - ClassDiary (table: class_diaries)
 *   - TeachingJournal (table: pedagogy_teaching_journals)
 *   - ClassLog (table: pedagogy_class_logs)
 *   - WeeklyReport (table: pedagogy_weekly_reports)
 *   - Timetable (table: timetables)
 *   - TimetableEntry (table: timetable_entries)
 *   - PedagogicalDocument (table: pedagogical_documents)
 *   - PedagogicalKpiSnapshot (table: pedagogy_kpi_snapshots)
 *   - OrionPedagogicalInsight (table: orion_pedagogical_insights)
 *   - OrionRiskFlag (table: orion_risk_flags)
 *   - PedagogicalMaterial (table: pedagogical_materials)
 *   - SeriesSubject (table: pedagogy_series_subjects)
 *   - SubjectProgram (table: pedagogy_subject_programs)
 *   - GlobalPedagogicalResource (table: global_pedagogical_resources)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OpenRouterService } from '../common/services/openrouter.service';

// Pondérations de couverture pédagogique
const COVERAGE_WEIGHTS = {
  programCoverage: 0.35,    // Couverture du programme officiel
  lessonPlanQuality: 0.25,  // Qualité des plans de cours
  journalRegularity: 0.20,  // Régularité du cahier journal
  evaluationFrequency: 0.20, // Fréquence des évaluations
};

// Templates de génération par type
const GENERATION_TEMPLATES: Record<string, any> = {
  composition: {
    structure: [
      { section: 'En-tête', components: ['Établissement', 'Classe', 'Matière', 'Durée', 'Date'] },
      { section: 'Consignes', components: ['Instructions générales'] },
      { section: 'Exercices', components: ['Questions progressives'] },
      { section: 'Barème', components: ['Répartition des points'] },
    ],
    defaultQuestions: 5,
  },
  devoir: {
    structure: [
      { section: 'En-tête', components: ['Établissement', 'Classe', 'Matière', 'Durée'] },
      { section: 'Questions', components: ['Questions directes'] },
      { section: 'Barème', components: ['Répartition des points'] },
    ],
    defaultQuestions: 5,
  },
  interrogation: {
    structure: [
      { section: 'En-tête', components: ['Classe', 'Matière'] },
      { section: 'Questions rapides', components: ['QCM/Vrai-Faux/Court'] },
    ],
    defaultQuestions: 10,
  },
  'fiche-activite': {
    structure: [
      { section: 'Objectifs', components: ['Compétences visées'] },
      { section: 'Matériel', components: ['Ressources nécessaires'] },
      { section: 'Déroulement', components: ['Étapes de l\'activité'] },
      { section: 'Évaluation', components: ['Critères d\'évaluation'] },
    ],
    defaultQuestions: 3,
  },
};

// Styles de génération
const STYLE_CONFIGS: Record<string, any> = {
  'situation-probleme': {
    approach: 'Situation-problème',
    description: 'Chaque question part d\'une situation concrète de la vie quotidienne',
    questionFormat: 'Contexte → Question → Application',
  },
  classique: {
    approach: 'Approche classique',
    description: 'Questions directes avec application de cours',
    questionFormat: 'Rappel → Application → Approfondissement',
  },
  'examen-officiel': {
    approach: 'Format examen officiel',
    description: 'Respect strict du format d\'examen national (BEPC, BAC, etc.)',
    questionFormat: 'Barème officiel → Présentation stricte → Consignes normalisées',
  },
  ludique: {
    approach: 'Ludique & interactif',
    description: 'Approche jeu avec énigmes et défis',
    questionFormat: 'Défi → Investigation → Résolution collaborative',
  },
};

// Skills IA prédéfinis
const DEFAULT_SKILLS = [
  {
    id: 'skill-primaire-standard',
    label: 'Primaire Standard',
    description: 'Consignes simples, progressif, adapté au primaire',
    level: 'Primaire',
    style: 'classique',
    isDefault: true,
  },
  {
    id: 'skill-examen-officiel',
    label: 'Examen Officiel',
    description: 'Présentation stricte, barème rigoureux, format national',
    level: 'Secondaire',
    style: 'examen-officiel',
    isDefault: false,
  },
  {
    id: 'skill-maternelle-qualitatif',
    label: 'Maternelle Qualitative',
    description: 'Activités ludiques, observation, évaluation qualitative',
    level: 'Maternelle',
    style: 'ludique',
    isDefault: false,
  },
  {
    id: 'skill-bilingue-fr-en',
    label: 'Bilingue Français-Anglais',
    description: 'Questions en français avec variantes en anglais',
    level: 'Mixte',
    style: 'situation-probleme',
    isDefault: false,
  },
];

@Injectable()
export class IaPrismaService {
  private readonly logger = new Logger(IaPrismaService.name);

  constructor(
    private prisma: PrismaService,
    private readonly openRouter: OpenRouterService,
  ) {}

  /**
   * Vérifie si l'IA est configurée (via OpenRouter)
   */
  private isAiConfigured(): boolean {
    return this.openRouter.isConfigured();
  }

  // ─── GÉNÉRATION DE DOCUMENTS PÉDAGOGIQUES ──────────────────────────────────

  /**
   * Génère un document pédagogique (épreuve, devoir, exercice, fiche d'activité).
   *
   * Si l'IA est configurée (ANTHROPIC_API_KEY), envoie les paramètres à Claude
   * pour génération réelle. Sinon, retourne un template structuré basé sur les
   * données existantes du tenant.
   */
  async generateDocument(tenantId: string, data: {
    type?: string;
    subjectId?: string;
    classId?: string;
    academicYearId?: string;
    teacherId?: string;
    questions?: number;
    difficulty?: string;
    style?: string;
    notions?: string[];
    skillId?: string;
    screenshots?: string[];
    journalEntries?: string[];
  }) {
    this.logger.log(`generateDocument called for tenant ${tenantId}, type: ${data.type || 'composition'}`);

    const docType = data.type || 'composition';
    const template = GENERATION_TEMPLATES[docType] || GENERATION_TEMPLATES.composition;
    const styleConfig = STYLE_CONFIGS[data.style || 'situation-probleme'] || STYLE_CONFIGS['situation-probleme'];
    const numQuestions = data.questions || template.defaultQuestions;
    const difficulty = data.difficulty || 'mixte';

    // Récupérer le contexte pédagogique du tenant
    const context = await this.buildPedagogicalContext(tenantId, {
      subjectId: data.subjectId,
      classId: data.classId,
      teacherId: data.teacherId,
      academicYearId: data.academicYearId,
    });

    // Récupérer les notions du programme si disponibles
    const programNotions = await this.getProgramNotions(tenantId, data.subjectId, data.classId);

    // Fusionner les notions fournies avec celles du programme
    const allNotions = [...(data.notions || []), ...programNotions];
    const uniqueNotions = [...new Set(allNotions)];

    if (this.isAiConfigured()) {
      // Appel réel à l'IA via OpenRouter pour la génération
      try {
        const styleDesc = styleConfig.approach || styleConfig.description || data.style || 'classique';
        const notionsText = uniqueNotions.length > 0 ? uniqueNotions.join(', ') : 'notions du programme';

        const generatedContent = await this.openRouter.simpleChat(
          `Génère un document pédagogique de type "${docType}" avec les paramètres suivants :
- Nombre de questions/exercices : ${numQuestions}
- Difficulté : ${difficulty}
- Style : ${styleDesc}
- Notions : ${notionsText}
- Classe : ${context.academicClass?.name || 'Non spécifiée'}
- Matière : ${context.subject?.name || 'Non spécifiée'}
- Enseignant : ${context.teacher ? `${context.teacher.firstName} ${context.teacher.lastName}` : 'Non spécifié'}\n\nGénère le contenu complet avec énoncés, questions et barème sur 20 points.`,
          `Tu es le moteur SCE (Sara Compose Engine) d'Academia Helm. Tu génères des documents pédagogiques de qualité professionnelle pour des établissements scolaires africains.
RÈGLES :
- Adapte le niveau au type de classe spécifié
- Respecte le format ${docType} (composition, devoir, interrogation, fiche-activité)
- Utilise le style ${styleDesc}
- Assure-toi que le barème total est de 20 points
- Réponds en français
- Sois précis et pédagogiquement pertinent`,
          'SCE',
          0.7,
        );

        if (generatedContent && !generatedContent.includes('n\'est pas encore configurée')) {
          // Enrichir le template avec le contenu généré par l'IA
          const generated = this.generateFromTemplate(tenantId, {
            docType,
            template,
            styleConfig,
            numQuestions,
            difficulty,
            notions: uniqueNotions,
            context,
            skillId: data.skillId,
          });

          (generated as any).aiGeneratedContent = generatedContent;
          generated.metadata.isPlaceholder = false;
          generated.metadata.aiConfigured = true;
          generated.metadata.engine = 'SCE v2.0 + OpenRouter';

          return generated;
        }
      } catch (error) {
        this.logger.error('OpenRouter generation failed, using template fallback', error);
      }
    }

    // Génération basée sur les templates et le contexte
    const generated = this.generateFromTemplate(tenantId, {
      docType,
      template,
      styleConfig,
      numQuestions,
      difficulty,
      notions: uniqueNotions,
      context,
      skillId: data.skillId,
    });

    return generated;
  }

  // ─── ANALYSE DE DOCUMENTS PÉDAGOGIQUES ──────────────────────────────────────

  /**
   * Analyse un document pédagogique existant.
   * Types d'analyse :
   *   - quality : Qualité pédagogique du document
   *   - coverage : Couverture du programme officiel
   *   - difficulty : Adéquation du niveau de difficulté
   *   - alignment : Alignement avec les standards nationaux
   */
  async analyzeDocument(tenantId: string, data: {
    documentId?: string;
    content?: string;
    analysisType?: string;
  }) {
    this.logger.log(`analyzeDocument called for tenant ${tenantId}, type: ${data.analysisType || 'quality'}`);

    const analysisType = data.analysisType || 'quality';
    let documentData: any = null;

    // Si un documentId est fourni, récupérer les données existantes
    if (data.documentId) {
      documentData = await this.prisma.pedagogicalDocument.findFirst({
        where: { id: data.documentId, tenantId },
        include: {
          versions: { orderBy: { versionNumber: 'desc' as const }, take: 1 },
          reviews: true,
          comments: true,
        },
      });
    }

    if (this.isAiConfigured()) {
      // Appel réel à l'IA via OpenRouter pour l'analyse
      try {
        const contentToAnalyze = documentData
          ? `Document: ${documentData.title || 'Sans titre'}, Type: ${documentData.type || 'N/A'}, Statut: ${documentData.status || 'N/A'}, Versions: ${documentData.versions?.length || 0}`
          : data.content || 'Contenu à analyser';

        const analysisResult = await this.openRouter.structuredChat<{
          score: number;
          recommendations: string[];
        }>(
          `Analyse ce document pédagogique selon le type "${analysisType}" :\n${contentToAnalyze}`,
          `Tu es le moteur SCE d'Academia Helm. Tu analyses des documents pédagogiques.
Type d'analyse : ${analysisType}
Réponds en JSON avec : { "score": number (0-100), "recommendations": string[] }`,
          'SCE',
        );

        if (analysisResult.data && !analysisResult.isPlaceholder) {
          return {
            analysisType,
            ...analysisResult.data,
            isPlaceholder: false,
            aiConfigured: true,
            analyzedAt: new Date().toISOString(),
          };
        }
      } catch (error) {
        this.logger.error('OpenRouter analysis failed, using rule-based fallback', error);
      }
    }

    // Analyse basée sur les règles
    return this.performRuleBasedAnalysis(tenantId, analysisType, documentData, data.content);
  }

  // ─── INSIGHTS & RECOMMANDATIONS PÉDAGOGIQUES ──────────────────────────────

  /**
   * Retourne des insights et recommandations pédagogiques basés sur les données du tenant.
   */
  async getInsights(tenantId: string, params: {
    teacherId?: string;
    classId?: string;
    scope?: string;
  }) {
    this.logger.log(`getInsights called for tenant ${tenantId}, scope: ${params.scope}`);

    const scope = params.scope || 'global';

    // Récupérer les métriques pédagogiques
    const metrics = await this.getPedagogicalMetrics(tenantId, params);

    // Calculer les scores de couverture
    const coverageScore = this.calculateCoverageScore(metrics);

    // Générer des insights basés sur les données
    const insights = this.generateInsightsFromMetrics(metrics, coverageScore);

    // Récupérer les insights Orion existants
    const orionInsights = await this.prisma.orionPedagogicalInsight.findMany({
      where: {
        tenantId,
        ...(params.teacherId ? { scopeType: 'TEACHER', scopeId: params.teacherId } : {}),
        ...(params.classId ? { scopeType: 'CLASS', scopeId: params.classId } : {}),
      },
      orderBy: { createdAt: 'desc' as const },
      take: 10,
    });

    return {
      scope,
      coverage: coverageScore,
      metrics,
      insights,
      orionInsights,
      aiConfigured: this.isAiConfigured(),
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── DÉTECTION D'ANOMALIES PÉDAGOGIQUES ────────────────────────────────────

  /**
   * Détecte les anomalies et incohérences dans les données pédagogiques.
   */
  async detectAnomalies(tenantId: string) {
    this.logger.log(`detectAnomalies called for tenant ${tenantId}`);

    const anomalies: Array<{
      entityType: string;
      entityId?: string;
      entityName?: string;
      riskType: string;
      riskDetail: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
    }> = [];

    // 1. Enseignants sans profil académique
    const teachersWithoutProfile = await this.prisma.teacher.findMany({
      where: { tenantId, academicProfile: { is: null } },
    });
    for (const t of teachersWithoutProfile) {
      anomalies.push({
        entityType: 'Teacher',
        entityId: t.id,
        entityName: `${t.firstName || ''} ${t.lastName || ''}`.trim() || t.id,
        riskType: 'PROFIL_MANQUANT',
        riskDetail: `L'enseignant ${t.firstName || ''} ${t.lastName || ''} n'a pas de profil académique. Les habilitations et autorisations ne sont pas définies.`,
        severity: 'HIGH',
      });
    }

    // 2. Classes sans enseignant assigné
    const classesWithAssignments = await this.prisma.teachingAssignment.findMany({
      where: { tenantId },
      select: { classId: true },
      distinct: ['classId'],
    });
    const assignedClassIds = new Set(classesWithAssignments.map(a => a.classId).filter(Boolean));
    const allClasses = await this.prisma.academicClass.findMany({
      where: { tenantId },
    });
    for (const cls of allClasses) {
      if (!assignedClassIds.has(cls.id)) {
        anomalies.push({
          entityType: 'AcademicClass',
          entityId: cls.id,
          entityName: cls.name || cls.id,
          riskType: 'SANS_ENSEIGNANT',
          riskDetail: `La classe "${cls.name || cls.id}" n'a aucun enseignant assigné pour l'année en cours.`,
          severity: 'HIGH',
        });
      }
    }

    // 3. Emplois du temps avec conflits
    const timetables = await this.prisma.timetable.findMany({
      where: { tenantId },
      include: { entries: true },
    });
    for (const tt of timetables) {
      const timeSlots = new Map<string, string[]>();
      for (const entry of tt.entries || []) {
        const key = `${entry.dayOfWeek}-${entry.timeSlotId}`;
        if (!timeSlots.has(key)) timeSlots.set(key, []);
        timeSlots.get(key)!.push(entry.id);
      }
      for (const [slot, entries] of timeSlots) {
        if (entries.length > 1) {
          anomalies.push({
            entityType: 'Timetable',
            entityId: tt.id,
            riskType: 'CONFLIT_EMPLOI_DU_TEMPS',
            riskDetail: `Conflit détecté dans l'emploi du temps : ${entries.length} entrées se chevauchent sur le créneau ${slot}.`,
            severity: 'MEDIUM',
          });
        }
      }
    }

    // 4. Plans de cours non publiés depuis longtemps
    const unpublishedPlans = await this.prisma.lessonPlan.findMany({
      where: { tenantId, status: 'DRAFT' },
      take: 20,
    });
    for (const plan of unpublishedPlans) {
      const daysSinceCreation = Math.floor(
        (Date.now() - new Date(plan.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceCreation > 7) {
        anomalies.push({
          entityType: 'LessonPlan',
          entityId: plan.id,
          entityName: plan.title || plan.id,
          riskType: 'PLAN_NON_PUBLIE',
          riskDetail: `Le plan de cours "${plan.title || plan.id}" est en brouillon depuis ${daysSinceCreation} jours.`,
          severity: daysSinceCreation > 14 ? 'HIGH' : 'MEDIUM',
        });
      }
    }

    // 5. Matériel pédagogique en stock faible
    const lowStockMaterials = await this.prisma.materialStock.findMany({
      where: { tenantId, quantity: { lte: 5 } },
      include: { material: true },
    });
    for (const stock of lowStockMaterials) {
      anomalies.push({
        entityType: 'MaterialStock',
        entityId: stock.id,
        entityName: stock.material?.name || stock.id,
        riskType: 'STOCK_FAIBLE',
        riskDetail: `Le stock de "${stock.material?.name || stock.id}" est bas : ${stock.quantity} unité(s) restante(s).`,
        severity: stock.quantity <= 2 ? 'HIGH' : 'LOW',
      });
    }

    // 6. Cahiers journal non remplis (enseignants sans DailyLog récent)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const teachers = await this.prisma.teacher.findMany({
      where: { tenantId },
    });
    for (const teacher of teachers) {
      const recentLogs = await this.prisma.dailyLog.count({
        where: { tenantId, teacherId: teacher.id, createdAt: { gte: sevenDaysAgo } },
      });
      if (recentLogs === 0) {
        anomalies.push({
          entityType: 'Teacher',
          entityId: teacher.id,
          entityName: `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || teacher.id,
          riskType: 'JOURNAL_VIDE',
          riskDetail: `L'enseignant ${teacher.firstName || ''} ${teacher.lastName || ''} n'a pas rempli son cahier journal depuis plus de 7 jours.`,
          severity: 'MEDIUM',
        });
      }
    }

    return {
      anomalies,
      totalAnomalies: anomalies.length,
      severityBreakdown: {
        HIGH: anomalies.filter(a => a.severity === 'HIGH').length,
        MEDIUM: anomalies.filter(a => a.severity === 'MEDIUM').length,
        LOW: anomalies.filter(a => a.severity === 'LOW').length,
      },
      aiConfigured: this.isAiConfigured(),
      scanTimestamp: new Date().toISOString(),
    };
  }

  // ─── COPILOTE PÉDAGOGIQUE (SARA) ───────────────────────────────────────────

  /**
   * Traite un message du Copilote Pédagogique (Sara) et retourne une réponse
   * contextuelle basée sur les données pédagogiques du tenant.
   */
  async copilotChat(tenantId: string, message: string, conversationHistory?: Array<{ role: string; content: string }>) {
    this.logger.log(`copilotChat called for tenant ${tenantId}`);

    // Récupérer le contexte pédagogique
    const [
      teacherCount,
      classCount,
      subjectCount,
      lessonPlanCount,
      dailyLogCount,
      materialsCount,
    ] = await Promise.all([
      this.prisma.teacher.count({ where: { tenantId } }),
      this.prisma.academicClass.count({ where: { tenantId } }),
      this.prisma.subject.count({ where: { tenantId } }),
      this.prisma.lessonPlan.count({ where: { tenantId } }),
      this.prisma.dailyLog.count({ where: { tenantId } }),
      this.prisma.pedagogicalMaterial.count({ where: { tenantId } }),
    ]);

    if (this.isAiConfigured()) {
      // Appel réel à l'IA via OpenRouter pour le copilote pédagogique
      const systemPrompt = `Tu es Sara, le Copilote Pédagogique d'Academia Helm. Tu aides les enseignants et la direction.
Tu as accès aux données suivantes :
- Enseignants : ${teacherCount}
- Classes : ${classCount}
- Matières : ${subjectCount}
- Plans de cours : ${lessonPlanCount}
- Entrées cahier journal : ${dailyLogCount}
- Matériel pédagogique : ${materialsCount}

RÈGLES :
- Réponds en français
- Sois concis et professionnel
- Base-toi sur les données réelles fournies
- Propose des actions concrètes
- Si tu ne connais pas la réponse, dis-le honnêtement`;

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
      ];

      if (conversationHistory && conversationHistory.length > 0) {
        for (const msg of conversationHistory.slice(-10)) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
          }
        }
      }

      messages.push({ role: 'user', content: message });

      const response = await this.openRouter.chat({
        messages,
        temperature: 0.6,
        maxTokens: 600,
        persona: 'SCE',
      });

      if (!response.isPlaceholder) {
        return {
          reply: response.content,
          isAiEnhanced: true,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Moteur de règles pédagogiques
    const response = this.generateRuleBasedResponse(message, {
      totalTeachers: teacherCount,
      totalClasses: classCount,
      totalSubjects: subjectCount,
      totalLessonPlans: lessonPlanCount,
      totalDailyLogs: dailyLogCount,
      totalMaterials: materialsCount,
    });

    return {
      reply: response,
      isAiEnhanced: this.isAiConfigured(),
      timestamp: new Date().toISOString(),
    };
  }

  // ─── IMPORT DEPUIS LE CAHIER JOURNAL ──────────────────────────────────────

  /**
   * Importe les entrées du cahier journal pour générer des suggestions.
   */
  async importJournal(tenantId: string, data: {
    teacherId: string;
    weekStartDate?: string;
    academicYearId?: string;
  }) {
    this.logger.log(`importJournal called for tenant ${tenantId}, teacherId: ${data.teacherId}`);

    // Récupérer les entrées du journal de l'enseignant
    const whereClause: any = { tenantId, teacherId: data.teacherId };
    if (data.weekStartDate) {
      const weekStart = new Date(data.weekStartDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      whereClause.createdAt = { gte: weekStart, lte: weekEnd };
    }

    const [dailyLogs, classLogs, teachingJournals] = await Promise.all([
      this.prisma.dailyLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' as const },
        take: 20,
      }),
      this.prisma.classLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' as const },
        take: 20,
      }),
      this.prisma.teachingJournal.findMany({
        where: { tenantId, teacherId: data.teacherId },
        orderBy: { createdAt: 'desc' as const },
        take: 5,
      }),
    ]);

    // Extraire les notions des entrées de journal
    const extractedNotions: string[] = [];
    for (const log of dailyLogs) {
      if (log.topics) {
        const topics = Array.isArray(log.topics) ? log.topics : [log.topics];
        extractedNotions.push(...topics.filter((t: any) => typeof t === 'string'));
      }
    }
    for (const log of classLogs) {
      if (log.topic) extractedNotions.push(log.topic);
      if (log.objectives) {
        const objectives = Array.isArray(log.objectives) ? log.objectives : [log.objectives];
        extractedNotions.push(...objectives.filter((o: any) => typeof o === 'string'));
      }
    }

    const uniqueNotions = [...new Set(extractedNotions)];

    // Suggestions de génération basées sur le journal
    const suggestions = uniqueNotions.map((notion, index) => ({
      notion,
      suggestedTypes: ['composition', 'devoir', 'interrogation'] as string[],
      suggestedDifficulty: 'mixte' as string,
      priority: index < 3 ? 'HIGH' as const : 'MEDIUM' as const,
    }));

    return {
      teacherId: data.teacherId,
      entriesFound: {
        dailyLogs: dailyLogs.length,
        classLogs: classLogs.length,
        teachingJournals: teachingJournals.length,
      },
      extractedNotions: uniqueNotions,
      suggestions,
      canGenerate: uniqueNotions.length > 0,
      aiConfigured: this.isAiConfigured(),
    };
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  /**
   * Construit le contexte pédagogique du tenant pour la génération
   */
  private async buildPedagogicalContext(tenantId: string, params: {
    subjectId?: string;
    classId?: string;
    teacherId?: string;
    academicYearId?: string;
  }) {
    const [
      subject,
      academicClass,
      teacher,
      level,
    ] = await Promise.all([
      params.subjectId
        ? this.prisma.subject.findFirst({ where: { id: params.subjectId, tenantId } })
        : null,
      params.classId
        ? this.prisma.academicClass.findFirst({
            where: { id: params.classId, tenantId },
            include: { level: true, series: { include: { seriesSubjects: { include: { subject: true } } } } },
          })
        : null,
      params.teacherId
        ? this.prisma.teacher.findFirst({
            where: { id: params.teacherId, tenantId },
            include: { academicProfile: { include: { qualifications: true } } },
          })
        : null,
      params.classId
        ? this.prisma.academicLevel.findFirst({
            where: { tenantId },
          })
        : null,
    ]);

    return {
      subject,
      academicClass,
      teacher,
      level,
      tenantId,
    };
  }

  /**
   * Récupère les notions du programme pour une matière et classe
   */
  private async getProgramNotions(tenantId: string, subjectId?: string, classId?: string): Promise<string[]> {
    if (!subjectId) return [];

    try {
      const programs = await this.prisma.subjectProgram.findMany({
        where: { tenantId, subjectId },
        select: { title: true, description: true, notions: true },
        take: 10,
      });

      const notions: string[] = [];
      for (const prog of programs) {
        if (prog.title) notions.push(prog.title);
        if (prog.notions && Array.isArray(prog.notions)) {
          notions.push(...prog.notions.filter((n: any) => typeof n === 'string'));
        }
      }
      return [...new Set(notions)];
    } catch {
      return [];
    }
  }

  /**
   * Génère un document à partir du template et du contexte
   */
  private generateFromTemplate(tenantId: string, params: {
    docType: string;
    template: any;
    styleConfig: any;
    numQuestions: number;
    difficulty: string;
    notions: string[];
    context: any;
    skillId?: string;
  }) {
    const { docType, template, styleConfig, numQuestions, difficulty, notions, context, skillId } = params;

    // Sélectionner le skill actif
    const activeSkill = skillId
      ? DEFAULT_SKILLS.find(s => s.id === skillId) || DEFAULT_SKILLS[0]
      : DEFAULT_SKILLS[0];

    // Construire l'en-tête du document
    const header = {
      institution: 'ACADÉMIA HELM',
      department: 'DÉPARTEMENT PÉDAGOGIQUE',
      class: context.academicClass?.name || 'Classe à définir',
      subject: context.subject?.name || 'Matière à définir',
      duration: docType === 'interrogation' ? '30 min' : docType === 'fiche-activite' ? '—' : '1H30',
      date: new Date().toLocaleDateString('fr-FR'),
    };

    // Générer les questions/exercices
    const exercises = this.generateExercises(numQuestions, difficulty, notions, styleConfig, docType);

    // Construire le brouillon du document
    const document = {
      type: docType,
      header,
      style: styleConfig,
      skill: activeSkill,
      exercises,
      notions: notions.length > 0 ? notions : ['Notions à définir via le cahier journal'],
      barème: {
        total: docType === 'interrogation' ? 20 : 20,
        distribution: exercises.map((ex: any, i: number) => ({
          exercice: i + 1,
          points: ex.points,
        })),
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        engine: 'SCE v1.0',
        isPlaceholder: !this.isAiConfigured(),
        aiConfigured: this.isAiConfigured(),
      },
    };

    return document;
  }

  /**
   * Génère les exercices/questions pour le document
   */
  private generateExercises(
    count: number,
    difficulty: string,
    notions: string[],
    styleConfig: any,
    docType: string,
  ) {
    const exercises = [];
    const difficultyPoints: Record<string, number> = {
      facile: { min: 2, max: 3 },
      moyen: { min: 3, max: 5 },
      difficile: { min: 4, max: 6 },
      mixte: { min: 2, max: 6 },
    };
    const pointRange = difficultyPoints[difficulty] || difficultyPoints.mixte;

    for (let i = 0; i < count; i++) {
      const notion = notions[i % notions.length] || 'Notion à définir';
      const points = pointRange.min + Math.floor(Math.random() * (pointRange.max - pointRange.min + 1));

      const exercise: any = {
        numero: i + 1,
        titre: `Exercice ${i + 1} : ${notion}`,
        points,
        questions: this.generateQuestionsForExercise(notion, styleConfig, docType, points),
      };

      exercises.push(exercise);
    }

    // Ajuster les points pour totaliser 20
    const totalPoints = exercises.reduce((sum: number, ex: any) => sum + ex.points, 0);
    if (totalPoints !== 20 && exercises.length > 0) {
      const diff = 20 - totalPoints;
      exercises[exercises.length - 1].points += diff;
    }

    return exercises;
  }

  /**
   * Génère les questions pour un exercice
   */
  private generateQuestionsForExercise(
    notion: string,
    styleConfig: any,
    docType: string,
    points: number,
  ) {
    if (docType === 'interrogation') {
      return [
        {
          text: `[Question rapide - ${notion}]`,
          type: 'court',
          bareme: points,
          saraInsight: `Basé sur les notions de ${notion}. Style: ${styleConfig.approach}.`,
        },
      ];
    }

    if (docType === 'fiche-activite') {
      return [
        {
          text: `Objectif : Maîtriser ${notion}`,
          type: 'activite',
          bareme: points,
          saraInsight: `Activité conçue pour renforcer la compréhension de ${notion}.`,
        },
      ];
    }

    // Composition / Devoir
    return [
      {
        text: `[Question de cours sur ${notion}]`,
        type: 'application',
        bareme: Math.ceil(points * 0.4),
        saraInsight: `Rappel des concepts clés de ${notion}.`,
      },
      {
        text: `[Problème / Situation-problème impliquant ${notion}]`,
        type: 'probleme',
        bareme: Math.floor(points * 0.6),
        saraInsight: `Application contextualisée de ${notion}. Style: ${styleConfig.approach}.`,
      },
    ];
  }

  /**
   * Effectue une analyse basée sur des règles d'un document
   */
  private async performRuleBasedAnalysis(
    tenantId: string,
    analysisType: string,
    documentData: any,
    content?: string,
  ) {
    const analysisResults: any = {
      analysisType,
      isPlaceholder: !this.isAiConfigured(),
      aiConfigured: this.isAiConfigured(),
      analyzedAt: new Date().toISOString(),
    };

    switch (analysisType) {
      case 'quality': {
        let qualityScore = 50; // Score de base
        if (documentData) {
          if (documentData.versions?.length > 1) qualityScore += 15;
          if (documentData.reviews?.length > 0) qualityScore += 10;
          if (documentData.comments?.length > 0) qualityScore += 5;
        }
        if (content && content.length > 200) qualityScore += 10;
        analysisResults.score = Math.min(100, qualityScore);
        analysisResults.recommendations = [
          'Ajouter des situations-problème contextualisées au milieu local',
          'Vérifier l\'alignement avec le programme officiel',
          'Inclure des critères d\'évaluation détaillés',
          'Diversifier les types de questions (QCM, problèmes, rédaction)',
        ];
        break;
      }

      case 'coverage': {
        const programs = await this.prisma.subjectProgram.findMany({
          where: { tenantId },
          select: { subjectId: true, title: true },
        });
        const coveragePercent = programs.length > 0 ? Math.min(100, Math.round((programs.length / 10) * 100)) : 0;
        analysisResults.coveragePercent = coveragePercent;
        analysisResults.programsReferenced = programs.length;
        analysisResults.recommendations = [
          coveragePercent < 50
            ? 'La couverture du programme est insuffisante. Vérifiez que les notions essentielles sont couvertes.'
            : 'La couverture est satisfaisante. Envisagez d\'ajouter des exercices de renforcement.',
          'S\'assurer que chaque chapitre du programme a au moins une évaluation associée',
        ];
        break;
      }

      case 'difficulty': {
        analysisResults.difficultyAssessment = {
          level: 'MIXTE',
          distribution: { facile: '30%', moyen: '50%', difficile: '20%' },
          isAppropriate: true,
        };
        analysisResults.recommendations = [
          'Équilibrer les questions faciles et difficiles pour maintenir la motivation',
          'Inclure au moins une question de haut niveau (analyse/synthèse)',
          'Adapter le vocabulaire au niveau de la classe cible',
        ];
        break;
      }

      case 'alignment': {
        analysisResults.alignmentScore = this.isAiConfigured() ? 75 : 50;
        analysisResults.standardsReferenced = ['Programme national', 'Compétences du socle'];
        analysisResults.recommendations = [
          'Vérifier la conformité avec le programme national en vigueur',
          'S\'assurer que les compétences transversales sont évaluées',
          'Aligner la pondération avec les directives académiques',
        ];
        break;
      }

      default:
        analysisResults.score = 50;
        analysisResults.recommendations = ['Type d\'analyse non reconnu. Utilisez: quality, coverage, difficulty, alignment'];
    }

    return analysisResults;
  }

  /**
   * Récupère les métriques pédagogiques du tenant
   */
  private async getPedagogicalMetrics(tenantId: string, params: {
    teacherId?: string;
    classId?: string;
  }) {
    const teacherFilter = params.teacherId ? { teacherId: params.teacherId } : {};
    const classFilter = params.classId ? { classId: params.classId } : {};

    const [
      totalTeachers,
      totalClasses,
      totalSubjects,
      totalLessonPlans,
      publishedPlans,
      totalDailyLogs,
      recentLogs,
      totalAssignments,
      totalDocuments,
      submittedDocuments,
      approvedDocuments,
    ] = await Promise.all([
      this.prisma.teacher.count({ where: { tenantId } }),
      this.prisma.academicClass.count({ where: { tenantId } }),
      this.prisma.subject.count({ where: { tenantId } }),
      this.prisma.lessonPlan.count({ where: { tenantId, ...teacherFilter } }),
      this.prisma.lessonPlan.count({ where: { tenantId, ...teacherFilter, status: 'PUBLISHED' } }),
      this.prisma.dailyLog.count({ where: { tenantId, ...teacherFilter } }),
      this.prisma.dailyLog.count({
        where: {
          tenantId,
          ...teacherFilter,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.teachingAssignment.count({ where: { tenantId, ...classFilter } }),
      this.prisma.pedagogicalDocument.count({ where: { tenantId, ...teacherFilter } }),
      this.prisma.pedagogicalDocument.count({ where: { tenantId, ...teacherFilter, status: 'SUBMITTED' } }),
      this.prisma.pedagogicalDocument.count({ where: { tenantId, ...teacherFilter, status: 'APPROVED' } }),
    ]);

    return {
      totalTeachers,
      totalClasses,
      totalSubjects,
      lessonPlans: { total: totalLessonPlans, published: publishedPlans, draft: totalLessonPlans - publishedPlans },
      dailyLogs: { total: totalDailyLogs, recent: recentLogs },
      assignments: { total: totalAssignments },
      documents: { total: totalDocuments, submitted: submittedDocuments, approved: approvedDocuments },
    };
  }

  /**
   * Calcule le score de couverture pédagogique
   */
  private calculateCoverageScore(metrics: any) {
    const programCoverage = metrics.lessonPlans.total > 0
      ? Math.round((metrics.lessonPlans.published / Math.max(metrics.lessonPlans.total, 1)) * 100)
      : 0;

    const lessonPlanQuality = metrics.lessonPlans.published > 0 ? 70 : 30;

    const journalRegularity = metrics.dailyLogs.total > 0
      ? Math.min(100, Math.round((metrics.dailyLogs.recent / 5) * 100))
      : 0;

    const evaluationFrequency = metrics.documents.total > 0 ? 60 : 20;

    const totalScore = Math.round(
      programCoverage * COVERAGE_WEIGHTS.programCoverage +
      lessonPlanQuality * COVERAGE_WEIGHTS.lessonPlanQuality +
      journalRegularity * COVERAGE_WEIGHTS.journalRegularity +
      evaluationFrequency * COVERAGE_WEIGHTS.evaluationFrequency
    );

    return {
      total: Math.min(100, totalScore),
      breakdown: {
        programCoverage: { score: programCoverage, weight: COVERAGE_WEIGHTS.programCoverage },
        lessonPlanQuality: { score: lessonPlanQuality, weight: COVERAGE_WEIGHTS.lessonPlanQuality },
        journalRegularity: { score: journalRegularity, weight: COVERAGE_WEIGHTS.journalRegularity },
        evaluationFrequency: { score: evaluationFrequency, weight: COVERAGE_WEIGHTS.evaluationFrequency },
      },
    };
  }

  /**
   * Génère des insights à partir des métriques
   */
  private generateInsightsFromMetrics(metrics: any, coverage: any) {
    const insights: Array<{
      category: string;
      title: string;
      description: string;
      priority: 'INFO' | 'WARNING' | 'CRITICAL';
      action?: string;
    }> = [];

    // Insight sur les plans de cours
    if (metrics.lessonPlans.draft > metrics.lessonPlans.published) {
      insights.push({
        category: 'LESSON_PLANS',
        title: 'Plans de cours en attente',
        description: `${metrics.lessonPlans.draft} plan(s) de cours sont encore en brouillon sur ${metrics.lessonPlans.total} au total. Priorisez leur publication.`,
        priority: 'WARNING',
        action: 'Publier les plans de cours en brouillon',
      });
    }

    // Insight sur les cahiers journal
    if (metrics.dailyLogs.recent === 0 && metrics.totalTeachers > 0) {
      insights.push({
        category: 'DAILY_LOGS',
        title: 'Cahiers journal non remplis',
        description: `Aucune entrée de cahier journal ces 7 derniers jours pour ${metrics.totalTeachers} enseignant(s). Rappel nécessaire.`,
        priority: 'CRITICAL',
        action: 'Envoyer un rappel aux enseignants',
      });
    }

    // Insight sur les assignations
    if (metrics.assignments.total === 0 && metrics.totalClasses > 0) {
      insights.push({
        category: 'ASSIGNMENTS',
        title: 'Classes non couvertes',
        description: `${metrics.totalClasses} classe(s) sans assignation d'enseignement. La rentrée ne semble pas encore configurée.`,
        priority: 'CRITICAL',
        action: 'Configurer les assignations d\'enseignement',
      });
    }

    // Insight sur la validation des documents
    if (metrics.documents.submitted > 0) {
      insights.push({
        category: 'DOCUMENTS',
        title: 'Documents en attente de validation',
        description: `${metrics.documents.submitted} document(s) pédagogique(s) sont en attente de validation par la direction.`,
        priority: 'WARNING',
        action: 'Valider les documents soumis',
      });
    }

    // Insight positif sur la couverture
    if (coverage.total >= 70) {
      insights.push({
        category: 'COVERAGE',
        title: 'Couverture pédagogique satisfaisante',
        description: `Le score de couverture pédagogique est de ${coverage.total}%. Continuez sur cette lancée.`,
        priority: 'INFO',
      });
    }

    return insights;
  }

  /**
   * Génère une réponse basée sur des règles pour le copilote pédagogique
   */
  private generateRuleBasedResponse(
    message: string,
    context: {
      totalTeachers: number;
      totalClasses: number;
      totalSubjects: number;
      totalLessonPlans: number;
      totalDailyLogs: number;
      totalMaterials: number;
    },
  ): string {
    const textLower = message.toLowerCase();

    if (textLower.includes('épreuve') || textLower.includes('devoir') || textLower.includes('exercice') || textLower.includes('composition') || textLower.includes('génér')) {
      return `Je peux vous aider à générer des documents pédagogiques ! Utilisez l'onglet **"Sara Compose"** pour :\n\n1. Choisir le type (épreuve, devoir, interrogation, fiche d'activité)\n2. Sélectionner la matière et la classe\n3. Définir le style (situation-problème, classique, examen officiel, ludique)\n4. Importer les notions depuis votre cahier journal\n\n💡 *${context.totalSubjects} matière(s) disponible(s) dans votre base.*`;
    }

    if (textLower.includes('plan') && (textLower.includes('cours') || textLower.includes('leçon'))) {
      if (context.totalLessonPlans > 0) {
        return `Vous avez **${context.totalLessonPlans} plan(s) de cours** enregistré(s). Pour en créer un nouveau, allez dans l'onglet "Production". Je peux aussi vous aider à analyser la qualité de vos plans existants.`;
      }
      return "Aucun plan de cours n'a encore été créé. Commencez par l'onglet **Production** pour créer votre premier plan de cours structuré.";
    }

    if (textLower.includes('cahier') || textLower.includes('journal') || textLower.includes('cournal')) {
      if (context.totalDailyLogs > 0) {
        return `**${context.totalDailyLogs} entrée(s)** de cahier journal enregistrée(s). N'oubliez pas de remplir votre cahier journal quotidiennement — c'est essentiel pour le suivi pédagogique et la génération d'épreuves avec Sara Compose.`;
      }
      return "Le cahier journal n'a pas encore été rempli. C'est un outil essentiel pour :\n- Assurer le suivi de vos cours\n- Générer automatiquement des épreuves adaptées\n- Faciliter les validations par la direction\n\nCommencez dans l'onglet **Production**.";
    }

    if (textLower.includes('enseignant') || textLower.includes('professeur') || textLower.includes('maître')) {
      return `Selon les données pédagogiques :\n- **${context.totalTeachers}** enseignant(s) enregistré(s)\n- **${context.totalClasses}** classe(s) configurée(s)\n- **${context.totalSubjects}** matière(s) disponible(s)\n\nPour gérer les profils académiques et les assignations, consultez l'onglet **Enseignants**.`;
    }

    if (textLower.includes('matière') || textLower.includes('discipline') || textLower.includes('programme')) {
      return `**${context.totalSubjects}** matière(s) enregistrée(s) dans votre base pédagogique. Chaque matière peut être associée à un programme officiel avec des notions et compétences. Consultez l'onglet **Matières** pour la gestion et **Séries** pour les programmes.`;
    }

    if (textLower.includes('matériel') || textLower.includes('fourniture') || textLower.includes('stock')) {
      if (context.totalMaterials > 0) {
        return `Vous avez **${context.totalMaterials}** article(s) de matériel pédagogique enregistré(s). Consultez l'onglet **Matériel & Fournitures** pour gérer les stocks, les mouvements et les assignations aux enseignants.`;
      }
      return "Le module de gestion du matériel pédagogique est prêt. Consultez l'onglet **Matériel & Fournitures** pour :\n- Inventorier le matériel disponible\n- Suivre les mouvements et assignations\n- Gérer les fournitures annuelles des enseignants";
    }

    if (textLower.includes('emploi') && textLower.includes('temps')) {
      return "L'emploi du temps peut être configuré dans l'onglet **Emplois du Temps**. Je peux vous aider à :\n- Détecter les conflits de créneaux\n- Optimiser la répartition des salles\n- Vérifier la charge horaire des enseignants";
    }

    if (textLower.includes('validation') || textLower.includes('valider') || textLower.includes('approuver')) {
      return "Le workflow de validation pédagogique permet à la direction de :\n- Réviser et approuver les documents soumis\n- Ajouter des commentaires et observations\n- Suivre les versions et l'historique\n\nConsultez l'onglet **Validation Direction** pour le tableau de bord de validation.";
    }

    if (textLower.includes('classe') || textLower.includes('niveau') || textLower.includes('série')) {
      return `**${context.totalClasses}** classe(s) configurée(s). La structure académique (niveaux, cycles, classes, séries) est gérée dans l'onglet **Structure**. Pour les assignations d'enseignants, utilisez l'onglet **Assignations**.`;
    }

    if (textLower.includes('bonjour') || textLower.includes('salut') || textLower.includes('hello') || textLower.includes('hey')) {
      return `Bonjour ! Je suis Sara, votre Copilote Pédagogique. Je peux vous aider avec :\n- La génération d'épreuves et devoirs (Sara Compose)\n- L'analyse de vos documents pédagogiques\n- Le suivi de la couverture des programmes\n- La gestion des cahiers journal\n- Les insights pédagogiques\n\nQue puis-je faire pour vous ?`;
    }

    // Réponse par défaut
    return `Entendu ! J'analyse les données pédagogiques disponibles. Pour des réponses plus pertinentes, essayez de demander :\n- "Génère une épreuve de mathématiques"\n- "Quel est l'état des cahiers journal ?"\n- "Combien de plans de cours en brouillon ?"\n- "Analyse la couverture pédagogique"\n\n💡 *L'intégration IA complète nécessite une clé API Claude ou OpenAI.*`;
  }
}
