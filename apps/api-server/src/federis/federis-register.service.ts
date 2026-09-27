/**
 * FederisRegisterService — Inscription patronat (multi-pays, hiérarchique)
 *
 * Parcours défini par le cahier des charges Academia Federis §6.3 :
 *   1. Informations institutionnelles (pays, niveau territorial, nom, département
 *      sélectionné dans la liste du pays, patronat national de rattachement)
 *   2. Responsable et accès (nom, email institutionnel, téléphone)
 *   3. Mot de passe → création du compte → redirection /checkout
 *
 * Le patronat existe AVANT les écoles : aucune école n'est nécessaire.
 * Règle « NO ACADEMIC YEAR = NO DATA » : une année scolaire active est créée
 * avec l'espace patronat.
 *
 * Type d'organisation : Federis est dédié aux patronats — le champ n'est plus
 * affiché à l'inscription ; la valeur PATRONAT est appliquée par défaut.
 */

import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';

export class RegisterPatronatDto {
  // Étape 1 — Informations institutionnelles
  countryId!: string;
  /** Niveau institutionnel : NATIONAL ou code du niveau territorial (ex: DEPARTMENT) */
  territorialLevelCode!: string;
  name!: string;
  /** Libellé de l'unité territoriale (ex: Atlantique) — sélectionnée dans la liste du pays */
  territoryName!: string;
  /** Patronat national de rattachement — obligatoire si niveau territorial */
  parentPatronatId?: string;
  /** Obsolète : Federis est dédié aux patronats — PATRONAT appliqué par défaut */
  organismType?: 'PATRONAT' | 'ASSOCIATION' | 'ORGANISME';
  // Étape 2 — Responsable et accès
  responsibleName!: string;
  email!: string;
  phone!: string;
  // Étape 3 — Sécurité
  password!: string;
}

const ORGANISM_TYPES = new Set(['PATRONAT', 'ASSOCIATION', 'ORGANISME']);

@Injectable()
export class FederisRegisterService {
  private readonly logger = new Logger(FederisRegisterService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Slug unique à partir du nom du patronat. */
  private async buildUniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'patronat';
    let slug = base;
    let suffix = 2;
    // Le slug des tenants est unique — on ajoute un suffixe en cas de conflit.
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix++}`;
    }
    return slug;
  }

  /**
   * Pays actifs avec leurs niveaux territoriaux et unités territoriales de
   * référence (départements…). Les territoires alimentent le sélecteur
   * « Département » de l'inscription ; un pays sans territoire configuré
   * conserve un champ texte libre (compatibilité multi-pays).
   */
  async getCountriesWithLevels() {
    const countries = await this.prisma.country.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        currencySymbol: true,
        phonePrefix: true,
        territorialLevels: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          select: { id: true, code: true, label: true, order: true },
        },
        territories: {
          where: { isActive: true },
          orderBy: [{ order: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true, code: true, order: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    return countries;
  }

  /** Patronats nationaux actifs (pour le rattachement des territoriaux). */
  async getNationalPatronats(countryId?: string) {
    return this.prisma.patronat.findMany({
      where: {
        orgLevel: 'NATIONAL',
        status: 'ACTIVE',
        ...(countryId ? { countryId } : {}),
      },
      select: {
        id: true,
        name: true,
        abbreviation: true,
        countryId: true,
        territoryName: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Création complète d'un compte patronat :
   * Tenant (PATRONAT) + Patronat + User + PatronatUser (PATRONAT_ADMIN)
   * + Bureau (Président) + AcademicYear active + audit log.
   */
  async registerPatronat(dto: RegisterPatronatDto) {
    // ── Validations ──────────────────────────────────────────────
    // Federis est dédié aux patronats : le sélecteur n'est plus affiché,
    // PATRONAT est la valeur par défaut (champ accepté pour compatibilité).
    const organismType: 'PATRONAT' | 'ASSOCIATION' | 'ORGANISME' =
      dto.organismType && ORGANISM_TYPES.has(dto.organismType)
        ? dto.organismType
        : 'PATRONAT';
    if (dto.password && dto.password.length < 8) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères.');
    }
    const email = dto.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Adresse électronique institutionnelle invalide.');
    }

    const country = await this.prisma.country.findFirst({
      where: { id: dto.countryId, isActive: true },
      include: { territorialLevels: { where: { isActive: true } } },
    });
    if (!country) throw new NotFoundException('Pays introuvable ou inactif.');

    const level = country.territorialLevels.find((l) => l.code === dto.territorialLevelCode);
    if (!level) {
      throw new BadRequestException(
        "Le niveau organisationnel sélectionné n'est pas configuré pour ce pays.",
      );
    }
    const isNational = level.code === 'NATIONAL' || level.order === 1;

    // Département / unité territoriale : si le pays dispose d'une liste de
    // référence (CountryTerritory), la valeur doit en faire partie — plus de
    // saisie libre (ex: les 12 départements du Bénin).
    if (!isNational && dto.territoryName?.trim()) {
      const referenceTerritories = await this.prisma.countryTerritory.findMany({
        where: { countryId: country.id, isActive: true },
        select: { name: true },
      });
      if (
        referenceTerritories.length > 0 &&
        !referenceTerritories.some(
          (t) => t.name.trim().toLowerCase() === dto.territoryName.trim().toLowerCase(),
        )
      ) {
        throw new BadRequestException(
          `« ${dto.territoryName.trim()} » ne fait pas partie des unités territoriales configurées pour ce pays. Sélectionnez une valeur dans la liste.`,
        );
      }
    }

    // Hiérarchie : un territorial DOIT se rattacher à un national du même pays.
    let parentPatronatId: string | null = null;
    if (!isNational) {
      if (!dto.parentPatronatId) {
        throw new BadRequestException(
          'Un patronat territorial doit être rattaché à un patronat national.',
        );
      }
      const parent = await this.prisma.patronat.findFirst({
        where: {
          id: dto.parentPatronatId,
          orgLevel: 'NATIONAL',
          countryId: country.id,
          status: 'ACTIVE',
        },
      });
      if (!parent) {
        throw new BadRequestException(
          'Patronat national de rattachement introuvable pour ce pays.',
        );
      }
      parentPatronatId = parent.id;
    }

    // Email déjà utilisé ?
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException(
        'Un compte existe déjà avec cette adresse électronique. Connectez-vous ou utilisez une autre adresse.',
      );
    }

    // Nom de patronat déjà utilisé dans le pays ?
    const nameConflict = await this.prisma.patronat.findFirst({
      where: { name: { equals: dto.name.trim(), mode: 'insensitive' }, countryId: country.id },
    });
    if (nameConflict) {
      throw new ConflictException('Un patronat portant ce nom existe déjà dans ce pays.');
    }

    const [responsibleFirstName, ...rest] = dto.responsibleName?.trim().split(/\s+/) ?? [];
    const responsibleLastName = rest.join(' ') || '';

    const slug = await this.buildUniqueSlug(dto.name);
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // ── Transaction : tout ou rien ───────────────────────────────
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Tenant dédié au patronat (cloisonnement des données)
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name.trim(),
          slug,
          countryId: country.id,
          type: 'PATRONAT',
          status: 'active',
          subscriptionStatus: 'TRIAL',
          subscriptionPlan: 'free',
        },
      });

      // 2. Fiche patronat avec hiérarchie
      const patronat = await tx.patronat.create({
        data: {
          tenantId: tenant.id,
          name: dto.name.trim(),
          primaryEmail: email,
          primaryPhone: dto.phone?.trim() || null,
          region: dto.territoryName?.trim() || null,
          scope: isNational ? 'NATIONAL' : level.code,
          orgLevel: isNational ? 'NATIONAL' : 'TERRITORIAL',
          parentPatronatId,
          territoryName: dto.territoryName?.trim() || null,
          territorialLevelId: level.id,
          countryId: country.id,
          subscriptionPlan: 'ESSENTIEL',
          subscriptionStatus: 'PENDING_PAYMENT',
          subscriptionPeriod: 'SCHOOL_YEAR',
          metadata: { organismType },
        },
      });

      // 3. Compte utilisateur du responsable
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          passwordHash: hashedPassword,
          firstName: responsibleFirstName || '',
          lastName: responsibleLastName,
          role: 'PATRONAT_ADMIN',
          status: 'active',
        },
      });

      // 4. Lien PatronatUser — rôle administrateur du patronat
      await tx.patronatUser.create({
        data: {
          patronatId: patronat.id,
          tenantId: tenant.id,
          userId: user.id,
          role: 'PATRONAT_ADMIN',
          isActive: true,
        },
      });

      // 5. Membre du bureau — Président / Responsable
      await tx.patronatBureauMember.create({
        data: {
          tenantId: tenant.id,
          patronatId: patronat.id,
          userId: user.id,
          role: 'PRESIDENT',
          firstName: responsibleFirstName || '',
          lastName: responsibleLastName,
          phone: dto.phone?.trim() || null,
          email,
          isActive: true,
        },
      });

      // 6. Année scolaire active (règle : NO ACADEMIC YEAR = NO DATA)
      const now = new Date();
      const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      const academicYear = await tx.academicYear.create({
        data: {
          tenantId: tenant.id,
          name: `${startYear}-${startYear + 1}`,
          label: `Année scolaire ${startYear}-${startYear + 1}`,
          startDate: new Date(`${startYear}-09-01T00:00:00Z`),
          endDate: new Date(`${startYear + 1}-08-31T23:59:59Z`),
          isActive: true,
          isAutoGenerated: true,
        },
      });

      // 7. Audit log de création
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          action: 'FEDERIS_PATRONAT_REGISTERED',
          resource: 'Patronat',
          resourceId: patronat.id,
          tableName: 'patronats',
          recordId: patronat.id,
          newData: {
            name: patronat.name,
            orgLevel: patronat.orgLevel,
            country: country.code,
            territoryName: patronat.territoryName,
            organismType,
          },
        },
      });

      return { tenant, patronat, user, academicYear };
    });

    this.logger.log(
      `Patronat créé : « ${result.patronat.name} » (${result.patronat.orgLevel}, pays ${country.code})`,
    );

    return {
      success: true,
      patronat: {
        id: result.patronat.id,
        name: result.patronat.name,
        orgLevel: result.patronat.orgLevel,
        tenantId: result.tenant.id,
        slug: result.tenant.slug,
        country: { id: country.id, code: country.code, name: country.name },
        subscriptionPlan: result.patronat.subscriptionPlan,
        subscriptionStatus: result.patronat.subscriptionStatus,
      },
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: 'PATRONAT_ADMIN',
      },
      // Le parcours continue vers /checkout pour l'activation du compte.
      nextStep: 'CHECKOUT',
    };
  }
}
