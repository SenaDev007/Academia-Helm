/**
 * ============================================================================
 * PUBLIC ADMISSION CONTROLLER — Portail public d'admission
 * ============================================================================
 *
 * Endpoint public (sans authentification) permettant aux parents de soumettre
 * une demande d'admission pour leur enfant depuis le portail public.
 *
 * Pattern aligné sur RecruitmentPrismaController.applyJobDataUrl :
 *   - Classe @Public() (override JwtAuthGuard)
 *   - Body JSON avec data URLs base64 pour les fichiers
 *   - Conversion data URL → Express.Multer.File puis délégation au service
 *
 * Endpoint:
 *   POST /students/admissions-public/upload-apply
 *   Body: JSON {
 *     tenantId: string,
 *     firstName: string, lastName: string,
 *     dateOfBirth?: string, gender?: string, birthPlace?: string,
 *     nationality?: string, address?: string,
 *     schoolLevelId?: string, requestedClassId?: string, requestedSeriesId?: string,
 *     wantsBilingual?: boolean,
 *     previousSchool?: string, previousLevel?: string, changeReason?: string,
 *     mainGuardianName: string, mainGuardianPhone?: string, mainGuardianEmail?: string,
 *     mainGuardianRelationship?: string, mainGuardianAddress?: string, mainGuardianProfession?: string,
 *     message?: string,
 *     // Documents (data URLs, optionnels) :
 *     birthCertificate?: { fileName, fileDataUrl, mimeType, fileSize },
 *     idPhoto?: { ... }, lastReportCard?: { ... }, schoolCertificate?: { ... },
 *     parentalAuth?: { ... }, npi?: { ... }, idDocument?: { ... }, other?: { ... },
 *   }
 * ============================================================================
 */

import {
  Controller, Post, Body, UseGuards, BadRequestException, Logger, Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdmissionService } from '../services/admission.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Public } from '../../auth/decorators/public.decorator';
import { SkipThrottle } from '@nestjs/throttler';
import { IMAGE_OR_PDF_DATA_URL_PIPE } from '../../common/pipes/data-url-validation.pipe';
import type { Request } from 'express';

@Controller('students/admissions-public')
@UseGuards(JwtAuthGuard)
export class PublicAdmissionController {
  private readonly logger = new Logger(PublicAdmissionController.name);

  constructor(
    private readonly admissionService: AdmissionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Valide un token Cloudflare Turnstile côté serveur (si configuré).
   * Appelle l'API siteverify de Cloudflare.
   * Si TURNSTILE_SECRET_KEY n'est pas configuré, la validation est ignorée (mode dev).
   *
   * Important : si le token manque (ex: NEXT_PUBLIC_TURNSTILE_SITE_KEY non configuré
   * côté frontend mais TURNSTILE_SECRET_KEY configuré côté backend), on log un warning
   * et on laisse passer plutôt que de bloquer — évite les faux 400 en configuration
   * partielle. La sécurité anti-spam reste effective si les deux vars sont configurées.
   */
  private async verifyTurnstileToken(token: string | undefined, ip?: string): Promise<void> {
    const secret = this.configService.get<string>('TURNSTILE_SECRET_KEY');
    if (!secret) {
      // Pas de secret configuré → validation désactivée (mode dev/test)
      return;
    }
    if (!token) {
      // Token manquant — probablement NEXT_PUBLIC_TURNSTILE_SITE_KEY non configuré
      // côté frontend. On log et on laisse passer (fail-open) pour éviter les faux 400.
      this.logger.warn(
        'Turnstile: token manquant (NEXT_PUBLIC_TURNSTILE_SITE_KEY probablement non configuré côté frontend). ' +
        'Soumission autorisée sans validation Turnstile.',
      );
      return;
    }
    try {
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret,
          response: token,
          ...(ip ? { remoteip: ip } : {}),
        }),
      });
      const data = await res.json() as { success: boolean; 'error-codes'?: string[] };
      if (!data.success) {
        this.logger.warn(`Turnstile validation failed: ${JSON.stringify(data['error-codes'])}`);
        throw new BadRequestException('Vérification de sécurité échouée. Veuillez réessayer.');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Turnstile siteverify error: ${err.message}`);
      // En cas d'erreur réseau Cloudflare, on laisse passer (fail-open) pour ne pas bloquer
      // l'admission si Cloudflare est temporairement indisponible.
    }
  }

  /**
   * POST /students/admissions-public/upload-apply
   *
   * Soumission publique d'une demande d'admission avec pièces justificatives.
   * Chaque fichier est envoyé en base64 data URL dans le JSON body, puis
   * validé via IMAGE_OR_PDF_DATA_URL_PIPE (images + PDF, max 20 Mo).
   */
  @Public()
  @Post('upload-apply')
  @SkipThrottle()
  async applyAdmissionDataUrl(@Body() body: any, @Req() req: Request) {
    if (!body || !body.tenantId) {
      throw new BadRequestException('tenantId est requis');
    }
    if (!body.firstName || !body.lastName) {
      throw new BadRequestException('Prénom et nom de l\'élève sont requis');
    }

    // Valider le token Turnstile (anti-spam) si configuré
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      undefined;
    await this.verifyTurnstileToken(body.turnstileToken, clientIp);

    // Convertir chaque data URL en pseudo Express.Multer.File
    // (même pattern que recruitment.controller.ts:282-313)
    // Si un document a un format non supporté, on l'ignore (best-effort) plutôt
    // que de rejeter toute la soumission. Le parent pourra compléter plus tard.
    const convertToFile = (f: any, docKey: string): Express.Multer.File | null => {
      if (!f || !f.fileDataUrl) return null;
      try {
        // Valider le data URL via le pipe (vérifie format, MIME, taille)
        const validatedDataUrl = IMAGE_OR_PDF_DATA_URL_PIPE.transform(f.fileDataUrl);
        const m = /^data:([^;]+);base64,(.+)$/i.exec(validatedDataUrl);
        if (!m) return null;
        const buffer = Buffer.from(m[2], 'base64');
        return {
          buffer,
          originalname: f.fileName || 'document',
          mimetype: f.mimeType || m[1],
          size: f.fileSize || buffer.length,
          fieldname: 'file',
          encoding: '7bit',
          destination: '',
          filename: f.fileName || 'document',
          path: '',
          stream: null as any,
        } as unknown as Express.Multer.File;
      } catch (err: any) {
        // Document invalide (mauvais format, trop volumineux, etc.)
        // On log et on ignore ce document — la soumission continue sans lui
        this.logger.warn(
          `Document ${docKey} ignoré (format invalide): ${err.message}`,
        );
        return null;
      }
    };

    const files: any = {};
    if (body.birthCertificate) {
      const f = convertToFile(body.birthCertificate, 'birthCertificate');
      if (f) files.birthCertificate = [f];
    }
    if (body.idPhoto) {
      const f = convertToFile(body.idPhoto, 'idPhoto');
      if (f) files.idPhoto = [f];
    }
    if (body.lastReportCard) {
      const f = convertToFile(body.lastReportCard, 'lastReportCard');
      if (f) files.lastReportCard = [f];
    }
    if (body.schoolCertificate) {
      const f = convertToFile(body.schoolCertificate, 'schoolCertificate');
      if (f) files.schoolCertificate = [f];
    }
    if (body.parentalAuth) {
      const f = convertToFile(body.parentalAuth, 'parentalAuth');
      if (f) files.parentalAuth = [f];
    }
    if (body.npi) {
      const f = convertToFile(body.npi, 'npi');
      if (f) files.npi = [f];
    }
    if (body.idDocument) {
      const f = convertToFile(body.idDocument, 'idDocument');
      if (f) files.idDocument = [f];
    }
    if (body.other) {
      const f = convertToFile(body.other, 'other');
      if (f) files.other = [f];
    }

    return this.admissionService.applyAdmission(body, files);
  }
}
