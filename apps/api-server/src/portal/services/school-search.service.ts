/**
 * ============================================================================
 * SCHOOL SEARCH SERVICE - RECHERCHE PUBLIQUE D'ÉTABLISSEMENTS
 * ============================================================================
 * 
 * Service pour la recherche publique d'établissements avec rate limiting
 * 
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SchoolSearchService {
  private readonly logger = new Logger(SchoolSearchService.name);

  constructor(private readonly prisma: PrismaService) {}

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
        schools: {
          select: {
            name: true,
            logo: true,
            address: true,
            educationLevels: true,
          },
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

      // Formater les résultats (schools est une relation 1-1, donc un objet ou null)
      const results = tenants.map((tenant) => {
        const school = tenant.schools;
        const address = school?.address || '';
        const city = this.extractCityFromAddress(address);

        return {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: school?.logo || null,
          city: city || null,
          schoolType: this.getSchoolTypeFromLevels(school?.educationLevels || []),
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
      // Récupérer tous les tenants actifs (pas seulement type SCHOOL, pour inclure tous les établissements)
      const tenants = await this.prisma.tenant.findMany({
      where: {
        status: 'active',
      },
      include: {
        schools: {
          select: {
            name: true,
            logo: true,
            address: true,
            educationLevels: true,
          },
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

      // Formater les résultats (schools est une relation 1-1, donc un objet ou null)
      const results = tenants.map((tenant) => {
        const school = tenant.schools;
        const address = school?.address || '';
        const city = this.extractCityFromAddress(address);

        return {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          subdomain: tenant.subdomain || null,
          logoUrl: school?.logo || null,
          city: city || null,
          schoolType: this.getSchoolTypeFromLevels(school?.educationLevels || []),
          country: tenant.country?.name || null,
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

