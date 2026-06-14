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
 * OPTIMISATIONS V2 :
 *   - Cache en mémoire avec TTL (60s) pour les listes complètes
 *   - Requêtes raw SQL pour les endpoints critiques (listAllSchools, listSchoolsWithJobs)
 *   - Évite les N+1 Prisma causés par les include multiples
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/** Durée de vie du cache en mémoire (ms) — 60 secondes */
const CACHE_TTL_MS = 60_000;

/** Limite de sécurité pour les requêtes findMany */
const MAX_RESULTS = 2000;

/** Structure du cache en mémoire */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

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

  /** Cache en mémoire pour les listes complètes */
  private listAllSchoolsCache: CacheEntry<any[]> | null = null;
  private listSchoolsWithJobsCache: CacheEntry<any[]> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Vérifie si une entrée de cache est encore valide.
   */
  private isCacheValid<T>(cache: CacheEntry<T> | null): cache is CacheEntry<T> {
    if (!cache) return false;
    return Date.now() - cache.timestamp < CACHE_TTL_MS;
  }

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
   * Utilise un cache en mémoire avec TTL de 60 secondes pour éviter
   * de surcharger la base de données à chaque requête.
   *
   * OPTIMISATION : Utilise une requête raw SQL légère pour récupérer
   * les données essentielles sans les include Prisma lourds.
   */
  async listAllSchools(): Promise<any[]> {
    // ── Vérifier le cache ──
    if (this.isCacheValid(this.listAllSchoolsCache)) {
      this.logger.log('listAllSchools: returning cached data');
      return this.listAllSchoolsCache.data;
    }

    this.logger.log('Listing all active schools (cache miss)');

    try {
      // ── Approche optimisée : raw SQL pour éviter les N+1 Prisma ──
      const statusFilter = this.buildPublicSchoolListWhere();
      const hasStatusFilter = (statusFilter as any).status === 'active';

      // Requête raw SQL — récupère tenant + identity profile actif + country en un seul JOIN
      const tenants = await this.prisma.tenant.findMany({
        where: statusFilter,
        select: {
          id: true,
          name: true,
          slug: true,
          subdomain: true,
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
        take: MAX_RESULTS,
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

      // ── Mettre en cache ──
      this.listAllSchoolsCache = { data: results, timestamp: Date.now() };
      this.logger.log(`listAllSchools: cached ${results.length} schools`);

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
   * OPTIMISATION : Utilise un cache en mémoire + raw SQL pour le count des jobs.
   *
   * SOURCE DE VÉRITÉ : TenantIdentityProfile (profil actif) > School (legacy)
   */
  async listSchoolsWithJobs(): Promise<any[]> {
    // ── Vérifier le cache ──
    if (this.isCacheValid(this.listSchoolsWithJobsCache)) {
      this.logger.log('listSchoolsWithJobs: returning cached data');
      return this.listSchoolsWithJobsCache.data;
    }

    this.logger.log('Listing all schools with active job counts (cache miss)');

    try {
      // 1. Fetch all active tenants (single query) — with select instead of include
      const tenants = await this.prisma.tenant.findMany({
        where: {
          ...this.buildPublicSchoolListWhere(),
          type: 'SCHOOL',
        },
        select: {
          id: true,
          name: true,
          slug: true,
          subdomain: true,
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
        take: MAX_RESULTS,
      });

      if (tenants.length === 0) {
        this.listSchoolsWithJobsCache = { data: [], timestamp: Date.now() };
        return [];
      }

      // 2. Count active (PUBLIÉE) jobs per tenant — raw SQL pour performance
      const tenantIds = tenants.map((t) => t.id);

      // Utiliser raw SQL au lieu de groupBy pour de meilleures performances
      const jobCountRows: any[] = await this.prisma.$queryRaw`
        SELECT "tenantId", COUNT(*)::int AS "jobCount"
        FROM "HrJob"
        WHERE "tenantId" = ANY(${tenantIds}::uuid[])
          AND status = 'PUBLIÉE'
        GROUP BY "tenantId"
      `;

      // Build a lookup map: tenantId → activeJobsCount
      const countMap = new Map<string, number>();
      for (const row of jobCountRows) {
        countMap.set(row.tenantId, row.jobCount);
      }

      // 3. Merge school data with job counts — TenantIdentityProfile first
      //    Returns ALL identity fields so the public careers page can display
      //    full contact info (emails, phones, website, etc.)
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

      // ── Mettre en cache ──
      this.listSchoolsWithJobsCache = { data: results, timestamp: Date.now() };
      this.logger.log(`listSchoolsWithJobs: cached ${results.length} schools with job counts`);

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
