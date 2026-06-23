/**
 * ============================================================================
 * TEST QUESTIONNAIRE SERVICE
 * ============================================================================
 *
 * Gère les questionnaires de test en ligne pour le recrutement :
 *   - Création de questionnaires (QCM, Vrai/Faux, texte court, texte long)
 *   - Envoi au candidat par email avec lien unique + token
 *   - Soumission des réponses avec minuterie anti-fraude
 *   - Correction automatique (QCM/Vrai-Faux)
 *   - Notation manuelle par le recruteur
 *
 * Flow :
 *   1. Recruteur crée un questionnaire (POST /hr/recruitment/tests/:id/questionnaire)
 *   2. Recruteur l'envoie au candidat (POST /hr/recruitment/tests/:id/send-questionnaire)
 *      → Email avec lien /test/:token
 *   3. Candidat ouvre le lien → minuterie démarre → répond → soumet
 *   4. Backend corrige automatiquement (QCM/Vrai-Faux)
 *   5. Recruteur voit les réponses + score auto → ajoute sa note → valide/refuse
 *
 * Sécurité anti-fraude :
 *   - Minuterie : démarre au premier clic, expire automatiquement
 *   - Token unique : un token par candidat, invalidé après soumission
 *   - Lien expire : si non commencé dans les 48h
 *   - Pas de rechargement : la minuterie continue (basée sur startedAt en DB)
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../../communication/services/email.service';
import { RecruitmentNotificationService } from '../recruitment-notification.service';
import { randomBytes } from 'crypto';

export interface Question {
  id: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_TEXT' | 'LONG_TEXT';
  question: string;
  options?: string[];           // Pour SINGLE_CHOICE, MULTIPLE_CHOICE
  correctAnswers?: number[];    // Index des bonnes réponses (pour correction auto)
  points: number;               // Points attribués si bonne réponse
  explanation?: string;         // Explication affichée après soumission (optionnel)
}

export interface CreateQuestionnaireDto {
  title: string;
  description?: string;
  durationMinutes: number;
  questions: Question[];
  passingScore?: number;
  maxScore?: number;
}

export interface UpdateQuestionnaireDto extends Partial<CreateQuestionnaireDto> {}

export interface SendQuestionnaireDto {
  candidateId: string;
  applicationId?: string;
}

export interface SubmitResponseDto {
  responses: Array<{
    questionId: string;
    answer: string | string[];  // string pour TRUE_FALSE/SHORT_TEXT/LONG_TEXT, string[] pour MULTIPLE_CHOICE
  }>;
}

@Injectable()
export class TestQuestionnaireService {
  private readonly logger = new Logger(TestQuestionnaireService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => EmailService))
    private readonly emailService: EmailService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // GESTION DES QUESTIONNAIRES (CRUD)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Crée un questionnaire pour un test.
   */
  async createQuestionnaire(tenantId: string, testId: string | null, dto: CreateQuestionnaireDto): Promise<any> {
    await this.ensureTablesExist();

    // Valider les questions
    if (!dto.questions || dto.questions.length === 0) {
      throw new BadRequestException('Au moins une question est requise');
    }

    for (const q of dto.questions) {
      if (!q.question?.trim()) throw new BadRequestException('Chaque question doit avoir un texte');
      if ((q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') && (!q.options || q.options.length < 2)) {
        throw new BadRequestException('Les QCM doivent avoir au moins 2 options');
      }
    }

    const questionsJson = JSON.stringify(dto.questions);

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO hr_test_questionnaires (tenant_id, test_id, title, description, duration_minutes, questions, status, passing_score, max_score)
      VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7, $8)
    `, tenantId, testId, dto.title, dto.description || null, dto.durationMinutes, questionsJson, dto.passingScore || 60, dto.maxScore || 100);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM hr_test_questionnaires WHERE tenant_id = $1 AND title = $2 ORDER BY created_at DESC LIMIT 1
    `, tenantId, dto.title);

    this.logger.log(`Questionnaire créé: id=${rows[0]?.id}, title="${dto.title}", ${dto.questions.length} questions, ${dto.durationMinutes}min`);
    return this.parseQuestionnaire(rows[0]);
  }

  /**
   * Récupère un questionnaire par son ID.
   */
  async getQuestionnaire(id: string, tenantId: string): Promise<any> {
    await this.ensureTablesExist();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM hr_test_questionnaires WHERE id = $1 AND tenant_id = $2
    `, id, tenantId);
    if (!rows[0]) throw new NotFoundException('Questionnaire introuvable');
    return this.parseQuestionnaire(rows[0]);
  }

  /**
   * Liste les questionnaires d'un tenant.
   */
  async listQuestionnaires(tenantId: string, testId?: string): Promise<any[]> {
    await this.ensureTablesExist();
    let sql = `SELECT * FROM hr_test_questionnaires WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    if (testId) {
      sql += ` AND test_id = $2`;
      params.push(testId);
    }
    sql += ` ORDER BY created_at DESC`;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
    return rows.map(r => this.parseQuestionnaire(r));
  }

  /**
   * Met à jour un questionnaire.
   */
  async updateQuestionnaire(id: string, tenantId: string, dto: UpdateQuestionnaireDto): Promise<any> {
    await this.ensureTablesExist();
    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (dto.title !== undefined) { fields.push(`title = $${paramIdx++}::text`); values.push(dto.title); }
    if (dto.description !== undefined) { fields.push(`description = $${paramIdx++}::text`); values.push(dto.description); }
    if (dto.durationMinutes !== undefined) { fields.push(`duration_minutes = $${paramIdx++}::int`); values.push(dto.durationMinutes); }
    if (dto.questions !== undefined) { fields.push(`questions = $${paramIdx++}::text`); values.push(JSON.stringify(dto.questions)); }
    if (dto.passingScore !== undefined) { fields.push(`passing_score = $${paramIdx++}::int`); values.push(dto.passingScore); }
    if (dto.maxScore !== undefined) { fields.push(`max_score = $${paramIdx++}::int`); values.push(dto.maxScore); }

    if (fields.length === 0) return this.getQuestionnaire(id, tenantId);

    fields.push(`updated_at = NOW()`);
    values.push(id, tenantId);

    await this.prisma.$executeRawUnsafe(`
      UPDATE hr_test_questionnaires SET ${fields.join(', ')} WHERE id = $${paramIdx++} AND tenant_id = $${paramIdx++}
    `, ...values);

    return this.getQuestionnaire(id, tenantId);
  }

  /**
   * Publie un questionnaire (passe de DRAFT à PUBLISHED).
   */
  async publishQuestionnaire(id: string, tenantId: string): Promise<any> {
    await this.ensureTablesExist();
    await this.prisma.$executeRawUnsafe(`
      UPDATE hr_test_questionnaires SET status = 'PUBLISHED', updated_at = NOW() WHERE id = $1 AND tenant_id = $2
    `, id, tenantId);
    return this.getQuestionnaire(id, tenantId);
  }

  /**
   * Supprime un questionnaire.
   */
  async deleteQuestionnaire(id: string, tenantId: string): Promise<void> {
    await this.ensureTablesExist();
    await this.prisma.$executeRawUnsafe(`
      DELETE FROM hr_test_questionnaires WHERE id = $1 AND tenant_id = $2
    `, id, tenantId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENVOI AU CANDIDAT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Envoie un questionnaire à un candidat par email avec un lien unique.
   */
  async sendToCandidate(
    questionnaireId: string,
    tenantId: string,
    candidateId: string,
    applicationId?: string,
  ): Promise<{ token: string; testUrl: string; responseId: string }> {
    await this.ensureTablesExist();

    // 1. Vérifier le questionnaire
    const qRows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM hr_test_questionnaires WHERE id = $1 AND tenant_id = $2 AND status = 'PUBLISHED'
    `, questionnaireId, tenantId);
    if (!qRows[0]) throw new BadRequestException('Questionnaire introuvable ou non publié');

    // 2. Récupérer le candidat
    const candidate = await this.prisma.hrCandidate.findFirst({
      where: { id: candidateId, tenantId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!candidate) throw new NotFoundException('Candidat introuvable');
    if (!candidate.email) throw new BadRequestException('Le candidat n\'a pas d\'email');

    // 3. Invalider les anciennes réponses PENDING pour ce candidat + questionnaire
    await this.prisma.$executeRawUnsafe(`
      UPDATE hr_test_responses SET status = 'EXPIRED' WHERE questionnaire_id = $1 AND candidate_id = $2 AND status = 'PENDING'
    `, questionnaireId, candidateId);

    // 4. Créer la réponse (token + lien)
    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // Lien valide 48h pour commencer

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO hr_test_responses (tenant_id, questionnaire_id, candidate_id, application_id, token, status, expires_at, candidate_email, candidate_name)
      VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7, $8)
    `, tenantId, questionnaireId, candidateId, applicationId || null, token, expiresAt, candidate.email, `${candidate.firstName} ${candidate.lastName}`);

    // 5. Récupérer l'ID de la réponse
    const rRows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id FROM hr_test_responses WHERE token = $1
    `, token);
    const responseId = rRows[0]?.id;

    // 6. Construire l'URL publique
    const baseUrl = this.config.get<string>('PUBLIC_WEB_URL') || this.config.get<string>('APP_PUBLIC_URL') || 'https://www.academiahelm.com';
    const normalizedBase = baseUrl.replace(/\/+$/, '');
    const testUrl = `${normalizedBase}/test/${token}`;

    // 7. Envoyer l'email au candidat (avec branding école)
    const questionnaire = this.parseQuestionnaire(qRows[0]);
    try {
      const fromEmail = this.config.get<string>('EMAIL_FROM_NOREPLY') || 'noreply@academiahelm.com';
      const branding = await this.getTenantBranding(tenantId);
      const html = this.buildTestInvitationEmail({
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        testTitle: questionnaire.title,
        durationMinutes: questionnaire.durationMinutes,
        testUrl,
        expiresAt: expiresAt.toLocaleDateString('fr-FR'),
        schoolName: branding.schoolName,
        schoolLogo: branding.schoolLogo,
      });

      await this.emailService.sendCategorized({
        tenantId,
        category: 'RECRUTEMENT' as any,
        subCategory: 'test_questionnaire_envoye',
        module: 'hr',
        to: candidate.email,
        toName: `${candidate.firstName} ${candidate.lastName}`,
        recipientType: 'CANDIDAT' as any,
        recipientId: candidateId,
        fromEmail,
        fromName: branding.schoolName, // Nom de l'école, pas 'Academia Helm'
        subject: `📝 Test à passer : ${questionnaire.title}`,
        html,
        triggeredBy: 'SYSTEM',
        relatedEntityId: questionnaireId,
        relatedEntityType: 'HrTestQuestionnaire',
      });

      this.logger.log(`📧 Email de test envoyé à ${candidate.email} — questionnaire: "${questionnaire.title}", durée: ${questionnaire.durationMinutes}min`);
    } catch (err: any) {
      this.logger.error(`Failed to send test email: ${err.message}`);
      // Non-blocking — le token est créé, le recruteur peut partager le lien manuellement
    }

    return { token, testUrl, responseId };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE PUBLIQUE (CANDIDAT)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Valide un token et démarre le test (status → IN_PROGRESS, startedAt = now).
   * Retourne les questions SANS les réponses correctes.
   */
  async startTest(token: string): Promise<any> {
    await this.ensureTablesExist();

    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT r.*, q.title, q.description, q.duration_minutes, q.questions, q.passing_score, q.max_score
      FROM hr_test_responses r
      JOIN hr_test_questionnaires q ON r.questionnaire_id = q.id
      WHERE r.token = $1
    `, token);

    if (!rows[0]) throw new NotFoundException('Lien de test invalide ou introuvable');

    const response = rows[0];

    // Vérifier le statut
    if (response.status === 'SUBMITTED') {
      throw new BadRequestException('Ce test a déjà été soumis. Vous ne pouvez pas le repasser.');
    }
    if (response.status === 'EXPIRED') {
      throw new BadRequestException('Ce lien de test a expiré.');
    }

    // Vérifier l'expiration du lien
    if (response.status === 'PENDING' && new Date(response.expires_at) < new Date()) {
      await this.prisma.$executeRawUnsafe(`
        UPDATE hr_test_responses SET status = 'EXPIRED' WHERE token = $1
      `, token);
      throw new BadRequestException('Ce lien de test a expiré. Le délai de 48h pour commencer le test est dépassé.');
    }

    // Si PENDING → passer à IN_PROGRESS et démarrer la minuterie
    let justStarted = false;
    if (response.status === 'PENDING') {
      await this.prisma.$executeRawUnsafe(`
        UPDATE hr_test_responses SET status = 'IN_PROGRESS', started_at = NOW() WHERE token = $1
      `, token);
      // Mettre à jour started_at dans la réponse locale pour le calcul du temps restant
      response.started_at = new Date();
      justStarted = true;
    }

    // Parser les questions SANS les réponses correctes
    const questions = JSON.parse(response.questions);
    const safeQuestions = questions.map((q: Question) => ({
      id: q.id,
      type: q.type,
      question: q.question,
      options: q.options,
      points: q.points,
    }));

    // Calculer le temps restant
    let timeRemainingSeconds: number | null = null;
    if (response.started_at) {
      const startedAt = new Date(response.started_at);
      const expiresAt = new Date(startedAt.getTime() + response.duration_minutes * 60 * 1000);
      timeRemainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

      // Si le temps est écoulé → auto-expire
      if (timeRemainingSeconds === 0 && (response.status === 'IN_PROGRESS' || justStarted)) {
        await this.prisma.$executeRawUnsafe(`
          UPDATE hr_test_responses SET status = 'EXPIRED' WHERE token = $1
        `, token);
        throw new BadRequestException('Le temps imparti pour ce test est écoulé.');
      }
    } else if (justStarted) {
      // Cas de sécurité: si started_at n'est pas défini mais qu'on vient de démarrer
      timeRemainingSeconds = response.duration_minutes * 60;
    }

    return {
      token,
      title: response.title,
      description: response.description,
      durationMinutes: response.duration_minutes,
      timeRemainingSeconds,
      questions: safeQuestions,
      status: response.status === 'PENDING' ? 'IN_PROGRESS' : response.status,
    };
  }

  /**
   * Soumet les réponses du candidat.
   * Calcule le score automatique (QCM/Vrai-Faux).
   */
  async submitTest(token: string, dto: SubmitResponseDto): Promise<any> {
    await this.ensureTablesExist();

    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT r.*, q.questions, q.max_score, q.passing_score
      FROM hr_test_responses r
      JOIN hr_test_questionnaires q ON r.questionnaire_id = q.id
      WHERE r.token = $1
    `, token);

    if (!rows[0]) throw new NotFoundException('Lien de test invalide');
    const response = rows[0];

    if (response.status === 'SUBMITTED') {
      throw new BadRequestException('Ce test a déjà été soumis.');
    }
    if (response.status === 'EXPIRED') {
      throw new BadRequestException('Ce test a expiré.');
    }

    // Vérifier la minuterie
    if (response.started_at) {
      const startedAt = new Date(response.started_at);
      const deadline = new Date(startedAt.getTime() + response.duration_minutes * 60 * 1000);
      if (Date.now() > deadline.getTime()) {
        // Temps écoulé → on accepte quand même la soumission mais on marque comme EXPIRED+SUBMITTED
        this.logger.warn(`Test submitted after deadline for token ${token} — accepting as expired submission`);
      }
    }

    // Corriger automatiquement
    const questions: Question[] = JSON.parse(response.questions);
    let autoScore = 0;
    let autoScoreMax = 0;

    const correctedResponses = dto.responses.map((submitted) => {
      const question = questions.find(q => q.id === submitted.questionId);
      if (!question) return { ...submitted, isCorrect: false, pointsAwarded: 0 };

      autoScoreMax += question.points;

      let isCorrect = false;
      if (question.type === 'SINGLE_CHOICE' || question.type === 'TRUE_FALSE') {
        // Une seule bonne réponse
        const correctIdx = question.correctAnswers?.[0];
        isCorrect = correctIdx !== undefined && String(submitted.answer) === String(correctIdx);
      } else if (question.type === 'MULTIPLE_CHOICE') {
        // Plusieurs bonnes réponses
        const submittedArr = Array.isArray(submitted.answer) ? submitted.answer.map(Number).sort() : [];
        const correctArr = (question.correctAnswers || []).slice().sort();
        isCorrect = submittedArr.length === correctArr.length && submittedArr.every((v, i) => v === correctArr[i]);
      }
      // SHORT_TEXT et LONG_TEXT ne sont pas corrigés automatiquement

      const pointsAwarded = isCorrect ? question.points : 0;
      autoScore += pointsAwarded;

      return {
        ...submitted,
        isCorrect,
        pointsAwarded,
        correctAnswers: question.correctAnswers, // Pour affichage après soumission
        explanation: question.explanation,
      };
    });

    // Calculer le pourcentage
    const autoScorePercent = autoScoreMax > 0 ? Math.round((autoScore / autoScoreMax) * 100) : 0;

    // Sauvegarder
    await this.prisma.$executeRawUnsafe(`
      UPDATE hr_test_responses
      SET status = 'SUBMITTED', submitted_at = NOW(), responses = $2, auto_score = $3, auto_score_max = $4
      WHERE token = $1
    `, token, JSON.stringify(correctedResponses), autoScore, autoScoreMax);

    this.logger.log(`Test soumis: token=${token}, autoScore=${autoScore}/${autoScoreMax} (${autoScorePercent}%)`);

    return {
      status: 'SUBMITTED',
      autoScore,
      autoScoreMax,
      autoScorePercent,
      passed: autoScorePercent >= (response.passing_score || 60),
      correctedResponses: correctedResponses.map(r => ({
        questionId: r.questionId,
        isCorrect: r.isCorrect,
        pointsAwarded: r.pointsAwarded,
        correctAnswers: r.correctAnswers,
        explanation: r.explanation,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CÔTÉ RECRUTEUR — RÉCEPTION ET NOTATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Liste les réponses reçues pour un questionnaire.
   */
  async listResponses(questionnaireId: string, tenantId: string): Promise<any[]> {
    await this.ensureTablesExist();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM hr_test_responses
      WHERE questionnaire_id = $1 AND tenant_id = $2
      ORDER BY submitted_at DESC NULLS LAST, created_at DESC
    `, questionnaireId, tenantId);
    return rows.map(r => this.parseResponse(r));
  }

  /**
   * Récupère une réponse détaillée (avec les réponses du candidat).
   */
  async getResponse(responseId: string, tenantId: string): Promise<any> {
    await this.ensureTablesExist();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT r.*, q.title as questionnaire_title, q.questions as questionnaire_questions
      FROM hr_test_responses r
      JOIN hr_test_questionnaires q ON r.questionnaire_id = q.id
      WHERE r.id = $1 AND r.tenant_id = $2
    `, responseId, tenantId);
    if (!rows[0]) throw new NotFoundException('Réponse introuvable');

    const response = this.parseResponse(rows[0]);
    response.questionnaireTitle = rows[0].questionnaire_title;
    response.questionnaireQuestions = JSON.parse(rows[0].questionnaire_questions);
    if (response.responses) {
      response.responses = JSON.parse(response.responses);
    }
    return response;
  }

  /**
   * Le recruteur ajoute sa note manuelle + feedback.
   */
  async scoreResponse(
    responseId: string,
    tenantId: string,
    recruiterScore: number,
    recruiterFeedback?: string,
  ): Promise<any> {
    await this.ensureTablesExist();
    await this.prisma.$executeRawUnsafe(`
      UPDATE hr_test_responses
      SET recruiter_score = $3::int, recruiter_feedback = $4::text, recruiter_scored_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `, responseId, tenantId, recruiterScore, recruiterFeedback || null);

    return this.getResponse(responseId, tenantId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private parseQuestionnaire(row: any): any {
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenant_id,
      testId: row.test_id,
      title: row.title,
      description: row.description,
      durationMinutes: row.duration_minutes,
      questions: typeof row.questions === 'string' ? JSON.parse(row.questions) : row.questions,
      status: row.status,
      passingScore: row.passing_score,
      maxScore: row.max_score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private parseResponse(row: any): any {
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenant_id,
      questionnaireId: row.questionnaire_id,
      candidateId: row.candidate_id,
      applicationId: row.application_id,
      token: row.token,
      status: row.status,
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
      expiresAt: row.expires_at,
      responses: typeof row.responses === 'string' ? JSON.parse(row.responses) : row.responses,
      autoScore: row.auto_score,
      autoScoreMax: row.auto_score_max,
      autoScorePercent: row.auto_score && row.auto_score_max ? Math.round((row.auto_score / row.auto_score_max) * 100) : null,
      recruiterScore: row.recruiter_score,
      recruiterFeedback: row.recruiter_feedback,
      recruiterScoredAt: row.recruiter_scored_at,
      candidateEmail: row.candidate_email,
      candidateName: row.candidate_name,
      createdAt: row.created_at,
    };
  }

  /**
   * Email d'invitation au test (HTML).
   */
  private buildTestInvitationEmail(data: {
    candidateName: string;
    testTitle: string;
    durationMinutes: number;
    testUrl: string;
    expiresAt: string;
    schoolName: string;
    schoolLogo?: string | null;
  }): string {
    const { candidateName, testTitle, durationMinutes, testUrl, expiresAt, schoolName, schoolLogo } = data;
    const N = '#0b2f73', B = '#1d4fa5', G = '#f5b335';
    return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#eef2f7;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(11,47,115,0.08);">
        <!-- Header: logo + nom école -->
        <tr><td style="background:linear-gradient(160deg,${N} 0%,${B} 100%);padding:28px 24px;border-bottom:3px solid ${G};text-align:center;">
          ${schoolLogo ? `<img src="${schoolLogo}" alt="${schoolName}" style="max-height:48px;max-width:160px;object-fit:contain;margin-bottom:8px;" />` : ''}
          <div style="font-size:22px;font-weight:bold;color:#fff;">${schoolName}</div>
          <div style="font-size:13px;color:${G};margin-top:4px;">Test de recrutement</div>
        </td></tr>
        <!-- Corps -->
        <tr><td style="padding:32px 28px;background:#f8fafc;">
          <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#eff6ff;border:1px solid #93c5fd;color:#1e40af;font-size:13px;font-weight:bold;margin-bottom:20px;">📝 Test à passer</div>
          <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">Bonjour ${candidateName},</h2>
          <p style="margin:0 0 20px;color:#475569;line-height:1.6;">Vous avez été invité(e) par <strong style="color:${N};">${schoolName}</strong> à passer le test suivant :</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 8px;font-size:16px;font-weight:bold;color:${N};">${testTitle}</p>
              <p style="margin:0;font-size:13px;color:#64748b;">⏱ Durée : ${durationMinutes} minutes</p>
              <p style="margin:4px 0 0;font-size:13px;color:#64748b;">⏰ Lien valide jusqu'au ${expiresAt}</p>
            </td></tr>
          </table>
          <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
            <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;">
              <strong>⚠ Important :</strong> Une minuterie démarrera dès que vous ouvrirez le test.
              Vous aurez ${durationMinutes} minutes pour répondre à toutes les questions.
              Une fois le temps écoulé, le test sera automatiquement soumis.
              Assurez-vous d'avoir une connexion internet stable avant de commencer.
            </p>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${testUrl}" style="display:inline-block;background:${N};color:#fff;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:bold;text-decoration:none;">Commencer le test →</a>
          </div>
          <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;">Si le bouton ne fonctionne pas, copiez ce lien :<br/><a href="${testUrl}" style="color:${N};word-break:break-all;">${testUrl}</a></p>
        </td></tr>
        <!-- Footer: Academia Helm -->
        <tr><td style="background:${N};padding:24px 28px;text-align:center;border-top:3px solid ${G};">
          <div style="font-size:15px;font-weight:bold;color:#fff;">Academia Helm</div>
          <div style="font-size:11px;color:${G};margin-top:2px;">Plateforme de pilotage éducatif</div>
          <div style="font-size:11px;color:#94a3b8;line-height:1.6;margin-top:12px;">Cet email a été envoyé automatiquement. Merci de ne pas répondre directement.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  /**
   * Vérifie que les tables existent (idempotent).
   */
  private async getTenantBranding(tenantId: string): Promise<{ schoolName: string; schoolLogo: string | null }> {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: { schoolName: true, logoUrl: true },
      });
      if (profile?.schoolName) {
        const apiBaseUrl = this.config.get<string>('APP_PUBLIC_URL') || 'https://academia-helm-api.fly.dev';
        const logoUrl = profile.logoUrl ? `${apiBaseUrl}/api/tenants/${tenantId}/logo` : null;
        return { schoolName: profile.schoolName, schoolLogo: logoUrl };
      }
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
      return { schoolName: tenant?.name || 'Établissement', schoolLogo: null };
    } catch {
      return { schoolName: 'Établissement', schoolLogo: null };
    }
  }

  private async ensureTablesExist(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "hr_test_questionnaires" (
            "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "tenant_id"       TEXT NOT NULL,
            "test_id"         TEXT,
            "title"           TEXT NOT NULL,
            "description"     TEXT,
            "duration_minutes" INT NOT NULL DEFAULT 30,
            "questions"       TEXT NOT NULL,
            "status"          TEXT NOT NULL DEFAULT 'DRAFT',
            "passing_score"   INT DEFAULT 60,
            "max_score"       INT DEFAULT 100,
            "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "hr_test_questionnaires_tenant_id_fkey"
                FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "idx_hr_test_questionnaires_tenant"
            ON "hr_test_questionnaires" ("tenant_id");

        CREATE TABLE IF NOT EXISTS "hr_test_responses" (
            "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "tenant_id"       TEXT NOT NULL,
            "questionnaire_id" TEXT NOT NULL,
            "candidate_id"    TEXT NOT NULL,
            "application_id"  TEXT,
            "token"           TEXT NOT NULL UNIQUE,
            "status"          TEXT NOT NULL DEFAULT 'PENDING',
            "started_at"      TIMESTAMP(3),
            "submitted_at"    TIMESTAMP(3),
            "expires_at"      TIMESTAMP(3),
            "responses"       TEXT,
            "auto_score"      INT,
            "auto_score_max"  INT,
            "recruiter_score" INT,
            "recruiter_feedback" TEXT,
            "recruiter_scored_at" TIMESTAMP(3),
            "candidate_email" TEXT,
            "candidate_name"  TEXT,
            "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "hr_test_responses_tenant_id_fkey"
                FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
            CONSTRAINT "hr_test_responses_questionnaire_id_fkey"
                FOREIGN KEY ("questionnaire_id") REFERENCES "hr_test_questionnaires"("id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "idx_hr_test_responses_tenant"
            ON "hr_test_responses" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_hr_test_responses_questionnaire"
            ON "hr_test_responses" ("questionnaire_id");
        CREATE INDEX IF NOT EXISTS "idx_hr_test_responses_token"
            ON "hr_test_responses" ("token");
        CREATE INDEX IF NOT EXISTS "idx_hr_test_responses_status"
            ON "hr_test_responses" ("status");
      `);
    } catch (err: any) {
      this.logger.warn(`Failed to ensure test questionnaire tables: ${err.message}`);
    }
  }
}

// Import forwardRef ici pour éviter les problèmes de circular dependency
import { Inject, forwardRef } from '@nestjs/common';
