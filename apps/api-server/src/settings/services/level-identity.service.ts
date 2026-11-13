import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../../common/utils/prisma-helpers';
import { invalidateLevelIdentityCache } from '../../common/context/resolve-level-identity';
import { UpdateSecondaryIdentityDto } from '../dto/secondary-identity.dto';

/**
 * ============================================================================
 * SERVICE IDENTITÉ PAR NIVEAU — SECONDAIRE ≠ MATERNELLE/PRIMAIRE
 * ============================================================================
 * ⭐ 2026-11-13 — Écoles combinées (maternelle+primaire+secondaire) dont le
 * secondaire porte un nom, des contacts et un logo différents.
 *
 * DONNÉES : tenant_level_identity_profiles (1 ligne max par (tenant, niveau)),
 * pattern TenantStamp/TenantSignature. Existence de la ligne = override actif
 * pour les documents du secondaire ; suppression = retour à l'identité unique.
 *
 * DIFFÉRENCES avec IdentityProfileService (identité globale) :
 *   - PAS de versionnement immuable : l'override est un paramétrage pratique,
 *     modifié en place (précédent : PUT identity/card-settings, update direct) ;
 *   - audit quand même obligatoire (logSettingChange 'identity.level.secondary') ;
 *   - les documents PDF ne lisent PAS ce service : ils passent par le helper
 *     commun common/context/resolve-level-identity.ts (cache 60 s).
 *
 * Le site public institutionnel n'utilise PAS ce service (défaut
 * maternelle/primaire — exigence produit).
 * ============================================================================
 */
@Injectable()
export class LevelIdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
  ) {}

  /** Niveau education_levels SECONDAIRE du tenant (FR d'abord, miroir EN ensuite). */
  private async findSecondaryEducationLevel(tenantId: string) {
    const levels = await this.prisma.educationLevel.findMany({
      where: { tenantId, name: { in: ['SECONDAIRE', 'SECONDARY'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    });
    return levels.find((l) => l.name === 'SECONDAIRE') ?? levels[0] ?? null;
  }

  private findExisting(tenantId: string) {
    return this.prisma.tenantLevelIdentityProfile.findFirst({
      where: {
        tenantId,
        educationLevel: { name: { in: ['SECONDAIRE', 'SECONDARY'] } },
      },
    });
  }

  private format(row: any) {
    return {
      schoolName: row.schoolName,
      schoolAcronym: row.schoolAcronym ?? null,
      slogan: row.slogan ?? null,
      phonePrimary: row.phonePrimary ?? null,
      phoneSecondary: row.phoneSecondary ?? null,
      whatsapp: row.whatsapp ?? null,
      email: row.email ?? null,
      website: row.website ?? null,
      address: row.address ?? null,
      city: row.city ?? null,
      department: row.department ?? null,
      postalCode: row.postalCode ?? null,
      country: row.country ?? null,
      logoUrl: row.logoUrl ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * GET /settings/identity/secondary
   * { configured: false } ⇒ le secondaire partage l'identité maternelle/primaire.
   */
  async getSecondaryProfile(tenantId: string) {
    const row = await this.findExisting(tenantId);
    if (!row) {
      return {
        configured: false,
        profile: null,
        message:
          "Le niveau secondaire partage l'identité de l'établissement (maternelle/primaire). " +
          'Configurez PUT /settings/identity/secondary si le secondaire porte un nom différent.',
      };
    }
    return { configured: true, profile: this.format(row) };
  }

  /**
   * PUT /settings/identity/secondary — upsert de l'identité du secondaire.
   * Champs vides/non fournis ⇒ override désactivé pour ce champ (retour au global).
   */
  async upsertSecondaryProfile(tenantId: string, userId: string | null, dto: UpdateSecondaryIdentityDto) {
    const schoolName = (dto.schoolName || '').trim();
    if (!schoolName) {
      throw new BadRequestException('schoolName est requis pour une identité de niveau secondaire');
    }

    const level = await this.findSecondaryEducationLevel(tenantId);
    if (!level) {
      throw new BadRequestException(
        "Aucun niveau SECONDAIRE n'existe pour cet établissement. " +
          "Activez d'abord le secondaire dans Paramètres > Structure.",
      );
    }

    const existing = await this.findExisting(tenantId);

    const toNullable = (v?: string | null) => {
      const t = (v ?? '').trim();
      return t.length > 0 ? t : null;
    };

    const dataFields = {
      schoolName,
      schoolAcronym: toNullable(dto.schoolAcronym),
      slogan: toNullable(dto.slogan),
      phonePrimary: toNullable(dto.phonePrimary),
      phoneSecondary: toNullable(dto.phoneSecondary),
      whatsapp: toNullable(dto.whatsapp),
      email: toNullable(dto.email),
      website: toNullable(dto.website),
      address: toNullable(dto.address),
      city: toNullable(dto.city),
      department: toNullable(dto.department),
      postalCode: toNullable(dto.postalCode),
      country: toNullable(dto.country) ?? 'BJ',
      logoUrl: toNullable(dto.logoUrl),
    };

    let saved: any;
    if (existing) {
      saved = await this.prisma.tenantLevelIdentityProfile.update({
        where: { id: existing.id },
        data: { ...dataFields, ...prismaUpdateDefaults() },
      });
    } else {
      saved = await this.prisma.tenantLevelIdentityProfile.create({
        data: {
          ...prismaCreateDefaults(),
          tenantId,
          educationLevelId: level.id,
          createdBy: userId ?? null,
          ...dataFields,
        },
      });
    }

    invalidateLevelIdentityCache(tenantId);

    // Audit (settingId = null : hors TenantSetting, cf. IdentityProfileService)
    try {
      await this.historyService.logSettingChange(
        tenantId,
        null,
        'identity.level.secondary',
        'identity',
        {
          configured: existing ? true : false,
          schoolName: { old: existing?.schoolName ?? null, new: saved.schoolName },
          schoolAcronym: { old: existing?.schoolAcronym ?? null, new: saved.schoolAcronym },
          slogan: { old: existing?.slogan ?? null, new: saved.slogan },
          phonePrimary: { old: existing?.phonePrimary ?? null, new: saved.phonePrimary },
          phoneSecondary: { old: existing?.phoneSecondary ?? null, new: saved.phoneSecondary },
          whatsapp: { old: existing?.whatsapp ?? null, new: saved.whatsapp },
          email: { old: existing?.email ?? null, new: saved.email },
          website: { old: existing?.website ?? null, new: saved.website },
          address: { old: existing?.address ?? null, new: saved.address },
          city: { old: existing?.city ?? null, new: saved.city },
          department: { old: existing?.department ?? null, new: saved.department },
          postalCode: { old: existing?.postalCode ?? null, new: saved.postalCode },
          logoUrl: { old: existing?.logoUrl ?? null, new: saved.logoUrl },
          changeReason: { old: existing ? 'override' : null, new: dto.changeReason ?? 'configuration identité secondaire' },
        },
        userId || "unknown",
      );
    } catch {
      // audit non bloquant
    }

    return { configured: true, profile: this.format(saved) };
  }

  /**
   * DELETE /settings/identity/secondary — retour à l'identité unique partagée
   * (le secondaire reprend le nom/contacts/logo maternelle-primaire).
   */
  async deleteSecondaryProfile(tenantId: string, userId: string | null, reason?: string) {
    const existing = await this.findExisting(tenantId);
    if (!existing) {
      return { configured: false, profile: null, message: "Aucune identité secondaire configurée — rien à supprimer." };
    }
    await this.prisma.tenantLevelIdentityProfile.delete({ where: { id: existing.id } });
    invalidateLevelIdentityCache(tenantId);
    try {
      await this.historyService.logSettingChange(
        tenantId,
        null,
        'identity.level.secondary',
        'identity',
        {
          configured: { old: true, new: false },
          schoolName: { old: existing.schoolName, new: null },
          changeReason: { old: null, new: reason ?? 'retour à l’identité unique (maternelle/primaire)' },
        },
        userId || "unknown",
      );
    } catch {
      // audit non bloquant
    }
    return {
      configured: false,
      profile: null,
      message: "Identité secondaire supprimée — le secondaire partage désormais l'identité de l'établissement.",
    };
  }
}
