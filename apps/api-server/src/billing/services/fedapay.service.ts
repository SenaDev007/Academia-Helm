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
import { EmailService } from '../../communication/services/email.service';
import { emailTemplates, type PaymentTransactionalEmailConfig } from '../email-templates';
import { BillingService } from '../billing.service';
import { FedaPay, Transaction, Webhook } from 'fedapay';

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' ||
      parsed.hostname === 'localhost' ||
      parsed.hostname.includes('ngrok') ||
      parsed.hostname.includes('localtunnel')
    );
  } catch {
    return false;
  }
}

@Injectable()
export class FedaPayService implements OnModuleInit {
  private readonly logger = new Logger(FedaPayService.name);
  private readonly apiKey: string;
  private readonly publicKey: string;
  private apiBaseUrl: string;
  private isLiveMode: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => BillingService))
    private readonly billingService: BillingService,
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

    const fedapayEnvExplicit = (this.configService.get<string>('FEDAPAY_ENVIRONMENT') || '').trim().toLowerCase();
    if (fedapayEnvExplicit === 'sandbox') {
      baseUrl = 'https://sandbox-api.fedapay.com';
    } else if (fedapayEnvExplicit === 'live') {
      baseUrl = 'https://api.fedapay.com';
    }
    
    // Détecter le mode sandbox : FEDAPAY_SANDBOX=true, ou URL "sandbox", ou clé sk_sandbox_/sk_test_/pk_test_
    const envSandbox = this.configService.get<string>('FEDAPAY_SANDBOX') === 'true';
    const urlIsSandbox = baseUrl.includes('sandbox');
    const keyIsSandbox = this.apiKey.startsWith('sk_sandbox_') || this.apiKey.startsWith('sk_test_') || this.apiKey.startsWith('pk_test_');
    if (fedapayEnvExplicit === 'sandbox') {
      this.isLiveMode = false;
    } else if (fedapayEnvExplicit === 'live') {
      this.isLiveMode = true;
    } else {
      this.isLiveMode = !envSandbox && !urlIsSandbox && !keyIsSandbox;
    }
    if (envSandbox) {
      baseUrl = 'https://sandbox-api.fedapay.com';
      this.logger.warn('⚠️  FEDAPAY_SANDBOX=true : mode sandbox forcé, montant plafonné à 20 000 XOF');
    } else if (keyIsSandbox && !urlIsSandbox) {
      baseUrl = 'https://sandbox-api.fedapay.com';
      this.logger.warn('⚠️  Clé sandbox détectée : utilisation de sandbox-api.fedapay.com');
    }
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

    // Configurer la clé API du SDK (clé uniquement via variables d’environnement, jamais en dur)
    FedaPay.setApiKey(this.apiKey);

    const explicit = (this.configService.get<string>('FEDAPAY_ENVIRONMENT') || '').trim().toLowerCase();
    const environment: 'live' | 'sandbox' =
      explicit === 'sandbox'
        ? 'sandbox'
        : explicit === 'live'
          ? 'live'
          : process.env.NODE_ENV === 'production'
            ? 'live'
            : 'sandbox';

    FedaPay.setEnvironment(environment);

    // Aligner fetch direct et logique montants avec le SDK (tests sandbox sur hôte prod : FEDAPAY_ENVIRONMENT=sandbox)
    this.isLiveMode = environment === 'live';
    this.apiBaseUrl = this.isLiveMode ? 'https://api.fedapay.com' : 'https://sandbox-api.fedapay.com';

    this.logger.log(`✅ FedaPay SDK configured for ${environment.toUpperCase()} environment.`);

    if (explicit === 'sandbox' && process.env.NODE_ENV === 'production') {
      this.logger.log('🧪 FEDAPAY_ENVIRONMENT=sandbox sur hôte production : paiements de test FedaPay (non live).');
    }
    
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
            await this.billingService.handlePaymentSuccess(transaction);
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
   * Normalise le pays vers le code ISO 3166-1 alpha-2 attendu par FedaPay (ex: Bénin -> BJ).
   * Référence: https://docs.fedapay.com/api-reference/transactions/create (customer.phone_number.country)
   */
  private normalizeCountryForFedaPay(country: string | undefined): string {
    if (!country || typeof country !== 'string') return 'BJ';
    const s = country.trim().toUpperCase();
    if (s.length === 2) return s;
    const map: Record<string, string> = {
      'BENIN': 'BJ', 'BÉNIN': 'BJ',
      'TOGO': 'TG', 'NIGER': 'NE', 'BURKINA': 'BF', 'BURKINA FASO': 'BF',
      'SENEGAL': 'SN', 'MALI': 'ML', 'NIGERIA': 'NG', 'GHANA': 'GH',
    };
    return map[s] || s.substring(0, 2);
  }

  /**
   * Convertit un numéro (string) au format FedaPay: { number, country }.
   * API: phone_number doit être un objet avec number (sans préfixe international) et country (code ISO).
   * https://docs.fedapay.com/api-reference/transactions/create
   */
  private normalizePhoneForFedaPay(phone: string | undefined, countryCode: string): { number: string; country: string } | null {
    if (!phone || typeof phone !== 'string') return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) return null;
    const code = countryCode.toUpperCase();
    const prefixes: Record<string, string> = { BJ: '229', TG: '228', NE: '227', BF: '226', SN: '221', ML: '223', NG: '234', GH: '233' };
    let num = digits;
    const prefix = prefixes[code];
    if (prefix && num.startsWith(prefix)) num = num.slice(prefix.length);
    if (num.startsWith('0')) num = num.slice(1);
    if (num.length < 8) return null;
    return { number: num, country: code };
  }

  /**
   * Base publique de l’API pour les webhooks FedaPay (joignable depuis Internet).
   * Ordre : FEDAPAY_WEBHOOK_BASE_URL → PUBLIC_API_URL → API_URL.
   * Ex. prod : https://api.academiahelm.com → https://api.academiahelm.com/api/billing/fedapay/webhook
   */
  private getFedaPayWebhookApiBaseUrl(): string {
    return (
      this.configService.get<string>('FEDAPAY_WEBHOOK_BASE_URL') ||
      this.configService.get<string>('PUBLIC_API_URL') ||
      this.configService.get<string>('API_URL') ||
      ''
    )
      .trim()
      .replace(/\/$/, '');
  }

  /** URL complète du webhook (identique à celle déclarée dans le dashboard FedaPay). */
  private buildFedaPayWebhookUrl(): string {
    return `${this.getFedaPayWebhookApiBaseUrl()}/api/billing/fedapay/webhook`;
  }

  /**
   * Crée une transaction FedaPay en utilisant le SDK officiel.
   * 
   * Important : la transaction est toujours créée même si les infos client sont incomplètes
   * (ex. pas de téléphone ou numéro invalide). Le formulaire FedaPay s'ouvre et l'utilisateur
   * peut remplir ou modifier les informations (ex. utiliser un autre numéro Mobile Money).
   * Référence : https://github.com/fedapay-samples/sample-node
   * 
   * SDK: https://docs.fedapay.com/sdks/fr/nodejs-fr
   * API: https://docs.fedapay.com/api/transactions#create-a-transaction
   */
  async createTransaction(data: {
    amount: number;
    description: string;
    callbackUrl: string;
    cancelUrl?: string;
    currency?: string;
    metadata?: Record<string, any>;
    customer?: {
      email: string;
      firstname?: string;
      lastname?: string;
      phone_number?: string;
      /** Code pays ISO (ex: BJ) ou nom (ex: Bénin) pour formater phone_number pour FedaPay */
      countryCode?: string;
      countryName?: string;
    };
    imageUrl?: string;
  }) {
    if (!this.apiKey) {
      throw new BadRequestException('FEDAPAY_API_KEY not configured');
    }

    // Déclarer transactionData en dehors du try pour qu'il soit accessible dans le catch
    let transactionData: any;

    try {
      // Normaliser currency (XOF par défaut) — accepter string ou number depuis la DB
      let currencyCode = String(data.currency || 'XOF').trim().toUpperCase();
      if (currencyCode.length !== 3) {
        this.logger.warn(`⚠️  Invalid currency code: "${currencyCode}", using XOF as default`);
        currencyCode = 'XOF';
      }

      // Préparer les données selon le format du SDK officiel
      // Le SDK attend directement les paramètres, pas la structure { transaction: { ... } }
      // IMPORTANT: Vérifier que tous les paramètres requis sont présents
      // Documentation: https://docs.fedapay.com/sdks/fr/nodejs-fr
      // FedaPay API attend amount en entier. En sandbox, plafond 20 000 XOF (limite FedaPay).
      const SANDBOX_MAX_AMOUNT = 20000;
      let amountInteger = Math.round(Number(data.amount));
      const isSandbox = !this.isLiveMode;
      if (isSandbox && amountInteger > SANDBOX_MAX_AMOUNT) {
        this.logger.warn(`⚠️  Sandbox FedaPay : montant plafonné à ${SANDBOX_MAX_AMOUNT} XOF (demandé: ${amountInteger})`);
        amountInteger = SANDBOX_MAX_AMOUNT;
      }
      transactionData = {
        description: data.description,
        amount: amountInteger,
        currency: { iso: currencyCode }, // Format SDK: { iso: 'XOF' }
        callback_url: data.callbackUrl,
        ...(data.cancelUrl?.trim() && { cancel_url: data.cancelUrl.trim() }),
        // En sandbox FedaPay le mode unifié est 'momo_test' (numéros 64000001/66000001 pour succès).
        // En production utiliser 'mtn_open', 'moov_open', etc.
        mode: data.metadata?.mode || (this.isLiveMode ? 'mtn_open' : 'momo_test'),
      };

      // Validation des paramètres requis
      if (!Number.isFinite(transactionData.amount) || transactionData.amount <= 0) {
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

      // Ajouter customer si présent (format FedaPay: phone_number = { number, country })
      if (data.customer?.email) {
        const countryCode = data.customer.countryCode
          ? this.normalizeCountryForFedaPay(data.customer.countryCode)
          : this.normalizeCountryForFedaPay(data.customer.countryName);
        const phoneObj = data.customer.phone_number
          ? this.normalizePhoneForFedaPay(data.customer.phone_number, countryCode)
          : null;
        transactionData.customer = {
          email: String(data.customer.email).trim(),
          ...(data.customer.firstname && { firstname: String(data.customer.firstname).trim() }),
          ...(data.customer.lastname && { lastname: String(data.customer.lastname).trim() }),
          ...(phoneObj && { phone_number: phoneObj }),
        };
      }

      // Ajouter metadata si présent (+ custom_metadata pour les webhooks FedaPay qui renvoient ce champ)
      if (data.metadata || data.imageUrl) {
        const meta = {
          ...(data.metadata || {}),
          ...(data.imageUrl && {
            image_url: data.imageUrl,
            logo_url: data.imageUrl,
          }),
        };
        transactionData.metadata = meta;
        // Répercuter dans custom_metadata tout ce qui doit réapparaître dans les webhooks FedaPay
        const cm: Record<string, unknown> = {};
        const webhookKeys = [
          'draftId',
          'paymentId',
          'type',
          'billingEventId',
          'reference',
          'etablissementNom',
          'plan',
          'promoteurEmail',
        ] as const;
        for (const k of webhookKeys) {
          const v = (meta as Record<string, unknown>)[k];
          if (v !== undefined && v !== null && v !== '') {
            cm[k] = v;
          }
        }
        if (Object.keys(cm).length > 0) {
          transactionData.custom_metadata = cm;
        }
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
      const responseData = error.response?.data ?? error.data;
      this.logger.error('❌ FedaPay SDK error:', {
        message: error.message,
        code: error.code,
        errors: error.errors,
        cause: error.cause,
        status: error.status ?? error.statusCode,
        statusCode: error.statusCode ?? error.status,
        responseBody: responseData,
      });
      if (responseData && typeof responseData === 'object') {
        this.logger.error('❌ FedaPay API response body: ' + JSON.stringify(responseData, null, 2));
      }

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
      
      if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
        const errorDetails = error.errors.map((e: any) => e.message || e).join(', ');
        errorMessage = `${errorMessage}: ${errorDetails}`;
      }

      // Erreur 400 "montant maximum 20000" = sandbox FedaPay
      const amountErr = error.errors?.amount?.[0] ?? '';
      if ((error.status === 400 || error.statusCode === 400) && typeof amountErr === 'string' && amountErr.includes('20000')) {
        errorMessage += ' En sandbox FedaPay le montant max est 20 000 XOF. Ajoutez FEDAPAY_SANDBOX=true dans .env (api-server) et redémarrez l\'API.';
      }

      // Si c'est une erreur 500, ajouter plus de détails
      if (error.status === 500 || error.statusCode === 500) {
        this.logger.error('❌ FedaPay server error (500). Possible causes:');
        this.logger.error('  - callback_url : FedaPay peut refuser localhost. En dev, essayer FRONTEND_URL=https://votre-tunnel.ngrok.io');
        this.logger.error('  - Invalid transaction data structure or missing required parameters');
        this.logger.error('  - Clé API sandbox invalide ou compte FedaPay (vérifier FEDAPAY_API_URL et FEDAPAY_API_KEY)');
        if (responseData) {
          this.logger.error('  - Voir responseBody ci-dessus pour le détail renvoyé par FedaPay');
        }
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

    // Montant depuis PricingService. En sandbox FedaPay, plafonner à 20 000 XOF (limite API test).
    const amountFromPricing = await this.pricingService.calculateInitialPaymentPrice(draft.schoolsCount || 1);
    const SANDBOX_MAX = 20000;
    const amount = this.isLiveMode ? amountFromPricing : Math.min(amountFromPricing, SANDBOX_MAX);
    if (!this.isLiveMode && amountFromPricing > SANDBOX_MAX) {
      this.logger.log(`🧪 Sandbox : montant onboarding ${amountFromPricing} → ${amount} XOF pour le test`);
    }

    // Récupérer la devise dynamiquement depuis priceSnapshot ou utiliser XOF par défaut
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

    // Mode API : Créer la transaction FedaPay (toujours, même si infos promoteur incomplètes).
    // Le formulaire FedaPay s'ouvrira et l'utilisateur pourra remplir/modifier (ex. autre numéro).
    const frontendUrl = (this.configService.get<string>('FRONTEND_URL') || '').trim().replace(/\/$/, '');
    const apiUrl = (this.configService.get<string>('API_URL') || '').trim().replace(/\/$/, '');

    if (!frontendUrl || !apiUrl || !isValidUrl(frontendUrl) || !isValidUrl(apiUrl)) {
      throw new BadRequestException('FRONTEND_URL et API_URL doivent être configurés');
    }

    const callbackUrl = `${frontendUrl}/signup/confirmation?draftId=${encodeURIComponent(draftId)}&paymentId=${encodeURIComponent(payment.id)}`;
    const cancelUrl = `${frontendUrl}/signup/annulation?draftId=${encodeURIComponent(draftId)}`;
    const webhookUrl = this.buildFedaPayWebhookUrl();

    const imageUrl = `${frontendUrl}/images/Souscription%20initiale.jpg`;

    // Validation finale du currency avant l'appel
    if (!currency || typeof currency !== 'string' || currency.trim() === '' || currency.length !== 3) {
      this.logger.error(`❌ CRITICAL: Invalid currency before createTransaction: "${currency}", forcing XOF`);
      currency = 'XOF';
    }
    
    this.logger.log(`🔍 DEBUG createOnboardingPaymentSession - currency before createTransaction: "${currency}"`);

    // Préparer le contexte Helm à partir du priceSnapshot (plan/code + période)
    const helmPlanFromSnapshot =
      typeof priceSnapshot?.planCode === 'string'
        ? String(priceSnapshot.planCode).toUpperCase()
        : undefined;
    const helmBillingCycleFromSnapshot =
      typeof priceSnapshot?.periodType === 'string' &&
      String(priceSnapshot.periodType).toUpperCase() === 'YEARLY'
        ? 'ANNUAL'
        : 'MONTHLY';

    const transaction = await this.createTransaction({
      amount,
      currency, // Devise récupérée dynamiquement
      description: `Paiement initial Academia Helm - ${draft.schoolName}`,
      callbackUrl,
      cancelUrl,
      imageUrl, // Image pour la page de paiement
      metadata: {
        draftId,
        paymentId: payment.id,
        reference,
        // Type utilisé par handlePaymentSuccess → handleOnboardingPaymentSuccess
        type: 'onboarding',
        // Champs explicites pour les webhooks (metadata + custom_metadata)
        etablissementNom: draft.schoolName,
        plan: helmPlanFromSnapshot || 'HELM',
        promoteurEmail: draft.promoterEmail || draft.email || '',
        webhookUrl,
        // Contexte Helm pour la création de HelmSubscription/HelmInvoice après paiement
        helmPlan: helmPlanFromSnapshot || null,
        helmBillingCycle: helmBillingCycleFromSnapshot,
        helmBilingualAddon: !!draft.bilingual,
        helmSchoolsCount: draft.schoolsCount || 1,
        // Note: currency ne doit PAS être dans metadata, il doit être uniquement dans transaction.currency
      },
      customer: {
        email: draft.promoterEmail || draft.email,
        firstname: draft.promoterFirstName || '',
        lastname: draft.promoterLastName || '',
        phone_number: draft.promoterPhone || draft.phone,
        countryName: draft.country,
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

    const paymentPageUrl = transaction.paymentUrl;
    if (!paymentPageUrl) {
      this.logger.warn('⚠️ FedaPay n\'a pas renvoyé d\'URL de paiement (transaction.paymentUrl)');
    }
    // Retourner les données pour le checkout intégré + URL pleine page (éviter iframe tronquée)
    return {
      paymentId: payment.id,
      reference,
      paymentUrl: paymentPageUrl,
      payment_url: paymentPageUrl,
      amount,
      status: 'PENDING',
      // Données pour le checkout intégré (FedaPay). Même avec infos partielles, le popup
      // s'ouvre et l'utilisateur peut compléter/modifier (ex. autre numéro Mobile Money).
      // Retourner public_key (snake_case) et publicKey pour compatibilité frontend.
      checkout: {
        publicKey: this.publicKey,
        public_key: this.publicKey,
        transaction: {
          id: transaction.transactionId,
          amount: transaction.amount || amount,
          description: `Paiement initial Academia Helm - ${draft.schoolName}`,
        },
        customer: {
          email: draft.promoterEmail || draft.email || '',
          firstname: draft.promoterFirstName || '',
          lastname: draft.promoterLastName || '',
          phone_number: draft.promoterPhone || draft.phone || '',
        },
        transactionId: transaction.transactionId,
        paymentId: payment.id,
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
              where: { role: 'PROMOTER' },
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
    const frontendUrl = (this.configService.get<string>('FRONTEND_URL') || '').trim().replace(/\/$/, '');
    const apiUrl = (this.configService.get<string>('API_URL') || '').trim().replace(/\/$/, '');
    if (!frontendUrl || !apiUrl || !isValidUrl(frontendUrl) || !isValidUrl(apiUrl)) {
      throw new BadRequestException('FRONTEND_URL et API_URL doivent être configurés');
    }
    const callbackUrl = `${frontendUrl}/billing/renewal/callback?subscriptionId=${subscriptionId}&billingEventId=${billingEvent.id}`;
    const webhookUrl = this.buildFedaPayWebhookUrl();

    // URL de l'image pour l'abonnement mensuel
    const imageUrl = `${frontendUrl}/images/Abonnement%20mensuel.jpg`;

    // Récupérer les infos du promoteur pour le customer
    const promoter = subscription.tenant.users[0];
    const schoolSettings = await this.prisma.schoolSettings.findUnique({
      where: { tenantId: subscription.tenantId },
      select: { phone: true },
    });
    const contactPhone = schoolSettings?.phone ?? '';

    const transaction = await this.createTransaction({
      amount,
      currency, // Devise récupérée dynamiquement depuis la subscription
      description: `Renouvellement ${cycle === 'MONTHLY' ? 'mensuel' : 'annuel'} Academia Helm - ${subscription.tenant.name}`,
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
        phone_number: contactPhone,
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
  async handleWebhookLegacy(payload: any, signatureHeader: string, rawBody?: string) {
    // 1. Vérifier la signature (OBLIGATOIRE) – FedaPay signe le body brut exact
    const payloadString = rawBody != null && rawBody.length > 0
      ? rawBody
      : (typeof payload === 'string' ? payload : JSON.stringify(payload));
    const skipVerify = this.configService.get<string>('FEDAPAY_WEBHOOK_SKIP_VERIFY') === 'true' && process.env.NODE_ENV !== 'production';
    let isValid = await this.verifyWebhookSignature(payloadString, signatureHeader);
    if (!isValid && skipVerify) {
      this.logger.warn('⚠️  FedaPay webhook signature verification SKIPPED (FEDAPAY_WEBHOOK_SKIP_VERIFY=true, dev only)');
      isValid = true;
    }
    if (!isValid) {
      this.logger.error('❌ Invalid FedaPay webhook signature. Vérifiez FEDAPAY_WEBHOOK_SECRET (secret du webhook dans le dashboard FedaPay pour cette URL).');
      this.logger.error(`   rawBody length: ${payloadString.length}, header prefix: ${(signatureHeader || '').substring(0, 40)}...`);
      throw new BadRequestException('Invalid webhook signature');
    }

    // 2. Extraire l'événement et la transaction (FedaPay envoie name + entity)
    const event = payload.name || payload.event || payload.type;
    const transaction = payload.entity || payload.data || payload.transaction || payload;

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
          return await this.billingService.handlePaymentSuccess(transaction);

        case 'transaction.declined':
        case 'transaction.failed':
          await this.billingService.handlePaymentFailed(transaction);
          return { received: true, processed: false };

        case 'transaction.canceled':
          await this.billingService.handlePaymentCanceled(transaction);
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
            payload: payload as any,
            processedAt: new Date(),
            metadata: {
              status: 'ERROR',
              errorMessage: error.message,
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
   * Crée une session de paiement pour le renouvellement mensuel/annuel
   * 
   * ⚠️ CRITIQUE : Le montant est calculé côté serveur via PricingService
   * 
   * Documentation FedaPay : https://docs.fedapay.com/api/transactions#create-a-transaction
   */
  async createRenewalPaymentSessionLegacy(subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        subscriptionPlan: true,
        tenant: {
          include: {
            users: {
              where: { role: 'PROMOTER' },
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
    const frontendUrl = (this.configService.get<string>('FRONTEND_URL') || '').trim().replace(/\/$/, '');
    const apiUrl = (this.configService.get<string>('API_URL') || '').trim().replace(/\/$/, '');
    if (!frontendUrl || !apiUrl || !isValidUrl(frontendUrl) || !isValidUrl(apiUrl)) {
      throw new BadRequestException('FRONTEND_URL et API_URL doivent être configurés');
    }
    const callbackUrl = `${frontendUrl}/billing/renewal/callback?subscriptionId=${subscriptionId}&billingEventId=${billingEvent.id}`;
    const webhookUrl = this.buildFedaPayWebhookUrl();

    // URL de l'image pour l'abonnement mensuel
    const imageUrl = `${frontendUrl}/images/Abonnement%20mensuel.jpg`;

    // Récupérer les infos du promoteur pour le customer
    const promoter = subscription.tenant.users[0];
    const schoolSettings = await this.prisma.schoolSettings.findUnique({
      where: { tenantId: subscription.tenantId },
      select: { phone: true },
    });
    const contactPhone = schoolSettings?.phone ?? '';

    const transaction = await this.createTransaction({
      amount,
      currency, // Devise récupérée dynamiquement depuis la subscription
      description: `Renouvellement ${cycle === 'MONTHLY' ? 'mensuel' : 'annuel'} Academia Helm - ${subscription.tenant.name}`,
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
        phone_number: contactPhone,
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
   * Vérifie la signature d'un webhook FedaPay via le SDK officiel.
   * Nécessite le body brut exact (rawBody) pour que la signature corresponde.
   */
  async verifyWebhookSignature(
    rawPayload: string,
    header: string,
  ): Promise<boolean> {
    const webhookSecret = (this.configService.get<string>('FEDAPAY_WEBHOOK_SECRET') || '').trim();
    if (!webhookSecret) {
      this.logger.warn('⚠️  FEDAPAY_WEBHOOK_SECRET is not set');
      return false;
    }
    try {
      Webhook.constructEvent(rawPayload, header, webhookSecret, 600);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Vérifie la signature HMAC FedaPay (body brut + en-tête). Lève si invalide.
   * Le secret est lu via ConfigService (variable FEDAPAY_WEBHOOK_SECRET sur Railway, jamais en dur).
   */
  async assertValidFedaPayWebhookSignature(
    payloadString: string,
    signatureHeader: string | undefined,
  ): Promise<void> {
    if (!signatureHeader || typeof signatureHeader !== 'string') {
      throw new BadRequestException('Missing webhook signature');
    }
    const isProduction = process.env.NODE_ENV === 'production';
    const skipVerify =
      this.configService.get<string>('FEDAPAY_WEBHOOK_SKIP_VERIFY') === 'true' && !isProduction;
    /** Jamais en production : uniquement debug local / staging */
    const skipSignatureDebug =
      this.configService.get<string>('SKIP_WEBHOOK_SIGNATURE') === 'true' && !isProduction;
    let isValid = await this.verifyWebhookSignature(payloadString, signatureHeader);
    if (!isValid && skipVerify) {
      this.logger.warn(
        '⚠️  FedaPay webhook signature verification SKIPPED (FEDAPAY_WEBHOOK_SKIP_VERIFY=true, dev only)',
      );
      isValid = true;
    }
    if (!isValid && skipSignatureDebug) {
      this.logger.warn(
        '⚠️  FedaPay webhook signature SKIPPED (SKIP_WEBHOOK_SIGNATURE=true, NODE_ENV≠production). À désactiver après debug.',
      );
      isValid = true;
    }
    if (!isValid) {
      this.logger.error(
        '❌ Invalid FedaPay webhook signature. Vérifiez FEDAPAY_WEBHOOK_SECRET (secret du webhook dans le dashboard FedaPay pour cette URL).',
      );
      this.logger.error(
        `   rawBody length: ${payloadString.length}, header prefix: ${(signatureHeader || '').substring(0, 40)}...`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  /** Appelé après vérification de signature (ex. depuis BillingService). */
  async processApprovedWebhookEntity(transaction: any) {
    return this.handlePaymentSuccess(transaction);
  }

  /** @deprecated Préférer BillingService.handlePaymentSuccess */
  async handlePaymentSuccessWebhook(transaction: any) {
    return this.billingService.handlePaymentSuccess(transaction);
  }

  async processFailedWebhookEntity(transaction: any) {
    await this.handlePaymentFailure(transaction);
  }

  async processCanceledWebhookEntity(transaction: any) {
    await this.handlePaymentCanceled(transaction);
  }

  /** Échec / refus — équivalent handlePaymentFailure. */
  async handlePaymentFailedWebhook(transaction: any) {
    await this.handlePaymentFailure(transaction);
  }

  /** Annulation côté FedaPay. */
  async handlePaymentCanceledWebhook(transaction: any) {
    await this.handlePaymentCanceled(transaction);
  }

  /**
   * Extrait et valide name/type + entity depuis le JSON webhook FedaPay.
   */
  parseFedaPayWebhookPayload(body: any): {
    event: string;
    transaction: any;
    transactionId: string | undefined;
    transactionReference: string;
  } {
    const event = body.name || body.event || body.type;
    const transaction = body.entity || body.data || body.transaction || body;

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

    return { event, transaction, transactionId, transactionReference };
  }

  /**
   * Traite le corps du webhook une fois la signature validée (transaction.approved | declined | canceled).
   */
  async processVerifiedFedaPayWebhook(payload: any) {
    const { event, transaction, transactionId, transactionReference } =
      this.parseFedaPayWebhookPayload(payload);

    this.logger.log(
      `📥 FedaPay webhook received: ${event} - Transaction ID: ${transactionId} - Reference: ${transactionReference}`,
    );

    try {
      return await this.dispatchFedaPayWebhookByEventType(event, transaction, payload);
    } catch (error: any) {
      this.logger.error(`❌ Error processing webhook: ${error.message}`, error.stack);

      try {
        await this.prisma.paymentWebhookLog.create({
          data: {
            reference: transactionReference,
            provider: 'fedapay',
            eventType: event,
            payload: payload as any,
            processedAt: new Date(),
            metadata: {
              status: 'ERROR',
              errorMessage: error.message,
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
   * Routage des événements FedaPay (utilisé par processVerifiedFedaPayWebhook et par le contrôleur).
   */
  async dispatchFedaPayWebhookByEventType(
    event: string,
    transaction: any,
    _payload?: any,
  ): Promise<any> {
    switch (event) {
      case 'transaction.approved':
      case 'transaction.completed':
        return await this.billingService.handlePaymentSuccess(transaction);

      case 'transaction.declined':
      case 'transaction.failed':
        await this.billingService.handlePaymentFailed(transaction);
        return { received: true, processed: false };

      case 'transaction.canceled':
        await this.billingService.handlePaymentCanceled(transaction);
        return { received: true, processed: false };

      default:
        this.logger.warn(`⚠️  Unhandled FedaPay event: ${event}`);
        return { received: true, processed: false, event };
    }
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
  async handleWebhook(payload: any, signatureHeader: string, rawBody?: string) {
    const payloadString =
      rawBody != null && rawBody.length > 0
        ? rawBody
        : typeof payload === 'string'
          ? payload
          : JSON.stringify(payload);
    await this.assertValidFedaPayWebhookSignature(payloadString, signatureHeader);
    return this.processVerifiedFedaPayWebhook(payload);
  }

  /**
   * Simule un webhook transaction.approved pour un paiement onboarding (DEV uniquement).
   * Utile pour tester la création du tenant sans refaire un vrai paiement FedaPay.
   * En production cette méthode lève une exception.
   */
  async simulateOnboardingApproved(paymentId: string) {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'production') {
      this.logger.warn('simulateOnboardingApproved called in production - rejected');
      throw new BadRequestException('Simulation is not available in production');
    }

    const payment = await this.prisma.onboardingPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new BadRequestException(`Payment not found: ${paymentId}`);
    }

    if (payment.status === 'COMPLETED') {
      this.logger.warn(`Payment ${paymentId} already COMPLETED`);
      return { received: true, processed: false, reason: 'already_completed' };
    }

    const reference = payment.reference;
    const simulatedTransaction = {
      id: `sim-${Date.now()}`,
      reference,
      metadata: {
        paymentId: payment.id,
        draftId: payment.draftId,
        type: 'onboarding',
      },
    };

    this.logger.log(`🧪 Simulating transaction.approved for payment ${paymentId} (ref: ${reference})`);
    return this.billingService.handlePaymentSuccess(simulatedTransaction);
  }

  /**
   * Traite un paiement réussi
   * 
   * ⚠️ CRITIQUE : Cette méthode doit être idempotente et transactionnelle
   */
  private async handlePaymentSuccess(transaction: any) {
    this.logger.log('=== PAYMENT SUCCESS WEBHOOK ===');
    this.logger.log(`Transaction ID: ${transaction?.id}`);
    const rawMeta = transaction?.metadata;
    const rawCustom = transaction?.custom_metadata;
    this.logger.log(`Metadata (raw): ${typeof rawMeta === 'string' ? rawMeta : JSON.stringify(rawMeta)}`);
    this.logger.log(
      `Custom metadata (raw): ${typeof rawCustom === 'string' ? rawCustom : JSON.stringify(rawCustom)}`,
    );
    const normalizedMeta = this.billingService.normalizeFedaPayTransactionMetadata(transaction);
    this.logger.log(`Metadata (normalized): ${JSON.stringify(normalizedMeta)}`);

    const paymentReference = transaction.reference || transaction.id;

    // 1. Vérifier l'idempotence via PaymentWebhookLog
    const existingLog = await this.prisma.paymentWebhookLog.findUnique({
      where: { reference: paymentReference },
    });

    if (existingLog && existingLog.processed) {
      this.logger.warn(`⚠️  Payment already processed: ${paymentReference}`);
      return { received: true, processed: false, reason: 'already_processed' };
    }

    // 2. Résoudre onboarding (paymentId) ou renouvellement (billingEventId) — ne pas dépendre seul de metadata.paymentId
    const resolved = await this.billingService.resolveWebhookPayment(transaction);
    if (!resolved) {
      this.logger.error(
        `❌ Impossible de résoudre le paiement (metadata normalisée): ${JSON.stringify(normalizedMeta)} — ref=${paymentReference}`,
      );
      throw new BadRequestException(
        'Cannot resolve payment from webhook: missing paymentId, draftId, or matching reference',
      );
    }

    if (resolved.paymentType === 'onboarding') {
      return await this.handleOnboardingPaymentSuccess(transaction, resolved.paymentId);
    }
    return await this.handleRenewalPaymentSuccess(transaction, resolved.billingEventId);
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
        metadata: {
          ...(existingPayment.metadata as any || {}),
          transactionReference: paymentReference,
          transactionData: transaction,
          transactionId: transaction.id,
          completedAt: new Date().toISOString(),
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

    const emailCfg = this.getPaymentTransactionalEmailConfig();

    // Créer le tenant, la subscription et l'utilisateur promoteur (idempotent)
    try {
      const activation = await this.onboardingService.activateTenantAfterPayment(paymentId);
      this.logger.log(`✅ Tenant activated for onboarding payment: ${paymentId}`);
      if (
        emailCfg &&
        !(activation as { alreadyActivated?: boolean }).alreadyActivated
      ) {
        await this.sendOnboardingPaymentSuccessEmail(paymentId, transaction, emailCfg).catch(
          (err: any) =>
            this.logger.error(`Échec envoi email bienvenue onboarding: ${err?.message}`, err?.stack),
        );
      }
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
        metadata: {
          ...(existingBillingEvent.metadata as any || {}),
          transactionReference: paymentReference,
          transactionData: transaction,
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
        },
      },
    });

    // Mettre à jour l'abonnement
    if (billingEvent.subscriptionId) {
      const eventMeta = (existingBillingEvent.metadata as any) || {};
      const cycle = eventMeta.cycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY';
      const days = cycle === 'YEARLY' ? 365 : 30;
      await this.prisma.subscription.update({
        where: { id: billingEvent.subscriptionId },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
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
    const transactionId = transaction.id || transaction.transaction_id;
    const errorMessage = transaction.error || transaction.message || transaction.status_message || 'Payment failed';
    const errorCode = transaction.error_code || transaction.code;
    
    // Log détaillé de l'échec
    this.logger.error(`❌ Payment failed - Reference: ${paymentReference}, Transaction ID: ${transactionId}`);
    this.logger.error(`❌ Error message: ${errorMessage}`);
    if (errorCode) {
      this.logger.error(`❌ Error code: ${errorCode}`);
    }
    this.logger.error(`❌ Full transaction data: ${JSON.stringify(transaction, null, 2)}`);
    
    // Enregistrer le webhook avec plus de détails
    await this.prisma.paymentWebhookLog.create({
      data: {
        reference: paymentReference,
        provider: 'fedapay',
        eventType: 'transaction.failed',
        processed: false,
        payload: transaction,
        metadata: {
          error: errorMessage,
          errorCode,
          transactionId,
          // Raisons possibles de l'échec
          possibleCauses: [
            'Callback URL inaccessible (localhost)',
            'Webhook URL inaccessible',
            'Numéro de téléphone invalide',
            'Opérateur Mobile Money non disponible',
            'Fonds insuffisants',
            'Transaction expirée',
          ],
        },
      },
    });

    this.logger.warn(`⚠️  Payment failed: ${paymentReference} - ${errorMessage}`);
    
    // Suggestions de résolution
    if (errorMessage.includes('callback') || errorMessage.includes('redirect')) {
      this.logger.error(`💡 Suggestion: Vérifier que FRONTEND_URL est accessible publiquement (utiliser ngrok en dev)`);
    }
    if (errorMessage.includes('webhook') || errorMessage.includes('notification')) {
      this.logger.error(`💡 Suggestion: Vérifier que API_URL est accessible publiquement et que le webhook est configuré dans FedaPay`);
    }
    if (errorMessage.includes('phone') || errorMessage.includes('mobile')) {
      this.logger.error(`💡 Suggestion: Vérifier que le numéro de téléphone est valide pour le sandbox FedaPay`);
    }

    const emailCfg = this.getPaymentTransactionalEmailConfig();
    if (emailCfg) {
      await this.sendOnboardingPaymentFailedEmailIfApplicable(transaction, emailCfg).catch((err: any) =>
        this.logger.error(`Échec envoi email paiement refusé: ${err?.message}`, err?.stack),
      );
    }
  }

  private async handlePaymentCanceled(transaction: any) {
    const paymentReference = transaction.reference || transaction.id;
    const transactionId = transaction.id || transaction.transaction_id;

    await this.prisma.paymentWebhookLog.create({
      data: {
        reference: paymentReference,
        provider: 'fedapay',
        eventType: 'transaction.canceled',
        processed: false,
        payload: transaction,
        metadata: {
          transactionId,
          status: 'CANCELED',
        },
      },
    });

    this.logger.warn(`⚠️  Payment canceled: ${paymentReference}`);

    const emailCfg = this.getPaymentTransactionalEmailConfig();
    if (emailCfg) {
      await this.sendOnboardingPaymentCanceledEmailIfApplicable(transaction, emailCfg).catch((err: any) =>
        this.logger.error(`Échec envoi email paiement annulé: ${err?.message}`, err?.stack),
      );
    }
  }

  private getPaymentTransactionalEmailConfig(): PaymentTransactionalEmailConfig | null {
    const noreplyFrom = (this.configService.get<string>('EMAIL_FROM_NOREPLY') || '').trim();
    const supportFrom = (this.configService.get<string>('EMAIL_FROM_SUPPORT') || '').trim();
    const frontend = (this.configService.get<string>('FRONTEND_URL') || '').trim().replace(/\/$/, '');
    if (!noreplyFrom || !supportFrom || !frontend) {
      this.logger.warn(
        'Emails transactionnels désactivés : EMAIL_FROM_NOREPLY, EMAIL_FROM_SUPPORT ou FRONTEND_URL manquant.',
      );
      return null;
    }
    return {
      noreplyFrom,
      supportFrom,
      supportEmail: supportFrom,
      siteUrl: frontend,
      portalUrl: `${frontend}/portal`,
      signupUrl: `${frontend}/signup`,
    };
  }

  private async findOnboardingPaymentForFedaPayTransaction(transaction: any) {
    const ref = transaction?.reference ?? transaction?.id;
    const rawMeta = transaction?.metadata;
    const meta =
      rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)
        ? (rawMeta as Record<string, unknown>)
        : {};
    if (meta.type === 'subscription_renewal') {
      return null;
    }
    const paymentId = typeof meta.paymentId === 'string' ? meta.paymentId : undefined;
    if (paymentId) {
      const p = await this.prisma.onboardingPayment.findUnique({
        where: { id: paymentId },
        include: { draft: true },
      });
      if (p) {
        return p;
      }
    }
    if (ref) {
      return this.prisma.onboardingPayment.findFirst({
        where: { reference: String(ref) },
        include: { draft: true },
      });
    }
    return null;
  }

  /** URL portail tenant : https://{subdomain}.{domaine du FRONTEND_URL}/portal */
  private buildTenantPortalUrl(frontendBaseUrl: string, subdomain: string | undefined | null): string {
    const fallback = `${frontendBaseUrl.replace(/\/$/, '')}/portal`;
    if (!subdomain || !String(subdomain).trim()) {
      return fallback;
    }
    try {
      const u = new URL(frontendBaseUrl);
      let host = u.hostname;
      if (host.startsWith('www.')) {
        host = host.slice(4);
      }
      return `${u.protocol}//${String(subdomain).trim().toLowerCase()}.${host}/portal`;
    } catch {
      return fallback;
    }
  }

  private async sendOnboardingPaymentSuccessEmail(
    paymentId: string,
    transaction: any,
    cfg: PaymentTransactionalEmailConfig,
  ) {
    const payment = await this.prisma.onboardingPayment.findUnique({
      where: { id: paymentId },
      include: { draft: true },
    });
    if (!payment?.draft) {
      return;
    }
    const draft = payment.draft;
    const to = (draft.promoterEmail || draft.email || '').trim();
    if (!to) {
      return;
    }
    const payMeta = (payment.metadata as Record<string, unknown>) || {};
    const firstSub =
      typeof payMeta.firstTenantSubdomain === 'string' ? payMeta.firstTenantSubdomain : undefined;
    const loginUrl = this.buildTenantPortalUrl(cfg.siteUrl, firstSub);
    const snap = (draft.priceSnapshot as Record<string, unknown>) || {};
    const plan =
      typeof snap.planCode === 'string'
        ? snap.planCode
        : typeof snap.planName === 'string'
          ? snap.planName
          : 'Academia Helm';
    const links = {
      siteUrl: cfg.siteUrl,
      portalUrl: cfg.portalUrl,
      signupUrl: cfg.signupUrl,
      supportEmail: cfg.supportEmail,
    };
    const tmpl = emailTemplates.paymentSuccess(links, {
      promoteurPrenom: draft.promoterFirstName || draft.email?.split('@')[0] || 'Promoteur',
      etablissementNom: draft.schoolName,
      plan,
      transactionRef: String(transaction.reference || transaction.id || payment.reference),
      montant: Number(transaction.amount ?? payment.amount) || 0,
      loginUrl,
      email: to,
      motDePasse: null,
    });
    await this.emailService.sendEmail({
      to,
      from: cfg.noreplyFrom,
      subject: tmpl.subject,
      html: tmpl.html,
    });
  }

  private async sendOnboardingPaymentFailedEmailIfApplicable(
    transaction: any,
    cfg: PaymentTransactionalEmailConfig,
  ) {
    const pay = await this.findOnboardingPaymentForFedaPayTransaction(transaction);
    if (!pay?.draft) {
      return;
    }
    const draft = pay.draft;
    const to = (draft.promoterEmail || draft.email || '').trim();
    if (!to) {
      return;
    }
    const links = {
      siteUrl: cfg.siteUrl,
      portalUrl: cfg.portalUrl,
      signupUrl: cfg.signupUrl,
      supportEmail: cfg.supportEmail,
    };
    const tmpl = emailTemplates.paymentFailed(links, {
      promoteurPrenom: draft.promoterFirstName || 'Bonjour',
      etablissementNom: draft.schoolName,
      transactionRef: String(transaction.reference || transaction.id || pay.reference),
      montant: Number(transaction.amount ?? pay.amount) || 0,
      retryUrl: cfg.signupUrl,
    });
    await this.emailService.sendEmail({
      to,
      from: cfg.supportFrom,
      subject: tmpl.subject,
      html: tmpl.html,
    });
  }

  private async sendOnboardingPaymentCanceledEmailIfApplicable(
    transaction: any,
    cfg: PaymentTransactionalEmailConfig,
  ) {
    const pay = await this.findOnboardingPaymentForFedaPayTransaction(transaction);
    if (!pay?.draft) {
      return;
    }
    const draft = pay.draft;
    const to = (draft.promoterEmail || draft.email || '').trim();
    if (!to) {
      return;
    }
    const links = {
      siteUrl: cfg.siteUrl,
      portalUrl: cfg.portalUrl,
      signupUrl: cfg.signupUrl,
      supportEmail: cfg.supportEmail,
    };
    const tmpl = emailTemplates.paymentCanceled(links, {
      promoteurPrenom: draft.promoterFirstName || 'Bonjour',
      etablissementNom: draft.schoolName,
      retryUrl: cfg.signupUrl,
    });
    await this.emailService.sendEmail({
      to,
      from: cfg.noreplyFrom,
      subject: tmpl.subject,
      html: tmpl.html,
    });
  }
}
