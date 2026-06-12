/**
 * ============================================================================
 * MAP STATS SERVICE - STATISTIQUES CARTE DU BÉNIN POUR ACADEMIA HELM
 * ============================================================================
 *
 * Fournit les statistiques en temps réel des écoles inscrites sur
 * Academia Helm, groupées par département géographique du Bénin.
 *
 * Ces données viennent s'ajouter aux statistiques gouvernementales
 * (EducMaster) affichées sur la carte interactive du portail.
 *
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/** Les 12 départements officiels du Bénin avec leurs variantes de nom */
const BENIN_DEPARTMENTS = [
  {
    code: 'AL',
    name: 'Alibori',
    variants: ['alibori'],
  },
  {
    code: 'AT',
    name: 'Atacora',
    variants: ['atacora'],
  },
  {
    code: 'AQ',
    name: 'Atlantique',
    variants: ['atlantique', 'atlant'],
  },
  {
    code: 'BO',
    name: 'Borgou',
    variants: ['borgou'],
  },
  {
    code: 'CO',
    name: 'Collines',
    variants: ['collines'],
  },
  {
    code: 'DO',
    name: 'Donga',
    variants: ['donga'],
  },
  {
    code: 'KO',
    name: 'Kouffo',
    variants: ['kouffo', 'couffo'],
  },
  {
    code: 'LI',
    name: 'Littoral',
    variants: ['littoral'],
  },
  {
    code: 'MO',
    name: 'Mono',
    variants: ['mono'],
  },
  {
    code: 'OU',
    name: 'Ouémé',
    variants: ['oueme', 'ouémé'],
  },
  {
    code: 'PL',
    name: 'Plateau',
    variants: ['plateau'],
  },
  {
    code: 'ZO',
    name: 'Zou',
    variants: ['zou'],
  },
] as const;

export interface AcademiaSchoolInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  city: string | null;
  schoolType: string | null;
}

export interface DepartmentMapStats {
  code: string;
  name: string;
  academiaSchoolCount: number;
  academiaPublicCount: number;
  academiaPrivateCount: number;
  schools: AcademiaSchoolInfo[];
}

export interface MapStatsResponse {
  departments: DepartmentMapStats[];
  totalSchools: number;
  totalPublic: number;
  totalPrivate: number;
}

@Injectable()
export class MapStatsService {
  private readonly logger = new Logger(MapStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère les statistiques des écoles Academia Helm par département.
   *
   * Stratégie de mapping département :
   * 1. Si School.department est renseigné → matching direct
   * 2. Sinon, extraction depuis School.address (dernière partie après virgule)
   * 3. Sinon, extraction depuis Tenant.name (si contient un nom de département)
   */
  async getMapStats(): Promise<MapStatsResponse> {
    this.logger.log('Fetching Academia Helm map stats by department');

    try {
      // Récupérer tous les tenants actifs avec leur école
      const tenants = await this.prisma.tenant.findMany({
        where: {
          status: 'active',
          type: 'SCHOOL',
        },
        include: {
          schools: {
            select: {
              name: true,
              logo: true,
              address: true,
              city: true,
              department: true,
              educationLevels: true,
            },
          },
        },
      });

      // Initialiser les stats par département
      const deptStats: Map<string, DepartmentMapStats> = new Map();
      for (const dept of BENIN_DEPARTMENTS) {
        deptStats.set(dept.code, {
          code: dept.code,
          name: dept.name,
          academiaSchoolCount: 0,
          academiaPublicCount: 0,
          academiaPrivateCount: 0,
          schools: [],
        });
      }

      let totalSchools = 0;
      let totalPublic = 0;
      let totalPrivate = 0;

      // Classifier chaque tenant/école dans un département
      for (const tenant of tenants) {
        const school = tenant.schools;
        if (!school) continue;

        const deptCode = this.resolveDepartmentCode(
          school.department,
          school.city,
          school.address,
          tenant.name,
        );

        if (!deptCode) {
          // École non classée dans un département — on l'ignore pour la carte
          continue;
        }

        const stats = deptStats.get(deptCode)!;
        const schoolType = this.getSchoolTypeFromLevels(school.educationLevels || []);

        const schoolInfo: AcademiaSchoolInfo = {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: school.logo || null,
          city: school.city || this.extractCityFromAddress(school.address),
          schoolType,
        };

        stats.academiaSchoolCount++;
        stats.schools.push(schoolInfo);

        if (schoolType === 'PRIMAIRE' || schoolType === 'MIXTE') {
          stats.academiaPublicCount++;
        } else if (schoolType === 'SECONDAIRE') {
          stats.academiaPrivateCount++;
        }

        totalSchools++;
        if (schoolType === 'PRIMAIRE' || schoolType === 'MIXTE') {
          totalPublic++;
        } else if (schoolType === 'SECONDAIRE') {
          totalPrivate++;
        }
      }

      return {
        departments: Array.from(deptStats.values()),
        totalSchools,
        totalPublic,
        totalPrivate,
      };
    } catch (error: any) {
      this.logger.error('Failed to fetch map stats:', error.message);
      // Retourner des stats vides en cas d'erreur plutôt que de crasher
      return {
        departments: BENIN_DEPARTMENTS.map((dept) => ({
          code: dept.code,
          name: dept.name,
          academiaSchoolCount: 0,
          academiaPublicCount: 0,
          academiaPrivateCount: 0,
          schools: [],
        })),
        totalSchools: 0,
        totalPublic: 0,
        totalPrivate: 0,
      };
    }
  }

  /**
   * Résout le code département à partir des différents champs disponibles.
   * Priorité : School.department > School.city > School.address > Tenant.name
   */
  private resolveDepartmentCode(
    schoolDepartment: string | null | undefined,
    schoolCity: string | null | undefined,
    schoolAddress: string | null | undefined,
    tenantName: string,
  ): string | null {
    // 1. Champ department explicite
    if (schoolDepartment) {
      const code = this.matchDepartmentCode(schoolDepartment);
      if (code) return code;
    }

    // 2. Champ city
    if (schoolCity) {
      const code = this.matchDepartmentCode(schoolCity);
      if (code) return code;
    }

    // 3. Extraction depuis l'adresse
    const cityFromAddress = this.extractCityFromAddress(schoolAddress);
    if (cityFromAddress) {
      const code = this.matchDepartmentCode(cityFromAddress);
      if (code) return code;
    }

    // 4. Matching depuis le nom du tenant (dernier recours)
    const code = this.matchDepartmentCode(tenantName);
    if (code) return code;

    return null;
  }

  /**
   * Tente de faire correspondre un texte à un code département.
   * Utilise les variantes de noms (insensible à la casse et aux accents).
   */
  private matchDepartmentCode(text: string): string | null {
    if (!text) return null;
    const normalized = this.normalize(text);

    for (const dept of BENIN_DEPARTMENTS) {
      for (const variant of dept.variants) {
        if (normalized.includes(variant)) {
          return dept.code;
        }
      }

      // Vérifier aussi les villes principales par département
      const cities = DEPARTMENT_CITIES[dept.code];
      if (cities) {
        for (const city of cities) {
          if (normalized.includes(city)) {
            return dept.code;
          }
        }
      }
    }

    return null;
  }

  /**
   * Normalise un texte : minuscules, sans accents, sans caractères spéciaux.
   */
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
      .replace(/[^a-z0-9\s]/g, '') // Supprimer les caractères spéciaux
      .trim();
  }

  /**
   * Extrait la ville de l'adresse (dernière partie après virgule).
   */
  private extractCityFromAddress(address: string | null | undefined): string | null {
    if (!address) return null;
    const parts = address.split(',').map((p) => p.trim());
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
    return null;
  }

  /**
   * Détermine le type d'école depuis les niveaux d'éducation.
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
}

/**
 * Villes principales par département (pour le matching quand
 * le champ department n'est pas renseigné mais la ville l'est).
 */
const DEPARTMENT_CITIES: Record<string, string[]> = {
  AL: ['kandi', 'malanville', 'banikoara', 'segbana', 'gogounou', 'karimama'],
  AT: ['natitingou', 'tanguieta', 'boukombe', 'cobly', 'kerou', 'kouande', 'materi', 'pehunco', 'toucountouna'],
  AQ: ['allada', 'abomey-calavi', 'ouidah', 'tori-bossito', 'toffo', 'kpomasse', 'ze', 'calavi'],
  BO: ['parakou', 'ndali', 'tchaourou', 'bembereke', 'kalale', 'perere', 'sinende'],
  CO: ['savalou', 'dassa-zoume', 'bante', 'glazoue', 'ouesse'],
  DO: ['djougou', 'bassila', 'copargo', 'ouake'],
  KO: ['dogbo', 'aplahoue', 'djakotomey', 'klouekanme', 'lalo', 'toviklin'],
  LI: ['cotonou'],
  MO: ['lokossa', 'houeyogbe', 'athieme', 'bopa', 'come', 'grand-popo'],
  OU: ['porto-novo', 'adjara', 'adja-ouere', 'akpro-misserete', 'avrankou', 'bonou', 'dangbo', 'misserete', 'seme-kpodji'],
  PL: ['pobe', 'ifangni', 'ketou', 'sakete'],
  ZO: ['abomey', 'bohicon', 'agbangnizoun', 'cove', 'djidja', 'ouinhi', 'za-kpota', 'zangnanado'],
};
