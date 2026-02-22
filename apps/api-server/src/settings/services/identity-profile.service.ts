import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';

/**
 * ============================================================================
 * SERVICE IDENTITÉ ÉTABLISSEMENT — SOURCE LÉGALE DE VÉRITÉ
 * ============================================================================
 * 
 * Ce service gère l'identité institutionnelle versionnée de chaque tenant.
 * 
 * RÈGLES MÉTIER :
 * - Chaque modification crée une NOUVELLE VERSION (pas de mise à jour en place)
 * - Un seul profil actif par tenant à tout moment
 * - Les anciennes versions sont conservées pour validité légale des documents
 * - Aucune suppression physique (soft delete uniquement)
 * - Audit log obligatoire sur toutes les opérations
 */
@Injectable()
export class IdentityProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
  ) {}

  /**
   * Récupère le profil d'identité actif du tenant
   */
  async getActiveProfile(tenantId: string) {
    const profile = await this.prisma.tenantIdentityProfile.findFirst({
      where: { tenantId, isActive: true },
    });

    if (!profile) {
      return null;
    }

    return this.formatProfile(profile);
  }

  /**
   * Récupère un profil par son ID
   */
  async getProfileById(tenantId: string, profileId: string) {
    const profile = await this.prisma.tenantIdentityProfile.findFirst({
      where: { id: profileId, tenantId },
    });

    if (!profile) {
      throw new NotFoundException('Profil d\'identité non trouvé');
    }

    return this.formatProfile(profile);
  }

  /**
   * Récupère l'historique complet des versions
   */
  async getVersionHistory(tenantId: string, options?: { limit?: number; offset?: number }) {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const [profiles, total] = await Promise.all([
      this.prisma.tenantIdentityProfile.findMany({
        where: { tenantId },
        orderBy: { version: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.tenantIdentityProfile.count({ where: { tenantId } }),
    ]);

    return {
      versions: profiles.map(p => this.formatProfile(p)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Crée une nouvelle version du profil d'identité
   * Ceci désactive automatiquement la version précédente
   */
  async createNewVersion(
    tenantId: string,
    data: CreateIdentityProfileDto,
    userId: string,
    changeReason?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const now = new Date();

    // Récupérer la version actuelle pour incrémenter
    const currentVersion = await this.prisma.tenantIdentityProfile.findFirst({
      where: { tenantId },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (currentVersion?.version || 0) + 1;

    // Transaction : désactiver l'ancienne, créer la nouvelle
    const newProfile = await this.prisma.$transaction(async (tx) => {
      // Désactiver l'ancienne version active
      if (currentVersion?.isActive) {
        await tx.tenantIdentityProfile.update({
          where: { id: currentVersion.id },
          data: {
            isActive: false,
            deactivatedAt: now,
            deactivatedBy: userId,
          },
        });
      }

      // Payload explicite (même logique que périodes/années) : champs envoyés ou valeur par défaut
      const foundationDate =
        data.foundationDate != null && String(data.foundationDate).trim() !== ''
          ? new Date(data.foundationDate)
          : null;
      const createData = {
        tenantId,
        version: nextVersion,
        isActive: true,
        schoolName: String(data.schoolName ?? '').trim() || (currentVersion?.schoolName ?? 'Établissement'),
        schoolAcronym: data.schoolAcronym != null ? String(data.schoolAcronym).trim() : null,
        schoolType: data.schoolType && String(data.schoolType).trim() ? data.schoolType : 'PRIVEE',
        authorizationNumber: data.authorizationNumber != null ? String(data.authorizationNumber).trim() : null,
        foundationDate,
        slogan: data.slogan != null ? String(data.slogan).trim() : null,
        address: data.address != null ? String(data.address).trim() : null,
        city: data.city != null ? String(data.city).trim() : null,
        department: data.department != null ? String(data.department).trim() : null,
        country: data.country && String(data.country).trim() ? data.country : 'BJ',
        postalCode: data.postalCode != null ? String(data.postalCode).trim() : null,
        phonePrimary: data.phonePrimary != null ? String(data.phonePrimary).trim() : null,
        phoneSecondary: data.phoneSecondary != null ? String(data.phoneSecondary).trim() : null,
        email: data.email != null ? String(data.email).trim() : null,
        website: data.website != null ? String(data.website).trim() : null,
        currency: data.currency && String(data.currency).trim() ? data.currency : 'XOF',
        timezone: data.timezone && String(data.timezone).trim() ? data.timezone : 'Africa/Porto-Novo',
        logoUrl: data.logoUrl != null ? String(data.logoUrl).trim() : null,
        stampUrl: data.stampUrl != null ? String(data.stampUrl).trim() : null,
        directorSignatureUrl: data.directorSignatureUrl != null ? String(data.directorSignatureUrl).trim() : null,
        createdBy: userId,
        activatedAt: now,
        activatedBy: userId,
        changeReason: (changeReason && String(changeReason).trim()) || 'Nouvelle version créée',
      };

      const created = await tx.tenantIdentityProfile.create({
        data: createData as Parameters<typeof tx.tenantIdentityProfile.create>[0]['data'],
      });

      return created;
    });

    // Audit log
    await this.historyService.logSettingChange(
      tenantId,
      newProfile.id,
      'identity.profile',
      'identity',
      {
        oldValue: currentVersion ? { version: currentVersion.version, schoolName: currentVersion.schoolName } : null,
        newValue: { version: nextVersion, schoolName: data.schoolName },
        changeReason,
      },
      userId,
      ipAddress,
      userAgent,
    );

    // Synchroniser avec SchoolSettings pour rétrocompatibilité
    await this.syncToSchoolSettings(tenantId, newProfile);

    return this.formatProfile(newProfile);
  }

  /**
   * Active une version précédente (restauration)
   * Ceci crée une COPIE de l'ancienne version comme nouvelle version active
   */
  async activateVersion(
    tenantId: string,
    profileId: string,
    userId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const profileToActivate = await this.prisma.tenantIdentityProfile.findFirst({
      where: { id: profileId, tenantId },
    });

    if (!profileToActivate) {
      throw new NotFoundException('Version non trouvée');
    }

    if (profileToActivate.isActive) {
      throw new BadRequestException('Cette version est déjà active');
    }

    // Créer une nouvelle version basée sur l'ancienne (restauration)
    const restoredProfile = await this.createNewVersion(
      tenantId,
      {
        schoolName: profileToActivate.schoolName,
        schoolAcronym: profileToActivate.schoolAcronym,
        schoolType: profileToActivate.schoolType,
        authorizationNumber: profileToActivate.authorizationNumber,
        foundationDate: profileToActivate.foundationDate?.toISOString(),
        slogan: profileToActivate.slogan,
        address: profileToActivate.address,
        city: profileToActivate.city,
        department: profileToActivate.department,
        country: profileToActivate.country,
        postalCode: profileToActivate.postalCode,
        phonePrimary: profileToActivate.phonePrimary,
        phoneSecondary: profileToActivate.phoneSecondary,
        email: profileToActivate.email,
        website: profileToActivate.website,
        currency: profileToActivate.currency,
        timezone: profileToActivate.timezone,
        logoUrl: profileToActivate.logoUrl,
        stampUrl: profileToActivate.stampUrl,
        directorSignatureUrl: profileToActivate.directorSignatureUrl,
      },
      userId,
      reason || `Restauration de la version ${profileToActivate.version}`,
      ipAddress,
      userAgent,
    );

    return restoredProfile;
  }

  /**
   * Met à jour les URLs des fichiers uploadés
   * Ceci crée une nouvelle version
   */
  async updateVisuals(
    tenantId: string,
    data: { logoUrl?: string; stampUrl?: string; directorSignatureUrl?: string },
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const current = await this.getActiveProfile(tenantId);

    if (!current) {
      throw new NotFoundException('Aucun profil d\'identité actif');
    }

    // Créer une nouvelle version avec les visuels mis à jour
    return this.createNewVersion(
      tenantId,
      {
        ...current,
        logoUrl: data.logoUrl !== undefined ? data.logoUrl : current.logoUrl,
        stampUrl: data.stampUrl !== undefined ? data.stampUrl : current.stampUrl,
        directorSignatureUrl: data.directorSignatureUrl !== undefined ? data.directorSignatureUrl : current.directorSignatureUrl,
      },
      userId,
      'Mise à jour des visuels officiels',
      ipAddress,
      userAgent,
    );
  }

  /**
   * Compare deux versions
   */
  async compareVersions(tenantId: string, versionA: number, versionB: number) {
    const [profileA, profileB] = await Promise.all([
      this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, version: versionA },
      }),
      this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, version: versionB },
      }),
    ]);

    if (!profileA || !profileB) {
      throw new NotFoundException('Une ou plusieurs versions non trouvées');
    }

    const fieldsToCompare = [
      'schoolName', 'schoolAcronym', 'schoolType', 'authorizationNumber',
      'foundationDate', 'slogan', 'address', 'city', 'department', 'country',
      'postalCode', 'phonePrimary', 'phoneSecondary', 'email', 'website',
      'currency', 'timezone', 'logoUrl', 'stampUrl', 'directorSignatureUrl',
    ];

    const differences: Array<{ field: string; versionA: any; versionB: any }> = [];

    for (const field of fieldsToCompare) {
      const valueA = profileA[field];
      const valueB = profileB[field];
      if (JSON.stringify(valueA) !== JSON.stringify(valueB)) {
        differences.push({ field, versionA: valueA, versionB: valueB });
      }
    }

    return {
      versionA: this.formatProfile(profileA),
      versionB: this.formatProfile(profileB),
      differences,
      totalDifferences: differences.length,
    };
  }

  /**
   * Récupère le profil valide à une date donnée
   * Utile pour les documents historiques
   */
  async getProfileAtDate(tenantId: string, date: Date) {
    const profile = await this.prisma.tenantIdentityProfile.findFirst({
      where: {
        tenantId,
        createdAt: { lte: date },
        OR: [
          { isActive: true },
          { deactivatedAt: { gte: date } },
        ],
      },
      orderBy: { version: 'desc' },
    });

    if (!profile) {
      return null;
    }

    return this.formatProfile(profile);
  }

  /**
   * Génère un aperçu document officiel avec les données d'identité
   */
  async generateDocumentPreview(tenantId: string) {
    const profile = await this.getActiveProfile(tenantId);

    if (!profile) {
      throw new NotFoundException('Aucun profil d\'identité configuré');
    }

    return {
      header: {
        logo: profile.logoUrl,
        schoolName: profile.schoolName,
        acronym: profile.schoolAcronym,
        type: profile.schoolType,
        slogan: profile.slogan,
      },
      contact: {
        address: profile.address,
        city: profile.city,
        department: profile.department,
        country: profile.country,
        phone: profile.phonePrimary,
        email: profile.email,
        website: profile.website,
      },
      legal: {
        authorizationNumber: profile.authorizationNumber,
        foundationDate: profile.foundationDate,
      },
      footer: {
        stamp: profile.stampUrl,
        signature: profile.directorSignatureUrl,
        currency: profile.currency,
        timezone: profile.timezone,
      },
      metadata: {
        version: profile.version,
        generatedAt: new Date(),
      },
    };
  }

  /**
   * Synchronise les données vers SchoolSettings pour rétrocompatibilité
   */
  private async syncToSchoolSettings(tenantId: string, profile: any) {
    await this.prisma.schoolSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        schoolName: profile.schoolName,
        abbreviation: profile.schoolAcronym,
        establishmentType: profile.schoolType,
        authorizationNumber: profile.authorizationNumber,
        foundingDate: profile.foundationDate,
        slogan: profile.slogan,
        address: profile.address,
        city: profile.city,
        department: profile.department,
        country: profile.country,
        postalCode: profile.postalCode,
        phone: profile.phonePrimary,
        secondaryPhone: profile.phoneSecondary,
        email: profile.email,
        website: profile.website,
        currency: profile.currency,
        timezone: profile.timezone,
        logoUrl: profile.logoUrl,
        sealUrl: profile.stampUrl,
        signatureUrl: profile.directorSignatureUrl,
        version: profile.version,
      },
      update: {
        schoolName: profile.schoolName,
        abbreviation: profile.schoolAcronym,
        establishmentType: profile.schoolType,
        authorizationNumber: profile.authorizationNumber,
        foundingDate: profile.foundationDate,
        slogan: profile.slogan,
        address: profile.address,
        city: profile.city,
        department: profile.department,
        country: profile.country,
        postalCode: profile.postalCode,
        phone: profile.phonePrimary,
        secondaryPhone: profile.phoneSecondary,
        email: profile.email,
        website: profile.website,
        currency: profile.currency,
        timezone: profile.timezone,
        logoUrl: profile.logoUrl,
        sealUrl: profile.stampUrl,
        signatureUrl: profile.directorSignatureUrl,
        version: profile.version,
      },
    });
  }

  /**
   * Formate un profil pour l'API
   */
  private formatProfile(profile: any) {
    return {
      id: profile.id,
      tenantId: profile.tenantId,
      version: profile.version,
      isActive: profile.isActive,
      schoolName: profile.schoolName,
      schoolAcronym: profile.schoolAcronym,
      schoolType: profile.schoolType,
      authorizationNumber: profile.authorizationNumber,
      foundationDate: profile.foundationDate,
      slogan: profile.slogan,
      address: profile.address,
      city: profile.city,
      department: profile.department,
      country: profile.country,
      postalCode: profile.postalCode,
      phonePrimary: profile.phonePrimary,
      phoneSecondary: profile.phoneSecondary,
      email: profile.email,
      website: profile.website,
      currency: profile.currency,
      timezone: profile.timezone,
      logoUrl: profile.logoUrl,
      stampUrl: profile.stampUrl,
      directorSignatureUrl: profile.directorSignatureUrl,
      createdBy: profile.createdBy,
      createdAt: profile.createdAt,
      activatedAt: profile.activatedAt,
      activatedBy: profile.activatedBy,
      deactivatedAt: profile.deactivatedAt,
      changeReason: profile.changeReason,
    };
  }
}

// DTO pour la création d'un profil
interface CreateIdentityProfileDto {
  schoolName: string;
  schoolAcronym?: string;
  schoolType?: string;
  authorizationNumber?: string;
  foundationDate?: string;
  slogan?: string;
  address?: string;
  city?: string;
  department?: string;
  country?: string;
  postalCode?: string;
  phonePrimary?: string;
  phoneSecondary?: string;
  email?: string;
  website?: string;
  currency?: string;
  timezone?: string;
  logoUrl?: string;
  stampUrl?: string;
  directorSignatureUrl?: string;
}
