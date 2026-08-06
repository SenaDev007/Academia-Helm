/**
 * ============================================================================
 * SITE CONTENT SERVICE — Contenu dynamique du site public pour SARA
 * ============================================================================
 *
 * ⚠️ RÔLE STRICT : Ce service ne charge QUE le PRICING depuis la base de données.
 *
 * Sarah (widget landing page) a un accès DB LIMITÉ au pricing uniquement :
 *   - Plans d'abonnement (SubscriptionPlan)
 *   - Configuration pricing (PricingConfig — frais de souscription, add-ons)
 *
 * Sarah N'A PAS ACCÈS à :
 *   - Les données opérationnelles des écoles (élèves, paiements, notes, etc.)
 *   - Les avis/reviews (bien que la table existe, Sarah ne les lit pas)
 *   - Les contacts (informations statiques intégrées au prompt)
 *   - Les données multi-tenant d'aucune école
 *
 * Le contact et les informations entreprise sont des données STATIQUES
 * (rarement modifiées) intégrées directement dans le prompt système.
 *
 * Cache TTL : 1 heure par défaut (configurable)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/** Structure du contenu site injecté dans le prompt SARA */
export interface SiteContent {
  /** ⭐ SEULE donnée chargée dynamiquement depuis la DB */
  pricing: string;
  /** Contact statique (ne change jamais — intégré au prompt) */
  contact: string;
  /** Avis — NON chargés depuis la DB. Placeholder indiquant que les avis
   *  sont visibles sur /avis mais que Sarah n'y a pas accès en lecture. */
  reviews: string;
  lastUpdated: Date;
}

@Injectable()
export class SiteContentService {
  private readonly logger = new Logger(SiteContentService.name);

  /** Cache du contenu site */
  private cachedContent: SiteContent | null = null;
  private cacheExpiry = 0;

  /** TTL du cache en ms (1 heure par défaut) */
  private readonly CACHE_TTL = parseInt(
    process.env.SITE_CONTENT_CACHE_TTL || '3600000',
    10,
  );

  /** Contact statique Academia Helm — ne change jamais */
  private static readonly STATIC_CONTACT = `CONTACT :
- Email : support@academiahelm.com — Réponse sous 48h ouvrées
- Téléphone : +229 01 41 36 08 03
- Adresse : Parakou, Bénin — Afrique de l'Ouest
- WhatsApp : wa.me/2290141360803
- Horaires : Lun-Jeu 8h-18h | Ven 8h-16h | Dim 9h-17h | Sam fermé

CRÉATEUR : YEHI OR Tech — entreprise technologique béninoise (Parakou, Bénin)
- Mission : Démocratiser l'accès à une gestion scolaire moderne pour toutes les écoles privées d'Afrique de l'Ouest
- Vision : Devenir la plateforme de référence pour la gestion éducative en Afrique francophone`;

  /** Placeholder pour les avis — Sarah n'a PAS accès aux avis depuis la DB */
  private static readonly REVIEWS_PLACEHOLDER = `STATS AVIS : Les avis vérifiés sont visibles publiquement sur la page /avis du site. Pour des statistiques précises, orientez le prospect vers /avis. Sarah n'a pas accès en lecture aux avis depuis la DB — elle s'appuie uniquement sur le pricing pour argumenter.`;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère le contenu dynamique du site (avec cache).
   *
   * ⚠️ SEUL le pricing est chargé depuis la DB. Le contact et les reviews
   * sont des données statiques ou placeholders.
   */
  async getSiteContent(): Promise<SiteContent> {
    const now = Date.now();

    // Retourner le cache si encore valide
    if (this.cachedContent && now < this.cacheExpiry) {
      return this.cachedContent;
    }

    // Recharger le pricing depuis la DB (seule source dynamique)
    try {
      const pricing = await this.loadPricingContent();

      this.cachedContent = {
        pricing,
        // Contact statique — jamais chargé depuis la DB
        contact: SiteContentService.STATIC_CONTACT,
        // Reviews : Sarah n'y a pas accès — placeholder
        reviews: SiteContentService.REVIEWS_PLACEHOLDER,
        lastUpdated: new Date(),
      };
      this.cacheExpiry = now + this.CACHE_TTL;

      this.logger.log('✅ Site pricing refreshed from DB (contact & reviews are static)');
      return this.cachedContent;
    } catch (error: any) {
      this.logger.warn(`⚠️ Failed to load site content: ${error?.message}`);

      // Retourner le cache expiré si disponible, sinon un fallback minimal
      if (this.cachedContent) {
        this.logger.warn('Using expired cache as fallback');
        return this.cachedContent;
      }

      return {
        pricing: '(Pricing non disponible — consultez /pricing sur le site)',
        contact: SiteContentService.STATIC_CONTACT,
        reviews: SiteContentService.REVIEWS_PLACEHOLDER,
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Invalide le cache manuellement (utile après un update du pricing)
   */
  invalidateCache(): void {
    this.cachedContent = null;
    this.cacheExpiry = 0;
    this.logger.log('🗑️ Site content cache invalidated');
  }

  // ─── PRICING (depuis la DB — SEULE source dynamique) ─────────────────

  private async loadPricingContent(): Promise<string> {
    try {
      // Récupérer les plans depuis la DB
      const plans = await this.prisma.subscriptionPlan.findMany({
        orderBy: { monthlyPrice: 'asc' },
      });

      // Récupérer la config pricing active
      const config = await this.prisma.pricingConfig.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' },
      });

      if (plans.length === 0) {
        return '(Plans non configurés — consultez /pricing sur le site)';
      }

      const lines: string[] = [
        'GRILLE TARIFAIRE (données en temps réel du site) :',
      ];

      for (const plan of plans) {
        const monthlyFCFA = this.toFCFA(plan.monthlyPrice);
        const yearlyFCFA = this.toFCFA(plan.yearlyPrice);
        const setupFCFA = config
          ? this.toFCFA(config.initialSubscriptionFee)
          : 'sur devis';

        lines.push(
          `- **${plan.name}** (${plan.code}) : ${setupFCFA} FCFA souscription + ${monthlyFCFA} FCFA/mois ou ${yearlyFCFA} FCFA/an — max ${plan.maxSchools} école(s)`,
        );
      }

      if (config) {
        const discount = config.yearlyDiscountPercent || 0;
        if (discount > 0) {
          lines.push(
            `Avantage annuel : **${Math.round(discount)}% de réduction** (environ 2 mois offerts)`,
          );
        }
        lines.push(
          `Tous les plans incluent : 15 modules complets, mode offline/online, support inclus`,
        );

        // Add-ons
        lines.push('');
        lines.push('ADD-ONS OPTIONNELS :');
        if (config.bilingualMonthlyAddon) {
          lines.push(
            `- Bilingue FR/EN : ${this.toFCFA(config.bilingualMonthlyAddon)} FCFA/mois`,
          );
        }
        if (config.schoolAdditionalPrice) {
          lines.push(
            `- École supplémentaire : ${this.toFCFA(config.schoolAdditionalPrice)} FCFA/mois`,
          );
        }
      }

      lines.push(
        'Réassurance : "Paiement sécurisé • Aucun prélèvement automatique • Données conservées en cas de suspension"',
      );

      return lines.join('\n');
    } catch (error: any) {
      this.logger.warn(`Failed to load pricing: ${error?.message}`);
      return '(Pricing non disponible — consultez /pricing sur le site)';
    }
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────

  /** Convertit un montant en FCFA formaté */
  private toFCFA(amount: number | null | undefined): string {
    if (amount == null) return 'sur devis';
    return amount.toLocaleString('fr-FR');
  }
}
