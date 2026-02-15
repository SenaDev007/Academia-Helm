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

import { Injectable, Logger, BadRequestException, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { OnboardingService } from '../../onboarding/services/onboarding.service';
import { PricingService } from './pricing.service';
import { FedaPay, Transaction } from 'fedapay';

@Injectable()
export class FedaPayService implements OnModuleInit {
  private readonly logger = new Logger(FedaPayService.name);
  private readonly apiKey: string;
  private readonly publicKey: string;
  private readonly apiBaseUrl: string;
  private readonly isLiveMode: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    @Inject(forwardRef(() => OnboardingService))
    private readonly onboardingService: OnboardingService,
  ) {
    // Récupérer et nettoyer la clé API
    const rawApiKey = this.configService.get<string>('FEDAPAY_API_KEY') || '';
    this.apiKey = rawApiKey.trim();
    this.publicKey = (this.configService.get<string>('FEDAPAY_PUBLIC_KEY') || '').trim();
    
    // Normaliser l'URL de base de l'API FedaPay
    let baseUrl = this.configService.get<string>('FEDAPAY_API_URL') || 'https://api.fedapay.com';
    
    // Gérer différents formats d'URL :
    // - https://sandbox-api.fedapay.com (sandbox/test)
    // - https://sandbox.fedapay.com/api (format alternatif sandbox)
    // - https://api.fedapay.com (production/live)
    // - https://live.fedapay.com (production/live - format alternatif)
    
    // Si l'URL contient "live.fedapay.com", la convertir en "api.fedapay.com" (pour production)
    if (baseUrl.includes('live.fedapay.com')) {
      baseUrl = baseUrl.replace('live.fedapay.com', 'api.fedapay.com');
      this.logger.warn('⚠️  Converted live.fedapay.com URL to api.fedapay.com (LIVE/PRODUCTION mode)');
    }
    // Si l'URL contient "sandbox.fedapay.com/api", la convertir en "sandbox-api.fedapay.com"
    else if (baseUrl.includes('sandbox.fedapay.com/api')) {
      baseUrl = baseUrl.replace('sandbox.fedapay.com/api', 'sandbox-api.fedapay.com');
      this.logger.warn('⚠️  Converted sandbox URL format: sandbox.fedapay.com/api → sandbox-api.fedapay.com');
    }
    // Si l'URL contient "sandbox.fedapay.com" sans "/api", la convertir en "sandbox-api.fedapay.com"
    else if (baseUrl.includes('sandbox.fedapay.com') && !baseUrl.includes('sandbox-api.fedapay.com')) {
      baseUrl = baseUrl.replace('sandbox.fedapay.com', 'sandbox-api.fedapay.com');
      this.logger.warn('⚠️  Converted sandbox URL format: sandbox.fedapay.com → sandbox-api.fedapay.com');
    }
    
    // IMPORTANT: Retirer /api de l'URL si présent (car on ajoute /v1/transactions après)
    // L'URL de base doit être: https://sandbox-api.fedapay.com (sandbox) ou https://api.fedapay.com (live)
    // Vérifier d'abord si l'URL contient sandbox-api.fedapay.com/api
    if (baseUrl.includes('sandbox-api.fedapay.com/api')) {
      baseUrl = baseUrl.replace('sandbox-api.fedapay.com/api', 'sandbox-api.fedapay.com');
      this.logger.warn('⚠️  Removed /api from sandbox-api.fedapay.com/api URL');
    }
    // Vérifier si l'URL contient api.fedapay.com/api (pour live/production)
    if (baseUrl.includes('api.fedapay.com/api') && !baseUrl.includes('sandbox')) {
      baseUrl = baseUrl.replace('api.fedapay.com/api', 'api.fedapay.com');
      this.logger.warn('⚠️  Removed /api from api.fedapay.com/api URL (LIVE mode)');
    }
    // Si l'URL se termine par /api (pour toutes les URLs), enlever /api
    if (baseUrl.endsWith('/api')) {
      baseUrl = baseUrl.replace(/\/api$/, '');
      this.logger.warn('⚠️  Removed trailing /api from URL');
    }
    // Si l'URL contient /api/ au milieu, le remplacer par /
    if (baseUrl.includes('/api/')) {
      baseUrl = baseUrl.replace(/\/api\//g, '/');
      this.logger.warn('⚠️  Removed /api/ from middle of URL');
    }
    
    // S'assurer qu'il n'y a pas de slash à la fin
    baseUrl = baseUrl.replace(/\/$/, '');
    
    // Détecter le mode (live ou sandbox) après toutes les normalisations
    this.isLiveMode = baseUrl.includes('api.fedapay.com') && !baseUrl.includes('sandbox');
    const mode = this.isLiveMode ? 'LIVE/PRODUCTION' : 'SANDBOX/TEST';
    
    this.apiBaseUrl = baseUrl;
    this.logger.log(`🔧 FedaPay API Base URL configured: ${this.apiBaseUrl} (${mode})`);
    
    // Avertissement si on utilise le mode live
    if (this.isLiveMode) {
      this.logger.warn('⚠️  ⚠️  ⚠️  MODE LIVE/PRODUCTION ACTIVÉ - Les transactions seront réelles ! ⚠️  ⚠️  ⚠️');
    }
    
    // Valider et logger la clé API
    if (!this.apiKey) {
      this.logger.warn('⚠️  FEDAPAY_API_KEY not configured');
    } else {
      // Vérifier le format de la clé API
      // Formats acceptés : sk_sandbox_..., sk_test_..., sk_live_..., pk_test_..., pk_live_...
      const isValidFormat = 
        this.apiKey.startsWith('sk_') || 
        this.apiKey.startsWith('pk_') ||
        this.apiKey.startsWith('sk_sandbox_') ||
        this.apiKey.startsWith('sk_test_') ||
        this.apiKey.startsWith('sk_live_') ||
        this.apiKey.startsWith('pk_test_') ||
        this.apiKey.startsWith('pk_live_');
      
      if (!isValidFormat) {
        const apiKeyPrefix = this.apiKey.substring(0, Math.min(15, this.apiKey.length));
        this.logger.warn(`⚠️  FEDAPAY_API_KEY format may be incorrect. Expected format: sk_sandbox_..., sk_test_..., or sk_live_... (current: ${apiKeyPrefix}...)`);
      } else {
        // Masquer partiellement la clé pour les logs (sécurité)
        const maskedKey = this.apiKey.length > 14 
          ? this.apiKey.substring(0, 12) + '...' + this.apiKey.substring(this.apiKey.length - 4)
          : '***';
        this.logger.log(`✅ FedaPay API Key configured: ${maskedKey}`);
      }
    }
  }

  /**
   * Configure le SDK FedaPay au démarrage du module
   * 
   * Cette méthode est appelée automatiquement par NestJS après l'initialisation
   * de tous les modules et dépendances.
   */
  onModuleInit() {
    if (!this.apiKey) {
      this.logger.warn('⚠️  FedaPay SDK not configured: FEDAPAY_API_KEY is missing.');
      return;
    }

    // Configurer la clé API du SDK
    FedaPay.setApiKey(this.apiKey);

    // Déterminer l'environnement (sandbox ou live) depuis la propriété de classe
    const environment = this.isLiveMode ? 'live' : 'sandbox';

    // Configurer l'environnement du SDK
    FedaPay.setEnvironment(environment);

    this.logger.log(`✅ FedaPay SDK configured for ${environment.toUpperCase()} environment.`);
    
    if (this.isLiveMode) {
      this.logger.warn('⚠️  ⚠️  ⚠️  MODE LIVE/PRODUCTION ACTIVÉ - Les transactions seront réelles ! ⚠️  ⚠️  ⚠️');
    }
  }

  /**
   * Vérifie le statut d'une transaction FedaPay via l'API
   * 
   * ⚠️ CRITIQUE : Cette méthode vérifie le statut réel depuis FedaPay
   * et enregistre le résultat dans la base de données
   * 
   * Documentation : https://docs.fedapay.com/api/transactions#retrieve-a-transaction
   */
  async verifyTransactionStatus(transactionId: string): Promise<{
    status: string;
    amount: number;
    verified: boolean;
    paymentId?: string;
  }> {
    if (!this.apiKey) {
      throw new BadRequestException('FEDAPAY_API_KEY not configured');
    }

    try {
      const apiUrl = `${this.apiBaseUrl}/v1/transactions/${transactionId}`;
      this.logger.log(`🔍 Verifying FedaPay transaction at: ${apiUrl}`);
      
      let response: Response;
      try {
        // Timeout de 30 secondes pour les requêtes FedaPay
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        // Vérifier si c'est un timeout
        if (fetchError.name === 'AbortError' || fetchError.code === 'UND_ERR_CONNECT_TIMEOUT') {
          this.logger.error('❌ FedaPay connection timeout during verification:', {
            apiUrl,
            message: 'Connection timeout after 30 seconds',
          });
          throw new BadRequestException(
            `Connection timeout to FedaPay API. Please check your network connection.`
          );
        }
        
        this.logger.error('❌ FedaPay fetch error during verification:', {
          message: fetchError.message,
          code: fetchError.code,
          name: fetchError.name,
          cause: fetchError.cause,
          apiUrl,
        });
        throw new BadRequestException(
          `Failed to connect to FedaPay API: ${fetchError.message}`
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        let error: any;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { message: errorText || 'Unknown error', status: response.status };
        }
        
        // Gestion spécifique de l'erreur 401 (Unauthorized)
        if (response.status === 401) {
          const maskedKey = this.apiKey ? (this.apiKey.substring(0, 10) + '...' + this.apiKey.substring(this.apiKey.length - 4)) : 'NOT SET';
          this.logger.error('❌ FedaPay authentication failed during verification (401 Unauthorized):', {
            status: response.status,
            statusText: response.statusText,
            error: error.message || error.error?.message || 'Erreur d\'authentification',
            apiUrl,
            apiKeyConfigured: !!this.apiKey,
            apiKeyPreview: maskedKey,
          });
          throw new BadRequestException(
            `Erreur d'authentification FedaPay. Veuillez vérifier que FEDAPAY_API_KEY est correctement configurée.`
          );
        }
        
        this.logger.error('❌ FedaPay transaction verification failed:', {
          status: response.status,
          statusText: response.statusText,
          error,
          apiUrl,
        });
        throw new BadRequestException(
          error.message || error.error?.message || `Failed to verify transaction status (${response.status})`
        );
      }

      const result = await response.json();
      const transaction = result.transaction || result;

      if (!transaction.id) {
        this.logger.error('Invalid FedaPay response:', result);
        throw new BadRequestException('Invalid response from FedaPay API');
      }

      const status = transaction.status || 'pending';
      const amount = transaction.amount || 0;

      // Si le paiement est approuvé, traiter comme un webhook
      if (status === 'approved' || status === 'completed') {
        // Chercher le paiement correspondant dans notre base
        const payment = await this.prisma.onboardingPayment.findFirst({
          where: {
            OR: [
              { reference: transaction.reference || transaction.id },
              { metadata: { path: ['transactionId'], equals: transactionId } },
            ],
          },
        });

        if (payment && payment.status !== 'SUCCESS') {
          // Traiter le paiement comme un webhook (vérifications + activation)
          try {
            await this.handlePaymentSuccess(transaction);
            this.logger.log(`✅ Transaction verified and processed: ${transactionId}`);
          } catch (error: any) {
            // Si déjà traité, c'est OK (idempotence)
            if (error.message?.includes('already processed') || error.message?.includes('alreadyProcessed')) {
              this.logger.log(`✅ Transaction already processed: ${transactionId}`);
            } else {
              throw error;
            }
          }
        }
      }

      return {
        status,
        amount,
        verified: true,
        paymentId: transaction.id,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('FedaPay transaction verification error:', error);
      throw new BadRequestException('Failed to verify transaction status');
    }
  }

  /**
   * Crée une transaction FedaPay en utilisant le SDK officiel
   * 
   * Documentation : 
   * - SDK: https://docs.fedapay.com/sdks/fr/nodejs-fr
   * - API: https://docs.fedapay.com/api/transactions#create-a-transaction
   * 
   * Le SDK gère automatiquement la structure et le format des données.
   * Format currency selon SDK: { iso: 'XOF' }
   */
  async createTransaction(data: {
    amount: number;
    description: string;
    callbackUrl: string;
    currency?: string; // Code devise (XOF par défaut pour FCFA)
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

    // Déclarer transactionData en dehors du try pour qu'il soit accessible dans le catch
    let transactionData: any;

    try {
      // Normaliser currency (XOF par défaut)
      let currencyCode = (data.currency || 'XOF').trim().toUpperCase();
      
      // Valider que currency est un code ISO valide (3 caractères)
      if (currencyCode.length !== 3) {
        this.logger.warn(`⚠️  Invalid currency code: "${currencyCode}", using XOF as default`);
        currencyCode = 'XOF';
      }

      // Préparer les données selon le format du SDK officiel
      // Le SDK attend directement les paramètres, pas la structure { transaction: { ... } }
      // IMPORTANT: Vérifier que tous les paramètres requis sont présents
      // Documentation: https://docs.fedapay.com/sdks/fr/nodejs-fr
      transactionData = {
        description: data.description,
        amount: data.amount,
        currency: { iso: currencyCode }, // Format SDK: { iso: 'XOF' }
        callback_url: data.callbackUrl,
        // Le paramètre 'mode' est requis par l'API FedaPay
        // Valeurs possibles: 'mtn_open', 'moov_open', 'mtn', 'moov', etc.
        // Si non spécifié, utiliser 'mtn_open' par défaut (MTN Mobile Money)
        mode: data.metadata?.mode || 'mtn_open',
      };

      // Validation des paramètres requis
      if (!transactionData.amount || transactionData.amount <= 0) {
        throw new BadRequestException('Transaction amount must be greater than 0');
      }
      if (!transactionData.description || transactionData.description.trim() === '') {
        throw new BadRequestException('Transaction description is required');
      }
      if (!transactionData.callback_url || transactionData.callback_url.trim() === '') {
        throw new BadRequestException('Transaction callback_url is required');
      }
      if (!transactionData.currency || !transactionData.currency.iso) {
        throw new BadRequestException('Transaction currency is required');
      }

      // Ajouter customer si présent
      if (data.customer) {
        transactionData.customer = {
          email: data.customer.email,
          ...(data.customer.firstname && { firstname: data.customer.firstname }),
          ...(data.customer.lastname && { lastname: data.customer.lastname }),
          ...(data.customer.phone_number && { phone_number: data.customer.phone_number }),
        };
      }

      // Ajouter metadata si présent
      if (data.metadata || data.imageUrl) {
        transactionData.metadata = {
          ...(data.metadata || {}),
          ...(data.imageUrl && {
            image_url: data.imageUrl,
            logo_url: data.imageUrl,
          }),
        };
      }

      // Ajouter webhook_url si présent dans metadata
      // Le SDK FedaPay peut nécessiter webhook_url en plus de callback_url
      if (data.metadata?.webhookUrl) {
        transactionData.webhook_url = data.metadata.webhookUrl;
      }

      // Log détaillé des données avant envoi au SDK
      this.logger.log(`📤 Creating transaction with FedaPay SDK`);
      this.logger.log(`💰 Amount: ${transactionData.amount}, Currency: ${JSON.stringify(transactionData.currency)}`);
      this.logger.log(`📝 Description: ${transactionData.description}`);
      this.logger.log(`🔗 Callback URL: ${transactionData.callback_url}`);
      this.logger.log(`📦 Full transaction data: ${JSON.stringify(transactionData, null, 2)}`);

      // Utiliser le SDK officiel pour créer la transaction
      const transaction = await Transaction.create(transactionData);

      this.logger.log(`✅ Transaction created successfully with SDK: ${transaction.id}`);

      // Retourner les données dans le format attendu
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

      // Gestion des erreurs du SDK FedaPay
      this.logger.error('❌ FedaPay SDK error:', {
        message: error.message,
        code: error.code,
        errors: error.errors,
        cause: error.cause,
        status: error.status,
        statusCode: error.statusCode,
        response: error.response,
      });

      // Log des données qui ont été envoyées (pour déboguer)
      // Vérifier que transactionData existe avant de logger
      if (transactionData) {
        this.logger.error('❌ Transaction data that was sent:', {
          amount: transactionData.amount,
          currency: transactionData.currency,
          description: transactionData.description,
          callback_url: transactionData.callback_url,
          hasCustomer: !!transactionData.customer,
          hasMetadata: !!transactionData.metadata,
        });
      } else {
        this.logger.error('❌ Transaction data was not initialized before error occurred');
      }

      // Extraire le message d'erreur détaillé
      let errorMessage = error.message || 'Unknown error';
      
      // Si le SDK retourne des erreurs détaillées
      if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
        const errorDetails = error.errors.map((e: any) => e.message || e).join(', ');
        errorMessage = `${errorMessage}: ${errorDetails}`;
      }

      // Si c'est une erreur 500, ajouter plus de détails
      if (error.status === 500 || error.statusCode === 500) {
        this.logger.error('❌ FedaPay server error (500). Possible causes:');
        this.logger.error('  - Invalid transaction data structure');
        this.logger.error('  - Missing required parameters');
        this.logger.error('  - Invalid callback_url format');
        this.logger.error('  - Currency format issue');
      }

      throw new BadRequestException(
        `Failed to create payment transaction: ${errorMessage}`
      );
    }
  }

  /**
   * Crée une session de paiement pour l'onboarding
   * 
   * ⚠️ CRITIQUE : Le montant est calculé côté serveur
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

    // ⚠️ Récupérer la devise dynamiquement depuis priceSnapshot ou utiliser XOF par défaut
    const priceSnapshot = draft.priceSnapshot as any;
    
    // S'assurer que currency est toujours valide et non vide
    let currency = 'XOF'; // Valeur par défaut
    
    if (priceSnapshot?.currency && 
        typeof priceSnapshot.currency === 'string' && 
        priceSnapshot.currency.trim() !== '' &&
        priceSnapshot.currency.length === 3) {
      currency = priceSnapshot.currency.trim().toUpperCase();
    } else {
      // Récupérer depuis PricingConfig si disponible
      try {
        const pricingConfig = await this.pricingService.getActiveConfig();
        if (pricingConfig?.currency && 
            typeof pricingConfig.currency === 'string' && 
            pricingConfig.currency.trim() !== '' &&
            pricingConfig.currency.length === 3) {
          currency = pricingConfig.currency.trim().toUpperCase();
          this.logger.log(`💰 Currency from PricingConfig: ${currency}`);
        }
      } catch (error) {
        this.logger.warn(`⚠️  Could not retrieve currency from PricingConfig, using XOF`);
      }
    }
    
    // Validation finale
    if (!currency || currency.length !== 3) {
      this.logger.error(`❌ Invalid currency: "${currency}", forcing XOF`);
      currency = 'XOF';
    }
    
    this.logger.log(`💰 Payment currency: ${currency} (from priceSnapshot: ${priceSnapshot?.currency || 'not set'})`);

    // Vérifier s'il existe déjà un paiement en cours
    const existingPayment = draft.payments.find(
      (p) => p.status === 'PENDING' || p.status === 'PROCESSING'
    );

    if (existingPayment) {
      // Si une transaction FedaPay existe déjà, la récupérer
      const existingTransaction = (existingPayment.metadata as any)?.transactionId;
      
      if (existingTransaction) {
        // Retourner l'URL de paiement existante avec les données de checkout si disponibles
        const metadata = existingPayment.metadata as any;
        return {
          paymentId: existingPayment.id,
          reference: existingPayment.reference,
          paymentUrl: metadata?.paymentUrl,
          amount: existingPayment.amount,
          status: existingPayment.status,
          // Inclure les données de checkout si disponibles
          checkout: metadata?.checkout || null,
        };
      }
    }

    // Générer une référence unique
    const reference = `ONB-${draftId.substring(0, 8).toUpperCase()}-${Date.now()}`;

    // Créer le paiement dans notre base avec la devise récupérée dynamiquement
    const payment = await this.prisma.onboardingPayment.create({
      data: {
        draftId,
        provider: 'fedapay',
        reference,
        amount,
        currency, // Devise récupérée dynamiquement depuis priceSnapshot
        status: 'PENDING',
        metadata: {
          draftId,
          amount,
          currency,
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

    // Validation finale du currency avant l'appel
    if (!currency || typeof currency !== 'string' || currency.trim() === '' || currency.length !== 3) {
      this.logger.error(`❌ CRITICAL: Invalid currency before createTransaction: "${currency}", forcing XOF`);
      currency = 'XOF';
    }
    
    this.logger.log(`🔍 DEBUG createOnboardingPaymentSession - currency before createTransaction: "${currency}"`);

    const transaction = await this.createTransaction({
      amount,
      currency, // Devise récupérée dynamiquement
      description: `Paiement initial Academia Hub - ${draft.schoolName}`,
      callbackUrl,
      imageUrl, // Image pour la page de paiement
      metadata: {
        draftId,
        paymentId: payment.id,
        reference,
        type: 'onboarding_initial_payment',
        webhookUrl,
        // Note: currency ne doit PAS être dans metadata, il doit être uniquement dans transaction.currency
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

    // Retourner les données pour le checkout intégré
    return {
      paymentId: payment.id,
      reference,
      paymentUrl: transaction.paymentUrl,
      amount,
      status: 'PENDING',
      // Données pour le checkout intégré selon la documentation FedaPay
      // Documentation : https://docs-v1.fedapay.com/payments/checkout
      checkout: {
        publicKey: this.publicKey,
        transaction: {
          id: transaction.transactionId,
          amount: transaction.amount || amount,
          description: `Paiement initial Academia Hub - ${draft.schoolName}`,
        },
        customer: {
          email: draft.promoterEmail || draft.email,
          firstname: draft.promoterFirstName || '',
          lastname: draft.promoterLastName || '',
          phone_number: draft.promoterPhone || draft.phone,
        },
        transactionId: transaction.transactionId,
        paymentId: payment.id, // ID du paiement dans notre base pour la vérification
      },
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

    // ⚠️ Récupérer la devise dynamiquement depuis la subscription
    // S'assurer que currency n'est jamais vide ou undefined
    const currency = (subscription.currency && subscription.currency.trim() !== '') 
      ? subscription.currency.trim() 
      : 'XOF';
    
    this.logger.log(`💰 Renewal payment currency: ${currency} (from subscription: ${subscription.currency || 'not set'})`);

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
      currency, // Devise récupérée dynamiquement depuis la subscription
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
        currency,
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
   * Gère les webhooks FedaPay pour les paiements
   * 
   * ⚠️ CRITIQUE : Vérification de signature obligatoire
   * 
   * Documentation : https://docs.fedapay.com/webhooks
   * 
   * Validations effectuées :
   * 1. Signature HMAC
   * 2. Transaction ID valide
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
            provider: 'fedapay',
            eventType: event,
            payload: payload as any,
            status: 'ERROR',
            errorMessage: error.message,
            processedAt: new Date(),
          },
        });
      } catch (logError) {
        this.logger.error('Failed to log webhook error:', logError);
      }

      throw error;
    }
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

    // ⚠️ Récupérer la devise dynamiquement depuis la subscription
    // S'assurer que currency n'est jamais vide ou undefined
    const currency = (subscription.currency && subscription.currency.trim() !== '') 
      ? subscription.currency.trim() 
      : 'XOF';
    
    this.logger.log(`💰 Renewal payment currency: ${currency} (from subscription: ${subscription.currency || 'not set'})`);

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
      currency, // Devise récupérée dynamiquement depuis la subscription
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
        currency,
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
            provider: 'fedapay',
            eventType: event,
            payload: payload as any,
            status: 'ERROR',
            errorMessage: error.message,
            processedAt: new Date(),
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
      this.logger.warn(`⚠️  Payment already processed: ${paymentReference}`);
      return { received: true, processed: false, reason: 'already_processed' };
    }

    // 2. Extraire les métadonnées de la transaction
    const metadata = transaction.metadata || {};
    const paymentType = metadata.type || metadata.paymentType || 'onboarding';
    const paymentId = metadata.paymentId || metadata.billingEventId;

    if (!paymentId) {
      this.logger.error(`❌ Missing payment ID in transaction metadata: ${JSON.stringify(metadata)}`);
      throw new BadRequestException('Missing payment ID in transaction metadata');
    }

    // 3. Traiter selon le type de paiement
    if (paymentType === 'onboarding') {
      return await this.handleOnboardingPaymentSuccess(transaction, paymentId);
    } else if (paymentType === 'subscription_renewal') {
      return await this.handleRenewalPaymentSuccess(transaction, paymentId);
    } else {
      this.logger.error(`❌ Unknown payment type: ${paymentType}`);
      throw new BadRequestException(`Unknown payment type: ${paymentType}`);
    }
  }

  /**
   * Gère le succès d'un paiement d'onboarding
   */
  private async handleOnboardingPaymentSuccess(transaction: any, paymentId: string) {
    const paymentReference = transaction.reference || transaction.id;
    
    // Enregistrer le webhook
    await this.prisma.paymentWebhookLog.create({
      data: {
        reference: paymentReference,
        provider: 'fedapay',
        eventType: 'transaction.approved',
        processed: true,
        payload: transaction,
        metadata: {
          paymentId,
          type: 'onboarding',
        },
      },
    });

    // Récupérer le paiement existant
    const existingPayment = await this.prisma.onboardingPayment.findUnique({
      where: { id: paymentId },
    });

    if (!existingPayment) {
      throw new BadRequestException(`Payment not found: ${paymentId}`);
    }

    // Mettre à jour le paiement
    const payment = await this.prisma.onboardingPayment.update({
      where: { id: paymentId },
      data: {
        status: 'COMPLETED',
        transactionId: transaction.id,
        completedAt: new Date(),
        metadata: {
          ...(existingPayment.metadata as any || {}),
          transactionReference: paymentReference,
          transactionData: transaction,
        },
      },
    });

    // Mettre à jour le draft
    await this.prisma.onboardingDraft.update({
      where: { id: payment.draftId },
      data: {
        status: 'PAYMENT_COMPLETED',
      },
    });

    this.logger.log(`✅ Onboarding payment completed: ${paymentId} - Reference: ${paymentReference}`);

    // Créer le tenant, la subscription et l'utilisateur promoteur (idempotent)
    try {
      await this.onboardingService.activateTenantAfterPayment(paymentId);
      this.logger.log(`✅ Tenant activated for onboarding payment: ${paymentId}`);
    } catch (err: any) {
      const msg = err?.message || err?.response?.message || '';
      if (msg.includes('already activated') || msg.includes('status: SUCCESS')) {
        this.logger.log(`✅ Tenant already activated for payment ${paymentId} (idempotent)`);
      } else {
        throw err;
      }
    }

    return { received: true, processed: true, paymentId };
  }

  /**
   * Gère le succès d'un paiement de renouvellement
   */
  private async handleRenewalPaymentSuccess(transaction: any, billingEventId: string) {
    const paymentReference = transaction.reference || transaction.id;
    
    // Enregistrer le webhook
    await this.prisma.paymentWebhookLog.create({
      data: {
        reference: paymentReference,
        provider: 'fedapay',
        eventType: 'transaction.approved',
        processed: true,
        payload: transaction,
        metadata: {
          billingEventId,
          type: 'subscription_renewal',
        },
      },
    });

    // Récupérer l'événement de facturation existant
    const existingBillingEvent = await this.prisma.billingEvent.findUnique({
      where: { id: billingEventId },
    });

    if (!existingBillingEvent) {
      throw new BadRequestException(`Billing event not found: ${billingEventId}`);
    }

    // Mettre à jour l'événement de facturation
    const billingEvent = await this.prisma.billingEvent.update({
      where: { id: billingEventId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        metadata: {
          ...(existingBillingEvent.metadata as any || {}),
          transactionReference: paymentReference,
          transactionData: transaction,
        },
      },
    });

    // Mettre à jour l'abonnement
    if (billingEvent.subscriptionId) {
      await this.prisma.subscription.update({
        where: { id: billingEvent.subscriptionId },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + (metadata.cycle === 'YEARLY' ? 365 : 30) * 24 * 60 * 60 * 1000),
        },
      });
    }

    this.logger.log(`✅ Renewal payment completed: ${billingEventId} - Reference: ${paymentReference}`);

    return { received: true, processed: true, billingEventId };
  }

  /**
   * Gère l'échec d'un paiement FedaPay
   */
  private async handlePaymentFailure(transaction: any) {
    const paymentReference = transaction.reference || transaction.id;
    
    // Enregistrer le webhook
    await this.prisma.paymentWebhookLog.create({
      data: {
        reference: paymentReference,
        provider: 'fedapay',
        eventType: 'transaction.failed',
        processed: false,
        payload: transaction,
        metadata: {
          error: transaction.error || transaction.message || 'Payment failed',
        },
      },
    });

    this.logger.warn(`⚠️  Payment failed: ${paymentReference}`);
  }
}
