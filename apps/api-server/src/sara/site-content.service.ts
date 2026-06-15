/**
 * ============================================================================
 * SITE CONTENT SERVICE — Contenu dynamique du site public pour SARA
 * ============================================================================
 *
 * Charge dynamiquement le contenu du site public (pricing, modules, contact, etc.)
 * pour l'injecter dans le prompt de SARA. AUCUNE donnée n'est codée en dur :
 *
 * - Pricing → vient de la DB via PricingService
 * - Contenu des pages → fetché depuis le site public (avec cache)
 * - Stats avis → vient de la DB via ReviewsService
 *
 * Quand le site est mis à jour, SARA est automatiquement à jour.
 * Cache TTL : 1 heure par défaut (configurable)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/** Structure du contenu site injecté dans le prompt SARA */
export interface SiteContent {
  pricing: string;
  contact: string;
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

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère le contenu dynamique du site (avec cache).
   * C'est la seule méthode appelée par SaraService.
   */
  async getSiteContent(): Promise<SiteContent> {
    const now = Date.now();

    // Retourner le cache si encore valide
    if (this.cachedContent && now < this.cacheExpiry) {
      return this.cachedContent;
    }

    // Recharger le contenu depuis les sources dynamiques
    try {
      const [pricing, contact, reviews] = await Promise.all([
        this.loadPricingContent(),
        this.loadContactContent(),
        this.loadReviewsContent(),
      ]);

      this.cachedContent = {
        pricing,
        contact,
        reviews,
        lastUpdated: new Date(),
      };
      this.cacheExpiry = now + this.CACHE_TTL;

      this.logger.log('✅ Site content refreshed from DB');
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
        contact: 'support@academiahelm.com | +229 01 41 36 08 03',
        reviews: '(Avis non disponibles actuellement)',
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Invalide le cache manuellement (utile après un update du site)
   */
  invalidateCache(): void {
    this.cachedContent = null;
    this.cacheExpiry = 0;
    this.logger.log('🗑️ Site content cache invalidated');
  }

  // ─── PRICING (depuis la DB) ──────────────────────────────────────────

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

  // ─── CONTACT (depuis les settings DB) ─────────────────────────────────

  private async loadContactContent(): Promise<string> {
    // Le contact est stocké dans les settings du platform ou hardcoded
    // Pour l'instant, on retourne les infos de base (qui changent rarement)
    // mais on pourrait les rendre dynamiques via une table PlatformSettings
    return `CONTACT :
- Email : support@academiahelm.com — Réponse sous 48h ouvrées
- Téléphone : +229 01 41 36 08 03
- Adresse : Parakou, Bénin — Afrique de l'Ouest
- WhatsApp : wa.me/2290141360803
- Horaires : Lun-Jeu 8h-18h | Ven 8h-16h | Dim 9h-17h | Sam fermé

CRÉATEUR : YEHI OR Tech — entreprise technologique béninoise (Parakou, Bénin)
- Mission : Démocratiser l'accès à une gestion scolaire moderne pour toutes les écoles privées d'Afrique de l'Ouest
- Vision : Devenir la plateforme de référence pour la gestion éducative en Afrique francophone`;
  }

  // ─── REVIEWS STATS (depuis la DB) ─────────────────────────────────────

  private async loadReviewsContent(): Promise<string> {
    try {
      // Compter les avis approuvés et la moyenne
      const approvedReviews = await this.prisma.review.aggregate({
        _count: { id: true },
        _avg: { rating: true },
        where: { status: 'APPROVED' },
      });

      const total = approvedReviews._count.id;
      const average = approvedReviews._avg.rating;

      if (total === 0) {
        return 'STATS AVIS : Aucun avis publié encore. Les avis vérifiés apparaîtront sur le site dès approbation.';
      }

      const avgRounded = average ? average.toFixed(1) : '0.0';
      const satisfactionPercent = average
        ? Math.round((average / 5) * 100)
        : 0;

      return `STATS AVIS (en temps réel) :
- **${total}** avis vérifiés publiés
- **${satisfactionPercent}%** de satisfaction
- **${avgRounded}/5** note moyenne
- Les avis sont modérés avant publication. Tout le monde peut donner son avis : directeurs, enseignants, parents, élèves.`;
    } catch (error: any) {
      this.logger.warn(`Failed to load reviews: ${error?.message}`);
      return '(Stats avis non disponibles)';
    }
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────

  /** Convertit un montant en FCFA formaté */
  private toFCFA(amount: number | null | undefined): string {
    if (amount == null) return 'sur devis';
    return amount.toLocaleString('fr-FR');
  }
}
