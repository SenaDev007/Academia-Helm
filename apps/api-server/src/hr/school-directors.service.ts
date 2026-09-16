/**
 * ============================================================================
 * SCHOOL DIRECTORS SERVICE
 * ============================================================================
 *
 * Gestion des directeurs par niveau scolaire + piste linguistique.
 * Le promoteur définit qui sont les directeurs pour :
 *   - Maternelle (FR / EN si bilingue)
 *   - Primaire (FR / EN si bilingue)
 *   - Secondaire (FR / EN si bilingue)
 *
 * ⭐ REFACTOR V2 :
 *   - Le directeur est sélectionné parmi le personnel existant (Staff).
 *   - Si `staffId` est fourni, on résout automatiquement fullName/email/phone
 *     depuis le Staff record.
 *   - À chaque affectation, on envoie automatiquement un mail d'identifiants
 *     au directeur (s'il n'a pas déjà un User, on lui crée un compte + mdp
 *     temporaire + lien portail école).
 *   - Le mail contient le lien du portail école (login) et le lien du site
 *     institutionnel.
 * ============================================================================
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StaffCredentialService } from './services/staff-credential.service';
import * as crypto from 'crypto';

@Injectable()
export class SchoolDirectorsService {
  private readonly logger = new Logger(SchoolDirectorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly staffCredentialService: StaffCredentialService,
  ) {}

  async getDirectors(tenantId: string) {
    // ⭐ Jointure avec staff pour récupérer les infos à jour (si staffId défini)
    //    staffUserId (→ staff."userId") : permet à la route BFF
    //    /api/school-directors de matcher la fiche du directeur CONNECTÉ
    //    (chargement de sa signature dans la Validation Direction pédagogique).
    return this.prisma.$queryRawUnsafe<any[]>(`
      SELECT sd.*, sl.code AS "schoolLevelCode", sl.name AS "schoolLevelName",
             s."firstName" AS "staffFirstName",
             s."lastName" AS "staffLastName",
             s."email" AS "staffEmail",
             s."phone" AS "staffPhone",
             s."position" AS "staffPosition",
             s."userId" AS "staffUserId"
      FROM school_directors sd
      LEFT JOIN school_levels sl ON sl.id = sd."schoolLevelId"
      LEFT JOIN staff s ON s.id = sd."staffId"
      WHERE sd."tenantId" = $1 AND sd."isActive" = true
      ORDER BY sl.code, sd.language
    `, tenantId).catch(() => []);
  }

  async upsertDirector(tenantId: string, data: {
    schoolLevelId: string;
    language?: string;
    fullName: string;
    functionLabel?: string;
    email?: string;
    phone?: string;
    signatureDataUrl?: string;
    signatureUploadedUrl?: string;
    staffId?: string;
    createdById?: string;
    /** Si true, envoie automatiquement l'email d'identifiants au directeur */
    sendCredentialsEmail?: boolean;
  }) {
    const id = crypto.randomUUID();
    const language = data.language || 'FR';

    // ⭐ Si staffId est fourni, résoudre les infos depuis le Staff
    //    (le staff est la source de vérité pour email/phone — on garde les
    //    valeurs saisies manuellement comme fallback seulement si pas de staffId)
    let staffId: string | null = data.staffId || null;
    let resolvedFullName = data.fullName;
    let resolvedEmail = data.email || null;
    let resolvedPhone = data.phone || null;
    let resolvedFunction = data.functionLabel || null;

    if (data.staffId) {
      // Charger le staff pour résoudre les infos
      const staffRows = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT id, "firstName", "lastName", email, phone, position
        FROM staff
        WHERE id = $1 AND "tenantId" = $2
        LIMIT 1
      `, data.staffId, tenantId).catch(() => []);

      if (staffRows.length === 0) {
        throw new NotFoundException(`Staff ${data.staffId} introuvable dans ce tenant`);
      }

      const staff = staffRows[0];
      // ⭐ Le Staff est la source de vérité — on écrase les valeurs manuelles
      //    avec les valeurs du Staff (pour cohérence).
      resolvedFullName = `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || resolvedFullName;
      resolvedEmail = staff.email || resolvedEmail;
      resolvedPhone = staff.phone || resolvedPhone;
      // functionLabel : si le Staff a un position (ex: "Directeur pédagogique"),
      // on l'utilise. Sinon on garde la valeur saisie.
      resolvedFunction = staff.position || resolvedFunction;

      this.logger.log(`[SchoolDirectors] Director resolved from staff ${data.staffId}: ${resolvedFullName} <${resolvedEmail}>`);
    }

    // ⭐ FIX: utiliser COALESCE pour ne PAS écraser une signature existante
    //    avec null quand le frontend n'envoie pas de signature.
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO school_directors (id, "tenantId", "schoolLevelId", "language",
        "fullName", "functionLabel", "email", "phone",
        "signatureDataUrl", "signatureUploadedUrl", "staffId",
        "isActive", "createdById", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, $12, NOW(), NOW())
      ON CONFLICT ("tenantId", "schoolLevelId", "language") DO UPDATE SET
        "fullName" = $5,
        "functionLabel" = $6,
        "email" = $7,
        "phone" = $8,
        "signatureDataUrl" = COALESCE($9, school_directors."signatureDataUrl"),
        "signatureUploadedUrl" = COALESCE($10, school_directors."signatureUploadedUrl"),
        "staffId" = $11,
        "updatedAt" = NOW()
    `, id, tenantId, data.schoolLevelId, language,
      resolvedFullName, resolvedFunction, resolvedEmail, resolvedPhone,
      data.signatureDataUrl || null, data.signatureUploadedUrl || null,
      staffId,
      data.createdById || null);

    // ⭐ Retourner l'enregistrement complet (pour que le frontend voie la signature + staffId)
    const result: any = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT sd.*, sl.code AS "schoolLevelCode", sl.name AS "schoolLevelName"
      FROM school_directors sd
      LEFT JOIN school_levels sl ON sl.id = sd."schoolLevelId"
      WHERE sd."tenantId" = $1 AND sd."schoolLevelId" = $2 AND sd."language" = $3 AND sd."isActive" = true
      LIMIT 1
    `, tenantId, data.schoolLevelId, language).catch(() => []);

    const director = result[0] || { success: true, schoolLevelId: data.schoolLevelId, language, fullName: resolvedFullName };

    // ⭐ Auto-send credentials email si demandé et si staffId est défini
    //    (non-bloquant : si l'envoi échoue, le directeur est quand même créé)
    if (data.sendCredentialsEmail !== false && staffId) {
      try {
        await this.sendCredentialsToDirector(tenantId, staffId, data.createdById, {
          schoolLevelName: director.schoolLevelName,
          schoolLevelCode: director.schoolLevelCode,
          language,
        });
      } catch (err) {
        this.logger.warn(`[SchoolDirectors] Credentials email failed (non-blocking): ${err.message}`);
      }
    }

    return director;
  }

  /**
   * ⭐ Envoie les identifiants au directeur sélectionné.
   *    Réutilise le StaffCredentialService existant (même pipeline que la
   *    fiche personnelle staff) :
   *    1. Crée/maj un User avec un mot de passe temporaire
   *    2. Envoie un email avec loginUrl + site institutionnel + identifiants
   *    3. Le directeur peut se connecter et changer son mot de passe.
   */
  async sendCredentialsToDirector(
    tenantId: string,
    staffId: string,
    triggeredByUserId?: string,
    context?: { schoolLevelName?: string; schoolLevelCode?: string; language?: string },
  ): Promise<{ success: boolean; message: string; email?: string; error?: string }> {
    if (!this.staffCredentialService) {
      return { success: false, message: 'StaffCredentialService non disponible', error: 'injection-failed' };
    }

    try {
      const result = await this.staffCredentialService.generateOrRegenerateCredentials(
        staffId,
        tenantId,
        triggeredByUserId,
      );

      this.logger.log(
        `[SchoolDirectors] Credentials sent to director (staffId=${staffId}): ${result.message} — email sent: ${result.emailSent}`,
      );

      return {
        success: result.success,
        message: result.message,
        email: result.email,
        error: result.error,
      };
    } catch (err) {
      this.logger.error(`[SchoolDirectors] Error sending credentials: ${err.message}`);
      return {
        success: false,
        message: err.message || 'Erreur lors de l\'envoi des identifiants',
        error: err.message,
      };
    }
  }

  async deleteDirector(tenantId: string, directorId: string) {
    await this.prisma.$executeRawUnsafe(`
      UPDATE school_directors SET "isActive" = false, "updatedAt" = NOW()
      WHERE id = $1 AND "tenantId" = $2
    `, directorId, tenantId);
    return { success: true };
  }

  async getDirectorByLevel(tenantId: string, schoolLevelId: string, language?: string) {
    const lang = language || 'FR';
    const directors = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM school_directors
      WHERE "tenantId" = $1 AND "schoolLevelId" = $2 AND "language" = $3 AND "isActive" = true
      LIMIT 1
    `, tenantId, schoolLevelId, lang).catch(() => []);
    return directors[0] || null;
  }
}
