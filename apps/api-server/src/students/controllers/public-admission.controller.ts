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
   */
  private async verifyTurnstileToken(token: string | undefined, ip?: string): Promise<void> {
    const secret = this.configService.get<string>('TURNSTILE_SECRET_KEY');
    if (!secret) {
      // Pas de secret configuré → validation désactivée (mode dev/test)
      return;
    }
    if (!token) {
      throw new BadRequestException('Vérification de sécurité Turnstile requise');
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
    const convertToFile = (f: any): Express.Multer.File | null => {
      if (!f || !f.fileDataUrl) return null;
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
    };

    const files: any = {};
    if (body.birthCertificate) files.birthCertificate = [convertToFile(body.birthCertificate)].filter(Boolean);
    if (body.idPhoto) files.idPhoto = [convertToFile(body.idPhoto)].filter(Boolean);
    if (body.lastReportCard) files.lastReportCard = [convertToFile(body.lastReportCard)].filter(Boolean);
    if (body.schoolCertificate) files.schoolCertificate = [convertToFile(body.schoolCertificate)].filter(Boolean);
    if (body.parentalAuth) files.parentalAuth = [convertToFile(body.parentalAuth)].filter(Boolean);
    if (body.npi) files.npi = [convertToFile(body.npi)].filter(Boolean);
    if (body.idDocument) files.idDocument = [convertToFile(body.idDocument)].filter(Boolean);
    if (body.other) files.other = [convertToFile(body.other)].filter(Boolean);

    return this.admissionService.applyAdmission(body, files);
  }
}
