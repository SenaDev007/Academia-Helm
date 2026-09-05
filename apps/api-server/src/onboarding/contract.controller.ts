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
import { ContractGenerationService } from './contract-generation.service';
import type { ContractData, ContractInstallment } from './contract-generation.service';
import { OnboardingService } from './services/onboarding.service';
import type { CashPaymentMarking } from './services/onboarding.service';
import { EmailService } from '../communication/services/email.service';
import { PuppeteerPoolService } from '../common/services/puppeteer-pool.service';

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
    private readonly puppeteerPool: PuppeteerPoolService,
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
   * Flux "Signer et créer l'école" (signLater=false) — mode YEHI OR Tech :
   *   1. Persiste le marquage de paiement en espèces (cases du wizard)
   *   2. ⭐ ACTIVE l'école EN PREMIER (création complète « du fond en comble » :
   *      tenant + souscriptions + école + niveaux + année + promoteur +
   *      UserTenant + sous-domaine Cloudflare/Vercel). Une erreur d'activation
   *      remonte à l'appelant — plus jamais avalée derrière un success:true.
   *   3. Génère le contrat PDF avec les signatures intégrées (NON BLOQUANT :
   *      l'école est déjà créée ; un échec PDF n'annule rien)
   *   4. Envoie un email au promoteur avec :
   *      - Le contrat PDF signé en pièce jointe
   *      - Les credentials de connexion (email + URL de login)
   *      - Le mot de passe n'est PAS inclus (choisi à l'étape 2)
   *
   * ⭐ Flux "Contrat déjà signé manuellement" (signedManually=true) :
   *   Le contrat a été signé sur papier par les deux parties. Aucune signature
   *   numérique n'est recueillie ni exigée — l'école est créée DIRECTEMENT
   *   (même création complète, sous-domaine compris). Le contrat PDF part
   *   quand même par email avec la mention « déjà signé manuellement », et le
   *   promoteur reçoit ses identifiants.
   *
   * Flux "Envoyer pour signature différée" (signLater=true) :
   *   1. Envoie un email au promoteur avec un lien pour signer plus tard
   *      (/signup/contract-sign?draftId=...)
   *   2. Le tenant n'est PAS créé (sera créé après signature finale)
   */
  @Post('sign')
  async signContract(
    @Body() body: {
      draftId: string;
      promoterSignature: string;
      providerSignature?: string;
      signLater?: boolean;
      // ⭐ Contrat déjà signé manuellement (version papier)
      signedManually?: boolean;
      contractData?: ContractData;
      paymentMarked?: CashPaymentMarking & {
        installments?: ContractInstallment[];
      };
    },
  ) {
    this.logger.log(`Contract sign request: draft=${body.draftId}, signLater=${body.signLater}, signedManually=${body.signedManually}`);

    // ⭐ Persister le marquage de paiement en espèces avant tout (signature
    //    immédiate OU différée) — les flags survivent ainsi au rechargement
    //    du draft et alimentent le contrat + l'activation.
    //    Le flag signedManually est persisté pour la traçabilité.
    if (body.paymentMarked && body.draftId) {
      try {
        await this.onboardingService.markCashPayment(body.draftId, {
          ...body.paymentMarked,
          ...(body.signedManually ? { signedManually: true } : {}),
        });
      } catch (err: any) {
        // Non-bloquant : l'activation relira les flags depuis le draft
        this.logger.warn(`⚠️  Failed to persist payment marking: ${err.message}`);
      }
    }

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

    // ⭐ Signature immédiate : les deux parties signent en présence.
    //    SAUF si le contrat a déjà été signé manuellement (version papier) :
    //    aucune signature numérique n'est exigée.
    if (!body.promoterSignature && !body.signedManually) {
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

    // ⭐ Détection du flag « signé manuellement » (body explicite, contractData,
    //    ou marquage persisté) — si actif, on NE prend PAS la signature numérique.
    const signedManually = !!body.signedManually
      || !!contractData.signedManually
      || !!(body.paymentMarked as any)?.signedManually;

    // 3. ⭐ ACTIVER L'ÉCOLE D'ABORD — création complète « du fond en comble » :
    //    tenant, souscriptions, école, niveaux, année académique, promoteur,
    //    UserTenant et SOUS-DOMAINE Cloudflare/Vercel. Contrat signé
    //    NUMÉRIQUEMENT ou DÉJÀ SIGNÉ MANUELLEMENT (papier) : même flux,
    //    même résultat — la case « déjà signé » crée l'école directement,
    //    sans exiger la moindre signature numérique.
    //    ⚠️ AVANT la génération PDF (Puppeteer) : un échec/timeout de PDF ne
    //    doit JAMAIS empêcher la création de l'école (cause du blocage du
    //    03/09 : draft bloqué, données partielles, école recréée à la main).
    //    ⚠️ Une erreur d'activation RÉELLE (ex : sous-domaine déjà pris) est
    //    REMONTÉE à l'appelant au lieu d'être avalée derrière un success:true
    //    mensonger.
    let tenantInfo: {
      tenantId: string | null;
      subdomain: string;
      hostname?: string;
      portalUrl?: string;
      domainStatus?: string;
      domainReports?: unknown[];
    } | null = null;
    try {
      tenantInfo = await this.onboardingService.activateTenantAfterContractSign(body.draftId, {
        subscriptionPaid: body.paymentMarked?.subscriptionPaid,
        bilingualPaid: body.paymentMarked?.bilingualPaid,
        receivedBy: body.paymentMarked?.receivedBy,
        paymentPlan: body.paymentMarked?.paymentPlan,
        installments: body.paymentMarked?.installments,
        downPaymentReceived: body.paymentMarked?.downPaymentReceived,
      });
      this.logger.log(
        `✅ Tenant ensured for draft ${body.draftId}: ${tenantInfo.tenantId} ` +
        `(subdomain: ${tenantInfo.subdomain}, domain: ${tenantInfo.domainStatus || 'n/a'})`,
      );
    } catch (err: any) {
      // ⭐ L'école n'a PAS pu être créée : on NE SIMULE PAS un succès.
      // L'erreur remonte (HTTP 4xx/500 avec le message réel) — l'agent peut
      // corriger (ex : changer le sous-domaine) et relancer : l'activation
      // est idempotente et auto-réparante.
      this.logger.error(
        `❌ Tenant activation FAILED for draft ${body.draftId}: ${err.message}`,
        err.stack,
      );
      throw err;
    }

    // 4. Générer le contrat PDF — NON BLOQUANT : l'école est déjà créée.
    //    Avec signatures intégrées OU avec la mention « déjà signé
    //    manuellement » (aucune signature numérique recueillie).
    const nowIso = new Date().toISOString();
    let contractResult: { filePath: string; fileName: string; fileUrl: string } | null = null;
    let contractPdf: { buffer: Buffer; filename: string } | null = null;
    try {
      contractResult = await this.contractService.generateContractPdf({
        ...contractData,
        ...(signedManually
          ? {
              promoterSignatureDataUrl: undefined,
              providerSignatureDataUrl: undefined,
              signedManually: true,
              promoterSignedAt: nowIso,
              providerSignedAt: nowIso,
            }
          : {
              promoterSignatureDataUrl: body.promoterSignature,
              providerSignatureDataUrl: body.providerSignature,
              promoterSignedAt: nowIso,
              providerSignedAt: body.providerSignature ? nowIso : undefined,
            }),
      });
      this.logger.log(`✅ Contract PDF generated: ${contractResult.fileName}`);

      // 4bis. Convertir le HTML du contrat en VRAI PDF (pièce jointe email).
      //    Le HTML reste servi pour la consultation en ligne (route :fileName) ;
      //    le promoteur reçoit lui un vrai PDF en pièce jointe.
      contractPdf = await this.renderContractPdf(contractResult.filePath, contractResult.fileName);
    } catch (err: any) {
      // ⭐ Non-bloquant : l'école EXISTE déjà et le promoteur a reçu ses
      //    identifiants (email de bienvenue envoyé par l'activation). Relancer
      //    l'étape régénère le contrat — l'activation reste idempotente.
      contractResult = null;
      contractPdf = null;
      this.logger.error(
        `⚠️  Contract PDF generation FAILED (school already created) for draft ${body.draftId}: ${err.message}`,
        err.stack,
      );
    }

    // 5. Envoyer l'email avec le contrat PDF signé + credentials
    //    (mention « déjà signé manuellement » si applicable) — uniquement
    //    si le PDF a pu être généré (l'école, elle, est déjà créée).
    if (contractResult) {
      try {
        await this.sendSignedContractEmail(
          body.draftId,
          contractResult.filePath,
          contractResult.fileName,
          tenantInfo?.subdomain,
          tenantInfo?.hostname,
          tenantInfo?.portalUrl,
          signedManually,
          contractPdf,
        );
        this.logger.log(`✅ Signed contract email sent to promoter`);
      } catch (err: any) {
        this.logger.error(`⚠️  Failed to send signed contract email: ${err.message}`, err.stack);
        // Non-bloquant : le contrat est signé et le tenant créé
      }
    } else {
      this.logger.warn(
        `⚠️  Email contrat non envoyé (PDF non généré) pour le draft ${body.draftId} — ` +
        `l'école est créée et les identifiants ont été envoyés par l'email de bienvenue`,
      );
    }

    return {
      success: true,
      message: signedManually
        ? contractResult
          ? 'Contrat enregistré (déjà signé manuellement). Le PDF avec la mention « déjà signé manuellement » a été envoyé par email avec vos identifiants de connexion.'
          : 'Contrat enregistré (déjà signé manuellement) et école créée. Le PDF du contrat n\'a pas pu être généré — relancez l\'étape pour le recevoir.'
        : contractResult
          ? 'Contrat signé avec succès. Le PDF signé a été envoyé par email avec vos identifiants de connexion.'
          : 'Contrat signé et école créée. Le PDF du contrat n\'a pas pu être généré — relancez l\'étape pour le recevoir.',
      signLater: false,
      signedManually,
      promoterSigned: !!body.promoterSignature || signedManually,
      providerSigned: !!body.providerSignature || signedManually,
      contractUrl: contractResult?.fileUrl ?? null,
      contractGenerated: !!contractResult,
      tenantId: tenantInfo?.tenantId,
      subdomain: tenantInfo?.subdomain,
      hostname: tenantInfo?.hostname,
      portalUrl: tenantInfo?.portalUrl,
      // ⭐ État RÉEL de la création du sous-domaine (created / partial /
      //    failed / not_configured) + rapport par école — l'appelant SAIT
      //    si {subdomain}.academiahelm.com existe réellement.
      domainStatus: tenantInfo?.domainStatus ?? null,
      domainReports: tenantInfo?.domainReports ?? null,
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

  // ─── Helpers ───────────────────────────────────────────────────────────

  /**
   * ⭐ Convertit le HTML du contrat en vrai PDF (via Puppeteer, même pool que
   *    les bulletins/fiches). Retourne :
   *    - { buffer, filename } en cas de succès (PDF A4) ;
   *    - { buffer, filename } du HTML brut en secours (si Chromium indisponible) ;
   *    - null si le fichier contrat est introuvable.
   */
  private async renderContractPdf(
    contractFilePath: string,
    contractFileName: string,
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    if (!fs.existsSync(contractFilePath)) {
      this.logger.warn(`Contract file not found at ${contractFilePath} — no PDF to attach`);
      return null;
    }

    try {
      const html = fs.readFileSync(contractFilePath, 'utf-8');
      const { page } = await this.puppeteerPool.acquirePage();
      try {
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
        // Laisser les images base64 (logos) se charger
        await new Promise((r) => setTimeout(r, 300));
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' },
        });
        return { buffer: Buffer.from(pdf), filename: contractFileName.replace(/\.html$/, '.pdf') };
      } finally {
        await this.puppeteerPool.releasePage(page);
      }
    } catch (err: any) {
      // ⚠️ Fallback : Chromium indisponible → joindre le HTML tel quel
      //    (pièce jointe ouvrable dans un navigateur). On garde l'extension
      //    réelle pour éviter un PDF corrompu.
      this.logger.warn(`⚠️  PDF rendering failed (${err.message}) — HTML file will be attached instead`);
      try {
        return { buffer: fs.readFileSync(contractFilePath), filename: contractFileName };
      } catch {
        return null;
      }
    }
  }

  /**
   * Construit l'objet ContractData à partir du draft (si non fourni par le frontend).
   * ⭐ Inclut le marquage de paiement en espèces persisté dans priceSnapshot.paymentMarked
   *    (utile pour la signature différée — la page /signup/contract-sign ne renvoie
   *    pas de contractData complet).
   */
  private buildContractDataFromDraft(draft: any, body: any): ContractData {
    const today = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    const priceSnap = (draft.priceSnapshot as any) || {};
    const marked = priceSnap.paymentMarked || {};
    const subdomain = draft.preferredSubdomain
      || draft.schoolName?.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20)
      || 'ecole';
    const bilingualFee = draft.bilingual ? Number(priceSnap.bilingualFee ?? 100000) || 0 : 0;
    const activationFee = Number(priceSnap.initialFee || priceSnap.initialPayment || 500000) || 500000;
    const annualFee = Number(priceSnap.yearlyPrice || 50000) || 50000;
    // ⭐ MULTI-ÉCOLES : nombre d'établissements du draft + annexes déclarées
    //    (noms/villes propres — la fiche et le détail tarifaire s'adaptent).
    const schoolsCount = Math.max(1, draft.schoolsCount || 1);
    const annexes = Array.isArray(draft.annexes)
      ? (draft.annexes as { name?: string; city?: string }[])
          .map((a) => ({ name: String(a?.name || '').trim(), city: a?.city ? String(a.city).trim() : undefined }))
          .filter((a) => a.name.length >= 2)
      : [];
    const perSchoolTotal = activationFee + annualFee + bilingualFee;

    return {
      schoolName: draft.schoolName || '',
      promoterName: `${draft.promoterFirstName || ''} ${draft.promoterLastName || ''}`.trim() || draft.email || '',
      directorName: `${draft.promoterFirstName || ''} ${draft.promoterLastName || ''}`.trim(),
      schoolAddress: draft.city || '',
      schoolCity: draft.city || '',
      schoolPhone: draft.promoterPhone || draft.phone || '',
      schoolEmail: draft.promoterEmail || draft.email || '',
      studentCount: draft.estimatedStudentCount || 0,
      planCode: priceSnap.planCode || 'SEED',
      planName: priceSnap.planName || 'Helm Essentiel',
      bilingual: draft.bilingual || false,
      subdomain,
      effectiveDate: today,
      // ⭐ Multi-écoles
      schoolsCount,
      ...(annexes.length > 0 ? { annexes } : {}),
      activationFee,
      annualFee,
      bilingualFee,
      // ⭐ Total = PAR ÉCOLE × nombre d'écoles (le contrat s'adapte)
      totalYearOne: schoolsCount > 1 ? perSchoolTotal * schoolsCount : perSchoolTotal,
      // ⭐ Paiement en espèces (mode YEHI OR Tech)
      paymentMethod: 'cash',
      subscriptionPaid: marked.subscriptionPaid ?? true,
      bilingualPaid: marked.bilingualPaid ?? draft.bilingual ?? false,
      receivedBy: marked.receivedBy || undefined,
      // ⭐ Paiement par tranches : échéancier persisté à l'étape 3 du wizard
      paymentPlan: marked.paymentPlan === 'installments' ? 'installments' : 'full',
      installments: Array.isArray(marked.installments) ? marked.installments : undefined,
      downPaymentReceived: typeof marked.downPaymentReceived === 'boolean' ? marked.downPaymentReceived : undefined,
      ...(body?.paymentMarked || {}),
    };
  }

  /**
   * Envoie l'email avec le contrat PDF signé + credentials au promoteur.
   * ⭐ Inclut le récapitulatif du paiement en espèces (mode YEHI OR Tech).
   * ⭐ Si signedManually : mention « déjà signé manuellement » (version papier)
   *    à la place de la confirmation de signature électronique.
   */
  private async sendSignedContractEmail(
    draftId: string,
    contractFilePath: string,
    contractFileName: string,
    subdomain?: string,
    hostname?: string,
    portalUrl?: string,
    signedManually?: boolean,
    contractPdf?: { buffer: Buffer; filename: string } | null,
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
    const loginUrl = portalUrl
      || (hostname ? `https://${hostname}/login?portal=SCHOOL&tenant=${subdomain}` : undefined)
      || (subdomain
        ? `${frontendUrl.replace('https://', `https://${subdomain}.`)}/login?portal=SCHOOL&tenant=${subdomain}`
        : `${frontendUrl}/login`);

    const promoterName = `${draft.promoterFirstName || ''} ${draft.promoterLastName || ''}`.trim() || 'Promoteur';
    const priceSnap = (draft.priceSnapshot as any) || {};
    const planName = priceSnap.planName || 'Helm Essentiel';
    const marked = priceSnap.paymentMarked || {};
    // Breakdown depuis le priceSnapshot (source de vérité du pricing)
    const emailActivationFee = Number(priceSnap.initialPayment ?? priceSnap.initialFee ?? 500000) || 0;
    const emailAnnualFee = Number(priceSnap.yearlyPrice ?? 0) || 0;
    const emailBilingualFee = draft.bilingual ? Number(priceSnap.bilingualFee ?? 100000) || 0 : 0;
    const totalPaid = emailActivationFee + emailAnnualFee + emailBilingualFee;

    // ⭐ Échéancier par tranches (si paymentPlan='installments' persisté à
    //    l'étape 3) — remplace le bloc « payé en espèces » par le détail
    //    de l'échéancier + le solde restant après l'acompte.
    const installments: ContractInstallment[] = Array.isArray(marked.installments) ? marked.installments : [];
    const isInstallments = marked.paymentPlan === 'installments' && installments.length > 0;
    const fmtDate = (iso?: string) => {
      if (!iso) return '—';
      const d = new Date(iso);
      return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    const scheduleTotal = isInstallments ? installments.reduce((s, i) => s + (Number(i.amount) || 0), 0) : 0;
    const downPaymentAmount = isInstallments ? Number(installments[0]?.amount) || 0 : 0;
    const downPaymentReceived = marked.downPaymentReceived !== false;
    const remaining = isInstallments ? Math.max(0, scheduleTotal - (downPaymentReceived ? downPaymentAmount : 0)) : 0;

    const paymentBlockHtml = isInstallments
      ? `
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <h3 style="color: #047857; margin: 0 0 8px; font-size: 14px;">💵 Paiement en espèces — par tranches</h3>
        <table style="width: 100%; font-size: 13px; color: #1f2937; border-collapse: collapse;">
          <tr style="background: #dcfce7;"><td style="padding: 3px 6px; color: #6b7280;">N°</td><td style="padding: 3px 6px; color: #6b7280;">Libellé</td><td style="padding: 3px 6px; color: #6b7280;">Échéance</td><td style="padding: 3px 6px; color: #6b7280; text-align: right;">Montant</td></tr>
          ${installments.map((inst, i) => `
          <tr${i === 0 ? ' style="background: #f0fdf4;"' : ''}>
            <td style="padding: 3px 6px;">${i + 1}</td>
            <td style="padding: 3px 6px;">${inst.label || (i === 0 ? 'Acompte' : 'Tranche ' + (i + 1))}</td>
            <td style="padding: 3px 6px;">${i === 0 && !inst.dueDate ? 'À la signature' : fmtDate(inst.dueDate)}</td>
            <td style="padding: 3px 6px; text-align: right;">${(Number(inst.amount) || 0).toLocaleString('fr-FR')} FCFA</td>
          </tr>`).join('')}
          <tr style="border-top: 1px solid #86efac;"><td style="padding: 3px 6px; font-weight: bold;" colspan="3">Total Année 1</td><td style="padding: 3px 6px; text-align: right; font-weight: bold;">${scheduleTotal.toLocaleString('fr-FR')} FCFA</td></tr>
        </table>
        <table style="width: 100%; font-size: 13px; margin-top: 8px;">
          <tr><td style="padding: 2px 0; color: #6b7280;">Acompte (tranche 1) :</td><td style="padding: 2px 0;"><strong>${downPaymentReceived ? 'Encaissé à la signature' : 'À encaisser'}</strong> — ${downPaymentAmount.toLocaleString('fr-FR')} FCFA</td></tr>
          <tr><td style="padding: 2px 0; color: #6b7280;">Solde restant :</td><td style="padding: 2px 0;"><strong>${remaining.toLocaleString('fr-FR')} FCFA</strong> selon l'échéancier ci-dessus</td></tr>
          ${marked.receivedBy ? `<tr><td style="padding: 2px 0; color: #6b7280;">Encaissé et suivi par :</td><td style="padding: 2px 0;">${marked.receivedBy} (YEHI OR Tech)</td></tr>` : ''}
        </table>
      </div>`
      : `
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 16px; margin: 20px 0;">
      <h3 style="color: #047857; margin: 0 0 8px; font-size: 14px;">💵 Paiement en espèces</h3>
      <table style="width: 100%; font-size: 13px; color: #1f2937;">
        <tr><td style="padding: 2px 0; color: #6b7280;">Souscription :</td><td style="padding: 2px 0;"><strong>${marked.subscriptionPaid !== false ? 'Payée (espèces)' : 'À régler'}</strong></td></tr>
        ${draft.bilingual ? `<tr><td style="padding: 2px 0; color: #6b7280;">Option bilingue FR/EN :</td><td style="padding: 2px 0;"><strong>${marked.bilingualPaid !== false ? 'Payée — facturation annuelle' : 'À régler (annuelle)'}</strong></td></tr>` : ''}
        ${totalPaid > 0 ? `<tr><td style="padding: 2px 0; color: #6b7280;">Détail :</td><td style="padding: 2px 0;">Activation ${emailActivationFee.toLocaleString('fr-FR')} + Annuel ${emailAnnualFee.toLocaleString('fr-FR')}${emailBilingualFee > 0 ? ' + Bilingue ' + emailBilingualFee.toLocaleString('fr-FR') : ''} FCFA</td></tr>` : ''}
        ${totalPaid > 0 ? `<tr><td style="padding: 2px 0; color: #6b7280;">Total encaissé :</td><td style="padding: 2px 0;"><strong>${totalPaid.toLocaleString('fr-FR')} FCFA</strong></td></tr>` : ''}
        ${marked.receivedBy ? `<tr><td style="padding: 2px 0; color: #6b7280;">Encaissé par :</td><td style="padding: 2px 0;">${marked.receivedBy} (YEHI OR Tech)</td></tr>` : ''}
      </table>
    </div>`;

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${signedManually ? 'Contrat (déjà signé manuellement)' : 'Contrat signé'} — Academia Helm</title>
</head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">

  <div style="background: linear-gradient(135deg, #0a1d3f 0%, #0b2f73 100%); padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Academia <span style="color: #f5b335;">Helm</span></h1>
    <p style="color: #bfdbfe; margin: 4px 0 0; font-size: 13px;">${signedManually ? 'Contrat d\'abonnement — déjà signé manuellement' : 'Contrat d\'abonnement signé'}</p>
  </div>

  <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">

    <p style="font-size: 16px;">Bonjour <strong>${promoterName}</strong>,</p>

    ${signedManually ? `
    <p style="font-size: 14px; line-height: 1.6;">
      Nous confirmons que votre contrat d'abonnement à la plateforme
      <strong>Academia Helm</strong> a été <strong>déjà signé manuellement</strong> par les deux parties
      (signatures apposées sur la version papier). La version numérique du contrat est jointe à cet
      email avec la mention « déjà signé manuellement », à titre de copie conforme pour archivage.
    </p>
    <div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px 16px; margin: 16px 0; text-align: center;">
      <p style="margin: 0; font-size: 13px; color: #92400e;">
        ✒️ <strong>Contrat déjà signé manuellement</strong> — aucune signature numérique n'a été recueillie.
      </p>
    </div>
    ` : `
    <p style="font-size: 14px; line-height: 1.6;">
      Nous avons le plaisir de vous confirmer que votre contrat d'abonnement à la plateforme
      <strong>Academia Helm</strong> a été signé électroniquement par les deux parties.
    </p>
    `}
    <p style="font-size: 14px; line-height: 1.6;">
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

    ${paymentBlockHtml}

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
      📎 ${signedManually ? 'Le contrat (mention « déjà signé manuellement ») est joint à cet email au format PDF' : 'Le contrat signé est joint à cet email au format PDF'}. Conservez-le précieusement,
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
      YEHI OR Tech — Academia Helm · support@academiahelm.com · www.academiahelm.com<br>
      Parakou, République du Bénin · © 2026
    </p>
  </div>
</body>
</html>`;

    // ⭐ Pièce jointe : VRAI PDF (rendu via Puppeteer) ; fallback : fichier HTML
    //    ⚠️ Resend n'accepte PAS `path` — le contenu doit être passé en Buffer
    //    (l'email service l'encode en base64). Sans cela, la pièce jointe était
    //    silencieusement ignorée.
    let attachment: { filename: string; content: Buffer } | undefined;
    if (contractPdf?.buffer?.length) {
      attachment = { filename: contractPdf.filename, content: contractPdf.buffer };
      this.logger.log(`📎 Attaching real PDF: ${attachment.filename} (${attachment.content.length} bytes)`);
    } else if (fs.existsSync(contractFilePath)) {
      attachment = {
        filename: contractFileName,
        content: fs.readFileSync(contractFilePath),
      };
      this.logger.warn(`Attaching HTML file as fallback: ${contractFileName}`);
    } else {
      this.logger.warn(`Contract file not found at ${contractFilePath} — email will be sent without attachment`);
    }

    await this.emailService.sendEmail({
      to,
      from: process.env.EMAIL_FROM_NOREPLY || 'noreply@academiahelm.com',
      fromName: 'Academia Helm',
      subject: signedManually
        ? `✅ Contrat déjà signé manuellement — ${draft.schoolName} | Academia Helm`
        : `✅ Contrat signé — ${draft.schoolName} | Academia Helm`,
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
      YEHI OR Tech — Academia Helm · support@academiahelm.com · www.academiahelm.com
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
