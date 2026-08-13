/**
 * ============================================================================
 * SITE CONTENT SERVICE — Contenu dynamique du site public pour SARA
 * ============================================================================
 *
 * ⚠️ RÔLE STRICT : Ce service ne charge QUE le PRICING depuis la base de données.
 *
 * Sarah (widget landing page) a un accès DB LIMITÉ au pricing uniquement :
 *   - Plans d'abonnement (PricingPlan — pricing_plans)
 *   - Configuration pricing (PricingConfig — frais d'activation, add-ons)
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

  /**
   * Charge le contenu pricing depuis la DB.
   *
   * ⭐ Aligné sur le contrat d'abonnement Academia Helm (Article 4) :
   *   - 4 plans : Helm Essentiel / Helm Croissance / Helm Performance / Helm Institution
   *   - Facturation annuelle uniquement (plus d'option mensuelle)
   *   - Frais d'activation uniformes : 300 000 FCFA
   *   - Tranches d'élèves : 1-50, 51-150, 151-400, 401+
   *   - Add-ons : bilingue 50 000 FCFA/an, WhatsApp gratuit, SMS/Email/Voice au prix coûtant
   */
  private async loadPricingContent(): Promise<string> {
    try {
      // ⭐ Utiliser pricing_plans (table dynamique source de vérité — codes SEED/GROW/LEAD/NETWORK)
      const plans = await this.prisma.pricingPlan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
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
        'GRILLE TARIFAIRE (données en temps réel du site — contrat Article 4) :',
        '',
        'FACTURATION ANNUELLE UNIQUEMENT — pas d\'option mensuelle.',
        'Frais d\'activation uniques : 300 000 FCFA (payables à la signature, uniformes quel que soit le plan).',
        '',
        'PLANS D\'ABONNEMENT (par tranche d\'élèves) :',
      ];

      for (const plan of plans) {
        const studentRange = plan.studentMax == null
          ? `${plan.studentMin} élèves et +`
          : `${plan.studentMin} à ${plan.studentMax} élèves`;
        const yearlyFCFA = this.toFCFA(plan.yearlyAmount);
        const setupFCFA = this.toFCFA(plan.initialFee ?? config?.initialSubscriptionFee);

        lines.push(
          `- **${plan.name}** (${plan.code}) : ${studentRange} — Frais annuels ${yearlyFCFA} FCFA/an + Frais d'activation ${setupFCFA} FCFA (one-shot)`,
        );
      }

      // Coût total Année 1 pour chaque plan
      lines.push('');
      lines.push('COÛT TOTAL ANNÉE 1 (activation + frais annuels) :');
      for (const plan of plans) {
        const total = (plan.yearlyAmount ?? 0) + (plan.initialFee ?? config?.initialSubscriptionFee ?? 0);
        lines.push(
          `- ${plan.name} : ${this.toFCFA(total)} FCFA`,
        );
      }

      if (config) {
        lines.push('');
        lines.push('TOUS LES PLANS INCLUENT (sans exception) :');
        lines.push('- 21 modules métier + 6 modules complémentaires (27 modules au total)');
        lines.push('- Web + Desktop + Mobile — Offline-first');
        lines.push('- Agents IA : ORION (analytique), SARA (closing & guide), ATLAS (exécution)');
        lines.push('- Paiements en ligne (FedaPay/FeexPay)');
        lines.push('- Multi-caisses, multi-niveaux (Maternelle + Primaire + Secondaire)');
        lines.push('- Reçus PDF/WhatsApp/SMS');
        lines.push('- Personnalisation de marque');
        lines.push('- Site institutionnel');

        lines.push('');
        lines.push('ADD-ONS (Article 4 du contrat) :');
        lines.push(`- Option bilingue FR/EN : ${this.toFCFA(config.bilingualYearlyAddon || 50000)} FCFA/an (en supplément du plan, quel que soit le plan)`);
        lines.push('- WhatsApp : GRATUIT et illimité (inclus dans tous les plans)');
        lines.push('- SMS : facturé au prix coûtant (selon pays de destination)');
        lines.push('- Email : facturé au prix coûtant');
        lines.push('- Voice (appel vocal) : facturé au prix coûtant');

        lines.push('');
        lines.push('MODALITÉS DE PAIEMENT (Article 4) :');
        lines.push('- Frais d\'activation : dus intégralement à la signature');
        lines.push('- Frais annuels : dus chaque année à la date anniversaire');
        lines.push(`- Pénalité de retard : ${config.graceDays || 15} jours après échéance → suspension possible`);
        lines.push('- Réglement : virement bancaire, Mobile Money (FedaPay/FeexPay), ou espèces contre reçu');
      }

      lines.push('');
      lines.push('Réassurance : "Paiement sécurisé via FedaPay/FeexPay • Données conservées en cas de suspension"');

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
