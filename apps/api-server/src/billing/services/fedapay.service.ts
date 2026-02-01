/**
 * ============================================================================
 * FEDAPAY SERVICE - INTÉGRATION FEDAPAY
 * ============================================================================
 * 
 * Service pour gérer les paiements via FedaPay
 * 
 * IMPORTANT : Utiliser la documentation officielle FedaPay
 * https://docs.fedapay.com
 * 
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { OnboardingService } from '../../onboarding/services/onboarding.service';
import { PricingService } from './pricing.service';

@Injectable()
export class FedaPayService {
  private readonly logger = new Logger(FedaPayService.name);
  private readonly apiKey: string;
  private readonly apiBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    @Inject(forwardRef(() => OnboardingService))
    private readonly onboardingService: OnboardingService,
  ) {
    this.apiKey = this.configService.get<string>('FEDAPAY_API_KEY') || '';
    this.apiBaseUrl = this.configService.get<string>('FEDAPAY_API_URL') || 'https://api.fedapay.com';
  }

  /**
   * Crée une transaction FedaPay
   * 
   * Documentation : https://docs.fedapay.com/api/transactions#create-a-transaction
   * 
   * Structure selon documentation FedaPay :
   * POST /v1/transactions
   * {
   *   "transaction": {
   *     "amount": 100000,
   *     "description": "Description",
   *     "callback_url": "https://...",
   *     "customer": { ... },
   *     "metadata": { ... }
   *   }
   * }
   * 
   * Note: FedaPay utilise l'API REST. Le SDK officiel est disponible mais
   * nous utilisons fetch pour plus de contrôle et compatibilité.
   */
  async createTransaction(data: {
    amount: number;
    description: string;
    callbackUrl: string;
    metadata?: Record<string, any>;
    customer?: {
      email: string;
      firstname?: string;
      lastname?: string;
      phone_number?: string;
    };
    imageUrl?: string; // URL de l'image pour la page de paiement
  }) {
    if (!this.apiKey) {
      throw new BadRequestException('FEDAPAY_API_KEY not configured');
    }

    try {
      // Structure conforme à la documentation FedaPay
      const payload: any = {
        transaction: {
          amount: data.amount,
          description: data.description,
          callback_url: data.callbackUrl,
          metadata: data.metadata || {},
        },
      };

      // Ajouter l'image si fournie (pour personnaliser la page de paiement)
      if (data.imageUrl) {
        payload.transaction.metadata = {
          ...payload.transaction.metadata,
          image_url: data.imageUrl,
          logo_url: data.imageUrl, // Certaines versions de FedaPay utilisent logo_url
        };
      }

      // Ajouter les informations client si fournies (optionnel selon doc FedaPay)
      if (data.customer) {
        payload.transaction.customer = {
          email: data.customer.email,
          firstname: data.customer.firstname || '',
          lastname: data.customer.lastname || '',
          phone_number: data.customer.phone_number || '',
        };
      }

      const response = await fetch(`${this.apiBaseUrl}/v1/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        this.logger.error('FedaPay transaction creation failed:', error);
        throw new BadRequestException(
          error.message || 'Failed to create payment transaction'
        );
      }

      const result = await response.json();
      
      // FedaPay retourne les données dans un objet 'transaction'
      // Réponse attendue : { "transaction": { "id": "...", "payment_url": "...", ... } }
      const transaction = result.transaction || result;
      
      if (!transaction.id) {
        this.logger.error('Invalid FedaPay response:', result);
        throw new BadRequestException('Invalid response from FedaPay API');
      }

      this.logger.log(`✅ FedaPay transaction created: ${transaction.id} - URL: ${transaction.payment_url || transaction.url}`);

      return {
        transactionId: transaction.id,
        reference: transaction.reference || transaction.id,
        paymentUrl: transaction.payment_url || transaction.url || transaction.paymentUrl,
        status: transaction.status || 'pending',
        amount: transaction.amount || data.amount,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('FedaPay API error:', error);
      throw new BadRequestException('Failed to create payment transaction');
    }
  }

  /**
   * Crée une session de paiement pour l'onboarding
   * 
   * ⚠️ CRITIQUE : Le montant est calculé côté serveur (100 000 FCFA)
   * 
   * Support deux modes :
   * 1. Pages statiques FedaPay (si FEDAPAY_STATIC_PAGE_URL configuré)
   * 2. Transactions dynamiques via API (par défaut)
   */
  async createOnboardingPaymentSession(draftId: string) {
    const draft = await this.prisma.onboardingDraft.findUnique({
      where: { id: draftId },
      include: { payments: true },
    });

    if (!draft) {
      throw new BadRequestException(`Onboarding draft not found: ${draftId}`);
    }

    if (draft.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(
        `Cannot create payment session for draft in status: ${draft.status}`
      );
    }

    // ⚠️ Montant depuis PricingService (paramétrable)
    // Appliquer la réduction multi-écoles si applicable
    const amount = await this.pricingService.calculateInitialPaymentPrice(draft.schoolsCount || 1);

    // Vérifier s'il existe déjà un paiement en cours
    const existingPayment = draft.payments.find(
      (p) => p.status === 'PENDING' || p.status === 'PROCESSING'
    );

    if (existingPayment) {
      // Si une transaction FedaPay existe déjà, la récupérer
      const existingTransaction = (existingPayment.metadata as any)?.transactionId;
      
      if (existingTransaction) {
        // Retourner l'URL de paiement existante
        return {
          paymentId: existingPayment.id,
          reference: existingPayment.reference,
          paymentUrl: (existingPayment.metadata as any)?.paymentUrl,
          amount: existingPayment.amount,
          status: existingPayment.status,
        };
      }
    }

    // Générer une référence unique
    const reference = `ONB-${draftId.substring(0, 8).toUpperCase()}-${Date.now()}`;

    // Créer le paiement dans notre base
    const payment = await this.prisma.onboardingPayment.create({
      data: {
        draftId,
        provider: 'fedapay',
        reference,
        amount,
        currency: 'XOF',
        status: 'PENDING',
        metadata: {
          draftId,
          amount,
          createdAt: new Date().toISOString(),
        },
      },
    });

    // Vérifier si on utilise une page statique FedaPay
    const staticPageUrl = this.configService.get<string>('FEDAPAY_STATIC_PAGE_SUBSCRIPTION_URL');
    
    if (staticPageUrl) {
      // Mode page statique : utiliser l'URL de la page pré-configurée
      // Ajouter les paramètres dans l'URL pour identifier le paiement
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');
      const callbackUrl = `${frontendUrl}/onboarding/callback?draftId=${draftId}&paymentId=${payment.id}&reference=${reference}`;
      
      // Construire l'URL avec les paramètres de callback
      const paymentUrl = `${staticPageUrl}?callback_url=${encodeURIComponent(callbackUrl)}&reference=${reference}&metadata=${encodeURIComponent(JSON.stringify({ draftId, paymentId: payment.id }))}`;

      // Mettre à jour le paiement avec l'URL de la page statique
      await this.prisma.onboardingPayment.update({
        where: { id: payment.id },
        data: {
          metadata: {
            ...(payment.metadata as any),
            paymentUrl,
            staticPage: true,
            callbackUrl,
          },
        },
      });

      this.logger.log(`💳 Payment session created (static page): ${payment.id} - Reference: ${reference} - URL: ${paymentUrl}`);

      return {
        paymentId: payment.id,
        reference,
        paymentUrl,
        amount,
        status: 'PENDING',
      };
    }

    // Mode API : Créer la transaction FedaPay dynamiquement
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');
    const callbackUrl = `${frontendUrl}/onboarding/callback?draftId=${draftId}`;
    const webhookUrl = `${this.configService.get<string>('API_URL', 'http://localhost:3000')}/api/billing/fedapay/webhook`;

    // URL de l'image pour la souscription initiale
    const imageUrl = `${frontendUrl}/images/Souscription%20initiale.jpg`;

    const transaction = await this.createTransaction({
      amount,
      description: `Paiement initial Academia Hub - ${draft.schoolName}`,
      callbackUrl,
      imageUrl, // Image pour la page de paiement
      metadata: {
        draftId,
        paymentId: payment.id,
        reference,
        type: 'onboarding_initial_payment',
        webhookUrl,
      },
      customer: {
        email: draft.promoterEmail || draft.email,
        firstname: draft.promoterFirstName || '',
        lastname: draft.promoterLastName || '',
        phone_number: draft.promoterPhone || draft.phone,
      },
    });

    // Mettre à jour le paiement avec les infos de la transaction
    await this.prisma.onboardingPayment.update({
      where: { id: payment.id },
      data: {
        metadata: {
          ...(payment.metadata as any),
          transactionId: transaction.transactionId,
          paymentUrl: transaction.paymentUrl,
          webhookUrl,
          staticPage: false,
        },
      },
    });

    this.logger.log(`💳 Payment session created (API): ${payment.id} - Reference: ${reference} - URL: ${transaction.paymentUrl}`);

    return {
      paymentId: payment.id,
      reference,
      paymentUrl: transaction.paymentUrl,
      amount,
      status: 'PENDING',
    };
  }

  /**
   * Crée une session de paiement pour le renouvellement mensuel/annuel
   * 
   * ⚠️ CRITIQUE : Le montant est calculé côté serveur via PricingService
   * 
   * Documentation FedaPay : https://docs.fedapay.com/api/transactions#create-a-transaction
   */
  async createRenewalPaymentSession(subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        subscriptionPlan: true,
        tenant: {
          include: {
            users: {
              where: { roles: { has: 'PROMOTER' } },
              take: 1,
            },
          },
        },
      },
    });

    if (!subscription) {
      throw new BadRequestException(`Subscription not found: ${subscriptionId}`);
    }

    if (subscription.status === 'SUSPENDED' || subscription.status === 'CANCELLED') {
      throw new BadRequestException(
        `Cannot create renewal payment for subscription in status: ${subscription.status}`
      );
    }

    // ⚠️ Calculer le montant via PricingService (paramétrable)
    const pricingResult = await this.pricingService.calculateRenewalPrice(subscriptionId);
    const amount = pricingResult.amount;

    // Déterminer le cycle (MONTHLY ou YEARLY)
    const cycle = subscription.currentPeriodEnd && subscription.currentPeriodStart
      ? (subscription.currentPeriodEnd.getFullYear() - subscription.currentPeriodStart.getFullYear() >= 1 ? 'YEARLY' : 'MONTHLY')
      : 'MONTHLY';

    // Générer une référence unique
    const reference = `REN-${subscriptionId.substring(0, 8).toUpperCase()}-${Date.now()}`;

    // Créer l'événement de facturation
    const billingEvent = await this.prisma.billingEvent.create({
      data: {
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        type: 'RENEWAL',
        amount,
        channel: 'fedapay',
        reference,
        metadata: {
          subscriptionId,
          cycle,
          pricingBreakdown: pricingResult.breakdown as any,
          configVersion: pricingResult.configVersion,
        } as any,
      },
    });

    // Vérifier si on utilise une page statique pour les renouvellements
    const staticPageUrl = this.configService.get<string>('FEDAPAY_STATIC_PAGE_MONTHLY_URL');
    
    if (staticPageUrl) {
      // Mode page statique : utiliser l'URL de la page pré-configurée
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');
      const callbackUrl = `${frontendUrl}/billing/renewal/callback?subscriptionId=${subscriptionId}&billingEventId=${billingEvent.id}`;
      
      // Construire l'URL avec les paramètres de callback
      const paymentUrl = `${staticPageUrl}?callback_url=${encodeURIComponent(callbackUrl)}&reference=${reference}&metadata=${encodeURIComponent(JSON.stringify({ subscriptionId, billingEventId: billingEvent.id }))}`;

      // Mettre à jour l'événement avec l'URL de la page statique
      await this.prisma.billingEvent.update({
        where: { id: billingEvent.id },
        data: {
          metadata: {
            ...(billingEvent.metadata as any),
            paymentUrl,
            staticPage: true,
            callbackUrl,
          },
        },
      });

      this.logger.log(`💳 Renewal payment session created (static page): ${billingEvent.id} - Reference: ${reference} - URL: ${paymentUrl}`);

      return {
        billingEventId: billingEvent.id,
        reference,
        paymentUrl,
        amount,
        cycle,
        status: 'PENDING',
      };
    }

    // Mode API : Créer la transaction FedaPay dynamiquement
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');
    const callbackUrl = `${frontendUrl}/billing/renewal/callback?subscriptionId=${subscriptionId}&billingEventId=${billingEvent.id}`;
    const webhookUrl = `${this.configService.get<string>('API_URL', 'http://localhost:3000')}/api/billing/fedapay/webhook`;

    // URL de l'image pour l'abonnement mensuel
    const imageUrl = `${frontendUrl}/images/Abonnement%20mensuel.jpg`;

    // Récupérer les infos du promoteur pour le customer
    const promoter = subscription.tenant.users[0];

    const transaction = await this.createTransaction({
      amount,
      description: `Renouvellement ${cycle === 'MONTHLY' ? 'mensuel' : 'annuel'} Academia Hub - ${subscription.tenant.name}`,
      callbackUrl,
      imageUrl, // Image pour la page de paiement
      metadata: {
        subscriptionId,
        billingEventId: billingEvent.id,
        reference,
        type: 'subscription_renewal',
        cycle,
        webhookUrl,
      },
      customer: promoter ? {
        email: promoter.email,
        firstname: promoter.firstName || '',
        lastname: promoter.lastName || '',
        phone_number: promoter.phone || '',
      } : undefined,
    });

    // Mettre à jour l'événement de facturation avec les infos de la transaction
    await this.prisma.billingEvent.update({
      where: { id: billingEvent.id },
      data: {
        metadata: {
          ...(billingEvent.metadata as any),
          transactionId: transaction.transactionId,
          paymentUrl: transaction.paymentUrl,
          webhookUrl,
          staticPage: false,
        },
      },
    });

    this.logger.log(`💳 Renewal payment session created (API): ${billingEvent.id} - Reference: ${reference} - URL: ${transaction.paymentUrl}`);

    return {
      billingEventId: billingEvent.id,
      reference,
      paymentUrl: transaction.paymentUrl,
      amount,
      cycle,
      status: 'PENDING',
    };
  }

  /**
   * Vérifie la signature d'un webhook FedaPay
   * 
   * Documentation : https://docs.fedapay.com/webhooks#verify-webhook-signature
   */
  async verifyWebhookSignature(
    payload: string,
    signature: string,
  ): Promise<boolean> {
    // TODO: Implémenter la vérification de signature selon la doc FedaPay
    // Généralement, c'est un HMAC SHA256
    
    const crypto = require('crypto');
    const webhookSecret = this.configService.get<string>('FEDAPAY_WEBHOOK_SECRET') || '';
    
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Traite un webhook FedaPay
   * 
   * ⚠️ CRITIQUE : Vérifications de sécurité obligatoires
   * 1. Signature webhook
   * 2. Event type
   * 3. Transaction status
   * 4. Montant
   * 5. Reference connue
   * 6. Idempotence
   */
  async handleWebhook(payload: any, signature: string) {
    // 1. Vérifier la signature (OBLIGATOIRE)
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const isValid = await this.verifyWebhookSignature(payloadString, signature);

    if (!isValid) {
      this.logger.error('❌ Invalid FedaPay webhook signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    // 2. Extraire l'événement et la transaction
    const event = payload.event || payload.type;
    const transaction = payload.data || payload.transaction || payload;

    if (!event) {
      throw new BadRequestException('Missing event type in webhook payload');
    }

    if (!transaction) {
      throw new BadRequestException('Missing transaction data in webhook payload');
    }

    const transactionId = transaction.id || transaction.transaction_id;
    const transactionReference = transaction.reference || transaction.reference_id || transactionId;

    if (!transactionReference) {
      throw new BadRequestException('Missing transaction reference in webhook payload');
    }

    this.logger.log(
      `📥 FedaPay webhook received: ${event} - Transaction ID: ${transactionId} - Reference: ${transactionReference}`
    );

    // 3. Traiter selon le type d'événement
    try {
      switch (event) {
        case 'transaction.approved':
        case 'transaction.completed':
          return await this.handlePaymentSuccess(transaction);

        case 'transaction.declined':
        case 'transaction.failed':
          await this.handlePaymentFailure(transaction);
          return { received: true, processed: false };

        default:
          this.logger.warn(`⚠️  Unhandled FedaPay event: ${event}`);
          return { received: true, processed: false, event };
      }
    } catch (error: any) {
      this.logger.error(`❌ Error processing webhook: ${error.message}`, error.stack);
      
      // Enregistrer l'erreur dans le log
      try {
        await this.prisma.paymentWebhookLog.create({
          data: {
            reference: transactionReference,
            provider: 'fedapay',
            eventType: event,
            processed: false,
            payload: transaction,
            metadata: {
              error: error.message,
              transactionId,
            },
          },
        });
      } catch (logError) {
        this.logger.error('Failed to log webhook error:', logError);
      }

      throw error;
    }
  }

  /**
   * Traite un paiement réussi
   * 
   * ⚠️ CRITIQUE : Cette méthode doit être idempotente et transactionnelle
   */
  private async handlePaymentSuccess(transaction: any) {
    const paymentReference = transaction.reference || transaction.id;
    const eventType = 'transaction.approved';
    
    // 1. Vérifier l'idempotence via PaymentWebhookLog
    const existingLog = await this.prisma.paymentWebhookLog.findUnique({
      where: { reference: paymentReference },
    });

    if (existingLog && existingLog.processed) {
      // Déjà traité (idempotency)
      this.logger.log(`✅ Payment already processed (idempotent): ${paymentReference}`);
      return { processed: true, alreadyProcessed: true };
    }

    // 2. Trouver le paiement dans notre base
    const payment = await this.prisma.onboardingPayment.findUnique({
      where: { reference: paymentReference },
      include: { draft: true },
    });

    if (!payment) {
      this.logger.error(`❌ Payment not found for reference: ${paymentReference}`);
      
      // Enregistrer le webhook même si le paiement n'existe pas (pour audit)
      await this.prisma.paymentWebhookLog.create({
        data: {
          reference: paymentReference,
          provider: 'fedapay',
          eventType,
          processed: false,
          payload: transaction,
          metadata: {
            error: 'Payment not found',
            transactionId: transaction.id,
          },
        },
      });
      
      throw new BadRequestException(`Payment not found for reference: ${paymentReference}`);
    }

    // 3. Vérifier le statut du paiement
    const currentStatus = payment ? payment.status : (billingEvent?.metadata as any)?.status;
    const expectedAmount = payment ? payment.amount : (billingEvent?.amount || 0);

    if (payment && payment.status === 'SUCCESS') {
      // Déjà traité (double vérification)
      this.logger.log(`✅ Payment already marked as SUCCESS: ${paymentReference}`);
      
      // Mettre à jour le log si nécessaire
      if (!existingLog) {
        await this.prisma.paymentWebhookLog.create({
          data: {
            reference: paymentReference,
            provider: 'fedapay',
            eventType,
            processed: true,
            processedAt: new Date(),
            payload: transaction,
          },
        });
      }
      
      return { processed: true, alreadyProcessed: true };
    }

    // 4. Vérifier le montant (CRITIQUE - vérification serveur)
    if (expectedAmount !== transaction.amount) {
      this.logger.error(
        `❌ Amount mismatch for payment ${paymentReference}: expected ${expectedAmount}, got ${transaction.amount}`
      );
      
      // Enregistrer l'erreur
      await this.prisma.paymentWebhookLog.create({
        data: {
          reference: paymentReference,
          provider: 'fedapay',
          eventType,
          processed: false,
          payload: transaction,
          metadata: {
            error: 'Amount mismatch',
            expectedAmount: payment.amount,
            receivedAmount: transaction.amount,
            transactionId: transaction.id,
          },
        },
      });
      
      // TODO: Émettre alerte ORION pour fraude potentielle
      throw new BadRequestException(
        `Payment amount mismatch: expected ${payment.amount}, got ${transaction.amount}`
      );
    }

    // 5. Vérifier le statut de la transaction FedaPay
    if (transaction.status !== 'approved' && transaction.status !== 'approved') {
      this.logger.error(
        `❌ Transaction not approved: ${transaction.status} for reference ${paymentReference}`
      );
      throw new BadRequestException(`Transaction status is not approved: ${transaction.status}`);
    }

    // 6. Transaction atomique : traitement selon le type de paiement
    return await this.prisma.$transaction(async (tx) => {
      // 6.1. Créer le log webhook (idempotence)
      await tx.paymentWebhookLog.upsert({
        where: { reference: paymentReference },
        create: {
          reference: paymentReference,
          provider: 'fedapay',
          eventType,
          processed: true,
          processedAt: new Date(),
          payload: transaction,
          metadata: {
            transactionId: transaction.id,
            paymentType,
            paymentId: payment?.id || billingEvent?.id,
            draftId: payment?.draftId,
            subscriptionId: billingEvent?.subscriptionId,
          },
        },
        update: {
          processed: true,
          processedAt: new Date(),
        },
      });

      if (paymentType === 'onboarding' && payment) {
        // 6.2. Mettre à jour le statut du paiement onboarding
        await tx.onboardingPayment.update({
          where: { id: payment.id },
          data: {
            status: 'SUCCESS',
            metadata: {
              ...(payment.metadata as any),
              transactionId: transaction.id,
              processedAt: new Date().toISOString(),
              webhookProcessed: true,
            },
          },
        });

        // 6.3. Activer le tenant (transaction atomique)
        await this.onboardingService.activateTenantAfterPayment(payment.id);

        this.logger.log(`✅ Onboarding payment processed and tenant activated: ${paymentReference}`);

        return {
          processed: true,
          paymentId: payment.id,
          reference: paymentReference,
          type: 'onboarding',
        };
      } else if (paymentType === 'renewal' && billingEvent) {
        // 6.2. Mettre à jour l'événement de facturation
        await tx.billingEvent.update({
          where: { id: billingEvent.id },
          data: {
            metadata: {
              ...(billingEvent.metadata as any),
              transactionId: transaction.id,
              status: 'SUCCESS',
              processedAt: new Date().toISOString(),
              webhookProcessed: true,
            },
          },
        });

        // 6.3. Renouveler la souscription
        const subscription = billingEvent.subscription;
        const now = new Date();
        const periodEnd = new Date(now);
        
        // Déterminer le cycle depuis les métadonnées
        const cycle = (billingEvent.metadata as any)?.cycle || 'MONTHLY';
        if (cycle === 'MONTHLY') {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        } else {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        }

        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });

        this.logger.log(`✅ Renewal payment processed and subscription renewed: ${paymentReference}`);

        return {
          processed: true,
          billingEventId: billingEvent.id,
          reference: paymentReference,
          type: 'renewal',
        };
      }

      throw new BadRequestException('Invalid payment type');
    });
  }

  /**
   * Traite un paiement échoué
   */
  private async handlePaymentFailure(transaction: any) {
    const paymentReference = transaction.reference;
    
    const payment = await this.prisma.onboardingPayment.findUnique({
      where: { reference: paymentReference },
    });

    if (!payment) {
      this.logger.error(`❌ Payment not found for reference: ${paymentReference}`);
      return;
    }

    await this.prisma.onboardingPayment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        metadata: {
          ...(payment.metadata as any),
          transactionId: transaction.id,
          failureReason: transaction.failure_reason,
          processedAt: new Date().toISOString(),
        },
      },
    });

    this.logger.warn(`⚠️  Payment failed: ${paymentReference}`);
  }
}
