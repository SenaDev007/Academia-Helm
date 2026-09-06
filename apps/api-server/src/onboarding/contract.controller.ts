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
import { BillingReceiptService } from './billing-receipt.service';
import type { EmittedBillingDocument, ReceiptLine, ReceiptInstallment } from './billing-receipt.service';
import { OnboardingService } from './services/onboarding.service';
import type { CashPaymentMarking } from './services/onboarding.service';
import { EmailService } from '../communication/services/email.service';
import { PuppeteerPoolService } from '../common/services/puppeteer-pool.service';
import { PrismaService } from '../database/prisma.service';

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
    private readonly billingReceiptService: BillingReceiptService,
    private readonly emailService: EmailService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly prisma: PrismaService,
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

    // 3bis. ⭐ REÇUS + FACTURE AUTOMATIQUES — générés AVANT le contrat pour
    //       que leurs numéros figurent dans les sections 4.3 (paiement intégral)
    //       et 4.4 (échéancier) du contrat. Chaque encaissement en espèces
    //       (paiement intégral OU acompte à la signature) donne lieu à un reçu
    //       REC-AH-AAAA-NNNNN ; une facture FAC-AH-AAAA-NNNNN couvre la
    //       souscription (échéancier complet en paiement échelonné).
    //       ⚠️ Non-bloquant : un échec de reçu ne doit pas empêcher le contrat.
    let billingDocs: {
      receiptNumbers: string[];
      installmentReceipts: { index: number; receiptNumber: string; paidAt?: string }[];
      documents: EmittedBillingDocument[];
    } = { receiptNumbers: [], installmentReceipts: [], documents: [] };
    try {
      billingDocs = await this.emitBillingDocumentsForSign(body.draftId, contractData, tenantInfo?.tenantId || null);
      // Injecter les numéros de reçus dans le contrat AVANT son rendu
      if (billingDocs.receiptNumbers.length > 0) {
        contractData.receiptNumbers = billingDocs.receiptNumbers;
      }
      if (billingDocs.installmentReceipts.length > 0) {
        contractData.installmentReceipts = billingDocs.installmentReceipts;
      }
    } catch (billingErr: any) {
      this.logger.error(`⚠️  Billing documents emission failed (non-bloquant): ${billingErr.message}`, billingErr.stack);
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
    //    ⭐ Reçus + facture générés (3bis) joints au même email.
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
          billingDocs.documents,
        );
        this.logger.log(`✅ Signed contract email sent to promoter (avec reçus/facture)`);
      } catch (err: any) {
        this.logger.error(`⚠️  Failed to send signed contract email: ${err.message}`, err.stack);
        // Non-bloquant : le contrat est signé et le tenant créé
      }
    } else {
      // ⭐ Contrat PDF en échec MAIS reçus émis → les envoyer quand même :
      //    chaque encaissement doit être attesté au promoteur.
      if (billingDocs.documents.length > 0) {
        try {
          await this.sendBillingDocumentsEmail(body.draftId, billingDocs.documents);
        } catch (err: any) {
          this.logger.error(`⚠️  Failed to send billing documents email: ${err.message}`, err.stack);
        }
      }
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
      // ⭐ Reçus + facture émis automatiquement (numéros) — l'écran de succès
      //    du wizard les affiche et les PDF sont joints à l'email promoteur.
      receiptNumbers: billingDocs.documents
        .filter((d) => d.kind === 'RECEIPT')
        .map((d) => d.documentNumber),
      invoiceNumber: billingDocs.documents.find((d) => d.kind === 'INVOICE')?.documentNumber || null,
      billingDocuments: billingDocs.documents.map((d) => ({
        kind: d.kind,
        documentNumber: d.documentNumber,
        amount: d.amount,
        fileUrl: d.fileUrl,
      })),
    };
  }

  /**
   * ⭐ Émet les REÇUS + FACTURE automatiques pour un encaissement espèces
   *    (appelé à la signature du contrat — immédiate OU différée) :
   *
   *    - Paiement intégral (4.3) marqué payé → 1 reçu FULL_SUBSCRIPTION
   *      couvrant le détail exact (activation au barème, frais annuels,
   *      option bilingue) + 1 facture de la souscription.
   *    - Paiement échelonné (4.4) avec acompte encaissé → 1 reçu
   *      DOWN_PAYMENT pour l'acompte + 1 facture avec l'échéancier complet
   *      (reçus émis + solde restant) — les tranches ultérieures reçoivent
   *    leur reçu via POST /receipts (endpoint dédié aux encaissements).
   *
   *    ⚠️ NON-BLOQUANT et IDEMPOTENT (par draft + type de transaction).
   */
  private async emitBillingDocumentsForSign(
    draftId: string,
    contractData: ContractData,
    tenantId: string | null,
  ): Promise<{
    receiptNumbers: string[];
    installmentReceipts: { index: number; receiptNumber: string; paidAt?: string }[];
    documents: EmittedBillingDocument[];
  }> {
    const draft: any = await this.onboardingService.getDraft(draftId);
    if (!draft) return { receiptNumbers: [], installmentReceipts: [], documents: [] };

    const priceSnap = (draft.priceSnapshot as any) || {};
    const marked: any = (priceSnap.paymentMarked as any) || {};
    const payerName = `${draft.promoterFirstName || ''} ${draft.promoterLastName || ''}`.trim()
      || draft.promoterEmail || draft.email || 'Client';
    const payerEmail = draft.promoterEmail || draft.email || undefined;
    const subdomain = (draft as any).preferredSubdomain
      || String(draft.schoolName || 'ecole').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
    const contractRef = `CT-AH-${new Date().getFullYear()}-${subdomain.toUpperCase().substring(0, 12)}`;

    // ⭐ Agent encaisseur : nom lisible — sinon résolu depuis l'email (user)
    let issuedByName: string | undefined = marked.receivedByName || (contractData as any).receivedByName;
    const issuedByEmail: string | undefined = marked.receivedBy || (contractData as any).receivedBy;
    if (!issuedByName && issuedByEmail && String(issuedByEmail).includes('@')) {
      try {
        const agent = await this.prisma.user.findUnique({
          where: { email: String(issuedByEmail).toLowerCase() },
          select: { firstName: true, lastName: true },
        });
        if (agent && (agent.firstName || agent.lastName)) {
          issuedByName = `${agent.firstName || ''} ${agent.lastName || ''}`.trim();
        }
      } catch { /* résolution best-effort */ }
    }
    // Propager le nom résolu au contrat (4.3 — « Encaissé par »)
    if (issuedByName && !contractData.receivedByName) {
      contractData.receivedByName = issuedByName;
    }

    // Montants — même logique que buildContractDataFromDraft (source : snapshot)
    const schoolsCount = Math.max(1, draft.schoolsCount || 1);
    const activationFee = Number(priceSnap.initialFee ?? priceSnap.initialPayment ?? contractData.activationFee ?? 500000) || 500000;
    const annualFee = Number(priceSnap.yearlyPrice ?? contractData.annualFee ?? 50000) || 50000;
    const bilingualFee = (draft.bilingual || contractData.bilingual)
      ? Number(priceSnap.bilingualFee ?? (contractData as any).bilingualFee ?? 100000) || 100000
      : 0;
    const annexRank = priceSnap.annexRank != null ? Number(priceSnap.annexRank) : contractData.annexRank;
    const annexDiscount = Number(priceSnap.activationDiscountPercent ?? contractData.activationDiscountPercent ?? 0) || 0;
    const bilingual = !!(draft.bilingual ?? contractData.bilingual);
    const isInstallments = marked.paymentPlan === 'installments'
      || (contractData.paymentPlan === 'installments' && !!contractData.installments);
    const installments: any[] = Array.isArray(marked.installments)
      ? marked.installments
      : (contractData.installments || []);

    // ⭐ Détail d'activation : barème multi-écoles OU remise annexe mono-école
    const activationLines: ReceiptLine[] = [];
    if (schoolsCount > 1) {
      const activationTiers = Array.isArray(priceSnap.activationTiers) ? priceSnap.activationTiers : null;
      const activationTotal = Number(priceSnap.activationTotal ?? 0) || 0;
      if (activationTiers && activationTiers.length === schoolsCount) {
        activationTiers.forEach((t: any, i: number) => {
          activationLines.push({
            label: `Frais d'activation — ${i + 1}${i === 0 ? 're' : 'e'} école${t.discountPercent ? ` (barème −${Number(t.discountPercent)} %)` : ''}`,
            amount: Number(t.fee) || 0,
          });
        });
      } else if (activationTotal > 0) {
        activationLines.push({
          label: `Frais d'activation du groupe (${schoolsCount} écoles — barème progressif)`,
          amount: activationTotal,
        });
      } else {
        activationLines.push({ label: 'Frais d\'activation', amount: activationFee * schoolsCount });
      }
    } else {
      activationLines.push({
        label: annexDiscount > 0 && annexRank != null && annexRank >= 2
          ? `Frais d'activation (${annexRank}e école du groupe — barème annexe −${annexDiscount} %)`
          : 'Frais d\'activation',
        amount: activationFee,
      });
    }

    const documents: EmittedBillingDocument[] = [];
    const receiptNumbers: string[] = [];
    const installmentReceipts: { index: number; receiptNumber: string; paidAt?: string }[] = [];

    if (!isInstallments && (marked.subscriptionPaid !== false)) {
      // ── Paiement intégral : 1 reçu couvrant le détail exact ──
      const lines: ReceiptLine[] = [
        ...activationLines,
        { label: `Frais annuels — plan ${priceSnap.planName || contractData.planName || 'souscrit'}${schoolsCount > 1 ? ` × ${schoolsCount} écoles` : ''}`, amount: annualFee * schoolsCount },
      ];
      if (bilingual && marked.bilingualPaid !== false) {
        lines.push({ label: `Option bilingue FR/EN (1re année)${schoolsCount > 1 ? ` × ${schoolsCount} écoles` : ''}`, amount: bilingualFee * schoolsCount });
      }
      const amount = lines.reduce((s, l) => s + l.amount, 0);
      if (amount > 0) {
        const receipt = await this.billingReceiptService.emit(
          {
            kind: 'RECEIPT',
            transactionType: 'FULL_SUBSCRIPTION',
            draftId,
            tenantId: tenantId || undefined,
            payerName,
            payerEmail,
            issuedByName,
            issuedByEmail,
            paymentMethod: 'CASH',
            paidAt: marked.markedAt ? new Date(marked.markedAt) : new Date(),
            lines,
            amount,
            contractRef,
            schoolName: draft.schoolName,
          },
          `full-${draftId}`,
        );
        if (receipt) {
          documents.push(receipt);
          receiptNumbers.push(receipt.documentNumber);
        }
      }
    } else if (isInstallments && installments.length > 0 && marked.downPaymentReceived !== false) {
      // ── Acompte (tranche 1) encaissé à la signature → reçu dédié ──
      const downPayment = Math.max(0, Math.round(Number(installments[0]?.amount) || 0));
      if (downPayment > 0) {
        const receipt = await this.billingReceiptService.emit(
          {
            kind: 'RECEIPT',
            transactionType: 'DOWN_PAYMENT',
            draftId,
            tenantId: tenantId || undefined,
            payerName,
            payerEmail,
            issuedByName,
            issuedByEmail,
            paymentMethod: 'CASH',
            paidAt: marked.markedAt ? new Date(marked.markedAt) : new Date(),
            lines: [
              {
                label: installments[0]?.label || 'Acompte à la signature',
                amount: downPayment,
              },
            ],
            amount: downPayment,
            contractRef,
            schoolName: draft.schoolName,
            note: 'Acompte sur la souscription (Article 4.4 — paiement échelonné).',
            installments: installments.map((t: any, i: number) => ({
              label: String(t.label || (i === 0 ? 'Acompte à la signature' : `Tranche ${i + 1}`)),
              amount: Math.max(0, Math.round(Number(t.amount) || 0)),
              dueDate: t.dueDate,
            })),
          },
          `downpayment-${draftId}`,
        );
        if (receipt) {
          documents.push(receipt);
          installmentReceipts.push({
            index: 0,
            receiptNumber: receipt.documentNumber,
            paidAt: new Date().toISOString(),
          });
          // Persister le n° de reçu de l'acompte dans l'échéancier du draft
          await this.persistInstallmentReceipt(draftId, 0, receipt.documentNumber);
        }
      }
    }

    // ── Facture de souscription (toujours émise) ──
    if (!isInstallments || installments.length > 0) {
      const invoiceLines: ReceiptLine[] = [
        ...activationLines,
        { label: `Frais annuels — plan ${priceSnap.planName || contractData.planName || 'souscrit'}${schoolsCount > 1 ? ` × ${schoolsCount} écoles` : ''}`, amount: annualFee * schoolsCount },
      ];
      if (bilingual) {
        invoiceLines.push({ label: `Option bilingue FR/EN (1re année)${schoolsCount > 1 ? ` × ${schoolsCount} écoles` : ''}`, amount: bilingualFee * schoolsCount });
      }
      const invoiceAmount = invoiceLines.reduce((s, l) => s + l.amount, 0);
      const invoiceInstallments: ReceiptInstallment[] | undefined = isInstallments
        ? installments.map((t: any, i: number) => {
            const already = installmentReceipts.find((r) => r.index === i);
            const persisted = (marked.installments?.[i] as any)?.receiptNumber;
            return {
              label: String(t.label || (i === 0 ? 'Acompte à la signature' : `Tranche ${i + 1}`)),
              amount: Math.max(0, Math.round(Number(t.amount) || 0)),
              dueDate: t.dueDate,
              receiptNumber: already?.receiptNumber || persisted || undefined,
            };
          })
        : undefined;
      if (invoiceAmount > 0) {
        const invoice = await this.billingReceiptService.emit(
          {
            kind: 'INVOICE',
            transactionType: 'FULL_SUBSCRIPTION',
            draftId,
            tenantId: tenantId || undefined,
            payerName,
            payerEmail,
            issuedByName,
            issuedByEmail,
            paymentMethod: 'CASH',
            paidAt: new Date(),
            lines: invoiceLines,
            amount: invoiceAmount,
            contractRef,
            schoolName: draft.schoolName,
            note: isInstallments
              ? 'Paiement échelonné convenu (Article 4.4) — le détail des encaissements figure sur les reçus numérotés.'
              : undefined,
            installments: invoiceInstallments,
          },
          `invoice-${draftId}`,
        );
        if (invoice) documents.push(invoice);
      }
    }

    return { receiptNumbers, installmentReceipts, documents };
  }

  /**
   * ⭐ Encaissement d'une TRANCHE ultérieure (Article 4.4) : émet le reçu
   *    de la tranche, le reporte dans l'échéancier du draft (numéro + date),
   *    et l'email au promoteur. Idempotent par index de tranche.
   *
   *    Body : { draftId, installmentIndex, receivedBy?, receivedByName?, paidAt? }
   */
  @Post('receipts')
  @HttpCode(HttpStatus.OK)
  async emitInstallmentReceipt(
    @Body() body: {
      draftId: string;
      installmentIndex: number;
      receivedBy?: string;
      receivedByName?: string;
      paidAt?: string;
    },
  ) {
    const draft: any = await this.onboardingService.getDraft(body.draftId);
    if (!draft) {
      return { success: false, message: 'Draft introuvable.' };
    }
    const priceSnap = (draft.priceSnapshot as any) || {};
    const marked: any = (priceSnap.paymentMarked as any) || {};
    const installments: any[] = Array.isArray(marked.installments) ? marked.installments : [];
    const idx = Number(body.installmentIndex);
    if (!(idx >= 0) || idx >= installments.length) {
      return { success: false, message: `Tranche ${idx} introuvable dans l'échéancier de ce draft.` };
    }

    // Déjà un reçu pour cette tranche ? → renvoyer le document existant
    const existingNumber = installments[idx]?.receiptNumber;
    if (existingNumber) {
      const existing = await this.billingReceiptService.emit(
        {
          kind: 'RECEIPT',
          transactionType: 'INSTALLMENT',
          draftId: body.draftId,
          payerName: `${draft.promoterFirstName || ''} ${draft.promoterLastName || ''}`.trim() || 'Client',
          lines: [{ label: installments[idx].label, amount: Number(installments[idx].amount) || 0 }],
          amount: Number(installments[idx].amount) || 0,
        },
        `installment-${idx}-${body.draftId}`,
      );
      if (existing) {
        return { success: true, receipt: { number: existingNumber, fileUrl: existing.fileUrl }, alreadyEmitted: true };
      }
    }

    const amount = Math.max(0, Math.round(Number(installments[idx].amount) || 0));
    if (amount <= 0) {
      return { success: false, message: 'Montant de la tranche invalide (0 FCFA).' };
    }

    const subdomain = (draft as any).preferredSubdomain
      || String(draft.schoolName || 'ecole').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
    const receipt = await this.billingReceiptService.emit(
      {
        kind: 'RECEIPT',
        transactionType: 'INSTALLMENT',
        draftId: body.draftId,
        payerName: `${draft.promoterFirstName || ''} ${draft.promoterLastName || ''}`.trim() || 'Client',
        payerEmail: draft.promoterEmail || draft.email || undefined,
        issuedByName: body.receivedByName || marked.receivedByName,
        issuedByEmail: body.receivedBy || marked.receivedBy,
        paymentMethod: 'CASH',
        paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
        lines: [{ label: installments[idx].label || `Tranche ${idx + 1}`, amount }],
        amount,
        contractRef: `CT-AH-${new Date().getFullYear()}-${subdomain.toUpperCase().substring(0, 12)}`,
        schoolName: draft.schoolName,
        note: `Tranche ${idx + 1} de l'échéancier convenu (Article 4.4 du contrat).`,
        installments: installments.map((t: any, i: number) => ({
          label: String(t.label || (i === 0 ? 'Acompte à la signature' : `Tranche ${i + 1}`)),
          amount: Math.max(0, Math.round(Number(t.amount) || 0)),
          dueDate: t.dueDate,
          receiptNumber: i === idx ? undefined : t.receiptNumber,
        })),
      },
      `installment-${idx}-${body.draftId}`,
    );
    if (!receipt) {
      return { success: false, message: 'Impossible d\u2019émettre le reçu (erreur technique — consulter les logs).' };
    }

    // Reporter le numéro + date dans l'échéancier du draft
    await this.persistInstallmentReceipt(body.draftId, idx, receipt.documentNumber, body.paidAt);

    // Email au promoteur avec le reçu en pièce jointe
    try {
      await this.sendBillingDocumentsEmail(body.draftId, [receipt]);
    } catch (err: any) {
      this.logger.warn(`Reçu émis mais email non envoyé : ${err.message}`);
    }

    return {
      success: true,
      receipt: { number: receipt.documentNumber, fileUrl: receipt.fileUrl, amount },
    };
  }

  /** Reporte le n° de reçu + date d'encaissement d'une tranche dans le draft. */
  private async persistInstallmentReceipt(
    draftId: string,
    index: number,
    receiptNumber: string,
    paidAt?: string,
  ): Promise<void> {
    try {
      const draft: any = await this.onboardingService.getDraft(draftId);
      if (!draft) return;
      const marked: any = ((draft.priceSnapshot as any) || {}).paymentMarked || {};
      const installments: any[] = Array.isArray(marked.installments) ? [...marked.installments] : [];
      if (index < 0 || index >= installments.length) return;
      installments[index] = {
        ...installments[index],
        receiptNumber,
        paidAt: paidAt || new Date().toISOString(),
      };
      // markCashPayment fusionne (spread) : l'échéancier enrichi survit aux
      // rechargements du draft (signature différée, reprise, tranches suivantes).
      await this.onboardingService.markCashPayment(draftId, { installments });
      this.logger.log(`🧾 Reçu ${receiptNumber} rattaché à la tranche ${index + 1} du draft ${draftId}`);
    } catch (err: any) {
      this.logger.warn(`persistInstallmentReceipt failed: ${err.message}`);
    }
  }

  /**
   * Envoie les reçus/factures PDF au promoteur (cas : contrat PDF en échec OU
   * encaissement d'une tranche ultérieure — reçu individuel).
   */
  private async sendBillingDocumentsEmail(
    draftId: string,
    documents: EmittedBillingDocument[],
  ): Promise<void> {
    const draft: any = await this.onboardingService.getDraft(draftId);
    if (!draft) return;
    const to = (draft.promoterEmail || draft.email || '').trim();
    if (!to || documents.length === 0) return;

    const promoterName = `${draft.promoterFirstName || ''} ${draft.promoterLastName || ''}`.trim() || 'Promoteur';
    const attachments = documents
      .filter((d) => d.pdf?.buffer?.length)
      .map((d) => ({ filename: d.pdf!.filename, content: d.pdf!.buffer }));

    const docRows = documents
      .map(
        (d) =>
          `<tr><td style="padding:4px 8px;color:#6b7280;">${d.kind === 'RECEIPT' ? '🧾 Reçu' : '📄 Facture'}</td><td style="padding:4px 8px;"><strong>${d.documentNumber}</strong></td><td style="padding:4px 8px;text-align:right;"><strong>${d.amount.toLocaleString('fr-FR')} FCFA</strong></td></tr>`,
      )
      .join('');

    const html = `
<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;">
  <div style="background:linear-gradient(135deg,#0a1d3f 0%,#0b2f73 100%);padding:24px;border-radius:8px 8px 0 0;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Academia <span style="color:#f5b335;">Helm</span></h1>
    <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">Documents financiers — ${documents[0]?.kind === 'INVOICE' ? 'facture de souscription' : 'reçu d\u2019encaissement'}</p>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;">
    <p style="font-size:16px;">Bonjour <strong>${promoterName}</strong>,</p>
    <p style="font-size:14px;line-height:1.6;">Vous trouverez ci-joint${documents.length > 1 ? 's' : ''} le${documents.length > 1 ? 's' : ''} document${documents.length > 1 ? 's' : ''} financier${documents.length > 1 ? 's' : ''} suivant${documents.length > 1 ? 's' : ''} :</p>
    <table style="width:100%;font-size:13px;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;margin:12px 0;">
      <tr style="background:#f9fafb;"><td style="padding:4px 8px;font-weight:600;">Type</td><td style="padding:4px 8px;font-weight:600;">Numéro</td><td style="padding:4px 8px;font-weight:600;text-align:right;">Montant</td></tr>
      ${docRows}
    </table>
    <p style="font-size:13px;color:#6b7280;line-height:1.6;">Conservez ces documents : ils attestent des règlements effectués auprès de YEHI OR Tech au titre de votre abonnement Academia Helm.</p>
    <p style="font-size:13px;">Cordialement,<br/><strong>L'équipe YEHI OR Tech</strong></p>
  </div>
  <div style="background:#0a1d3f;padding:16px;border-radius:0 0 8px 8px;text-align:center;">
    <p style="color:#bfdbfe;font-size:11px;margin:0;">YEHI OR Tech — Academia Helm · support@academiahelm.com · www.academiahelm.com</p>
  </div>
</body></html>`;

    await this.emailService.sendEmail({
      to,
      from: process.env.EMAIL_FROM_NOREPLY || 'noreply@academiahelm.com',
      fromName: 'Academia Helm',
      subject: `🧾 ${documents.length > 1 ? 'Documents financiers' : documents[0]?.kind === 'RECEIPT' ? 'Reçu d\u2019encaissement' : 'Facture'} — ${draft.schoolName} | Academia Helm`,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  }

  /**
   * ⭐ Télécharge un REÇU / FACTURE générés (uploads/billing) — les fichiers
   *    HTML/PDF des documents financiers (REC-AH-…, FAC-AH-…).
   */
  @Get('billing/:fileName')
  async downloadBillingDocument(
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    const safeFileName = path.basename(fileName);
    const filePath = path.join(process.cwd(), 'uploads', 'billing', safeFileName);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
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
    // ⭐ Barème progressif du coût d'activation (annexes — contrat Article 4) :
    //    rang, tarif de base et remise portés par le snapshot (createAnnexDraft
    //    pour l'annexe mono-école, selectPlan pour le multi-écoles du signup).
    const annexRank = priceSnap.annexRank != null ? Number(priceSnap.annexRank) : undefined;
    const activationBaseFee = priceSnap.activationBaseFee != null
      ? Number(priceSnap.activationBaseFee)
      : undefined;
    const activationDiscountPercent = priceSnap.activationDiscountPercent != null
      ? Number(priceSnap.activationDiscountPercent)
      : 0;
    // ⭐ Total Année 1 : l'activation du groupe N'EST PAS activation × N —
    //    chaque rang porte sa remise (2e −15 %, 3e −20 %, 4e −25 %).
    //    Mono-école : initialFee est déjà le tarif remisé de l'annexe.
    const activationTotal = Number(priceSnap.activationTotal ?? 0) || 0;
    const totalYearOne = schoolsCount > 1
      ? (activationTotal > 0
        ? activationTotal + (annualFee + bilingualFee) * schoolsCount
        : perSchoolTotal * schoolsCount)
      : perSchoolTotal;

    return {
      schoolName: draft.schoolName || '',
      promoterName: `${draft.promoterFirstName || ''} ${draft.promoterLastName || ''}`.trim() || draft.email || '',
      directorName: `${draft.promoterFirstName || ''} ${draft.promoterLastName || ''}`.trim(),
      schoolAddress: draft.city || '',
      schoolCity: draft.city || '',
      schoolPhone: draft.promoterPhone || draft.phone || '',
      schoolEmail: draft.promoterEmail || draft.email || '',
      studentCount: (draft as any).estimatedStudentCount || 0,
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
      // ⭐ Barème progressif du coût d'activation (annexes remisées)
      ...(annexRank != null ? { annexRank } : {}),
      ...(activationBaseFee != null ? { activationBaseFee } : {}),
      ...(activationDiscountPercent > 0 ? { activationDiscountPercent } : {}),
      // ⭐ Total = PAR ÉCOLE × nombre d'écoles (le contrat s'adapte) — activation
      //    du groupe au barème progressif (remises par rang, cf. ci-dessus)
      totalYearOne,
      // ⭐ Paiement en espèces (mode YEHI OR Tech)
      paymentMethod: 'cash',
      subscriptionPaid: marked.subscriptionPaid ?? true,
      bilingualPaid: marked.bilingualPaid ?? draft.bilingual ?? false,
      receivedBy: marked.receivedBy || undefined,
      // ⭐ Nom lisible de l'agent encaisseur + dates de règlement réelles
      ...(marked.receivedByName ? { receivedByName: marked.receivedByName } : {}),
      ...(Array.isArray(marked.paymentDates) && marked.paymentDates.length > 0
        ? { paymentDates: marked.paymentDates }
        : {}),
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
    billingDocs: EmittedBillingDocument[] = [],
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
    // ⭐ Barème progressif du coût d'activation : le total encaissé suit le
    //    barème du groupe (2e école −15 %, 3e −20 %, 4e −25 %) et non un
    //    simple × N. Mono-école annexe : initialFee déjà remisé dans le snapshot.
    const emailSchoolsCount = Math.max(1, draft.schoolsCount || 1);
    const emailActivationTotal = Number(priceSnap.activationTotal ?? 0) > 0
      ? Number(priceSnap.activationTotal)
      : emailActivationFee * emailSchoolsCount;
    const emailActivationDiscount = Number(priceSnap.activationDiscountPercent ?? 0) || 0;
    const totalPaid = emailActivationTotal + (emailAnnualFee + emailBilingualFee) * emailSchoolsCount;

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
        ${totalPaid > 0 ? `<tr><td style="padding: 2px 0; color: #6b7280;">Détail :</td><td style="padding: 2px 0;">Activation ${emailActivationTotal.toLocaleString('fr-FR')}${emailSchoolsCount > 1 ? ` (groupe ${emailSchoolsCount} écoles — barème progressif)` : emailActivationDiscount > 0 ? ` (−${emailActivationDiscount} % — barème annexe)` : ''} + Annuel ${(emailAnnualFee * emailSchoolsCount).toLocaleString('fr-FR')}${emailBilingualFee > 0 ? ' + Bilingue ' + (emailBilingualFee * emailSchoolsCount).toLocaleString('fr-FR') : ''} FCFA</td></tr>` : ''}
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
      ${billingDocs.length > 0 ? 'Les documents financiers ci-dessous sont également joints à cet email.' : ''}
    </p>

    ${billingDocs.length > 0 ? `
    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 16px; margin: 20px 0;">
      <h3 style="color: #047857; margin: 0 0 8px; font-size: 14px;">🧾 Documents financiers joints</h3>
      <table style="width: 100%; font-size: 13px; color: #1f2937; border-collapse: collapse;">
        <tr style="background: #dcfce7;"><td style="padding: 3px 6px; color: #6b7280;">Type</td><td style="padding: 3px 6px; color: #6b7280;">Numéro</td><td style="padding: 3px 6px; color: #6b7280; text-align: right;">Montant</td></tr>
        ${billingDocs.map((d) => `
        <tr>
          <td style="padding: 3px 6px;">${d.kind === 'RECEIPT' ? '🧾 Reçu d&rsquo;encaissement' : '📄 Facture de souscription'}</td>
          <td style="padding: 3px 6px;"><strong>${d.documentNumber}</strong></td>
          <td style="padding: 3px 6px; text-align: right;"><strong>${d.amount.toLocaleString('fr-FR')} FCFA</strong></td>
        </tr>`).join('')}
      </table>
    </div>
    ` : ''}

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

    // ⭐ Pièces jointes : contrat (VRAI PDF via Puppeteer ; fallback HTML) +
    //    REÇUS/FACTURE émis automatiquement (PDF A5).
    //    ⚠️ Resend n'accepte PAS `path` — le contenu doit être passé en Buffer
    //    (l'email service l'encode en base64). Sans cela, la pièce jointe était
    //    silencieusement ignorée.
    const attachments: { filename: string; content: Buffer }[] = [];
    if (contractPdf?.buffer?.length) {
      attachments.push({ filename: contractPdf.filename, content: contractPdf.buffer });
      this.logger.log(`📎 Attaching real PDF: ${contractPdf.filename} (${contractPdf.buffer.length} bytes)`);
    } else if (fs.existsSync(contractFilePath)) {
      attachments.push({ filename: contractFileName, content: fs.readFileSync(contractFilePath) });
      this.logger.warn(`Attaching HTML file as fallback: ${contractFileName}`);
    } else {
      this.logger.warn(`Contract file not found at ${contractFilePath} — email will be sent without contract attachment`);
    }
    for (const d of billingDocs) {
      if (d.pdf?.buffer?.length) {
        attachments.push({ filename: d.pdf.filename, content: d.pdf.buffer });
        this.logger.log(`📎 Attaching billing PDF: ${d.pdf.filename} (${d.pdf.buffer.length} bytes)`);
      }
    }

    await this.emailService.sendEmail({
      to,
      from: process.env.EMAIL_FROM_NOREPLY || 'noreply@academiahelm.com',
      fromName: 'Academia Helm',
      subject: signedManually
        ? `✅ Contrat déjà signé manuellement — ${draft.schoolName} | Academia Helm`
        : `✅ Contrat signé — ${draft.schoolName} | Academia Helm`,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
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
