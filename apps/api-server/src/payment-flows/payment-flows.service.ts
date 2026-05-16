import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentFlowsRepository, SchoolPaymentAccountsRepository } from './payment-flows.repository';
import { PaymentFlow, PaymentFlowType, PaymentDestination, PaymentFlowStatus, PaymentServiceProvider } from './entities/payment-flow.entity';
import { SchoolPaymentAccount } from './entities/school-payment-account.entity';
import { CreatePaymentFlowDto } from './dto/create-payment-flow.dto';
import { CreateSchoolPaymentAccountDto } from './dto/create-school-payment-account.dto';
import { FedapayService } from './providers/fedapay.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FinanceTransactionService } from '../finance/finance-transaction.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PaymentFlowsService {
  constructor(
    private readonly paymentFlowsRepository: PaymentFlowsRepository,
    private readonly schoolPaymentAccountsRepository: SchoolPaymentAccountsRepository,
    private readonly fedapayService: FedapayService,
    private readonly auditLogsService: AuditLogsService,
    private readonly financeTransactionService: FinanceTransactionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Crée un flux de paiement avec séparation stricte SAAS/TUITION
   * 
   * RÈGLES MÉTIER :
   * 1. Si flowType = SAAS → destination = ACADEMIA (obligatoire)
   * 2. Si flowType = TUITION → destination = SCHOOL (obligatoire)
   * 3. TUITION nécessite un compte école vérifié
   * 4. Aucun mélange de flux
   */
  async createPaymentFlow(
    createDto: CreatePaymentFlowDto,
    tenantId: string,
    userId?: string,
  ): Promise<PaymentFlow> {
    // RÈGLE 1 & 2 : Déterminer la destination selon le type
    let destination: PaymentDestination;
    if (createDto.flowType === PaymentFlowType.SAAS) {
      destination = PaymentDestination.ACADEMIA;
    } else if (createDto.flowType === PaymentFlowType.TUITION) {
      destination = PaymentDestination.SCHOOL;
      
      // RÈGLE 3 : Vérifier qu'un compte école est configuré et vérifié
      const schoolAccount = await this.schoolPaymentAccountsRepository.findActive(
        tenantId,
        createDto.psp,
      );
      
      if (!schoolAccount) {
        throw new BadRequestException(
          `Aucun compte de paiement vérifié trouvé pour le PSP ${createDto.psp}. ` +
          `Veuillez configurer un compte de paiement dans les paramètres.`
        );
      }
      
      // Vérifier que studentId est fourni pour TUITION
      if (!createDto.studentId) {
        throw new BadRequestException('studentId est obligatoire pour les paiements TUITION');
      }
    } else {
      throw new BadRequestException(`Type de flux invalide: ${createDto.flowType}`);
    }

    // Créer le flux de paiement
    const flowData: any = {
      ...createDto,
      tenantId,
      destination: destination as PaymentDestination,
      currency: createDto.currency || 'XOF',
      status: PaymentFlowStatus.INITIATED,
      initiatedBy: userId,
      academicYearId: createDto.academicYearId,
    };
    const flow = await this.paymentFlowsRepository.create(flowData);

    // Initier le paiement selon le PSP
    let paymentUrl: string | null = null;
    let pspReference: string | null = null;

    if (createDto.psp === PaymentServiceProvider.FEDAPAY) {
      const fedapayResult = await this.fedapayService.initiatePayment({
        amount: createDto.amount,
        currency: createDto.currency || 'XOF',
        description: createDto.reason || `Paiement ${createDto.flowType}`,
        metadata: {
          flowId: flow.id,
          flowType: createDto.flowType,
          destination: destination,
          tenantId,
          ...createDto.metadata,
        },
        // Pour TUITION, utiliser le compte de l'école
        ...(destination === PaymentDestination.SCHOOL && {
          destinationAccount: await this.getSchoolAccountIdentifier(tenantId, createDto.psp),
        }),
      });

      paymentUrl = fedapayResult.paymentUrl;
      pspReference = fedapayResult.reference;
    } else if (createDto.psp === PaymentServiceProvider.CASH || createDto.psp === PaymentServiceProvider.BANK_TRANSFER) {
      // Paiements hors ligne : pas de URL, statut PENDING
      flow.status = PaymentFlowStatus.PENDING;
    } else {
      throw new BadRequestException(`PSP ${createDto.psp} non supporté`);
    }

    // Mettre à jour le flux avec les infos du PSP
    const updatedFlow = await this.paymentFlowsRepository.update(flow.id, tenantId, {
      paymentUrl,
      pspReference,
      status: flow.status,
    });

    // Journaliser l'action
    await this.auditLogsService.create(
      {
        action: 'PAYMENT_FLOW_CREATED',
        resource: 'payment_flow',
        resourceId: flow.id,
        changes: {
          flowType: createDto.flowType,
          destination,
          amount: createDto.amount,
          psp: createDto.psp,
        },
      },
      tenantId,
      userId,
    );

    return updatedFlow;
  }

  /**
   * Traite un webhook de paiement (appelé par le PSP)
   */
  async handleWebhook(
    psp: PaymentServiceProvider,
    webhookData: any,
  ): Promise<PaymentFlow> {
    // Vérifier la signature du webhook (sécurité)
    if (psp === PaymentServiceProvider.FEDAPAY) {
      const isValid = await this.fedapayService.verifyWebhookSignature(webhookData);
      if (!isValid) {
        throw new BadRequestException('Signature webhook invalide');
      }
    }

    // Identifier le flux de paiement
    const pspReference = this.extractPspReference(psp, webhookData);
    if (!pspReference) {
      throw new BadRequestException('Référence PSP introuvable dans le webhook');
    }

    const flow = await this.paymentFlowsRepository.findByPspReference(pspReference);
    if (!flow) {
      throw new NotFoundException(`Payment flow avec référence ${pspReference} introuvable`);
    }

    // Déterminer le nouveau statut
    const newStatus = this.mapWebhookStatusToFlowStatus(psp, webhookData);

    // Mettre à jour le flux
    const updatedFlow = await this.paymentFlowsRepository.update(flow.id, flow.tenantId, {
      status: newStatus,
      paidAt: newStatus === PaymentFlowStatus.PAID ? new Date() : flow.paidAt,
      webhookData,
    });

    // RÈGLE MÉTIER : Si TUITION est payé → enregistrer dans le module Finance
    if (newStatus === PaymentFlowStatus.PAID && flow.flowType === PaymentFlowType.TUITION && flow.studentId && flow.academicYearId) {
      try {
        // Trouver le compte élève
        const account = await this.prisma.studentAccount.findUnique({
          where: {
            studentId_academicYearId: {
              studentId: flow.studentId,
              academicYearId: flow.academicYearId,
            },
          },
        });

        if (account) {
          await this.financeTransactionService.create(flow.tenantId, {
            academicYearId: flow.academicYearId,
            studentAccountId: account.id,
            amount: Number(flow.amount),
            paymentMethod: 'FEDAPAY',
            reference: `Online: ${flow.pspReference}`,
            cashierId: flow.initiatedBy || 'SYSTEM', // Ou un ID dédié robot
            receiptUrl: flow.paymentUrl || undefined,
          });
        }
      } catch (e) {
        console.error('Failed to bridge payment flow to finance transaction:', e);
        // On ne bloque pas le webhook car le paiement est déjà encaissé côté PSP
      }
    }

    // Journaliser l'événement
    await this.auditLogsService.create(
      {
        action: 'PAYMENT_FLOW_WEBHOOK',
        resource: 'payment_flow',
        resourceId: flow.id,
        changes: {
          psp,
          oldStatus: flow.status,
          newStatus,
          webhookData,
        },
      },
      flow.tenantId,
      null,
    );

    return updatedFlow;
  }

  /**
   * Récupère tous les flux de paiement d'un tenant
   */
  async findAll(
    tenantId: string,
    flowType?: PaymentFlowType,
    status?: PaymentFlowStatus,
    studentId?: string,
  ): Promise<PaymentFlow[]> {
    return this.paymentFlowsRepository.findAll(tenantId, flowType, status, studentId);
  }

  /**
   * Récupère un flux de paiement spécifique
   */
  async findOne(id: string, tenantId: string): Promise<PaymentFlow> {
    const flow = await this.paymentFlowsRepository.findOne(id, tenantId);
    if (!flow) {
      throw new NotFoundException(`Payment flow with ID ${id} not found`);
    }
    return flow;
  }

  /**
   * Gestion des comptes de paiement école
   */
  async createSchoolPaymentAccount(
    createDto: CreateSchoolPaymentAccountDto,
    tenantId: string,
    userId?: string,
  ): Promise<SchoolPaymentAccount> {
    // Vérifier qu'un compte avec ce PSP n'existe pas déjà
    const existing = await this.schoolPaymentAccountsRepository.findActive(tenantId, createDto.psp);
    if (existing) {
      throw new BadRequestException(`Un compte actif existe déjà pour le PSP ${createDto.psp}`);
    }

    const account = await this.schoolPaymentAccountsRepository.create({
      ...createDto,
      tenantId,
      createdBy: userId,
      isVerified: false, // Nécessite vérification manuelle
      isActive: true,
    });

    // Journaliser
    await this.auditLogsService.create(
      {
        action: 'SCHOOL_PAYMENT_ACCOUNT_CREATED',
        resource: 'school_payment_account',
        resourceId: account.id,
        changes: {
          psp: createDto.psp,
          accountIdentifier: createDto.accountIdentifier,
        },
      },
      tenantId,
      userId,
    );

    return account;
  }

  async verifySchoolPaymentAccount(
    accountId: string,
    tenantId: string,
    userId: string,
  ): Promise<SchoolPaymentAccount> {
    const account = await this.schoolPaymentAccountsRepository.findOne(accountId, tenantId);
    if (!account) {
      throw new NotFoundException(`School payment account with ID ${accountId} not found`);
    }

    const updated = await this.schoolPaymentAccountsRepository.update(accountId, tenantId, {
      isVerified: true,
      verifiedAt: new Date(),
      verifiedBy: userId,
    });

    // Journaliser
    await this.auditLogsService.create(
      {
        action: 'SCHOOL_PAYMENT_ACCOUNT_VERIFIED',
        resource: 'school_payment_account',
        resourceId: accountId,
        changes: {
          verifiedBy: userId,
        },
      },
      tenantId,
      userId,
    );

    return updated;
  }

  async findAllSchoolPaymentAccounts(tenantId: string): Promise<SchoolPaymentAccount[]> {
    return this.schoolPaymentAccountsRepository.findAll(tenantId);
  }

  /**
   * Récupère l'identifiant du compte école pour un PSP donné
   */
  private async getSchoolAccountIdentifier(tenantId: string, psp: PaymentServiceProvider): Promise<string> {
    const account = await this.schoolPaymentAccountsRepository.findActive(tenantId, psp);
    if (!account) {
      throw new BadRequestException(`Aucun compte actif trouvé pour le PSP ${psp}`);
    }
    return account.accountIdentifier;
  }

  /**
   * Extrait la référence PSP du webhook
   */
  private extractPspReference(psp: PaymentServiceProvider, webhookData: any): string | null {
    if (psp === PaymentServiceProvider.FEDAPAY) {
      return webhookData.transaction?.id || webhookData.id || null;
    }
    return null;
  }

  /**
   * Mappe le statut du webhook au statut du flux
   */
  private mapWebhookStatusToFlowStatus(psp: PaymentServiceProvider, webhookData: any): PaymentFlowStatus {
    if (psp === PaymentServiceProvider.FEDAPAY) {
      const status = webhookData.transaction?.status || webhookData.status;
      switch (status?.toUpperCase()) {
        case 'APPROVED':
        case 'SUCCESS':
        case 'PAID':
          return PaymentFlowStatus.PAID;
        case 'PENDING':
          return PaymentFlowStatus.PENDING;
        case 'FAILED':
        case 'REJECTED':
          return PaymentFlowStatus.FAILED;
        case 'CANCELLED':
          return PaymentFlowStatus.CANCELLED;
        default:
          return PaymentFlowStatus.PENDING;
      }
    }
    return PaymentFlowStatus.PENDING;
  }
}

