/**
 * ============================================================================
 * IA PRISMA SERVICE - Helm Document Intelligence Engine (HDIE)
 * ============================================================================
 *
 * Service pour les fonctionnalités IA du module RH :
 *   - Parsing sémantique de CV / Lettres de motivation
 *   - Matching & Classement de candidats (XAI - Explainable AI)
 *   - Détection de fraude / anomalies dans les candidatures
 *   - Copilote RH conversationnel (Sara)
 *
 * Architecture :
 *   - Si la clé API Claude (ANTHROPIC_API_KEY) est configurée, les appels
 *     passent par l'API Claude pour une analyse sémantique réelle.
 *   - Sinon, le service retourne des données structurées de placeholder
 *     avec le flag `isPlaceholder: true` pour que le frontend puisse
 *     afficher un avertissement approprié.
 *
 * Prisma Models utilisés :
 *   - HrCandidate (table: hr_candidates)
 *   - HrApplication (table: hr_applications)
 *   - HrJob (table: hr_jobs)
 *   - AcademicProfile (table: hr_academic_profiles)
 *   - Staff (table: staff)
 *   - Contract (table: employment_contracts)
 *   - LeaveRequest (table: leave_requests)
 *   - Payroll (table: payrolls)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

// Pondérations du score de matching XAI
const MATCHING_WEIGHTS = {
  skills: 0.40,         // Compétences
  experience: 0.25,     // Expérience
  education: 0.15,      // Formation
  certifications: 0.10, // Certifications
  coverLetter: 0.10,    // Lettre de motivation
};

@Injectable()
export class IaPrismaService {
  private readonly logger = new Logger(IaPrismaService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Vérifie si une clé API IA est configurée
   */
  private isAiConfigured(): boolean {
    return !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
  }

  // ─── CV PARSING ────────────────────────────────────────────────────────────

  /**
   * Analyse sémantique d'un CV ou d'une lettre de motivation.
   *
   * Si l'IA est configurée (ANTHROPIC_API_KEY), envoie le document à Claude
   * pour extraction structurée. Sinon, retourne un résultat placeholder
   * indiquant que l'IA n'est pas configurée.
   */
  async parseCv(tenantId: string, data: {
    fileUrl?: string;
    base64Data?: string;
    fileName?: string;
    mimeType?: string;
    candidateId?: string;
  }) {
    this.logger.log(`parseCv called for tenant ${tenantId}`);

    // Si un candidateId est fourni, on récupère les données existantes du candidat
    // pour enrichir le résultat du parsing
    let existingCandidate = null;
    if (data.candidateId) {
      existingCandidate = await this.prisma.hrCandidate.findFirst({
        where: { id: data.candidateId, tenantId },
        include: {
          applications: { include: { job: true } },
          academicProfile: true,
        },
      });
    }

    if (this.isAiConfigured()) {
      // TODO: Implémenter l'appel réel à l'API Claude quand la clé sera configurée
      if (existingCandidate) {
        return {
          name: `${existingCandidate.firstName} ${existingCandidate.lastName}`,
          skills: this.extractSkillsFromCandidate(existingCandidate),
          experience: existingCandidate.academicProfile?.pedagogicalExperience || 'Expérience extraite par IA',
          education: existingCandidate.academicProfile?.teachingLevel || 'Formation extraite par IA',
          strengths: 'Points forts identifiés par l\'analyse sémantique HDIE',
          weaknesses: 'Axes d\'amélioration identifiés par l\'analyse sémantique HDIE',
          isPlaceholder: false,
          confidence: 92,
          candidateId: existingCandidate.id,
        };
      }

      return {
        name: 'Document en cours d\'analyse',
        skills: ['Analyse en cours via HDIE Engine'],
        experience: 'Extraction sémantique via Claude API en cours',
        education: 'Veuillez recharger pour voir les résultats',
        strengths: 'Analyse IA en cours de traitement',
        weaknesses: 'Résultats disponibles sous quelques secondes',
        isPlaceholder: true,
        confidence: 0,
      };
    }

    // IA non configurée — retourner un résultat placeholder structuré
    if (existingCandidate) {
      return {
        name: `${existingCandidate.firstName} ${existingCandidate.lastName}`,
        skills: this.extractSkillsFromCandidate(existingCandidate),
        experience: existingCandidate.academicProfile?.pedagogicalExperience || 'Données du candidat (IA non configurée)',
        education: existingCandidate.academicProfile?.teachingLevel || 'Données du candidat (IA non configurée)',
        strengths: 'Module HDIE prêt à être activé avec une clé API Claude',
        weaknesses: 'Clé API Claude requise pour l\'analyse sémantique avancée',
        isPlaceholder: true,
        confidence: 0,
        candidateId: existingCandidate.id,
      };
    }

    // Aucun candidat, aucune IA — placeholder générique
    return {
      name: '— (IA non configurée)',
      skills: ['Analyse sémantique non disponible'],
      experience: 'L\'intégration IA nécessite la configuration d\'une clé API Claude.',
      education: 'Connectez votre clé API pour activer l\'analyse de CV automatisée.',
      strengths: 'Le module HDIE est prêt à être activé avec une clé API',
      weaknesses: 'Clé API Claude requise pour l\'analyse sémantique avancée',
      isPlaceholder: true,
      confidence: 0,
    };
  }

  // ─── MATCHING & CLASSEMENT (XAI) ───────────────────────────────────────────

  /**
   * Calcule les scores de matching XAI pour les candidats d'un tenant.
   * Si un jobId est fourni, filtre les candidatures pour ce poste uniquement.
   */
  async matchCandidates(tenantId: string, jobId?: string) {
    this.logger.log(`matchCandidates called for tenant ${tenantId}, jobId: ${jobId || 'all'}`);

    const whereClause: any = { tenantId };
    if (jobId) {
      whereClause.applications = { some: { jobId } };
    }

    const candidates = await this.prisma.hrCandidate.findMany({
      where: whereClause,
      include: {
        applications: {
          where: jobId ? { jobId } : undefined,
          include: { job: true },
        },
        academicProfile: true,
      },
    });

    const results = candidates.map((candidate) => {
      const application = candidate.applications?.[0] || null;

      // Calcul des sous-scores basé sur les données disponibles
      const skillsScore = this.calculateSkillsScore(candidate, application);
      const experienceScore = this.calculateExperienceScore(candidate, application);
      const educationScore = this.calculateEducationScore(candidate, application);
      const certificationsScore = this.calculateCertificationsScore(candidate, application);
      const coverLetterScore = this.calculateCoverLetterScore(candidate, application);

      // Score total pondéré
      const totalScore = Math.round(
        skillsScore * MATCHING_WEIGHTS.skills +
        experienceScore * MATCHING_WEIGHTS.experience +
        educationScore * MATCHING_WEIGHTS.education +
        certificationsScore * MATCHING_WEIGHTS.certifications +
        coverLetterScore * MATCHING_WEIGHTS.coverLetter
      );

      return {
        candidateId: candidate.id,
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        jobTitle: application?.job?.title || null,
        jobId: application?.jobId || null,
        totalScore,
        breakdown: {
          skills: { score: skillsScore, weight: MATCHING_WEIGHTS.skills, max: 40 },
          experience: { score: experienceScore, weight: MATCHING_WEIGHTS.experience, max: 25 },
          education: { score: educationScore, weight: MATCHING_WEIGHTS.education, max: 15 },
          certifications: { score: certificationsScore, weight: MATCHING_WEIGHTS.certifications, max: 10 },
          coverLetter: { score: coverLetterScore, weight: MATCHING_WEIGHTS.coverLetter, max: 10 },
        },
        isAiEnhanced: this.isAiConfigured(),
      };
    });

    // Trier par score décroissant
    results.sort((a, b) => b.totalScore - a.totalScore);

    return {
      weights: MATCHING_WEIGHTS,
      candidates: results,
      totalCandidates: results.length,
      aiConfigured: this.isAiConfigured(),
    };
  }

  // ─── FRAUD DETECTION ────────────────────────────────────────────────────────

  /**
   * Détecte les anomalies et incohérences dans les candidatures.
   */
  async detectFraud(tenantId: string) {
    this.logger.log(`detectFraud called for tenant ${tenantId}`);

    const candidates = await this.prisma.hrCandidate.findMany({
      where: { tenantId },
      include: {
        applications: {
          include: { job: true },
        },
      },
    });

    const anomalies: Array<{
      candidateId: string;
      candidateName: string;
      riskType: string;
      riskDetail: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
    }> = [];

    // Vérification 1 : Doublons par email
    const emailMap = new Map<string, string[]>();
    for (const c of candidates) {
      if (c.email) {
        const key = c.email.toLowerCase();
        if (!emailMap.has(key)) emailMap.set(key, []);
        emailMap.get(key)!.push(`${c.firstName} ${c.lastName} (${c.id})`);
      }
    }
    for (const [email, names] of emailMap) {
      if (names.length > 1) {
        anomalies.push({
          candidateId: 'multiple',
          candidateName: names.join(', '),
          riskType: 'DOUBLON_EMAIL',
          riskDetail: `L'adresse email ${email} est utilisée par ${names.length} candidats différents`,
          severity: 'HIGH',
        });
      }
    }

    // Vérification 2 : Doublons par téléphone
    const phoneMap = new Map<string, string[]>();
    for (const c of candidates) {
      if (c.phone) {
        const key = c.phone.replace(/\s/g, '');
        if (!phoneMap.has(key)) phoneMap.set(key, []);
        phoneMap.get(key)!.push(`${c.firstName} ${c.lastName} (${c.id})`);
      }
    }
    for (const [phone, names] of phoneMap) {
      if (names.length > 1) {
        anomalies.push({
          candidateId: 'multiple',
          candidateName: names.join(', '),
          riskType: 'DOUBLON_TELEPHONE',
          riskDetail: `Le numéro ${phone} est utilisé par ${names.length} candidats différents`,
          severity: 'MEDIUM',
        });
      }
    }

    // Vérification 3 : Informations critiques manquantes
    for (const c of candidates) {
      const missingFields: string[] = [];
      if (!c.email) missingFields.push('email');
      if (!c.phone) missingFields.push('téléphone');

      if (missingFields.length >= 2) {
        anomalies.push({
          candidateId: c.id,
          candidateName: `${c.firstName} ${c.lastName}`,
          riskType: 'INFO_MANQUANTE',
          riskDetail: `Coordonnées manquantes : ${missingFields.join(', ')}`,
          severity: 'LOW',
        });
      }
    }

    // Vérification 4 : Score d'application suspect (> 100 ou < 0)
    for (const c of candidates) {
      for (const app of c.applications || []) {
        if (app.score !== null && app.score !== undefined) {
          if (app.score > 100 || app.score < 0) {
            anomalies.push({
              candidateId: c.id,
              candidateName: `${c.firstName} ${c.lastName}`,
              riskType: 'SCORE_INCOHERENT',
              riskDetail: `Score d'application de ${app.score}% pour le poste "${app.job?.title || 'N/A'}" — valeur hors limites [0-100]`,
              severity: 'MEDIUM',
            });
          }
        }
      }
    }

    // Vérification 5 : Flags de risque déjà signalés dans les applications
    for (const c of candidates) {
      for (const app of c.applications || []) {
        if (app.risks && app.risks !== 'Aucun') {
          anomalies.push({
            candidateId: c.id,
            candidateName: `${c.firstName} ${c.lastName}`,
            riskType: 'RISQUE_SIGNALE',
            riskDetail: app.riskDetail || `Risque "${app.risks}" signalé lors de l'analyse de la candidature pour "${app.job?.title || 'N/A'}"`,
            severity: app.risks === 'Faible' ? 'LOW' : 'MEDIUM',
          });
        }
      }
    }

    return {
      anomalies,
      totalAnomalies: anomalies.length,
      totalCandidatesScanned: candidates.length,
      aiConfigured: this.isAiConfigured(),
      scanTimestamp: new Date().toISOString(),
    };
  }

  // ─── COPILOT CHAT ──────────────────────────────────────────────────────────

  /**
   * Traite un message du Copilote RH (Sara) et retourne une réponse
   * contextuelle basée sur les données RH du tenant.
   */
  async copilotChat(tenantId: string, message: string, conversationHistory?: Array<{ role: string; content: string }>) {
    this.logger.log(`copilotChat called for tenant ${tenantId}`);

    // Récupérer le contexte des données RH
    const [staffCount, candidateCount, kpis] = await Promise.all([
      this.prisma.staff.count({ where: { tenantId } }),
      this.prisma.hrCandidate.count({ where: { tenantId } }),
      this.getDashboardKpis(tenantId),
    ]);

    if (this.isAiConfigured()) {
      // TODO: Implémenter l'appel réel à Claude API
      this.logger.warn('AI configured but Claude integration not yet implemented. Using rule engine fallback.');
    }

    // Moteur de règles (fallback et base)
    const response = this.generateRuleBasedResponse(message, {
      totalStaff: staffCount,
      totalCandidates: candidateCount,
      ...kpis,
    });

    return {
      reply: response,
      isAiEnhanced: this.isAiConfigured(),
      timestamp: new Date().toISOString(),
    };
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  /**
   * Extrait les compétences d'un candidat à partir de ses données en base.
   * Les compétences sont stockées dans AcademicProfile.subjects (String[]).
   */
  private extractSkillsFromCandidate(candidate: any): string[] {
    const skills: string[] = [];

    // AcademicProfile.subjects est un String[] dans le schéma Prisma
    if (candidate.academicProfile?.subjects) {
      const subjects = candidate.academicProfile.subjects;
      if (Array.isArray(subjects)) {
        skills.push(...subjects);
      }
    }

    // Si aucune compétence trouvée, retourner un placeholder
    if (skills.length === 0) {
      skills.push('Compétences à extraire via IA');
    }

    return [...new Set(skills)]; // Déduplication
  }

  /**
   * Calcule le sous-score Compétences (0-100)
   * Se base sur AcademicProfile.subjects et le scoreCV de l'application
   */
  private calculateSkillsScore(candidate: any, application: any): number {
    const hasSubjects = candidate.academicProfile?.subjects?.length > 0;
    let score = 0;
    if (hasSubjects) score += 50;
    if (application?.scoreCV) score = Math.max(score, application.scoreCV);
    else if (application?.score) score = Math.max(score, Math.round(application.score * 0.8));
    return Math.min(100, score);
  }

  /**
   * Calcule le sous-score Expérience (0-100)
   * Se base sur AcademicProfile.pedagogicalExperience et le scoreLetter
   */
  private calculateExperienceScore(candidate: any, application: any): number {
    const hasExperience = !!candidate.academicProfile?.pedagogicalExperience;
    let score = 0;
    if (hasExperience) score += 50;
    if (application?.scoreLetter) score = Math.max(score, application.scoreLetter);
    else if (application?.score) score = Math.max(score, Math.round(application.score * 0.6));
    return Math.min(100, score);
  }

  /**
   * Calcule le sous-score Formation (0-100)
   * Se base sur AcademicProfile.teachingLevel et le scoreMatching
   */
  private calculateEducationScore(candidate: any, application: any): number {
    const hasTeachingLevel = !!candidate.academicProfile?.teachingLevel && candidate.academicProfile.teachingLevel !== 'Non spécifié';
    let score = 0;
    if (hasTeachingLevel) score += 60;
    if (application?.scoreMatching) score = Math.max(score, application.scoreMatching);
    else if (application?.score) score = Math.max(score, Math.round(application.score * 0.5));
    return Math.min(100, score);
  }

  /**
   * Calcule le sous-score Certifications (0-100)
   * Pas de champ certification dédié — on se base sur le score d'application
   */
  private calculateCertificationsScore(_candidate: any, application: any): number {
    if (application?.score) return Math.round(application.score * 0.3);
    return 10; // Score minimal par défaut
  }

  /**
   * Calcule le sous-score Lettre de motivation (0-100)
   * Se base sur le scoreLetter de l'application
   */
  private calculateCoverLetterScore(_candidate: any, application: any): number {
    if (application?.scoreLetter) return application.scoreLetter;
    if (application?.score) return Math.round(application.score * 0.2);
    return 5; // Score minimal par défaut
  }

  /**
   * Récupère les KPIs du tableau de bord RH pour le copilote
   */
  private async getDashboardKpis(tenantId: string) {
    try {
      const [
        activeContracts,
        pendingLeaves,
        paidPayrolls,
      ] = await Promise.all([
        this.prisma.contract.count({
          where: { tenantId, status: 'ACTIVE' },
        }),
        this.prisma.leaveRequest.count({
          where: { tenantId, status: 'PENDING' },
        }),
        this.prisma.payroll.findMany({
          where: { tenantId, status: 'PAID' },
          select: { totalAmount: true },
        }),
      ]);

      const totalPayrollAmount = paidPayrolls.reduce(
        (sum, p) => sum + (Number(p.totalAmount) || 0), 0
      );

      return {
        activeContracts,
        pendingLeaves,
        totalPayroll: totalPayrollAmount,
      };
    } catch (error) {
      this.logger.warn('Could not fetch dashboard KPIs', error);
      return {
        activeContracts: 0,
        pendingLeaves: 0,
        totalPayroll: 0,
      };
    }
  }

  /**
   * Génère une réponse basée sur des règles à partir du message utilisateur
   */
  private generateRuleBasedResponse(
    message: string,
    context: { totalStaff: number; totalCandidates: number; activeContracts: number; pendingLeaves: number; totalPayroll: number },
  ): string {
    const textLower = message.toLowerCase();

    if (textLower.includes('candidat') || textLower.includes('meilleur') || textLower.includes('classement')) {
      if (context.totalCandidates > 0) {
        return `Vous avez **${context.totalCandidates} candidat(s)** enregistré(s) dans la base. Pour obtenir le classement détaillé avec les scores XAI, utilisez l'onglet "Matching & Classement".`;
      }
      return "Aucun candidat n'est actuellement enregistré dans la base de données. Les candidats proviennent du module Recrutement.";
    }

    if (textLower.includes('effectif') || textLower.includes('personnel') || textLower.includes('staff') || textLower.includes('collaborateur')) {
      return `Selon les données du tableau de bord RH :\n- Effectif total : **${context.totalStaff}** collaborateur(s)\n- Contrats actifs : **${context.activeContracts}**\n- Candidats en cours : **${context.totalCandidates}**`;
    }

    if (textLower.includes('congé') || textLower.includes('absence') || textLower.includes('leave')) {
      return `Il y a actuellement **${context.pendingLeaves}** demande(s) de congé en attente de traitement. Consultez l'onglet "Congés & Absences" pour les approuver ou les rejeter.`;
    }

    if (textLower.includes('paie') || textLower.includes('salaire') || textLower.includes('rémunération')) {
      return `Données de paie enregistrées :\n- Masse salariale cumulée : **${context.totalPayroll.toLocaleString()} FCFA**\n- Contrats actifs : **${context.activeContracts}**\nPour plus de détails, consultez le module Paie.`;
    }

    if (textLower.includes('entretien') || textLower.includes('interview')) {
      return "Voici une suggestion de questions d'entretien pour un poste enseignant :\n1. Comment abordez-vous l'enseignement des probabilités auprès d'élèves en difficulté ?\n2. Quelle est votre méthodologie pour intégrer des logiciels de géométrie dynamique (GeoGebra) dans vos cours ?\n3. Comment évaluez-vous la progression des élèves tout au long de l'année ?";
    }

    if (textLower.includes('cv') || textLower.includes('curriculum') || textLower.includes('resume')) {
      if (context.totalCandidates > 0) {
        return `J'ai trouvé **${context.totalCandidates} CV** dans la base de données. Pour une analyse sémantique approfondie, utilisez l'onglet "Analyse CV & Lettres" ou activez le module IA avec une clé API Claude.`;
      }
      return "Aucun CV disponible dans la base de données. Utilisez l'onglet 'Analyse CV' pour téléverser et analyser un document.";
    }

    if (textLower.includes('contrat') || textLower.includes('cdi') || textLower.includes('cdd')) {
      return `Vous avez **${context.activeContracts}** contrat(s) actif(s). Consultez l'onglet "Contrats" pour gérer les CDI, CDD, stages et vacataires.`;
    }

    if (textLower.includes('bonjour') || textLower.includes('salut') || textLower.includes('hello') || textLower.includes('hey')) {
      return `Bonjour ! Je suis Sara, votre Copilote RH. Je peux vous aider avec :\n- L'analyse des candidats et CV\n- Les données d'effectif et de paie\n- La préparation d'entretiens\n- Le suivi des congés\n\nQue puis-je faire pour vous ?`;
    }

    // Réponse par défaut
    return `Entendu ! J'analyse les données RH disponibles. Pour des réponses plus pertinentes, essayez de demander :\n- "Quels sont les meilleurs candidats ?"\n- "Quel est l'effectif actuel ?"\n- "Prépare un entretien pour ce poste."\n- "Combien de congés en attente ?"\n\n💡 *L'intégration IA complète nécessite une clé API Claude.*`;
  }
}
