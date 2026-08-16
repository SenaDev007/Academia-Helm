/**
 * ============================================================================
 * WHATSAPP SERVICE - ENVOI DE MESSAGES WHATSAPP
 * ============================================================================
 *
 * Service pour l'envoi de messages WhatsApp via différents providers.
 * Supporte :
 *   - Gupshup.io (RECOMMANDÉ - templates pré-approuvés Meta)
 *   - WhatsApp Business API (Facebook Graph)
 *   - Twilio WhatsApp (Content API)
 *   - Infobip WhatsApp
 *   - Gateway générique
 *   - Mock (développement)
 *
 * ─── Architecture multi-canal ────────────────────────────────────────────
 *
 *   Business Service (RH, Élèves, Pédagogie)
 *          │
 *          ▼
 *   WhatsAppService.sendCategorized()   ← Orchestration + tracing
 *          │
 *          ├─ WhatsAppLogService.createLog()    (PENDING)
 *          ├─ WhatsAppService.sendWhatsApp()    (provider dispatch)
 *          │     └─ sendViaGupshup()            (Gupshup API)
 *          ├─ WhatsAppLogService.markAsSent()   (SENT + providerId)
 *          └─ WhatsAppLogService.markAsFailed() (FAILED + errorMessage)
 *
 * ─── Personnalisation par école tenante ──────────────────────────────────
 *
 * Chaque template WhatsApp utilise un header {{1}} = nom de l'école.
 * Le service sendCategorizedForTenant() charge automatiquement le
 * tenant_identity_profile (schoolAcronym + schoolName) et l'injecte
 * comme premier paramètre.
 *
 * ============================================================================
 */

import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import { PrismaService } from '../../database/prisma.service';
import {
  normalizePhoneE164,
  toGupshupDestination,
  isValidPhoneE164,
} from '../../common/utils/phone';
import {
  WhatsAppTemplateRegistry,
  MetaTemplate,
} from './whatsapp-template.registry';
import {
  WhatsAppLogService,
  CategorizedWhatsAppRequest,
} from './whatsapp-log.service';

export interface WhatsAppRequest {
  to: string; // Numéro au format international (ex: +22961234567)
  message?: string; // Message texte (pour fallback sans template)
  template?: string; // Nom du template Gupshup (elementName)
  variables?: Record<string, string>; // Variables pour le template (clé = nom de variable Meta v3)
  contentSid?: string; // Content SID pour Twilio WhatsApp
  contentVariables?: Record<string, string>; // Variables pour Content SID Twilio
  /** Document PDF à envoyer (Buffer + filename) */
  document?: { content: Buffer; filename: string };
  /** Caption du document (texte descriptif sous le PDF) */
  documentCaption?: string;
}

export type WhatsAppProvider =
  | 'gupshup'
  | 'whatsapp-business'
  | 'twilio-whatsapp'
  | 'infobip-whatsapp'
  | 'gateway'
  | 'mock';

// ─── Branding école ────────────────────────────────────────────────────────

export interface TenantBranding {
  schoolName: string;
  schoolAcronym?: string | null;
  schoolLogo?: string | null;
  schoolPhone?: string | null;
  schoolEmail?: string | null;
  // v3 : pour les 3 boutons URL dynamiques
  subdomain?: string | null;
  whatsappNumber?: string | null;
  phoneNumber?: string | null;
}

// ─── Résultat d'envoi catégorisé ───────────────────────────────────────────

export interface CategorizedSendResult {
  success: boolean;
  logId?: string;
  providerId?: string;
  error?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly provider: WhatsAppProvider;
  private _whatsappLogService: WhatsAppLogService | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly templateRegistry: WhatsAppTemplateRegistry,
  ) {
    this.provider = (this.configService.get<string>(
      'WHATSAPP_PROVIDER',
      'mock',
    ) as WhatsAppProvider) || 'mock';
    this.logger.log(`📱 WhatsAppService initialisé (provider: ${this.provider})`);
  }

  /**
   * Injection du WhatsAppLogService (lazy) pour éviter la circular dependency.
   * Appelé par CommunicationModule.onModuleInit().
   */
  setWhatsAppLogService(service: WhatsAppLogService): void {
    this._whatsappLogService = service;
  }

  // ========================================================================
  // ENVOI SIMPLE (sans tracing)
  // ========================================================================

  /**
   * Envoie un message WhatsApp via le provider configuré.
   *
   * @throws Error si l'envoi échoue
   */
  async sendWhatsApp(
    request: WhatsAppRequest,
  ): Promise<{ success: boolean; messageId?: string }> {
    try {
      // Normalisation du numéro destinataire
      const normalizedTo = normalizePhoneE164(request.to);
      this.logger.log(`WhatsApp normalisation: raw="${request.to}" → normalized="${normalizedTo}"`);
      if (!isValidPhoneE164(normalizedTo)) {
        throw new Error(
          `Numéro WhatsApp invalide: "${request.to}" → normalisé: "${normalizedTo}". ` +
            `Format attendu: +229XXXXXXXX (E.164)`,
        );
      }
      const normalizedRequest = { ...request, to: normalizedTo };

      switch (this.provider) {
        case 'gupshup':
          return await this.sendViaGupshup(normalizedRequest);
        case 'whatsapp-business':
          return await this.sendViaWhatsAppBusiness(normalizedRequest);
        case 'twilio-whatsapp':
          return await this.sendViaTwilioWhatsApp(normalizedRequest);
        case 'infobip-whatsapp':
          return await this.sendViaInfobipWhatsApp(normalizedRequest);
        case 'gateway':
          return await this.sendViaGateway(normalizedRequest);
        case 'mock':
        default:
          return await this.sendMock(normalizedRequest);
      }
    } catch (error: any) {
      this.logger.error(`Failed to send WhatsApp via ${this.provider}:`, error);
      throw new Error(`Échec d'envoi WhatsApp: ${error.message}`);
    }
  }

  // ========================================================================
  // ENVOI CATÉGORISÉ (avec tracing dans whatsapp_logs)
  // ========================================================================

  /**
   * Envoie un message WhatsApp catégorisé avec traçabilité complète.
   *
   * Ne lance JAMAIS d'erreur — retourne { success: false, error } en cas d'échec.
   * Le caller peut donc l'utiliser en fire-and-forget.
   *
   * @example
   * const result = await whatsappService.sendCategorized({
   *   tenantId: 'abc',
   *   category: 'RECRUTEMENT',
   *   module: 'hr',
   *   to: '+22997123456',
   *   toName: 'Erhel DEGBE',
   *   recipientType: 'CANDIDAT',
   *   recipientId: 'candidate-uuid',
   *   message: 'Candidature reçue',
   *   templateId: 'candidature_recue',
   *   templateLanguage: 'fr',
   *   triggeredBy: 'SYSTEM',
   *   relatedEntityId: 'application-uuid',
   *   relatedEntityType: 'HrApplication',
   * });
   */
  async sendCategorized(
    request: CategorizedWhatsAppRequest & {
      /** Template Gupshup à utiliser (elementName). Si fourni, variables seront envoyées. */
      templateName?: string;
      /** Variables du template (clé = index 1-based, valeur = texte). */
      templateVariables?: Record<string, string>;
    },
  ): Promise<CategorizedSendResult> {
    // 1. Créer un log PENDING avant l'envoi
    let logId: string | undefined;
    if (this._whatsappLogService) {
      try {
        const logResult = await this._whatsappLogService.createLog(request);
        logId = logResult.logId;
      } catch (err: any) {
        this.logger.warn(
          `createLog failed — sending without tracing. Error: ${err.message}`,
        );
      }
    }

    // 2. Construire la requête d'envoi
    const sendRequest: WhatsAppRequest = {
      to: request.to,
      message: request.message,
      template: request.templateName,
      variables: request.templateVariables,
      document: (request as any).document,
      documentCaption: (request as any).documentCaption,
    };

    // 3. Envoi via le provider
    try {
      const result = await this.sendWhatsApp(sendRequest);

      if (result.success) {
        if (logId && this._whatsappLogService) {
          await this._whatsappLogService.markAsSent(
            logId,
            this.provider,
            result.messageId,
          );
        }
        this.logger.log(`✅ WhatsApp sendCategorized réussi: messageId=${result.messageId}`);
        return {
          success: true,
          logId,
          providerId: result.messageId,
        };
      } else {
        const errorMsg = 'Provider returned success=false';
        this.logger.error(`❌ WhatsApp sendCategorized: provider returned success=false`);
        if (logId && this._whatsappLogService) {
          await this._whatsappLogService.markAsFailed(logId, errorMsg);
        }
        return { success: false, logId, error: errorMsg };
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error';
      this.logger.error(`❌ WhatsApp sendCategorized FAILED: ${errorMsg}`, err?.stack);
      this.logger.error(`   Request: to=${request.to}, template=${request.templateName || 'N/A'}, provider=${this.provider}`);
      if (logId && this._whatsappLogService) {
        try {
          await this._whatsappLogService.markAsFailed(logId, errorMsg);
        } catch (markErr: any) {
          this.logger.error(`markAsFailed also failed: ${markErr.message}`);
        }
      }
      return { success: false, logId, error: errorMsg };
    }
  }

  // ========================================================================
  // ENVOI PAR ÉCOLE TENANTE (avec branding automatique)
  // ========================================================================

  /**
   * Charge le branding d'une école (tenant_identity_profiles).
   *
   * @returns { schoolName, schoolAcronym, schoolLogo, schoolPhone, schoolEmail }
   */
  async getTenantBranding(tenantId: string): Promise<TenantBranding> {
    try {
      // Charger le profil d'identité actif + le tenant (pour subdomain)
      const [profile, tenant] = await Promise.all([
        this.prisma.tenantIdentityProfile.findFirst({
          where: { tenantId, isActive: true },
          select: {
            schoolName: true,
            schoolAcronym: true,
            logoUrl: true,
            phonePrimary: true,
            email: true,
            whatsapp: true,
          },
        }),
        this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true, subdomain: true },
        }),
      ]);

      if (profile?.schoolName) {
        const apiBaseUrl =
          this.configService.get<string>('APP_PUBLIC_URL') ||
          'https://api.academiahelm.com';
        const logoUrl = profile.logoUrl
          ? `${apiBaseUrl}/api/tenants/${tenantId}/logo`
          : null;

        return {
          schoolName: profile.schoolName,
          schoolAcronym: profile.schoolAcronym,
          schoolLogo: logoUrl,
          schoolPhone: profile.phonePrimary,
          schoolEmail: profile.email,
          // v3 : pour les 3 boutons URL dynamiques
          subdomain: tenant?.subdomain || null,
          whatsappNumber: (profile as any).whatsapp || profile.phonePrimary || null,
          phoneNumber: profile.phonePrimary || null,
        };
      }

      // Fallback sur le tenant directement
      return { schoolName: tenant?.name || 'Établissement' };
    } catch (err: any) {
      this.logger.warn(
        `getTenantBranding failed for tenant ${tenantId}: ${err.message}`,
      );
      return { schoolName: 'Établissement' };
    }
  }

  /**
   * Génère la chaîne d'en-tête personnalisée pour une école.
   * Format: "${schoolAcronym} — ${schoolName}" (ou juste schoolName si pas d'acronym).
   *
   * @example
   * getSchoolDisplay(branding)
   * // → "CSPEB — Complexe Scolaire Pierre Emeri Bocco"
   */
  getSchoolDisplay(branding: TenantBranding): string {
    if (branding.schoolAcronym && branding.schoolName) {
      return `${branding.schoolAcronym} - ${branding.schoolName}`;
    }
    return branding.schoolName || 'Établissement';
  }

  /**
   * Envoie un message WhatsApp à un parent/candidat d'une école spécifique.
   *
   * Cette méthode charge automatiquement le branding école (schoolName) et
   * l'injecte en position 1 du tableau de bodyParams. Le caller ne doit
   * fournir QUE les variables métier (sans schoolName).
   *
   * Convention v2 :
   *   - {{1}} = schoolName (injecté automatiquement)
   *   - {{2}}, {{3}}, ... = callerParams (fournis par le caller)
   *   - callerParamCount = bodyPlaceholderCount - 1
   *
   * @param params.tenantId - ID du tenant (école)
   * @param params.templateName - Nom du template Gupshup (elementName)
   * @param params.to - Numéro destinataire (E.164)
   * @param params.callerParams - Variables métier (SANS schoolName, qui est injecté auto)
   * @param params.category - Catégorie (RECRUTEMENT, PEDAGOGIE, FINANCE, ADMINISTRATIF)
   * @param params.module - Module (hr, students, pedagogy)
   * @param params.recipientName - Nom du destinataire
   * @param params.recipientType - Type (CANDIDAT, PARENT, STAFF, ENSEIGNANT, EXTERNE)
   * @param params.recipientId - ID du destinataire en DB
   * @param params.relatedEntityId - ID de l'entité liée (Admission, HrApplication, etc.)
   * @param params.relatedEntityType - Type de l'entité liée
   * @param params.triggeredBy - Source du déclenchement (SYSTEM, STAFF, AUTOMATION, SARA)
   *
   * @example
   * // Pour le template 'admission_recue' qui a callerParamCount=5 :
   * await whatsappService.sendForTenant({
   *   tenantId: 'cspeb-uuid',
   *   templateName: 'admission_recue',
   *   to: '+22997123456',
   *   callerParams: ['Marie ADANDE', 'Jean ADANDE', '2025-2026', 'CP1', 'ADM-2025-001'],
   *   //                ^guardianName  ^childName    ^year       ^class  ^admissionNumber
   *   category: 'ADMINISTRATIF',
   *   module: 'students',
   *   recipientName: 'Marie ADANDE',
   *   recipientType: 'PARENT',
   *   relatedEntityId: 'admission-uuid',
   *   relatedEntityType: 'Admission',
   *   triggeredBy: 'SYSTEM',
   * });
   */
  async sendForTenant(params: {
    tenantId: string;
    templateName: string;
    to: string;
    callerParams: string[];
    category: 'RECRUTEMENT' | 'PEDAGOGIE' | 'FINANCE' | 'ADMINISTRATIF' | 'COMMUNICATION' | 'SYSTEM';
    module?: 'hr' | 'students' | 'pedagogy' | 'finance' | 'communication' | 'discipline';
    subCategory?: string;
    recipientName?: string;
    recipientType?: 'CANDIDAT' | 'PARENT' | 'STAFF' | 'ENSEIGNANT' | 'EXTERNE';
    recipientId?: string;
    relatedEntityId?: string;
    relatedEntityType?: string;
    triggeredBy?: 'SYSTEM' | 'STAFF' | 'AUTOMATION' | 'SARA';
    triggeredByUserId?: string;
    threadId?: string;
  }): Promise<CategorizedSendResult> {
    // 1. Charger le branding école (inclut subdomain/whatsapp/phone pour boutons URL)
    const branding = await this.getTenantBranding(params.tenantId);
    const schoolDisplay = this.getSchoolDisplay(branding);

    // 2. Valider le template
    const template = this.templateRegistry.require(params.templateName);

    // 3. Construire l'objet paramsByName (variables nommées Meta v3)
    //    Inclut school_name + variables métier (callerParams mappées via bodyVariables)
    let bodyParamsByName: Record<string, string>;
    try {
      bodyParamsByName = this.templateRegistry.buildBodyParamsByName(
        params.templateName,
        schoolDisplay,
        params.callerParams,
      );
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
      };
    }

    // 4. Construire les variables de boutons URL (3 valeurs : subdomain, whatsapp, phone)
    const buttonParams = this.templateRegistry.buildButtonParams(branding);

    // 5. Construire templateVariables pour Meta Graph API :
    //    - Clé = nom de variable (Meta utilise les noms nommés)
    //    - Valeurs body + valeurs boutons
    const templateVariables: Record<string, string> = { ...bodyParamsByName };
    // Les variables des boutons sont nommées selon varName des MetaTemplateButton
    const buttons = template.buttons ?? [];
    buttons.forEach((btn, i) => {
      templateVariables[btn.varName] = buttonParams[i] ?? '';
    });

    // 6. Rendu final du message pour le log
    const renderedMessage = this.templateRegistry.renderBody(
      params.templateName,
      bodyParamsByName,
    );

    // 7. Source phone (numéro WhatsApp Business)
    const fromPhone =
      this.configService.get<string>('GUPSHUP_SOURCE_PHONE') ||
      this.configService.get<string>('WHATSAPP_PHONE_NUMBER') ||
      undefined;

    // 8. Envoyer avec tracing
    return this.sendCategorized({
      tenantId: params.tenantId,
      category: params.category,
      subCategory: params.subCategory,
      module: params.module,
      to: params.to,
      toName: params.recipientName,
      recipientType: params.recipientType,
      recipientId: params.recipientId,
      fromPhone,
      message: renderedMessage,
      templateId: params.templateName,
      templateLanguage: 'fr',
      threadId: params.threadId,
      triggeredBy: params.triggeredBy,
      triggeredByUserId: params.triggeredByUserId,
      relatedEntityId: params.relatedEntityId,
      relatedEntityType: params.relatedEntityType,
      templateName: params.templateName,
      templateVariables,
    });
  }

  // ========================================================================
  // PROVIDER: GUPSHUP
  // ========================================================================

  /**
   * Envoie un message WhatsApp via l'API Gupshup.io.
   *
   * Endpoint: POST https://api.gupshup.io/wa/api/v1/template/msg
   * Headers: apikey + Content-Type: application/x-www-form-urlencoded
   * Body (form-urlencoded):
   *   - channel: "whatsapp"
   *   - source: numéro WhatsApp Business (sans "+")
   *   - destination: numéro destinataire (sans "+")
   *   - src.name: nom de l'app Gupshup
   *   - template: JSON { id: elementName, params: [val1, val2, ...] }
   *
   * Réponse: HTTP 202 + { status: "submitted", messageId: "..." }
   */
  private async sendViaGupshup(
    request: WhatsAppRequest,
  ): Promise<{ success: boolean; messageId?: string }> {
    const apiKey = this.configService.get<string>('GUPSHUP_API_KEY');
    const appName = this.configService.get<string>('GUPSHUP_APP_NAME');
    const sourcePhone = this.configService.get<string>('GUPSHUP_SOURCE_PHONE');
    const apiUrl =
      this.configService.get<string>('GUPSHUP_API_URL') ||
      'https://api.gupshup.io/wa/api/v1';

    if (!apiKey || !appName || !sourcePhone) {
      throw new Error(
        'Configuration Gupshup incomplète. Vérifiez GUPSHUP_API_KEY, GUPSHUP_APP_NAME, GUPSHUP_SOURCE_PHONE',
      );
    }

    // Source: numéro WhatsApp Business sans "+"
    const source = toGupshupDestination(sourcePhone);
    // Destination: numéro destinataire sans "+"
    const destination = toGupshupDestination(request.to);

    this.logger.log(
      `Gupshup envoi: source=${source} | dest=${destination} | template=${request.template || 'N/A'} | rawTo=${request.to}`,
    );

    // ─── Cas 1: envoi via template ───
    if (request.template) {
      // Valider que le template existe dans le registry
      const tpl = this.templateRegistry.get(request.template);
      if (!tpl) {
        throw new Error(
          `Template WhatsApp inconnu: "${request.template}". ` +
            `Templates disponibles: ${this.templateRegistry
              .list()
              .map((t) => t.elementName)
              .slice(0, 5)
              .join(', ')}...`,
        );
      }

      // v3 : les variables sont nommées dans templateVariables { school_name, var1, var2, ... }
      // Gupshup attend les params dans l'ordre d'apparition dans bodyVariables
      const orderedParams: string[] = [];
      if (request.variables) {
        for (const varName of tpl.bodyVariables) {
          orderedParams.push(request.variables[varName] || '');
        }
      } else if (tpl.bodyPlaceholderCount > 0) {
        throw new Error(
          `Template "${request.template}" requiert ${tpl.bodyPlaceholderCount} variables, ` +
            `mais request.variables est vide`,
        );
      }

      // Gupshup utilise encore {{1}}, {{2}}... donc on envoie le tableau ordonné
      const templatePayload = {
        id: request.template,
        params: orderedParams,
      };

      this.logger.log(
        `Gupshup template payload: ${JSON.stringify(templatePayload)}`,
      );

      // Construction du body form-urlencoded
      const formData = new URLSearchParams();
      formData.append('channel', 'whatsapp');
      formData.append('source', source);
      formData.append('destination', destination);
      formData.append('src.name', appName);
      formData.append('template', JSON.stringify(templatePayload));

      const url = `${apiUrl}/template/msg`;
      this.logger.debug(
        `Gupshup API call: POST ${url} | template=${request.template} | dest=${destination}`,
      );

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const responseText = await response.text();
      let result: any;
      try {
        result = JSON.parse(responseText);
      } catch {
        result = { raw: responseText };
      }

      // Gupshup retourne 202 + { status: "submitted", messageId: "..." } en cas de succès
      this.logger.log(
        `Gupshup response: HTTP ${response.status} | body: ${JSON.stringify(result).substring(0, 500)}`,
      );
      if (
        (response.status === 200 || response.status === 202) &&
        (result.status === 'submitted' || result.status === 'success' || result.messageId)
      ) {
        const messageId =
          result.messageId ||
          result.response?.messages?.[0]?.id ||
          result.response?.id ||
          `gupshup-${Date.now()}`;
        this.logger.log(
          `✅ WhatsApp template envoyé via Gupshup à ${destination}: ${messageId}`,
        );

        // Si un document PDF est fourni, l'uploader et l'envoyer
        if (request.document?.content) {
          try {
            const docResult = await this.sendDocumentViaGupshup(
              source,
              destination,
              appName,
              apiKey,
              apiUrl,
              request.document.content,
              request.document.filename,
              request.documentCaption || `Reçu ${request.template || ''}`,
            );
            this.logger.log(`✅ WhatsApp document envoyé via Gupshup à ${destination}: ${docResult.messageId}`);
          } catch (docErr: any) {
            this.logger.warn(`⚠️ Échec envoi document WhatsApp (non bloquant): ${docErr.message}`);
          }
        }

        return { success: true, messageId };
      }

      // Erreur
      const errMsg =
        result.message ||
        result.error ||
        result.raw ||
        `HTTP ${response.status}`;
      this.logger.error(
        `❌ Gupshup API error for template "${request.template}" to ${destination}: ${errMsg}`,
      );
      this.logger.debug(`Gupshup full response: ${JSON.stringify(result)}`);
      throw new Error(`Gupshup: ${errMsg}`);
    }

    // ─── Cas 2: envoi texte simple (sans template) ───
    // Note: WhatsApp Business API n'autorise l'envoi de texte libre que dans
    // les 24h suivant la dernière interaction de l'utilisateur (customer care window)
    if (!request.message) {
      throw new Error(
        'Envoi WhatsApp sans template: request.message est requis',
      );
    }

    const formData = new URLSearchParams();
    formData.append('channel', 'whatsapp');
    formData.append('source', source);
    formData.append('destination', destination);
    formData.append('src.name', appName);
    formData.append('message', request.message);

    const url = `${apiUrl}/msg`;
    this.logger.debug(
      `Gupshup API call (text): POST ${url} | dest=${destination}`,
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const responseText = await response.text();
    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    if (
      (response.status === 200 || response.status === 202) &&
      (result.status === 'submitted' || result.status === 'success' || result.messageId)
    ) {
      const messageId = result.messageId || `gupshup-${Date.now()}`;
      this.logger.log(
        `✅ WhatsApp envoyé via Gupshup (texte) à ${destination}: ${messageId}`,
      );
      return { success: true, messageId };
    }

    const errMsg = result.message || result.error || `HTTP ${response.status}`;
    this.logger.error(
      `❌ Gupshup API error (text) to ${destination}: ${errMsg}`,
    );
    throw new Error(`Gupshup: ${errMsg}`);
  }

  /**
   * Upload et envoie un document PDF via Gupshup.
   * 1. Upload du PDF via POST /media/upload (multipart/form-data)
   * 2. Envoi du document via POST /msg avec type=document
   */
  private async sendDocumentViaGupshup(
    source: string,
    destination: string,
    appName: string,
    apiKey: string,
    apiUrl: string,
    pdfBuffer: Buffer,
    filename: string,
    caption: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    // 1. Upload du PDF
    const uploadUrl = `${apiUrl.replace('/wa/api/v1', '')}/sm/api/v1/media/upload`;
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' });
    formData.append('file', blob, filename);

    this.logger.log(`Gupshup media upload: POST ${uploadUrl} | filename=${filename} | size=${pdfBuffer.length} bytes`);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'apikey': apiKey },
      body: formData,
    });

    const uploadText = await uploadResponse.text();
    let uploadResult: any;
    try { uploadResult = JSON.parse(uploadText); } catch { uploadResult = { raw: uploadText }; }

    this.logger.log(`Gupshup upload response: HTTP ${uploadResponse.status} | body: ${JSON.stringify(uploadResult).substring(0, 300)}`);

    if (!uploadResponse.ok) {
      throw new Error(`Gupshup media upload failed: HTTP ${uploadResponse.status} - ${uploadText.substring(0, 200)}`);
    }

    const mediaUrl = uploadResult.handles?.[0] || uploadResult.url || uploadResult.mediaUrl;
    if (!mediaUrl) {
      throw new Error(`Gupshup media upload: URL introuvable: ${JSON.stringify(uploadResult)}`);
    }

    // 2. Envoi du document
    const msgData = new URLSearchParams();
    msgData.append('channel', 'whatsapp');
    msgData.append('source', source);
    msgData.append('destination', destination);
    msgData.append('src.name', appName);
    msgData.append('message', caption);
    msgData.append('isTemplate', 'false');
    msgData.append('type', 'document');
    msgData.append('url', mediaUrl);
    msgData.append('fileName', filename);

    const msgResponse = await fetch(`${apiUrl}/msg`, {
      method: 'POST',
      headers: { 'apikey': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: msgData.toString(),
    });

    const msgText = await msgResponse.text();
    let msgResult: any;
    try { msgResult = JSON.parse(msgText); } catch { msgResult = { raw: msgText }; }

    if ((msgResponse.status === 200 || msgResponse.status === 202) &&
        (msgResult.status === 'submitted' || msgResult.status === 'success' || msgResult.messageId)) {
      return { success: true, messageId: msgResult.messageId || `gupshup-doc-${Date.now()}` };
    }

    throw new Error(`Gupshup document send failed: ${JSON.stringify(msgResult).substring(0, 200)}`);
  }

  // ========================================================================
  // PROVIDER: WHATSAPP BUSINESS (Facebook Graph API)
  // ========================================================================

  /**
   * Envoie un message via WhatsApp Business API
   */
  private async sendViaWhatsAppBusiness(
    request: WhatsAppRequest,
  ): Promise<{ success: boolean; messageId?: string }> {
    const apiUrl =
      this.configService.get<string>('WHATSAPP_BUSINESS_API_URL') ||
      this.configService.get<string>('WHATSAPP_API_URL') ||
      'https://graph.facebook.com/v18.0';
    const accessToken =
      this.configService.get<string>('WHATSAPP_BUSINESS_ACCESS_TOKEN') ||
      this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId =
      this.configService.get<string>('WHATSAPP_BUSINESS_PHONE_NUMBER_ID') ||
      this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');

    if (!accessToken || !phoneNumberId) {
      throw new Error(
        'WhatsApp Business API configuration incomplete. Check WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID',
      );
    }

    if (request.template) {
      // v3 : construire le payload Meta avec header + body + footer + boutons URL
      const tpl = this.templateRegistry.require(request.template);

      // Construire les components pour Meta Graph API
      const components: any[] = [];

      // 1. Header component (TEXT, sans variable)
      if (tpl.header) {
        components.push({
          type: 'header',
          parameters: [{ type: 'text', text: tpl.header }],
        });
      }

      // 2. Body component : paramètres dans l'ordre d'apparition dans bodyVariables
      const bodyParameters = tpl.bodyVariables.map((varName) => ({
        type: 'text',
        text: (request.variables as Record<string, string>)?.[varName] ?? '',
      }));
      components.push({ type: 'body', parameters: bodyParameters });

      // 3. Button components : 3 boutons URL avec variables
      //    Dans Meta, les boutons URL utilisent le type "button" avec sub_type "url"
      //    et index 0-based, avec une seule variable text par bouton
      const buttons = tpl.buttons ?? [];
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        const varValue = (request.variables as Record<string, string>)?.[btn.varName] ?? '';
        components.push({
          type: 'button',
          sub_type: 'url',
          index: i,
          parameters: [{ type: 'text', text: varValue }],
        });
      }

      const response = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: request.to.replace(/^\+/, ''),
          type: 'template',
          template: {
            name: request.template,
            language: { code: tpl.language || 'fr' },
            components,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `WhatsApp Business API error: ${JSON.stringify(error)}`,
        );
      }

      const result = await response.json();
      this.logger.log(
        `WhatsApp sent via Meta Graph API to ${request.to}: ${result.messages?.[0]?.id}`,
      );

      return {
        success: true,
        messageId: result.messages?.[0]?.id,
      };
    }

    // Envoi texte simple (sans template)
    const response = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: request.to.replace(/^\+/, ''),
        type: 'text',
        text: { body: request.message },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp Business API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    this.logger.log(
      `WhatsApp sent via Meta Graph API to ${request.to}: ${result.messages?.[0]?.id}`,
    );

    return {
      success: true,
      messageId: result.messages?.[0]?.id,
    };
  }

  // ========================================================================
  // PROVIDER: TWILIO WHATSAPP
  // ========================================================================

  /**
   * Envoie un message via Twilio WhatsApp
   */
  private async sendViaTwilioWhatsApp(
    request: WhatsAppRequest,
  ): Promise<{ success: boolean; messageId?: string }> {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const fromNumber =
      this.configService.get<string>('TWILIO_WHATSAPP_NUMBER') ||
      'whatsapp:+14155238886';
    const defaultContentSid = this.configService.get<string>(
      'TWILIO_WHATSAPP_CONTENT_SID',
    );

    if (!accountSid || !authToken) {
      throw new Error(
        'Twilio configuration incomplete. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN',
      );
    }

    if (!fromNumber) {
      throw new Error('TWILIO_WHATSAPP_NUMBER is required for WhatsApp messages');
    }

    const client = twilio(accountSid, authToken);

    try {
      if (request.contentSid && request.contentVariables) {
        const contentVariables = JSON.stringify(request.contentVariables);

        const result = await client.messages.create({
          from: fromNumber,
          to: `whatsapp:${request.to}`,
          contentSid: request.contentSid,
          contentVariables: contentVariables,
        });

        this.logger.log(
          `✅ WhatsApp sent via Twilio (Content SID) to ${request.to}: ${result.sid}`,
        );

        return { success: true, messageId: result.sid };
      }

      if (defaultContentSid && request.contentVariables) {
        const contentVariables = JSON.stringify(request.contentVariables);

        const result = await client.messages.create({
          from: fromNumber,
          to: `whatsapp:${request.to}`,
          contentSid: defaultContentSid,
          contentVariables: contentVariables,
        });

        this.logger.log(
          `✅ WhatsApp sent via Twilio (Content SID default) to ${request.to}: ${result.sid}`,
        );

        return { success: true, messageId: result.sid };
      }

      if (!request.message) {
        throw new Error(
          'Either contentSid with contentVariables or message is required for WhatsApp',
        );
      }

      const result = await client.messages.create({
        body: request.message,
        from: fromNumber,
        to: `whatsapp:${request.to}`,
      });

      this.logger.log(
        `✅ WhatsApp sent via Twilio (text) to ${request.to}: ${result.sid}`,
      );

      return { success: true, messageId: result.sid };
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to send WhatsApp via Twilio to ${request.to}:`,
        error,
      );

      if (error.code === 21211) {
        throw new Error(
          'Numéro de téléphone invalide. Vérifiez le format (ex: +22961234567)',
        );
      } else if (error.code === 21614) {
        throw new Error(
          'Numéro WhatsApp Twilio invalide. Vérifiez TWILIO_WHATSAPP_NUMBER',
        );
      } else if (error.code === 20003) {
        throw new Error(
          'Identifiants Twilio invalides. Vérifiez TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN',
        );
      }

      throw new Error(
        `Erreur Twilio WhatsApp: ${error.message || "Échec d'envoi WhatsApp"}`,
      );
    }
  }

  // ========================================================================
  // PROVIDER: INFOBIP
  // ========================================================================

  /**
   * Envoie un message via Infobip WhatsApp
   */
  private async sendViaInfobipWhatsApp(
    request: WhatsAppRequest,
  ): Promise<{ success: boolean; messageId?: string }> {
    const apiUrl = this.configService.get<string>('INFOBIP_API_URL');
    const apiKey = this.configService.get<string>('INFOBIP_API_KEY');
    const senderNumber = this.configService.get<string>(
      'INFOBIP_WHATSAPP_NUMBER',
    );

    if (!apiUrl || !apiKey || !senderNumber) {
      throw new Error(
        'Configuration Infobip WhatsApp incomplète. Vérifiez INFOBIP_API_URL, INFOBIP_API_KEY et INFOBIP_WHATSAPP_NUMBER',
      );
    }

    const payload: any = {
      from: senderNumber,
      to: request.to,
    };

    if (request.template) {
      payload.content = {
        templateName: request.template,
        templateData: {
          body: {
            placeholders: request.variables
              ? Object.values(request.variables)
              : [],
          },
        },
        language: 'fr',
      };
    } else {
      payload.content = { text: request.message };
    }

    const response = await fetch(`${apiUrl}/whatsapp/1/message/text`, {
      method: 'POST',
      headers: {
        Authorization: `App ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      this.logger.error('Infobip WhatsApp API error:', errorData);
      throw new Error(
        `Infobip WhatsApp error HTTP ${response.status}: ${JSON.stringify(errorData)}`,
      );
    }

    const result = await response.json();
    const messageId = result.messageId || `infobip-wa-${Date.now()}`;
    this.logger.log(`✅ WhatsApp sent via Infobip to ${request.to}: ${messageId}`);

    return { success: true, messageId };
  }

  // ========================================================================
  // PROVIDER: GENERIC GATEWAY
  // ========================================================================

  /**
   * Envoie un message via Gateway générique
   */
  private async sendViaGateway(
    request: WhatsAppRequest,
  ): Promise<{ success: boolean; messageId?: string }> {
    const gatewayUrl = this.configService.get<string>('WHATSAPP_GATEWAY_URL');
    const apiKey = this.configService.get<string>('WHATSAPP_GATEWAY_API_KEY');

    if (!gatewayUrl || !apiKey) {
      throw new Error(
        'WhatsApp Gateway configuration incomplete. Check WHATSAPP_GATEWAY_URL and WHATSAPP_GATEWAY_API_KEY',
      );
    }

    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to: request.to,
        message: request.message,
        template: request.template,
        variables: request.variables,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `WhatsApp Gateway returned ${response.status}: ${await response.text()}`,
      );
    }

    const result = await response.json();
    this.logger.log(
      `WhatsApp sent via Gateway to ${request.to}: ${result.messageId || 'unknown'}`,
    );

    return {
      success: true,
      messageId: result.messageId || result.id,
    };
  }

  // ========================================================================
  // PROVIDER: MOCK (développement)
  // ========================================================================

  /**
   * Mode mock (développement)
   */
  private async sendMock(
    request: WhatsAppRequest,
  ): Promise<{ success: boolean; messageId?: string }> {
    this.logger.log(`[MOCK WHATSAPP] To: ${request.to}`);
    this.logger.log(`[MOCK WHATSAPP] Template: ${request.template || 'none'}`);
    if (request.template && request.variables) {
      this.logger.log(`[MOCK WHATSAPP] Variables: ${JSON.stringify(request.variables)}`);
      try {
        // v3 : request.variables est déjà un Record<string, string> (variables nommées)
        const rendered = this.templateRegistry.renderBody(
          request.template,
          request.variables as Record<string, string>,
        );
        this.logger.log(`[MOCK WHATSAPP] Rendered:\n${rendered}`);
      } catch (e: any) {
        this.logger.warn(`[MOCK WHATSAPP] Render failed: ${e.message}`);
      }
    } else if (request.message) {
      this.logger.log(`[MOCK WHATSAPP] Message: ${request.message}`);
    }
    this.logger.warn(
      '⚠️  WhatsApp service is in MOCK mode. No messages will be sent. Configure WHATSAPP_PROVIDER=gupshup for production.',
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      messageId: `mock-whatsapp-${Date.now()}`,
    };
  }

  // ========================================================================
  // HELPERS MÉTIER
  // ========================================================================

  /**
   * Formate un message de rappel de facturation
   */
  formatBillingReminderMessage(data: {
    schoolName: string;
    planName: string;
    daysRemaining: number;
    status: string;
    renewalUrl: string;
  }): string {
    const statusText =
      data.status === 'TRIAL_ACTIVE' ? "période d'essai" : 'abonnement';

    return `🔔 *Rappel Academia Helm*

Bonjour,

Votre ${statusText} pour *${data.schoolName}* expire dans *${data.daysRemaining} jour${data.daysRemaining > 1 ? 's' : ''}*.

📋 Plan actuel : ${data.planName}

Pour continuer à bénéficier de tous les services Academia Helm, renouvelez votre abonnement :

${data.renewalUrl}

Cordialement,
L'équipe Academia Helm`.trim();
  }
}
