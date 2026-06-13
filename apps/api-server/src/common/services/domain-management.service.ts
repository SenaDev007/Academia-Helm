/**
 * ============================================================================
 * DOMAIN MANAGEMENT SERVICE - GESTION AUTOMATISÉE DES SOUS-DOMAINES
 * ============================================================================
 *
 * Service pour créer/supprimer automatiquement les sous-domaines d'écoles
 * dans Cloudflare (DNS) et Vercel (hébergement) via API.
 *
 * Architecture :
 * - Cloudflare : Gère le DNS (CNAME) + Proxy de sécurité
 * - Vercel : Héberge l'application Next.js + SSL
 * - TenantDomain : Modèle Prisma pour tracker les domaines en DB
 *
 * Flux de création :
 * 1. Cloudflare API → Ajouter CNAME slug.academiahelm.com → cname.vercel-dns.com
 * 2. Vercel API → Ajouter le domaine au projet
 * 3. Vercel vérifie le domaine → SSL émis automatiquement
 * 4. TenantDomain en DB → Tracker le domaine
 *
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

export interface DomainOperationResult {
  success: boolean;
  domain: string;
  cloudflareCreated?: boolean;
  vercelAdded?: boolean;
  vercelVerified?: boolean;
  dbTracked?: boolean;
  error?: string;
}

@Injectable()
export class DomainManagementService {
  private readonly logger = new Logger(DomainManagementService.name);

  private readonly cfToken: string | undefined;
  private readonly cfZoneId: string | undefined;
  private readonly vercelToken: string | undefined;
  private readonly vercelTeamId: string | undefined;
  private readonly vercelProjectId: string | undefined;
  private readonly baseDomain: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.cfToken = this.configService.get('CLOUDFLARE_API_TOKEN');
    this.cfZoneId = this.configService.get('CLOUDFLARE_ZONE_ID');
    this.vercelToken = this.configService.get('VERCEL_API_TOKEN');
    this.vercelTeamId = this.configService.get('VERCEL_TEAM_ID');
    this.vercelProjectId = this.configService.get('VERCEL_PROJECT_ID');
    this.baseDomain = this.configService.get('APP_BASE_DOMAIN') || 'academiahelm.com';

    if (!this.cfToken || !this.cfZoneId) {
      this.logger.warn('⚠️  Cloudflare API credentials not configured — subdomain DNS creation will be skipped');
    }
    if (!this.vercelToken || !this.vercelProjectId) {
      this.logger.warn('⚠️  Vercel API credentials not configured — domain addition to Vercel will be skipped');
    }
  }

  /**
   * Vérifie si le service est configuré pour la gestion automatique des domaines
   */
  isConfigured(): boolean {
    return !!(this.cfToken && this.cfZoneId && this.vercelToken && this.vercelProjectId);
  }

  /**
   * Crée un sous-domaine complet pour une école :
   * 1. CNAME Cloudflare (proxied)
   * 2. Domaine Vercel (+ vérification)
   * 3. TenantDomain en DB
   */
  async createSchoolSubdomain(
    slug: string,
    tenantId: string,
  ): Promise<DomainOperationResult> {
    const subdomain = `${slug}.${this.baseDomain}`;
    const result: DomainOperationResult = {
      success: false,
      domain: subdomain,
    };

    this.logger.log(`🔗 Creating subdomain: ${subdomain} for tenant ${tenantId}`);

    // Étape 1 : Ajouter le CNAME dans Cloudflare
    if (this.cfToken && this.cfZoneId) {
      const cfResult = await this.addCloudflareCname(slug);
      result.cloudflareCreated = cfResult.success;
      if (!cfResult.success) {
        result.error = `Cloudflare: ${cfResult.error}`;
        this.logger.error(`❌ Cloudflare CNAME failed for ${subdomain}: ${cfResult.error}`);
        // On continue même si Cloudflare échoue — on essaie Vercel quand même
      }
    } else {
      this.logger.warn('⚠️  Skipping Cloudflare CNAME — credentials not configured');
      result.cloudflareCreated = false;
    }

    // Étape 2 : Ajouter le domaine dans Vercel
    if (this.vercelToken && this.vercelProjectId) {
      const vercelAddResult = await this.addVercelDomain(subdomain);
      result.vercelAdded = vercelAddResult.success;
      if (!vercelAddResult.success) {
        result.error = `${result.error ? result.error + ' | ' : ''}Vercel: ${vercelAddResult.error}`;
        this.logger.error(`❌ Vercel domain addition failed for ${subdomain}: ${vercelAddResult.error}`);
      } else {
        // Étape 3 : Vérifier le domaine dans Vercel (déclenche l'émission du certificat SSL)
        // Attendre un délai pour la propagation DNS
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const vercelVerifyResult = await this.verifyVercelDomain(subdomain);
        result.vercelVerified = vercelVerifyResult.verified;
        if (!vercelVerifyResult.verified) {
          this.logger.warn(
            `⚠️  Vercel domain verification pending for ${subdomain}: ${vercelVerifyResult.error || 'DNS propagation delay'}`,
          );
        }
      }
    } else {
      this.logger.warn('⚠️  Skipping Vercel domain — credentials not configured');
      result.vercelAdded = false;
    }

    // Étape 4 : Enregistrer dans la DB (TenantDomain)
    try {
      const existingDomain = await this.prisma.tenantDomain.findUnique({
        where: {
          tenantId_domain: {
            tenantId,
            domain: subdomain,
          },
        },
      });

      if (existingDomain) {
        // Mettre à jour si déjà existant
        await this.prisma.tenantDomain.update({
          where: { id: existingDomain.id },
          data: {
            isActive: true,
            isPrimary: true,
            verifiedAt: result.vercelVerified ? new Date() : existingDomain.verifiedAt,
          },
        });
        this.logger.log(`📝 Updated existing TenantDomain for ${subdomain}`);
      } else {
        // Créer une nouvelle entrée
        await this.prisma.tenantDomain.create({
          data: {
            tenantId,
            domain: subdomain,
            isPrimary: true,
            isActive: true,
            verifiedAt: result.vercelVerified ? new Date() : null,
          },
        });
        this.logger.log(`📝 Created TenantDomain for ${subdomain}`);
      }
      result.dbTracked = true;
    } catch (error) {
      this.logger.error(`❌ Failed to track domain in DB for ${subdomain}: ${error.message}`);
      result.dbTracked = false;
    }

    // Succès global si au moins Cloudflare OU Vercel a fonctionné
    result.success = !!(result.cloudflareCreated || result.vercelAdded);

    if (result.success) {
      this.logger.log(`✅ Subdomain ${subdomain} created successfully (CF: ${result.cloudflareCreated}, Vercel: ${result.vercelAdded}, DB: ${result.dbTracked})`);
    }

    return result;
  }

  /**
   * Supprime un sous-domaine (quand une école est supprimée ou désactivée)
   */
  async deleteSchoolSubdomain(slug: string, tenantId: string): Promise<DomainOperationResult> {
    const subdomain = `${slug}.${this.baseDomain}`;
    const result: DomainOperationResult = {
      success: false,
      domain: subdomain,
    };

    this.logger.log(`🔗 Deleting subdomain: ${subdomain} for tenant ${tenantId}`);

    // Supprimer de Cloudflare
    if (this.cfToken && this.cfZoneId) {
      const cfResult = await this.deleteCloudflareCname(slug);
      result.cloudflareCreated = !cfResult.success; // false = supprimé
    }

    // Supprimer de Vercel
    if (this.vercelToken && this.vercelProjectId) {
      const vercelResult = await this.deleteVercelDomain(subdomain);
      result.vercelAdded = !vercelResult.success; // false = supprimé
    }

    // Marquer comme inactif dans la DB (ne pas supprimer l'enregistrement)
    try {
      await this.prisma.tenantDomain.updateMany({
        where: {
          tenantId,
          domain: subdomain,
        },
        data: {
          isActive: false,
        },
      });
      result.dbTracked = true;
    } catch (error) {
      this.logger.error(`❌ Failed to deactivate domain in DB: ${error.message}`);
    }

    result.success = true;
    this.logger.log(`✅ Subdomain ${subdomain} deleted/deactivated`);
    return result;
  }

  /**
   * Vérifie le statut d'un domaine dans Vercel
   */
  async checkDomainStatus(domain: string): Promise<{
    vercelConfigured: boolean;
    vercelVerified: boolean;
    cloudflareProxied: boolean;
    dbTracked: boolean;
  }> {
    const status = {
      vercelConfigured: false,
      vercelVerified: false,
      cloudflareProxied: false,
      dbTracked: false,
    };

    // Vérifier dans Vercel
    if (this.vercelToken && this.vercelProjectId) {
      try {
        const vercelDomain = await this.getVercelDomainInfo(domain);
        status.vercelConfigured = !!vercelDomain;
        status.vercelVerified = vercelDomain?.verified === true;
      } catch {
        // Domaine pas dans Vercel
      }
    }

    // Vérifier dans Cloudflare
    if (this.cfToken && this.cfZoneId) {
      try {
        const cfRecord = await this.getCloudflareDnsRecord(domain);
        status.cloudflareProxied = cfRecord?.proxied === true;
      } catch {
        // Enregistrement pas dans Cloudflare
      }
    }

    // Vérifier dans la DB
    const dbDomain = await this.prisma.tenantDomain.findFirst({
      where: { domain, isActive: true },
    });
    status.dbTracked = !!dbDomain;

    return status;
  }

  /**
   * Réessaie la vérification d'un domaine Vercel (utile si la propagation DNS était lente)
   */
  async retryVerification(slug: string, tenantId: string): Promise<DomainOperationResult> {
    const subdomain = `${slug}.${this.baseDomain}`;

    if (!this.vercelToken || !this.vercelProjectId) {
      return {
        success: false,
        domain: subdomain,
        error: 'Vercel API credentials not configured',
      };
    }

    const verifyResult = await this.verifyVercelDomain(subdomain);

    if (verifyResult.verified) {
      // Mettre à jour la DB
      await this.prisma.tenantDomain.updateMany({
        where: { tenantId, domain: subdomain },
        data: { verifiedAt: new Date() },
      });
    }

    return {
      success: verifyResult.verified,
      domain: subdomain,
      vercelVerified: verifyResult.verified,
      error: verifyResult.error,
    };
  }

  // ============================================================================
  // MÉTHODES PRIVÉES — CLOUDFLARE
  // ============================================================================

  /**
   * Ajoute un enregistrement CNAME dans Cloudflare
   */
  private async addCloudflareCname(slug: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Vérifier si l'enregistrement existe déjà
      const existingRecord = await this.getCloudflareDnsRecord(`${slug}.${this.baseDomain}`);
      if (existingRecord) {
        this.logger.log(`CNAME ${slug}.${this.baseDomain} already exists in Cloudflare (id: ${existingRecord.id})`);
        return { success: true };
      }

      // Créer l'enregistrement CNAME
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.cfZoneId}/dns_records`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.cfToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'CNAME',
            name: slug,
            content: 'cname.vercel-dns.com',
            proxied: true, // ☁️ Orange cloud = Cloudflare proxy activé
            ttl: 1, // Auto
          }),
        },
      );

      const data = await response.json() as any;

      if (!data.success) {
        const errorMsg = data.errors?.[0]?.message || 'Cloudflare API error';
        return { success: false, error: errorMsg };
      }

      this.logger.log(`✅ CNAME ${slug}.${this.baseDomain} added to Cloudflare (proxied)`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Supprime un enregistrement CNAME de Cloudflare
   */
  private async deleteCloudflareCname(slug: string): Promise<{ success: boolean; error?: string }> {
    try {
      const existingRecord = await this.getCloudflareDnsRecord(`${slug}.${this.baseDomain}`);
      if (!existingRecord) {
        this.logger.log(`CNAME ${slug}.${this.baseDomain} not found in Cloudflare — nothing to delete`);
        return { success: true };
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.cfZoneId}/dns_records/${existingRecord.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.cfToken}`,
          },
        },
      );

      const data = await response.json() as any;
      if (!data.success) {
        return { success: false, error: data.errors?.[0]?.message || 'Cloudflare delete error' };
      }

      this.logger.log(`✅ CNAME ${slug}.${this.baseDomain} deleted from Cloudflare`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Récupère un enregistrement DNS Cloudflare par nom
   */
  private async getCloudflareDnsRecord(
    domain: string,
  ): Promise<{ id: string; proxied: boolean } | null> {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.cfZoneId}/dns_records?name=${domain}`,
        {
          headers: {
            Authorization: `Bearer ${this.cfToken}`,
          },
        },
      );

      const data = await response.json() as any;
      if (data.success && data.result?.length > 0) {
        return {
          id: data.result[0].id,
          proxied: data.result[0].proxied,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // MÉTHODES PRIVÉES — VERCEL
  // ============================================================================

  /**
   * Ajoute un domaine au projet Vercel
   */
  private async addVercelDomain(domain: string): Promise<{ success: boolean; error?: string }> {
    try {
      const url = this.vercelTeamId
        ? `https://api.vercel.com/v10/projects/${this.vercelProjectId}/domains?teamId=${this.vercelTeamId}`
        : `https://api.vercel.com/v10/projects/${this.vercelProjectId}/domains`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.vercelToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: domain }),
      });

      const data = await response.json() as any;

      // 409 = domaine déjà existant — pas une erreur
      if (response.status === 409) {
        this.logger.log(`Domain ${domain} already exists in Vercel`);
        return { success: true };
      }

      if (!response.ok) {
        const errorMsg = data.error?.message || data.message || 'Vercel API error';
        return { success: false, error: errorMsg };
      }

      this.logger.log(`✅ Domain ${domain} added to Vercel project`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Vérifie un domaine dans Vercel (déclenche la vérification SSL)
   */
  private async verifyVercelDomain(domain: string): Promise<{ verified: boolean; error?: string }> {
    try {
      const url = this.vercelTeamId
        ? `https://api.vercel.com/v10/projects/${this.vercelProjectId}/domains/${domain}/verify?teamId=${this.vercelTeamId}`
        : `https://api.vercel.com/v10/projects/${this.vercelProjectId}/domains/${domain}/verify`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.vercelToken}`,
        },
      });

      const data = await response.json() as any;

      if (data.verified) {
        this.logger.log(`✅ Domain ${domain} verified in Vercel (SSL certificate issued)`);
        return { verified: true };
      }

      // Pas encore vérifié — probablement propagation DNS en cours
      const error = data.error?.message || data.verification?.[0]?.reason || 'Verification pending';
      return { verified: false, error };
    } catch (error) {
      return { verified: false, error: error.message };
    }
  }

  /**
   * Récupère les informations d'un domaine dans Vercel
   */
  private async getVercelDomainInfo(
    domain: string,
  ): Promise<{ verified: boolean; [key: string]: any } | null> {
    try {
      const url = this.vercelTeamId
        ? `https://api.vercel.com/v10/projects/${this.vercelProjectId}/domains/${domain}?teamId=${this.vercelTeamId}`
        : `https://api.vercel.com/v10/projects/${this.vercelProjectId}/domains/${domain}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.vercelToken}`,
        },
      });

      if (!response.ok) return null;

      const data = await response.json() as any;
      return {
        verified: data.verified === true,
        ...data,
      };
    } catch {
      return null;
    }
  }

  /**
   * Supprime un domaine du projet Vercel
   */
  private async deleteVercelDomain(domain: string): Promise<{ success: boolean; error?: string }> {
    try {
      const url = this.vercelTeamId
        ? `https://api.vercel.com/v10/projects/${this.vercelProjectId}/domains/${domain}?teamId=${this.vercelTeamId}`
        : `https://api.vercel.com/v10/projects/${this.vercelProjectId}/domains/${domain}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.vercelToken}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        const data = await response.json() as any;
        return { success: false, error: data.error?.message || 'Vercel delete error' };
      }

      this.logger.log(`✅ Domain ${domain} removed from Vercel`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
