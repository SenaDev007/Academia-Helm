/**
 * ============================================================================
 * SCHOOL SEARCH SERVICE - RECHERCHE PUBLIQUE D'ÉTABLISSEMENTS
 * ============================================================================
 * 
 * Service pour la recherche publique d'établissements avec rate limiting
 * 
 * SOURCE DE VÉRITÉ : TenantIdentityProfile (versionnée, active)
 * Rétrocompatibilité : School (table legacy, fallback si pas de profil actif)
 * 
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/** Champs sélectionnés sur le profil d'identité actif */
const IDENTITY_PROFILE_SELECT = {
  schoolName: true,
  schoolAcronym: true,
  schoolType: true,
  logoUrl: true,
  address: true,
  city: true,
  department: true,
  phonePrimary: true,
  phoneSecondary: true,
  email: true,
  website: true,
  slogan: true,
  country: true,
  version: true,
};

/** Champs sélectionnés sur la table School (fallback) */
const SCHOOL_SELECT = {
  name: true,
  logo: true,
  address: true,
  city: true,
  primaryPhone: true,
  primaryEmail: true,
  educationLevels: true,
};

@Injectable()
export class SchoolSearchService {
  private readonly logger = new Logger(SchoolSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Liste publique portail : en prod, seuls les tenants `status: active` sauf si
   * PLATFORM_OWNER_MODE=true ou environnement non-production (tests / plateforme).
   * (Le modèle Tenant n'a pas deletedAt / isActive — le filtre métier est `status`.)
   */
  private buildPublicSchoolListWhere(): Prisma.TenantWhereInput {
    const platformOwner =
      this.configService.get<string>('PLATFORM_OWNER_MODE')?.trim().toLowerCase() === 'true';
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    if (platformOwner || nodeEnv !== 'production') {
      return {};
    }
    return { status: 'active' };
  }

  /**
   * Extrait les données d'identité d'un tenant en privilégiant le profil actif
   * (TenantIdentityProfile) par rapport à la table School (legacy).
   * Le profil d'identité est la source légale de vérité — il est versionné et
   * mis à jour via l'onglet Identité des Paramètres.
   */
  private extractSchoolData(tenant: any) {
    const identity = tenant.identityProfiles?.[0] ?? null;
    const school = tenant.schools ?? null;

    return {
      schoolName: identity?.schoolName || school?.name || tenant.name,
      schoolAcronym: identity?.schoolAcronym || school?.abbreviation || null,
      logoUrl: identity?.logoUrl || school?.logo || null,
      address: identity?.address || school?.address || null,
      city: identity?.city || school?.city || this.extractCityFromAddress(school?.address || '') || null,
      phonePrimary: identity?.phonePrimary || school?.primaryPhone || null,
      phoneSecondary: identity?.phoneSecondary || school?.secondaryPhone || null,
      primaryEmail: identity?.email || school?.primaryEmail || null,
      website: identity?.website || school?.website || null,
      schoolType: identity?.schoolType || this.getSchoolTypeFromLevels(school?.educationLevels || []),
      slogan: identity?.slogan || school?.slogan || null,
      department: identity?.department || school?.department || null,
      country: identity?.country || null,
      identityVersion: identity?.version ?? null,
    };
  }

  /**
   * Recherche publique d'établissements
   * Rate-limited, sécurisé, audité
   */
  async searchSchools(
    searchTerm: string,
    ipAddress?: string,
  ): Promise<any[]> {
    if (!searchTerm || searchTerm.length < 2) {
      throw new BadRequestException('Le terme de recherche doit contenir au moins 2 caractères');
    }

    // Rate limiting basique (peut être amélioré avec Redis)
    // Pour l'instant, on log juste
    this.logger.log(`School search: "${searchTerm}" from IP: ${ipAddress}`);

    try {
      // Recherche dans tous les tenants actifs (même critère que listAllSchools)
      const tenants = await this.prisma.tenant.findMany({
        where: {
          status: 'active',
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { slug: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        include: {
          schools: { select: SCHOOL_SELECT },
          identityProfiles: {
            where: { isActive: true },
            take: 1,
            orderBy: { version: 'desc' },
            select: IDENTITY_PROFILE_SELECT,
          },
          country: {
            select: {
              name: true,
              code: true,
            },
          },
        },
        take: 20, // Limiter à 20 résultats
      });

      // Formater les résultats
      const results = tenants.map((tenant) => {
        const data = this.extractSchoolData(tenant);

        return {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: data.logoUrl,
          city: data.city,
          schoolType: data.schoolType,
        };
      });

      // Logger la recherche (non-bloquant)
      this.logSearch(searchTerm, ipAddress, results.length).catch((err) => {
        this.logger.warn('Failed to log search (non-blocking):', err?.message);
      });

      return results;
    } catch (error: any) {
      // ✅ Gestion d'erreur Prisma avec message clair
      if (error?.code === 'P1001' || error?.message?.includes('Can\'t reach database server')) {
        this.logger.error('Database connection failed:', error.message);
        throw new ServiceUnavailableException(
          'Service temporairement indisponible. Veuillez réessayer plus tard.'
        );
      }
      // Propager les autres erreurs
      throw error;
    }
  }

  /**
   * Liste tous les établissements actifs (pour sélecteur portail).
   * Inclut tous les tenants actifs (type SCHOOL ou autre) pour afficher toutes les écoles.
   */
  async listAllSchools(): Promise<any[]> {
    this.logger.log('Listing all active schools');

    try {
      const tenants = await this.prisma.tenant.findMany({
        where: this.buildPublicSchoolListWhere(),
        include: {
          schools: { select: SCHOOL_SELECT },
          identityProfiles: {
            where: { isActive: true },
            take: 1,
            orderBy: { version: 'desc' },
            select: IDENTITY_PROFILE_SELECT,
          },
          country: {
            select: {
              name: true,
              code: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      // Formater les résultats
      const results = tenants.map((tenant) => {
        const data = this.extractSchoolData(tenant);

        return {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          subdomain: tenant.subdomain || null,
          logoUrl: data.logoUrl,
          city: data.city,
          primaryPhone: data.phonePrimary,
          primaryEmail: data.primaryEmail,
          address: data.address,
          schoolType: data.schoolType,
          country: tenant.country?.name || data.country || null,
        };
      });

      return results;
    } catch (error: any) {
      // ✅ Gestion d'erreur Prisma avec message clair
      if (error?.code === 'P1001' || error?.message?.includes('Can\'t reach database server')) {
        this.logger.error('Database connection failed:', error.message);
        throw new ServiceUnavailableException(
          'Service temporairement indisponible. Veuillez réessayer plus tard.'
        );
      }
      // Propager les autres erreurs
      throw error;
    }
  }

  /**
   * Liste tous les établissements actifs avec le nombre d'offres d'emploi publiées.
   * Single-query approach: fetches all schools then counts active (PUBLIÉE) jobs per tenant.
   * Used by the public /jobs careers page to avoid N+1 parallel API calls.
   *
   * SOURCE DE VÉRITÉ : TenantIdentityProfile (profil actif) > School (legacy)
   */
  async listSchoolsWithJobs(): Promise<any[]> {
    this.logger.log('Listing all schools with active job counts');

    try {
      // 1. Fetch all active tenants (single query)
      const tenants = await this.prisma.tenant.findMany({
        where: {
          ...this.buildPublicSchoolListWhere(),
          type: 'SCHOOL',
        },
        include: {
          schools: { select: SCHOOL_SELECT },
          identityProfiles: {
            where: { isActive: true },
            take: 1,
            orderBy: { version: 'desc' },
            select: IDENTITY_PROFILE_SELECT,
          },
          country: {
            select: {
              name: true,
              code: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      if (tenants.length === 0) return [];

      // 2. Count active (PUBLIÉE) jobs per tenant in a single groupBy query
      const tenantIds = tenants.map((t) => t.id);
      const jobCounts = await this.prisma.hrJob.groupBy({
        by: ['tenantId'],
        where: {
          tenantId: { in: tenantIds },
          status: 'PUBLIÉE',
        },
        _count: { id: true },
      });

      // Build a lookup map: tenantId → activeJobsCount
      const countMap = new Map<string, number>();
      for (const row of jobCounts) {
        countMap.set(row.tenantId, row._count.id);
      }

      // 3. Merge school data with job counts — TenantIdentityProfile first
      const results = tenants.map((tenant) => {
        const data = this.extractSchoolData(tenant);

        return {
          id: tenant.id,
          tenantId: tenant.id,
          name: tenant.name,
          schoolName: data.schoolName,
          tenantName: tenant.name,
          slug: tenant.slug,
          subdomain: tenant.subdomain || null,
          logoUrl: data.logoUrl,
          city: data.city,
          primaryPhone: data.phonePrimary,
          primaryEmail: data.primaryEmail,
          address: data.address,
          schoolType: data.schoolType,
          slogan: data.slogan,
          country: tenant.country?.name || data.country || null,
          activeJobsCount: countMap.get(tenant.id) || 0,
        };
      });

      return results;
    } catch (error: any) {
      if (error?.code === 'P1001' || error?.message?.includes('Can\'t reach database server')) {
        this.logger.error('Database connection failed:', error.message);
        throw new ServiceUnavailableException(
          'Service temporairement indisponible. Veuillez réessayer plus tard.',
        );
      }
      throw error;
    }
  }

  /**
   * Extrait la ville de l'adresse
   */
  private extractCityFromAddress(address: string): string | null {
    if (!address) return null;

    // Tentative simple d'extraction (peut être améliorée)
    const parts = address.split(',').map((p) => p.trim());
    if (parts.length > 1) {
      return parts[parts.length - 1]; // Dernière partie = ville généralement
    }
    return null;
  }

  /**
   * Détermine le type d'école depuis les niveaux
   */
  private getSchoolTypeFromLevels(levels: string[]): string | null {
    if (levels.length === 0) return null;

    const hasPrimaire = levels.some((l) =>
      l.toUpperCase().includes('PRIMAIRE'),
    );
    const hasSecondaire = levels.some((l) =>
      l.toUpperCase().includes('SECONDAIRE'),
    );

    if (hasPrimaire && hasSecondaire) return 'MIXTE';
    if (hasPrimaire) return 'PRIMAIRE';
    if (hasSecondaire) return 'SECONDAIRE';

    return null;
  }

  /**
   * Log la recherche pour audit et rate limiting
   */
  private async logSearch(
    searchTerm: string,
    ipAddress?: string,
    resultsCount: number = 0,
  ): Promise<void> {
    try {
      await this.prisma.schoolSearchLog.create({
        data: {
          searchTerm,
          ipAddress: ipAddress || null,
          resultsCount,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log school search', error);
      // Ne pas bloquer la recherche si le log échoue
    }
  }
}
