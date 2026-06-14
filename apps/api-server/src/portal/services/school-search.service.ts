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
 * OPTIMISATIONS :
 *   - Cache distribué Redis via CacheService (partagé entre instances)
 *   - TTL configurable (60s par défaut, data change rarement)
 *   - Prisma findMany avec select ciblé (méthode éprouvée du commit 3873d84)
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';

/** Durée de vie du cache (ms) — 60 secondes */
const CACHE_TTL_MS = 60_000;

/** Clés de cache Redis */
const CACHE_KEY_ALL_SCHOOLS = 'schools:list:all';
const CACHE_KEY_SCHOOLS_WITH_JOBS = 'schools:list:with-jobs';

/** Champs sélectionnés sur le profil d'identité actif */
const IDENTITY_PROFILE_SELECT = {
  schoolName: true,
  schoolAcronym: true,
  schoolType: true,
  logoUrl: true,
  address: true,
  city: true,
  department: true,
  postalCode: true,
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
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Filtre where pour la liste publique : en prod, seuls les tenants actifs
   * sauf si PLATFORM_OWNER_MODE=true ou environnement non-production.
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
      postalCode: identity?.postalCode || school?.postalCode || null,
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
   * Liste tous les établissements actifs (pour sélecteur portail).
   * Utilise Prisma findMany — méthode éprouvée du commit 3873d84.
   * Cache Redis 60s pour éviter les requêtes répétées.
   */
  async listAllSchools(): Promise<any[]> {
    // ── Vérifier le cache Redis ──
    const cached = await this.cacheService.get<any[]>(CACHE_KEY_ALL_SCHOOLS);
    if (cached) {
      this.logger.log('listAllSchools: returning Redis cached data');
      return cached;
    }

    this.logger.log('Listing all active schools (cache miss)');

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

      // ── Mettre en cache Redis ──
      await this.cacheService.set(CACHE_KEY_ALL_SCHOOLS, results, CACHE_TTL_MS);
      this.logger.log(`listAllSchools: cached ${results.length} schools in Redis`);

      return results;
    } catch (error: any) {
      if (error?.code === 'P1001' || error?.message?.includes('Can\'t reach database server')) {
        this.logger.error('Database connection failed:', error.message);
        throw new ServiceUnavailableException(
          'Service temporairement indisponible. Veuillez réessayer plus tard.'
        );
      }
      throw error;
    }
  }

  /**
   * Liste tous les établissements actifs avec le nombre d'offres d'emploi publiées.
   * Prisma findMany + groupBy pour les job counts — méthode éprouvée.
   * Cache Redis 60s.
   */
  async listSchoolsWithJobs(): Promise<any[]> {
    // ── Vérifier le cache Redis ──
    const cached = await this.cacheService.get<any[]>(CACHE_KEY_SCHOOLS_WITH_JOBS);
    if (cached) {
      this.logger.log('listSchoolsWithJobs: returning Redis cached data');
      return cached;
    }

    this.logger.log('Listing all schools with active job counts (cache miss)');

    try {
      // 1. Fetch all active tenants of type SCHOOL
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

      // 3. Merge school data with job counts
      const results = tenants.map((tenant) => {
        const data = this.extractSchoolData(tenant);

        return {
          id: tenant.id,
          tenantId: tenant.id,
          name: tenant.name,
          schoolName: data.schoolName,
          schoolAcronym: data.schoolAcronym,
          tenantName: tenant.name,
          slug: tenant.slug,
          subdomain: tenant.subdomain || null,
          logoUrl: data.logoUrl,
          address: data.address,
          city: data.city,
          department: data.department,
          postalCode: data.postalCode || null,
          country: tenant.country?.name || data.country || null,
          phonePrimary: data.phonePrimary,
          phoneSecondary: data.phoneSecondary,
          primaryEmail: data.primaryEmail,
          website: data.website,
          schoolType: data.schoolType,
          slogan: data.slogan,
          identityVersion: data.identityVersion,
          activeJobsCount: countMap.get(tenant.id) || 0,
        };
      });

      // ── Mettre en cache Redis ──
      await this.cacheService.set(CACHE_KEY_SCHOOLS_WITH_JOBS, results, CACHE_TTL_MS);
      this.logger.log(`listSchoolsWithJobs: cached ${results.length} schools with job counts in Redis`);

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

    this.logger.log(`School search: "${searchTerm}" from IP: ${ipAddress}`);

    try {
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
        take: 20,
      });

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
      if (error?.code === 'P1001' || error?.message?.includes('Can\'t reach database server')) {
        this.logger.error('Database connection failed:', error.message);
        throw new ServiceUnavailableException(
          'Service temporairement indisponible. Veuillez réessayer plus tard.'
        );
      }
      throw error;
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private extractCityFromAddress(address: string): string | null {
    if (!address) return null;
    const parts = address.split(',').map((p) => p.trim());
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
    return null;
  }

  private getSchoolTypeFromLevels(levels: string[]): string | null {
    if (!levels || !Array.isArray(levels) || levels.length === 0) return null;

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
    }
  }
}
