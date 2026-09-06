/**
 * SOUS-MODULE 3 — Encaissements (FinanceTransaction) — API
 */
import { Controller, Get, Post, Body, Param, Query, UseGuards, Res, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { FinanceTransactionService } from './finance-transaction.service';
import { ReceiptFinanceService } from './receipt-finance.service';
import { ReceiptNotificationFinanceService } from './receipt-notification-finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTransactionDto } from './dto';

const PARENT_ROLES = ['PARENT', 'PARENT_PRIMARY', 'LEGAL_GUARDIAN', 'FINANCIAL_RESPONSIBLE', 'GUARDIAN'];
// ⭐ FIX : ajouter 'PROMOTEUR' (FR) en plus de 'PROMOTER' (EN) — le RBAC bootstrap
//    crée le rôle système 'PROMOTEUR' (FR), mais l'onboarding crée les users avec
//    'PROMOTER' (EN). Les deux variantes doivent être reconnues comme staff.
// ⭐ FIX 2026-09-06 : élargissement + normalisation des suffixes de niveau —
//    les rôles niveau-spécifiques (SECRETAIRE_COMPTABLE_MAT_PRI, DIRECTEUR_SEC…)
//    sont rattachés à leur rôle de base avant comparaison.
const STAFF_ROLES = [
  'DIRECTOR', 'SUPER_DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'CENSEUR', 'SURVEILLANT_GENERAL',
  'SECRETARY_GENERAL', 'COMPTABLE', 'PROMOTER', 'PROMOTEUR',
  // ⭐ Ajoutés (fermeture du fail-open sans casser les flux légitimes) :
  'DIRECTEUR', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR', 'SCHOOL_ADMIN', 'DIRECTOR_GENERAL',
  'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'SECRETAIRE', 'SECRETAIRE_COMPTABLE',
  'SECRETARY', 'ECONOME', 'INTENDANT', 'CFO', 'FINANCE_MANAGER', 'CASHIER', 'CAISSIER',
  'RECOVERY_MANAGER', 'RESP_SCOLARITE', 'ADMIN_AGENT', 'INTERNAL_AUDITOR', 'SUPER_ADMIN',
  'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN',
];
const ROLE_LEVEL_SUFFIX = /_(MAT|PRI|SEC|MAT_PRI|MATERNELLE|PRIMAIRE|SECONDAIRE)$/;
const isStaffRole = (role: string) =>
  STAFF_ROLES.includes(role) || STAFF_ROLES.includes(role.replace(ROLE_LEVEL_SUFFIX, ''));

// ⭐ Rôles autorisés à encaisser sur la caisse FONDE (caisse promoteur/fondateur).
//    Empêche un caissier (ACCOUNTANT) d'encaisser sur la caisse du promoteur.
const PROMOTER_CAISSE_ALLOWED_ROLES = ['PROMOTER', 'PROMOTEUR', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN'];

@Controller('finance/transactions')
@UseGuards(JwtAuthGuard)
export class FinanceTransactionController {
  private readonly logger = new Logger(FinanceTransactionController.name);

  constructor(
    private readonly service: FinanceTransactionService,
    private readonly receiptFinanceService: ReceiptFinanceService,
    private readonly receiptNotificationService: ReceiptNotificationFinanceService,
  ) {}

  /**
   * Vérifie qu'un utilisateur parent a bien le droit d'accéder à une transaction
   * (la transaction doit concerner un élève lié à ce parent via student_guardians).
   *
   * Rôles staff (DIRECTOR, ADMIN, etc.) → toujours autorisés.
   * Rôles parent → vérif ownership via student_guardians.
   *
   * Lève ForbiddenException si refusé.
   */
  private async assertParentCanAccessTransaction(
    tenantId: string,
    user: any,
    transactionId: string,
  ): Promise<void> {
    if (!user?.id) return;
    const role = (user.role || '').toUpperCase();

    // Staff → bypass
    if (isStaffRole(role)) return;

    // Parent → vérifier ownership
    if (!PARENT_ROLES.includes(role)) {
      // ⭐ FIX 2026-09-06 (F6) — ferme le fail-open : avant, un rôle non reconnu
      //    (TEACHER, STUDENT, etc.) passait et pouvait lire n'importe quel reçu.
      //    Désormais : rôles non listés → refus explicite. Les rôles staff
      //    légitimes doivent être ajoutés à STAFF_ROLES (avec normalisation
      //    des suffixes de niveau _MAT/_PRI/_SEC/_MAT_PRI).
      this.logger.warn(
        `assertParentCanAccessTransaction: ACCÈS REFUSÉ — user ${user.id} (role=${role}) non autorisé sur la transaction ${transactionId}`,
      );
      throw new ForbiddenException("Vous n'avez pas accès à ce reçu");
    }

    // Récupérer le studentId de la transaction
    const tx: any = await this.service.prismaClient.financeTransaction.findUnique({
      where: { id: transactionId },
      select: {
        studentAccount: {
          select: { studentId: true },
        },
      },
    });

    if (!tx?.studentAccount?.studentId) {
      this.logger.warn(`assertParentCanAccessTransaction: transaction ${transactionId} introuvable ou sans studentId`);
      throw new NotFoundException('Transaction introuvable');
    }

    const studentId = tx.studentAccount.studentId;

    // Vérifier qu'un guardian lié à ce studentId a le même email ou téléphone
    // que l'utilisateur connecté.
    const userRow: any = await this.service.prismaClient.$queryRawUnsafe(
      `SELECT "email", "phone" FROM "users" WHERE "id" = $1 AND "tenantId" = $2 LIMIT 1`,
      user.id, tenantId,
    ).catch(() => []);

    if (!userRow || userRow.length === 0) {
      throw new ForbiddenException('Utilisateur non trouvé');
    }

    const u = userRow[0];
    const guardian: any = await this.service.prismaClient.$queryRawUnsafe(
      `SELECT 1 FROM "student_guardians" sg
       INNER JOIN "guardians" g ON g."id" = sg."guardianId"
       WHERE sg."studentId" = $1 AND sg."tenantId" = $2
       AND (g."email" = $3 OR g."phone" = $4)
       LIMIT 1`,
      studentId, tenantId, u.email || '', u.phone || '',
    ).catch(() => []);

    if (!guardian || guardian.length === 0) {
      this.logger.warn(
        `assertParentCanAccessTransaction: ACCÈS REFUSÉ — user ${user.id} (role=${role}) a demandé la transaction ${transactionId} qui ne concerne pas son enfant`,
      );
      throw new ForbiddenException("Vous n'avez pas accès à ce reçu");
    }
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: CreateTransactionDto,
  ) {
    return this.service.create(tenantId, {
      academicYearId: body.academicYearId,
      studentAccountId: body.studentAccountId,
      amount: Number(body.amount),
      paymentMethod: body.paymentMethod,
      reference: body.reference,
      cashierId: user?.id ?? '',
      // ⭐ Passer le rôle pour vérification caisse FONDE (caisse promoteur)
      cashierRole: (user?.role || '').toUpperCase(),
      deviceId: body.deviceId,
      receiptUrl: body.receiptUrl,
      cashRegisterId: body.cashRegisterId,
      tenderedAmount: body.tenderedAmount != null ? Number(body.tenderedAmount) : undefined,
      changeGiven: body.changeGiven != null ? Number(body.changeGiven) : undefined,
    });
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('studentAccountId') studentAccountId?: string,
    @Query('type') type?: string,
    // ⭐ Filtre par type de frais (sous-onglet « Frais généraux » du module
    //    Encaissements) : ne renvoie que les transactions dont au moins une
    //    allocation vise un AccountBreakdown de ce type (ex: feeType=GENERAL).
    @Query('feeType') feeType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // ⭐ Pagination optionnelle : si page/limit fournis → retour paginé { data, total, page, totalPages }
    // Sinon → retour array (rétro-compatibilité avec les autres callers qui attendent un array)
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.service.findAll(tenantId, {
      academicYearId,
      studentAccountId,
      type,
      feeType,
      page: pageNum && !isNaN(pageNum) ? pageNum : undefined,
      limit: limitNum && !isNaN(limitNum) ? limitNum : undefined,
    });
  }

  /**
   * GET /finance/transactions/:id/receipt.pdf
   * Télécharge le PDF du reçu. Si le PDF n'existe pas encore (génération
   * fire-and-forget en cours), on le génère à la volée.
   *
   * Sécurité : vérifie qu'un parent connecté ne peut télécharger que les reçus
   * de ses propres enfants (assertParentCanAccessTransaction).
   */
  @Get(':id/receipt.pdf')
  async downloadReceipt(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    // Vérifier ownership (no-op pour staff, vérifie parent sinon)
    await this.assertParentCanAccessTransaction(tenantId, user, id);

    // S'assurer que le PDF existe (le régénère si nécessaire)
    const { filePath } = await this.receiptFinanceService.generateForTransaction(id, tenantId);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Reçu PDF introuvable');
    }

    const tx = await this.service.prismaClient.financeTransaction.findUnique({
      where: { id },
      select: {
        receiptNumber: true,
        studentAccount: {
          select: {
            student: { select: { lastName: true, firstName: true } },
          },
        },
      },
    });
    const studentName = `${tx?.studentAccount?.student?.lastName || ''} ${tx?.studentAccount?.student?.firstName || ''}`.trim() || 'Eleve';
    const safeName = studentName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Recu de paiement_${safeName}_${tx?.receiptNumber || id}_${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    fs.createReadStream(filePath).pipe(res);
  }

  /**
   * POST /finance/transactions/:id/resend
   * Renvoie le reçu par email/WhatsApp/SMS au parent de l'élève.
   * Body: { channels: ['email', 'whatsapp', 'sms'] }
   *
   * Sécurité : vérifie ownership pour les parents.
   */
  @Post(':id/resend')
  async resendReceipt(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { channels?: string[] },
  ) {
    await this.assertParentCanAccessTransaction(tenantId, user, id);

    const requestedChannels = (body?.channels || ['email']) as ('email' | 'whatsapp' | 'sms')[];
    const results = await this.receiptNotificationService.sendReceiptNotifications(
      id,
      tenantId,
      requestedChannels,
    );

    // Récupérer le n° reçu pour la réponse
    const tx = await this.service.prismaClient.financeTransaction.findUnique({
      where: { id },
      select: { receiptNumber: true },
    });

    return {
      success: true,
      transactionId: id,
      receiptNumber: tx?.receiptNumber,
      channels: results,
    };
  }

  /**
   * GET /finance/transactions/:id/whatsapp-link
   * Génère un lien wa.me avec le message pré-rempli pour envoi manuel
   * (contourne l'API Gupshup — gratuit, pas d'opt-in requis).
   */
  @Get(':id/whatsapp-link')
  async getWhatsAppLink(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    // Vérifier ownership pour les parents
    await this.assertParentCanAccessTransaction(tenantId, user, id);

    // Charger la transaction + élève + guardian + branding
    const tx = await this.service.prismaClient.financeTransaction.findUnique({
      where: { id },
      include: {
        studentAccount: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                matricule: true,
                studentGuardians: { include: { guardian: true } },
              },
            },
          },
        },
      },
    });
    if (!tx) throw new NotFoundException('Transaction introuvable');

    // Récupérer la classe de l'élève pour cette année
    const enrollment = await this.service.prismaClient.studentEnrollment.findFirst({
      where: { studentId: tx.studentAccount.studentId, academicYearId: tx.academicYearId },
      include: { class: { select: { name: true, code: true } } },
    });
    const className = enrollment?.class?.name || '—';

    // Récupérer le téléphone du parent
    const contacts = await this.receiptFinanceService.getParentContacts(tx.studentAccount.studentId);

    // Récupérer le branding
    const branding = await this.receiptFinanceService.getTenantBranding(tenantId);

    const studentName = `${tx.studentAccount?.student?.lastName || ''} ${tx.studentAccount?.student?.firstName || ''}`.trim();
    const schoolName = branding.schoolName || 'l\'établissement';
    const amountStr = Number(tx.amount).toLocaleString('fr-FR');
    const dateStr = new Date(tx.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const totalDue = Number(tx.studentAccount?.totalDue ?? 0);
    const balanceAfter = Number(tx.studentAccount?.balance ?? 0);
    const balanceLine = balanceAfter > 0
      ? `Solde restant à payer : ${balanceAfter.toLocaleString('fr-FR')} FCFA`
      : `Compte soldé — aucun solde restant.`;

    // Construire le lien public de téléchargement du reçu (via verificationToken HMAC)
    // Le token est régénéré déterministiquement à partir de transactionId + receiptNumber
    const verificationToken = this.generateReceiptToken(tx.id, tx.receiptNumber);
    // Utiliser l'URL du FRONTEND (pas du backend) pour que le parent puisse
    // télécharger le reçu dans son navigateur sans erreur 404.
    // Le frontend a une route BFF /api/finance/transactions/[id]/receipt.pdf
    // et une page publique /receipt/[token]/[id] qui télécharge le PDF.
    const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://academia-helm.vercel.app';
    const receiptLink = `${frontendUrl}/receipt/${verificationToken}/${tx.id}`;

    // Construire le message WhatsApp (avec accents — le lien wa.me les supporte)
    // ⭐ Pour les paiements en espèces, inclure le montant remis et le reliquat
    const cashPart = (tx.paymentMethod === 'CASH' && tx.tenderedAmount != null)
      ? `Montant remis : ${Number(tx.tenderedAmount).toLocaleString('fr-FR')} FCFA\n` +
        `Reliquat rendu : ${Number(tx.changeGiven ?? 0).toLocaleString('fr-FR')} FCFA\n`
      : '';

    const message = `Bonjour${contacts.name ? ` ${contacts.name}` : ''},\n\n` +
      `Nous confirmons la réception du paiement pour ${studentName} (Classe: ${className}) auprès de ${schoolName}.\n\n` +
      `Reçu n° : ${tx.receiptNumber}\n` +
      `Montant : ${amountStr} FCFA\n` +
      `${cashPart}` +
      `Date : ${dateStr}\n` +
      `${balanceLine}\n\n` +
      `📄 Téléchargez le reçu PDF détaillé ici :\n${receiptLink}\n\n` +
      `Cordialement,\nLa Direction`;

    // Normaliser le numéro pour wa.me (format international sans +)
    let phoneForWaMe = '';
    if (contacts.phone) {
      // Nettoyer le numéro : retirer espaces, tirets, points
      let cleaned = contacts.phone.replace(/[\s\-().]/g, '').trim();
      // Convertir 0195722234 → 22995722234
      if (/^01\d{8}$/.test(cleaned)) {
        cleaned = '229' + cleaned.substring(2);
      } else if (/^\d{8}$/.test(cleaned) && !cleaned.startsWith('00')) {
        cleaned = '229' + cleaned;
      } else if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
      } else if (cleaned.startsWith('00')) {
        cleaned = cleaned.substring(2);
      }
      phoneForWaMe = cleaned;
    }

    const waMeUrl = phoneForWaMe
      ? `https://wa.me/${phoneForWaMe}?text=${encodeURIComponent(message)}`
      : '';

    return {
      url: waMeUrl,
      phone: contacts.phone || null,
      message,
      receiptNumber: tx.receiptNumber,
      hasPhone: !!contacts.phone,
    };
  }


  @Post(':id/reverse')
  async reverse(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { reason: string },
  ) {
    return this.service.reverse(
      id,
      tenantId,
      body?.reason ?? 'Non précisé',
      user?.id ?? '',
    );
  }

  /**
   * Génère le token de vérification HMAC d'un reçu (déterministe).
   * Doit correspondre à ReceiptFinanceService.generateVerificationToken().
   */
  private generateReceiptToken(transactionId: string, receiptNumber: string): string {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    const secret = process.env.RECEIPT_VERIFICATION_SECRET || 'academia-helm-receipt-secret-2026';
    const data = `${transactionId}|${receiptNumber}`;
    return crypto.createHmac('sha256', secret).update(data).digest('base64url');
  }
}
