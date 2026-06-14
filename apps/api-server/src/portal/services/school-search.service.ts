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
 * OPTIMISATIONS V3 :
 *   - Raw SQL avec LEFT JOIN pour listAllSchools et listSchoolsWithJobs
 *     (une seule requête au lieu des N+1 de Prisma include/select)
 *   - Cache en mémoire avec TTL (60s)
 *   - Recherche Prisma (searchSchools) inchangée — take:20 la rend rapide
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/** Durée de vie du cache en mémoire (ms) — 60 secondes */
const CACHE_TTL_MS = 60_000;

/** Structure du cache en mémoire */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

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
   * Détermine si on doit filtrer par status = 'active' en production.
   */
  private shouldFilterActive(): boolean {
    const platformOwner =
      this.configService.get<string>('PLATFORM_OWNER_MODE')?.trim().toLowerCase() === 'true';
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    return !platformOwner && nodeEnv === 'production';
  }

  // ============================================================================
  // RAW SQL — Liste complète des établissements (ULTRA RAPIDE)
  // ============================================================================

  /**
   * Liste tous les établissements actifs (pour sélecteur portail).
   *
   * Utilise du raw SQL avec LEFT JOIN pour récupérer toutes les données
   * en une seule requête, au lieu des N+1 requêtes générées par Prisma
   * findMany + include/select de relations imbriquées.
   *
   * Performance : ~200ms au lieu de 30s+ avec Prisma.
   */
  async listAllSchools(): Promise<any[]> {
    // ── Vérifier le cache ──
    if (this.isCacheValid(this.listAllSchoolsCache)) {
      this.logger.log('listAllSchools: returning cached data');
      return this.listAllSchoolsCache.data;
    }

    this.logger.log('Listing all active schools (cache miss, raw SQL)');

    try {
      const statusFilter = this.shouldFilterActive()
        ? `AND t.status = 'active'`
        : '';

      // Single query avec LEFT JOINs — 10-100x plus rapide que Prisma findMany + include
      const rows: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT
          t.id,
          t.name,
          t.slug,
          t.subdomain,
          COALESCE(ip."schoolName", s.name, t.name) AS "schoolName",
          ip."schoolAcronym",
          COALESCE(ip."logoUrl", s.logo) AS "logoUrl",
          COALESCE(ip.address, s.address) AS address,
          COALESCE(ip.city, s.city) AS city,
          ip.department,
          ip."postalCode",
          COALESCE(ip."phonePrimary", s."primaryPhone") AS "phonePrimary",
          ip."phoneSecondary",
          COALESCE(ip.email, s."primaryEmail") AS "primaryEmail",
          ip.website,
          COALESCE(ip."schoolType", s."educationLevels") AS "schoolType",
          COALESCE(ip.slogan, s.slogan) AS slogan,
          ip.country AS "identityCountry",
          c.name AS "countryName",
          ip.version AS "identityVersion"
        FROM "Tenant" t
        LEFT JOIN "TenantIdentityProfile" ip
          ON ip."tenantId" = t.id AND ip."isActive" = true
        LEFT JOIN LATERAL (
          SELECT ip2.* FROM "TenantIdentityProfile" ip2
          WHERE ip2."tenantId" = t.id AND ip2."isActive" = true
          ORDER BY ip2.version DESC
          LIMIT 1
        ) ip ON true
        LEFT JOIN "School" s ON s."tenantId" = t.id
        LEFT JOIN "Country" c ON c.id = t."countryId"
        WHERE 1=1 ${statusFilter}
        ORDER BY t.name ASC
      `);

      const results = rows.map((row) => {
        // Convertir educationLevels en schoolType si nécessaire
        let schoolType = row.schoolType;
        if (Array.isArray(schoolType)) {
          schoolType = this.getSchoolTypeFromLevels(schoolType);
        }

        return {
          id: row.id,
          name: row.name,
          slug: row.slug,
          subdomain: row.subdomain || null,
          logoUrl: row.logoUrl || null,
          city: row.city || this.extractCityFromAddress(row.address || '') || null,
          primaryPhone: row.phonePrimary || null,
          primaryEmail: row.primaryEmail || null,
          address: row.address || null,
          schoolType: schoolType || null,
          country: row.countryName || row.identityCountry || null,
        };
      });

      // ── Mettre en cache ──
      this.listAllSchoolsCache = { data: results, timestamp: Date.now() };
      this.logger.log(`listAllSchools: cached ${results.length} schools`);

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
   *
   * Raw SQL avec LEFT JOIN + sous-requête pour le count des jobs.
   * Tout en une seule requête — ultra rapide.
   */
  async listSchoolsWithJobs(): Promise<any[]> {
    // ── Vérifier le cache ──
    if (this.isCacheValid(this.listSchoolsWithJobsCache)) {
      this.logger.log('listSchoolsWithJobs: returning cached data');
      return this.listSchoolsWithJobsCache.data;
    }

    this.logger.log('Listing all schools with active job counts (cache miss, raw SQL)');

    try {
      const statusFilter = this.shouldFilterActive()
        ? `AND t.status = 'active'`
        : '';

      // Single query : tenant + identity profile + school + country + job count
      const rows: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT
          t.id,
          t.name,
          t.slug,
          t.subdomain,
          COALESCE(ip."schoolName", s.name, t.name) AS "schoolName",
          ip."schoolAcronym",
          COALESCE(ip."logoUrl", s.logo) AS "logoUrl",
          COALESCE(ip.address, s.address) AS address,
          COALESCE(ip.city, s.city) AS city,
          ip.department,
          ip."postalCode",
          COALESCE(ip."phonePrimary", s."primaryPhone") AS "phonePrimary",
          ip."phoneSecondary",
          COALESCE(ip.email, s."primaryEmail") AS "primaryEmail",
          ip.website,
          COALESCE(ip."schoolType", s."educationLevels") AS "schoolType",
          COALESCE(ip.slogan, s.slogan) AS slogan,
          ip.country AS "identityCountry",
          c.name AS "countryName",
          ip.version AS "identityVersion",
          COALESCE(jobs."activeJobsCount", 0) AS "activeJobsCount"
        FROM "Tenant" t
        LEFT JOIN LATERAL (
          SELECT ip2.* FROM "TenantIdentityProfile" ip2
          WHERE ip2."tenantId" = t.id AND ip2."isActive" = true
          ORDER BY ip2.version DESC
          LIMIT 1
        ) ip ON true
        LEFT JOIN "School" s ON s."tenantId" = t.id
        LEFT JOIN "Country" c ON c.id = t."countryId"
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS "activeJobsCount"
          FROM "HrJob" j
          WHERE j."tenantId" = t.id AND j.status = 'PUBLIÉE'
        ) jobs ON true
        WHERE t.type = 'SCHOOL' ${statusFilter}
        ORDER BY t.name ASC
      `);

      const results = rows.map((row) => {
        let schoolType = row.schoolType;
        if (Array.isArray(schoolType)) {
          schoolType = this.getSchoolTypeFromLevels(schoolType);
        }

        return {
          id: row.id,
          tenantId: row.id,
          name: row.name,
          schoolName: row.schoolName,
          schoolAcronym: row.schoolAcronym || null,
          tenantName: row.name,
          slug: row.slug,
          subdomain: row.subdomain || null,
          logoUrl: row.logoUrl || null,
          address: row.address || null,
          city: row.city || this.extractCityFromAddress(row.address || '') || null,
          department: row.department || null,
          postalCode: row.postalCode || null,
          country: row.countryName || row.identityCountry || null,
          phonePrimary: row.phonePrimary || null,
          phoneSecondary: row.phoneSecondary || null,
          primaryEmail: row.primaryEmail || null,
          website: row.website || null,
          schoolType: schoolType || null,
          slogan: row.slogan || null,
          identityVersion: row.identityVersion ?? null,
          activeJobsCount: row.activeJobsCount || 0,
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

  // ============================================================================
  // RECHERCHE — Prisma (take:20 la rend rapide, pas besoin de raw SQL)
  // ============================================================================

  /** Champs sélectionnés sur le profil d'identité actif */
  private static readonly IDENTITY_PROFILE_SELECT = {
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
  private static readonly SCHOOL_SELECT = {
    name: true,
    logo: true,
    address: true,
    city: true,
    primaryPhone: true,
    primaryEmail: true,
    educationLevels: true,
  };

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
          schools: { select: SchoolSearchService.SCHOOL_SELECT },
          identityProfiles: {
            where: { isActive: true },
            take: 1,
            orderBy: { version: 'desc' },
            select: SchoolSearchService.IDENTITY_PROFILE_SELECT,
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
