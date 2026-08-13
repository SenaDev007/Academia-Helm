/**
 * ============================================================================
 * CONTRACT CONTROLLER — Endpoints pour génération et signature de contrat
 * ============================================================================
 *
 * POST /api/onboarding/contract/generate
 *   Génère le PDF du contrat avec les infos du promoteur
 *   Body: ContractData (school info, plan, signatures)
 *   Response: { fileUrl, fileName }
 *
 * POST /api/onboarding/contract/sign
 *   Enregistre les signatures, finalise le contrat, crée le tenant
 *   Body: { draftId, promoterSignature, providerSignature, contractData }
 *   Response: { success, contractUrl, tenantId }
 *
 * GET /api/onboarding/contract/:fileName
 *   Télécharge le contrat PDF généré
 * ============================================================================
 */

import {
  Controller, Get, Post, Body, Param, Res, Logger,
} from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { Public } from '../auth/decorators/public.decorator';
import { ContractGenerationService, ContractData } from './contract-generation.service';
import { OnboardingService } from './services/onboarding.service';
import { EmailService } from '../communication/services/email.service';

/**
 * ⭐ Les endpoints contrat sont PUBLICS : ils sont appelés pendant le flux
 *    d'onboarding (signup) — l'utilisateur n'est PAS encore authentifié.
 *    On ne peut donc pas exiger un JWT ici. La sécurité est assurée par :
 *    - Le draftId (token opaque généré par OnboardingService)
 *    - Le throttler global (rate-limiting)
 *    - La validation des entrées (ContractData)
 */
@Controller('onboarding/contract')
@Public()
export class ContractController {
  private readonly logger = new Logger(ContractController.name);

  constructor(
    private readonly contractService: ContractGenerationService,
    private readonly onboardingService: OnboardingService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Génère le contrat PDF (HTML print-friendly) avec les données dynamiques.
   */
  @Post('generate')
  async generateContract(@Body() data: ContractData) {
    this.logger.log(`Contract generation request: school=${data.schoolName}, plan=${data.planName}`);
    const result = await this.contractService.generateContractPdf(data);
    return { success: true, fileUrl: result.fileUrl, fileName: result.fileName };
  }

  /**
   * Enregistre les signatures et finalise le contrat.
   *
   * Flux "Signer et créer l'école" (signLater=false) :
   *   1. Génère le contrat PDF avec les signatures intégrées
   *   2. Crée le tenant (école) en arrière-plan via OnboardingService
   *   3. Envoie un email au promoteur avec :
   *      - Le contrat PDF signé en pièce jointe
   *      - Les credentials de connexion (email + URL de login)
   *      - Le mot de passe n'est PAS inclus (l'utilisateur l'a choisi à l'étape 2)
   *
   * Flux "Envoyer pour signature différée" (signLater=true) :
   *   1. Envoie un email au promoteur avec un lien pour signer plus tard
   *   2. Le tenant n'est PAS créé (sera créé après signature finale)
   */
  @Post('sign')
  async signContract(
    @Body() body: {
      draftId: string;
      promoterSignature: string;
      providerSignature?: string;
      signLater?: boolean;
      contractData?: ContractData;
    },
  ) {
    this.logger.log(`Contract sign request: draft=${body.draftId}, signLater=${body.signLater}`);

    if (body.signLater) {
      // ⭐ Signature différée : envoyer un email au promoteur avec le lien de signature
      try {
        await this.sendDeferredSignatureEmail(body.draftId);
        return {
          success: true,
          message: 'Le lien de signature a été envoyé par email au promoteur.',
          signLater: true,
        };
      } catch (err: any) {
        this.logger.error(`Failed to send deferred signature email: ${err.message}`, err.stack);
        throw err;
      }
    }

    // ⭐ Signature immédiate : les deux parties signent en présence
    if (!body.promoterSignature) {
      return {
        success: false,
        message: 'La signature du promoteur est requise.',
      };
    }

    // 1. Récupérer les données du draft pour avoir les infos complètes
    const draft = await this.onboardingService.getDraft(body.draftId);
    if (!draft) {
      return { success: false, message: 'Draft introuvable.' };
    }

    // 2. Construire les données du contrat si non fournies
    const contractData: ContractData = body.contractData || this.buildContractDataFromDraft(draft, body);

    // 3. Générer le contrat PDF avec les signatures intégrées
    const contractResult = await this.contractService.generateContractPdf({
      ...contractData,
      promoterSignatureDataUrl: body.promoterSignature,
      providerSignatureDataUrl: body.providerSignature,
      promoterSignedAt: new Date().toISOString(),
      providerSignedAt: body.providerSignature ? new Date().toISOString() : undefined,
    });

    this.logger.log(`✅ Contract PDF generated: ${contractResult.fileName}`);

    // 4. Créer le tenant (école) en arrière-plan
    let tenantInfo: { tenantId: string; subdomain: string } | null = null;
    try {
      tenantInfo = await this.onboardingService.activateTenantAfterContractSign(body.draftId);
      this.logger.log(`✅ Tenant created: ${tenantInfo.tenantId} (subdomain: ${tenantInfo.subdomain})`);
    } catch (err: any) {
      // Si le tenant existe déjà (idempotence), on continue
      this.logger.warn(`⚠️  Tenant activation failed (may already exist): ${err.message}`);
    }

    // 5. Envoyer l'email avec le contrat PDF signé + credentials
    try {
      await this.sendSignedContractEmail(
        body.draftId,
        contractResult.filePath,
        contractResult.fileName,
        tenantInfo?.subdomain,
      );
      this.logger.log(`✅ Signed contract email sent to promoter`);
    } catch (err: any) {
      this.logger.error(`⚠️  Failed to send signed contract email: ${err.message}`, err.stack);
      // Non-bloquant : le contrat est signé et le tenant créé
    }

    return {
      success: true,
      message: 'Contrat signé avec succès. Le PDF signé a été envoyé par email avec vos identifiants de connexion.',
      signLater: false,
      promoterSigned: !!body.promoterSignature,
      providerSigned: !!body.providerSignature,
      contractUrl: contractResult.fileUrl,
      tenantId: tenantInfo?.tenantId,
      subdomain: tenantInfo?.subdomain,
    };
  }

  /**
   * Télécharge un contrat PDF généré.
   */
  @Get(':fileName')
  async downloadContract(
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    const safeFileName = path.basename(fileName);
    const filePath = path.join(process.cwd(), 'uploads', 'contracts', safeFileName);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Construit l'objet ContractData à partir du draft (si non fourni par le frontend).
   */
  private buildContractDataFromDraft(draft: any, body: any): ContractData {
    const today = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    const priceSnap = (draft.priceSnapshot as any) || {};
    const subdomain = draft.preferredSubdomain
      || draft.schoolName?.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20)
      || 'ecole';

    return {
      schoolName: draft.schoolName || '',
      promoterName: `${draft.promoterFirstName || ''} ${draft.promoterLastName || ''}`.trim() || draft.email || '',
      directorName: `${draft.promoterFirstName || ''} ${draft.promoterLastName || ''}`.trim(),
      schoolAddress: draft.city || '',
      schoolCity: draft.city || '',
      schoolPhone: draft.promoterPhone || '',
      schoolEmail: draft.promoterEmail || draft.email || '',
      studentCount: draft.estimatedStudentCount || 0,
      planCode: priceSnap.planCode || 'SEED',
      planName: priceSnap.planName || 'Helm Essentiel',
      bilingual: draft.bilingual || false,
      subdomain,
      effectiveDate: today,
      activationFee: priceSnap.initialFee || 300000,
      annualFee: priceSnap.yearlyPrice || 50000,
      totalYearOne: (priceSnap.initialFee || 300000) + (priceSnap.yearlyPrice || 50000) + (draft.bilingual ? 50000 : 0),
    };
  }

  /**
   * Envoie l'email avec le contrat PDF signé + credentials au promoteur.
   */
  private async sendSignedContractEmail(
    draftId: string,
    contractFilePath: string,
    contractFileName: string,
    subdomain?: string,
  ): Promise<void> {
    const draft = await this.onboardingService.getDraft(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    const to = (draft.promoterEmail || draft.email || '').trim();
    if (!to) {
      this.logger.warn('No promoter email — skipping contract email');
      return;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://academiahelm.com';
    const loginUrl = subdomain
      ? `${frontendUrl.replace('https://', `https://${subdomain}.`)}`
      : `${frontendUrl}/login`;

    const promoterName = `${draft.promoterFirstName || ''} ${draft.promoterLastName || ''}`.trim() || 'Promoteur';
    const priceSnap = (draft.priceSnapshot as any) || {};
    const planName = priceSnap.planName || 'Helm Essentiel';

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Contrat signé — Academia Helm</title>
</head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">

  <div style="background: linear-gradient(135deg, #0a1d3f 0%, #0b2f73 100%); padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Academia <span style="color: #f5b335;">Helm</span></h1>
    <p style="color: #bfdbfe; margin: 4px 0 0; font-size: 13px;">Contrat d'abonnement signé</p>
  </div>

  <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">

    <p style="font-size: 16px;">Bonjour <strong>${promoterName}</strong>,</p>

    <p style="font-size: 14px; line-height: 1.6;">
      Nous avons le plaisir de vous confirmer que votre contrat d'abonnement à la plateforme
      <strong>Academia Helm</strong> a été signé électroniquement par les deux parties.
      Votre école <strong>${draft.schoolName}</strong> est désormais créée et active sur la plateforme.
    </p>

    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px; margin: 20px 0;">
      <h3 style="color: #0a1d3f; margin: 0 0 8px; font-size: 14px;">📋 Récapitulatif</h3>
      <table style="width: 100%; font-size: 13px; color: #1f2937;">
        <tr><td style="padding: 2px 0; color: #6b7280;">École :</td><td style="padding: 2px 0;"><strong>${draft.schoolName}</strong></td></tr>
        <tr><td style="padding: 2px 0; color: #6b7280;">Plan :</td><td style="padding: 2px 0;"><strong>${planName}</strong></td></tr>
        ${subdomain ? `<tr><td style="padding: 2px 0; color: #6b7280;">Sous-domaine :</td><td style="padding: 2px 0;"><strong>${subdomain}.academiahelm.com</strong></td></tr>` : ''}
      </table>
    </div>

    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 16px; margin: 20px 0;">
      <h3 style="color: #047857; margin: 0 0 8px; font-size: 14px;">🔑 Vos identifiants de connexion</h3>
      <table style="width: 100%; font-size: 13px; color: #1f2937;">
        <tr><td style="padding: 2px 0; color: #6b7280;">Email :</td><td style="padding: 2px 0;"><strong>${to}</strong></td></tr>
        <tr><td style="padding: 2px 0; color: #6b7280;">Mot de passe :</td><td style="padding: 2px 0;"><em>Celui que vous avez choisi à l'étape 2 de l'inscription</em></td></tr>
      </table>
      <p style="margin: 12px 0 0;">
        <a href="${loginUrl}" style="display: inline-block; background: #047857; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 13px;">
          🔐 Se connecter à ma plateforme
        </a>
      </p>
    </div>

    <p style="font-size: 13px; line-height: 1.6; color: #6b7280;">
      📎 Le contrat signé est joint à cet email au format PDF. Conservez-le précieusement,
      il constitue la preuve de votre abonnement et fait foi entre les parties.
    </p>

    <p style="font-size: 13px; line-height: 1.6;">
      Pour toute question, notre équipe support est disponible à
      <a href="mailto:support@academiahelm.com" style="color: #0b2f73;">support@academiahelm.com</a>
      ou via WhatsApp au +229 00 00 00 00.
    </p>

    <p style="font-size: 13px; line-height: 1.6;">
      Bienvenue dans la communauté Academia Helm !<br>
      <strong>L'équipe YEHI OR Tech</strong>
    </p>
  </div>

  <div style="background: #0a1d3f; padding: 16px; border-radius: 0 0 8px 8px; text-align: center;">
    <p style="color: #bfdbfe; font-size: 11px; margin: 0;">
      YEHI OR Tech — Academia Helm · contact@academiahelm.com · www.academiahelm.com<br>
      Parakou, République du Bénin · © 2026
    </p>
  </div>
</body>
</html>`;

    // Lire le fichier contrat pour l'attacher
    let attachment: { filename: string; path: string } | undefined;
    if (fs.existsSync(contractFilePath)) {
      attachment = {
        filename: contractFileName.replace(/\.html$/, '.pdf'),
        path: contractFilePath,
      };
    } else {
      this.logger.warn(`Contract file not found at ${contractFilePath} — email will be sent without attachment`);
    }

    await this.emailService.sendEmail({
      to,
      from: process.env.EMAIL_FROM_NOREPLY || 'noreply@academiahelm.com',
      fromName: 'Academia Helm',
      subject: `✅ Contrat signé — ${draft.schoolName} | Academia Helm`,
      html,
      attachments: attachment ? [attachment] : undefined,
    });
  }

  /**
   * Envoie un email au promoteur avec un lien pour signer le contrat plus tard.
   */
  private async sendDeferredSignatureEmail(draftId: string): Promise<void> {
    const draft = await this.onboardingService.getDraft(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    const to = (draft.promoterEmail || draft.email || '').trim();
    if (!to) {
      this.logger.warn('No promoter email — skipping deferred signature email');
      return;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://academiahelm.com';
    const signUrl = `${frontendUrl}/signup/contract-sign?draftId=${draftId}`;
    const promoterName = `${draft.promoterFirstName || ''} ${draft.promoterLastName || ''}`.trim() || 'Promoteur';

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">

  <div style="background: linear-gradient(135deg, #0a1d3f 0%, #0b2f73 100%); padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Academia <span style="color: #f5b335;">Helm</span></h1>
    <p style="color: #bfdbfe; margin: 4px 0 0; font-size: 13px;">Contrat d'abonnement — signature différée</p>
  </div>

  <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 16px;">Bonjour <strong>${promoterName}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6;">
      Comme convenu avec notre équipe, vous pouvez signer électroniquement votre contrat
      d'abonnement à la plateforme <strong>Academia Helm</strong> pour votre école
      <strong>${draft.schoolName}</strong>.
    </p>
    <p style="font-size: 14px; line-height: 1.6;">
      Cliquez sur le bouton ci-dessous pour accéder au contrat et apposer votre signature :
    </p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${signUrl}" style="display: inline-block; background: #f5b335; color: #0a1d3f; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">
        ✍️ Signer mon contrat
      </a>
    </p>
    <p style="font-size: 12px; color: #6b7280; line-height: 1.6;">
      Ce lien est valable 7 jours. Si vous avez des questions, contactez-nous à
      <a href="mailto:support@academiahelm.com" style="color: #0b2f73;">support@academiahelm.com</a>.
    </p>
    <p style="font-size: 13px;">
      Cordialement,<br>
      <strong>L'équipe YEHI OR Tech</strong>
    </p>
  </div>

  <div style="background: #0a1d3f; padding: 16px; border-radius: 0 0 8px 8px; text-align: center;">
    <p style="color: #bfdbfe; font-size: 11px; margin: 0;">
      YEHI OR Tech — Academia Helm · contact@academiahelm.com · www.academiahelm.com
    </p>
  </div>
</body>
</html>`;

    await this.emailService.sendEmail({
      to,
      from: process.env.EMAIL_FROM_NOREPLY || 'noreply@academiahelm.com',
      fromName: 'Academia Helm',
      subject: `✍️ Signature de votre contrat Academia Helm — ${draft.schoolName}`,
      html,
    });
  }
}
